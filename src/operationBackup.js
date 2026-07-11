const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');
const { getKoreanDateString } = require('./pointsRepository');
const { formatTimestampForFilename } = require('./exportUtils');
const { saveJsonFileAtomic } = require('./jsonStorage');
const { getOperationDataPaths, isProductionDataStrict } = require('./operationDataPaths');

const DEFAULT_STATE_PATH = getOperationDataPaths().operationBackupState;
const SNAPSHOT_SCHEMA_VERSION = 2;
const DEFAULT_BACKUP_TIME_KST = '21:00';
const MAX_BACKUP_BYTES = Math.floor(7.5 * 1024 * 1024);
const MAX_STATE_RECORDS = 30;
const STRICT_REQUIRED_KEYS = new Set([
  'points',
  'shopItems',
  'redemptions',
  'missions',
  'submissions',
]);

let schedulerStarted = false;

function isOperationBackupAutoEnabled() {
  return String(process.env.OPERATION_BACKUP_AUTO_ENABLED || '').trim().toLowerCase() === 'true';
}

function getOperationBackupChannelId() {
  return process.env.OPERATION_BACKUP_CHANNEL_ID || process.env.LOG_CHANNEL_ID || '';
}

function getOperationBackupTimeKst() {
  const configuredTime = String(process.env.OPERATION_BACKUP_TIME_KST || DEFAULT_BACKUP_TIME_KST).trim();
  const match = configuredTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return { hours: 21, minutes: 0 };
  }

  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function getDefaultSnapshotPaths() {
  const paths = getOperationDataPaths();
  return {
    points: paths.points,
    shopItems: paths.shopItems,
    redemptions: paths.redemptions,
    missions: paths.missions,
    missionTemplates: paths.missionTemplates,
    submissions: paths.submissions,
    reactionApprovals: paths.reactionApprovals,
    operatorSupport: paths.operatorSupport,
    dailyMissionAnnouncements: paths.dailyMissionAnnouncements,
    adminAudit: paths.adminAudit,
    opsReminders: paths.opsReminders,
    dmChatLogs: paths.dmChatLogs,
    dmCleanupState: paths.dmCleanupState,
    dmSafetyReviews: paths.dmSafetyReviews,
    dungeonworldLogs: paths.dungeonworldLogs,
    dungeonworldConfig: paths.dungeonworldConfig,
    webgameLinks: paths.webgameLinks,
    webgameScores: paths.webgameScores,
    webgameSocial: paths.webgameSocial,
  };
}

function getBackupPolicies() {
  return {
    webgameReplayMismatch: { excludedByPolicy: true },
    operationBackupState: { excludedByPolicy: true },
  };
}

function readSnapshotFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(`운영 백업 스냅샷 파일을 읽지 못했습니다 (${filePath}):`, error.message);
    return null;
  }
}

function collectBackupSnapshot(paths = {}, options = {}) {
  const resolvedPaths = {
    ...getDefaultSnapshotPaths(),
    ...paths,
  };
  const now = options.now || new Date();
  const files = {};
  const manifest = {};

  for (const [key, filePath] of Object.entries(resolvedPaths)) {
    files[key] = readSnapshotFile(filePath);
    const exists = Boolean(filePath && fs.existsSync(filePath));
    manifest[key] = {
      included: files[key] !== null,
      missing: !exists || files[key] === null,
      excludedByPolicy: false,
      requiredForStrict: STRICT_REQUIRED_KEYS.has(key),
      byteSize: exists ? fs.statSync(filePath).size : 0,
    };
  }

  for (const [key] of Object.entries(getBackupPolicies())) {
    manifest[key] = {
      included: false,
      missing: false,
      excludedByPolicy: true,
      requiredForStrict: false,
      byteSize: 0,
    };
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    generatedDateKst: getKoreanDateString(now),
    trigger: options.trigger || 'scheduled',
    files,
    manifest,
  };
}

function buildBackupFilename(now = new Date()) {
  return `operation-backup-${formatTimestampForFilename(now)}.json`;
}

function createEmptyState() {
  return {
    isExample: false,
    description: 'Local automated operation backup send history.',
    records: [],
  };
}

function readBackupState(statePath) {
  if (!fs.existsSync(statePath)) {
    return createEmptyState();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      ...createEmptyState(),
      ...parsed,
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch (error) {
    console.warn('운영 백업 발송 기록을 읽지 못했습니다:', error.message);
    return createEmptyState();
  }
}

function saveBackupState(statePath, state) {
  saveJsonFileAtomic(statePath, {
    ...state,
    records: state.records.slice(-MAX_STATE_RECORDS),
  });
}

function hasBackupBeenSentForDate(state, dateString) {
  return state.records.some((record) => record.date === dateString);
}

async function fetchBackupChannel(client, channelId) {
  if (!client || !client.channels || !channelId) {
    return null;
  }

  if (client.channels.cache && typeof client.channels.cache.get === 'function') {
    const cachedChannel = client.channels.cache.get(channelId);
    if (cachedChannel) {
      return cachedChannel;
    }
  }

  if (typeof client.channels.fetch === 'function') {
    return client.channels.fetch(channelId);
  }

  return null;
}

async function sendOperationBackup(client, options = {}) {
  const now = options.now || new Date();
  const trigger = options.trigger || 'scheduled';
  const statePath = options.statePath || DEFAULT_STATE_PATH;
  const channelId = options.channelId || getOperationBackupChannelId();

  if (!channelId) {
    console.warn('운영 자동 백업 채널이 설정되지 않아 백업을 건너뜁니다. OPERATION_BACKUP_CHANNEL_ID 또는 LOG_CHANNEL_ID를 확인해 주세요.');
    return { ok: false, reason: 'MISSING_CHANNEL_ID' };
  }

  const dateString = getKoreanDateString(now);
  const state = readBackupState(statePath);

  if (hasBackupBeenSentForDate(state, dateString)) {
    return { ok: false, reason: 'ALREADY_SENT_TODAY' };
  }

  const snapshot = collectBackupSnapshot(options.paths || {}, { now, trigger });
  const missingRequired = Object.entries(snapshot.manifest)
    .filter(([, entry]) => entry.missing && entry.requiredForStrict)
    .map(([key]) => key);
  if (isProductionDataStrict() && missingRequired.length > 0) {
    console.warn(`운영 자동 백업 strict 점검 실패: 필수 파일 ${missingRequired.length}개 누락`);
    return { ok: false, reason: 'MISSING_REQUIRED_FILES', missingCount: missingRequired.length };
  }
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  const byteSize = Buffer.byteLength(serialized, 'utf8');

  let channel = null;
  try {
    channel = await fetchBackupChannel(client, channelId);
  } catch (error) {
    console.warn('운영 자동 백업 채널 조회 실패:', `${error.message} / 확인 위치: OPERATION_BACKUP_CHANNEL_ID, Discord 채널 권한`);
    return { ok: false, reason: 'CHANNEL_FETCH_FAILED' };
  }

  if (!channel || typeof channel.send !== 'function') {
    console.warn('운영 자동 백업 채널을 찾을 수 없거나 전송할 수 없습니다. 확인 위치: OPERATION_BACKUP_CHANNEL_ID, LOG_CHANNEL_ID, Discord 채널 권한');
    return { ok: false, reason: 'CHANNEL_NOT_FOUND' };
  }

  if (byteSize > MAX_BACKUP_BYTES) {
    console.warn(`운영 자동 백업 크기 초과로 업로드를 건너뜁니다: ${byteSize} bytes. /운영내보내기로 수동 백업을 진행해 주세요.`);
    try {
      await channel.send({
        content: [
          '운영 자동 백업 실패: 스냅샷 크기가 업로드 한도를 초과했습니다.',
          `- 크기: ${byteSize} bytes (한도 ${MAX_BACKUP_BYTES} bytes)`,
          '- `/운영내보내기 종류:전체 형식:JSON`으로 수동 백업을 진행해 주세요.',
        ].join('\n'),
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.warn('운영 자동 백업 크기 초과 알림 전송 실패:', error.message);
    }
    return { ok: false, reason: 'SNAPSHOT_TOO_LARGE', byteSize };
  }

  const filename = buildBackupFilename(now);
  const manifestEntries = Object.values(snapshot.manifest);
  const includedFileCount = manifestEntries.filter((entry) => entry.included).length;
  const excludedFileCount = manifestEntries.filter((entry) => entry.excludedByPolicy).length;
  const missingFileCount = manifestEntries.filter((entry) => entry.missing).length;

  let message = null;
  try {
    message = await channel.send({
      content: [
        `운영 데이터 자동 백업 (${snapshot.generatedDateKst})`,
        '- 이 파일에는 사용자 ID와 인증 원문이 포함됩니다. 채널 외부로 공유하지 마세요.',
        '- 복원: `node scripts/restore-operation-backup.js <파일> --apply`',
      ].join('\n'),
      files: [new AttachmentBuilder(Buffer.from(serialized, 'utf8'), { name: filename })],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.warn('운영 자동 백업 업로드 실패:', `${error.message} / 확인 위치: OPERATION_BACKUP_CHANNEL_ID, Discord 채널 권한`);
    return { ok: false, reason: 'SEND_FAILED' };
  }

  const record = {
    date: dateString,
    sentAt: now.toISOString(),
    trigger,
    messageId: message && message.id ? message.id : null,
    filename,
    byteSize,
    includedFileCount,
    excludedFileCount,
    missingFileCount,
  };

  saveBackupState(statePath, {
    ...state,
    records: [...state.records, record],
  });

  return { ok: true, reason: 'SENT', record, filename };
}

function getNextBackupDelayMs(now = new Date()) {
  const { hours, minutes } = getOperationBackupTimeKst();
  const nowKst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const targetKst = new Date(Date.UTC(
    nowKst.getUTCFullYear(),
    nowKst.getUTCMonth(),
    nowKst.getUTCDate(),
    hours,
    minutes,
    0,
    0
  ));

  if (targetKst.getTime() <= nowKst.getTime()) {
    targetKst.setUTCDate(targetKst.getUTCDate() + 1);
  }

  return targetKst.getTime() - nowKst.getTime();
}

function hasTodayScheduledTimePassed(now = new Date()) {
  const { hours, minutes } = getOperationBackupTimeKst();
  const nowKst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayTargetKst = Date.UTC(
    nowKst.getUTCFullYear(),
    nowKst.getUTCMonth(),
    nowKst.getUTCDate(),
    hours,
    minutes,
    0,
    0
  );

  return nowKst.getTime() >= todayTargetKst;
}

async function runCatchUpBackupIfNeeded(client, options = {}) {
  const now = options.now || new Date();

  if (!hasTodayScheduledTimePassed(now)) {
    return { ok: false, reason: 'NOT_DUE_YET' };
  }

  return sendOperationBackup(client, { ...options, now, trigger: 'catchUp' });
}

function startOperationBackupScheduler(client, options = {}) {
  if (!isOperationBackupAutoEnabled()) {
    return { ok: false, reason: 'DISABLED' };
  }

  if (!getOperationBackupChannelId()) {
    console.warn('운영 자동 백업이 켜져 있지만 채널이 없어 스케줄러를 시작하지 않습니다. OPERATION_BACKUP_CHANNEL_ID 또는 LOG_CHANNEL_ID를 설정해 주세요.');
    return { ok: false, reason: 'MISSING_CHANNEL_ID' };
  }

  if (schedulerStarted) {
    return { ok: false, reason: 'ALREADY_STARTED' };
  }

  schedulerStarted = true;

  const scheduleNext = () => {
    const delay = getNextBackupDelayMs();
    const timer = setTimeout(async () => {
      try {
        await sendOperationBackup(client, { ...options, trigger: 'scheduled' });
      } catch (error) {
        console.warn('운영 자동 백업 처리 실패:', error.message);
      }
      scheduleNext();
    }, delay);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    return timer;
  };

  runCatchUpBackupIfNeeded(client, options).catch((error) => {
    console.warn('운영 자동 백업 부팅 캐치업 실패:', error.message);
  });

  return { ok: true, reason: 'STARTED', timer: scheduleNext() };
}

module.exports = {
  DEFAULT_STATE_PATH,
  MAX_BACKUP_BYTES,
  SNAPSHOT_SCHEMA_VERSION,
  STRICT_REQUIRED_KEYS,
  buildBackupFilename,
  collectBackupSnapshot,
  getDefaultSnapshotPaths,
  getBackupPolicies,
  getNextBackupDelayMs,
  getOperationBackupChannelId,
  getOperationBackupTimeKst,
  hasBackupBeenSentForDate,
  hasTodayScheduledTimePassed,
  isOperationBackupAutoEnabled,
  runCatchUpBackupIfNeeded,
  sendOperationBackup,
  startOperationBackupScheduler,
};

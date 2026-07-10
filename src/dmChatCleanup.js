const fs = require('fs');
const path = require('path');
const { saveJsonFileAtomic } = require('./jsonStorage');
const { getOperationDataPaths } = require('./operationDataPaths');

const DEFAULT_RETENTION_DAYS = 90;
const SAFETY_RECORD_RETENTION_DAYS = 180;
const DEFAULT_CLEANUP_WEEKDAY = 'sunday';
const DEFAULT_CLEANUP_TIME_KST = '04:00';
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
let schedulerStarted = false;
const schedulerAttemptedWeeks = new Set();

function getRetentionDays(env = process.env) {
  const parsed = Number.parseInt(env.DM_CHAT_RETENTION_DAYS || `${DEFAULT_RETENTION_DAYS}`, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_RETENTION_DAYS;
}

function isSafetyRecord(message) {
  return Boolean(message && message.safetyDetection);
}

function getMessageAgeDays(message, now) {
  const messageTime = new Date(message && message.createdAt).getTime();
  return Number.isNaN(messageTime) ? 0 : (now - messageTime) / (24 * 60 * 60 * 1000);
}

function isMessageExpired(message, now, retentionDays) {
  const ageDays = getMessageAgeDays(message, now);
  const limitDays = isSafetyRecord(message) ? SAFETY_RECORD_RETENTION_DAYS : retentionDays;
  if (limitDays === 0 && !isSafetyRecord(message)) return false;
  return ageDays > limitDays;
}

function runRetentionCleanup(data, { now, retentionDays }) {
  const expired = [];
  const kept = [];
  for (const message of data.messages) {
    (isMessageExpired(message, now, retentionDays) ? expired : kept).push(message);
  }
  return { nextData: { ...data, messages: kept }, removedCount: expired.length, remainingCount: kept.length };
}

function runUserDeletion(data, userId) {
  const beforeMessages = data.messages.length;
  const beforeNotices = data.notices.length;
  const beforeResets = data.historyResets.length;
  const beforeScenarios = Array.isArray(data.activeScenarios) ? data.activeScenarios.length : 0;
  const nextData = {
    ...data,
    messages: data.messages.filter((message) => message.userId !== userId),
    notices: data.notices.filter((notice) => notice.userId !== userId),
    historyResets: data.historyResets.filter((reset) => reset.userId !== userId),
    activeScenarios: (data.activeScenarios || []).filter((scenario) => scenario.userId !== userId),
  };
  return {
    nextData,
    removed: {
      messages: beforeMessages - nextData.messages.length,
      notices: beforeNotices - nextData.notices.length,
      historyResets: beforeResets - nextData.historyResets.length,
      activeScenarios: beforeScenarios - nextData.activeScenarios.length,
    },
  };
}

function createBackupCopy(logPath, data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = path.basename(logPath, path.extname(logPath));
  const backupPath = path.join(path.dirname(logPath), `${baseName}.backup-${timestamp}.json`);
  saveJsonFileAtomic(backupPath, data);
  return backupPath;
}

function getCleanupConfig(env = process.env, warn = console.warn) {
  let weekday = String(env.DM_CHAT_CLEANUP_WEEKDAY || DEFAULT_CLEANUP_WEEKDAY).trim().toLowerCase();
  let time = String(env.DM_CHAT_CLEANUP_TIME_KST || DEFAULT_CLEANUP_TIME_KST).trim();
  if (!WEEKDAYS.includes(weekday)) {
    warn(`[dm-cleanup] 잘못된 요일 값으로 기본값 ${DEFAULT_CLEANUP_WEEKDAY}을 사용합니다.`);
    weekday = DEFAULT_CLEANUP_WEEKDAY;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    warn(`[dm-cleanup] 잘못된 시각 값으로 기본값 ${DEFAULT_CLEANUP_TIME_KST}을 사용합니다.`);
    time = DEFAULT_CLEANUP_TIME_KST;
  }
  return {
    enabled: String(env.DM_CHAT_CLEANUP_AUTO_ENABLED || '').trim().toLowerCase() === 'true',
    weekday,
    time,
  };
}

function getKstParts(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: kst.getUTCFullYear(), month: kst.getUTCMonth(), date: kst.getUTCDate(),
    weekday: WEEKDAYS[kst.getUTCDay()], hours: kst.getUTCHours(), minutes: kst.getUTCMinutes(),
  };
}

function getWeekKey(now = new Date()) {
  const parts = getKstParts(now);
  const date = new Date(Date.UTC(parts.year, parts.month, parts.date));
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function loadCleanupState(statePath) {
  if (!fs.existsSync(statePath)) return { version: 1, isExample: false, records: [] };
  const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  return { version: 1, isExample: false, ...parsed, records: Array.isArray(parsed.records) ? parsed.records : [] };
}

function saveCleanupRecord(statePath, state, record) {
  saveJsonFileAtomic(statePath, { ...state, records: [...state.records, record].slice(-52) });
  return record;
}

function persistCleanupRecord(options, statePath, state, record, details = {}) {
  try {
    (options.saveStateRecord || saveCleanupRecord)(statePath, state, record);
    return null;
  } catch (error) {
    return {
      ok: false,
      reason: details.applied ? 'STATE_WRITE_FAILED_AFTER_APPLY' : 'STATE_WRITE_FAILED',
      originalReason: record.reason || null,
      applied: details.applied === true,
      removedCount: Number(record.removedCount || 0),
      cutoffAt: record.cutoffAt || null,
      mode: 'automatic',
    };
  }
}

function runAutomaticCleanup(options = {}) {
  const env = options.env || process.env;
  const now = options.now || new Date();
  const paths = options.paths || getOperationDataPaths(env);
  const retentionDays = getRetentionDays(env);
  if (retentionDays === 0) return { ok: false, reason: 'RETENTION_DISABLED', removedCount: 0 };
  const cutoffAt = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  let state;
  try {
    state = loadCleanupState(paths.dmCleanupState);
  } catch (error) {
    return { ok: false, reason: 'STATE_PARSE_FAILED', removedCount: 0 };
  }
  const weekKey = getWeekKey(now);
  if (state.records.some((record) => record.weekKey === weekKey)) {
    return { ok: false, reason: 'ALREADY_RAN_THIS_WEEK', removedCount: 0 };
  }
  if (!fs.existsSync(paths.dmChatLogs)) return { ok: false, reason: 'NO_LOG_FILE', removedCount: 0 };

  let data;
  try {
    data = JSON.parse(fs.readFileSync(paths.dmChatLogs, 'utf8'));
    if (!data || !Array.isArray(data.messages)) throw new Error('messages array missing');
  } catch (error) {
    const record = { weekKey, ranAt: now.toISOString(), ok: false, reason: 'LOG_PARSE_FAILED', removedCount: 0, cutoffAt, mode: 'automatic' };
    return persistCleanupRecord(options, paths.dmCleanupState, state, record) || record;
  }

  const result = runRetentionCleanup(data, { now, retentionDays });
  const totalCount = data.messages.length;
  const removalRatio = totalCount ? result.removedCount / totalCount : 0;
  if (removalRatio > 0.5) {
    const record = { weekKey, ranAt: now.toISOString(), ok: false, reason: 'REMOVAL_RATIO_EXCEEDED', removedCount: result.removedCount, removalRatio, cutoffAt, mode: 'automatic' };
    return persistCleanupRecord(options, paths.dmCleanupState, state, record) || record;
  }
  if (result.removedCount === 0) {
    const record = { weekKey, ranAt: now.toISOString(), ok: true, reason: 'NO_CHANGES', removedCount: 0, cutoffAt, mode: 'automatic' };
    const stateFailure = persistCleanupRecord(options, paths.dmCleanupState, state, record);
    return stateFailure || record;
  }

  let backupPath;
  try {
    backupPath = (options.createBackupCopy || createBackupCopy)(paths.dmChatLogs, data);
  } catch (error) {
    const record = { weekKey, ranAt: now.toISOString(), ok: false, reason: 'BACKUP_FAILED', removedCount: result.removedCount, cutoffAt, mode: 'automatic' };
    return persistCleanupRecord(options, paths.dmCleanupState, state, record) || record;
  }

  try {
    (options.saveLog || saveJsonFileAtomic)(paths.dmChatLogs, result.nextData);
  } catch (error) {
    const record = { weekKey, ranAt: now.toISOString(), ok: false, reason: 'APPLY_FAILED', removedCount: result.removedCount, cutoffAt, mode: 'automatic' };
    return persistCleanupRecord(options, paths.dmCleanupState, state, record) || record;
  }
  const record = { weekKey, ranAt: now.toISOString(), ok: true, reason: 'APPLIED', removedCount: result.removedCount, cutoffAt, mode: 'automatic' };
  const stateFailure = persistCleanupRecord(options, paths.dmCleanupState, state, record, { applied: true });
  return stateFailure || { ...record, applied: true, backupPath };
}

async function notifyCleanupResult(client, result) {
  const channelId = process.env.DM_CHAT_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
  if (!channelId || !client || !client.channels || typeof client.channels.fetch !== 'function') return false;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || typeof channel.send !== 'function') return false;
    await channel.send({
      content: `DM 로그 자동 정리 ${result.ok ? '완료' : '확인 필요'} · 삭제 ${result.removedCount || 0}건 · 기준 ${result.cutoffAt || '해당 없음'} · 실행 automatic · 결과 ${result.reason}`,
      allowedMentions: { parse: [] },
    });
    return true;
  } catch (error) {
    console.warn('[dm-cleanup] 운영 알림 전송 실패:', error.message);
    return false;
  }
}

function isCleanupDue(now, config) {
  const parts = getKstParts(now);
  const [hours, minutes] = config.time.split(':').map(Number);
  return parts.weekday === config.weekday && (parts.hours > hours || (parts.hours === hours && parts.minutes >= minutes));
}

async function runCleanupSchedulerCheck(client, config, options = {}) {
  const now = options.now instanceof Date
    ? options.now
    : (typeof options.now === 'function' ? options.now() : new Date());
  if (!isCleanupDue(now, config)) return { ok: false, reason: 'NOT_DUE' };
  const weekKey = getWeekKey(now);
  if (schedulerAttemptedWeeks.has(weekKey)) return { ok: false, reason: 'ALREADY_ATTEMPTED_IN_PROCESS' };
  schedulerAttemptedWeeks.add(weekKey);

  let result;
  try {
    result = runAutomaticCleanup({ ...options, now });
  } catch (error) {
    result = { ok: false, reason: 'STATE_WRITE_FAILED', removedCount: 0 };
  }
  if (result.reason !== 'ALREADY_RAN_THIS_WEEK') await notifyCleanupResult(client, result);
  return result;
}

function resetDmChatCleanupSchedulerForTest() {
  schedulerStarted = false;
  schedulerAttemptedWeeks.clear();
}

function startDmChatCleanupScheduler(client, options = {}) {
  const config = getCleanupConfig(options.env || process.env);
  if (!config.enabled) return { ok: false, reason: 'DISABLED' };
  if (schedulerStarted) return { ok: false, reason: 'ALREADY_STARTED' };
  schedulerStarted = true;
  const check = async () => {
    const now = options.now ? options.now() : new Date();
    await runCleanupSchedulerCheck(client, config, { ...options, now });
  };
  check().catch((error) => console.warn('[dm-cleanup] 부팅 점검 실패:', error.message));
  const timer = setInterval(() => check().catch((error) => console.warn('[dm-cleanup] 예약 실행 실패:', error.message)), 15 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
  return { ok: true, reason: 'STARTED', timer };
}

module.exports = {
  DEFAULT_CLEANUP_TIME_KST,
  DEFAULT_CLEANUP_WEEKDAY,
  SAFETY_RECORD_RETENTION_DAYS,
  WEEKDAYS,
  createBackupCopy,
  getCleanupConfig,
  getRetentionDays,
  getWeekKey,
  isCleanupDue,
  isMessageExpired,
  loadCleanupState,
  notifyCleanupResult,
  persistCleanupRecord,
  runAutomaticCleanup,
  runCleanupSchedulerCheck,
  runRetentionCleanup,
  runUserDeletion,
  saveCleanupRecord,
  resetDmChatCleanupSchedulerForTest,
  startDmChatCleanupScheduler,
};

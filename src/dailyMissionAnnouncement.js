const fs = require('fs');
const path = require('path');
const { getKoreanDateString } = require('./pointsRepository');
const { saveJsonFileAtomic } = require('./jsonStorage');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_ANNOUNCEMENT_HOUR = 9;
const DEFAULT_INTERVAL_MS = 60 * 1000;
const DEFAULT_STATE_PATH = path.join(DATA_DIR, 'daily-mission-announcements.local.json');

let schedulerStarted = false;
let warnedMissingAnnouncementChannel = false;

function isDailyMissionAnnouncementEnabled() {
  return process.env.DAILY_MISSION_ANNOUNCEMENT_ENABLED === 'true';
}

function getDailyMissionAnnouncementChannelId() {
  return process.env.DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID || process.env.TODAY_MISSION_CHANNEL_ID || '';
}

function getDailyMissionAnnouncementHour() {
  const parsed = Number.parseInt(process.env.DAILY_MISSION_ANNOUNCEMENT_HOUR || String(DEFAULT_ANNOUNCEMENT_HOUR), 10);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
    return DEFAULT_ANNOUNCEMENT_HOUR;
  }

  return parsed;
}

function getKoreanHour(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.getUTCHours();
}

function buildDailyMissionAnnouncementMessage() {
  return {
    content: [
      '오늘의 미션 안내',
      '- 오늘의 미션은 사진으로 인증해주세요.',
      '- #오늘의-미션 채널에 사진 업로드하면 접수됩니다.',
      '- 운영자가 확인하면 포인트 지급됩니다.',
      '- 포인트는 하루 1회만 지급됩니다.',
    ].join('\n'),
    allowedMentions: { parse: [] },
  };
}

function createEmptyState() {
  return {
    isExample: false,
    description: 'Local daily mission announcement send history.',
    records: [],
  };
}

function readState(statePath) {
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
    console.warn('오늘의 미션 안내 발송 기록을 읽지 못했습니다:', error.message);
    return createEmptyState();
  }
}

function saveState(statePath, state) {
  saveJsonFileAtomic(statePath, state);
}

function hasAnnouncementBeenSentForDate(state, dateString) {
  return state.records.some((record) => record.date === dateString);
}

async function fetchAnnouncementChannel(client, channelId) {
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

async function sendDailyMissionAnnouncementIfDue(client, options = {}) {
  if (!isDailyMissionAnnouncementEnabled()) {
    return { ok: false, reason: 'DISABLED' };
  }

  const now = options.now || new Date();
  if (getKoreanHour(now) !== getDailyMissionAnnouncementHour()) {
    return { ok: false, reason: 'NOT_SCHEDULED_HOUR' };
  }

  const channelId = getDailyMissionAnnouncementChannelId();
  if (!channelId) {
    if (!warnedMissingAnnouncementChannel) {
      console.warn('오늘의 미션 안내 채널이 설정되지 않아 자동 안내를 건너뜁니다.');
      warnedMissingAnnouncementChannel = true;
    }
    return { ok: false, reason: 'MISSING_CHANNEL_ID' };
  }

  const statePath = options.statePath || DEFAULT_STATE_PATH;
  const dateString = getKoreanDateString(now);
  const state = readState(statePath);

  if (hasAnnouncementBeenSentForDate(state, dateString)) {
    return { ok: false, reason: 'ALREADY_SENT_TODAY' };
  }

  const channel = await fetchAnnouncementChannel(client, channelId);
  if (!channel || typeof channel.send !== 'function') {
    return { ok: false, reason: 'CHANNEL_NOT_FOUND' };
  }

  const message = await channel.send(buildDailyMissionAnnouncementMessage());
  const nextState = {
    ...state,
    records: [
      ...state.records,
      {
        date: dateString,
        channelId,
        messageId: message && message.id ? message.id : null,
        sentAt: now.toISOString(),
      },
    ],
  };

  saveState(statePath, nextState);

  return { ok: true, reason: 'SENT', record: nextState.records[nextState.records.length - 1] };
}

function startDailyMissionAnnouncementScheduler(client, options = {}) {
  if (schedulerStarted) {
    return { ok: false, reason: 'ALREADY_STARTED' };
  }

  schedulerStarted = true;
  const intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
  const run = async () => {
    try {
      await sendDailyMissionAnnouncementIfDue(client, options);
    } catch (error) {
      console.warn('오늘의 미션 자동 안내 처리 실패:', error.message);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  return { ok: true, reason: 'STARTED', timer };
}

module.exports = {
  buildDailyMissionAnnouncementMessage,
  getDailyMissionAnnouncementChannelId,
  getDailyMissionAnnouncementHour,
  getKoreanHour,
  hasAnnouncementBeenSentForDate,
  isDailyMissionAnnouncementEnabled,
  sendDailyMissionAnnouncementIfDue,
  startDailyMissionAnnouncementScheduler,
};

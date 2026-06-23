const { createPointsRepository, getKoreanDateString } = require('./pointsRepository');
const { buildTodayMissionNoticePayload } = require('./handlers');

const DEFAULT_AUTO_PUBLISH_HOUR = 9;
const DEFAULT_INTERVAL_MS = 60 * 1000;

let schedulerStarted = false;
let warnedMissingChannel = false;

function isTodayMissionAutoPublishEnabled() {
  return process.env.TODAY_MISSION_AUTO_PUBLISH_ENABLED === 'true';
}

function getTodayMissionAutoPublishHour() {
  const parsed = Number.parseInt(process.env.TODAY_MISSION_AUTO_PUBLISH_HOUR || String(DEFAULT_AUTO_PUBLISH_HOUR), 10);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
    return DEFAULT_AUTO_PUBLISH_HOUR;
  }

  return parsed;
}

function getKoreanHour(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.getUTCHours();
}

async function fetchConfiguredChannel(client, channelId) {
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

async function publishTodayMissionIfDue(client, options = {}) {
  if (!isTodayMissionAutoPublishEnabled()) {
    return { ok: false, reason: 'DISABLED' };
  }

  const now = options.now || new Date();
  if (getKoreanHour(now) !== getTodayMissionAutoPublishHour()) {
    return { ok: false, reason: 'NOT_SCHEDULED_HOUR' };
  }

  const repository = options.repository || createPointsRepository();
  const dateString = getKoreanDateString(now);
  const mission = repository.findTodayActiveMission(dateString);
  if (!mission) {
    return { ok: false, reason: 'NO_ACTIVE_MISSION' };
  }

  if (repository.hasTodayMissionNoticeBeenPublished(dateString)) {
    return { ok: false, reason: 'ALREADY_PUBLISHED' };
  }

  const channelId = process.env.TODAY_MISSION_CHANNEL_ID || '';
  if (!channelId) {
    if (!warnedMissingChannel) {
      console.warn('TODAY_MISSION_CHANNEL_ID가 설정되지 않아 오늘의 미션 자동 게시를 건너뜁니다.');
      warnedMissingChannel = true;
    }
    return { ok: false, reason: 'MISSING_CHANNEL_ID' };
  }

  const channel = await fetchConfiguredChannel(client, channelId);
  if (!channel || typeof channel.send !== 'function') {
    return { ok: false, reason: 'CHANNEL_NOT_FOUND' };
  }

  const reservation = repository.reserveTodayMissionNoticePublication({
    missionId: mission.id,
    missionTitle: mission.title || null,
    channelId,
    publishedBy: null,
    date: dateString,
  });

  if (!reservation.ok && reservation.reason === 'ALREADY_RESERVED') {
    return { ok: false, reason: 'ALREADY_PUBLISHED' };
  }

  let message;
  try {
    message = await channel.send(buildTodayMissionNoticePayload(mission));
  } catch (error) {
    repository.failTodayMissionNoticePublication(reservation.record.id, error.message);
    return { ok: false, reason: 'SEND_FAILED', error };
  }

  const record = repository.completeTodayMissionNoticePublication(reservation.record.id, {
    messageId: message && message.id ? message.id : null,
    messageUrl: message && message.url ? message.url : null,
  });

  return { ok: true, reason: 'PUBLISHED', record, mission };
}

function startTodayMissionAutoPublishScheduler(client, options = {}) {
  if (schedulerStarted) {
    return { ok: false, reason: 'ALREADY_STARTED' };
  }

  schedulerStarted = true;
  const intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
  const run = async () => {
    try {
      await publishTodayMissionIfDue(client, options);
    } catch (error) {
      console.warn('오늘의 미션 자동 게시 처리 실패:', error.message);
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
  getKoreanHour,
  getTodayMissionAutoPublishHour,
  isTodayMissionAutoPublishEnabled,
  publishTodayMissionIfDue,
  startTodayMissionAutoPublishScheduler,
};

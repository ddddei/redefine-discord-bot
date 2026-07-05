const { EmbedBuilder } = require('discord.js');
const { truncateEmbedValue } = require('./embeds');
const { formatKoreanTime } = require('./logging');

const DEFAULT_SAFETY_ALERT_THROTTLE_MINUTES = 10;
const safetyAlertThrottleState = new Map();

function getSafetyAlertThrottleMinutes() {
  const parsed = Number.parseInt(process.env.SAFETY_ALERT_THROTTLE_MINUTES || `${DEFAULT_SAFETY_ALERT_THROTTLE_MINUTES}`, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_SAFETY_ALERT_THROTTLE_MINUTES;
  }

  return parsed;
}

function getSafetyAlertThrottleMs() {
  return getSafetyAlertThrottleMinutes() * 60 * 1000;
}

function getSafetyAlertThrottleKey(record) {
  return record && record.userId ? record.userId : null;
}

function getTimeMs(value) {
  const date = value ? new Date(value) : new Date();
  const time = date.getTime();
  return Number.isNaN(time) ? Date.now() : time;
}

async function fetchLogChannel(client, channelId, contextLabel) {
  if (!channelId || !client || !client.channels || typeof client.channels.fetch !== 'function') {
    return null;
  }

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel || typeof channel.send !== 'function') {
      console.warn(`${contextLabel} 채널을 찾을 수 없거나 전송할 수 없습니다.`);
      return null;
    }

    return channel;
  } catch (error) {
    console.warn(`${contextLabel} 채널 조회 실패:`, error.message);
    return null;
  }
}

function getSafetyDetectionSourceLabel(record) {
  if (record.safetyDetectionSource === 'output') {
    return '출력 감지';
  }

  return '입력 감지';
}

async function sendDmChatOperatorLog(client, record) {
  const logChannelId = process.env.DM_CHAT_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
  const channel = await fetchLogChannel(client, logChannelId, 'DM 대화 로그');

  if (!channel) {
    return false;
  }

  const embed = new EmbedBuilder()
    .setColor(record.role === 'user' ? 0x6f8fb8 : 0x8f7a5f)
    .setTitle(record.role === 'user' ? 'DM 대화 로그: 참가자' : 'DM 대화 로그: 봇')
    .addFields(
      {
        name: '참가자',
        value: truncateEmbedValue(`${record.displayName || record.userId} (${record.userId})`, 300),
      },
      {
        name: '시간',
        value: formatKoreanTime(record.createdAt ? new Date(record.createdAt) : new Date()),
      },
      {
        name: '내용',
        value: truncateEmbedValue(record.content, 900),
      }
    );

  if (record.safetyDetection) {
    embed.addFields({
      name: '안전 감지',
      value: truncateEmbedValue(`${getSafetyDetectionSourceLabel(record)} / ${record.safetyDetection.category} / ${record.safetyDetection.severity}`, 300),
    });
  }

  if (record.error) {
    embed.addFields({
      name: '오류',
      value: truncateEmbedValue(record.error, 300),
    });
  }

  await channel.send({ embeds: [embed] });
  return true;
}

async function sendDmChatSafetyAlert(client, record, detection, options = {}) {
  const alertChannelId = process.env.SAFETY_ALERT_CHANNEL_ID || process.env.DM_CHAT_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
  const throttleMs = getSafetyAlertThrottleMs();
  const throttleKey = getSafetyAlertThrottleKey(record);
  const nowMs = getTimeMs(options.now);
  const previousState = throttleKey ? safetyAlertThrottleState.get(throttleKey) : null;

  if (throttleMs > 0 && previousState && nowMs - previousState.lastSentAt < throttleMs) {
    safetyAlertThrottleState.set(throttleKey, {
      lastSentAt: previousState.lastSentAt,
      suppressedCount: (previousState.suppressedCount || 0) + 1,
    });
    return false;
  }

  const channel = await fetchLogChannel(client, alertChannelId, 'DM 안전 알림');

  if (!channel) {
    return false;
  }

  const embed = new EmbedBuilder()
    .setColor(0xb85c5c)
    .setTitle('DM 안전 확인 필요')
    .addFields(
      {
        name: '참가자',
        value: truncateEmbedValue(`${record.displayName || record.userId} (${record.userId})`, 300),
      },
      {
        name: '감지 유형',
        value: truncateEmbedValue(detection && detection.category, 300),
      },
      {
        name: '심각도',
        value: truncateEmbedValue(detection && detection.severity, 300),
      },
      {
        name: '감지 시간',
        value: formatKoreanTime(),
      },
      {
        name: 'DM 내용 일부',
        value: truncateEmbedValue(record.content, 900),
      },
      {
        name: '주의',
        value: '키워드 기반 감지이며 자동 판단이 아닙니다. 운영진 확인이 필요합니다.',
      }
    );

  if (previousState && previousState.suppressedCount > 0) {
    embed.addFields({
      name: '스로틀 생략',
      value: `이 알림 전 ${previousState.suppressedCount}건이 스로틀로 생략되었어요. 로그에는 모두 기록됩니다.`,
    });
  }

  await channel.send({ embeds: [embed] });

  if (throttleKey) {
    safetyAlertThrottleState.set(throttleKey, {
      lastSentAt: nowMs,
      suppressedCount: 0,
    });
  }

  return true;
}

function resetDmChatSafetyAlertThrottleForTest() {
  safetyAlertThrottleState.clear();
}

module.exports = {
  resetDmChatSafetyAlertThrottleForTest,
  sendDmChatOperatorLog,
  sendDmChatSafetyAlert,
};

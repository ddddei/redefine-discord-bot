const { EmbedBuilder } = require('discord.js');
const { truncateEmbedValue } = require('./embeds');
const { formatKoreanTime } = require('./logging');

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
      value: truncateEmbedValue(`${record.safetyDetection.category} / ${record.safetyDetection.severity}`, 300),
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

async function sendDmChatSafetyAlert(client, record, detection) {
  const alertChannelId = process.env.SAFETY_ALERT_CHANNEL_ID || process.env.DM_CHAT_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
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

  await channel.send({ embeds: [embed] });
  return true;
}

module.exports = {
  sendDmChatOperatorLog,
  sendDmChatSafetyAlert,
};

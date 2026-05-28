const { EmbedBuilder } = require('discord.js');
const { truncateEmbedValue } = require('./embeds');

function formatKoreanTime(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

async function sendUnansweredQuestionLog(interaction, question) {
  const logChannelId = process.env.LOG_CHANNEL_ID;

  if (!logChannelId) {
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(logChannelId);

    if (!channel || typeof channel.send !== 'function') {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xd6a35f)
      .setTitle('답변하지 못한 질문')
      .addFields(
        {
          name: '질문 내용',
          value: truncateEmbedValue(question),
        },
        {
          name: '시간',
          value: formatKoreanTime(),
        }
      );

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('답변 실패 질문 로그 전송 실패:', error.message);
  }
}

async function sendSensitiveQuestionAlert(interaction, question, detection) {
  const alertChannelId = process.env.SAFETY_ALERT_CHANNEL_ID || process.env.LOG_CHANNEL_ID;

  if (!alertChannelId) {
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(alertChannelId);

    if (!channel || typeof channel.send !== 'function') {
      console.error('민감 질문 알림 채널을 찾을 수 없거나 전송할 수 없습니다.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xb85c5c)
      .setTitle('민감 질문 확인 필요')
      .addFields(
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
          name: '입력 경로',
          value: '/질문',
        },
        {
          name: '질문 일부',
          value: truncateEmbedValue(question, 300),
        },
        {
          name: '주의',
          value: '키워드 기반 감지이며 자동 판단이 아닙니다. 운영진 확인이 필요합니다.',
        }
      );

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('민감 질문 알림 전송 실패:', error.message);
  }
}

async function sendMissionSubmissionReviewAlert(interaction, submission, mission) {
  const alertChannelId = process.env.ACTIVITY_REVIEW_CHANNEL_ID || process.env.LOG_CHANNEL_ID;

  if (!alertChannelId) {
    console.warn('인증 검토 알림 채널이 설정되지 않아 알림을 건너뜁니다.');
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(alertChannelId);

    if (!channel || typeof channel.send !== 'function') {
      console.warn('인증 검토 알림 채널을 찾을 수 없거나 전송할 수 없습니다.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x8f7a5f)
      .setTitle('미션 인증 검토 요청')
      .addFields(
        {
          name: '제출 ID',
          value: truncateEmbedValue(submission.id, 300),
        },
        {
          name: '제출자',
          value: truncateEmbedValue(submission.displayName || submission.userId, 300),
        },
        {
          name: '미션',
          value: truncateEmbedValue(`${mission.id} / ${mission.title || '제목 없음'}`, 500),
        },
        {
          name: '지급 예정 포인트',
          value: `${mission.rewardPoints || 0}P`,
        },
        {
          name: '제출 내용 일부',
          value: truncateEmbedValue(submission.content, 500),
        },
        {
          name: '제출 시간',
          value: formatKoreanTime(new Date(submission.createdAt)),
        },
        {
          name: '처리 안내',
          value: `/인증관리 제출id:${submission.id} 처리:승인 또는 /인증관리 제출id:${submission.id} 처리:반려`,
        }
      );

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('미션 인증 검토 알림 전송 실패:', error.message);
  }
}

module.exports = {
  formatKoreanTime,
  sendMissionSubmissionReviewAlert,
  sendSensitiveQuestionAlert,
  sendUnansweredQuestionLog,
};

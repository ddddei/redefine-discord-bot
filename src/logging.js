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

  if (!interaction.client || !interaction.client.channels || typeof interaction.client.channels.fetch !== 'function') {
    console.warn('인증 검토 알림 전송 실패: Discord client 채널 접근을 사용할 수 없습니다.');
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
        ...(submission.attachment ? [
          {
            name: '첨부파일',
            value: truncateEmbedValue([
              '있음',
              submission.attachment.name ? `파일명: ${submission.attachment.name}` : '',
              submission.attachment.contentType ? `종류: ${submission.attachment.contentType}` : '',
              submission.attachment.url ? `링크: ${submission.attachment.url}` : '',
            ].filter(Boolean).join('\n'), 700),
          },
        ] : []),
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
    console.info(`인증 검토 알림 전송됨: channel=${alertChannelId} submission=${submission.id}`);
  } catch (error) {
    console.warn('미션 인증 검토 알림 전송 실패:', error.message);
  }
}

async function sendMissionReactionApprovalLog(client, record) {
  const alertChannelId = process.env.ACTIVITY_REVIEW_CHANNEL_ID || process.env.LOG_CHANNEL_ID;

  if (!alertChannelId) {
    console.warn('미션 인증 반응 처리 로그 채널이 설정되지 않아 알림을 건너뜁니다.');
    return;
  }

  if (!client || !client.channels || typeof client.channels.fetch !== 'function') {
    console.warn('미션 인증 반응 처리 로그 전송 실패: Discord client 채널 접근을 사용할 수 없습니다.');
    return;
  }

  try {
    const channel = await client.channels.fetch(alertChannelId);

    if (!channel || typeof channel.send !== 'function') {
      console.warn('미션 인증 반응 처리 로그 채널을 찾을 수 없거나 전송할 수 없습니다.');
      return;
    }

    const approved = record.status === 'approved';
    const notificationSettings = record.notificationSettings || {};
    const embed = new EmbedBuilder()
      .setColor(approved ? 0x5f8f6b : 0x8f6b5f)
      .setTitle(approved ? '미션 인증 반응 승인' : '미션 인증 반응 반려')
      .addFields(
        {
          name: '참여자',
          value: truncateEmbedValue(record.authorDisplayName || record.authorId, 300),
        },
        {
          name: '처리자',
          value: truncateEmbedValue(record.reviewedByDisplayName || record.reviewedBy, 300),
        },
        {
          name: '처리 상태',
          value: approved ? `지급 완료 (${record.rewardPoints || 0}P)` : '포인트 미지급',
        },
        {
          name: '원본 메시지',
          value: record.messageUrl || `${record.guildId}/${record.channelId}/${record.messageId}`,
        },
        {
          name: '참여자 DM',
          value: notificationSettings.dmUser ? '전송 시도 예정' : '비활성',
        },
        {
          name: '공개 답글',
          value: notificationSettings.publicReply ? '전송 시도 예정' : '비활성',
        },
        {
          name: '처리 시간',
          value: formatKoreanTime(new Date(record.reviewedAt)),
        }
      );

    await channel.send({ embeds: [embed] });
    console.info(`미션 인증 반응 처리 로그 전송됨: channel=${alertChannelId} message=${record.messageId}`);
  } catch (error) {
    console.warn('미션 인증 반응 처리 로그 전송 실패:', error.message);
  }
}

async function sendRedemptionReviewAlert(interaction, redemption, item, user, transaction) {
  const alertChannelId = process.env.POINT_REDEEM_CHANNEL_ID || process.env.LOG_CHANNEL_ID;

  if (!alertChannelId) {
    console.warn('교환 신청 알림 채널이 설정되지 않아 알림을 건너뜁니다.');
    return;
  }

  if (!interaction.client || !interaction.client.channels || typeof interaction.client.channels.fetch !== 'function') {
    console.warn('교환 신청 알림 전송 실패: Discord client 채널 접근을 사용할 수 없습니다.');
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(alertChannelId);

    if (!channel || typeof channel.send !== 'function') {
      console.warn('교환 신청 알림 채널을 찾을 수 없거나 전송할 수 없습니다.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x8f7a5f)
      .setTitle('교환 신청 확인 요청')
      .addFields(
        {
          name: '신청 ID',
          value: truncateEmbedValue(redemption.id, 300),
        },
        {
          name: '신청자',
          value: truncateEmbedValue(user.displayName || user.userId, 300),
        },
        {
          name: '항목',
          value: truncateEmbedValue(`${item.id} / ${item.name || '이름 없음'}`, 500),
        },
        {
          name: '차감 포인트',
          value: `${redemption.cost || 0}P`,
        },
        {
          name: '차감 후 잔액',
          value: `${transaction.balanceAfter || 0}P`,
        },
        {
          name: '처리 안내',
          value: `/교환관리 신청id:${redemption.id} 처리:지급완료 또는 /교환관리 신청id:${redemption.id} 처리:취소`,
        }
      );

    await channel.send({ embeds: [embed] });
    console.info(`교환 신청 알림 전송됨: channel=${alertChannelId} redemption=${redemption.id}`);
  } catch (error) {
    console.warn('교환 신청 알림 전송 실패:', error.message);
  }
}

module.exports = {
  formatKoreanTime,
  sendMissionReactionApprovalLog,
  sendMissionSubmissionReviewAlert,
  sendRedemptionReviewAlert,
  sendSensitiveQuestionAlert,
  sendUnansweredQuestionLog,
};

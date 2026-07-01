const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { truncateEmbedValue } = require('./embeds');

function createSubmissionReviewActionRow(submissionId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`operator_submission_approve:${submissionId}`)
      .setLabel('승인하고 지급')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`operator_submission_reject:${submissionId}`)
      .setLabel('반려하기')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

function getAttachmentCount(submission) {
  if (typeof submission.attachmentCount === 'number') {
    return submission.attachmentCount;
  }

  return submission.attachment ? 1 : 0;
}

function getSubmissionContentSummary(submission) {
  const content = submission.contentSummary || submission.content || '';
  return content.trim() || '텍스트 없음';
}

function getSubmissionSourceText(submission) {
  if (submission.messageUrl) {
    return submission.messageUrl;
  }

  if (submission.guildId && submission.channelId && submission.messageId) {
    return `${submission.guildId}/${submission.channelId}/${submission.messageId}`;
  }

  return 'Slash Command 제출';
}

function formatKoreanTime(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function parseBooleanEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return String(value).trim().toLowerCase() === 'true';
}

function getBackupReminderDelay(now = new Date()) {
  const configuredTime = String(process.env.OPERATION_BACKUP_REMINDER_TIME_KST || '20:50').trim();
  const match = configuredTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  const hours = match ? Number(match[1]) : 20;
  const minutes = match ? Number(match[2]) : 50;
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

async function sendOperationBackupReminder(client) {
  const logChannelId = process.env.LOG_CHANNEL_ID;

  if (!logChannelId || !client || !client.channels || typeof client.channels.fetch !== 'function') {
    console.warn('운영 데이터 백업 리마인더 전송 건너뜀: LOG_CHANNEL_ID와 Discord 채널 접근을 확인해 주세요. 수동 확인은 `/운영내보내기 종류:전체 형식:JSON`입니다.');
    return false;
  }

  try {
    const channel = await client.channels.fetch(logChannelId);
    if (!channel || typeof channel.send !== 'function') {
      console.warn('운영 데이터 백업 리마인더 전송 실패: LOG_CHANNEL_ID 채널 조회 또는 메시지 전송 권한을 확인해 주세요.');
      return false;
    }

    await channel.send({
      content: [
        '운영 종료 전 확인입니다.',
        '`/운영내보내기 종류:전체 형식:JSON`으로 오늘 운영 데이터를 백업했는지 확인해 주세요.',
        '이 알림은 파일을 자동 생성하지 않습니다.',
      ].join('\n'),
    });
    return true;
  } catch (error) {
    console.warn('운영 데이터 백업 리마인더 전송 실패:', `${error.message} / 확인 위치: Railway Variables LOG_CHANNEL_ID, Discord 채널 권한, /운영내보내기`);
    return false;
  }
}

function startOperationBackupReminder(client) {
  if (!parseBooleanEnv(process.env.OPERATION_BACKUP_REMINDER_ENABLED, false)) {
    return null;
  }

  const scheduleNext = () => {
    const delay = getBackupReminderDelay();
    return setTimeout(async () => {
      await sendOperationBackupReminder(client);
      scheduleNext();
    }, delay);
  };

  return scheduleNext();
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
  const alertChannelEnvName = process.env.ACTIVITY_REVIEW_CHANNEL_ID ? 'ACTIVITY_REVIEW_CHANNEL_ID' : 'LOG_CHANNEL_ID';

  if (!alertChannelId) {
    console.warn('[submission-alert] skipped: ACTIVITY_REVIEW_CHANNEL_ID and LOG_CHANNEL_ID are not configured. 확인 위치: /운영현황 종류:인증대기, /인증관리');
    return;
  }

  if (!interaction.client || !interaction.client.channels || typeof interaction.client.channels.fetch !== 'function') {
    console.warn('[submission-alert] failed: Discord client channel access is unavailable. 확인 위치: /운영현황 종류:인증대기, /인증관리');
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(alertChannelId);

    if (!channel || typeof channel.send !== 'function') {
      console.warn('[submission-alert] failed: missing channel permission or channel not found. 확인 위치: ACTIVITY_REVIEW_CHANNEL_ID, LOG_CHANNEL_ID, /운영현황 종류:환경설정점검');
      return;
    }

    const attachmentCount = getAttachmentCount(submission);
    const rewardPoints = typeof submission.rewardPoints === 'number'
      ? submission.rewardPoints
      : (mission && typeof mission.rewardPoints === 'number' ? mission.rewardPoints : 0);
    const embed = new EmbedBuilder()
      .setColor(0x8f7a5f)
      .setTitle(submission.type === 'todayMission' ? '오늘의 미션 인증 후보' : '미션 인증 검토 요청')
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
          value: mission
            ? truncateEmbedValue(`${mission.id} / ${mission.title || '제목 없음'}`, 500)
            : truncateEmbedValue(submission.missionTitle || submission.missionId || '오늘의 미션', 500),
        },
        {
          name: '원본 메시지',
          value: truncateEmbedValue(getSubmissionSourceText(submission), 700),
        },
        {
          name: '지급 예정 포인트',
          value: `${rewardPoints}P`,
        },
        {
          name: '텍스트 내용 요약',
          value: truncateEmbedValue(getSubmissionContentSummary(submission), 500),
        },
        {
          name: '첨부파일 개수',
          value: `${attachmentCount}개`,
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
          value: [
            '아래 버튼으로 바로 처리할 수 있어요.',
            '문제가 있으면 `/인증관리` 명령어로 직접 처리할 수 있어요.',
            `제출 ID: \`${submission.id}\``,
          ].join('\n'),
        }
      );

    await channel.send({
      embeds: [embed],
      components: [createSubmissionReviewActionRow(submission.id)],
    });
    console.info(`[submission-alert] sent to ${alertChannelEnvName}: channel=${alertChannelId} submission=${submission.id}`);
  } catch (error) {
    console.warn(`[submission-alert] failed: ${error.message} / 확인 위치: /운영현황 종류:인증대기, /인증관리, Discord 채널 권한`);
  }
}

async function sendMissionSubmissionReviewLog(client, result, reviewerDisplayName) {
  const alertChannelId = process.env.ACTIVITY_REVIEW_CHANNEL_ID || process.env.LOG_CHANNEL_ID;

  if (!alertChannelId) {
    console.warn('미션 인증 버튼 처리 로그 채널이 설정되지 않아 알림을 건너뜁니다. 확인 위치: /운영현황 종류:인증대기, /포인트로그');
    return;
  }

  if (!client || !client.channels || typeof client.channels.fetch !== 'function') {
    console.warn('미션 인증 버튼 처리 로그 전송 실패: Discord client 채널 접근을 사용할 수 없습니다. 확인 위치: /운영현황 종류:인증대기, /포인트로그');
    return;
  }

  try {
    const channel = await client.channels.fetch(alertChannelId);

    if (!channel || typeof channel.send !== 'function') {
      console.warn('미션 인증 버튼 처리 로그 채널을 찾을 수 없거나 전송할 수 없습니다. 확인 위치: ACTIVITY_REVIEW_CHANNEL_ID, LOG_CHANNEL_ID, /운영현황 종류:환경설정점검');
      return;
    }

    const approved = result.submission.status === 'approved';
    const duplicateBlocked = result.submission.duplicateRewardBlocked === true;
    const embed = new EmbedBuilder()
      .setColor(approved ? 0x5f8f6b : 0x8f6b5f)
      .setTitle(approved ? '미션 인증 버튼 승인' : '미션 인증 버튼 반려')
      .addFields(
        {
          name: '제출 ID',
          value: truncateEmbedValue(result.submission.id, 300),
        },
        {
          name: '참여자',
          value: truncateEmbedValue(result.submission.displayName || result.submission.userId, 300),
        },
        {
          name: '미션',
          value: result.mission
            ? truncateEmbedValue(`${result.mission.id} / ${result.mission.title || '제목 없음'}`, 500)
            : truncateEmbedValue(result.submission.missionId, 300),
        },
        ...(result.submission.messageUrl ? [
          {
            name: '원본 메시지',
            value: truncateEmbedValue(result.submission.messageUrl, 700),
          },
        ] : []),
        {
          name: '처리자',
          value: truncateEmbedValue(reviewerDisplayName || result.submission.reviewedBy || '운영진', 300),
        },
        {
          name: '처리 결과',
          value: duplicateBlocked
            ? '이미 오늘 지급 완료 / 추가 지급 없음'
            : (approved
              ? `지급 완료 (${result.transaction ? result.transaction.amount : 0}P)`
              : '반려 완료 / 포인트 미지급'),
        },
        {
          name: '처리 시간',
          value: formatKoreanTime(new Date(result.submission.reviewedAt)),
        }
      );

    await channel.send({ embeds: [embed] });
    console.info(`미션 인증 버튼 처리 로그 전송됨: channel=${alertChannelId} submission=${result.submission.id}`);
  } catch (error) {
    console.warn('미션 인증 버튼 처리 로그 전송 실패:', `${error.message} / 확인 위치: /운영현황 종류:인증대기, /포인트로그`);
  }
}

async function sendMissionReactionApprovalLog(client, record) {
  const alertChannelId = process.env.ACTIVITY_REVIEW_CHANNEL_ID || process.env.LOG_CHANNEL_ID;

  if (!alertChannelId) {
    console.warn('미션 인증 반응 처리 로그 채널이 설정되지 않아 알림을 건너뜁니다. 확인 위치: /운영현황 종류:반응후속확인, /포인트로그');
    return;
  }

  if (!client || !client.channels || typeof client.channels.fetch !== 'function') {
    console.warn('미션 인증 반응 처리 로그 전송 실패: Discord client 채널 접근을 사용할 수 없습니다. 확인 위치: /운영현황 종류:반응후속확인, /포인트로그');
    return;
  }

  try {
    const channel = await client.channels.fetch(alertChannelId);

    if (!channel || typeof channel.send !== 'function') {
      console.warn('미션 인증 반응 처리 로그 채널을 찾을 수 없거나 전송할 수 없습니다. 확인 위치: ACTIVITY_REVIEW_CHANNEL_ID, LOG_CHANNEL_ID, /운영현황 종류:환경설정점검');
      return;
    }

    const approved = record.status === 'approved';
    const notificationSettings = record.notificationSettings || {};
    const notificationResults = record.notificationResults || {};
    const formatNotificationStatus = (settingEnabled, result) => {
      if (!settingEnabled) return '비활성';
      if (result === 'sent') return '전송 완료';
      if (result === 'failed') return '전송 실패';
      return '전송 시도';
    };
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
          value: formatNotificationStatus(notificationSettings.dmUser, notificationResults.dmUser),
        },
        {
          name: '공개 답글',
          value: formatNotificationStatus(notificationSettings.publicReply, notificationResults.publicReply),
        },
        {
          name: '처리 시간',
          value: formatKoreanTime(new Date(record.reviewedAt)),
        }
      );

    await channel.send({ embeds: [embed] });
    console.info(`미션 인증 반응 처리 로그 전송됨: channel=${alertChannelId} message=${record.messageId}`);
  } catch (error) {
    console.warn('미션 인증 반응 처리 로그 전송 실패:', `${error.message} / 확인 위치: /운영현황 종류:반응후속확인, /포인트로그`);
  }
}

async function sendRedemptionReviewAlert(interaction, redemption, item, user, transaction) {
  const alertChannelId = process.env.POINT_REDEEM_CHANNEL_ID || process.env.LOG_CHANNEL_ID;
  const alertChannelEnvName = process.env.POINT_REDEEM_CHANNEL_ID ? 'POINT_REDEEM_CHANNEL_ID' : 'LOG_CHANNEL_ID';

  if (!alertChannelId) {
    console.warn('[redeem-alert] skipped: POINT_REDEEM_CHANNEL_ID and LOG_CHANNEL_ID are not configured. 확인 위치: /운영현황 종류:교환대기, /교환관리');
    return;
  }

  if (!interaction.client || !interaction.client.channels || typeof interaction.client.channels.fetch !== 'function') {
    console.warn('[redeem-alert] failed: Discord client channel access is unavailable. 확인 위치: /운영현황 종류:교환대기, /교환관리');
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(alertChannelId);

    if (!channel || typeof channel.send !== 'function') {
      console.warn('[redeem-alert] failed: missing channel permission or channel not found. 확인 위치: POINT_REDEEM_CHANNEL_ID, LOG_CHANNEL_ID, /운영현황 종류:환경설정점검');
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
    console.info(`[redeem-alert] sent to ${alertChannelEnvName}: channel=${alertChannelId} redemption=${redemption.id}`);
  } catch (error) {
    console.warn(`[redeem-alert] failed: ${error.message} / 확인 위치: /운영현황 종류:교환대기, /교환관리, Discord 채널 권한`);
  }
}

module.exports = {
  createSubmissionReviewActionRow,
  formatKoreanTime,
  getBackupReminderDelay,
  sendOperationBackupReminder,
  sendMissionReactionApprovalLog,
  sendMissionSubmissionReviewAlert,
  sendMissionSubmissionReviewLog,
  sendRedemptionReviewAlert,
  sendSensitiveQuestionAlert,
  sendUnansweredQuestionLog,
  startOperationBackupReminder,
};

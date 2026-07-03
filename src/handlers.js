const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const {
  OPERATOR_CHECK_FOOTER,
  buildOperatorChecklistEmbed,
  buildOperatorEnvironmentCheckEmbed,
  buildOperatorExportGuideEmbed,
  buildOperatorFaqCandidatesEmbed,
  buildOperatorFirstDayCheckEmbed,
  buildOperatorHubEmbed,
  buildOperatorInvitationNoticeEmbed,
  buildOperatorOnboardingSignalsEmbed,
  buildOperatorPrelaunchCheckEmbed,
  getOperatorPrelaunchCheckIssues,
  buildOperatorMissionsShopEmbed,
  buildOperatorPointLogsEmbed,
  buildOperatorReactionApprovalsEmbed,
  buildOperatorReactionFollowUpsEmbed,
  buildOperatorRedemptionsEmbed,
  buildOperatorSubmissionsEmbed,
  buildOperatorTodayQueueEmbed,
  createChannelGuideEmbed,
  createGuideEmbed,
  createGuideHubDetailEmbed,
  createGuideHubEmbed,
  createKnowledgeEmbed,
  createPointBalanceEmbed,
  createShopEmbed,
  formatPoints,
  formatTransactionAmount,
  formatTransactionDate,
  getShopTypeLabel,
  getNoticeTemplate,
  truncateText,
} = require('./embeds');
const {
  buildFaqCandidateQueue,
  buildFirstDayCheck,
  buildOnboardingSignals,
  buildReactionFollowUpQueue,
  buildTodayOperationsQueue,
} = require('./adminApi');
const {
  DUNGEONWORLD_CHOICE_PREFIX,
  GUIDE_HUB_SELECT_ID,
  OPERATOR_DUNGEONWORLD_MANAGE_PREFIX,
  OPERATOR_MISSION_HUB_BUTTON_IDS,
  OPERATOR_MISSION_HUB_SELECT_ID,
  OPERATOR_MISSION_TEMPLATE_SELECT_ID,
  OPERATOR_SHOP_HUB_BUTTON_IDS,
  OPERATOR_SHOP_HUB_SELECT_ID,
  OPERATOR_HUB_BUTTON_IDS,
  OPERATOR_HUB_SELECT_ID,
  createGuideHubSelectRow,
  createOperatorMissionHubToken,
  createOperatorMissionTemplateToken,
  createOperatorShopHubToken,
  createOperatorMissionHubRows,
  createOperatorMissionTemplateRows,
  createOperatorShopHubRows,
  createOperatorHubSelectRow,
  createOperatorInvitationNoticeButtonRow,
  createOperatorPrelaunchCheckActionRow,
} = require('./components');
const {
  createSubmissionReviewActionRow,
  sendMissionSubmissionReviewAlert,
  sendMissionSubmissionReviewLog,
  sendRedemptionReviewAlert,
  sendSensitiveQuestionAlert,
  sendUnansweredQuestionLog,
} = require('./logging');
const { getAiFallbackAnswer } = require('./ai');
const {
  getChannelGuideRoleNote,
  getOnboardingGuideMessage,
  getOnboardingRoleType,
} = require('./onboardingRoles');
const {
  getUser,
  getUserPoints,
  listPointTransactions,
  validateUserBalance,
} = require('./pointsStore');
const {
  CHECKIN_REWARD_POINTS,
  createPointsRepository,
} = require('./pointsRepository');
const {
  createMinigameButtonHandler,
  createMinigameChannelGuidePayload,
  createMinigameHubPayload,
} = require('./minigameInteractions');
const { buildOperationExportPayload, truncateForDiscord } = require('./exportUtils');
const { findFaqAnswer, findKnowledgeAnswer } = require('./search');
const { detectSensitiveQuestion, getSensitiveQuestionUserMessage } = require('./safety');
const {
  buildDungeonworldExportPayload,
  createDungeonworldConfigRepository,
  createDungeonworldRepository,
} = require('./dungeonworld');
const { createDungeonworldHandlers } = require('./dungeonworldHandlers');
const { buildMinigameReport, createMinigameReportEmbed } = require('./minigameReport');

const pointsRepository = createPointsRepository();
const dungeonworldRepository = createDungeonworldRepository();
const dungeonworldConfigRepository = createDungeonworldConfigRepository();
const {
  handleDungeonworldButton,
  handleDungeonworldCommand,
  handleDungeonworldManageButton,
  handleDungeonworldManageCommand,
  handleDungeonworldRecordCommand,
} = createDungeonworldHandlers({
  dungeonworldRepository,
  dungeonworldConfigRepository,
  getMemberDisplayName,
  isOperator,
});
const handleMinigameButton = createMinigameButtonHandler({
  pointsRepository,
  getMemberDisplayName,
});

const OPERATOR_ENV_CHANNEL_CHECKS = [
  {
    envName: 'LOG_CHANNEL_ID',
    label: '기본 운영 로그',
    requirementLabel: '권장',
    required: true,
  },
  {
    envName: 'POINT_REDEEM_CHANNEL_ID',
    label: '교환 신청 알림',
    requirementLabel: '권장',
    required: true,
  },
  {
    envName: 'ACTIVITY_REVIEW_CHANNEL_ID',
    label: '미션 인증 검토',
    requirementLabel: '권장',
    required: true,
  },
  {
    envName: 'TODAY_MISSION_CHANNEL_ID',
    label: '오늘의 미션/인증 업로드',
    requirementLabel: '권장',
    required: true,
  },
  {
    envName: 'MINIGAME_CHANNEL_ID',
    label: '미니게임 전용 채널',
    requirementLabel: '권장',
    required: true,
  },
  {
    envName: 'DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID',
    label: '별도 오늘의 미션 안내',
    requirementLabel: '선택',
    required: false,
  },
  {
    envName: 'MISSION_SUBMISSION_CHANNEL_ID',
    label: '별도 인증 채널',
    requirementLabel: '선택',
    required: false,
  },
  {
    envName: 'SAFETY_ALERT_CHANNEL_ID',
    label: '민감 질문 알림 분리',
    requirementLabel: '선택',
    required: false,
  },
];

function getMemberDisplayName(user, member) {
  return member && member.displayName ? member.displayName : user.username;
}

function memberHasPermission(member, permission) {
  return Boolean(member && member.permissions && typeof member.permissions.has === 'function'
    && member.permissions.has(permission));
}

function isOperator(interaction) {
  return memberHasPermission(interaction.member, PermissionFlagsBits.ManageMessages)
    || memberHasPermission(interaction.member, PermissionFlagsBits.Administrator);
}

function getConfiguredEnvValue(envName) {
  const value = process.env[envName];
  return typeof value === 'string' ? value.trim() : '';
}

function isGoogleSheetsLoggingEnabled() {
  return String(process.env.GOOGLE_SHEETS_LOGGING_ENABLED || '').trim().toLowerCase() === 'true';
}

function getChannelPermissions(channel, clientUser) {
  if (!channel || typeof channel.permissionsFor !== 'function' || !clientUser) {
    return null;
  }

  try {
    return channel.permissionsFor(clientUser);
  } catch (error) {
    return null;
  }
}

function channelPermissionHas(permissions, permission) {
  return Boolean(permissions && typeof permissions.has === 'function' && permissions.has(permission));
}

async function resolveConfiguredChannel(interaction, channelId) {
  const cachedChannel = interaction.client
    && interaction.client.channels
    && interaction.client.channels.cache
    && typeof interaction.client.channels.cache.get === 'function'
    ? interaction.client.channels.cache.get(channelId)
    : null;

  if (cachedChannel) {
    return cachedChannel;
  }

  if (!interaction.client || !interaction.client.channels || typeof interaction.client.channels.fetch !== 'function') {
    return null;
  }

  try {
    return await interaction.client.channels.fetch(channelId);
  } catch (error) {
    return null;
  }
}

async function inspectChannelEnvironment(interaction, definition) {
  const channelId = getConfiguredEnvValue(definition.envName);
  const baseCheck = {
    ...definition,
    configured: Boolean(channelId),
    channelId: channelId || null,
    channelName: null,
    found: null,
    accessible: null,
    canSendMessages: null,
  };

  if (!channelId) {
    return baseCheck;
  }

  const channel = await resolveConfiguredChannel(interaction, channelId);
  if (!channel) {
    return {
      ...baseCheck,
      found: false,
      accessible: false,
      canSendMessages: false,
    };
  }

  const permissions = getChannelPermissions(channel, interaction.client && interaction.client.user);
  return {
    ...baseCheck,
    found: true,
    channelName: typeof channel.name === 'string' && channel.name ? channel.name : null,
    accessible: channelPermissionHas(permissions, PermissionFlagsBits.ViewChannel),
    canSendMessages: channelPermissionHas(permissions, PermissionFlagsBits.SendMessages),
  };
}

async function createOperatorEnvironmentCheck(interaction) {
  const channelChecks = [];
  for (const definition of OPERATOR_ENV_CHANNEL_CHECKS) {
    channelChecks.push(await inspectChannelEnvironment(interaction, definition));
  }

  return {
    channelChecks,
    googleSheetsCheck: {
      loggingEnabled: isGoogleSheetsLoggingEnabled(),
      webAppUrlConfigured: Boolean(getConfiguredEnvValue('GOOGLE_SHEETS_WEB_APP_URL')),
    },
  };
}

async function createOperatorPrelaunchCheck(interaction) {
  const environmentCheck = await createOperatorEnvironmentCheck(interaction);
  const todayMissionChannel = environmentCheck.channelChecks
    .find((check) => check.envName === 'TODAY_MISSION_CHANNEL_ID');
  const activeTodayMission = pointsRepository.findTodayActiveMission();
  const channelReady = Boolean(todayMissionChannel
    && todayMissionChannel.configured
    && todayMissionChannel.found
    && todayMissionChannel.accessible
    && todayMissionChannel.canSendMessages);

  return {
    ...environmentCheck,
    todayMissionCheck: {
      activeMissionExists: Boolean(activeTodayMission),
      publishChannelReady: Boolean(activeTodayMission && channelReady),
      alreadyPublishedToday: pointsRepository.hasTodayMissionNoticeBeenPublished(),
      duplicateGuardReady: pointsRepository.isDuplicateMissionRewardGuardHealthy(),
    },
    operationSummary: pointsRepository.getOperationSummary(),
  };
}

async function createOperatorPrelaunchCheckPayload(interaction) {
  const checkData = await createOperatorPrelaunchCheck(interaction);
  const issueActionRow = createOperatorPrelaunchCheckActionRow(getOperatorPrelaunchCheckIssues(checkData));
  const components = [createOperatorHubSelectRow('prelaunch_check')];
  if (issueActionRow) {
    components.push(issueActionRow);
  }

  return {
    embeds: [buildOperatorPrelaunchCheckEmbed(checkData)],
    components,
  };
}

async function createOperatorFirstDayCheckPayload(interaction) {
  const environmentCheck = await createOperatorEnvironmentCheck(interaction);
  const checkData = buildFirstDayCheck(pointsRepository, {
    ...environmentCheck,
    limit: 10,
  });

  return {
    embeds: [buildOperatorFirstDayCheckEmbed(checkData)],
    components: [createOperatorHubSelectRow('first_day_check')],
  };
}

function recordParticipantCommandUse(interaction, commandName) {
  if (!interaction || !interaction.user || !interaction.user.id) {
    return;
  }

  try {
    pointsRepository.recordParticipantCommandFirstUse({
      userId: interaction.user.id,
      commandName,
    });
  } catch (error) {
    console.warn('참여자 기본 명령어 첫 사용 기록 실패:', error.message);
  }
}

function recordFaqFallbackQuestion(question) {
  try {
    recordFaqFallbackQuestion(question);
  } catch (error) {
    console.warn('FAQ 후보 질문 기록 실패:', error.message);
  }
}

function createInsufficientPointsDescription({ currentPoints = 0, requiredPoints = 0 } = {}) {
  return [
    '아직 포인트가 조금 부족해요.',
    '',
    `현재 포인트: ${formatPoints(currentPoints)}`,
    `필요 포인트: ${formatPoints(requiredPoints)}`,
    '',
    '체크인이나 미션 참여 후 다시 신청할 수 있어요.',
    '',
    '- `/체크인`으로 오늘의 기록 남기기',
    '- `/미션`에서 참여 가능한 활동 확인하기',
    '- `/포인트`로 내 포인트 다시 확인하기',
  ].join('\n');
}

function getRedemptionFailureMessage(reason) {
  const messages = {
    USER_NOT_FOUND: [
      '현재 포인트 기록이 없어 아직 신청할 수 없어요.',
      '',
      '먼저 체크인이나 미션 참여 후 다시 확인해 주세요.',
      '',
      '- `/체크인`으로 오늘의 기록 남기기',
      '- `/미션`에서 참여 가능한 활동 확인하기',
      '- `/포인트`로 내 포인트 다시 확인하기',
    ].join('\n'),
    ITEM_NOT_FOUND: '해당 항목을 찾지 못했어요. `/상점`에서 신청 코드를 다시 확인해 주세요.',
    SOLD_OUT: '해당 항목은 현재 재고가 없어 신청할 수 없어요.',
    ITEM_NOT_ACTIVE: '해당 항목은 현재 신청 가능한 상태가 아니에요.',
    INSUFFICIENT_POINTS: createInsufficientPointsDescription(),
  };

  return messages[reason] || '교환 신청 조건을 확인하지 못했어요. 운영진에게 알려주세요.';
}

function createPointTransactionLogEmbed(transactions) {
  const lines = transactions.length > 0
    ? transactions.map((transaction) => {
      return [
        `- ${formatTransactionDate(transaction.createdAt)}`,
        transaction.id,
        transaction.userId,
        transaction.type,
        formatTransactionAmount(transaction.amount),
        `잔액 ${formatPoints(transaction.balanceAfter)}`,
        transaction.reason,
      ].join(' / ');
    })
    : ['아직 표시할 실제 포인트 로그가 없습니다.'];

  return createGuideEmbed(
    '포인트 로그',
    lines.join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function createEmptyListEmbed(title, guideText) {
  return createGuideEmbed(title, guideText, {
    footer: OPERATOR_CHECK_FOOTER,
  });
}

function formatNullableCount(value, unit) {
  return typeof value === 'number' ? `${value}${unit}` : '운영진 확인';
}

function formatShopLimit(item) {
  const stockText = typeof item.stock === 'number'
    ? `재고 ${item.stock}개`
    : '재고 운영진 확인';
  const monthlyLimitText = typeof item.monthlyLimit === 'number'
    ? `월 한도 ${item.monthlyLimit}회`
    : '월 한도 운영진 확인';

  return `${stockText} / ${monthlyLimitText}`;
}

function createShopSelectRow(items) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('participant_shop_select')
      .setPlaceholder('교환할 항목을 선택해 주세요')
      .addOptions(items.slice(0, 25).map((item) => ({
        label: truncateText(`${item.displayCode} ${item.name}`, 100, item.displayCode || item.id),
        description: truncateText(`필요 포인트 ${formatPoints(item.cost)}`, 100, '상점 항목'),
        value: item.displayCode || item.id,
      })))
  );
}

function createRedemptionConfirmRow(displayCode) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`participant_redeem_confirm:${displayCode}`)
      .setLabel('교환 신청하기')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`participant_redeem_cancel_check:${displayCode}`)
      .setLabel('신청하지 않기')
      .setStyle(ButtonStyle.Secondary)
  );
}

const PARTICIPANT_MENU_BUTTON_IDS = {
  onboarding: 'participant_menu_onboarding',
  todayMission: 'participant_menu_today_mission',
  points: 'participant_menu_points',
  ranking: 'participant_menu_ranking',
  minigames: 'participant_menu_minigames',
  help: 'participant_menu_help',
};

function createParticipantMenuButtonRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(PARTICIPANT_MENU_BUTTON_IDS.onboarding)
        .setLabel('🌱 처음 왔다면 여기부터')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(PARTICIPANT_MENU_BUTTON_IDS.todayMission)
        .setLabel('🌱 오늘의 미션 보기')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(PARTICIPANT_MENU_BUTTON_IDS.points)
        .setLabel('💰 내 포인트 확인')
        .setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(PARTICIPANT_MENU_BUTTON_IDS.ranking)
        .setLabel('🏆 랭킹 확인')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(PARTICIPANT_MENU_BUTTON_IDS.minigames)
        .setLabel('🎮 미니게임')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(PARTICIPANT_MENU_BUTTON_IDS.help)
        .setLabel('❓ 이용 방법 보기')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createParticipantOnboardingNextStepRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PARTICIPANT_MENU_BUTTON_IDS.todayMission)
      .setLabel('🌱 오늘의 미션 보기')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(PARTICIPANT_MENU_BUTTON_IDS.points)
      .setLabel('💰 내 포인트 확인')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(PARTICIPANT_MENU_BUTTON_IDS.minigames)
      .setLabel('🎮 미니게임')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createRedemptionCancelConfirmRow(displayCode) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`participant_redeem_cancel_done:${displayCode}`)
      .setLabel('네, 종료할게요')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`participant_redeem_cancel_back:${displayCode}`)
      .setLabel('다시 확인할게요')
      .setStyle(ButtonStyle.Primary)
  );
}

function getSubmissionReviewButtonAction(customId) {
  if (customId.startsWith('operator_submission_approve:')) {
    return 'approve';
  }

  if (customId.startsWith('operator_submission_reject:')) {
    return 'reject';
  }

  return null;
}

function getSubmissionIdFromReviewButton(customId) {
  const separatorIndex = customId.indexOf(':');
  return separatorIndex === -1 ? '' : customId.slice(separatorIndex + 1);
}

function getEmbedJson(embed) {
  if (!embed) {
    return {};
  }

  if (typeof embed.toJSON === 'function') {
    return embed.toJSON();
  }

  return embed.data || embed;
}

function buildSubmissionReviewStatusEmbed(baseEmbed, result, reviewerDisplayName, alreadyProcessed = false) {
  const approved = result.submission.status === 'approved';
  const duplicateBlocked = result.submission.duplicateRewardBlocked === true;
  const baseJson = getEmbedJson(baseEmbed);
  const filteredFields = Array.isArray(baseJson.fields)
    ? baseJson.fields.filter((field) => !['처리 안내', '처리 상태', '처리자'].includes(field.name))
    : [];
  const statusLine = alreadyProcessed
    ? `이미 ${approved ? '승인' : '반려'} 처리된 인증 제출이에요.`
    : `${approved ? '승인' : '반려'} 완료`;
  const pointLine = result.transaction
    ? `지급 포인트: ${formatPoints(result.transaction.amount)}`
    : (duplicateBlocked ? '지급 포인트: 이미 오늘 지급 완료 / 추가 지급 없음' : '지급 포인트: 없음');

  return new EmbedBuilder({
    ...baseJson,
    fields: [
      ...filteredFields,
      {
        name: '처리 상태',
        value: [
          statusLine,
          pointLine,
          `처리 시간: ${formatTransactionDate(result.submission.reviewedAt)}`,
        ].join('\n'),
      },
      {
        name: '처리자',
        value: truncateText(reviewerDisplayName || result.submission.reviewedBy || '운영진', 300),
      },
    ],
  })
    .setColor(approved ? 0x5f8f6b : 0x8f6b5f)
    .setTitle(approved ? '미션 인증 승인 완료' : '미션 인증 반려 완료');
}

async function sendSubmissionReviewDm(interaction, result) {
  if (!interaction.client || !interaction.client.users || typeof interaction.client.users.fetch !== 'function') {
    return;
  }

  try {
    const targetUser = await interaction.client.users.fetch(result.submission.userId);

    if (!targetUser || typeof targetUser.send !== 'function') {
      return;
    }

    const approved = result.submission.status === 'approved';
    const duplicateBlocked = result.submission.duplicateRewardBlocked === true;
    const submissionLabel = result.submission.type === 'todayMission' ? '오늘의 미션 인증' : '미션 인증';
    await targetUser.send([
      approved ? `${submissionLabel}이 승인됐어요 ✅` : '이번 인증은 반려됐어요.',
      result.mission
        ? `미션: ${result.mission.title || result.mission.id}`
        : `미션 ID: ${result.submission.missionId || '확인 필요'}`,
      result.transaction
        ? `${formatPoints(result.transaction.amount)}가 지급됐어요.`
        : (duplicateBlocked ? '인증은 확인됐지만, 오늘의 미션 포인트는 이미 지급되어 추가 지급은 없어요.' : '안내 내용을 확인한 뒤 다시 제출해주세요.'),
    ].join('\n'));
  } catch (error) {
    console.warn('미션 인증 검토 DM 전송 실패:', error.message);
  }
}

function createMissionSelectRow(missions) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('participant_mission_select')
      .setPlaceholder('인증할 미션을 선택해 주세요')
      .addOptions(missions.slice(0, 25).map((mission) => ({
        label: truncateText(`${mission.displayCode} ${mission.title || mission.id}`, 100, mission.displayCode || mission.id),
        description: truncateText(`지급 포인트 ${formatPoints(mission.rewardPoints || 0)}`, 100, '미션'),
        value: mission.displayCode || mission.id,
      })))
  );
}

async function replyWithShopSelection(interaction) {
  const items = pointsRepository.listActiveShopItemsWithCodes();

  if (items.length === 0) {
    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '여정 포인트 상점',
          [
            '지금 교환할 수 있는 항목이 없어요.',
            '',
            '운영진이 새 항목을 열면 이곳에서 확인할 수 있어요.',
          ].join('\n')
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [createShopEmbed(items)],
    components: [createShopSelectRow(items)],
    ephemeral: true,
  });
}

async function replyWithMissionSelection(interaction) {
  const missions = pointsRepository.listActiveMissions();

  if (missions.length === 0) {
    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '오늘 참여 가능한 미션',
          [
            '지금 바로 참여할 수 있는 미션은 없어요.',
            '',
            '운영진이 새 미션을 열면 이곳에서 확인할 수 있어요.',
            '오늘은 `/체크인`으로 가볍게 기록을 남겨도 괜찮아요.',
          ].join('\n')
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  const lines = missions.slice(0, 10).map((mission) => {
    const submissionText = mission.requiresSubmission === false ? '운영진 안내' : '글로 인증';
    return [
      `🌱 ${mission.title || '미션'}`,
      `지급 포인트 ${formatPoints(mission.rewardPoints || 0)} · ${submissionText}`,
    ].join('\n');
  });

  await interaction.reply({
    embeds: [
      createGuideEmbed(
        '오늘 참여 가능한 미션',
        [
          ...lines.join('\n\n').split('\n'),
          '',
          '미션은 선택형 활동이에요.',
          '글로 남길 수 있는 미션은 아래에서 선택해 제출할 수 있어요.',
          '사진이나 영상이 필요한 경우 `/인증`에서 첨부파일을 함께 올려 주세요.',
        ].join('\n')
      ),
    ],
    components: [createMissionSelectRow(missions)],
    ephemeral: true,
  });
}

function createMissionSubmissionModal(mission) {
  return new ModalBuilder()
    .setCustomId(`participant_mission_submit:${mission.displayCode || mission.id}`)
    .setTitle(truncateText('미션 인증하기', 45, '미션 인증'))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('content')
          .setLabel('인증 내용')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(1000)
          .setPlaceholder('수행 내용을 필요한 만큼만 적어 주세요.')
      )
    );
}

function serializeAttachment(attachment) {
  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id || null,
    name: attachment.name || null,
    url: attachment.url || null,
    contentType: attachment.contentType || null,
    size: typeof attachment.size === 'number' ? attachment.size : null,
  };
}

function getOptionalStringOption(options, name) {
  try {
    return options.getString(name);
  } catch (error) {
    return null;
  }
}

function formatAdminMissionLine(mission) {
  return [
    `- ID: \`${mission.id}\``,
    `  제목: ${mission.title || '제목 없음'}`,
    `  상태: ${mission.status || '상태 없음'} / 포인트: ${formatPoints(mission.rewardPoints || 0)} / 날짜: ${mission.activeDate || '미지정'}`,
  ].join('\n');
}

function formatAdminShopItemLine(item) {
  return [
    `- ID: \`${item.id}\``,
    `  이름: ${item.name || '이름 없음'}`,
    `  상태: ${item.status || '상태 없음'} / 비용: ${formatPoints(item.cost || 0)} / 재고: ${formatNullableCount(item.stock, '개')} / 유형: ${item.type || '미지정'}`,
  ].join('\n');
}

function createOperationSummaryEmbed(summary) {
  return buildOperatorHubEmbed(summary);
}

function createPendingRedemptionsEmbed(redemptions) {
  return buildOperatorRedemptionsEmbed(redemptions);
}

function createPendingSubmissionsEmbed(submissions) {
  return buildOperatorSubmissionsEmbed(submissions);
}

function createAdminMissionListEmbed(missions) {
  if (missions.length === 0) {
    return createEmptyListEmbed('미션 관리 목록', '등록된 미션이 없어요. `/미션관리 작업:추가`로 먼저 생성해 주세요.');
  }

  return createGuideEmbed(
    '미션 관리 목록',
    [
      ...missions.map(formatAdminMissionLine),
      '',
      'status가 active인 미션만 참여자 `/미션`에 노출됩니다.',
    ].join('\n\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function getMissionHubSelection(missions, selectedMissionId = null) {
  if (!Array.isArray(missions) || missions.length === 0) {
    return null;
  }

  return missions.find((mission) => mission.id === selectedMissionId) || missions[0];
}

function formatMissionParticipantPreview(mission) {
  if (!mission) {
    return [
      '아직 미리볼 미션이 없어요.',
      '새 미션을 만든 뒤 참여자 `/미션` 안내문을 확인할 수 있어요.',
    ].join('\n');
  }

  return [
    `**${mission.title || '제목 없음'}**`,
    truncateText(mission.description || '설명 없음', 700, '설명 없음'),
    '',
    `지급 포인트: ${formatPoints(mission.rewardPoints || 0)}`,
    mission.requiresSubmission === false
      ? '인증 제출 없이 운영 기준에 따라 처리되는 미션입니다.'
      : '참여자는 `/미션` 또는 `/인증` 흐름으로 인증 내용을 제출합니다.',
  ].join('\n');
}

function formatMissionTemplateLine(template, selectedTemplateId = null) {
  const marker = template.id === selectedTemplateId ? '>' : '-';
  return `${marker} \`${template.id}\` ${truncateText(template.title || '제목 없음', 48, '제목 없음')} / ${template.recommendedDay || '요일 미지정'} / ${formatPoints(template.rewardPoints || 0)}`;
}

function formatMissionTemplatePreview(template) {
  if (!template) {
    return [
      '선택된 템플릿이 없습니다.',
      '템플릿을 선택하면 오늘의 미션으로 적용하기 전 안내문을 확인할 수 있어요.',
    ].join('\n');
  }

  return [
    `선택 템플릿: \`${template.id}\``,
    `제목: ${template.title || '제목 없음'}`,
    `추천 요일: ${template.recommendedDay || '미지정'} / 분류: ${template.category || template.type || '미지정'}`,
    `지급: ${formatPoints(template.rewardPoints || 0)} / 인증 필요: ${template.requiresSubmission === false ? '아니오' : '예'}`,
    template.isExample ? '예시 템플릿입니다. 운영자가 선택하면 오늘의 미션으로 복사 생성할 수 있어요.' : null,
    truncateText(template.description || '설명 없음', 500, '설명 없음'),
    template.note ? `운영 메모: ${truncateText(template.note, 180, '')}` : null,
  ].filter(Boolean).join('\n');
}

function formatWeekdayRecommendationLine(recommendation) {
  const templateTitle = recommendation.template ? recommendation.template.title : recommendation.title;
  return `- ${recommendation.label || recommendation.weekday}: ${templateTitle || '추천 미션 없음'}${recommendation.note ? ` (${truncateText(recommendation.note, 45, '')})` : ''}`;
}

function formatTodayMissionRecommendation(recommendation) {
  if (!recommendation || !recommendation.template) {
    return '오늘 요일에 연결된 추천 템플릿이 없습니다. 필요하면 템플릿 목록에서 직접 선택해 주세요.';
  }

  return [
    `${recommendation.label || recommendation.weekday} 추천: ${recommendation.template.title}`,
    truncateText(recommendation.template.description || '설명 없음', 280, '설명 없음'),
    `적용하면 오늘 날짜의 active 미션으로 저장됩니다.`,
  ].join('\n');
}

function buildTodayMissionNoticeEmbed(mission) {
  return createGuideEmbed(
    '오늘의 미션',
    [
      `**${mission.title || '오늘의 미션'}**`,
      truncateText(mission.description || '오늘 편하게 참여할 수 있는 작은 미션입니다.', 700, '오늘 편하게 참여할 수 있는 작은 미션입니다.'),
      '',
      '오늘 할 일',
      '가능한 만큼 해보고, 글이나 사진으로 짧게 남겨 주세요.',
      '',
      '인증 방법',
      mission.requiresSubmission === false
        ? '#오늘의-미션 채널 안내를 확인하고 운영 기준에 맞게 참여해 주세요.'
        : '#오늘의-미션 채널에 글, 사진, 영상 중 편한 방식으로 인증을 올려 주세요.',
      '',
      `지급 포인트: ${formatPoints(mission.rewardPoints || 0)}`,
      '주의사항',
      '- 오늘의 미션 포인트는 하루 1회만 지급됩니다.',
      '- 운영자 확인 후 지급됩니다.',
      '- 얼굴, 주소, 연락처처럼 민감한 정보는 가려도 괜찮아요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildTodayMissionNoticePayload(mission) {
  return {
    embeds: [buildTodayMissionNoticeEmbed(mission)],
    allowedMentions: { parse: [] },
  };
}

function getTodayMissionNoticeMission() {
  return pointsRepository.findTodayActiveMission();
}

function createAdminMissionHubEmbed(missions, selectedMissionId = null, templates = [], selectedTemplateId = null, recommendations = [], todayRecommendation = null) {
  const selectedMission = getMissionHubSelection(missions, selectedMissionId);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)
    || (todayRecommendation && todayRecommendation.template)
    || templates[0]
    || null;
  const missionLines = missions.length > 0
    ? missions.slice(0, 8).map((mission) => {
      const marker = selectedMission && mission.id === selectedMission.id ? '>' : '-';
      return `${marker} \`${mission.id}\` ${truncateText(mission.title || '제목 없음', 60, '제목 없음')} / ${mission.status || 'unknown'} / ${formatPoints(mission.rewardPoints || 0)}`;
    })
    : ['등록된 미션이 없습니다.'];
  const selectedLines = selectedMission
    ? [
      `선택 미션: \`${selectedMission.id}\``,
      `상태: ${selectedMission.status || 'unknown'} / 지급: ${formatPoints(selectedMission.rewardPoints || 0)}`,
      `인증 필요: ${selectedMission.requiresSubmission === false ? '아니오' : '예'}`,
      `날짜: ${selectedMission.activeDate || '미지정'}`,
    ]
    : ['선택된 미션이 없습니다.'];
  const templateLines = templates.length > 0
    ? templates.slice(0, 8).map((template) => formatMissionTemplateLine(template, selectedTemplate ? selectedTemplate.id : null))
    : ['등록된 템플릿이 없습니다.'];
  const recommendationLines = recommendations.length > 0
    ? recommendations.map(formatWeekdayRecommendationLine)
    : ['요일별 추천이 없습니다.'];

  return createGuideEmbed(
    '미션 관리 허브',
    [
      '운영진 전용 미션 관리 화면입니다.',
      '아래에서 현재 미션을 확인하고 버튼으로 생성, 수정, 상태 변경을 진행할 수 있어요.',
      '',
      '현재 미션',
      ...missionLines,
      '',
      ...selectedLines,
      '',
      '참여자 안내문 미리보기',
      formatMissionParticipantPreview(selectedMission),
      '',
      '미션 템플릿',
      ...templateLines,
      '',
      '선택 템플릿 미리보기',
      formatMissionTemplatePreview(selectedTemplate),
      '',
      '요일별 추천',
      ...recommendationLines,
      '',
      '오늘의 추천',
      formatTodayMissionRecommendation(todayRecommendation),
      '',
      'active 상태의 미션만 참여자 `/미션`에 노출됩니다.',
      '템플릿 적용은 미션을 저장할 뿐 자동 공지는 보내지 않습니다.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

async function handleTodayMissionNoticePreview(interaction) {
  const mission = getTodayMissionNoticeMission();
  if (!mission) {
    await interaction.reply({
      content: '오늘 게시할 active 미션이 없어요. 템플릿을 오늘의 미션으로 적용하거나 미션을 active 상태로 만든 뒤 다시 확인해 주세요.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [createGuideEmbed(
      '오늘의 미션 공지 미리보기',
      buildTodayMissionNoticeEmbed(mission).data.description,
      {
        footer: OPERATOR_CHECK_FOOTER,
      }
    )],
    ephemeral: true,
  });
}

async function handleTodayMissionNoticePublish(interaction) {
  const mission = getTodayMissionNoticeMission();
  if (!mission) {
    await interaction.reply({
      content: '오늘 게시할 active 미션이 없어요. 템플릿을 오늘의 미션으로 적용하거나 미션을 active 상태로 만든 뒤 다시 시도해 주세요.',
      ephemeral: true,
    });
    return;
  }

  if (pointsRepository.hasTodayMissionNoticeBeenPublished()) {
    await interaction.reply({
      content: '이미 오늘의 미션을 게시했어요. 중복 게시하지 않았습니다.',
      ephemeral: true,
    });
    return;
  }

  const channelId = getConfiguredEnvValue('TODAY_MISSION_CHANNEL_ID');
  if (!channelId) {
    await interaction.reply({
      content: 'TODAY_MISSION_CHANNEL_ID가 설정되지 않아 오늘의 미션을 게시할 수 없어요.',
      ephemeral: true,
    });
    return;
  }

  const channel = await resolveConfiguredChannel(interaction, channelId);
  if (!channel || typeof channel.send !== 'function') {
    await interaction.reply({
      content: '오늘의 미션 채널을 찾지 못했거나 메시지를 보낼 수 없어요. 채널 ID와 봇 권한을 확인해 주세요.',
      ephemeral: true,
    });
    return;
  }

  const reservation = pointsRepository.reserveTodayMissionNoticePublication({
    missionId: mission.id,
    missionTitle: mission.title || null,
    channelId,
    publishedBy: interaction.user && interaction.user.id ? interaction.user.id : null,
  });

  if (!reservation.ok && reservation.reason === 'ALREADY_RESERVED') {
    await interaction.reply({
      content: '이미 오늘의 미션을 게시했어요. 중복 게시하지 않았습니다.',
      ephemeral: true,
    });
    return;
  }

  let message;
  try {
    message = await channel.send(buildTodayMissionNoticePayload(mission));
  } catch (error) {
    pointsRepository.failTodayMissionNoticePublication(reservation.record.id, error.message);
    await interaction.reply({
      content: `오늘의 미션 게시에 실패했어요. ${error.message}`,
      ephemeral: true,
    });
    return;
  }

  pointsRepository.completeTodayMissionNoticePublication(reservation.record.id, {
    messageId: message && message.id ? message.id : null,
    messageUrl: message && message.url ? message.url : null,
  });

  await interaction.reply({
    content: '오늘의 미션을 게시했어요.',
    ephemeral: true,
  });
}

function createMissionHubPayload(selectedMissionId = null, selectedTemplateId = null) {
  const missions = pointsRepository.listMissionsForAdmin({ limit: 25 });
  const selectedMission = getMissionHubSelection(missions, selectedMissionId);
  const baseTemplates = pointsRepository.listMissionTemplates({ limit: 25 });
  const recommendations = pointsRepository.listWeekdayMissionRecommendations();
  const todayRecommendation = pointsRepository.getTodayMissionRecommendation();
  const selectedRecommendationTemplate = todayRecommendation && todayRecommendation.template
    ? todayRecommendation.template
    : null;
  const templates = selectedRecommendationTemplate && !baseTemplates.some((template) => template.id === selectedRecommendationTemplate.id)
    ? [selectedRecommendationTemplate, ...baseTemplates.slice(0, 24)]
    : baseTemplates;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)
    || selectedRecommendationTemplate
    || templates[0]
    || null;

  return {
    embeds: [createAdminMissionHubEmbed(
      missions,
      selectedMission ? selectedMission.id : null,
      templates,
      selectedTemplate ? selectedTemplate.id : null,
      recommendations,
      todayRecommendation
    )],
    components: [
      createOperatorHubSelectRow('mission_management'),
      ...createOperatorMissionHubRows(missions, selectedMission ? selectedMission.id : null),
      ...createOperatorMissionTemplateRows(templates, selectedTemplate ? selectedTemplate.id : null),
    ],
  };
}

function resolveMissionHubToken(token) {
  const missions = pointsRepository.listMissionsForAdmin({ limit: 200 });
  return missions.find((mission) => createOperatorMissionHubToken(mission.id) === token) || null;
}

function getMissionHubTokenFromCustomId(customId) {
  const parts = String(customId || '').split(':');
  const token = parts.slice(2).join(':');
  return token && token !== 'none' ? token : '';
}

function getMissionTemplateIdFromCustomId(customId) {
  const prefix = OPERATOR_MISSION_HUB_BUTTON_IDS.applyTemplatePrefix;
  return String(customId || '').startsWith(prefix)
    ? String(customId).slice(prefix.length)
    : '';
}

function resolveMissionTemplateToken(token) {
  const templates = pointsRepository.listMissionTemplates({ limit: 200 });
  return templates.find((template) => createOperatorMissionTemplateToken(template.id) === token) || null;
}

function getMissionHubStatusInput(value, fallbackStatus = 'draft') {
  const normalized = String(value || fallbackStatus || 'draft').trim();
  const aliases = {
    활성: 'active',
    비활성: 'paused',
    일시중지: 'paused',
    종료: 'closed',
    초안: 'draft',
  };
  const status = aliases[normalized] || normalized;

  if (!['draft', 'active', 'paused', 'closed', 'archived'].includes(status)) {
    throw new Error('상태는 draft, active, paused, closed, archived 중 하나로 입력해 주세요.');
  }

  return status;
}

function createMissionHubModal(action, mission = null) {
  const isUpdate = action === 'update';
  const customId = isUpdate
    ? `admin_mission_hub_modal:update:${createOperatorMissionHubToken(mission.id)}`
    : 'admin_mission_hub_modal:create';

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(isUpdate ? '미션 수정' : '새 미션 만들기')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('미션 제목')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setValue(mission && mission.title ? truncateText(mission.title, 100, '') : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('미션 설명/안내 문구')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setValue(mission && mission.description ? truncateText(mission.description, 1000, '') : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rewardPoints')
          .setLabel('지급 포인트')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(8)
          .setValue(mission && mission.rewardPoints ? String(mission.rewardPoints) : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('status')
          .setLabel('상태')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setPlaceholder('draft, active, paused, closed')
          .setValue(mission && mission.status ? mission.status : 'draft')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('activeDate')
          .setLabel('미션 날짜 (YYYY-MM-DD)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(10)
          .setPlaceholder('비우면 오늘 날짜 또는 기존 날짜를 유지합니다.')
          .setValue(mission && mission.activeDate ? mission.activeDate : '')
      )
    );
}

function getMissionHubModalInput(interaction, fallbackStatus = 'draft', fallbackActiveDate = null) {
  const rewardPoints = Number.parseInt(interaction.fields.getTextInputValue('rewardPoints'), 10);
  if (!Number.isInteger(rewardPoints) || rewardPoints <= 0) {
    throw new Error('지급 포인트는 0보다 큰 정수로 입력해 주세요.');
  }

  const activeDateInput = interaction.fields.getTextInputValue('activeDate').trim();
  if (activeDateInput && !/^\d{4}-\d{2}-\d{2}$/.test(activeDateInput)) {
    throw new Error('미션 날짜는 YYYY-MM-DD 형식으로 입력해 주세요.');
  }

  return {
    title: interaction.fields.getTextInputValue('title'),
    description: interaction.fields.getTextInputValue('description'),
    rewardPoints,
    status: getMissionHubStatusInput(interaction.fields.getTextInputValue('status'), fallbackStatus),
    activeDate: activeDateInput || fallbackActiveDate,
  };
}

function createAdminShopListEmbed(items) {
  if (items.length === 0) {
    return createEmptyListEmbed('상점 관리 목록', '등록된 상점 항목이 없어요. `/상점관리 작업:추가`로 먼저 생성해 주세요.');
  }

  return createGuideEmbed(
    '상점 관리 목록',
    [
      ...items.map(formatAdminShopItemLine),
      '',
      'status가 active인 항목만 참여자 `/상점`에 노출됩니다.',
    ].join('\n\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function getShopHubSelection(items, selectedItemId = null) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items.find((item) => item.id === selectedItemId) || items[0];
}

function createAdminShopHubEmbed(items, selectedItemId = null) {
  const selectedItem = getShopHubSelection(items, selectedItemId);
  const itemLines = items.length > 0
    ? items.slice(0, 8).map((item) => {
      const marker = selectedItem && item.id === selectedItem.id ? '>' : '-';
      return `${marker} \`${item.id}\` ${truncateText(item.name || '이름 없음', 60, '이름 없음')} / ${item.status || 'unknown'} / ${formatPoints(item.cost || 0)}`;
    })
    : ['등록된 상점 항목이 없습니다.'];
  const selectedLines = selectedItem
    ? [
      `선택 항목: \`${selectedItem.id}\``,
      `상태: ${selectedItem.status || 'unknown'} / 비용: ${formatPoints(selectedItem.cost || 0)}`,
      `재고: ${formatNullableCount(selectedItem.stock, '개')} / 월한도: ${formatNullableCount(selectedItem.monthlyLimit, '회')}`,
      `유형: ${selectedItem.type || '미지정'}`,
      truncateText(selectedItem.description || '설명 없음', 500, '설명 없음'),
    ]
    : ['선택된 상점 항목이 없습니다.'];

  return createGuideEmbed(
    '상점 관리 허브',
    [
      '운영진 전용 상점 관리 화면입니다.',
      '아래에서 현재 상점 항목을 확인하고 버튼으로 생성, 수정, 상태 변경을 진행할 수 있어요.',
      '',
      '현재 상점 항목',
      ...itemLines,
      '',
      ...selectedLines,
      '',
      'active 상태의 항목만 참여자 `/상점`에 노출됩니다.',
      '재고, 월한도 등 세부 값은 `/상점관리`로도 조정할 수 있어요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function createShopHubPayload(selectedItemId = null) {
  const items = pointsRepository.listShopItemsForAdmin({ limit: 25 });
  const selectedItem = getShopHubSelection(items, selectedItemId);

  return {
    embeds: [createAdminShopHubEmbed(items, selectedItem ? selectedItem.id : null)],
    components: [
      createOperatorHubSelectRow('shop_management'),
      ...createOperatorShopHubRows(items, selectedItem ? selectedItem.id : null),
    ],
  };
}

function resolveShopHubToken(token) {
  const items = pointsRepository.listShopItemsForAdmin({ limit: 200 });
  return items.find((item) => createOperatorShopHubToken(item.id) === token) || null;
}

function getShopHubTokenFromCustomId(customId) {
  const parts = String(customId || '').split(':');
  const token = parts.slice(2).join(':');
  return token && token !== 'none' ? token : '';
}

function getShopHubTypeInput(value, fallbackType = 'reward') {
  const normalized = String(value || fallbackType || 'reward').trim();
  const aliases = {
    청년동포인트: 'youthCenterPoint',
    리워드: 'reward',
    굿즈: 'goods',
    이벤트: 'event',
  };
  const type = aliases[normalized] || normalized;

  if (!['youthCenterPoint', 'reward', 'goods', 'event'].includes(type)) {
    throw new Error('유형은 youthCenterPoint, reward, goods, event 중 하나로 입력해 주세요.');
  }

  return type;
}

function getShopHubStatusInput(value, fallbackStatus = 'paused') {
  const normalized = String(value || fallbackStatus || 'paused').trim();
  const aliases = {
    활성: 'active',
    비활성: 'paused',
    일시중지: 'paused',
    품절: 'soldOut',
    숨김: 'hidden',
  };
  const status = aliases[normalized] || normalized;

  if (!['active', 'paused', 'soldOut', 'hidden'].includes(status)) {
    throw new Error('상태는 active, paused, soldOut, hidden 중 하나로 입력해 주세요.');
  }

  return status;
}

function createShopHubModal(action, item = null) {
  const isUpdate = action === 'update';
  const customId = isUpdate
    ? `admin_shop_hub_modal:update:${createOperatorShopHubToken(item.id)}`
    : 'admin_shop_hub_modal:create';

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(isUpdate ? '상점 항목 수정' : '새 상점 항목 만들기')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('항목 이름')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setValue(item && item.name ? truncateText(item.name, 100, '') : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('항목 설명')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setValue(item && item.description ? truncateText(item.description, 1000, '') : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cost')
          .setLabel('필요 포인트')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(8)
          .setValue(item && item.cost ? String(item.cost) : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('type')
          .setLabel('유형')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setPlaceholder('youthCenterPoint, reward, goods, event')
          .setValue(item && item.type ? item.type : 'reward')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('status')
          .setLabel('상태')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setPlaceholder('active, paused, soldOut, hidden')
          .setValue(item && item.status ? item.status : 'paused')
      )
    );
}

function getShopHubModalInput(interaction, fallbackType = 'reward', fallbackStatus = 'paused') {
  const cost = Number.parseInt(interaction.fields.getTextInputValue('cost'), 10);
  if (!Number.isInteger(cost) || cost <= 0) {
    throw new Error('필요 포인트는 0보다 큰 정수로 입력해 주세요.');
  }

  return {
    name: interaction.fields.getTextInputValue('name'),
    description: interaction.fields.getTextInputValue('description'),
    cost,
    type: getShopHubTypeInput(interaction.fields.getTextInputValue('type'), fallbackType),
    status: getShopHubStatusInput(interaction.fields.getTextInputValue('status'), fallbackStatus),
  };
}

async function handleShopHubSelect(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const selectedItemToken = interaction.values && interaction.values[0] ? interaction.values[0] : null;
    const selectedItem = selectedItemToken ? resolveShopHubToken(selectedItemToken) : null;
    await interaction.update(createShopHubPayload(selectedItem ? selectedItem.id : null));
  } catch (error) {
    console.error('상점 관리 허브 선택 실패:', error.message);
    await interaction.reply({
      content: `상점 관리 허브를 불러오지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleShopHubButton(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    if (interaction.customId === OPERATOR_SHOP_HUB_BUTTON_IDS.create) {
      await interaction.showModal(createShopHubModal('create'));
      return;
    }

    if (interaction.customId === OPERATOR_SHOP_HUB_BUTTON_IDS.refresh) {
      await interaction.update(createShopHubPayload());
      return;
    }

    const itemToken = getShopHubTokenFromCustomId(interaction.customId);
    const item = itemToken ? resolveShopHubToken(itemToken) : null;

    if (interaction.customId.startsWith(OPERATOR_SHOP_HUB_BUTTON_IDS.editPrefix)) {
      if (!item) {
        await interaction.reply({
          content: '수정할 상점 항목을 찾지 못했어요. 새로고침 후 다시 시도해 주세요.',
          ephemeral: true,
        });
        return;
      }

      await interaction.showModal(createShopHubModal('update', item));
      return;
    }

    if (!item) {
      await interaction.reply({
        content: '대상 상점 항목을 찾지 못했어요. 새로고침 후 다시 시도해 주세요.',
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId.startsWith(OPERATOR_SHOP_HUB_BUTTON_IDS.togglePrefix)) {
      const updatedItem = pointsRepository.setShopItemStatus(item.id, item.status === 'active' ? 'paused' : 'active');
      await interaction.update(createShopHubPayload(updatedItem.id));
      return;
    }

    if (interaction.customId.startsWith(OPERATOR_SHOP_HUB_BUTTON_IDS.soldOutPrefix)) {
      const updatedItem = pointsRepository.setShopItemStatus(item.id, 'soldOut');
      await interaction.update(createShopHubPayload(updatedItem.id));
      return;
    }

    if (interaction.customId.startsWith(OPERATOR_SHOP_HUB_BUTTON_IDS.hidePrefix)) {
      const updatedItem = pointsRepository.setShopItemStatus(item.id, 'hidden');
      await interaction.update(createShopHubPayload(updatedItem.id));
      return;
    }
  } catch (error) {
    console.error('상점 관리 허브 처리 실패:', error.message);
    await interaction.reply({
      content: `상점 관리 허브 작업을 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleShopHubModal(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    let item;

    if (interaction.customId === 'admin_shop_hub_modal:create') {
      item = pointsRepository.createShopItem(getShopHubModalInput(interaction));
    } else {
      const itemToken = getShopHubTokenFromCustomId(interaction.customId);
      const currentItem = itemToken ? resolveShopHubToken(itemToken) : null;
      if (!currentItem) {
        await interaction.reply({
          content: '수정할 상점 항목을 찾지 못했어요. 새로고침 후 다시 시도해 주세요.',
          ephemeral: true,
        });
        return;
      }

      item = pointsRepository.updateShopItem(
        currentItem.id,
        getShopHubModalInput(interaction, currentItem.type || 'reward', currentItem.status || 'paused')
      );
    }

    await interaction.reply({
      ...createShopHubPayload(item.id),
      ephemeral: true,
    });
  } catch (error) {
    console.error('상점 관리 허브 저장 실패:', error.message);
    await interaction.reply({
      content: `상점 항목을 저장하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

function createNoticeEmbed(type) {
  const noticeText = getNoticeTemplate(type);

  return createGuideEmbed(
    '공지 템플릿',
    [
      '아래 문안을 필요한 만큼 다듬어 공지 채널에 사용해 주세요.',
      '세부 내용은 운영진 안내를 기준으로 확인해 주세요.',
      '',
      '```',
      noticeText,
      '```',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

async function handleGuideCommand(interaction) {
  recordParticipantCommandUse(interaction, '안내');
  const roleType = getOnboardingRoleType(interaction.member);
  const roleGuideMessage = getOnboardingGuideMessage(roleType);

  await interaction.reply({
    embeds: [createGuideEmbed(
      '📌 리디파인 이용 메뉴',
      [
        '필요한 내용을 버튼으로 바로 확인할 수 있어요.',
        '내 포인트 같은 개인 정보는 본인에게만 보여요.',
        roleGuideMessage ? '' : null,
        roleGuideMessage || null,
        '',
        '더 자세한 안내가 필요하면 아래 선택 메뉴도 함께 사용할 수 있어요.',
      ].filter((line) => line !== null).join('\n')
    )],
    components: [...createParticipantMenuButtonRows(), createGuideHubSelectRow()],
    ephemeral: true,
  });
}

function createPointBalanceEmbedForUser(userId) {
  const { pointsData } = pointsRepository.loadState();
  const user = getUser(pointsData, userId);
  const currentPoints = getUserPoints(pointsData, userId);
  const transactions = listPointTransactions(pointsData, userId, {
    latestFirst: true,
  });
  const balanceCheck = user ? validateUserBalance(pointsData, userId) : null;

  return createPointBalanceEmbed({
    currentPoints,
    transactions,
    balanceCheck,
  });
}

async function handleParticipantMenuButton(interaction) {
  if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.onboarding) {
    await interaction.reply({
      embeds: [createGuideEmbed(
        '처음 왔다면 여기부터',
        [
          '처음엔 모든 채널과 기능을 한 번에 다 보지 않아도 괜찮아요. 아래 순서대로만 확인해도 시작하기에 충분합니다.',
          '',
          '1. 참여동의 확인 채널 확인',
          '#참여동의-확인 채널이나 운영진이 안내한 참여동의 안내를 먼저 확인해 주세요. 동의 확인 방식이 헷갈리면 운영진에게 물어봐도 됩니다.',
          '',
          '2. 이름표/색상 고르기',
          '이름표나 색상 선택 채널에서 나를 편하게 알아볼 수 있는 표시를 골라 주세요. 꼭 화려하게 꾸미지 않아도 괜찮아요.',
          '',
          '3. `/안내` 메뉴 살펴보기',
          '`/안내`를 열면 오늘의 미션, 내 포인트, 상점/교환, 미니게임, 문의 방법을 버튼으로 다시 볼 수 있어요.',
          '',
          '4. 오늘의 미션 확인과 인증 방법',
          '`오늘의 미션 보기` 버튼을 눌러 오늘 할 수 있는 활동을 확인해 주세요. 오늘의 미션 채널에 글이나 사진을 올리면 인증이 접수되고, 운영자가 확인한 뒤 포인트가 지급됩니다.',
          '',
          '5. 포인트, 미니게임, 상점은 선택 활동',
          '`내 포인트 확인`으로 현재 포인트를 볼 수 있고, `미니게임`은 가볍게 즐기는 선택 활동이에요. 상점/교환은 포인트를 사용하고 싶을 때 천천히 확인하면 됩니다.',
          '',
          '처음엔 여기까지만 해도 충분해요. 지금은 아래 버튼 중 하나만 눌러 다음 안내를 이어서 봐도 됩니다.',
        ].join('\n')
      )],
      components: [createParticipantOnboardingNextStepRow()],
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.todayMission) {
    await interaction.reply({
      embeds: [createGuideEmbed(
        '오늘의 미션 보기',
        [
          '오늘의 미션 채널에 사진을 올리면 인증이 자동으로 접수돼요.',
          '접수되면 원본 메시지에 확인 반응이 남고, 안내는 DM으로 보내드려요.',
          '',
          '운영자가 확인한 뒤 포인트가 지급돼요.',
          '오늘의 미션 포인트는 하루 1회만 지급됩니다.',
        ].join('\n')
      )],
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.points) {
    await interaction.reply({
      embeds: [createPointBalanceEmbedForUser(interaction.user.id)],
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.ranking) {
    await interaction.reply({
      embeds: [createGuideEmbed(
        '랭킹 확인',
        [
          '랭킹 기능은 준비 중입니다.',
          '',
          '포인트와 랭킹은 비교나 평가가 아니라 가볍게 즐기는 요소예요.',
          '지금은 내 포인트를 먼저 확인해 주세요.',
        ].join('\n')
      )],
      ephemeral: true,
    });
    return;
  }

  if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.minigames) {
    if (!process.env.MINIGAME_CHANNEL_ID || interaction.channelId === process.env.MINIGAME_CHANNEL_ID) {
      await interaction.reply(createMinigameHubPayload());
      return;
    }

    await interaction.reply(createMinigameChannelGuidePayload());
    return;
  }

  if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.help) {
    await interaction.reply({
      embeds: [createGuideEmbed(
        '이용 방법 보기',
        [
          '1. 오늘의 미션 채널에 사진을 올리면 인증이 접수돼요.',
          '2. 운영자가 확인하면 포인트가 지급돼요.',
          '3. 오늘의 미션 포인트는 하루 1회만 지급돼요.',
          '4. 이미 지급된 뒤에는 중복 지급 없이 확인만 될 수 있어요.',
          '5. 반려된 경우 안내 내용을 확인한 뒤 다시 제출해주세요.',
        ].join('\n')
      )],
      ephemeral: true,
    });
  }
}

async function handleGuideHubSelect(interaction) {
  const selectedValue = interaction.values[0];
  const pointsData = pointsRepository.loadState().pointsData;
  const currentPoints = getUserPoints(pointsData, interaction.user.id);
  const activeMissionCount = pointsRepository.listActiveMissions().length;

  await interaction.update({
    embeds: [
      createGuideHubDetailEmbed(selectedValue, {
        currentPoints,
        activeMissionCount,
      }),
    ],
    components: [createGuideHubSelectRow(selectedValue)],
  });
}

async function handleChannelGuideCommand(interaction) {
  const roleType = getOnboardingRoleType(interaction.member);
  const roleNote = getChannelGuideRoleNote(roleType);

  await interaction.reply({ embeds: [createChannelGuideEmbed({ roleNote })] });
}

async function handleQuestionCommand(interaction) {
  const question = interaction.options.getString('내용');
  const sensitiveDetection = detectSensitiveQuestion(question);

  if (sensitiveDetection) {
    const embed = createGuideEmbed(
      '운영진 확인이 필요한 질문이에요',
      getSensitiveQuestionUserMessage(sensitiveDetection),
      {
        footer: OPERATOR_CHECK_FOOTER,
      }
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    await sendSensitiveQuestionAlert(interaction, question, sensitiveDetection);
    return;
  }

  const matchedFaq = findFaqAnswer(question);

  if (matchedFaq) {
    await interaction.reply({
      embeds: [
        createGuideEmbed(
          matchedFaq.question,
          matchedFaq.answer
        ),
      ],
    });
    return;
  }

  const matchedKnowledge = findKnowledgeAnswer(question);

  if (matchedKnowledge) {
    await interaction.reply({ embeds: [createKnowledgeEmbed(matchedKnowledge)] });
    return;
  }

  const aiFallbackAnswer = getAiFallbackAnswer(question);

  if (aiFallbackAnswer) {
    const embed = createGuideEmbed(
      '운영진 확인이 필요한 질문이에요',
      aiFallbackAnswer,
      {
        footer: OPERATOR_CHECK_FOOTER,
      }
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    pointsRepository.recordFaqFallbackCandidate({ question });
    await sendUnansweredQuestionLog(interaction, question);
    return;
  }

  const embed = createGuideEmbed(
    '운영진 확인이 필요한 질문이에요',
    [
      '지금 등록된 FAQ와 지식창고에서는 딱 맞는 답변을 찾지 못했어요.',
      '',
      '질문을 조금 다르게 적어 다시 물어보거나,',
      '문의 채널에 남겨 주세요.',
      '운영진이 확인 후 순차적으로 안내드릴게요.',
      '',
      '예시:',
      '`/질문 내용: 처음 왔는데 뭐부터 해요?`',
      '`/질문 내용: 참여동의 어디서 해요?`',
      '`/질문 내용: 오늘 못 갈 것 같아요`',
      '`/질문 내용: 포인트 어떻게 얻어요?`',
      '`/질문 내용: 음성채널 꼭 들어가야 해요?`',
    ].join('\n')
  );

  await interaction.reply({ embeds: [embed], ephemeral: true });
  recordFaqFallbackQuestion(question);
  await sendUnansweredQuestionLog(interaction, question);
}

async function handleNoticeCommand(interaction) {
  const type = interaction.options.getString('종류');

  await interaction.reply({
    embeds: [createNoticeEmbed(type)],
    ephemeral: true,
  });
}

async function handlePointCommand(interaction) {
  try {
    recordParticipantCommandUse(interaction, '포인트');
    await interaction.reply({
      embeds: [createPointBalanceEmbedForUser(interaction.user.id)],
      ephemeral: true,
    });
  } catch (error) {
    console.error('포인트 정보 로드 실패:', error.message);
    await interaction.reply({
      content: '포인트 정보를 불러오지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleShopCommand(interaction) {
  try {
    recordParticipantCommandUse(interaction, '상점');
    await replyWithShopSelection(interaction);
  } catch (error) {
    console.error('상점 정보 로드 실패:', error.message);
    await interaction.reply({
      content: '상점 정보를 불러오지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleCheckinCommand(interaction) {
  try {
    const content = interaction.options.getString('내용');
    const result = pointsRepository.createCheckin({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      content,
    });

    if (!result.ok && result.reason === 'ALREADY_CHECKED_IN') {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '오늘은 이미 체크인을 완료했어요',
            [
              '내일 다시 체크인할 수 있어요.',
              '중복 포인트는 지급되지 않아요.',
              '',
              '체크인은 경쟁이나 출석 압박이 아니라 가벼운 참여 기록이에요.',
            ].join('\n')
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '오늘의 체크인이 기록됐어요',
          [
            `지급 포인트: ${formatPoints(CHECKIN_REWARD_POINTS)}`,
            `현재 보유 포인트: ${formatPoints(result.transaction.balanceAfter)}`,
            `오늘 남긴 한마디: ${content || '남긴 한마디 없음'}`,
            '',
            '체크인은 참여를 돕는 가벼운 기록이에요. 운영 기준에 따라 지급 포인트는 조정될 수 있어요.',
          ].join('\n')
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('체크인 처리 실패:', error.message);
    await interaction.reply({
      content: '체크인을 처리하지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleMissionCommand(interaction) {
  try {
    recordParticipantCommandUse(interaction, '미션');
    await replyWithMissionSelection(interaction);
  } catch (error) {
    console.error('미션 목록 조회 실패:', error.message);
    await interaction.reply({
      content: '미션 목록을 불러오지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleShopSelect(interaction) {
  const displayCode = interaction.values[0];
  const item = pointsRepository.resolveActiveShopItem(displayCode);

  if (!item) {
    await interaction.update({
      embeds: [
        createGuideEmbed(
          '상점 항목을 찾지 못했어요',
          '`/상점`을 다시 실행해 현재 선택 가능한 항목을 확인해 주세요.',
          { footer: OPERATOR_CHECK_FOOTER }
        ),
      ],
      components: [],
    });
    return;
  }

  const currentPoints = getUserPoints(pointsRepository.loadState().pointsData, interaction.user.id);
  const balanceAfter = currentPoints - item.cost;

  if (balanceAfter < 0) {
    await interaction.update({
      embeds: [
        createGuideEmbed(
          '아직 포인트가 조금 부족해요',
          [
            `${getShopTypeLabel(item.type)} ${item.name}`,
            '',
            createInsufficientPointsDescription({
              currentPoints,
              requiredPoints: item.cost,
            }),
          ].join('\n'),
        ),
      ],
      components: [],
    });
    return;
  }

  await interaction.update({
    embeds: [
      createGuideEmbed(
        '교환 신청 전 확인해 주세요',
        [
          `${getShopTypeLabel(item.type)}`,
          `${item.name}`,
          '',
          `필요 포인트: ${formatPoints(item.cost)}`,
          `현재 포인트: ${formatPoints(currentPoints)}`,
          `신청 후 포인트: ${formatPoints(balanceAfter)}`,
          '',
          '신청하면 포인트가 차감돼요.',
          '단순 변심에 따른 취소나 환불은 원칙적으로 어렵습니다.',
          '',
          `직접 입력용 신청 코드: ${item.displayCode}`,
        ].join('\n'),
        { footer: OPERATOR_CHECK_FOOTER }
      ),
    ],
    components: [createRedemptionConfirmRow(item.displayCode)],
  });
}

async function handleRedemptionConfirmButton(interaction) {
  const displayCode = interaction.customId.split(':')[1];

  if (interaction.customId.startsWith('participant_redeem_cancel_check:')) {
    await interaction.update({
      embeds: [
        createGuideEmbed(
          '교환 신청을 종료할까요?',
          [
            '아직 포인트는 차감되지 않았어요.',
          ].join('\n')
        ),
      ],
      components: [createRedemptionCancelConfirmRow(displayCode)],
    });
    return;
  }

  if (interaction.customId.startsWith('participant_redeem_cancel_back:')) {
    const item = pointsRepository.resolveActiveShopItem(displayCode);

    if (!item) {
      await interaction.update({
        embeds: [
          createGuideEmbed(
            '상점 항목을 찾지 못했어요',
            '`/상점`을 다시 실행해 현재 선택 가능한 항목을 확인해 주세요.',
            { footer: OPERATOR_CHECK_FOOTER }
          ),
        ],
        components: [],
      });
      return;
    }

    const currentPoints = getUserPoints(pointsRepository.loadState().pointsData, interaction.user.id);
    const balanceAfter = currentPoints - item.cost;

    await interaction.update({
      embeds: [
        createGuideEmbed(
          '교환 신청 전 확인해 주세요',
          [
            `${getShopTypeLabel(item.type)}`,
            `${item.name}`,
            '',
            `필요 포인트: ${formatPoints(item.cost)}`,
            `현재 포인트: ${formatPoints(currentPoints)}`,
            `신청 후 포인트: ${formatPoints(balanceAfter)}`,
            '',
            '신청하면 포인트가 차감돼요.',
            '단순 변심에 따른 취소나 환불은 원칙적으로 어렵습니다.',
            '',
            `직접 입력용 신청 코드: ${item.displayCode}`,
          ].join('\n'),
          { footer: OPERATOR_CHECK_FOOTER }
        ),
      ],
      components: [createRedemptionConfirmRow(displayCode)],
    });
    return;
  }

  if (interaction.customId.startsWith('participant_redeem_cancel_done:')) {
    await interaction.update({
      embeds: [
        createGuideEmbed(
          '교환 신청을 진행하지 않았어요',
          [
            '포인트는 차감되지 않았어요.',
            '',
            '`/상점`에서 다시 항목을 선택할 수 있어요.',
          ].join('\n')
        ),
      ],
      components: [],
    });
    return;
  }

  try {
    const result = pointsRepository.requestRedemption({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      itemId: displayCode,
      note: `participant ux flow ${displayCode}`,
    });

    if (!result.ok) {
      await interaction.update({
        embeds: [
          createGuideEmbed(
            '교환 신청을 접수하지 못했어요',
            getRedemptionFailureMessage(result.reason),
            { footer: OPERATOR_CHECK_FOOTER }
          ),
        ],
        components: [],
      });
      return;
    }

    await interaction.update({
      embeds: [
        createGuideEmbed(
          '교환 신청이 접수됐어요',
          [
            `신청한 항목: ${result.item.name}`,
            `차감 포인트: ${formatPoints(result.item.cost)}`,
            `현재 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
            '',
            '운영진이 순차적으로 확인할게요.',
          ].join('\n'),
        ),
      ],
      components: [],
    });
    await sendRedemptionReviewAlert(interaction, result.redemption, result.item, result.user, result.transaction);
  } catch (error) {
    console.error('교환 확인 버튼 처리 실패:', error.message);
    await interaction.update({
      embeds: [
        createGuideEmbed(
          '교환 신청을 처리하지 못했어요',
          '운영진에게 알려주세요.',
          { footer: OPERATOR_CHECK_FOOTER }
        ),
      ],
      components: [],
    });
  }
}

async function handleMissionSelect(interaction) {
  const displayCode = interaction.values[0];
  const mission = pointsRepository.resolveActiveMission(displayCode);

  if (!mission) {
    await interaction.reply({
      content: '`/미션`을 다시 실행해 현재 선택 가능한 미션을 확인해 주세요.',
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(createMissionSubmissionModal(mission));
}

async function handleMissionSubmissionModal(interaction) {
  const displayCode = interaction.customId.split(':')[1];
  const content = interaction.fields.getTextInputValue('content');

  try {
    const result = pointsRepository.createMissionSubmission({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      missionId: displayCode,
      content,
      attachment: null,
    });

    if (!result.ok) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '인증 제출을 접수하지 못했어요',
            getSubmissionFailureMessage(result.reason),
            { footer: OPERATOR_CHECK_FOOTER }
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '인증 제출이 접수됐어요',
          [
            `미션: ${result.mission.title || result.mission.id}`,
            '',
            '운영진 확인 후 포인트가 지급돼요.',
            '사진이나 영상이 필요한 미션은 `/인증` 첨부파일 옵션으로 제출해 주세요.',
          ].join('\n'),
        ),
      ],
      ephemeral: true,
    });
    await sendMissionSubmissionReviewAlert(interaction, result.submission, result.mission);
  } catch (error) {
    console.error('인증 입력 모달 처리 실패:', error.message);
    await interaction.reply({
      content: '인증 제출을 처리하지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

function getSubmissionFailureMessage(reason) {
  const messages = {
    MISSION_NOT_FOUND: '해당 미션을 찾지 못했어요. `/미션`에서 현재 참여 가능한 미션을 확인해 주세요.',
    MISSION_NOT_ACTIVE: '해당 미션은 현재 인증을 접수하는 상태가 아니에요.',
    DUPLICATE_SUBMISSION: '이 미션은 이미 제출한 기록이 있어요. 운영진 확인을 기다려 주세요.',
  };

  return messages[reason] || '인증 제출 조건을 확인하지 못했어요. 운영진에게 알려주세요.';
}

async function handleSubmissionCommand(interaction) {
  try {
    const missionId = getOptionalStringOption(interaction.options, '미션')
      || getOptionalStringOption(interaction.options, '미션id');
    const content = getOptionalStringOption(interaction.options, '내용');
    const attachment = typeof interaction.options.getAttachment === 'function'
      ? serializeAttachment(interaction.options.getAttachment('첨부파일'))
      : null;

    if (!missionId) {
      await replyWithMissionSelection(interaction);
      return;
    }

    if (!content && !attachment) {
      const mission = pointsRepository.resolveActiveMission(missionId);

      if (!mission) {
        const existingMission = pointsRepository.findMission(missionId);
        await interaction.reply({
          embeds: [
            createGuideEmbed(
              '인증 제출을 접수하지 못했어요',
              getSubmissionFailureMessage(existingMission ? 'MISSION_NOT_ACTIVE' : 'MISSION_NOT_FOUND'),
              { footer: OPERATOR_CHECK_FOOTER }
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.showModal(createMissionSubmissionModal(mission));
      return;
    }

    const result = pointsRepository.createMissionSubmission({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      missionId,
      content,
      attachment,
    });

    if (!result.ok) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '인증 제출을 접수하지 못했어요',
            getSubmissionFailureMessage(result.reason),
            {
              footer: OPERATOR_CHECK_FOOTER,
            }
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '인증 제출이 접수됐어요',
          [
            `미션: ${result.mission.title || result.mission.id}`,
            attachment ? `첨부파일: ${attachment.name || '있음'}` : '첨부파일: 없음',
            '',
            '운영진 확인 후 포인트가 지급돼요.',
            '글로 남길 수 있는 미션은 `/미션`에서 선택해 제출할 수 있어요.',
            '사진이나 영상이 필요한 경우 `/인증`에서 첨부파일을 함께 올려 주세요.',
          ].join('\n'),
        ),
      ],
      ephemeral: true,
    });
    await sendMissionSubmissionReviewAlert(interaction, result.submission, result.mission);
  } catch (error) {
    console.error('인증 제출 처리 실패:', error.message);
    await interaction.reply({
      content: '인증 제출을 처리하지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleSubmissionManageCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 명령어는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const submissionId = interaction.options.getString('제출id');
    const action = interaction.options.getString('처리');
    const note = interaction.options.getString('메모');
    const result = pointsRepository.reviewSubmissionById(
      submissionId,
      action,
      {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      note
    );
    const pointLines = result.transaction
      ? [
        `지급 포인트: ${formatPoints(result.transaction.amount)}`,
        `지급 후 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
        `거래 ID: \`${result.transaction.id}\``,
      ]
      : ['포인트는 지급하지 않았어요.'];

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          action === 'approve' ? '인증 승인 완료' : '인증 반려 완료',
          [
            `제출 ID: \`${result.submission.id}\``,
            `상태: ${result.submission.status}`,
            `미션 ID: ${result.submission.missionId}`,
            ...pointLines,
            `처리자 ID: ${interaction.user.id}`,
            ...(note ? [`메모: ${note}`] : []),
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('인증 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `인증 처리를 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function sendEphemeralAfterUpdate(interaction, payload) {
  if (typeof interaction.followUp === 'function') {
    await interaction.followUp({
      ...payload,
      ephemeral: true,
    });
    return;
  }

  if (typeof interaction.reply === 'function') {
    await interaction.reply({
      ...payload,
      ephemeral: true,
    });
  }
}

async function handleSubmissionReviewButton(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '운영진만 처리할 수 있어요.',
      ephemeral: true,
    });
    return;
  }

  const action = getSubmissionReviewButtonAction(interaction.customId);
  const submissionId = getSubmissionIdFromReviewButton(interaction.customId);
  const reviewer = {
    userId: interaction.user.id,
    displayName: getMemberDisplayName(interaction.user, interaction.member),
  };

  try {
    const result = action === 'approve'
      ? pointsRepository.approveSubmissionById(submissionId, reviewer, '운영자 검토 버튼 처리')
      : pointsRepository.rejectSubmissionById(submissionId, reviewer, '운영자 검토 버튼 처리');
    const embed = buildSubmissionReviewStatusEmbed(
      interaction.message && interaction.message.embeds && interaction.message.embeds[0],
      result,
      reviewer.displayName
    );

    await interaction.update({
      embeds: [embed],
      components: [createSubmissionReviewActionRow(submissionId, true)],
    });
    await sendSubmissionReviewDm(interaction, result);
    await sendMissionSubmissionReviewLog(interaction.client, result, reviewer.displayName);

    const participant = result.submission.displayName || result.submission.userId;
    const duplicateBlocked = result.submission.duplicateRewardBlocked === true;
    const lines = action === 'approve'
      ? [
        '승인 완료',
        duplicateBlocked
          ? '지급 포인트: 이미 오늘 지급 완료 / 추가 지급 없음'
          : `지급 포인트: ${formatPoints(result.transaction ? result.transaction.amount : 0)}`,
        `참여자: ${participant}`,
      ]
      : [
        '반려 완료',
        `참여자: ${participant}`,
      ];

    await sendEphemeralAfterUpdate(interaction, {
      content: lines.join('\n'),
    });
  } catch (error) {
    if (/이미 처리된 인증 제출/.test(error.message)) {
      const submission = pointsRepository.findSubmission(submissionId);
      const mission = submission ? pointsRepository.findMission(submission.missionId) : null;
      const result = {
        submission: submission || {
          id: submissionId,
          status: 'reviewed',
          missionId: null,
          reviewedBy: null,
          reviewedAt: null,
        },
        mission,
        transaction: null,
      };
      const embed = buildSubmissionReviewStatusEmbed(
        interaction.message && interaction.message.embeds && interaction.message.embeds[0],
        result,
        reviewer.displayName,
        true
      );

      await interaction.update({
        embeds: [embed],
        components: [createSubmissionReviewActionRow(submissionId, true)],
      });
      await sendEphemeralAfterUpdate(interaction, {
        content: '이미 처리된 인증 제출이에요.',
      });
      return;
    }

    console.error('인증 검토 버튼 처리 실패:', error.message);
    await interaction.reply({
      content: `인증 처리를 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleRedemptionCommand(interaction) {
  try {
    const itemId = getOptionalStringOption(interaction.options, '항목');
    const note = getOptionalStringOption(interaction.options, '메모');

    if (!itemId) {
      await replyWithShopSelection(interaction);
      return;
    }

    const result = pointsRepository.requestRedemption({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      itemId,
      note,
    });

    if (!result.ok) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '교환 신청을 접수하지 못했어요',
            getRedemptionFailureMessage(result.reason),
            {
              footer: OPERATOR_CHECK_FOOTER,
            }
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '교환 신청이 접수됐어요',
          [
            `신청 코드: \`${result.item.displayCode || itemId}\``,
            `항목: ${result.item.name}`,
            `차감 포인트: ${formatPoints(result.item.cost)}`,
            `현재 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
            '',
            '운영진이 순차적으로 확인할게요.',
            '신청 코드는 `/상점`에서 확인할 수 있어요.',
            '청년동 포인트 전환권은 청년동 내부 사용처에 한정된 운영진 처리 항목이며, 현금 환급이나 외부 교환 대상이 아니에요.',
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
    await sendRedemptionReviewAlert(interaction, result.redemption, result.item, result.user, result.transaction);
  } catch (error) {
    console.error('교환 신청 처리 실패:', error.message);
    await interaction.reply({
      content: '교환 신청을 처리하지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handlePointManageCommand(interaction) {
  try {
    const target = interaction.options.getUser('대상');
    const amount = interaction.options.getInteger('증감');
    const reason = interaction.options.getString('사유');
    const result = pointsRepository.adjustUserPoints({
      user: {
        userId: target.id,
        displayName: target.username,
      },
      amount,
      reason,
      operatorId: interaction.user.id,
    });

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '포인트 조정 완료',
          [
            `대상: ${target.username}`,
            `증감: ${formatTransactionAmount(result.transaction.amount)}`,
            `조정 후 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
            `거래 ID: \`${result.transaction.id}\``,
            `사유: ${reason}`,
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('포인트 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `포인트 조정을 처리하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleRedemptionManageCommand(interaction) {
  try {
    const redemptionId = interaction.options.getString('신청id');
    const action = interaction.options.getString('처리');
    const note = interaction.options.getString('메모');
    const result = pointsRepository.reviewRedemption({
      redemptionId,
      action,
      note,
      operatorId: interaction.user.id,
    });
    const refundLine = result.refundTransaction
      ? [`환불 거래 ID: \`${result.refundTransaction.id}\``, `환불 후 잔액: ${formatPoints(result.refundTransaction.balanceAfter)}`]
      : [];

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '교환 신청 처리 완료',
          [
            `신청 ID: \`${result.redemption.id}\``,
            `상태: ${result.redemption.status}`,
            `사용자 ID: ${result.redemption.userId}`,
            ...refundLine,
            `처리자 ID: ${interaction.user.id}`,
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('교환 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `교환 신청 처리를 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handlePointLogCommand(interaction) {
  try {
    const user = interaction.options.getUser('사용자');
    const type = interaction.options.getString('종류');
    const limit = interaction.options.getInteger('개수') || 10;
    const transactions = pointsRepository.listOperationalTransactions({
      userId: user ? user.id : undefined,
      type: type || undefined,
      limit,
    });

    await interaction.reply({
      embeds: [createPointTransactionLogEmbed(transactions)],
      ephemeral: true,
    });
  } catch (error) {
    console.error('포인트 로그 조회 실패:', error.message);
    await interaction.reply({
      content: '포인트 로그를 불러오지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

function getOperatorHubEmbed(value, limit = 10) {
  if (value === 'today_queue') {
    return buildOperatorTodayQueueEmbed(buildTodayOperationsQueue(pointsRepository, limit));
  }

  if (value === 'first_day_check') {
    return buildOperatorFirstDayCheckEmbed(buildFirstDayCheck(pointsRepository, { limit }));
  }

  if (value === 'redemptions') {
    return buildOperatorRedemptionsEmbed(pointsRepository.listPendingRedemptions(limit));
  }

  if (value === 'submissions') {
    return buildOperatorSubmissionsEmbed(pointsRepository.listPendingSubmissions(limit));
  }

  if (value === 'points') {
    return buildOperatorPointLogsEmbed(pointsRepository.listOperationalTransactions({ limit }));
  }

  if (value === 'missions_shop') {
    return buildOperatorMissionsShopEmbed(pointsRepository.getOperationSummary());
  }

  if (value === 'mission_management') {
    return createAdminMissionHubEmbed(pointsRepository.listMissionsForAdmin({ limit: 25 }));
  }

  if (value === 'reaction_approvals') {
    return buildOperatorReactionApprovalsEmbed(pointsRepository.listRecentReactionApprovals(limit));
  }

  if (value === 'reaction_followups') {
    return buildOperatorReactionFollowUpsEmbed(buildReactionFollowUpQueue(pointsRepository, limit));
  }

  if (value === 'onboarding_signals') {
    return buildOperatorOnboardingSignalsEmbed(buildOnboardingSignals(pointsRepository, limit));
  }

  if (value === 'faq_candidates') {
    return buildOperatorFaqCandidatesEmbed(buildFaqCandidateQueue(pointsRepository, limit));
  }

  if (value === 'environment_check') {
    return buildOperatorEnvironmentCheckEmbed();
  }

  if (value === 'invitation_notice') {
    return buildOperatorInvitationNoticeEmbed();
  }

  if (value === 'prelaunch_check') {
    return buildOperatorPrelaunchCheckEmbed();
  }

  if (value === 'exports') {
    return buildOperatorExportGuideEmbed();
  }

  if (value === 'checklist') {
    return buildOperatorChecklistEmbed();
  }

  return buildOperatorHubEmbed(pointsRepository.getOperationSummary());
}

async function handleOperatorHubSelect(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const selectedValue = interaction.values && interaction.values[0] ? interaction.values[0] : 'overview';
    let payload;

    if (selectedValue === 'mission_management') {
      payload = createMissionHubPayload();
    } else if (selectedValue === 'shop_management') {
      payload = createShopHubPayload();
    } else if (selectedValue === 'first_day_check') {
      payload = await createOperatorFirstDayCheckPayload(interaction);
    } else if (selectedValue === 'environment_check') {
      payload = {
        embeds: [buildOperatorEnvironmentCheckEmbed(await createOperatorEnvironmentCheck(interaction))],
        components: [createOperatorHubSelectRow(selectedValue)],
      };
    } else if (selectedValue === 'prelaunch_check') {
      payload = await createOperatorPrelaunchCheckPayload(interaction);
    } else {
      payload = {
        embeds: [getOperatorHubEmbed(selectedValue, 10)],
        components: [createOperatorHubSelectRow(selectedValue)],
      };
    }

    if (typeof interaction.update === 'function') {
      await interaction.update(payload);
      return;
    }

    await interaction.reply({
      ...payload,
      ephemeral: true,
    });
  } catch (error) {
    console.error('운영 허브 메뉴 조회 실패:', error.message);
    await interaction.reply({
      content: `운영 허브 메뉴를 불러오지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleMissionHubSelect(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const selectedMissionId = interaction.values && interaction.values[0] ? interaction.values[0] : null;
    const selectedMission = selectedMissionId ? resolveMissionHubToken(selectedMissionId) : null;
    await interaction.update(createMissionHubPayload(selectedMission ? selectedMission.id : null));
  } catch (error) {
    console.error('미션 관리 허브 선택 실패:', error.message);
    await interaction.reply({
      content: `미션 관리 허브를 불러오지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleOperatorInvitationNoticeButton(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [buildOperatorInvitationNoticeEmbed()],
    components: [createOperatorHubSelectRow('invitation_notice')],
    ephemeral: true,
  });
}

async function handleOperatorPrelaunchCheckButton(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    ...(await createOperatorPrelaunchCheckPayload(interaction)),
    ephemeral: true,
  });
}

async function handleOperatorPrelaunchOpenEnvironmentCheckButton(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [buildOperatorEnvironmentCheckEmbed(await createOperatorEnvironmentCheck(interaction))],
    components: [createOperatorHubSelectRow('environment_check')],
    ephemeral: true,
  });
}

async function handleOperatorPrelaunchOpenMissionHubButton(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    ...createMissionHubPayload(),
    ephemeral: true,
  });
}

async function handleOperatorPrelaunchOpenShopHubButton(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    ...createShopHubPayload(),
    ephemeral: true,
  });
}

async function handleMissionTemplateSelect(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const templateToken = interaction.values && interaction.values[0] ? interaction.values[0] : null;
    const selectedTemplate = templateToken ? resolveMissionTemplateToken(templateToken) : null;
    await interaction.update(createMissionHubPayload(null, selectedTemplate ? selectedTemplate.id : null));
  } catch (error) {
    console.error('미션 템플릿 선택 실패:', error.message);
    await interaction.reply({
      content: `미션 템플릿을 불러오지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleMissionHubButton(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    if (interaction.customId === OPERATOR_MISSION_HUB_BUTTON_IDS.create) {
      await interaction.showModal(createMissionHubModal('create'));
      return;
    }

    if (interaction.customId === OPERATOR_MISSION_HUB_BUTTON_IDS.refresh) {
      await interaction.update(createMissionHubPayload());
      return;
    }

    if (interaction.customId === OPERATOR_MISSION_HUB_BUTTON_IDS.previewTodayNotice) {
      await handleTodayMissionNoticePreview(interaction);
      return;
    }

    if (interaction.customId === OPERATOR_MISSION_HUB_BUTTON_IDS.publishTodayNotice) {
      await handleTodayMissionNoticePublish(interaction);
      return;
    }

    if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.applyTemplatePrefix)) {
      const templateToken = getMissionTemplateIdFromCustomId(interaction.customId);
      const template = resolveMissionTemplateToken(templateToken);
      if (!template) {
        await interaction.reply({
          content: '선택한 템플릿을 찾지 못했어요. 허브를 새로고침한 뒤 다시 시도해 주세요.',
          ephemeral: true,
        });
        return;
      }

      const result = pointsRepository.createMissionFromTemplateForToday(template.id);
      if (!result.ok && result.reason === 'TODAY_MISSION_EXISTS') {
        await interaction.update(createMissionHubPayload(result.mission.id, template.id));
        await sendEphemeralAfterUpdate(interaction, {
          content: `이미 오늘의 active 미션이 있어요: ${result.mission.title || result.mission.id}. 중복 생성하지 않았습니다.`,
        });
        return;
      }

      if (!result.ok) {
        await interaction.reply({
          content: '선택한 템플릿을 찾지 못했어요. 허브를 새로고침한 뒤 다시 시도해 주세요.',
          ephemeral: true,
        });
        return;
      }

      await interaction.update(createMissionHubPayload(result.mission.id, result.template.id));
      await sendEphemeralAfterUpdate(interaction, {
        content: `${result.template.title || result.template.id} 템플릿을 오늘의 미션으로 저장했어요. 이제 공지 미리보기 후 게시할 수 있어요.${result.template.isExample ? ' 이 템플릿은 예시 템플릿입니다.' : ''}`,
      });
      return;
    }

    const missionToken = getMissionHubTokenFromCustomId(interaction.customId);
    const mission = missionToken ? resolveMissionHubToken(missionToken) : null;
    if (!mission) {
      await interaction.reply({
        content: '대상 미션을 찾지 못했어요. 허브를 새로고침한 뒤 다시 선택해 주세요.',
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.editPrefix)) {
      await interaction.showModal(createMissionHubModal('update', mission));
      return;
    }

    if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.togglePrefix)) {
      const nextStatus = mission.status === 'active' ? 'paused' : 'active';
      const updatedMission = pointsRepository.setMissionStatus(mission.id, nextStatus);
      await interaction.update(createMissionHubPayload(updatedMission.id));
      await sendEphemeralAfterUpdate(interaction, {
        content: `${updatedMission.title || updatedMission.id} 상태를 ${updatedMission.status}로 변경했어요.`,
      });
      return;
    }

    if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.closePrefix)) {
      const updatedMission = pointsRepository.setMissionStatus(mission.id, 'closed');
      await interaction.update(createMissionHubPayload(updatedMission.id));
      await sendEphemeralAfterUpdate(interaction, {
        content: `${updatedMission.title || updatedMission.id} 미션을 종료 상태로 변경했어요.`,
      });
      return;
    }

    if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.toggleSubmissionPrefix)) {
      const nextRequiresSubmission = mission.requiresSubmission === false;
      const updatedMission = pointsRepository.updateMission(mission.id, { requiresSubmission: nextRequiresSubmission });
      await interaction.update(createMissionHubPayload(updatedMission.id));
      await sendEphemeralAfterUpdate(interaction, {
        content: `${updatedMission.title || updatedMission.id} 인증 필요 여부를 ${updatedMission.requiresSubmission === false ? '아니오' : '예'}로 변경했어요.`,
      });
      return;
    }

    await interaction.reply({
      content: '지원하지 않는 미션 관리 허브 버튼이에요. 허브를 새로고침한 뒤 다시 시도해 주세요.',
      ephemeral: true,
    });
  } catch (error) {
    console.error('미션 관리 허브 버튼 처리 실패:', error.message);
    await interaction.reply({
      content: `미션 관리 허브 작업을 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleMissionHubModal(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 메뉴는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const missionToken = parts.slice(2).join(':');
    let mission;

    if (action === 'create') {
      mission = pointsRepository.createMission({
        ...getMissionHubModalInput(interaction, 'draft'),
        requiresSubmission: true,
      });
    } else if (action === 'update') {
      const currentMission = resolveMissionHubToken(missionToken);
      if (!currentMission) {
        throw new Error('수정할 미션을 찾을 수 없습니다.');
      }
      mission = pointsRepository.updateMission(
        currentMission.id,
        getMissionHubModalInput(interaction, currentMission.status || 'draft', currentMission.activeDate || null)
      );
    } else {
      throw new Error('지원하지 않는 미션 허브 작업입니다.');
    }

    await interaction.reply({
      embeds: [createMissionAdminResultEmbed(action === 'create' ? '미션 생성 완료' : '미션 수정 완료', mission, [
        '',
        mission.status === 'active'
          ? '이 미션은 참여자 `/미션`에 노출됩니다.'
          : 'active 상태가 아니므로 참여자 `/미션`에는 노출되지 않습니다.',
      ])],
      components: [
        createOperatorHubSelectRow('mission_management'),
        ...createOperatorMissionHubRows(pointsRepository.listMissionsForAdmin({ limit: 25 }), mission.id),
        ...createOperatorMissionTemplateRows(pointsRepository.listMissionTemplates({ limit: 25 })),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('미션 관리 허브 모달 처리 실패:', error.message);
    await interaction.reply({
      content: `미션 저장을 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleOperationStatusCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 명령어는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const type = interaction.options.getString('종류') || 'summary';
    const limit = interaction.options.getInteger('개수') || 10;
    let selectedValue = 'overview';
    let embed;

    if (type === 'firstDayCheck') {
      const payload = await createOperatorFirstDayCheckPayload(interaction);
      await interaction.reply({
        ...payload,
        ephemeral: true,
      });
      return;
    }

    if (type === 'pendingRedemptions') {
      selectedValue = 'redemptions';
      embed = createPendingRedemptionsEmbed(pointsRepository.listPendingRedemptions(limit));
    } else if (type === 'pendingSubmissions') {
      selectedValue = 'submissions';
      embed = createPendingSubmissionsEmbed(pointsRepository.listPendingSubmissions(limit));
    } else if (type === 'missions') {
      selectedValue = 'missions_shop';
      embed = createAdminMissionListEmbed(pointsRepository.listMissionsForAdmin({ limit }));
    } else if (type === 'shop') {
      selectedValue = 'missions_shop';
      embed = createAdminShopListEmbed(pointsRepository.listShopItemsForAdmin({ limit }));
    } else if (type === 'reactionFollowUps') {
      selectedValue = 'reaction_followups';
      embed = buildOperatorReactionFollowUpsEmbed(buildReactionFollowUpQueue(pointsRepository, limit));
    } else if (type === 'onboardingSignals') {
      selectedValue = 'onboarding_signals';
      embed = buildOperatorOnboardingSignalsEmbed(buildOnboardingSignals(pointsRepository, limit));
    } else if (type === 'faqCandidates') {
      selectedValue = 'faq_candidates';
      embed = buildOperatorFaqCandidatesEmbed(buildFaqCandidateQueue(pointsRepository, limit));
    } else if (type === 'minigames') {
      embed = createMinigameReportEmbed(buildMinigameReport({
        pointsRepository,
        dungeonworldRepository,
      }));
    } else {
      embed = createOperationSummaryEmbed(pointsRepository.getOperationSummary());
    }

    await interaction.reply({
      embeds: [embed],
      components: [createOperatorHubSelectRow(selectedValue), createOperatorInvitationNoticeButtonRow()],
      ephemeral: true,
    });
  } catch (error) {
    console.error('운영 현황 조회 실패:', error.message);
    await interaction.reply({
      content: `운영 현황을 불러오지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

function createOperationExportEmbed(payload) {
  return createGuideEmbed(
    '운영 데이터 내보내기',
    [
      `종류: ${payload.kindLabel}`,
      `형식: ${payload.formatLabel}`,
      `포함 개수: ${payload.rowCount}`,
      `생성 시간: ${payload.generatedAt}`,
      '',
      payload.format === 'summary'
        ? payload.content
        : `파일명: \`${payload.filename}\``,
      '',
      '파일을 안전한 위치에 보관해 주세요.',
      '외부 공유 시 개인정보 포함 여부를 반드시 확인해 주세요.',
      '이 내보내기는 운영자 백업용이며 공개 채널에 공유하지 않는 것을 권장합니다.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

async function handleOperationExportCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '운영진 전용 명령어예요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const kind = interaction.options.getString('종류');
    const format = interaction.options.getString('형식') || 'summary';
    const limit = interaction.options.getInteger('개수') || 50;
    const payload = kind === 'dungeonworld'
      ? buildDungeonworldExportPayload(dungeonworldRepository, { format, limit })
      : buildOperationExportPayload(pointsRepository, { kind, format, limit });

    if (payload.isAttachment) {
      const attachment = new AttachmentBuilder(payload.buffer, {
        name: payload.filename,
      });

      await interaction.reply({
        embeds: [createOperationExportEmbed(payload)],
        files: [attachment],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createOperationExportEmbed(payload)],
      ephemeral: true,
    });
  } catch (error) {
    console.error('운영 데이터 내보내기 실패:', error.message);
    const fallback = truncateForDiscord(
      [
        '운영 데이터 내보내기를 완료하지 못했어요.',
        error.message,
        '',
        '파일 첨부 또는 데이터 조회 과정에서 문제가 발생했습니다. 공개 채널에는 운영 데이터를 올리지 말아 주세요.',
      ].join('\n'),
      1900
    );

    await interaction.reply({
      content: fallback,
      ephemeral: true,
    });
  }
}

function getMissionUpdatesFromOptions(options) {
  const updates = {};
  const title = options.getString('제목');
  const description = options.getString('설명');
  const rewardPoints = options.getInteger('포인트');
  const requiresSubmission = options.getBoolean('인증필요');
  const activeDate = options.getString('날짜');
  const note = options.getString('메모');

  if (title !== null) updates.title = title;
  if (description !== null) updates.description = description;
  if (rewardPoints !== null) updates.rewardPoints = rewardPoints;
  if (requiresSubmission !== null) updates.requiresSubmission = requiresSubmission;
  if (activeDate !== null) updates.activeDate = activeDate;
  if (note !== null) updates.note = note;

  return updates;
}

function createMissionAdminResultEmbed(title, mission, extraLines = []) {
  const requiresSubmission = mission.requiresSubmission === false ? '아니오' : '예';
  return createGuideEmbed(
    title,
    [
      `미션 ID: \`${mission.id}\``,
      `제목: ${mission.title || '제목 없음'}`,
      `상태: ${mission.status}`,
      `지급 포인트: ${formatPoints(mission.rewardPoints || 0)}`,
      `인증 필요: ${requiresSubmission}`,
      `날짜: ${mission.activeDate || '미지정'}`,
      ...extraLines,
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

async function handleMissionManageCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 명령어는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const action = interaction.options.getString('작업');
    const missionId = interaction.options.getString('미션id');
    let embed;

    if (action === 'list') {
      embed = createAdminMissionListEmbed(pointsRepository.listMissionsForAdmin({ limit: 20 }));
    } else if (action === 'create') {
      const mission = pointsRepository.createMission({
        title: interaction.options.getString('제목'),
        description: interaction.options.getString('설명'),
        rewardPoints: interaction.options.getInteger('포인트'),
        requiresSubmission: interaction.options.getBoolean('인증필요') ?? true,
        activeDate: interaction.options.getString('날짜') || undefined,
        note: interaction.options.getString('메모'),
      });
      embed = createMissionAdminResultEmbed('미션 생성 완료', mission, [
        '',
        `참여자에게 노출하려면 \`/미션관리 작업:활성화 미션id:${mission.id}\`를 실행해 주세요.`,
      ]);
    } else if (action === 'update') {
      const mission = pointsRepository.updateMission(missionId, getMissionUpdatesFromOptions(interaction.options));
      embed = createMissionAdminResultEmbed('미션 수정 완료', mission);
    } else {
      const statusByAction = {
        activate: 'active',
        pause: 'paused',
        close: 'closed',
      };
      const mission = pointsRepository.setMissionStatus(missionId, statusByAction[action]);
      embed = createMissionAdminResultEmbed('미션 상태 변경 완료', mission, [
        mission.status === 'active' ? '이 미션은 참여자 `/미션`에 노출됩니다.' : '이 미션은 참여자 `/미션`에 노출되지 않습니다.',
      ]);
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error('미션 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `미션 관리를 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

function getShopUpdatesFromOptions(options) {
  const updates = {};
  const name = options.getString('이름');
  const description = options.getString('설명');
  const cost = options.getInteger('비용');
  const stock = options.getInteger('재고');
  const monthlyLimit = options.getInteger('월한도');
  const type = options.getString('유형');
  const note = options.getString('메모');

  if (name !== null) updates.name = name;
  if (description !== null) updates.description = description;
  if (cost !== null) updates.cost = cost;
  if (stock !== null) updates.stock = stock;
  if (monthlyLimit !== null) updates.monthlyLimit = monthlyLimit;
  if (type !== null) updates.type = type;
  if (note !== null) updates.note = note;

  return updates;
}

function createShopAdminResultEmbed(title, item, extraLines = []) {
  return createGuideEmbed(
    title,
    [
      `항목 ID: \`${item.id}\``,
      `이름: ${item.name || '이름 없음'}`,
      `상태: ${item.status}`,
      `비용: ${formatPoints(item.cost || 0)}`,
      `재고: ${formatNullableCount(item.stock, '개')}`,
      `월한도: ${formatNullableCount(item.monthlyLimit, '회')}`,
      `유형: ${item.type || '미지정'}`,
      ...extraLines,
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

async function handleShopManageCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 명령어는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const action = interaction.options.getString('작업');
    const itemId = interaction.options.getString('항목id');
    let embed;

    if (action === 'list') {
      embed = createAdminShopListEmbed(pointsRepository.listShopItemsForAdmin({ limit: 20 }));
    } else if (action === 'create') {
      const item = pointsRepository.createShopItem({
        name: interaction.options.getString('이름'),
        description: interaction.options.getString('설명'),
        cost: interaction.options.getInteger('비용'),
        stock: interaction.options.getInteger('재고'),
        monthlyLimit: interaction.options.getInteger('월한도'),
        type: interaction.options.getString('유형'),
        note: interaction.options.getString('메모'),
      });
      embed = createShopAdminResultEmbed('상점 항목 생성 완료', item, [
        '',
        `참여자에게 노출하려면 \`/상점관리 작업:활성화 항목id:${item.id}\`를 실행해 주세요.`,
        item.type === 'youthCenterPoint' ? '청년동 포인트 전환권은 청년동 내부 사용처에 한정된 운영진 처리 항목입니다.' : '',
      ].filter(Boolean));
    } else if (action === 'update') {
      const item = pointsRepository.updateShopItem(itemId, getShopUpdatesFromOptions(interaction.options));
      embed = createShopAdminResultEmbed('상점 항목 수정 완료', item);
    } else {
      const statusByAction = {
        activate: 'active',
        pause: 'paused',
        soldOut: 'soldOut',
        hide: 'hidden',
      };
      const item = pointsRepository.setShopItemStatus(itemId, statusByAction[action]);
      embed = createShopAdminResultEmbed('상점 항목 상태 변경 완료', item, [
        item.status === 'active' ? '이 항목은 참여자 `/상점`에 노출됩니다.' : '이 항목은 참여자 `/상점`에 노출되지 않습니다.',
      ]);
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error('상점 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `상점 관리를 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleRediHelpCommand(interaction) {
  const embed = createGuideEmbed(
    '리디파인 안내 봇 사용법',
    [
      '필요한 안내를 편한 순서로 확인할 수 있어요.',
      '처음이라 낯설다면 `/안내`부터 천천히 봐 주세요.',
      '',
      '`/안내` 처음 온 참여자용 안내',
      '`/채널안내` 주요 채널 용도 안내',
      '`/질문 내용:궁금한 내용` 자주 묻는 질문 검색',
      '`/공지 종류:일정안내` 운영진용 공지 템플릿',
      '`/공지 종류:봇사용안내` 운영진용 안내 봇 사용법 공지 템플릿',
      '`/리디 일정` 프로그램 일정 안내',
      '`/리디 규칙` 참여 규칙 안내',
      '`/리디 문의` 문의 방법 안내',
      '',
      '봇이 답하기 어려운 내용은 운영진 확인이 필요할 수 있어요.',
      '세부 내용은 운영진 안내를 기준으로 확인해 주세요.',
    ].join('\n')
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleRediScheduleCommand(interaction) {
  const embed = createGuideEmbed(
    '리디파인 일정 안내',
    [
      '리디파인 프로그램은 운영진이 안내한 회차별 일정에 따라 진행돼요.',
      '',
      '정확한 날짜와 시간은 공지 채널에서 확인해 주세요.',
      '일정이 바뀌면 운영진이 디스코드 공지로 다시 안내드릴게요.',
      '',
      '참여가 어렵거나 늦을 것 같다면 가능한 때에 운영진에게 알려주세요.',
      '세부 내용은 운영진 안내를 기준으로 확인해 주세요.',
    ].join('\n')
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleRediRulesCommand(interaction) {
  const embed = createGuideEmbed(
    '프로젝트 리디파인 커뮤니티 약속',
    [
      '리디파인은 서로의 속도와 안전을 함께 살피는 공간이에요.',
      '처음부터 활발하게 말하지 않아도 괜찮아요.',
      '',
      '1. 서로 존댓말로 이야기해 주세요.',
      '2. 욕설, 비하, 조롱처럼 상대를 힘들게 할 수 있는 표현은 피해주세요.',
      '3. 개인적인 이야기와 채팅 캡처는 허락 없이 외부에 공유하지 말아 주세요.',
      '4. 반복 DM이나 사적인 접근은 상대에게 부담이 될 수 있으니 조심해 주세요.',
      '5. 건의나 불편한 점은 운영진에게 알려주세요.',
      '6. 각 채널의 성격에 맞게 대화해 주세요.',
      '7. 혐오, 차별, 성적 콘텐츠, 폭력적 표현, 사칭, 광고, 스팸, 금전 거래, 불법 링크 공유는 운영진 확인 후 조치될 수 있어요.',
      '8. 참여 중단이나 탈퇴를 고민할 때는 운영진에게 먼저 알려 주세요.',
      '9. 읽기, 이모지 반응, 짧은 질문도 모두 참여의 방식이에요.',
      '',
      '어렵거나 불편한 일이 생기면 혼자 해결하려고 애쓰지 않아도 괜찮아요.',
      '필요한 만큼 운영진에게 알려주세요.',
    ].join('\n')
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleRediContactCommand(interaction) {
  const embed = createGuideEmbed(
    '문의 방법',
    [
      '궁금한 점이나 확인이 필요한 내용은 디스코드 문의 채널에 남겨주세요.',
      '',
      '운영진이 확인 후 순차적으로 답변드릴게요.',
      '급한 내용이라면 공지된 연락 방법도 함께 확인해 주세요.',
      '',
      '개인정보가 있거나 공개 채널에 쓰기 어려운 내용은',
      '운영진이 안내한 개별 연락 방법을 이용해 주세요.',
    ].join('\n')
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleRediCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === '도움') {
    await handleRediHelpCommand(interaction);
    return;
  }

  if (subcommand === '일정') {
    await handleRediScheduleCommand(interaction);
    return;
  }

  if (subcommand === '규칙') {
    await handleRediRulesCommand(interaction);
    return;
  }

  if (subcommand === '문의') {
    await handleRediContactCommand(interaction);
  }
}

async function handleInteractionCreate(interaction) {
  if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
    if (interaction.customId === GUIDE_HUB_SELECT_ID) {
      await handleGuideHubSelect(interaction);
      return;
    }

    if (interaction.customId === OPERATOR_HUB_SELECT_ID) {
      await handleOperatorHubSelect(interaction);
      return;
    }

    if (interaction.customId === OPERATOR_MISSION_HUB_SELECT_ID) {
      await handleMissionHubSelect(interaction);
      return;
    }

    if (interaction.customId === OPERATOR_MISSION_TEMPLATE_SELECT_ID) {
      await handleMissionTemplateSelect(interaction);
      return;
    }

    if (interaction.customId === OPERATOR_SHOP_HUB_SELECT_ID) {
      await handleShopHubSelect(interaction);
      return;
    }

    if (interaction.customId === 'participant_shop_select') {
      await handleShopSelect(interaction);
      return;
    }

    if (interaction.customId === 'participant_mission_select') {
      await handleMissionSelect(interaction);
      return;
    }
  }

  if (interaction.isButton && interaction.isButton()) {
    if (interaction.customId === OPERATOR_HUB_BUTTON_IDS.invitationNotice) {
      await handleOperatorInvitationNoticeButton(interaction);
      return;
    }

    if (interaction.customId === OPERATOR_HUB_BUTTON_IDS.prelaunchCheck) {
      await handleOperatorPrelaunchCheckButton(interaction);
      return;
    }

    if (interaction.customId === OPERATOR_HUB_BUTTON_IDS.prelaunchOpenEnvironmentCheck) {
      await handleOperatorPrelaunchOpenEnvironmentCheckButton(interaction);
      return;
    }

    if (interaction.customId === OPERATOR_HUB_BUTTON_IDS.prelaunchOpenMissionHub) {
      await handleOperatorPrelaunchOpenMissionHubButton(interaction);
      return;
    }

    if (interaction.customId === OPERATOR_HUB_BUTTON_IDS.prelaunchOpenShopHub) {
      await handleOperatorPrelaunchOpenShopHubButton(interaction);
      return;
    }

    if (interaction.customId.startsWith('admin_mission_hub:')) {
      await handleMissionHubButton(interaction);
      return;
    }

    if (interaction.customId.startsWith('admin_shop_hub:')) {
      await handleShopHubButton(interaction);
      return;
    }

    if (getSubmissionReviewButtonAction(interaction.customId)) {
      await handleSubmissionReviewButton(interaction);
      return;
    }

    if (interaction.customId.startsWith('participant_redeem_confirm:')
      || interaction.customId.startsWith('participant_redeem_cancel_check:')
      || interaction.customId.startsWith('participant_redeem_cancel_done:')
      || interaction.customId.startsWith('participant_redeem_cancel_back:')) {
      await handleRedemptionConfirmButton(interaction);
      return;
    }

    if (interaction.customId.startsWith('participant_minigame_')) {
      await handleMinigameButton(interaction);
      return;
    }

    if (Object.values(PARTICIPANT_MENU_BUTTON_IDS).includes(interaction.customId)) {
      await handleParticipantMenuButton(interaction);
      return;
    }

    if (interaction.customId.startsWith(OPERATOR_DUNGEONWORLD_MANAGE_PREFIX)) {
      await handleDungeonworldManageButton(interaction);
      return;
    }

    if (interaction.customId.startsWith(DUNGEONWORLD_CHOICE_PREFIX)) {
      await handleDungeonworldButton(interaction);
      return;
    }
  }

  if (interaction.isModalSubmit && interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('admin_mission_hub_modal:')) {
      await handleMissionHubModal(interaction);
      return;
    }

    if (interaction.customId.startsWith('admin_shop_hub_modal:')) {
      await handleShopHubModal(interaction);
      return;
    }

    if (interaction.customId.startsWith('participant_mission_submit:')) {
      await handleMissionSubmissionModal(interaction);
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === '공지') {
    await handleNoticeCommand(interaction);
    return;
  }

  if (interaction.commandName === '안내') {
    await handleGuideCommand(interaction);
    return;
  }

  if (interaction.commandName === '채널안내') {
    await handleChannelGuideCommand(interaction);
    return;
  }

  if (interaction.commandName === '던전월드') {
    await handleDungeonworldCommand(interaction);
    return;
  }

  if (interaction.commandName === '던전월드기록') {
    await handleDungeonworldRecordCommand(interaction);
    return;
  }

  if (interaction.commandName === '던전월드관리') {
    await handleDungeonworldManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '포인트') {
    await handlePointCommand(interaction);
    return;
  }

  if (interaction.commandName === '상점') {
    await handleShopCommand(interaction);
    return;
  }

  if (interaction.commandName === '체크인') {
    await handleCheckinCommand(interaction);
    return;
  }

  if (interaction.commandName === '미션') {
    await handleMissionCommand(interaction);
    return;
  }

  if (interaction.commandName === '인증') {
    await handleSubmissionCommand(interaction);
    return;
  }

  if (interaction.commandName === '교환') {
    await handleRedemptionCommand(interaction);
    return;
  }

  if (interaction.commandName === '포인트관리') {
    await handlePointManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '교환관리') {
    await handleRedemptionManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '인증관리') {
    await handleSubmissionManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '포인트로그') {
    await handlePointLogCommand(interaction);
    return;
  }

  if (interaction.commandName === '운영현황') {
    await handleOperationStatusCommand(interaction);
    return;
  }

  if (interaction.commandName === '운영내보내기') {
    await handleOperationExportCommand(interaction);
    return;
  }

  if (interaction.commandName === '미션관리') {
    await handleMissionManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '상점관리') {
    await handleShopManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '질문') {
    await handleQuestionCommand(interaction);
    return;
  }

  if (interaction.commandName === '리디') {
    await handleRediCommand(interaction);
  }
}

module.exports = {
  buildTodayMissionNoticePayload,
  createAdminMissionHubEmbed,
  createAdminShopHubEmbed,
  createNoticeEmbed,
  createOperationSummaryEmbed,
  createPendingRedemptionsEmbed,
  createPendingSubmissionsEmbed,
  createMissionHubPayload,
  createShopHubPayload,
  getOperatorHubEmbed,
  handleChannelGuideCommand,
  handleCheckinCommand,
  handleDungeonworldButton,
  handleDungeonworldCommand,
  handleDungeonworldManageButton,
  handleDungeonworldManageCommand,
  handleDungeonworldRecordCommand,
  handleGuideCommand,
  handleGuideHubSelect,
  handleInteractionCreate,
  handleMissionHubButton,
  handleMissionHubModal,
  handleMissionHubSelect,
  handleMissionManageCommand,
  handleMissionCommand,
  handleMissionSelect,
  handleMissionSubmissionModal,
  handleNoticeCommand,
  handleOperationStatusCommand,
  handleOperatorHubSelect,
  handleOperationExportCommand,
  handleParticipantMenuButton,
  handlePointLogCommand,
  handlePointManageCommand,
  handlePointCommand,
  handleQuestionCommand,
  handleRediCommand,
  handleRediContactCommand,
  handleRediHelpCommand,
  handleRediRulesCommand,
  handleRediScheduleCommand,
  handleRedemptionCommand,
  handleRedemptionConfirmButton,
  handleRedemptionManageCommand,
  handleShopHubButton,
  handleShopHubModal,
  handleShopHubSelect,
  handleShopSelect,
  handleSubmissionCommand,
  handleSubmissionManageCommand,
  handleSubmissionReviewButton,
  handleShopManageCommand,
  handleShopCommand,
};

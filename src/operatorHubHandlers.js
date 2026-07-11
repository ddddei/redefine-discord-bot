const { AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const { getConfiguredEnvValue } = require('./interactionContext');
const { resolveConfiguredChannel, getChannelPermissions, channelPermissionHas } = require('./interactionEnvironment');
const {
  buildDmChatTodaySummary, buildFaqCandidateQueue, buildFirstDayCheck, buildOnboardingSignals,
  buildReactionFollowUpQueue, buildTodayOperationsQueue,
} = require('./adminApi');
const {
  buildOperatorChecklistEmbed, buildOperatorDmChatSummaryEmbed, buildOperatorEnvironmentCheckEmbed,
  buildOperatorExportGuideEmbed, buildOperatorFaqCandidatesEmbed, buildOperatorFirstDayCheckEmbed,
  buildOperatorHubEmbed, buildOperatorInvitationNoticeEmbed, buildOperatorMissionsShopEmbed,
  buildOperatorOnboardingSignalsEmbed, buildOperatorPointLogsEmbed, buildOperatorPrelaunchCheckEmbed,
  buildOperatorReactionApprovalsEmbed, buildOperatorReactionFollowUpsEmbed, buildOperatorRedemptionsEmbed,
  buildOperatorSubmissionsEmbed, buildOperatorTodayQueueEmbed, getOperatorPrelaunchCheckIssues,
} = require('./embeds');
const {
  createOperatorHubSelectRow, createOperatorInvitationNoticeButtonRow,
  createOperatorPrelaunchCheckActionRow,
} = require('./components');
const { getOperationDataPaths, isProductionDataStrict, runOperationDataPreflight } = require('./operationDataPaths');
const { buildOperationExportPayload, truncateForDiscord } = require('./exportUtils');
const { createDmSafetyReviewPayload, parseCustomId: parseDmSafetyReviewCustomId } = require('./dmSafetyReviewUi');
const { buildDungeonworldExportPayload } = require('./dungeonworld');
const { buildMinigameReport, createMinigameReportEmbed } = require('./minigameReport');
const { createOperationExportEmbed } = require('./operatorInteractionUi');

function createOperatorHubHandlers({
  pointsRepository, dmSafetyReviewRepository, dungeonworldRepository,
  isOperator, createMissionHubPayload, createShopHubPayload,
  createAdminMissionListEmbed, createAdminShopListEmbed,
}) {
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

  function isGoogleSheetsLoggingEnabled() {
    return String(process.env.GOOGLE_SHEETS_LOGGING_ENABLED || '').trim().toLowerCase() === 'true';
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

    const operationDataResult = runOperationDataPreflight({ paths: getOperationDataPaths(), strict: isProductionDataStrict() });
    return {
      channelChecks,
      googleSheetsCheck: {
        loggingEnabled: isGoogleSheetsLoggingEnabled(),
        webAppUrlConfigured: Boolean(getConfiguredEnvValue('GOOGLE_SHEETS_WEB_APP_URL')),
      },
      operationDataCheck: {
        strict: operationDataResult.strict,
        ok: operationDataResult.ok,
        issueCount: operationDataResult.issues.length,
        commonRootConfigured: Boolean(String(process.env.OPERATION_DATA_DIR || '').trim()),
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


  function createOperationSummaryEmbed(summary) {
    return buildOperatorHubEmbed(summary);
  }

  function createPendingRedemptionsEmbed(redemptions) {
    return buildOperatorRedemptionsEmbed(redemptions);
  }

  function createPendingSubmissionsEmbed(submissions) {
    return buildOperatorSubmissionsEmbed(submissions);
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

    if (value === 'dm_chat') {
      return buildOperatorDmChatSummaryEmbed(buildDmChatTodaySummary());
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

  function createOperatorDmChatPayload() {
    const summary = buildDmChatTodaySummary();
    const reviews = dmSafetyReviewRepository.list({ statuses: ['pending', 'followUp'], limit: 2 });
    const payload = createDmSafetyReviewPayload(summary, reviews);
    return {
      embeds: [buildOperatorDmChatSummaryEmbed(summary), ...payload.embeds],
      components: [createOperatorHubSelectRow('dm_chat'), ...payload.components],
    };
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
      } else if (selectedValue === 'dm_chat') {
        payload = createOperatorDmChatPayload();
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
      } else if (type === 'dmChat') {
        await interaction.reply({ ...createOperatorDmChatPayload(), ephemeral: true });
        return;
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

  async function handleDmSafetyReviewButton(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({ content: '이 작업은 운영진 권한이 필요해요.', ephemeral: true });
      return;
    }
    const parsed = parseDmSafetyReviewCustomId(interaction.customId);
    if (!parsed || !['reviewed', 'followUp', 'closed'].includes(parsed.action)) {
      await interaction.reply({ content: '안전 확인 작업 정보를 읽지 못했어요.', ephemeral: true });
      return;
    }
    const result = dmSafetyReviewRepository.transition(parsed.id, {
      status: parsed.action,
      expectedUpdatedAt: parsed.updatedAt,
      reviewedBy: interaction.user && interaction.user.id,
    });
    if (!result.ok) {
      const message = result.reason === 'CONFLICT'
        ? '다른 운영자가 먼저 처리했습니다. 최신 상태를 다시 확인해 주세요.'
        : '안전 확인 기록을 찾지 못했습니다.';
      await interaction.reply({ content: message, ephemeral: true });
      return;
    }
    await interaction.update(createOperatorDmChatPayload());
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


  return {
    createOperationSummaryEmbed,
    createPendingRedemptionsEmbed,
    createPendingSubmissionsEmbed,
    getOperatorHubEmbed,
    handleDmSafetyReviewButton,
    handleOperationExportCommand,
    handleOperationStatusCommand,
    handleOperatorHubSelect,
    handleOperatorInvitationNoticeButton,
    handleOperatorPrelaunchCheckButton,
    handleOperatorPrelaunchOpenEnvironmentCheckButton,
    handleOperatorPrelaunchOpenMissionHubButton,
    handleOperatorPrelaunchOpenShopHubButton,
  };
}

module.exports = { createOperatorHubHandlers };

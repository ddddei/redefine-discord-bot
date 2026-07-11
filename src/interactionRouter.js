function createInteractionRouter({ ids, handlers, predicates }) {
  const selectRoutes = [
    [ids.guideHubSelect, handlers.handleGuideHubSelect],
    [ids.operatorHubSelect, handlers.handleOperatorHubSelect],
    [ids.operatorMissionHubSelect, handlers.handleMissionHubSelect],
    [ids.operatorMissionTemplateSelect, handlers.handleMissionTemplateSelect],
    [ids.operatorShopHubSelect, handlers.handleShopHubSelect],
    ['participant_shop_select', handlers.handleShopSelect],
    ['participant_mission_select', handlers.handleMissionSelect],
  ];

  const commandRoutes = new Map([
    ['공지', handlers.handleNoticeCommand],
    ['안내', handlers.handleGuideCommand],
    ['채널안내', handlers.handleChannelGuideCommand],
    ['던전월드', handlers.handleDungeonworldCommand],
    ['던전월드기록', handlers.handleDungeonworldRecordCommand],
    ['던전월드관리', handlers.handleDungeonworldManageCommand],
    ['게임연결', handlers.handleWebgameLinkCommand],
    ['게임랭킹', handlers.handleWebgameRankingCommand],
    ['포인트', handlers.handlePointCommand],
    ['상점', handlers.handleShopCommand],
    ['체크인', handlers.handleCheckinCommand],
    ['미션', handlers.handleMissionCommand],
    ['인증', handlers.handleSubmissionCommand],
    ['교환', handlers.handleRedemptionCommand],
    ['포인트관리', handlers.handlePointManageCommand],
    ['게임지급', handlers.handleWebgamePayoutCommand],
    ['교환관리', handlers.handleRedemptionManageCommand],
    ['인증관리', handlers.handleSubmissionManageCommand],
    ['포인트로그', handlers.handlePointLogCommand],
    ['운영현황', handlers.handleOperationStatusCommand],
    ['운영내보내기', handlers.handleOperationExportCommand],
    ['미션관리', handlers.handleMissionManageCommand],
    ['상점관리', handlers.handleShopManageCommand],
    ['질문', handlers.handleQuestionCommand],
    ['리디', handlers.handleRediCommand],
  ]);

  return async function handleInteractionCreate(interaction) {
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
      const route = selectRoutes.find(([customId]) => interaction.customId === customId);
      if (route) {
        await route[1](interaction);
        return;
      }
    }

    if (interaction.isButton && interaction.isButton()) {
      if (predicates.isDmSafetyReview(interaction.customId)) {
        await handlers.handleDmSafetyReviewButton(interaction);
        return;
      }

      const exactButtonRoutes = [
        [ids.operatorButtons.invitationNotice, handlers.handleOperatorInvitationNoticeButton],
        [ids.operatorButtons.prelaunchCheck, handlers.handleOperatorPrelaunchCheckButton],
        [ids.operatorButtons.prelaunchOpenEnvironmentCheck, handlers.handleOperatorPrelaunchOpenEnvironmentCheckButton],
        [ids.operatorButtons.prelaunchOpenMissionHub, handlers.handleOperatorPrelaunchOpenMissionHubButton],
        [ids.operatorButtons.prelaunchOpenShopHub, handlers.handleOperatorPrelaunchOpenShopHubButton],
      ];
      const exactRoute = exactButtonRoutes.find(([customId]) => interaction.customId === customId);
      if (exactRoute) {
        await exactRoute[1](interaction);
        return;
      }
      if (interaction.customId.startsWith('admin_mission_hub:')) return handlers.handleMissionHubButton(interaction);
      if (interaction.customId.startsWith('admin_shop_hub:')) return handlers.handleShopHubButton(interaction);
      if (predicates.isSubmissionReview(interaction.customId)) return handlers.handleSubmissionReviewButton(interaction);
      if (interaction.customId.startsWith(ids.webgamePayoutConfirmPrefix)) return handlers.handleWebgamePayoutConfirmButton(interaction);
      if (interaction.customId === ids.webgamePayoutCancel) return handlers.handleWebgamePayoutCancelButton(interaction);
      if (predicates.isParticipantRedemption(interaction.customId)) return handlers.handleRedemptionConfirmButton(interaction);
      if (interaction.customId.startsWith('participant_minigame_')) return handlers.handleMinigameButton(interaction);
      if (ids.participantMenuButtons.includes(interaction.customId)) return handlers.handleParticipantMenuButton(interaction);
      if (interaction.customId.startsWith(ids.dungeonworldManagePrefix)) return handlers.handleDungeonworldManageButton(interaction);
      if (interaction.customId.startsWith(ids.dungeonworldChoicePrefix)) return handlers.handleDungeonworldButton(interaction);
    }

    if (interaction.isModalSubmit && interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('admin_mission_hub_modal:')) return handlers.handleMissionHubModal(interaction);
      if (interaction.customId.startsWith('admin_shop_hub_modal:')) return handlers.handleShopHubModal(interaction);
      if (interaction.customId.startsWith('participant_mission_submit:')) return handlers.handleMissionSubmissionModal(interaction);
    }

    if (!interaction.isChatInputCommand || !interaction.isChatInputCommand()) return;
    const handler = commandRoutes.get(interaction.commandName);
    if (handler) await handler(interaction);
  };
}

module.exports = { createInteractionRouter };

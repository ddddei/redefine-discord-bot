const { getConfiguredEnvValue, getMemberDisplayName, isOperator } = require('./interactionContext');
const { sendEphemeralAfterUpdate } = require('./interactionResponse');
const { createActivityParticipantHandlers } = require('./activityParticipantHandlers');
const { createActivityOperatorHandlers } = require('./activityOperatorHandlers');
const { createMissionShopHubHandlers } = require('./missionShopHubHandlers');
const { createOperatorHubHandlers } = require('./operatorHubHandlers');
const { createParticipantHandlers } = require('./participantHandlers');
const { createWebgameOperatorHandlers } = require('./webgameOperatorHandlers');
const { resolveConfiguredChannel } = require('./interactionEnvironment');
const { PARTICIPANT_MENU_BUTTON_IDS } = require('./participantInteractionUi');
const { WEBGAME_PAYOUT_CANCEL_ID, WEBGAME_PAYOUT_CONFIRM_PREFIX, createNoticeEmbed } = require('./operatorInteractionUi');
const {
  DUNGEONWORLD_CHOICE_PREFIX, GUIDE_HUB_SELECT_ID, OPERATOR_DUNGEONWORLD_MANAGE_PREFIX,
  OPERATOR_HUB_BUTTON_IDS, OPERATOR_HUB_SELECT_ID, OPERATOR_MISSION_HUB_SELECT_ID,
  OPERATOR_MISSION_TEMPLATE_SELECT_ID, OPERATOR_SHOP_HUB_SELECT_ID,
} = require('./components');
const {
  createSubmissionReviewActionRow, sendMissionSubmissionReviewAlert,
  sendMissionSubmissionReviewLog, sendRedemptionReviewAlert,
  sendSensitiveQuestionAlert, sendUnansweredQuestionLog,
} = require('./logging');
const { createPointsRepository } = require('./pointsRepository');
const { createMinigameButtonHandler } = require('./minigameInteractions');
const { createDmSafetyReviewRepository } = require('./dmSafetyReview');
const { parseCustomId: parseDmSafetyReviewCustomId } = require('./dmSafetyReviewUi');
const { createDungeonworldConfigRepository, createDungeonworldRepository } = require('./dungeonworld');
const { createDungeonworldHandlers } = require('./dungeonworldHandlers');
const { createWebgameRepository } = require('./webgameRepository');
const pointsRepository = createPointsRepository();
const dungeonworldRepository = createDungeonworldRepository();
const dungeonworldConfigRepository = createDungeonworldConfigRepository();
const dmSafetyReviewRepository = createDmSafetyReviewRepository();
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
let participantHandlers;
const {
  createPointBalanceEmbedForUser,
  handleCheckinCommand,
  handleMissionCommand,
  handleMissionSelect,
  handleMissionSubmissionModal,
  handlePointCommand,
  handleRedemptionCommand,
  handleRedemptionConfirmButton,
  handleShopCommand,
  handleShopSelect,
  handleSubmissionCommand,
} = createActivityParticipantHandlers({
  pointsRepository,
  getMemberDisplayName,
  recordParticipantCommandUse: (...args) => participantHandlers.recordParticipantCommandUse(...args),
  sendMissionSubmissionReviewAlert,
  sendRedemptionReviewAlert,
});
participantHandlers = createParticipantHandlers({
  pointsRepository,
  createPointBalanceEmbedForUser,
  sendSensitiveQuestionAlert,
  sendUnansweredQuestionLog,
});
const {
  handleChannelGuideCommand,
  handleGuideCommand,
  handleGuideHubSelect,
  handleNoticeCommand,
  handleParticipantMenuButton,
  handleQuestionCommand,
  handleRediCommand,
  handleRediContactCommand,
  handleRediHelpCommand,
  handleRediRulesCommand,
  handleRediScheduleCommand,
  handleWebgameLinkCommand,
  handleWebgameRankingCommand,
} = participantHandlers;
const {
  handleWebgamePayoutCancelButton,
  handleWebgamePayoutCommand,
  handleWebgamePayoutConfirmButton,
} = createWebgameOperatorHandlers({ pointsRepository, createWebgameRepository, isOperator });
const {
  handlePointLogCommand,
  handlePointManageCommand,
  handleRedemptionManageCommand,
  handleSubmissionManageCommand,
  handleSubmissionReviewButton,
} = createActivityOperatorHandlers({
  pointsRepository,
  isOperator,
  getMemberDisplayName,
  createSubmissionReviewActionRow,
  sendMissionSubmissionReviewLog,
});
const {
  buildTodayMissionNoticePayload,
  createAdminMissionHubEmbed,
  createAdminMissionListEmbed,
  createAdminShopHubEmbed,
  createAdminShopListEmbed,
  createMissionHubPayload,
  createShopHubPayload,
  handleMissionHubButton,
  handleMissionHubModal,
  handleMissionHubSelect,
  handleMissionManageCommand,
  handleMissionTemplateSelect,
  handleShopHubButton,
  handleShopHubModal,
  handleShopHubSelect,
  handleShopManageCommand,
} = createMissionShopHubHandlers({
  pointsRepository,
  isOperator,
  getMemberDisplayName,
  sendEphemeralAfterUpdate,
  resolveConfiguredChannel,
  getConfiguredEnvValue,
});
const {
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
} = createOperatorHubHandlers({
  pointsRepository,
  dmSafetyReviewRepository,
  dungeonworldRepository,
  isOperator,
  createMissionHubPayload,
  createShopHubPayload,
  createAdminMissionListEmbed,
  createAdminShopListEmbed,
});

const routingDependencies = {
  ids: {
    guideHubSelect: GUIDE_HUB_SELECT_ID,
    operatorHubSelect: OPERATOR_HUB_SELECT_ID,
    operatorMissionHubSelect: OPERATOR_MISSION_HUB_SELECT_ID,
    operatorMissionTemplateSelect: OPERATOR_MISSION_TEMPLATE_SELECT_ID,
    operatorShopHubSelect: OPERATOR_SHOP_HUB_SELECT_ID,
    operatorButtons: OPERATOR_HUB_BUTTON_IDS,
    webgamePayoutConfirmPrefix: WEBGAME_PAYOUT_CONFIRM_PREFIX,
    webgamePayoutCancel: WEBGAME_PAYOUT_CANCEL_ID,
    participantMenuButtons: Object.values(PARTICIPANT_MENU_BUTTON_IDS),
    dungeonworldManagePrefix: OPERATOR_DUNGEONWORLD_MANAGE_PREFIX,
    dungeonworldChoicePrefix: DUNGEONWORLD_CHOICE_PREFIX,
  },
  predicates: {
    isDmSafetyReview: (customId) => Boolean(parseDmSafetyReviewCustomId(customId)),
    isSubmissionReview: (customId) => customId.startsWith('operator_submission_approve:')
      || customId.startsWith('operator_submission_reject:'),
    isParticipantRedemption: (customId) => customId.startsWith('participant_redeem_confirm:')
      || customId.startsWith('participant_redeem_cancel_check:')
      || customId.startsWith('participant_redeem_cancel_done:')
      || customId.startsWith('participant_redeem_cancel_back:'),
  },
  handlers: {
    handleGuideHubSelect, handleOperatorHubSelect, handleMissionHubSelect, handleMissionTemplateSelect,
    handleShopHubSelect, handleShopSelect, handleMissionSelect, handleDmSafetyReviewButton,
    handleOperatorInvitationNoticeButton, handleOperatorPrelaunchCheckButton,
    handleOperatorPrelaunchOpenEnvironmentCheckButton, handleOperatorPrelaunchOpenMissionHubButton,
    handleOperatorPrelaunchOpenShopHubButton, handleMissionHubButton, handleShopHubButton,
    handleSubmissionReviewButton, handleWebgamePayoutConfirmButton, handleWebgamePayoutCancelButton,
    handleRedemptionConfirmButton, handleMinigameButton, handleParticipantMenuButton,
    handleDungeonworldManageButton, handleDungeonworldButton, handleMissionHubModal, handleShopHubModal,
    handleMissionSubmissionModal, handleNoticeCommand, handleGuideCommand, handleChannelGuideCommand,
    handleDungeonworldCommand, handleDungeonworldRecordCommand, handleDungeonworldManageCommand,
    handleWebgameLinkCommand, handleWebgameRankingCommand, handlePointCommand, handleShopCommand,
    handleCheckinCommand, handleMissionCommand, handleSubmissionCommand, handleRedemptionCommand,
    handlePointManageCommand, handleWebgamePayoutCommand, handleRedemptionManageCommand,
    handleSubmissionManageCommand, handlePointLogCommand, handleOperationStatusCommand,
    handleOperationExportCommand, handleMissionManageCommand, handleShopManageCommand,
    handleQuestionCommand, handleRediCommand,
  },
};

module.exports = {
  routingDependencies,
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
  handleDmSafetyReviewButton,
  handleDungeonworldCommand,
  handleDungeonworldManageButton,
  handleDungeonworldManageCommand,
  handleDungeonworldRecordCommand,
  handleGuideCommand,
  handleGuideHubSelect,
  handleWebgameLinkCommand,
  handleWebgameRankingCommand,
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

const assert = require('assert');
const { createInteractionRouter } = require('../src/interactionRouter');

const ids = {
  guideHubSelect: 'guide', operatorHubSelect: 'operator', operatorMissionHubSelect: 'mission',
  operatorMissionTemplateSelect: 'template', operatorShopHubSelect: 'shop',
  operatorButtons: { invitationNotice: 'invite', prelaunchCheck: 'prelaunch', prelaunchOpenEnvironmentCheck: 'environment', prelaunchOpenMissionHub: 'open-mission', prelaunchOpenShopHub: 'open-shop' },
  webgamePayoutConfirmPrefix: 'payout:', webgamePayoutCancel: 'payout-cancel',
  participantMenuButtons: ['participant-menu'], dungeonworldManagePrefix: 'dw-manage:', dungeonworldChoicePrefix: 'dw-choice:',
};

function interaction(type, customId, commandName) {
  return {
    customId, commandName,
    isStringSelectMenu: () => type === 'select',
    isButton: () => type === 'button',
    isModalSubmit: () => type === 'modal',
    isChatInputCommand: () => type === 'command',
  };
}

async function main() {
  const publicExports = Object.keys(require('../src/handlers')).sort();
  assert.deepStrictEqual(publicExports, [
    'buildTodayMissionNoticePayload', 'createAdminMissionHubEmbed', 'createAdminShopHubEmbed',
    'createMissionHubPayload', 'createNoticeEmbed', 'createOperationSummaryEmbed',
    'createPendingRedemptionsEmbed', 'createPendingSubmissionsEmbed', 'createShopHubPayload',
    'getOperatorHubEmbed', 'handleChannelGuideCommand', 'handleCheckinCommand',
    'handleDmSafetyReviewButton', 'handleDungeonworldButton', 'handleDungeonworldCommand',
    'handleDungeonworldManageButton', 'handleDungeonworldManageCommand', 'handleDungeonworldRecordCommand',
    'handleGuideCommand', 'handleGuideHubSelect', 'handleInteractionCreate', 'handleMissionCommand',
    'handleMissionHubButton', 'handleMissionHubModal', 'handleMissionHubSelect', 'handleMissionManageCommand',
    'handleMissionSelect', 'handleMissionSubmissionModal', 'handleNoticeCommand', 'handleOperationExportCommand',
    'handleOperationStatusCommand', 'handleOperatorHubSelect', 'handleParticipantMenuButton', 'handlePointCommand',
    'handlePointLogCommand', 'handlePointManageCommand', 'handleQuestionCommand', 'handleRediCommand',
    'handleRediContactCommand', 'handleRediHelpCommand', 'handleRediRulesCommand', 'handleRediScheduleCommand',
    'handleRedemptionCommand', 'handleRedemptionConfirmButton', 'handleRedemptionManageCommand',
    'handleShopCommand', 'handleShopHubButton', 'handleShopHubModal', 'handleShopHubSelect',
    'handleShopManageCommand', 'handleShopSelect', 'handleSubmissionCommand',
    'handleSubmissionManageCommand', 'handleSubmissionReviewButton', 'handleWebgameLinkCommand',
    'handleWebgameRankingCommand',
  ].sort());
  const calls = [];
  const handlers = new Proxy({}, { get: (_target, name) => async () => calls.push(String(name)) });
  const router = createInteractionRouter({
    ids,
    handlers,
    predicates: {
      isDmSafetyReview: (value) => value === 'dm-safe',
      isSubmissionReview: (value) => value === 'submission-review',
      isParticipantRedemption: (value) => value.startsWith('participant_redeem_'),
    },
  });
  const cases = [
    ['select', 'guide', null, 'handleGuideHubSelect'], ['select', 'operator', null, 'handleOperatorHubSelect'],
    ['select', 'mission', null, 'handleMissionHubSelect'], ['select', 'template', null, 'handleMissionTemplateSelect'],
    ['select', 'shop', null, 'handleShopHubSelect'], ['select', 'participant_shop_select', null, 'handleShopSelect'],
    ['select', 'participant_mission_select', null, 'handleMissionSelect'],
    ['button', 'dm-safe', null, 'handleDmSafetyReviewButton'], ['button', 'admin_mission_hub:x', null, 'handleMissionHubButton'],
    ['button', 'admin_shop_hub:x', null, 'handleShopHubButton'], ['button', 'submission-review', null, 'handleSubmissionReviewButton'],
    ['button', 'participant_redeem_confirm:x', null, 'handleRedemptionConfirmButton'],
    ['button', 'participant_minigame_x', null, 'handleMinigameButton'], ['button', 'participant-menu', null, 'handleParticipantMenuButton'],
    ['button', 'dw-manage:x', null, 'handleDungeonworldManageButton'], ['button', 'dw-choice:x', null, 'handleDungeonworldButton'],
    ['modal', 'admin_mission_hub_modal:x', null, 'handleMissionHubModal'], ['modal', 'admin_shop_hub_modal:x', null, 'handleShopHubModal'],
    ['modal', 'participant_mission_submit:x', null, 'handleMissionSubmissionModal'],
    ['command', null, '안내', 'handleGuideCommand'], ['command', null, '게임지급', 'handleWebgamePayoutCommand'],
    ['command', null, '운영현황', 'handleOperationStatusCommand'], ['command', null, '리디', 'handleRediCommand'],
  ];
  for (const [type, customId, commandName, expected] of cases) {
    calls.length = 0;
    await router(interaction(type, customId, commandName));
    assert.deepStrictEqual(calls, [expected], `${type}:${customId || commandName}`);
  }
  calls.length = 0;
  await router(interaction('button', 'unknown'));
  await router(interaction('command', null, 'unknown'));
  assert.deepStrictEqual(calls, []);

  calls.length = 0;
  const priorityRouter = createInteractionRouter({
    ids, handlers,
    predicates: { isDmSafetyReview: () => true, isSubmissionReview: () => true, isParticipantRedemption: () => true },
  });
  await priorityRouter(interaction('button', 'admin_mission_hub:x'));
  assert.deepStrictEqual(calls, ['handleDmSafetyReviewButton']);
  console.log('interaction router 계약 테스트 통과');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

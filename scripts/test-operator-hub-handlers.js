const assert = require('assert');
const { createOperatorHubHandlers } = require('../src/operatorHubHandlers');

async function main() {
  const calls = [];
  const pointsRepository = {
    getOperationSummary() { calls.push('summary'); return { userCount: 0, pendingRedemptionCount: 0, pendingSubmissionCount: 0 }; },
  };
  const handlers = createOperatorHubHandlers({
    pointsRepository,
    dmSafetyReviewRepository: { list: () => [], transition: () => ({ ok: false, reason: 'NOT_FOUND' }) },
    dungeonworldRepository: {},
    isOperator: () => true,
    createMissionHubPayload: () => ({ embeds: [], components: [] }),
    createShopHubPayload: () => ({ embeds: [], components: [] }),
    createAdminMissionListEmbed: () => null,
    createAdminShopListEmbed: () => null,
  });
  const interaction = {
    user: { id: 'operator' }, member: {},
    options: { getString: () => 'summary', getInteger: () => 10 },
    async reply(payload) { this.replyPayload = payload; },
  };
  await handlers.handleOperationStatusCommand(interaction);
  assert.deepStrictEqual(calls, ['summary']);
  assert.strictEqual(interaction.replyPayload.ephemeral, true);
  assert.strictEqual(interaction.replyPayload.embeds.length, 1);

  const openMission = { ...interaction, replyPayload: null };
  await handlers.handleOperatorPrelaunchOpenMissionHubButton(openMission);
  assert.strictEqual(openMission.replyPayload.ephemeral, true);
  assert.strictEqual(typeof handlers.handleDmSafetyReviewButton, 'function');
  assert.strictEqual(typeof handlers.handleOperationExportCommand, 'function');
  console.log('operator hub handler factory 계약 테스트 통과');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

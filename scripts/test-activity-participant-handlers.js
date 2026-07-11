const assert = require('assert');
const { createActivityParticipantHandlers } = require('../src/activityParticipantHandlers');

async function main() {
  const calls = [];
  const repository = {
    loadState() { calls.push('loadState'); return { pointsData: { users: [], transactions: [] } }; },
    listActiveShopItemsWithCodes() { calls.push('listShop'); return []; },
    listActiveMissions() { calls.push('listMissions'); return []; },
  };
  const used = [];
  const handlers = createActivityParticipantHandlers({
    pointsRepository: repository,
    getMemberDisplayName: () => '참여자',
    recordParticipantCommandUse: (_interaction, command) => used.push(command),
    sendMissionSubmissionReviewAlert: async () => {},
    sendRedemptionReviewAlert: async () => {},
  });

  function interaction() {
    return {
      user: { id: 'participant', username: '참여자' }, member: {},
      options: { getString: () => null },
      async reply(payload) { this.replyPayload = payload; },
    };
  }

  const point = interaction();
  await handlers.handlePointCommand(point);
  assert.deepStrictEqual(calls.splice(0), ['loadState']);
  assert.strictEqual(point.replyPayload.ephemeral, true);

  const shop = interaction();
  await handlers.handleShopCommand(shop);
  assert.deepStrictEqual(calls.splice(0), ['listShop']);
  assert.match(shop.replyPayload.embeds[0].toJSON().description, /교환할 수 있는 항목이 없어요/);

  const mission = interaction();
  await handlers.handleMissionCommand(mission);
  assert.deepStrictEqual(calls.splice(0), ['listMissions']);
  assert.match(mission.replyPayload.embeds[0].toJSON().description, /참여할 수 있는 미션은 없어요/);
  assert.deepStrictEqual(used, ['포인트', '상점', '미션']);
  assert.strictEqual(typeof handlers.handleRedemptionConfirmButton, 'function');
  assert.strictEqual(typeof handlers.handleMissionSubmissionModal, 'function');
  console.log('activity participant handler factory 계약 테스트 통과');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

const assert = require('assert');
const { createMissionShopHubHandlers } = require('../src/missionShopHubHandlers');

function main() {
  const calls = [];
  const repository = {
    listMissionsForAdmin() { calls.push('missions'); return []; },
    listMissionTemplates() { calls.push('templates'); return []; },
    listWeekdayMissionRecommendations() { calls.push('recommendations'); return []; },
    getTodayMissionRecommendation() { calls.push('today'); return null; },
    listShopItemsForAdmin() { calls.push('shop'); return []; },
  };
  const handlers = createMissionShopHubHandlers({
    pointsRepository: repository,
    isOperator: () => true,
    getMemberDisplayName: () => '운영자',
    sendEphemeralAfterUpdate: async () => {},
    resolveConfiguredChannel: async () => null,
    getConfiguredEnvValue: () => '',
  });
  const missionPayload = handlers.createMissionHubPayload();
  assert.deepStrictEqual(calls.splice(0), ['missions', 'templates', 'recommendations', 'today']);
  assert.strictEqual(missionPayload.embeds[0].toJSON().title, '미션 관리 허브');
  const shopPayload = handlers.createShopHubPayload();
  assert.deepStrictEqual(calls.splice(0), ['shop']);
  assert.strictEqual(shopPayload.embeds[0].toJSON().title, '상점 관리 허브');
  assert.strictEqual(typeof handlers.handleMissionHubModal, 'function');
  assert.strictEqual(typeof handlers.handleShopManageCommand, 'function');
  console.log('mission shop hub handler factory 계약 테스트 통과');
}

main();

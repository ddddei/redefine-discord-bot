const assert = require('assert');
const {
  WEBGAME_PAYOUT_CANCEL_ID,
  WEBGAME_PAYOUT_CONFIRM_PREFIX,
  createMissionAdminResultEmbed,
  createOperationExportEmbed,
  createShopAdminResultEmbed,
  createWebgamePayoutPreviewPayload,
} = require('../src/operatorInteractionUi');

function main() {
  const preview = createWebgamePayoutPreviewPayload({
    weekKey: '2026-W27', games: [],
    participation: { amount: 10, recipients: [] },
    communal: { achieved: false, total: 0, goal: 100, amount: 10, recipients: [] },
    mismatchWarning: null, totals: { payableCount: 0, payableAmount: 0 },
  });
  const buttonIds = preview.components[0].toJSON().components.map((button) => button.custom_id);
  assert.deepStrictEqual(buttonIds, [`${WEBGAME_PAYOUT_CONFIRM_PREFIX}2026-W27`, WEBGAME_PAYOUT_CANCEL_ID]);
  assert.strictEqual(preview.ephemeral, true);

  const exportEmbed = createOperationExportEmbed({ kindLabel: '포인트', formatLabel: 'JSON', rowCount: 1,
    generatedAt: '2026-07-11', format: 'json', filename: 'export.json' }).toJSON();
  assert.match(exportEmbed.description, /파일명: `export.json`/);

  const missionEmbed = createMissionAdminResultEmbed('완료', { id: 'm1', title: '산책', status: 'active', rewardPoints: 10 }).toJSON();
  assert.match(missionEmbed.description, /미션 ID: `m1`/);
  const shopEmbed = createShopAdminResultEmbed('완료', { id: 's1', name: '선물', status: 'active', cost: 20 }).toJSON();
  assert.match(shopEmbed.description, /재고: 운영진 확인/);
  console.log('operator interaction UI 계약 테스트 통과');
}

main();

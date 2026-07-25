const assert = require('assert');
const {
  PARTICIPANT_MENU_BUTTON_IDS,
  createInsufficientPointsDescription,
  createMissionSelectRow,
  createMissionSubmissionModal,
  createParticipantGuideLinkRow,
  createParticipantMenuButtonRows,
  createRedemptionConfirmRow,
  createShopSelectRow,
  formatShopLimit,
  getRedemptionFailureMessage,
} = require('../src/participantInteractionUi');

function main() {
  assert.match(createInsufficientPointsDescription({ currentPoints: 10, requiredPoints: 20 }), /현재 포인트: 10P/);
  assert.match(getRedemptionFailureMessage('SOLD_OUT'), /재고가 없어/);
  assert.strictEqual(formatShopLimit({ stock: 2, monthlyLimit: 1 }), '재고 2개 / 월 한도 1회');

  const shopRow = createShopSelectRow([{ id: 'item', displayCode: 'S01', name: '선물', cost: 30 }]).toJSON();
  assert.strictEqual(shopRow.components[0].custom_id, 'participant_shop_select');
  assert.strictEqual(shopRow.components[0].options[0].value, 'S01');

  const missionRow = createMissionSelectRow([{ id: 'mission', displayCode: 'M01', title: '산책', rewardPoints: 10 }]).toJSON();
  assert.strictEqual(missionRow.components[0].custom_id, 'participant_mission_select');
  assert.strictEqual(missionRow.components[0].options[0].value, 'M01');

  const confirmIds = createRedemptionConfirmRow('S01').toJSON().components.map((button) => button.custom_id);
  assert.deepStrictEqual(confirmIds, ['participant_redeem_confirm:S01', 'participant_redeem_cancel_check:S01']);

  const menuIds = createParticipantMenuButtonRows().flatMap((row) => row.toJSON().components.map((button) => button.custom_id));
  assert.deepStrictEqual(
    menuIds,
    Object.values(PARTICIPANT_MENU_BUTTON_IDS).filter((id) => id !== PARTICIPANT_MENU_BUTTON_IDS.guideDm)
  );

  const originalGuideUrl = process.env.PARTICIPANT_GUIDE_URL;
  process.env.PARTICIPANT_GUIDE_URL = 'http://example.com/guide';
  assert.strictEqual(createParticipantGuideLinkRow(), null);
  process.env.PARTICIPANT_GUIDE_URL = 'https://example.com/guide';
  const guideRow = createParticipantGuideLinkRow().toJSON();
  assert.strictEqual(guideRow.components[0].style, 5);
  assert.strictEqual(guideRow.components[0].url, 'https://example.com/guide');
  assert.strictEqual(guideRow.components[1].custom_id, PARTICIPANT_MENU_BUTTON_IDS.guideDm);
  assert.strictEqual(guideRow.components[1].label, '가이드 DM으로 받기');
  const linkOnlyRow = createParticipantGuideLinkRow({ includeDmButton: false }).toJSON();
  assert.strictEqual(linkOnlyRow.components.length, 1);
  if (originalGuideUrl === undefined) {
    delete process.env.PARTICIPANT_GUIDE_URL;
  } else {
    process.env.PARTICIPANT_GUIDE_URL = originalGuideUrl;
  }

  const modal = createMissionSubmissionModal({ id: 'mission', displayCode: 'M01' }).toJSON();
  assert.strictEqual(modal.custom_id, 'participant_mission_submit:M01');
  assert.strictEqual(modal.components[0].components[0].custom_id, 'content');
  console.log('participant interaction UI 계약 테스트 통과');
}

main();

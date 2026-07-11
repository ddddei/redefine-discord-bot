const assert = require('assert');
const { createActivityOperatorHandlers } = require('../src/activityOperatorHandlers');

async function main() {
  const calls = [];
  const repository = {
    adjustUserPoints(input) {
      calls.push(['adjust', input]);
      return { transaction: { id: 'tx1', amount: 5, balanceAfter: 15 } };
    },
    reviewRedemption(input) {
      calls.push(['redemption', input]);
      return { redemption: { id: 'r1', status: 'approved', userId: 'participant' }, refundTransaction: null };
    },
    reviewSubmissionById(id, action, reviewer, note) {
      calls.push(['submission', { id, action, reviewer, note }]);
      return { submission: { id, status: 'approved', missionId: 'm1' }, transaction: null };
    },
  };
  const handlers = createActivityOperatorHandlers({
    pointsRepository: repository,
    isOperator: () => true,
    getMemberDisplayName: () => '운영자',
    createSubmissionReviewActionRow: () => ({ toJSON: () => ({}) }),
    sendMissionSubmissionReviewLog: async () => {},
  });
  const values = { 대상: { id: 'participant', username: '참여자' }, 증감: 5, 사유: '테스트', 신청id: 'r1', 처리: 'approve', 메모: '확인', 제출id: 's1' };
  const interaction = {
    user: { id: 'operator', username: '운영자' }, member: {},
    options: {
      getUser: (name) => values[name], getInteger: (name) => values[name], getString: (name) => values[name],
    },
    async reply(payload) { this.replyPayload = payload; },
  };

  await handlers.handlePointManageCommand(interaction);
  await handlers.handleRedemptionManageCommand(interaction);
  await handlers.handleSubmissionManageCommand(interaction);
  assert.deepStrictEqual(calls.map(([name]) => name), ['adjust', 'redemption', 'submission']);
  assert.strictEqual(calls[0][1].operatorId, 'operator');
  assert.strictEqual(calls[1][1].operatorId, 'operator');
  assert.strictEqual(calls[2][1].reviewer.displayName, '운영자');
  assert.strictEqual(interaction.replyPayload.ephemeral, true);
  assert.strictEqual(typeof handlers.handleSubmissionReviewButton, 'function');
  console.log('activity operator handler factory 계약 테스트 통과');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

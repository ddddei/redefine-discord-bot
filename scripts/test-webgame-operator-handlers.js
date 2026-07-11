const assert = require('assert');
const { createWebgameOperatorHandlers } = require('../src/webgameOperatorHandlers');

async function main() {
  let repositoryCreateCount = 0;
  const handlers = createWebgameOperatorHandlers({
    pointsRepository: {},
    createWebgameRepository: () => { repositoryCreateCount += 1; throw new Error('factory probe'); },
    isOperator: () => true,
  });
  const command = {
    user: { id: 'operator' }, member: {}, commandName: '게임지급',
    options: { getString: () => 'last' },
    async reply(payload) { this.payload = payload; },
  };
  await handlers.handleWebgamePayoutCommand(command);
  assert.strictEqual(repositoryCreateCount, 1);
  assert.strictEqual(command.payload.ephemeral, true);

  const confirm = {
    user: { id: 'operator' }, member: {}, customId: 'operator_webgame_payout_confirm:2026-W27',
    async reply(payload) { this.payload = payload; },
  };
  await handlers.handleWebgamePayoutConfirmButton(confirm);
  assert.strictEqual(repositoryCreateCount, 2);
  assert.strictEqual(confirm.payload.ephemeral, true);
  console.log('webgame operator handler factory 계약 테스트 통과');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

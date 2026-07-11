const assert = require('assert');
const { createParticipantHandlers } = require('../src/participantHandlers');

async function main() {
  const calls = [];
  const handlers = createParticipantHandlers({
    pointsRepository: {
      recordParticipantCommandFirstUse(input) { calls.push(['record', input.commandName]); },
      loadState() { calls.push(['load']); return { pointsData: { users: [], transactions: [] } }; },
      listActiveMissions() { calls.push(['missions']); return []; },
    },
    createPointBalanceEmbedForUser: (id) => ({ toJSON: () => ({ title: id }) }),
    sendSensitiveQuestionAlert: async () => {},
    sendUnansweredQuestionLog: async () => {},
  });
  const guide = { member: {}, user: { id: 'u1' }, async reply(payload) { this.payload = payload; } };
  await handlers.handleGuideCommand(guide);
  assert.deepStrictEqual(calls.splice(0), [['record', '안내']]);
  assert.strictEqual(guide.payload.ephemeral, true);

  const select = { values: ['points'], user: { id: 'u1' }, async update(payload) { this.payload = payload; } };
  await handlers.handleGuideHubSelect(select);
  assert.deepStrictEqual(calls.splice(0), [['load'], ['missions']]);
  assert.strictEqual(select.payload.components.length, 1);

  const pointMenu = { customId: 'participant_menu_points', user: { id: 'u1' }, async reply(payload) { this.payload = payload; } };
  await handlers.handleParticipantMenuButton(pointMenu);
  assert.strictEqual(pointMenu.payload.ephemeral, true);
  assert.strictEqual(typeof handlers.handleQuestionCommand, 'function');
  console.log('participant handler factory 계약 테스트 통과');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

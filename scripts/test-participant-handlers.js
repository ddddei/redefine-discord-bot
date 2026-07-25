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

  const originalGuideUrl = process.env.PARTICIPANT_GUIDE_URL;
  process.env.PARTICIPANT_GUIDE_URL = 'https://example.com/guide';
  const guideDm = {
    customId: 'participant_menu_guide_dm',
    user: {
      id: 'u1',
      async send(payload) { guideDm.sentPayload = payload; },
    },
    async deferReply(payload) { this.deferPayload = payload; },
    async editReply(payload) { this.payload = payload; },
    async reply(payload) { this.payload = payload; },
  };
  await handlers.handleParticipantMenuButton(guideDm);
  assert.strictEqual(guideDm.deferPayload.ephemeral, true);
  assert.match(guideDm.payload.content, /DM으로 보냈어요/);
  assert.strictEqual(guideDm.sentPayload.components[0].toJSON().components.length, 1);
  assert.strictEqual(guideDm.sentPayload.components[0].toJSON().components[0].url, 'https://example.com/guide');

  const blockedGuideDm = {
    customId: 'participant_menu_guide_dm',
    user: {
      id: 'u2',
      async send() { throw new Error('Cannot send messages to this user'); },
    },
    async deferReply(payload) { this.deferPayload = payload; },
    async editReply(payload) { this.payload = payload; },
    async reply(payload) { this.payload = payload; },
  };
  await handlers.handleParticipantMenuButton(blockedGuideDm);
  assert.strictEqual(blockedGuideDm.deferPayload.ephemeral, true);
  assert.match(blockedGuideDm.payload.content, /DM을 보내지 못했어요/);
  assert.strictEqual(blockedGuideDm.payload.components[0].toJSON().components.length, 1);
  if (originalGuideUrl === undefined) delete process.env.PARTICIPANT_GUIDE_URL;
  else process.env.PARTICIPANT_GUIDE_URL = originalGuideUrl;

  assert.strictEqual(typeof handlers.handleQuestionCommand, 'function');
  console.log('participant handler factory 계약 테스트 통과');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

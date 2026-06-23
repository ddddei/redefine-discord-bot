const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function setupEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dungeonworld-'));
  process.env.DUNGEONWORLD_LOG_PATH = path.join(tempDir, 'logs.json');
}

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function createInteraction({ commandName, customId, isButton = false }) {
  return {
    commandName,
    customId,
    user: { id: 'dungeonworld_user', username: '던전월드 참여자' },
    member: { displayName: '던전월드 참여자' },
    replyPayload: null,
    isChatInputCommand() {
      return Boolean(commandName);
    },
    isStringSelectMenu() {
      return false;
    },
    isButton() {
      return isButton;
    },
    isModalSubmit() {
      return false;
    },
    async reply(payload) {
      this.replyPayload = payload;
    },
  };
}

function getEmbedTitle(payload) {
  return payload.embeds[0].data.title;
}

function getEmbedDescription(payload) {
  return payload.embeds[0].data.description;
}

async function main() {
  setupEnvironment();
  resetModule('../src/dungeonworld');
  resetModule('../src/components');
  resetModule('../src/handlers');

  const {
    resolveTier,
    playChoice,
    createDungeonworldRepository,
    buildDungeonworldExportPayload,
  } = require('../src/dungeonworld');
  const { handleInteractionCreate } = require('../src/handlers');

  assert.strictEqual(resolveTier(12), 'strong');
  assert.strictEqual(resolveTier(10), 'strong');
  assert.strictEqual(resolveTier(9), 'mixed');
  assert.strictEqual(resolveTier(7), 'mixed');
  assert.strictEqual(resolveTier(6), 'weak');
  assert.strictEqual(resolveTier(2), 'weak');

  assert.throws(() => playChoice('not_a_real_choice'), /지원하지 않는 선택지/);

  const repository = createDungeonworldRepository({
    logs: process.env.DUNGEONWORLD_LOG_PATH,
    logsFallback: process.env.DUNGEONWORLD_LOG_PATH,
  });
  assert.strictEqual(repository.getPlayCount(), 0);

  const commandInteraction = createInteraction({ commandName: '던전월드' });
  await handleInteractionCreate(commandInteraction);
  assert.strictEqual(getEmbedTitle(commandInteraction.replyPayload), '1회차. 변방 여관의 검은 종');
  assert.strictEqual(commandInteraction.replyPayload.ephemeral, true);
  const choiceButtons = commandInteraction.replyPayload.components[0].components.map((c) => c.data.custom_id);
  assert.deepStrictEqual(choiceButtons, [
    'dungeonworld:choice:pursue',
    'dungeonworld:choice:investigate',
    'dungeonworld:choice:negotiate',
  ]);

  const buttonInteraction = createInteraction({ customId: 'dungeonworld:choice:investigate', isButton: true });
  await handleInteractionCreate(buttonInteraction);
  assert.strictEqual(buttonInteraction.replyPayload.ephemeral, true);
  assert.match(getEmbedTitle(buttonInteraction.replyPayload), /여관과 마을을 먼저 조사한다/);
  assert.match(getEmbedDescription(buttonInteraction.replyPayload), /🎲 \d \+ \d = \d+/);
  assert.doesNotMatch(getEmbedDescription(buttonInteraction.replyPayload), /포인트/);

  assert.strictEqual(repository.getPlayCount(), 1);
  const recentPlays = repository.listRecentPlays(10);
  assert.strictEqual(recentPlays.length, 1);
  assert.strictEqual(recentPlays[0].choiceId, 'investigate');
  assert.strictEqual(recentPlays[0].userId, 'dungeonworld_user');
  assert.ok(['strong', 'mixed', 'weak'].includes(recentPlays[0].tier));

  const unknownChoiceInteraction = createInteraction({ customId: 'dungeonworld:choice:bogus', isButton: true });
  await handleInteractionCreate(unknownChoiceInteraction);
  assert.strictEqual(unknownChoiceInteraction.replyPayload.ephemeral, true);
  assert.match(unknownChoiceInteraction.replyPayload.content, /선택지를 찾지 못했어요/);

  const summaryPayload = buildDungeonworldExportPayload(repository, { format: 'summary' });
  assert.strictEqual(summaryPayload.isAttachment, false);
  assert.strictEqual(summaryPayload.rowCount, 1);
  assert.match(summaryPayload.content, /던전월드 참여자/);
  assert.doesNotMatch(summaryPayload.content, /포인트/);

  const jsonPayload = buildDungeonworldExportPayload(repository, { format: 'json' });
  assert.strictEqual(jsonPayload.isAttachment, true);
  assert.ok(jsonPayload.filename.endsWith('.json'));
  const parsedJson = JSON.parse(jsonPayload.content);
  assert.strictEqual(parsedJson.data.logs.length, 1);

  const csvPayload = buildDungeonworldExportPayload(repository, { format: 'csv' });
  assert.ok(csvPayload.filename.endsWith('.csv'));
  assert.match(csvPayload.content, /선택내용/);
  assert.match(csvPayload.content, /investigate/);

  function createExportInteraction(isOperator) {
    return {
      commandName: '운영내보내기',
      member: {
        permissions: {
          has: () => isOperator,
        },
      },
      options: {
        getString: (name) => (name === '종류' ? 'dungeonworld' : 'summary'),
        getInteger: () => 50,
      },
      replyPayload: null,
      isChatInputCommand() {
        return true;
      },
      isStringSelectMenu() {
        return false;
      },
      isButton() {
        return false;
      },
      isModalSubmit() {
        return false;
      },
      async reply(payload) {
        this.replyPayload = payload;
      },
    };
  }

  const operatorExportInteraction = createExportInteraction(true);
  await handleInteractionCreate(operatorExportInteraction);
  assert.strictEqual(getEmbedTitle(operatorExportInteraction.replyPayload), '운영 데이터 내보내기');
  assert.match(getEmbedDescription(operatorExportInteraction.replyPayload), /종류: 던전월드/);

  const nonOperatorExportInteraction = createExportInteraction(false);
  await handleInteractionCreate(nonOperatorExportInteraction);
  assert.match(nonOperatorExportInteraction.replyPayload.content, /운영진 전용 명령어/);

  console.log('dungeonworld flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

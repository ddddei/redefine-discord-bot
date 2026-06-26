const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function setupEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dungeonworld-'));
  process.env.DUNGEONWORLD_LOG_PATH = path.join(tempDir, 'logs.json');
  process.env.DUNGEONWORLD_CONFIG_PATH = path.join(tempDir, 'config.json');
  delete process.env.DUNGEONWORLD_START_DATE;
}

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function createInteraction({
  commandName,
  customId,
  isButton = false,
  userId = 'dungeonworld_user',
  username = '던전월드 참여자',
  displayName = '던전월드 참여자',
  isOperator = false,
  stringOptions = {},
  booleanOptions = {},
  integerOptions = {},
}) {
  return {
    commandName,
    customId,
    user: { id: userId, username },
    member: {
      displayName,
      permissions: {
        has: () => isOperator,
      },
    },
    options: {
      getString(name) {
        return Object.prototype.hasOwnProperty.call(stringOptions, name) ? stringOptions[name] : null;
      },
      getBoolean(name) {
        return Object.prototype.hasOwnProperty.call(booleanOptions, name) ? booleanOptions[name] : null;
      },
      getInteger(name) {
        return Object.prototype.hasOwnProperty.call(integerOptions, name) ? integerOptions[name] : null;
      },
    },
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

function getDescriptionSection(description, heading, nextHeading) {
  const start = description.indexOf(heading);
  assert.notStrictEqual(start, -1);
  const end = description.indexOf(nextHeading, start + heading.length);
  assert.notStrictEqual(end, -1);
  return description.slice(start, end);
}

function testDungeonworldManageComponents() {
  resetModule('../src/components');
  const {
    OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS,
    OPERATOR_DUNGEONWORLD_MANAGE_PREFIX,
    createDungeonworldManageRow,
  } = require('../src/components');

  const rowData = createDungeonworldManageRow().toJSON();
  const customIds = rowData.components.map((component) => component.custom_id);

  assert.deepStrictEqual(customIds, [
    OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.previous,
    OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.next,
    OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.clearOverride,
    OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.refresh,
  ]);
  assert.deepStrictEqual(customIds, [
    'dungeonworld_manage:prev',
    'dungeonworld_manage:next',
    'dungeonworld_manage:clear',
    'dungeonworld_manage:refresh',
  ]);
  assert.ok(customIds.every((customId) => customId.startsWith(OPERATOR_DUNGEONWORLD_MANAGE_PREFIX)));
  assert.ok(customIds.every((customId) => customId.length <= 100));
  assert.ok(customIds.every((customId) => !customId.includes('session_')));
  assert.ok(customIds.every((customId) => !/(reset|delete|remove|purge|truncate|drop)/i.test(customId)));
}

function testDungeonworldRecordCommandDefinition() {
  resetModule('../src/deploy-commands');
  const { commands } = require('../src/deploy-commands');
  const recordCommand = commands.find((command) => command.name === '던전월드기록');

  assert.ok(recordCommand);
  assert.deepStrictEqual(recordCommand.options || [], []);
}

async function main() {
  setupEnvironment();
  testDungeonworldManageComponents();
  testDungeonworldRecordCommandDefinition();
  resetModule('../src/dungeonworld');
  resetModule('../src/components');
  resetModule('../src/handlers');

  const {
    resolveTier,
    playChoice,
    createDungeonworldConfigRepository,
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
  const configRepository = createDungeonworldConfigRepository({
    config: process.env.DUNGEONWORLD_CONFIG_PATH,
    configFallback: process.env.DUNGEONWORLD_CONFIG_PATH,
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

  configRepository.setOverride('session_02_roots_below', 'operator_1');
  repository.recordPlay({
    userId: 'dungeonworld_user',
    displayName: '던전월드 참여자',
    sessionId: 'session_01_black_bell',
    sessionTitle: '1회차. 변방 여관의 검은 종',
    choiceId: 'pursue',
    choiceLabel: '고블린을 바로 추격한다',
    die1: 2,
    die2: 3,
    total: 5,
    tier: 'weak',
    tierLabel: '6- 예상과 다른 전개',
    outcomeText: '낡은 기록',
  });
  repository.recordPlay({
    userId: 'dungeonworld_user',
    displayName: '던전월드 참여자',
    sessionId: 'session_02_roots_below',
    sessionTitle: '2회차. 뿌리 아래 고블린 길',
    choiceId: 'trade',
    choiceLabel: '고블린과 거래한다',
    die1: 4,
    die2: 5,
    total: 9,
    tier: 'mixed',
    tierLabel: '7~9 해내지만 대가가 생김',
    outcomeText: '거래의 대가가 남았다',
  });
  repository.recordPlay({
    userId: 'other_user',
    displayName: '비밀 참여자',
    sessionId: 'session_02_roots_below',
    sessionTitle: '2회차. 뿌리 아래 고블린 길',
    choiceId: 'secret_choice',
    choiceLabel: '다른 사람의 비밀 선택',
    die1: 6,
    die2: 6,
    total: 12,
    tier: 'strong',
    tierLabel: '10+ 원하는 대로 풀림',
    outcomeText: '다른 사람 결과',
  });

  const recordInteraction = createInteraction({ commandName: '던전월드기록' });
  await handleInteractionCreate(recordInteraction);
  assert.strictEqual(recordInteraction.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(recordInteraction.replyPayload), '내 던전월드 기록');
  const recordDescription = getEmbedDescription(recordInteraction.replyPayload);
  assert.match(recordDescription, /총 플레이 수: 3/);
  assert.match(recordDescription, /완료한 회차: 2/);
  assert.match(recordDescription, /현재 열린 회차: 2회차\. 뿌리 아래 고블린 길/);
  assert.match(recordDescription, /현재 회차 참여: 완료/);
  assert.match(recordDescription, /직전 회차 연속성: 1회차\. 변방 여관의 검은 종/);
  assert.match(recordDescription, /고블린과 거래한다/);
  assert.doesNotMatch(recordDescription, /비밀 참여자/);
  assert.doesNotMatch(recordDescription, /다른 사람의 비밀 선택/);

  const emptyRecordInteraction = createInteraction({
    commandName: '던전월드기록',
    userId: 'new_user',
    username: '새 참여자',
    displayName: '새 참여자',
  });
  await handleInteractionCreate(emptyRecordInteraction);
  assert.strictEqual(emptyRecordInteraction.replyPayload.ephemeral, true);
  assert.match(getEmbedDescription(emptyRecordInteraction.replyPayload), /아직 던전월드 플레이 기록이 없어요/);
  assert.doesNotMatch(getEmbedDescription(emptyRecordInteraction.replyPayload), /던전월드 참여자/);

  process.env.DUNGEONWORLD_START_DATE = '2030-01-01T00:00:00.000Z';
  const manageInteraction = createInteraction({
    commandName: '던전월드관리',
    isOperator: true,
  });
  await handleInteractionCreate(manageInteraction);
  assert.strictEqual(manageInteraction.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(manageInteraction.replyPayload), '던전월드 회차 관리');
  const manageDescription = getEmbedDescription(manageInteraction.replyPayload);
  assert.match(manageDescription, /현재 회차: 2회차\. 뿌리 아래 고블린 길/);
  assert.match(manageDescription, /자동 계산 회차: 1회차\. 변방 여관의 검은 종/);
  assert.match(manageDescription, /수동 설정: 예/);
  assert.match(manageDescription, /다음 자동 오픈:/);
  assert.match(manageDescription, /고유 참여자 수: 2/);
  assert.match(manageDescription, /결과 분포:/);
  assert.match(manageDescription, /인기 회차/);
  assert.match(manageDescription, /인기 선택/);
  assert.match(manageDescription, /9회차\. 검은탑의 마지막 문/);
  const popularChoiceSection = getDescriptionSection(manageDescription, '인기 선택', '전체 회차');
  assert.match(popularChoiceSection, /여관과 마을을 먼저 조사한다/);
  assert.match(popularChoiceSection, /고블린과 거래한다/);
  assert.doesNotMatch(popularChoiceSection, /- 1회차\. 변방 여관의 검은 종 \(`session_01_black_bell`\): 1/);
  const manageButtonIds = manageInteraction.replyPayload.components[0].components.map((component) => component.data.custom_id);
  assert.deepStrictEqual(manageButtonIds, [
    'dungeonworld_manage:prev',
    'dungeonworld_manage:next',
    'dungeonworld_manage:clear',
    'dungeonworld_manage:refresh',
  ]);

  const nonOperatorManageInteraction = createInteraction({ commandName: '던전월드관리' });
  await handleInteractionCreate(nonOperatorManageInteraction);
  assert.strictEqual(nonOperatorManageInteraction.replyPayload.ephemeral, true);
  assert.match(nonOperatorManageInteraction.replyPayload.content, /운영진 권한/);

  const nextManageButton = createInteraction({
    customId: 'dungeonworld_manage:next',
    isButton: true,
    isOperator: true,
    userId: 'operator_1',
  });
  await handleInteractionCreate(nextManageButton);
  assert.strictEqual(nextManageButton.replyPayload.ephemeral, true);
  assert.match(getEmbedDescription(nextManageButton.replyPayload), /다음 회차 `session_03_locked_basin`/);
  assert.strictEqual(configRepository.getOverride(), 'session_03_locked_basin');

  const previousManageButton = createInteraction({
    customId: 'dungeonworld_manage:prev',
    isButton: true,
    isOperator: true,
    userId: 'operator_1',
  });
  await handleInteractionCreate(previousManageButton);
  assert.strictEqual(previousManageButton.replyPayload.ephemeral, true);
  assert.match(getEmbedDescription(previousManageButton.replyPayload), /이전 회차 `session_02_roots_below`/);
  assert.strictEqual(configRepository.getOverride(), 'session_02_roots_below');

  const refreshManageButton = createInteraction({
    customId: 'dungeonworld_manage:refresh',
    isButton: true,
    isOperator: true,
    userId: 'operator_1',
  });
  await handleInteractionCreate(refreshManageButton);
  assert.strictEqual(refreshManageButton.replyPayload.ephemeral, true);
  assert.match(getEmbedDescription(refreshManageButton.replyPayload), /새로고침/);

  const clearManageButton = createInteraction({
    customId: 'dungeonworld_manage:clear',
    isButton: true,
    isOperator: true,
    userId: 'operator_1',
  });
  await handleInteractionCreate(clearManageButton);
  assert.strictEqual(clearManageButton.replyPayload.ephemeral, true);
  assert.match(getEmbedDescription(clearManageButton.replyPayload), /수동 설정을 해제/);
  assert.strictEqual(configRepository.getOverride(), null);

  const nonOperatorManageButton = createInteraction({
    customId: 'dungeonworld_manage:next',
    isButton: true,
  });
  await handleInteractionCreate(nonOperatorManageButton);
  assert.strictEqual(nonOperatorManageButton.replyPayload.ephemeral, true);
  assert.match(nonOperatorManageButton.replyPayload.content, /운영진 권한/);

  configRepository.setOverride('session_01_black_bell', 'operator_1');
  const firstClampButton = createInteraction({
    customId: 'dungeonworld_manage:prev',
    isButton: true,
    isOperator: true,
    userId: 'operator_1',
  });
  await handleInteractionCreate(firstClampButton);
  assert.match(getEmbedDescription(firstClampButton.replyPayload), /이미 첫 회차/);
  assert.strictEqual(configRepository.getOverride(), 'session_01_black_bell');

  configRepository.setOverride('session_09_final_gate', 'operator_1');
  const lastClampButton = createInteraction({
    customId: 'dungeonworld_manage:next',
    isButton: true,
    isOperator: true,
    userId: 'operator_1',
  });
  await handleInteractionCreate(lastClampButton);
  assert.match(getEmbedDescription(lastClampButton.replyPayload), /이미 마지막 회차/);
  assert.strictEqual(configRepository.getOverride(), 'session_09_final_gate');

  const unknownManageButton = createInteraction({
    customId: 'dungeonworld_manage:unknown',
    isButton: true,
    isOperator: true,
    userId: 'operator_1',
  });
  await handleInteractionCreate(unknownManageButton);
  assert.strictEqual(unknownManageButton.replyPayload.ephemeral, true);
  assert.match(unknownManageButton.replyPayload.content, /지원하지 않는 던전월드 관리 작업/);

  const unknownChoiceInteraction = createInteraction({ customId: 'dungeonworld:choice:bogus', isButton: true });
  await handleInteractionCreate(unknownChoiceInteraction);
  assert.strictEqual(unknownChoiceInteraction.replyPayload.ephemeral, true);
  assert.match(unknownChoiceInteraction.replyPayload.content, /선택지를 찾지 못했어요/);

  const summaryPayload = buildDungeonworldExportPayload(repository, { format: 'summary' });
  assert.strictEqual(summaryPayload.isAttachment, false);
  assert.strictEqual(summaryPayload.rowCount, 4);
  assert.match(summaryPayload.content, /던전월드 참여자/);
  assert.match(summaryPayload.content, /집계/);
  assert.match(summaryPayload.content, /고유 참여자 수: 2/);
  assert.match(summaryPayload.content, /회차별 플레이:/);
  assert.match(summaryPayload.content, /결과 등급 분포:/);
  assert.match(summaryPayload.content, /선택 분포:/);
  assert.strictEqual(summaryPayload.data.analytics.totalPlayCount, 4);
  assert.strictEqual(summaryPayload.data.analytics.uniqueUserCount, 2);
  assert.doesNotMatch(summaryPayload.content, /포인트/);

  const jsonPayload = buildDungeonworldExportPayload(repository, { format: 'json' });
  assert.strictEqual(jsonPayload.isAttachment, true);
  assert.ok(jsonPayload.filename.endsWith('.json'));
  const parsedJson = JSON.parse(jsonPayload.content);
  assert.strictEqual(parsedJson.data.logs.length, 4);
  assert.strictEqual(parsedJson.data.totalPlayCount, 4);
  assert.strictEqual(parsedJson.data.analytics.uniqueUserCount, 2);
  assert.ok(parsedJson.data.analytics.sessionCounts.some((item) => item.sessionId === 'session_02_roots_below'));
  assert.ok(parsedJson.data.analytics.choiceCounts.some((item) => item.choiceId === 'secret_choice'));
  assert.strictEqual(parsedJson.data.analytics.latestSessionProgressCounts.sessionId, 'session_02_roots_below');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(parsedJson.data.analytics, 'recentActivity'), false);

  const limitedJsonPayload = buildDungeonworldExportPayload(repository, { format: 'json', limit: 1 });
  const parsedLimitedJson = JSON.parse(limitedJsonPayload.content);
  assert.strictEqual(parsedLimitedJson.limit, 1);
  assert.strictEqual(parsedLimitedJson.data.logs.length, 1);
  assert.strictEqual(parsedLimitedJson.data.logs[0].id, repository.listRecentPlays(1)[0].id);
  assert.strictEqual(parsedLimitedJson.data.analytics.totalPlayCount, 4);
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(parsedLimitedJson.data.analytics, 'recentActivity'),
    false
  );

  const csvPayload = buildDungeonworldExportPayload(repository, { format: 'csv' });
  assert.ok(csvPayload.filename.endsWith('.csv'));
  assert.ok(csvPayload.content.startsWith('기록ID,사용자ID,표시이름,회차ID,선택ID,선택내용'));
  assert.match(csvPayload.content, /선택내용/);
  assert.match(csvPayload.content, /investigate/);

  function createExportInteraction(isOperator, format = 'summary') {
    return {
      commandName: '운영내보내기',
      member: {
        permissions: {
          has: () => isOperator,
        },
      },
      options: {
        getString: (name) => (name === '종류' ? 'dungeonworld' : format),
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
  assert.match(getEmbedDescription(operatorExportInteraction.replyPayload), /집계/);

  const operatorJsonExportInteraction = createExportInteraction(true, 'json');
  await handleInteractionCreate(operatorJsonExportInteraction);
  assert.strictEqual(operatorJsonExportInteraction.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(operatorJsonExportInteraction.replyPayload), '운영 데이터 내보내기');
  assert.strictEqual(operatorJsonExportInteraction.replyPayload.files.length, 1);
  assert.match(getEmbedDescription(operatorJsonExportInteraction.replyPayload), /형식: JSON/);

  const operatorCsvExportInteraction = createExportInteraction(true, 'csv');
  await handleInteractionCreate(operatorCsvExportInteraction);
  assert.strictEqual(operatorCsvExportInteraction.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(operatorCsvExportInteraction.replyPayload), '운영 데이터 내보내기');
  assert.strictEqual(operatorCsvExportInteraction.replyPayload.files.length, 1);
  assert.match(getEmbedDescription(operatorCsvExportInteraction.replyPayload), /형식: CSV/);

  const nonOperatorExportInteraction = createExportInteraction(false);
  await handleInteractionCreate(nonOperatorExportInteraction);
  assert.match(nonOperatorExportInteraction.replyPayload.content, /운영진 전용 명령어/);

  console.log('dungeonworld flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

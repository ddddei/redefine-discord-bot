const assert = require('assert');
const { ButtonStyle } = require('discord.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function createUser(id, username) {
  return { id, username };
}

function createMember(displayName) {
  return {
    displayName,
    permissions: {
      has() {
        return false;
      },
    },
  };
}

function createChatInputInteraction(commandName, userId, displayName, optionValues = {}, channelId = 'general_channel') {
  return {
    commandName,
    channelId,
    user: createUser(userId, displayName),
    member: createMember(displayName),
    options: {
      getString(name) {
        return Object.hasOwn(optionValues, name) ? optionValues[name] : null;
      },
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

function createButtonInteraction(customId, userId, displayName, channelId = 'minigame_channel') {
  return {
    customId,
    channelId,
    user: createUser(userId, displayName),
    member: createMember(displayName),
    replyPayload: null,
    updatePayload: null,
    isChatInputCommand() {
      return false;
    },
    isStringSelectMenu() {
      return false;
    },
    isButton() {
      return true;
    },
    isModalSubmit() {
      return false;
    },
    async reply(payload) {
      this.replyPayload = payload;
    },
    async update(payload) {
      this.updatePayload = payload;
    },
  };
}

function getEmbedTitle(payload) {
  return payload.embeds[0].data.title;
}

function getButtonIds(payload) {
  return payload.components.flatMap((row) => {
    return row.components.map((component) => component.toJSON().custom_id);
  });
}

function getButtons(payload) {
  return payload.components.flatMap((row) => {
    return row.components.map((component) => component.toJSON());
  }).filter((component) => {
    return component.custom_id && component.custom_id.startsWith('participant_');
  });
}

function setupTempState() {
  const repoDir = path.resolve(__dirname, '..');
  const dataDir = path.join(repoDir, 'data');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'redefine-minigame-'));
  const paths = {
    points: path.join(tempDir, 'points.json'),
    shopItems: path.join(tempDir, 'shop-items.json'),
    redemptions: path.join(tempDir, 'redemptions.json'),
    missions: path.join(tempDir, 'missions.json'),
    submissions: path.join(tempDir, 'submissions.json'),
  };

  writeJson(paths.points, {
    version: 1,
    isExample: false,
    users: [
      { userId: 'mini_user', displayName: '미니게임 사용자', totalPoints: 100, status: 'active' },
      { userId: 'cap_user', displayName: '상한 테스트 사용자', totalPoints: 50, status: 'active' },
    ],
    pointTransactions: [],
  });
  writeJson(paths.shopItems, { version: 1, isExample: false, shopItems: [] });
  writeJson(paths.redemptions, { version: 1, isExample: false, redemptions: [] });
  writeJson(paths.missions, { version: 1, isExample: false, missions: [] });
  writeJson(paths.submissions, { version: 1, isExample: false, submissions: [] });

  process.env.POINTS_DATA_PATH = paths.points;
  process.env.SHOP_ITEMS_DATA_PATH = paths.shopItems;
  process.env.REDEMPTIONS_DATA_PATH = paths.redemptions;
  process.env.MISSIONS_DATA_PATH = paths.missions;
  process.env.SUBMISSIONS_DATA_PATH = paths.submissions;
  process.env.MINIGAME_CHANNEL_ID = 'minigame_channel';
  process.env.POINTS_DATA_FALLBACK = path.join(dataDir, 'points.example.json');
  process.env.SHOP_ITEMS_DATA_FALLBACK = path.join(dataDir, 'shop-items.example.json');
  process.env.REDEMPTIONS_DATA_FALLBACK = path.join(dataDir, 'redemptions.example.json');
  process.env.MISSIONS_DATA_FALLBACK = path.join(dataDir, 'missions.example.json');
  process.env.SUBMISSIONS_DATA_FALLBACK = path.join(dataDir, 'submissions.example.json');

  resetModule('../src/pointsRepository');
  resetModule('../src/handlers');
  resetModule('../src/components');
  resetModule('../src/minigames');
  resetModule('../src/minigameInteractions');

  return { paths, tempDir };
}

async function run() {
  const { paths, tempDir } = setupTempState();
  const { handleInteractionCreate } = require('../src/handlers');
  const { RPS_CHOICES, createMinigameResult } = require('../src/minigames');

  const guideCommand = createChatInputInteraction('안내', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(guideCommand);
  assert.strictEqual(guideCommand.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(guideCommand.replyPayload), '📌 리디파인 이용 메뉴');
  assert.ok(getButtonIds(guideCommand.replyPayload).includes('participant_menu_minigames'));
  assert.ok(getButtonIds(guideCommand.replyPayload).includes('participant_menu_today_mission'));
  const guideButtons = getButtons(guideCommand.replyPayload);
  assert.deepStrictEqual(
    guideButtons.map((button) => [button.custom_id, button.style]),
    [
      ['participant_menu_today_mission', ButtonStyle.Primary],
      ['participant_menu_points', ButtonStyle.Success],
      ['participant_menu_ranking', ButtonStyle.Secondary],
      ['participant_menu_minigames', ButtonStyle.Secondary],
      ['participant_menu_help', ButtonStyle.Secondary],
    ]
  );

  const hubButton = createButtonInteraction('participant_menu_minigames', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(hubButton);
  assert.strictEqual(hubButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(hubButton.replyPayload), '미니게임 채널 안내');
  assert.match(hubButton.replyPayload.embeds[0].data.description, /미니게임은 지정된 미니게임 채널에서 이용해 주세요/);
  assert.match(hubButton.replyPayload.embeds[0].data.description, /<#minigame_channel>/);
  assert.strictEqual(hubButton.replyPayload.components, undefined);

  const noticeWrongChannel = createChatInputInteraction(
    '공지',
    'operator_user',
    '운영자',
    { 종류: 'minigameHub' },
    'general_channel'
  );
  await handleInteractionCreate(noticeWrongChannel);
  assert.strictEqual(noticeWrongChannel.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(noticeWrongChannel.replyPayload), '미니게임 채널 안내');

  const noticeHub = createChatInputInteraction(
    '공지',
    'operator_user',
    '운영자',
    { 종류: 'minigameHub' },
    'minigame_channel'
  );
  await handleInteractionCreate(noticeHub);
  assert.strictEqual(noticeHub.replyPayload.ephemeral, false);
  assert.strictEqual(getEmbedTitle(noticeHub.replyPayload), '미니게임 놀이터');
  assert.deepStrictEqual(
    getButtonIds(noticeHub.replyPayload),
    [
      'participant_minigame_card:1',
      'participant_minigame_card:2',
      'participant_minigame_card:3',
      'participant_minigame_rps_start',
      'participant_minigame_dice',
      'participant_minigame_number:1',
      'participant_minigame_number:2',
      'participant_minigame_number:3',
      'participant_minigame_number:4',
      'participant_minigame_number:5',
    ]
  );

  const blockedCard = createButtonInteraction('participant_minigame_card:1', 'mini_user', '미니게임 사용자', 'other_channel');
  await handleInteractionCreate(blockedCard);
  assert.strictEqual(blockedCard.replyPayload.ephemeral, true);
  assert.match(blockedCard.replyPayload.content, /미니게임은 지정된 미니게임 채널에서 이용해 주세요/);
  assert.strictEqual(readJson(paths.points).pointTransactions.length, 0);

  const cardButton = createButtonInteraction('participant_minigame_card:2', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(cardButton);
  assert.strictEqual(cardButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(cardButton.replyPayload), '🎴 행운 카드 뒤집기');
  assert.match(cardButton.replyPayload.embeds[0].data.description, /선택한 카드:/);
  assert.match(cardButton.replyPayload.embeds[0].data.description, /카드 결과: (0P|3P|5P|10P)/);

  const duplicateCard = createButtonInteraction('participant_minigame_card:3', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(duplicateCard);
  assert.strictEqual(getEmbedTitle(duplicateCard.replyPayload), '🎴 행운 카드 뒤집기');
  assert.match(duplicateCard.replyPayload.embeds[0].data.description, /이미 오늘 보상을 확인했어요|중복 지급되지 않아요/);

  const rpsStart = createButtonInteraction('participant_minigame_rps_start', 'rps_draw_user', '가위바위보 사용자');
  await handleInteractionCreate(rpsStart);
  assert.strictEqual(rpsStart.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(rpsStart.replyPayload), '✊ 가위바위보');
  assert.deepStrictEqual(
    getButtonIds(rpsStart.replyPayload),
    [
      'participant_minigame_rps:scissors',
      'participant_minigame_rps:rock',
      'participant_minigame_rps:paper',
    ]
  );

  const playDate = require('../src/pointsRepository').getKoreanDateString();
  const drawChoice = Object.keys(RPS_CHOICES).find((choice) => {
    const result = createMinigameResult({
      gameId: 'rps',
      choice,
      userId: 'rps_draw_user',
      dateString: playDate,
    });
    return result && result.isDraw;
  });
  assert.ok(drawChoice, 'expected at least one deterministic RPS draw choice');
  const rpsDraw = createButtonInteraction(`participant_minigame_rps:${drawChoice}`, 'rps_draw_user', '가위바위보 사용자');
  await handleInteractionCreate(rpsDraw);
  assert.strictEqual(rpsDraw.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(rpsDraw.replyPayload), '✊ 가위바위보');
  assert.match(rpsDraw.replyPayload.embeds[0].data.description, /무승부/);
  assert.match(rpsDraw.replyPayload.embeds[0].data.description, /한 번 더 선택/);
  assert.deepStrictEqual(
    getButtonIds(rpsDraw.replyPayload),
    [
      'participant_minigame_rps:scissors',
      'participant_minigame_rps:rock',
      'participant_minigame_rps:paper',
    ]
  );
  assert.ok(!readJson(paths.points).pointTransactions.some((transaction) => {
    return transaction.userId === 'rps_draw_user' && transaction.relatedId.endsWith(':rps');
  }));

  const diceButton = createButtonInteraction('participant_minigame_dice', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(diceButton);
  assert.strictEqual(diceButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(diceButton.replyPayload), '🎲 주사위 대결');
  assert.match(diceButton.replyPayload.embeds[0].data.description, /🎲 내 주사위:/);
  assert.match(diceButton.replyPayload.embeds[0].data.description, /🎲 봇 주사위:/);
  assert.match(diceButton.replyPayload.embeds[0].data.description, /지급 포인트:/);

  const numberButton = createButtonInteraction('participant_minigame_number:3', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(numberButton);
  assert.strictEqual(numberButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(numberButton.replyPayload), '🔢 숫자 맞히기');
  assert.match(numberButton.replyPayload.embeds[0].data.description, /내 숫자: 3/);
  assert.match(numberButton.replyPayload.embeds[0].data.description, /봇 숫자:/);

  const capCard = createButtonInteraction('participant_minigame_card:1', 'cap_user', '상한 테스트 사용자');
  const capDice = createButtonInteraction('participant_minigame_dice', 'cap_user', '상한 테스트 사용자');
  const capNumber = createButtonInteraction('participant_minigame_number:5', 'cap_user', '상한 테스트 사용자');
  await handleInteractionCreate(capCard);
  await handleInteractionCreate(capDice);
  await handleInteractionCreate(capNumber);
  const capData = readJson(paths.points);
  const capUser = capData.users.find((user) => user.userId === 'cap_user');
  const capEarned = capUser.totalPoints - 50;
  assert.ok(capEarned <= 10, `daily minigame cap exceeded: ${capEarned}`);
  assert.ok(capData.pointTransactions.every((transaction) => transaction.amount >= 0));
  assert.ok(capData.pointTransactions.every((transaction) => transaction.relatedType === 'minigameReward'));

  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('minigame hub flow smoke test passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

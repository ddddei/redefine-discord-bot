const assert = require('assert');
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

function createChatInputInteraction(commandName, userId, displayName) {
  return {
    commandName,
    user: createUser(userId, displayName),
    member: createMember(displayName),
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

function createButtonInteraction(customId, userId, displayName) {
  return {
    customId,
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
  process.env.POINTS_DATA_FALLBACK = path.join(dataDir, 'points.example.json');
  process.env.SHOP_ITEMS_DATA_FALLBACK = path.join(dataDir, 'shop-items.example.json');
  process.env.REDEMPTIONS_DATA_FALLBACK = path.join(dataDir, 'redemptions.example.json');
  process.env.MISSIONS_DATA_FALLBACK = path.join(dataDir, 'missions.example.json');
  process.env.SUBMISSIONS_DATA_FALLBACK = path.join(dataDir, 'submissions.example.json');

  resetModule('../src/pointsRepository');
  resetModule('../src/handlers');
  resetModule('../src/components');

  return { paths, tempDir };
}

async function run() {
  const { paths, tempDir } = setupTempState();
  const { handleInteractionCreate } = require('../src/handlers');

  const guideCommand = createChatInputInteraction('안내', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(guideCommand);
  assert.strictEqual(guideCommand.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(guideCommand.replyPayload), '📌 리디파인 이용 메뉴');
  assert.ok(getButtonIds(guideCommand.replyPayload).includes('participant_menu_minigames'));
  assert.ok(getButtonIds(guideCommand.replyPayload).includes('participant_menu_today_mission'));

  const hubButton = createButtonInteraction('participant_menu_minigames', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(hubButton);
  assert.strictEqual(hubButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(hubButton.replyPayload), '미니게임 놀이터');
  assert.deepStrictEqual(
    getButtonIds(hubButton.replyPayload),
    [
      'participant_minigame_treasure',
      'participant_minigame_rps:rock',
      'participant_minigame_rps:scissors',
      'participant_minigame_rps:paper',
      'participant_minigame_dice',
    ]
  );

  const treasureButton = createButtonInteraction('participant_minigame_treasure', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(treasureButton);
  assert.strictEqual(treasureButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(treasureButton.replyPayload), '오늘의 보물상자');
  assert.match(treasureButton.replyPayload.embeds[0].data.description, /포인트|보상|오늘/);

  const duplicateTreasure = createButtonInteraction('participant_minigame_treasure', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(duplicateTreasure);
  assert.strictEqual(getEmbedTitle(duplicateTreasure.replyPayload), '오늘의 보물상자');
  assert.match(duplicateTreasure.replyPayload.embeds[0].data.description, /이미 오늘 보상을 확인했어요|중복 지급되지 않아요/);

  const rpsButton = createButtonInteraction('participant_minigame_rps:rock', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(rpsButton);
  assert.strictEqual(rpsButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(rpsButton.replyPayload), '가위바위보');
  assert.match(rpsButton.replyPayload.embeds[0].data.description, /내 선택: 바위/);
  assert.match(rpsButton.replyPayload.embeds[0].data.description, /봇 선택:/);

  const diceButton = createButtonInteraction('participant_minigame_dice', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(diceButton);
  assert.strictEqual(diceButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(diceButton.replyPayload), '주사위 대결');
  assert.match(diceButton.replyPayload.embeds[0].data.description, /내 주사위:/);
  assert.match(diceButton.replyPayload.embeds[0].data.description, /봇 주사위:/);

  const capTreasure = createButtonInteraction('participant_minigame_treasure', 'cap_user', '상한 테스트 사용자');
  const capRps = createButtonInteraction('participant_minigame_rps:rock', 'cap_user', '상한 테스트 사용자');
  const capDice = createButtonInteraction('participant_minigame_dice', 'cap_user', '상한 테스트 사용자');
  await handleInteractionCreate(capTreasure);
  await handleInteractionCreate(capRps);
  await handleInteractionCreate(capDice);
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

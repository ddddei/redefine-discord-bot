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

function getRows(payload) {
  return payload.components.map((row) => {
    return row.components.map((component) => component.toJSON());
  });
}

function assertButtonIds(payload, expectedIds) {
  assert.deepStrictEqual(getButtonIds(payload), expectedIds);
}

function assertMaxButtonsPerRow(payload, maxButtons = 3) {
  assert.ok(getRows(payload).every((row) => row.length <= maxButtons));
}

function assertButtonStyles(payload, expectedStylesById) {
  const buttonsById = new Map(getButtons(payload).map((button) => [button.custom_id, button]));
  Object.entries(expectedStylesById).forEach(([customId, expectedStyle]) => {
    assert.strictEqual(buttonsById.get(customId).style, expectedStyle, `${customId} button style`);
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
  const { getKoreanDateString } = require('../src/pointsRepository');

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
      ['participant_menu_onboarding', ButtonStyle.Primary],
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
  assert.strictEqual(getEmbedTitle(hubButton.replyPayload), '미니게임 놀이터');
  assertButtonIds(hubButton.replyPayload, [
    'participant_minigame_select:card',
    'participant_minigame_select:rps',
    'participant_minigame_select:dice',
    'participant_minigame_select:number',
    'participant_minigame_select:door',
    'participant_minigame_select:memory',
    'participant_minigame_select:initial',
    'participant_minigame_select:explore',
    'participant_minigame_select:rogue',
    'participant_minigame_today_record',
    'participant_minigame_today_ranking',
  ]);
  assertMaxButtonsPerRow(hubButton.replyPayload);
  assertButtonStyles(hubButton.replyPayload, {
    'participant_minigame_today_record': ButtonStyle.Secondary,
    'participant_minigame_today_ranking': ButtonStyle.Secondary,
  });
  assert.ok(getButtonIds(hubButton.replyPayload).slice(0, 9).every((customId) => {
    return customId.startsWith('participant_minigame_select:');
  }));
  assert.ok(getButtons(hubButton.replyPayload).slice(0, 9).every((button) => button.style === ButtonStyle.Primary));
  assert.match(hubButton.replyPayload.embeds[0].data.description, /최대 4회/);
  assert.match(hubButton.replyPayload.embeds[0].data.description, /최대 40P/);

  const emptyRecordButton = createButtonInteraction('participant_minigame_today_record', 'empty_user', '기록 없는 사용자');
  await handleInteractionCreate(emptyRecordButton);
  assert.strictEqual(emptyRecordButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(emptyRecordButton.replyPayload), '📊 오늘의 미니게임 기록');
  assert.match(emptyRecordButton.replyPayload.embeds[0].data.description, /아직 오늘 플레이한 미니게임이 없어요/);
  assert.match(emptyRecordButton.replyPayload.embeds[0].data.description, /오늘 미니게임 참여 횟수: 0\/4/);
  assert.match(emptyRecordButton.replyPayload.embeds[0].data.description, /오늘 미니게임 획득 포인트: 0\/40P/);

  const emptyRankingButton = createButtonInteraction('participant_minigame_today_ranking', 'empty_user', '기록 없는 사용자');
  await handleInteractionCreate(emptyRankingButton);
  assert.strictEqual(emptyRankingButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(emptyRankingButton.replyPayload), '🏆 미니게임 랭킹');
  assert.match(emptyRankingButton.replyPayload.embeds[0].data.description, /아직 미니게임 랭킹 데이터가 없어요/);

  const outsideHubButton = createButtonInteraction(
    'participant_menu_minigames',
    'mini_user',
    '미니게임 사용자',
    'general_channel'
  );
  await handleInteractionCreate(outsideHubButton);
  assert.strictEqual(outsideHubButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(outsideHubButton.replyPayload), '미니게임 채널 안내');
  assert.match(outsideHubButton.replyPayload.embeds[0].data.description, /미니게임은 지정된 미니게임 채널에서 이용해 주세요/);
  assert.match(outsideHubButton.replyPayload.embeds[0].data.description, /<#minigame_channel>/);
  assert.strictEqual(outsideHubButton.replyPayload.components, undefined);

  delete process.env.MINIGAME_CHANNEL_ID;
  const noEnvHubButton = createButtonInteraction(
    'participant_menu_minigames',
    'mini_user',
    '미니게임 사용자',
    'general_channel'
  );
  await handleInteractionCreate(noEnvHubButton);
  assert.strictEqual(noEnvHubButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(noEnvHubButton.replyPayload), '미니게임 놀이터');
  process.env.MINIGAME_CHANNEL_ID = 'minigame_channel';

  const blockedSelect = createButtonInteraction('participant_minigame_select:card', 'mini_user', '미니게임 사용자', 'other_channel');
  await handleInteractionCreate(blockedSelect);
  assert.strictEqual(blockedSelect.replyPayload.ephemeral, true);
  assert.match(blockedSelect.replyPayload.content, /미니게임은 지정된 미니게임 채널에서 이용해 주세요/);
  assert.strictEqual(readJson(paths.points).pointTransactions.length, 0);

  const blockedRecord = createButtonInteraction('participant_minigame_today_record', 'mini_user', '미니게임 사용자', 'other_channel');
  await handleInteractionCreate(blockedRecord);
  assert.strictEqual(blockedRecord.replyPayload.ephemeral, true);
  assert.match(blockedRecord.replyPayload.content, /미니게임은 지정된 미니게임 채널에서 이용해 주세요/);

  const cardSelect = createButtonInteraction('participant_minigame_select:card', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(cardSelect);
  assert.strictEqual(cardSelect.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(cardSelect.replyPayload), '🎴 행운 카드 뒤집기');
  assertButtonIds(cardSelect.replyPayload, [
    'participant_minigame_card:1',
    'participant_minigame_card:2',
    'participant_minigame_card:3',
  ]);
  assertMaxButtonsPerRow(cardSelect.replyPayload);
  assert.ok(getButtons(cardSelect.replyPayload).every((button) => button.style === ButtonStyle.Secondary));
  const cardButton = createButtonInteraction('participant_minigame_card:2', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(cardButton);
  assert.strictEqual(cardButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(cardButton.replyPayload), '🎴 행운 카드 뒤집기');
  assert.match(cardButton.replyPayload.embeds[0].data.description, /선택한 카드:/);
  assert.match(cardButton.replyPayload.embeds[0].data.description, /카드 결과: (0P|3P|5P|10P)/);
  assert.match(cardButton.replyPayload.embeds[0].data.description, /오늘 남은 미니게임 보상 한도: \d+P/);

  const duplicateCard = createButtonInteraction('participant_minigame_card:3', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(duplicateCard);
  assert.strictEqual(getEmbedTitle(duplicateCard.replyPayload), '🎴 행운 카드 뒤집기');
  assert.match(duplicateCard.replyPayload.embeds[0].data.description, /이미 오늘 보상을 확인했어요|중복 지급되지 않아요/);

  const playDate = getKoreanDateString();
  let drawUserId = null;
  let drawChoice = null;
  for (let index = 0; index < 1000 && !drawChoice; index += 1) {
    const candidateUserId = `rps_draw_user_${index}`;
    drawChoice = Object.keys(RPS_CHOICES).find((choice) => {
      const result = createMinigameResult({
        gameId: 'rps',
        choice,
        userId: candidateUserId,
        dateString: playDate,
      });
      return result && result.isDraw;
    });
    if (drawChoice) {
      drawUserId = candidateUserId;
    }
  }
  assert.ok(drawUserId && drawChoice, 'expected at least one deterministic RPS draw fixture');

  const rpsSelect = createButtonInteraction('participant_minigame_select:rps', drawUserId, '가위바위보 사용자');
  await handleInteractionCreate(rpsSelect);
  assert.strictEqual(rpsSelect.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(rpsSelect.replyPayload), '✊ 가위바위보');
  assertButtonIds(rpsSelect.replyPayload, [
    'participant_minigame_rps:scissors',
    'participant_minigame_rps:rock',
    'participant_minigame_rps:paper',
  ]);
  assertMaxButtonsPerRow(rpsSelect.replyPayload);
  assert.ok(getButtons(rpsSelect.replyPayload).every((button) => button.style === ButtonStyle.Secondary));

  const rpsDraw = createButtonInteraction(`participant_minigame_rps:${drawChoice}`, drawUserId, '가위바위보 사용자');
  await handleInteractionCreate(rpsDraw);
  assert.strictEqual(rpsDraw.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(rpsDraw.replyPayload), '✊ 가위바위보');
  assert.match(rpsDraw.replyPayload.embeds[0].data.description, /무승부/);
  assert.match(rpsDraw.replyPayload.embeds[0].data.description, /한 번 더 선택/);
  assertButtonIds(rpsDraw.replyPayload, [
    'participant_minigame_rps:scissors',
    'participant_minigame_rps:rock',
    'participant_minigame_rps:paper',
  ]);
  assert.ok(!readJson(paths.points).pointTransactions.some((transaction) => {
    return transaction.userId === drawUserId && transaction.relatedId.endsWith(':rps');
  }));

  const diceSelect = createButtonInteraction('participant_minigame_select:dice', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(diceSelect);
  assert.strictEqual(diceSelect.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(diceSelect.replyPayload), '🎲 주사위 대결');
  assertButtonIds(diceSelect.replyPayload, ['participant_minigame_dice']);
  assertButtonStyles(diceSelect.replyPayload, {
    participant_minigame_dice: ButtonStyle.Success,
  });
  const diceButton = createButtonInteraction('participant_minigame_dice', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(diceButton);
  assert.strictEqual(diceButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(diceButton.replyPayload), '🎲 주사위 대결');
  assert.match(diceButton.replyPayload.embeds[0].data.description, /🎲 내 주사위:/);
  assert.match(diceButton.replyPayload.embeds[0].data.description, /🎲 봇 주사위:/);
  assert.match(diceButton.replyPayload.embeds[0].data.description, /지급 포인트:/);

  const numberSelect = createButtonInteraction('participant_minigame_select:number', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(numberSelect);
  assert.strictEqual(numberSelect.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(numberSelect.replyPayload), '🔢 숫자 맞히기');
  assertButtonIds(numberSelect.replyPayload, [
    'participant_minigame_number:1',
    'participant_minigame_number:2',
    'participant_minigame_number:3',
    'participant_minigame_number:4',
    'participant_minigame_number:5',
  ]);
  assertMaxButtonsPerRow(numberSelect.replyPayload);
  assert.ok(getButtons(numberSelect.replyPayload).every((button) => button.style === ButtonStyle.Secondary));
  const numberButton = createButtonInteraction('participant_minigame_number:3', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(numberButton);
  assert.strictEqual(numberButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(numberButton.replyPayload), '🔢 숫자 맞히기');
  assert.match(numberButton.replyPayload.embeds[0].data.description, /내 숫자: 3/);
  assert.match(numberButton.replyPayload.embeds[0].data.description, /봇 숫자:/);

  const populatedRecordButton = createButtonInteraction('participant_minigame_today_record', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(populatedRecordButton);
  assert.strictEqual(populatedRecordButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(populatedRecordButton.replyPayload), '📊 오늘의 미니게임 기록');
  assert.match(populatedRecordButton.replyPayload.embeds[0].data.description, /오늘 미니게임 참여 횟수: 3\/4/);
  assert.match(populatedRecordButton.replyPayload.embeds[0].data.description, /오늘 미니게임 획득 포인트: \d+\/40P/);
  assert.match(populatedRecordButton.replyPayload.embeds[0].data.description, /남은 참여 횟수: 1회/);
  assert.match(populatedRecordButton.replyPayload.embeds[0].data.description, /남은 획득 가능 포인트: \d+P/);
  assert.match(populatedRecordButton.replyPayload.embeds[0].data.description, /오늘 플레이한 게임/);
  assert.match(populatedRecordButton.replyPayload.embeds[0].data.description, /행운 카드 뒤집기/);
  assert.match(populatedRecordButton.replyPayload.embeds[0].data.description, /주사위 대결/);
  assert.match(populatedRecordButton.replyPayload.embeds[0].data.description, /숫자 맞히기/);
  assert.match(populatedRecordButton.replyPayload.embeds[0].data.description, /최근 결과/);

  const doorSelect = createButtonInteraction('participant_minigame_select:door', 'door_user', '문 선택 사용자');
  await handleInteractionCreate(doorSelect);
  assert.strictEqual(doorSelect.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(doorSelect.replyPayload), '🚪 문 하나 고르기');
  assertButtonIds(doorSelect.replyPayload, [
    'participant_minigame_door:1',
    'participant_minigame_door:2',
    'participant_minigame_door:3',
  ]);
  const doorButton = createButtonInteraction('participant_minigame_door:2', 'door_user', '문 선택 사용자');
  await handleInteractionCreate(doorButton);
  assert.strictEqual(getEmbedTitle(doorButton.replyPayload), '🚪 문 하나 고르기');
  assert.match(doorButton.replyPayload.embeds[0].data.description, /선택한 문: 2번/);

  const memorySelect = createButtonInteraction('participant_minigame_select:memory', 'memory_user', '기억력 사용자');
  await handleInteractionCreate(memorySelect);
  assert.strictEqual(memorySelect.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(memorySelect.replyPayload), '🧠 이모지 기억력');
  assertButtonIds(memorySelect.replyPayload, [
    'participant_minigame_memory:1',
    'participant_minigame_memory:2',
    'participant_minigame_memory:3',
  ]);
  const memoryButton = createButtonInteraction('participant_minigame_memory:1', 'memory_user', '기억력 사용자');
  await handleInteractionCreate(memoryButton);
  assert.strictEqual(getEmbedTitle(memoryButton.replyPayload), '🧠 이모지 기억력');
  assert.match(memoryButton.replyPayload.embeds[0].data.description, /선택한 패턴:/);

  const initialSelect = createButtonInteraction('participant_minigame_select:initial', 'initial_user', '초성 사용자');
  await handleInteractionCreate(initialSelect);
  assert.strictEqual(initialSelect.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(initialSelect.replyPayload), '🧩 초성 퀴즈');
  assertButtonIds(initialSelect.replyPayload, [
    'participant_minigame_initial:1',
    'participant_minigame_initial:2',
    'participant_minigame_initial:3',
  ]);
  const initialButton = createButtonInteraction('participant_minigame_initial:1', 'initial_user', '초성 사용자');
  await handleInteractionCreate(initialButton);
  assert.strictEqual(getEmbedTitle(initialButton.replyPayload), '🧩 초성 퀴즈');
  assert.match(initialButton.replyPayload.embeds[0].data.description, /선택한 답:/);

  const exploreSelect = createButtonInteraction('participant_minigame_select:explore', 'explore_user', '탐험 사용자');
  await handleInteractionCreate(exploreSelect);
  assert.strictEqual(exploreSelect.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(exploreSelect.replyPayload), '🧭 리디파인 탐험');
  assertButtonIds(exploreSelect.replyPayload, [
    'participant_minigame_explore:forest',
    'participant_minigame_explore:library',
    'participant_minigame_explore:plaza',
  ]);
  const exploreButton = createButtonInteraction('participant_minigame_explore:library', 'explore_user', '탐험 사용자');
  await handleInteractionCreate(exploreButton);
  assert.strictEqual(getEmbedTitle(exploreButton.replyPayload), '🧭 리디파인 탐험');
  assert.match(exploreButton.replyPayload.embeds[0].data.description, /선택한 장소: 도서관/);

  const rogueSelect = createButtonInteraction('participant_minigame_select:rogue', 'rogue_user', '세 칸 탐험 사용자');
  await handleInteractionCreate(rogueSelect);
  assert.strictEqual(rogueSelect.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(rogueSelect.replyPayload), '🗺️ 세 칸 탐험');
  assertButtonIds(rogueSelect.replyPayload, [
    'participant_minigame_rogue_path:market',
    'participant_minigame_rogue_path:station',
    'participant_minigame_rogue_path:rooftop',
  ]);
  assertMaxButtonsPerRow(rogueSelect.replyPayload);

  const roguePath = createButtonInteraction('participant_minigame_rogue_path:market', 'rogue_user', '세 칸 탐험 사용자');
  await handleInteractionCreate(roguePath);
  assert.strictEqual(roguePath.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(roguePath.replyPayload), '🗺️ 세 칸 탐험');
  assert.match(roguePath.replyPayload.embeds[0].data.description, /탐험지: 새벽 시장/);
  assertButtonIds(roguePath.replyPayload, [
    'participant_minigame_rogue_item:market:lantern',
    'participant_minigame_rogue_item:market:map',
    'participant_minigame_rogue_item:market:snack',
  ]);

  const rogueItem = createButtonInteraction('participant_minigame_rogue_item:market:map', 'rogue_user', '세 칸 탐험 사용자');
  await handleInteractionCreate(rogueItem);
  assert.strictEqual(rogueItem.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(rogueItem.replyPayload), '🗺️ 세 칸 탐험');
  assert.match(rogueItem.replyPayload.embeds[0].data.description, /장비: 접힌 지도/);
  assertButtonIds(rogueItem.replyPayload, [
    'participant_minigame_rogue_exit:market:map:signal',
    'participant_minigame_rogue_exit:market:map:talk',
    'participant_minigame_rogue_exit:market:map:rest',
  ]);

  assert.ok(!readJson(paths.points).pointTransactions.some((transaction) => {
    return transaction.userId === 'rogue_user' && transaction.relatedId.endsWith(':rogue');
  }));

  // 유리 조합은 사용자·날짜 시드로 정해지므로 오늘의 유리 조합을 계산해 완주한다.
  const { getRogueFavoredChoices } = require('../src/minigameResults');
  const { ROGUE_EXITS, ROGUE_ITEMS } = require('../src/minigameData');
  const rogueFavored = getRogueFavoredChoices({
    userId: 'rogue_user',
    dateString: playDate,
    pathKey: 'market',
  });
  const rogueExit = createButtonInteraction(
    `participant_minigame_rogue_exit:market:${rogueFavored.favoredItem}:${rogueFavored.favoredExit}`,
    'rogue_user',
    '세 칸 탐험 사용자'
  );
  await handleInteractionCreate(rogueExit);
  assert.strictEqual(rogueExit.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(rogueExit.replyPayload), '🗺️ 세 칸 탐험');
  assert.match(rogueExit.replyPayload.embeds[0].data.description, /탐험지: 새벽 시장/);
  assert.ok(rogueExit.replyPayload.embeds[0].data.description.includes(`장비: ${ROGUE_ITEMS[rogueFavored.favoredItem].label}`));
  assert.ok(rogueExit.replyPayload.embeds[0].data.description.includes(`마지막 행동: ${ROGUE_EXITS[rogueFavored.favoredExit].label}`));
  assert.match(rogueExit.replyPayload.embeds[0].data.description, /탐험 결과: 10P/);
  assert.match(rogueExit.replyPayload.embeds[0].data.description, /지급 포인트: 10P/);

  const duplicateRogueExit = createButtonInteraction('participant_minigame_rogue_exit:station:lantern:signal', 'rogue_user', '세 칸 탐험 사용자');
  await handleInteractionCreate(duplicateRogueExit);
  assert.strictEqual(getEmbedTitle(duplicateRogueExit.replyPayload), '🗺️ 세 칸 탐험');
  assert.match(duplicateRogueExit.replyPayload.embeds[0].data.description, /같은 게임 보상은 같은 날짜에 중복 지급되지 않아요/);

  const repo = require('../src/pointsRepository').createPointsRepository();
  const capUserFixture = { userId: 'cap_user', displayName: '상한 테스트 사용자' };
  const capResults = [
    ['cap_a', 15],
    ['cap_b', 15],
    ['cap_c', 15],
  ].map(([gameId, rewardPoints]) => {
    return repo.awardMinigameReward({
      user: capUserFixture,
      gameId,
      gameTitle: gameId,
      playDate,
      rewardPoints,
      reason: `미니게임 보상: ${gameId}`,
    });
  });
  assert.deepStrictEqual(capResults.map((result) => result.awardedPoints), [15, 15, 10]);
  const capData = readJson(paths.points);
  const capUser = capData.users.find((user) => user.userId === 'cap_user');
  const capEarned = capUser.totalPoints - 50;
  assert.ok(capEarned <= 40, `daily minigame cap exceeded: ${capEarned}`);
  assert.strictEqual(
    capData.pointTransactions.filter((transaction) => transaction.userId === 'cap_user').length,
    3
  );
  assert.ok(capData.pointTransactions.every((transaction) => transaction.amount >= 0));
  assert.ok(capData.pointTransactions.every((transaction) => transaction.relatedType === 'minigameReward'));

  const highRewardUser = { userId: 'high_reward_user', displayName: '상한 사용자' };
  const highRewardGames = [
    ['bonus_a', 15],
    ['bonus_b', 15],
    ['bonus_c', 15],
    ['bonus_d', 15],
  ];
  const highRewardResults = highRewardGames.map(([gameId, rewardPoints]) => {
    return repo.awardMinigameReward({
      user: highRewardUser,
      gameId,
      gameTitle: gameId,
      playDate,
      rewardPoints,
      reason: `미니게임 보상: ${gameId}`,
    });
  });
  assert.deepStrictEqual(highRewardResults.map((result) => result.awardedPoints), [15, 15, 10, 0]);
  assert.strictEqual(highRewardResults[2].remainingDailyRewardAfterAward, 0);
  assert.strictEqual(highRewardResults[3].remainingDailyRewardAfterAward, 0);
  assert.strictEqual(readJson(paths.points).users.find((user) => user.userId === 'high_reward_user').totalPoints, 40);

  const playLimitUser = { userId: 'play_limit_user', displayName: '횟수 제한 사용자' };
  ['card', 'dice', 'number', 'door'].forEach((gameId) => {
    const result = repo.awardMinigameReward({
      user: playLimitUser,
      gameId,
      gameTitle: gameId,
      playDate,
      rewardPoints: gameId === 'card' ? 0 : 1,
      reason: `미니게임 보상: ${gameId}`,
    });
    assert.strictEqual(result.ok, true);
  });
  const fifthPlay = createButtonInteraction('participant_minigame_explore:library', 'play_limit_user', '횟수 제한 사용자');
  await handleInteractionCreate(fifthPlay);
  assert.strictEqual(fifthPlay.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(fifthPlay.replyPayload), '🧭 리디파인 탐험');
  assert.match(fifthPlay.replyPayload.embeds[0].data.description, /오늘 참여 가능한 미니게임 횟수를 모두 사용했어요/);
  assert.strictEqual(
    readJson(paths.points).pointTransactions.filter((transaction) => transaction.userId === 'play_limit_user').length,
    4
  );

  const zeroPointUser = 'zero_point_count_user';
  const zeroPointPlay = repo.awardMinigameReward({
    user: { userId: zeroPointUser, displayName: '0P 사용자' },
    gameId: 'zero_a',
    gameTitle: '0P 게임',
    playDate,
    rewardPoints: 0,
    reason: '미니게임 보상: 0P 게임',
  });
  assert.strictEqual(zeroPointPlay.ok, true);
  assert.strictEqual(zeroPointPlay.dailyPlayCountAfterAward, 1);

  const rankingButton = createButtonInteraction('participant_minigame_today_ranking', 'mini_user', '미니게임 사용자');
  await handleInteractionCreate(rankingButton);
  assert.strictEqual(rankingButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(rankingButton.replyPayload), '🏆 미니게임 랭킹');
  const rankingDescription = rankingButton.replyPayload.embeds[0].data.description;
  assert.match(rankingDescription, /재미용 기록/);
  assert.match(rankingDescription, /오늘 \(/);
  assert.match(rankingDescription, /최근 7일/);
  assert.match(rankingDescription, /누적/);
  assert.match(rankingDescription, /상한 사용자 - 40P \(4회\)/);
  assert.match(rankingDescription, /상한 테스트 사용자 - 40P \(3회\)/);
  assert.match(rankingDescription, /꾸준한 참여 기록/);
  assert.match(rankingDescription, /하루 미니게임은 최대 4회, 보상 합계는 최대 40P/);
  assert.doesNotMatch(rankingDescription, /0P 사용자/);

  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('minigame hub flow smoke test passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

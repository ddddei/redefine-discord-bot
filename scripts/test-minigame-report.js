const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

const repoDir = path.resolve(__dirname, '..');
const dataDir = path.join(repoDir, 'data');

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function createMinigameTransaction({ userId, date, gameId, amount, createdAt }) {
  return {
    id: `tx_${userId}_${date}_${gameId}`,
    userId,
    type: amount > 0 ? 'earn' : 'adjust',
    amount,
    balanceAfter: 100,
    reason: `미니게임 보상: ${gameId}`,
    relatedType: 'minigameReward',
    relatedId: `${date}:${gameId}`,
    createdBy: userId,
    createdAt: createdAt || `${date}T10:00:00.000Z`,
    note: null,
  };
}

function createFixtureRepository() {
  const tempDir = createTempDir('minigame-report-points-');
  const pointsPath = path.join(tempDir, 'points.json');

  writeJson(pointsPath, {
    version: 1,
    isExample: false,
    users: [],
    pointTransactions: [
      // 오늘(KST 2026-07-03)
      createMinigameTransaction({ userId: 'user_a', date: '2026-07-03', gameId: 'card', amount: 5 }),
      createMinigameTransaction({ userId: 'user_a', date: '2026-07-03', gameId: 'dice', amount: 0 }),
      createMinigameTransaction({ userId: 'user_b', date: '2026-07-03', gameId: 'card', amount: 3 }),
      // 6일 전 — 최근 7일 창 안
      createMinigameTransaction({ userId: 'user_b', date: '2026-06-27', gameId: 'rogue', amount: 10 }),
      // 8일 전 — 최근 7일 창 밖, 누적에는 포함
      createMinigameTransaction({ userId: 'user_c', date: '2026-06-25', gameId: 'card', amount: 5 }),
      // 알 수 없는 gameId — 제목 폴백 확인
      createMinigameTransaction({ userId: 'user_c', date: '2026-06-25', gameId: 'mystery', amount: 2 }),
      // 미니게임 아닌 거래 — 집계 제외
      {
        id: 'tx_manual_1',
        userId: 'user_a',
        type: 'earn',
        amount: 50,
        balanceAfter: 150,
        reason: '수동 지급',
        relatedType: 'manual',
        relatedId: null,
        createdBy: 'operator',
        createdAt: '2026-07-03T10:00:00.000Z',
        note: null,
      },
      // example 유사 데이터 — 운영 레코드 필터로 제외
      createMinigameTransaction({ userId: 'example_user', date: '2026-07-03', gameId: 'card', amount: 5 }),
    ],
  });

  const { createPointsRepository } = require('../src/pointsRepository');
  return createPointsRepository({
    points: pointsPath,
    pointsFallback: path.join(dataDir, 'points.example.json'),
    shopItems: path.join(tempDir, 'shop-items.json'),
    shopItemsFallback: path.join(dataDir, 'shop-items.example.json'),
    redemptions: path.join(tempDir, 'redemptions.json'),
    redemptionsFallback: path.join(dataDir, 'redemptions.example.json'),
    missions: path.join(tempDir, 'missions.json'),
    missionsFallback: path.join(dataDir, 'missions.example.json'),
    submissions: path.join(tempDir, 'submissions.json'),
    submissionsFallback: path.join(dataDir, 'submissions.example.json'),
  });
}

function createFixtureDungeonworldRepository() {
  const tempDir = createTempDir('minigame-report-dungeonworld-');
  const { createDungeonworldRepository } = require('../src/dungeonworld');
  const repository = createDungeonworldRepository({
    logs: path.join(tempDir, 'dungeonworld-logs.json'),
  });

  const basePlay = {
    choiceId: 'chase',
    choiceLabel: '고블린을 바로 추격한다',
    die1: 4,
    die2: 4,
    total: 8,
    tier: 'mixed',
    tierLabel: '7~9',
    outcomeText: '테스트 결과',
  };
  repository.recordPlay({ ...basePlay, sessionId: 'session_01_black_bell', userId: 'dw_user_a', displayName: 'A' });
  repository.recordPlay({ ...basePlay, sessionId: 'session_01_black_bell', userId: 'dw_user_b', displayName: 'B' });
  repository.recordPlay({ ...basePlay, sessionId: 'session_02_roots_below', userId: 'dw_user_a', displayName: 'A' });

  return repository;
}

function createOperatorInteraction(commandName, optionValues = {}) {
  return {
    commandName,
    channelId: 'operator_channel',
    user: { id: 'operator_user', username: '운영자' },
    member: {
      displayName: '운영자',
      permissions: {
        has() {
          return true;
        },
      },
    },
    options: {
      getString(name) {
        return Object.hasOwn(optionValues, name) ? optionValues[name] : null;
      },
      getInteger() {
        return null;
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

async function main() {
  const { buildMinigameReport, createMinigameReportEmbed } = require('../src/minigameReport');
  const now = new Date('2026-07-03T12:00:00.000Z'); // KST 2026-07-03 21:00

  // 1. 집계 정확성: 오늘 / 최근 7일 / 누적 + 제외 규칙
  const pointsRepository = createFixtureRepository();
  const dungeonworldRepository = createFixtureDungeonworldRepository();
  const report = buildMinigameReport({ pointsRepository, dungeonworldRepository, now });

  assert.strictEqual(report.generatedDateKst, '2026-07-03');
  assert.deepStrictEqual(report.hub.today, { playCount: 3, uniqueUserCount: 2, totalPoints: 8 });
  assert.deepStrictEqual(report.hub.recent7Days, { playCount: 4, uniqueUserCount: 2, totalPoints: 18 });
  assert.deepStrictEqual(report.hub.total, { playCount: 6, uniqueUserCount: 3, totalPoints: 25 });

  // 일별 집계: 오늘 3건/2명, 2026-06-27 1건/1명, 나머지 0건
  assert.strictEqual(report.hub.dailyCounts.length, 7);
  assert.deepStrictEqual(report.hub.dailyCounts[0], { date: '2026-07-03', playCount: 3, uniqueUserCount: 2 });
  const june27 = report.hub.dailyCounts.find((day) => day.date === '2026-06-27');
  assert.deepStrictEqual(june27, { date: '2026-06-27', playCount: 1, uniqueUserCount: 1 });
  const emptyDays = report.hub.dailyCounts.filter((day) => day.playCount === 0);
  assert.strictEqual(emptyDays.length, 5);

  // 2. 게임별 집계: 정렬, 0P 비율, 제목 폴백
  assert.strictEqual(report.hub.perGame[0].gameId, 'card');
  assert.strictEqual(report.hub.perGame[0].playCount, 3);
  assert.strictEqual(report.hub.perGame[0].uniqueUserCount, 3);
  assert.strictEqual(report.hub.perGame[0].zeroRewardRate, 0);
  assert.strictEqual(report.hub.perGame[0].totalPoints, 13);
  const diceSummary = report.hub.perGame.find((game) => game.gameId === 'dice');
  assert.strictEqual(diceSummary.zeroRewardRate, 100);
  assert.strictEqual(diceSummary.title, '🎲 주사위 대결');
  const mysterySummary = report.hub.perGame.find((game) => game.gameId === 'mystery');
  assert.strictEqual(mysterySummary.title, 'mystery');
  assert.ok(!report.hub.perGame.some((game) => game.gameId === '')); // manual 거래 미포함

  // 3. 던전월드 섹션 연동
  assert.strictEqual(report.dungeonworld.totalPlayCount, 3);
  assert.strictEqual(report.dungeonworld.uniqueUserCount, 2);
  const session01 = report.dungeonworld.sessionCounts.find((session) => session.sessionId === 'session_01_black_bell');
  assert.strictEqual(session01.count, 2);

  // 4. KST 날짜 경계: relatedId 날짜 우선, 형식이 깨지면 createdAt(KST) 사용
  const boundaryReport = buildMinigameReport({
    pointsRepository: {
      listMinigameRewardTransactions: () => [
        // relatedId 날짜(오늘)와 createdAt(UTC 전날)이 다르면 relatedId를 따른다
        createMinigameTransaction({
          userId: 'user_x',
          date: '2026-07-03',
          gameId: 'card',
          amount: 5,
          createdAt: '2026-07-02T23:00:00.000Z',
        }),
        // relatedId가 날짜 형식이 아니면 createdAt의 KST 날짜를 쓴다 (UTC 07-02 15:30 = KST 07-03 00:30)
        {
          id: 'tx_no_date',
          userId: 'user_y',
          relatedType: 'minigameReward',
          relatedId: 'legacy_format',
          amount: 3,
          createdAt: '2026-07-02T15:30:00.000Z',
        },
      ],
    },
    dungeonworldRepository: null,
    now,
  });
  assert.deepStrictEqual(boundaryReport.hub.today, { playCount: 2, uniqueUserCount: 2, totalPoints: 8 });
  assert.strictEqual(boundaryReport.dungeonworld, null);

  // 5. embed: 핵심 라인 포함 + 길이 한도
  const embed = createMinigameReportEmbed(report);
  assert.strictEqual(embed.data.title, '🎮 미니게임 참여 리포트');
  const description = embed.data.description;
  assert.ok(description.length < 4096);
  assert.match(description, /기준 날짜\(KST\): 2026-07-03/);
  assert.match(description, /오늘: 확정 결과 3건 \/ 참여자 2명 \/ 지급 8P/);
  assert.match(description, /누적: 확정 결과 6건 \/ 참여자 3명 \/ 지급 25P/);
  assert.match(description, /🎴 행운 카드 뒤집기: 3건 \/ 3명 \/ 0P 비율 0% \/ 지급 13P/);
  assert.match(description, /🎲 주사위 대결: 1건 \/ 1명 \/ 0P 비율 100%/);
  assert.match(description, /누적 플레이 3건 \/ 참여자 2명/);
  assert.match(description, /평가가 아닌 운영 참고용/);

  // 6. 빈 데이터 안내
  const emptyEmbed = createMinigameReportEmbed(buildMinigameReport({
    pointsRepository: { listMinigameRewardTransactions: () => [] },
    dungeonworldRepository: { getPlayCount: () => 0, listRecentPlays: () => [] },
    now,
  }));
  assert.match(emptyEmbed.data.description, /아직 미니게임 참여 기록이 없어요/);

  // 7. /운영현황 종류:미니게임 분기 (임시 경로 + 모듈 리로드)
  const handlerTempDir = createTempDir('minigame-report-handler-');
  const previousEnv = {
    POINTS_DATA_PATH: process.env.POINTS_DATA_PATH,
    SHOP_ITEMS_DATA_PATH: process.env.SHOP_ITEMS_DATA_PATH,
    REDEMPTIONS_DATA_PATH: process.env.REDEMPTIONS_DATA_PATH,
    MISSIONS_DATA_PATH: process.env.MISSIONS_DATA_PATH,
    SUBMISSIONS_DATA_PATH: process.env.SUBMISSIONS_DATA_PATH,
    DUNGEONWORLD_LOG_PATH: process.env.DUNGEONWORLD_LOG_PATH,
    DUNGEONWORLD_CONFIG_PATH: process.env.DUNGEONWORLD_CONFIG_PATH,
  };

  try {
    writeJson(path.join(handlerTempDir, 'points.json'), {
      version: 1,
      isExample: false,
      users: [],
      pointTransactions: [
        createMinigameTransaction({ userId: 'handler_user', date: '2026-07-01', gameId: 'card', amount: 5 }),
      ],
    });
    writeJson(path.join(handlerTempDir, 'shop-items.json'), { version: 1, isExample: false, shopItems: [] });
    writeJson(path.join(handlerTempDir, 'redemptions.json'), { version: 1, isExample: false, redemptions: [] });
    writeJson(path.join(handlerTempDir, 'missions.json'), { version: 1, isExample: false, missions: [] });
    writeJson(path.join(handlerTempDir, 'submissions.json'), { version: 1, isExample: false, submissions: [] });

    process.env.POINTS_DATA_PATH = path.join(handlerTempDir, 'points.json');
    process.env.SHOP_ITEMS_DATA_PATH = path.join(handlerTempDir, 'shop-items.json');
    process.env.REDEMPTIONS_DATA_PATH = path.join(handlerTempDir, 'redemptions.json');
    process.env.MISSIONS_DATA_PATH = path.join(handlerTempDir, 'missions.json');
    process.env.SUBMISSIONS_DATA_PATH = path.join(handlerTempDir, 'submissions.json');
    process.env.DUNGEONWORLD_LOG_PATH = path.join(handlerTempDir, 'dungeonworld-logs.json');
    process.env.DUNGEONWORLD_CONFIG_PATH = path.join(handlerTempDir, 'dungeonworld-config.json');

    resetModule('../src/pointsRepository');
    resetModule('../src/dungeonworld');
    resetModule('../src/dungeonworldHandlers');
    resetModule('../src/minigameReport');
    resetModule('../src/minigames');
    resetModule('../src/minigameInteractions');
    resetModule('../src/components');
    resetModule('../src/handlers');

    const { handleInteractionCreate } = require('../src/handlers');
    const interaction = createOperatorInteraction('운영현황', { 종류: 'minigames' });
    await handleInteractionCreate(interaction);

    assert.strictEqual(interaction.replyPayload.ephemeral, true);
    assert.strictEqual(interaction.replyPayload.embeds[0].data.title, '🎮 미니게임 참여 리포트');
    assert.match(interaction.replyPayload.embeds[0].data.description, /🎴 행운 카드 뒤집기: 1건/);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  console.log('minigame report smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

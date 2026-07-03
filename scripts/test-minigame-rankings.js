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

function createMinigameTransaction({ id, userId, date, gameId, amount, createdAt, relatedId }) {
  return {
    id: id || `tx_${userId}_${date || 'legacy'}_${gameId || 'unknown'}_${amount}`,
    userId,
    type: amount > 0 ? 'earn' : 'adjust',
    amount,
    balanceAfter: 100,
    reason: `미니게임 보상: ${gameId || 'legacy'}`,
    relatedType: 'minigameReward',
    relatedId: relatedId || `${date}:${gameId}`,
    createdBy: userId,
    createdAt: createdAt || `${date}T10:00:00.000Z`,
    note: null,
  };
}

function createFixtureRepository() {
  const tempDir = createTempDir('minigame-rankings-');
  const pointsPath = path.join(tempDir, 'points.json');

  writeJson(pointsPath, {
    version: 1,
    isExample: false,
    users: [
      { userId: 'cap_user', displayName: '상한 사용자' },
      { userId: 'steady_user', displayName: '꾸준한 사용자' },
      { userId: 'tie_more_plays', displayName: '동점 다회 사용자' },
      { userId: 'tie_fewer_plays', displayName: '동점 소회 사용자' },
      { userId: 'name_a', displayName: '가나 사용자' },
      { userId: 'name_b', displayName: '다라 사용자' },
      { userId: 'zero_user', displayName: '0P 사용자' },
    ],
    pointTransactions: [
      createMinigameTransaction({ userId: 'cap_user', date: '2026-07-03', gameId: 'card', amount: 10 }),
      createMinigameTransaction({ userId: 'cap_user', date: '2026-07-03', gameId: 'dice', amount: 10 }),
      createMinigameTransaction({ userId: 'cap_user', date: '2026-07-03', gameId: 'door', amount: 10 }),
      createMinigameTransaction({ userId: 'cap_user', date: '2026-07-03', gameId: 'number', amount: 10 }),
      createMinigameTransaction({ userId: 'steady_user', date: '2026-07-03', gameId: 'card', amount: 30 }),
      createMinigameTransaction({ userId: 'steady_user', date: '2026-06-30', gameId: 'dice', amount: 20 }),
      createMinigameTransaction({ userId: 'steady_user', date: '2026-06-25', gameId: 'door', amount: 50 }),
      createMinigameTransaction({ userId: 'tie_more_plays', date: '2026-07-03', gameId: 'card', amount: 10 }),
      createMinigameTransaction({ userId: 'tie_more_plays', date: '2026-07-03', gameId: 'dice', amount: 10 }),
      createMinigameTransaction({ userId: 'tie_fewer_plays', date: '2026-07-03', gameId: 'door', amount: 20 }),
      createMinigameTransaction({ userId: 'name_b', date: '2026-07-03', gameId: 'card', amount: 5 }),
      createMinigameTransaction({ userId: 'name_a', date: '2026-07-03', gameId: 'dice', amount: 5 }),
      createMinigameTransaction({ userId: 'fallback_user', date: '2026-07-03', gameId: 'memory', amount: 4 }),
      createMinigameTransaction({ userId: 'zero_user', date: '2026-07-03', gameId: 'initial', amount: 0 }),
      createMinigameTransaction({ userId: 'example_user', date: '2026-07-03', gameId: 'card', amount: 100 }),
      {
        id: 'tx_manual',
        userId: 'manual_user',
        type: 'earn',
        amount: 100,
        balanceAfter: 100,
        reason: '수동 지급',
        relatedType: 'manual',
        relatedId: null,
        createdBy: 'operator',
        createdAt: '2026-07-03T10:00:00.000Z',
        note: null,
      },
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

async function main() {
  const {
    getMinigamePlayDate,
  } = require('../src/pointsRepository');
  const {
    createMinigameRankingPayload,
  } = require('../src/minigamePayloads');

  const pointsRepository = createFixtureRepository();
  const rankings = pointsRepository.listMinigameRankings({
    now: new Date('2026-07-03T12:00:00.000Z'),
    limit: 5,
  });

  assert.strictEqual(rankings.generatedDateKst, '2026-07-03');
  assert.deepStrictEqual(
    rankings.today.map((entry) => [entry.userId, entry.earnedPoints, entry.playCount]),
    [
      ['cap_user', 40, 4],
      ['steady_user', 30, 1],
      ['tie_more_plays', 20, 2],
      ['tie_fewer_plays', 20, 1],
      ['name_a', 5, 1],
    ]
  );
  assert.deepStrictEqual(
    rankings.recent7Days.map((entry) => [entry.userId, entry.earnedPoints, entry.playCount]),
    [
      ['steady_user', 50, 2],
      ['cap_user', 40, 4],
      ['tie_more_plays', 20, 2],
      ['tie_fewer_plays', 20, 1],
      ['name_a', 5, 1],
    ]
  );
  assert.deepStrictEqual(
    rankings.total.map((entry) => [entry.userId, entry.earnedPoints, entry.playCount]),
    [
      ['steady_user', 100, 3],
      ['cap_user', 40, 4],
      ['tie_more_plays', 20, 2],
      ['tie_fewer_plays', 20, 1],
      ['name_a', 5, 1],
    ]
  );
  assert.ok(!rankings.today.some((entry) => entry.userId === 'zero_user'));
  assert.ok(!rankings.today.some((entry) => entry.userId === 'example_user'));
  assert.ok(!rankings.today.some((entry) => entry.userId === 'manual_user'));

  const fallbackRankings = pointsRepository.listMinigameRankings({
    now: new Date('2026-07-03T12:00:00.000Z'),
    limit: 8,
  });
  const fallbackEntry = fallbackRankings.today.find((entry) => entry.userId === 'fallback_user');
  assert.strictEqual(fallbackEntry.displayName, 'fallback_user');

  const todayRanking = pointsRepository.listTodayMinigameRanking('2026-07-03', 3);
  assert.deepStrictEqual(
    todayRanking.map((entry) => [entry.userId, entry.earnedPoints]),
    [
      ['cap_user', 40],
      ['steady_user', 30],
      ['tie_more_plays', 20],
    ]
  );

  assert.strictEqual(getMinigamePlayDate(createMinigameTransaction({
    userId: 'date_priority_user',
    date: '2026-07-03',
    gameId: 'card',
    amount: 5,
    createdAt: '2026-07-01T10:00:00.000Z',
  })), '2026-07-03');
  assert.strictEqual(getMinigamePlayDate(createMinigameTransaction({
    userId: 'legacy_user',
    gameId: 'legacy',
    amount: 5,
    relatedId: 'legacy_format',
    createdAt: '2026-07-02T15:30:00.000Z',
  })), '2026-07-03');

  const payload = createMinigameRankingPayload(rankings);
  assert.strictEqual(payload.ephemeral, true);
  assert.strictEqual(payload.embeds[0].data.title, '🏆 미니게임 랭킹');
  assert.ok(payload.embeds[0].data.description.length < 4096);
  assert.match(payload.embeds[0].data.description, /오늘 \(2026-07-03\)/);
  assert.match(payload.embeds[0].data.description, /최근 7일/);
  assert.match(payload.embeds[0].data.description, /누적/);
  assert.match(payload.embeds[0].data.description, /3\. 동점 다회 사용자 - 20P \(2회\)/);
  assert.match(payload.embeds[0].data.description, /3\. 동점 소회 사용자 - 20P \(1회\)/);
  assert.match(payload.embeds[0].data.description, /꾸준한 참여 기록/);
  assert.match(payload.embeds[0].data.description, /포인트 베팅이나 차감은 없어요/);

  const emptyPayload = createMinigameRankingPayload({
    today: [],
    recent7Days: [],
    total: [],
    generatedDateKst: '2026-07-03',
  });
  assert.strictEqual(emptyPayload.ephemeral, true);
  assert.match(emptyPayload.embeds[0].data.description, /아직 미니게임 랭킹 데이터가 없어요/);

  console.log('minigame rankings smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

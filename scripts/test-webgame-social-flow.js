const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createWebgameRepository,
  getDailySeed,
  getDayKey,
  getIsoWeekKey,
} = require('../src/webgameRepository');

function createTempRepository() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webgame-social-flow-'));
  return {
    tempDir,
    paths: {
      links: path.join(tempDir, 'webgame-links.local.json'),
      scores: path.join(tempDir, 'webgame-scores.local.json'),
      social: path.join(tempDir, 'webgame-social.local.json'),
    },
  };
}

function linkUser(repository, discordId, displayName, now) {
  const issued = repository.issueLinkCode({ discordId, displayName }, now);
  const redeemed = repository.redeemLinkCode(issued.code, now);
  assert.strictEqual(redeemed.ok, true);
  return redeemed;
}

function main() {
  const { tempDir, paths } = createTempRepository();
  const repository = createWebgameRepository(paths);
  const now = new Date('2026-07-04T12:00:00Z');
  const dayKey = getDayKey(now);
  const weekKey = getIsoWeekKey(now);
  const previousWeekKey = getIsoWeekKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));

  try {
    assert.strictEqual(getDayKey(new Date('2026-07-04T14:59:59Z')), '2026-07-04');
    assert.strictEqual(getDayKey(new Date('2026-07-04T15:00:00Z')), '2026-07-05');
    assert.strictEqual(getDailySeed('2026-07-04'), 20260704);

    linkUser(repository, 'user_a', '참여자A', now);
    linkUser(repository, 'user_b', '참여자B', now);
    linkUser(repository, 'user_c', '참여자C', now);

    repository.recordScore({
      discordId: 'user_a',
      gameId: 'match3',
      score: 1000,
      seed: String(getDailySeed(dayKey)),
      mode: 'daily',
      dayKey,
    }, now);
    repository.recordScore({
      discordId: 'user_a',
      gameId: 'match3',
      score: 1800,
      seed: String(getDailySeed(dayKey)),
      mode: 'daily',
      dayKey,
    }, now);
    repository.recordScore({
      discordId: 'user_b',
      gameId: 'match3',
      score: 1400,
      seed: String(getDailySeed(dayKey)),
      mode: 'daily',
      dayKey,
    }, now);
    repository.recordScore({
      discordId: 'user_c',
      gameId: 'match3',
      score: 9999,
      seed: String(getDailySeed(dayKey)),
      mode: 'daily',
      dayKey,
      flagged: true,
    }, now);

    const dailyRanking = repository.listDailyRanking('match3', dayKey, { limit: 10, includeTargetId: true });
    assert.strictEqual(dailyRanking.length, 2, 'daily 랭킹은 사용자별 최고·flagged 제외로 산출되어야 합니다.');
    assert.strictEqual(dailyRanking[0].displayName, '참여자A');
    assert.strictEqual(dailyRanking[0].score, 1800);
    assert.match(dailyRanking[0].targetId, /^[0-9a-f]{16}$/);
    assert.strictEqual(repository.countDailyParticipants('match3', dayKey), 2);
    assert.deepStrictEqual(repository.getMyDailyRank('match3', dayKey, 'user_b'), { rank: 2, score: 1400 });
    assert.strictEqual(repository.getDailyBest('user_a', 'match3', dayKey).score, 1800);

    repository.recordScore({ discordId: 'user_a', gameId: 'idle', score: 1000, weekKey: previousWeekKey }, now);
    repository.recordScore({ discordId: 'user_a', gameId: 'idle', score: 1600, weekKey }, now);
    repository.recordScore({ discordId: 'user_b', gameId: 'idle', score: 500, weekKey }, now);
    repository.recordScore({ discordId: 'user_b', gameId: 'idle', score: 900, weekKey }, now);
    repository.recordScore({ discordId: 'user_c', gameId: 'idle', score: 700, weekKey }, now);
    repository.recordScore({ discordId: 'user_d', gameId: 'idle', score: 2000, weekKey: previousWeekKey }, now);
    repository.recordScore({ discordId: 'user_d', gameId: 'idle', score: 1500, weekKey }, now);
    repository.recordScore({ discordId: 'user_e', gameId: 'idle', score: 999999, weekKey, flagged: true }, now);

    const goal = repository.getCommunalGoalProgress(weekKey);
    assert.strictEqual(goal.participants, 4);
    assert.strictEqual(goal.contributions.get('user_a'), 600);
    assert.strictEqual(goal.contributions.get('user_b'), 400);
    assert.strictEqual(goal.contributions.get('user_c'), 0);
    assert.strictEqual(goal.contributions.get('user_d'), 0);
    assert.strictEqual(goal.total, 1000);

    const targetId = repository.getTargetId('user_b');
    assert.strictEqual(repository.resolveTargetId(targetId).discordId, 'user_b');
    const firstCheer = repository.addCheer({
      fromDiscordId: 'user_a',
      targetDiscordId: 'user_b',
      gameId: 'match3',
      periodKey: dayKey,
    }, now);
    assert.strictEqual(firstCheer.ok, true);
    const duplicateCheer = repository.addCheer({
      fromDiscordId: 'user_a',
      targetDiscordId: 'user_b',
      gameId: 'match3',
      periodKey: dayKey,
    }, now);
    assert.strictEqual(duplicateCheer.ok, false);
    assert.strictEqual(duplicateCheer.reason, 'ALREADY_CHEERED');
    assert.strictEqual(repository.countCheers('match3', dayKey).get('user_b'), 1);
    assert.strictEqual(repository.countCheersSentToday('user_a', dayKey), 1);

    const reloadedRepository = createWebgameRepository(paths);
    assert.strictEqual(reloadedRepository.getTargetId('user_b'), targetId, 'cheerSalt는 재로드 후에도 고정이어야 합니다.');

    const scoresData = JSON.parse(fs.readFileSync(paths.scores, 'utf8'));
    scoresData.scores.push({
      discordId: 'user_c',
      gameId: 'deck',
      score: 7000,
      seed: 'legacy-seed',
      submittedAt: now.toISOString(),
      weekKey,
      flagged: false,
    });
    scoresData.scores.push({
      discordId: 'user_b',
      gameId: 'deck',
      score: 8000,
      seed: 'new-seed',
      submittedAt: now.toISOString(),
      weekKey,
      flagged: false,
      mode: 'daily',
      dayKey,
    });
    fs.writeFileSync(paths.scores, JSON.stringify(scoresData, null, 2));

    const mixedRanking = reloadedRepository.listWeeklyRanking('deck', weekKey, { limit: 10 });
    assert.strictEqual(mixedRanking.length, 2);
    assert.strictEqual(mixedRanking[0].score, 8000);
    assert.strictEqual(mixedRanking[1].score, 7000);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('webgame 비동기 소셜 저장소 흐름 테스트를 통과했습니다.');
}

main();

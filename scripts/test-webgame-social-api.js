const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createWebgameRepository, getDailySeed, getDayKey, getIsoWeekKey } = require('../src/webgameRepository');
const { createWebgameApi, getMatch3VariantForDayKey, getDeckVariantForDayKey } = require('../src/webgameApi');
const { createAdminRequestHandler } = require('../src/adminServer');
const { createPointsRepository } = require('../src/pointsRepository');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function requestJson(baseUrl, requestPath, options = {}) {
  return fetch(`${baseUrl}${requestPath}`, options).then(async (response) => {
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = null;
      }
    }
    return { status: response.status, data };
  });
}

function requestRaw(baseUrl, requestPath, options = {}) {
  return fetch(`${baseUrl}${requestPath}`, options).then(async (response) => {
    const text = await response.text();
    return { status: response.status, text };
  });
}

function createPointsRepo(tempDir) {
  return createPointsRepository({
    points: path.join(tempDir, 'points.local.json'),
    pointsFallback: path.join(__dirname, '..', 'data', 'points.example.json'),
    shopItems: path.join(tempDir, 'shop-items.local.json'),
    shopItemsFallback: path.join(__dirname, '..', 'data', 'shop-items.example.json'),
    redemptions: path.join(tempDir, 'redemptions.local.json'),
    redemptionsFallback: path.join(__dirname, '..', 'data', 'redemptions.example.json'),
    missions: path.join(tempDir, 'missions.local.json'),
    missionsFallback: path.join(__dirname, '..', 'data', 'missions.example.json'),
    submissions: path.join(tempDir, 'submissions.local.json'),
    submissionsFallback: path.join(__dirname, '..', 'data', 'submissions.example.json'),
  });
}

async function linkUser(baseUrl, repository, discordId, displayName, now) {
  const issued = repository.issueLinkCode({ discordId, displayName }, now);
  const linked = await requestJson(baseUrl, '/game/api/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: issued.code }),
  });
  assert.strictEqual(linked.status, 200);
  return linked.data.playerToken;
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webgame-social-api-'));
  const previousGoalEnv = process.env.WEBGAME_COMMUNAL_GOAL;
  process.env.WEBGAME_COMMUNAL_GOAL = '1000';

  const nowDate = new Date('2026-07-04T12:00:00Z');
  const fixedNow = () => nowDate;
  const repository = createWebgameRepository({
    links: path.join(tempDir, 'webgame-links.local.json'),
    scores: path.join(tempDir, 'webgame-scores.local.json'),
    social: path.join(tempDir, 'webgame-social.local.json'),
  });
  const webgameApi = createWebgameApi({ repository, now: fixedNow });
  const handler = createAdminRequestHandler(createPointsRepo(tempDir), webgameApi);
  const server = await startServer(handler);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const dayKey = getDayKey(nowDate);
  const weekKey = getIsoWeekKey(nowDate);
  const todaySeed = String(getDailySeed(dayKey));

  try {
    const tokenA = await linkUser(baseUrl, repository, 'api_user_a', 'API A', nowDate);
    const tokenB = await linkUser(baseUrl, repository, 'api_user_b', 'API B', nowDate);
    const tokenC = await linkUser(baseUrl, repository, 'api_user_c', 'API C', nowDate);

    const emptyDaily = await requestJson(baseUrl, '/game/api/daily?gameId=match3', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(emptyDaily.status, 200);
    assert.strictEqual(emptyDaily.data.dayKey, dayKey);
    assert.strictEqual(emptyDaily.data.seed, Number(todaySeed));
    assert.strictEqual(emptyDaily.data.participants, 0);
    assert.strictEqual(emptyDaily.data.myBest, null);

    const idleDaily = await requestJson(baseUrl, '/game/api/daily?gameId=idle');
    assert.strictEqual(idleDaily.status, 400);
    assert.strictEqual(idleDaily.data.error, 'NOT_DAILY');

    // 검은 종 생존전: rankable:true지만 dailyCapable:false(idle은 rankable:false라 다른
    // 케이스) - 실시간 입력 의존 장르라 오늘의 도전 비대상(docs/survivors-improvement-plan.md
    // 0·6절). /daily는 idle과 동일하게 NOT_DAILY, /score에 challenge:'daily'를 실어도
    // 거부되어야 한다.
    const survivorsDaily = await requestJson(baseUrl, '/game/api/daily?gameId=survivors');
    assert.strictEqual(survivorsDaily.status, 400);
    assert.strictEqual(survivorsDaily.data.error, 'NOT_DAILY');

    // 이후 tokenA는 원래 테스트가 분당 제출 한도(RATE_LIMIT_PER_MINUTE)를 정확히 맞춰
    // 쓰므로, survivors 전용 검증은 tokenC로 분리해 간섭하지 않는다.
    const survivorsDailyScore = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenC, gameId: 'survivors', score: 5000, challenge: 'daily' }),
    });
    assert.strictEqual(survivorsDailyScore.status, 400);
    assert.strictEqual(survivorsDailyScore.data.error, 'NOT_DAILY');

    // 랭킹 대상(rankable:true)이므로 일반(퀵 런) 제출은 정상 동작해야 한다.
    const survivorsWeeklyScore = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenC, gameId: 'survivors', score: 5000 }),
    });
    assert.strictEqual(survivorsWeeklyScore.status, 200);
    assert.strictEqual(survivorsWeeklyScore.data.accepted, true);
    // 리플레이 검증 대상 외 게임(idle/word/survivors) - replayLog 미첨부 제출은 서버가
    // skipped로 기록해야 한다(missing이 아님 - docs/replay-verification-plan.md 0.1절).
    assert.strictEqual(survivorsWeeklyScore.data.replay, 'skipped');

    const survivorsScoreCap = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenC, gameId: 'survivors', score: 999999 }),
    });
    assert.strictEqual(survivorsScoreCap.status, 400);
    assert.strictEqual(survivorsScoreCap.data.error, 'SCORE_OUT_OF_RANGE');

    const dailyScoreA = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, gameId: 'match3', score: 1500, seed: todaySeed, challenge: 'daily' }),
    });
    assert.strictEqual(dailyScoreA.status, 200);
    assert.strictEqual(dailyScoreA.data.mode, 'daily');
    assert.strictEqual(dailyScoreA.data.dayKey, dayKey);
    assert.strictEqual(dailyScoreA.data.dayBest, 1500);

    const dailyScoreB = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenB, gameId: 'match3', score: 1800, seed: todaySeed, challenge: 'daily' }),
    });
    assert.strictEqual(dailyScoreB.status, 200);

    // 자정 걸침 유예: 어제 시드는 어제 dayKey의 daily로 인정된다.
    const yesterdayKey = getDayKey(new Date(nowDate.getTime() - 24 * 60 * 60 * 1000));
    const graceScore = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenC,
        gameId: 'match3',
        score: 1100,
        seed: String(getDailySeed(yesterdayKey)),
        challenge: 'daily',
      }),
    });
    assert.strictEqual(graceScore.status, 200);
    assert.strictEqual(graceScore.data.mode, 'daily');
    assert.strictEqual(graceScore.data.dayKey, yesterdayKey);

    const downgraded = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, gameId: 'match3', score: 1200, seed: '19990101', challenge: 'daily' }),
    });
    assert.strictEqual(downgraded.status, 200);
    assert.strictEqual(downgraded.data.mode, 'free');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(downgraded.data, 'dayKey'), false);

    const legacyScore = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, gameId: 'match3', score: 1600, seed: 'free-seed' }),
    });
    assert.strictEqual(legacyScore.status, 200);
    assert.strictEqual(legacyScore.data.accepted, true);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(legacyScore.data, 'mode'), false);

    const daily = await requestJson(baseUrl, '/game/api/daily?gameId=match3', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(daily.status, 200);
    assert.strictEqual(daily.data.participants, 2);
    assert.strictEqual(daily.data.ranking[0].displayName, 'API B');
    assert.match(daily.data.ranking[0].targetId, /^[0-9a-f]{16}$/);
    assert.strictEqual(daily.data.ranking[0].cheers, 0);
    assert.strictEqual(daily.data.ranking[1].isMe, true);
    assert.strictEqual(daily.data.myBest, 1500);
    assert.strictEqual(daily.data.myRank.rank, 2);
    // 요일 변형(docs/match3-improvement-plan.md 2절): match3 /daily 응답에는
    // variant가 실려야 하고, 서버 결정 로직(getMatch3VariantForDayKey)과 일치해야 한다.
    assert.deepStrictEqual(daily.data.variant, getMatch3VariantForDayKey(dayKey));
    assert.strictEqual(typeof daily.data.variant.id, 'string');
    assert.strictEqual(typeof daily.data.variant.movesLimit, 'number');

    // idle은 오늘의 도전 자체가 없는 게임이라 /daily가 애초에 NOT_DAILY로 거부된다
    // (variant는 match3·deck처럼 dailyCapable한 게임에만 해당하는 필드).
    const idleDailyForVariantCheck = await requestJson(baseUrl, '/game/api/daily?gameId=idle', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(idleDailyForVariantCheck.status, 400);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(idleDailyForVariantCheck.data, 'variant'), false);

    // 덱 오늘의 도전 요일 프리셋(docs/deck-improvement-plan.md 5절): /daily?gameId=deck
    // 응답에는 variant.deckPreset이 실려야 하고, 서버 결정 로직과 일치해야 한다.
    const deckDaily = await requestJson(baseUrl, '/game/api/daily?gameId=deck', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(deckDaily.status, 200);
    assert.deepStrictEqual(deckDaily.data.variant, getDeckVariantForDayKey(dayKey));
    assert.strictEqual(typeof deckDaily.data.variant.deckPreset, 'string');
    assert.ok(
      ['balanced', 'aggro', 'guard', 'free'].includes(deckDaily.data.variant.deckPreset),
      'deckPreset은 알려진 프리셋 중 하나여야 함'
    );

    const targetB = daily.data.ranking[0].targetId;
    const selfTargetA = daily.data.ranking[1].targetId;

    const rankings = await requestJson(baseUrl, '/game/api/rankings?gameId=match3', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(rankings.status, 200);
    assert.match(rankings.data.ranking[0].targetId, /^[0-9a-f]{16}$/);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(rankings.data.ranking[0], 'discordId'), false);
    assert.strictEqual(typeof rankings.data.ranking[0].isMe, 'boolean');

    const cheer = await requestJson(baseUrl, '/game/api/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, gameId: 'match3', periodKey: dayKey, targetId: targetB }),
    });
    assert.strictEqual(cheer.status, 200);
    assert.strictEqual(cheer.data.ok, true);
    assert.strictEqual(cheer.data.cheers, 1);

    const duplicateCheer = await requestJson(baseUrl, '/game/api/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, gameId: 'match3', periodKey: dayKey, targetId: targetB }),
    });
    assert.strictEqual(duplicateCheer.status, 200);
    assert.strictEqual(duplicateCheer.data.alreadyCheered, true);
    assert.strictEqual(duplicateCheer.data.cheers, 1);

    const selfCheer = await requestJson(baseUrl, '/game/api/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, gameId: 'match3', periodKey: dayKey, targetId: selfTargetA }),
    });
    assert.strictEqual(selfCheer.status, 400);
    assert.strictEqual(selfCheer.data.error, 'CANNOT_CHEER_SELF');

    const invalidPeriod = await requestJson(baseUrl, '/game/api/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, gameId: 'match3', periodKey: '2020-01-01', targetId: targetB }),
    });
    assert.strictEqual(invalidPeriod.status, 400);
    assert.strictEqual(invalidPeriod.data.error, 'INVALID_PERIOD');

    const noToken = await requestJson(baseUrl, '/game/api/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: 'match3', periodKey: dayKey, targetId: targetB }),
    });
    assert.strictEqual(noToken.status, 401);

    for (let index = 0; index < 29; index += 1) {
      repository.addCheer({
        fromDiscordId: 'api_user_a',
        targetDiscordId: `bulk_target_${index}`,
        gameId: 'deck',
        periodKey: weekKey,
      }, nowDate);
    }
    const dayLimited = await requestJson(baseUrl, '/game/api/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, gameId: 'match3', periodKey: dayKey, targetId: targetB }),
    });
    assert.strictEqual(dayLimited.status, 429);

    repository.recordScore({ discordId: 'api_user_a', gameId: 'idle', score: 1000, weekKey: '2026-W26' }, nowDate);
    repository.recordScore({ discordId: 'api_user_a', gameId: 'idle', score: 1600, weekKey }, nowDate);
    repository.recordScore({ discordId: 'api_user_b', gameId: 'idle', score: 500, weekKey }, nowDate);
    repository.recordScore({ discordId: 'api_user_b', gameId: 'idle', score: 900, weekKey }, nowDate);

    const goal = await requestJson(baseUrl, '/game/api/goal', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(goal.status, 200);
    assert.strictEqual(goal.data.goal, 1000);
    assert.strictEqual(goal.data.total, 1000);
    assert.strictEqual(goal.data.participants, 2);
    assert.strictEqual(goal.data.achieved, true);
    assert.strictEqual(goal.data.myContribution, 600);

    const goalAnonymous = await requestJson(baseUrl, '/game/api/goal');
    assert.strictEqual(goalAnonymous.status, 200);
    assert.strictEqual(goalAnonymous.data.myContribution, null);

    // 이벤트 배수 미설정 시 event는 null이어야 한다.
    assert.strictEqual(goal.data.event, null);
    assert.strictEqual(goalAnonymous.data.event, null);

    // 이벤트 배수 설정 시 event 필드가 응답에 실려야 한다(docs/idle-improvement-plan.md 1.2절).
    const previousEventMultiplierEnv = process.env.WEBGAME_IDLE_EVENT_MULTIPLIER;
    const previousEventLabelEnv = process.env.WEBGAME_IDLE_EVENT_LABEL;
    try {
      process.env.WEBGAME_IDLE_EVENT_MULTIPLIER = '2';
      const goalWithEvent = await requestJson(baseUrl, '/game/api/goal');
      assert.strictEqual(goalWithEvent.status, 200);
      assert.deepStrictEqual(goalWithEvent.data.event, { multiplier: 2, label: '이벤트 주간' });

      process.env.WEBGAME_IDLE_EVENT_LABEL = '여름 감사제';
      const goalWithCustomLabel = await requestJson(baseUrl, '/game/api/goal');
      assert.deepStrictEqual(goalWithCustomLabel.data.event, { multiplier: 2, label: '여름 감사제' });

      // 허용되지 않은 배수는 무효로 취급해 event: null이어야 한다.
      process.env.WEBGAME_IDLE_EVENT_MULTIPLIER = '5';
      const goalWithInvalidMultiplier = await requestJson(baseUrl, '/game/api/goal');
      assert.strictEqual(goalWithInvalidMultiplier.data.event, null);
    } finally {
      if (previousEventMultiplierEnv === undefined) {
        delete process.env.WEBGAME_IDLE_EVENT_MULTIPLIER;
      } else {
        process.env.WEBGAME_IDLE_EVENT_MULTIPLIER = previousEventMultiplierEnv;
      }
      if (previousEventLabelEnv === undefined) {
        delete process.env.WEBGAME_IDLE_EVENT_LABEL;
      } else {
        process.env.WEBGAME_IDLE_EVENT_LABEL = previousEventLabelEnv;
      }
    }

    const invalidJson = await requestRaw(baseUrl, '/game/api/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid',
    });
    assert.strictEqual(invalidJson.status, 400);

    const tooLarge = await requestRaw(baseUrl, '/game/api/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenA, gameId: 'match3', periodKey: dayKey, targetId: targetB, pad: 'x'.repeat(5000) }),
    });
    assert.strictEqual(tooLarge.status, 400);
  } finally {
    await stopServer(server);
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (previousGoalEnv === undefined) {
      delete process.env.WEBGAME_COMMUNAL_GOAL;
    } else {
      process.env.WEBGAME_COMMUNAL_GOAL = previousGoalEnv;
    }
  }

  console.log('webgame 비동기 소셜 API 테스트를 통과했습니다.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

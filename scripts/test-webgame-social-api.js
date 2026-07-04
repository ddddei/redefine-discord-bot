const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createWebgameRepository, getDailySeed, getDayKey, getIsoWeekKey } = require('../src/webgameRepository');
const { createWebgameApi } = require('../src/webgameApi');
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

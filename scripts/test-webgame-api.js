const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createWebgameRepository } = require('../src/webgameRepository');
const { createWebgameApi, RATE_LIMIT_PER_MINUTE } = require('../src/webgameApi');
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

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webgame-api-'));
  const repository = createWebgameRepository({
    links: path.join(tempDir, 'webgame-links.local.json'),
    scores: path.join(tempDir, 'webgame-scores.local.json'),
  });
  const fixedNow = () => new Date('2026-07-06T00:00:00Z');
  const webgameApi = createWebgameApi({ repository, now: fixedNow });
  const pointsRepository = createPointsRepository({
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

  const handler = createAdminRequestHandler(pointsRepository, webgameApi);
  const server = await startServer(handler);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. 코드 미발급 상태 -> 404
    const notFound = await requestJson(baseUrl, '/game/api/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '000000' }),
    });
    assert.strictEqual(notFound.status, 404);

    // 2. 코드 발급 -> link 왕복 -> playerToken 발급
    const issued = repository.issueLinkCode({ discordId: 'api_user_1', displayName: 'API참여자1' }, fixedNow());
    const linkResult = await requestJson(baseUrl, '/game/api/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: issued.code }),
    });
    assert.strictEqual(linkResult.status, 200);
    assert.ok(linkResult.data.playerToken);
    assert.strictEqual(linkResult.data.displayName, 'API참여자1');
    const token = linkResult.data.playerToken;

    // 3. 잘못된 JSON -> 400
    const invalidJson = await requestRaw(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not valid json',
    });
    assert.strictEqual(invalidJson.status, 400);

    // 4. 본문 상한(4KB) 초과 -> 400
    const oversizedBody = JSON.stringify({
      token,
      gameId: 'match3',
      score: 100,
      seed: 'x'.repeat(5000),
    });
    const tooLarge = await requestRaw(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversizedBody,
    });
    assert.strictEqual(tooLarge.status, 400);

    // 5. 정상 점수 제출 -> 기록/조회 왕복
    const scoreResult = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, gameId: 'match3', score: 2000, seed: 'seed-1' }),
    });
    assert.strictEqual(scoreResult.status, 200);
    assert.strictEqual(scoreResult.data.accepted, true);
    assert.strictEqual(scoreResult.data.flagged, false);
    assert.strictEqual(scoreResult.data.weekBest, 2000);

    // 6. 점수 상한 초과 -> 400
    const outOfRange = await requestJson(baseUrl, '/game/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, gameId: 'match3', score: 999999999, seed: 'seed-2' }),
    });
    assert.strictEqual(outOfRange.status, 400);
    assert.strictEqual(outOfRange.data.error, 'SCORE_OUT_OF_RANGE');

    // 7. 빈도 제한(분당 RATE_LIMIT_PER_MINUTE회) -> 429
    let rateLimited = false;
    for (let i = 0; i < RATE_LIMIT_PER_MINUTE + 2; i += 1) {
      const attempt = await requestJson(baseUrl, '/game/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, gameId: 'match3', score: 100 + i, seed: `seed-rate-${i}` }),
      });
      if (attempt.status === 429) {
        rateLimited = true;
        break;
      }
    }
    assert.strictEqual(rateLimited, true, '빈도 제한 초과 시 429가 반환되어야 합니다.');

    // 8. 랭킹 조회 (내 순위 포함)
    const rankings = await requestJson(baseUrl, `/game/api/rankings?gameId=match3`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(rankings.status, 200);
    assert.ok(Array.isArray(rankings.data.ranking));
    assert.ok(rankings.data.myRank);
    assert.strictEqual(rankings.data.myRank.score, 2000);

    // 9. /game/api/me
    const me = await requestJson(baseUrl, '/game/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.data.displayName, 'API참여자1');

    // 10. 잘못된 토큰 -> 401
    const invalidToken = await requestJson(baseUrl, '/game/api/me', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    assert.strictEqual(invalidToken.status, 401);

    // 11. 알 수 없는 게임 -> 400
    const unknownGame = await requestJson(baseUrl, '/game/api/rankings?gameId=unknown');
    assert.strictEqual(unknownGame.status, 400);
  } finally {
    await stopServer(server);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('webgame API 스모크 테스트를 통과했습니다.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createAdminRequestHandler } = require('../src/adminServer');
const { createPointsRepository } = require('../src/pointsRepository');
const {
  createWebgameRepository,
  getDailySeed,
  getDayKey,
} = require('../src/webgameRepository');
const {
  createWebgameApi,
  WORD_GUESS_RATE_LIMIT_PER_MINUTE,
} = require('../src/webgameApi');
const WordLogic = require('../public/word/logic');
const wordPool = require('../data/word-pool.json');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TEST_SALT = 'word-api-test-salt';

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function requestRaw(baseUrl, requestPath, options = {}) {
  return fetch(`${baseUrl}${requestPath}`, options).then(async (response) => {
    const text = await response.text();
    return { status: response.status, text };
  });
}

async function requestJson(baseUrl, requestPath, options = {}) {
  const raw = await requestRaw(baseUrl, requestPath, options);
  return {
    status: raw.status,
    text: raw.text,
    data: raw.text ? JSON.parse(raw.text) : null,
  };
}

function postJson(baseUrl, requestPath, body, headers = {}) {
  return requestJson(baseUrl, requestPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function selectAnswer(dayKey) {
  const digest = crypto.createHash('sha256').update(`${TEST_SALT}:${dayKey}`).digest('hex');
  const index = Number(BigInt(`0x${digest}`) % BigInt(wordPool.answers.length));
  return wordPool.answers[index];
}

function assertNoAnswer(label, text, answer) {
  assert.strictEqual(text.includes(answer), false, `${label} must not expose the answer`);
}

async function linkPlayer(baseUrl, repository, input, now) {
  const issued = repository.issueLinkCode(input, now);
  const linked = await postJson(baseUrl, '/game/api/link', { code: issued.code });
  assert.strictEqual(linked.status, 200);
  assert.ok(linked.data.playerToken);
  return linked.data.playerToken;
}

async function main() {
  const previousSalt = process.env.WEBGAME_WORD_SALT;
  process.env.WEBGAME_WORD_SALT = TEST_SALT;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-api-'));
  const repository = createWebgameRepository({
    links: path.join(tempDir, 'webgame-links.local.json'),
    scores: path.join(tempDir, 'webgame-scores.local.json'),
    social: path.join(tempDir, 'webgame-social.local.json'),
  });
  const fixedNow = () => new Date('2026-07-05T03:00:00Z');
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
  const server = await startServer(createAdminRequestHandler(pointsRepository, webgameApi));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const dayKey = getDayKey(fixedNow());
  const yesterdayKey = getDayKey(new Date(fixedNow().getTime() - ONE_DAY_MS));
  const twoDaysAgoKey = getDayKey(new Date(fixedNow().getTime() - (2 * ONE_DAY_MS)));
  const answer = selectAnswer(dayKey);
  const wrongGuess = wordPool.validGuesses.find((word) => word !== answer);

  try {
    assert.strictEqual(selectAnswer(dayKey), answer, 'same salt/dayKey must select the same answer');

    const dailyWord = await requestJson(baseUrl, '/game/api/daily?gameId=word');
    assert.strictEqual(dailyWord.status, 200);
    assert.deepStrictEqual(Object.keys(dailyWord.data).sort(), [
      'dayKey',
      'distribution',
      'gameId',
      'myResult',
      'participants',
    ].sort());
    assert.strictEqual(dailyWord.data.dayKey, dayKey);
    assert.strictEqual(dailyWord.data.participants, 0);
    assert.strictEqual(dailyWord.data.seed, undefined);
    assert.strictEqual(dailyWord.data.ranking, undefined);
    assertNoAnswer('word daily response', dailyWord.text, answer);

    const staticWord = await requestRaw(baseUrl, '/game/word/');
    assert.strictEqual(staticWord.status, 200);
    assert.match(staticWord.text, /오늘의 간식 단어/);
    assertNoAnswer('word static response', staticWord.text, answer);

    const solvedGuess = await postJson(baseUrl, '/game/api/word/guess', { dayKey, guess: answer });
    assert.strictEqual(solvedGuess.status, 200);
    assert.strictEqual(solvedGuess.data.valid, true);
    assert.strictEqual(solvedGuess.data.solved, true);
    assert.strictEqual(solvedGuess.data.feedback.length, 6);
    assert.deepStrictEqual(
      solvedGuess.data.feedback.map((cell) => cell.state),
      ['exact', 'exact', 'exact', 'exact', 'exact', 'exact']
    );
    assertNoAnswer('word guess response', solvedGuess.text, answer);

    const invalidGuess = await postJson(baseUrl, '/game/api/word/guess', { dayKey, guess: '힣힣' });
    assert.strictEqual(invalidGuess.status, 200);
    assert.strictEqual(invalidGuess.data.valid, false);

    const yesterdayGuess = await postJson(baseUrl, '/game/api/word/guess', { dayKey: yesterdayKey, guess: wrongGuess });
    assert.strictEqual(yesterdayGuess.status, 200);

    const oldGuess = await postJson(baseUrl, '/game/api/word/guess', { dayKey: twoDaysAgoKey, guess: wrongGuess });
    assert.strictEqual(oldGuess.status, 400);
    assert.strictEqual(oldGuess.data.error, 'INVALID_DAY');

    const token = await linkPlayer(baseUrl, repository, { discordId: 'word_user_1', displayName: '단어참여자1' }, fixedNow());
    const firstScore = await postJson(baseUrl, '/game/api/score', {
      token,
      gameId: 'word',
      score: 6,
      challenge: 'daily',
      dayKey,
    });
    assert.strictEqual(firstScore.status, 200);
    assert.strictEqual(firstScore.data.accepted, true);
    assert.deepStrictEqual(firstScore.data.myResult, { tries: 1 });
    assertNoAnswer('word score response', firstScore.text, answer);

    const duplicateScore = await postJson(baseUrl, '/game/api/score', {
      token,
      gameId: 'word',
      score: 4,
      challenge: 'daily',
      dayKey,
    });
    assert.strictEqual(duplicateScore.status, 200);
    assert.strictEqual(duplicateScore.data.duplicate, true);
    assert.strictEqual(repository.getScoresData().scores.filter((score) => score.gameId === 'word').length, 1);

    const failToken = await linkPlayer(baseUrl, repository, { discordId: 'word_user_2', displayName: '단어참여자2' }, fixedNow());
    const failedScore = await postJson(baseUrl, '/game/api/score', {
      token: failToken,
      gameId: 'word',
      score: 0,
      challenge: 'daily',
      dayKey,
    });
    assert.strictEqual(failedScore.status, 200);

    const dailyAfterScores = await requestJson(baseUrl, '/game/api/daily?gameId=word', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(dailyAfterScores.status, 200);
    assert.strictEqual(dailyAfterScores.data.participants, 2);
    assert.deepStrictEqual(dailyAfterScores.data.distribution, {
      1: 1,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    });
    assert.deepStrictEqual(dailyAfterScores.data.myResult, { tries: 1 });
    assert.strictEqual(dailyAfterScores.data.distribution.fail, undefined);
    assertNoAnswer('word daily scored response', dailyAfterScores.text, answer);

    let limited = false;
    for (let index = 0; index < WORD_GUESS_RATE_LIMIT_PER_MINUTE + 5; index += 1) {
      const attempt = await postJson(
        baseUrl,
        '/game/api/word/guess',
        { dayKey, guess: wrongGuess },
        { 'x-forwarded-for': '203.0.113.77' }
      );
      if (attempt.status === 429) {
        limited = true;
        break;
      }
    }
    assert.strictEqual(limited, true, 'word guess IP limiter should return 429 after the minute cap');

    const match3Daily = await requestJson(baseUrl, '/game/api/daily?gameId=match3');
    assert.strictEqual(match3Daily.status, 200);
    assert.deepStrictEqual(Object.keys(match3Daily.data).sort(), [
      'dayKey',
      'gameId',
      'myBest',
      'myRank',
      'participants',
      'ranking',
      'seed',
    ].sort());
    assert.strictEqual(match3Daily.data.seed, getDailySeed(dayKey));
    assert.strictEqual(match3Daily.data.distribution, undefined);

    const idleDaily = await requestJson(baseUrl, '/game/api/daily?gameId=idle');
    assert.strictEqual(idleDaily.status, 400);
    assert.strictEqual(idleDaily.data.error, 'NOT_DAILY');

    const wordRankings = await requestJson(baseUrl, '/game/api/rankings?gameId=word');
    assert.strictEqual(wordRankings.status, 400);
    assert.strictEqual(wordRankings.data.error, 'NOT_RANKABLE');

    assert.deepStrictEqual(WordLogic.decomposeWord(answer).length, 6);
  } finally {
    await stopServer(server);
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (previousSalt === undefined) {
      delete process.env.WEBGAME_WORD_SALT;
    } else {
      process.env.WEBGAME_WORD_SALT = previousSalt;
    }
  }

  console.log('word API 테스트를 통과했습니다.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

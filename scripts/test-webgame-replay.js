const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createWebgameRepository } = require('../src/webgameRepository');
const { verifyReplay, REPLAY_STATUS, isStrictModeEnabled } = require('../src/webgameReplay');
const Board = require('../public/match3/board.js');
const Scoring = require('../public/match3/scoring.js');
const Content = require('../public/deck/content.js');
const Engine = require('../public/deck/engine.js');

// ---- match3 픽스처 헬퍼 ----

function findFirstValidSwap(seed) {
  const { grid } = Board.generateBoard(seed);
  for (let row = 0; row < Board.BOARD_SIZE; row += 1) {
    for (let col = 0; col < Board.BOARD_SIZE; col += 1) {
      if (col + 1 < Board.BOARD_SIZE) {
        const right = Board.tryApplySwap(grid, { row, col }, { row, col: col + 1 });
        if (right.valid) {
          return [row, col, row, col + 1];
        }
      }
      if (row + 1 < Board.BOARD_SIZE) {
        const down = Board.tryApplySwap(grid, { row, col }, { row: row + 1, col });
        if (down.valid) {
          return [row, col, row + 1, col];
        }
      }
    }
  }
  return null;
}

function testMatch3VerifiedForHonestPlay() {
  const seed = 2026;
  const action = findFirstValidSwap(seed);
  assert.ok(action, 'fixture seed should contain a valid swap');

  const replay = Scoring.replayMatch3(seed, [action]);
  assert.strictEqual(replay.ok, true);

  const result = verifyReplay({ gameId: 'match3', score: replay.score, seed, replayLog: { v: 1, actions: [action] } });
  assert.strictEqual(result.status, REPLAY_STATUS.VERIFIED);
  assert.strictEqual(result.replayScore, replay.score);
}

function testMatch3MismatchOnForgedScore() {
  const seed = 2026;
  const action = findFirstValidSwap(seed);
  const replay = Scoring.replayMatch3(seed, [action]);

  const result = verifyReplay({
    gameId: 'match3',
    score: replay.score + 12345,
    seed,
    replayLog: { v: 1, actions: [action] },
  });
  assert.strictEqual(result.status, REPLAY_STATUS.MISMATCH);
  assert.strictEqual(result.reason, 'SCORE_MISMATCH');
  assert.strictEqual(result.replayScore, replay.score);
}

function testMatch3MismatchOnInvalidSwapInLog() {
  const seed = 2026;
  // 같은 칸끼리의 스왑은 인접하지 않으므로 항상 무효하다.
  const result = verifyReplay({
    gameId: 'match3',
    score: 999,
    seed,
    replayLog: { v: 1, actions: [[0, 0, 0, 0]] },
  });
  assert.strictEqual(result.status, REPLAY_STATUS.MISMATCH);
}

function testMatch3MissingOnEmptyLog() {
  // replayLog 자체가 없는 제출 - 구버전 클라이언트/전송 실패와 동일한 무해 경로.
  const result = verifyReplay({ gameId: 'match3', score: 500, seed: 2026, replayLog: null });
  assert.strictEqual(result.status, REPLAY_STATUS.MISSING);
}

function testMatch3MissingOnVersionMismatch() {
  const result = verifyReplay({
    gameId: 'match3',
    score: 500,
    seed: 2026,
    replayLog: { v: 999, actions: [] },
  });
  assert.strictEqual(result.status, REPLAY_STATUS.MISSING);
}

function testMatch3MissingOnActionOverflow() {
  const oversized = new Array(31).fill([0, 1, 0, 2]);
  const result = verifyReplay({
    gameId: 'match3',
    score: 500,
    seed: 2026,
    replayLog: { v: 1, actions: oversized },
  });
  assert.strictEqual(result.status, REPLAY_STATUS.MISSING);
}

function testUnsupportedGameIsSkipped() {
  const result = verifyReplay({ gameId: 'idle', score: 100, seed: null, replayLog: null });
  assert.strictEqual(result.status, REPLAY_STATUS.SKIPPED);

  const wordResult = verifyReplay({ gameId: 'word', score: 3, seed: null, replayLog: null });
  assert.strictEqual(wordResult.status, REPLAY_STATUS.SKIPPED);
}

// ---- deck 픽스처 헬퍼 ----
// 시드를 스캔해 승패와 무관하게 "끝까지 도달한(state.finished)" 짧은 런을 하나 찾는다.
// 매 스텝에서 사용 가능한 카드를 최대한 사용하고, 아니면 턴을 종료하는 단순 정책이다.
function playDeterministicRun(seed, guardLimit) {
  const state = Engine.createNewRun(seed);
  let tracker = Engine.trackerFromState(state);
  const actions = [];
  let guard = 0;

  while (!state.finished && guard < guardLimit) {
    guard += 1;
    if (state.screen === 'run') {
      Engine.enterCurrentNode(state, tracker);
      actions.push(['n']);
    } else if (state.screen === 'combat') {
      let played = false;
      const hand = state.player.hand.slice();
      for (let i = 0; i < hand.length; i += 1) {
        const cardId = hand[i];
        if (Engine.canPlayCard(state, cardId)) {
          const index = state.player.hand.indexOf(cardId);
          const result = Engine.playCard(state, cardId, index, tracker);
          if (result.success) {
            actions.push(['p', cardId, index]);
            played = true;
            break;
          }
        }
      }
      if (!played) {
        Engine.endTurn(state, tracker);
        actions.push(['e']);
      }
    } else if (state.screen === 'reward') {
      Engine.chooseReward(state, null);
      actions.push(['r0']);
    } else if (state.screen === 'rest') {
      Engine.applyRestHeal(state);
      actions.push(['h']);
    } else {
      break;
    }
    Engine.commitTracker(state, tracker);
    tracker = Engine.trackerFromState(state);
  }

  return { state, actions };
}

function findFinishedRunSeed(maxSeed, guardLimit) {
  for (let seed = 1; seed <= maxSeed; seed += 1) {
    const { state, actions } = playDeterministicRun(seed, guardLimit);
    if (state.finished) {
      return { seed, state, actions };
    }
  }
  throw new Error('fixture: no finished deck run found in seed range');
}

function scoreForDeckState(state) {
  const totalNodes = Content.RUN_LAYOUT.length;
  const reachedStage = Math.min(state.runIndex + 1, totalNodes);
  const remainingHp = Math.max(0, state.player.hp);
  return reachedStage * 1000 + remainingHp;
}

function testDeckVerifiedForFullRun() {
  const fixture = findFinishedRunSeed(300, 4000);
  const score = scoreForDeckState(fixture.state);

  const result = verifyReplay({
    gameId: 'deck',
    score,
    seed: fixture.seed,
    replayLog: { v: 1, actions: fixture.actions },
  });
  assert.strictEqual(result.status, REPLAY_STATUS.VERIFIED);
  assert.strictEqual(result.replayScore, score);
}

function testDeckVerifiedForResumedRun() {
  // 이어하기: actionLog를 두 조각으로 나눠도(세이브에 이어붙여 제출) 같은 전체 로그를
  // 그대로 재생하면 동일하게 verified가 나와야 한다(실제 이어하기는 클라이언트가
  // 세이브에서 actionLog를 이어붙이는 방식이므로, 검증기 입장에서는 풀 로그와 동치).
  const fixture = findFinishedRunSeed(300, 4000);
  const score = scoreForDeckState(fixture.state);
  const midpoint = Math.floor(fixture.actions.length / 2);
  const resumedLog = fixture.actions.slice(0, midpoint).concat(fixture.actions.slice(midpoint));

  const result = verifyReplay({
    gameId: 'deck',
    score,
    seed: fixture.seed,
    replayLog: { v: 1, actions: resumedLog },
  });
  assert.strictEqual(result.status, REPLAY_STATUS.VERIFIED);
  assert.strictEqual(result.replayScore, score);
}

function testDeckMismatchOnInvalidAction() {
  // 전투 시작 전(첫 번째 [n] 없이) 카드를 내는 것은 무효 액션이다(에너지 부족과 동일하게
  // canPlayCard가 false를 반환하는 경로).
  const result = verifyReplay({
    gameId: 'deck',
    score: 100,
    seed: 12345,
    replayLog: { v: 1, actions: [['p', 'giant-rolling-pin', 0]] },
  });
  assert.strictEqual(result.status, REPLAY_STATUS.MISMATCH);
  assert.strictEqual(result.reason, 'INVALID_DECK_ACTION');
}

function testDeckMismatchOnUnfinishedRun() {
  const result = verifyReplay({
    gameId: 'deck',
    score: 2000,
    seed: 12345,
    replayLog: { v: 1, actions: [['n']] },
  });
  assert.strictEqual(result.status, REPLAY_STATUS.MISMATCH);
  assert.strictEqual(result.reason, 'RUN_NOT_FINISHED');
}

function testDeckMissingOnActionOverflow() {
  const oversized = new Array(2001).fill(['e']);
  const result = verifyReplay({
    gameId: 'deck',
    score: 100,
    seed: 12345,
    replayLog: { v: 1, actions: oversized },
  });
  assert.strictEqual(result.status, REPLAY_STATUS.MISSING);
}

// ---- repository 통합: replay 필드 저장·관용 로드·strict 반영·mismatch 순환 ----

function withTempRepository(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webgame-replay-'));
  try {
    const repository = createWebgameRepository({
      links: path.join(tempDir, 'webgame-links.local.json'),
      scores: path.join(tempDir, 'webgame-scores.local.json'),
    });
    fn(repository, tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testRepositoryStoresReplayStatus() {
  withTempRepository((repository) => {
    const record = repository.recordScore({
      discordId: 'user_a',
      gameId: 'match3',
      score: 100,
      seed: 'x',
      flagged: false,
      replay: 'verified',
    });
    assert.strictEqual(record.replay, 'verified');
  });
}

function testRepositoryTreatsMissingReplayFieldAsMissing() {
  withTempRepository((repository, tempDir) => {
    // 비동기 소셜 확장 이전의 레거시 레코드를 흉내내 replay 필드 없이 직접 파일에 심는다
    // (recordScore는 항상 replay를 쓰므로, 관용 로드를 검증하려면 파일을 직접 조작해야 한다).
    const scoresPath = path.join(tempDir, 'webgame-scores.local.json');
    const weekKey = '2026-W01';
    fs.writeFileSync(scoresPath, JSON.stringify({
      version: 1,
      isExample: false,
      description: 'legacy fixture without replay field',
      scores: [{
        discordId: 'user_a',
        gameId: 'match3',
        score: 10,
        seed: null,
        submittedAt: '2026-01-01T00:00:00.000Z',
        weekKey,
        flagged: false,
      }],
    }));

    const ranking = repository.listWeeklyRanking('match3', weekKey, { limit: 10 });
    assert.strictEqual(ranking.length, 1, '기존 레코드도 정상적으로 랭킹에 포함되어야 한다(replay 필드 부재가 조회를 막지 않음)');

    const counts = repository.countReplayStatusesForWeek(weekKey);
    assert.strictEqual(counts.missing, 1);
    assert.strictEqual(counts.verified, 0);
  });
}

function testStrictModeTogglesFlagged() {
  const originalEnv = process.env.WEBGAME_REPLAY_STRICT;
  try {
    process.env.WEBGAME_REPLAY_STRICT = 'true';
    assert.strictEqual(isStrictModeEnabled(), true);

    delete process.env.WEBGAME_REPLAY_STRICT;
    assert.strictEqual(isStrictModeEnabled(), false);

    process.env.WEBGAME_REPLAY_STRICT = 'false';
    assert.strictEqual(isStrictModeEnabled(), false);
  } finally {
    if (originalEnv === undefined) {
      delete process.env.WEBGAME_REPLAY_STRICT;
    } else {
      process.env.WEBGAME_REPLAY_STRICT = originalEnv;
    }
  }
}

function testMismatchFileRotatesTo50Records() {
  withTempRepository((repository) => {
    for (let i = 0; i < 55; i += 1) {
      repository.appendReplayMismatch({
        discordId: `user_${i}`,
        gameId: 'match3',
        seed: String(i),
        score: i,
        replayScore: 0,
        reason: 'SCORE_MISMATCH',
        log: { v: 1, actions: [] },
      });
    }

    const data = repository.getReplayMismatchData();
    assert.strictEqual(data.records.length, 50);
    // 가장 오래된 5건(user_0..user_4)은 순환에서 밀려나야 한다.
    assert.strictEqual(data.records[0].discordId, 'user_5');
    assert.strictEqual(data.records[data.records.length - 1].discordId, 'user_54');

    const recent = repository.listRecentMismatches(10);
    assert.strictEqual(recent.length, 10);
    assert.strictEqual(recent[0].discordId, 'user_54', '최근 목록은 최신순이어야 한다');
  });
}

function main() {
  testMatch3VerifiedForHonestPlay();
  testMatch3MismatchOnForgedScore();
  testMatch3MismatchOnInvalidSwapInLog();
  testMatch3MissingOnEmptyLog();
  testMatch3MissingOnVersionMismatch();
  testMatch3MissingOnActionOverflow();
  testUnsupportedGameIsSkipped();

  testDeckVerifiedForFullRun();
  testDeckVerifiedForResumedRun();
  testDeckMismatchOnInvalidAction();
  testDeckMismatchOnUnfinishedRun();
  testDeckMissingOnActionOverflow();

  testRepositoryStoresReplayStatus();
  testRepositoryTreatsMissingReplayFieldAsMissing();
  testStrictModeTogglesFlagged();
  testMismatchFileRotatesTo50Records();

  console.log('webgame replay 검증기 테스트를 통과했습니다.');
}

main();

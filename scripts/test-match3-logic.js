const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BOARD_FILE = path.join(__dirname, '..', 'public', 'match3', 'board.js');
const SCORING_FILE = path.join(__dirname, '..', 'public', 'match3', 'scoring.js');

function loadBoard() {
  const context = { window: {}, module: undefined };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(BOARD_FILE, 'utf8'), context, { filename: 'board.js' });
  return context.window.Match3Board;
}

// scoring.js는 브라우저(window.Match3Board)와 Node(require('./board')) 양쪽에서
// board.js를 읽을 수 있는 UMD 패턴이라, 같은 vm 컨텍스트 안에 board.js를 먼저 실행해
// window.Match3Board를 채운 뒤 scoring.js를 이어서 실행하면 된다.
function loadScoring() {
  const context = { window: {}, module: undefined };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(BOARD_FILE, 'utf8'), context, { filename: 'board.js' });
  vm.runInContext(fs.readFileSync(SCORING_FILE, 'utf8'), context, { filename: 'scoring.js' });
  return { Board: context.window.Match3Board, Scoring: context.window.Match3Scoring };
}

function buildGrid(rows) {
  return rows.map((row) => row.slice());
}

function testInitialBoardsHaveNoMatches() {
  const Board = loadBoard();
  const seeds = [1, 2, 3, 42, 1234, 999999, 7, 88, 555, 2026];
  seeds.forEach((seed) => {
    const { grid } = Board.generateBoard(seed);
    assert.strictEqual(grid.length, Board.BOARD_SIZE, `seed ${seed} should build ${Board.BOARD_SIZE} rows`);
    grid.forEach((row) => {
      assert.strictEqual(row.length, Board.BOARD_SIZE, `seed ${seed} should build ${Board.BOARD_SIZE} cols`);
      row.forEach((tile) => {
        assert.ok(Board.TILE_TYPES.includes(tile), `seed ${seed} should only use known tile types`);
      });
    });
    assert.strictEqual(Board.hasAnyMatch(grid), false, `seed ${seed} initial board should have no matches`);
  });
}

function testSameSeedIsDeterministic() {
  const Board = loadBoard();
  const first = Board.generateBoard(2026).grid;
  const second = Board.generateBoard(2026).grid;
  assert.strictEqual(JSON.stringify(first), JSON.stringify(second), 'same seed should produce the same board');
}

function testHorizontalMatchDetection() {
  const Board = loadBoard();
  const grid = buildGrid([
    ['cookie', 'cookie', 'cookie', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange'],
    ['strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
  ]);
  const result = Board.findMatches(grid);
  assert.strictEqual(result.groups.length, 1);
  assert.strictEqual(result.groups[0].cells.length, 3);
  assert.strictEqual(result.groups[0].type, 'cookie');
}

function testVerticalMatchDetection() {
  const Board = loadBoard();
  const grid = buildGrid([
    ['cookie', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['cookie', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['cookie', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['cookie', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange'],
    ['jelly', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly'],
    ['candy', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['cupcake', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['strawberry', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
  ]);
  const result = Board.findMatches(grid);
  assert.strictEqual(result.groups.length, 1);
  assert.strictEqual(result.groups[0].cells.length, 4);
  assert.strictEqual(result.groups[0].type, 'cookie');
}

function testFivePlusMatchDetection() {
  const Board = loadBoard();
  const grid = buildGrid([
    ['candy', 'candy', 'candy', 'candy', 'candy', 'orange', 'jelly', 'cookie'],
    ['orange', 'jelly', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange'],
    ['strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
  ]);
  const result = Board.findMatches(grid);
  assert.strictEqual(result.groups.length, 1);
  assert.strictEqual(result.groups[0].cells.length, 5);
  assert.strictEqual(Board.scoreForGroup(result.groups[0]), 120);
}

function testInvalidSwapIsRejected() {
  const Board = loadBoard();
  const { grid } = Board.generateBoard(10);
  // Find an adjacent pair whose swap does not create a match, by scanning.
  let found = null;
  for (let row = 0; row < Board.BOARD_SIZE && !found; row += 1) {
    for (let col = 0; col < Board.BOARD_SIZE - 1 && !found; col += 1) {
      const result = Board.tryApplySwap(grid, { row, col }, { row, col: col + 1 });
      if (!result.valid) {
        found = { row, col };
      }
    }
  }
  assert.ok(found, 'expected at least one invalid swap in a freshly generated board');
  const swapResult = Board.tryApplySwap(grid, found, { row: found.row, col: found.col + 1 });
  assert.strictEqual(swapResult.valid, false);
  assert.strictEqual(JSON.stringify(swapResult.grid), JSON.stringify(grid), 'invalid swap should not mutate board state');
}

function testValidSwapProducesMatch() {
  const Board = loadBoard();
  const grid = buildGrid([
    ['candy', 'candy', 'orange', 'candy', 'jelly', 'orange', 'jelly', 'cookie'],
    ['orange', 'jelly', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange'],
    ['strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
  ]);
  // Swapping (0,2) 'orange' with (0,3) 'candy' should create 'candy candy candy' at row0 col0-2.
  const result = Board.tryApplySwap(grid, { row: 0, col: 2 }, { row: 0, col: 3 });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.grid[0][0], 'candy');
  assert.strictEqual(result.grid[0][1], 'candy');
  assert.strictEqual(result.grid[0][2], 'candy');
}

function testGravityRefillAndCascadeScoring() {
  const Board = loadBoard();
  const grid = buildGrid([
    ['candy', 'candy', 'candy', 'orange', 'jelly', 'cookie', 'cupcake', 'strawberry'],
    ['orange', 'jelly', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange'],
    ['strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
  ]);
  const rng = Board.createRng(5);
  const result = Board.removeMatchesAndCollapse(grid, rng);

  assert.strictEqual(result.cleared, 3);
  assert.strictEqual(result.score, 30);

  // No empty cells should remain after gravity + refill.
  result.grid.forEach((row) => {
    row.forEach((tile) => {
      assert.ok(Board.TILE_TYPES.includes(tile), 'no null cells should remain after refill');
    });
  });
}

function testCascadeMultiplierAccumulates() {
  const Board = loadBoard();
  // Start from a known match-free generated board (seed 500), then hand-plant
  // a single vertical match in column 0 (rows 5-7, 'candy'). Clearing it drops
  // the two 'jelly' tiles above (rows 0-1) down by three rows, landing them
  // next to the existing 'jelly' at row 4 and forming a second, cascaded
  // match. Rows 2-3 are set to distinct filler types so no other match exists
  // before the cascade begins.
  const grid = buildGrid([
    ['jelly', 'cupcake', 'cupcake', 'orange', 'candy', 'candy', 'cookie', 'candy'],
    ['jelly', 'candy', 'cupcake', 'cupcake', 'candy', 'orange', 'cupcake', 'jelly'],
    ['orange', 'jelly', 'candy', 'cupcake', 'cookie', 'orange', 'strawberry', 'candy'],
    ['cookie', 'jelly', 'candy', 'strawberry', 'strawberry', 'cupcake', 'strawberry', 'strawberry'],
    ['jelly', 'orange', 'cookie', 'cupcake', 'cookie', 'orange', 'orange', 'cupcake'],
    ['candy', 'candy', 'cupcake', 'candy', 'candy', 'orange', 'orange', 'jelly'],
    ['candy', 'candy', 'cookie', 'orange', 'orange', 'cupcake', 'cookie', 'orange'],
    ['candy', 'orange', 'strawberry', 'cookie', 'orange', 'jelly', 'strawberry', 'candy'],
  ]);

  const initialMatches = Board.findMatches(grid);
  assert.strictEqual(initialMatches.groups.length, 1, 'fixture should start with exactly one match');
  assert.strictEqual(initialMatches.groups[0].type, 'candy');

  const rng = Board.createRng(1);
  const result = Board.resolveCascades(grid, rng);

  assert.ok(result.cascadeCount >= 2, `expected at least two cascade steps, got ${result.cascadeCount}`);
  assert.ok(result.score > 0);
  assert.ok(result.maxMultiplier >= 2, `expected multiplier to grow past 1, got ${result.maxMultiplier}`);
  result.grid.forEach((row) => {
    row.forEach((tile) => {
      assert.ok(Board.TILE_TYPES.includes(tile), 'no null cells should remain after cascading');
    });
  });
  assert.strictEqual(Board.hasAnyMatch(result.grid), false, 'cascades should resolve until no matches remain');
}

function testNoAvailableMoveDetectionAndShuffle() {
  const Board = loadBoard();
  // Diagonal three-color stripe pattern: type = (row + 2*col) mod 3. This
  // construction guarantees both that no three-in-a-row/column already
  // exists and that swapping any adjacent pair cannot create one, since
  // every adjacent pair (horizontally or vertically) always differs by a
  // fixed non-zero offset in the underlying stripe index.
  const types = ['strawberry', 'orange', 'candy'];
  const pattern = [];
  for (let row = 0; row < 8; row += 1) {
    const rowValues = [];
    for (let col = 0; col < 8; col += 1) {
      rowValues.push(types[(row + 2 * col) % 3]);
    }
    pattern.push(rowValues);
  }
  const grid = buildGrid(pattern);

  assert.strictEqual(Board.hasAnyMatch(grid), false, 'fixture board should not already contain a match');
  assert.strictEqual(Board.hasAvailableMove(grid), false, 'checkerboard fixture should have no available move');

  const rng = Board.createRng(123);
  const shuffled = Board.shuffleBoard(grid, rng);
  assert.strictEqual(Board.hasAnyMatch(shuffled), false, 'shuffled board should not start with a match');
  assert.strictEqual(Board.hasAvailableMove(shuffled), true, 'shuffled board should have at least one available move');
}

function testScoreRulesForMatchSizes() {
  const Board = loadBoard();
  assert.strictEqual(Board.scoreForGroup({ cells: [1, 2, 3] }), 30);
  assert.strictEqual(Board.scoreForGroup({ cells: [1, 2, 3, 4] }), 60);
  assert.strictEqual(Board.scoreForGroup({ cells: [1, 2, 3, 4, 5] }), 120);
  assert.strictEqual(Board.scoreForGroup({ cells: [1, 2, 3, 4, 5, 6] }), 120);
}

// scoring.js 추출 후 점수 동일성 검증(신규 확장 — 기존 케이스는 무수정).
// 시드 고정 스왑 시퀀스를 1) board.js 프리미티브를 직접 조합해 계산한 점수와
// 2) scoring.js의 replayMatch3(서버 검증기가 그대로 사용)로 계산한 점수가 같아야
// 클라이언트 게임 로직(game.js)과 서버 재현이 이중 구현 없이 같은 값을 낸다고 증명된다.
function testScoringExtractionMatchesManualCascadeCalculation() {
  const { Board, Scoring } = loadScoring();
  const seed = 2026;

  // 1) 수동 계산: game.js의 attemptSwap → resolveBoard → checkForShuffleNeeded와
  // 동일한 순서로 board.js 프리미티브를 직접 호출한다.
  const manualInitial = Board.generateBoard(seed);
  let manualGrid = manualInitial.grid;
  const manualRng = manualInitial.rng;
  let manualScore = 0;

  const actions = findFirstValidSwaps(Board, seed, 3);
  assert.ok(actions.length >= 1, 'fixture seed should contain at least one valid swap');

  actions.forEach((action) => {
    const first = { row: action[0], col: action[1] };
    const second = { row: action[2], col: action[3] };
    const swapResult = Board.tryApplySwap(manualGrid, first, second);
    assert.strictEqual(swapResult.valid, true);
    manualGrid = swapResult.grid;
    const cascadeResult = Board.resolveCascades(manualGrid, manualRng);
    manualGrid = cascadeResult.grid;
    manualScore += cascadeResult.score;
    if (!Board.hasAvailableMove(manualGrid)) {
      manualGrid = Board.shuffleBoard(manualGrid, manualRng);
    }
  });

  // 2) scoring.js 추출 함수로 같은 시퀀스를 재생.
  const replayResult = Scoring.replayMatch3(seed, actions);
  assert.strictEqual(replayResult.ok, true);
  assert.strictEqual(replayResult.score, manualScore, 'extracted scoring.js should reproduce the same score as manual board.js composition');
}

// 시드 고정 보드에서 앞쪽부터 스캔해 유효한 스왑을 count개 찾는다(테스트 픽스처 헬퍼).
function findFirstValidSwaps(Board, seed, count) {
  const { grid } = Board.generateBoard(seed);
  const found = [];
  for (let row = 0; row < Board.BOARD_SIZE && found.length < count; row += 1) {
    for (let col = 0; col < Board.BOARD_SIZE && found.length < count; col += 1) {
      if (col + 1 < Board.BOARD_SIZE) {
        const right = Board.tryApplySwap(grid, { row, col }, { row, col: col + 1 });
        if (right.valid) {
          found.push([row, col, row, col + 1]);
          continue;
        }
      }
      if (row + 1 < Board.BOARD_SIZE) {
        const down = Board.tryApplySwap(grid, { row, col }, { row: row + 1, col });
        if (down.valid) {
          found.push([row, col, row + 1, col]);
        }
      }
    }
  }
  return found;
}

function testScoringDetectsInvalidSwapInLog() {
  const { Board, Scoring } = loadScoring();
  const seed = 2026;
  // (0,0)-(0,1)이 유효한 스왑이 아니라고 보장할 수 없으므로, 존재하지 않는 조합 대신
  // 명백히 무효한 스왑(같은 칸)을 사용해 replayMatch3가 즉시 중단하는지 확인한다.
  const result = Scoring.replayMatch3(seed, [[0, 0, 0, 0]]);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'INVALID_SWAP');
}

function main() {
  testInitialBoardsHaveNoMatches();
  testSameSeedIsDeterministic();
  testHorizontalMatchDetection();
  testVerticalMatchDetection();
  testFivePlusMatchDetection();
  testInvalidSwapIsRejected();
  testValidSwapProducesMatch();
  testGravityRefillAndCascadeScoring();
  testCascadeMultiplierAccumulates();
  testNoAvailableMoveDetectionAndShuffle();
  testScoreRulesForMatchSizes();
  testScoringExtractionMatchesManualCascadeCalculation();
  testScoringDetectsInvalidSwapInLog();

  console.log('match3 logic test passed');
}

main();

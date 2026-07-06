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

// ---- 특수 타일 (docs/match3-improvement-plan.md 1절) — 신규 확장 ----
// 기존 케이스는 위에서 전부 유지된다. 아래는 생성 위치 결정성·발동 제거 집합·
// 체인 순서·컬러 타일 대상 선택·재현 결정성을 검증하는 신규 케이스다.

function buildFilledGrid(rows) {
  return rows.map((row) => row.slice());
}

// 4개 가로 매치 -> 스왑된 셀에 세로줄 제거 타일이 생겨야 한다(계획서 1.1 표: 매치
// 방향과 생성 타일의 제거 방향은 반대).
function testFourMatchSpawnsLineSpecialAtSwapCell() {
  const Board = loadBoard();
  const seed = 2;
  const initial = Board.generateBoard(seed);
  const first = { row: 0, col: 4 };
  const second = { row: 1, col: 4 };
  const swapResult = Board.tryApplySwap(initial.grid, first, second, initial.specialGrid);
  assert.strictEqual(swapResult.valid, true);

  const cascade = Board.resolveCascades(swapResult.grid, initial.rng, {
    specialGrid: swapResult.specialGrid,
    swapCells: swapResult.swapCells,
    triggeredSwapSpecials: swapResult.triggeredSwapSpecials,
  });

  assert.strictEqual(cascade.steps[0].groups.length, 1);
  assert.strictEqual(cascade.steps[0].groups[0].cells.length, 4);
  assert.strictEqual(cascade.specialGrid[1][4], 'line-v', '가로 4매치는 스왑 셀에 세로줄 제거 타일을 만들어야 한다');
}

// 5개 일렬 매치 -> 스왑된 셀에 컬러(동종 제거) 타일이 생겨야 한다.
function testFivePlusMatchSpawnsColorSpecialAtSwapCell() {
  const Board = loadBoard();
  const seed = 29;
  const initial = Board.generateBoard(seed);
  const first = { row: 3, col: 3 };
  const second = { row: 4, col: 3 };
  const swapResult = Board.tryApplySwap(initial.grid, first, second, initial.specialGrid);
  assert.strictEqual(swapResult.valid, true);

  const cascade = Board.resolveCascades(swapResult.grid, initial.rng, {
    specialGrid: swapResult.specialGrid,
    swapCells: swapResult.swapCells,
    triggeredSwapSpecials: swapResult.triggeredSwapSpecials,
  });

  assert.strictEqual(cascade.specialGrid[3][3], 'color', '5매치는 스왑 셀에 컬러 타일을 만들어야 한다');
}

// T/L자 매치 -> 교차점 셀에 폭발(3x3) 타일 생성 계획이 세워져야 한다(계획서 1.1).
// planSpecialForGroup은 생성 규칙 자체(중력 적용 전)를 결정하는 순수 함수이므로
// 여기서 직접 검증한다 - 중력 이후에는 다른 일반 타일처럼 아래로 떨어질 수 있어
// (계획서에 명시된 대로 특수 타일도 일반 타일처럼 취급되므로) 최종 낙하 위치가
// 아니라 "생성 시점의 계획"이 교차점인지를 확인하는 것이 맞는 단정이다.
function testCrossMatchSpawnsWrapSpecialAtIntersection() {
  const Board = loadBoard();
  const seed = 3;
  const initial = Board.generateBoard(seed);
  const first = { row: 2, col: 0 };
  const second = { row: 2, col: 1 };
  const swapResult = Board.tryApplySwap(initial.grid, first, second, initial.specialGrid);
  assert.strictEqual(swapResult.valid, true);

  const matchResult = Board.findMatches(swapResult.grid);
  const crossGroup = matchResult.groups.find((g) => g.cells.length === 5);
  assert.ok(crossGroup, 'fixture should contain the cross-shaped 5-cell group');

  const plan = Board.planSpecialForGroup(crossGroup, swapResult.swapCells);
  assert.strictEqual(plan.kind, 'wrap');
  const intersection = Board.findIntersectionCell(crossGroup);
  assert.strictEqual(JSON.stringify(plan.cell), JSON.stringify(intersection), 'T/L자 매치는 교차점 셀에 폭발 타일을 만들어야 한다');

  // 중력 적용 후에도 폭발 타일 자체는(위치가 옮겨지더라도) 보드 어딘가에 남아 있어야 한다.
  const cascade = Board.resolveCascades(swapResult.grid, initial.rng, {
    specialGrid: swapResult.specialGrid,
    swapCells: swapResult.swapCells,
    triggeredSwapSpecials: swapResult.triggeredSwapSpecials,
  });
  var wrapCount = 0;
  cascade.specialGrid.forEach((row) => row.forEach((v) => { if (v === 'wrap') wrapCount += 1; }));
  assert.strictEqual(wrapCount, 1, '생성된 폭발 타일은 중력 이후에도 보드에 남아 있어야 한다');
}

// 발동 제거 집합: 줄 제거 타일은 해당 행/열 8칸 전부를, 폭발은 3x3(최대 9칸)을 지운다.
function testActivationClearedCellSets() {
  const Board = loadBoard();
  const lineHCells = Board.computeActivationCells('line-h', 3, 3);
  assert.strictEqual(lineHCells.length, Board.BOARD_SIZE);
  assert.ok(lineHCells.every((cell) => cell[0] === 3));

  const lineVCells = Board.computeActivationCells('line-v', 3, 3);
  assert.strictEqual(lineVCells.length, Board.BOARD_SIZE);
  assert.ok(lineVCells.every((cell) => cell[1] === 3));

  const wrapCenter = Board.computeActivationCells('wrap', 3, 3);
  assert.strictEqual(wrapCenter.length, 9);

  const wrapCorner = Board.computeActivationCells('wrap', 0, 0);
  assert.strictEqual(wrapCorner.length, 4, '경계에서는 보드 밖 셀을 제외해야 한다');
}

// 체인 발동: 매치로 제거되는 셀 안에 이미 다른 특수 타일이 있으면 연쇄 발동해야
// 하고, 처리 순서는 좌상단부터 행 우선이다(계획서 1.2).
function testChainActivationOrderAndClearedSet() {
  const Board = loadBoard();
  const grid = buildFilledGrid([
    ['cookie', 'cookie', 'cookie', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange'],
    ['strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
  ]);
  const specialGrid = Board.createEmptySpecialGrid();
  // (0,1)은 (0,0)-(0,2) cookie 3매치 그룹 안에 있다 - 매치로 소모되며 발동해야 한다.
  specialGrid[0][1] = 'line-h';

  const rng = Board.createRng(999);
  const result = Board.removeMatchesAndCollapse(grid, rng, { specialGrid: specialGrid });

  assert.strictEqual(result.activations.length, 1);
  assert.strictEqual(result.activations[0].kind, 'line-h');
  assert.strictEqual(JSON.stringify(result.activations[0].cell), JSON.stringify([0, 1]));
  // 3매치(30점) + line-h 발동 보너스(100점) = 130점. 행 전체(8칸)가 제거됨.
  assert.strictEqual(result.score, 130);
  assert.strictEqual(result.cleared, 8);
}

// 컬러 타일: 캐스케이드로 소모되면 보드에서 가장 많은 간식 종류를 제거한다.
function testColorSpecialTargetsMostCommonTypeOnCascadeTrigger() {
  const Board = loadBoard();
  const grid = buildFilledGrid([
    ['cookie', 'cookie', 'cookie', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange'],
    ['strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
  ]);
  const specialGrid = Board.createEmptySpecialGrid();
  specialGrid[0][0] = 'color';

  const mostCommon = Board.findMostCommonType(grid);
  const rng = Board.createRng(1);
  const result = Board.removeMatchesAndCollapse(grid, rng, { specialGrid: specialGrid });

  assert.strictEqual(result.activations.length, 1);
  assert.strictEqual(result.activations[0].kind, 'color');
  assert.strictEqual(result.activations[0].targetType, mostCommon);
}

// 컬러 타일: 스왑으로 발동되면 스왑 상대의 종류를 제거한다.
function testColorSpecialTargetsSwapPartnerTypeOnSwapTrigger() {
  const Board = loadBoard();
  const grid = buildFilledGrid([
    ['cookie', 'cookie', 'cookie', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
    ['candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry'],
    ['cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange'],
    ['strawberry', 'orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly'],
    ['orange', 'jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy'],
    ['jelly', 'candy', 'cupcake', 'strawberry', 'orange', 'jelly', 'candy', 'cupcake'],
  ]);
  const specialGrid = Board.createEmptySpecialGrid();
  specialGrid[7][7] = 'color'; // cupcake 칸에 컬러 타일

  const rng = Board.createRng(1);
  const swapResult = Board.tryApplySwap(grid, { row: 7, col: 7 }, { row: 7, col: 6 }, specialGrid);
  assert.strictEqual(swapResult.valid, true, '특수 타일 스왑은 일반 매치가 없어도 유효해야 한다');

  const cascade = Board.resolveCascades(swapResult.grid, rng, {
    specialGrid: swapResult.specialGrid,
    swapCells: swapResult.swapCells,
    triggeredSwapSpecials: swapResult.triggeredSwapSpecials,
  });

  assert.strictEqual(cascade.activations.length, 1);
  assert.strictEqual(cascade.activations[0].targetType, 'candy', '스왑 상대(candy)의 종류를 지워야 한다');
}

// 결정성: 같은 시드 + 같은 스왑 시퀀스를 특수 타일 포함 재현(replayMatch3 withSpecials)
// 으로 2회 실행하면 완전히 같은 결과가 나와야 한다(계획서 절대 조건).
function testSpecialTileDeterminismAcrossRuns() {
  const { Scoring } = loadScoring();
  const seed = 2;
  // 두 스왑 모두 seed 2 보드에서 순서대로 유효하다(1번째: 가로 4매치 스왑,
  // 2번째: 그 결과 보드에서 스캔한 다음 유효 스왑).
  const actions = [[0, 4, 1, 4], [0, 0, 1, 0]];

  const first = Scoring.replayMatch3(seed, actions, true);
  const second = Scoring.replayMatch3(seed, actions, true);

  assert.strictEqual(first.ok, true);
  assert.strictEqual(second.ok, true);
  assert.strictEqual(first.score, second.score);
  assert.strictEqual(JSON.stringify(first.grid), JSON.stringify(second.grid));
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

  testFourMatchSpawnsLineSpecialAtSwapCell();
  testFivePlusMatchSpawnsColorSpecialAtSwapCell();
  testCrossMatchSpawnsWrapSpecialAtIntersection();
  testActivationClearedCellSets();
  testChainActivationOrderAndClearedSet();
  testColorSpecialTargetsMostCommonTypeOnCascadeTrigger();
  testColorSpecialTargetsSwapPartnerTypeOnSwapTrigger();
  testSpecialTileDeterminismAcrossRuns();

  console.log('match3 logic test passed');
}

main();

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const GAME_DIR = path.join(__dirname, '..', 'public', 'match3');
const REQUIRED_FILES = ['index.html', 'styles.css', 'board.js', 'game.js', 'goals.js'];

function readGameFile(fileName) {
  return fs.readFileSync(path.join(GAME_DIR, fileName), 'utf8');
}

function readProjectFile(fileName) {
  return fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
}

function main() {
  REQUIRED_FILES.forEach((fileName) => {
    assert.ok(fs.existsSync(path.join(GAME_DIR, fileName)), `${fileName} should exist`);
  });

  const html = readGameFile('index.html');
  assert.ok(html.includes('간식 맞추기'));
  assert.ok(html.includes('id="board"'));
  assert.ok(!html.includes('포인트 지급'));

  const boardScriptIndex = html.indexOf('./board.js');
  const gameScriptIndex = html.indexOf('./game.js');
  assert.ok(boardScriptIndex !== -1, 'index.html should load board.js');
  assert.ok(gameScriptIndex !== -1, 'index.html should load game.js');
  assert.ok(boardScriptIndex < gameScriptIndex, 'board.js should load before game.js');

  const sharedCssIndex = html.indexOf('../shared/game-ui.css');
  const gameCssIndex = html.indexOf('./styles.css');
  assert.ok(sharedCssIndex !== -1, 'index.html should load ../shared/game-ui.css');
  assert.ok(gameCssIndex !== -1, 'index.html should load ./styles.css');
  assert.ok(sharedCssIndex < gameCssIndex, '../shared/game-ui.css should load before ./styles.css');

  const board = readGameFile('board.js');
  assert.ok(board.includes('window.Match3Board') || board.includes('root.Match3Board'));
  assert.ok(board.includes('module.exports'));
  assert.ok(board.includes('BOARD_SIZE'));
  assert.ok(board.includes('generateBoard'));
  assert.ok(board.includes('resolveCascades'));
  assert.ok(board.includes('hasAvailableMove'));
  assert.ok(board.includes('shuffleBoard'));

  const game = readGameFile('game.js');
  assert.ok(game.includes('Match3Board'));
  assert.ok(game.includes("getElementById('board')"));
  assert.ok(game.includes('seed'));

  const styles = readGameFile('styles.css');
  assert.ok(styles.includes('.board'));
  assert.ok(styles.includes('.tile'));
  assert.ok(styles.includes('@media (max-width: 480px)'));

  const adminServer = readProjectFile('src/adminServer.js');
  assert.ok(adminServer.includes('/game/match3'), 'adminServer should route /game/match3');
  assert.ok(adminServer.includes('MATCH3_PUBLIC_DIR'), 'adminServer should define MATCH3_PUBLIC_DIR');
  assert.ok(adminServer.includes('resolveMatch3Asset'), 'adminServer should define resolveMatch3Asset');
  assert.ok(adminServer.includes('serveMatch3Asset'), 'adminServer should define serveMatch3Asset');
  assert.ok(
    adminServer.includes("filePath.startsWith(MATCH3_PUBLIC_DIR)"),
    'adminServer should guard against path traversal for match3 assets'
  );

  const webGameDoc = readProjectFile('docs/match3-web-game.md');
  assert.ok(webGameDoc.includes('포인트 지급 없음'));
  assert.ok(webGameDoc.includes('/game/match3'));

  // 목표 판 모드(docs/match3-improvement-plan.md 3절) - goals.js 존재·목표 12종 스키마.
  const Goals = require(path.join(GAME_DIR, 'goals.js'));
  const boards = Goals.getGoalBoards();
  assert.strictEqual(boards.length, 12, '목표 판은 12종이어야 한다');

  const seenIds = new Set();
  const validTypes = new Set(['collect', 'combo', 'special']);
  boards.forEach((goal) => {
    assert.strictEqual(typeof goal.id, 'number');
    assert.ok(!seenIds.has(goal.id), `goal id ${goal.id} should be unique`);
    seenIds.add(goal.id);
    assert.strictEqual(typeof goal.seed, 'number');
    assert.ok(Number.isInteger(goal.moves) && goal.moves > 0, 'moves should be a positive integer');
    assert.ok(validTypes.has(goal.type), `goal type ${goal.type} should be one of collect/combo/special`);
    assert.strictEqual(typeof goal.title, 'string');
    assert.strictEqual(typeof goal.description, 'string');
    assert.ok(Number.isInteger(goal.target) && goal.target > 0, 'target should be a positive integer');
    if (goal.type === 'collect') {
      assert.strictEqual(typeof goal.tile, 'string');
    }
  });

  const goalsScript = readGameFile('goals.js');
  assert.ok(goalsScript.includes('module.exports'));
  assert.ok(html.includes('./goals.js'), 'index.html should load goals.js');
  assert.ok(html.includes('id="goals-list"'), 'index.html should have a goals list container');
  assert.ok(game.includes('Match3Goals'), 'game.js should reference Match3Goals');

  console.log('match3 static test passed');
}

main();

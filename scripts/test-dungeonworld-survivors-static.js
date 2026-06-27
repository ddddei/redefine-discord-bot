const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME_DIR = path.join(__dirname, '..', 'public', 'dungeonworld-survivors');
const REQUIRED_FILES = [
  'index.html',
  'styles.css',
  'content.js',
  'systems.js',
  'renderer.js',
  'game.js',
];

function readGameFile(fileName) {
  return fs.readFileSync(path.join(GAME_DIR, fileName), 'utf8');
}

function testWaveRollBehavior() {
  const context = { window: {}, Math: Object.create(Math) };
  context.Math.random = () => 0.5;
  vm.createContext(context);

  ['content.js', 'systems.js'].forEach((fileName) => {
    vm.runInContext(readGameFile(fileName), context, { filename: fileName });
  });

  const content = context.window.DungeonworldSurvivorsContent;
  const systems = context.window.DungeonworldSurvivorsSystems;
  const state = systems.createState(content, 'cleric');
  state.elapsed = 44.95;
  state.enemies = [];

  const result = systems.tick(state, { up: false, down: false, left: false, right: false }, 0.1);

  assert.strictEqual(result, 'running');
  assert.strictEqual(state.waveIndex, 1);
  assert.match(state.lastMoveResult, /상황 파악/);
  assert.match(state.lastMoveResult, /7-9|10\+|6-/);
  assert.strictEqual(state.playbook.title, '사제');
  assert.strictEqual(state.player.stats.wis, 2);
}

function main() {
  REQUIRED_FILES.forEach((fileName) => {
    assert.ok(fs.existsSync(path.join(GAME_DIR, fileName)), `${fileName} should exist`);
  });

  const html = readGameFile('index.html');
  assert.ok(html.includes('검은 종 생존전'));
  assert.ok(html.includes('id="game-canvas"'));
  assert.ok(html.includes('./content.js'));
  assert.ok(html.includes('./systems.js'));
  assert.ok(html.includes('./renderer.js'));
  assert.ok(html.includes('./game.js'));
  assert.ok(!html.includes('포인트 지급'));
  assert.ok(html.includes('id="tension-value"'));
  assert.ok(html.includes('id="move-result-value"'));
  assert.ok(html.includes('캐릭터 시트'));

  const content = readGameFile('content.js');
  assert.ok(content.includes('playbooks'));
  assert.ok(content.includes('전사'));
  assert.ok(content.includes('도적'));
  assert.ok(content.includes('사제'));
  assert.ok(content.includes('moveName: \'위험 돌파\''));
  assert.ok(content.includes('checkStat: \'dex\''));
  assert.ok(content.includes('마른 참나무'));
  assert.ok(content.includes('픽의 지름길'));
  assert.ok(content.includes('바루크의 창선'));
  assert.ok(content.includes('라메의 잎 표식'));
  assert.ok(content.includes('검은 종 파수꾼'));
  assert.ok(content.includes('wavePatterns'));
  assert.ok(content.includes('behavior: \'skirmisher\''));
  assert.ok(content.includes('behavior: \'charger\''));
  assert.ok(content.includes('behavior: \'bulwark\''));
  assert.ok(content.includes('maxLevel'));
  assert.ok(content.includes('토른의 방패 II'));

  const systems = readGameFile('systems.js');
  assert.ok(systems.includes('const GAME_DURATION = 240;'));
  assert.ok(systems.includes('function resolveDungeonMove'));
  assert.ok(systems.includes('function updateTension'));
  assert.ok(systems.includes('lastMoveResult'));
  assert.ok(systems.includes('function fireProjectiles'));
  assert.ok(systems.includes('function fireFanKnives'));
  assert.ok(systems.includes('function fireBellWave'));
  assert.ok(systems.includes('function updateOrbitingSpears'));
  assert.ok(systems.includes('function consumeLevelUps'));
  assert.ok(systems.includes('function updateWave'));
  assert.ok(systems.includes('bossDefeated'));
  assert.ok(systems.includes('return \'won\''));

  const game = readGameFile('game.js');
  assert.ok(game.includes('function renderPlaybookOptions'));
  assert.ok(game.includes('플레이북 선택'));
  assert.ok(game.includes('formatStat'));

  const styles = readGameFile('styles.css');
  assert.ok(styles.includes('--accent-primary: #76d0a4;'));
  assert.ok(styles.includes('aspect-ratio: 16 / 9;'));
  assert.ok(styles.includes('.feedback-strip'));
  assert.ok(styles.includes('.sheet-list'));
  assert.ok(styles.includes('@media (max-width: 980px)'));

  testWaveRollBehavior();

  console.log('dungeonworld survivors static test passed');
}

main();

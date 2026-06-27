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

function loadGameRuntime() {
  const context = { window: {}, Math: Object.create(Math) };
  context.Math.random = () => 0.5;
  vm.createContext(context);

  ['content.js', 'systems.js'].forEach((fileName) => {
    vm.runInContext(readGameFile(fileName), context, { filename: fileName });
  });

  return {
    content: context.window.DungeonworldSurvivorsContent,
    systems: context.window.DungeonworldSurvivorsSystems,
  };
}

function createTrainingEnemy(state, distanceFromPlayer = 96) {
  return {
    ...state.content.enemyTypes.goblin,
    x: state.player.x + distanceFromPlayer,
    y: state.player.y,
    maxHp: state.content.enemyTypes.goblin.hp,
    slowTimer: 0,
    behaviorTimer: 0,
    hitFlash: 0,
  };
}

function testEveryPlaybookStartsAndAttacks() {
  const { content, systems } = loadGameRuntime();
  const expectedAttacks = {
    fighter: 'cleave',
    cleric: 'radiance',
    thief: 'knives',
    druid: 'roots',
    wizard: 'missile',
    ranger: 'arrow',
  };

  assert.strictEqual(
    JSON.stringify(content.playbooks.map((playbook) => playbook.id).sort()),
    JSON.stringify(Object.keys(expectedAttacks).sort())
  );

  content.playbooks.forEach((playbook) => {
    const state = systems.createState(content, playbook.id);
    state.spawnTimer = 99;
    state.enemies = [createTrainingEnemy(state, playbook.id === 'fighter' ? 54 : 120)];

    assert.strictEqual(state.playbook.id, playbook.id);
    assert.strictEqual(state.player.attackStyle, expectedAttacks[playbook.id]);
    assert.ok(playbook.role);
    assert.ok(playbook.survival);

    const result = systems.tick(state, { up: false, down: false, left: false, right: false }, 0.016);
    assert.match(result, /running|level/);

    if (playbook.id === 'fighter') {
      assert.ok(state.attackMarks.some((mark) => mark.kind === 'cleave'));
      assert.ok(state.enemies.length === 0 || state.enemies[0].hp < state.enemies[0].maxHp);
    } else {
      assert.ok(
        state.projectiles.some((projectile) => projectile.kind === expectedAttacks[playbook.id])
        || state.enemies[0].hp < state.enemies[0].maxHp,
        `${playbook.title} should fire or damage with ${expectedAttacks[playbook.id]}`
      );
    }

    const choices = systems.pickUpgrades(state);
    assert.ok(choices.length > 0);
    choices.forEach((upgrade) => {
      assert.ok(upgrade.pools.some((pool) => playbook.upgradePool.includes(pool)));
    });
  });
}

function testBossFlowCanSpawnAndResolveWin() {
  const { content, systems } = loadGameRuntime();
  const state = systems.createState(content, 'fighter');
  state.spawnTimer = 99;
  state.elapsed = 204.99;
  state.enemies = [];

  const spawnResult = systems.tick(state, { up: false, down: false, left: false, right: false }, 0.02);
  assert.strictEqual(spawnResult, 'running');
  assert.strictEqual(state.bossSpawned, true);
  assert.ok(state.enemies.some((enemy) => enemy.behavior === 'boss'));
  assert.strictEqual(content.wavePatterns[state.waveIndex].id, 'finalGate');

  const boss = state.enemies.find((enemy) => enemy.behavior === 'boss');
  boss.hp = 0;
  const winResult = systems.tick(state, { up: false, down: false, left: false, right: false }, 0.016);
  assert.strictEqual(winResult, 'won');
  assert.strictEqual(state.bossDefeated, true);
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
  assert.ok(html.includes('id="role-value"'));
  assert.ok(html.includes('id="attack-value"'));
  assert.ok(html.includes('id="survival-value"'));

  const content = readGameFile('content.js');
  assert.ok(content.includes('playbooks'));
  assert.ok(content.includes('전사'));
  assert.ok(content.includes('도적'));
  assert.ok(content.includes('사제'));
  assert.ok(content.includes('드루이드'));
  assert.ok(content.includes('마법사'));
  assert.ok(content.includes('레인저'));
  assert.ok(content.includes('upgradePool'));
  assert.ok(content.includes('짐승의 형상'));
  assert.ok(content.includes('동료 매의 급강하'));
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
  assert.ok(systems.includes('function fireCleave'));
  assert.ok(systems.includes('function updateHealPulse'));
  assert.ok(systems.includes('function updateCompanionStrike'));
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
  assert.ok(game.includes('function formatAttack'));

  const styles = readGameFile('styles.css');
  assert.ok(styles.includes('--surface-parchment: #2a241c;'));
  assert.ok(styles.includes('aspect-ratio: 16 / 9;'));
  assert.ok(styles.includes('.feedback-strip'));
  assert.ok(styles.includes('.sheet-list'));
  assert.ok(styles.includes('.playbook-option'));
  assert.ok(styles.includes('@media (max-width: 980px)'));

  testWaveRollBehavior();
  testEveryPlaybookStartsAndAttacks();
  testBossFlowCanSpawnAndResolveWin();

  console.log('dungeonworld survivors static test passed');
}

main();

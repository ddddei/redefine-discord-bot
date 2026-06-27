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
  const state = systems.createState(content, 'cleric', { mode: 'demo' });
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

function testRunModesAndStandardTimeline() {
  const { content, systems } = loadGameRuntime();
  const defaultRun = systems.createState(content, 'fighter');
  const demo = systems.createState(content, 'fighter', { mode: 'demo' });
  const quick = systems.createState(content, 'fighter', { mode: 'quick' });
  const standard = systems.createState(content, 'fighter', { mode: 'standard' });

  assert.strictEqual(defaultRun.mode.id, 'standard');
  assert.strictEqual(demo.mode.id, 'demo');
  assert.strictEqual(demo.mode.label, '4분 데모');
  assert.strictEqual(demo.duration, 240);
  assert.strictEqual(quick.mode.id, 'quick');
  assert.strictEqual(quick.mode.label, '10분 빠른 런');
  assert.strictEqual(quick.duration, 600);
  assert.strictEqual(JSON.stringify(quick.mode.eliteSchedule), JSON.stringify([300]));
  assert.strictEqual(quick.mode.bossSpawnAt, 540);
  assert.strictEqual(standard.mode.id, 'standard');
  assert.strictEqual(standard.mode.label, '30분 정식');
  assert.strictEqual(standard.duration, 1800);
  assert.strictEqual(JSON.stringify(standard.mode.eliteSchedule), JSON.stringify([300, 600, 900, 1200, 1500]));
  assert.strictEqual(JSON.stringify(standard.mode.eliteMinutes), JSON.stringify([5, 10, 15, 20, 25]));
  assert.strictEqual(standard.mode.bossSpawnAt, 1740);
  assert.strictEqual(demo.waves[demo.waves.length - 1].id, 'finalGate');
  assert.strictEqual(standard.waves[0].at, 0);
  assert.strictEqual(standard.waves[standard.waves.length - 1].at, 1740);
  assert.strictEqual(standard.waves[standard.waves.length - 1].until, 1800);
  assert.ok(standard.waves.some((wave) => wave.id === 'standard-15-20'));
  assert.strictEqual(systems.getCurrentWave(standard).id, 'standard-0-3');
  standard.elapsed = 1500;
  assert.strictEqual(systems.getCurrentWave(standard).id, 'standard-25-29');
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

function createRuntimeEnemy(state, typeId, distanceFromPlayer = 72) {
  const type = state.content.enemyTypes[typeId];
  return {
    ...type,
    x: state.player.x + distanceFromPlayer,
    y: state.player.y,
    maxHp: type.hp,
    hp: type.hp,
    slowTimer: 0,
    behaviorTimer: 0,
    hitFlash: 0,
    attackCooldown: 0,
    attackWindup: 0,
    attackRecovery: 0,
    attackTarget: null,
    warning: null,
    attackProfile: type.attackProfile,
  };
}

function testEnemyProfilesAndTelegraphs() {
  const { content, systems } = loadGameRuntime();
  assert.ok(content.balance.earlyGame.spawnGrace > 0);
  assert.strictEqual(content.balance.boss.spawnAt, 198);
  assert.ok(content.enemyTypes.mimic);
  assert.ok(content.enemyTypes.cultist);
  Object.keys(content.enemyTypes).forEach((typeId) => {
    const profile = content.enemyTypes[typeId].attackProfile;
    assert.ok(profile, `${typeId} should have attackProfile`);
    assert.ok(profile.range > 0, `${typeId} profile should have range`);
    assert.ok(profile.windup > 0, `${typeId} profile should have windup`);
    assert.ok(profile.recovery > 0, `${typeId} profile should have recovery`);
    assert.ok(profile.shape, `${typeId} profile should have shape`);
    assert.ok(profile.warningLabel, `${typeId} profile should have warningLabel`);
  });
  assert.ok(content.enemyTypes.sentinel.bossPhases.length >= 4);
  assert.ok(content.enemyTypes.sentinel.bossPhases.some((phase) => phase.pattern === 'cross'));

  const state = systems.createState(content, 'fighter');
  assert.strictEqual(state.player.nextXp, content.balance.earlyGame.xpCurve.firstLevel);
  state.spawnTimer = 99;
  state.player.attackTimer = 99;
  state.enemies = [createRuntimeEnemy(state, 'goblin', 46)];
  const beforeHealth = state.player.health;

  systems.tick(state, { up: false, down: false, left: false, right: false }, 0.1);
  assert.strictEqual(state.player.health, beforeHealth);
  assert.ok(state.enemyWarnings.length > 0);

  systems.tick(state, { up: false, down: false, left: false, right: false }, 0.5);
  assert.ok(state.player.health < beforeHealth);

  const avoided = systems.createState(content, 'fighter');
  avoided.spawnTimer = 99;
  avoided.player.attackTimer = 99;
  avoided.enemies = [createRuntimeEnemy(avoided, 'slime', 58)];
  const safeHealth = avoided.player.health;
  systems.tick(avoided, { up: false, down: false, left: false, right: false }, 0.1);
  avoided.player.x += 240;
  systems.tick(avoided, { up: false, down: false, left: false, right: false }, 0.7);
  assert.strictEqual(avoided.player.health, safeHealth);
}

function testWaveHazardsAffectOnlyInsideArea() {
  const { content, systems } = loadGameRuntime();
  const hazardKinds = new Set(content.wavePatterns.flatMap((wave) => wave.hazards.map((hazard) => hazard.kind)));
  assert.ok(hazardKinds.has('mimicBite'));
  assert.ok(hazardKinds.has('thornCross'));
  assert.ok(hazardKinds.has('towerGaze'));
  content.wavePatterns.slice(1).forEach((wave) => {
    assert.ok(wave.objective, `${wave.id} should have objective`);
    assert.ok(wave.hazards.length > 0, `${wave.id} should have hazards`);
  });

  const state = systems.createState(content, 'cleric');
  state.spawnTimer = 99;
  state.player.attackTimer = 99;
  state.hazards.push({
    kind: 'basinPool',
    x: state.player.x,
    y: state.player.y,
    radius: 70,
    warningLeft: 0,
    life: 1,
    maxLife: 1,
    damage: 4,
    colorToken: '--status-info',
    label: '테스트 웅덩이',
    pulseTimer: 0,
  });
  const beforeHealth = state.player.health;
  systems.tick(state, { up: false, down: false, left: false, right: false }, 0.1);
  assert.ok(state.player.health < beforeHealth);

  const outside = systems.createState(content, 'cleric');
  outside.spawnTimer = 99;
  outside.player.attackTimer = 99;
  outside.hazards.push({
    kind: 'basinPool',
    x: outside.player.x + 240,
    y: outside.player.y,
    radius: 70,
    warningLeft: 0,
    life: 1,
    maxLife: 1,
    damage: 4,
    colorToken: '--status-info',
    label: '테스트 웅덩이',
    pulseTimer: 0,
  });
  const safeHealth = outside.player.health;
  systems.tick(outside, { up: false, down: false, left: false, right: false }, 0.1);
  assert.strictEqual(outside.player.health, safeHealth);
}

function testUpgradeMetadataAndSynergies() {
  const { content, systems } = loadGameRuntime();
  content.playbooks.forEach((playbook) => {
    const classUpgrades = content.upgrades.filter((upgrade) => upgrade.pools.includes(playbook.id));
    assert.ok(classUpgrades.length >= 3, `${playbook.id} should have at least three class upgrades`);
  });
  content.upgrades.forEach((upgrade) => {
    assert.ok(upgrade.rarity, `${upgrade.id} should have rarity`);
    assert.ok(Array.isArray(upgrade.tags) && upgrade.tags.length > 0, `${upgrade.id} should have tags`);
    assert.ok(upgrade.classHint, `${upgrade.id} should have classHint`);
    assert.ok(upgrade.synergyText, `${upgrade.id} should have synergyText`);
  });

  const state = systems.createState(content, 'fighter');
  const thornShield = content.upgrades.find((upgrade) => upgrade.id === 'thornShield');
  const shieldBash = content.upgrades.find((upgrade) => upgrade.id === 'shieldBash');
  systems.applyUpgrade(state, thornShield);
  systems.applyUpgrade(state, shieldBash);
  assert.strictEqual(state.selectedUpgrades.length, 2);
  assert.ok(state.buildTags.shield >= 2);
  assert.ok(state.synergies.some((synergy) => synergy.id === 'shieldLine'));

  const summary = systems.getRunSummary(state);
  assert.strictEqual(summary.playbook, '전사');
  assert.match(summary.buildName, /방패선 전사|생존선 전사/);
  assert.ok(summary.buildVerdict);
  assert.ok(summary.buildSummary.includes('시너지'));
  assert.strictEqual(summary.selectedUpgrades.length, 2);
  assert.ok(summary.buildTags.some((entry) => entry.tag === 'shield'));
  assert.ok(summary.synergies.some((synergy) => synergy.title === '방패선'));

  const wizard = systems.createState(content, 'wizard');
  const sigilBattery = content.upgrades.find((upgrade) => upgrade.id === 'sigilBattery');
  const forkedMissile = content.upgrades.find((upgrade) => upgrade.id === 'forkedMissile');
  systems.applyUpgrade(wizard, sigilBattery);
  systems.applyUpgrade(wizard, forkedMissile);
  assert.ok(wizard.buildTags.arcane >= 2);
  assert.ok(wizard.synergies.some((synergy) => synergy.id === 'arcaneWard'));
  assert.ok(wizard.player.shots > 1);
}

function testInventoryEvolutionAndChestRewards() {
  const { content, systems } = loadGameRuntime();
  assert.ok(content.itemCatalog);
  assert.ok(content.itemCatalog.weapons.length >= 6);
  assert.ok(content.itemCatalog.passives.length >= 6);
  assert.ok(content.itemCatalog.evolutions.length >= 6);

  const expectedEvolutions = {
    cleave: '방패선의 회전검',
    knives: '그림자 칼비',
    radiance: '라메의 태양환',
    roots: '고대 뿌리 감옥',
    missile: '검은 서고의 유성',
    arrow: '파수꾼 사냥매',
  };
  Object.entries(expectedEvolutions).forEach(([weaponId, evolvedTitle]) => {
    const weapon = content.itemCatalog.weapons.find((item) => item.id === weaponId);
    const evolution = content.itemCatalog.evolutions.find((item) => item.weaponId === weaponId);
    assert.ok(weapon, `${weaponId} weapon should exist`);
    assert.strictEqual(weapon.maxLevel, 8);
    assert.ok(evolution, `${weaponId} evolution should exist`);
    assert.strictEqual(evolution.title, evolvedTitle);
    assert.ok(content.itemCatalog.passives.some((item) => item.id === evolution.passiveId));
  });
  content.itemCatalog.passives.forEach((passive) => {
    assert.strictEqual(passive.maxLevel, 5);
  });

  const state = systems.createState(content, 'fighter', { mode: 'standard' });
  assert.deepStrictEqual(Object.keys(state.inventory).sort(), ['evolvedWeapons', 'passives', 'weapons'].sort());
  assert.strictEqual(state.inventory.weapons[0].id, 'cleave');
  assert.strictEqual(state.inventory.weapons[0].level, 1);
  assert.strictEqual(systems.getEligibleEvolutions(state).length, 0);

  systems.setInventoryItemLevel(state, 'weapon', 'cleave', 8);
  systems.setInventoryItemLevel(state, 'passive', 'shieldLine', 1);
  const eligible = systems.getEligibleEvolutions(state);
  assert.strictEqual(eligible.length, 1);
  assert.strictEqual(eligible[0].title, '방패선의 회전검');

  const chest = systems.dropChest(state, { x: state.player.x + 1, y: state.player.y });
  assert.strictEqual(state.chests.length, 1);
  systems.collectChests(state);
  assert.strictEqual(state.pendingChestRewards.length, 1);
  const reward = systems.claimChestReward(state);
  assert.strictEqual(reward.type, 'evolution');
  assert.strictEqual(reward.evolution.title, '방패선의 회전검');
  assert.strictEqual(state.pendingChestRewards.length, 0);
  assert.strictEqual(state.inventory.evolvedWeapons[0].id, 'shieldLineSpinningBlade');
  assert.strictEqual(state.chests.includes(chest), false);

  const fallback = systems.createState(content, 'ranger', { mode: 'standard' });
  fallback.upgradeLevels.farShot = 0;
  systems.dropChest(fallback, { x: fallback.player.x, y: fallback.player.y });
  systems.collectChests(fallback);
  const fallbackReward = systems.claimChestReward(fallback);
  assert.match(fallbackReward.type, /weapon|passive|upgrade/);
}

function testStandardEliteDropsChest() {
  const { content, systems } = loadGameRuntime();
  const standard = systems.createState(content, 'fighter', { mode: 'standard' });
  standard.elapsed = 300.01;
  standard.spawnTimer = 99;
  standard.enemies = [];

  systems.tick(standard, { up: false, down: false, left: false, right: false }, 0.02);
  const elite = standard.enemies.find((enemy) => enemy.elite);
  assert.ok(elite);
  assert.strictEqual(elite.eliteMinute, 5);
  elite.hp = 0;
  systems.tick(standard, { up: false, down: false, left: false, right: false }, 0.016);
  assert.strictEqual(standard.chests.length, 1);
  assert.strictEqual(standard.chests[0].source, 'elite');
}

function testRunGoalsSmartRecommendationsAndBossTelemetry() {
  const { content, systems } = loadGameRuntime();
  const goalTypes = new Set(content.runGoals.map((goal) => goal.type));
  ['level_before_boss', 'tag_combo', 'hazard_damage', 'wave_kills', 'boss_avoid', 'boss_time'].forEach((type) => {
    assert.ok(goalTypes.has(type), `runGoals should include ${type}`);
  });

  const ranger = systems.createState(content, 'ranger');
  assert.strictEqual(ranger.runGoals.length, 3);
  assert.ok(ranger.runGoals.some((goal) => goal.type === 'boss_time'));
  let goals = systems.evaluateRunGoals(ranger);
  assert.ok(goals.every((goal) => goal.status));
  assert.ok(goals.some((goal) => goal.progress.includes('/')));

  const hawkMark = content.upgrades.find((upgrade) => upgrade.id === 'hawkMark');
  ranger.upgradeLevels.hawkMark = hawkMark.maxLevel;
  systems.applyUpgrade(ranger, content.upgrades.find((upgrade) => upgrade.id === 'farShot'));
  const choices = systems.pickUpgrades(ranger);
  assert.strictEqual(choices.length, 3);
  assert.strictEqual(
    JSON.stringify(choices.map((upgrade) => upgrade.recommendationRole).sort()),
    JSON.stringify(['방향 전환', '안정 보정', '현재 빌드'].sort())
  );
  choices.forEach((upgrade) => {
    assert.notStrictEqual(upgrade.id, 'hawkMark');
    assert.ok(upgrade.recommendationReason, `${upgrade.id} should explain recommendation`);
    assert.ok((ranger.upgradeLevels[upgrade.id] || 0) < upgrade.maxLevel);
  });

  const thief = systems.createState(content, 'thief');
  thief.spawnTimer = 99;
  thief.player.attackTimer = 99;
  thief.enemies.push(createRuntimeEnemy(thief, 'sentinel', 320));
  thief.bossStartedAt = thief.elapsed;
  thief.bossWarnings.push({
    x: thief.player.x + 360,
    y: thief.player.y,
    kind: 'line',
    label: '테스트 탑 그림자',
    angle: 0,
    width: 42,
    length: 120,
    warningLeft: 0,
    life: 1,
    maxLife: 1,
    damage: 9,
    colorToken: '--accent-bell',
    pulseTimer: 0,
  });
  systems.tick(thief, { up: false, down: false, left: false, right: false }, 0.05);
  assert.strictEqual(thief.bossPatternAvoids, 1);
  assert.ok(thief.player.bossBurstTimer > 0);
  assert.ok(thief.bossContribution.triggers > 0);

  const fighter = systems.createState(content, 'fighter');
  fighter.spawnTimer = 99;
  fighter.player.attackTimer = 99;
  fighter.enemies.push(createRuntimeEnemy(fighter, 'sentinel', 96));
  systems.tick(fighter, { up: false, down: false, left: false, right: false }, 1.5);
  assert.ok(fighter.bossContribution.triggers > 0);
  assert.match(systems.getRunSummary(fighter).bossContribution.label, /근접/);
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
    assert.ok(playbook.accentToken);
    assert.ok(playbook.secondaryToken);
    assert.ok(playbook.crest);
    assert.ok(playbook.combatMood);
    assert.ok(playbook.visualCue);
    assert.strictEqual(state.player.playbookId, playbook.id);
    assert.strictEqual(state.player.accentToken, playbook.accentToken);

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
      state.projectiles.forEach((projectile) => {
        assert.ok(projectile.maxLife);
        assert.ok(projectile.trail);
        assert.ok(projectile.impactKind);
      });
    }

    const choices = systems.pickUpgrades(state);
    assert.ok(choices.length > 0);
    choices.forEach((upgrade) => {
      assert.ok(upgrade.pools.some((pool) => playbook.upgradePool.includes(pool)));
    });
  });
}

function testLargeWorldAndMovementClamp() {
  const { content, systems } = loadGameRuntime();
  assert.ok(systems.WORLD.width > 960);
  assert.ok(systems.WORLD.height > 540);
  assert.ok(systems.WORLD.towerX > systems.WORLD.startX);

  const state = systems.createState(content, 'ranger');
  assert.ok(state.player.x > 0 && state.player.x < systems.WORLD.width);
  assert.ok(state.player.y > 0 && state.player.y < systems.WORLD.height);

  state.player.x = 29;
  state.player.y = 29;
  systems.tick(state, { up: true, down: false, left: true, right: false }, 0.6);
  assert.ok(state.player.x >= 28);
  assert.ok(state.player.y >= 28);

  state.player.x = systems.WORLD.width - 29;
  state.player.y = systems.WORLD.height - 29;
  systems.tick(state, { up: false, down: true, left: false, right: true }, 0.6);
  assert.ok(state.player.x <= systems.WORLD.width - 28);
  assert.ok(state.player.y <= systems.WORLD.height - 28);
}

function testBossFlowCanSpawnAndResolveWin() {
  const { content, systems } = loadGameRuntime();
  const state = systems.createState(content, 'fighter', { mode: 'demo' });
  state.spawnTimer = 99;
  state.elapsed = 204.99;
  state.enemies = [];

  const spawnResult = systems.tick(state, { up: false, down: false, left: false, right: false }, 0.02);
  assert.strictEqual(spawnResult, 'running');
  assert.strictEqual(state.bossSpawned, true);
  assert.ok(state.enemies.some((enemy) => enemy.behavior === 'boss'));
  assert.strictEqual(content.wavePatterns[state.waveIndex].id, 'finalGate');

  const boss = state.enemies.find((enemy) => enemy.behavior === 'boss');
  assert.strictEqual(state.bossPhase.id, 'gateBell');
  boss.hp = boss.maxHp * 0.32;
  systems.tick(state, { up: false, down: false, left: false, right: false }, 0.016);
  assert.strictEqual(state.bossPhase.id, 'lastToll');
  state.bossPatternTimer = 0;
  systems.tick(state, { up: false, down: false, left: false, right: false }, 0.016);
  assert.ok(state.bossWarnings.length > 0);
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
  assert.ok(html.includes('30분을 버티고 마지막 문을 여세요'));
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
  assert.ok(content.includes('balance'));
  assert.ok(content.includes('spawnAt: 198'));
  assert.ok(content.includes('wavePatterns'));
  assert.ok(content.includes('behavior: \'skirmisher\''));
  assert.ok(content.includes('behavior: \'charger\''));
  assert.ok(content.includes('behavior: \'bulwark\''));
  assert.ok(content.includes('behavior: \'ambusher\''));
  assert.ok(content.includes('behavior: \'caster\''));
  assert.ok(content.includes('물그릇 미믹'));
  assert.ok(content.includes('검은 종 신도'));
  assert.ok(content.includes('mimicBite'));
  assert.ok(content.includes('thornCross'));
  assert.ok(content.includes('towerGaze'));
  assert.ok(content.includes('maxLevel'));
  assert.ok(content.includes('토른의 방패 II'));
  assert.ok(content.includes('철의 맹세'));
  assert.ok(content.includes('연막 주머니'));
  assert.ok(content.includes('성역 원'));
  assert.ok(content.includes('뿌리 미로'));
  assert.ok(content.includes('문양 축전'));
  assert.ok(content.includes('매의 표식'));
  assert.ok(content.includes('attackProfile'));
  assert.ok(content.includes('bossPhases'));
  assert.ok(content.includes('brokenGate'));
  assert.ok(content.includes('pressureRule'));
  assert.ok(content.includes('upgradeMeta'));
  assert.ok(content.includes('synergyText'));
  assert.ok(content.includes('runGoals'));
  assert.ok(content.includes('보스 등장 전까지 레벨 8'));
  assert.ok(content.includes('표식이 사라지기 전에'));

  const systems = readGameFile('systems.js');
  assert.ok(systems.includes('RUN_MODES'));
  assert.ok(systems.includes("DEFAULT_RUN_MODE = 'standard'"));
  assert.ok(systems.includes('eliteSchedule: [300, 600, 900, 1200, 1500]'));
  assert.ok(systems.includes('width: 2400'));
  assert.ok(systems.includes('height: 1600'));
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
  assert.ok(systems.includes('function getAttackTrail'));
  assert.ok(systems.includes('impactKind'));
  assert.ok(systems.includes('particles: []'));
  assert.ok(systems.includes('levelShockwave'));
  assert.ok(systems.includes('function spawnDeathParticles'));
  assert.ok(systems.includes('function spawnImpactSparks'));
  assert.ok(systems.includes('function spawnXpAbsorbParticles'));
  assert.ok(systems.includes('function updateParticles'));
  assert.ok(systems.includes('gem.trail'));
  assert.ok(systems.includes('gem.pullMode'));
  assert.ok(systems.includes('function consumeLevelUps'));
  assert.ok(systems.includes('function updateWave'));
  assert.ok(systems.includes('bossDefeated'));
  assert.ok(systems.includes('return \'won\''));
  assert.ok(systems.includes('function updateEnemyAttackState'));
  assert.ok(systems.includes('function updateHazards'));
  assert.ok(systems.includes('function updateBossPatterns'));
  assert.ok(systems.includes('function applyUpgrade'));
  assert.ok(systems.includes('function getRunSummary'));
  assert.ok(systems.includes('applyBalanceAdjustments'));
  assert.ok(systems.includes('warningGrace'));
  assert.ok(systems.includes('hazardResist'));
  assert.ok(systems.includes('function evaluateRunGoals'));
  assert.ok(systems.includes('function scoreCurrentBuild'));
  assert.ok(systems.includes('recommendationRole'));
  assert.ok(systems.includes('bossContribution'));
  assert.ok(systems.includes('bossPatternAvoids'));
  assert.ok(systems.includes('function getEligibleEvolutions'));
  assert.ok(systems.includes('function claimChestReward'));

  const game = readGameFile('game.js');
  assert.ok(game.includes('function renderPlaybookOptions'));
  assert.ok(game.includes('플레이북 선택'));
  assert.ok(game.includes('formatStat'));
  assert.ok(game.includes('function formatAttack'));
  assert.ok(game.includes('visualCue'));
  assert.ok(game.includes('accentToken'));
  assert.ok(game.includes('function renderResultSummary'));
  assert.ok(game.includes('function updateQaOverlay'));
  assert.ok(game.includes('QA balance'));
  assert.ok(game.includes('describeBuildDirection'));
  assert.ok(game.includes('function formatRarity'));
  assert.ok(game.includes('dataset.mode'));
  assert.ok(game.includes("params.get('qa') === '1'"));
  assert.ok(game.includes('quick 모드에서는 10분 빠른 런'));
  assert.ok(game.includes('MODE ${state.mode.id.toUpperCase()}'));
  assert.ok(game.includes('evolution-ready-chip'));
  assert.ok(game.includes('진화 가능: 다음 엘리트 상자를 노리세요'));
  assert.ok(game.includes('recommendation-reason'));
  assert.ok(game.includes('런 목표'));
  assert.ok(game.includes('보스전 기여'));
  assert.ok(game.includes('formatTagBadges'));
  assert.ok(game.includes('result-ledger-head'));
  assert.ok(game.includes('buildName'));
  assert.ok(game.includes('buildVerdict'));

  const renderer = readGameFile('renderer.js');
  assert.ok(renderer.includes('function createCamera'));
  assert.ok(renderer.includes('function applyCamera'));
  assert.ok(renderer.includes('drawScreenOverlays'));
  assert.ok(renderer.includes('drawTower'));
  assert.ok(renderer.includes('drawRoad'));
  assert.ok(renderer.includes('drawProjectileTrail'));
  assert.ok(renderer.includes('function drawPlayerAnchor'));
  assert.ok(renderer.includes('function drawInvulnerabilityShell'));
  assert.ok(renderer.includes('function drawLevelShockwave'));
  assert.ok(renderer.includes('function drawHazard'));
  assert.ok(renderer.includes('function drawWarning'));
  assert.ok(renderer.includes('function drawArmedHazardTicks'));
  assert.ok(renderer.includes('function drawWarningPhaseTicks'));
  assert.ok(renderer.includes('drawLaneShape'));
  assert.ok(renderer.includes('thornCross'));
  assert.ok(renderer.includes('ambusher'));
  assert.ok(renderer.includes('function drawEnemyThreatRing'));
  assert.ok(renderer.includes('function getEnemyOutline'));
  assert.ok(renderer.includes('drawGoblinEnemy'));
  assert.ok(renderer.includes('drawSlimeEnemy'));
  assert.ok(renderer.includes('drawArmorEnemy'));
  assert.ok(renderer.includes('drawWolfEnemy'));
  assert.ok(renderer.includes('drawMimicEnemy'));
  assert.ok(renderer.includes('drawCultistEnemy'));
  assert.ok(renderer.includes('drawSentinelEnemy'));
  assert.ok(renderer.includes('drawJawWarning'));
  assert.ok(renderer.includes('function drawParticle'));
  assert.ok(renderer.includes('function drawGemPullTrail'));
  assert.ok(renderer.includes('state.particles.forEach'));
  assert.ok(renderer.includes('function drawBossStatusHud'));
  assert.ok(renderer.includes('MODE ${modeLabel}'));

  const styles = readGameFile('styles.css');
  assert.ok(styles.includes('--surface-parchment: #2b2116;'));
  assert.ok(styles.includes('--class-fighter'));
  assert.ok(styles.includes('aspect-ratio: 16 / 9;'));
  assert.ok(styles.includes('.feedback-strip'));
  assert.ok(styles.includes('.hud-rail'));
  assert.ok(styles.includes('.hud-chip.mode-demo'));
  assert.ok(styles.includes('.hud-chip.mode-quick'));
  assert.ok(styles.includes('.hud-chip.mode-standard'));
  assert.ok(styles.includes('.boss-chip.boss-active'));
  assert.ok(styles.includes('.boss-chip.evolution-ready-chip'));
  assert.ok(styles.includes('.sheet-list'));
  assert.ok(styles.includes('.playbook-option'));
  assert.ok(styles.includes('.rarity-rare'));
  assert.ok(styles.includes('.result-grid'));
  assert.ok(styles.includes('.synergy-hint'));
  assert.ok(styles.includes('.qa-panel'));
  assert.ok(styles.includes('.build-line'));
  assert.ok(styles.includes('.retry-copy'));
  assert.ok(styles.includes('.recommendation-pill'));
  assert.ok(styles.includes('.run-goal-list'));
  assert.ok(styles.includes('.goal-result-list'));
  assert.ok(styles.includes('.card-seal'));
  assert.ok(styles.includes('.rune-badge'));
  assert.ok(styles.includes('.result-ledger-head'));
  assert.ok(styles.includes('.upgrade-option.evolution-ready'));
  assert.ok(styles.includes('@media (max-width: 980px)'));

  testWaveRollBehavior();
  testRunModesAndStandardTimeline();
  testLargeWorldAndMovementClamp();
  testEveryPlaybookStartsAndAttacks();
  testEnemyProfilesAndTelegraphs();
  testWaveHazardsAffectOnlyInsideArea();
  testUpgradeMetadataAndSynergies();
  testInventoryEvolutionAndChestRewards();
  testStandardEliteDropsChest();
  testRunGoalsSmartRecommendationsAndBossTelemetry();
  testBossFlowCanSpawnAndResolveWin();

  console.log('dungeonworld survivors static test passed');
}

main();

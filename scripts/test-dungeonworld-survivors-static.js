const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME_DIR = path.join(__dirname, '..', 'public', 'dungeonworld-survivors');
const DESIGN_DIR = path.join(__dirname, '..', 'docs', 'design');
const REQUIRED_FILES = [
  'index.html',
  'styles.css',
  'content.js',
  'systems.js',
  'renderer.js',
  'game.js',
];
const ENEMY_SPRITES = {
  'goblin.png': [48, 48],
  'slime.png': [48, 48],
  'armor.png': [48, 48],
  'wolf.png': [64, 40],
  'mimic.png': [56, 56],
  'cultist.png': [56, 56],
  'warden.png': [128, 128],
};
const BACKGROUND_SPRITES = {
  'inn-ground.png': [1832, 859],
  'ruins-ground.png': [1832, 859],
  'forest-ground.png': [1832, 859],
  'basin-ground.png': [1832, 859],
  'basin-setpiece.png': [1832, 859],
  'tower-gate-setpiece.png': [1942, 809],
};

function readGameFile(fileName) {
  return fs.readFileSync(path.join(GAME_DIR, fileName), 'utf8');
}

function readProjectFile(fileName) {
  return fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
}

function readDesignFile(fileName) {
  return fs.readFileSync(path.join(DESIGN_DIR, fileName), 'utf8');
}

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.strictEqual(buffer.toString('ascii', 1, 4), 'PNG', `${filePath} should be a PNG`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function testEnemySpriteAssets() {
  Object.entries(ENEMY_SPRITES).forEach(([fileName, expectedSize]) => {
    const filePath = path.join(GAME_DIR, 'assets', 'enemies', fileName);
    assert.ok(fs.existsSync(filePath), `${fileName} should exist`);
    assert.deepStrictEqual(readPngSize(filePath), expectedSize, `${fileName} should be ${expectedSize.join('x')}`);
  });
}

function testBackgroundSpriteAssets() {
  Object.entries(BACKGROUND_SPRITES).forEach(([fileName, expectedSize]) => {
    const filePath = path.join(GAME_DIR, 'assets', 'backgrounds', fileName);
    assert.ok(fs.existsSync(filePath), `${fileName} should exist`);
    assert.deepStrictEqual(readPngSize(filePath), expectedSize, `${fileName} should be ${expectedSize.join('x')}`);
  });
}

function testBackgroundKeyMappings() {
  const { content, systems } = loadGameRuntime();
  const expectedDemo = {
    skirmish: 'inn',
    roots: 'ruins',
    basin: 'basin',
    forest: 'forest',
    finalGate: 'towerGate',
  };
  const expectedStandard = {
    'standard-0-3': 'inn',
    'standard-3-6': 'ruins',
    'standard-6-9': 'basin',
    'standard-9-12': 'forest',
    'standard-12-15': 'forest',
    'standard-15-20': 'forest',
    'standard-20-25': 'towerGate',
    'standard-25-29': 'towerGate',
    'standard-29-30': 'towerGate',
  };

  Object.entries(expectedDemo).forEach(([waveId, backgroundKey]) => {
    const wave = content.wavePatterns.find((entry) => entry.id === waveId);
    assert.ok(wave, `${waveId} should exist`);
    assert.strictEqual(wave.backgroundKey, backgroundKey);
  });
  Object.entries(expectedStandard).forEach(([waveId, backgroundKey]) => {
    const wave = content.standardWavePatterns.find((entry) => entry.id === waveId);
    assert.ok(wave, `${waveId} should exist`);
    assert.strictEqual(wave.backgroundKey, backgroundKey);
  });
  [...content.scenes, ...content.standardScenes].forEach((scene) => {
    assert.ok(scene.backgroundKey, `${scene.title} should declare backgroundKey`);
  });

  const demo = systems.createState(content, 'fighter', { mode: 'demo' });
  demo.elapsed = 91;
  systems.tick(demo, { up: false, down: false, left: false, right: false }, 0.02);
  assert.strictEqual(demo.waves[demo.waveIndex].id, 'basin');
  assert.strictEqual(demo.waves[demo.waveIndex].backgroundKey, 'basin');

  const standard = systems.createState(content, 'fighter', { mode: 'standard' });
  standard.elapsed = 1201;
  systems.tick(standard, { up: false, down: false, left: false, right: false }, 0.02);
  assert.strictEqual(standard.waves[standard.waveIndex].id, 'standard-20-25');
  assert.strictEqual(standard.waves[standard.waveIndex].backgroundKey, 'towerGate');
}

function testDesignReferenceBoards() {
  const compositeFile = 'dungeonworld-survivors-combat-boss-composite.dc.html';
  const monsterBoardFile = 'dungeonworld-survivors-monster-background-art-board.dc.html';
  const characterBoardFile = 'dungeonworld-survivors-character-art-board.dc.html';
  const backgroundPromptsFile = 'dungeonworld-survivors-background-ai-prompts.dc.html';
  const backgroundConceptBoardFile = 'dungeonworld-survivors-background-concept-board.dc.html';
  [compositeFile, monsterBoardFile, characterBoardFile, backgroundPromptsFile, backgroundConceptBoardFile].forEach((fileName) => {
    assert.ok(fs.existsSync(path.join(DESIGN_DIR, fileName)), `${fileName} should exist`);
  });

  const composite = readDesignFile(compositeFile);
  assert.ok(composite.includes('전투 화면 합본'));
  assert.ok(composite.includes('보스 강림 합본'));
  assert.ok(composite.includes('XP/전조는 엔진') || composite.includes('XP·전조 = 엔진'));

  const monsterBoard = readDesignFile(monsterBoardFile);
  assert.ok(monsterBoard.includes('몬스터'));
  assert.ok(monsterBoard.includes('배경 · 존'));
  assert.ok(monsterBoard.includes('검은 종 파수꾼'));

  const characterBoard = readDesignFile(characterBoardFile);
  assert.ok(characterBoard.includes('6직업'));
  assert.ok(characterBoard.includes('전사'));
  assert.ok(characterBoard.includes('레인저'));

  const backgroundPrompts = readDesignFile(backgroundPromptsFile);
  assert.ok(backgroundPrompts.includes('BACKGROUND AI PROMPTS'));
  assert.ok(backgroundPrompts.includes('B1'));
  assert.ok(backgroundPrompts.includes('B5'));
  assert.ok(backgroundPrompts.includes('Avoid:'));

  const backgroundConceptBoard = readDesignFile(backgroundConceptBoardFile);
  assert.ok(backgroundConceptBoard.includes('배경 시안'));
  assert.ok(backgroundConceptBoard.includes('Background Concepts'));
  assert.ok(backgroundConceptBoard.includes('B1'));
  assert.ok(backgroundConceptBoard.includes('B5'));
  assert.ok(backgroundConceptBoard.includes('bg-sprites.js'));
}

function testEnemySpriteRendererSharpness() {
  const renderer = readGameFile('renderer.js');
  const drawEnemySprite = renderer.match(/function drawEnemySprite\([\s\S]+?\n  }\n\n  function getEnemySpriteMetrics/);
  assert.ok(drawEnemySprite, 'drawEnemySprite should be present');
  assert.ok(drawEnemySprite[0].includes('const previousSmoothing = ctx.imageSmoothingEnabled;'));
  assert.ok(drawEnemySprite[0].includes('ctx.imageSmoothingEnabled = false;'));
  assert.ok(drawEnemySprite[0].includes('ctx.imageSmoothingEnabled = previousSmoothing;'));
  assert.ok(drawEnemySprite[0].includes("if (enemy.hitFlash > 0) ctx.filter = 'brightness(1.75)';"));
  assert.ok(drawEnemySprite[0].includes('Math.round(wobble)'));
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

function testEarlyGamePacingAndUpgradeRoleClarity() {
  const { content, systems } = loadGameRuntime();
  assert.strictEqual(content.balance.earlyGame.xpCurve.firstLevel, 4);
  assert.ok(content.balance.earlyGame.spawnGrace >= 1.5);
  assert.ok(content.balance.earlyGame.baseSpawnCadence >= 1.25);
  assert.ok(content.balance.earlyGame.contactDamageScale < 1);
  assert.ok(content.balance.earlyGame.contactDamageScaleUntil >= 60);

  const fighter = systems.createState(content, 'fighter', { mode: 'standard' });
  let firstLevelAt = null;
  let maxEnemies = 0;
  for (let step = 0; step < 600; step += 1) {
    const result = systems.tick(fighter, { up: false, down: false, left: false, right: true }, 0.1);
    if (result === 'level' && firstLevelAt === null) firstLevelAt = fighter.elapsed;
    maxEnemies = Math.max(maxEnemies, fighter.enemies.length);
    if (result === 'lost') break;
  }

  assert.ok(firstLevelAt !== null && firstLevelAt <= 45, `first level should arrive early, got ${firstLevelAt}`);
  assert.ok(fighter.kills >= 8, `first minute should create an active XP flow, got ${fighter.kills} kills`);
  assert.ok(maxEnemies <= 45, `first minute should not flood the screen, got ${maxEnemies} enemies`);
  assert.ok(fighter.player.health > fighter.player.maxHealth * 0.55, 'early contact pressure should leave room to recover');

  const choices = systems.pickUpgrades(fighter);
  assert.strictEqual(
    JSON.stringify(choices.map((upgrade) => upgrade.recommendationRole)),
    JSON.stringify(['현재 빌드', '방향 전환', '안정 보정'])
  );
  assert.strictEqual(new Set(choices.map((upgrade) => upgrade.recommendationReason)).size, 3);
  choices.forEach((upgrade) => {
    assert.ok(upgrade.recommendationReason.length <= 28, `${upgrade.id} recommendation should stay short`);
  });
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
  assert.match(summary.buildName, /철문 파쇄자|방패선 전사|생존선 전사/);
  assert.ok(summary.buildVerdict);
  assert.ok(summary.buildSummary.includes('시너지'));
  assert.strictEqual(summary.classUltimate.ready, true);
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
  let shieldBashState = systems.getUpgradeEvolutionState(state, content.upgrades.find((upgrade) => upgrade.id === 'shieldBash'));
  assert.strictEqual(shieldBashState.status, 'progress');
  assert.match(shieldBashState.text, /방패선/);
  systems.setInventoryItemLevel(state, 'passive', 'shieldLine', 1);
  const eligible = systems.getEligibleEvolutions(state);
  assert.strictEqual(eligible.length, 1);
  assert.strictEqual(eligible[0].title, '방패선의 회전검');
  shieldBashState = systems.getUpgradeEvolutionState(state, content.upgrades.find((upgrade) => upgrade.id === 'shieldBash'));
  assert.strictEqual(shieldBashState.status, 'ready');
  assert.match(shieldBashState.text, /다음 상자/);
  const evolutionPlan = systems.getEvolutionPlan(state, eligible[0]);
  assert.strictEqual(evolutionPlan.weaponTitle, '철의 베기');
  assert.strictEqual(evolutionPlan.passiveTitle, '방패선');
  assert.strictEqual(evolutionPlan.ready, true);

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
  assert.ok(content.elitePatterns, 'elitePatterns should exist');
  ['armor', 'mimic', 'cultist', 'wolf'].forEach((typeId) => {
    assert.ok(content.elitePatterns[typeId], `${typeId} elite pattern should exist`);
    assert.ok(content.elitePatterns[typeId].title, `${typeId} elite pattern should have title`);
    assert.ok(content.elitePatterns[typeId].modifier, `${typeId} elite pattern should have modifier`);
  });

  const standard = systems.createState(content, 'fighter', { mode: 'standard' });
  standard.elapsed = 300.01;
  standard.spawnTimer = 99;
  standard.enemies = [];

  systems.tick(standard, { up: false, down: false, left: false, right: false }, 0.02);
  const elite = standard.enemies.find((enemy) => enemy.elite);
  assert.ok(elite);
  assert.strictEqual(elite.eliteMinute, 5);
  assert.ok(elite.elitePattern);
  assert.ok(elite.elitePatternTitle);
  assert.ok(elite.attackProfile.warningLabel.includes('엘리트') || elite.name.includes('엘리트'));
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

function testClassUltimatesAndBuildNames() {
  const { content, systems } = loadGameRuntime();
  content.playbooks.forEach((playbook) => {
    assert.ok(playbook.ultimate, `${playbook.id} should define an ultimate`);
    assert.ok(playbook.ultimate.title, `${playbook.id} ultimate should have title`);
    assert.ok(playbook.ultimate.resultName, `${playbook.id} ultimate should have resultName`);
    assert.ok(playbook.ultimate.tags.length >= 2, `${playbook.id} ultimate should declare tags`);
  });

  const fighter = systems.createState(content, 'fighter');
  systems.applyUpgrade(fighter, content.upgrades.find((upgrade) => upgrade.id === 'shieldBash'));
  systems.applyUpgrade(fighter, content.upgrades.find((upgrade) => upgrade.id === 'ironVow'));
  const fighterSummary = systems.getRunSummary(fighter);
  assert.ok(fighterSummary.classUltimate);
  assert.strictEqual(fighterSummary.classUltimate.ready, true);
  assert.match(fighterSummary.buildName, /철문 파쇄자|방패선/);

  const thief = systems.createState(content, 'thief');
  systems.applyUpgrade(thief, content.upgrades.find((upgrade) => upgrade.id === 'shadowStep'));
  systems.applyUpgrade(thief, content.upgrades.find((upgrade) => upgrade.id === 'backstabRhythm'));
  const thiefSummary = systems.getRunSummary(thief);
  assert.strictEqual(thiefSummary.classUltimate.ready, true);
  assert.match(thiefSummary.buildName, /그림자 칼비꾼|칼날 박자/);
}

function testMobileHardeningAndSilence() {
  const html = readGameFile('index.html');
  assert.ok(html.includes('viewport-fit=cover'), 'viewport meta should include viewport-fit=cover');
  assert.ok(html.includes('theme-color'), 'theme-color meta should exist');
  assert.ok(html.includes('background-color: #090a09'), 'body should inline background color to avoid white flash');
  assert.ok(html.includes('virtual-stick-zone'), 'virtual stick zone element should exist');
  assert.ok(html.includes('virtual-stick-base'));
  assert.ok(html.includes('virtual-stick-knob'));
  assert.ok(html.includes('orientation-hint'), 'landscape recommendation copy should exist');

  const styles = readGameFile('styles.css');
  assert.ok(styles.includes('100dvh'), 'dvh unit should be used for viewport height');
  assert.ok(!styles.includes('background-attachment: fixed'), 'iOS-problematic fixed background should not be used');
  assert.ok(styles.includes('env(safe-area-inset-bottom'), 'safe-area padding should exist');
  assert.ok(styles.includes('.virtual-stick-zone'));
  assert.ok(styles.includes('.virtual-stick-base'));
  assert.ok(styles.includes('.virtual-stick-knob'));

  const game = readGameFile('game.js');
  assert.ok(game.includes('setPointerCapture'), 'virtual stick should use Pointer Events with setPointerCapture');
  assert.ok(game.includes('pointerdown'));
  assert.ok(game.includes('pointermove'));
  assert.ok(game.includes('pointerup'));
  assert.ok(game.includes('STICK_DEAD_ZONE'));
  assert.ok(game.includes('STICK_RADIUS'));
  assert.ok(game.includes('loadDeferredSprites'), '첫 화면 전송량 예산 - 적/배경 원화는 런 시작 시점에 지연 로드해야 합니다');
  assert.ok(game.includes('renderer.preloadEnemySprites();'));
  assert.ok(game.includes('renderer.preloadBackgroundSprites();'));
  // 부팅 시점 최상위 호출(2-space 들여쓰기, IIFE 바로 아래)만 클래스 스프라이트여야 하고
  // 적/배경 스프라이트 호출은 loadDeferredSprites 함수 본문(4칸 이상 들여쓰기) 안에만 있어야 한다.
  const topLevelPreloadCalls = game.match(/^  renderer\.preload\w+\(\);$/gm) || [];
  assert.deepStrictEqual(topLevelPreloadCalls, ['  renderer.preloadClassSprites();'], '부팅 시 최상위 호출은 클래스 스프라이트 하나만이어야 합니다(첫 화면 전송량 예산)');

  [readGameFile('game.js'), readGameFile('systems.js'), readGameFile('renderer.js'), html].forEach((source) => {
    assert.ok(!source.includes('new Audio'), '무음 유지 - new Audio 사용 금지');
    assert.ok(!source.includes('navigator.vibrate'), '무진동 유지 - navigator.vibrate 사용 금지');
    assert.ok(!/Notification\(/.test(source), '네이티브 알림 사용 금지');
  });
}

function testBossEncounterPresentation() {
  const systemsSource = readGameFile('systems.js');
  assert.ok(systemsSource.includes('검은 종 파수꾼이 문을 등지고 섰다'), '보스 등장 경고 배너 문구가 계획서 그대로여야 합니다');
  const renderer = readGameFile('renderer.js');
  assert.ok(renderer.includes('function drawBossStatusHud'), '보스 전용 체력바 렌더 함수가 있어야 합니다');
  assert.ok(renderer.includes("boss ? '검은 종 파수꾼'"), '보스 전용 체력바에 보스명이 표시되어야 합니다');
  assert.ok(renderer.includes('phaseLabel'), '보스 체력바에 패턴/페이즈명 캡션이 있어야 합니다');

  const { content, systems } = loadGameRuntime();
  const state = systems.createState(content, 'fighter', { mode: 'demo' });
  state.spawnTimer = 99;
  state.elapsed = 204.99;
  state.enemies = [];
  systems.tick(state, { up: false, down: false, left: false, right: false }, 0.02);
  assert.ok(state.floaters.some((floater) => floater.text === '검은 종 파수꾼이 문을 등지고 섰다'));
  const banner = state.floaters.find((floater) => floater.text === '검은 종 파수꾼이 문을 등지고 섰다');
  assert.strictEqual(banner.maxLife, 2, '보스 경고 배너는 2초 노출이어야 합니다');
}

function testCombatFeedbackHitVignetteAndDamageNumbers() {
  const { content, systems } = loadGameRuntime();
  const renderer = readGameFile('renderer.js');
  assert.ok(renderer.includes('function drawHitVignette'), '피격 비네트 렌더 함수가 있어야 합니다');
  assert.ok(renderer.includes('function drawDamageNumbers'), '데미지 숫자 렌더 함수가 있어야 합니다');
  assert.ok(renderer.includes('drawHitVignette(ctx, state, palette, canvas);'), 'drawScreenOverlays가 비네트를 그려야 합니다');
  assert.ok(renderer.includes("gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');") && renderer.includes('createRadialGradient'), '비네트는 중앙이 비고 가장자리만 강조되는 방사형이어야 합니다(풀스크린 플래시 금지)');

  const state = systems.createState(content, 'fighter', { mode: 'quick' });
  state.spawnTimer = 99;
  state.player.attackTimer = 99;
  state.enemies = [createRuntimeEnemy(state, 'goblin', 46)];
  // windup(0.38초)이 아주 조금 남을 때까지 잘게 진행한 뒤, 마지막 한 프레임만 작은 dt로
  // 넘겨 명중을 발동시킨다 - hitVignette(0.2초 감쇠)가 같은 프레임 감쇠로 곧장 지워지지
  // 않게 dt를 작게 유지한다(실제 게임 프레임(약 16ms)과 유사한 크기).
  const startHealth = state.player.health;
  let hit = false;
  for (let step = 0; step < 200 && !hit; step += 1) {
    systems.tick(state, { up: false, down: false, left: false, right: false }, 0.016);
    if (state.player.health < startHealth) hit = true;
  }
  assert.ok(hit, '공격이 명중해 체력이 줄어야 합니다');
  assert.ok(state.effects.hitVignette > 0, '피격 시 hitVignette가 트리거되어야 합니다(피격 직후 프레임)');

  const dmgState = systems.createState(content, 'fighter', { mode: 'quick' });
  dmgState.spawnTimer = 99;
  dmgState.player.attackTimer = 0;
  dmgState.enemies = [createRuntimeEnemy(dmgState, 'goblin', 40)];
  systems.tick(dmgState, { up: false, down: false, left: false, right: false }, 0.016);
  assert.ok(Array.isArray(dmgState.damageNumbers));
  assert.ok(dmgState.damageNumbers.length > 0, '전사 베기 명중 시 데미지 숫자가 생성되어야 합니다');

  const toggledOff = systems.createState(content, 'fighter', { mode: 'quick' });
  toggledOff.damageNumbersEnabled = false;
  toggledOff.spawnTimer = 99;
  toggledOff.player.attackTimer = 0;
  toggledOff.enemies = [createRuntimeEnemy(toggledOff, 'goblin', 40)];
  systems.tick(toggledOff, { up: false, down: false, left: false, right: false }, 0.016);
  assert.strictEqual(toggledOff.damageNumbers.length, 0, '토글을 끄면 데미지 숫자가 생성되지 않아야 합니다');

  const html = readGameFile('index.html');
  assert.ok(html.includes('damage-numbers-toggle'), '데미지 숫자 토글 UI가 있어야 합니다');
}

function testVirtualStickDrivesSharedMovementPath() {
  const { content, systems } = loadGameRuntime();
  const state = systems.createState(content, 'fighter', { mode: 'quick' });
  const before = { x: state.player.x, y: state.player.y };
  systems.tick(state, { up: false, down: false, left: false, right: false, vx: 1, vy: 0 }, 0.5);
  assert.ok(state.player.x > before.x, '가상 스틱 analog vx가 기존 이동 로직을 통해 반영되어야 합니다');

  const keyboardState = systems.createState(content, 'fighter', { mode: 'quick' });
  const keyboardBefore = { x: keyboardState.player.x, y: keyboardState.player.y };
  systems.tick(keyboardState, { up: false, down: false, left: false, right: true, vx: null, vy: null }, 0.5);
  assert.ok(keyboardState.player.x > keyboardBefore.x, '키보드 digital 입력도 동일 경로로 계속 동작해야 합니다(회귀 없음)');
  assert.strictEqual(
    Math.round(state.player.x * 100),
    Math.round(keyboardState.player.x * 100),
    '가상 스틱과 키보드가 동일한 이동 로직 함수를 타야 합니다(분기 신설 금지)'
  );
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
  assert.ok(content.includes('contactDamageScale'));
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
  assert.ok(content.includes("backgroundKey: 'basin'"));
  assert.ok(content.includes("backgroundKey: 'towerGate'"));
  assert.ok(content.includes('elitePatterns'));
  assert.ok(content.includes('ultimate'));
  assert.ok(content.includes('resultName'));

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
  assert.ok(systems.includes('function getEarlyContactDamageScale'));
  assert.ok(systems.includes('warningGrace'));
  assert.ok(systems.includes('hazardResist'));
  assert.ok(systems.includes('function evaluateRunGoals'));
  assert.ok(systems.includes('function scoreCurrentBuild'));
  assert.ok(systems.includes('recommendationRole'));
  assert.ok(systems.includes('bossContribution'));
  assert.ok(systems.includes('bossPatternAvoids'));
  assert.ok(systems.includes('function getEligibleEvolutions'));
  assert.ok(systems.includes('function claimChestReward'));
  assert.ok(systems.includes('function applyElitePattern'));
  assert.ok(systems.includes('function evaluateClassUltimate'));
  assert.ok(systems.includes('classUltimate'));

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
  assert.ok(game.includes('reward-quick-grid'));
  assert.ok(game.includes('function shortenRecommendation'));
  assert.ok(game.includes('function renderLevelPips'));
  assert.ok(game.includes('function formatRecommendationRoleClass'));
  assert.ok(game.includes('function formatEvolutionComparison'));
  assert.ok(game.includes('renderer.preloadEnemySprites();'));
  assert.ok(game.includes('renderer.preloadBackgroundSprites();'));
  assert.ok(game.includes('renderer.getBackgroundRenderInfo'));
  assert.ok(game.includes('window.DungeonworldSurvivorsQa'));
  assert.ok(game.includes('forceBackgroundFailure(spriteId)'));
  assert.ok(game.includes('런 목표'));
  assert.ok(game.includes('보스전 기여'));
  assert.ok(game.includes('formatTagBadges'));
  assert.ok(game.includes('result-ledger-head'));
  assert.ok(game.includes('buildName'));
  assert.ok(game.includes('buildVerdict'));
  assert.ok(game.includes('readability'));
  assert.ok(game.includes('classUltimate'));
  assert.ok(game.includes('activeElitePatterns'));

  const renderer = readGameFile('renderer.js');
  assert.ok(renderer.includes('function createCamera'));
  assert.ok(renderer.includes('function applyCamera'));
  assert.ok(renderer.includes('drawScreenOverlays'));
  assert.ok(renderer.includes('drawTower'));
  assert.ok(renderer.includes('drawRoad'));
  assert.ok(renderer.includes('drawProjectileTrail'));
  assert.ok(renderer.includes('function drawPlayerAnchor'));
  assert.ok(renderer.includes('function drawPlayerMiniatureBody'));
  assert.ok(renderer.includes('classSprites'));
  assert.ok(renderer.includes('enemySprites'));
  assert.ok(renderer.includes('backgroundSprites'));
  assert.ok(renderer.includes('assets/classes/'));
  assert.ok(renderer.includes('assets/enemies/'));
  assert.ok(renderer.includes('assets/backgrounds/'));
  assert.ok(renderer.includes('BACKGROUND_SPRITE_SPECS'));
  assert.ok(renderer.includes('function preloadClassSprites'));
  assert.ok(renderer.includes('function preloadEnemySprites'));
  assert.ok(renderer.includes('function preloadBackgroundSprites'));
  assert.ok(renderer.includes('function getPlayerClassSprite'));
  assert.ok(renderer.includes('function getEnemySprite'));
  assert.ok(renderer.includes('function getBackgroundSprite'));
  assert.ok(renderer.includes("inn: { file: 'inn-ground.png', kind: 'ground' }"));
  assert.ok(renderer.includes("basin: { file: 'basin-ground.png', kind: 'ground' }"));
  assert.ok(renderer.includes("basinSetpiece: { file: 'basin-setpiece.png', kind: 'setpiece' }"));
  assert.ok(renderer.includes("towerGate: { file: 'tower-gate-setpiece.png', kind: 'setpiece' }"));
  assert.ok(renderer.includes('function resolveBackgroundKey'));
  assert.ok(renderer.includes('function resolveGroundBackgroundId'));
  assert.ok(renderer.includes('function drawBackgroundSprites'));
  assert.ok(renderer.includes('function drawGroundBackgroundSprite'));
  assert.ok(renderer.includes('function drawBasinSetpiece'));
  assert.ok(renderer.includes('function drawTowerGateSetpiece'));
  assert.ok(renderer.includes('function getBackgroundRenderInfo'));
  assert.ok(renderer.includes('markBackgroundSpriteFailedForQa'));
  assert.ok(renderer.includes('function drawProceduralBackground'));
  assert.ok(renderer.includes('if (!groundSprite) return false;'));
  assert.ok(renderer.includes('drawProceduralBackground(ctx, world, camera, state.elapsed, palette);'));
  assert.ok(renderer.includes('function drawPlayerClassSprite'));
  assert.ok(renderer.includes('function drawEnemySprite'));
  assert.ok(renderer.includes('function drawProceduralEnemy'));
  assert.ok(renderer.includes('if (enemySprite)'));
  assert.ok(renderer.includes("boss: 'warden'"));
  assert.ok(renderer.includes('if (classSprite)'));
  assert.ok(renderer.includes('} else {'));
  assert.ok(renderer.includes('ctx.drawImage(image'));
  assert.ok(renderer.includes('ctx.imageSmoothingEnabled = false'));
  assert.ok(renderer.includes('ctx.imageSmoothingEnabled = previousSmoothing;'));
  assert.ok(renderer.includes('Math.round(wobble)'));
  assert.ok(renderer.includes('function drawInvulnerabilityShell'));
  assert.ok(renderer.includes('function drawLevelShockwave'));
  assert.ok(renderer.includes('function drawHazard'));
  assert.ok(renderer.includes('function drawWarning'));
  assert.ok(renderer.includes('function drawArmedHazardTicks'));
  assert.ok(renderer.includes('function drawWarningPhaseTicks'));
  assert.ok(renderer.includes('function drawCrackRunes'));
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
  assert.ok(renderer.includes('surfaceTower'));
  assert.ok(renderer.includes('accentBrass'));
  assert.ok(renderer.includes('preloadBackgroundSprites,'));
  assert.ok(renderer.includes('function drawCombatReadabilityScrim'));
  assert.ok(renderer.includes('function drawGemHalo'));
  assert.ok(renderer.includes('function getCombatReadabilityInfo'));
  assert.ok(renderer.includes('bossPhase'));

  const styles = readGameFile('styles.css');
  assert.ok(styles.includes('--surface-parchment: #241b12;'));
  assert.ok(styles.includes('--surface-iron: #171717;'));
  assert.ok(styles.includes('--surface-tower: #070706;'));
  assert.ok(styles.includes('--accent-brass: #9c7b45;'));
  assert.ok(styles.includes('--accent-bell: #5d527d;'));
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
  assert.ok(styles.includes('.level-pips'));
  assert.ok(styles.includes('.level-pip.next'));
  assert.ok(styles.includes('.upgrade-option.role-current'));
  assert.ok(styles.includes('.upgrade-option.role-pivot'));
  assert.ok(styles.includes('.upgrade-option.role-stable'));
  assert.ok(styles.includes('.run-goal-list'));
  assert.ok(styles.includes('.goal-result-list'));
  assert.ok(styles.includes('.card-seal'));
  assert.ok(styles.includes('.rune-badge'));
  assert.ok(styles.includes('.result-ledger-head'));
  assert.ok(styles.includes('.upgrade-option.evolution-ready'));
  assert.ok(styles.includes('@media (max-width: 980px)'));

  const designDirection = readProjectFile('docs/dungeonworld-survivors-design-direction.md');
  assert.ok(designDirection.includes('검은탑은 게임의 중심 목적지'));
  assert.ok(designDirection.includes('마지막 문'));
  assert.ok(designDirection.includes('검은 종은 탑의 저주와 보스 패턴을 상징하는 서브 모티프'));
  assert.ok(designDirection.includes('## 4. 네온/아기자기함 제거 기준'));
  assert.ok(designDirection.includes('## 5. 피해야 할 디자인 방향'));

  const webGameDoc = readProjectFile('docs/dungeonworld-survivors-web-game.md');
  assert.ok(webGameDoc.includes('중심 목표는 검은탑의 마지막 문'));
  assert.ok(webGameDoc.includes('검은 종은 탑에서 울리는 저주와 보스 패턴의 신호'));
  assert.ok(webGameDoc.includes('네온 장판이 아니라 낮은 투명도의 피빛 의식선'));
  assert.ok(webGameDoc.includes('assets/enemies/<enemy>.png'));
  assert.ok(webGameDoc.includes('스프라이트가 없거나 로드에 실패하면 기존 절차형 적 렌더로 폴백'));
  assert.ok(webGameDoc.includes('디자인 보드 HTML은 `docs/design/` 아래에 보관'));
  assert.ok(webGameDoc.includes('docs/design/dungeonworld-survivors-background-ai-prompts.dc.html'));
  assert.ok(webGameDoc.includes('docs/design/dungeonworld-survivors-background-concept-board.dc.html'));
  assert.ok(webGameDoc.includes('배경 시안 보드는 `docs/design/dungeonworld-survivors-background-concept-board.dc.html`에 보관'));
  assert.ok(webGameDoc.includes('bg-sprites.js` 의존성이 필요'));
  assert.ok(webGameDoc.includes('B1~B3는 낮은 채도/낮은 대비의 바닥/존 배경으로 사용'));
  assert.ok(webGameDoc.includes('B4는 `basin-ground.png` 바닥과 `basin-setpiece.png` 물그릇 세트피스를 함께 사용'));
  assert.ok(webGameDoc.includes('B5는 반복 배경이 아니라 검은탑과 마지막 문을 위한 대형 세트피스로 사용'));
  assert.ok(webGameDoc.includes('public/dungeonworld-survivors/assets/backgrounds/inn-ground.png'));
  assert.ok(webGameDoc.includes('public/dungeonworld-survivors/assets/backgrounds/tower-gate-setpiece.png'));
  assert.ok(webGameDoc.includes('public/dungeonworld-survivors/assets/backgrounds/basin-ground.png'));
  assert.ok(webGameDoc.includes('현재 `basin-setpiece.png`는 중앙 물그릇/웅덩이 세트피스로 사용'));
  assert.ok(webGameDoc.includes('wave/scene의 `backgroundKey`'));
  assert.ok(webGameDoc.includes('node scripts/smoke-dungeonworld-survivors-browser.js'));
  assert.ok(webGameDoc.includes('배경 스프라이트가 없거나 로드 실패하면 기존 절차형 배경으로 폴백'));
  assert.ok(webGameDoc.includes('XP, 공격 전조, 위험선, HUD, 보스 체력바는 이미지화하지 않고 기존 엔진 렌더를 유지'));
  assert.ok(webGameDoc.includes('XP 보석, 공격 전조, 위험선, HUD, 체력바, 보스 체력바는 배경 이미지에 넣지 않고 기존 엔진 렌더를 유지'));
  assert.ok(webGameDoc.includes('v3 전투 가독성'));
  assert.ok(webGameDoc.includes('엘리트 패턴'));
  assert.ok(webGameDoc.includes('직업별 궁극기'));

  testDesignReferenceBoards();
  testEnemySpriteRendererSharpness();
  testEnemySpriteAssets();
  testBackgroundSpriteAssets();
  testBackgroundKeyMappings();
  testWaveRollBehavior();
  testRunModesAndStandardTimeline();
  testEarlyGamePacingAndUpgradeRoleClarity();
  testLargeWorldAndMovementClamp();
  testEveryPlaybookStartsAndAttacks();
  testEnemyProfilesAndTelegraphs();
  testWaveHazardsAffectOnlyInsideArea();
  testUpgradeMetadataAndSynergies();
  testInventoryEvolutionAndChestRewards();
  testStandardEliteDropsChest();
  testRunGoalsSmartRecommendationsAndBossTelemetry();
  testBossFlowCanSpawnAndResolveWin();
  testClassUltimatesAndBuildNames();
  testMobileHardeningAndSilence();
  testVirtualStickDrivesSharedMovementPath();
  testCombatFeedbackHitVignetteAndDamageNumbers();
  testBossEncounterPresentation();

  console.log('dungeonworld survivors static test passed');
}

main();

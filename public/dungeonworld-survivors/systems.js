(function () {
  const RUN_MODES = {
    demo: {
      id: 'demo',
      title: '4분 데모',
      label: '4분 데모',
      duration: 240,
      wavesKey: 'wavePatterns',
      scenesKey: 'scenes',
      bossAt: 198,
      bossSpawnAt: 198,
      eliteMinutes: [],
      eliteSchedule: [],
    },
    quick: {
      id: 'quick',
      title: '10분 퀵 런',
      label: '10분 빠른 런',
      duration: 600,
      wavesKey: 'standardWavePatterns',
      scenesKey: 'standardScenes',
      bossAt: 540,
      bossSpawnAt: 540,
      eliteMinutes: [5],
      eliteSchedule: [300],
    },
    standard: {
      id: 'standard',
      title: '30분 정식 런',
      label: '30분 정식',
      duration: 1800,
      wavesKey: 'standardWavePatterns',
      scenesKey: 'standardScenes',
      bossAt: 1740,
      bossSpawnAt: 1740,
      eliteMinutes: [5, 10, 15, 20, 25],
      eliteSchedule: [300, 600, 900, 1200, 1500],
    },
  };
  // 세션 구조(계획서 4절): 기본 URL은 10분 퀵 런. 30분은 ?mode=long(standard 내부
  // 식별자 유지, URL 파라미터만 long으로 매핑 - game.js getRequestedMode).
  const DEFAULT_RUN_MODE = 'quick';
  const UPGRADE_ITEM_LINKS = {
    shieldBash: { type: 'weapon', id: 'cleave' },
    ironVow: { type: 'passive', id: 'shieldLine' },
    shadowStep: { type: 'passive', id: 'shadowStepPassive' },
    fanKnives: { type: 'weapon', id: 'knives' },
    healingLitany: { type: 'passive', id: 'rameLeafPassive' },
    sanctuaryCircle: { type: 'weapon', id: 'radiance' },
    beastForm: { type: 'passive', id: 'ancientRootPassive' },
    rootMaze: { type: 'weapon', id: 'roots' },
    grimGrimoire: { type: 'passive', id: 'blackLibraryPassive' },
    forkedMissile: { type: 'weapon', id: 'missile' },
    hawkMark: { type: 'passive', id: 'sentinelMarkPassive' },
    snareArrow: { type: 'weapon', id: 'arrow' },
  };
  const WORLD = {
    width: 2400,
    height: 1600,
    startX: 420,
    startY: 1060,
    towerX: 2060,
    towerY: 300,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function normalize(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  }

  function createPlayer(playbook, balance) {
    const player = {
      x: WORLD.startX, y: WORLD.startY,
      radius: 15, maxHealth: 100, health: 100, speed: 168,
      armor: 0, damage: 18, attackCooldown: 0.62, attackTimer: 0,
      invulnerableTimer: 0, hazardSlowTimer: 0, magnet: 74, level: 1, xp: 0, nextXp: 6,
      stats: { str: 0, dex: 0, wis: 0, will: 0 },
      tension: 0,
      maxTension: 12,
      tensionResist: 0,
      tensionSpeed: 0,
      moveGrace: 0,
      attackStyle: 'knife',
      shots: 1, pierce: 0,
      projectileSpeed: 420,
      projectileRadius: 5,
      projectileLife: 1.4,
      cleaveRange: 0,
      cleaveArc: Math.PI * 0.62,
      cleaveSlow: 0,
      rootSlow: 0,
      dodgeChance: 0,
      aura: false,
      auraDamage: 0,
      auraRange: 106,
      auraTimer: 0,
      healPulse: 0,
      healTimer: 0,
      fanKnives: 0,
      fanTimer: 0,
      fanCooldownBonus: 0,
      orbitingSpears: 0,
      orbitTimer: 0,
      bellWave: 0,
      bellTimer: 0,
      arcaneShield: 0,
      arcaneShieldTimer: 0,
      companionStrike: 0,
      companionTimer: 0,
      spawnPressure: 0,
      bossDamageBonus: 0,
      bossBurstTimer: 0,
      bossSpellTimer: 0,
      bossCloseTimer: 0,
      warningGrace: 0,
      hazardResist: 0,
      healBonus: 0,
      arcaneShieldCooldownBonus: 0,
      facing: 0,
      playbookId: playbook ? playbook.id : 'fighter',
      accentToken: playbook ? playbook.accentToken : '--accent-primary',
      secondaryToken: playbook ? playbook.secondaryToken : '--accent-primary',
      crest: playbook ? playbook.crest : 'shield',
    };
    if (playbook) {
      player.stats = { ...player.stats, ...playbook.stats };
      player.attackStyle = playbook.attack || player.attackStyle;
      playbook.apply(player);
      applyBalanceAdjustments(player, playbook.id, balance);
    }
    return player;
  }

  function applyBalanceAdjustments(player, playbookId, balance) {
    const earlyGame = balance && balance.earlyGame;
    if (earlyGame && earlyGame.xpCurve) player.nextXp = earlyGame.xpCurve.firstLevel;
    const adjustment = earlyGame && earlyGame.classAdjustments && earlyGame.classAdjustments[playbookId];
    if (!adjustment) return;
    if (adjustment.damage) player.damage += adjustment.damage;
    if (adjustment.magnet) player.magnet += adjustment.magnet;
    if (adjustment.auraDamage) player.auraDamage += adjustment.auraDamage;
    if (adjustment.auraRange) player.auraRange += adjustment.auraRange;
    if (adjustment.rootSlow) player.rootSlow += adjustment.rootSlow;
    if (adjustment.projectileSpeed) player.projectileSpeed += adjustment.projectileSpeed;
    if (adjustment.projectileLife) player.projectileLife += adjustment.projectileLife;
    if (adjustment.firstHealTimer) player.healTimer = adjustment.firstHealTimer;
    if (adjustment.arcaneShieldTimer) player.arcaneShieldTimer = adjustment.arcaneShieldTimer;
    if (adjustment.companionTimer) player.companionTimer = adjustment.companionTimer;
  }

  function findPlaybook(content, playbookId) {
    return content.playbooks.find((playbook) => playbook.id === playbookId) || content.playbooks[0];
  }

  function resolveRunMode(options) {
    const requested = options && options.mode ? options.mode : DEFAULT_RUN_MODE;
    return RUN_MODES[requested] || RUN_MODES[DEFAULT_RUN_MODE];
  }

  function selectModeList(content, mode, key, fallbackKey) {
    const list = content[mode[key]] || content[fallbackKey];
    return list && list.length > 0 ? list : content[fallbackKey];
  }

  function createInventory(content, playbook) {
    const catalog = content.itemCatalog || { weapons: [], passives: [], evolutions: [] };
    const weapon = catalog.weapons.find((item) => item.attack === playbook.attack) || catalog.weapons[0];
    return {
      weapons: weapon ? [{ id: weapon.id, title: weapon.title, level: 1, maxLevel: weapon.maxLevel }] : [],
      passives: [],
      evolvedWeapons: [],
    };
  }

  function createState(content, playbookId = 'fighter', options = {}) {
    const playbook = findPlaybook(content, playbookId);
    const mode = resolveRunMode(options);
    const waves = selectModeList(content, mode, 'wavesKey', 'wavePatterns');
    const scenes = selectModeList(content, mode, 'scenesKey', 'scenes');
    return {
      content,
      playbook,
      mode,
      duration: mode.duration,
      waves,
      scenes,
      elapsed: 0,
      sceneIndex: 0,
      waveIndex: 0,
      spawnTimer: content.balance && content.balance.earlyGame ? content.balance.earlyGame.spawnGrace : 0,
      bossSpawned: false,
      bossDefeated: false,
      lastMoveResult: '아직 판정 없음',
      kills: 0,
      attackMarks: [],
      player: createPlayer(playbook, content.balance),
      enemies: [],
      projectiles: [],
      particles: [],
      gems: [],
      chests: [],
      pendingChestRewards: [],
      floaters: [],
      hazards: [],
      enemyWarnings: [],
      bossWarnings: [],
      effects: { flash: 0, shake: 0, pulse: 0, bossPulse: 0, levelShockwave: 0, hitVignette: 0 },
      upgradeLevels: {},
      damageNumbersEnabled: true,
      damageNumbers: [],
      inventory: createInventory(content, playbook),
      learnedUpgrades: [playbook.learned, playbook.loadout],
      selectedUpgrades: [],
      buildTags: {},
      synergies: [],
      runGoals: createRunGoals(content, playbook),
      waveKills: {},
      hazardDamageTaken: 0,
      bossPatternAvoids: 0,
      bossPatternHits: 0,
      bossStartedAt: null,
      bossDefeatedAt: null,
      levelAtBoss: null,
      bossContribution: createBossContribution(playbook),
      runSummary: null,
      hazardTimer: 2.4,
      bossPhase: null,
      bossPatternTimer: 0,
      spawnedEliteMinutes: [],
      status: 'ready',
    };
  }

  function createRunGoals(content, playbook) {
    const goals = (content.runGoals || []).filter((goal) => goal.playbooks.includes(playbook.id));
    const classGoal = goals.find((goal) => goal.playbooks.length === 1) || goals[0];
    return goals
      .filter((goal) => goal.id !== (classGoal && classGoal.id))
      .slice(0, 2)
      .concat(classGoal ? [classGoal] : [])
      .slice(0, 3);
  }

  function createBossContribution(playbook) {
    const labels = {
      fighter: '근접 유지 보상',
      thief: '회피 후 폭딜',
      cleric: '피격 후 회복',
      druid: '패턴 후 둔화',
      wizard: '보호막 주문 강화',
      ranger: '거리 유지 표식',
    };
    return {
      label: labels[playbook.id] || '보스전 기여',
      triggers: 0,
      bonusDamage: 0,
      preventedDamage: 0,
      recoveredHealth: 0,
      controlTime: 0,
      text: '보스전 특수 기여는 아직 발동하지 않았습니다.',
    };
  }

  function getCurrentWave(state) {
    return state.waves.find((wave) => (
      state.elapsed >= wave.at && state.elapsed < wave.until
    )) || state.waves[state.waves.length - 1];
  }

  function createEdgePoint(side, offset) {
    const edge = [
      { x: -30, y: clamp(offset, 28, WORLD.height - 28) },
      { x: WORLD.width + 30, y: clamp(offset, 28, WORLD.height - 28) },
      { x: clamp(offset, 28, WORLD.width - 28), y: -30 },
      { x: clamp(offset, 28, WORLD.width - 28), y: WORLD.height + 30 },
    ][side];
    return edge;
  }

  function spawnEnemy(state, type, edge) {
    const profile = type.attackProfile || {};
    const bossScale = type.behavior === 'boss' && state.content.balance && state.content.balance.boss
      ? state.content.balance.boss.hpScale
      : 1;
    state.enemies.push({
      ...type,
      x: edge.x,
      y: edge.y,
      hp: type.hp * bossScale,
      maxHp: type.hp * bossScale,
      slowTimer: 0,
      behaviorTimer: Math.random() * 0.6,
      hitFlash: 0,
      attackCooldown: 0.7 + Math.random() * 0.6,
      attackWindup: 0,
      attackRecovery: 0,
      attackTarget: null,
      warning: null,
      attackProfile: {
        ...profile,
        range: profile.range || type.radius + 42,
        windup: profile.windup || 0.5,
        recovery: profile.recovery || 1.2,
        shape: profile.shape || 'circle',
        warningColorToken: profile.warningColorToken || type.colorToken,
        warningLabel: profile.warningLabel || type.name,
      },
    });
  }

  function spawnPack(state, pack) {
    const side = Math.floor(Math.random() * 4);
    const axisLength = side < 2 ? WORLD.height : WORLD.width;
    const center = Math.random() * axisLength;
    for (let index = 0; index < pack.count; index += 1) {
      const spread = (index - (pack.count - 1) / 2) * 44;
      const wave = pack.formation === 'arc' ? Math.sin(index) * 32 : 0;
      const offset = pack.formation === 'split'
        ? Math.random() * axisLength
        : center + spread + wave;
      spawnEnemy(state, state.content.enemyTypes[pack.type], createEdgePoint(side, offset));
    }
  }

  function updateWave(state, dt) {
    const wave = getCurrentWave(state);
    const nextWaveIndex = state.waves.indexOf(wave);
    if (nextWaveIndex !== state.waveIndex) {
      state.waveIndex = nextWaveIndex;
      state.hazardTimer = 1.2;
      addFloater(state, wave.title, state.player.x, state.player.y - 96, '--accent-ember', 1.8, true);
      state.effects.pulse = 0.5;
      resolveDungeonMove(state, wave);
    }

    const baseCadence = state.content.balance && state.content.balance.earlyGame
      ? state.content.balance.earlyGame.baseSpawnCadence
      : 1;
    const pressure = wave.pressure + state.elapsed / 230 + state.player.spawnPressure + state.player.tension * 0.022;
    state.spawnTimer -= dt * pressure;
    if (state.spawnTimer <= 0) {
      // 성능 예산 안전망(계획서 1절 작업 A): 동시 적 상한 도달 시 이번 팩 스폰을 건너뛴다.
      // 스폰 밀도(간격)는 유지하고 상한만 지켜, 다음 tick에 다시 시도해 압박감은 보존한다.
      const budget = state.content.performanceBudget;
      const enemyCap = budget ? budget.maxConcurrentEnemies : 120;
      if (state.enemies.length < enemyCap) {
        wave.packs.forEach((pack) => spawnPack(state, pack));
      }
      state.spawnTimer = Math.max(0.28, wave.cadence * baseCadence - state.elapsed / 560);
    }

    spawnDueElites(state);
    const bossAt = state.mode.bossAt || (state.content.balance && state.content.balance.boss ? state.content.balance.boss.spawnAt : 205);
    if (!state.bossSpawned && state.elapsed > bossAt) {
      spawnEnemy(state, state.content.enemyTypes.sentinel, { x: WORLD.towerX, y: WORLD.towerY + 170 });
      state.bossSpawned = true;
      state.bossStartedAt = state.elapsed;
      state.levelAtBoss = state.player.level;
      state.bossPhase = state.content.enemyTypes.sentinel.bossPhases[0];
      state.bossPatternTimer = state.content.balance && state.content.balance.boss
        ? state.content.balance.boss.firstPatternDelay
        : 1.2;
      state.effects.flash = 0.45;
      state.effects.shake = 0.7;
      state.effects.bossPulse = 1;
      // 보스 등장 경고 배너(계획서 3절 문구 그대로) - 2초 노출, 화면 고정(screenSpace).
      addFloater(state, '검은 종 파수꾼이 문을 등지고 섰다', state.player.x, state.player.y - 110, '--accent-bell', 2, true);
    }

    updateWaveHazards(state, wave, dt);
    updateBossPatterns(state, dt);
  }

  function spawnDueElites(state) {
    (state.mode.eliteMinutes || []).forEach((minute) => {
      const at = minute * 60;
      if (state.elapsed < at || state.spawnedEliteMinutes.includes(minute)) return;
      state.spawnedEliteMinutes.push(minute);
      spawnElite(state, minute);
    });
  }

  function spawnElite(state, minute) {
    const typeIds = ['armor', 'mimic', 'cultist', 'wolf'];
    const typeId = typeIds[(minute / 5 - 1) % typeIds.length];
    const type = state.content.enemyTypes[typeId];
    const side = Math.floor(Math.random() * 4);
    const axisLength = side < 2 ? WORLD.height : WORLD.width;
    const edge = createEdgePoint(side, Math.random() * axisLength);
    spawnEnemy(state, type, edge);
    const elite = state.enemies[state.enemies.length - 1];
    elite.elite = true;
    elite.eliteMinute = minute;
    elite.name = `${minute}분 엘리트 ${type.name}`;
    elite.hp *= 3.2;
    elite.maxHp = elite.hp;
    elite.damage *= 1.25;
    elite.radius += 5;
    elite.xp += 12;
    applyElitePattern(state, elite, typeId);
    state.effects.pulse = 0.55;
    state.effects.bossPulse = Math.max(state.effects.bossPulse, 0.46);
    addFloater(state, `${minute}분 엘리트 등장`, state.player.x, state.player.y - 112, '--accent-ember', 1.8, true);
  }

  function applyElitePattern(state, elite, typeId) {
    const pattern = state.content.elitePatterns && state.content.elitePatterns[typeId];
    if (!pattern) return;
    elite.elitePattern = pattern.modifier;
    elite.elitePatternTitle = pattern.title;
    elite.name = `${elite.name} · ${pattern.title}`;
    elite.attackProfile.warningLabel = pattern.warningLabel || `엘리트 ${elite.attackProfile.warningLabel}`;
    if (pattern.modifier === 'guardBreak') {
      elite.attackProfile.arc = Math.max(elite.attackProfile.arc || 0, Math.PI * 0.82);
      elite.attackProfile.reach = Math.max(elite.attackProfile.reach || 0, 104);
      elite.attackProfile.windup += 0.1;
      return;
    }
    if (pattern.modifier === 'jawAmbush') {
      elite.attackProfile.arc = Math.max(elite.attackProfile.arc || 0, Math.PI * 0.74);
      elite.attackProfile.reach = Math.max(elite.attackProfile.reach || 0, 132);
      elite.speed *= 1.08;
      return;
    }
    if (pattern.modifier === 'bellChoir') {
      elite.attackProfile.radius = Math.max(elite.attackProfile.radius || 0, 104);
      elite.attackProfile.width = Math.max(elite.attackProfile.width || 0, 34);
      elite.attackProfile.recovery = Math.max(1.2, elite.attackProfile.recovery - 0.18);
      return;
    }
    if (pattern.modifier === 'longCharge') {
      elite.attackProfile.length = Math.max(elite.attackProfile.length || 0, 190);
      elite.attackProfile.width = Math.max(24, (elite.attackProfile.width || 28) - 2);
      elite.speed *= 1.06;
    }
  }

  function updateWaveHazards(state, wave, dt) {
    if (!wave.hazards || wave.hazards.length === 0) return;
    state.hazardTimer -= dt;
    if (state.hazardTimer > 0) return;
    const template = wave.hazards[Math.floor(Math.random() * wave.hazards.length)];
    state.hazards.push(createHazard(state, template));
    state.hazardTimer = Math.max(1.8, template.cadence - state.elapsed / 260);
  }

  function createHazard(state, template) {
    const angle = Math.random() * Math.PI * 2;
    const distanceFromPlayer = 90 + Math.random() * 170;
    const x = clamp(state.player.x + Math.cos(angle) * distanceFromPlayer, 80, WORLD.width - 80);
    const y = clamp(state.player.y + Math.sin(angle) * distanceFromPlayer, 80, WORLD.height - 80);
    const targetAngle = Math.atan2(state.player.y - y, state.player.x - x);
    return {
      ...template,
      x,
      y,
      angle: targetAngle,
      warningLeft: template.warning || 0.75,
      life: (template.warning || 0.75) + (template.duration || 1.5),
      maxLife: (template.warning || 0.75) + (template.duration || 1.5),
      pulseTimer: 0,
    };
  }

  function updateBossPatterns(state, dt) {
    const boss = state.enemies.find((enemy) => enemy.behavior === 'boss');
    if (!boss || !boss.bossPhases) return;
    const phase = getBossPhase(boss);
    if (!state.bossPhase || state.bossPhase.id !== phase.id) {
      state.bossPhase = phase;
      state.bossPatternTimer = 0.4;
      addFloater(state, phase.title, boss.x, boss.y - 70, '--accent-bell', 1.6, true);
    }
    state.bossPatternTimer -= dt;
    if (state.bossPatternTimer > 0) return;
    spawnBossPattern(state, boss, phase);
    state.bossPatternTimer = phase.cadence;
  }

  function getBossPhase(boss) {
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    return boss.bossPhases
      .slice()
      .reverse()
      .find((phase) => ratio <= phase.threshold) || boss.bossPhases[0];
  }

  function spawnBossPattern(state, boss, phase) {
    if (phase.pattern === 'summon') {
      spawnEnemy(state, state.content.enemyTypes.armor, { x: clamp(boss.x - 120, 40, WORLD.width - 40), y: clamp(boss.y + 90, 40, WORLD.height - 40) });
      spawnEnemy(state, state.content.enemyTypes.wolf, { x: clamp(boss.x + 120, 40, WORLD.width - 40), y: clamp(boss.y + 90, 40, WORLD.height - 40) });
      state.bossWarnings.push(createBossWarning(boss, phase, 'ring'));
      addFloater(state, phase.warning, boss.x, boss.y - 84, '--accent-bell', 1.2, true);
      return;
    }
    if (phase.pattern === 'cross') {
      spawnEnemy(state, state.content.enemyTypes.cultist, { x: clamp(boss.x, 40, WORLD.width - 40), y: clamp(boss.y + 130, 40, WORLD.height - 40) });
      state.bossWarnings.push(createBossWarning(boss, phase, 'line', 0));
      state.bossWarnings.push(createBossWarning(boss, phase, 'line', Math.PI / 2));
      addFloater(state, phase.warning, boss.x, boss.y - 84, '--accent-bell', 1.2, true);
      return;
    }
    state.bossWarnings.push(createBossWarning(boss, phase, phase.pattern));
    addFloater(state, phase.warning, boss.x, boss.y - 84, '--accent-bell', 1.2, true);
  }

  function createBossWarning(boss, phase, pattern, forcedAngle) {
    const angle = Math.atan2(WORLD.startY - boss.y, WORLD.startX - boss.x);
    return {
      x: boss.x,
      y: boss.y,
      kind: pattern,
      phase: phase.id,
      label: phase.warning,
      angle: typeof forcedAngle === 'number' ? forcedAngle : angle,
      radius: pattern === 'ring' ? 142 : 0,
      width: pattern === 'line' ? 52 : 38,
      length: pattern === 'line' ? 460 : 0,
      warningLeft: 0.95,
      life: 1.75,
      maxLife: 1.75,
      damage: phase.pattern === 'cross' ? 12 : pattern === 'line' ? 13 : 10,
      colorToken: '--accent-bell',
      pulseTimer: 0,
    };
  }

  function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function resolveDungeonMove(state, wave) {
    const stat = state.player.stats[wave.checkStat] || 0;
    const total = rollD6() + rollD6() + stat;
    if (total >= 10) {
      state.player.tension = Math.max(0, state.player.tension - 2);
      state.player.health = Math.min(state.player.maxHealth, state.player.health + 5);
      state.lastMoveResult = `${wave.moveName} 10+: 흐름을 잡았습니다`;
      addFloater(state, '10+ 문제 없이 해냅니다', state.player.x, state.player.y - 112, '--status-success', 1.7, true);
      return;
    }
    if (total >= 7) {
      state.player.tension = clamp(state.player.tension + 1, 0, state.player.maxTension);
      state.lastMoveResult = `${wave.moveName} 7-9: 대가를 치릅니다`;
      addFloater(state, '7-9 해내지만 대가가 생깁니다', state.player.x, state.player.y - 112, '--accent-ember', 1.7, true);
      return;
    }
    state.player.tension = clamp(state.player.tension + Math.max(1, 3 - state.player.moveGrace), 0, state.player.maxTension);
    state.lastMoveResult = `${wave.moveName} 6-: 마스터가 움직입니다`;
    addFloater(state, '6- 예상 밖의 전개', state.player.x, state.player.y - 112, '--status-error', 1.7, true);
    wave.packs.slice(0, 1).forEach((pack) => spawnPack(state, pack));
    state.effects.shake = 0.45;
  }

  // 가상 스틱(계획서 2절)이 analog vx/vy를 채우면 그 값을, 아니면 키보드 digital
  // up/down/left/right를 사용한다. 이동 로직 자체는 분기 없이 동일한 (dx, dy) 벡터
  // 소비 경로 하나만 탄다 - 입력 소스만 다를 뿐 updatePlayer 아래 로직은 공용.
  function resolveMoveVector(input) {
    if (input.vx !== null && input.vx !== undefined) {
      return { dx: input.vx || 0, dy: input.vy || 0 };
    }
    return {
      dx: (input.right ? 1 : 0) - (input.left ? 1 : 0),
      dy: (input.down ? 1 : 0) - (input.up ? 1 : 0),
    };
  }

  function updatePlayer(state, input, dt) {
    const player = state.player;
    const moveVector = resolveMoveVector(input);
    const dx = moveVector.dx;
    const dy = moveVector.dy;
    const direction = normalize(dx, dy);
    const moving = dx !== 0 || dy !== 0;
    const tensionScale = 1 + player.tension * player.tensionSpeed;
    const hazardScale = player.hazardSlowTimer > 0 ? 0.68 : 1;
    const bossBurstScale = player.bossBurstTimer > 0 ? 1.12 : 1;
    const speed = player.speed * tensionScale * hazardScale * bossBurstScale;
    if (moving) player.facing = Math.atan2(direction.y, direction.x);
    player.x = clamp(player.x + (moving ? direction.x * speed * dt : 0), 28, WORLD.width - 28);
    player.y = clamp(player.y + (moving ? direction.y * speed * dt : 0), 28, WORLD.height - 28);
    player.attackTimer = Math.max(0, player.attackTimer - dt);
    player.invulnerableTimer = Math.max(0, player.invulnerableTimer - dt);
    player.hazardSlowTimer = Math.max(0, player.hazardSlowTimer - dt);
    player.arcaneShieldTimer = Math.max(0, player.arcaneShieldTimer - dt);
    player.companionTimer = Math.max(0, player.companionTimer - dt);
    player.bossBurstTimer = Math.max(0, player.bossBurstTimer - dt);
    player.bossSpellTimer = Math.max(0, player.bossSpellTimer - dt);
    updateAura(state, dt);
    updateHealPulse(state, dt);
    updateCompanionStrike(state);
    updateWeaponTimers(state, dt);
    updateBossClassInteraction(state, dt);
  }

  function updateBossClassInteraction(state, dt) {
    const boss = state.enemies.find((enemy) => enemy.behavior === 'boss');
    if (!boss) return;
    const player = state.player;
    if (player.playbookId !== 'fighter') return;
    if (distance(player, boss) > 135) {
      player.bossCloseTimer = 0;
      return;
    }
    player.bossCloseTimer += dt;
    if (player.bossCloseTimer < 1.4) return;
    player.bossCloseTimer = 0;
    player.tension = Math.max(0, player.tension - 0.45);
    state.bossContribution.triggers += 1;
    state.bossContribution.preventedDamage += 1.5;
    state.bossContribution.text = '보스 근접을 유지해 긴장과 피해 압박을 낮췄습니다.';
    addFloater(state, '방패 압박', player.x, player.y - 46, '--class-fighter', 0.9);
  }

  function updateAura(state, dt) {
    const player = state.player;
    if (!player.aura) return;
    player.auraTimer -= dt;
    if (player.auraTimer > 0) return;
    player.auraTimer = 3;
    state.enemies.forEach((enemy) => {
      if (distance(player, enemy) < player.auraRange) {
        enemy.slowTimer = 1.7;
        enemy.hp -= player.auraDamage;
      }
    });
    addFloater(state, '라메의 잎 표식', player.x, player.y - 28, '--accent-primary');
  }

  function updateHealPulse(state, dt) {
    const player = state.player;
    if (player.healPulse <= 0) return;
    player.healTimer -= dt;
    if (player.healTimer > 0) return;
    player.healTimer = Math.max(3.2, 5.4 - player.healPulse * 0.46);
    const amount = 3 + player.healPulse * 2 + player.healBonus;
    player.health = Math.min(player.maxHealth, player.health + amount);
    addFloater(state, `기도 +${amount}`, player.x, player.y - 34, '--status-success', 1);
  }

  function updateCompanionStrike(state) {
    const player = state.player;
    if (player.companionStrike <= 0 || player.companionTimer > 0 || state.enemies.length === 0) return;
    const target = state.enemies
      .slice()
      .sort((a, b) => a.hp - b.hp)[0];
    target.hp -= 12 + player.companionStrike * 8;
    target.hitFlash = 0.2;
    target.slowTimer = Math.max(target.slowTimer, 0.42);
    state.attackMarks.push({
      x: target.x,
      y: target.y,
      radius: 22 + player.companionStrike * 2,
      kind: 'hawk',
      angle: -0.82,
      impactKind: 'hawk',
      life: 0.34,
      maxLife: 0.34,
    });
    addFloater(state, '동료 매', target.x, target.y - 16, '--accent-ember', 0.9);
    player.companionTimer = Math.max(1.8, 3.4 - player.companionStrike * 0.34);
  }

  function updateWeaponTimers(state, dt) {
    const player = state.player;
    player.fanTimer = Math.max(0, player.fanTimer - dt);
    player.bellTimer = Math.max(0, player.bellTimer - dt);
  }

  function fireProjectiles(state) {
    const player = state.player;
    if (player.attackTimer > 0 || state.enemies.length === 0) return;
    if (player.attackStyle === 'cleave') {
      fireCleave(state);
      return;
    }
    const targets = state.enemies
      .slice()
      .sort((a, b) => {
        if (player.attackStyle === 'arrow') return distance(player, b) - distance(player, a);
        return distance(player, a) - distance(player, b);
      })
      .slice(0, player.shots);
    targets.forEach((target) => {
      const direction = normalize(target.x - player.x, target.y - player.y);
      const spread = player.attackStyle === 'missile' ? (Math.random() - 0.5) * 0.14 : 0;
      const vx = direction.x * Math.cos(spread) - direction.y * Math.sin(spread);
      const vy = direction.x * Math.sin(spread) + direction.y * Math.cos(spread);
      state.projectiles.push({
        x: player.x,
        y: player.y,
        originX: player.x,
        originY: player.y,
        vx: vx * player.projectileSpeed,
        vy: vy * player.projectileSpeed,
        radius: player.attackStyle === 'radiance' ? 8 : player.projectileRadius,
        damage: player.damage,
        pierce: player.attackStyle === 'arrow' ? player.pierce + 1 : player.pierce,
        life: player.projectileLife,
        maxLife: player.projectileLife,
        kind: player.attackStyle,
        source: player.playbookId,
        angle: Math.atan2(vy, vx),
        trail: getAttackTrail(player.attackStyle),
        impactKind: player.attackStyle,
      });
    });
    player.attackTimer = player.attackCooldown;
    fireFanKnives(state);
    fireBellWave(state);
  }

  function fireCleave(state) {
    const player = state.player;
    const target = state.enemies
      .slice()
      .sort((a, b) => distance(player, a) - distance(player, b))[0];
    const facing = normalize(target.x - player.x, target.y - player.y);
    let hits = 0;
    state.enemies.forEach((enemy) => {
      const toEnemy = normalize(enemy.x - player.x, enemy.y - player.y);
      const angle = Math.acos(clamp(facing.x * toEnemy.x + facing.y * toEnemy.y, -1, 1));
      if (distance(player, enemy) <= player.cleaveRange + enemy.radius && angle <= player.cleaveArc / 2) {
        const baseDamage = player.damage + 8;
        const bossBonus = enemy.behavior === 'boss' ? getBossDamageBonus(state, enemy) : 0;
        const finalDamage = baseDamage * (1 + bossBonus);
        enemy.hp -= finalDamage;
        if (enemy.behavior === 'boss' && bossBonus > 0) recordBossBonusDamage(state, baseDamage * bossBonus);
        enemy.hitFlash = 0.16;
        enemy.slowTimer = Math.max(enemy.slowTimer, player.cleaveSlow);
        spawnDamageNumber(state, finalDamage, enemy.x, enemy.y - enemy.radius - 6, enemy);
        hits += 1;
      }
    });
    state.attackMarks.push({
      x: player.x + facing.x * (player.cleaveRange * 0.48),
      y: player.y + facing.y * (player.cleaveRange * 0.48),
      radius: player.cleaveRange,
      angle: Math.atan2(facing.y, facing.x),
      arc: player.cleaveArc,
      kind: 'cleave',
      source: player.playbookId,
      windup: 0.1,
      impactKind: 'metal',
      life: 0.18,
      maxLife: 0.18,
    });
    if (hits > 1) addFloater(state, `베기 x${hits}`, player.x, player.y - 34, '--accent-ember', 0.8);
    player.attackTimer = player.attackCooldown;
    fireBellWave(state);
  }

  function fireFanKnives(state) {
    const player = state.player;
    if (player.fanKnives <= 0 || player.fanTimer > 0) return;
    const count = 2 + player.fanKnives;
    const baseAngle = -Math.PI / 2 + Math.random() * Math.PI * 2;
    for (let index = 0; index < count; index += 1) {
      const angle = baseAngle + (index - (count - 1) / 2) * 0.22;
      state.projectiles.push({
        x: player.x,
        y: player.y,
        originX: player.x,
        originY: player.y,
        vx: Math.cos(angle) * 360,
        vy: Math.sin(angle) * 360,
        radius: 4,
        damage: 10 + player.fanKnives * 4,
        pierce: 0,
        life: 0.85,
        maxLife: 0.85,
        kind: 'fan',
        source: 'thief',
        angle,
        trail: 'knife',
        impactKind: 'blade',
      });
    }
    player.fanTimer = Math.max(0.45, 1.35 - player.fanKnives * 0.18 - player.fanCooldownBonus);
  }

  function fireBellWave(state) {
    const player = state.player;
    if (player.bellWave <= 0 || player.bellTimer > 0 || state.enemies.length === 0) return;
    const target = state.enemies
      .slice()
      .sort((a, b) => distance(player, a) - distance(player, b))[0];
    const direction = normalize(target.x - player.x, target.y - player.y);
    state.projectiles.push({
      x: player.x,
      y: player.y,
      originX: player.x,
      originY: player.y,
      vx: direction.x * 245,
      vy: direction.y * 245,
      radius: 13 + player.bellWave * 4,
      damage: 24 + player.bellWave * 10,
      pierce: 4 + player.bellWave,
      life: 1.9,
      maxLife: 1.9,
      kind: 'bell',
      source: player.playbookId,
      angle: Math.atan2(direction.y, direction.x),
      trail: 'bell',
      impactKind: 'bell',
    });
    player.bellTimer = Math.max(2.1, 3.4 - player.bellWave * 0.35);
  }

  function updateProjectiles(state, dt) {
    state.projectiles.forEach((projectile) => {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
    });
    state.projectiles = state.projectiles.filter((projectile) => (
      projectile.life > 0
      && projectile.x > -120
      && projectile.x < WORLD.width + 120
      && projectile.y > -120
      && projectile.y < WORLD.height + 120
    ));
    // 성능 예산 안전망(계획서 1절): 투사체 상한 초과 시 가장 오래된 것부터 정리(오프스크린
    // 컬링 강화 - 계획서 조정 순서 2단계).
    const budget = state.content.performanceBudget;
    const projectileCap = budget ? budget.maxConcurrentProjectiles : 80;
    if (state.projectiles.length > projectileCap) {
      state.projectiles.splice(0, state.projectiles.length - projectileCap);
    }
  }

  function updateAttackMarks(state, dt) {
    state.attackMarks.forEach((mark) => {
      mark.life -= dt;
    });
    state.attackMarks = state.attackMarks.filter((mark) => mark.life > 0);
  }

  function updateOrbitingSpears(state, dt) {
    const player = state.player;
    if (player.orbitingSpears <= 0) return;
    player.orbitTimer += dt;
    const count = player.orbitingSpears + 1;
    const radius = 48 + player.orbitingSpears * 10;
    state.enemies.forEach((enemy) => {
      enemy.orbitHitTimer = Math.max(0, (enemy.orbitHitTimer || 0) - dt);
      for (let index = 0; index < count; index += 1) {
        const angle = player.orbitTimer * 3.2 + index * (Math.PI * 2 / count);
        const spear = {
          x: player.x + Math.cos(angle) * radius,
          y: player.y + Math.sin(angle) * radius,
        };
        if (enemy.orbitHitTimer <= 0 && distance(spear, enemy) < enemy.radius + 8) {
          enemy.hp -= 16 + player.orbitingSpears * 5;
          enemy.hitFlash = 0.16;
          enemy.orbitHitTimer = 0.42;
        }
      }
    });
  }

  function updateEnemies(state, dt) {
    const player = state.player;
    state.enemies.forEach((enemy) => {
      const direction = normalize(player.x - enemy.x, player.y - enemy.y);
      const slow = enemy.slowTimer > 0 ? 0.48 : 1;
      enemy.behaviorTimer += dt;
      updateEnemyAttackState(state, enemy, dt, direction);
      const behavior = getEnemyBehavior(enemy, direction);
      const windupScale = enemy.attackWindup > 0 ? 0.28 : 1;
      enemy.x += behavior.x * enemy.speed * behavior.speedScale * slow * windupScale * dt;
      enemy.y += behavior.y * enemy.speed * behavior.speedScale * slow * windupScale * dt;
      enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      if (distance(player, enemy) < player.radius + enemy.radius && player.invulnerableTimer <= 0) {
        applyPlayerDamage(state, Math.max(2, enemy.damage * 0.35 * getEarlyContactDamageScale(state)), enemy, '몸싸움', '--status-error', 0.38);
      }
    });
  }

  function getEarlyContactDamageScale(state) {
    const earlyGame = state.content.balance && state.content.balance.earlyGame;
    if (!earlyGame || !earlyGame.contactDamageScale || !earlyGame.contactDamageScaleUntil) return 1;
    if (state.elapsed >= earlyGame.contactDamageScaleUntil) return 1;
    const progress = clamp(state.elapsed / earlyGame.contactDamageScaleUntil, 0, 1);
    return earlyGame.contactDamageScale + (1 - earlyGame.contactDamageScale) * progress;
  }

  function updateEnemyAttackState(state, enemy, dt, direction) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.attackRecovery = Math.max(0, enemy.attackRecovery - dt);
    if (enemy.attackWindup > 0) {
      enemy.attackWindup -= dt;
      if (enemy.attackWindup <= 0) {
        resolveEnemyAttack(state, enemy);
        enemy.attackRecovery = enemy.attackProfile.recovery;
        enemy.attackCooldown = enemy.attackProfile.recovery + 0.35;
        enemy.warning = null;
      } else if (enemy.warning) {
        enemy.warning.warningLeft = enemy.attackWindup;
      }
      return;
    }
    if (enemy.attackRecovery > 0 || enemy.attackCooldown > 0) return;
    if (distance(state.player, enemy) > enemy.attackProfile.range) return;
    startEnemyAttack(state, enemy, direction);
  }

  function startEnemyAttack(state, enemy, direction) {
    const profile = enemy.attackProfile;
    enemy.attackWindup = profile.windup + state.player.warningGrace;
    enemy.attackTarget = { x: state.player.x, y: state.player.y };
    const angle = Math.atan2(direction.y, direction.x);
    enemy.warning = {
      source: enemy.name,
      x: enemy.x,
      y: enemy.y,
      targetX: state.player.x,
      targetY: state.player.y,
      kind: profile.shape,
      label: profile.warningLabel,
      angle,
      radius: profile.radius || profile.reach || profile.range,
      reach: profile.reach || profile.range,
      arc: profile.arc || Math.PI * 0.5,
      length: profile.length || profile.range,
      width: profile.width || 30,
      warningLeft: enemy.attackWindup,
      maxLife: enemy.attackWindup,
      colorToken: profile.warningColorToken || enemy.colorToken,
    };
    state.enemyWarnings.push(enemy.warning);
  }

  function resolveEnemyAttack(state, enemy) {
    if (!enemy.warning) return;
    if (!isPointInWarning(state.player, enemy.warning, state.player.radius)) return;
    const damage = Math.max(3, enemy.damage * (enemy.attackProfile.damageScale || 1));
    applyPlayerDamage(state, damage, enemy, enemy.attackProfile.warningLabel, enemy.attackProfile.warningColorToken, 0.7);
  }

  function applyPlayerDamage(state, rawDamage, source, label, colorToken, invulnerableTime) {
    const player = state.player;
    if (player.invulnerableTimer > 0) return false;
    if (player.dodgeChance > 0 && Math.random() < player.dodgeChance) {
      player.invulnerableTimer = 0.36;
      addFloater(state, '회피', player.x, player.y - 22, '--status-info');
      return false;
    }
    const shieldReduction = player.arcaneShield > 0 && player.arcaneShieldTimer <= 0 ? 0.45 : 1;
    if (shieldReduction < 1) {
      player.arcaneShieldTimer = Math.max(2.8, 4.8 - player.arcaneShieldCooldownBonus);
      addFloater(state, '비전 보호막', player.x, player.y - 24, '--accent-bell');
      if (source && source.behavior === 'boss' && player.playbookId === 'wizard') {
        player.bossSpellTimer = Math.max(player.bossSpellTimer, 3);
        state.bossContribution.triggers += 1;
        state.bossContribution.preventedDamage += rawDamage * 0.55;
        state.bossContribution.text = '보스 피해를 보호막 타이밍으로 받아 주문 강화 시간을 만들었습니다.';
        addFloater(state, '주문 과충전', player.x, player.y - 46, '--class-wizard', 1);
      }
    }
    const armor = source && source.behavior === 'boss' ? player.armor * 0.55 : player.armor;
    const damageTaken = Math.max(2, rawDamage - armor) * shieldReduction;
    player.health -= damageTaken;
    if (source && source.behavior === 'boss' && player.playbookId === 'cleric') {
      const recovered = Math.min(8, 3 + player.healPulse);
      player.health = Math.min(player.maxHealth, player.health + recovered);
      player.tension = Math.max(0, player.tension - 0.8);
      state.bossContribution.triggers += 1;
      state.bossContribution.recoveredHealth += recovered;
      state.bossContribution.text = '보스 피해 뒤 치유 기도가 체력과 긴장을 되돌렸습니다.';
      addFloater(state, `사면 +${recovered}`, player.x, player.y - 46, '--class-cleric', 1);
    }
    player.tension = clamp(player.tension + Math.max(0.3, 1 - player.tensionResist), 0, player.maxTension);
    player.invulnerableTimer = invulnerableTime || 0.7;
    state.effects.flash = Math.max(state.effects.flash, 0.12);
    state.effects.shake = Math.max(state.effects.shake, 0.18);
    triggerHitVignette(state);
    addFloater(state, label || '위험', player.x, player.y - 22, colorToken || '--status-error');
    spawnDamageNumber(state, damageTaken, player.x, player.y - 30);
    return true;
  }

  function isPointInWarning(point, warning, radius) {
    if (warning.kind === 'line') {
      return pointInLine(point, warning, radius);
    }
    if (warning.kind === 'cone' || warning.kind === 'arc') {
      return pointInArc(point, warning, radius);
    }
    if (warning.kind === 'ring') {
      const dist = Math.hypot(point.x - warning.x, point.y - warning.y);
      return Math.abs(dist - warning.radius) <= (warning.width || 32) + radius;
    }
    const dist = Math.hypot(point.x - warning.x, point.y - warning.y);
    return dist <= (warning.radius || warning.reach || 40) + radius;
  }

  function pointInLine(point, warning, radius) {
    const dx = point.x - warning.x;
    const dy = point.y - warning.y;
    const along = dx * Math.cos(warning.angle) + dy * Math.sin(warning.angle);
    const across = Math.abs(-dx * Math.sin(warning.angle) + dy * Math.cos(warning.angle));
    return along >= -radius && along <= (warning.length || warning.reach || 120) + radius
      && across <= (warning.width || 30) / 2 + radius;
  }

  function pointInArc(point, warning, radius) {
    const dx = point.x - warning.x;
    const dy = point.y - warning.y;
    const dist = Math.hypot(dx, dy);
    if (dist > (warning.reach || warning.radius || 70) + radius) return false;
    const angle = Math.atan2(dy, dx);
    const delta = Math.atan2(Math.sin(angle - warning.angle), Math.cos(angle - warning.angle));
    return Math.abs(delta) <= (warning.arc || Math.PI * 0.5) / 2;
  }

  function getEnemyBehavior(enemy, direction) {
    if (enemy.behavior === 'skirmisher') {
      const strafe = Math.sin(enemy.behaviorTimer * 3) * 0.44;
      const movement = normalize(direction.x - direction.y * strafe, direction.y + direction.x * strafe);
      return { x: movement.x, y: movement.y, speedScale: 1 };
    }
    if (enemy.behavior === 'lurcher') {
      return { x: direction.x, y: direction.y, speedScale: Math.sin(enemy.behaviorTimer * 4) > 0.2 ? 1.55 : 0.34 };
    }
    if (enemy.behavior === 'charger') {
      return { x: direction.x, y: direction.y, speedScale: Math.sin(enemy.behaviorTimer * 2.7) > 0.68 ? 2.35 : 0.72 };
    }
    if (enemy.behavior === 'ambusher') {
      const sway = Math.sin(enemy.behaviorTimer * 2.2) * 0.32;
      const movement = normalize(direction.x - direction.y * sway, direction.y + direction.x * sway);
      return { x: movement.x, y: movement.y, speedScale: Math.sin(enemy.behaviorTimer * 3.6) > 0.55 ? 1.85 : 0.38 };
    }
    if (enemy.behavior === 'caster') {
      const towerDistance = Math.hypot(enemy.x - WORLD.towerX, enemy.y - WORLD.towerY);
      const holdScale = towerDistance < 520 ? 0.42 : 0.86;
      return { x: direction.x, y: direction.y, speedScale: enemy.attackWindup > 0 ? 0.08 : holdScale };
    }
    if (enemy.behavior === 'bulwark') {
      return { x: direction.x, y: direction.y, speedScale: enemy.hp > enemy.maxHp * 0.45 ? 0.82 : 1.22 };
    }
    if (enemy.behavior === 'boss') {
      return { x: direction.x, y: direction.y, speedScale: Math.sin(enemy.behaviorTimer * 1.8) > 0.72 ? 1.7 : 0.72 };
    }
    return { x: direction.x, y: direction.y, speedScale: 1 };
  }

  function resolveHits(state) {
    state.projectiles.forEach((projectile) => {
      state.enemies.forEach((enemy) => {
        if (projectile.life <= 0 || distance(projectile, enemy) > projectile.radius + enemy.radius) return;
        const bossBonus = enemy.behavior === 'boss' ? getBossDamageBonus(state, enemy) : 0;
        const projectileDamage = projectile.damage * (1 + bossBonus);
        enemy.hp -= projectileDamage;
        if (enemy.behavior === 'boss' && bossBonus > 0) recordBossBonusDamage(state, projectile.damage * bossBonus);
        enemy.hitFlash = 0.13;
        spawnDamageNumber(state, projectileDamage, enemy.x, enemy.y - enemy.radius - 6, enemy);
        spawnImpactSparks(state, enemy, projectile.impactKind || projectile.kind, 4);
        state.attackMarks.push({
          x: enemy.x,
          y: enemy.y,
          radius: Math.max(14, projectile.radius + enemy.radius * 0.45),
          kind: projectile.impactKind || projectile.kind,
          angle: projectile.angle || 0,
          source: projectile.source,
          life: 0.22,
          maxLife: 0.22,
        });
        if (projectile.kind === 'roots') enemy.slowTimer = Math.max(enemy.slowTimer, state.player.rootSlow);
        if (projectile.kind === 'radiance') {
          state.player.health = Math.min(state.player.maxHealth, state.player.health + 1.2);
        }
        projectile.pierce -= 1;
        if (projectile.pierce < 0) projectile.life = 0;
      });
    });

    const defeated = state.enemies.filter((enemy) => enemy.hp <= 0);
    defeated.forEach((enemy) => {
      state.kills += 1;
      const wave = getCurrentWave(state);
      state.waveKills[wave.id] = (state.waveKills[wave.id] || 0) + 1;
      state.gems.push({ x: enemy.x, y: enemy.y, value: enemy.xp, radius: 6, age: 0 });
      spawnDeathParticles(state, enemy);
      if (enemy.elite) {
        dropChest(state, enemy);
      }
      if (enemy.behavior === 'boss') {
        state.bossDefeated = true;
        state.bossDefeatedAt = state.elapsed;
        state.effects.flash = 0.65;
        state.effects.shake = 0.55;
        addFloater(state, '마지막 문이 열립니다', state.player.x, state.player.y - 100, '--status-success', 2, true);
      } else {
        addFloater(state, enemy.name, enemy.x, enemy.y - 12, enemy.colorToken);
      }
    });
    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  }

  function dropChest(state, source) {
    const chest = {
      id: `chest-${Math.round(state.elapsed * 1000)}-${state.chests.length}`,
      x: clamp(source.x, 36, WORLD.width - 36),
      y: clamp(source.y, 36, WORLD.height - 36),
      radius: 15,
      source: source.elite ? 'elite' : 'event',
      age: 0,
    };
    state.chests.push(chest);
    addFloater(state, '상자', chest.x, chest.y - 18, '--accent-ember', 1.4);
    return chest;
  }

  function getBossDamageBonus(state, enemy) {
    const player = state.player;
    let bonus = player.bossDamageBonus || 0;
    if (player.playbookId === 'fighter' && distance(player, enemy) <= 135) bonus += 0.14;
    if (player.playbookId === 'thief' && player.bossBurstTimer > 0) bonus += 0.28;
    if (player.playbookId === 'wizard' && player.bossSpellTimer > 0) bonus += 0.24;
    if (player.playbookId === 'ranger' && distance(player, enemy) >= 260) bonus += 0.18;
    return bonus;
  }

  function recordBossBonusDamage(state, amount) {
    if (amount <= 0) return;
    state.bossContribution.bonusDamage += amount;
    const playbookId = state.player.playbookId;
    if (playbookId === 'fighter') state.bossContribution.text = '근접 유지로 보스 피해를 더 밀어 넣었습니다.';
    else if (playbookId === 'thief') state.bossContribution.text = '회피 후 열린 폭딜 시간에 보스 피해를 넣었습니다.';
    else if (playbookId === 'wizard') state.bossContribution.text = '보호막 주문 강화 시간에 보스 피해를 끌어올렸습니다.';
    else if (playbookId === 'ranger') {
      state.bossContribution.triggers += 1;
      state.bossContribution.text = '거리를 유지한 표식 화살로 보스 피해를 높였습니다.';
    }
  }

  function updateGems(state, dt) {
    const player = state.player;
    state.gems.forEach((gem) => {
      gem.age += dt;
      const attractionRange = gem.age > 2.4 ? 900 : player.magnet;
      gem.pullMode = distance(player, gem) < player.magnet ? 'magnet' : gem.age > 2.4 ? 'late' : null;
      if (distance(player, gem) < attractionRange) {
        const direction = normalize(player.x - gem.x, player.y - gem.y);
        gem.trail = { x: gem.x, y: gem.y };
        gem.x += direction.x * 260 * dt;
        gem.y += direction.y * 260 * dt;
      }
    });
    const collected = state.gems.filter((gem) => distance(player, gem) < player.radius + gem.radius);
    collected.forEach((gem) => {
      player.xp += gem.value;
      spawnXpAbsorbParticles(state, gem, player);
      addFloater(state, `+${gem.value}`, gem.x, gem.y - 10, '--status-info', 0.8);
    });
    state.gems = state.gems.filter((gem) => distance(player, gem) >= player.radius + gem.radius);
  }

  function collectChests(state) {
    const collected = state.chests.filter((chest) => distance(state.player, chest) < state.player.radius + chest.radius + 4);
    if (collected.length === 0) return false;
    collected.forEach((chest) => {
      state.pendingChestRewards.push(createChestReward(state, chest));
      addFloater(state, '상자 개봉', chest.x, chest.y - 24, '--accent-ember', 1.2);
    });
    state.chests = state.chests.filter((chest) => !collected.includes(chest));
    return true;
  }

  function updateChests(state, dt) {
    state.chests.forEach((chest) => {
      chest.age += dt;
    });
  }

  function createChestReward(state, chest) {
    const evolution = getEligibleEvolutions(state)[0];
    if (evolution) {
      return { type: 'evolution', evolution, chest };
    }
    const weapon = state.inventory.weapons.find((item) => item.level < item.maxLevel);
    if (weapon) {
      return { type: 'weapon', item: weapon, chest };
    }
    const passive = state.inventory.passives.find((item) => item.level < item.maxLevel);
    if (passive) {
      return { type: 'passive', item: passive, chest };
    }
    const upgrade = pickBestUpgrade(
      state.content.upgrades.filter((item) => (state.upgradeLevels[item.id] || 0) < item.maxLevel),
      state,
      scoreCurrentBuild
    );
    return { type: 'upgrade', upgrade, chest };
  }

  function updateFloaters(state, dt) {
    state.floaters.forEach((floater) => {
      floater.y -= 22 * dt;
      floater.life -= dt;
    });
    state.floaters = state.floaters.filter((floater) => floater.life > 0);
  }

  // 피격(플레이어) 피드백은 화면 가장자리 비네트 200ms(계획서 3절) - 풀스크린 플래시
  // 금지(광과민 배려). hitVignette는 0.2초 동안 선형 감쇠하는 독립 이펙트 값이다.
  const HIT_VIGNETTE_DURATION = 0.2;

  function updateEffects(state, dt) {
    state.effects.flash = Math.max(0, state.effects.flash - dt);
    state.effects.shake = Math.max(0, state.effects.shake - dt);
    state.effects.pulse = Math.max(0, state.effects.pulse - dt);
    state.effects.bossPulse = Math.max(0, state.effects.bossPulse - dt * 0.5);
    state.effects.levelShockwave = Math.max(0, state.effects.levelShockwave - dt * 1.3);
    state.effects.hitVignette = Math.max(0, state.effects.hitVignette - dt / HIT_VIGNETTE_DURATION);
  }

  function triggerHitVignette(state) {
    state.effects.hitVignette = 1;
  }

  // 데미지 숫자(계획서 3절): 설정 토글 기본 켬, 개체당 최대 1개 표시·풀링(성능 예산 내).
  // entityKey가 있으면 같은 개체의 기존 숫자를 교체(누적)해 개체당 1개만 유지한다.
  function spawnDamageNumber(state, amount, x, y, entityKey) {
    if (!state.damageNumbersEnabled || amount <= 0) return;
    const rounded = Math.round(amount);
    if (entityKey) {
      const existing = state.damageNumbers.find((entry) => entry.entityKey === entityKey);
      if (existing) {
        existing.amount += rounded;
        existing.x = x;
        existing.y = y;
        existing.life = Math.max(existing.life, 0.6);
        existing.maxLife = 0.6;
        return;
      }
    }
    state.damageNumbers.push({ entityKey: entityKey || null, amount: rounded, x, y, life: 0.6, maxLife: 0.6 });
    const budget = state.content.performanceBudget;
    const cap = budget ? budget.maxConcurrentParticles : 60;
    if (state.damageNumbers.length > cap) {
      state.damageNumbers.splice(0, state.damageNumbers.length - cap);
    }
  }

  function updateDamageNumbers(state, dt) {
    state.damageNumbers.forEach((entry) => {
      entry.y -= 26 * dt;
      entry.life -= dt;
    });
    state.damageNumbers = state.damageNumbers.filter((entry) => entry.life > 0);
  }

  function updateParticles(state, dt) {
    state.particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
      particle.life -= dt;
    });
    state.particles = state.particles.filter((particle) => particle.life > 0);
    // 성능 예산 안전망(계획서 1절): 파티클 상한 초과 시 가장 오래된 것부터 정리한다.
    const budget = state.content.performanceBudget;
    const particleCap = budget ? budget.maxConcurrentParticles : 60;
    if (state.particles.length > particleCap) {
      state.particles.splice(0, state.particles.length - particleCap);
    }
  }

  function updateHazards(state, dt) {
    state.hazards.forEach((hazard) => {
      hazard.life -= dt;
      hazard.warningLeft = Math.max(0, hazard.warningLeft - dt);
      hazard.pulseTimer = Math.max(0, hazard.pulseTimer - dt);
      if (hazard.warningLeft > 0 || hazard.pulseTimer > 0) return;
      if (!isPointInHazard(state.player, hazard, state.player.radius)) return;
      if (hazard.damage) applyHazardDamage(state, hazard);
      if (hazard.tension) state.player.tension = clamp(state.player.tension + hazard.tension, 0, state.player.maxTension);
      if (hazard.slow) {
        const slowTime = Math.max(0.35, hazard.slow * (1 - state.player.hazardResist));
        state.player.hazardSlowTimer = Math.max(state.player.hazardSlowTimer, slowTime);
      }
      hazard.pulseTimer = 0.65;
    });
    state.hazards = state.hazards.filter((hazard) => hazard.life > 0);
  }

  function updateWarnings(state, dt) {
    state.enemyWarnings.forEach((warning) => {
      warning.warningLeft -= dt;
    });
    state.enemyWarnings = state.enemyWarnings.filter((warning) => warning.warningLeft > 0);

    state.bossWarnings.forEach((warning) => {
      warning.life -= dt;
      warning.warningLeft = Math.max(0, warning.warningLeft - dt);
      warning.pulseTimer = Math.max(0, warning.pulseTimer - dt);
      if (warning.warningLeft > 0 || warning.pulseTimer > 0) return;
      if (isPointInWarning(state.player, warning, state.player.radius)) {
        if (!warning.evaluated) state.bossPatternHits += 1;
        warning.evaluated = true;
        applyPlayerDamage(state, warning.damage || 10, { behavior: 'boss' }, warning.label, warning.colorToken, 0.72);
        warning.pulseTimer = 0.8;
      } else if (!warning.evaluated) {
        warning.evaluated = true;
        recordBossPatternAvoided(state, warning);
      }
    });
    state.bossWarnings = state.bossWarnings.filter((warning) => warning.life > 0);
  }

  function recordBossPatternAvoided(state, warning) {
    state.bossPatternAvoids += 1;
    const player = state.player;
    if (player.playbookId === 'thief') {
      player.bossBurstTimer = Math.max(player.bossBurstTimer, 2.2);
      state.bossContribution.triggers += 1;
      state.bossContribution.text = '보스 패턴 회피 직후 짧은 가속과 폭딜 창을 열었습니다.';
      addFloater(state, '그림자 반격', player.x, player.y - 42, '--class-thief', 0.95);
      return;
    }
    if (player.playbookId === 'druid') {
      const boss = state.enemies.find((enemy) => enemy.behavior === 'boss');
      if (boss) boss.slowTimer = Math.max(boss.slowTimer, 1.35);
      player.bossBurstTimer = Math.max(player.bossBurstTimer, 1.2);
      state.bossContribution.triggers += 1;
      state.bossContribution.controlTime += 1.35;
      state.bossContribution.text = '보스 패턴 뒤 뿌리 둔화와 짧은 이동 보상을 얻었습니다.';
      addFloater(state, '뿌리 되감기', player.x, player.y - 42, '--class-druid', 0.95);
      return;
    }
    if (player.playbookId === 'ranger' && warning.kind === 'line') {
      state.bossContribution.triggers += 1;
      state.bossContribution.text = '직선 패턴을 벌려 피하며 표식 피해 창을 유지했습니다.';
    }
  }

  function isPointInHazard(point, hazard, radius) {
    if (hazard.kind === 'wolfLane' || hazard.kind === 'towerGaze') return pointInLine(point, hazard, radius);
    if (hazard.kind === 'thornCross') {
      return pointInLine(point, hazard, radius) || pointInLine(point, { ...hazard, angle: (hazard.angle || 0) + Math.PI / 2 }, radius);
    }
    if (hazard.kind === 'bellRing') {
      const dist = Math.hypot(point.x - hazard.x, point.y - hazard.y);
      return Math.abs(dist - hazard.radius) <= (hazard.width || 34) + radius;
    }
    const dist = Math.hypot(point.x - hazard.x, point.y - hazard.y);
    return dist <= (hazard.radius || 60) + radius;
  }

  function applyHazardDamage(state, hazard) {
    const player = state.player;
    if (player.invulnerableTimer > 0) return;
    player.health -= hazard.damage;
    state.hazardDamageTaken += hazard.damage;
    player.invulnerableTimer = 0.42;
    state.effects.flash = Math.max(state.effects.flash, 0.1);
    triggerHitVignette(state);
    addFloater(state, hazard.label || '위험 구역', player.x, player.y - 26, hazard.colorToken || '--status-error', 0.8);
    spawnDamageNumber(state, hazard.damage, player.x, player.y - 30);
  }

  function updateTension(state) {
    const player = state.player;
    if (player.tension < player.maxTension) return;
    player.tension = player.maxTension - 3;
    player.health -= 6;
    state.effects.flash = 0.28;
    state.effects.shake = 0.34;
    addFloater(state, '긴장이 한계에 닿았습니다', player.x, player.y - 42, '--status-error', 1.5);
  }

  function getAttackTrail(kind) {
    const trails = {
      arrow: 'arrow',
      bell: 'bell',
      fan: 'knife',
      knives: 'knife',
      missile: 'rune',
      radiance: 'halo',
      roots: 'root',
    };
    return trails[kind] || 'ember';
  }

  function addFloater(state, text, x, y, color, life = 1.1, screenSpace = false) {
    state.floaters.push({ text, x, y, color, life, maxLife: life, screenSpace });
  }

  function consumeLevelUps(state) {
    const player = state.player;
    let leveled = false;
    while (player.xp >= player.nextXp) {
      player.xp -= player.nextXp;
      player.level += 1;
      const curve = state.content.balance && state.content.balance.earlyGame && state.content.balance.earlyGame.xpCurve;
      const growth = curve ? curve.growth : 1.35;
      const flat = curve ? curve.flat : 4;
      player.nextXp = Math.floor(player.nextXp * growth + flat);
      leveled = true;
    }
    if (leveled) {
      state.effects.pulse = 0.45;
      state.effects.levelShockwave = 1;
      addFloater(state, `레벨 ${player.level}`, player.x, player.y - 36, '--accent-ember', 1.5);
    }
    return leveled;
  }

  function spawnDeathParticles(state, enemy) {
    const count = enemy.behavior === 'boss' ? 26 : enemy.elite ? 18 : 9;
    const baseSpeed = enemy.behavior === 'boss' ? 135 : enemy.elite ? 105 : 72;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = baseSpeed * (0.38 + Math.random() * 0.78);
      state.particles.push({
        kind: enemy.behavior === 'boss' ? 'bellShard' : enemy.elite ? 'eliteShard' : 'deathSmoke',
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.max(3, enemy.radius * (0.1 + Math.random() * 0.12)),
        colorToken: enemy.behavior === 'boss' ? '--accent-bell' : enemy.elite ? '--accent-ember' : enemy.colorToken,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
      });
    }
  }

  function spawnImpactSparks(state, enemy, kind, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 38 + Math.random() * 72;
      state.particles.push({
        kind: 'impactSpark',
        x: enemy.x + Math.cos(angle) * enemy.radius * 0.35,
        y: enemy.y + Math.sin(angle) * enemy.radius * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.5 + Math.random() * 2.5,
        colorToken: kind === 'bell' ? '--accent-bell' : kind === 'roots' ? '--class-druid' : '--accent-ember',
        life: 0.18 + Math.random() * 0.12,
        maxLife: 0.32,
      });
    }
  }

  function spawnXpAbsorbParticles(state, gem, player) {
    const pull = normalize(player.x - gem.x, player.y - gem.y);
    for (let index = 0; index < 3; index += 1) {
      const side = index - 1;
      state.particles.push({
        kind: 'xpAbsorb',
        x: gem.x,
        y: gem.y,
        vx: pull.x * (90 + index * 24) - pull.y * side * 36,
        vy: pull.y * (90 + index * 24) + pull.x * side * 36,
        radius: 2.5 + index,
        colorToken: '--status-info',
        life: 0.28 + index * 0.06,
        maxLife: 0.42,
      });
    }
  }

  function pickUpgrades(state) {
    const available = state.content.upgrades.filter((upgrade) => (
      (state.upgradeLevels[upgrade.id] || 0) < upgrade.maxLevel
      && (upgrade.pools || []).some((pool) => state.playbook.upgradePool.includes(pool))
    ));
    const chosen = [];
    addRecommendedUpgrade(chosen, pickBestUpgrade(available, state, scoreCurrentBuild), '현재 빌드', '이미 잡은 태그와 직업 강점을 더 밀어줍니다.');
    addRecommendedUpgrade(chosen, pickBestUpgrade(available, state, scorePivotBuild, chosen), '방향 전환', '새 태그로 보스/진화 각도를 바꿉니다.');
    addRecommendedUpgrade(chosen, pickBestUpgrade(available, state, scoreStabilityBuild, chosen), '안정 보정', '체력, 회피, 제어로 초반 흔들림을 줄입니다.');
    available
      .filter((upgrade) => !chosen.some((item) => item.id === upgrade.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3 - chosen.length)
      .forEach((upgrade) => addRecommendedUpgrade(chosen, upgrade, '보조 선택', '남은 빌드 빈칸을 메우는 선택입니다.'));
    return chosen;
  }

  function addRecommendedUpgrade(chosen, upgrade, role, reason) {
    if (!upgrade || chosen.some((item) => item.id === upgrade.id)) return;
    const detail = createUpgradeDetail(upgrade, chosen.length, reason);
    chosen.push({
      ...upgrade,
      recommendationRole: role,
      recommendationReason: reason,
      itemType: detail.itemType,
      effectPreview: detail.effectPreview,
      evolutionCondition: detail.evolutionCondition,
    });
  }

  function createUpgradeDetail(upgrade, index, reason) {
    const labels = ['무기/공격 강화', '패시브/생존 강화', '빌드 강화'];
    const itemType = upgrade.family === 'weapon'
      ? '무기'
      : upgrade.family === 'survival' || upgrade.family === 'control' || upgrade.family === 'mobility'
        ? '패시브'
        : labels[index] || '강화';
    return {
      itemType,
      effectPreview: upgrade.text,
      evolutionCondition: findEvolutionTextForUpgrade(upgrade),
      recommendationReason: reason,
    };
  }

  function findEvolutionTextForUpgrade(upgrade) {
    const link = UPGRADE_ITEM_LINKS[upgrade.id];
    if (!link) return '진화 조건: 무기 Lv.8 + 지정 패시브 + 엘리트 상자';
    const catalog = window.DungeonworldSurvivorsContent.itemCatalog;
    const evolution = (catalog.evolutions || []).find((item) => (
      item.weaponId === link.id || item.passiveId === link.id
    ));
    if (!evolution) return '진화 조건: 무기 Lv.8 + 지정 패시브 + 엘리트 상자';
    const weapon = catalog.weapons.find((item) => item.id === evolution.weaponId);
    const passive = catalog.passives.find((item) => item.id === evolution.passiveId);
    return `진화 조건: ${weapon.title} Lv.8 + ${passive.title} 보유 + 상자`;
  }

  function pickBestUpgrade(available, state, scorer, existing = []) {
    return available
      .filter((upgrade) => !existing.some((item) => item.id === upgrade.id))
      .map((upgrade) => ({ upgrade, score: scorer(upgrade, state) + Math.random() * 0.01 }))
      .sort((a, b) => b.score - a.score)[0]?.upgrade || null;
  }

  function scoreCurrentBuild(upgrade, state) {
    const tagScore = (upgrade.tags || []).reduce((score, tag) => score + (state.buildTags[tag] || 0) * 6, 0);
    const poolScore = (upgrade.pools || []).some((pool) => pool === state.playbook.id) ? 8 : 0;
    const rarityScore = upgrade.rarity === 'class' ? 4 : 0;
    return tagScore + poolScore + rarityScore;
  }

  function scorePivotBuild(upgrade, state) {
    const usedTags = Object.keys(state.buildTags);
    const freshTags = (upgrade.tags || []).filter((tag) => !usedTags.includes(tag)).length;
    const repeatPenalty = (upgrade.tags || []).reduce((penalty, tag) => penalty + (state.buildTags[tag] || 0), 0);
    const bossHook = (upgrade.tags || []).some((tag) => tag === 'boss' || tag === 'bell' || tag === 'pierce') ? 4 : 0;
    return freshTags * 5 + bossHook - repeatPenalty * 2 + (upgrade.rarity === 'rare' ? 1 : 0);
  }

  function scoreStabilityBuild(upgrade, state) {
    const stableTags = ['survival', 'shield', 'control', 'mobility', 'faith', 'root'];
    const stableScore = (upgrade.tags || []).filter((tag) => stableTags.includes(tag)).length * 5;
    const lowHealthBonus = state.player.health < state.player.maxHealth * 0.55 ? 5 : 0;
    const highTensionBonus = state.player.tension > state.player.maxTension * 0.5 ? 4 : 0;
    return stableScore + lowHealthBonus + highTensionBonus + (upgrade.family === 'survival' ? 4 : 0);
  }

  function applyUpgrade(state, upgrade) {
    const nextLevel = (state.upgradeLevels[upgrade.id] || 0) + 1;
    state.upgradeLevels[upgrade.id] = nextLevel;
    upgrade.apply(state.player, nextLevel);
    const selected = {
      id: upgrade.id,
      title: upgrade.title,
      level: nextLevel,
      rarity: upgrade.rarity,
      family: upgrade.family,
      tags: upgrade.tags || [],
      text: upgrade.text,
    };
    state.selectedUpgrades.push(selected);
    state.learnedUpgrades.push(`${upgrade.title} ${formatLevel(nextLevel)} · ${summarizeUpgradeDirection(selected.tags)}`);
    recordBuildTags(state, selected.tags);
    recordInventoryUpgrade(state, upgrade);
    updateSynergies(state);
    return selected;
  }

  function recordInventoryUpgrade(state, upgrade) {
    const link = UPGRADE_ITEM_LINKS[upgrade.id];
    if (!link) return;
    setInventoryItemLevel(state, link.type, link.id, getInventoryItemLevel(state, link.type, link.id) + 1);
  }

  function summarizeUpgradeDirection(tags) {
    if (tags.includes('boss')) return '보스 화력';
    if (tags.includes('shield') || tags.includes('survival')) return '생존 안정';
    if (tags.includes('blade') || tags.includes('pierce')) return '처치 속도';
    if (tags.includes('control') || tags.includes('root')) return '제어 강화';
    if (tags.includes('bell') || tags.includes('arcane')) return '주문 화력';
    if (tags.includes('hunt') || tags.includes('mobility')) return '거리 운영';
    if (tags.includes('faith')) return '회복 운영';
    return '빌드 보완';
  }

  function getInventoryItemLevel(state, itemType, itemId) {
    const item = findInventoryItem(state, itemType, itemId);
    return item ? item.level : 0;
  }

  function getEvolutionPlan(state, evolution) {
    if (!evolution) return null;
    const catalog = state.content.itemCatalog || { weapons: [], passives: [] };
    const weapon = catalog.weapons.find((item) => item.id === evolution.weaponId);
    const passive = catalog.passives.find((item) => item.id === evolution.passiveId);
    const inventoryWeapon = findInventoryItem(state, 'weapon', evolution.weaponId);
    const inventoryPassive = findInventoryItem(state, 'passive', evolution.passiveId);
    const weaponMaxLevel = weapon ? weapon.maxLevel : 8;
    const weaponLevel = inventoryWeapon ? inventoryWeapon.level : 0;
    return {
      weaponTitle: weapon ? weapon.title : '지정 무기',
      weaponLevel,
      weaponMaxLevel,
      passiveTitle: passive ? passive.title : '지정 패시브',
      hasPassive: Boolean(inventoryPassive),
      evolvedTitle: evolution.title,
      effect: evolution.effect,
      ready: weaponLevel >= weaponMaxLevel && Boolean(inventoryPassive),
    };
  }

  function getUpgradeEvolutionState(state, upgrade) {
    const link = UPGRADE_ITEM_LINKS[upgrade.id];
    if (!link) {
      return {
        status: 'generic',
        label: '진화 조건',
        text: '무기 Lv.8 + 지정 패시브 + 상자',
      };
    }
    const catalog = state.content.itemCatalog || { weapons: [], passives: [], evolutions: [] };
    const evolution = (catalog.evolutions || []).find((item) => (
      item.weaponId === link.id || item.passiveId === link.id
    ));
    const plan = getEvolutionPlan(state, evolution);
    if (!plan) {
      return {
        status: 'generic',
        label: '진화 조건',
        text: '무기 Lv.8 + 지정 패시브 + 상자',
      };
    }
    const currentLinkedLevel = getInventoryItemLevel(state, link.type, link.id);
    const linkedCatalog = getCatalogItem(state, link.type, link.id);
    const linkedMaxLevel = linkedCatalog ? linkedCatalog.maxLevel : plan.weaponMaxLevel;
    const nextLinkedLevel = clamp(currentLinkedLevel + 1, 1, linkedMaxLevel);
    const weaponLevelAfterPick = link.type === 'weapon' ? nextLinkedLevel : plan.weaponLevel;
    const hasPassiveAfterPick = link.type === 'passive' ? true : plan.hasPassive;
    const readyAfterPick = weaponLevelAfterPick >= plan.weaponMaxLevel && hasPassiveAfterPick;
    const missing = [];
    if (weaponLevelAfterPick < plan.weaponMaxLevel) missing.push(`${plan.weaponTitle} Lv.${plan.weaponMaxLevel}`);
    if (!hasPassiveAfterPick) missing.push(`${plan.passiveTitle} 보유`);
    if (plan.ready) {
      return {
        status: 'ready',
        label: '진화 가능',
        text: `${plan.weaponTitle} + ${plan.passiveTitle} 완료. 다음 상자에서 ${plan.evolvedTitle}`,
      };
    }
    if (readyAfterPick) {
      return {
        status: 'will-ready',
        label: '선택 후 진화 가능',
        text: `이 선택으로 조건 완료. 다음 상자에서 ${plan.evolvedTitle}`,
      };
    }
    return {
      status: link.type === 'passive' ? 'material' : 'progress',
      label: link.type === 'passive' ? '진화 재료' : '진화 진행',
      text: `${plan.evolvedTitle}: ${missing.join(' + ')} + 상자`,
    };
  }

  function setInventoryItemLevel(state, itemType, itemId, level) {
    const collection = getInventoryCollection(state, itemType);
    const catalogItem = getCatalogItem(state, itemType, itemId);
    if (!collection || !catalogItem) return null;
    let item = collection.find((entry) => entry.id === itemId);
    if (!item) {
      item = { id: catalogItem.id, title: catalogItem.title, level: 0, maxLevel: catalogItem.maxLevel };
      collection.push(item);
    }
    item.level = clamp(level, 1, item.maxLevel);
    return item;
  }

  function findInventoryItem(state, itemType, itemId) {
    const collection = getInventoryCollection(state, itemType);
    return collection ? collection.find((item) => item.id === itemId) : null;
  }

  function getInventoryCollection(state, itemType) {
    if (itemType === 'weapon') return state.inventory.weapons;
    if (itemType === 'passive') return state.inventory.passives;
    if (itemType === 'evolvedWeapon') return state.inventory.evolvedWeapons;
    return null;
  }

  function getCatalogItem(state, itemType, itemId) {
    const catalog = state.content.itemCatalog || {};
    const key = itemType === 'weapon' ? 'weapons' : itemType === 'passive' ? 'passives' : 'evolutions';
    return (catalog[key] || []).find((item) => item.id === itemId);
  }

  function getEligibleEvolutions(state) {
    const catalog = state.content.itemCatalog || { evolutions: [] };
    return (catalog.evolutions || []).filter((evolution) => {
      if (state.inventory.evolvedWeapons.some((item) => item.id === evolution.id)) return false;
      const weapon = findInventoryItem(state, 'weapon', evolution.weaponId);
      const passive = findInventoryItem(state, 'passive', evolution.passiveId);
      return weapon && weapon.level >= weapon.maxLevel && passive;
    });
  }

  function claimChestReward(state) {
    const reward = state.pendingChestRewards.shift();
    if (!reward) return null;
    if (reward.type === 'evolution') {
      const evolution = reward.evolution;
      state.inventory.evolvedWeapons.push({ id: evolution.id, title: evolution.title, level: 1, maxLevel: 1 });
      state.learnedUpgrades.push(`진화: ${evolution.title}`);
      addFloater(state, `진화: ${evolution.title}`, state.player.x, state.player.y - 86, '--accent-bell', 1.8, true);
      return reward;
    }
    if (reward.type === 'weapon' || reward.type === 'passive') {
      const item = setInventoryItemLevel(state, reward.type, reward.item.id, reward.item.level + 1);
      reward.item = item;
      state.learnedUpgrades.push(`${item.title} Lv.${item.level}`);
      return reward;
    }
    if (reward.type === 'upgrade' && reward.upgrade) {
      reward.selected = applyUpgrade(state, reward.upgrade);
      return reward;
    }
    return reward;
  }

  function recordBuildTags(state, tags) {
    tags.forEach((tag) => {
      state.buildTags[tag] = (state.buildTags[tag] || 0) + 1;
    });
  }

  function updateSynergies(state) {
    const definitions = [
      { id: 'shieldLine', title: '방패선', tag: 'shield', count: 2, apply: (player) => { player.armor += 2; player.tensionResist += 0.08; } },
      { id: 'bladeTempo', title: '칼날 박자', tag: 'blade', count: 2, apply: (player) => { player.fanCooldownBonus += 0.16; player.speed *= 1.03; } },
      { id: 'rootCircle', title: '뿌리 고리', tag: 'root', count: 2, apply: (player) => { player.rootSlow += 0.25; player.auraRange += 12; } },
      { id: 'blackBellChoir', title: '검은 종 합창', tag: 'bell', count: 2, apply: (player) => { player.bossDamageBonus += 0.12; player.bellWave = Math.max(player.bellWave, 1); } },
      { id: 'faithAnchor', title: '기도 닻', tag: 'faith', count: 2, apply: (player) => { player.healPulse += 1; player.tensionResist += 0.06; } },
      { id: 'huntMark', title: '추적 표식', tag: 'hunt', count: 2, apply: (player) => { player.companionStrike = Math.max(player.companionStrike, 2); player.projectileLife += 0.16; } },
      { id: 'arcaneWard', title: '비전 결계', tag: 'arcane', count: 2, apply: (player) => { player.arcaneShield = Math.max(player.arcaneShield, 1); player.projectileSpeed += 35; } },
      { id: 'controlWindow', title: '판정의 틈', tag: 'control', count: 2, apply: (player) => { player.moveGrace += 1; player.magnet += 18; } },
    ];
    definitions.forEach((definition) => {
      if ((state.buildTags[definition.tag] || 0) < definition.count) return;
      if (state.synergies.some((synergy) => synergy.id === definition.id)) return;
      definition.apply(state.player);
      state.synergies.push({
        id: definition.id,
        title: definition.title,
        tag: definition.tag,
        text: `${definition.tag} 선택 ${definition.count}개로 발동`,
      });
      addFloater(state, `시너지: ${definition.title}`, state.player.x, state.player.y - 62, '--accent-ember', 1.4, true);
    });
  }

  function evaluateRunGoals(state) {
    return state.runGoals.map((goal) => {
      if (goal.type === 'level_before_boss') return evaluateLevelGoal(state, goal);
      if (goal.type === 'tag_combo') return evaluateTagGoal(state, goal);
      if (goal.type === 'hazard_damage') return evaluateHazardGoal(state, goal);
      if (goal.type === 'wave_kills') return evaluateWaveKillGoal(state, goal);
      if (goal.type === 'boss_avoid') return evaluateBossAvoidGoal(state, goal);
      if (goal.type === 'boss_time') return evaluateBossTimeGoal(state, goal);
      return { ...goal, status: 'failed', progress: '평가 기준을 찾지 못했습니다.', close: '다음 런에서 다시 확인합니다.' };
    });
  }

  function goalResult(goal, achieved, close, progress, closeText) {
    return {
      id: goal.id,
      title: goal.title,
      copy: goal.copy,
      status: achieved ? 'achieved' : close ? 'close' : 'failed',
      progress,
      close: achieved ? '달성했습니다.' : closeText,
    };
  }

  function evaluateLevelGoal(state, goal) {
    const level = state.levelAtBoss || state.player.level;
    const achieved = level >= goal.target;
    const close = level >= goal.near;
    return goalResult(goal, achieved, close, `보스 전 레벨 ${level} / ${goal.target}`, `아까운 점: 레벨 ${Math.max(1, goal.target - level)}만 더 필요했습니다.`);
  }

  function evaluateTagGoal(state, goal) {
    const count = goal.tags.reduce((total, tag) => total + (state.buildTags[tag] || 0), 0);
    return goalResult(goal, count >= goal.target, count >= goal.near, `${goal.tags.map((tag) => `#${tag}`).join(' ')} ${count} / ${goal.target}`, '아까운 점: 같은 방향 태그를 한 장만 더 모으면 완성됩니다.');
  }

  function evaluateHazardGoal(state, goal) {
    const damage = Math.round(state.hazardDamageTaken);
    return goalResult(goal, damage <= goal.maxDamage, damage <= goal.nearDamage, `위험 구역 피해 ${damage} / ${goal.maxDamage}`, '아까운 점: 전조 한두 번만 더 피하면 안정 목표권입니다.');
  }

  function evaluateWaveKillGoal(state, goal) {
    const count = state.waveKills[goal.waveId] || 0;
    return goalResult(goal, count >= goal.target, count >= goal.near, `${count} / ${goal.target} 처치`, '아까운 점: 해당 웨이브 화력이 조금 부족했습니다.');
  }

  function evaluateBossAvoidGoal(state, goal) {
    const achieved = state.bossPatternAvoids >= goal.avoidTarget && state.bossPatternHits <= goal.maxHits;
    const close = state.bossPatternAvoids >= goal.nearAvoid;
    return goalResult(goal, achieved, close, `회피 ${state.bossPatternAvoids} / ${goal.avoidTarget}, 피격 ${state.bossPatternHits} / ${goal.maxHits}`, '아까운 점: 보스 전조를 한 번만 더 안정적으로 넘기면 됩니다.');
  }

  function evaluateBossTimeGoal(state, goal) {
    const elapsed = state.bossStartedAt === null ? null : Math.round((state.bossDefeatedAt || state.elapsed) - state.bossStartedAt);
    const achieved = state.bossDefeated && elapsed !== null && elapsed <= goal.targetSeconds;
    const close = state.bossDefeated && elapsed !== null && elapsed <= goal.nearSeconds;
    const progress = elapsed === null ? '보스 미등장' : `${elapsed}초 / ${goal.targetSeconds}초`;
    return goalResult(goal, achieved, close, progress, '아까운 점: 보스 화력 태그나 거리 유지 보상을 더 챙기면 단축됩니다.');
  }

  function getRunSummary(state) {
    const sortedTags = Object.keys(state.buildTags)
      .sort((a, b) => state.buildTags[b] - state.buildTags[a])
      .map((tag) => ({ tag, count: state.buildTags[tag] }));
    const buildIdentity = createBuildIdentity(state, sortedTags);
    const classUltimate = evaluateClassUltimate(state);
    return {
      playbook: state.playbook.title,
      buildName: buildIdentity.name,
      buildVerdict: buildIdentity.verdict,
      buildSummary: buildIdentity.summary,
      classUltimate,
      survivalTime: Math.min(state.elapsed, state.duration),
      kills: state.kills,
      level: state.player.level,
      won: state.bossDefeated,
      selectedUpgrades: state.selectedUpgrades.slice(),
      buildTags: sortedTags,
      synergies: state.synergies.slice(),
      goals: evaluateRunGoals(state),
      bossContribution: {
        ...state.bossContribution,
        bonusDamage: Math.round(state.bossContribution.bonusDamage),
        preventedDamage: Math.round(state.bossContribution.preventedDamage),
        recoveredHealth: Math.round(state.bossContribution.recoveredHealth),
        controlTime: Math.round(state.bossContribution.controlTime * 10) / 10,
      },
    };
  }

  function createBuildIdentity(state, sortedTags) {
    const primaryTag = sortedTags[0] ? sortedTags[0].tag : null;
    const classUltimate = evaluateClassUltimate(state);
    const playbookNames = {
      fighter: '전사',
      thief: '도적',
      cleric: '사제',
      druid: '드루이드',
      wizard: '주문사',
      ranger: '레인저',
    };
    const tagNames = {
      arcane: '검은 종',
      bell: '검은 종',
      blade: '칼날 박자',
      boss: '문턱 압박',
      control: '판정의 틈',
      faith: '기도 닻',
      hunt: '추적 표식',
      mobility: '빠른 발',
      pierce: '관통 사격',
      root: '뿌리 고리',
      shield: '방패선',
      survival: '생존선',
      wild: '야수 형상',
    };
    const playbookName = playbookNames[state.playbook.id] || state.playbook.title;
    const theme = tagNames[primaryTag] || state.playbook.role;
    const verdict = state.bossDefeated
      ? '마지막 문 돌파'
      : state.player.level >= 7
        ? '보스전 준비 완료'
        : '초반 생존 보강 필요';
    const synergyText = state.synergies.length > 0
      ? `${state.synergies.length}개 시너지 발동`
      : '시너지 미발동';
    return {
      name: classUltimate.ready ? classUltimate.resultName : `${theme} ${playbookName}`,
      verdict,
      summary: `${state.kills}체 처치, 레벨 ${state.player.level}, ${synergyText}`,
    };
  }

  function evaluateClassUltimate(state) {
    const ultimate = state.playbook.ultimate;
    if (!ultimate) {
      return {
        title: '궁극기 없음',
        resultName: state.playbook.title,
        ready: false,
        progress: '조건 없음',
        copy: '이 플레이북에는 궁극기 조건이 없습니다.',
      };
    }
    const count = ultimate.tags.reduce((total, tag) => total + (state.buildTags[tag] || 0), 0);
    const ready = ultimate.tags.every((tag) => (state.buildTags[tag] || 0) > 0) || count >= ultimate.tags.length;
    return {
      title: ultimate.title,
      resultName: ultimate.resultName,
      ready,
      progress: `${count} / ${ultimate.tags.length} 핵심 태그`,
      copy: ultimate.copy,
    };
  }

  function updateScene(state) {
    const nextIndex = state.scenes.findIndex((scene, index) => (
      state.elapsed >= scene.at
      && (!state.scenes[index + 1] || state.elapsed < state.scenes[index + 1].at)
    ));
    if (nextIndex >= 0) state.sceneIndex = nextIndex;
  }

  function formatLevel(level) {
    return ['I', 'II', 'III', 'IV'][level - 1] || String(level);
  }

  function tick(state, input, dt) {
    state.elapsed += dt;
    updateScene(state);
    updateWave(state, dt);
    updatePlayer(state, input, dt);
    fireProjectiles(state);
    updateProjectiles(state, dt);
    updateAttackMarks(state, dt);
    updateParticles(state, dt);
    updateDamageNumbers(state, dt);
    updateOrbitingSpears(state, dt);
    updateEnemies(state, dt);
    resolveHits(state);
    updateGems(state, dt);
    updateChests(state, dt);
    if (collectChests(state)) return 'chest';
    updateFloaters(state, dt);
    updateHazards(state, dt);
    updateWarnings(state, dt);
    updateEffects(state, dt);
    updateTension(state);
    if (state.player.health <= 0) return 'lost';
    if (state.bossDefeated) return 'won';
    if (consumeLevelUps(state)) return 'level';
    return 'running';
  }

  // QA/성능 측정 전용 - 임의 개체 수로 state를 채워 스로틀 프로파일에서 프레임 비용을
  // 실측한다(계획서 1절 작업 A 게이트). 실제 스폰 로직과 무관하게 개체 배열만 채운다.
  function fillStressEntities(state, counts) {
    const enemyCount = counts && counts.enemies || 0;
    const projectileCount = counts && counts.projectiles || 0;
    const particleCount = counts && counts.particles || 0;
    for (let index = 0; index < enemyCount; index += 1) {
      const typeId = ['goblin', 'slime', 'armor', 'wolf', 'mimic', 'cultist'][index % 6];
      const type = state.content.enemyTypes[typeId];
      const angle = (index / enemyCount) * Math.PI * 2;
      state.enemies.push({
        ...type,
        x: state.player.x + Math.cos(angle) * (140 + (index % 5) * 30),
        y: state.player.y + Math.sin(angle) * (140 + (index % 5) * 30),
        hp: type.hp * 500,
        maxHp: type.hp * 500,
        slowTimer: 0,
        behaviorTimer: Math.random() * 0.6,
        hitFlash: 0,
        attackCooldown: 5,
        attackWindup: 0,
        attackRecovery: 0,
        attackTarget: null,
        warning: null,
        attackProfile: { ...type.attackProfile, range: type.attackProfile.range || 60 },
      });
    }
    for (let index = 0; index < projectileCount; index += 1) {
      const angle = (index / projectileCount) * Math.PI * 2;
      state.projectiles.push({
        x: state.player.x,
        y: state.player.y,
        originX: state.player.x,
        originY: state.player.y,
        vx: Math.cos(angle) * 300,
        vy: Math.sin(angle) * 300,
        radius: 5,
        damage: 10,
        pierce: 999,
        life: 5,
        maxLife: 5,
        kind: 'missile',
        source: 'wizard',
        angle,
        trail: 'rune',
        impactKind: 'missile',
      });
    }
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (index / particleCount) * Math.PI * 2;
      state.particles.push({
        kind: 'impactSpark',
        x: state.player.x,
        y: state.player.y,
        vx: Math.cos(angle) * 80,
        vy: Math.sin(angle) * 80,
        radius: 3,
        colorToken: '--accent-ember',
        life: 5,
        maxLife: 5,
      });
    }
  }

  window.DungeonworldSurvivorsSystems = {
    WORLD,
    RUN_MODES,
    createState,
    applyUpgrade,
    claimChestReward,
    collectChests,
    dropChest,
    evaluateRunGoals,
    getCurrentWave,
    getEligibleEvolutions,
    getEvolutionPlan,
    getRunSummary,
    evaluateClassUltimate,
    getUpgradeEvolutionState,
    pickUpgrades,
    setInventoryItemLevel,
    tick,
    clamp,
    fillStressEntities,
  };
})();

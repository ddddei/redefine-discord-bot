(function () {
  const GAME_DURATION = 240;
  const WORLD = { width: 960, height: 540 };

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

  function createPlayer() {
    return {
      x: WORLD.width / 2, y: WORLD.height / 2,
      radius: 15, maxHealth: 100, health: 100, speed: 168,
      armor: 0, damage: 18, attackCooldown: 0.62, attackTimer: 0,
      invulnerableTimer: 0, magnet: 74, level: 1, xp: 0, nextXp: 6,
      shots: 1, pierce: 0,
      aura: false,
      auraDamage: 0,
      auraRange: 106,
      auraTimer: 0,
      fanKnives: 0,
      fanTimer: 0,
      orbitingSpears: 0,
      orbitTimer: 0,
      bellWave: 0,
      bellTimer: 0,
      spawnPressure: 0,
    };
  }

  function createState(content) {
    return {
      content,
      duration: GAME_DURATION,
      elapsed: 0,
      sceneIndex: 0,
      waveIndex: 0,
      spawnTimer: 0,
      bossSpawned: false,
      bossDefeated: false,
      kills: 0,
      player: createPlayer(),
      enemies: [],
      projectiles: [],
      gems: [],
      floaters: [],
      effects: { flash: 0, shake: 0, pulse: 0 },
      upgradeLevels: {},
      learnedUpgrades: ['토른의 방패: 기본 이동과 자동 단검'],
      status: 'ready',
    };
  }

  function getCurrentWave(state) {
    return state.content.wavePatterns.find((wave) => (
      state.elapsed >= wave.at && state.elapsed < wave.until
    )) || state.content.wavePatterns[state.content.wavePatterns.length - 1];
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
    state.enemies.push({
      ...type,
      x: edge.x,
      y: edge.y,
      maxHp: type.hp,
      slowTimer: 0,
      behaviorTimer: Math.random() * 0.6,
      hitFlash: 0,
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
    const nextWaveIndex = state.content.wavePatterns.indexOf(wave);
    if (nextWaveIndex !== state.waveIndex) {
      state.waveIndex = nextWaveIndex;
      addFloater(state, wave.title, WORLD.width / 2, 78, '--accent-ember', 1.8);
      state.effects.pulse = 0.5;
    }

    const pressure = wave.pressure + state.elapsed / 210 + state.player.spawnPressure;
    state.spawnTimer -= dt * pressure;
    if (state.spawnTimer <= 0) {
      wave.packs.forEach((pack) => spawnPack(state, pack));
      state.spawnTimer = Math.max(0.24, wave.cadence - state.elapsed / 520);
    }

    if (!state.bossSpawned && state.elapsed > 205) {
      spawnEnemy(state, state.content.enemyTypes.sentinel, { x: WORLD.width + 42, y: WORLD.height / 2 });
      state.bossSpawned = true;
      state.effects.flash = 0.45;
      state.effects.shake = 0.7;
      addFloater(state, '검은 종 파수꾼이 문을 밀고 나옵니다', WORLD.width / 2, 82, '--accent-bell', 2.1);
    }
  }

  function updatePlayer(state, input, dt) {
    const player = state.player;
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const direction = normalize(dx, dy);
    const moving = dx !== 0 || dy !== 0;
    player.x = clamp(player.x + (moving ? direction.x * player.speed * dt : 0), 18, WORLD.width - 18);
    player.y = clamp(player.y + (moving ? direction.y * player.speed * dt : 0), 18, WORLD.height - 18);
    player.attackTimer = Math.max(0, player.attackTimer - dt);
    player.invulnerableTimer = Math.max(0, player.invulnerableTimer - dt);
    updateAura(state, dt);
    updateWeaponTimers(state, dt);
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

  function updateWeaponTimers(state, dt) {
    const player = state.player;
    player.fanTimer = Math.max(0, player.fanTimer - dt);
    player.bellTimer = Math.max(0, player.bellTimer - dt);
  }

  function fireProjectiles(state) {
    const player = state.player;
    if (player.attackTimer > 0 || state.enemies.length === 0) return;
    const targets = state.enemies
      .slice()
      .sort((a, b) => distance(player, a) - distance(player, b))
      .slice(0, player.shots);
    targets.forEach((target) => {
      const direction = normalize(target.x - player.x, target.y - player.y);
      state.projectiles.push({
        x: player.x,
        y: player.y,
        vx: direction.x * 420,
        vy: direction.y * 420,
        radius: 5,
        damage: player.damage,
        pierce: player.pierce,
        life: 1.4,
        kind: 'knife',
      });
    });
    player.attackTimer = player.attackCooldown;
    fireFanKnives(state);
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
        vx: Math.cos(angle) * 360,
        vy: Math.sin(angle) * 360,
        radius: 4,
        damage: 10 + player.fanKnives * 4,
        pierce: 0,
        life: 0.85,
        kind: 'fan',
      });
    }
    player.fanTimer = Math.max(0.55, 1.35 - player.fanKnives * 0.18);
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
      vx: direction.x * 245,
      vy: direction.y * 245,
      radius: 13 + player.bellWave * 4,
      damage: 24 + player.bellWave * 10,
      pierce: 4 + player.bellWave,
      life: 1.9,
      kind: 'bell',
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
      && projectile.x > -40
      && projectile.x < WORLD.width + 40
      && projectile.y > -40
      && projectile.y < WORLD.height + 40
    ));
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
      const behavior = getEnemyBehavior(enemy, direction);
      enemy.x += behavior.x * enemy.speed * behavior.speedScale * slow * dt;
      enemy.y += behavior.y * enemy.speed * behavior.speedScale * slow * dt;
      enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      if (distance(player, enemy) < player.radius + enemy.radius && player.invulnerableTimer <= 0) {
        player.health -= Math.max(3, enemy.damage - player.armor);
        player.invulnerableTimer = 0.7;
        state.effects.flash = 0.2;
        state.effects.shake = 0.28;
        addFloater(state, '위험', player.x, player.y - 22, '--status-error');
      }
    });
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
        enemy.hp -= projectile.damage;
        enemy.hitFlash = 0.13;
        projectile.pierce -= 1;
        if (projectile.pierce < 0) projectile.life = 0;
      });
    });

    const defeated = state.enemies.filter((enemy) => enemy.hp <= 0);
    defeated.forEach((enemy) => {
      state.kills += 1;
      state.gems.push({ x: enemy.x, y: enemy.y, value: enemy.xp, radius: 6, age: 0 });
      if (enemy.behavior === 'boss') {
        state.bossDefeated = true;
        state.effects.flash = 0.65;
        state.effects.shake = 0.55;
        addFloater(state, '마지막 문이 열립니다', WORLD.width / 2, 92, '--status-success', 2);
      } else {
        addFloater(state, enemy.name, enemy.x, enemy.y - 12, enemy.colorToken);
      }
    });
    state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  }

  function updateGems(state, dt) {
    const player = state.player;
    state.gems.forEach((gem) => {
      gem.age += dt;
      const attractionRange = gem.age > 2.4 ? 900 : player.magnet;
      if (distance(player, gem) < attractionRange) {
        const direction = normalize(player.x - gem.x, player.y - gem.y);
        gem.x += direction.x * 260 * dt;
        gem.y += direction.y * 260 * dt;
      }
    });
    const collected = state.gems.filter((gem) => distance(player, gem) < player.radius + gem.radius);
    collected.forEach((gem) => {
      player.xp += gem.value;
      addFloater(state, `+${gem.value}`, gem.x, gem.y - 10, '--status-info', 0.8);
    });
    state.gems = state.gems.filter((gem) => distance(player, gem) >= player.radius + gem.radius);
  }

  function updateFloaters(state, dt) {
    state.floaters.forEach((floater) => {
      floater.y -= 22 * dt;
      floater.life -= dt;
    });
    state.floaters = state.floaters.filter((floater) => floater.life > 0);
  }

  function updateEffects(state, dt) {
    state.effects.flash = Math.max(0, state.effects.flash - dt);
    state.effects.shake = Math.max(0, state.effects.shake - dt);
    state.effects.pulse = Math.max(0, state.effects.pulse - dt);
  }

  function addFloater(state, text, x, y, color, life = 1.1) {
    state.floaters.push({ text, x, y, color, life, maxLife: life });
  }

  function consumeLevelUps(state) {
    const player = state.player;
    let leveled = false;
    while (player.xp >= player.nextXp) {
      player.xp -= player.nextXp;
      player.level += 1;
      player.nextXp = Math.floor(player.nextXp * 1.35 + 4);
      leveled = true;
    }
    if (leveled) {
      state.effects.pulse = 0.45;
      addFloater(state, `레벨 ${player.level}`, player.x, player.y - 36, '--accent-ember', 1.5);
    }
    return leveled;
  }

  function pickUpgrades(state) {
    const available = state.content.upgrades.filter((upgrade) => (
      (state.upgradeLevels[upgrade.id] || 0) < upgrade.maxLevel
    ));
    const byFamily = available.reduce((groups, upgrade) => {
      if (!groups[upgrade.family]) groups[upgrade.family] = [];
      groups[upgrade.family].push(upgrade);
      return groups;
    }, {});
    return Object.keys(byFamily)
      .sort(() => Math.random() - 0.5)
      .flatMap((family) => byFamily[family].sort(() => Math.random() - 0.5).slice(0, 1))
      .slice(0, 3);
  }

  function updateScene(state) {
    const nextIndex = state.content.scenes.findIndex((scene, index) => (
      state.elapsed >= scene.at
      && (!state.content.scenes[index + 1] || state.elapsed < state.content.scenes[index + 1].at)
    ));
    if (nextIndex >= 0) state.sceneIndex = nextIndex;
  }

  function tick(state, input, dt) {
    state.elapsed += dt;
    updateScene(state);
    updateWave(state, dt);
    updatePlayer(state, input, dt);
    fireProjectiles(state);
    updateProjectiles(state, dt);
    updateOrbitingSpears(state, dt);
    updateEnemies(state, dt);
    resolveHits(state);
    updateGems(state, dt);
    updateFloaters(state, dt);
    updateEffects(state, dt);
    if (state.player.health <= 0) return 'lost';
    if (state.bossDefeated) return 'won';
    if (consumeLevelUps(state)) return 'level';
    return 'running';
  }

  window.DungeonworldSurvivorsSystems = {
    WORLD,
    createState,
    pickUpgrades,
    tick,
  };
})();

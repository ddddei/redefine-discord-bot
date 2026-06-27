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

  function createPlayer(playbook) {
    const player = {
      x: WORLD.width / 2, y: WORLD.height / 2,
      radius: 15, maxHealth: 100, health: 100, speed: 168,
      armor: 0, damage: 18, attackCooldown: 0.62, attackTimer: 0,
      invulnerableTimer: 0, magnet: 74, level: 1, xp: 0, nextXp: 6,
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
    };
    if (playbook) {
      player.stats = { ...player.stats, ...playbook.stats };
      player.attackStyle = playbook.attack || player.attackStyle;
      playbook.apply(player);
    }
    return player;
  }

  function findPlaybook(content, playbookId) {
    return content.playbooks.find((playbook) => playbook.id === playbookId) || content.playbooks[0];
  }

  function createState(content, playbookId = 'fighter') {
    const playbook = findPlaybook(content, playbookId);
    return {
      content,
      playbook,
      duration: GAME_DURATION,
      elapsed: 0,
      sceneIndex: 0,
      waveIndex: 0,
      spawnTimer: 0,
      bossSpawned: false,
      bossDefeated: false,
      lastMoveResult: '아직 판정 없음',
      kills: 0,
      attackMarks: [],
      player: createPlayer(playbook),
      enemies: [],
      projectiles: [],
      gems: [],
      floaters: [],
      effects: { flash: 0, shake: 0, pulse: 0 },
      upgradeLevels: {},
      learnedUpgrades: [playbook.learned, playbook.loadout],
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
      resolveDungeonMove(state, wave);
    }

    const pressure = wave.pressure + state.elapsed / 210 + state.player.spawnPressure + state.player.tension * 0.025;
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
      addFloater(state, '10+ 문제 없이 해냅니다', WORLD.width / 2, 112, '--status-success', 1.7);
      return;
    }
    if (total >= 7) {
      state.player.tension = clamp(state.player.tension + 1, 0, state.player.maxTension);
      state.lastMoveResult = `${wave.moveName} 7-9: 대가를 치릅니다`;
      addFloater(state, '7-9 해내지만 대가가 생깁니다', WORLD.width / 2, 112, '--accent-ember', 1.7);
      return;
    }
    state.player.tension = clamp(state.player.tension + Math.max(1, 3 - state.player.moveGrace), 0, state.player.maxTension);
    state.lastMoveResult = `${wave.moveName} 6-: 마스터가 움직입니다`;
    addFloater(state, '6- 예상 밖의 전개', WORLD.width / 2, 112, '--status-error', 1.7);
    wave.packs.slice(0, 1).forEach((pack) => spawnPack(state, pack));
    state.effects.shake = 0.45;
  }

  function updatePlayer(state, input, dt) {
    const player = state.player;
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const direction = normalize(dx, dy);
    const moving = dx !== 0 || dy !== 0;
    const tensionScale = 1 + player.tension * player.tensionSpeed;
    const speed = player.speed * tensionScale;
    player.x = clamp(player.x + (moving ? direction.x * speed * dt : 0), 18, WORLD.width - 18);
    player.y = clamp(player.y + (moving ? direction.y * speed * dt : 0), 18, WORLD.height - 18);
    player.attackTimer = Math.max(0, player.attackTimer - dt);
    player.invulnerableTimer = Math.max(0, player.invulnerableTimer - dt);
    player.arcaneShieldTimer = Math.max(0, player.arcaneShieldTimer - dt);
    player.companionTimer = Math.max(0, player.companionTimer - dt);
    updateAura(state, dt);
    updateHealPulse(state, dt);
    updateCompanionStrike(state);
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

  function updateHealPulse(state, dt) {
    const player = state.player;
    if (player.healPulse <= 0) return;
    player.healTimer -= dt;
    if (player.healTimer > 0) return;
    player.healTimer = Math.max(3.2, 5.4 - player.healPulse * 0.46);
    const amount = 3 + player.healPulse * 2;
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
        vx: vx * player.projectileSpeed,
        vy: vy * player.projectileSpeed,
        radius: player.attackStyle === 'radiance' ? 8 : player.projectileRadius,
        damage: player.damage,
        pierce: player.attackStyle === 'arrow' ? player.pierce + 1 : player.pierce,
        life: player.projectileLife,
        kind: player.attackStyle,
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
        enemy.hp -= player.damage + 8;
        enemy.hitFlash = 0.16;
        enemy.slowTimer = Math.max(enemy.slowTimer, player.cleaveSlow);
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
        vx: Math.cos(angle) * 360,
        vy: Math.sin(angle) * 360,
        radius: 4,
        damage: 10 + player.fanKnives * 4,
        pierce: 0,
        life: 0.85,
        kind: 'fan',
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
      const behavior = getEnemyBehavior(enemy, direction);
      enemy.x += behavior.x * enemy.speed * behavior.speedScale * slow * dt;
      enemy.y += behavior.y * enemy.speed * behavior.speedScale * slow * dt;
      enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      if (distance(player, enemy) < player.radius + enemy.radius && player.invulnerableTimer <= 0) {
        if (player.dodgeChance > 0 && Math.random() < player.dodgeChance) {
          player.invulnerableTimer = 0.36;
          addFloater(state, '회피', player.x, player.y - 22, '--status-info');
          return;
        }
        const shieldReduction = player.arcaneShield > 0 && player.arcaneShieldTimer <= 0 ? 0.45 : 1;
        if (shieldReduction < 1) {
          player.arcaneShieldTimer = 4.8;
          addFloater(state, '비전 보호막', player.x, player.y - 24, '--accent-bell');
        }
        player.health -= Math.max(3, enemy.damage - player.armor) * shieldReduction;
        player.tension = clamp(player.tension + Math.max(0.35, 1 - player.tensionResist), 0, player.maxTension);
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

  function updateTension(state) {
    const player = state.player;
    if (player.tension < player.maxTension) return;
    player.tension = player.maxTension - 3;
    player.health -= 6;
    state.effects.flash = 0.28;
    state.effects.shake = 0.34;
    addFloater(state, '긴장이 한계에 닿았습니다', player.x, player.y - 42, '--status-error', 1.5);
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
      && (upgrade.pools || []).some((pool) => state.playbook.upgradePool.includes(pool))
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
    updateAttackMarks(state, dt);
    updateOrbitingSpears(state, dt);
    updateEnemies(state, dt);
    resolveHits(state);
    updateGems(state, dt);
    updateFloaters(state, dt);
    updateEffects(state, dt);
    updateTension(state);
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

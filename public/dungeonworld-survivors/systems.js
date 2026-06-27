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
      auraTimer: 0,
      spawnPressure: 0,
    };
  }

  function createState(content) {
    return {
      content,
      duration: GAME_DURATION,
      elapsed: 0,
      sceneIndex: 0,
      spawnTimer: 0,
      bossSpawned: false,
      kills: 0,
      player: createPlayer(),
      enemies: [],
      projectiles: [],
      gems: [],
      floaters: [],
      learnedUpgrades: ['토른의 방패'],
      status: 'ready',
    };
  }

  function chooseEnemyType(elapsed, enemyTypes) {
    if (elapsed > 195) return Math.random() < 0.2 ? enemyTypes.armor : enemyTypes.wolf;
    if (elapsed > 135) return Math.random() < 0.35 ? enemyTypes.wolf : enemyTypes.armor;
    if (elapsed > 90) return Math.random() < 0.55 ? enemyTypes.slime : enemyTypes.goblin;
    if (elapsed > 45) return Math.random() < 0.35 ? enemyTypes.slime : enemyTypes.goblin;
    return enemyTypes.goblin;
  }

  function spawnEnemy(state, type) {
    const side = Math.floor(Math.random() * 4);
    const edge = [
      { x: -30, y: Math.random() * WORLD.height },
      { x: WORLD.width + 30, y: Math.random() * WORLD.height },
      { x: Math.random() * WORLD.width, y: -30 },
      { x: Math.random() * WORLD.width, y: WORLD.height + 30 },
    ][side];
    state.enemies.push({
      ...type,
      x: edge.x,
      y: edge.y,
      maxHp: type.hp,
      slowTimer: 0,
    });
  }

  function updateWave(state, dt) {
    const pressure = 1 + state.elapsed / 150 + state.player.spawnPressure;
    state.spawnTimer -= dt * pressure;
    if (state.spawnTimer <= 0) {
      spawnEnemy(state, chooseEnemyType(state.elapsed, state.content.enemyTypes));
      state.spawnTimer = Math.max(0.18, 1.05 - state.elapsed / 340);
    }

    if (!state.bossSpawned && state.elapsed > 205) {
      spawnEnemy(state, state.content.enemyTypes.sentinel);
      state.bossSpawned = true;
      addFloater(state, '검은 종 파수꾼이 문을 밀고 나옵니다', WORLD.width / 2, 82, '--accent-bell');
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
  }

  function updateAura(state, dt) {
    const player = state.player;
    if (!player.aura) return;
    player.auraTimer -= dt;
    if (player.auraTimer > 0) return;
    player.auraTimer = 3;
    state.enemies.forEach((enemy) => {
      if (distance(player, enemy) < 118) enemy.slowTimer = 1.7;
    });
    addFloater(state, '라메의 잎 표식', player.x, player.y - 28, '--accent-primary');
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
      });
    });
    player.attackTimer = player.attackCooldown;
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

  function updateEnemies(state, dt) {
    const player = state.player;
    state.enemies.forEach((enemy) => {
      const direction = normalize(player.x - enemy.x, player.y - enemy.y);
      const slow = enemy.slowTimer > 0 ? 0.48 : 1;
      enemy.x += direction.x * enemy.speed * slow * dt;
      enemy.y += direction.y * enemy.speed * slow * dt;
      enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
      if (distance(player, enemy) < player.radius + enemy.radius && player.invulnerableTimer <= 0) {
        player.health -= Math.max(3, enemy.damage - player.armor);
        player.invulnerableTimer = 0.7;
        addFloater(state, '위험', player.x, player.y - 22, '--status-error');
      }
    });
  }

  function resolveHits(state) {
    state.projectiles.forEach((projectile) => {
      state.enemies.forEach((enemy) => {
        if (projectile.life <= 0 || distance(projectile, enemy) > projectile.radius + enemy.radius) return;
        enemy.hp -= projectile.damage;
        projectile.pierce -= 1;
        if (projectile.pierce < 0) projectile.life = 0;
      });
    });

    const defeated = state.enemies.filter((enemy) => enemy.hp <= 0);
    defeated.forEach((enemy) => {
      state.kills += 1;
      state.gems.push({ x: enemy.x, y: enemy.y, value: enemy.xp, radius: 6, age: 0 });
      addFloater(state, enemy.name, enemy.x, enemy.y - 12, enemy.colorToken);
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

  function addFloater(state, text, x, y, color) {
    state.floaters.push({ text, x, y, color, life: 1.1 });
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
    return leveled;
  }

  function pickUpgrades(state) {
    return state.content.upgrades
      .slice()
      .sort(() => Math.random() - 0.5)
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
    updateEnemies(state, dt);
    resolveHits(state);
    updateGems(state, dt);
    updateFloaters(state, dt);
    if (state.player.health <= 0) return 'lost';
    if (state.elapsed >= state.duration) return 'won';
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

(function () {
  const CLASS_SPRITE_PATH_PREFIX = 'assets/classes/';
  const CLASS_SPRITE_IDS = ['fighter', 'cleric', 'thief', 'druid', 'wizard', 'ranger'];
  const ENEMY_SPRITE_PATH_PREFIX = 'assets/enemies/';
  const BACKGROUND_SPRITE_PATH_PREFIX = 'assets/backgrounds/';
  const ENEMY_SPRITE_SPECS = {
    goblin: { file: 'goblin.png', width: 48, height: 48 },
    slime: { file: 'slime.png', width: 48, height: 48 },
    armor: { file: 'armor.png', width: 48, height: 48 },
    wolf: { file: 'wolf.png', width: 64, height: 40 },
    mimic: { file: 'mimic.png', width: 56, height: 56 },
    cultist: { file: 'cultist.png', width: 56, height: 56 },
    warden: { file: 'warden.png', width: 128, height: 128 },
  };
  const ENEMY_BEHAVIOR_SPRITE_MAP = {
    skirmisher: 'goblin',
    lurcher: 'slime',
    bulwark: 'armor',
    charger: 'wolf',
    ambusher: 'mimic',
    caster: 'cultist',
    boss: 'warden',
  };
  const BACKGROUND_SPRITE_SPECS = {
    inn: { file: 'inn-ground.png', kind: 'ground' },
    ruins: { file: 'ruins-ground.png', kind: 'ground' },
    forest: { file: 'forest-ground.png', kind: 'ground' },
    basin: { file: 'basin-ground.png', kind: 'ground' },
    basinSetpiece: { file: 'basin-setpiece.png', kind: 'setpiece' },
    towerGate: { file: 'tower-gate-setpiece.png', kind: 'setpiece' },
  };
  const CREST_CLASS_MAP = {
    shield: 'fighter',
    halo: 'cleric',
    blade: 'thief',
    root: 'druid',
    rune: 'wizard',
    hawk: 'ranger',
  };
  const classSprites = Object.create(null);
  const enemySprites = Object.create(null);
  const backgroundSprites = Object.create(null);
  let classSpritesPreload = null;
  let enemySpritesPreload = null;
  let backgroundSpritesPreload = null;

  function normalizeClassId(value) {
    if (!value) return '';
    if (typeof value === 'object' && typeof value.id === 'string') return normalizeClassId(value.id);
    if (typeof value !== 'string') return '';
    const classId = value.toLowerCase();
    return CLASS_SPRITE_IDS.includes(classId) ? classId : '';
  }

  function resolvePlayerClassId(player) {
    return normalizeClassId(player.playbook)
      || normalizeClassId(player.classId)
      || normalizeClassId(player.playbookId)
      || CREST_CLASS_MAP[player.crest]
      || '';
  }

  function preloadClassSprites() {
    if (classSpritesPreload) return classSpritesPreload;
    if (typeof window.Image !== 'function') {
      classSpritesPreload = Promise.resolve(classSprites);
      return classSpritesPreload;
    }
    classSpritesPreload = Promise.all(CLASS_SPRITE_IDS.map((classId) => new Promise((resolve) => {
      const image = new window.Image();
      classSprites[classId] = { image, loaded: false, failed: false };
      image.onload = () => {
        classSprites[classId].loaded = true;
        resolve(classSprites[classId]);
      };
      image.onerror = () => {
        classSprites[classId].failed = true;
        resolve(classSprites[classId]);
      };
      image.src = `${CLASS_SPRITE_PATH_PREFIX}${classId}.png`;
    }))).then(() => classSprites);
    return classSpritesPreload;
  }

  function preloadEnemySprites() {
    if (enemySpritesPreload) return enemySpritesPreload;
    if (typeof window.Image !== 'function') {
      enemySpritesPreload = Promise.resolve(enemySprites);
      return enemySpritesPreload;
    }
    enemySpritesPreload = Promise.all(Object.keys(ENEMY_SPRITE_SPECS).map((spriteId) => new Promise((resolve) => {
      const image = new window.Image();
      const spec = ENEMY_SPRITE_SPECS[spriteId];
      enemySprites[spriteId] = { image, loaded: false, failed: false, spec };
      image.onload = () => {
        enemySprites[spriteId].loaded = true;
        resolve(enemySprites[spriteId]);
      };
      image.onerror = () => {
        enemySprites[spriteId].failed = true;
        resolve(enemySprites[spriteId]);
      };
      image.src = `${ENEMY_SPRITE_PATH_PREFIX}${spec.file}`;
    }))).then(() => enemySprites);
    return enemySpritesPreload;
  }

  function preloadBackgroundSprites() {
    if (backgroundSpritesPreload) return backgroundSpritesPreload;
    if (typeof window.Image !== 'function') {
      backgroundSpritesPreload = Promise.resolve(backgroundSprites);
      return backgroundSpritesPreload;
    }
    backgroundSpritesPreload = Promise.all(Object.keys(BACKGROUND_SPRITE_SPECS).map((spriteId) => new Promise((resolve) => {
      const image = new window.Image();
      const spec = BACKGROUND_SPRITE_SPECS[spriteId];
      backgroundSprites[spriteId] = { image, loaded: false, failed: false, spec };
      image.onload = () => {
        backgroundSprites[spriteId].loaded = true;
        resolve(backgroundSprites[spriteId]);
      };
      image.onerror = () => {
        backgroundSprites[spriteId].failed = true;
        resolve(backgroundSprites[spriteId]);
      };
      image.src = `${BACKGROUND_SPRITE_PATH_PREFIX}${spec.file}`;
    }))).then(() => backgroundSprites);
    return backgroundSpritesPreload;
  }

  function getPlayerClassSprite(player) {
    const classId = resolvePlayerClassId(player);
    const sprite = classId ? classSprites[classId] : null;
    return sprite && sprite.loaded && !sprite.failed ? sprite.image : null;
  }

  function resolveEnemySpriteId(enemy) {
    if (!enemy) return '';
    if (enemy.spriteId && ENEMY_SPRITE_SPECS[enemy.spriteId]) return enemy.spriteId;
    return ENEMY_BEHAVIOR_SPRITE_MAP[enemy.behavior] || '';
  }

  function getEnemySprite(enemy) {
    const spriteId = resolveEnemySpriteId(enemy);
    const sprite = spriteId ? enemySprites[spriteId] : null;
    return sprite && sprite.loaded && !sprite.failed ? sprite : null;
  }

  function getBackgroundSprite(spriteId) {
    const sprite = spriteId ? backgroundSprites[spriteId] : null;
    return sprite && sprite.loaded && !sprite.failed ? sprite : null;
  }

  function markBackgroundSpriteFailedForQa(spriteId) {
    if (!BACKGROUND_SPRITE_SPECS[spriteId]) return false;
    const current = backgroundSprites[spriteId] || { image: null, spec: BACKGROUND_SPRITE_SPECS[spriteId] };
    current.loaded = false;
    current.failed = true;
    backgroundSprites[spriteId] = current;
    return true;
  }

  function getBackgroundLoadState(spriteId) {
    const sprite = spriteId ? backgroundSprites[spriteId] : null;
    if (!sprite) return 'pending';
    if (sprite.loaded && !sprite.failed) return 'loaded';
    if (sprite.failed) return 'failed';
    return 'pending';
  }

  function getPalette() {
    const style = getComputedStyle(document.documentElement);
    const token = (name) => style.getPropertyValue(name).trim();
    return {
      surfacePrimary: token('--surface-primary'),
      surfaceCanvas: token('--surface-canvas'),
      surfaceParchment: token('--surface-parchment'),
      surfaceIron: token('--surface-iron'),
      surfaceTower: token('--surface-tower'),
      textPrimary: token('--text-primary'),
      textSecondary: token('--text-secondary'),
      textTertiary: token('--text-tertiary'),
      borderDefault: token('--border-default'),
      borderSubtle: token('--border-subtle'),
      accentPrimary: token('--accent-primary'),
      accentEmber: token('--accent-ember'),
      accentBrass: token('--accent-brass'),
      accentBell: token('--accent-bell'),
      statusWarning: token('--status-warning'),
      statusSuccess: token('--status-success'),
      statusError: token('--status-error'),
      statusInfo: token('--status-info'),
      fighter: token('--class-fighter'),
      cleric: token('--class-cleric'),
      thief: token('--class-thief'),
      druid: token('--class-druid'),
      wizard: token('--class-wizard'),
      ranger: token('--class-ranger'),
    };
  }

  function resolveColor(palette, colorToken) {
    const map = {
      '--accent-primary': palette.accentPrimary,
      '--accent-ember': palette.accentEmber,
      '--accent-brass': palette.accentBrass,
      '--accent-bell': palette.accentBell,
      '--status-success': palette.statusSuccess,
      '--status-error': palette.statusError,
      '--status-info': palette.statusInfo,
      '--text-secondary': palette.textSecondary,
      '--class-fighter': palette.fighter,
      '--class-cleric': palette.cleric,
      '--class-thief': palette.thief,
      '--class-druid': palette.druid,
      '--class-wizard': palette.wizard,
      '--class-ranger': palette.ranger,
    };
    return map[colorToken] || palette.textPrimary;
  }

  function withAlpha(color, alpha) {
    if (!color || !color.startsWith('#')) return color;
    const hex = color.replace('#', '');
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function createCamera(state, world, canvas) {
    const x = Math.max(0, Math.min(world.width - canvas.width, state.player.x - canvas.width / 2));
    const y = Math.max(0, Math.min(world.height - canvas.height, state.player.y - canvas.height / 2));
    return { x, y, width: canvas.width, height: canvas.height };
  }

  function applyCamera(ctx, camera) {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
  }

  function isVisible(camera, x, y, radius) {
    return x + radius >= camera.x
      && x - radius <= camera.x + camera.width
      && y + radius >= camera.y
      && y - radius <= camera.y + camera.height;
  }

  function seededNoise(x, y) {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function resolveBackgroundKey(state) {
    const wave = state.waves && state.waves[state.waveIndex] ? state.waves[state.waveIndex] : null;
    const scene = state.scenes && state.scenes[state.sceneIndex] ? state.scenes[state.sceneIndex] : null;
    if (state.bossSpawned) return 'towerGate';
    if (wave && wave.backgroundKey) return wave.backgroundKey;
    if (scene && scene.backgroundKey) return scene.backgroundKey;
    const waveId = wave && wave.id ? wave.id : '';
    if (waveId === 'finalGate' || waveId.includes('29-30')) return 'towerGate';
    if (waveId.includes('forest') || waveId.includes('15-20') || waveId.includes('20-25') || waveId.includes('25-29')) return 'forest';
    if (waveId.includes('basin') || waveId.includes('6-9')) return 'basin';
    if (waveId.includes('ruin') || waveId.includes('9-12') || waveId.includes('12-15')) return 'ruins';
    return 'inn';
  }

  function resolveGroundBackgroundId(state) {
    const key = resolveBackgroundKey(state);
    if (key === 'towerGate') return 'forest';
    return BACKGROUND_SPRITE_SPECS[key] && BACKGROUND_SPRITE_SPECS[key].kind === 'ground' ? key : 'inn';
  }

  function shouldDrawBasinSetpiece(state) {
    return resolveBackgroundKey(state) === 'basin';
  }

  function shouldDrawTowerGateSetpiece(state) {
    const key = resolveBackgroundKey(state);
    return key === 'towerGate' || state.bossSpawned;
  }

  function withPixelSprites(ctx, draw) {
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    draw();
    ctx.imageSmoothingEnabled = previousSmoothing;
  }

  function drawGroundBackgroundSprite(ctx, sprite, world) {
    withPixelSprites(ctx, () => {
      ctx.drawImage(sprite.image, 0, 0, world.width, world.height);
    });
  }

  function drawSetpieceSprite(ctx, sprite, x, y, width, height) {
    withPixelSprites(ctx, () => {
      ctx.drawImage(sprite.image, Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    });
  }

  function drawBasinSetpiece(ctx, world, camera) {
    const sprite = getBackgroundSprite('basinSetpiece');
    if (!sprite) return false;
    const width = 980;
    const height = Math.round(width * sprite.image.height / sprite.image.width);
    const x = world.width * 0.52 - width / 2;
    const y = world.height * 0.49 - height / 2;
    if (!isVisible(camera, x + width / 2, y + height / 2, Math.max(width, height) / 2)) return true;
    drawSetpieceSprite(ctx, sprite, x, y, width, height);
    return true;
  }

  function drawTowerGateSetpiece(ctx, world, camera, state, palette) {
    const sprite = getBackgroundSprite('towerGate');
    if (!sprite) return false;
    const width = state.bossSpawned ? 1280 : 1120;
    const height = Math.round(width * sprite.image.height / sprite.image.width);
    const x = world.towerX - width / 2;
    const y = world.towerY - height * 0.54;
    if (!isVisible(camera, x + width / 2, y + height / 2, Math.max(width, height) / 2)) return true;
    if (state.effects.bossPulse > 0 || state.bossSpawned) {
      ctx.save();
      ctx.globalAlpha = 0.16 + Math.min(0.22, state.effects.bossPulse * 0.18);
      ctx.fillStyle = palette.accentBell;
      ctx.beginPath();
      ctx.ellipse(world.towerX, world.towerY + height * 0.28, width * 0.28, height * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawSetpieceSprite(ctx, sprite, x, y, width, height);
    return true;
  }

  function drawBackgroundSprites(ctx, world, camera, state, palette) {
    const groundSprite = getBackgroundSprite(resolveGroundBackgroundId(state));
    if (!groundSprite) return false;
    drawGroundBackgroundSprite(ctx, groundSprite, world);
    if (shouldDrawBasinSetpiece(state)) drawBasinSetpiece(ctx, world, camera);
    if (shouldDrawTowerGateSetpiece(state) && !drawTowerGateSetpiece(ctx, world, camera, state, palette)) {
      drawTower(ctx, world, state.elapsed, palette);
    }
    return true;
  }

  function getBackgroundRenderInfo(state) {
    const backgroundKey = resolveBackgroundKey(state);
    const groundKey = resolveGroundBackgroundId(state);
    const setpieces = [];
    if (shouldDrawBasinSetpiece(state)) setpieces.push('basinSetpiece');
    if (shouldDrawTowerGateSetpiece(state)) setpieces.push('towerGate');
    return {
      backgroundKey,
      groundKey,
      groundLoadState: getBackgroundLoadState(groundKey),
      usingProcedural: !getBackgroundSprite(groundKey),
      setpieces,
    };
  }

  function drawProceduralBackground(ctx, world, camera, elapsed, palette) {
    ctx.fillStyle = palette.surfaceTower || palette.surfaceCanvas;
    ctx.fillRect(0, 0, world.width, world.height);
    drawGroundTexture(ctx, world, camera, palette);
    drawRoad(ctx, world, elapsed, palette);
    drawRuins(ctx, palette);
    drawForest(ctx, world, camera, palette);
    drawBasin(ctx, palette);
    drawTower(ctx, world, elapsed, palette);
    drawWorldEdges(ctx, world, palette);
  }

  function drawBackground(ctx, world, camera, state, palette) {
    if (drawBackgroundSprites(ctx, world, camera, state, palette)) {
      drawWorldEdges(ctx, world, palette);
      return;
    }
    drawProceduralBackground(ctx, world, camera, state.elapsed, palette);
  }

  function drawCombatReadabilityScrim(ctx, camera, state, palette) {
    const bossWeight = state.bossSpawned ? 0.08 : 0;
    ctx.save();
    ctx.fillStyle = withAlpha(palette.surfaceCanvas, 0.18 + bossWeight);
    ctx.fillRect(camera.x, camera.y, camera.width, camera.height);
    ctx.strokeStyle = withAlpha(state.bossSpawned ? palette.accentBell : palette.borderDefault, state.bossSpawned ? 0.28 : 0.16);
    ctx.lineWidth = state.bossSpawned ? 5 : 3;
    ctx.strokeRect(camera.x + 10, camera.y + 10, camera.width - 20, camera.height - 20);
    ctx.restore();
  }

  function drawGroundTexture(ctx, world, camera, palette) {
    ctx.fillStyle = withAlpha(palette.borderSubtle, 0.24);
    const startX = Math.floor(camera.x / 80) * 80;
    const startY = Math.floor(camera.y / 80) * 80;
    for (let y = startY; y < camera.y + camera.height + 90; y += 80) {
      for (let x = startX; x < camera.x + camera.width + 90; x += 80) {
        const noise = seededNoise(x, y);
        ctx.globalAlpha = 0.06 + noise * 0.06;
        ctx.fillRect(x + noise * 26, y + (1 - noise) * 22, 34 + noise * 28, 2);
        ctx.fillRect(x + 18, y + 42, 2, 18 + noise * 20);
        if (noise > 0.72) {
          ctx.strokeStyle = withAlpha(palette.textTertiary, 0.08);
          ctx.beginPath();
          ctx.moveTo(x + 8, y + 66);
          ctx.lineTo(x + 34, y + 50);
          ctx.lineTo(x + 66, y + 70);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function roadPoint(world, t) {
    const x = 250 + (world.towerX - 250) * t;
    const y = world.startY + (world.towerY - world.startY) * t + Math.sin(t * Math.PI * 3.1) * 110;
    return { x, y };
  }

  function drawRoad(ctx, world, elapsed, palette) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = withAlpha(palette.surfaceParchment, 0.36);
    ctx.lineWidth = 92;
    ctx.beginPath();
    for (let index = 0; index <= 34; index += 1) {
      const point = roadPoint(world, index / 34);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.borderDefault, 0.44);
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 18]);
    ctx.lineDashOffset = -elapsed * 8;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRuins(ctx, palette) {
    const ruins = [
      { x: 760, y: 760, w: 150, h: 96, r: 0.12 },
      { x: 1180, y: 1050, w: 210, h: 80, r: -0.18 },
      { x: 1640, y: 610, w: 170, h: 90, r: 0.22 },
    ];
    ruins.forEach((ruin) => {
      ctx.save();
      ctx.translate(ruin.x, ruin.y);
      ctx.rotate(ruin.r);
      ctx.strokeStyle = withAlpha(palette.textTertiary, 0.45);
      ctx.fillStyle = withAlpha(palette.surfaceParchment, 0.25);
      ctx.lineWidth = 5;
      ctx.strokeRect(-ruin.w / 2, -ruin.h / 2, ruin.w, ruin.h);
      for (let index = -2; index <= 2; index += 1) {
        ctx.fillRect(index * 32 - 8, -ruin.h / 2 - 28, 16, 42);
      }
      ctx.restore();
    });
  }

  function drawForest(ctx, world, camera, palette) {
    ctx.strokeStyle = withAlpha(palette.accentPrimary, 0.16);
    ctx.fillStyle = withAlpha(palette.accentPrimary, 0.055);
    for (let index = 0; index < 90; index += 1) {
      const x = 130 + seededNoise(index, 4) * (world.width - 260);
      const y = 170 + seededNoise(index, 8) * (world.height - 340);
      if (!isVisible(camera, x, y, 80)) continue;
      const radius = 16 + seededNoise(index, 12) * 22;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y + radius * 0.7);
      ctx.lineTo(x + Math.sin(index) * 14, y - radius * 0.95);
      ctx.stroke();
    }
  }

  function drawBasin(ctx, palette) {
    ctx.save();
    ctx.translate(1260, 830);
    ctx.strokeStyle = withAlpha(palette.statusInfo, 0.3);
    ctx.fillStyle = withAlpha(palette.statusInfo, 0.07);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 150, 74, -0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.textSecondary, 0.34);
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI * 2 / 8;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 175, Math.sin(angle) * 94, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTower(ctx, world, elapsed, palette) {
    ctx.save();
    ctx.translate(world.towerX, world.towerY);
    ctx.fillStyle = withAlpha(palette.surfaceIron || palette.surfaceCanvas, 0.38);
    ctx.beginPath();
    ctx.arc(0, 80, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(palette.textPrimary, 0.12);
    ctx.beginPath();
    ctx.moveTo(-68, 210);
    ctx.lineTo(-34, -74);
    ctx.lineTo(20, -150);
    ctx.lineTo(70, 210);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.accentBrass || palette.accentEmber, 0.42);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -32, 36 + Math.sin(elapsed * 2) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.accentBell, 0.22 + Math.sin(elapsed * 1.4) * 0.04);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-44, 126);
    ctx.lineTo(-12, 10);
    ctx.lineTo(22, 112);
    ctx.stroke();
    ctx.restore();
  }

  function drawWorldEdges(ctx, world, palette) {
    ctx.strokeStyle = withAlpha(palette.borderDefault, 0.72);
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, world.width - 16, world.height - 16);
  }

  function drawPlayer(ctx, player, palette) {
    const accent = resolveColor(palette, player.accentToken);
    const classSprite = getPlayerClassSprite(player);
    ctx.save();
    drawPlayerAnchor(ctx, player, accent, palette);
    ctx.translate(player.x, player.y);
    if (player.invulnerableTimer > 0) drawInvulnerabilityShell(ctx, player.radius, accent, palette);
    ctx.globalAlpha = player.invulnerableTimer > 0 ? 0.78 : 1;
    if (classSprite) {
      drawPlayerClassSprite(ctx, classSprite, player);
      ctx.save();
      ctx.rotate(player.facing || 0);
      drawFacingNotch(ctx, player.radius, accent);
      ctx.restore();
    } else {
      ctx.rotate(player.facing || 0);
      drawPlayerMiniatureBody(ctx, player, accent, palette);
      ctx.fillStyle = withAlpha(accent, 0.72);
      ctx.strokeStyle = withAlpha(palette.textPrimary, 0.78);
      ctx.lineWidth = 2.2;
      ctx.save();
      ctx.scale(0.78, 0.78);
      if (player.crest === 'shield') drawShieldCrest(ctx, player.radius);
      else if (player.crest === 'blade') drawBladeCrest(ctx, player.radius);
      else if (player.crest === 'halo') drawHaloCrest(ctx, player.radius);
      else if (player.crest === 'root') drawRootCrest(ctx, player.radius);
      else if (player.crest === 'rune') drawRuneCrest(ctx, player.radius);
      else drawHawkCrest(ctx, player.radius);
      ctx.restore();
      drawFacingNotch(ctx, player.radius, accent);
    }
    ctx.restore();
    drawPlayerAuras(ctx, player, accent, palette);
  }

  function drawPlayerClassSprite(ctx, image, player) {
    const previousSmoothing = ctx.imageSmoothingEnabled;
    const snapX = Math.round(player.x) - player.x;
    const snapY = Math.round(player.y) - player.y;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, snapX - 32, snapY - 32, 64, 64);
    ctx.imageSmoothingEnabled = previousSmoothing;
  }

  function drawPlayerMiniatureBody(ctx, player, accent, palette) {
    const radius = player.radius;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.fillStyle = withAlpha(palette.surfaceIron || palette.surfaceCanvas, 0.9);
    ctx.strokeStyle = withAlpha(palette.textPrimary, 0.58);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.82, radius * 0.95);
    ctx.lineTo(-radius * 0.48, -radius * 0.54);
    ctx.quadraticCurveTo(0, -radius * 1.1, radius * 0.52, -radius * 0.54);
    ctx.lineTo(radius * 0.84, radius * 0.95);
    ctx.quadraticCurveTo(0, radius * 1.24, -radius * 0.82, radius * 0.95);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = withAlpha(accent, 0.34);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.42, -radius * 0.16);
    ctx.lineTo(0, -radius * 0.72);
    ctx.lineTo(radius * 0.42, -radius * 0.16);
    ctx.lineTo(radius * 0.22, radius * 0.72);
    ctx.lineTo(-radius * 0.22, radius * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.accentBrass || palette.borderDefault, 0.62);
    ctx.lineWidth = 1.6;
    if (player.crest === 'shield') {
      ctx.strokeRect(radius * 0.42, -radius * 0.18, radius * 0.42, radius * 0.72);
    } else if (player.crest === 'blade') {
      ctx.beginPath();
      ctx.moveTo(radius * 0.28, -radius * 0.72);
      ctx.lineTo(radius * 1.04, radius * 0.5);
      ctx.stroke();
    } else if (player.crest === 'halo') {
      ctx.beginPath();
      ctx.arc(0, -radius * 0.78, radius * 0.52, 0, Math.PI * 2);
      ctx.stroke();
    } else if (player.crest === 'root') {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.3, radius * 0.28);
      ctx.lineTo(-radius * 0.72, radius * 0.92);
      ctx.moveTo(radius * 0.2, radius * 0.28);
      ctx.lineTo(radius * 0.72, radius * 0.92);
      ctx.stroke();
    } else if (player.crest === 'rune') {
      ctx.strokeRect(-radius * 0.34, -radius * 0.34, radius * 0.68, radius * 0.68);
    } else {
      ctx.beginPath();
      ctx.moveTo(radius * 0.42, -radius * 0.62);
      ctx.lineTo(radius * 1.02, -radius * 0.18);
      ctx.lineTo(radius * 0.42, radius * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayerAnchor(ctx, player, accent, palette) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.strokeStyle = withAlpha(accent, 0.74);
    ctx.fillStyle = withAlpha(palette.surfaceCanvas, 0.42);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, player.radius + 7, player.radius * 1.35, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.textPrimary, 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawInvulnerabilityShell(ctx, radius, accent, palette) {
    ctx.save();
    const pulse = 0.45 + Math.sin(performance.now() * 0.024) * 0.18;
    ctx.strokeStyle = withAlpha(palette.textPrimary, 0.62);
    ctx.fillStyle = withAlpha(accent, 0.12 + pulse * 0.08);
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, radius + 12 + pulse * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawShieldCrest(ctx, radius) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.fillRect(-radius * 0.48, -radius * 0.72, radius * 0.76, radius * 1.44);
    ctx.strokeRect(-radius * 0.48, -radius * 0.72, radius * 0.76, radius * 1.44);
    ctx.beginPath();
    ctx.moveTo(radius * 0.08, -radius * 1.08);
    ctx.lineTo(radius * 1.08, -radius * 0.7);
    ctx.lineTo(radius * 1.08, radius * 0.7);
    ctx.lineTo(radius * 0.06, radius * 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = withAlpha(ctx.strokeStyle, 0.72);
    ctx.beginPath();
    ctx.moveTo(radius * 0.38, -radius * 0.58);
    ctx.lineTo(radius * 0.72, 0);
    ctx.lineTo(radius * 0.38, radius * 0.58);
    ctx.stroke();
    ctx.restore();
  }

  function drawBladeCrest(ctx, radius) {
    ctx.save();
    ctx.scale(1.18, 0.68);
    ctx.beginPath();
    ctx.moveTo(radius * 0.98, 0);
    ctx.lineTo(-radius * 0.66, -radius * 0.74);
    ctx.lineTo(-radius * 1.08, 0);
    ctx.lineTo(-radius * 0.66, radius * 0.74);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = withAlpha(ctx.strokeStyle, 0.72);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.2, -radius * 0.88);
    ctx.lineTo(radius * 1.32, -radius * 0.34);
    ctx.moveTo(-radius * 0.24, radius * 0.88);
    ctx.lineTo(radius * 1.28, radius * 0.34);
    ctx.stroke();
  }

  function drawHaloCrest(ctx, radius) {
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = withAlpha(ctx.strokeStyle, 0.8);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(radius * 0.35, 0, radius * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(radius * 0.35, -radius * 0.54);
    ctx.lineTo(radius * 0.35, radius * 0.54);
    ctx.moveTo(-radius * 0.08, 0);
    ctx.lineTo(radius * 0.78, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawRootCrest(ctx, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(radius * 0.86, -radius * 0.18);
    ctx.lineTo(radius * 0.26, -radius * 0.92);
    ctx.lineTo(-radius * 0.68, -radius * 0.68);
    ctx.lineTo(-radius * 1.02, radius * 0.08);
    ctx.lineTo(-radius * 0.28, radius * 0.94);
    ctx.lineTo(radius * 0.68, radius * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = withAlpha(ctx.strokeStyle, 0.76);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius * 1.08, radius * 0.86);
    ctx.lineTo(-radius * 0.22, radius * 0.12);
    ctx.lineTo(radius * 0.46, radius * 1.04);
    ctx.moveTo(-radius * 0.42, radius * 0.46);
    ctx.lineTo(-radius * 0.92, radius * 1.18);
    ctx.moveTo(radius * 0.04, radius * 0.48);
    ctx.lineTo(radius * 0.86, radius * 1.08);
    ctx.stroke();
    ctx.restore();
  }

  function drawRuneCrest(ctx, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(radius * 0.7, 0);
    ctx.lineTo(radius * 0.18, -radius * 1.15);
    ctx.lineTo(-radius * 0.54, -radius * 0.78);
    ctx.lineTo(-radius * 0.78, radius * 0.78);
    ctx.lineTo(radius * 0.14, radius * 1.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = withAlpha(ctx.strokeStyle, 0.82);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-radius * 0.5, -radius * 0.5, radius, radius);
    ctx.moveTo(-radius * 0.66, radius * 0.12);
    ctx.lineTo(0, -radius * 0.72);
    ctx.lineTo(radius * 0.58, radius * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  function drawHawkCrest(ctx, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(radius * 0.95, -radius * 0.08);
    ctx.lineTo(-radius * 0.42, -radius * 0.92);
    ctx.lineTo(-radius * 0.18, -radius * 0.18);
    ctx.lineTo(-radius * 1.04, radius * 0.28);
    ctx.lineTo(-radius * 0.16, radius * 0.34);
    ctx.lineTo(-radius * 0.42, radius * 0.96);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = withAlpha(ctx.strokeStyle, 0.78);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.62, -radius * 1.1);
    ctx.quadraticCurveTo(-radius * 0.08, -radius * 1.44, radius * 0.62, -radius * 1.05);
    ctx.moveTo(-radius * 1.08, radius * 0.76);
    ctx.lineTo(radius * 0.9, radius * 0.76);
    ctx.stroke();
    ctx.restore();
  }

  function drawFacingNotch(ctx, radius, accent) {
    ctx.strokeStyle = withAlpha(accent, 0.58);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 9, -0.58, 0.58);
    ctx.stroke();
  }

  function drawPlayerAuras(ctx, player, accent, palette) {
    if (player.aura) {
      ctx.strokeStyle = withAlpha(accent, 0.2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.auraRange, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (player.arcaneShield > 0) {
      ctx.strokeStyle = withAlpha(palette.accentBell, player.arcaneShieldTimer > 0 ? 0.22 : 0.5);
      ctx.lineWidth = 3;
      ctx.strokeRect(player.x - player.radius - 12, player.y - player.radius - 12, (player.radius + 12) * 2, (player.radius + 12) * 2);
    }
    if (player.orbitingSpears > 0) drawOrbitingSpears(ctx, player, palette);
  }

  function drawLevelShockwave(ctx, state, palette) {
    if (state.effects.levelShockwave <= 0) return;
    const progress = 1 - state.effects.levelShockwave;
    ctx.save();
    ctx.strokeStyle = withAlpha(palette.statusWarning, state.effects.levelShockwave * 0.68);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, 34 + progress * 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.accentBell, state.effects.levelShockwave * 0.28);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, 18 + progress * 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawOrbitingSpears(ctx, player, palette) {
    const count = player.orbitingSpears + 1;
    const radius = 48 + player.orbitingSpears * 10;
    ctx.strokeStyle = withAlpha(palette.accentEmber, 0.26);
    ctx.beginPath();
    ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = palette.accentEmber;
    for (let index = 0; index < count; index += 1) {
      const angle = player.orbitTimer * 3.2 + index * (Math.PI * 2 / count);
      ctx.save();
      ctx.translate(player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius);
      ctx.rotate(angle);
      ctx.fillRect(-3, -13, 6, 26);
      ctx.restore();
    }
  }

  function drawEnemy(ctx, enemy, palette) {
    const color = enemy.hitFlash > 0 ? palette.textPrimary : resolveColor(palette, enemy.colorToken);
    const enemySprite = getEnemySprite(enemy);
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const wobble = Math.sin(enemy.behaviorTimer * 5) * enemy.radius * 0.12;
    drawEnemyThreatRing(ctx, enemy, palette);
    if (enemySprite) drawEnemySprite(ctx, enemySprite, enemy, palette, wobble);
    else drawProceduralEnemy(ctx, enemy, palette, color, wobble);
    ctx.restore();
    const metrics = enemySprite ? getEnemySpriteMetrics(enemySprite, enemy) : { width: enemy.radius * 2.2, top: -enemy.radius };
    const width = metrics.width;
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = palette.borderSubtle;
    ctx.fillRect(enemy.x - width / 2, enemy.y + metrics.top - 10, width, 4);
    ctx.fillStyle = enemy.behavior === 'boss' ? palette.accentBell : palette.statusError;
    ctx.fillRect(enemy.x - width / 2, enemy.y + metrics.top - 10, width * hpRatio, 4);
  }

  function drawProceduralEnemy(ctx, enemy, palette, color, wobble) {
    ctx.fillStyle = withAlpha(color, enemy.behavior === 'boss' ? 0.82 : 0.72);
    ctx.strokeStyle = getEnemyOutline(enemy, palette);
    ctx.lineWidth = enemy.behavior === 'boss' ? 5 : enemy.elite ? 3.5 : 2;
    if (enemy.behavior === 'skirmisher') drawGoblinEnemy(ctx, enemy.radius, wobble, palette);
    else if (enemy.behavior === 'lurcher') drawSlimeEnemy(ctx, enemy.radius, wobble, palette);
    else if (enemy.behavior === 'bulwark') drawArmorEnemy(ctx, enemy.radius, palette);
    else if (enemy.behavior === 'charger') drawWolfEnemy(ctx, enemy.radius, enemy.behaviorTimer, palette);
    else if (enemy.behavior === 'ambusher') drawMimicEnemy(ctx, enemy.radius, palette);
    else if (enemy.behavior === 'caster') drawCultistEnemy(ctx, enemy.radius, palette);
    else if (enemy.behavior === 'boss') drawSentinelEnemy(ctx, enemy, palette);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawEnemySprite(ctx, sprite, enemy, palette, wobble) {
    const metrics = getEnemySpriteMetrics(sprite, enemy);
    const previousSmoothing = ctx.imageSmoothingEnabled;
    const previousFilter = ctx.filter;
    const snapX = Math.round(enemy.x) - enemy.x;
    const snapY = Math.round(enemy.y) - enemy.y;
    const offsetX = enemy.behavior === 'skirmisher' || enemy.behavior === 'lurcher' ? Math.round(wobble) : 0;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.strokeStyle = getEnemyOutline(enemy, palette);
    ctx.lineWidth = enemy.behavior === 'boss' ? 5 : enemy.elite ? 3 : 2;
    ctx.strokeRect(
      snapX + offsetX - metrics.width / 2 - 2,
      snapY - metrics.height / 2 - 2,
      metrics.width + 4,
      metrics.height + 4,
    );
    ctx.restore();
    if (enemy.hitFlash > 0) ctx.filter = 'brightness(1.75)';
    ctx.drawImage(
      sprite.image,
      snapX + offsetX - metrics.width / 2,
      snapY - metrics.height / 2,
      metrics.width,
      metrics.height,
    );
    ctx.filter = previousFilter;
    ctx.imageSmoothingEnabled = previousSmoothing;
  }

  function getEnemySpriteMetrics(sprite, enemy) {
    const eliteScale = enemy.elite ? 1.14 : 1;
    const bossScale = enemy.behavior === 'boss' ? 1 : eliteScale;
    const width = sprite.spec.width * bossScale;
    const height = sprite.spec.height * bossScale;
    return { width, height, top: -height / 2 };
  }

  function drawEnemyThreatRing(ctx, enemy, palette) {
    if (!enemy.elite && enemy.behavior !== 'boss') return;
    const radius = enemy.radius + (enemy.behavior === 'boss' ? 17 : 10);
    ctx.save();
    ctx.strokeStyle = enemy.behavior === 'boss' ? withAlpha(palette.accentBrass || palette.accentBell, 0.72) : withAlpha(palette.accentEmber, 0.68);
    ctx.lineWidth = enemy.behavior === 'boss' ? 4 : 2.5;
    ctx.setLineDash(enemy.behavior === 'boss' ? [18, 8] : [9, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (enemy.elite) {
      ctx.fillStyle = withAlpha(palette.accentEmber, 0.12);
      for (let index = 0; index < 6; index += 1) {
        const angle = index * Math.PI * 2 / 6;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function getEnemyOutline(enemy, palette) {
    if (enemy.slowTimer > 0) return palette.accentPrimary;
    if (enemy.behavior === 'boss') return palette.accentBrass || palette.accentBell;
    if (enemy.elite) return palette.accentEmber;
    return palette.surfacePrimary;
  }

  function drawGoblinEnemy(ctx, radius, wobble, palette) {
    ctx.save();
    ctx.translate(wobble, 0);
    ctx.beginPath();
    ctx.moveTo(radius * 0.7, 0);
    ctx.lineTo(-radius * 0.34, -radius * 0.78);
    ctx.lineTo(-radius * 0.9, -radius * 0.22);
    ctx.lineTo(-radius * 0.36, radius * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = withAlpha(palette.textPrimary, 0.72);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.5, -radius * 0.5);
    ctx.lineTo(-radius * 1.28, -radius * 0.96);
    ctx.lineTo(-radius * 0.78, -radius * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.4, radius * 0.46);
    ctx.lineTo(-radius * 1.18, radius * 0.76);
    ctx.lineTo(-radius * 0.72, radius * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = palette.borderDefault;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(radius * 0.16, -radius * 1.08);
    ctx.lineTo(radius * 1.72, radius * 0.72);
    ctx.moveTo(radius * 1.42, radius * 0.36);
    ctx.lineTo(radius * 1.72, radius * 0.72);
    ctx.lineTo(radius * 1.3, radius * 0.64);
    ctx.stroke();
    ctx.restore();
  }

  function drawSlimeEnemy(ctx, radius, wobble, palette) {
    ctx.save();
    ctx.scale(1.22, 0.78 + Math.sin(wobble) * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.bezierCurveTo(radius * 0.95, -radius * 0.82, radius * 1.1, radius * 0.46, radius * 0.36, radius * 0.88);
    ctx.bezierCurveTo(-radius * 0.5, radius * 1.16, -radius * 1.14, radius * 0.54, -radius * 0.88, -radius * 0.18);
    ctx.bezierCurveTo(-radius * 0.58, -radius * 0.7, -radius * 0.22, -radius * 0.88, 0, -radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = withAlpha(palette.textPrimary, 0.28);
    ctx.fillRect(-radius * 0.4, -radius * 0.08, radius * 0.28, radius * 0.12);
    ctx.fillRect(radius * 0.12, -radius * 0.18, radius * 0.22, radius * 0.1);
  }

  function drawArmorEnemy(ctx, radius, palette) {
    ctx.save();
    ctx.lineJoin = 'miter';
    ctx.fillRect(-radius * 0.82, -radius * 0.72, radius * 1.64, radius * 1.48);
    ctx.strokeRect(-radius * 0.82, -radius * 0.72, radius * 1.64, radius * 1.48);
    ctx.strokeStyle = withAlpha(palette.textPrimary, 0.5);
    ctx.strokeRect(-radius * 0.5, -radius * 1.24, radius, radius * 0.62);
    ctx.fillStyle = palette.surfaceCanvas;
    ctx.fillRect(-radius * 0.34, -radius * 1.03, radius * 0.68, radius * 0.18);
    ctx.strokeStyle = palette.borderDefault;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.82, -radius * 0.08);
    ctx.lineTo(radius * 0.82, -radius * 0.08);
    ctx.moveTo(0, -radius * 0.72);
    ctx.lineTo(0, radius * 0.76);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.accentBrass || palette.borderDefault, 0.58);
    ctx.strokeRect(-radius * 0.62, -radius * 0.5, radius * 1.24, radius * 1.04);
    ctx.restore();
  }

  function drawWolfEnemy(ctx, radius, timer, palette) {
    const dash = Math.sin(timer * 2.7) > 0.68;
    if (dash) {
      ctx.strokeStyle = withAlpha(palette.statusError, 0.18);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-radius * 2.6, radius * 0.46);
      ctx.lineTo(-radius * 0.8, radius * 0.2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(-radius * 0.12, radius * 0.2, radius * 1.34, radius * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(radius * 0.88, -radius * 0.1);
    ctx.lineTo(radius * 1.48, -radius * 0.42);
    ctx.lineTo(radius * 1.36, radius * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.textPrimary, 0.56);
    ctx.beginPath();
    ctx.moveTo(radius * 0.4, radius * 0.68);
    ctx.lineTo(radius * 0.74, radius * 1.3);
    ctx.moveTo(-radius * 0.4, radius * 0.68);
    ctx.lineTo(-radius * 0.82, radius * 1.28);
    ctx.stroke();
  }

  function drawMimicEnemy(ctx, radius, palette) {
    ctx.save();
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-radius * 0.78, -radius * 0.78, radius * 1.56, radius * 1.56);
    ctx.strokeRect(-radius * 0.78, -radius * 0.78, radius * 1.56, radius * 1.56);
    ctx.restore();
    ctx.fillStyle = palette.surfaceCanvas;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.88, radius * 0.1);
    ctx.lineTo(0, radius * 0.72);
    ctx.lineTo(radius * 0.88, radius * 0.1);
    ctx.lineTo(0, radius * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = withAlpha(palette.textPrimary, 0.7);
    for (let index = -2; index <= 2; index += 1) {
      ctx.beginPath();
      ctx.moveTo(index * radius * 0.28, radius * 0.2);
      ctx.lineTo(index * radius * 0.28 + radius * 0.12, radius * 0.48);
      ctx.lineTo(index * radius * 0.28 - radius * 0.12, radius * 0.48);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCultistEnemy(ctx, radius, palette) {
    ctx.beginPath();
    ctx.moveTo(0, -radius * 1.28);
    ctx.quadraticCurveTo(radius * 1.05, -radius * 0.64, radius * 0.72, radius * 1.02);
    ctx.lineTo(-radius * 0.72, radius * 1.02);
    ctx.quadraticCurveTo(-radius * 1.05, -radius * 0.64, 0, -radius * 1.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.surfaceCanvas;
    ctx.beginPath();
    ctx.arc(0, -radius * 0.42, radius * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.accentBell, 0.56);
    ctx.beginPath();
    ctx.arc(0, radius * 0.24, radius * 0.36, 0.18, Math.PI * 1.24);
    ctx.stroke();
    ctx.fillStyle = withAlpha(palette.accentBrass || palette.accentBell, 0.62);
    ctx.fillRect(-radius * 0.1, radius * 0.48, radius * 0.2, radius * 0.24);
  }

  function drawSentinelEnemy(ctx, enemy, palette) {
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = withAlpha(palette.surfaceTower || palette.surfaceCanvas, 0.74);
    ctx.beginPath();
    ctx.moveTo(-enemy.radius * 1.55, -enemy.radius * 0.76);
    ctx.lineTo(-enemy.radius * 0.96, enemy.radius * 1.22);
    ctx.lineTo(-enemy.radius * 0.38, enemy.radius * 0.62);
    ctx.lineTo(enemy.radius * 0.38, enemy.radius * 0.62);
    ctx.lineTo(enemy.radius * 0.96, enemy.radius * 1.22);
    ctx.lineTo(enemy.radius * 1.55, -enemy.radius * 0.76);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = withAlpha(palette.surfaceIron || palette.surfaceCanvas, 0.92);
    ctx.fillRect(-enemy.radius * 0.92, -enemy.radius * 1.12, enemy.radius * 1.84, enemy.radius * 2.1);
    ctx.strokeRect(-enemy.radius * 0.92, -enemy.radius * 1.12, enemy.radius * 1.84, enemy.radius * 2.1);
    ctx.strokeStyle = withAlpha(palette.accentBrass || palette.borderDefault, 0.72);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-enemy.radius * 1.18, -enemy.radius * 1.12);
    ctx.lineTo(0, -enemy.radius * 1.82);
    ctx.lineTo(enemy.radius * 1.18, -enemy.radius * 1.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.surfaceCanvas;
    ctx.fillRect(-enemy.radius * 0.48, -enemy.radius * 0.58, enemy.radius * 0.96, enemy.radius * 0.32);
    ctx.strokeStyle = withAlpha(palette.accentBrass || palette.accentBell, 0.82);
    ctx.beginPath();
    ctx.arc(0, enemy.radius * 0.22, enemy.radius * 0.5, 0.1, Math.PI * 1.36);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.accentBell, 0.58);
    ctx.beginPath();
    ctx.moveTo(-enemy.radius * 1.16, -enemy.radius * 0.2);
    ctx.lineTo(-enemy.radius * 1.62, enemy.radius * 0.72);
    ctx.moveTo(enemy.radius * 1.16, -enemy.radius * 0.2);
    ctx.lineTo(enemy.radius * 1.62, enemy.radius * 0.72);
    ctx.stroke();
    if (hpRatio < 0.66) {
      ctx.beginPath();
      ctx.moveTo(-enemy.radius * 0.44, -enemy.radius * 1.04);
      ctx.lineTo(enemy.radius * 0.08, -enemy.radius * 0.1);
      ctx.lineTo(-enemy.radius * 0.22, enemy.radius * 0.92);
      ctx.stroke();
    }
    if (hpRatio < 0.33) {
      ctx.strokeStyle = withAlpha(palette.accentBell, 0.72);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(enemy.radius * 0.5, -enemy.radius * 1.18);
      ctx.lineTo(enemy.radius * 0.06, -enemy.radius * 0.32);
      ctx.lineTo(enemy.radius * 0.5, enemy.radius * 0.96);
      ctx.stroke();
    }
  }

  function drawHazard(ctx, hazard, palette) {
    const color = resolveColor(palette, hazard.colorToken);
    const armed = hazard.warningLeft <= 0;
    const alpha = armed ? 0.26 : 0.12 + Math.sin(hazard.life * 18) * 0.04;
    ctx.save();
    ctx.translate(hazard.x, hazard.y);
    ctx.rotate(hazard.angle || 0);
    ctx.strokeStyle = withAlpha(color, armed ? 0.78 : 0.54);
    ctx.fillStyle = withAlpha(color, armed ? alpha * 0.18 : alpha * 0.08);
    ctx.lineWidth = armed ? 3 : 1.6;
    ctx.setLineDash(armed ? [16, 9] : [3, 12]);
    if (hazard.kind === 'wolfLane' || hazard.kind === 'towerGaze') {
      drawLaneShape(ctx, hazard.length || 240, hazard.width || 38);
    } else if (hazard.kind === 'thornCross') {
      drawLaneShape(ctx, hazard.length || 210, hazard.width || 34);
      ctx.rotate(Math.PI / 2);
      drawLaneShape(ctx, hazard.length || 210, hazard.width || 34);
    } else if (hazard.kind === 'mimicBite') {
      drawJawWarning(ctx, hazard.radius || 58, Math.PI * 0.68);
    } else if (hazard.kind === 'bellRing') {
      ctx.beginPath();
      ctx.arc(0, 0, hazard.radius || 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, (hazard.radius || 110) - (hazard.width || 34), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, hazard.radius || 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    drawCrackRunes(ctx, hazard, color);
    if (armed) drawArmedHazardTicks(ctx, hazard, color);
    ctx.restore();
  }

  function drawCrackRunes(ctx, hazard, color) {
    ctx.save();
    ctx.strokeStyle = withAlpha(color, 0.34);
    ctx.lineWidth = 1.2;
    const radius = hazard.radius || hazard.reach || 64;
    if (hazard.kind === 'wolfLane' || hazard.kind === 'towerGaze' || hazard.kind === 'thornCross') {
      const length = hazard.length || 220;
      const width = hazard.width || 36;
      for (let x = 18; x < length; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, -width * 0.44);
        ctx.lineTo(x + 10, -width * 0.1);
        ctx.lineTo(x + 4, width * 0.42);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI * 2 / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius * 0.34, Math.sin(angle) * radius * 0.34);
      ctx.lineTo(Math.cos(angle + 0.08) * radius * 0.78, Math.sin(angle + 0.08) * radius * 0.78);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawArmedHazardTicks(ctx, hazard, color) {
    ctx.strokeStyle = withAlpha(color, 0.88);
    ctx.lineWidth = 2;
    if (hazard.kind === 'wolfLane' || hazard.kind === 'towerGaze' || hazard.kind === 'thornCross') {
      const length = hazard.length || 220;
      const width = hazard.width || 36;
      for (let x = 14; x < length; x += 34) {
        ctx.beginPath();
        ctx.moveTo(x, -width / 2 - 5);
        ctx.lineTo(x + 12, -width / 2 - 16);
        ctx.moveTo(x, width / 2 + 5);
        ctx.lineTo(x + 12, width / 2 + 16);
        ctx.stroke();
      }
      return;
    }
    const radius = hazard.radius || 60;
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI * 2 / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (radius - 7), Math.sin(angle) * (radius - 7));
      ctx.lineTo(Math.cos(angle) * (radius + 10), Math.sin(angle) * (radius + 10));
      ctx.stroke();
    }
  }

  function drawWarning(ctx, warning, palette) {
    const color = resolveColor(palette, warning.colorToken);
    const progress = warning.maxLife ? warning.warningLeft / warning.maxLife : 0.5;
    const isBoss = Boolean(warning.phase);
    const armed = progress <= 0.18;
    ctx.save();
    ctx.translate(warning.x, warning.y);
    ctx.rotate(warning.angle || 0);
    ctx.strokeStyle = withAlpha(color, armed ? 0.92 : isBoss ? 0.72 : 0.58);
    ctx.fillStyle = withAlpha(color, (isBoss ? 0.04 : 0.025) + (1 - progress) * (isBoss ? 0.09 : 0.055));
    ctx.lineWidth = (isBoss ? 3 : 1.8) + (1 - progress) * 1.7;
    ctx.setLineDash(armed ? [] : isBoss ? [14, 10] : [5, 12]);
    if (warning.kind === 'line') {
      drawLaneShape(ctx, warning.length || warning.reach || 130, warning.width || 30);
    } else if (warning.kind === 'cone' || warning.kind === 'arc') {
      const reach = warning.reach || warning.radius || 70;
      const arc = warning.arc || Math.PI * 0.5;
      if (warning.label && warning.label.includes('이빨')) drawJawWarning(ctx, reach, arc);
      else drawConeWarning(ctx, reach, arc);
    } else if (warning.kind === 'ring') {
      ctx.beginPath();
      ctx.arc(0, 0, warning.radius || 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, (warning.radius || 110) - (warning.width || 32), 0, Math.PI * 2);
      ctx.stroke();
      if (isBoss) {
        for (let index = 0; index < 8; index += 1) {
          const angle = index * Math.PI * 2 / 8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * ((warning.radius || 110) - 10), Math.sin(angle) * ((warning.radius || 110) - 10));
          ctx.lineTo(Math.cos(angle) * ((warning.radius || 110) + 12), Math.sin(angle) * ((warning.radius || 110) + 12));
          ctx.stroke();
        }
      }
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, warning.radius || 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    drawCrackRunes(ctx, warning, color);
    drawWarningPhaseTicks(ctx, warning, color, progress, armed);
    ctx.restore();
  }

  function drawWarningPhaseTicks(ctx, warning, color, progress, armed) {
    ctx.strokeStyle = withAlpha(color, armed ? 0.86 : 0.5);
    ctx.lineWidth = armed ? 2.4 : 1.2;
    const radius = warning.radius || warning.reach || 70;
    const tickCount = warning.phase ? 12 : 8;
    for (let index = 0; index < tickCount; index += 1) {
      const angle = index * Math.PI * 2 / tickCount + progress * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (radius + 5), Math.sin(angle) * (radius + 5));
      ctx.lineTo(Math.cos(angle) * (radius + (armed ? 22 : 14)), Math.sin(angle) * (radius + (armed ? 22 : 14)));
      ctx.stroke();
    }
  }

  function drawConeWarning(ctx, reach, arc) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, reach, -arc / 2, arc / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawJawWarning(ctx, reach, arc) {
    drawConeWarning(ctx, reach, arc);
    for (let index = -3; index <= 3; index += 1) {
      const angle = index * arc / 7;
      const inner = reach * 0.62;
      const outer = reach * 0.9;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.lineTo(Math.cos(angle - 0.04) * inner, Math.sin(angle - 0.04) * inner);
      ctx.lineTo(Math.cos(angle + 0.04) * inner, Math.sin(angle + 0.04) * inner);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawLaneShape(ctx, length, width) {
    ctx.beginPath();
    ctx.rect(0, -width / 2, length, width);
    ctx.fill();
    ctx.stroke();
  }

  function drawProjectile(ctx, projectile, palette) {
    const colors = {
      bell: palette.accentBell,
      missile: palette.wizard,
      radiance: palette.cleric,
      roots: palette.druid,
      arrow: palette.ranger,
      knives: palette.thief,
      fan: palette.thief,
    };
    const color = colors[projectile.kind] || palette.accentEmber;
    const angle = projectile.angle || Math.atan2(projectile.vy, projectile.vx);
    const alpha = projectile.maxLife ? Math.max(0.22, projectile.life / projectile.maxLife) : 1;
    drawProjectileTrail(ctx, projectile, color, alpha);
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.strokeStyle = withAlpha(color, 0.5);
    if (projectile.kind === 'arrow') drawArrowProjectile(ctx);
    else if (projectile.kind === 'knives' || projectile.kind === 'fan') drawKnifeProjectile(ctx);
    else if (projectile.kind === 'missile') drawRuneProjectile(ctx, projectile.radius);
    else if (projectile.kind === 'radiance') drawRadianceProjectile(ctx, projectile.radius);
    else if (projectile.kind === 'roots') drawRootProjectile(ctx);
    else if (projectile.kind === 'bell') drawBellProjectile(ctx, projectile.radius);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawProjectileTrail(ctx, projectile, color, alpha) {
    const angle = projectile.angle || Math.atan2(projectile.vy, projectile.vx);
    const length = projectile.trail === 'arrow' ? 42 : projectile.trail === 'bell' ? 24 : 30;
    ctx.strokeStyle = withAlpha(color, alpha * 0.34);
    ctx.lineWidth = projectile.trail === 'bell' ? projectile.radius * 0.8 : 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(projectile.x - Math.cos(angle) * length, projectile.y - Math.sin(angle) * length);
    ctx.lineTo(projectile.x, projectile.y);
    ctx.stroke();
  }

  function drawArrowProjectile(ctx) {
    ctx.fillRect(-18, -2, 32, 4);
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(7, -7);
    ctx.lineTo(7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-22, -5, 8, 3);
    ctx.fillRect(-22, 2, 8, 3);
  }

  function drawKnifeProjectile(ctx) {
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-7, -4);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-7, 4);
    ctx.closePath();
    ctx.fill();
  }

  function drawRuneProjectile(ctx, radius) {
    ctx.strokeRect(-radius, -radius, radius * 2, radius * 2);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.6, radius * 0.3);
    ctx.lineTo(0, -radius * 0.6);
    ctx.lineTo(radius * 0.7, radius * 0.4);
    ctx.stroke();
  }

  function drawRadianceProjectile(ctx, radius) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawRootProjectile(ctx) {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 8);
    ctx.lineTo(0, -10);
    ctx.lineTo(14, 8);
    ctx.lineTo(22, -2);
    ctx.stroke();
  }

  function drawBellProjectile(ctx, radius) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, -0.25, Math.PI * 1.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawAttackMark(ctx, mark, palette) {
    const alpha = Math.max(0, mark.life / mark.maxLife);
    const color = getMarkColor(mark, palette);
    ctx.save();
    ctx.translate(mark.x, mark.y);
    ctx.rotate(mark.angle || 0);
    ctx.strokeStyle = withAlpha(color, alpha * 0.74);
    ctx.fillStyle = withAlpha(color, alpha * 0.12);
    if (mark.kind === 'cleave') {
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, mark.radius * (0.44 + (1 - alpha) * 0.08), -mark.arc / 2, mark.arc / 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, mark.radius * 0.28, -mark.arc / 2, mark.arc / 2);
      ctx.stroke();
      ctx.fillStyle = withAlpha(color, alpha * 0.16);
      ctx.beginPath();
      ctx.moveTo(mark.radius * 0.16, 0);
      ctx.arc(0, 0, mark.radius * 0.55, -mark.arc / 2, mark.arc / 2);
      ctx.lineTo(mark.radius * 0.16, 0);
      ctx.fill();
      ctx.strokeStyle = withAlpha(palette.textPrimary, alpha * 0.42);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, mark.radius * 0.5, -mark.arc / 2, mark.arc / 2);
      ctx.stroke();
    } else if (mark.kind === 'roots') {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-mark.radius, 0);
      ctx.lineTo(-mark.radius * 0.25, -mark.radius * 0.35);
      ctx.lineTo(mark.radius * 0.15, mark.radius * 0.25);
      ctx.lineTo(mark.radius, -mark.radius * 0.18);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-mark.radius * 0.54, mark.radius * 0.18);
      ctx.lineTo(-mark.radius * 0.82, mark.radius * 0.46);
      ctx.moveTo(mark.radius * 0.14, mark.radius * 0.24);
      ctx.lineTo(mark.radius * 0.52, mark.radius * 0.56);
      ctx.stroke();
    } else if (mark.kind === 'hawk') {
      ctx.beginPath();
      ctx.moveTo(0, -mark.radius);
      ctx.lineTo(mark.radius, mark.radius * 0.6);
      ctx.lineTo(0, mark.radius * 0.2);
      ctx.lineTo(-mark.radius, mark.radius * 0.6);
      ctx.closePath();
      ctx.stroke();
    } else if (mark.kind === 'radiance' || mark.kind === 'halo') {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, mark.radius * (1 + (1 - alpha) * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-mark.radius * 0.7, 0);
      ctx.lineTo(mark.radius * 0.7, 0);
      ctx.moveTo(0, -mark.radius * 0.7);
      ctx.lineTo(0, mark.radius * 0.7);
      ctx.stroke();
    } else if (mark.kind === 'missile') {
      ctx.lineWidth = 2;
      ctx.strokeRect(-mark.radius, -mark.radius, mark.radius * 2, mark.radius * 2);
      ctx.beginPath();
      ctx.moveTo(-mark.radius * 0.7, mark.radius * 0.25);
      ctx.lineTo(0, -mark.radius * 0.82);
      ctx.lineTo(mark.radius * 0.78, mark.radius * 0.3);
      ctx.stroke();
    } else if (mark.kind === 'blade') {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-mark.radius, -mark.radius * 0.24);
      ctx.lineTo(mark.radius, mark.radius * 0.18);
      ctx.moveTo(-mark.radius * 0.72, mark.radius * 0.34);
      ctx.lineTo(mark.radius * 0.7, -mark.radius * 0.28);
      ctx.stroke();
    } else {
      ctx.lineWidth = mark.kind === 'bell' ? 5 : 3;
      ctx.beginPath();
      ctx.arc(0, 0, mark.radius * (1 + (1 - alpha) * 0.55), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticle(ctx, particle, palette) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    const color = resolveColor(palette, particle.colorToken);
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.globalAlpha = alpha;
    if (particle.kind === 'deathSmoke') {
      ctx.fillStyle = withAlpha(color, 0.24);
      ctx.strokeStyle = withAlpha(palette.textPrimary, 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, particle.radius * (1.5 - alpha * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (particle.kind === 'eliteShard' || particle.kind === 'bellShard') {
      ctx.fillStyle = withAlpha(color, 0.72);
      ctx.strokeStyle = withAlpha(palette.textPrimary, 0.36);
      ctx.lineWidth = 1;
      ctx.rotate((1 - alpha) * Math.PI * 1.4);
      ctx.beginPath();
      ctx.moveTo(0, -particle.radius * 1.5);
      ctx.lineTo(particle.radius, 0);
      ctx.lineTo(0, particle.radius * 1.35);
      ctx.lineTo(-particle.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (particle.kind === 'xpAbsorb') {
      ctx.strokeStyle = withAlpha(color, 0.82);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-particle.vx * 0.045, -particle.vy * 0.045);
      ctx.lineTo(0, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = withAlpha(color, 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function getMarkColor(mark, palette) {
    const colors = {
      arrow: palette.ranger,
      blade: palette.thief,
      bell: palette.accentBell,
      cleave: palette.fighter,
      halo: palette.cleric,
      hawk: palette.ranger,
      metal: palette.fighter,
      missile: palette.wizard,
      radiance: palette.cleric,
      roots: palette.druid,
    };
    return colors[mark.kind] || palette.accentEmber;
  }

  function drawGem(ctx, gem, palette) {
    if (gem.trail && gem.pullMode) drawGemPullTrail(ctx, gem, palette);
    const pulse = 1 + Math.sin(gem.age * 7) * 0.08;
    ctx.save();
    ctx.translate(gem.x, gem.y);
    ctx.scale(pulse, pulse);
    drawGemHalo(ctx, gem, palette);
    ctx.fillStyle = palette.statusInfo;
    ctx.strokeStyle = withAlpha(palette.textPrimary, 0.5);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -gem.radius * 1.35);
    ctx.lineTo(gem.radius * 1.05, 0);
    ctx.lineTo(0, gem.radius * 1.35);
    ctx.lineTo(-gem.radius * 1.05, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.statusInfo, gem.pullMode === 'magnet' ? 0.66 : 0.34);
    ctx.beginPath();
    ctx.arc(0, 0, gem.radius + (gem.pullMode === 'magnet' ? 6 : 3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawGemHalo(ctx, gem, palette) {
    ctx.save();
    ctx.fillStyle = withAlpha(palette.surfaceCanvas, 0.56);
    ctx.strokeStyle = withAlpha(palette.statusInfo, gem.pullMode ? 0.74 : 0.42);
    ctx.lineWidth = gem.pullMode ? 2.2 : 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, gem.radius + 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawGemPullTrail(ctx, gem, palette) {
    const color = gem.pullMode === 'magnet' ? palette.statusInfo : palette.accentPrimary;
    ctx.strokeStyle = withAlpha(color, gem.pullMode === 'magnet' ? 0.58 : 0.34);
    ctx.lineWidth = gem.pullMode === 'magnet' ? 2.4 : 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const controlX = (gem.trail.x + gem.x) / 2 + Math.sin(gem.age * 8) * 14;
    const controlY = (gem.trail.y + gem.y) / 2 + Math.cos(gem.age * 8) * 10;
    ctx.moveTo(gem.trail.x, gem.trail.y);
    ctx.quadraticCurveTo(controlX, controlY, gem.x, gem.y);
    ctx.stroke();
  }

  function drawChest(ctx, chest, palette) {
    const pulse = 1 + Math.sin((chest.age || 0) * 4) * 0.035;
    ctx.save();
    ctx.translate(chest.x, chest.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = palette.surfaceIron || palette.surfaceParchment;
    ctx.strokeStyle = palette.accentBrass || palette.accentEmber;
    ctx.lineWidth = 2;
    ctx.fillRect(-13, -8, 26, 18);
    ctx.strokeRect(-13, -8, 26, 18);
    ctx.beginPath();
    ctx.moveTo(-13, -8);
    ctx.quadraticCurveTo(0, -19, 13, -8);
    ctx.lineTo(13, -4);
    ctx.lineTo(-13, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = withAlpha(palette.accentBell, 0.82);
    ctx.fillRect(-2, -3, 4, 8);
    ctx.strokeStyle = withAlpha(palette.accentBrass || palette.accentEmber, 0.54);
    ctx.beginPath();
    ctx.moveTo(-9, 2);
    ctx.lineTo(9, 2);
    ctx.moveTo(-7, 7);
    ctx.lineTo(7, 7);
    ctx.stroke();
    ctx.restore();
  }

  function drawHud(ctx, state, palette, canvas) {
    const player = state.player;
    const accent = resolveColor(palette, player.accentToken);
    const safeWidth = Math.min(390, canvas.width - 28);
    ctx.fillStyle = withAlpha(palette.surfacePrimary, 0.76);
    ctx.fillRect(14, 14, safeWidth, 82);
    ctx.strokeStyle = withAlpha(accent, 0.7);
    ctx.strokeRect(14.5, 14.5, safeWidth, 82);
    drawBar(ctx, 32, 36, safeWidth - 152, 10, player.health / player.maxHealth, palette.borderSubtle, palette.statusError);
    drawBar(ctx, 32, 58, safeWidth - 152, 8, player.xp / player.nextXp, palette.borderSubtle, palette.statusInfo);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 13px "Apple SD Gothic Neo", Arial, sans-serif';
    ctx.fillText(`${state.playbook.title}  LV ${player.level}`, 32, 84);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(Math.max(0, state.duration - state.elapsed)), safeWidth - 12, 42);
    const modeLabel = state.mode && state.mode.id ? state.mode.id.toUpperCase() : 'STANDARD';
    ctx.fillStyle = state.bossSpawned ? palette.accentBell : palette.statusWarning;
    ctx.fillText(state.bossSpawned ? '보스전' : state.waves[state.waveIndex].title, safeWidth - 12, 67);
    ctx.textAlign = 'left';
    ctx.fillStyle = withAlpha(state.bossSpawned ? palette.accentBell : palette.surfacePrimary, 0.82);
    ctx.fillRect(32, 18, 92, 16);
    ctx.strokeStyle = state.bossSpawned ? palette.accentBell : palette.borderDefault;
    ctx.strokeRect(32.5, 18.5, 92, 16);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 11px "SFMono-Regular", Consolas, monospace';
    ctx.fillText(`MODE ${modeLabel}`, 39, 30);
    drawBossStatusHud(ctx, state, palette, canvas);
  }

  function drawBossStatusHud(ctx, state, palette, canvas) {
    const boss = state.enemies.find((enemy) => enemy.behavior === 'boss');
    if (!boss && state.effects.bossPulse <= 0) return;
    const width = Math.min(520, canvas.width - 72);
    const x = (canvas.width - width) / 2;
    const y = 18;
    ctx.save();
    ctx.fillStyle = withAlpha(palette.surfacePrimary, 0.84);
    ctx.strokeStyle = withAlpha(palette.accentBell, 0.86);
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, width, 34);
    ctx.strokeRect(x + 0.5, y + 0.5, width, 34);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 13px "Apple SD Gothic Neo", Arial, sans-serif';
    ctx.fillText(boss ? '검은 종 파수꾼' : '강적 접근', x + 14, y + 22);
    if (boss) {
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      const phaseLabel = state.bossPhase ? state.bossPhase.title : '문 앞의 종';
      drawBar(ctx, x + 136, y + 11, width - 154, 8, ratio, palette.borderSubtle, palette.accentBell);
      ctx.fillStyle = palette.textSecondary;
      ctx.font = '700 11px "Apple SD Gothic Neo", Arial, sans-serif';
      ctx.fillText(phaseLabel, x + 136, y + 27);
    } else {
      ctx.fillStyle = palette.accentBell;
      ctx.fillText('엘리트/보스 경고', x + 136, y + 22);
    }
    ctx.restore();
  }

  function drawBar(ctx, x, y, width, height, ratio, baseColor, fillColor) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, ratio)), height);
  }

  function drawFloaters(ctx, floaters, palette, camera) {
    ctx.font = '700 13px "Apple SD Gothic Neo", Arial, sans-serif';
    ctx.textAlign = 'center';
    floaters.forEach((floater) => {
      ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      ctx.fillStyle = resolveColor(palette, floater.color);
      if (floater.screenSpace) {
        ctx.fillText(floater.text, camera.x + camera.width / 2, camera.y + 92);
      } else {
        ctx.fillText(floater.text, floater.x, floater.y);
      }
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawScreenOverlays(ctx, state, palette, canvas) {
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.width * 0.18,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.68
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.46)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = withAlpha(palette.textPrimary, 0.025);
    for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 1);
    if (state.effects.pulse > 0) {
      ctx.strokeStyle = withAlpha(palette.accentEmber, state.effects.pulse);
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    }
    if (state.effects.bossPulse > 0) {
      ctx.strokeStyle = withAlpha(palette.accentBell, state.effects.bossPulse * 0.42);
      ctx.lineWidth = 7;
      ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
    }
    if (state.effects.flash > 0) {
      ctx.fillStyle = withAlpha(palette.accentBell, state.effects.flash * 0.14);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const rest = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
  }

  function getCombatReadabilityInfo(state) {
    const boss = state.enemies.find((enemy) => enemy.behavior === 'boss');
    return {
      hudContrast: 'reinforced',
      bossPhaseLabel: state.bossPhase ? state.bossPhase.title : '',
      bossPhase: state.bossPhase ? state.bossPhase.id : '',
      activeElitePatterns: state.enemies
        .filter((enemy) => enemy.elitePatternTitle)
        .map((enemy) => enemy.elitePatternTitle),
      warningCount: state.enemyWarnings.length + state.bossWarnings.length + state.hazards.length,
      xpGemCount: state.gems.length,
      bossVisible: Boolean(boss),
    };
  }

  function render(ctx, state, world) {
    const palette = getPalette();
    const canvas = ctx.canvas;
    const camera = createCamera(state, world, canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (state.effects.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.effects.shake * 12, (Math.random() - 0.5) * state.effects.shake * 12);
    }
    applyCamera(ctx, camera);
    drawBackground(ctx, world, camera, state, palette);
    drawCombatReadabilityScrim(ctx, camera, state, palette);
    state.hazards.forEach((hazard) => drawHazard(ctx, hazard, palette));
    state.bossWarnings.forEach((warning) => drawWarning(ctx, warning, palette));
    state.enemyWarnings.forEach((warning) => drawWarning(ctx, warning, palette));
    state.gems.forEach((gem) => drawGem(ctx, gem, palette));
    state.chests.forEach((chest) => drawChest(ctx, chest, palette));
    state.projectiles.forEach((projectile) => drawProjectile(ctx, projectile, palette));
    state.attackMarks.forEach((mark) => drawAttackMark(ctx, mark, palette));
    state.particles.forEach((particle) => drawParticle(ctx, particle, palette));
    state.enemies.forEach((enemy) => drawEnemy(ctx, enemy, palette));
    drawLevelShockwave(ctx, state, palette);
    drawPlayer(ctx, state.player, palette);
    drawFloaters(ctx, state.floaters, palette, camera);
    ctx.restore();
    drawScreenOverlays(ctx, state, palette, canvas);
    drawHud(ctx, state, palette, canvas);
    ctx.restore();
  }

  window.DungeonworldSurvivorsRenderer = {
    createCamera,
    formatTime,
    getBackgroundRenderInfo,
    getCombatReadabilityInfo,
    markBackgroundSpriteFailedForQa,
    preloadClassSprites,
    preloadEnemySprites,
    preloadBackgroundSprites,
    render,
  };
})();

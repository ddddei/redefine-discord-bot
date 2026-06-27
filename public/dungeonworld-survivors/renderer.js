(function () {
  function getPalette() {
    const style = getComputedStyle(document.documentElement);
    const token = (name) => style.getPropertyValue(name).trim();
    return {
      surfacePrimary: token('--surface-primary'),
      surfaceCanvas: token('--surface-canvas'),
      surfaceParchment: token('--surface-parchment'),
      textPrimary: token('--text-primary'),
      textSecondary: token('--text-secondary'),
      textTertiary: token('--text-tertiary'),
      borderDefault: token('--border-default'),
      borderSubtle: token('--border-subtle'),
      accentPrimary: token('--accent-primary'),
      accentEmber: token('--accent-ember'),
      accentBell: token('--accent-bell'),
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

  function drawBackground(ctx, world, camera, elapsed, palette) {
    ctx.fillStyle = palette.surfaceCanvas;
    ctx.fillRect(0, 0, world.width, world.height);
    drawGroundTexture(ctx, world, camera, palette);
    drawRoad(ctx, world, elapsed, palette);
    drawRuins(ctx, palette);
    drawForest(ctx, world, camera, palette);
    drawBasin(ctx, palette);
    drawTower(ctx, world, elapsed, palette);
    drawWorldEdges(ctx, world, palette);
  }

  function drawGroundTexture(ctx, world, camera, palette) {
    ctx.fillStyle = withAlpha(palette.borderSubtle, 0.32);
    const startX = Math.floor(camera.x / 80) * 80;
    const startY = Math.floor(camera.y / 80) * 80;
    for (let y = startY; y < camera.y + camera.height + 90; y += 80) {
      for (let x = startX; x < camera.x + camera.width + 90; x += 80) {
        const noise = seededNoise(x, y);
        ctx.globalAlpha = 0.08 + noise * 0.08;
        ctx.fillRect(x + noise * 26, y + (1 - noise) * 22, 34 + noise * 28, 2);
        ctx.fillRect(x + 18, y + 42, 2, 18 + noise * 20);
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
    ctx.strokeStyle = withAlpha(palette.surfaceParchment, 0.5);
    ctx.lineWidth = 92;
    ctx.beginPath();
    for (let index = 0; index <= 34; index += 1) {
      const point = roadPoint(world, index / 34);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.borderDefault, 0.52);
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
    ctx.strokeStyle = withAlpha(palette.accentPrimary, 0.34);
    ctx.fillStyle = withAlpha(palette.accentPrimary, 0.14);
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
    ctx.strokeStyle = withAlpha(palette.statusInfo, 0.44);
    ctx.fillStyle = withAlpha(palette.statusInfo, 0.12);
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
    ctx.fillStyle = withAlpha(palette.accentBell, 0.08 + Math.sin(elapsed * 1.4) * 0.025);
    ctx.beginPath();
    ctx.arc(0, 80, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(palette.textPrimary, 0.16);
    ctx.beginPath();
    ctx.moveTo(-68, 210);
    ctx.lineTo(-34, -74);
    ctx.lineTo(20, -150);
    ctx.lineTo(70, 210);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.accentBell, 0.5);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -32, 36 + Math.sin(elapsed * 2) * 3, 0, Math.PI * 2);
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
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.facing || 0);
    ctx.globalAlpha = player.invulnerableTimer > 0 ? 0.62 : 1;
    ctx.fillStyle = accent;
    ctx.strokeStyle = palette.textPrimary;
    ctx.lineWidth = 3;
    if (player.crest === 'shield') drawShieldCrest(ctx, player.radius);
    else if (player.crest === 'blade') drawBladeCrest(ctx, player.radius);
    else if (player.crest === 'halo') drawHaloCrest(ctx, player.radius);
    else if (player.crest === 'root') drawRootCrest(ctx, player.radius);
    else if (player.crest === 'rune') drawRuneCrest(ctx, player.radius);
    else drawHawkCrest(ctx, player.radius);
    ctx.strokeStyle = withAlpha(accent, 0.56);
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 8, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
    drawPlayerAuras(ctx, player, accent, palette);
  }

  function drawShieldCrest(ctx, radius) {
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(-radius * 0.3, -radius * 0.85);
    ctx.lineTo(-radius, 0);
    ctx.lineTo(-radius * 0.25, radius * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawBladeCrest(ctx, radius) {
    ctx.beginPath();
    ctx.moveTo(radius * 1.05, 0);
    ctx.lineTo(-radius * 0.5, -radius * 0.58);
    ctx.lineTo(-radius * 0.22, 0);
    ctx.lineTo(-radius * 0.5, radius * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawHaloCrest(ctx, radius) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawRootCrest(ctx, radius) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-radius, radius * 0.7);
    ctx.lineTo(-radius * 0.2, 0);
    ctx.lineTo(radius * 0.3, radius * 0.85);
    ctx.lineTo(radius, -radius * 0.1);
    ctx.stroke();
  }

  function drawRuneCrest(ctx, radius) {
    ctx.beginPath();
    ctx.rect(-radius * 0.72, -radius * 0.72, radius * 1.44, radius * 1.44);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.4, radius * 0.2);
    ctx.lineTo(0, -radius * 0.45);
    ctx.lineTo(radius * 0.42, radius * 0.2);
    ctx.stroke();
  }

  function drawHawkCrest(ctx, radius) {
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(-radius * 0.8, -radius * 0.72);
    ctx.lineTo(-radius * 0.32, 0);
    ctx.lineTo(-radius * 0.8, radius * 0.72);
    ctx.closePath();
    ctx.fill();
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
    ctx.fillStyle = color;
    ctx.beginPath();
    if (enemy.behavior === 'bulwark') ctx.rect(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
    else ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = enemy.slowTimer > 0 ? palette.accentPrimary : palette.surfacePrimary;
    ctx.lineWidth = enemy.behavior === 'boss' ? 4 : 2;
    ctx.stroke();
    const width = enemy.radius * 2.2;
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = palette.borderSubtle;
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width, 4);
    ctx.fillStyle = enemy.behavior === 'boss' ? palette.accentBell : palette.statusError;
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 12, width * hpRatio, 4);
  }

  function drawHazard(ctx, hazard, palette) {
    const color = resolveColor(palette, hazard.colorToken);
    const armed = hazard.warningLeft <= 0;
    const alpha = armed ? 0.34 : 0.2 + Math.sin(hazard.life * 18) * 0.07;
    ctx.save();
    ctx.translate(hazard.x, hazard.y);
    ctx.rotate(hazard.angle || 0);
    ctx.strokeStyle = withAlpha(color, alpha + 0.2);
    ctx.fillStyle = withAlpha(color, alpha * 0.34);
    ctx.lineWidth = armed ? 4 : 2;
    ctx.setLineDash(armed ? [] : [10, 8]);
    if (hazard.kind === 'wolfLane') {
      drawLaneShape(ctx, hazard.length || 240, hazard.width || 38);
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
    ctx.restore();
  }

  function drawWarning(ctx, warning, palette) {
    const color = resolveColor(palette, warning.colorToken);
    const progress = warning.maxLife ? warning.warningLeft / warning.maxLife : 0.5;
    ctx.save();
    ctx.translate(warning.x, warning.y);
    ctx.rotate(warning.angle || 0);
    ctx.strokeStyle = withAlpha(color, 0.72);
    ctx.fillStyle = withAlpha(color, 0.1 + (1 - progress) * 0.13);
    ctx.lineWidth = 3 + (1 - progress) * 2;
    ctx.setLineDash([12, 8]);
    if (warning.kind === 'line') {
      drawLaneShape(ctx, warning.length || warning.reach || 130, warning.width || 30);
    } else if (warning.kind === 'cone' || warning.kind === 'arc') {
      const reach = warning.reach || warning.radius || 70;
      const arc = warning.arc || Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, reach, -arc / 2, arc / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (warning.kind === 'ring') {
      ctx.beginPath();
      ctx.arc(0, 0, warning.radius || 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, (warning.radius || 110) - (warning.width || 32), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, warning.radius || 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
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
    } else if (mark.kind === 'roots') {
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-mark.radius, 0);
      ctx.lineTo(-mark.radius * 0.25, -mark.radius * 0.35);
      ctx.lineTo(mark.radius * 0.15, mark.radius * 0.25);
      ctx.lineTo(mark.radius, -mark.radius * 0.18);
      ctx.stroke();
    } else if (mark.kind === 'hawk') {
      ctx.beginPath();
      ctx.moveTo(0, -mark.radius);
      ctx.lineTo(mark.radius, mark.radius * 0.6);
      ctx.lineTo(0, mark.radius * 0.2);
      ctx.lineTo(-mark.radius, mark.radius * 0.6);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.lineWidth = mark.kind === 'bell' ? 5 : 3;
      ctx.beginPath();
      ctx.arc(0, 0, mark.radius * (1 + (1 - alpha) * 0.55), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
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
    ctx.fillStyle = palette.statusInfo;
    ctx.strokeStyle = withAlpha(palette.textPrimary, 0.42);
    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - gem.radius);
    ctx.lineTo(gem.x + gem.radius, gem.y);
    ctx.lineTo(gem.x, gem.y + gem.radius);
    ctx.lineTo(gem.x - gem.radius, gem.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
    ctx.fillStyle = state.bossSpawned ? palette.accentBell : palette.accentEmber;
    ctx.fillText(state.bossSpawned ? '보스전' : state.content.wavePatterns[state.waveIndex].title, safeWidth - 12, 67);
    ctx.textAlign = 'left';
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
      ctx.strokeStyle = withAlpha(palette.accentBell, state.effects.bossPulse * 0.65);
      ctx.lineWidth = 10;
      ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
    }
    if (state.effects.flash > 0) {
      ctx.fillStyle = withAlpha(palette.accentBell, state.effects.flash * 0.22);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const rest = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
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
    drawBackground(ctx, world, camera, state.elapsed, palette);
    state.hazards.forEach((hazard) => drawHazard(ctx, hazard, palette));
    state.bossWarnings.forEach((warning) => drawWarning(ctx, warning, palette));
    state.enemyWarnings.forEach((warning) => drawWarning(ctx, warning, palette));
    state.gems.forEach((gem) => drawGem(ctx, gem, palette));
    state.projectiles.forEach((projectile) => drawProjectile(ctx, projectile, palette));
    state.attackMarks.forEach((mark) => drawAttackMark(ctx, mark, palette));
    state.enemies.forEach((enemy) => drawEnemy(ctx, enemy, palette));
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
    render,
  };
})();

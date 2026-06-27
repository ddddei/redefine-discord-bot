(function () {
  function getPalette() {
    const style = getComputedStyle(document.documentElement);
    const token = (name) => style.getPropertyValue(name).trim();
    return {
      surfacePrimary: token('--surface-primary'),
      surfaceCanvas: token('--surface-canvas'),
      textPrimary: token('--text-primary'),
      textSecondary: token('--text-secondary'),
      borderSubtle: token('--border-subtle'),
      accentPrimary: token('--accent-primary'),
      accentEmber: token('--accent-ember'),
      accentBell: token('--accent-bell'),
      statusSuccess: token('--status-success'),
      statusError: token('--status-error'),
      statusInfo: token('--status-info'),
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
    };
    return map[colorToken] || palette.textPrimary;
  }

  function withAlpha(hexColor, alpha) {
    const hex = hexColor.replace('#', '');
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function drawBackground(ctx, world, elapsed, palette) {
    ctx.fillStyle = palette.surfaceCanvas;
    ctx.fillRect(0, 0, world.width, world.height);
    ctx.strokeStyle = palette.borderSubtle;
    ctx.lineWidth = 1;
    for (let x = -80; x < world.width + 80; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x + (elapsed * 6) % 80, 0);
      ctx.lineTo(x - 180 + (elapsed * 6) % 80, world.height);
      ctx.stroke();
    }
    ctx.fillStyle = withAlpha(palette.accentBell, 0.08);
    ctx.beginPath();
    ctx.arc(world.width - 118, 92, 82 + Math.sin(elapsed) * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(ctx, player, palette) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.globalAlpha = player.invulnerableTimer > 0 ? 0.62 : 1;
    ctx.fillStyle = palette.accentPrimary;
    ctx.beginPath();
    if (player.arcaneShield > 0) {
      ctx.rect(-player.radius * 0.75, -player.radius * 0.75, player.radius * 1.5, player.radius * 1.5);
      ctx.fill();
    } else {
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = palette.textPrimary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 5, -0.8, 0.8);
    ctx.stroke();
    if (player.aura) {
      ctx.strokeStyle = withAlpha(palette.accentPrimary, 0.26);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, player.auraRange, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (player.orbitingSpears > 0) {
      const count = player.orbitingSpears + 1;
      const radius = 48 + player.orbitingSpears * 10;
      ctx.strokeStyle = withAlpha(palette.accentEmber, 0.26);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = palette.accentEmber;
      for (let index = 0; index < count; index += 1) {
        const angle = player.orbitTimer * 3.2 + index * (Math.PI * 2 / count);
        ctx.save();
        ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
        ctx.rotate(angle);
        ctx.fillRect(-3, -10, 6, 20);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawEnemy(ctx, enemy, palette) {
    ctx.fillStyle = enemy.hitFlash > 0 ? palette.textPrimary : resolveColor(palette, enemy.colorToken);
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = enemy.slowTimer > 0 ? palette.accentPrimary : palette.surfacePrimary;
    ctx.lineWidth = 2;
    ctx.stroke();
    const width = enemy.radius * 2;
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = palette.borderSubtle;
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 9, width, 4);
    ctx.fillStyle = palette.statusError;
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 9, width * hpRatio, 4);
  }

  function drawProjectile(ctx, projectile, palette) {
    const projectileColors = {
      bell: palette.accentBell,
      missile: palette.accentBell,
      radiance: palette.statusSuccess,
      roots: palette.accentPrimary,
      arrow: palette.accentEmber,
      knives: palette.accentEmber,
      fan: palette.accentEmber,
    };
    ctx.fillStyle = projectileColors[projectile.kind] || palette.accentEmber;
    ctx.beginPath();
    if (projectile.kind === 'arrow') {
      const angle = Math.atan2(projectile.vy, projectile.vx);
      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(angle);
      ctx.fillRect(-10, -2, 20, 4);
      ctx.restore();
    } else {
      ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    if (projectile.kind === 'bell' || projectile.kind === 'missile') {
      ctx.strokeStyle = withAlpha(palette.accentBell, 0.45);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (projectile.kind === 'roots') {
      ctx.strokeStyle = withAlpha(palette.accentPrimary, 0.36);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(projectile.x - 12, projectile.y + 8);
      ctx.lineTo(projectile.x, projectile.y - 10);
      ctx.lineTo(projectile.x + 12, projectile.y + 8);
      ctx.stroke();
    }
  }

  function drawAttackMark(ctx, mark, palette) {
    const alpha = Math.max(0, mark.life / mark.maxLife);
    if (mark.kind === 'cleave') {
      ctx.save();
      ctx.translate(mark.x, mark.y);
      ctx.rotate(mark.angle);
      ctx.strokeStyle = withAlpha(palette.accentEmber, alpha * 0.72);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, mark.radius * 0.48, -mark.arc / 2, mark.arc / 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = withAlpha(palette.accentEmber, alpha * 0.68);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mark.x, mark.y, mark.radius * (1 + (1 - alpha) * 0.4), 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawGem(ctx, gem, palette) {
    ctx.fillStyle = palette.statusInfo;
    ctx.beginPath();
    ctx.moveTo(gem.x, gem.y - gem.radius);
    ctx.lineTo(gem.x + gem.radius, gem.y);
    ctx.lineTo(gem.x, gem.y + gem.radius);
    ctx.lineTo(gem.x - gem.radius, gem.y);
    ctx.closePath();
    ctx.fill();
  }

  function drawHud(ctx, state, world, palette) {
    const player = state.player;
    ctx.fillStyle = 'rgba(16, 20, 23, 0.72)';
    ctx.fillRect(18, 18, 272, 48);
    ctx.fillStyle = palette.borderSubtle;
    ctx.fillRect(32, 34, 108, 10);
    ctx.fillStyle = palette.statusError;
    ctx.fillRect(32, 34, 108 * Math.max(0, player.health / player.maxHealth), 10);
    ctx.fillStyle = palette.borderSubtle;
    ctx.fillRect(158, 34, 108, 10);
    ctx.fillStyle = palette.statusInfo;
    ctx.fillRect(158, 34, 108 * Math.max(0, player.xp / player.nextXp), 10);
    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 12px Arial, sans-serif';
    ctx.fillText(`HP ${Math.ceil(player.health)}/${player.maxHealth}`, 32, 58);
    ctx.fillText(`LV ${player.level}`, 158, 58);
    ctx.textAlign = 'right';
    ctx.fillText(state.bossSpawned ? '파수꾼 처치' : formatTime(Math.max(0, state.duration - state.elapsed)), world.width - 24, 38);
    ctx.textAlign = 'left';
  }

  function drawFloaters(ctx, floaters, palette) {
    ctx.font = '700 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    floaters.forEach((floater) => {
      ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      ctx.fillStyle = resolveColor(palette, floater.color);
      ctx.fillText(floater.text, floater.x, floater.y);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const rest = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
  }

  function render(ctx, state, world) {
    const palette = getPalette();
    ctx.save();
    if (state.effects.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.effects.shake * 12, (Math.random() - 0.5) * state.effects.shake * 12);
    }
    drawBackground(ctx, world, state.elapsed, palette);
    state.gems.forEach((gem) => drawGem(ctx, gem, palette));
    state.projectiles.forEach((projectile) => drawProjectile(ctx, projectile, palette));
    state.attackMarks.forEach((mark) => drawAttackMark(ctx, mark, palette));
    state.enemies.forEach((enemy) => drawEnemy(ctx, enemy, palette));
    drawPlayer(ctx, state.player, palette);
    drawFloaters(ctx, state.floaters, palette);
    drawHud(ctx, state, world, palette);
    if (state.effects.pulse > 0) {
      ctx.strokeStyle = withAlpha(palette.accentEmber, state.effects.pulse);
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, world.width - 16, world.height - 16);
    }
    if (state.effects.flash > 0) {
      ctx.fillStyle = withAlpha(palette.accentBell, state.effects.flash * 0.25);
      ctx.fillRect(0, 0, world.width, world.height);
    }
    ctx.restore();
  }

  window.DungeonworldSurvivorsRenderer = {
    formatTime,
    render,
  };
})();

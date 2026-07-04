const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const GAMES = ['match3', 'idle', 'deck'];

function readProjectFile(filePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, filePath), 'utf8');
}

function assertNoNativeInterruptions(filePath, source) {
  assert.ok(!source.includes('navigator.vibrate'), `${filePath} should not use vibration`);
  assert.ok(!source.includes('Notification('), `${filePath} should not use native notifications`);
  assert.ok(!source.includes('new Audio'), `${filePath} should not create audio`);
}

function assertIndexHardening(game) {
  const filePath = `public/${game}/index.html`;
  const html = readProjectFile(filePath);

  assert.ok(
    html.includes('<html lang="ko" style="--paper: #efe3c8; background-color: var(--paper);">'),
    `${filePath} should set paper background inline before CSS loads`
  );
  assert.ok(
    html.includes('width=device-width, initial-scale=1, viewport-fit=cover'),
    `${filePath} should opt into viewport-fit=cover`
  );
  assert.ok(html.includes('name="theme-color"'), `${filePath} should set theme-color`);
  assert.ok(html.includes('content="#efe3c8"'), `${filePath} should use the paper theme color`);
  assertNoNativeInterruptions(filePath, html);
}

function assertStyleHardening(game) {
  const filePath = `public/${game}/styles.css`;
  const css = readProjectFile(filePath);

  assert.ok(css.includes('min-height: 100vh;'), `${filePath} should keep the 100vh fallback`);
  assert.ok(css.includes('min-height: 100dvh;'), `${filePath} should use 100dvh after the fallback`);
  assert.ok(!css.includes('background-attachment: fixed'), `${filePath} should not use fixed background attachment`);
  assert.ok(!css.includes('no-repeat fixed'), `${filePath} should not use fixed shorthand backgrounds`);
  assert.ok(css.includes('body::before'), `${filePath} should use a fixed pseudo-element background layer`);
  assert.ok(
    css.includes('env(safe-area-inset-bottom, 0px)'),
    `${filePath} should account for bottom safe area`
  );
  assert.ok(
    css.includes('env(safe-area-inset-top, 0px)'),
    `${filePath} should account for top safe area`
  );
}

function assertSharedTouchHardening() {
  const css = readProjectFile('public/shared/game-ui.css');

  assert.ok(css.includes('touch-action: manipulation'), 'game-ui.css should remove tap delay on controls');
  assert.ok(
    css.includes('-webkit-tap-highlight-color: transparent'),
    'game-ui.css should suppress iOS tap highlights on controls'
  );
  assert.ok(css.includes('-webkit-user-select: none'), 'game-ui.css should prevent stage text selection');
  assert.ok(css.includes('user-select: none'), 'game-ui.css should prevent stage text selection');
  assert.ok(css.includes('.gk-modal'), 'game-ui.css should include modal text selection exceptions');
  assert.ok(css.includes('user-select: text'), 'game-ui.css should keep modal/link copy selectable');
  assert.ok(css.includes('min-height: 44px'), 'game-ui.css should enforce 44px button targets');
}

function assertMatch3SwipeHardening() {
  const game = readProjectFile('public/match3/game.js');
  const css = readProjectFile('public/match3/styles.css');

  assert.ok(game.includes('pointerdown'), 'match3 game.js should listen for pointerdown');
  assert.ok(game.includes('pointermove'), 'match3 game.js should listen for pointermove');
  assert.ok(game.includes('pointerup'), 'match3 game.js should listen for pointerup');
  assert.ok(game.includes('setPointerCapture'), 'match3 swipe should capture the active pointer');
  assert.ok(game.includes('attemptSwap(first, second)'), 'click swap path should still call attemptSwap');
  assert.ok(game.includes('attemptSwap(swipeStart.tile, target)'), 'swipe should reuse the existing swap path');
  assert.ok(css.includes('touch-action: none'), 'match3 board should disable page scroll only on the board');
}

function main() {
  GAMES.forEach((game) => {
    assertIndexHardening(game);
    assertStyleHardening(game);
    assertNoNativeInterruptions(`public/${game}/game.js`, readProjectFile(`public/${game}/game.js`));
  });

  assertSharedTouchHardening();
  assertMatch3SwipeHardening();

  console.log('mobile hardening static test passed');
}

main();

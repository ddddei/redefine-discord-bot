const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SHARED_DIR = path.join(__dirname, '..', 'public', 'shared');
const GAMES = ['match3', 'idle', 'deck'];

function readSharedFile(fileName) {
  return fs.readFileSync(path.join(SHARED_DIR, fileName), 'utf8');
}

function readProjectFile(fileName) {
  return fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
}

function main() {
  assert.ok(fs.existsSync(path.join(SHARED_DIR, 'game-ui.css')), 'game-ui.css should exist');

  const sharedCss = readSharedFile('game-ui.css');
  assert.ok(sharedCss.includes('.gk-button'), 'game-ui.css should define .gk-button');
  assert.ok(sharedCss.includes('.gk-modal'), 'game-ui.css should define .gk-modal');
  assert.ok(
    sharedCss.includes('prefers-reduced-motion: reduce'),
    'game-ui.css should include a prefers-reduced-motion block'
  );

  GAMES.forEach((game) => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', game, 'index.html'), 'utf8');
    const sharedIndex = html.indexOf('../shared/game-ui.css');
    const gameStylesIndex = html.indexOf('./styles.css');
    assert.ok(sharedIndex !== -1, `${game}/index.html should load ../shared/game-ui.css`);
    assert.ok(gameStylesIndex !== -1, `${game}/index.html should load ./styles.css`);
    assert.ok(
      sharedIndex < gameStylesIndex,
      `${game}/index.html should load ../shared/game-ui.css before ./styles.css`
    );
  });

  const adminServer = readProjectFile('src/adminServer.js');
  assert.ok(adminServer.includes('/game/shared'), 'adminServer should route /game/shared');
  assert.ok(adminServer.includes('SHARED_PUBLIC_DIR'), 'adminServer should define SHARED_PUBLIC_DIR');
  assert.ok(adminServer.includes('resolveSharedAsset'), 'adminServer should define resolveSharedAsset');
  assert.ok(adminServer.includes('serveSharedAsset'), 'adminServer should define serveSharedAsset');
  assert.ok(
    adminServer.includes('filePath.startsWith(SHARED_PUBLIC_DIR)'),
    'adminServer should guard against path traversal for shared assets'
  );

  console.log('shared ui static test passed');
}

main();

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const GAME_DIR = path.join(__dirname, '..', 'public', 'deck');
const REQUIRED_FILES = ['index.html', 'styles.css', 'content.js', 'engine.js', 'game.js'];

function readGameFile(fileName) {
  return fs.readFileSync(path.join(GAME_DIR, fileName), 'utf8');
}

function readProjectFile(fileName) {
  return fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
}

function main() {
  REQUIRED_FILES.forEach((fileName) => {
    assert.ok(fs.existsSync(path.join(GAME_DIR, fileName)), `${fileName} should exist`);
  });

  const html = readGameFile('index.html');
  assert.ok(html.includes('간식 수호대'));
  assert.ok(!html.includes('포인트 지급'));

  const contentScriptIndex = html.indexOf('./content.js');
  const engineScriptIndex = html.indexOf('./engine.js');
  const gameScriptIndex = html.indexOf('./game.js');
  assert.ok(contentScriptIndex !== -1, 'index.html should load content.js');
  assert.ok(engineScriptIndex !== -1, 'index.html should load engine.js');
  assert.ok(gameScriptIndex !== -1, 'index.html should load game.js');
  assert.ok(contentScriptIndex < engineScriptIndex, 'content.js should load before engine.js');
  assert.ok(engineScriptIndex < gameScriptIndex, 'engine.js should load before game.js');

  const sharedCssIndex = html.indexOf('../shared/game-ui.css');
  const gameCssIndex = html.indexOf('./styles.css');
  assert.ok(sharedCssIndex !== -1, 'index.html should load ../shared/game-ui.css');
  assert.ok(gameCssIndex !== -1, 'index.html should load ./styles.css');
  assert.ok(sharedCssIndex < gameCssIndex, '../shared/game-ui.css should load before ./styles.css');

  const content = readGameFile('content.js');
  assert.ok(content.includes('window.DeckContent') || content.includes('root.DeckContent'));
  assert.ok(content.includes('module.exports'));
  assert.ok(content.includes('CARDS'));
  assert.ok(content.includes('ENEMIES'));
  assert.ok(content.includes('RUN_LAYOUT'));
  assert.ok(content.includes('STARTER_DECK'));

  const engine = readGameFile('engine.js');
  assert.ok(engine.includes('window.DeckEngine') || engine.includes('root.DeckEngine'));
  assert.ok(engine.includes('module.exports'));
  const engineCodeLines = engine.split('\n').filter((line) => !line.trim().startsWith('//'));
  assert.ok(
    !engineCodeLines.some((line) => line.includes('Date.now(')),
    'engine.js should not call Date.now() directly outside of comments'
  );
  assert.ok(
    !engineCodeLines.some((line) => line.includes('Math.random(')),
    'engine.js should not call Math.random() directly outside of comments (RNG must be seeded)'
  );
  assert.ok(
    !engineCodeLines.some((line) => line.includes('document.') || line.includes('localStorage')),
    'engine.js should not touch the DOM or localStorage directly'
  );
  assert.ok(engine.includes('computeHitDamage'));
  assert.ok(engine.includes('createRngTracker'));
  assert.ok(engine.includes('serializeState'));
  assert.ok(engine.includes('deserializeState'));

  const game = readGameFile('game.js');
  assert.ok(game.includes('DeckEngine'));
  assert.ok(game.includes('localStorage'));
  assert.ok(game.includes('beforeunload'));

  const styles = readGameFile('styles.css');
  assert.ok(styles.includes('.hand-list'));
  assert.ok(styles.includes('.run-track'));
  assert.ok(styles.includes('@media (max-width: 480px)') || styles.includes('@media (min-width: 640px)'));

  const adminServer = readProjectFile('src/adminServer.js');
  assert.ok(adminServer.includes('/game/deck'), 'adminServer should route /game/deck');
  assert.ok(adminServer.includes('DECK_PUBLIC_DIR'), 'adminServer should define DECK_PUBLIC_DIR');
  assert.ok(adminServer.includes('resolveDeckAsset'), 'adminServer should define resolveDeckAsset');
  assert.ok(adminServer.includes('serveDeckAsset'), 'adminServer should define serveDeckAsset');
  assert.ok(
    adminServer.includes('filePath.startsWith(DECK_PUBLIC_DIR)'),
    'adminServer should guard against path traversal for deck assets'
  );

  const webGameDoc = readProjectFile('docs/deck-web-game.md');
  assert.ok(webGameDoc.includes('포인트 지급 없음'));
  assert.ok(webGameDoc.includes('/game/deck/'));

  console.log('deck static test passed');
}

main();

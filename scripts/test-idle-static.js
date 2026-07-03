const assert = require('assert');
const fs = require('fs');
const path = require('path');

const GAME_DIR = path.join(__dirname, '..', 'public', 'idle');
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
  assert.ok(html.includes('간식 공방 키우기'));
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
  assert.ok(content.includes('window.IdleContent') || content.includes('root.IdleContent'));
  assert.ok(content.includes('module.exports'));
  assert.ok(content.includes('STAGES'));
  assert.ok(content.includes('BUILDINGS'));
  assert.ok(content.includes('QUESTS'));
  assert.ok(content.includes('ACHIEVEMENTS'));

  const engine = readGameFile('engine.js');
  assert.ok(engine.includes('window.IdleEngine') || engine.includes('root.IdleEngine'));
  assert.ok(engine.includes('module.exports'));
  const engineCodeLines = engine.split('\n').filter((line) => !line.trim().startsWith('//'));
  assert.ok(
    !engineCodeLines.some((line) => line.includes('Date.now(')),
    'engine.js should not call Date.now() directly outside of comments'
  );
  assert.ok(engine.includes('formatNumber'));
  assert.ok(engine.includes('prestige'));
  assert.ok(engine.includes('computeOfflineEarnings'));

  const game = readGameFile('game.js');
  assert.ok(game.includes('IdleEngine'));
  assert.ok(game.includes('localStorage'));
  assert.ok(game.includes('visibilitychange'));
  assert.ok(game.includes('requestAnimationFrame'));

  const styles = readGameFile('styles.css');
  assert.ok(styles.includes('.tab-bar'));
  assert.ok(styles.includes('.stage-scene'));
  assert.ok(styles.includes('@media (max-width: 480px)') || styles.includes('@media (min-width: 640px)'));

  const adminServer = readProjectFile('src/adminServer.js');
  assert.ok(adminServer.includes('/game/idle'), 'adminServer should route /game/idle');
  assert.ok(adminServer.includes('IDLE_PUBLIC_DIR'), 'adminServer should define IDLE_PUBLIC_DIR');
  assert.ok(adminServer.includes('resolveIdleAsset'), 'adminServer should define resolveIdleAsset');
  assert.ok(adminServer.includes('serveIdleAsset'), 'adminServer should define serveIdleAsset');
  assert.ok(
    adminServer.includes('filePath.startsWith(IDLE_PUBLIC_DIR)'),
    'adminServer should guard against path traversal for idle assets'
  );

  const webGameDoc = readProjectFile('docs/idle-web-game.md');
  assert.ok(webGameDoc.includes('포인트 지급 없음'));
  assert.ok(webGameDoc.includes('/game/idle'));

  console.log('idle static test passed');
}

main();

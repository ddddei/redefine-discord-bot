const assert = require('assert');
const fs = require('fs');
const path = require('path');

const GAME_DIR = path.join(__dirname, '..', 'public', 'dungeonworld-survivors');
const REQUIRED_FILES = [
  'index.html',
  'styles.css',
  'content.js',
  'systems.js',
  'renderer.js',
  'game.js',
];

function readGameFile(fileName) {
  return fs.readFileSync(path.join(GAME_DIR, fileName), 'utf8');
}

function main() {
  REQUIRED_FILES.forEach((fileName) => {
    assert.ok(fs.existsSync(path.join(GAME_DIR, fileName)), `${fileName} should exist`);
  });

  const html = readGameFile('index.html');
  assert.ok(html.includes('검은 종 생존전'));
  assert.ok(html.includes('id="game-canvas"'));
  assert.ok(html.includes('./content.js'));
  assert.ok(html.includes('./systems.js'));
  assert.ok(html.includes('./renderer.js'));
  assert.ok(html.includes('./game.js'));
  assert.ok(!html.includes('포인트 지급'));

  const content = readGameFile('content.js');
  assert.ok(content.includes('마른 참나무'));
  assert.ok(content.includes('픽의 지름길'));
  assert.ok(content.includes('바루크의 창선'));
  assert.ok(content.includes('라메의 잎 표식'));
  assert.ok(content.includes('검은 종 파수꾼'));

  const systems = readGameFile('systems.js');
  assert.ok(systems.includes('const GAME_DURATION = 240;'));
  assert.ok(systems.includes('function fireProjectiles'));
  assert.ok(systems.includes('function consumeLevelUps'));
  assert.ok(systems.includes('function updateWave'));

  const styles = readGameFile('styles.css');
  assert.ok(styles.includes('--accent-primary: #76d0a4;'));
  assert.ok(styles.includes('aspect-ratio: 16 / 9;'));
  assert.ok(styles.includes('@media (max-width: 980px)'));

  console.log('dungeonworld survivors static test passed');
}

main();

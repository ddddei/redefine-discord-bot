const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const lineCount = (file) => read(file).trimEnd().split('\n').length;

function main() {
  assert.ok(lineCount('src/handlerRuntime.js') <= 600, 'handlerRuntime.js는 600줄 이하여야 합니다.');
  assert.ok(lineCount('src/interactionRouter.js') <= 350, 'interactionRouter.js는 350줄 이하여야 합니다.');

  const domainModules = [
    'src/activityParticipantHandlers.js', 'src/activityOperatorHandlers.js',
    'src/missionShopHubHandlers.js', 'src/missionShopHubUi.js',
    'src/operatorHubHandlers.js', 'src/participantHandlers.js', 'src/webgameOperatorHandlers.js',
  ];
  const forbiddenCreators = /\bcreate(?:Points|Dungeonworld|DungeonworldConfig|DmSafetyReview)Repository\s*\(/;
  domainModules.forEach((file) => assert.ok(!forbiddenCreators.test(read(file)), `${file}에서 repository를 직접 생성하면 안 됩니다.`));

  const graph = new Map(domainModules.map((file) => [file, []]));
  domainModules.forEach((file) => {
    const directory = path.dirname(file);
    for (const match of read(file).matchAll(/require\(['"](\.\.?\/[^'"]+)['"]\)/g)) {
      const target = path.normalize(path.join(directory, `${match[1]}.js`));
      if (graph.has(target)) graph.get(file).push(target);
    }
  });
  const visiting = new Set();
  const visited = new Set();
  function visit(file) {
    assert.ok(!visiting.has(file), `순환 require 감지: ${file}`);
    if (visited.has(file)) return;
    visiting.add(file);
    graph.get(file).forEach(visit);
    visiting.delete(file);
    visited.add(file);
  }
  domainModules.forEach(visit);

  const deployHash = crypto.createHash('sha256').update(read('src/deploy-commands.js')).digest('hex');
  assert.strictEqual(deployHash, '4440bc287782929314eff83ed5d7308e8fa9ee1b23b675a0dc4a7ebb7307db15');
  console.log('handler module 구조 계약 테스트 통과');
}

main();

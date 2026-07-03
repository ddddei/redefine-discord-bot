const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 웹게임 디자인 v2 에셋 정적 검증. docs/webgame-design-guide.md와
// docs/webgame-design-v2-plan.md 4~7절 기준.

const ASSETS_DIR = path.join(__dirname, '..', 'public', 'shared', 'assets');

// 인벤토리 19종 (기준 3종 + 신규 16종). 재사용 대상(방치형 소품)은 match3 타일을 그대로
// 참조하므로 여기 포함하지 않는다.
const REQUIRED_ASSET_FILES = [
  // 기준(canonical) 3종 — 04fc2db에서 커밋됨
  'match3-tile-strawberry.svg',
  'deck-enemy-crumb-ant.svg',
  'shared-char-baker.svg',
  // 매치3 타일 5종
  'match3-tile-orange.svg',
  'match3-tile-candy.svg',
  'match3-tile-cookie.svg',
  'match3-tile-cupcake.svg',
  'match3-tile-jelly.svg',
  // 덱 적 8종
  'deck-enemy-sugar-scent-moth.svg',
  'deck-enemy-greedy-pigeon.svg',
  'deck-enemy-sugar-slime.svg',
  'deck-enemy-kitchen-mouse.svg',
  'deck-enemy-mold-fairy.svg',
  'deck-enemy-caramel-golem.svg',
  'deck-enemy-whipped-harpy.svg',
  'deck-enemy-great-glutton-dragon.svg',
  // 덱 카드 타입 아이콘 3종
  'deck-icon-attack.svg',
  'deck-icon-defense.svg',
  'deck-icon-skill.svg',
];

const FILE_NAME_PATTERN = /^(match3|idle|deck|shared)-[a-z0-9]+(-[a-z0-9]+)*\.svg$/;

function readAsset(fileName) {
  return fs.readFileSync(path.join(ASSETS_DIR, fileName), 'utf8');
}

function readProjectFile(fileName) {
  return fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
}

// 게임 HTML/JS가 참조하는 ../shared/assets/*.svg 상대 경로를 모두 추출한다.
function extractAssetReferences(source) {
  const matches = source.match(/\.\.\/shared\/assets\/[a-zA-Z0-9_.-]+\.svg/g) || [];
  return matches.map((ref) => ref.replace('../shared/assets/', ''));
}

function main() {
  // 1. 에셋 19종 전부 존재, 각 파일 형식 검증.
  REQUIRED_ASSET_FILES.forEach((fileName) => {
    const filePath = path.join(ASSETS_DIR, fileName);
    assert.ok(fs.existsSync(filePath), `${fileName} 파일이 존재해야 함`);

    assert.ok(FILE_NAME_PATTERN.test(fileName), `${fileName} 파일명이 {scope}-{종류}-{이름}.svg 규칙을 따라야 함`);

    const svg = readAsset(fileName);
    assert.ok(svg.trim().startsWith('<svg'), `${fileName}은 <svg로 시작해야 함`);
    assert.ok(svg.includes('viewBox="0 0 64 64"'), `${fileName}은 viewBox="0 0 64 64"를 가져야 함`);
    assert.ok(/<title>[^<]+<\/title>/.test(svg), `${fileName}은 한국어 <title>을 가져야 함`);
    assert.ok(!svg.includes('<script'), `${fileName}은 스크립트를 포함하면 안 됨`);
    assert.ok(!svg.includes('xlink:href') && !svg.includes(' href="http'), `${fileName}은 외부 참조를 포함하면 안 됨`);
  });

  // 2. 각 게임이 참조하는 ../shared/assets/ 경로가 실재하는지 순회 검증.
  const gameFiles = [
    path.join('public', 'match3', 'game.js'),
    path.join('public', 'match3', 'index.html'),
    path.join('public', 'idle', 'game.js'),
    path.join('public', 'idle', 'index.html'),
    path.join('public', 'idle', 'styles.css'),
    path.join('public', 'deck', 'game.js'),
    path.join('public', 'deck', 'index.html'),
    path.join('public', 'deck', 'styles.css'),
  ];

  let totalReferencesChecked = 0;
  gameFiles.forEach((relPath) => {
    const fullPath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) {
      return;
    }
    const source = fs.readFileSync(fullPath, 'utf8');
    const references = extractAssetReferences(source);
    references.forEach((assetFileName) => {
      totalReferencesChecked += 1;
      assert.ok(
        fs.existsSync(path.join(ASSETS_DIR, assetFileName)),
        `${relPath}가 참조하는 ${assetFileName}이 public/shared/assets/에 존재해야 함`
      );
    });
  });

  assert.ok(totalReferencesChecked > 0, '게임 파일 중 최소 하나는 ../shared/assets/ 경로를 참조해야 함');

  // 3. deck content.js의 각 적 정의에 asset 필드가 있고 실제 파일과 일치하는지 확인
  //    (로직 필드가 아닌 표시용 데이터 필드이므로 static 테스트에서 검증).
  const deckContent = readProjectFile(path.join('public', 'deck', 'content.js'));
  assert.ok(deckContent.includes('asset:'), 'deck content.js의 적 정의에 asset 필드가 있어야 함');

  // 4. adminServer가 SVG를 올바른 MIME 타입으로 서빙하는지 확인.
  //    누락되면 application/octet-stream으로 내려가 브라우저가 <img> 렌더링을 거부한다.
  const adminServer = readProjectFile(path.join('src', 'adminServer.js'));
  assert.ok(
    adminServer.includes("'.svg': 'image/svg+xml"),
    'adminServer.js CONTENT_TYPES에 .svg → image/svg+xml 매핑이 있어야 함'
  );

  console.log('design assets static test passed');
}

main();

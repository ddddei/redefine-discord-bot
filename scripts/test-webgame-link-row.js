const assert = require('assert');

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function getLinkButtons(row) {
  return row.components.map((button) => button.toJSON());
}

function main() {
  const originalBaseUrl = process.env.WEBGAME_PUBLIC_BASE_URL;

  try {
    // 1. 미설정이면 링크 행이 생기지 않고, 허브는 기존 4행을 유지한다.
    delete process.env.WEBGAME_PUBLIC_BASE_URL;
    let rows = freshRequire('../src/minigameRows');
    assert.strictEqual(rows.createWebgameLinkRow(), null);
    assert.strictEqual(rows.createMinigameHubRows().length, 4);

    // 2. https가 아닌 값은 무효로 취급한다.
    process.env.WEBGAME_PUBLIC_BASE_URL = 'http://insecure.example.com';
    rows = freshRequire('../src/minigameRows');
    assert.strictEqual(rows.createWebgameLinkRow(), null);

    // 3. 설정하면 허브 5행 + 웹게임 링크 버튼이 생기고, 끝 슬래시는 정리된다.
    // 오늘의 단어(/game/word/)는 운영 결정 전이라 의도적으로 노출하지 않는다.
    process.env.WEBGAME_PUBLIC_BASE_URL = 'https://example.up.railway.app/';
    rows = freshRequire('../src/minigameRows');
    const linkRow = rows.createWebgameLinkRow();
    assert.ok(linkRow, '기준 URL이 설정되면 링크 행이 생성되어야 합니다.');
    const buttons = getLinkButtons(linkRow);
    assert.strictEqual(buttons.length, 4);
    assert.deepStrictEqual(
      buttons.map((button) => button.url),
      [
        'https://example.up.railway.app/game/match3/',
        'https://example.up.railway.app/game/deck/',
        'https://example.up.railway.app/game/idle/',
        'https://example.up.railway.app/game/dungeonworld-survivors/',
      ]
    );
    assert.strictEqual(rows.createMinigameHubRows().length, 5);

    // 4. 허브/채널 안내 payload에도 링크 안내가 함께 실린다.
    const payloads = freshRequire('../src/minigamePayloads');
    const hub = payloads.createMinigameHubPayload();
    assert.strictEqual(hub.components.length, 5);
    assert.match(hub.embeds[0].toJSON().description, /링크 버튼으로 바로 열 수 있어요/);
    const channelGuide = payloads.createMinigameChannelGuidePayload();
    assert.strictEqual(channelGuide.components.length, 1);
    assert.match(channelGuide.embeds[0].toJSON().description, /채널과 상관없이 아래 링크 버튼/);
  } finally {
    if (originalBaseUrl === undefined) delete process.env.WEBGAME_PUBLIC_BASE_URL;
    else process.env.WEBGAME_PUBLIC_BASE_URL = originalBaseUrl;
  }

  console.log('webgame link row test passed');
}

main();

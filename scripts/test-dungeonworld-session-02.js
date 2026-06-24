const assert = require('assert');

function main() {
  const {
    listSessions,
    listChoices,
    getSession,
    getChoice,
    playChoice,
  } = require('../src/dungeonworld');

  const sessions = listSessions();
  const session02 = sessions.find((session) => session.id === 'session_02_roots_below');
  assert.ok(session02, '2회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session02.title, '2회차. 뿌리 아래 고블린 길');
  assert.match(session02.intro, /픽/);
  assert.match(session02.closingNote, /돌로 만든/);

  const summary = getSession('session_02_roots_below');
  assert.strictEqual(summary.id, 'session_02_roots_below');

  const choices = listChoices('session_02_roots_below');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['trade', 'disarm', 'bypass'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_02_roots_below'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
    for (const tier of ['strong', 'mixed', 'weak']) {
      const outcomeText = choice.outcomes[tier];
      assert.ok(
        outcomeText.length >= 200,
        `${choice.id}/${tier} 결과 텍스트는 200자 이상이어야 합니다 (현재 ${outcomeText.length}자).`,
      );
      assert.match(
        outcomeText,
        /"[^"]+"/,
        `${choice.id}/${tier} 결과 텍스트에는 NPC 대사(인용부호)가 포함되어야 합니다.`,
      );
    }
  }

  assert.strictEqual(getChoice('not_a_real_choice', 'session_02_roots_below'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_02_roots_below'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('trade', 'session_02_roots_below');
  assert.strictEqual(result.sessionId, 'session_02_roots_below');
  assert.strictEqual(result.sessionTitle, '2회차. 뿌리 아래 고블린 길');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 02 content test passed');
}

main();

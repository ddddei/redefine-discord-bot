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
  const session03 = sessions.find((session) => session.id === 'session_03_locked_basin');
  assert.ok(session03, '3회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session03.title, '3회차. 무너진 신전의 잠긴 물그릇');
  assert.match(session03.intro, /픽/);
  assert.match(session03.closingNote, /오크/);

  const summary = getSession('session_03_locked_basin');
  assert.strictEqual(summary.id, 'session_03_locked_basin');

  const choices = listChoices('session_03_locked_basin');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['block', 'decode', 'bargain'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_03_locked_basin'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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

  assert.strictEqual(getChoice('not_a_real_choice', 'session_03_locked_basin'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_03_locked_basin'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('block', 'session_03_locked_basin');
  assert.strictEqual(result.sessionId, 'session_03_locked_basin');
  assert.strictEqual(result.sessionTitle, '3회차. 무너진 신전의 잠긴 물그릇');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 03 content test passed');
}

main();

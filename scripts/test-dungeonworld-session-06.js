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
  const session06 = sessions.find((session) => session.id === 'session_06_memory_forest');
  assert.ok(session06, '6회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session06.title, '6회차. 기억의 숲과 되감긴 길');
  assert.match(session06.intro, /라메/);
  assert.match(session06.closingNote, /검은 성문/);

  const summary = getSession('session_06_memory_forest');
  assert.strictEqual(summary.id, 'session_06_memory_forest');

  const choices = listChoices('session_06_memory_forest');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['chase', 'listen', 'split'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_06_memory_forest'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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

  assert.strictEqual(getChoice('not_a_real_choice', 'session_06_memory_forest'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_06_memory_forest'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('chase', 'session_06_memory_forest');
  assert.strictEqual(result.sessionId, 'session_06_memory_forest');
  assert.strictEqual(result.sessionTitle, '6회차. 기억의 숲과 되감긴 길');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 06 content test passed');
}

main();

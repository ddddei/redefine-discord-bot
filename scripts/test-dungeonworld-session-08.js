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
  const session08 = sessions.find((session) => session.id === 'session_08_three_doors');
  assert.ok(session08, '8회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session08.title, '8회차. 세 개의 문과 마지막 시험');
  assert.match(session08.intro, /라메/);
  assert.match(session08.closingNote, /맹세/);

  const summary = getSession('session_08_three_doors');
  assert.strictEqual(summary.id, 'session_08_three_doors');

  const choices = listChoices('session_08_three_doors');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['name', 'loop', 'vow'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_08_three_doors'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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

  assert.strictEqual(getChoice('not_a_real_choice', 'session_08_three_doors'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_08_three_doors'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('name', 'session_08_three_doors');
  assert.strictEqual(result.sessionId, 'session_08_three_doors');
  assert.strictEqual(result.sessionTitle, '8회차. 세 개의 문과 마지막 시험');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 08 content test passed');
}

main();

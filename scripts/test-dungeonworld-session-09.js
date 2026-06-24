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
  const session09 = sessions.find((session) => session.id === 'session_09_final_gate');
  assert.ok(session09, '9회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session09.title, '9회차. 검은탑의 마지막 문');
  assert.match(session09.intro, /픽/);
  assert.match(session09.closingNote, /후일담/);

  const summary = getSession('session_09_final_gate');
  assert.strictEqual(summary.id, 'session_09_final_gate');

  const choices = listChoices('session_09_final_gate');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['strike', 'call', 'unite'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_09_final_gate'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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

  assert.strictEqual(getChoice('not_a_real_choice', 'session_09_final_gate'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_09_final_gate'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('strike', 'session_09_final_gate');
  assert.strictEqual(result.sessionId, 'session_09_final_gate');
  assert.strictEqual(result.sessionTitle, '9회차. 검은탑의 마지막 문');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 09 content test passed');
}

main();

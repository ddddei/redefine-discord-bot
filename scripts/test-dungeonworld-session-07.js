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
  const session07 = sessions.find((session) => session.id === 'session_07_black_gate');
  assert.ok(session07, '7회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session07.title, '7회차. 검은 성문과 탑 하층');
  assert.match(session07.intro, /헤르/);
  assert.match(session07.closingNote, /문/);

  const summary = getSession('session_07_black_gate');
  assert.strictEqual(summary.id, 'session_07_black_gate');

  const choices = listChoices('session_07_black_gate');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['breach', 'riddle', 'rewind'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_07_black_gate'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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

  assert.strictEqual(getChoice('not_a_real_choice', 'session_07_black_gate'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_07_black_gate'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('breach', 'session_07_black_gate');
  assert.strictEqual(result.sessionId, 'session_07_black_gate');
  assert.strictEqual(result.sessionTitle, '7회차. 검은 성문과 탑 하층');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 07 content test passed');
}

main();

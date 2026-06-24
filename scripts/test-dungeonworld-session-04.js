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
  const session04 = sessions.find((session) => session.id === 'session_04_orc_bridge');
  assert.ok(session04, '4회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session04.title, '4회차. 오크가 지키는 다리');
  assert.match(session04.intro, /바루크/);
  assert.match(session04.closingNote, /종루/);

  const summary = getSession('session_04_orc_bridge');
  assert.strictEqual(summary.id, 'session_04_orc_bridge');

  const choices = listChoices('session_04_orc_bridge');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['duel', 'negotiate', 'bypass'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_04_orc_bridge'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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

  assert.strictEqual(getChoice('not_a_real_choice', 'session_04_orc_bridge'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_04_orc_bridge'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('duel', 'session_04_orc_bridge');
  assert.strictEqual(result.sessionId, 'session_04_orc_bridge');
  assert.strictEqual(result.sessionTitle, '4회차. 오크가 지키는 다리');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 04 content test passed');
}

main();

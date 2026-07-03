const assert = require('assert');

const {
  listSessions,
  listChoices,
  getSession,
  getChoice,
  playChoice,
} = require('../src/dungeonworld');

function main() {
  const sessions = listSessions();
  const session12 = sessions.find((session) => session.id === 'session_12_new_map');
  assert.ok(session12, '12회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session12.title, '12회차. 새 지도의 첫 줄');
  assert.match(session12.intro, /렌/);
  assert.match(session12.closingNote, /새 지도/);

  const summary = getSession('session_12_new_map');
  assert.strictEqual(summary.id, 'session_12_new_map');

  const choices = listChoices('session_12_new_map');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['firstStep', 'compare', 'promise'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_12_new_map'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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

  assert.strictEqual(getChoice('not_a_real_choice', 'session_12_new_map'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_12_new_map'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('firstStep', 'session_12_new_map');
  assert.strictEqual(result.sessionId, 'session_12_new_map');
  assert.strictEqual(result.sessionTitle, '12회차. 새 지도의 첫 줄');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 12 content test passed');
}

main();

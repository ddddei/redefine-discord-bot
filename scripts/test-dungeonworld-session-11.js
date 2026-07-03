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
  const session11 = sessions.find((session) => session.id === 'session_11_piks_debt');
  assert.ok(session11, '11회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session11.title, '11회차. 픽의 갚음');
  assert.match(session11.intro, /픽/);
  assert.match(session11.closingNote, /렌/);

  const summary = getSession('session_11_piks_debt');
  assert.strictEqual(summary.id, 'session_11_piks_debt');

  const choices = listChoices('session_11_piks_debt');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['path', 'listen', 'terms'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_11_piks_debt'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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

  assert.strictEqual(getChoice('not_a_real_choice', 'session_11_piks_debt'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_11_piks_debt'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('path', 'session_11_piks_debt');
  assert.strictEqual(result.sessionId, 'session_11_piks_debt');
  assert.strictEqual(result.sessionTitle, '11회차. 픽의 갚음');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 11 content test passed');
}

main();

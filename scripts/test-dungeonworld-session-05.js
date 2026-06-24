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
  const session05 = sessions.find((session) => session.id === 'session_05_broken_belfry');
  assert.ok(session05, '5회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session05.title, '5회차. 무너진 종루의 문지기');
  assert.match(session05.intro, /세린/);
  assert.match(session05.closingNote, /숲/);

  const summary = getSession('session_05_broken_belfry');
  assert.strictEqual(summary.id, 'session_05_broken_belfry');

  const choices = listChoices('session_05_broken_belfry');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['cut', 'talk', 'breach'],
  );

  for (const choice of choices) {
    assert.ok(getChoice(choice.id, 'session_05_broken_belfry'), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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

  assert.strictEqual(getChoice('not_a_real_choice', 'session_05_broken_belfry'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_05_broken_belfry'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('cut', 'session_05_broken_belfry');
  assert.strictEqual(result.sessionId, 'session_05_broken_belfry');
  assert.strictEqual(result.sessionTitle, '5회차. 무너진 종루의 문지기');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 05 content test passed');
}

main();

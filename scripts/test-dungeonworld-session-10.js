const assert = require('assert');

function assertContentQuality(choices, sessionId) {
  for (const choice of choices) {
    assert.ok(getChoice(choice.id, sessionId), `${choice.id} 선택지를 조회할 수 있어야 합니다.`);
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
}

const {
  listSessions,
  listChoices,
  getSession,
  getChoice,
  playChoice,
} = require('../src/dungeonworld');

function main() {
  const sessions = listSessions();
  const session10 = sessions.find((session) => session.id === 'session_10_quiet_morning');
  assert.ok(session10, '10회차가 SESSIONS에 등록되어 있어야 합니다.');
  assert.strictEqual(session10.title, '10회차. 종이 멎은 아침');
  assert.match(session10.intro, /마라/);
  assert.match(session10.closingNote, /픽/);

  const defaultSummary = getSession('session_10_quiet_morning');
  const strongSummary = getSession('session_10_quiet_morning', { previousTier: 'strong' });
  const mixedSummary = getSession('session_10_quiet_morning', { previousTier: 'mixed' });
  const weakSummary = getSession('session_10_quiet_morning', { previousTier: 'weak' });
  assert.strictEqual(defaultSummary.id, 'session_10_quiet_morning');
  assert.match(defaultSummary.intro, /검은 종/);
  assert.notStrictEqual(strongSummary.intro, defaultSummary.intro);
  assert.notStrictEqual(mixedSummary.intro, defaultSummary.intro);
  assert.notStrictEqual(weakSummary.intro, defaultSummary.intro);
  assert.notStrictEqual(strongSummary.intro, mixedSummary.intro);
  assert.notStrictEqual(strongSummary.intro, weakSummary.intro);
  assert.notStrictEqual(mixedSummary.intro, weakSummary.intro);

  const choices = listChoices('session_10_quiet_morning');
  assert.deepStrictEqual(
    choices.map((choice) => choice.id),
    ['clear', 'trace', 'settle'],
  );
  assertContentQuality(choices, 'session_10_quiet_morning');

  assert.strictEqual(getChoice('not_a_real_choice', 'session_10_quiet_morning'), null);
  assert.throws(
    () => playChoice('not_a_real_choice', 'session_10_quiet_morning'),
    /지원하지 않는 선택지/,
  );

  const result = playChoice('clear', 'session_10_quiet_morning');
  assert.strictEqual(result.sessionId, 'session_10_quiet_morning');
  assert.strictEqual(result.sessionTitle, '10회차. 종이 멎은 아침');
  assert.ok(['strong', 'mixed', 'weak'].includes(result.tier));
  assert.ok(result.outcomeText.length >= 200);

  console.log('dungeonworld session 10 content test passed');
}

main();

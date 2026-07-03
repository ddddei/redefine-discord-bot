const assert = require('assert');
const {
  EXPLORE_PLACES,
  EXPLORE_REWARD_MESSAGES,
  INITIAL_QUIZZES,
  MEMORY_PATTERNS,
} = require('../src/minigameData');
const {
  createExploreResult,
  createInitialDetail,
  createMemoryDetail,
  createRogueResult,
  getExploreRewardsByPlace,
  getRogueFavoredChoices,
} = require('../src/minigameResults');

const SAMPLE_DATES = Array.from({ length: 30 }, (unused, index) => {
  return `2026-07-${String(index + 1).padStart(2, '0')}`;
});
const SAMPLE_USER = 'minigame_results_test_user';

function main() {
  // 1. 이모지 기억력 패턴: 12개 이상, 각 3개 이모지, 패턴 간 중복 없음
  assert.ok(MEMORY_PATTERNS.length >= 12, `MEMORY_PATTERNS는 12개 이상이어야 합니다: ${MEMORY_PATTERNS.length}`);
  const patternKeys = MEMORY_PATTERNS.map((pattern) => pattern.join(' '));
  assert.strictEqual(new Set(patternKeys).size, MEMORY_PATTERNS.length, '패턴 간 중복이 있습니다.');
  for (const pattern of MEMORY_PATTERNS) {
    assert.strictEqual(pattern.length, 3, `패턴은 이모지 3개여야 합니다: ${pattern.join(' ')}`);
    assert.strictEqual(new Set(pattern).size, 3, `패턴 안에 중복 이모지가 있습니다: ${pattern.join(' ')}`);
  }

  // 2. 초성 퀴즈: 12개 이상, 3지선다, 정답 포함, 보기 중복 없음
  assert.ok(INITIAL_QUIZZES.length >= 12, `INITIAL_QUIZZES는 12개 이상이어야 합니다: ${INITIAL_QUIZZES.length}`);
  const prompts = INITIAL_QUIZZES.map((quiz) => quiz.prompt);
  assert.strictEqual(new Set(prompts).size, INITIAL_QUIZZES.length, '초성 문제가 중복됩니다.');
  for (const quiz of INITIAL_QUIZZES) {
    assert.strictEqual(quiz.choices.length, 3, `보기는 3개여야 합니다: ${quiz.prompt}`);
    assert.ok(quiz.choices.includes(quiz.answer), `정답이 보기에 없습니다: ${quiz.prompt}`);
    assert.strictEqual(new Set(quiz.choices).size, 3, `보기가 중복됩니다: ${quiz.prompt}`);
  }

  // 3. 탐험 보상 메시지: 0/3/5 등급별로 존재
  for (const reward of [0, 3, 5]) {
    assert.ok(
      Array.isArray(EXPLORE_REWARD_MESSAGES[reward]) && EXPLORE_REWARD_MESSAGES[reward].length > 0,
      `EXPLORE_REWARD_MESSAGES[${reward}]가 비어 있습니다.`
    );
  }

  // 4. 결정성: 같은 입력이면 항상 같은 결과
  const exploreInput = { userId: SAMPLE_USER, dateString: SAMPLE_DATES[0], placeKey: 'library' };
  assert.deepStrictEqual(createExploreResult(exploreInput), createExploreResult(exploreInput));
  const rogueInput = {
    userId: SAMPLE_USER,
    dateString: SAMPLE_DATES[0],
    pathKey: 'market',
    itemKey: 'map',
    exitKey: 'talk',
  };
  assert.deepStrictEqual(createRogueResult(rogueInput), createRogueResult(rogueInput));

  // 5. 탐험: 하루 안에서 세 장소 보상은 {0, 3, 5} 정확히 한 번씩, 장소별 보상은 날마다 변동
  const libraryRewards = new Set();
  for (const dateString of SAMPLE_DATES) {
    const rewardsByPlace = getExploreRewardsByPlace({ userId: SAMPLE_USER, dateString });
    const rewards = Object.values(rewardsByPlace).sort((left, right) => left - right);
    assert.deepStrictEqual(rewards, [0, 3, 5], `보상 배정이 {0,3,5} 순열이 아닙니다: ${dateString}`);
    libraryRewards.add(rewardsByPlace.library);

    for (const placeKey of Object.keys(EXPLORE_PLACES)) {
      const result = createExploreResult({ userId: SAMPLE_USER, dateString, placeKey });
      assert.strictEqual(result.rewardPoints, rewardsByPlace[placeKey]);
      assert.ok(result.lines.some((line) => line.includes(`선택한 장소: ${EXPLORE_PLACES[placeKey].label}`)));
      assert.ok(result.lines.some((line) => line.includes(`탐험 결과: ${result.rewardPoints}P`)));
    }
  }
  assert.ok(libraryRewards.size >= 2, '도서관 보상이 날짜에 따라 변하지 않습니다. 고정 정답이 남아 있습니다.');

  // 6. 세 칸 탐험: 결과는 {3, 5, 10}, 유리 조합은 날마다 변동, 유리 조합 완주는 10P
  const favoredCombos = new Set();
  for (const dateString of SAMPLE_DATES) {
    const { favoredItem, favoredExit } = getRogueFavoredChoices({
      userId: SAMPLE_USER,
      dateString,
      pathKey: 'market',
    });
    favoredCombos.add(`${favoredItem}:${favoredExit}`);

    const bestResult = createRogueResult({
      userId: SAMPLE_USER,
      dateString,
      pathKey: 'market',
      itemKey: favoredItem,
      exitKey: favoredExit,
    });
    assert.strictEqual(bestResult.rewardPoints, 10, `유리 조합 완주가 10P가 아닙니다: ${dateString}`);

    for (const itemKey of ['lantern', 'map', 'snack']) {
      for (const exitKey of ['signal', 'talk', 'rest']) {
        const result = createRogueResult({
          userId: SAMPLE_USER,
          dateString,
          pathKey: 'market',
          itemKey,
          exitKey,
        });
        assert.ok([3, 5, 10].includes(result.rewardPoints), `보상이 {3,5,10} 밖입니다: ${result.rewardPoints}`);
      }
    }
  }
  assert.ok(favoredCombos.size >= 2, '세 칸 탐험 유리 조합이 날짜에 따라 변하지 않습니다. 고정 정답이 남아 있습니다.');

  // 7. 잘못된 키는 기존처럼 기본값으로 처리
  const fallbackResult = createRogueResult({
    userId: SAMPLE_USER,
    dateString: SAMPLE_DATES[0],
    pathKey: 'unknown',
    itemKey: 'unknown',
    exitKey: 'unknown',
  });
  assert.ok([3, 5, 10].includes(fallbackResult.rewardPoints));
  assert.ok(fallbackResult.lines.some((line) => line.includes('탐험지: 새벽 시장')));

  // 8. 기억력/초성 문항 회전: 사용자·날짜 샘플에서 기존 3종보다 많은 문항이 실제로 등장
  const seenPatterns = new Set();
  const seenPrompts = new Set();
  for (const dateString of SAMPLE_DATES) {
    for (const userId of ['user_a', 'user_b', 'user_c']) {
      seenPatterns.add(createMemoryDetail({ userId, dateString }).pattern.join(' '));
      seenPrompts.add(createInitialDetail({ userId, dateString }).prompt);
    }
  }
  assert.ok(seenPatterns.size > 3, `기억력 패턴이 3종 이하만 등장합니다: ${seenPatterns.size}`);
  assert.ok(seenPrompts.size > 3, `초성 문제가 3종 이하만 등장합니다: ${seenPrompts.size}`);

  console.log('minigame results smoke test passed');
}

main();

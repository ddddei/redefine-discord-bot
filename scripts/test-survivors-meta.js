const assert = require('assert');
const path = require('path');

const Meta = require(path.join('..', 'public', 'dungeonworld-survivors', 'meta.js'));

function testUnlockAndAchievementCatalogSizes() {
  assert.strictEqual(Meta.UNLOCKS.length, 12, '해금은 12종이어야 합니다');
  assert.strictEqual(Meta.ACHIEVEMENTS.length, 12, '도전 과제는 12종이어야 합니다');
  Meta.UNLOCKS.forEach((unlock) => {
    assert.ok(unlock.id, '해금 id가 있어야 합니다');
    assert.ok(unlock.title, `${unlock.id} title이 있어야 합니다`);
    assert.ok(Number.isInteger(unlock.price) && unlock.price > 0, `${unlock.id} price는 양의 정수여야 합니다`);
    assert.ok(unlock.effect && unlock.effect.type, `${unlock.id} effect가 있어야 합니다`);
  });
  Meta.ACHIEVEMENTS.forEach((achievement) => {
    assert.ok(achievement.id, '도전 과제 id가 있어야 합니다');
    assert.ok(achievement.title);
    assert.ok(Number.isInteger(achievement.reward) && achievement.reward > 0);
    assert.strictEqual(typeof achievement.condition, 'function');
  });
  // 시작 무기 Lv.2 예외(계획서 5절)만 난이도 완화가 아니라 시작 강화임을 명시해야 한다.
  const smithyFavor = Meta.UNLOCKS.find((entry) => entry.id === 'smithyFavor');
  assert.ok(smithyFavor);
  assert.strictEqual(smithyFavor.isDifficultyException, true);
  Meta.UNLOCKS.filter((entry) => entry.id !== 'smithyFavor').forEach((entry) => {
    assert.notStrictEqual(entry.isDifficultyException, true, `${entry.id}는 난이도 완화 방향이어야 합니다(예외 아님)`);
  });
}

function testBellEssenceFormula() {
  // floor(생존초/10) + floor(처치/5) + (보스 격파 ? 500 : 0)
  assert.strictEqual(Meta.calculateBellEssenceReward({ survivalTime: 95, kills: 12, won: false }), 9 + 2 + 0);
  assert.strictEqual(Meta.calculateBellEssenceReward({ survivalTime: 600, kills: 120, won: true }), 60 + 24 + 500);
  assert.strictEqual(Meta.calculateBellEssenceReward({ survivalTime: 0, kills: 0, won: false }), 0);
  assert.strictEqual(Meta.calculateBellEssenceReward({}), 0, '값이 없어도 예외 없이 0을 반환해야 합니다');
}

function testStorageSchemaTolerantLoad() {
  assert.deepStrictEqual(Meta.parseMeta(null), Meta.getDefaultMeta());
  assert.deepStrictEqual(Meta.parseMeta(''), Meta.getDefaultMeta());
  assert.deepStrictEqual(Meta.parseMeta('{ not valid json'), Meta.getDefaultMeta());
  assert.deepStrictEqual(Meta.parseMeta('null'), Meta.getDefaultMeta());
  assert.deepStrictEqual(Meta.parseMeta('42'), Meta.getDefaultMeta());
  assert.deepStrictEqual(Meta.parseMeta('"a string"'), Meta.getDefaultMeta());

  // 알 수 없는 unlockId/achievementId, 음수, 손상된 타입이 섞여도 정규화되어야 한다.
  const messy = JSON.stringify({
    bellEssence: -50,
    totalBellEssenceEarned: 'not-a-number',
    unlockedIds: ['innBreakfast1', 'unknown-id', 'innBreakfast1'],
    achievementIds: ['firstBossKill', 'unknown-achievement'],
    runsCompleted: -3,
  });
  const normalized = Meta.parseMeta(messy);
  assert.strictEqual(normalized.bellEssence, 0);
  assert.strictEqual(normalized.totalBellEssenceEarned, 0);
  assert.deepStrictEqual(normalized.unlockedIds, ['innBreakfast1']);
  assert.deepStrictEqual(normalized.achievementIds, ['firstBossKill']);
  assert.strictEqual(normalized.runsCompleted, 0);

  // 왕복 직렬화 확인
  const meta = Meta.getDefaultMeta();
  meta.bellEssence = 1234;
  meta.unlockedIds = ['guideBoots1'];
  const roundTrip = Meta.parseMeta(Meta.serializeMeta(meta));
  assert.strictEqual(roundTrip.bellEssence, 1234);
  assert.deepStrictEqual(roundTrip.unlockedIds, ['guideBoots1']);
}

function testUnlockPurchaseFlowAndTierGating() {
  let meta = Meta.getDefaultMeta();
  // 잔액 부족
  let check = Meta.canPurchaseUnlock(meta, 'innBreakfast1');
  assert.strictEqual(check.ok, false);
  assert.strictEqual(check.reason, 'INSUFFICIENT_ESSENCE');

  meta.bellEssence = 300;
  const purchase1 = Meta.purchaseUnlock(meta, 'innBreakfast1');
  assert.strictEqual(purchase1.ok, true);
  assert.strictEqual(purchase1.meta.bellEssence, 0);
  assert.deepStrictEqual(purchase1.meta.unlockedIds, ['innBreakfast1']);

  // 2단계 해금은 1단계 없이 불가(tier gating)
  let meta2 = Meta.getDefaultMeta();
  meta2.bellEssence = 900;
  const tierSkip = Meta.canPurchaseUnlock(meta2, 'innBreakfast2');
  assert.strictEqual(tierSkip.ok, false);
  assert.strictEqual(tierSkip.reason, 'PREVIOUS_TIER_REQUIRED');

  // 1단계 해금 후 2단계 가능
  meta2 = Meta.purchaseUnlock(meta2, 'innBreakfast1').meta;
  meta2.bellEssence += 900;
  const tierOk = Meta.canPurchaseUnlock(meta2, 'innBreakfast2');
  assert.strictEqual(tierOk.ok, true);

  // 이미 해금된 항목 재구매 불가
  const already = Meta.canPurchaseUnlock(purchase1.meta, 'innBreakfast1');
  assert.strictEqual(already.ok, false);
  assert.strictEqual(already.reason, 'ALREADY_UNLOCKED');

  // 알 수 없는 unlockId
  const unknown = Meta.canPurchaseUnlock(meta, 'not-a-real-unlock');
  assert.strictEqual(unknown.ok, false);
  assert.strictEqual(unknown.reason, 'UNKNOWN_UNLOCK');

  // 순수 함수 - 원본 불변
  const before = Meta.getDefaultMeta();
  before.bellEssence = 300;
  const frozenCopy = JSON.parse(JSON.stringify(before));
  Meta.purchaseUnlock(before, 'innBreakfast1');
  assert.deepStrictEqual(before, frozenCopy, 'purchaseUnlock은 원본 meta를 변경하면 안 됩니다');
}

function testAchievementEvaluationAndRunReward() {
  const meta = Meta.getDefaultMeta();
  const runSummary = {
    survivalTime: 320,
    kills: 40,
    won: true,
    playbookId: 'fighter',
    classUltimate: { ready: true },
    longestNoHitStreak: 200,
    evolvedWeaponCount: 2,
    eliteKills: 3,
    chestsOpened: 2,
    levelAtBoss: 9,
  };
  const result = Meta.applyRunResult(meta, runSummary);
  assert.ok(result.earned > 0);
  const expectedAchievements = ['ultimateFighter', 'noHit3Min', 'twoEvolutionsAtOnce', 'firstBossKill', 'firstElite', 'firstChest', 'levelEightBeforeBoss'];
  expectedAchievements.forEach((id) => {
    assert.ok(result.newlyAchieved.some((entry) => entry.id === id), `${id} 달성이 감지되어야 합니다`);
  });
  assert.ok(result.meta.achievementIds.includes('firstBossKill'));
  assert.strictEqual(result.meta.runsCompleted, 1);
  assert.strictEqual(result.meta.bellEssence, result.totalEarned);

  // 같은 도전 과제를 두 번째 런에서 다시 달성해도 중복 보상 없음
  const secondRun = Meta.applyRunResult(result.meta, runSummary);
  assert.strictEqual(secondRun.newlyAchieved.length, 0, '이미 달성한 과제는 다시 보상하지 않아야 합니다');
  assert.strictEqual(secondRun.achievementReward, 0);
}

function testUnlockedPlayerAdjustmentsFavorDifficultyRelief() {
  let meta = Meta.getDefaultMeta();
  meta.unlockedIds = ['innBreakfast1', 'guideBoots1', 'bigPouch1'];
  const adjustments = Meta.getUnlockedPlayerAdjustments(meta);
  assert.strictEqual(adjustments.startHealthBonus, 10);
  assert.strictEqual(adjustments.moveSpeedPercent, 0.04);
  assert.strictEqual(adjustments.magnetPercent, 0.2);
  assert.strictEqual(adjustments.startWeaponLevel, 1, '대장간 신세 미해금 시 기본 Lv.1이어야 합니다');

  meta.unlockedIds = meta.unlockedIds.concat(['smithyFavor']);
  const withSmithy = Meta.getUnlockedPlayerAdjustments(meta);
  assert.strictEqual(withSmithy.startWeaponLevel, 2, '대장간 신세 해금 시 시작 무기 Lv.2여야 합니다(예외 명시)');
}

function testNextGoalPreviewForResultScreen() {
  const meta = Meta.getDefaultMeta();
  const preview = Meta.getNextGoalPreview(meta);
  assert.ok(typeof preview === 'string' && preview.length > 0);
  assert.ok(preview.includes('다음 목표'));
}

function main() {
  testUnlockAndAchievementCatalogSizes();
  testBellEssenceFormula();
  testStorageSchemaTolerantLoad();
  testUnlockPurchaseFlowAndTierGating();
  testAchievementEvaluationAndRunReward();
  testUnlockedPlayerAdjustmentsFavorDifficultyRelief();
  testNextGoalPreviewForResultScreen();
  console.log('dungeonworld survivors meta test passed');
}

main();

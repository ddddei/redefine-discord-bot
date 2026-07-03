const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CONTENT_FILE = path.join(__dirname, '..', 'public', 'idle', 'content.js');
const ENGINE_FILE = path.join(__dirname, '..', 'public', 'idle', 'engine.js');

function loadEngine() {
  const context = { window: {}, module: undefined, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(CONTENT_FILE, 'utf8'), context, { filename: 'content.js' });
  vm.runInContext(fs.readFileSync(ENGINE_FILE, 'utf8'), context, { filename: 'engine.js' });
  return { Content: context.window.IdleContent, Engine: context.window.IdleEngine };
}

function findBuilding(Content, key) {
  return Content.BUILDINGS.find((building) => building.key === key);
}

function testCostCurve() {
  const { Content, Engine } = loadEngine();
  Content.BUILDINGS.forEach((building) => {
    [0, 1, 10].forEach((owned) => {
      const expected = Math.floor(building.baseCost * Math.pow(Content.BUILDING_COST_GROWTH, owned));
      const state = Engine.createNewState();
      state.buildings[building.key].owned = owned;
      assert.strictEqual(
        Engine.getBuildingCost(state, building.key),
        expected,
        `${building.key} cost at ${owned} owned should match formula`
      );
    });
  });
}

function testProductionSum() {
  const { Content, Engine } = loadEngine();
  const state = Engine.createNewState();
  state.buildings.strawberry.owned = 3;
  state.buildings.orange.owned = 2;

  const strawberry = findBuilding(Content, 'strawberry');
  const orange = findBuilding(Content, 'orange');
  const expectedBase = 3 * strawberry.ratePerUnit + 2 * orange.ratePerUnit;

  assert.strictEqual(Engine.baseProductionPerSecond(state), expectedBase);
  assert.strictEqual(Engine.getProductionPerSecond(state), expectedBase);

  // ×2 업그레이드 적용
  state.upgrades['sweet-recipe'] = true;
  assert.strictEqual(Engine.getProductionPerSecond(state), expectedBase * 2);

  // 레시피 보너스(+10%/개)도 곱연산으로 반영
  state.prestigePoints = 3;
  assert.strictEqual(Engine.getProductionPerSecond(state), expectedBase * 2 * 1.3);
}

function testClickAmount() {
  const { Engine } = loadEngine();
  const state = Engine.createNewState();
  assert.strictEqual(Engine.getClickAmount(state), 1);

  state.upgrades['sturdy-fingers'] = true;
  assert.strictEqual(Engine.getClickAmount(state), 5);

  const state2 = Engine.createNewState();
  state2.upgrades['snack-courier'] = true;
  state2.buildings.strawberry.owned = 10; // 초당 5 생산 (0.5 × 10)
  assert.strictEqual(Engine.getClickAmount(state2), 1 + 5 * 0.01);
}

function testBuyBuildingAndUpgradeStage() {
  const { Engine } = loadEngine();
  const state = Engine.createNewState();

  // 잔액 부족 시 거부, 상태 불변
  const before = JSON.stringify(state);
  const rejected = Engine.buyBuilding(state, 'strawberry');
  assert.strictEqual(rejected.success, false);
  assert.strictEqual(rejected.reason, 'INSUFFICIENT_FUNDS');
  assert.strictEqual(JSON.stringify(state), before);

  state.snacks = 100;
  const bought = Engine.buyBuilding(state, 'strawberry');
  assert.strictEqual(bought.success, true);
  assert.strictEqual(state.buildings.strawberry.owned, 1);
  assert.strictEqual(state.snacks, 100 - 15);

  // 무대 2 시설(오렌지)은 잠겨 있어야 함
  assert.strictEqual(Engine.isBuildingUnlocked(state, 'orange'), false);
  const lockedResult = Engine.buyBuilding(state, 'orange');
  assert.strictEqual(lockedResult.success, false);
  assert.strictEqual(lockedResult.reason, 'LOCKED');

  // 승급 후 해금 반영
  state.snacks = 0;
  const stageRejected = Engine.upgradeStage(state);
  assert.strictEqual(stageRejected.success, false);
  state.snacks = 2000;
  const stageResult = Engine.upgradeStage(state);
  assert.strictEqual(stageResult.success, true);
  assert.strictEqual(state.stageId, 2);
  assert.strictEqual(Engine.isBuildingUnlocked(state, 'orange'), true);
}

function testDelivery() {
  const { Engine } = loadEngine();
  const state = Engine.createNewState();
  state.stageId = 2;
  state.buildings.strawberry.owned = 10; // 초당 5 생산

  const now = 1000000;
  const started = Engine.startDelivery(state, 'neighborhood-delivery', now);
  assert.strictEqual(started.success, true);

  // 소요 시간 전에는 미완료
  assert.strictEqual(Engine.isDeliveryComplete(state, now + 1000), false);
  const tooEarly = Engine.collectDelivery(state, now + 1000);
  assert.strictEqual(tooEarly.success, false);
  assert.strictEqual(tooEarly.reason, 'NOT_READY');

  // 동시 1건 제한
  const secondStart = Engine.startDelivery(state, 'neighborhood-delivery', now + 1000);
  assert.strictEqual(secondStart.success, false);
  assert.strictEqual(secondStart.reason, 'DELIVERY_IN_PROGRESS');

  // 시계 역행 시 완료 처리되지 않음
  assert.strictEqual(Engine.isDeliveryComplete(state, now - 5000), false);

  // 경과 후 완료, 보상은 수령 시점 생산량 기준
  const finishTime = now + 5 * 60 * 1000;
  assert.strictEqual(Engine.isDeliveryComplete(state, finishTime), true);
  const beforeSnacks = state.snacks;
  const collected = Engine.collectDelivery(state, finishTime);
  assert.strictEqual(collected.success, true);
  const expectedReward = 5 * 900; // 초당 생산량 5 × rewardSeconds 900
  assert.strictEqual(collected.reward, expectedReward);
  assert.strictEqual(state.snacks, beforeSnacks + expectedReward);
  assert.strictEqual(state.delivery, null);
  assert.strictEqual(state.deliveryCompletedCount, 1);
}

function testQuests() {
  const { Engine } = loadEngine();
  const state = Engine.createNewState();

  // 순서대로만 진행
  assert.strictEqual(Engine.getCurrentQuest(state).id, 1);
  const questTooEarly = Engine.claimCurrentQuest(state);
  assert.strictEqual(questTooEarly.success, false);
  assert.strictEqual(questTooEarly.reason, 'NOT_MET');

  state.lifetimeProduced = 10;
  const quest1 = Engine.claimCurrentQuest(state);
  assert.strictEqual(quest1.success, true);
  assert.strictEqual(state.snacks, 20);
  assert.strictEqual(state.currentQuestIndex, 1);

  // 퀘스트 2: 딸기 텃밭 1대
  assert.strictEqual(Engine.isCurrentQuestComplete(state), false);
  state.buildings.strawberry.owned = 1;
  assert.strictEqual(Engine.isCurrentQuestComplete(state), true);
  Engine.claimCurrentQuest(state);
  assert.strictEqual(state.currentQuestIndex, 2);

  // 퀘스트 3: 딸기 텃밭 5대
  state.buildings.strawberry.owned = 5;
  assert.strictEqual(Engine.isCurrentQuestComplete(state), true);
  Engine.claimCurrentQuest(state);
  assert.strictEqual(state.currentQuestIndex, 3);

  // 퀘스트 4: 무대 2 승급
  state.stageId = 2;
  assert.strictEqual(Engine.isCurrentQuestComplete(state), true);
  Engine.claimCurrentQuest(state);
  assert.strictEqual(state.currentQuestIndex, 4);

  // 퀘스트 5: 첫 배달 보내기
  state.deliveryStartedCount = 1;
  assert.strictEqual(Engine.isCurrentQuestComplete(state), true);
  Engine.claimCurrentQuest(state);
  assert.strictEqual(state.currentQuestIndex, 5);
}

function testAchievements() {
  const { Engine } = loadEngine();
  const state = Engine.createNewState();

  // 경계값 이전에는 미달성
  state.buildings.strawberry.owned = 0;
  let unlocked = Engine.checkAndClaimAchievements(state);
  assert.strictEqual(state.achievements['first-building'], false);

  // 경계값 도달 시 달성 + 보상 지급
  state.buildings.strawberry.owned = 1;
  unlocked = Engine.checkAndClaimAchievements(state);
  assert.strictEqual(state.achievements['first-building'], true);
  assert.ok(unlocked.some((achievement) => achievement.key === 'first-building'));
  assert.strictEqual(state.snacks, 100);

  // 클릭 수 경계
  state.clickCount = 999;
  Engine.checkAndClaimAchievements(state);
  assert.strictEqual(state.achievements['click-1000'], false);
  state.clickCount = 1000;
  Engine.checkAndClaimAchievements(state);
  assert.strictEqual(state.achievements['click-1000'], true);

  // 환생 후에도 유지
  state.stageId = 6;
  state.lifetimeProduced = 5000000000;
  const prestigeResult = Engine.prestige(state);
  assert.strictEqual(prestigeResult.success, true);
  assert.strictEqual(state.achievements['first-building'], true);
  assert.strictEqual(state.achievements['click-1000'], true);
}

function testPrestige() {
  const { Engine, Content } = loadEngine();
  const state = Engine.createNewState();

  // 무대 6 미만이면 불가
  state.stageId = 5;
  assert.strictEqual(Engine.canPrestige(state), false);
  assert.strictEqual(Engine.prestige(state).success, false);

  // 레시피 공식 경계값
  assert.strictEqual(Engine.getPrestigePointsForLifetime(0), 0);
  assert.strictEqual(Engine.getPrestigePointsForLifetime(4999999999), 0);
  assert.strictEqual(Engine.getPrestigePointsForLifetime(5000000000), 1);
  assert.strictEqual(Engine.getPrestigePointsForLifetime(20000000000), 2);

  // 환생 후 초기화 범위 검증
  state.stageId = 6;
  state.lifetimeProduced = 20000000000;
  state.snacks = 12345;
  state.buildings.strawberry.owned = 10;
  state.upgrades['sturdy-fingers'] = true;
  state.delivery = { key: 'neighborhood-delivery', startedAt: 0, finishesAt: 100 };
  state.clickCount = 42;
  state.deliveryCompletedCount = 3;

  const result = Engine.prestige(state);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.gained, 2);
  assert.strictEqual(state.snacks, 0);
  assert.strictEqual(state.buildings.strawberry.owned, 0);
  assert.strictEqual(state.upgrades['sturdy-fingers'], false);
  assert.strictEqual(state.stageId, Content.STAGES[0].id);
  assert.strictEqual(state.delivery, null);
  assert.strictEqual(state.prestigePoints, 2);
  assert.strictEqual(state.prestigeCount, 1);

  // 통계는 유지
  assert.strictEqual(state.clickCount, 42);
  assert.strictEqual(state.deliveryCompletedCount, 3);
  assert.strictEqual(state.lifetimeProduced, 20000000000);
}

function testOfflineEarnings() {
  const { Engine } = loadEngine();
  const state = Engine.createNewState();
  state.buildings.strawberry.owned = 10; // 초당 5 생산

  const lastSeenAt = 1000000;
  const now = lastSeenAt + 3 * 60 * 60 * 1000; // 3시간 경과
  const result = Engine.computeOfflineEarnings(state, lastSeenAt, now);
  assert.strictEqual(result.earned, 5 * 3 * 60 * 60);
  assert.strictEqual(result.clockRewind, false);

  // 상한 8시간 절단
  const farNow = lastSeenAt + 20 * 60 * 60 * 1000;
  const capped = Engine.computeOfflineEarnings(state, lastSeenAt, farNow);
  assert.strictEqual(capped.earned, 5 * 8 * 60 * 60);

  // 야간 요정 구매 시 24시간 상한
  state.upgrades['night-fairy'] = true;
  const extended = Engine.computeOfflineEarnings(state, lastSeenAt, farNow);
  assert.strictEqual(extended.earned, 5 * 20 * 60 * 60);

  const overExtended = Engine.computeOfflineEarnings(state, lastSeenAt, lastSeenAt + 30 * 60 * 60 * 1000);
  assert.strictEqual(overExtended.earned, 5 * 24 * 60 * 60);

  // 시계 역행 시 0
  const rewind = Engine.computeOfflineEarnings(state, lastSeenAt, lastSeenAt - 1000);
  assert.strictEqual(rewind.earned, 0);
  assert.strictEqual(rewind.clockRewind, true);
}

function testSaveRoundTrip() {
  const { Engine } = loadEngine();
  const state = Engine.createNewState();
  state.snacks = 12345;
  state.buildings.strawberry.owned = 3;
  state.stageId = 2;

  const serialized = Engine.serializeState(state);
  const restored = Engine.deserializeState(serialized);
  assert.deepStrictEqual(restored, state);

  // 손상 입력은 null
  assert.strictEqual(Engine.deserializeState(''), null);
  assert.strictEqual(Engine.deserializeState('not json{{'), null);

  const negativeOwned = JSON.parse(serialized);
  negativeOwned.buildings.strawberry.owned = -1;
  assert.strictEqual(Engine.deserializeState(JSON.stringify(negativeOwned)), null);

  const noVersion = JSON.parse(serialized);
  delete noVersion.version;
  assert.strictEqual(Engine.deserializeState(JSON.stringify(noVersion)), null);
}

function testFormatNumber() {
  const { Engine } = loadEngine();
  assert.strictEqual(Engine.formatNumber(9999), '9,999');
  assert.strictEqual(Engine.formatNumber(12000), '1.2만');
  assert.strictEqual(Engine.formatNumber(340000000), '3.4억');
  assert.strictEqual(Engine.formatNumber(5600000000000), '5.6조');
}

function testBalanceSafetyNet() {
  const { Engine, Content } = loadEngine();
  const problems = Engine.validateStageProgression();
  assert.strictEqual(problems.length, 0, `expected no balance problems, got: ${problems.join(', ')}`);

  // 무대 승급 비용이 오름차순인지 직접 확인
  for (let i = 1; i < Content.STAGES.length; i += 1) {
    assert.ok(
      Content.STAGES[i].upgradeCost > Content.STAGES[i - 1].upgradeCost,
      `stage ${Content.STAGES[i].id} cost should exceed previous stage`
    );
  }

  // 시설 해금 순서가 무대 순서와 모순 없는지 (해금 무대가 정의된 무대 범위 내)
  const stageIds = Content.STAGES.map((stage) => stage.id);
  Content.BUILDINGS.forEach((building) => {
    assert.ok(stageIds.includes(building.unlockStage), `${building.key} unlockStage must be a defined stage`);
  });
  Content.UPGRADES.forEach((upgrade) => {
    assert.ok(stageIds.includes(upgrade.unlockStage), `${upgrade.key} unlockStage must be a defined stage`);
  });
  Content.DELIVERIES.forEach((delivery) => {
    assert.ok(stageIds.includes(delivery.unlockStage), `${delivery.key} unlockStage must be a defined stage`);
  });
}

function main() {
  testCostCurve();
  testProductionSum();
  testClickAmount();
  testBuyBuildingAndUpgradeStage();
  testDelivery();
  testQuests();
  testAchievements();
  testPrestige();
  testOfflineEarnings();
  testSaveRoundTrip();
  testFormatNumber();
  testBalanceSafetyNet();

  console.log('idle logic test passed');
}

main();

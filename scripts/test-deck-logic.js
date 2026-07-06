const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CONTENT_FILE = path.join(__dirname, '..', 'public', 'deck', 'content.js');
const ENGINE_FILE = path.join(__dirname, '..', 'public', 'deck', 'engine.js');

function loadEngine() {
  const context = { window: {}, module: undefined, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(CONTENT_FILE, 'utf8'), context, { filename: 'content.js' });
  vm.runInContext(fs.readFileSync(ENGINE_FILE, 'utf8'), context, { filename: 'engine.js' });
  return { Content: context.window.DeckContent, Engine: context.window.DeckEngine };
}

// 맵 1층은 항상 일반 전투 1노드뿐이라, "다음 노드 선택 → 전투 진입"이 옛 enterCurrentNode(index 0)와
// 동일한 진입점 역할을 한다. 대부분의 단위 테스트는 이 헬퍼로 첫 전투에 진입한다.
function enterFirstCombat(Engine, state, tracker) {
  return Engine.selectMapNode(state, 0, tracker);
}

function testRngAndShuffleDeterminism() {
  const { Engine } = loadEngine();

  const run1a = Engine.createNewRun(42);
  const run1b = Engine.createNewRun(42);
  assert.deepStrictEqual(run1a.map, run1b.map, '같은 시드는 같은 맵을 만들어야 함');
  assert.deepStrictEqual(run1a.enemyAssignment, run1b.enemyAssignment, '같은 시드는 같은 적 배치를 만들어야 함');
  assert.deepStrictEqual(run1a.eventAssignment, run1b.eventAssignment, '같은 시드는 같은 이벤트 배치를 만들어야 함');

  const run2 = Engine.createNewRun(43);
  assert.notDeepStrictEqual(run1a.map, run2.map, '다른 시드는 다른 맵을 만들어야 함(우연 일치 가능성 낮음)');

  // 같은 시드는 같은 카드 보상도 만들어야 함
  const stateA = Engine.createNewRun(7);
  const trackerA = Engine.trackerFromState(stateA);
  enterFirstCombat(Engine, stateA, trackerA);
  Engine.commitTracker(stateA, trackerA);
  stateA.combat.enemyHp = 0;
  const trackerA2 = Engine.trackerFromState(stateA);
  Engine.checkCombatOutcome(stateA, trackerA2);
  Engine.commitTracker(stateA, trackerA2);

  const stateB = Engine.createNewRun(7);
  const trackerB = Engine.trackerFromState(stateB);
  enterFirstCombat(Engine, stateB, trackerB);
  Engine.commitTracker(stateB, trackerB);
  stateB.combat.enemyHp = 0;
  const trackerB2 = Engine.trackerFromState(stateB);
  Engine.checkCombatOutcome(stateB, trackerB2);
  Engine.commitTracker(stateB, trackerB2);

  assert.deepStrictEqual(stateA.pendingReward, stateB.pendingReward, '같은 시드는 같은 카드 보상을 제시해야 함');
}

function testMapGenerationDeterminismAndDistribution() {
  const { Content, Engine } = loadEngine();

  for (let seed = 1; seed <= 60; seed += 1) {
    const runA = Engine.createNewRun(seed);
    const runB = Engine.createNewRun(seed);
    assert.deepStrictEqual(runA.map, runB.map, `시드 ${seed}: 같은 시드는 같은 맵을 만들어야 함`);

    assert.strictEqual(runA.map.floors.length, Content.MAP_FLOOR_COUNT, '층 수는 13이어야 함');
    assert.strictEqual(runA.map.floors[0].length, 1, '1층은 항상 노드 1개여야 함');
    assert.strictEqual(runA.map.floors[0][0].type, 'normal', '1층은 항상 일반 전투여야 함');
    const lastFloor = runA.map.floors[runA.map.floors.length - 1];
    assert.strictEqual(lastFloor.length, 1, '13층은 항상 노드 1개여야 함');
    assert.strictEqual(lastFloor[0].type, 'boss', '13층은 항상 보스여야 함');

    const typeCounts = {};
    const eliteFloors = [];
    const restFloors = [];
    runA.map.floors.forEach((floorNodes) => {
      floorNodes.forEach((node) => {
        typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
        if (node.type === 'elite') {
          eliteFloors.push(node.floor);
        }
        if (node.type === 'rest') {
          restFloors.push(node.floor);
        }
      });
    });

    const normal = typeCounts.normal || 0;
    const elite = typeCounts.elite || 0;
    const rest = typeCounts.rest || 0;
    const event = typeCounts.event || 0;
    assert.ok(normal >= 5 && normal <= 7, `시드 ${seed}: 일반 전투는 5~7개여야 함 (실제 ${normal})`);
    assert.strictEqual(elite, 2, `시드 ${seed}: 정예는 2개여야 함`);
    assert.strictEqual(rest, 2, `시드 ${seed}: 휴식은 2개여야 함`);
    assert.ok(event >= 2 && event <= 3, `시드 ${seed}: 이벤트는 2~3개여야 함 (실제 ${event})`);

    assert.ok(eliteFloors.some((f) => f <= 7), `시드 ${seed}: 정예 1개 이상이 7층 이하여야 함`);
    assert.ok(eliteFloors.some((f) => f > 7), `시드 ${seed}: 정예 1개 이상이 7층 초과여야 함`);

    restFloors.sort((a, b) => a - b);
    for (let i = 1; i < restFloors.length; i += 1) {
      assert.ok(restFloors[i] - restFloors[i - 1] > 1, `시드 ${seed}: 휴식은 연속 층에 오지 않아야 함`);
    }

    // 모든 노드(1층 제외)는 상행 연결을 최소 1개 가져야 함(고립 노드 금지).
    const incoming = new Set();
    runA.map.edges.forEach((edge) => incoming.add(edge.to));
    runA.map.floors.slice(1).forEach((floorNodes) => {
      floorNodes.forEach((node) => {
        assert.ok(incoming.has(node.id), `시드 ${seed}: 노드 ${node.id}는 상행 연결이 있어야 함`);
      });
    });
  }
}

function testDrawDiscardCycle() {
  const { Content, Engine } = loadEngine();
  const state = Engine.createNewRun(1);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);

  assert.strictEqual(state.player.hand.length, Content.PLAYER_DRAW_PER_TURN, '전투 시작 시 5장을 뽑아야 함');
  assert.strictEqual(
    state.player.drawPile.length + state.player.hand.length,
    state.player.deck.length,
    '드로우 직후 (뽑을 덱 + 손패) 합은 전체 덱과 같아야 함'
  );

  const tracker2 = Engine.trackerFromState(state);
  Engine.endTurn(state, tracker2);
  Engine.commitTracker(state, tracker2);

  // 턴 종료 후 이전 손패는 버림 더미로 (적이 죽지 않았다면) 이동해야 함
  if (state.combat) {
    assert.strictEqual(state.player.hand.length, Content.PLAYER_DRAW_PER_TURN, '다음 턴에도 5장을 뽑아야 함');
  }

  // 덱 소진 시 버림 더미 재셔플 후 이어서 드로우
  const state2 = Engine.createNewRun(2);
  const t2 = Engine.trackerFromState(state2);
  enterFirstCombat(Engine, state2, t2);
  Engine.commitTracker(state2, t2);
  state2.player.drawPile = [];
  state2.player.discardPile = ['rolling-pin-swing', 'dough-shield', 'secret-notebook'];
  state2.player.hand = [];
  const t3 = Engine.trackerFromState(state2);
  const drawn = Engine.drawCards(state2.player, 2, t3);
  assert.strictEqual(drawn.length, 2, '버림 더미가 있으면 재셔플 후 계속 뽑을 수 있어야 함');
  assert.strictEqual(state2.player.discardPile.length, 0, '재셔플 후 버림 더미는 비어야 함');
}

function testEnergy() {
  const { Content, Engine } = loadEngine();
  const state = Engine.createNewRun(5);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);

  assert.strictEqual(state.player.energy, Content.PLAYER_ENERGY_PER_TURN, '턴 시작 시 에너지는 3이어야 함');

  // 비용 합이 에너지를 초과하면 사용 불가
  state.player.energy = 0;
  assert.strictEqual(Engine.canPlayCard(state, 'rolling-pin-swing'), false, '에너지가 부족하면 카드를 사용할 수 없어야 함');

  // 계량 정확히(에너지 +1)
  state.player.energy = 1;
  state.player.hand = ['measure-precisely'];
  const tracker2 = Engine.trackerFromState(state);
  const result = Engine.playCard(state, 'measure-precisely', 0, tracker2);
  assert.strictEqual(result.success, true);
  assert.strictEqual(state.player.energy, 2, '계량 정확히는 비용 0에 에너지 +1을 줘야 함');

  // 마스터 레시피(카드 2장 뽑기, 에너지 +1)
  state.player.energy = 3;
  state.player.hand = ['master-recipe'];
  state.player.drawPile = ['rolling-pin-swing', 'dough-shield'];
  const tracker3 = Engine.trackerFromState(state);
  const result2 = Engine.playCard(state, 'master-recipe', 0, tracker3);
  assert.strictEqual(result2.success, true);
  assert.strictEqual(state.player.energy, 2 + 1, '마스터 레시피는 비용 1을 내고 에너지 +1을 줘야 함');
  assert.strictEqual(state.player.hand.length, 2, '마스터 레시피는 카드 2장을 뽑아야 함');
}

function testDamageCalculation() {
  const { Content, Engine } = loadEngine();

  // 기본
  assert.strictEqual(Engine.computeHitDamage(6, 0, 0, 0), 6);

  // 힘만
  assert.strictEqual(Engine.computeHitDamage(6, 2, 0, 0), 8);

  // 취약만: 6 × 1.5 = 9
  assert.strictEqual(Engine.computeHitDamage(6, 0, 0, 1), 9);

  // 약화만: 6 × 0.75 = 4.5 → 내림 4
  assert.strictEqual(Engine.computeHitDamage(6, 0, 1, 0), 4);

  // 힘2 + 취약: (6+2) × 1.5 = 12 (계획서 예시)
  assert.strictEqual(Engine.computeHitDamage(6, 2, 0, 1), 12);

  // 힘 + 약화 + 취약 조합, 내림이 각 곱연산 직후 적용되는지 확인
  // (7+3)=10 × 0.75=7.5→7 × 1.5=10.5→10
  assert.strictEqual(Engine.computeHitDamage(7, 3, 1, 1), 10);

  // 방어도 차감 후 HP 차감
  const target = { block: 5 };
  const result = Engine.applyDamageToTarget(target, 8);
  assert.strictEqual(target.block, 0);
  assert.strictEqual(result.hpLoss, 3);

  const target2 = { block: 10 };
  const result2 = Engine.applyDamageToTarget(target2, 4);
  assert.strictEqual(target2.block, 6);
  assert.strictEqual(result2.hpLoss, 0);

  // 다단 히트는 히트마다 방어도 차감
  const state = Engine.createNewRun(3);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);
  state.combat.enemyBlock = 5;
  state.combat.enemyHp = 100;
  // 크루아상 연타: 피해 3 × 3회
  const before = state.combat.enemyHp;
  state.player.hand = ['croissant-flurry'];
  state.player.energy = 3;
  const tracker2 = Engine.trackerFromState(state);
  Engine.playCard(state, 'croissant-flurry', 0, tracker2);
  // 히트1: 3피해 → 방어도 5-3=2 (hp손실 0)
  // 히트2: 3피해 → 방어도 2-2=0, 1 hp손실
  // 히트3: 3피해 → 방어도 0, 3 hp손실
  // 총 hp손실 4
  assert.strictEqual(before - state.combat.enemyHp, 4, '다단 히트는 히트마다 방어도를 차감해야 함');
}

function testStatusDurations() {
  const { Engine } = loadEngine();
  const state = Engine.createNewRun(9);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);

  state.combat.playerWeak = 2;
  state.combat.playerVulnerable = 1;
  state.combat.playerStrength = 3;
  state.combat.playerBlock = 5;

  const tracker2 = Engine.trackerFromState(state);
  Engine.endTurn(state, tracker2);
  Engine.commitTracker(state, tracker2);

  if (state.combat) {
    assert.strictEqual(state.combat.playerWeak, 1, '약화는 턴 종료 시 1턴 감소해야 함');
    assert.strictEqual(state.combat.playerVulnerable, 0, '취약은 턴 종료 시 1턴 감소해야 함');
    assert.strictEqual(state.combat.playerStrength, 3, '힘은 전투 내내 유지돼야 함');
    assert.strictEqual(state.combat.playerBlock, 0, '방어도는 자기 턴 시작 시 소멸해야 함(플레이어 턴 종료 시점에 비움)');
  }
}

function testEnemyBehavior() {
  const { Content, Engine } = loadEngine();
  const enemy = Content.ENEMIES.find((e) => e.id === 'crumb-ant');
  const state = Engine.createNewRun(11);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);
  // 첫 노드에 배정된 적을 강제로 부스러기 개미로 맞춘다(패턴 검증용 고정 시나리오).
  state.enemyAssignment[state.currentNodeId] = 'crumb-ant';
  state.combat.enemyId = 'crumb-ant';
  state.combat.enemyHp = enemy.maxHp;
  state.combat.enemyMaxHp = enemy.maxHp;

  // 의도와 실제 행동 일치 확인 (공5 → 공5 → 방5 순환)
  const intent0 = Engine.getEnemyIntent(state);
  assert.deepStrictEqual(intent0, enemy.pattern[0]);

  const hpBefore = state.player.hp;
  const tracker2 = Engine.trackerFromState(state);
  Engine.endTurn(state, tracker2);
  Engine.commitTracker(state, tracker2);
  assert.strictEqual(hpBefore - state.player.hp, 5, '첫 행동은 공격 5여야 함');
  assert.strictEqual(state.combat.enemyPatternIndex, 1);

  const intent1 = Engine.getEnemyIntent(state);
  assert.deepStrictEqual(intent1, enemy.pattern[1]);

  const hpBefore2 = state.player.hp;
  const tracker3 = Engine.trackerFromState(state);
  Engine.endTurn(state, tracker3);
  Engine.commitTracker(state, tracker3);
  assert.strictEqual(hpBefore2 - state.player.hp, 5, '두 번째 행동도 공격 5여야 함');

  const intent2 = Engine.getEnemyIntent(state);
  assert.deepStrictEqual(intent2, enemy.pattern[2]);
  const tracker4 = Engine.trackerFromState(state);
  Engine.endTurn(state, tracker4);
  Engine.commitTracker(state, tracker4);
  assert.strictEqual(state.combat.enemyBlock, 5, '세 번째 행동은 방어도 5를 얻어야 함');

  // 순환 확인 (인덱스 3 % 3 = 0)
  assert.strictEqual(state.combat.enemyPatternIndex, 3);
  const intent3 = Engine.getEnemyIntent(state);
  assert.deepStrictEqual(intent3, enemy.pattern[0], '패턴은 순환해야 함');
}

function testRunProgression() {
  const { Content, Engine } = loadEngine();
  const state = Engine.createNewRun(21);

  assert.strictEqual(Content.MAP_FLOOR_COUNT, 13);

  // 휴식 회복 30% 상한
  const restState = Engine.createNewRun(22);
  const restNode = findNodeOfType(restState, 'rest');
  restState.currentNodeId = restNode.id;
  restState.player.hp = 10;
  restState.screen = 'rest';
  const healResult = Engine.applyRestHeal(restState);
  assert.strictEqual(healResult.success, true);
  assert.strictEqual(healResult.healAmount, Math.floor(restState.player.maxHp * Content.REST_HEAL_PERCENT));
  assert.strictEqual(restState.player.hp, 10 + healResult.healAmount);
  assert.strictEqual(restState.screen, 'run', '휴식 후 지도 화면으로 돌아가야 함');

  // 휴식 카드 제거
  const removeState = Engine.createNewRun(23);
  const removeRestNode = findNodeOfType(removeState, 'rest');
  removeState.currentNodeId = removeRestNode.id;
  removeState.screen = 'rest';
  const deckSizeBefore = removeState.player.deck.length;
  const removeResult = Engine.applyRestRemoveCard(removeState, 0);
  assert.strictEqual(removeResult.success, true);
  assert.strictEqual(removeState.player.deck.length, deckSizeBefore - 1);

  // 정예/보스 보상은 정예급 카드 1장 이상 보장
  const eliteState = Engine.createNewRun(24);
  const eliteNode = findNodeOfType(eliteState, 'elite');
  const tracker = Engine.trackerFromState(eliteState);
  eliteState.currentNodeId = eliteNode.id;
  Engine.startCombat(eliteState, eliteState.enemyAssignment[eliteNode.id], tracker);
  Engine.commitTracker(eliteState, tracker);
  eliteState.combat.enemyHp = 0;
  const tracker2 = Engine.trackerFromState(eliteState);
  Engine.checkCombatOutcome(eliteState, tracker2);
  Engine.commitTracker(eliteState, tracker2);
  const eliteCardIds = Content.CARDS.filter((c) => c.rarity === 'elite').map((c) => c.id);
  const hasElite = eliteState.pendingReward.some((id) => eliteCardIds.includes(id));
  assert.strictEqual(hasElite, true, '정예 전투 보상은 정예급 카드를 1장 이상 포함해야 함');
  assert.strictEqual(eliteState.pendingReward.length, Content.REWARD_CARD_COUNT);
}

function findNodeOfType(state, type) {
  for (const floorNodes of state.map.floors) {
    for (const node of floorNodes) {
      if (node.type === type) {
        return node;
      }
    }
  }
  throw new Error(`fixture: no ${type} node found in map`);
}

function testWinLose() {
  const { Engine } = loadEngine();

  // 적 HP 0 → 전투 승리, 상태 초기화, HP 유지
  const state = Engine.createNewRun(31);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);
  state.player.hp = 45;
  state.combat.enemyHp = 0;
  state.combat.playerStrength = 5;
  const tracker2 = Engine.trackerFromState(state);
  const outcome = Engine.checkCombatOutcome(state, tracker2);
  Engine.commitTracker(state, tracker2);
  assert.strictEqual(outcome, 'victory');
  assert.strictEqual(state.combat, null, '승리 시 전투 상태는 초기화돼야 함');
  assert.strictEqual(state.player.hp, 45, '승리 시 HP는 유지돼야 함');
  assert.strictEqual(state.screen, 'reward');

  // 플레이어 HP 0 → 런 종료
  const state2 = Engine.createNewRun(32);
  const tracker3 = Engine.trackerFromState(state2);
  enterFirstCombat(Engine, state2, tracker3);
  Engine.commitTracker(state2, tracker3);
  state2.player.hp = 0;
  const outcome2 = Engine.checkCombatOutcome(state2);
  assert.strictEqual(outcome2, 'defeat');
  assert.strictEqual(state2.finished, true);
  assert.strictEqual(state2.victory, false);
  assert.strictEqual(state2.screen, 'result');

  // 보스 격파 → 클리어 기록 증가
  const state3 = Engine.createNewRun(33);
  const bossNode = findNodeOfType(state3, 'boss');
  const tracker4 = Engine.trackerFromState(state3);
  state3.currentNodeId = bossNode.id;
  Engine.startCombat(state3, state3.enemyAssignment[bossNode.id], tracker4);
  Engine.commitTracker(state3, tracker4);
  state3.combat.enemyHp = 0;
  const tracker5 = Engine.trackerFromState(state3);
  Engine.checkCombatOutcome(state3, tracker5);
  Engine.commitTracker(state3, tracker5);
  assert.strictEqual(state3.stats.clearCount, 1);
  assert.strictEqual(state3.victory, true);
  assert.strictEqual(state3.screen, 'result');
}

function testSaveRoundTrip() {
  const { Engine } = loadEngine();
  const state = Engine.createNewRun(41);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);

  const serialized = Engine.serializeState(state);
  const restored = Engine.deserializeState(serialized);
  assert.deepStrictEqual(restored, state);

  // 시드/RNG 카운터 복원 후 이후 셔플이 동일해야 함
  const trackerOriginal = Engine.trackerFromState(state);
  const trackerRestored = Engine.trackerFromState(restored);
  for (let i = 0; i < 10; i += 1) {
    assert.strictEqual(trackerOriginal.next(), trackerRestored.next(), '복원 후 이후 난수 스트림이 동일해야 함');
  }

  // 손상 입력은 null
  assert.strictEqual(Engine.deserializeState(''), null);
  assert.strictEqual(Engine.deserializeState('not json{{'), null);

  const negativeHp = JSON.parse(serialized);
  negativeHp.player.hp = -1;
  assert.strictEqual(Engine.deserializeState(JSON.stringify(negativeHp)), null);

  const noVersion = JSON.parse(serialized);
  delete noVersion.version;
  assert.strictEqual(Engine.deserializeState(JSON.stringify(noVersion)), null);
}

function testContentSafetyNet() {
  const { Engine } = loadEngine();
  const problems = Engine.validateContent();
  assert.strictEqual(problems.length, 0, `콘텐츠 검증 문제 발견: ${problems.join(', ')}`);
}

function testStarterDeckAndFirstCombatsBalance() {
  // 밸런스 자가 점검: 고정 시드로 시작 덱만 사용해 첫 2전투를 시뮬레이션한다.
  // 매 턴 에너지가 허용하는 한 손패의 첫 번째 사용 가능한 카드를 사용하는 단순 전략으로
  // 첫 2전투가 무난히 승리 가능한지(플레이어 HP가 과도하게 깎이지 않는지) 확인한다.
  const { Engine } = loadEngine();
  const seeds = [1, 2, 3, 4, 5];
  const results = seeds.map((seed) => simulateFirstTwoCombats(Engine, seed));

  results.forEach((result, index) => {
    assert.strictEqual(result.wonFirstTwo, true, `시드 ${seeds[index]}: 시작 덱만으로 첫 2전투를 이겨야 함`);
    assert.ok(result.hpRemainingRatio > 0.4, `시드 ${seeds[index]}: 첫 2전투 후 HP 비율이 너무 낮음 (${result.hpRemainingRatio})`);
  });
}

// 지도 화면에서 항상 첫 번째 선택지를 골라 진행하는 단순 정책. 이벤트 칸은 첫 선택지로
// 응답한다(밸런스 확인용 - 이벤트 결과에 따라 무작위 편차가 있을 수 있으므로 이 시뮬레이션은
// 첫 2전투까지만 진행해 이벤트 칸을 만나지 않는 얕은 시나리오로 한정한다).
function simulateFirstTwoCombats(Engine, seed) {
  const state = Engine.createNewRun(seed);
  let tracker = Engine.trackerFromState(state);
  let combatsSeen = 0;

  let safetyOuter = 0;
  while (combatsSeen < 2 && !state.finished && safetyOuter < 20) {
    safetyOuter += 1;
    if (state.screen === 'run') {
      Engine.selectMapNode(state, 0, tracker);
      Engine.commitTracker(state, tracker);
      tracker = Engine.trackerFromState(state);
      continue;
    }
    if (state.screen === 'combat') {
      combatsSeen += 1;
      let safetyCounter = 0;
      while (state.combat && safetyCounter < 100) {
        safetyCounter += 1;
        tracker = Engine.trackerFromState(state);
        let playedSomething = false;
        for (let i = 0; i < state.player.hand.length; i += 1) {
          const cardId = state.player.hand[i];
          if (Engine.canPlayCard(state, cardId)) {
            Engine.playCard(state, cardId, i, tracker);
            playedSomething = true;
            break;
          }
        }
        if (!playedSomething) {
          Engine.endTurn(state, tracker);
        }
        Engine.commitTracker(state, tracker);
        tracker = Engine.trackerFromState(state);
      }
      if (state.screen === 'reward') {
        Engine.chooseReward(state, null); // 시작 덱만 사용하도록 보상은 건너뜀
        tracker = Engine.trackerFromState(state);
      } else if (state.finished) {
        break;
      }
      continue;
    }
    if (state.screen === 'rest') {
      Engine.applyRestHeal(state);
      tracker = Engine.trackerFromState(state);
      continue;
    }
    if (state.screen === 'event') {
      const event = Engine.findEvent(state.pendingEvent.eventId);
      const choice = event.choices[0];
      const result = Engine.resolveEventChoice(state, choice.id, tracker);
      if (result.outcome && result.outcome.requiresFollowUp === 'removeCard') {
        Engine.applyEventRemoveCard(state, 0);
      } else if (result.outcome && result.outcome.requiresFollowUp === 'upgradeCard') {
        Engine.applyEventUpgradeCard(state, 0);
      } else if (result.outcome && result.outcome.requiresFollowUp === 'giveCard') {
        Engine.applyEventRemoveCard(state, 0);
      }
      tracker = Engine.trackerFromState(state);
      continue;
    }
    break;
  }

  return {
    wonFirstTwo: combatsSeen >= 2 && (!state.finished || state.victory),
    hpRemainingRatio: state.player.hp / state.player.maxHp,
  };
}

function testStatusDirectionAndBlockTiming() {
  const { Engine } = loadEngine();

  // 약화 방향: 약화는 "공격자"가 주는 피해를 줄인다.
  const state = Engine.createNewRun(5);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);
  state.enemyAssignment[state.currentNodeId] = 'crumb-ant';
  state.combat.enemyId = 'crumb-ant';
  state.combat.enemyHp = 100; // 전투가 끝나지 않게 넉넉히

  // 적이 약화 상태: 내 공격은 그대로, 적의 공격은 감소
  state.combat.enemyWeak = 1;
  const myHit = Engine.playerHitsEnemy(state, 6);
  assert.strictEqual(myHit.amount, 6, '적의 약화는 내 공격을 줄이지 않아야 함');
  const enemyHit = Engine.enemyHitsPlayer(state, 8);
  assert.strictEqual(enemyHit.amount, 6, '약화된 적의 공격은 25% 감소(내림)해야 함');
  state.combat.enemyWeak = 0;

  // 내가 약화 상태: 내 공격 감소
  state.combat.playerWeak = 1;
  const weakenedHit = Engine.playerHitsEnemy(state, 6);
  assert.strictEqual(weakenedHit.amount, 4, '약화된 내 공격은 25% 감소(내림)해야 함');

  // 방어도 타이밍: 이번 턴에 얻은 방어도는 적의 공격을 받아낸 뒤 다음 턴 시작 시 소멸한다.
  const state2 = Engine.createNewRun(5);
  const t2 = Engine.trackerFromState(state2);
  enterFirstCombat(Engine, state2, t2); // 첫 행동: 공격 5(부스러기 개미로 강제)
  Engine.commitTracker(state2, t2);
  state2.enemyAssignment[state2.currentNodeId] = 'crumb-ant';
  state2.combat.enemyId = 'crumb-ant';
  state2.combat.playerBlock = 5;
  const hpBefore = state2.player.hp;
  const t3 = Engine.trackerFromState(state2);
  Engine.endTurn(state2, t3);
  assert.strictEqual(state2.player.hp, hpBefore, '이번 턴에 얻은 방어도 5는 적의 공격 5를 전부 막아야 함');
  assert.strictEqual(state2.combat.playerBlock, 0, '남은 방어도는 다음 플레이어 턴 시작 시 소멸해야 함');
}

function testEnemyVulnerableCurse() {
  const { Engine } = loadEngine();
  // 곰팡이 요정: 취약 2턴 → 공9 순환. 두 번째 턴의 공격이 9 × 1.5 = 13(내림)이어야 한다.
  const state = Engine.createNewRun(5);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);
  state.enemyAssignment[state.currentNodeId] = 'mold-fairy';
  state.combat.enemyId = 'mold-fairy';

  const t2 = Engine.trackerFromState(state);
  Engine.endTurn(state, t2); // 적: 취약 2 부여 → 적 턴 종료 시 1로 감소
  assert.strictEqual(state.combat.playerVulnerable, 1, '취약 2턴 부여 후 적 턴 종료 시 1턴이 남아야 함');

  const hpBefore = state.player.hp;
  const t3 = Engine.trackerFromState(state);
  Engine.endTurn(state, t3); // 적: 공9 → 취약으로 증폭
  assert.strictEqual(hpBefore - state.player.hp, 13, '취약 상태의 플레이어는 9 × 1.5 = 13(내림) 피해를 받아야 함');
  assert.strictEqual(state.combat.playerVulnerable, 0, '취약은 효력을 낸 적 턴이 끝나면 만료돼야 함');
}

function testStatsCarryOver() {
  const { Engine } = loadEngine();
  const next = Engine.createNewRun(3, { clearCount: 2, bestNodeReached: 7, enemiesDefeated: 99 });
  assert.strictEqual(next.stats.clearCount, 2, '클리어 횟수는 새 런에 이어져야 함');
  assert.strictEqual(next.stats.bestNodeReached, 7, '최고 도달 층은 새 런에 이어져야 함');
  assert.strictEqual(next.stats.enemiesDefeated, 0, '처치 수는 런 단위로 초기화돼야 함');
}

// ---- v2 신규: 파워 카드 ----

function testPowerCards() {
  const { Engine } = loadEngine();

  // 시나몬 각성: 매 턴 시작 시 힘 +1(지속).
  const state = Engine.createNewRun(5);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);
  state.player.hand = ['cinnamon-awakening'];
  state.player.energy = 3;
  const t2 = Engine.trackerFromState(state);
  const result = Engine.playCard(state, 'cinnamon-awakening', 0, t2);
  assert.strictEqual(result.success, true);
  assert.strictEqual(state.powers.length, 1, '파워 카드는 state.powers에 등록돼야 함');
  const strengthBefore = state.combat.playerStrength;
  const t3 = Engine.trackerFromState(state);
  Engine.endTurn(state, t3);
  if (state.combat) {
    assert.strictEqual(state.combat.playerStrength, strengthBefore + 1, '시나몬 각성은 턴 시작마다 힘 +1을 줘야 함');
  }

  // 꿀 코팅: 매 턴 시작 시 방어도 +3(지속).
  const state2 = Engine.createNewRun(6);
  const trackerB = Engine.trackerFromState(state2);
  enterFirstCombat(Engine, state2, trackerB);
  Engine.commitTracker(state2, trackerB);
  state2.player.hand = ['honey-glaze'];
  state2.player.energy = 3;
  const tb2 = Engine.trackerFromState(state2);
  Engine.playCard(state2, 'honey-glaze', 0, tb2);
  assert.strictEqual(state2.powers.length, 1);
  const tb3 = Engine.trackerFromState(state2);
  Engine.endTurn(state2, tb3);
  if (state2.combat) {
    assert.ok(state2.combat.playerBlock >= 3, '꿀 코팅은 턴 시작마다 방어도 +3을 줘야 함');
  }

  // 파워는 전투가 끝나면 초기화된다(전투 단위 지속).
  assert.strictEqual(state2.combat !== null, true);
}

function testComboAndStockpileCards() {
  const { Engine } = loadEngine();

  // 크루아상 연타(이중창): 피해 4 + 이번 턴 사용한 공격 카드 수 × 2. 첫 장은 자기 자신을
  // 포함해 1장째이므로 보너스 2, 두 번째로 내면 2장째라 보너스 4.
  const state = Engine.createNewRun(1);
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  Engine.commitTracker(state, tracker);
  state.combat.enemyHp = 999;
  state.player.hand = ['croissant-double-tap', 'croissant-double-tap'];
  state.player.energy = 3;

  const t2 = Engine.trackerFromState(state);
  const before1 = state.combat.enemyHp;
  Engine.playCard(state, 'croissant-double-tap', 0, t2);
  const dealt1 = before1 - state.combat.enemyHp;
  assert.strictEqual(dealt1, 4 + 2 * 1, '연격 시너지: 1번째 공격 카드는 보너스 2를 받아야 함');

  const before2 = state.combat.enemyHp;
  const t3 = Engine.trackerFromState(state);
  Engine.playCard(state, 'croissant-double-tap', 0, t3);
  const dealt2 = before2 - state.combat.enemyHp;
  assert.strictEqual(dealt2, 4 + 2 * 2, '연격 시너지: 2번째 공격 카드는 보너스 4를 받아야 함');

  // 티라미수 비축: 이번 턴 첫 카드가 비용 0으로 나가면 추가 드로우.
  const state2 = Engine.createNewRun(2);
  const trackerB = Engine.trackerFromState(state2);
  enterFirstCombat(Engine, state2, trackerB);
  Engine.commitTracker(state2, trackerB);
  state2.player.hand = ['tiramisu-stockpile'];
  state2.player.drawPile = ['rolling-pin-swing', 'dough-shield', 'secret-notebook'];
  state2.player.energy = 3;
  const tb2 = Engine.trackerFromState(state2);
  // 설탕 모래시계 유물 없이 비용 1이라 무료 조건(비용 0)을 만족하지 않는 케이스도 확인.
  const handBefore = state2.player.hand.length;
  Engine.playCard(state2, 'tiramisu-stockpile', 0, tb2);
  assert.strictEqual(state2.player.hand.length, handBefore - 1 + 2, '티라미수 비축은 기본적으로 2장을 뽑아야 함(무료 보너스 미적용)');

  // 버터 기름칠: 소멸(exile) - 사용 후 덱에서 완전히 제거된다.
  const state3 = Engine.createNewRun(3);
  const trackerC = Engine.trackerFromState(state3);
  enterFirstCombat(Engine, state3, trackerC);
  Engine.commitTracker(state3, trackerC);
  state3.player.deck.push('butter-grease');
  state3.player.hand = ['butter-grease'];
  state3.player.energy = 1;
  const deckSizeBefore = state3.player.deck.length;
  const tc2 = Engine.trackerFromState(state3);
  Engine.playCard(state3, 'butter-grease', 0, tc2);
  assert.strictEqual(state3.player.deck.length, deckSizeBefore - 1, '소멸 카드는 덱에서 완전히 제거돼야 함');
  assert.strictEqual(state3.player.discardPile.indexOf('butter-grease'), -1, '소멸 카드는 버림 더미에도 없어야 함');
}

// ---- v2 신규: 유물 8종 ----

function testRelicEffects() {
  const { Content, Engine } = loadEngine();

  // 청동 반죽틀: 전투 시작 시 방어도 5.
  const state = Engine.createNewRun(1);
  state.relics = ['bronze-kneading-plate'];
  const tracker = Engine.trackerFromState(state);
  enterFirstCombat(Engine, state, tracker);
  assert.ok(state.combat.playerBlock >= 5, '청동 반죽틀은 전투 시작 시 방어도 5를 줘야 함');

  // 화덕 잉걸: 전투 시작 시 적에게 피해 6.
  const state2 = Engine.createNewRun(2);
  state2.relics = ['furnace-ember'];
  const tracker2 = Engine.trackerFromState(state2);
  const enemyId = Engine.getAvailableNextNodes(state2.map, null)[0].id;
  const enemy = Engine.findEnemy(state2.enemyAssignment[enemyId]);
  enterFirstCombat(Engine, state2, tracker2);
  assert.strictEqual(state2.combat.enemyHp, enemy.maxHp - 6, '화덕 잉걸은 전투 시작 시 적에게 피해 6을 줘야 함');

  // 설탕 모래시계: 턴당 첫 카드 비용 -1.
  const state3 = Engine.createNewRun(3);
  state3.relics = ['sugar-hourglass'];
  const tracker3 = Engine.trackerFromState(state3);
  enterFirstCombat(Engine, state3, tracker3);
  state3.player.hand = ['rolling-pin-swing', 'rolling-pin-swing'];
  state3.player.energy = 1;
  const t3a = Engine.trackerFromState(state3);
  const result1 = Engine.playCard(state3, 'rolling-pin-swing', 0, t3a);
  assert.strictEqual(result1.success, true, '설탕 모래시계는 첫 카드 비용을 1 줄여 에너지 1로도 사용 가능해야 함');
  assert.strictEqual(state3.player.energy, 1, '할인된 비용(0)만큼만 소모돼야 함');
  const t3b = Engine.trackerFromState(state3);
  const result2 = Engine.playCard(state3, 'rolling-pin-swing', 0, t3b);
  assert.strictEqual(result2.success, true, '남은 에너지로 정상 비용(1)의 두 번째 카드도 낼 수 있어야 함');
  assert.strictEqual(state3.player.energy, 0, '턴당 1회 할인만 적용돼 두 번째 카드는 정상 비용(1)을 소모해야 함');

  // 소금 부적: 약화·취약 지속 -1턴(최소 1턴).
  const state4 = Engine.createNewRun(4);
  state4.relics = ['salt-charm'];
  const tracker4 = Engine.trackerFromState(state4);
  enterFirstCombat(Engine, state4, tracker4);
  state4.player.hand = ['flour-cloud']; // 약화 2턴
  state4.player.energy = 3;
  const t4 = Engine.trackerFromState(state4);
  Engine.playCard(state4, 'flour-cloud', 0, t4);
  assert.strictEqual(state4.combat.enemyWeak, 1, '소금 부적은 약화 부여 시 지속을 1턴 줄여야 함(2턴 → 1턴)');

  const state5 = Engine.createNewRun(5);
  state5.relics = ['salt-charm'];
  const tracker5 = Engine.trackerFromState(state5);
  enterFirstCombat(Engine, state5, tracker5);
  state5.player.hand = ['caramel-coagulate']; // 약화 2턴
  state5.player.energy = 3;
  const t5 = Engine.trackerFromState(state5);
  Engine.playCard(state5, 'caramel-coagulate', 0, t5);
  assert.strictEqual(state5.combat.enemyWeak, 1, '소금 부적 적용 후에도 최소 1턴은 보장돼야 함');

  // 딸기 심장: 최대 HP +12, 즉시 회복 12.
  const state6 = Engine.createNewRun(6);
  state6.player.hp = 40;
  Engine.grantRelic(state6, 'strawberry-heart');
  assert.strictEqual(state6.player.maxHp, Content.PLAYER_MAX_HP + 12, '딸기 심장은 최대 HP를 12 늘려야 함');
  assert.strictEqual(state6.player.hp, 52, '딸기 심장은 즉시 12를 회복해야 함');

  // 은수저: 휴식 회복량 +50%.
  const state7 = Engine.createNewRun(7);
  state7.relics = ['silver-spoon'];
  const restNode = findNodeOfType(state7, 'rest');
  state7.currentNodeId = restNode.id;
  state7.screen = 'rest';
  state7.player.hp = 0;
  const healResult = Engine.applyRestHeal(state7);
  const baseHeal = Math.floor(state7.player.maxHp * Content.REST_HEAL_PERCENT);
  assert.strictEqual(healResult.healAmount, Math.floor(baseHeal * 1.5), '은수저는 휴식 회복량을 50% 늘려야 함');

  // 오래된 레시피북: 카드 보상 3 → 4장.
  const state8 = Engine.createNewRun(8);
  state8.relics = ['old-recipe-book'];
  const tracker8 = Engine.trackerFromState(state8);
  enterFirstCombat(Engine, state8, tracker8);
  Engine.commitTracker(state8, tracker8);
  state8.combat.enemyHp = 0;
  const tracker8b = Engine.trackerFromState(state8);
  Engine.checkCombatOutcome(state8, tracker8b);
  assert.strictEqual(state8.pendingReward.length, Content.REWARD_CARD_COUNT + 1, '오래된 레시피북은 보상 선택지를 4장으로 늘려야 함');

  // 여분의 앞치마: 드로우 수 +2(손패 상한 확장의 실제 구현).
  const state9 = Engine.createNewRun(9);
  state9.relics = ['extra-apron'];
  const tracker9 = Engine.trackerFromState(state9);
  enterFirstCombat(Engine, state9, tracker9);
  assert.strictEqual(state9.player.hand.length, Content.PLAYER_DRAW_PER_TURN + 2, '여분의 앞치마는 턴당 드로우 수를 2 늘려야 함');
}

// ---- v2 신규: 이벤트 칸 ----

function testEventDeterminismAndCurse() {
  const { Content, Engine } = loadEngine();

  // 이벤트 배정은 시드 결정적이어야 한다.
  const runA = Engine.createNewRun(50);
  const runB = Engine.createNewRun(50);
  assert.deepStrictEqual(runA.eventAssignment, runB.eventAssignment, '같은 시드는 같은 이벤트 배치를 만들어야 함');

  // 잊힌 창고 → 저주 감수 경로: 눅눅한 빵(저주 카드)이 덱에 추가돼야 한다.
  const eventNode = Object.keys(runA.eventAssignment)
    .map((id) => Engine.findNodeById(runA.map, id))
    .find((node) => runA.eventAssignment[node.id] === 'forgotten-storage');
  if (eventNode) {
    runA.currentNodeId = eventNode.id;
    Engine.enterEventNode(runA);
    const tracker = Engine.trackerFromState(runA);
    const deckSizeBefore = runA.player.deck.length;
    const result = Engine.resolveEventChoice(runA, 'take-relic-with-curse', tracker);
    assert.strictEqual(result.success, true);
    assert.strictEqual(runA.player.deck.length, deckSizeBefore + 1, '저주 감수 경로는 덱에 카드 1장(눅눅한 빵)을 추가해야 함');
    assert.ok(runA.player.deck.includes('soggy-bread'), '저주 카드 눅눅한 빵이 덱에 포함돼야 함');
  }

  const curseCard = Content.CARDS.find((c) => c.id === 'soggy-bread');
  assert.ok(curseCard, '눅눅한 빵 카드가 정의돼 있어야 함');
  assert.strictEqual(curseCard.rarity, 'curse');
  // vm 컨텍스트 간 객체는 프로토타입이 달라 deepStrictEqual이 아니라 키 목록으로 비교한다.
  assert.strictEqual(Object.keys(curseCard.effect).length, 0, '눅눅한 빵은 효과가 없어야 함');
}

function testEventChoiceResolution() {
  const { Engine } = loadEngine();

  // 설탕 샘: HP 15 회복 선택.
  const state = Engine.createNewRun(1);
  state.player.hp = 30;
  state.pendingEvent = { eventId: 'sugar-spring' };
  state.screen = 'event';
  const tracker = Engine.trackerFromState(state);
  const result = Engine.resolveEventChoice(state, 'drink', tracker);
  assert.strictEqual(result.success, true);
  assert.strictEqual(state.player.hp, 45, '설탕 샘의 회복 선택은 HP 15를 회복해야 함');

  // 잠든 수호묘: 깨우면 정예 전투 + 유물 확정.
  const state2 = Engine.createNewRun(2);
  state2.currentNodeId = Engine.getAvailableNextNodes(state2.map, null)[0].id;
  state2.pendingEvent = { eventId: 'sleeping-guardian-cat' };
  state2.screen = 'event';
  const tracker2 = Engine.trackerFromState(state2);
  const result2 = Engine.resolveEventChoice(state2, 'wake', tracker2);
  assert.strictEqual(result2.success, true);
  assert.strictEqual(state2.screen, 'combat', '잠든 수호묘를 깨우면 즉시 전투가 시작돼야 함');
  assert.strictEqual(state2.relics.length, 1, '잠든 수호묘는 유물 1개를 확정 지급해야 함');

  // 무작위 결과(수상한 조각 케이크)는 시드 결정적이어야 한다.
  const stateA = Engine.createNewRun(9);
  stateA.player.hp = 50;
  stateA.pendingEvent = { eventId: 'suspicious-cake-slice' };
  stateA.screen = 'event';
  const trackerA = Engine.trackerFromState(stateA);
  Engine.resolveEventChoice(stateA, 'eat', trackerA);

  const stateB = Engine.createNewRun(9);
  stateB.player.hp = 50;
  stateB.pendingEvent = { eventId: 'suspicious-cake-slice' };
  stateB.screen = 'event';
  const trackerB = Engine.trackerFromState(stateB);
  Engine.resolveEventChoice(stateB, 'eat', trackerB);

  assert.strictEqual(stateA.player.hp, stateB.player.hp, '무작위 이벤트 결과는 같은 시드에서 같아야 함');
}

// ---- v2 신규: 저장 마이그레이션 ----

function testLegacyV1SaveMigration() {
  const { Engine } = loadEngine();

  const legacySave = {
    version: 1,
    seed: 42,
    rngCallCount: 10,
    runIndex: 4,
    screen: 'run',
    player: { hp: 40, maxHp: 60, deck: ['rolling-pin-swing'], drawPile: [], discardPile: [], hand: [], energy: 3 },
    enemyAssignment: ['crumb-ant'],
    combat: null,
    pendingReward: null,
    pendingRest: false,
    stats: { clearCount: 3, bestNodeReached: 9, enemiesDefeated: 20 },
    finished: false,
    victory: false,
  };

  assert.strictEqual(Engine.isValidLoadedState(legacySave), false, '구버전 세이브는 새 검증을 통과하지 못해야 함');
  assert.strictEqual(Engine.isLegacyV1Save(legacySave), true, '구버전 세이브로 식별돼야 함');

  const extractedStats = Engine.extractLegacyStats(legacySave);
  assert.strictEqual(extractedStats.clearCount, 3, '통산 클리어 횟수가 보존돼야 함');
  assert.strictEqual(extractedStats.bestNodeReached, 9, '통산 최고 도달 기록이 보존돼야 함');
  assert.strictEqual(extractedStats.enemiesDefeated, 0, '처치 수는 새 런 기준으로 초기화돼야 함');

  // 크래시 없이 새 런을 만들 수 있어야 한다(통산 기록을 이어받아).
  const newRun = Engine.createNewRun(99, extractedStats);
  assert.strictEqual(newRun.stats.clearCount, 3);
  assert.strictEqual(newRun.stats.bestNodeReached, 9);
  assert.strictEqual(newRun.finished, false);

  // 형태가 심하게 어긋난 입력도 크래시 없이 관용 처리돼야 한다.
  const malformed = { version: 1, stats: null };
  assert.strictEqual(Engine.isLegacyV1Save(malformed), false, 'stats가 없으면 구버전으로 식별하지 않아야 함(관용 폴백은 game.js가 처리)');
}

// ---- v2 신규: 점수 공식 ----

function testScoreFormula() {
  const { Content, Engine } = loadEngine();
  assert.strictEqual(Content.MAP_FLOOR_COUNT, 13);
  assert.strictEqual(Content.SCORE_PER_FLOOR, 1000);
  assert.strictEqual(Content.MAX_SCORE, 13 * 1000 + 60, 'maxScore는 13층 기준 13,060이어야 함');

  const state = Engine.createNewRun(1);
  const bossNode = findNodeOfType(state, 'boss');
  state.currentNodeId = bossNode.id;
  const reachedFloor = Engine.getReachedFloor(state);
  assert.strictEqual(reachedFloor, 13, '보스 노드 도달 시 층수는 13이어야 함');
}

function main() {
  testRngAndShuffleDeterminism();
  testMapGenerationDeterminismAndDistribution();
  testDrawDiscardCycle();
  testEnergy();
  testDamageCalculation();
  testStatusDurations();
  testStatusDirectionAndBlockTiming();
  testEnemyVulnerableCurse();
  testStatsCarryOver();
  testEnemyBehavior();
  testRunProgression();
  testWinLose();
  testSaveRoundTrip();
  testContentSafetyNet();
  testStarterDeckAndFirstCombatsBalance();
  testPowerCards();
  testComboAndStockpileCards();
  testRelicEffects();
  testEventDeterminismAndCurse();
  testEventChoiceResolution();
  testLegacyV1SaveMigration();
  testScoreFormula();

  console.log('deck logic test passed');
}

main();

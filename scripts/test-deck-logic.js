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

function testRngAndShuffleDeterminism() {
  const { Engine } = loadEngine();

  const run1a = Engine.createNewRun(42);
  const run1b = Engine.createNewRun(42);
  assert.deepStrictEqual(run1a.enemyAssignment, run1b.enemyAssignment, '같은 시드는 같은 런 배치를 만들어야 함');

  const run2 = Engine.createNewRun(43);
  assert.notDeepStrictEqual(run1a.enemyAssignment, run2.enemyAssignment, '다른 시드는 다른 배치를 만들어야 함(우연 일치 가능성 낮음)');

  // 같은 시드는 같은 카드 보상도 만들어야 함
  const stateA = Engine.createNewRun(7);
  const trackerA = Engine.trackerFromState(stateA);
  Engine.enterCurrentNode(stateA, trackerA);
  Engine.commitTracker(stateA, trackerA);
  stateA.combat.enemyHp = 0;
  const trackerA2 = Engine.trackerFromState(stateA);
  Engine.checkCombatOutcome(stateA, trackerA2);
  Engine.commitTracker(stateA, trackerA2);

  const stateB = Engine.createNewRun(7);
  const trackerB = Engine.trackerFromState(stateB);
  Engine.enterCurrentNode(stateB, trackerB);
  Engine.commitTracker(stateB, trackerB);
  stateB.combat.enemyHp = 0;
  const trackerB2 = Engine.trackerFromState(stateB);
  Engine.checkCombatOutcome(stateB, trackerB2);
  Engine.commitTracker(stateB, trackerB2);

  assert.deepStrictEqual(stateA.pendingReward, stateB.pendingReward, '같은 시드는 같은 카드 보상을 제시해야 함');
}

function testDrawDiscardCycle() {
  const { Content, Engine } = loadEngine();
  const state = Engine.createNewRun(1);
  const tracker = Engine.trackerFromState(state);
  Engine.enterCurrentNode(state, tracker);
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
  Engine.enterCurrentNode(state2, t2);
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
  Engine.enterCurrentNode(state, tracker);
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
  Engine.enterCurrentNode(state, tracker);
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
  Engine.enterCurrentNode(state, tracker);
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
  state.enemyAssignment[0] = 'crumb-ant';
  const tracker = Engine.trackerFromState(state);
  Engine.enterCurrentNode(state, tracker);
  Engine.commitTracker(state, tracker);

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

  assert.strictEqual(Content.RUN_LAYOUT.length, 11);
  assert.deepStrictEqual(
    Array.from(Content.RUN_LAYOUT).map((n) => String(n.type)),
    ['normal', 'normal', 'normal', 'rest', 'elite', 'normal', 'normal', 'rest', 'normal', 'elite', 'boss'],
    '11칸 구성이 계획서 3절 배치와 일치해야 함'
  );

  // 일반 적 중복 없음
  const normalAssignments = state.enemyAssignment.filter((id, index) => Content.RUN_LAYOUT[index].type === 'normal');
  const uniqueNormal = new Set(normalAssignments);
  assert.strictEqual(uniqueNormal.size, normalAssignments.length, '일반 적은 중복 없이 배치돼야 함');

  // 휴식 회복 30% 상한
  const restState = Engine.createNewRun(22);
  restState.player.hp = 10;
  restState.runIndex = 3;
  restState.screen = 'rest';
  const healResult = Engine.applyRestHeal(restState);
  assert.strictEqual(healResult.success, true);
  assert.strictEqual(healResult.healAmount, Math.floor(restState.player.maxHp * Content.REST_HEAL_PERCENT));
  assert.strictEqual(restState.player.hp, 10 + healResult.healAmount);
  assert.strictEqual(restState.runIndex, 4, '휴식 후 다음 칸으로 진행해야 함');

  // 휴식 카드 제거
  const removeState = Engine.createNewRun(23);
  removeState.runIndex = 3;
  removeState.screen = 'rest';
  const deckSizeBefore = removeState.player.deck.length;
  const removeResult = Engine.applyRestRemoveCard(removeState, 0);
  assert.strictEqual(removeResult.success, true);
  assert.strictEqual(removeState.player.deck.length, deckSizeBefore - 1);

  // 정예/보스 보상은 정예급 1장 이상 보장
  const eliteState = Engine.createNewRun(24);
  eliteState.runIndex = 4; // elite node
  const tracker = Engine.trackerFromState(eliteState);
  Engine.enterCurrentNode(eliteState, tracker);
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

function testWinLose() {
  const { Engine } = loadEngine();

  // 적 HP 0 → 전투 승리, 상태 초기화, HP 유지
  const state = Engine.createNewRun(31);
  const tracker = Engine.trackerFromState(state);
  Engine.enterCurrentNode(state, tracker);
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
  Engine.enterCurrentNode(state2, tracker3);
  Engine.commitTracker(state2, tracker3);
  state2.player.hp = 0;
  const outcome2 = Engine.checkCombatOutcome(state2);
  assert.strictEqual(outcome2, 'defeat');
  assert.strictEqual(state2.finished, true);
  assert.strictEqual(state2.victory, false);
  assert.strictEqual(state2.screen, 'result');

  // 보스 격파 → 클리어 기록 증가
  const state3 = Engine.createNewRun(33);
  state3.runIndex = 10;
  const tracker4 = Engine.trackerFromState(state3);
  Engine.enterCurrentNode(state3, tracker4);
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
  Engine.enterCurrentNode(state, tracker);
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

function simulateFirstTwoCombats(Engine, seed) {
  const state = Engine.createNewRun(seed);
  let tracker = Engine.trackerFromState(state);

  for (let combatIndex = 0; combatIndex < 2; combatIndex += 1) {
    Engine.enterCurrentNode(state, tracker);
    Engine.commitTracker(state, tracker);

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
  }

  return {
    wonFirstTwo: !state.finished || state.victory,
    hpRemainingRatio: state.player.hp / state.player.maxHp,
  };
}

function testStatusDirectionAndBlockTiming() {
  const { Engine } = loadEngine();

  // 약화 방향: 약화는 "공격자"가 주는 피해를 줄인다.
  const state = Engine.createNewRun(5);
  state.enemyAssignment[0] = 'crumb-ant';
  const tracker = Engine.trackerFromState(state);
  Engine.enterCurrentNode(state, tracker);
  Engine.commitTracker(state, tracker);
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
  state2.enemyAssignment[0] = 'crumb-ant'; // 첫 행동: 공격 5
  const t2 = Engine.trackerFromState(state2);
  Engine.enterCurrentNode(state2, t2);
  Engine.commitTracker(state2, t2);
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
  state.enemyAssignment[0] = 'mold-fairy';
  const tracker = Engine.trackerFromState(state);
  Engine.enterCurrentNode(state, tracker);
  Engine.commitTracker(state, tracker);

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
  assert.strictEqual(next.stats.bestNodeReached, 7, '최고 도달 칸은 새 런에 이어져야 함');
  assert.strictEqual(next.stats.enemiesDefeated, 0, '처치 수는 런 단위로 초기화돼야 함');
}

function main() {
  testRngAndShuffleDeterminism();
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

  console.log('deck logic test passed');
}

main();

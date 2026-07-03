(function (root) {
  'use strict';

  // 순수 로직 모듈. DOM, localStorage, Date.now(), Math.random()을 직접 참조하지 않는다.
  // 난수가 필요한 모든 함수는 rng 함수(또는 rng를 감싼 tracker)를 인자로 받는다.

  var Content = (typeof root !== 'undefined' && root.DeckContent)
    || (typeof require === 'function' ? require('./content') : null);

  // ---- 시드 RNG (match3 board.js와 동일한 LCG 패턴) ----

  function createRng(seed) {
    var state = (typeof seed === 'number' && Number.isFinite(seed))
      ? Math.floor(seed) % 2147483647
      : 1;

    if (state <= 0) {
      state += 2147483646;
    }

    return function next() {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }

  // 저장/복원 후에도 이후 셔플이 동일하도록, 호출 횟수를 세는 RNG 래퍼를 만든다.
  // tracker.rng()를 호출할 때마다 tracker.callCount가 증가한다.
  function createRngTracker(seed, callCount) {
    var rng = createRng(seed);
    var count = 0;
    var skip = typeof callCount === 'number' && callCount > 0 ? callCount : 0;
    for (var i = 0; i < skip; i += 1) {
      rng();
      count += 1;
    }
    return {
      seed: seed,
      next: function () {
        count += 1;
        return rng();
      },
      getCallCount: function () {
        return count;
      },
    };
  }

  function randomInt(tracker, maxExclusive) {
    var index = Math.floor(tracker.next() * maxExclusive);
    if (index >= maxExclusive) {
      index = maxExclusive - 1;
    }
    if (index < 0) {
      index = 0;
    }
    return index;
  }

  // Fisher-Yates 셔플. 원본 배열은 변경하지 않는다.
  function shuffle(tracker, list) {
    var result = list.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var j = randomInt(tracker, i + 1);
      var temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  function pickN(tracker, list, n) {
    var shuffled = shuffle(tracker, list);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  // ---- 콘텐츠 조회 ----

  function findCard(id) {
    for (var i = 0; i < Content.CARDS.length; i += 1) {
      if (Content.CARDS[i].id === id) {
        return Content.CARDS[i];
      }
    }
    return null;
  }

  function findEnemy(id) {
    for (var i = 0; i < Content.ENEMIES.length; i += 1) {
      if (Content.ENEMIES[i].id === id) {
        return Content.ENEMIES[i];
      }
    }
    return null;
  }

  function cardsByRarity(rarity) {
    return Content.CARDS.filter(function (card) {
      return card.rarity === rarity;
    });
  }

  function enemiesByTier(tier) {
    return Content.ENEMIES.filter(function (enemy) {
      return enemy.tier === tier;
    });
  }

  // ---- 런 배정 (11칸에 대해 일반/정예 적을 시드 셔플로 배정) ----

  function buildEnemyAssignment(tracker) {
    var normalIds = enemiesByTier('normal').map(function (e) { return e.id; });
    var eliteIds = enemiesByTier('elite').map(function (e) { return e.id; });
    var bossId = enemiesByTier('boss')[0].id;

    var normalCount = Content.RUN_LAYOUT.filter(function (n) { return n.type === 'normal'; }).length;
    var eliteCount = Content.RUN_LAYOUT.filter(function (n) { return n.type === 'elite'; }).length;

    var shuffledNormal = shuffle(tracker, normalIds).slice(0, normalCount);
    var shuffledElite = shuffle(tracker, eliteIds).slice(0, eliteCount);

    var normalCursor = 0;
    var eliteCursor = 0;

    return Content.RUN_LAYOUT.map(function (node) {
      if (node.type === 'normal') {
        var id = shuffledNormal[normalCursor];
        normalCursor += 1;
        return id;
      }
      if (node.type === 'elite') {
        var eliteId = shuffledElite[eliteCursor];
        eliteCursor += 1;
        return eliteId;
      }
      if (node.type === 'boss') {
        return bossId;
      }
      return null;
    });
  }

  // ---- 새 런 상태 ----

  function buildStarterDeck() {
    var deck = [];
    Content.STARTER_DECK.forEach(function (entry) {
      for (var i = 0; i < entry.count; i += 1) {
        deck.push(entry.id);
      }
    });
    return deck;
  }

  // previousStats: 이전 런의 stats. 통산 기록(클리어 횟수·최고 도달 칸)은 새 런에도
  // 이어지고, 처치 수는 런 단위로 초기화한다.
  function createNewRun(seed, previousStats) {
    var tracker = createRngTracker(seed, 0);
    var enemyAssignment = buildEnemyAssignment(tracker);

    return {
      version: Content.SAVE_VERSION,
      seed: seed,
      rngCallCount: tracker.getCallCount(),
      runIndex: 0,
      screen: 'run',
      player: {
        hp: Content.PLAYER_MAX_HP,
        maxHp: Content.PLAYER_MAX_HP,
        deck: buildStarterDeck(),
        drawPile: [],
        discardPile: [],
        hand: [],
        energy: Content.PLAYER_ENERGY_PER_TURN,
      },
      enemyAssignment: enemyAssignment,
      combat: null,
      pendingReward: null,
      pendingRest: false,
      stats: {
        clearCount: (previousStats && previousStats.clearCount) || 0,
        bestNodeReached: (previousStats && previousStats.bestNodeReached) || 0,
        enemiesDefeated: 0,
      },
      finished: false,
      victory: false,
    };
  }

  // ---- 트래커 생성 헬퍼 (state로부터) ----

  function trackerFromState(state) {
    return createRngTracker(state.seed, state.rngCallCount);
  }

  function commitTracker(state, tracker) {
    state.rngCallCount = tracker.getCallCount();
  }

  // ---- 덱 셔플/드로우/버림 ----

  // 뽑을 덱(drawPile)이 비어 있으면 버림 더미(discardPile)를 셔플해 새 drawPile로 삼는다.
  function reshuffleIfNeeded(player, tracker) {
    if (player.drawPile.length === 0 && player.discardPile.length > 0) {
      player.drawPile = shuffle(tracker, player.discardPile);
      player.discardPile = [];
    }
  }

  function drawCards(player, count, tracker) {
    var drawn = [];
    for (var i = 0; i < count; i += 1) {
      reshuffleIfNeeded(player, tracker);
      if (player.drawPile.length === 0) {
        // 버림 더미도 비어 있으면 더 뽑을 카드가 없다.
        break;
      }
      var card = player.drawPile.pop();
      player.hand.push(card);
      drawn.push(card);
    }
    return drawn;
  }

  function discardHand(player) {
    player.discardPile = player.discardPile.concat(player.hand);
    player.hand = [];
  }

  // ---- 전투 시작/턴 진행 ----

  function startCombat(state, enemyId, tracker) {
    var enemy = findEnemy(enemyId);
    var player = state.player;

    player.drawPile = shuffle(tracker, player.deck);
    player.discardPile = [];
    player.hand = [];
    player.energy = Content.PLAYER_ENERGY_PER_TURN;

    state.combat = {
      enemyId: enemyId,
      enemyHp: enemy.maxHp,
      enemyMaxHp: enemy.maxHp,
      enemyBlock: 0,
      enemyStrength: 0,
      enemyWeak: 0,
      enemyVulnerable: 0,
      enemyPatternIndex: 0,
      playerBlock: 0,
      playerStrength: 0,
      playerWeak: 0,
      playerVulnerable: 0,
      turn: 1,
      log: [],
    };

    drawCards(player, Content.PLAYER_DRAW_PER_TURN, tracker);

    return state.combat;
  }

  function getEnemyIntent(state) {
    var combat = state.combat;
    var enemy = findEnemy(combat.enemyId);
    var index = combat.enemyPatternIndex % enemy.pattern.length;
    return enemy.pattern[index];
  }

  // ---- 피해 계산 ----
  // 순서: (기본 피해 + 힘) × 약화(0.75, 내림) × 취약(1.5, 내림) → 방어도 차감 → HP 차감.
  // 곱연산 직후 내림을 적용한다. 다단 히트는 히트마다 방어도 차감을 반복한다.
  // 약화는 "공격자"가 주는 피해를 줄이고, 취약은 "방어자"가 받는 피해를 늘린다.
  function computeHitDamage(baseDamage, attackerStrength, attackerWeak, defenderVulnerable) {
    var amount = baseDamage + (attackerStrength || 0);
    if (amount < 0) {
      amount = 0;
    }
    if (attackerWeak > 0) {
      amount = Math.floor(amount * Content.WEAK_MULTIPLIER);
    }
    if (defenderVulnerable > 0) {
      amount = Math.floor(amount * Content.VULNERABLE_MULTIPLIER);
    }
    return amount;
  }

  // 방어도를 먼저 소모하고 남은 만큼 HP를 깎는다. { block, hpLoss }를 반환.
  function applyDamageToTarget(target, amount) {
    var block = target.block || 0;
    var absorbed = Math.min(block, amount);
    var remaining = amount - absorbed;
    target.block = block - absorbed;
    var hpLoss = remaining;
    return { absorbed: absorbed, hpLoss: hpLoss };
  }

  // 플레이어가 적에게 히트를 가한다 (다단 히트 시 히트마다 호출).
  // 내 공격은 "내" 약화와 "적"의 취약에 영향을 받는다.
  function playerHitsEnemy(state, baseDamage) {
    var combat = state.combat;
    var amount = computeHitDamage(baseDamage, combat.playerStrength, combat.playerWeak || 0, combat.enemyVulnerable || 0);
    var target = { block: combat.enemyBlock };
    var result = applyDamageToTarget(target, amount);
    combat.enemyBlock = target.block;
    combat.enemyHp = Math.max(0, combat.enemyHp - result.hpLoss);
    return { amount: amount, hpLoss: result.hpLoss };
  }

  // 적이 플레이어에게 히트를 가한다. 적의 공격은 "적"의 약화와 "플레이어"의 취약에 영향을 받는다.
  function enemyHitsPlayer(state, baseDamage) {
    var combat = state.combat;
    var amount = computeHitDamage(baseDamage, combat.enemyStrength, combat.enemyWeak || 0, combat.playerVulnerable);
    var target = { block: combat.playerBlock };
    var result = applyDamageToTarget(target, amount);
    combat.playerBlock = target.block;
    state.player.hp = Math.max(0, state.player.hp - result.hpLoss);
    return { amount: amount, hpLoss: result.hpLoss };
  }

  // ---- 카드 사용 ----

  function canPlayCard(state, cardId) {
    var card = findCard(cardId);
    if (!card) {
      return false;
    }
    if (state.combat === null) {
      return false;
    }
    if (state.combat.enemyHp <= 0 || state.player.hp <= 0) {
      return false;
    }
    return state.player.energy >= card.cost;
  }

  // 카드 효과를 프리미티브 조합으로 해석해 적용한다. 카드별 if 분기를 두지 않는다.
  function applyCardEffect(state, card) {
    var effect = card.effect;
    var combat = state.combat;
    var player = state.player;
    var results = { hits: [] };

    if (effect.strength) {
      combat.playerStrength += effect.strength;
    }
    if (effect.block) {
      combat.playerBlock += effect.block;
    }
    if (effect.damage) {
      var hitCount = effect.hits || 1;
      for (var i = 0; i < hitCount; i += 1) {
        results.hits.push(playerHitsEnemy(state, effect.damage));
      }
    }
    if (effect.weak) {
      combat.enemyWeak = (combat.enemyWeak || 0) + effect.weak;
    }
    if (effect.vulnerable) {
      combat.enemyVulnerable = (combat.enemyVulnerable || 0) + effect.vulnerable;
    }
    if (effect.heal) {
      player.hp = Math.min(player.maxHp, player.hp + effect.heal);
    }
    if (effect.selfDamage) {
      player.hp = Math.max(0, player.hp - effect.selfDamage);
    }
    if (effect.energy) {
      player.energy += effect.energy;
    }
    if (effect.draw) {
      // draw는 호출부(playCard)에서 tracker를 받아 처리한다.
      results.drawCount = effect.draw;
    }

    return results;
  }

  function playCard(state, cardId, handIndex, tracker) {
    if (!canPlayCard(state, cardId)) {
      return { success: false, reason: 'CANNOT_PLAY' };
    }
    var card = findCard(cardId);
    var player = state.player;

    var index = handIndex;
    if (index === undefined || index === null || player.hand[index] !== cardId) {
      index = player.hand.indexOf(cardId);
    }
    if (index === -1) {
      return { success: false, reason: 'NOT_IN_HAND' };
    }

    player.energy -= card.cost;
    player.hand.splice(index, 1);
    player.discardPile.push(cardId);

    var results = applyCardEffect(state, card);
    if (results.drawCount) {
      drawCards(player, results.drawCount, tracker);
    }

    checkCombatOutcome(state, tracker);

    return { success: true, card: card, results: results };
  }

  // ---- 적 행동 실행 ----

  function executeEnemyTurn(state, tracker) {
    var combat = state.combat;
    var intent = getEnemyIntent(state);
    var record = { intent: intent, hits: [] };

    if (intent.type === 'attack') {
      var hitCount = intent.hits || 1;
      for (var i = 0; i < hitCount; i += 1) {
        record.hits.push(enemyHitsPlayer(state, intent.amount));
      }
    } else if (intent.type === 'block') {
      combat.enemyBlock += intent.amount;
    } else if (intent.type === 'strength') {
      combat.enemyStrength += intent.amount;
    } else if (intent.type === 'weak') {
      combat.playerWeak += intent.amount;
    } else if (intent.type === 'vulnerable') {
      combat.playerVulnerable += intent.amount;
    }

    combat.enemyPatternIndex += 1;
    checkCombatOutcome(state, tracker);

    return record;
  }

  // 턴 종료 흐름. 각 상태 효과는 "그 효과가 발휘되는 턴"이 끝날 때 1턴 감소한다:
  //  - 플레이어의 약화(내 공격 감소)·적의 취약(내 공격 증폭)은 플레이어 턴이 끝날 때
  //  - 적의 약화(적 공격 감소)·플레이어의 취약(적 공격 증폭)은 적 턴이 끝날 때
  // 방어도는 "자기 턴 시작 시" 소멸한다 — 플레이어 방어도는 적의 공격을 받아낸 뒤
  // 다음 플레이어 턴이 시작될 때 비운다 (적 행동 전에 비우면 방어 카드가 무의미해진다).
  function endTurn(state, tracker) {
    var combat = state.combat;
    var player = state.player;

    discardHand(player);

    if (combat.playerWeak > 0) {
      combat.playerWeak -= 1;
    }
    if (combat.enemyVulnerable > 0) {
      combat.enemyVulnerable -= 1;
    }

    if (state.combat && combat.enemyHp > 0 && player.hp > 0) {
      // 적 턴 시작: 적이 이전 턴에 얻은 방어도가 소멸한다 (이번 턴에 새로 얻는 방어도는 유지됨).
      combat.enemyBlock = 0;
      executeEnemyTurn(state, tracker);
      if (state.combat) {
        if (combat.enemyWeak > 0) {
          combat.enemyWeak -= 1;
        }
        if (combat.playerVulnerable > 0) {
          combat.playerVulnerable -= 1;
        }
      }
    }

    if (state.combat && combat.enemyHp > 0 && state.player.hp > 0) {
      // 플레이어 턴 시작: 지난 턴의 방어도가 소멸하고 에너지/드로우를 리셋한다.
      combat.playerBlock = 0;
      combat.turn += 1;
      player.energy = Content.PLAYER_ENERGY_PER_TURN;
      drawCards(player, Content.PLAYER_DRAW_PER_TURN, tracker);
    }

    return state.combat;
  }

  // ---- 승패 판정 ----

  function checkCombatOutcome(state, tracker) {
    var combat = state.combat;
    if (!combat) {
      return null;
    }
    if (combat.enemyHp <= 0) {
      var enemy = findEnemy(combat.enemyId);
      state.stats.enemiesDefeated += 1;
      state.combat = null;
      state.player.hand = [];
      state.player.discardPile = [];
      state.player.drawPile = [];
      if (enemy.tier === 'boss') {
        state.stats.clearCount += 1;
        state.stats.bestNodeReached = Math.max(state.stats.bestNodeReached, state.runIndex + 1);
        state.finished = true;
        state.victory = true;
        state.screen = 'result';
      } else {
        state.screen = 'reward';
        offerReward(state, tracker);
      }
      return 'victory';
    }
    if (state.player.hp <= 0) {
      state.combat = null;
      state.stats.bestNodeReached = Math.max(state.stats.bestNodeReached, state.runIndex);
      state.finished = true;
      state.victory = false;
      state.screen = 'result';
      return 'defeat';
    }
    return null;
  }

  // ---- 카드 보상 ----

  function generateCardReward(state, nodeType, tracker) {
    var pool = nodeType === 'elite' || nodeType === 'boss'
      ? cardsByRarity('common').concat(cardsByRarity('elite'))
      : cardsByRarity('common');

    var options;
    if (nodeType === 'elite' || nodeType === 'boss') {
      var eliteOptions = pickN(tracker, cardsByRarity('elite'), 1);
      var rest = pickN(tracker, pool.filter(function (c) {
        return c.id !== eliteOptions[0].id;
      }), Content.REWARD_CARD_COUNT - 1);
      options = eliteOptions.concat(rest);
    } else {
      options = pickN(tracker, pool, Content.REWARD_CARD_COUNT);
    }

    return options.map(function (card) {
      return card.id;
    });
  }

  function offerReward(state, tracker) {
    var node = Content.RUN_LAYOUT[state.runIndex];
    var rewardIds = generateCardReward(state, node.type, tracker);
    state.pendingReward = rewardIds;
    return rewardIds;
  }

  function chooseReward(state, cardId) {
    if (state.screen !== 'reward') {
      return { success: false, reason: 'NO_REWARD' };
    }
    if (cardId !== null && (!state.pendingReward || state.pendingReward.indexOf(cardId) === -1)) {
      return { success: false, reason: 'INVALID_CARD' };
    }
    if (cardId !== null) {
      state.player.deck.push(cardId);
    }
    state.pendingReward = null;
    advanceToNextNode(state);
    return { success: true };
  }

  // ---- 휴식 ----

  function applyRestHeal(state) {
    if (state.screen !== 'rest') {
      return { success: false, reason: 'NOT_RESTING' };
    }
    var healAmount = Math.floor(state.player.maxHp * Content.REST_HEAL_PERCENT);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
    advanceToNextNode(state);
    return { success: true, healAmount: healAmount };
  }

  function applyRestRemoveCard(state, deckIndex) {
    if (state.screen !== 'rest') {
      return { success: false, reason: 'NOT_RESTING' };
    }
    if (deckIndex < 0 || deckIndex >= state.player.deck.length) {
      return { success: false, reason: 'INVALID_INDEX' };
    }
    var removed = state.player.deck.splice(deckIndex, 1);
    advanceToNextNode(state);
    return { success: true, removedCardId: removed[0] };
  }

  // ---- 런 진행 ----

  function advanceToNextNode(state) {
    state.runIndex += 1;
    state.stats.bestNodeReached = Math.max(state.stats.bestNodeReached, state.runIndex);
    if (state.runIndex >= Content.RUN_LAYOUT.length) {
      state.screen = 'result';
      state.finished = true;
      return;
    }
    state.screen = 'run';
  }

  // 현재 칸에 진입한다 (전투 시작 또는 휴식 화면 전환). runIndex가 가리키는 노드를 소비한다.
  function enterCurrentNode(state, tracker) {
    var node = Content.RUN_LAYOUT[state.runIndex];
    if (!node) {
      return { success: false, reason: 'RUN_COMPLETE' };
    }
    if (node.type === 'rest') {
      state.screen = 'rest';
      return { success: true, type: 'rest' };
    }
    var enemyId = state.enemyAssignment[state.runIndex];
    startCombat(state, enemyId, tracker);
    state.screen = 'combat';
    return { success: true, type: 'combat', enemyId: enemyId };
  }

  // ---- 저장/불러오기 ----

  function serializeState(state) {
    return JSON.stringify(state);
  }

  function isValidLoadedState(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }
    if (candidate.version !== Content.SAVE_VERSION) {
      return false;
    }
    if (typeof candidate.seed !== 'number') {
      return false;
    }
    if (typeof candidate.rngCallCount !== 'number' || candidate.rngCallCount < 0) {
      return false;
    }
    if (typeof candidate.runIndex !== 'number' || candidate.runIndex < 0) {
      return false;
    }
    if (!candidate.player || typeof candidate.player !== 'object') {
      return false;
    }
    if (typeof candidate.player.hp !== 'number' || candidate.player.hp < 0) {
      return false;
    }
    if (typeof candidate.player.maxHp !== 'number' || candidate.player.maxHp <= 0) {
      return false;
    }
    if (!Array.isArray(candidate.player.deck)) {
      return false;
    }
    if (!Array.isArray(candidate.enemyAssignment)) {
      return false;
    }
    if (!candidate.stats || typeof candidate.stats !== 'object') {
      return false;
    }
    return true;
  }

  function deserializeState(raw) {
    if (typeof raw !== 'string' || raw.length === 0) {
      return null;
    }
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    if (!isValidLoadedState(parsed)) {
      return null;
    }
    return parsed;
  }

  // ---- 콘텐츠 안전망 검증 ----

  var KNOWN_EFFECT_KEYS = [
    'damage', 'hits', 'block', 'draw', 'energy', 'strength', 'weak', 'vulnerable', 'heal', 'selfDamage',
  ];
  var KNOWN_INTENT_TYPES = ['attack', 'block', 'strength', 'weak', 'vulnerable'];

  function validateContent() {
    var problems = [];

    Content.CARDS.forEach(function (card) {
      Object.keys(card.effect).forEach(function (key) {
        if (KNOWN_EFFECT_KEYS.indexOf(key) === -1) {
          problems.push('card ' + card.id + '의 effect 키 "' + key + '"가 엔진에 알려지지 않음');
        }
      });
    });

    Content.ENEMIES.forEach(function (enemy) {
      if (!Array.isArray(enemy.pattern) || enemy.pattern.length === 0) {
        problems.push('enemy ' + enemy.id + '의 pattern이 비어 있음');
        return;
      }
      enemy.pattern.forEach(function (action) {
        if (KNOWN_INTENT_TYPES.indexOf(action.type) === -1) {
          problems.push('enemy ' + enemy.id + '의 행동 타입 "' + action.type + '"이 엔진에 알려지지 않음');
        }
      });
    });

    Content.RUN_LAYOUT.forEach(function (node, index) {
      if (node.type === 'normal' || node.type === 'elite' || node.type === 'boss') {
        var pool = enemiesByTier(node.type);
        if (pool.length === 0) {
          problems.push('run layout 노드 ' + index + '(' + node.type + ')에 대응하는 적이 없음');
        }
      }
    });

    return problems;
  }

  var DeckEngine = {
    createRng: createRng,
    createRngTracker: createRngTracker,
    randomInt: randomInt,
    shuffle: shuffle,
    pickN: pickN,
    findCard: findCard,
    findEnemy: findEnemy,
    cardsByRarity: cardsByRarity,
    enemiesByTier: enemiesByTier,
    buildEnemyAssignment: buildEnemyAssignment,
    buildStarterDeck: buildStarterDeck,
    createNewRun: createNewRun,
    trackerFromState: trackerFromState,
    commitTracker: commitTracker,
    reshuffleIfNeeded: reshuffleIfNeeded,
    drawCards: drawCards,
    discardHand: discardHand,
    startCombat: startCombat,
    getEnemyIntent: getEnemyIntent,
    computeHitDamage: computeHitDamage,
    applyDamageToTarget: applyDamageToTarget,
    playerHitsEnemy: playerHitsEnemy,
    enemyHitsPlayer: enemyHitsPlayer,
    canPlayCard: canPlayCard,
    applyCardEffect: applyCardEffect,
    playCard: playCard,
    executeEnemyTurn: executeEnemyTurn,
    endTurn: endTurn,
    checkCombatOutcome: checkCombatOutcome,
    generateCardReward: generateCardReward,
    offerReward: offerReward,
    chooseReward: chooseReward,
    applyRestHeal: applyRestHeal,
    applyRestRemoveCard: applyRestRemoveCard,
    advanceToNextNode: advanceToNextNode,
    enterCurrentNode: enterCurrentNode,
    serializeState: serializeState,
    isValidLoadedState: isValidLoadedState,
    deserializeState: deserializeState,
    validateContent: validateContent,
  };

  root.DeckEngine = DeckEngine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeckEngine;
  }
})(typeof window !== 'undefined' ? window : this);

(function () {
  'use strict';

  var Content = window.DeckContent;
  var Engine = window.DeckEngine;

  var state = null;
  var tracker = null;

  var NODE_TYPE_LABEL = {
    normal: '일반 전투',
    elite: '정예 전투',
    rest: '휴식',
    boss: '보스 전투',
  };

  var INTENT_LABEL = {
    attack: '공격',
    block: '방어',
    strength: '강화',
    weak: '저주(약화)',
    vulnerable: '저주(취약)',
  };

  var EFFECT_DESCRIPTION_ORDER = ['damage', 'block', 'draw', 'energy', 'strength', 'weak', 'vulnerable', 'heal', 'selfDamage'];

  function describeEffect(card) {
    var effect = card.effect;
    var parts = [];
    EFFECT_DESCRIPTION_ORDER.forEach(function (key) {
      if (effect[key] === undefined) {
        return;
      }
      switch (key) {
        case 'damage':
          if (effect.hits && effect.hits > 1) {
            parts.push('피해 ' + effect.damage + ' × ' + effect.hits + '회');
          } else {
            parts.push('피해 ' + effect.damage);
          }
          break;
        case 'block':
          parts.push('방어도 ' + effect.block);
          break;
        case 'draw':
          parts.push('카드 ' + effect.draw + '장 뽑기');
          break;
        case 'energy':
          parts.push('에너지 +' + effect.energy);
          break;
        case 'strength':
          parts.push('힘 +' + effect.strength);
          break;
        case 'weak':
          parts.push('약화 ' + effect.weak + '턴');
          break;
        case 'vulnerable':
          parts.push('취약 ' + effect.vulnerable + '턴');
          break;
        case 'heal':
          parts.push('HP ' + effect.heal + ' 회복');
          break;
        case 'selfDamage':
          parts.push('자신 HP ' + effect.selfDamage + ' 감소');
          break;
        default:
          break;
      }
    });
    return parts.join(', ');
  }

  // ---- URL 시드 ----

  function getSeedFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var seedParam = params.get('seed');
    if (seedParam === null || seedParam === '') {
      return undefined;
    }
    var parsed = Number(seedParam);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function generateRandomSeed() {
    return Math.floor(Math.random() * 2147483646) + 1;
  }

  // ---- 저장/불러오기 ----

  function loadState() {
    var raw = null;
    try {
      raw = window.localStorage.getItem(Content.SAVE_KEY);
    } catch (error) {
      console.warn('저장 데이터를 읽지 못했어요:', error.message);
    }

    var loaded = raw ? Engine.deserializeState(raw) : null;
    if (!loaded) {
      if (raw) {
        console.warn('저장 데이터가 손상돼 있어 새 게임을 시작해요.');
      }
      return null;
    }
    return loaded;
  }

  function saveState() {
    try {
      window.localStorage.setItem(Content.SAVE_KEY, Engine.serializeState(state));
    } catch (error) {
      console.warn('저장에 실패했어요:', error.message);
    }
  }

  function startNewRun() {
    var seed = getSeedFromUrl();
    if (seed === undefined) {
      seed = generateRandomSeed();
    }
    state = Engine.createNewRun(seed);
    tracker = Engine.trackerFromState(state);
  }

  function refreshTracker() {
    tracker = Engine.trackerFromState(state);
  }

  function commit() {
    Engine.commitTracker(state, tracker);
    saveState();
    renderAll();
  }

  // ---- DOM 참조 ----

  var runProgressLabelEl = document.getElementById('run-progress-label');
  var playerHpValueEl = document.getElementById('player-hp-value');
  var runTrackEl = document.getElementById('run-track');

  var screens = {
    run: document.getElementById('screen-run'),
    combat: document.getElementById('screen-combat'),
    reward: document.getElementById('screen-reward'),
    rest: document.getElementById('screen-rest'),
    result: document.getElementById('screen-result'),
  };

  var runNodeDescriptionEl = document.getElementById('run-node-description');
  var advanceButton = document.getElementById('advance-button');

  var enemyNameEl = document.getElementById('enemy-name');
  var enemyHpValueEl = document.getElementById('enemy-hp-value');
  var enemyBlockValueEl = document.getElementById('enemy-block-value');
  var enemyStatusRowEl = document.getElementById('enemy-status-row');
  var enemyIntentValueEl = document.getElementById('enemy-intent-value');
  var playerStatusRowEl = document.getElementById('player-status-row');
  var playerBlockValueEl = document.getElementById('player-block-value');
  var handListEl = document.getElementById('hand-list');
  var energyValueEl = document.getElementById('energy-value');
  var endTurnButton = document.getElementById('end-turn-button');

  var rewardCardListEl = document.getElementById('reward-card-list');
  var skipRewardButton = document.getElementById('skip-reward-button');

  var restHealButton = document.getElementById('rest-heal-button');
  var restRemoveButton = document.getElementById('rest-remove-button');
  var restRemoveListEl = document.getElementById('rest-remove-list');

  var resultHeadingEl = document.getElementById('result-heading');
  var resultCopyEl = document.getElementById('result-copy');
  var resultNodeEl = document.getElementById('result-node');
  var resultDefeatedEl = document.getElementById('result-defeated');
  var resultDeckSizeEl = document.getElementById('result-deck-size');
  var resultClearCountEl = document.getElementById('result-clear-count');
  var resultBestNodeEl = document.getElementById('result-best-node');
  var restartButton = document.getElementById('restart-button');

  // ---- 렌더링 ----

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('hidden', key !== name);
    });
  }

  function renderHeader() {
    var total = Content.RUN_LAYOUT.length;
    var current = Math.min(state.runIndex + 1, total);
    runProgressLabelEl.textContent = current + ' / ' + total + '칸';
    playerHpValueEl.textContent = state.player.hp + ' / ' + state.player.maxHp;
  }

  function renderRunTrack() {
    runTrackEl.innerHTML = '';
    Content.RUN_LAYOUT.forEach(function (node, index) {
      var el = document.createElement('div');
      el.className = 'run-node';
      if (index < state.runIndex) {
        el.classList.add('done');
      }
      if (index === state.runIndex) {
        el.classList.add('current');
      }
      var emoji = node.type === 'rest' ? '☕'
        : node.type === 'elite' ? '⚔️'
        : node.type === 'boss' ? '👑'
        : '🍪';
      el.textContent = emoji;
      runTrackEl.appendChild(el);
    });
  }

  function renderRunScreen() {
    if (state.runIndex >= Content.RUN_LAYOUT.length) {
      return;
    }
    var node = Content.RUN_LAYOUT[state.runIndex];
    runNodeDescriptionEl.textContent = '다음 칸: ' + NODE_TYPE_LABEL[node.type];
  }

  function statusBadges(container, strength, weak, vulnerable) {
    container.innerHTML = '';
    if (strength) {
      var s = document.createElement('span');
      s.className = 'status-badge strength';
      s.textContent = '힘 +' + strength;
      container.appendChild(s);
    }
    if (weak > 0) {
      var w = document.createElement('span');
      w.className = 'status-badge weak';
      w.textContent = '약화 ' + weak + '턴';
      container.appendChild(w);
    }
    if (vulnerable > 0) {
      var v = document.createElement('span');
      v.className = 'status-badge vulnerable';
      v.textContent = '취약 ' + vulnerable + '턴';
      container.appendChild(v);
    }
  }

  function renderCombatScreen() {
    var combat = state.combat;
    if (!combat) {
      return;
    }
    var enemy = Engine.findEnemy(combat.enemyId);
    enemyNameEl.textContent = enemy.name;
    enemyHpValueEl.textContent = Math.max(0, combat.enemyHp) + ' / ' + combat.enemyMaxHp;

    if (combat.enemyBlock > 0) {
      enemyBlockValueEl.textContent = '방어 ' + combat.enemyBlock;
      enemyBlockValueEl.classList.remove('hidden');
    } else {
      enemyBlockValueEl.classList.add('hidden');
    }

    statusBadges(enemyStatusRowEl, combat.enemyStrength, combat.enemyWeak, combat.enemyVulnerable);
    statusBadges(playerStatusRowEl, combat.playerStrength, combat.playerWeak, combat.playerVulnerable);

    if (combat.playerBlock > 0) {
      playerBlockValueEl.textContent = '방어 ' + combat.playerBlock;
      playerBlockValueEl.classList.remove('hidden');
    } else {
      playerBlockValueEl.classList.add('hidden');
    }

    var intent = Engine.getEnemyIntent(state);
    var intentText = INTENT_LABEL[intent.type];
    if (intent.type === 'attack') {
      intentText += ' ' + intent.amount + (intent.hits && intent.hits > 1 ? ' × ' + intent.hits + '회' : '');
    } else if (intent.amount) {
      intentText += ' ' + intent.amount;
    }
    enemyIntentValueEl.textContent = intentText;

    energyValueEl.textContent = String(state.player.energy);

    renderHand();
  }

  function renderHand() {
    handListEl.innerHTML = '';
    state.player.hand.forEach(function (cardId, index) {
      var card = Engine.findCard(cardId);
      var el = document.createElement('div');
      el.className = 'card' + (card.rarity === 'elite' ? ' card-elite' : '');

      var playable = Engine.canPlayCard(state, cardId);
      if (!playable) {
        el.classList.add('card-disabled');
      }

      var cost = document.createElement('span');
      cost.className = 'card-cost';
      cost.textContent = String(card.cost);

      var name = document.createElement('p');
      name.className = 'card-name';
      name.textContent = card.name;

      var description = document.createElement('p');
      description.className = 'card-description';
      description.textContent = describeEffect(card);

      el.appendChild(cost);
      el.appendChild(name);
      el.appendChild(description);

      el.addEventListener('click', function () {
        handleCardTap(cardId, index);
      });

      handListEl.appendChild(el);
    });
  }

  function handleCardTap(cardId, index) {
    if (!state.combat) {
      return;
    }
    refreshTracker();
    var result = Engine.playCard(state, cardId, index, tracker);
    if (result.success) {
      commit();
      if (state.screen !== 'combat') {
        onScreenChanged();
      }
    }
  }

  endTurnButton.addEventListener('click', function () {
    if (!state.combat) {
      return;
    }
    refreshTracker();
    Engine.endTurn(state, tracker);
    commit();
    if (state.screen !== 'combat') {
      onScreenChanged();
    }
  });

  function renderRewardScreen() {
    rewardCardListEl.innerHTML = '';
    (state.pendingReward || []).forEach(function (cardId) {
      var card = Engine.findCard(cardId);
      var el = document.createElement('div');
      el.className = 'card' + (card.rarity === 'elite' ? ' card-elite' : '');

      var cost = document.createElement('span');
      cost.className = 'card-cost';
      cost.textContent = String(card.cost);

      var name = document.createElement('p');
      name.className = 'card-name';
      name.textContent = card.name;

      var description = document.createElement('p');
      description.className = 'card-description';
      description.textContent = describeEffect(card);

      el.appendChild(cost);
      el.appendChild(name);
      el.appendChild(description);

      el.addEventListener('click', function () {
        var result = Engine.chooseReward(state, cardId);
        if (result.success) {
          commit();
          onScreenChanged();
        }
      });

      rewardCardListEl.appendChild(el);
    });
  }

  skipRewardButton.addEventListener('click', function () {
    var result = Engine.chooseReward(state, null);
    if (result.success) {
      commit();
      onScreenChanged();
    }
  });

  function renderRestScreen() {
    restRemoveListEl.classList.add('hidden');
    restRemoveListEl.innerHTML = '';
  }

  restHealButton.addEventListener('click', function () {
    var result = Engine.applyRestHeal(state);
    if (result.success) {
      commit();
      onScreenChanged();
    }
  });

  restRemoveButton.addEventListener('click', function () {
    restRemoveListEl.innerHTML = '';
    state.player.deck.forEach(function (cardId, index) {
      var card = Engine.findCard(cardId);
      var row = document.createElement('div');
      row.className = 'rest-remove-row';

      var label = document.createElement('span');
      label.textContent = card.name;

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'button secondary';
      button.textContent = '정리';
      button.addEventListener('click', function () {
        var result = Engine.applyRestRemoveCard(state, index);
        if (result.success) {
          commit();
          onScreenChanged();
        }
      });

      row.appendChild(label);
      row.appendChild(button);
      restRemoveListEl.appendChild(row);
    });
    restRemoveListEl.classList.remove('hidden');
  });

  function renderResultScreen() {
    var totalNodes = Content.RUN_LAYOUT.length;
    if (state.victory) {
      resultHeadingEl.textContent = '보스를 물리쳤어요';
      resultCopyEl.textContent = '간식 수호대가 공방을 지켜냈어요. 차분하게 잘 풀어낸 런이었어요.';
    } else {
      resultHeadingEl.textContent = '런이 끝났어요';
      resultCopyEl.textContent = '이번엔 여기까지예요. 다음 런에서 다시 도전해 보세요.';
    }
    resultNodeEl.textContent = Math.min(state.runIndex + 1, totalNodes) + ' / ' + totalNodes;
    resultDefeatedEl.textContent = String(state.stats.enemiesDefeated);
    resultDeckSizeEl.textContent = String(state.player.deck.length);
    resultClearCountEl.textContent = String(state.stats.clearCount);
    resultBestNodeEl.textContent = String(state.stats.bestNodeReached);
  }

  function renderAll() {
    renderHeader();
    renderRunTrack();

    if (state.screen === 'run') {
      renderRunScreen();
    } else if (state.screen === 'combat') {
      renderCombatScreen();
    } else if (state.screen === 'reward') {
      renderRewardScreen();
    } else if (state.screen === 'rest') {
      renderRestScreen();
    } else if (state.screen === 'result') {
      renderResultScreen();
    }

    showScreen(state.screen);
  }

  // 화면이 바뀐 직후, 진입 화면이 'run'이면 자동으로 다음 칸에 진입한다.
  function onScreenChanged() {
    renderAll();
  }

  advanceButton.addEventListener('click', function () {
    refreshTracker();
    var result = Engine.enterCurrentNode(state, tracker);
    if (result.success) {
      commit();
    }
  });

  restartButton.addEventListener('click', function () {
    startNewRun();
    saveState();
    renderAll();
  });

  // ---- beforeunload 저장 ----

  window.addEventListener('beforeunload', function () {
    if (state && !state.finished) {
      saveState();
    }
  });

  // ---- 초기화 ----

  function init() {
    var seedFromUrl = getSeedFromUrl();
    var restored = loadState();

    if (restored && seedFromUrl === undefined) {
      state = restored;
    } else {
      startNewRun();
    }

    refreshTracker();
    renderAll();
    saveState();
  }

  init();

  // 수동/로컬 QA용으로만 노출한다. 자동화 테스트는 이 값을 사용하지 않는다.
  window.DeckGame = {
    getState: function () {
      return state;
    },
  };
})();

(function () {
  'use strict';

  var Content = window.DeckContent;
  var Engine = window.DeckEngine;

  var state = null;
  var tracker = null;
  var scoreSubmittedForRun = false;

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

  // 카드 우상단 타입 아이콘 판정: damage 포함=공격, block 포함(damage 없음)=방어, 그 외=스킬.
  // (표시 전용 판정 — 카드 로직/저장 스키마에는 영향 없음.)
  function getCardTypeAsset(card) {
    var effect = card.effect;
    if (effect.damage !== undefined) {
      return '../shared/assets/deck-icon-attack.svg';
    }
    if (effect.block !== undefined) {
      return '../shared/assets/deck-icon-defense.svg';
    }
    return '../shared/assets/deck-icon-skill.svg';
  }

  // 하단 분류 표기(가이드 6.4절). 코드 판정 로직은 getCardTypeAsset과 동일 기준을 공유한다.
  function getCardTypeLabel(card) {
    var effect = card.effect;
    if (effect.damage !== undefined) {
      return 'ATTACK';
    }
    if (effect.block !== undefined) {
      return 'DEFENSE';
    }
    return 'SKILL';
  }

  // 카드 물성(가이드 6.4절): 로제트 코스트 메달 + 아트 창(현재는 타입 아이콘 SVG를
  // 재사용 — 래스터 원화 도착 시 .card-art-window img의 src만 교체하면 된다) +
  // 이름 + 룰 라인 + 하단 분류 표기 + 설명. 정예 카드는 el.className으로 구분(card-elite).
  function buildCardElement(card) {
    var el = document.createElement('div');
    el.className = 'card' + (card.rarity === 'elite' ? ' card-elite' : '');

    var costMedal = document.createElement('span');
    costMedal.className = 'card-cost';
    costMedal.textContent = String(card.cost);
    el.appendChild(costMedal);

    var artWindow = document.createElement('div');
    artWindow.className = 'card-art-window';
    var artImg = document.createElement('img');
    artImg.className = 'card-art-image';
    artImg.src = getCardTypeAsset(card);
    artImg.alt = '';
    artImg.loading = 'lazy';
    artImg.decoding = 'async';
    artWindow.appendChild(artImg);
    el.appendChild(artWindow);

    var name = document.createElement('p');
    name.className = 'card-name';
    name.textContent = card.name;
    el.appendChild(name);

    var ruleLine = document.createElement('div');
    ruleLine.className = 'card-rule-line';
    ruleLine.setAttribute('aria-hidden', 'true');
    el.appendChild(ruleLine);

    var description = document.createElement('p');
    description.className = 'card-description';
    description.textContent = describeEffect(card);
    el.appendChild(description);

    var typeLabel = document.createElement('span');
    typeLabel.className = 'card-type-label';
    typeLabel.textContent = getCardTypeLabel(card);
    el.appendChild(typeLabel);

    return el;
  }

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

  // previousStats를 넘기면 통산 기록(클리어 횟수·최고 도달 칸)이 새 런에 이어진다.
  function startNewRun(previousStats, options) {
    options = options || {};
    scoreSubmittedForRun = false;
    var seed = options.seed !== undefined ? Number(options.seed) : getSeedFromUrl();
    if (seed === undefined) {
      seed = generateRandomSeed();
    }
    state = Engine.createNewRun(seed, previousStats);
    state.challengeMode = options.mode === 'daily' ? 'daily' : 'free';
    state.challengeDayKey = options.dayKey || null;
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
  var hpChipEl = document.querySelector('.hp-chip');
  var runTrackEl = document.getElementById('run-track');
  var hitFlashEl = document.getElementById('hit-flash');

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
  var enemyAssetEl = document.querySelector('.enemy-asset');
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
  var resultLinkSectionEl = document.getElementById('result-link-section');
  var resultDailySectionEl = document.getElementById('result-daily-section');
  var resultRankingSectionEl = document.getElementById('result-ranking-section');
  var restartButton = document.getElementById('restart-button');
  var dailyRunButton = document.getElementById('daily-run-button');
  var dailyRunChip = document.getElementById('daily-run-chip');

  // ---- 연출 헬퍼 ----

  function retriggerAnimation(el, className) {
    if (!el) {
      return;
    }
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }

  function showDamagePopup(targetEl, amount) {
    if (!targetEl) {
      return;
    }
    var rect = targetEl.getBoundingClientRect();
    var parentRect = targetEl.offsetParent
      ? targetEl.offsetParent.getBoundingClientRect()
      : { left: 0, top: 0 };
    var popup = document.createElement('span');
    popup.className = 'gk-float-num danger';
    popup.textContent = '-' + amount;
    popup.style.left = (rect.left - parentRect.left + rect.width / 2) + 'px';
    popup.style.top = (rect.top - parentRect.top) + 'px';
    (targetEl.offsetParent || document.body).appendChild(popup);
    window.setTimeout(function () {
      popup.remove();
    }, 700);
  }

  function flashPlayerHit() {
    retriggerAnimation(hitFlashEl, 'flashing');
    retriggerAnimation(hpChipEl, 'gk-shake');
  }

  function shakeEnemy() {
    retriggerAnimation(enemyAssetEl, 'gk-shake');
  }

  function pulseBlockBadge(el) {
    retriggerAnimation(el, 'badge-gain');
  }

  // 사용한 카드는 복제본을 제자리에 띄워 연출한다. 원본 손패는 곧바로
  // 재렌더링되므로(입력 비블로킹) 원본에 클래스를 달아도 보이지 않는다.
  function animateCardPlay(cardEl) {
    if (!cardEl) {
      return;
    }
    var rect = cardEl.getBoundingClientRect();
    var clone = cardEl.cloneNode(true);
    clone.classList.add('card-playing');
    clone.style.position = 'fixed';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.margin = '0';
    clone.style.zIndex = '40';
    document.body.appendChild(clone);
    window.setTimeout(function () {
      clone.remove();
    }, 300);
  }

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
    if (dailyRunChip) {
      dailyRunChip.classList.toggle('hidden', state.challengeMode !== 'daily');
    }
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

  var lastEnemyBlock = 0;
  var lastPlayerBlock = 0;
  var lastIntentText = null;

  function renderCombatScreen() {
    var combat = state.combat;
    if (!combat) {
      return;
    }
    var enemy = Engine.findEnemy(combat.enemyId);
    enemyNameEl.textContent = enemy.name;
    // v3 원화: SVG 에셋 파일명에서 유도한 webp 회화 원화를 아트 창에 사용한다
    // (content.js 무변경 — 파일명 규칙이 동일해 확장자·디렉터리만 치환).
    enemyAssetEl.src = '../shared/art/' + enemy.asset.replace('.svg', '.webp');
    enemyAssetEl.classList.toggle('enemy-asset-elite', enemy.tier === 'elite');
    enemyAssetEl.classList.toggle('enemy-asset-boss', enemy.tier === 'boss');
    enemyHpValueEl.textContent = Math.max(0, combat.enemyHp) + ' / ' + combat.enemyMaxHp;

    if (combat.enemyBlock > 0) {
      enemyBlockValueEl.textContent = '방어 ' + combat.enemyBlock;
      enemyBlockValueEl.classList.remove('hidden');
      if (combat.enemyBlock > lastEnemyBlock) {
        pulseBlockBadge(enemyBlockValueEl);
      }
    } else {
      enemyBlockValueEl.classList.add('hidden');
    }
    lastEnemyBlock = combat.enemyBlock;

    statusBadges(enemyStatusRowEl, combat.enemyStrength, combat.enemyWeak, combat.enemyVulnerable);
    statusBadges(playerStatusRowEl, combat.playerStrength, combat.playerWeak, combat.playerVulnerable);

    if (combat.playerBlock > 0) {
      playerBlockValueEl.textContent = '방어 ' + combat.playerBlock;
      playerBlockValueEl.classList.remove('hidden');
      if (combat.playerBlock > lastPlayerBlock) {
        pulseBlockBadge(playerBlockValueEl);
      }
    } else {
      playerBlockValueEl.classList.add('hidden');
    }
    lastPlayerBlock = combat.playerBlock;

    var intent = Engine.getEnemyIntent(state);
    var intentText = INTENT_LABEL[intent.type];
    if (intent.type === 'attack') {
      intentText += ' ' + intent.amount + (intent.hits && intent.hits > 1 ? ' × ' + intent.hits + '회' : '');
    } else if (intent.amount) {
      intentText += ' ' + intent.amount;
    }
    enemyIntentValueEl.textContent = intentText;
    if (lastIntentText !== null && lastIntentText !== intentText) {
      retriggerAnimation(enemyIntentValueEl, 'intent-changing');
    }
    lastIntentText = intentText;

    energyValueEl.textContent = String(state.player.energy);

    renderHand();
  }

  // 딜-인 애니메이션은 실제 드로우가 일어난 다음 렌더 한 번에만 적용한다.
  var animateNextHandRender = false;

  function renderHand() {
    var animate = animateNextHandRender;
    animateNextHandRender = false;
    handListEl.innerHTML = '';
    state.player.hand.forEach(function (cardId, index) {
      var card = Engine.findCard(cardId);
      var el = buildCardElement(card);
      if (animate) {
        el.classList.add('card-enter');
        el.style.animationDelay = (index * 30) + 'ms';
      }

      var playable = Engine.canPlayCard(state, cardId);
      if (!playable) {
        el.classList.add('card-disabled');
      }

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
    var cardEl = handListEl.children[index];
    var result = Engine.playCard(state, cardId, index, tracker);
    if (result.success) {
      animateCardPlay(cardEl);
      if (result.results && result.results.hits) {
        result.results.hits.forEach(function (hit) {
          showDamagePopup(enemyAssetEl, hit.amount);
        });
        if (result.results.hits.length > 0) {
          shakeEnemy();
        }
      }
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
    var hpBefore = state.player.hp;
    Engine.endTurn(state, tracker);
    if (state.player.hp < hpBefore) {
      showDamagePopup(hpChipEl, hpBefore - state.player.hp);
      flashPlayerHit();
    }
    animateNextHandRender = true;
    commit();
    if (state.screen !== 'combat') {
      onScreenChanged();
    }
  });

  function renderRewardScreen() {
    rewardCardListEl.innerHTML = '';
    (state.pendingReward || []).forEach(function (cardId, index) {
      var card = Engine.findCard(cardId);
      var el = buildCardElement(card);
      el.classList.add('card-enter');
      el.style.animationDelay = (index * 30) + 'ms';

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
      button.className = 'gk-button secondary';
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

    // 연동은 부가 기능: 미연결이거나 네트워크 오류여도 게임 진행에는 영향이 없다(fire-and-forget).
    // 점수화 공식: 도달 스테이지 × 1000 + 잔여 HP (서버 쪽 상수와 일치).
    if (window.GameLink && !scoreSubmittedForRun) {
      scoreSubmittedForRun = true;
      var reachedStage = Math.min(state.runIndex + 1, totalNodes);
      var remainingHp = Math.max(0, state.player.hp);
      var runScore = reachedStage * 1000 + remainingHp;
      var submitOptions = state.challengeMode === 'daily' ? { challenge: 'daily' } : undefined;
      window.GameLink.submitScore('deck', runScore, state.seed, submitOptions);
    }

    if (window.GameLink && resultLinkSectionEl) {
      window.GameLink.renderLinkSection(resultLinkSectionEl, {
        onChange: function () {
          if (resultDailySectionEl) {
            window.GameLink.renderDailySection(resultDailySectionEl, 'deck', {
              onStart: startDailyRunFromSeed,
            });
          }
          if (resultRankingSectionEl) {
            window.GameLink.renderRankingSection(resultRankingSectionEl, 'deck');
          }
        },
      });
    }

    if (window.GameLink && resultDailySectionEl) {
      window.GameLink.renderDailySection(resultDailySectionEl, 'deck', {
        onStart: startDailyRunFromSeed,
      });
    }

    if (window.GameLink && resultRankingSectionEl) {
      window.GameLink.renderRankingSection(resultRankingSectionEl, 'deck');
    }
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
      if (result.type === 'combat') {
        animateNextHandRender = true;
      }
      commit();
    }
  });

  restartButton.addEventListener('click', function () {
    var nextOptions = state && state.challengeMode === 'daily'
      ? { seed: state.seed, mode: 'daily', dayKey: state.challengeDayKey }
      : undefined;
    startNewRun(state && state.stats, nextOptions);
    saveState();
    renderAll();
  });

  function startDailyRunFromSeed(seed, daily) {
    startNewRun(state && state.stats, {
      seed: seed,
      mode: 'daily',
      dayKey: daily && daily.dayKey,
    });
    saveState();
    renderAll();
  }

  function startDailyRun() {
    if (!window.GameLink || !window.GameLink.fetchDaily) {
      runNodeDescriptionEl.textContent = '오늘의 도전을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
      return;
    }

    dailyRunButton.disabled = true;
    runNodeDescriptionEl.textContent = '오늘의 도전을 불러오는 중이에요.';
    window.GameLink.fetchDaily('deck').then(function (result) {
      dailyRunButton.disabled = false;
      if (!result.ok) {
        runNodeDescriptionEl.textContent = '오늘의 도전을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
        return;
      }
      startDailyRunFromSeed(result.seed, result);
    });
  }

  dailyRunButton.addEventListener('click', startDailyRun);

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
      state.challengeMode = state.challengeMode === 'daily' ? 'daily' : 'free';
      state.challengeDayKey = state.challengeMode === 'daily' ? state.challengeDayKey || null : null;
    } else {
      startNewRun(restored && restored.stats);
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

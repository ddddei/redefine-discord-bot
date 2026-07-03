(function () {
  'use strict';

  var Content = window.IdleContent;
  var Engine = window.IdleEngine;

  var state = null;

  // 황금 간식의 클릭 부스트 효과가 끝나는 시각(epoch ms). 0이면 부스트 없음.
  var clickBoostUntil = 0;

  function isClickBoostActive(now) {
    return clickBoostUntil > now;
  }

  function getEffectiveClickAmount(now) {
    var amount = Engine.getClickAmount(state);
    if (isClickBoostActive(now)) {
      amount *= Content.GOLDEN_SNACK.clickBoostMultiplier;
    }
    return amount;
  }

  // ---- DOM 참조 ----

  var stageRoleEl = document.getElementById('stage-role');
  var stageTitleEl = document.getElementById('stage-title');
  var snacksValueEl = document.getElementById('snacks-value');
  var rateValueEl = document.getElementById('rate-value');

  var stageSceneEl = document.getElementById('stage-scene');
  var sceneEmojiEl = document.getElementById('scene-emoji');
  var scenePropsEl = document.getElementById('scene-props');

  var makeSnackButton = document.getElementById('make-snack-button');
  var characterEmojiEl = document.getElementById('character-emoji');
  var clickAmountLabelEl = document.getElementById('click-amount-label');
  var popupLayerEl = document.getElementById('popup-layer');

  var goldenSnackButton = document.getElementById('golden-snack-button');

  var nextStageLabelEl = document.getElementById('next-stage-label');
  var stageUpgradeButton = document.getElementById('stage-upgrade-button');
  var stageUpgradeCostEl = document.getElementById('stage-upgrade-cost');

  var buildingListEl = document.getElementById('building-list');
  var upgradeListEl = document.getElementById('upgrade-list');

  var deliveryActiveEl = document.getElementById('delivery-active');
  var deliveryActiveNameEl = document.getElementById('delivery-active-name');
  var deliveryActiveRemainingEl = document.getElementById('delivery-active-remaining');
  var deliveryActiveRewardEl = document.getElementById('delivery-active-reward');
  var deliveryCollectButton = document.getElementById('delivery-collect-button');
  var deliveryListEl = document.getElementById('delivery-list');

  var statsListEl = document.getElementById('stats-list');
  var prestigeSummaryEl = document.getElementById('prestige-summary');
  var prestigeButton = document.getElementById('prestige-button');
  var achievementListEl = document.getElementById('achievement-list');
  var resetButton = document.getElementById('reset-button');

  var questDescriptionEl = document.getElementById('quest-description');
  var questRewardEl = document.getElementById('quest-reward');
  var questClaimButton = document.getElementById('quest-claim-button');
  var questBarEl = document.getElementById('quest-bar');

  var tabButtons = document.querySelectorAll('.tab-button');
  var tabPanels = document.querySelectorAll('.tab-panel');

  var offlineModal = document.getElementById('offline-modal');
  var offlineModalCopyEl = document.getElementById('offline-modal-copy');
  var offlineModalCloseButton = document.getElementById('offline-modal-close');

  var stageModal = document.getElementById('stage-modal');
  var stageModalTitleEl = document.getElementById('stage-modal-title');
  var stageModalCopyEl = document.getElementById('stage-modal-copy');
  var stageModalCloseButton = document.getElementById('stage-modal-close');

  var prestigeModal = document.getElementById('prestige-modal');
  var prestigeModalCopyEl = document.getElementById('prestige-modal-copy');
  var prestigeModalCancelButton = document.getElementById('prestige-modal-cancel');
  var prestigeModalConfirmButton = document.getElementById('prestige-modal-confirm');

  var resetModal = document.getElementById('reset-modal');
  var resetModalCancelButton = document.getElementById('reset-modal-cancel');
  var resetModalConfirmButton = document.getElementById('reset-modal-confirm');

  var toastLayerEl = document.getElementById('toast-layer');

  // ---- 모달 공통 ----

  function openModal(modalEl) {
    modalEl.classList.remove('hidden');
    modalEl.classList.remove('gk-modal-opening');
    // 강제 리플로우로 재시작 가능한 애니메이션 트리거.
    void modalEl.offsetWidth;
    modalEl.classList.add('gk-modal-opening');
  }

  function closeModal(modalEl) {
    modalEl.classList.add('hidden');
  }

  // ---- 토스트 ----

  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastLayerEl.appendChild(toast);
    window.setTimeout(function () {
      toast.remove();
    }, 2500);
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
      return Engine.createNewState();
    }
    return loaded;
  }

  function saveState() {
    // 저장 전에 마지막 틱 이후의 생산분을 먼저 정산한다. 이렇게 해야 lastSeenAt이
    // "여기까지의 생산은 모두 반영됨"을 뜻하게 되고, 다음 접속의 오프라인 수익이
    // 직전 세션 생산분을 중복 지급하지 않는다. (숨겨진 탭에서는 rAF가 멈추므로
    // 자동 저장 주기가 백그라운드 생산 정산도 겸한다.)
    var now = Date.now();
    var elapsed = now - lastTickAt;
    if (elapsed > 0) {
      Engine.applyProductionTick(state, elapsed);
      lastTickAt = now;
    }
    state.lastSeenAt = now;
    try {
      window.localStorage.setItem(Content.SAVE_KEY, Engine.serializeState(state));
    } catch (error) {
      console.warn('저장에 실패했어요:', error.message);
    }
  }

  // ---- 렌더링 ----

  function renderHeader() {
    var stage = Engine.findStage(state.stageId);
    stageRoleEl.textContent = stage.role;
    stageTitleEl.textContent = stage.title;
    snacksValueEl.textContent = Engine.formatNumber(state.snacks);
    rateValueEl.textContent = '+' + Engine.formatNumber(Engine.getProductionPerSecond(state)) + '/초';
  }

  var lastRenderedPropCount = 0;

  function renderScene() {
    var stage = Engine.findStage(state.stageId);
    stageSceneEl.setAttribute('data-stage', String(stage.id));
    sceneEmojiEl.textContent = stage.sceneEmoji;

    scenePropsEl.innerHTML = '';
    var propsAdded = 0;
    Content.BUILDINGS.forEach(function (building) {
      if (propsAdded >= Content.MAX_SCENE_PROPS_PER_STAGE) {
        return;
      }
      if (building.unlockStage !== stage.id) {
        return;
      }
      var owned = state.buildings[building.key].owned;
      var count = Math.min(owned, Content.MAX_SCENE_PROPS_PER_STAGE - propsAdded);
      for (var i = 0; i < count; i += 1) {
        var span = document.createElement('span');
        span.textContent = building.emoji;
        if (propsAdded >= lastRenderedPropCount) {
          span.classList.add('prop-pop-in');
        }
        scenePropsEl.appendChild(span);
        propsAdded += 1;
      }
    });
    lastRenderedPropCount = propsAdded;
  }

  function renderClickAmount() {
    clickAmountLabelEl.textContent = '+' + Engine.formatNumber(getEffectiveClickAmount(Date.now()));
  }

  function renderStageUpgrade() {
    var nextStage = Engine.getNextStage(state);
    if (!nextStage) {
      nextStageLabelEl.textContent = '가장 높은 무대에 도달했어요.';
      stageUpgradeButton.classList.add('hidden');
      return;
    }
    stageUpgradeButton.classList.remove('hidden');
    nextStageLabelEl.textContent = '다음 무대: ' + nextStage.title;
    stageUpgradeCostEl.textContent = Engine.formatNumber(nextStage.upgradeCost);
    stageUpgradeButton.disabled = state.snacks < nextStage.upgradeCost;
  }

  // 목록의 구매 버튼 참조. 방치 중 재화가 모이면 tick에서 disabled만 갱신한다
  // (목록 DOM 재생성 없이). 목록 자체는 상태 변화 때만 다시 그린다.
  var buildingBuyButtons = [];
  var upgradeBuyButtons = [];

  function updateAffordability() {
    buildingBuyButtons.forEach(function (entry) {
      entry.button.disabled = state.snacks < entry.cost;
    });
    upgradeBuyButtons.forEach(function (entry) {
      entry.button.disabled = state.snacks < entry.cost;
    });
  }

  function renderBuildings() {
    buildingListEl.innerHTML = '';
    buildingBuyButtons = [];
    Content.BUILDINGS.forEach(function (building) {
      if (!Engine.isBuildingUnlocked(state, building.key)) {
        return;
      }
      var owned = state.buildings[building.key].owned;
      var cost = Engine.getBuildingCost(state, building.key);

      var li = document.createElement('li');
      li.className = 'building-row';

      var info = document.createElement('div');
      info.className = 'row-info';
      var title = document.createElement('p');
      title.className = 'row-title';
      title.textContent = building.emoji + ' ' + building.name + ' (' + owned + '대)';
      var subtitle = document.createElement('p');
      subtitle.className = 'row-subtitle';
      subtitle.textContent = '초당 +' + Engine.formatNumber(building.ratePerUnit) + '/대';
      info.appendChild(title);
      info.appendChild(subtitle);

      var buyButton = document.createElement('button');
      buyButton.type = 'button';
      buyButton.className = 'gk-button primary';
      buyButton.textContent = Engine.formatNumber(cost);
      buyButton.disabled = state.snacks < cost;
      buyButton.addEventListener('click', function () {
        var result = Engine.buyBuilding(state, building.key);
        if (result.success) {
          onStateChanged();
        }
      });

      li.appendChild(info);
      li.appendChild(buyButton);
      buildingListEl.appendChild(li);
      buildingBuyButtons.push({ cost: cost, button: buyButton });
    });
  }

  function renderUpgrades() {
    upgradeListEl.innerHTML = '';
    upgradeBuyButtons = [];
    Content.UPGRADES.forEach(function (upgrade) {
      if (!Engine.isUpgradeUnlocked(state, upgrade.key) || state.upgrades[upgrade.key]) {
        return;
      }

      var li = document.createElement('li');
      li.className = 'upgrade-row';

      var info = document.createElement('div');
      info.className = 'row-info';
      var title = document.createElement('p');
      title.className = 'row-title';
      title.textContent = upgrade.name;
      var subtitle = document.createElement('p');
      subtitle.className = 'row-subtitle';
      subtitle.textContent = upgrade.description;
      info.appendChild(title);
      info.appendChild(subtitle);

      var buyButton = document.createElement('button');
      buyButton.type = 'button';
      buyButton.className = 'gk-button primary';
      buyButton.textContent = Engine.formatNumber(upgrade.cost);
      buyButton.disabled = state.snacks < upgrade.cost;
      buyButton.addEventListener('click', function () {
        var result = Engine.buyUpgrade(state, upgrade.key);
        if (result.success) {
          onStateChanged();
        }
      });

      li.appendChild(info);
      li.appendChild(buyButton);
      upgradeListEl.appendChild(li);
      upgradeBuyButtons.push({ cost: upgrade.cost, button: buyButton });
    });
  }

  function formatDuration(ms) {
    var totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var pad = function (n) {
      return n < 10 ? '0' + n : String(n);
    };
    if (hours > 0) {
      return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    }
    return pad(minutes) + ':' + pad(seconds);
  }

  // 진행 중 배달의 남은 시간/수령 버튼만 갱신한다. 매 프레임 호출되므로 DOM을
  // 재생성하지 않는다 (재생성하면 누르려던 버튼이 프레임 사이에 교체될 수 있다).
  function renderDeliveryActive() {
    if (!state.delivery) {
      return;
    }
    var delivery = Engine.findDelivery(state.delivery.key);
    var now = Date.now();
    var ready = Engine.isDeliveryComplete(state, now);
    deliveryActiveNameEl.textContent = delivery.name;
    deliveryActiveRemainingEl.textContent = ready
      ? '수령할 수 있어요.'
      : ('남은 시간 ' + formatDuration(state.delivery.finishesAt - now));
    deliveryActiveRewardEl.textContent = '예상 보상 ' + Engine.formatNumber(Engine.getProductionPerSecond(state) * delivery.rewardSeconds);
    deliveryCollectButton.disabled = !ready;
  }

  function renderDelivery() {
    if (state.delivery) {
      deliveryActiveEl.classList.remove('hidden');
      renderDeliveryActive();
    } else {
      deliveryActiveEl.classList.add('hidden');
    }

    deliveryListEl.innerHTML = '';
    Content.DELIVERIES.forEach(function (delivery) {
      if (!Engine.isDeliveryUnlocked(state, delivery.key)) {
        return;
      }

      var li = document.createElement('li');
      li.className = 'delivery-row';

      var info = document.createElement('div');
      info.className = 'row-info';
      var title = document.createElement('p');
      title.className = 'row-title';
      title.textContent = delivery.name;
      var subtitle = document.createElement('p');
      subtitle.className = 'row-subtitle';
      subtitle.textContent = '소요 ' + formatDuration(delivery.durationMs);
      info.appendChild(title);
      info.appendChild(subtitle);

      var sendButton = document.createElement('button');
      sendButton.type = 'button';
      sendButton.className = 'gk-button primary';
      sendButton.textContent = '보내기';
      sendButton.disabled = !!state.delivery;
      sendButton.addEventListener('click', function () {
        var result = Engine.startDelivery(state, delivery.key, Date.now());
        if (result.success) {
          onStateChanged();
        }
      });

      li.appendChild(info);
      li.appendChild(sendButton);
      deliveryListEl.appendChild(li);
    });
  }

  function renderStats() {
    statsListEl.innerHTML = '';
    var rows = [
      ['누적 생산량', Engine.formatNumber(state.lifetimeProduced)],
      ['클릭 수', Engine.formatNumber(state.clickCount)],
      ['환생 횟수', String(state.prestigeCount)],
      ['완료한 배달', String(state.deliveryCompletedCount)],
      ['황금 간식 획득', String(state.goldenSnackClickedCount)],
    ];
    rows.forEach(function (row) {
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];
      statsListEl.appendChild(dt);
      statsListEl.appendChild(dd);
    });
  }

  function renderPrestige() {
    var bonusPercent = Math.round(state.prestigePoints * Content.PRESTIGE.productionBonusPerPoint * 100);
    var summary = '보유 레시피 ' + state.prestigePoints + '개 (생산량 +' + bonusPercent + '%)';
    var pendingGain = Engine.getPrestigeGain(state);
    if (pendingGain > 0) {
      summary += ' · 지금 환생하면 ' + pendingGain + '개';
    } else {
      summary += ' · 다음 레시피까지 누적 생산 ' + Engine.formatNumber(Engine.getProducedUntilNextPrestigePoint(state)) + ' 남음';
    }
    prestigeSummaryEl.textContent = summary;
    prestigeButton.disabled = !Engine.canPrestige(state);
  }

  function renderAchievements() {
    achievementListEl.innerHTML = '';
    Content.ACHIEVEMENTS.forEach(function (achievement) {
      var unlocked = !!state.achievements[achievement.key];
      var li = document.createElement('li');
      li.className = 'achievement-row ' + (unlocked ? 'unlocked' : 'locked');

      var info = document.createElement('div');
      info.className = 'row-info';
      var title = document.createElement('p');
      title.className = 'row-title';
      title.textContent = achievement.name;
      info.appendChild(title);

      li.appendChild(info);
      achievementListEl.appendChild(li);
    });
  }

  function renderQuestBar() {
    var quest = Engine.getCurrentQuest(state);
    if (!quest) {
      questDescriptionEl.textContent = '모든 퀘스트를 완료했어요.';
      questRewardEl.textContent = '';
      questClaimButton.disabled = true;
      questBarEl.classList.remove('achieved');
      return;
    }

    questDescriptionEl.textContent = quest.description;
    questRewardEl.textContent = quest.reward > 0 ? ('보상 ' + Engine.formatNumber(quest.reward)) : '보상: 환생 안내';

    var achieved = Engine.isCurrentQuestComplete(state);
    questClaimButton.disabled = !achieved;
    questBarEl.classList.toggle('achieved', achieved);
  }

  function renderAll() {
    renderHeader();
    renderScene();
    renderClickAmount();
    renderStageUpgrade();
    renderBuildings();
    renderUpgrades();
    renderDelivery();
    renderStats();
    renderPrestige();
    renderAchievements();
    renderQuestBar();
  }

  function onStateChanged() {
    checkAchievements();
    renderAll();
    saveState();
  }

  function checkAchievements() {
    var newlyUnlocked = Engine.checkAndClaimAchievements(state);
    // 업적 달성은 낮은 톤 토스트로 알린다. 기록 탭에서 상세를 확인할 수 있다.
    newlyUnlocked.forEach(function (achievement) {
      showToast('업적 달성: ' + achievement.name);
    });
    return newlyUnlocked;
  }

  // ---- 탭 전환 ----

  function switchTab(target) {
    tabButtons.forEach(function (button) {
      button.classList.toggle('active', button.dataset.tabTarget === target);
    });
    tabPanels.forEach(function (panel) {
      panel.classList.toggle('hidden', panel.dataset.tab !== target);
    });
  }

  tabButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      switchTab(button.dataset.tabTarget);
    });
  });

  // ---- 클릭 입력 ----

  function showClickPopup(amount) {
    var popup = document.createElement('span');
    popup.className = 'gk-float-num';
    popup.textContent = '+' + Engine.formatNumber(amount);
    popup.style.left = '50%';
    popup.style.top = '0px';
    popupLayerEl.appendChild(popup);
    window.setTimeout(function () {
      popup.remove();
    }, 700);
  }

  makeSnackButton.addEventListener('click', function () {
    var amount = getEffectiveClickAmount(Date.now());
    Engine.addProduced(state, amount);
    state.clickCount += 1;
    showClickPopup(amount);
    makeSnackButton.classList.remove('bounce');
    // 강제 리플로우로 재시작 가능한 애니메이션 트리거.
    void makeSnackButton.offsetWidth;
    makeSnackButton.classList.add('bounce');
    onStateChanged();
  });

  // ---- 승급 ----

  stageUpgradeButton.addEventListener('click', function () {
    var result = Engine.upgradeStage(state);
    if (result.success) {
      showStageModal(result.stage);
      onStateChanged();
      // 이번 승급으로 황금 간식이 해금됐을 수 있으므로 스케줄을 다시 건다.
      scheduleGoldenSnack();
    }
  });

  function showStageModal(stage) {
    stageModalTitleEl.textContent = stage.title + '(으)로 승급했어요';
    stageModalCopyEl.textContent = stage.announceCopy;
    openModal(stageModal);
    stageSceneEl.classList.remove('stage-transitioning');
    void stageSceneEl.offsetWidth;
    stageSceneEl.classList.add('stage-transitioning');
  }

  stageModalCloseButton.addEventListener('click', function () {
    closeModal(stageModal);
  });

  // ---- 배달 ----

  deliveryCollectButton.addEventListener('click', function () {
    var result = Engine.collectDelivery(state, Date.now());
    if (result.success) {
      onStateChanged();
    }
  });

  // ---- 퀘스트 ----

  questClaimButton.addEventListener('click', function () {
    var result = Engine.claimCurrentQuest(state);
    if (result.success) {
      onStateChanged();
    }
  });

  // ---- 환생 ----

  prestigeButton.addEventListener('click', function () {
    if (!Engine.canPrestige(state)) {
      return;
    }
    var expectedGain = Engine.getPrestigeGain(state);
    prestigeModalCopyEl.textContent = '비법 레시피 ' + expectedGain + '개를 얻고, 간식·시설·업그레이드·무대·배달이 초기화돼요.\n업적·통계·레시피는 유지돼요.';
    openModal(prestigeModal);
  });

  prestigeModalCancelButton.addEventListener('click', function () {
    closeModal(prestigeModal);
  });

  prestigeModalConfirmButton.addEventListener('click', function () {
    var result = Engine.prestige(state);
    closeModal(prestigeModal);
    if (result.success) {
      onStateChanged();
      // 무대 1로 돌아가 황금 간식이 다시 잠기므로 표시 중이면 감추고 스케줄을 재설정한다.
      hideGoldenSnack();
      scheduleGoldenSnack();
    }
  });

  // ---- 초기화 ----

  resetButton.addEventListener('click', function () {
    openModal(resetModal);
  });

  resetModalCancelButton.addEventListener('click', function () {
    closeModal(resetModal);
  });

  resetModalConfirmButton.addEventListener('click', function () {
    closeModal(resetModal);
    state = Engine.createNewState();
    state.lastSeenAt = Date.now();
    onStateChanged();
    hideGoldenSnack();
    scheduleGoldenSnack();
  });

  // ---- 황금 간식 ----

  var goldenSnackTimeoutId = null;
  var goldenSnackHideTimeoutId = null;

  function scheduleGoldenSnack() {
    window.clearTimeout(goldenSnackTimeoutId);
    if (!Engine.isGoldenSnackUnlocked(state)) {
      return;
    }
    var config = Content.GOLDEN_SNACK;
    var delay = config.minIntervalMs + Math.random() * (config.maxIntervalMs - config.minIntervalMs);
    goldenSnackTimeoutId = window.setTimeout(showGoldenSnack, delay);
  }

  function hideGoldenSnack() {
    goldenSnackButton.classList.add('hidden');
    window.clearTimeout(goldenSnackHideTimeoutId);
  }

  function showGoldenSnack() {
    // 예약 이후 환생/초기화로 다시 잠겼을 수 있으므로 표시 시점에 재확인한다.
    if (document.hidden || !Engine.isGoldenSnackUnlocked(state)) {
      scheduleGoldenSnack();
      return;
    }
    var config = Content.GOLDEN_SNACK;
    var top = 60 + Math.random() * 200;
    var left = 10 + Math.random() * 70;
    goldenSnackButton.style.top = top + 'px';
    goldenSnackButton.style.left = left + '%';
    goldenSnackButton.classList.remove('hidden');

    goldenSnackHideTimeoutId = window.setTimeout(function () {
      goldenSnackButton.classList.add('hidden');
      scheduleGoldenSnack();
    }, config.visibleDurationMs);
  }

  goldenSnackButton.addEventListener('click', function () {
    goldenSnackButton.classList.add('hidden');
    window.clearTimeout(goldenSnackHideTimeoutId);

    var kind = Math.random() < 0.5 ? 'instant' : 'clickBoost';
    var result = Engine.collectGoldenSnack(state, kind);

    if (kind === 'instant') {
      showClickPopup(result.reward);
    } else {
      clickBoostUntil = Date.now() + Content.GOLDEN_SNACK.clickBoostDurationMs;
    }

    onStateChanged();
    scheduleGoldenSnack();
  });

  // ---- 오프라인 수익 ----

  function showOfflineEarnings(now) {
    if (state.lastSeenAt === null || state.lastSeenAt === undefined) {
      return;
    }
    var result = Engine.applyOfflineEarnings(state, state.lastSeenAt, now);
    if (result.clockRewind) {
      return;
    }
    if (result.elapsedMs < 60 * 1000) {
      return;
    }
    var minutes = Math.floor(result.cappedMs / 60000) % 60;
    var hours = Math.floor(result.cappedMs / 3600000);
    var parts = [];
    if (hours > 0) {
      parts.push(hours + '시간');
    }
    parts.push(minutes + '분');
    offlineModalCopyEl.textContent = '자리를 비운 사이 ' + parts.join(' ') + ' 동안 간식 ' + Engine.formatNumber(result.earned) + '개가 만들어졌어요.';
    openModal(offlineModal);
  }

  offlineModalCloseButton.addEventListener('click', function () {
    closeModal(offlineModal);
  });

  // ---- 메인 루프 ----

  var lastTickAt = Date.now();

  function tick() {
    var now = Date.now();
    var elapsed = now - lastTickAt;
    lastTickAt = now;

    if (elapsed > 0) {
      Engine.applyProductionTick(state, elapsed);
    }

    renderHeader();
    renderStageUpgrade();
    renderDeliveryActive();
    updateAffordability();

    if (Engine.isCurrentQuestComplete(state) !== questBarEl.classList.contains('achieved')) {
      renderQuestBar();
    }

    checkAchievements();

    window.requestAnimationFrame(tick);
  }

  // ---- 자동 저장 ----

  window.setInterval(saveState, Content.AUTOSAVE_INTERVAL_MS);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      saveState();
    }
    // 다시 보일 때 lastTickAt을 리셋하지 않는다. 숨겨진 동안 rAF가 멈춰 있었어도
    // 다음 틱이 경과 시간 전체를 정산하므로 백그라운드 생산이 소실되지 않는다.
  });

  window.addEventListener('beforeunload', saveState);

  // ---- 초기화 ----

  function init() {
    state = loadState();
    var now = Date.now();
    showOfflineEarnings(now);
    state.lastSeenAt = now;
    lastTickAt = now;

    renderAll();
    saveState();
    scheduleGoldenSnack();
    window.requestAnimationFrame(tick);
  }

  init();

  // 수동/로컬 QA용으로만 노출한다. 자동화 테스트는 이 값을 사용하지 않는다.
  window.IdleGame = {
    getState: function () {
      return state;
    },
  };
})();

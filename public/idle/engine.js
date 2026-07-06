(function (root) {
  'use strict';

  // 순수 로직 모듈. DOM, localStorage, Date.now()를 직접 참조하지 않는다.
  // 시각이 필요한 계산은 항상 인자로 now(epoch ms)를 주입받는다.

  var Content = (typeof root !== 'undefined' && root.IdleContent)
    || (typeof require === 'function' ? require('./content') : null);

  function findBuilding(key) {
    for (var i = 0; i < Content.BUILDINGS.length; i += 1) {
      if (Content.BUILDINGS[i].key === key) {
        return Content.BUILDINGS[i];
      }
    }
    return null;
  }

  function findStage(id) {
    for (var i = 0; i < Content.STAGES.length; i += 1) {
      if (Content.STAGES[i].id === id) {
        return Content.STAGES[i];
      }
    }
    return null;
  }

  function findUpgrade(key) {
    for (var i = 0; i < Content.UPGRADES.length; i += 1) {
      if (Content.UPGRADES[i].key === key) {
        return Content.UPGRADES[i];
      }
    }
    return null;
  }

  function findDelivery(key) {
    for (var i = 0; i < Content.DELIVERIES.length; i += 1) {
      if (Content.DELIVERIES[i].key === key) {
        return Content.DELIVERIES[i];
      }
    }
    return null;
  }

  // ---- 새 게임 상태 ----

  function createNewState() {
    var buildings = {};
    Content.BUILDINGS.forEach(function (building) {
      buildings[building.key] = { owned: 0 };
    });

    var upgrades = {};
    Content.UPGRADES.forEach(function (upgrade) {
      upgrades[upgrade.key] = false;
    });

    var achievements = {};
    Content.ACHIEVEMENTS.forEach(function (achievement) {
      achievements[achievement.key] = false;
    });

    return {
      version: Content.SAVE_VERSION,
      snacks: 0,
      lifetimeProduced: 0,
      clickCount: 0,
      stageId: Content.STAGES[0].id,
      buildings: buildings,
      upgrades: upgrades,
      prestigePoints: 0,
      prestigeCount: 0,
      lifetimeProducedBeforePrestige: 0,
      currentQuestIndex: 0,
      achievements: achievements,
      delivery: null,
      deliveryStartedCount: 0,
      deliveryCompletedCount: 0,
      goldenSnackClickedCount: 0,
      lastSeenAt: null,
      deliveryVisitCounts: {},
      collectedStories: {},
      weeklySnapshots: [],
      lastSnapshotWeekKey: null,
      snapshotBaselineProduced: 0,
      prestigeHistory: [],
    };
  }

  // ---- 비용 계산 ----

  function buildingCost(building, owned) {
    return Math.floor(building.baseCost * Math.pow(Content.BUILDING_COST_GROWTH, owned));
  }

  function getBuildingCost(state, key) {
    var building = findBuilding(key);
    if (!building) {
      return Infinity;
    }
    var owned = (state.buildings[key] && state.buildings[key].owned) || 0;
    return buildingCost(building, owned);
  }

  // ---- 생산량 계산 ----

  // eventMultiplier는 운영 이벤트 주간 생산 배수(선택 인자, 기본 1). engine은 env나
  // fetch를 직접 알지 못한다 — game.js가 서버 응답(goal API의 event.multiplier)을
  // 받아 이 인자로 주입하는, now 인자 주입과 같은 방식의 "값 주입 패턴"이다.
  function productionMultiplier(state, eventMultiplier) {
    var multiplier = 1;
    Content.UPGRADES.forEach(function (upgrade) {
      if (state.upgrades[upgrade.key] && upgrade.effect.type === 'productionMultiplier') {
        multiplier *= upgrade.effect.amount;
      }
    });
    multiplier *= 1 + (state.prestigePoints || 0) * Content.PRESTIGE.productionBonusPerPoint;
    if (typeof eventMultiplier === 'number' && eventMultiplier > 0) {
      multiplier *= eventMultiplier;
    }
    return multiplier;
  }

  function baseProductionPerSecond(state) {
    var total = 0;
    Content.BUILDINGS.forEach(function (building) {
      var owned = (state.buildings[building.key] && state.buildings[building.key].owned) || 0;
      total += owned * building.ratePerUnit;
    });
    return total;
  }

  function getProductionPerSecond(state, eventMultiplier) {
    return baseProductionPerSecond(state) * productionMultiplier(state, eventMultiplier);
  }

  function getClickAmount(state, eventMultiplier) {
    var amount = Content.BASE_CLICK_AMOUNT;
    var percentOfRate = 0;

    Content.UPGRADES.forEach(function (upgrade) {
      if (!state.upgrades[upgrade.key]) {
        return;
      }
      if (upgrade.effect.type === 'clickAdd') {
        amount += upgrade.effect.amount;
      } else if (upgrade.effect.type === 'clickPercentOfRate') {
        percentOfRate += upgrade.effect.amount;
      }
    });

    if (percentOfRate > 0) {
      amount += baseProductionPerSecond(state) * percentOfRate;
    }

    return amount * productionMultiplier(state, eventMultiplier);
  }

  function getOfflineCapHours(state) {
    var cap = Content.DEFAULT_OFFLINE_CAP_HOURS;
    Content.UPGRADES.forEach(function (upgrade) {
      if (state.upgrades[upgrade.key] && upgrade.effect.type === 'offlineCapHours') {
        cap = upgrade.effect.amount;
      }
    });
    return cap;
  }

  // ---- 해금 판정 ----

  function isBuildingUnlocked(state, key) {
    var building = findBuilding(key);
    return !!building && state.stageId >= building.unlockStage;
  }

  function isUpgradeUnlocked(state, key) {
    var upgrade = findUpgrade(key);
    return !!upgrade && state.stageId >= upgrade.unlockStage;
  }

  function isDeliveryUnlocked(state, key) {
    var delivery = findDelivery(key);
    return !!delivery && state.stageId >= delivery.unlockStage;
  }

  function isGoldenSnackUnlocked(state) {
    return state.stageId >= Content.GOLDEN_SNACK.unlockStage;
  }

  function getNextStage(state) {
    return findStage(state.stageId + 1);
  }

  // ---- 생산/클릭 적용 ----

  function addProduced(state, amount) {
    if (amount <= 0) {
      return;
    }
    state.snacks += amount;
    state.lifetimeProduced += amount;
  }

  function applyClick(state, eventMultiplier) {
    addProduced(state, getClickAmount(state, eventMultiplier));
    state.clickCount += 1;
  }

  function applyProductionTick(state, elapsedMs, eventMultiplier) {
    if (!(elapsedMs > 0)) {
      return 0;
    }
    var amount = getProductionPerSecond(state, eventMultiplier) * (elapsedMs / 1000);
    addProduced(state, amount);
    return amount;
  }

  // ---- 구매 ----

  function buyBuilding(state, key) {
    if (!isBuildingUnlocked(state, key)) {
      return { success: false, reason: 'LOCKED' };
    }
    var cost = getBuildingCost(state, key);
    if (state.snacks < cost) {
      return { success: false, reason: 'INSUFFICIENT_FUNDS', cost: cost };
    }
    state.snacks -= cost;
    state.buildings[key].owned += 1;
    return { success: true, cost: cost };
  }

  function buyUpgrade(state, key) {
    var upgrade = findUpgrade(key);
    if (!upgrade) {
      return { success: false, reason: 'UNKNOWN' };
    }
    if (!isUpgradeUnlocked(state, key)) {
      return { success: false, reason: 'LOCKED' };
    }
    if (state.upgrades[key]) {
      return { success: false, reason: 'ALREADY_OWNED' };
    }
    if (state.snacks < upgrade.cost) {
      return { success: false, reason: 'INSUFFICIENT_FUNDS', cost: upgrade.cost };
    }
    state.snacks -= upgrade.cost;
    state.upgrades[key] = true;
    return { success: true };
  }

  function upgradeStage(state) {
    var nextStage = getNextStage(state);
    if (!nextStage) {
      return { success: false, reason: 'MAX_STAGE' };
    }
    if (state.snacks < nextStage.upgradeCost) {
      return { success: false, reason: 'INSUFFICIENT_FUNDS', cost: nextStage.upgradeCost };
    }
    state.snacks -= nextStage.upgradeCost;
    state.stageId = nextStage.id;
    return { success: true, stage: nextStage };
  }

  // ---- 배달 ----

  function startDelivery(state, key, now) {
    if (state.delivery) {
      return { success: false, reason: 'DELIVERY_IN_PROGRESS' };
    }
    if (!isDeliveryUnlocked(state, key)) {
      return { success: false, reason: 'LOCKED' };
    }
    var delivery = findDelivery(key);
    if (!delivery) {
      return { success: false, reason: 'UNKNOWN' };
    }
    state.delivery = {
      key: key,
      startedAt: now,
      finishesAt: now + delivery.durationMs,
    };
    state.deliveryStartedCount = (state.deliveryStartedCount || 0) + 1;
    return { success: true };
  }

  function isDeliveryComplete(state, now) {
    if (!state.delivery) {
      return false;
    }
    if (now < state.delivery.startedAt) {
      // 시계 역행: 남은 소요 시간을 유지한 채 시작 시각을 now로 재고정하고 완료 처리하지 않음.
      var remainingMs = state.delivery.finishesAt - state.delivery.startedAt;
      state.delivery.startedAt = now;
      state.delivery.finishesAt = now + remainingMs;
      return false;
    }
    return now >= state.delivery.finishesAt;
  }

  function collectDelivery(state, now, eventMultiplier) {
    if (!state.delivery) {
      return { success: false, reason: 'NO_DELIVERY' };
    }
    if (!isDeliveryComplete(state, now)) {
      return { success: false, reason: 'NOT_READY' };
    }
    var delivery = findDelivery(state.delivery.key);
    var reward = getProductionPerSecond(state, eventMultiplier) * delivery.rewardSeconds;
    addProduced(state, reward);
    state.delivery = null;
    state.deliveryCompletedCount = (state.deliveryCompletedCount || 0) + 1;

    var result = { success: true, reward: reward };

    // 강가 찻집: 낮은 확률 황금 간식 보너스(계획서 2.1절). Math.random 허용 —
    // idle은 랭킹 미노출 장르라 시드 무관(기존 황금 간식과 동일 원칙).
    if (delivery.goldenBonusChance && Math.random() < delivery.goldenBonusChance) {
      var goldenBonus = getProductionPerSecond(state, eventMultiplier) * Content.GOLDEN_SNACK.instantRewardSeconds;
      addProduced(state, goldenBonus);
      result.goldenBonus = goldenBonus;
    }

    // 성문 앞 축제/달빛 기차역: 레시피 조각(환생 포인트 직접 +N, 계획서 2.1절).
    if (delivery.prestigePointReward) {
      state.prestigePoints = (state.prestigePoints || 0) + delivery.prestigePointReward;
      result.prestigePointReward = delivery.prestigePointReward;
    }

    // 이야기 카드: 목적지별 방문 횟수 기반 결정적 순환(RNG 아님, 계획서 2.2절).
    if (!state.deliveryVisitCounts || typeof state.deliveryVisitCounts !== 'object') {
      state.deliveryVisitCounts = {};
    }
    var visitCount = (state.deliveryVisitCounts[delivery.key] || 0) + 1;
    state.deliveryVisitCounts[delivery.key] = visitCount;
    var story = getDeliveryStory(delivery.key, visitCount);
    if (story) {
      if (!state.collectedStories || typeof state.collectedStories !== 'object') {
        state.collectedStories = {};
      }
      state.collectedStories[story.id] = true;
      result.story = story;
    }

    return result;
  }

  // 목적지별 이야기 카드 4종 중 하나를 방문 횟수로 결정적으로 고른다(RNG 아님).
  // visitCount는 1부터 시작(이번 방문 포함).
  function getDeliveryStory(deliveryKey, visitCount) {
    var stories = Content.DELIVERY_STORIES[deliveryKey];
    if (!stories || stories.length === 0) {
      return null;
    }
    var index = (visitCount - 1) % stories.length;
    return stories[index];
  }

  // ---- 황금 간식 ----

  function collectGoldenSnack(state, kind, eventMultiplier) {
    var reward = 0;
    if (kind === 'instant') {
      reward = getProductionPerSecond(state, eventMultiplier) * Content.GOLDEN_SNACK.instantRewardSeconds;
      addProduced(state, reward);
    }
    state.goldenSnackClickedCount = (state.goldenSnackClickedCount || 0) + 1;
    return { reward: reward, kind: kind };
  }

  // ---- 퀘스트 ----

  function isQuestConditionMet(state, condition) {
    switch (condition.type) {
      case 'snackMade':
        return state.lifetimeProduced >= condition.amount;
      case 'buildingOwned':
        return ((state.buildings[condition.key] && state.buildings[condition.key].owned) || 0) >= condition.amount;
      case 'stageReached':
        return state.stageId >= condition.amount;
      case 'deliveryStartedCount':
        return (state.deliveryStartedCount || 0) >= condition.amount;
      case 'deliveryCompletedCount':
        return (state.deliveryCompletedCount || 0) >= condition.amount;
      case 'upgradeOwned':
        return !!state.upgrades[condition.key];
      case 'prestigeCount':
        return (state.prestigeCount || 0) >= condition.amount;
      default:
        return false;
    }
  }

  function getCurrentQuest(state) {
    if (state.currentQuestIndex >= Content.QUESTS.length) {
      return null;
    }
    return Content.QUESTS[state.currentQuestIndex];
  }

  function isCurrentQuestComplete(state) {
    var quest = getCurrentQuest(state);
    if (!quest) {
      return false;
    }
    return isQuestConditionMet(state, quest.condition);
  }

  function claimCurrentQuest(state) {
    var quest = getCurrentQuest(state);
    if (!quest) {
      return { success: false, reason: 'NO_QUEST' };
    }
    if (!isQuestConditionMet(state, quest.condition)) {
      return { success: false, reason: 'NOT_MET' };
    }
    addProduced(state, quest.reward);
    state.currentQuestIndex += 1;
    return { success: true, quest: quest };
  }

  // ---- 업적 ----

  function isAchievementConditionMet(state, condition) {
    switch (condition.type) {
      case 'buildingOwned':
        return ((state.buildings[condition.key] && state.buildings[condition.key].owned) || 0) >= condition.amount;
      case 'allBuildingsOwned':
        return Content.BUILDINGS.every(function (building) {
          return ((state.buildings[building.key] && state.buildings[building.key].owned) || 0) >= 1;
        });
      case 'clickCount':
        return state.clickCount >= condition.amount;
      case 'stageReached':
        return state.stageId >= condition.amount;
      case 'deliveryCompletedCount':
        return (state.deliveryCompletedCount || 0) >= condition.amount;
      case 'goldenSnackClickedCount':
        return (state.goldenSnackClickedCount || 0) >= condition.amount;
      case 'prestigeCount':
        return (state.prestigeCount || 0) >= condition.amount;
      case 'lifetimeProduced':
        return state.lifetimeProduced >= condition.amount;
      default:
        return false;
    }
  }

  function checkAndClaimAchievements(state) {
    var newlyUnlocked = [];
    Content.ACHIEVEMENTS.forEach(function (achievement) {
      if (state.achievements[achievement.key]) {
        return;
      }
      if (isAchievementConditionMet(state, achievement.condition)) {
        state.achievements[achievement.key] = true;
        addProduced(state, achievement.reward);
        newlyUnlocked.push(achievement);
      }
    });
    return newlyUnlocked;
  }

  // ---- 환생 ----

  function getPrestigePointsForLifetime(lifetimeProduced) {
    var value = lifetimeProduced / Content.PRESTIGE.lifetimeProducedDivisor;
    if (value <= 0) {
      return 0;
    }
    return Math.floor(Math.sqrt(value));
  }

  // 이번 환생 주기(직전 환생 이후)의 생산량만으로 레시피를 계산한다.
  // 전체 누적을 매번 쓰면 이전 환생에서 이미 보상받은 생산량이 중복 지급된다.
  function getPrestigeGain(state) {
    var producedThisRun = state.lifetimeProduced - (state.lifetimeProducedBeforePrestige || 0);
    return getPrestigePointsForLifetime(producedThisRun);
  }

  // 다음 레시피 1개를 더 받기까지 이번 주기에서 추가로 필요한 생산량.
  function getProducedUntilNextPrestigePoint(state) {
    var producedThisRun = state.lifetimeProduced - (state.lifetimeProducedBeforePrestige || 0);
    var currentPoints = getPrestigePointsForLifetime(producedThisRun);
    var nextThreshold = Math.pow(currentPoints + 1, 2) * Content.PRESTIGE.lifetimeProducedDivisor;
    return nextThreshold - producedThisRun;
  }

  function canPrestige(state) {
    return state.stageId >= Content.PRESTIGE.requiredStageId;
  }

  // now는 환생 히스토리 기록용(선택 인자 — 기존 now 인자 주입 패턴과 동일). 생략하면
  // 히스토리에 at: null로 기록된다(엔진은 Date.now()를 직접 참조하지 않는다).
  function prestige(state, now) {
    if (!canPrestige(state)) {
      return { success: false, reason: 'STAGE_NOT_REACHED' };
    }

    var gained = getPrestigeGain(state);

    var buildings = {};
    Content.BUILDINGS.forEach(function (building) {
      buildings[building.key] = { owned: 0 };
    });
    var upgrades = {};
    Content.UPGRADES.forEach(function (upgrade) {
      upgrades[upgrade.key] = false;
    });

    state.snacks = 0;
    state.buildings = buildings;
    state.upgrades = upgrades;
    state.stageId = Content.STAGES[0].id;
    state.delivery = null;
    state.prestigePoints = (state.prestigePoints || 0) + gained;
    state.prestigeCount = (state.prestigeCount || 0) + 1;
    state.lifetimeProducedBeforePrestige = state.lifetimeProduced;
    // 업적/통계/퀘스트 진행은 유지한다.

    if (!Array.isArray(state.prestigeHistory)) {
      state.prestigeHistory = [];
    }
    state.prestigeHistory.push({
      at: typeof now === 'number' ? now : null,
      prestigePoints: state.prestigePoints,
      lifetimeProduced: state.lifetimeProduced,
    });
    // 최근 10개만 보관(계획서 3절).
    if (state.prestigeHistory.length > 10) {
      state.prestigeHistory = state.prestigeHistory.slice(state.prestigeHistory.length - 10);
    }

    return { success: true, gained: gained };
  }

  // ---- 오프라인 수익 ----

  function computeOfflineEarnings(state, lastSeenAt, now, eventMultiplier) {
    if (typeof lastSeenAt !== 'number' || !(lastSeenAt > 0)) {
      return { earned: 0, elapsedMs: 0, cappedMs: 0, clockRewind: false };
    }
    if (now < lastSeenAt) {
      return { earned: 0, elapsedMs: 0, cappedMs: 0, clockRewind: true };
    }

    var elapsedMs = now - lastSeenAt;
    var capMs = getOfflineCapHours(state) * 60 * 60 * 1000;
    var cappedMs = Math.min(elapsedMs, capMs);
    var earned = getProductionPerSecond(state, eventMultiplier) * (cappedMs / 1000);

    return { earned: earned, elapsedMs: elapsedMs, cappedMs: cappedMs, clockRewind: false };
  }

  function applyOfflineEarnings(state, lastSeenAt, now, eventMultiplier) {
    var result = computeOfflineEarnings(state, lastSeenAt, now, eventMultiplier);
    if (result.earned > 0) {
      addProduced(state, result.earned);
    }
    return result;
  }

  // ---- 통계: 주간 생산 추이 ----

  // weekKey 변화를 감지해 지난 주 스냅샷을 기록한다(계획서 3절). weekKey는 game.js가
  // 서버와 같은 ISO 주차 규칙으로 계산해 주입한다(engine은 Date를 직접 다루지 않는다).
  // 최초 호출(lastSnapshotWeekKey가 없을 때)은 기준점만 세우고 스냅샷을 남기지 않는다
  // (직전 주 생산량을 알 수 없기 때문).
  function recordWeeklySnapshotIfNeeded(state, weekKey) {
    if (!weekKey || typeof weekKey !== 'string') {
      return false;
    }
    if (!Array.isArray(state.weeklySnapshots)) {
      state.weeklySnapshots = [];
    }
    if (!state.lastSnapshotWeekKey) {
      state.lastSnapshotWeekKey = weekKey;
      state.snapshotBaselineProduced = state.lifetimeProduced;
      return false;
    }
    if (state.lastSnapshotWeekKey === weekKey) {
      return false;
    }

    var baseline = typeof state.snapshotBaselineProduced === 'number' ? state.snapshotBaselineProduced : 0;
    var produced = Math.max(0, state.lifetimeProduced - baseline);
    state.weeklySnapshots.push({ weekKey: state.lastSnapshotWeekKey, produced: produced });
    if (state.weeklySnapshots.length > 8) {
      state.weeklySnapshots = state.weeklySnapshots.slice(state.weeklySnapshots.length - 8);
    }
    state.lastSnapshotWeekKey = weekKey;
    state.snapshotBaselineProduced = state.lifetimeProduced;
    return true;
  }

  // ---- 큰 수 포맷 ----

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return '0';
    }
    var negative = value < 0;
    var abs = Math.abs(value);

    for (var i = 0; i < Content.NUMBER_UNITS.length; i += 1) {
      var unit = Content.NUMBER_UNITS[i];
      if (abs >= unit.threshold) {
        var scaled = abs / unit.divisor;
        var rounded = Math.floor(scaled * 10) / 10;
        var text = rounded.toFixed(1).replace(/\.0$/, '');
        return (negative ? '-' : '') + text + unit.suffix;
      }
    }

    if (abs > 0 && abs < 100 && Math.floor(abs) !== abs) {
      // 시설 1대의 초당 생산량처럼 1 미만/소수인 값이 "0"으로 뭉개지지 않도록
      // 100 미만 소수는 첫째 자리까지 보여준다.
      var smallRounded = Math.floor(abs * 10) / 10;
      var smallText = smallRounded.toFixed(1).replace(/\.0$/, '');
      return (negative ? '-' : '') + smallText;
    }

    var intValue = Math.floor(abs);
    var withCommas = intValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (negative ? '-' : '') + withCommas;
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
    if (typeof candidate.snacks !== 'number' || candidate.snacks < 0) {
      return false;
    }
    if (typeof candidate.lifetimeProduced !== 'number' || candidate.lifetimeProduced < 0) {
      return false;
    }
    if (typeof candidate.clickCount !== 'number' || candidate.clickCount < 0) {
      return false;
    }
    if (typeof candidate.stageId !== 'number' || candidate.stageId < 1) {
      return false;
    }
    if (!candidate.buildings || typeof candidate.buildings !== 'object') {
      return false;
    }
    var buildingsValid = Content.BUILDINGS.every(function (building) {
      var entry = candidate.buildings[building.key];
      return entry && typeof entry.owned === 'number' && entry.owned >= 0;
    });
    if (!buildingsValid) {
      return false;
    }
    if (!candidate.upgrades || typeof candidate.upgrades !== 'object') {
      return false;
    }
    if (!candidate.achievements || typeof candidate.achievements !== 'object') {
      return false;
    }
    if (typeof candidate.currentQuestIndex !== 'number' || candidate.currentQuestIndex < 0) {
      return false;
    }
    if (typeof candidate.prestigePoints !== 'number' || candidate.prestigePoints < 0) {
      return false;
    }
    if (typeof candidate.prestigeCount !== 'number' || candidate.prestigeCount < 0) {
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

    // 신규 필드에 대한 기본값 보강 (구버전 저장과의 순방향 호환).
    var fresh = createNewState();
    Object.keys(fresh).forEach(function (key) {
      if (parsed[key] === undefined) {
        parsed[key] = fresh[key];
      }
    });
    Content.BUILDINGS.forEach(function (building) {
      if (!parsed.buildings[building.key]) {
        parsed.buildings[building.key] = { owned: 0 };
      }
    });
    Content.UPGRADES.forEach(function (upgrade) {
      if (parsed.upgrades[upgrade.key] === undefined) {
        parsed.upgrades[upgrade.key] = false;
      }
    });
    Content.ACHIEVEMENTS.forEach(function (achievement) {
      if (parsed.achievements[achievement.key] === undefined) {
        parsed.achievements[achievement.key] = false;
      }
    });

    return parsed;
  }

  // ---- 밸런스 안전망 검증 ----

  function validateStageProgression() {
    var problems = [];
    var stages = Content.STAGES;

    for (var i = 1; i < stages.length; i += 1) {
      if (stages[i].upgradeCost <= stages[i - 1].upgradeCost) {
        problems.push('stage ' + stages[i].id + ' upgradeCost는 이전 무대보다 커야 함');
      }
    }

    Content.BUILDINGS.forEach(function (building) {
      var stage = findStage(building.unlockStage);
      if (!stage) {
        problems.push('building ' + building.key + '의 unlockStage가 존재하지 않음');
      }
    });

    Content.UPGRADES.forEach(function (upgrade) {
      var stage = findStage(upgrade.unlockStage);
      if (!stage) {
        problems.push('upgrade ' + upgrade.key + '의 unlockStage가 존재하지 않음');
      }
    });

    Content.DELIVERIES.forEach(function (delivery) {
      var stage = findStage(delivery.unlockStage);
      if (!stage) {
        problems.push('delivery ' + delivery.key + '의 unlockStage가 존재하지 않음');
      }
    });

    return problems;
  }

  var IdleEngine = {
    findBuilding: findBuilding,
    findStage: findStage,
    findUpgrade: findUpgrade,
    findDelivery: findDelivery,
    createNewState: createNewState,
    addProduced: addProduced,
    buildingCost: buildingCost,
    getBuildingCost: getBuildingCost,
    productionMultiplier: productionMultiplier,
    baseProductionPerSecond: baseProductionPerSecond,
    getProductionPerSecond: getProductionPerSecond,
    getClickAmount: getClickAmount,
    getOfflineCapHours: getOfflineCapHours,
    isBuildingUnlocked: isBuildingUnlocked,
    isUpgradeUnlocked: isUpgradeUnlocked,
    isDeliveryUnlocked: isDeliveryUnlocked,
    isGoldenSnackUnlocked: isGoldenSnackUnlocked,
    getNextStage: getNextStage,
    applyClick: applyClick,
    applyProductionTick: applyProductionTick,
    buyBuilding: buyBuilding,
    buyUpgrade: buyUpgrade,
    upgradeStage: upgradeStage,
    startDelivery: startDelivery,
    isDeliveryComplete: isDeliveryComplete,
    collectDelivery: collectDelivery,
    collectGoldenSnack: collectGoldenSnack,
    isQuestConditionMet: isQuestConditionMet,
    getCurrentQuest: getCurrentQuest,
    isCurrentQuestComplete: isCurrentQuestComplete,
    claimCurrentQuest: claimCurrentQuest,
    isAchievementConditionMet: isAchievementConditionMet,
    checkAndClaimAchievements: checkAndClaimAchievements,
    getPrestigePointsForLifetime: getPrestigePointsForLifetime,
    getPrestigeGain: getPrestigeGain,
    getProducedUntilNextPrestigePoint: getProducedUntilNextPrestigePoint,
    canPrestige: canPrestige,
    prestige: prestige,
    computeOfflineEarnings: computeOfflineEarnings,
    applyOfflineEarnings: applyOfflineEarnings,
    getDeliveryStory: getDeliveryStory,
    recordWeeklySnapshotIfNeeded: recordWeeklySnapshotIfNeeded,
    formatNumber: formatNumber,
    serializeState: serializeState,
    deserializeState: deserializeState,
    isValidLoadedState: isValidLoadedState,
    validateStageProgression: validateStageProgression,
  };

  root.IdleEngine = IdleEngine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IdleEngine;
  }
})(typeof window !== 'undefined' ? window : this);

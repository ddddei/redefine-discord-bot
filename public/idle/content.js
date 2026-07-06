(function (root) {
  'use strict';

  // 저장 데이터 버전. 저장 스키마가 바뀌면 engine.js의 역직렬화 검증과 함께 올린다.
  var SAVE_VERSION = 1;
  var SAVE_KEY = 'redefine-idle-save-v1';

  // 시설 구매 비용 곡선의 공통 배율. 비용 = 기본 비용 × BUILDING_COST_GROWTH^보유수 (내림).
  var BUILDING_COST_GROWTH = 1.15;

  // 무대 정의. 승급 비용은 간식 보유량 기준 지불형이며, 해금 배열은 이 무대에서 새로 열리는
  // 시설/기능 키를 담는다. index 0이 시작 무대(길거리 좌판)다.
  var STAGES = [
    {
      id: 1,
      key: 'street-stall',
      title: '길거리 좌판',
      role: '떠돌이 견습생',
      upgradeCost: 0,
      unlocksBuildings: ['strawberry'],
      unlocksFeatures: [],
      sceneEmoji: '🧺🍓',
      announceCopy: '작은 돗자리 하나로 시작해요.',
    },
    {
      id: 2,
      key: 'food-cart',
      title: '포장마차',
      role: '포장마차 사장',
      upgradeCost: 2000,
      unlocksBuildings: ['orange'],
      unlocksFeatures: ['delivery'],
      sceneEmoji: '🛒⛺',
      announceCopy: '수레와 천막을 갖췄어요. 이제 배달도 보낼 수 있어요.',
    },
    {
      id: 3,
      key: 'neighborhood-shop',
      title: '동네 가게',
      role: '골목 제과사',
      upgradeCost: 50000,
      unlocksBuildings: ['candy'],
      unlocksFeatures: ['goldenSnack'],
      sceneEmoji: '🏪🍬',
      announceCopy: '간판을 달고 가게를 열었어요. 가끔 특별한 간식도 나타나요.',
    },
    {
      id: 4,
      key: 'snack-workshop',
      title: '간식 공방',
      role: '공방 파티시에',
      upgradeCost: 1500000,
      unlocksBuildings: ['cookie', 'cupcake'],
      unlocksFeatures: [],
      sceneEmoji: '🏭🍪',
      announceCopy: '오븐에 불을 붙였어요. 공방다운 모습을 갖춰가요.',
    },
    {
      id: 5,
      key: 'snack-factory',
      title: '간식 공장',
      role: '공장장',
      upgradeCost: 80000000,
      unlocksBuildings: ['jelly'],
      unlocksFeatures: ['longDelivery'],
      sceneEmoji: '🏗️🚚',
      announceCopy: '컨베이어가 돌아가요. 먼 곳까지 배달할 수 있어요.',
    },
    {
      id: 6,
      key: 'snack-kingdom',
      title: '간식 왕국',
      role: '간식 대왕',
      upgradeCost: 5000000000,
      unlocksBuildings: [],
      unlocksFeatures: ['prestige'],
      sceneEmoji: '🏰🚩',
      announceCopy: '성과 깃발이 세워졌어요. 이제 비법 레시피를 남길 수 있어요.',
    },
  ];

  // 생산 시설 정의. costPerUnit이 BUILDING_COST_GROWTH 곡선의 기본 비용, ratePerUnit이
  // 1대당 초당 생산량이다. unlockStage는 STAGES[].id 기준.
  var BUILDINGS = [
    {
      key: 'strawberry',
      name: '딸기 텃밭',
      emoji: '🍓',
      unlockStage: 1,
      baseCost: 15,
      ratePerUnit: 0.5,
    },
    {
      key: 'orange',
      name: '오렌지 과수원',
      emoji: '🍊',
      unlockStage: 2,
      baseCost: 200,
      ratePerUnit: 3,
    },
    {
      key: 'candy',
      name: '사탕 기계',
      emoji: '🍬',
      unlockStage: 3,
      baseCost: 3000,
      ratePerUnit: 20,
    },
    {
      key: 'cookie',
      name: '쿠키 오븐',
      emoji: '🍪',
      unlockStage: 4,
      baseCost: 60000,
      ratePerUnit: 150,
    },
    {
      key: 'cupcake',
      name: '컵케이크 스탠드',
      emoji: '🧁',
      unlockStage: 4,
      baseCost: 500000,
      ratePerUnit: 800,
    },
    {
      key: 'jelly',
      name: '젤리 공장',
      emoji: '🍇',
      unlockStage: 5,
      baseCost: 10000000,
      ratePerUnit: 6000,
    },
  ];

  // 무대 장면 소품 최대 표시 수(시설 구매 시 하나씩 추가, 무대별 상한).
  var MAX_SCENE_PROPS_PER_STAGE = 8;

  // 업그레이드 정의. 일회성 구매, effect.type으로 engine.js가 분기한다.
  //  - clickAdd: 클릭당 생산량에 고정치 더함
  //  - clickPercentOfRate: 클릭당 생산량에 (초당 생산량 × percent) 더함
  //  - productionMultiplier: 전체 생산량(클릭 포함)에 곱연산 배율 적용
  //  - offlineCapHours: 오프라인 수익 상한 시간을 지정값으로 교체
  var UPGRADES = [
    {
      key: 'sturdy-fingers',
      name: '튼튼한 손가락',
      cost: 500,
      unlockStage: 1,
      effect: { type: 'clickAdd', amount: 4 },
      description: '클릭당 생산량이 4 늘어요 (기본 1 → 5).',
    },
    {
      key: 'sweet-recipe',
      name: '달콤한 레시피',
      cost: 8000,
      unlockStage: 2,
      effect: { type: 'productionMultiplier', amount: 2 },
      description: '전체 생산량이 두 배가 돼요.',
    },
    {
      key: 'snack-courier',
      name: '간식 배달부',
      cost: 100000,
      unlockStage: 3,
      effect: { type: 'clickPercentOfRate', amount: 0.01 },
      description: '클릭당 생산량에 초당 생산량의 1%가 더해져요.',
    },
    {
      key: 'workshop-expansion',
      name: '공방 확장',
      cost: 2000000,
      unlockStage: 4,
      effect: { type: 'productionMultiplier', amount: 2 },
      description: '전체 생산량이 다시 두 배가 돼요.',
    },
    {
      key: 'night-fairy',
      name: '야간 요정',
      cost: 50000000,
      unlockStage: 5,
      effect: { type: 'offlineCapHours', amount: 24 },
      description: '오프라인 수익 상한이 8시간에서 24시간으로 늘어요.',
    },
  ];

  var DEFAULT_OFFLINE_CAP_HOURS = 8;
  var EXTENDED_OFFLINE_CAP_HOURS = 24;

  // 간식 배달 의뢰 정의. durationMs가 소요 시간, rewardSeconds가 "수령 시점 초당 생산량 ×
  // rewardSeconds"로 보상을 계산하는 배수다.
  var DELIVERIES = [
    {
      key: 'neighborhood-delivery',
      name: '동네 배달',
      unlockStage: 2,
      durationMs: 5 * 60 * 1000,
      rewardSeconds: 900,
    },
    {
      key: 'festival-supply',
      name: '축제 납품',
      unlockStage: 3,
      durationMs: 60 * 60 * 1000,
      rewardSeconds: 10800,
    },
    {
      key: 'royal-tribute',
      name: '왕궁 진상',
      unlockStage: 5,
      durationMs: 8 * 60 * 60 * 1000,
      rewardSeconds: 115200,
    },
  ];

  // 파견 완료 시 목적지별로 순환 표시되는 이야기 카드(계획서 2.2절). 방문 횟수
  // 기반 결정적 인덱스로 고른다(engine.js getDeliveryStory). 목적지별 4종.
  var DELIVERY_STORIES = {};

  // 황금 간식 등장 설정 (무대 3부터, 화면이 보이는 동안에만).
  var GOLDEN_SNACK = {
    unlockStage: 3,
    minIntervalMs: 45 * 1000,
    maxIntervalMs: 120 * 1000,
    visibleDurationMs: 7 * 1000,
    instantRewardSeconds: 420,
    clickBoostMultiplier: 7,
    clickBoostDurationMs: 30 * 1000,
  };

  // 환생(비법 레시피) 설정.
  var PRESTIGE = {
    requiredStageId: 6,
    lifetimeProducedDivisor: 5000000000,
    productionBonusPerPoint: 0.1,
  };

  // 퀘스트 체인. condition.type으로 engine.js가 판정한다:
  //  - snackMade: 누적 생산량(클릭+시설 총합) >= amount
  //  - buildingOwned: buildings[key].owned >= amount
  //  - stageReached: stage.id >= amount
  //  - deliveryCompletedCount: 완료한 배달 총 횟수 >= amount
  //  - upgradeOwned: upgrades[key] 구매됨
  //  - prestigeCount: 환생 횟수 >= amount
  var QUESTS = [
    { id: 1, description: '간식 10개 만들기', condition: { type: 'snackMade', amount: 10 }, reward: 20 },
    { id: 2, description: '딸기 텃밭 1대 사기', condition: { type: 'buildingOwned', key: 'strawberry', amount: 1 }, reward: 50 },
    { id: 3, description: '딸기 텃밭 5대 모으기', condition: { type: 'buildingOwned', key: 'strawberry', amount: 5 }, reward: 300 },
    { id: 4, description: '포장마차로 승급하기', condition: { type: 'stageReached', amount: 2 }, reward: 1000 },
    { id: 5, description: '첫 배달 보내기', condition: { type: 'deliveryStartedCount', amount: 1 }, reward: 2000 },
    { id: 6, description: '오렌지 과수원 5대 모으기', condition: { type: 'buildingOwned', key: 'orange', amount: 5 }, reward: 4000 },
    { id: 7, description: '튼튼한 손가락 배우기', condition: { type: 'upgradeOwned', key: 'sturdy-fingers' }, reward: 6000 },
    { id: 8, description: '배달 1건 완료하기', condition: { type: 'deliveryCompletedCount', amount: 1 }, reward: 9000 },
    { id: 9, description: '동네 가게로 승급하기', condition: { type: 'stageReached', amount: 3 }, reward: 30000 },
    { id: 10, description: '사탕 기계 10대 모으기', condition: { type: 'buildingOwned', key: 'candy', amount: 10 }, reward: 80000 },
    { id: 11, description: '달콤한 레시피 배우기', condition: { type: 'upgradeOwned', key: 'sweet-recipe' }, reward: 120000 },
    { id: 12, description: '축제 납품 배달 완료하기', condition: { type: 'deliveryCompletedCount', amount: 2 }, reward: 250000 },
    { id: 13, description: '간식 공방으로 승급하기', condition: { type: 'stageReached', amount: 4 }, reward: 900000 },
    { id: 14, description: '쿠키 오븐 10대 모으기', condition: { type: 'buildingOwned', key: 'cookie', amount: 10 }, reward: 2500000 },
    { id: 15, description: '컵케이크 스탠드 10대 모으기', condition: { type: 'buildingOwned', key: 'cupcake', amount: 10 }, reward: 6000000 },
    { id: 16, description: '공방 확장 배우기', condition: { type: 'upgradeOwned', key: 'workshop-expansion' }, reward: 15000000 },
    { id: 17, description: '간식 공장으로 승급하기', condition: { type: 'stageReached', amount: 5 }, reward: 50000000 },
    { id: 18, description: '젤리 공장 5대 모으기', condition: { type: 'buildingOwned', key: 'jelly', amount: 5 }, reward: 150000000 },
    { id: 19, description: '왕궁 진상 배달 완료하기', condition: { type: 'deliveryCompletedCount', amount: 3 }, reward: 500000000 },
    { id: 20, description: '간식 왕국으로 승급하기', condition: { type: 'stageReached', amount: 6 }, reward: 0, isPrestigeAnnounce: true },
  ];

  // 업적 도감. condition.type으로 engine.js가 판정한다:
  //  - buildingOwned: buildings[key].owned >= amount (특정 시설 1종)
  //  - allBuildingsOwned: 정의된 모든 시설을 1대 이상 보유
  //  - clickCount: 누적 클릭 수 >= amount
  //  - stageReached: stage.id >= amount
  //  - deliveryCompletedCount: 완료한 배달 총 횟수 >= amount
  //  - goldenSnackClickedCount: 황금 간식 클릭 횟수 >= amount
  //  - prestigeCount: 환생 횟수 >= amount
  //  - lifetimeProduced: 누적 생산량 >= amount
  var ACHIEVEMENTS = [
    { key: 'first-building', name: '첫 시설 구매', condition: { type: 'buildingOwned', key: 'strawberry', amount: 1 }, reward: 100 },
    { key: 'click-1000', name: '클릭 1,000회', condition: { type: 'clickCount', amount: 1000 }, reward: 5000 },
    { key: 'stage-2', name: '포장마차 도달', condition: { type: 'stageReached', amount: 2 }, reward: 1000 },
    { key: 'stage-3', name: '동네 가게 도달', condition: { type: 'stageReached', amount: 3 }, reward: 20000 },
    { key: 'stage-4', name: '간식 공방 도달', condition: { type: 'stageReached', amount: 4 }, reward: 500000 },
    { key: 'stage-5', name: '간식 공장 도달', condition: { type: 'stageReached', amount: 5 }, reward: 20000000 },
    { key: 'stage-6', name: '간식 왕국 도달', condition: { type: 'stageReached', amount: 6 }, reward: 1000000000 },
    { key: 'delivery-10', name: '배달 10회 완료', condition: { type: 'deliveryCompletedCount', amount: 10 }, reward: 3000000 },
    { key: 'golden-snack-5', name: '황금 간식 5회', condition: { type: 'goldenSnackClickedCount', amount: 5 }, reward: 200000 },
    { key: 'first-prestige', name: '첫 환생', condition: { type: 'prestigeCount', amount: 1 }, reward: 0 },
    { key: 'all-buildings', name: '시설 전 종류 보유', condition: { type: 'allBuildingsOwned' }, reward: 10000000 },
    { key: 'lifetime-100m', name: '누적 1억 달성', condition: { type: 'lifetimeProduced', amount: 100000000 }, reward: 5000000 },
  ];

  var BASE_CLICK_AMOUNT = 1;

  // 큰 수 표기 단위 (한국식). 각 threshold 이상일 때 divisor로 나눠 소수 첫째 자리까지 표시.
  var NUMBER_UNITS = [
    { threshold: 1000000000000, divisor: 1000000000000, suffix: '조' },
    { threshold: 100000000, divisor: 100000000, suffix: '억' },
    { threshold: 10000, divisor: 10000, suffix: '만' },
  ];

  var AUTOSAVE_INTERVAL_MS = 15 * 1000;

  var IdleContent = {
    SAVE_VERSION: SAVE_VERSION,
    SAVE_KEY: SAVE_KEY,
    BUILDING_COST_GROWTH: BUILDING_COST_GROWTH,
    STAGES: STAGES,
    BUILDINGS: BUILDINGS,
    MAX_SCENE_PROPS_PER_STAGE: MAX_SCENE_PROPS_PER_STAGE,
    UPGRADES: UPGRADES,
    DEFAULT_OFFLINE_CAP_HOURS: DEFAULT_OFFLINE_CAP_HOURS,
    EXTENDED_OFFLINE_CAP_HOURS: EXTENDED_OFFLINE_CAP_HOURS,
    DELIVERIES: DELIVERIES,
    DELIVERY_STORIES: DELIVERY_STORIES,
    GOLDEN_SNACK: GOLDEN_SNACK,
    PRESTIGE: PRESTIGE,
    QUESTS: QUESTS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    BASE_CLICK_AMOUNT: BASE_CLICK_AMOUNT,
    NUMBER_UNITS: NUMBER_UNITS,
    AUTOSAVE_INTERVAL_MS: AUTOSAVE_INTERVAL_MS,
  };

  root.IdleContent = IdleContent;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IdleContent;
  }
})(typeof window !== 'undefined' ? window : this);

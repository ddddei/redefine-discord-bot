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

  // 간식 배달 의뢰 정의(계획서 2.1절 — 6종으로 확장). durationMs가 소요 시간,
  // rewardSeconds가 "수령 시점 초당 생산량 × rewardSeconds"로 보상을 계산하는 배수다.
  // 계획서 표의 "생산량 N분치"를 그대로 rewardSeconds(초 단위)로 옮겼다 — 원칙은
  // "방치 대비 약간 이득 + 돌아오는 재미"이며, 파견 중에도 기본 생산은 계속되므로
  // 구버전 3종(동네 배달 등, 소요 대비 보상 3~4배)보다는 낮은 배율(0.58~0.73배)로
  // 실측 조정했다 — 자세한 근거는 최종 보고서 3번 항목 참고.
  // goldenBonusChance: 강가 찻집 전용, 낮은 확률 황금 간식 보너스(Math.random 허용 —
  // idle은 랭킹 미노출 장르라 시드 무관, 기존 황금 간식과 동일 원칙).
  // prestigePointReward: 성문 앞 축제/달빛 기차역 전용, 레시피 조각(환생 포인트 직접 지급).
  var DELIVERIES = [
    {
      key: 'alley-errand',
      name: '골목 어귀',
      unlockStage: 1,
      durationMs: 5 * 60 * 1000,
      rewardSeconds: 180, // 생산량 3분치
    },
    {
      key: 'village-market',
      name: '마을 장터',
      unlockStage: 2,
      durationMs: 15 * 60 * 1000,
      rewardSeconds: 600, // 생산량 10분치
    },
    {
      key: 'riverside-teahouse',
      name: '강가 찻집',
      unlockStage: 3,
      durationMs: 30 * 60 * 1000,
      rewardSeconds: 1320, // 생산량 22분치
      goldenBonusChance: 0.12,
    },
    {
      key: 'forest-campsite',
      name: '숲속 야영지',
      unlockStage: 4,
      durationMs: 2 * 60 * 60 * 1000,
      rewardSeconds: 5400, // 생산량 90분치
    },
    {
      key: 'gatefront-festival',
      name: '성문 앞 축제',
      unlockStage: 5,
      durationMs: 8 * 60 * 60 * 1000,
      rewardSeconds: 18000, // 생산량 5시간치
      prestigePointReward: 1,
    },
    {
      key: 'moonlit-station',
      name: '달빛 기차역',
      unlockStage: 6,
      durationMs: 24 * 60 * 60 * 1000,
      rewardSeconds: 50400, // 생산량 14시간치
      prestigePointReward: 2,
    },
  ];

  // 파견 완료 시 목적지별로 순환 표시되는 이야기 카드(계획서 2.2절). 방문 횟수
  // 기반 결정적 인덱스로 고른다(engine.js getDeliveryStory, RNG 아님). 목적지별 4종,
  // id는 도감 수집 여부 저장 키(state.collectedStories)로 쓰인다.
  var DELIVERY_STORIES = {
    'alley-errand': [
      {
        id: 'alley-errand-1',
        title: '골목 어귀',
        body: '좁은 골목을 돌아 나가니 낯익은 담벼락이 보였어요. 바구니를 문 앞에 살며시 내려두고 돌아왔어요.',
      },
      {
        id: 'alley-errand-2',
        title: '골목 어귀',
        body: '고양이 한 마리가 배달 바구니 냄새를 맡으며 따라왔어요. 나눠줄 순 없었지만, 잠시 함께 걸어 좋았어요.',
      },
      {
        id: 'alley-errand-3',
        title: '골목 어귀',
        body: '비 온 다음 날이라 골목이 촉촉했어요. 물웅덩이를 피해 조심조심, 그래도 무사히 도착했어요.',
      },
      {
        id: 'alley-errand-4',
        title: '골목 어귀',
        body: '문 앞에 작은 쪽지가 붙어 있었어요. "잘 먹었어요" 라고요. 짧은 한마디가 오늘 하루를 가볍게 해줬어요.',
      },
    ],
    'village-market': [
      {
        id: 'village-market-1',
        title: '마을 장터',
        body: '장터에 들어서자마자 왁자지껄한 소리가 반겨줬어요. 상인들 사이를 누비며 배달함을 무사히 전했어요.',
      },
      {
        id: 'village-market-2',
        title: '마을 장터',
        body: '단골 채소 가게 아주머니가 손을 흔들어 주셨어요. "오늘도 수고한다"는 말 한마디가 발걸음을 가볍게 했어요.',
      },
      {
        id: 'village-market-3',
        title: '마을 장터',
        body: '장이 서는 날이라 사람이 많았어요. 조금 돌아가긴 했지만, 새로 생긴 노점을 구경할 수 있었어요.',
      },
      {
        id: 'village-market-4',
        title: '마을 장터',
        body: '장터 한켠에서 아이들이 공깃돌 놀이를 하고 있었어요. 잠깐 구경하다 다시 길을 나섰어요.',
      },
    ],
    'riverside-teahouse': [
      {
        id: 'riverside-teahouse-1',
        title: '강가 찻집',
        body: '강바람을 맞으며 걷다 보니 찻집의 풍경 소리가 들려왔어요. 따뜻한 차 향이 마중 나와 있었어요.',
      },
      {
        id: 'riverside-teahouse-2',
        title: '강가 찻집',
        body: '주인장이 방금 우린 차 한 모금을 건넸어요. 사양하기 미안해 한 모금만 마시고 다시 길을 나섰어요.',
      },
      {
        id: 'riverside-teahouse-3',
        title: '강가 찻집',
        body: '강물 위로 노을이 번지고 있었어요. 배달을 마치고 잠시 난간에 기대 그 풍경을 바라봤어요.',
      },
      {
        id: 'riverside-teahouse-4',
        title: '강가 찻집',
        body: '찻집 창가에 손님들이 도란도란 이야기를 나누고 있었어요. 그 온기를 등지고 나오는 발걸음이 따뜻했어요.',
      },
    ],
    'forest-campsite': [
      {
        id: 'forest-campsite-1',
        title: '숲속 야영지',
        body: '나무 그늘을 따라 한참을 걸었어요. 야영지에 도착하니 모닥불 냄새가 은은하게 퍼져 있었어요.',
      },
      {
        id: 'forest-campsite-2',
        title: '숲속 야영지',
        body: '텐트 사이로 아이들이 뛰어다니고 있었어요. 배달함을 조심스레 내려두고, 방해되지 않게 조용히 물러났어요.',
      },
      {
        id: 'forest-campsite-3',
        title: '숲속 야영지',
        body: '길을 걷다 다람쥐와 눈이 마주쳤어요. 서로 잠깐 멈춰 섰다가, 각자의 길을 갔어요.',
      },
      {
        id: 'forest-campsite-4',
        title: '숲속 야영지',
        body: '야영객들이 둘러앉아 별을 보고 있었어요. 방해하고 싶지 않아 발소리를 낮추고 다녀왔어요.',
      },
    ],
    'gatefront-festival': [
      {
        id: 'gatefront-festival-1',
        title: '성문 앞 축제',
        body: '성문 앞은 등불로 가득했어요. 사람들 사이를 지나 축제 준비 천막에 배달함을 무사히 전했어요.',
      },
      {
        id: 'gatefront-festival-2',
        title: '성문 앞 축제',
        body: '악단의 연주가 울려 퍼지고 있었어요. 발걸음이 절로 가벼워져 콧노래를 흥얼거리며 돌아왔어요.',
      },
      {
        id: 'gatefront-festival-3',
        title: '성문 앞 축제',
        body: '축제 준비로 다들 분주했지만, 잠시 짬을 내 오래된 레시피 조각 하나를 건네받았어요.',
      },
      {
        id: 'gatefront-festival-4',
        title: '성문 앞 축제',
        body: '성벽 위에서 내려다본 축제 풍경이 반짝였어요. 그 장면을 눈에 담고 조용히 발길을 돌렸어요.',
      },
    ],
    'moonlit-station': [
      {
        id: 'moonlit-station-1',
        title: '달빛 기차역',
        body: '달빛만 비추는 조용한 기차역에 도착했어요. 인적 드문 승강장에 배달함을 조심히 내려두었어요.',
      },
      {
        id: 'moonlit-station-2',
        title: '달빛 기차역',
        body: '먼 길을 오가는 기차가 기적을 울리며 지나갔어요. 그 소리를 배웅 삼아 다시 발걸음을 옮겼어요.',
      },
      {
        id: 'moonlit-station-3',
        title: '달빛 기차역',
        body: '역무원이 낡은 레시피 수첩 한 장을 건네주었어요. "오래 간직했던 거예요"라는 말과 함께요.',
      },
      {
        id: 'moonlit-station-4',
        title: '달빛 기차역',
        body: '플랫폼 끝에서 별이 유난히 밝게 보였어요. 잠시 올려다보다, 다음 배달을 위해 돌아섰어요.',
      },
    ],
  };

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
    { id: 12, description: '배달 2건 완료하기', condition: { type: 'deliveryCompletedCount', amount: 2 }, reward: 250000 },
    { id: 13, description: '간식 공방으로 승급하기', condition: { type: 'stageReached', amount: 4 }, reward: 900000 },
    { id: 14, description: '쿠키 오븐 10대 모으기', condition: { type: 'buildingOwned', key: 'cookie', amount: 10 }, reward: 2500000 },
    { id: 15, description: '컵케이크 스탠드 10대 모으기', condition: { type: 'buildingOwned', key: 'cupcake', amount: 10 }, reward: 6000000 },
    { id: 16, description: '공방 확장 배우기', condition: { type: 'upgradeOwned', key: 'workshop-expansion' }, reward: 15000000 },
    { id: 17, description: '간식 공장으로 승급하기', condition: { type: 'stageReached', amount: 5 }, reward: 50000000 },
    { id: 18, description: '젤리 공장 5대 모으기', condition: { type: 'buildingOwned', key: 'jelly', amount: 5 }, reward: 150000000 },
    { id: 19, description: '배달 3건 완료하기', condition: { type: 'deliveryCompletedCount', amount: 3 }, reward: 500000000 },
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

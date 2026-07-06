(function (root) {
  'use strict';

  // 정의 데이터 전용 모듈. DOM/localStorage/시간/난수에 접근하지 않는다.

  // v1(선형 11칸) → v2(갈림길 13층 맵, 파워/유물/이벤트/저주) — 저장 스키마가
  // 호환되지 않으므로 상향한다. 구버전 세이브는 engine.js의 마이그레이션 경로에서
  // 통산 기록만 보존하고 새 런으로 전환한다(docs/deck-improvement-plan.md 6절).
  var SAVE_VERSION = 2;
  var SAVE_KEY = 'redefine-deck-save-v1';

  var PLAYER_MAX_HP = 60;
  var PLAYER_ENERGY_PER_TURN = 3;
  var PLAYER_DRAW_PER_TURN = 5;

  var WEAK_MULTIPLIER = 0.75;
  var VULNERABLE_MULTIPLIER = 1.5;

  var REST_HEAL_PERCENT = 0.3;

  // ---- 갈림길 맵 (13층) ----
  // 층별 노드 수 1~3, 인접 열로만 연결. 타입 분포(계획서 3.1):
  // 일반 5~7, 정예 2(7층 이하 1·이상 1), 휴식 2(연속 층 금지), 이벤트 2~3, 보스 1(13층 고정).
  // 1층은 항상 일반 전투.
  var MAP_FLOOR_COUNT = 13;
  var MAP_MIN_NODES_PER_FLOOR = 1;
  var MAP_MAX_NODES_PER_FLOOR = 3;

  var NODE_TYPES = {
    NORMAL: 'normal',
    ELITE: 'elite',
    REST: 'rest',
    EVENT: 'event',
    BOSS: 'boss',
  };

  // 점수 공식: 도달 층 × 1000 + 잔여 HP. 기본 HP 기준 이론상 최대 = 13 × 1000 + 60 = 13,060
  // (계획서 3.1 표기 값). 서버 GAME_DEFINITIONS.deck.maxScore는 유물 '딸기 심장'(+12 최대
  // HP)을 반영한 13,072를 상한으로 쓴다 - 클라 쪽 MAX_SCORE 상수는 계획서 기준값을 유지한다.
  var SCORE_PER_FLOOR = 1000;
  var MAX_SCORE = MAP_FLOOR_COUNT * SCORE_PER_FLOOR + PLAYER_MAX_HP;

  // ---- 시작 덱 (10장) ----
  // 카드 정의: id, name, cost, rarity('starter'|'common'|'elite'), type('attack'|'skill'|'power'),
  // tags(시너지 배지 표시용, 선택), effect(프리미티브 조합), art(원화 파일명 - 도착 전에는
  // 잉크 문양 폴백 렌더로 game.js가 대체한다).
  // effect 프리미티브: damage, hits(다단 히트 횟수, damage와 함께 사용), block, draw,
  // energy(획득량), strength, weak(부여 턴 수), vulnerable(부여 턴 수), heal, selfDamage,
  // blockCarryover(다음 턴 이월 방어도), bonusDamagePerAttackPlayed(이번 턴 사용한 공격
  // 카드 수 × 이 값만큼 추가 피해 - 연격 시너지), freeIfFirstPlayNoCost(비축 시너지:
  // 이번 턴 첫 카드가 비용 0으로 나가면 추가 드로우), exile(런 중 1회성 소멸),
  // strengthPerTurn(파워: 매 턴 시작 시 힘 획득), blockPerTurn(파워: 매 턴 시작 시 방어도 획득),
  // randomFromDiscard(버린 더미에서 무작위 1장을 손으로).
  var STARTER_DECK = [
    { id: 'rolling-pin-swing', count: 5 },
    { id: 'dough-shield', count: 4 },
    { id: 'secret-notebook', count: 1 },
  ];

  var CARDS = [
    // 시작 카드
    {
      id: 'rolling-pin-swing',
      name: '밀대 휘두르기',
      rarity: 'starter',
      cost: 1,
      effect: { damage: 6 },
    },
    {
      id: 'dough-shield',
      name: '반죽 방패',
      rarity: 'starter',
      cost: 1,
      effect: { block: 5 },
    },
    {
      id: 'secret-notebook',
      name: '비법 노트',
      rarity: 'starter',
      cost: 1,
      effect: { draw: 2 },
    },

    // 일반 획득 카드 12종
    {
      id: 'baguette-stab',
      name: '바게트 찌르기',
      rarity: 'common',
      cost: 1,
      effect: { damage: 9 },
    },
    {
      id: 'croissant-flurry',
      name: '크루아상 연타',
      rarity: 'common',
      cost: 1,
      effect: { damage: 3, hits: 3 },
    },
    {
      id: 'open-the-oven',
      name: '오븐 열기',
      rarity: 'common',
      cost: 2,
      effect: { damage: 12, vulnerable: 1 },
    },
    {
      id: 'flour-cloud',
      name: '밀가루 구름',
      rarity: 'common',
      cost: 1,
      effect: { weak: 2 },
    },
    {
      id: 'sugar-coating',
      name: '슈거 코팅',
      rarity: 'common',
      cost: 1,
      effect: { block: 8 },
    },
    {
      id: 'yeast-proofing',
      name: '이스트 발효',
      rarity: 'common',
      cost: 1,
      effect: { strength: 2 },
    },
    {
      id: 'tidy-recipe',
      name: '레시피 정리',
      rarity: 'common',
      cost: 1,
      effect: { draw: 3 },
    },
    {
      id: 'tea-time',
      name: '티타임',
      rarity: 'common',
      cost: 1,
      effect: { heal: 4 },
    },
    {
      id: 'butter-slide',
      name: '버터 슬라이드',
      rarity: 'common',
      cost: 0,
      effect: { damage: 4 },
    },
    {
      id: 'dough-roll',
      name: '도우 굴리기',
      rarity: 'common',
      cost: 2,
      effect: { block: 6, damage: 6 },
    },
    {
      id: 'measure-precisely',
      name: '계량 정확히',
      rarity: 'common',
      cost: 0,
      effect: { energy: 1 },
    },
    {
      id: 'apply-jam',
      name: '잼 바르기',
      rarity: 'common',
      cost: 1,
      effect: { damage: 5, weak: 1 },
    },

    // 정예급 카드 6종
    {
      id: 'giant-rolling-pin',
      name: '대형 홍두깨',
      rarity: 'elite',
      cost: 2,
      effect: { damage: 20 },
    },
    {
      id: 'whipped-cream-storm',
      name: '생크림 폭풍',
      rarity: 'elite',
      cost: 2,
      effect: { damage: 5, hits: 3, weak: 1 },
    },
    {
      id: 'steel-oven-mitts',
      name: '강철 오븐장갑',
      rarity: 'elite',
      cost: 2,
      effect: { block: 14 },
    },
    {
      id: 'master-recipe',
      name: '마스터 레시피',
      rarity: 'elite',
      cost: 1,
      effect: { draw: 2, energy: 1 },
    },
    {
      id: 'special-dough',
      name: '특제 반죽',
      rarity: 'elite',
      cost: 2,
      effect: { strength: 3, block: 5 },
    },
    {
      id: 'oven-blast',
      name: '화덕 대폭발',
      rarity: 'elite',
      cost: 3,
      effect: { damage: 30, selfDamage: 3 },
    },

    // ---- 신규 카드 12종(v2 — docs/deck-improvement-plan.md 1절) ----
    // 시너지 축: 연격(공격 카드를 여러 장 낼수록 강해짐)·비축(에너지/드로우 효율).
    {
      id: 'croissant-double-tap',
      name: '크루아상 연타(이중)',
      rarity: 'common',
      cost: 1,
      tags: ['combo'],
      effect: { damage: 4, bonusDamagePerAttackPlayed: 2 },
    },
    {
      id: 'macaron-twin-window',
      name: '마카롱 이중창',
      rarity: 'common',
      cost: 2,
      tags: ['combo'],
      effect: { damage: 5, hits: 2 },
    },
    {
      id: 'choux-rampart',
      name: '슈크림 방벽',
      rarity: 'common',
      cost: 2,
      effect: { block: 8, blockCarryover: 3 },
    },
    {
      id: 'tiramisu-stockpile',
      name: '티라미수 비축',
      rarity: 'common',
      cost: 1,
      tags: ['stockpile'],
      effect: { draw: 2, freeIfFirstPlayNoCost: 1 },
    },
    {
      id: 'caramel-coagulate',
      name: '캐러멜 응고',
      rarity: 'common',
      cost: 1,
      effect: { weak: 2 },
    },
    {
      id: 'mint-blizzard',
      name: '박하 눈보라',
      rarity: 'common',
      cost: 2,
      effect: { damage: 3, vulnerable: 2 },
    },
    {
      id: 'butter-grease',
      name: '버터 기름칠',
      rarity: 'common',
      cost: 0,
      tags: ['stockpile'],
      effect: { energy: 1, exile: true },
    },
    {
      id: 'pretzel-knot',
      name: '프레첼 매듭',
      rarity: 'common',
      cost: 1,
      effect: { block: 5, strength: 1 },
    },
    {
      id: 'jam-bomb',
      name: '잼 폭탄',
      rarity: 'elite',
      cost: 3,
      effect: { damage: 14, selfWeak: 1 },
    },
    {
      id: 'cinnamon-awakening',
      name: '시나몬 각성',
      rarity: 'elite',
      cost: 2,
      type: 'power',
      effect: { strengthPerTurn: 1 },
    },
    {
      id: 'donut-cycle',
      name: '도넛 순환',
      rarity: 'common',
      cost: 1,
      effect: { randomFromDiscard: 1 },
    },
    {
      id: 'honey-glaze',
      name: '꿀 코팅',
      rarity: 'elite',
      cost: 2,
      type: 'power',
      effect: { blockPerTurn: 3 },
    },

    // ---- 저주 카드 ----
    // 이벤트 '잊힌 창고'에서 유물 대신 감수할 수 있는 저주. 효과 없음, 덱을 채워
    // 손패 효율을 떨어뜨리는 불리 카드. 소멸(exile)하지 않아 계속 손에 잡힌다.
    {
      id: 'soggy-bread',
      name: '눅눅한 빵',
      rarity: 'curse',
      cost: 1,
      effect: {},
    },
  ];

  // 보상 시 화면에 제시할 카드 수. 유물 '오래된 레시피북'으로 +1(4장).
  var REWARD_CARD_COUNT = 3;

  // ---- 유물 8종 (v2 — docs/deck-improvement-plan.md 2절) ----
  // 획득 경로: 정예 승리 확정 1개(시드 RNG 선택), 이벤트 보상. 효과는 프리미티브
  // 플래그로 표현하고 engine.js가 해석한다(카드와 동일한 설계 원칙 - 유물별 if 분기 최소화).
  var RELICS = [
    {
      id: 'bronze-kneading-plate',
      name: '청동 반죽틀',
      description: '매 전투 시작 시 방어도 5를 얻어요.',
      effect: { combatStartBlock: 5 },
    },
    {
      id: 'sugar-hourglass',
      name: '설탕 모래시계',
      description: '매 턴 첫 카드 비용이 1 줄어요(턴당 1회).',
      effect: { firstCardDiscount: 1 },
    },
    {
      id: 'salt-charm',
      name: '소금 부적',
      description: '적에게 약화·취약을 걸 때 지속 시간이 1턴 줄어요(최소 1턴).',
      effect: { debuffDurationReduction: 1 },
    },
    {
      id: 'furnace-ember',
      name: '화덕 잉걸',
      description: '전투 시작 시 적에게 피해 6을 줘요.',
      effect: { combatStartDamage: 6 },
    },
    {
      id: 'extra-apron',
      name: '여분의 앞치마',
      description: '손패 상한이 2 늘어나요.',
      effect: { handSizeBonus: 2 },
    },
    {
      id: 'old-recipe-book',
      name: '오래된 레시피북',
      description: '카드 보상 선택지가 3장에서 4장으로 늘어나요.',
      effect: { rewardCountBonus: 1 },
    },
    {
      id: 'strawberry-heart',
      name: '딸기 심장',
      description: '최대 HP가 12 늘고, 즉시 12만큼 회복돼요.',
      effect: { maxHpBonus: 12, immediateHeal: 12 },
    },
    {
      id: 'silver-spoon',
      name: '은수저',
      description: '휴식 칸 회복량이 50% 늘어나요.',
      effect: { restHealBonusPercent: 0.5 },
    },
  ];

  // ---- 이벤트 칸 10종 (v2 — docs/deck-improvement-plan.md 4절) ----
  // choices: 선택지별 { id, label, resultType, ... } — engine.js의 이벤트 결과 해석기가
  // resultType으로 분기한다(카드 효과와 동일한 프리미티브 조합 원칙).
  // 무작위 결과가 필요한 이벤트는 resultType: 'random'에 outcomes 배열(시드 결정적 선택).
  var EVENTS = [
    {
      id: 'wandering-merchant',
      title: '떠돌이 상인',
      body: '지친 상인이 손수레를 세우고 말을 건네요. "HP를 조금 나눠주면 좋은 물건을 드릴게요."',
      choices: [
        { id: 'pay-for-relic', label: 'HP 8을 지불하고 유물 받기', resultType: 'payHpForRelic', hpCost: 8 },
        { id: 'remove-card', label: '카드 1장 제거하기', resultType: 'removeCardChoice' },
        { id: 'skip', label: '그냥 지나가기', resultType: 'noop' },
      ],
    },
    {
      id: 'abandoned-oven',
      title: '버려진 오븐',
      body: '아직 온기가 남은 오븐이에요. 카드 하나를 넣으면 강화해서 꺼내줄 것 같아요.',
      choices: [
        { id: 'upgrade-card', label: '카드 1장 강화하기', resultType: 'upgradeCardChoice' },
        { id: 'ignore', label: '무시하기', resultType: 'noop' },
      ],
    },
    {
      id: 'sugar-spring',
      title: '설탕 샘',
      body: '달콤한 샘물이 솟아나요. 마시면 몸이 편해지고, 그릇에 담아 가면 오래 힘이 될 것 같아요.',
      choices: [
        { id: 'drink', label: 'HP 15 회복하기', resultType: 'heal', amount: 15 },
        { id: 'bottle', label: '최대 HP 5 늘리기(회복 없음)', resultType: 'maxHpBonus', amount: 5 },
      ],
    },
    {
      id: 'suspicious-cake-slice',
      title: '수상한 조각 케이크',
      body: '먹음직스럽지만 어딘가 수상한 케이크 조각이에요. 먹어볼까요?',
      choices: [
        {
          id: 'eat',
          label: '먹어보기(무작위)',
          resultType: 'random',
          outcomes: [
            { weight: 1, resultType: 'strength', amount: 2 },
            { weight: 1, resultType: 'selfDamage', amount: 10 },
          ],
        },
        { id: 'ignore', label: '무시하기', resultType: 'noop' },
      ],
    },
    {
      id: 'hungry-fledgling',
      title: '굶주린 아기 새',
      body: '아기 새가 배가 고픈지 카드를 자꾸 쪼아요. 한 장 내어주면 다음 전투에서 도와줄 것 같아요.',
      choices: [
        { id: 'feed', label: '카드 1장 주기(제거)', resultType: 'giveCardForNextCombatDebuff', enemyHpPenalty: 15 },
        { id: 'ignore', label: '무시하기', resultType: 'noop' },
      ],
    },
    {
      id: 'old-map',
      title: '낡은 지도',
      body: '다음 층으로 가는 길이 자세히 그려진 지도예요.',
      choices: [
        { id: 'reveal', label: '다음 층 노드 전부 공개하기', resultType: 'revealNextFloor' },
        { id: 'ignore', label: '무시하기', resultType: 'noop' },
      ],
    },
    {
      id: 'forgotten-storage',
      title: '잊힌 창고',
      body: '먼지 쌓인 창고에 카드 더미와 낡은 유물이 있어요. 유물 쪽엔 저주가 섞여 있을지도 몰라요.',
      choices: [
        { id: 'take-card', label: '카드 보상 받기', resultType: 'cardRewardChoice' },
        { id: 'take-relic-with-curse', label: '저주 카드를 감수하고 유물 받기', resultType: 'relicWithCurse' },
      ],
    },
    {
      id: 'quiet-altar',
      title: '조용한 제단',
      body: '조용한 제단 앞이에요. 마음에 걸리는 카드를 내려놓고 갈 수 있을 것 같아요.',
      choices: [
        { id: 'remove-card', label: '저주 또는 카드 1장 제거하기', resultType: 'removeCardChoice' },
        { id: 'ignore', label: '무시하기', resultType: 'noop' },
      ],
    },
    {
      id: 'sleeping-guardian-cat',
      title: '잠든 수호묘',
      body: '커다란 고양이가 곤히 자고 있어요. 깨우면 화를 낼 것 같지만, 지나간 뒤엔 뭔가 남길지도 몰라요.',
      choices: [
        { id: 'wake', label: '깨우기(정예 전투 + 유물 확정)', resultType: 'forceEliteWithRelic' },
        { id: 'pass', label: '조용히 지나가기', resultType: 'noop' },
      ],
    },
  ];

  // 이벤트 칸에서 뽑을 이벤트 ID 목록(눅눅한 빵은 카드이지 이벤트가 아니므로 제외).
  var EVENT_IDS = EVENTS.map(function (event) {
    return event.id;
  });

  // ---- 오늘의 도전 요일 프리셋 (v2 — docs/deck-improvement-plan.md 5절) ----
  // /daily variant(매치3 패턴 재사용)의 deckPreset 필드. 요일 매핑: 월목=balanced,
  // 화금=aggro, 수토=guard, 일=자유 선택(서버가 'free'를 내려주면 클라가 선택 UI를 보여준다).
  var DECK_PRESET_STARTER_OVERRIDES = {
    balanced: null, // 기본 시작 덱과 동일.
    aggro: [
      { id: 'rolling-pin-swing', count: 4 },
      { id: 'baguette-stab', count: 3 },
      { id: 'dough-shield', count: 2 },
      { id: 'secret-notebook', count: 1 },
    ],
    guard: [
      { id: 'dough-shield', count: 5 },
      { id: 'rolling-pin-swing', count: 3 },
      { id: 'sugar-coating', count: 1 },
      { id: 'secret-notebook', count: 1 },
    ],
  };

  var DECK_PRESET_BY_WEEKDAY = {
    0: 'free', // 일
    1: 'balanced', // 월
    2: 'aggro', // 화
    3: 'guard', // 수
    4: 'balanced', // 목
    5: 'aggro', // 금
    6: 'guard', // 토
  };

  // ---- 적 9종 ----
  // pattern은 고정 순환 배열. 각 행동은 아래 중 하나:
  //  { type: 'attack', amount, hits }  hits 생략 시 1
  //  { type: 'block', amount }
  //  { type: 'strength', amount }
  //  { type: 'weak', amount }        (플레이어에게 약화 부여)
  //  { type: 'vulnerable', amount }  (플레이어에게 취약 부여)
  var ENEMIES = [
    {
      id: 'crumb-ant',
      emoji: '🐜',
      asset: 'deck-enemy-crumb-ant.svg',
      name: '부스러기 개미',
      tier: 'normal',
      maxHp: 14,
      pattern: [
        { type: 'attack', amount: 5 },
        { type: 'attack', amount: 5 },
        { type: 'block', amount: 5 },
      ],
    },
    {
      id: 'sugar-scent-moth',
      emoji: '🦋',
      asset: 'deck-enemy-sugar-scent-moth.svg',
      name: '단내 나방',
      tier: 'normal',
      maxHp: 18,
      pattern: [
        { type: 'attack', amount: 4 },
        { type: 'weak', amount: 1 },
        { type: 'attack', amount: 7 },
      ],
    },
    {
      id: 'greedy-pigeon',
      emoji: '🕊️',
      asset: 'deck-enemy-greedy-pigeon.svg',
      name: '욕심쟁이 비둘기',
      tier: 'normal',
      maxHp: 22,
      pattern: [
        { type: 'attack', amount: 8 },
        { type: 'block', amount: 6 },
      ],
    },
    {
      id: 'sugar-slime',
      emoji: '🫠',
      asset: 'deck-enemy-sugar-slime.svg',
      name: '설탕 슬라임',
      tier: 'normal',
      maxHp: 26,
      pattern: [
        { type: 'block', amount: 8 },
        { type: 'attack', amount: 6 },
        { type: 'attack', amount: 6 },
      ],
    },
    {
      id: 'kitchen-mouse',
      emoji: '🐭',
      asset: 'deck-enemy-kitchen-mouse.svg',
      name: '주방 생쥐',
      tier: 'normal',
      maxHp: 20,
      pattern: [
        { type: 'attack', amount: 3, hits: 2 },
        { type: 'attack', amount: 3, hits: 2 },
        { type: 'strength', amount: 2 },
      ],
    },
    {
      id: 'mold-fairy',
      emoji: '🍄',
      asset: 'deck-enemy-mold-fairy.svg',
      name: '곰팡이 요정',
      tier: 'normal',
      maxHp: 24,
      pattern: [
        // 취약은 부여된 적 턴이 끝날 때 곧바로 1 감소하므로, 다음 공격을 증폭하려면 2턴 부여가 필요하다.
        { type: 'vulnerable', amount: 2 },
        { type: 'attack', amount: 9 },
      ],
    },
    {
      id: 'caramel-golem',
      emoji: '🗿',
      asset: 'deck-enemy-caramel-golem.svg',
      name: '캐러멜 골렘',
      tier: 'elite',
      maxHp: 45,
      pattern: [
        { type: 'block', amount: 10 },
        { type: 'attack', amount: 12 },
        { type: 'attack', amount: 8 },
      ],
    },
    {
      id: 'whipped-harpy',
      emoji: '🦅',
      asset: 'deck-enemy-whipped-harpy.svg',
      name: '휘핑 하피',
      tier: 'elite',
      maxHp: 40,
      pattern: [
        { type: 'attack', amount: 6, hits: 2 },
        { type: 'weak', amount: 2 },
        { type: 'attack', amount: 10 },
      ],
    },
    {
      id: 'great-glutton-dragon',
      emoji: '🐉',
      asset: 'deck-enemy-great-glutton-dragon.svg',
      name: '대왕 식탐 드래곤',
      tier: 'boss',
      maxHp: 80,
      pattern: [
        { type: 'strength', amount: 2 },
        { type: 'attack', amount: 10 },
        { type: 'block', amount: 12 },
        { type: 'attack', amount: 14 },
      ],
    },
  ];

  // 휴식 이벤트 선택지.
  var REST_OPTIONS = {
    heal: 'heal',
    removeCard: 'removeCard',
  };

  // 구버전(v1) 세이브 마이그레이션 안내 카피(계획서 6절).
  var MIGRATION_NOTICE = '게임이 새로워져서 진행 중이던 여정을 새로 시작해요. 통산 기록은 그대로예요.';

  var DeckContent = {
    SAVE_VERSION: SAVE_VERSION,
    SAVE_KEY: SAVE_KEY,
    PLAYER_MAX_HP: PLAYER_MAX_HP,
    PLAYER_ENERGY_PER_TURN: PLAYER_ENERGY_PER_TURN,
    PLAYER_DRAW_PER_TURN: PLAYER_DRAW_PER_TURN,
    WEAK_MULTIPLIER: WEAK_MULTIPLIER,
    VULNERABLE_MULTIPLIER: VULNERABLE_MULTIPLIER,
    REST_HEAL_PERCENT: REST_HEAL_PERCENT,
    MAP_FLOOR_COUNT: MAP_FLOOR_COUNT,
    MAP_MIN_NODES_PER_FLOOR: MAP_MIN_NODES_PER_FLOOR,
    MAP_MAX_NODES_PER_FLOOR: MAP_MAX_NODES_PER_FLOOR,
    NODE_TYPES: NODE_TYPES,
    SCORE_PER_FLOOR: SCORE_PER_FLOOR,
    MAX_SCORE: MAX_SCORE,
    STARTER_DECK: STARTER_DECK,
    CARDS: CARDS,
    REWARD_CARD_COUNT: REWARD_CARD_COUNT,
    RELICS: RELICS,
    EVENTS: EVENTS,
    EVENT_IDS: EVENT_IDS,
    DECK_PRESET_STARTER_OVERRIDES: DECK_PRESET_STARTER_OVERRIDES,
    DECK_PRESET_BY_WEEKDAY: DECK_PRESET_BY_WEEKDAY,
    ENEMIES: ENEMIES,
    REST_OPTIONS: REST_OPTIONS,
    MIGRATION_NOTICE: MIGRATION_NOTICE,
  };

  root.DeckContent = DeckContent;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeckContent;
  }
})(typeof window !== 'undefined' ? window : this);

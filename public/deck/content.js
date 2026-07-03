(function (root) {
  'use strict';

  // 정의 데이터 전용 모듈. DOM/localStorage/시간/난수에 접근하지 않는다.

  var SAVE_VERSION = 1;
  var SAVE_KEY = 'redefine-deck-save-v1';

  var PLAYER_MAX_HP = 60;
  var PLAYER_ENERGY_PER_TURN = 3;
  var PLAYER_DRAW_PER_TURN = 5;

  var WEAK_MULTIPLIER = 0.75;
  var VULNERABLE_MULTIPLIER = 1.5;

  var REST_HEAL_PERCENT = 0.3;

  // 런 구성. 'normal'/'elite'/'rest'/'boss' 4종. 일반/정예 칸은 실제 적 배정을
  // engine.js가 시드 셔플로 결정한다 (enemyPool 참고).
  var RUN_LAYOUT = [
    { type: 'normal' },
    { type: 'normal' },
    { type: 'normal' },
    { type: 'rest' },
    { type: 'elite' },
    { type: 'normal' },
    { type: 'normal' },
    { type: 'rest' },
    { type: 'normal' },
    { type: 'elite' },
    { type: 'boss' },
  ];

  // ---- 시작 덱 (10장) ----
  // 카드 정의: id, name, cost, rarity('starter'|'common'|'elite'), effect(프리미티브 조합).
  // effect 프리미티브: damage, hits(다단 히트 횟수, damage와 함께 사용), block, draw,
  // energy(획득량), strength, weak(부여 턴 수), vulnerable(부여 턴 수), heal, selfDamage.
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
  ];

  // 보상 시 화면에 제시할 카드 수.
  var REWARD_CARD_COUNT = 3;

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
      name: '곰팡이 요정',
      tier: 'normal',
      maxHp: 24,
      pattern: [
        { type: 'vulnerable', amount: 1 },
        { type: 'attack', amount: 9 },
      ],
    },
    {
      id: 'caramel-golem',
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

  var DeckContent = {
    SAVE_VERSION: SAVE_VERSION,
    SAVE_KEY: SAVE_KEY,
    PLAYER_MAX_HP: PLAYER_MAX_HP,
    PLAYER_ENERGY_PER_TURN: PLAYER_ENERGY_PER_TURN,
    PLAYER_DRAW_PER_TURN: PLAYER_DRAW_PER_TURN,
    WEAK_MULTIPLIER: WEAK_MULTIPLIER,
    VULNERABLE_MULTIPLIER: VULNERABLE_MULTIPLIER,
    REST_HEAL_PERCENT: REST_HEAL_PERCENT,
    RUN_LAYOUT: RUN_LAYOUT,
    STARTER_DECK: STARTER_DECK,
    CARDS: CARDS,
    REWARD_CARD_COUNT: REWARD_CARD_COUNT,
    ENEMIES: ENEMIES,
    REST_OPTIONS: REST_OPTIONS,
  };

  root.DeckContent = DeckContent;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeckContent;
  }
})(typeof window !== 'undefined' ? window : this);

const MINIGAME_REWARD_RELATED_TYPE = 'minigameReward';

const MINIGAMES = {
  card: {
    id: 'card',
    title: '🎴 행운 카드 뒤집기',
    description: '세 장의 카드 중 하나를 골라 0P, 3P, 5P, 10P 중 하나를 확인해요.',
  },
  rps: {
    id: 'rps',
    title: '✊ 가위바위보',
    description: '가위, 바위, 보 중 하나를 골라 봇과 겨뤄요. 비기면 다시 고를 수 있어요.',
  },
  dice: {
    id: 'dice',
    title: '🎲 주사위 대결',
    description: '내 주사위와 봇 주사위를 굴려요. 이기면 5P, 비기거나 지면 보상 없이 기록돼요.',
  },
  number: {
    id: 'number',
    title: '🔢 숫자 맞히기',
    description: '1부터 5까지 숫자 하나를 골라 봇 숫자와 같으면 5P를 받아요.',
  },
  door: {
    id: 'door',
    title: '🚪 문 하나 고르기',
    description: '세 개의 문 중 하나를 골라 작은 보상이나 재미 결과를 확인해요.',
  },
  memory: {
    id: 'memory',
    title: '🧠 이모지 기억력',
    description: '짧은 이모지 패턴을 보고 보기 중 같은 패턴을 골라요.',
  },
  initial: {
    id: 'initial',
    title: '🧩 초성 퀴즈',
    description: '쉬운 초성을 보고 알맞은 답을 선택해요.',
  },
  explore: {
    id: 'explore',
    title: '🧭 리디파인 탐험',
    description: '숲길, 도서관, 광장 중 한 곳을 골라 짧은 탐험 결과를 받아요.',
  },
  rogue: {
    id: 'rogue',
    title: '🗺️ 세 칸 탐험',
    description: '탐험지, 장비, 마지막 행동을 골라 짧은 로그라이크 한 판을 진행해요.',
  },
};

const RPS_CHOICES = {
  scissors: { label: '✌️ 가위', beats: 'paper' },
  rock: { label: '✊ 바위', beats: 'scissors' },
  paper: { label: '✋ 보', beats: 'rock' },
};

const MEMORY_PATTERNS = [
  ['🌱', '📘', '✨'],
  ['🎧', '🧭', '🌿'],
  ['💡', '🎴', '⭐'],
  ['🍀', '🎈', '🌙'],
  ['🍞', '🔔', '🧃'],
  ['🎨', '📎', '🌊'],
  ['🔑', '🧸', '🍎'],
  ['🎁', '🪴', '📻'],
  ['☕', '📮', '🌈'],
  ['🧵', '🍋', '🎹'],
  ['🌻', '📷', '🥪'],
  ['🧊', '🍇', '📌'],
];

const INITIAL_QUIZZES = [
  {
    prompt: 'ㄹㄷㅍㅇ',
    answer: '리디파인',
    choices: ['리디파인', '라이프온', '루틴파인'],
  },
  {
    prompt: 'ㅁㄴㄱㅇ',
    answer: '미니게임',
    choices: ['미니게임', '미션가이드', '마감공유'],
  },
  {
    prompt: 'ㅍㅇㅌ',
    answer: '포인트',
    choices: ['포인트', '프로필', '파트너'],
  },
  {
    prompt: 'ㅊㅋㅇ',
    answer: '체크인',
    choices: ['체크인', '초코칩', '치킨집'],
  },
  {
    prompt: 'ㅅㅈ',
    answer: '상점',
    choices: ['상점', '소풍', '사탕'],
  },
  {
    prompt: 'ㄱㅎ',
    answer: '교환',
    choices: ['교환', '관람', '거울'],
  },
  {
    prompt: 'ㅇㅇㅈ',
    answer: '운영진',
    choices: ['운영진', '안내문', '이어폰'],
  },
  {
    prompt: 'ㅇㄴ',
    answer: '안내',
    choices: ['안내', '여름', '우유'],
  },
  {
    prompt: 'ㅈㅅㅇ',
    answer: '주사위',
    choices: ['주사위', '지우개', '젓가락'],
  },
  {
    prompt: 'ㅋㄷ',
    answer: '카드',
    choices: ['카드', '코알라', '키위'],
  },
  {
    prompt: 'ㄷㅅㄱ',
    answer: '도서관',
    choices: ['도서관', '두더지', '딸기잼'],
  },
  {
    prompt: 'ㅇㅎ',
    answer: '여행',
    choices: ['여행', '야구', '온천'],
  },
];

// 장소별 보상은 고정이 아니라 사용자·날짜 시드로 매일 다르게 배정됩니다 (minigameResults.js).
const EXPLORE_PLACES = {
  forest: { label: '숲길' },
  library: { label: '도서관' },
  plaza: { label: '광장' },
};

const EXPLORE_REWARD_MESSAGES = {
  0: [
    '오늘은 쉬어 가는 자리였어요. 다음 걸음을 준비했어요.',
    '특별한 발견은 없었지만 마음이 한결 가벼워졌어요.',
    '바람만 스쳐 갔어요. 내일의 행운을 기약해요.',
  ],
  3: [
    '길가에서 반짝이는 작은 단서를 주웠어요.',
    '지나가던 이웃이 작은 응원을 건넸어요.',
    '구석에 놓인 작은 조각을 발견했어요.',
  ],
  5: [
    '숨겨진 기록을 찾아냈어요. 오늘의 행운 장소였어요.',
    '뜻밖의 보물 상자가 살짝 열려 있었어요.',
    '오늘의 반짝임이 이곳에 모여 있었어요.',
  ],
};

// 탐험지별 유리한 장비/행동 조합은 고정이 아니라 사용자·날짜 시드로 매일 다르게 정해집니다 (minigameResults.js).
const ROGUE_PATHS = {
  market: {
    label: '새벽 시장',
    intro: '아직 문을 덜 연 새벽 시장에 들어섰어요. 천막 사이로 작은 종소리가 들려요.',
  },
  station: {
    label: '비밀 정거장',
    intro: '표지판 없는 정거장에 불이 하나 켜져 있어요. 곧 이름 없는 열차가 올 것 같아요.',
  },
  rooftop: {
    label: '옥상 정원',
    intro: '낡은 계단 끝 옥상 정원에 도착했어요. 바람이 화분 사이의 쪽지를 넘겨요.',
  },
};

const ROGUE_ITEMS = {
  lantern: { label: '작은 랜턴', message: '주머니 속 작은 랜턴이 길 가장자리의 표시를 비춰 줬어요.' },
  map: { label: '접힌 지도', message: '접힌 지도에는 남들이 잘 보지 않는 샛길이 그려져 있었어요.' },
  snack: { label: '비상 간식', message: '비상 간식 하나가 긴장을 조금 풀어 줬어요.' },
};

const ROGUE_EXITS = {
  signal: { label: '신호 보내기', message: '멀리 있는 불빛에 짧은 신호를 보냈어요.' },
  talk: { label: '말 걸기', message: '근처에 있던 낯선 안내자에게 조심스럽게 말을 걸었어요.' },
  rest: { label: '잠깐 쉬기', message: '서두르지 않고 숨을 고른 뒤 다시 주변을 살폈어요.' },
};

module.exports = {
  EXPLORE_PLACES,
  EXPLORE_REWARD_MESSAGES,
  INITIAL_QUIZZES,
  MEMORY_PATTERNS,
  MINIGAMES,
  MINIGAME_REWARD_RELATED_TYPE,
  ROGUE_EXITS,
  ROGUE_ITEMS,
  ROGUE_PATHS,
  RPS_CHOICES,
};

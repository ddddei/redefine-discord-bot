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
];

const EXPLORE_PLACES = {
  forest: { label: '숲길', reward: 3, message: '조용한 숲길에서 반짝이는 단서를 찾았어요.' },
  library: { label: '도서관', reward: 5, message: '도서관 책갈피 사이에서 작은 기록을 발견했어요.' },
  plaza: { label: '광장', reward: 0, message: '광장에서 쉬어 가며 다음 여정을 준비했어요.' },
};

const ROGUE_PATHS = {
  market: {
    label: '새벽 시장',
    intro: '아직 문을 덜 연 새벽 시장에 들어섰어요. 천막 사이로 작은 종소리가 들려요.',
    favoredItem: 'map',
    favoredExit: 'talk',
  },
  station: {
    label: '비밀 정거장',
    intro: '표지판 없는 정거장에 불이 하나 켜져 있어요. 곧 이름 없는 열차가 올 것 같아요.',
    favoredItem: 'lantern',
    favoredExit: 'signal',
  },
  rooftop: {
    label: '옥상 정원',
    intro: '낡은 계단 끝 옥상 정원에 도착했어요. 바람이 화분 사이의 쪽지를 넘겨요.',
    favoredItem: 'snack',
    favoredExit: 'rest',
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
  INITIAL_QUIZZES,
  MEMORY_PATTERNS,
  MINIGAMES,
  MINIGAME_REWARD_RELATED_TYPE,
  ROGUE_EXITS,
  ROGUE_ITEMS,
  ROGUE_PATHS,
  RPS_CHOICES,
};

const MINIGAME_DAILY_REWARD_CAP = 10;
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

module.exports = {
  EXPLORE_PLACES,
  INITIAL_QUIZZES,
  MEMORY_PATTERNS,
  MINIGAMES,
  MINIGAME_DAILY_REWARD_CAP,
  MINIGAME_REWARD_RELATED_TYPE,
  RPS_CHOICES,
};

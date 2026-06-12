const crypto = require('crypto');

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
    description: '시작 버튼을 누른 뒤 가위, 바위, 보 중 하나를 골라 봇과 겨뤄요. 비기면 다시 고를 수 있어요.',
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
};

const RPS_CHOICES = {
  scissors: { label: '✌️ 가위', beats: 'paper' },
  rock: { label: '✊ 바위', beats: 'scissors' },
  paper: { label: '✋ 보', beats: 'rock' },
};

function deterministicNumber(parts, maxExclusive) {
  const digest = crypto.createHash('sha256').update(parts.join(':')).digest('hex');
  return Number.parseInt(digest.slice(0, 8), 16) % maxExclusive;
}

function createCardResult({ userId, dateString, cardIndex }) {
  const rewards = [0, 3, 5, 10];
  const selectedCard = Number.isInteger(cardIndex) && cardIndex >= 1 && cardIndex <= 3 ? cardIndex : 1;
  const rewardPoints = rewards[deterministicNumber([userId, dateString, 'card', selectedCard], rewards.length)];
  const messages = {
    0: '이번 카드는 쉬어 가기 카드였어요.',
    3: '작은 행운 카드가 나왔어요.',
    5: '반짝이는 카드가 뒤집혔어요.',
    10: '오늘의 카드 운이 꽤 좋았어요.',
  };

  return {
    gameId: MINIGAMES.card.id,
    title: MINIGAMES.card.title,
    rewardPoints,
    lines: [
      messages[rewardPoints],
      `선택한 카드: ${selectedCard}번`,
      `카드 결과: ${rewardPoints}P`,
    ],
  };
}

function createRpsResult({ userId, dateString, choice }) {
  const playerChoice = RPS_CHOICES[choice] ? choice : 'rock';
  const botChoices = Object.keys(RPS_CHOICES);
  const botChoice = botChoices[deterministicNumber([userId, dateString, 'rps', playerChoice], botChoices.length)];
  const isWin = RPS_CHOICES[playerChoice].beats === botChoice;
  const isDraw = playerChoice === botChoice;
  const rewardPoints = isWin ? 5 : 0;
  const outcome = isWin ? '승리' : (isDraw ? '무승부' : '패배');

  return {
    gameId: MINIGAMES.rps.id,
    title: MINIGAMES.rps.title,
    rewardPoints,
    isDraw,
    shouldAward: !isDraw,
    lines: [
      `내 선택: ${RPS_CHOICES[playerChoice].label}`,
      `봇 선택: ${RPS_CHOICES[botChoice].label}`,
      `결과: ${outcome}`,
      isDraw ? '비겼어요. 보상이나 실패 처리 없이 한 번 더 선택해 주세요.' : (
        isWin ? '승리 보상 5P를 확인해요.' : '이번 판은 보상 없이 결과만 기록돼요.'
      ),
    ],
  };
}

function createDiceResult({ userId, dateString }) {
  const playerRoll = deterministicNumber([userId, dateString, 'dice', 'player'], 6) + 1;
  const botRoll = deterministicNumber([userId, dateString, 'dice', 'bot'], 6) + 1;
  const isWin = playerRoll > botRoll;
  const isDraw = playerRoll === botRoll;
  const rewardPoints = isWin ? 5 : 0;
  const outcome = isWin ? '승리' : (isDraw ? '무승부' : '패배');

  return {
    gameId: MINIGAMES.dice.id,
    title: MINIGAMES.dice.title,
    rewardPoints,
    lines: [
      `🎲 내 주사위: ${playerRoll}`,
      `🎲 봇 주사위: ${botRoll}`,
      `결과: ${outcome}`,
      rewardPoints > 0 ? `지급 포인트: ${rewardPoints}P` : '지급 포인트: 0P',
      isDraw ? '비겼지만 이번 주사위 대결은 보상 없음으로 기록돼요.' : '포인트 베팅이나 차감은 없어요.',
    ],
  };
}

function createNumberResult({ userId, dateString, numberChoice }) {
  const playerNumber = Number.isInteger(numberChoice) && numberChoice >= 1 && numberChoice <= 5 ? numberChoice : 1;
  const botNumber = deterministicNumber([userId, dateString, 'number'], 5) + 1;
  const isWin = playerNumber === botNumber;
  const rewardPoints = isWin ? 5 : 0;

  return {
    gameId: MINIGAMES.number.id,
    title: MINIGAMES.number.title,
    rewardPoints,
    lines: [
      `내 숫자: ${playerNumber}`,
      `봇 숫자: ${botNumber}`,
      `결과: ${isWin ? '성공' : '실패'}`,
      rewardPoints > 0 ? '숫자를 맞혀 5P를 확인해요.' : '이번 판은 보상 없이 결과만 기록돼요.',
    ],
  };
}

function createMinigameResult(input) {
  if (input.gameId === MINIGAMES.card.id) {
    return createCardResult(input);
  }

  if (input.gameId === MINIGAMES.rps.id) {
    return createRpsResult(input);
  }

  if (input.gameId === MINIGAMES.dice.id) {
    return createDiceResult(input);
  }

  if (input.gameId === MINIGAMES.number.id) {
    return createNumberResult(input);
  }

  return null;
}

module.exports = {
  MINIGAMES,
  MINIGAME_DAILY_REWARD_CAP,
  MINIGAME_REWARD_RELATED_TYPE,
  RPS_CHOICES,
  createMinigameResult,
};

const crypto = require('crypto');

const MINIGAME_DAILY_REWARD_CAP = 10;
const MINIGAME_REWARD_RELATED_TYPE = 'minigameReward';

const MINIGAMES = {
  treasure: {
    id: 'treasure',
    title: '오늘의 보물상자',
    description: '하루 한 번 상자를 열고 0P, 3P, 5P, 10P 중 하나를 확인해요.',
  },
  rps: {
    id: 'rps',
    title: '가위바위보',
    description: '가위, 바위, 보 중 하나를 골라 봇과 겨뤄요. 이기면 5P까지 받을 수 있어요.',
  },
  dice: {
    id: 'dice',
    title: '주사위 대결',
    description: '내 주사위와 봇 주사위를 굴려요. 이기면 5P, 비기면 3P까지 받을 수 있어요.',
  },
};

const RPS_CHOICES = {
  rock: { label: '바위', beats: 'scissors' },
  scissors: { label: '가위', beats: 'paper' },
  paper: { label: '보', beats: 'rock' },
};

function deterministicNumber(parts, maxExclusive) {
  const digest = crypto.createHash('sha256').update(parts.join(':')).digest('hex');
  return Number.parseInt(digest.slice(0, 8), 16) % maxExclusive;
}

function createTreasureResult({ userId, dateString }) {
  const rewards = [0, 3, 5, 10];
  const rewardPoints = rewards[deterministicNumber([userId, dateString, 'treasure'], rewards.length)];
  const messages = {
    0: '상자 안에는 작은 응원 메모가 들어 있었어요.',
    3: '작은 반짝임을 발견했어요.',
    5: '상자에서 반가운 보상이 나왔어요.',
    10: '오늘은 운이 좋은 날이에요.',
  };

  return {
    gameId: MINIGAMES.treasure.id,
    title: MINIGAMES.treasure.title,
    rewardPoints,
    lines: [
      messages[rewardPoints],
      `상자 결과: ${rewardPoints}P`,
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
    lines: [
      `내 선택: ${RPS_CHOICES[playerChoice].label}`,
      `봇 선택: ${RPS_CHOICES[botChoice].label}`,
      `결과: ${outcome}`,
      isWin ? '승리 보상 5P를 확인해요.' : '이번 판은 보상 없이 결과만 기록돼요.',
    ],
  };
}

function createDiceResult({ userId, dateString }) {
  const playerRoll = deterministicNumber([userId, dateString, 'dice', 'player'], 6) + 1;
  const botRoll = deterministicNumber([userId, dateString, 'dice', 'bot'], 6) + 1;
  const isWin = playerRoll > botRoll;
  const isDraw = playerRoll === botRoll;
  const rewardPoints = isWin ? 5 : (isDraw ? 3 : 0);
  const outcome = isWin ? '승리' : (isDraw ? '무승부' : '패배');

  return {
    gameId: MINIGAMES.dice.id,
    title: MINIGAMES.dice.title,
    rewardPoints,
    lines: [
      `내 주사위: ${playerRoll}`,
      `봇 주사위: ${botRoll}`,
      `결과: ${outcome}`,
      rewardPoints > 0 ? `보상 ${rewardPoints}P를 확인해요.` : '이번 판은 보상 없이 결과만 기록돼요.',
    ],
  };
}

function createMinigameResult(input) {
  if (input.gameId === MINIGAMES.treasure.id) {
    return createTreasureResult(input);
  }

  if (input.gameId === MINIGAMES.rps.id) {
    return createRpsResult(input);
  }

  if (input.gameId === MINIGAMES.dice.id) {
    return createDiceResult(input);
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

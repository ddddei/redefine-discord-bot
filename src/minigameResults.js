const crypto = require('crypto');
const {
  EXPLORE_PLACES,
  INITIAL_QUIZZES,
  MEMORY_PATTERNS,
  MINIGAMES,
  RPS_CHOICES,
} = require('./minigameData');

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

function createDoorResult({ userId, dateString, doorIndex }) {
  const selectedDoor = Number.isInteger(doorIndex) && doorIndex >= 1 && doorIndex <= 3 ? doorIndex : 1;
  const rewards = [0, 3, 5];
  const rewardPoints = rewards[deterministicNumber([userId, dateString, 'door', selectedDoor], rewards.length)];
  const messages = {
    0: '문 뒤에는 쉬어 가는 표지판이 있었어요.',
    3: '문틈 사이로 작은 행운이 들어왔어요.',
    5: '문 너머에서 반짝이는 보상을 발견했어요.',
  };

  return {
    gameId: MINIGAMES.door.id,
    title: MINIGAMES.door.title,
    rewardPoints,
    lines: [
      messages[rewardPoints],
      `선택한 문: ${selectedDoor}번`,
      `문 결과: ${rewardPoints}P`,
    ],
  };
}

function createMemoryDetail({ userId, dateString }) {
  const patternIndex = deterministicNumber([userId, dateString, 'memory', 'pattern'], MEMORY_PATTERNS.length);
  const correctButtonIndex = deterministicNumber([userId, dateString, 'memory', 'answer'], 3) + 1;
  const pattern = MEMORY_PATTERNS[patternIndex];
  const decoys = MEMORY_PATTERNS.filter((candidate, index) => index !== patternIndex);
  let decoyIndex = 0;
  const choices = [1, 2, 3].map((buttonIndex) => {
    if (buttonIndex === correctButtonIndex) {
      return pattern;
    }

    const decoy = decoys[decoyIndex % decoys.length];
    decoyIndex += 1;
    return decoy;
  });

  return {
    pattern,
    correctButtonIndex,
    choices,
  };
}

function createMemoryResult({ userId, dateString, choiceIndex }) {
  const detail = createMemoryDetail({ userId, dateString });
  const selectedIndex = Number.isInteger(choiceIndex) && choiceIndex >= 1 && choiceIndex <= 3 ? choiceIndex : 1;
  const isWin = selectedIndex === detail.correctButtonIndex;
  const selectedPattern = detail.choices[selectedIndex - 1];

  return {
    gameId: MINIGAMES.memory.id,
    title: MINIGAMES.memory.title,
    rewardPoints: isWin ? 5 : 0,
    lines: [
      `기억할 패턴: ${detail.pattern.join(' ')}`,
      `선택한 패턴: ${selectedPattern.join(' ')}`,
      `결과: ${isWin ? '성공' : '실패'}`,
      isWin ? '패턴을 맞혀 5P를 확인해요.' : '이번 판은 보상 없이 결과만 기록돼요.',
    ],
  };
}

function createInitialDetail({ userId, dateString }) {
  const quizIndex = deterministicNumber([userId, dateString, 'initial'], INITIAL_QUIZZES.length);
  return INITIAL_QUIZZES[quizIndex];
}

function createInitialResult({ userId, dateString, choiceIndex }) {
  const quiz = createInitialDetail({ userId, dateString });
  const selectedIndex = Number.isInteger(choiceIndex) && choiceIndex >= 1 && choiceIndex <= quiz.choices.length ? choiceIndex : 1;
  const selectedAnswer = quiz.choices[selectedIndex - 1];
  const isWin = selectedAnswer === quiz.answer;

  return {
    gameId: MINIGAMES.initial.id,
    title: MINIGAMES.initial.title,
    rewardPoints: isWin ? 5 : 0,
    lines: [
      `초성: ${quiz.prompt}`,
      `선택한 답: ${selectedAnswer}`,
      `결과: ${isWin ? '정답' : '오답'}`,
      isWin ? '초성을 맞혀 5P를 확인해요.' : '가볍게 다시 도전해 주세요. 오늘 기록은 보상 없이 남아요.',
    ],
  };
}

function createExploreResult({ placeKey }) {
  const place = EXPLORE_PLACES[placeKey] || EXPLORE_PLACES.forest;

  return {
    gameId: MINIGAMES.explore.id,
    title: MINIGAMES.explore.title,
    rewardPoints: place.reward,
    lines: [
      place.message,
      `선택한 장소: ${place.label}`,
      `탐험 결과: ${place.reward}P`,
    ],
  };
}

module.exports = {
  createCardResult,
  createDiceResult,
  createDoorResult,
  createExploreResult,
  createInitialDetail,
  createInitialResult,
  createMemoryDetail,
  createMemoryResult,
  createNumberResult,
  createRpsResult,
  deterministicNumber,
};

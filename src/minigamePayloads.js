const {
  createGuideEmbed,
  formatPoints,
} = require('./embeds');
const {
  MINIGAMES,
  MINIGAME_DAILY_REWARD_CAP,
  createInitialDetail,
  createMemoryDetail,
} = require('./minigames');
const { getKoreanDateString } = require('./pointsRepository');
const {
  createCardChoiceRows,
  createDiceChoiceRows,
  createDoorChoiceRows,
  createExploreChoiceRows,
  createInitialChoiceRows,
  createMemoryChoiceRows,
  createMinigameHubRows,
  createNumberChoiceRows,
  createRpsChoiceRows,
} = require('./minigameRows');

function createMinigameHubPayload(options = {}) {
  const ephemeral = options.ephemeral !== false;

  return {
    embeds: [createGuideEmbed(
      '미니게임 놀이터',
      [
        'Discord 안에서 바로 눌러 즐기는 버튼형 미니게임이에요.',
        '먼저 게임을 고른 뒤, 다음 화면에서 선택지를 눌러 주세요.',
        '',
        '게임별 보상은 하루 한 번만 확인돼요.',
        `하루 미니게임 보상 합계는 최대 ${formatPoints(MINIGAME_DAILY_REWARD_CAP)}까지예요.`,
        '',
        ...Object.values(MINIGAMES).map((game) => `- ${game.title}: ${game.description}`),
        '',
        '포인트 베팅이나 차감은 없고, 결과와 지급 여부는 본인에게만 보여요.',
      ].join('\n')
    )],
    components: createMinigameHubRows(),
    ephemeral,
  };
}

function createMinigameChannelGuidePayload() {
  const channelId = process.env.MINIGAME_CHANNEL_ID;
  const channelText = channelId ? `<#${channelId}>` : '운영진이 안내한 미니게임 채널';

  return {
    embeds: [createGuideEmbed(
      '미니게임 채널 안내',
      [
        '미니게임은 지정된 미니게임 채널에서 이용해 주세요.',
        '',
        `이용 채널: ${channelText}`,
        '',
        '해당 채널에 고정된 미니게임 안내 또는 운영진 안내를 기준으로 참여해 주세요.',
      ].join('\n')
    )],
    ephemeral: true,
  };
}

function createRpsChoicePayload(descriptionLines = []) {
  return {
    embeds: [createGuideEmbed(
      MINIGAMES.rps.title,
      [
        ...descriptionLines,
        ...(descriptionLines.length > 0 ? [''] : []),
        '가위, 바위, 보 중 하나를 선택해 주세요.',
        '비기면 보상이나 실패 처리 없이 다시 선택할 수 있어요.',
      ].join('\n')
    )],
    components: createRpsChoiceRows(),
    ephemeral: true,
  };
}

function createMemoryDetailPayload(interaction) {
  const detail = createMemoryDetail({
    userId: interaction.user.id,
    dateString: getKoreanDateString(),
  });

  return {
    embeds: [createGuideEmbed(
      MINIGAMES.memory.title,
      [
        `기억할 패턴: ${detail.pattern.join(' ')}`,
        '',
        '아래 보기 중 같은 패턴을 골라 주세요.',
      ].join('\n')
    )],
    components: createMemoryChoiceRows(detail),
    ephemeral: true,
  };
}

function createInitialDetailPayload(interaction) {
  const quiz = createInitialDetail({
    userId: interaction.user.id,
    dateString: getKoreanDateString(),
  });

  return {
    embeds: [createGuideEmbed(
      MINIGAMES.initial.title,
      [
        `초성: ${quiz.prompt}`,
        '',
        '알맞은 답을 골라 주세요.',
      ].join('\n')
    )],
    components: createInitialChoiceRows(quiz),
    ephemeral: true,
  };
}

function createMinigameDetailPayload(minigameInput, interaction) {
  const staticPayloads = {
    card: {
      description: '세 장 중 마음이 가는 카드를 한 장 골라 주세요.\n결과는 0P, 3P, 5P, 10P 중 하나예요.',
      rows: createCardChoiceRows,
    },
    dice: {
      description: '버튼을 누르면 내 주사위와 봇 주사위를 함께 굴려요.\n비기면 이번 판은 보상 없음으로 기록돼요.',
      rows: createDiceChoiceRows,
    },
    number: {
      description: '1부터 5까지 숫자 하나를 골라 주세요.\n봇 숫자와 같으면 5P를 확인해요.',
      rows: createNumberChoiceRows,
    },
    door: {
      description: '세 개의 문 중 하나를 열어 보세요.\n결과는 0P, 3P, 5P 중 하나예요.',
      rows: createDoorChoiceRows,
    },
    explore: {
      description: '오늘 가볍게 둘러볼 장소를 하나 골라 주세요.\n결과는 작은 보상이나 재미 기록 중심으로 남아요.',
      rows: createExploreChoiceRows,
    },
  };
  const staticPayload = staticPayloads[minigameInput.gameId];

  if (staticPayload) {
    return {
      embeds: [createGuideEmbed(MINIGAMES[minigameInput.gameId].title, staticPayload.description)],
      components: staticPayload.rows(),
      ephemeral: true,
    };
  }

  if (minigameInput.gameId === MINIGAMES.rps.id) {
    return createRpsChoicePayload();
  }

  if (minigameInput.gameId === MINIGAMES.memory.id) {
    return createMemoryDetailPayload(interaction);
  }

  if (minigameInput.gameId === MINIGAMES.initial.id) {
    return createInitialDetailPayload(interaction);
  }

  return null;
}

module.exports = {
  createMinigameChannelGuidePayload,
  createMinigameDetailPayload,
  createMinigameHubPayload,
  createRpsChoicePayload,
};

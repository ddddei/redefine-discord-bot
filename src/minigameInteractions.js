const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  createGuideEmbed,
  formatPoints,
} = require('./embeds');
const {
  MINIGAMES,
  MINIGAME_DAILY_REWARD_CAP,
  RPS_CHOICES,
  createMinigameResult,
} = require('./minigames');
const { getKoreanDateString } = require('./pointsRepository');

function createMinigameHubRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('participant_minigame_treasure')
        .setLabel('오늘의 보물상자')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_rps:rock')
        .setLabel('바위')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_rps:scissors')
        .setLabel('가위')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_rps:paper')
        .setLabel('보')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_dice')
        .setLabel('주사위 대결')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createMinigameHubPayload() {
  return {
    embeds: [createGuideEmbed(
      '미니게임 놀이터',
      [
        'Discord 안에서 바로 눌러 즐기는 버튼형 미니게임이에요.',
        '',
        '게임별 보상은 하루 한 번만 확인돼요.',
        `하루 미니게임 보상 합계는 최대 ${formatPoints(MINIGAME_DAILY_REWARD_CAP)}까지예요.`,
        '',
        `- ${MINIGAMES.treasure.title}: ${MINIGAMES.treasure.description}`,
        `- ${MINIGAMES.rps.title}: ${MINIGAMES.rps.description}`,
        `- ${MINIGAMES.dice.title}: ${MINIGAMES.dice.description}`,
        '',
        '포인트 베팅이나 차감은 없고, 결과와 지급 여부는 본인에게만 보여요.',
      ].join('\n')
    )],
    components: createMinigameHubRows(),
    ephemeral: true,
  };
}

function getMinigameInputFromCustomId(customId) {
  if (customId === 'participant_minigame_treasure') {
    return { gameId: MINIGAMES.treasure.id };
  }

  if (customId === 'participant_minigame_dice') {
    return { gameId: MINIGAMES.dice.id };
  }

  if (customId.startsWith('participant_minigame_rps:')) {
    const choice = customId.split(':')[1];
    return {
      gameId: MINIGAMES.rps.id,
      choice: RPS_CHOICES[choice] ? choice : 'rock',
    };
  }

  return null;
}

function createMinigameResultDescription(result, awardResult) {
  if (!awardResult.ok && awardResult.reason === 'ALREADY_REWARDED') {
    return [
      ...result.lines,
      '',
      '이미 오늘 보상을 확인했어요.',
      '같은 게임 보상은 같은 날짜에 중복 지급되지 않아요.',
      `오늘 기록된 보상: ${formatPoints(awardResult.transaction.amount)}`,
    ].join('\n');
  }

  const awardedPoints = awardResult.awardedPoints || 0;
  const requestedReward = awardResult.requestedReward || 0;
  const capLines = requestedReward > awardedPoints
    ? [
      '',
      `하루 미니게임 보상 최대치 ${formatPoints(awardResult.dailyRewardCap)}에 맞춰 지급됐어요.`,
    ]
    : [];

  return [
    ...result.lines,
    '',
    `지급 포인트: ${formatPoints(awardedPoints)}`,
    `현재 보유 포인트: ${formatPoints(awardResult.transaction.balanceAfter)}`,
    `오늘 미니게임 보상 한도: ${formatPoints(awardResult.dailyRewardCap)}`,
    ...capLines,
    '',
    '포인트 차감이나 베팅은 없어요.',
  ].join('\n');
}

function createMinigameButtonHandler({ pointsRepository, getMemberDisplayName }) {
  return async function handleMinigameButton(interaction) {
    try {
      const minigameInput = getMinigameInputFromCustomId(interaction.customId);
      if (!minigameInput) {
        await interaction.reply({
          content: '미니게임 버튼을 확인하지 못했어요. `/안내`에서 다시 열어 주세요.',
          ephemeral: true,
        });
        return;
      }

      const playDate = getKoreanDateString();
      const result = createMinigameResult({
        ...minigameInput,
        userId: interaction.user.id,
        dateString: playDate,
      });

      if (!result) {
        await interaction.reply({
          content: '미니게임 결과를 만들지 못했어요. 운영진에게 알려주세요.',
          ephemeral: true,
        });
        return;
      }

      const awardResult = pointsRepository.awardMinigameReward({
        user: {
          userId: interaction.user.id,
          displayName: getMemberDisplayName(interaction.user, interaction.member),
        },
        gameId: result.gameId,
        gameTitle: result.title,
        playDate,
        rewardPoints: result.rewardPoints,
        reason: `미니게임 보상: ${result.title}`,
        note: result.lines.join(' / '),
      });

      await interaction.reply({
        embeds: [createGuideEmbed(
          result.title,
          createMinigameResultDescription(result, awardResult)
        )],
        ephemeral: true,
      });
    } catch (error) {
      console.error('미니게임 처리 실패:', error.message);
      await interaction.reply({
        content: '미니게임 결과를 처리하지 못했어요. 운영진에게 알려주세요.',
        ephemeral: true,
      });
    }
  };
}

module.exports = {
  createMinigameButtonHandler,
  createMinigameHubPayload,
};

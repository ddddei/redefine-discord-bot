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
        .setCustomId('participant_minigame_card:1')
        .setLabel('🎴 1번 카드')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_card:2')
        .setLabel('🎴 2번 카드')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_card:3')
        .setLabel('🎴 3번 카드')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_rps_start')
        .setLabel('✊ 가위바위보 시작')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_dice')
        .setLabel('🎲 주사위 굴리기')
        .setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('participant_minigame_number:1')
        .setLabel('🔢 1')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_number:2')
        .setLabel('🔢 2')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_number:3')
        .setLabel('🔢 3')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_number:4')
        .setLabel('🔢 4')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_number:5')
        .setLabel('🔢 5')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createRpsChoiceRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('participant_minigame_rps:scissors')
        .setLabel(RPS_CHOICES.scissors.label)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_rps:rock')
        .setLabel(RPS_CHOICES.rock.label)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('participant_minigame_rps:paper')
        .setLabel(RPS_CHOICES.paper.label)
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createMinigameHubPayload(options = {}) {
  const ephemeral = options.ephemeral !== false;

  return {
    embeds: [createGuideEmbed(
      '미니게임 놀이터',
      [
        'Discord 안에서 바로 눌러 즐기는 버튼형 미니게임이에요.',
        '',
        '게임별 보상은 하루 한 번만 확인돼요.',
        `하루 미니게임 보상 합계는 최대 ${formatPoints(MINIGAME_DAILY_REWARD_CAP)}까지예요.`,
        '',
        `- ${MINIGAMES.card.title}: ${MINIGAMES.card.description}`,
        `- ${MINIGAMES.rps.title}: ${MINIGAMES.rps.description}`,
        `- ${MINIGAMES.dice.title}: ${MINIGAMES.dice.description}`,
        `- ${MINIGAMES.number.title}: ${MINIGAMES.number.description}`,
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

function isMinigameChannelAllowed(interaction) {
  const minigameChannelId = process.env.MINIGAME_CHANNEL_ID;
  return !minigameChannelId || interaction.channelId === minigameChannelId;
}

function getMinigameInputFromCustomId(customId) {
  if (customId.startsWith('participant_minigame_card:')) {
    return {
      gameId: MINIGAMES.card.id,
      cardIndex: Number.parseInt(customId.split(':')[1], 10),
    };
  }

  if (customId === 'participant_minigame_dice') {
    return { gameId: MINIGAMES.dice.id };
  }

  if (customId.startsWith('participant_minigame_number:')) {
    return {
      gameId: MINIGAMES.number.id,
      numberChoice: Number.parseInt(customId.split(':')[1], 10),
    };
  }

  if (customId === 'participant_minigame_rps_start') {
    return { gameId: MINIGAMES.rps.id, action: 'start' };
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
      if (!isMinigameChannelAllowed(interaction)) {
        await interaction.reply({
          content: '미니게임은 지정된 미니게임 채널에서 이용해 주세요.',
          ephemeral: true,
        });
        return;
      }

      if (!minigameInput) {
        await interaction.reply({
          content: '미니게임 버튼을 확인하지 못했어요. `/안내`에서 다시 열어 주세요.',
          ephemeral: true,
        });
        return;
      }

      if (minigameInput.action === 'start') {
        await interaction.reply(createRpsChoicePayload());
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

      if (result.shouldAward === false) {
        await interaction.reply(createRpsChoicePayload(result.lines));
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
  createMinigameChannelGuidePayload,
  createMinigameHubPayload,
};

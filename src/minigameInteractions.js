const {
  createGuideEmbed,
  formatPoints,
} = require('./embeds');
const {
  MINIGAMES,
  RPS_CHOICES,
  createMinigameResult,
} = require('./minigames');
const {
  createMinigameChannelGuidePayload,
  createMinigameDetailPayload,
  createMinigameHubPayload,
  createMinigameRankingPayload,
  createRpsChoicePayload,
  createTodayMinigameRecordPayload,
} = require('./minigamePayloads');
const { getKoreanDateString } = require('./pointsRepository');

function isMinigameChannelAllowed(interaction) {
  const minigameChannelId = process.env.MINIGAME_CHANNEL_ID;
  return !minigameChannelId || interaction.channelId === minigameChannelId;
}

function getMinigameInputFromCustomId(customId) {
  if (customId.startsWith('participant_minigame_select:')) {
    return {
      gameId: customId.split(':')[1],
      action: 'select',
    };
  }

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

  if (customId.startsWith('participant_minigame_door:')) {
    return {
      gameId: MINIGAMES.door.id,
      doorIndex: Number.parseInt(customId.split(':')[1], 10),
    };
  }

  if (customId.startsWith('participant_minigame_memory:')) {
    return {
      gameId: MINIGAMES.memory.id,
      choiceIndex: Number.parseInt(customId.split(':')[1], 10),
    };
  }

  if (customId.startsWith('participant_minigame_initial:')) {
    return {
      gameId: MINIGAMES.initial.id,
      choiceIndex: Number.parseInt(customId.split(':')[1], 10),
    };
  }

  if (customId.startsWith('participant_minigame_explore:')) {
    return {
      gameId: MINIGAMES.explore.id,
      placeKey: customId.split(':')[1],
    };
  }

  if (customId.startsWith('participant_minigame_rogue_path:')) {
    return {
      gameId: MINIGAMES.rogue.id,
      action: 'choosePath',
      pathKey: customId.split(':')[1],
    };
  }

  if (customId.startsWith('participant_minigame_rogue_item:')) {
    const parts = customId.split(':');
    return {
      gameId: MINIGAMES.rogue.id,
      action: 'chooseItem',
      pathKey: parts[1],
      itemKey: parts[2],
    };
  }

  if (customId.startsWith('participant_minigame_rogue_exit:')) {
    const parts = customId.split(':');
    return {
      gameId: MINIGAMES.rogue.id,
      pathKey: parts[1],
      itemKey: parts[2],
      exitKey: parts[3],
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

function createMinigameResultDescription(result, awardResult) {
  if (!awardResult.ok && awardResult.reason === 'ALREADY_REWARDED') {
    return [
      ...result.lines,
      '',
      '이미 오늘 보상을 확인했어요.',
      '같은 게임 보상은 같은 날짜에 중복 지급되지 않아요.',
      `오늘 기록된 보상: ${formatPoints(awardResult.transaction.amount)}`,
      `오늘 남은 미니게임 보상 한도: ${formatPoints(awardResult.remainingDailyRewardAfterAward || 0)}`,
    ].join('\n');
  }

  if (!awardResult.ok && awardResult.reason === 'DAILY_PLAY_LIMIT_REACHED') {
    return [
      ...result.lines,
      '',
      '오늘 참여 가능한 미니게임 횟수를 모두 사용했어요.',
      `오늘 미니게임 참여: ${awardResult.dailyPlayCount}/${awardResult.dailyPlayLimit}회`,
      `오늘 남은 미니게임 보상 한도: ${formatPoints(awardResult.remainingDailyRewardAfterAward || 0)}`,
      '',
      '내일 다시 참여해 주세요.',
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
    `오늘 남은 미니게임 보상 한도: ${formatPoints(awardResult.remainingDailyRewardAfterAward || 0)}`,
    `오늘 미니게임 참여: ${awardResult.dailyPlayCountAfterAward}/${awardResult.dailyPlayLimit}회`,
    ...capLines,
    '',
    '포인트 차감이나 베팅은 없어요.',
  ].join('\n');
}

async function replyUnknownMinigame(interaction) {
  await interaction.reply({
    content: '미니게임 버튼을 확인하지 못했어요. `/안내`에서 다시 열어 주세요.',
    ephemeral: true,
  });
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

      if (interaction.customId === 'participant_minigame_today_record') {
        await interaction.reply(createTodayMinigameRecordPayload(
          pointsRepository.getTodayMinigameRecord(interaction.user.id)
        ));
        return;
      }

      if (interaction.customId === 'participant_minigame_today_ranking') {
        await interaction.reply(createMinigameRankingPayload(
          pointsRepository.listMinigameRankings()
        ));
        return;
      }

      if (!minigameInput) {
        await replyUnknownMinigame(interaction);
        return;
      }

      if (minigameInput.action === 'select'
        || minigameInput.action === 'start'
        || minigameInput.action === 'choosePath'
        || minigameInput.action === 'chooseItem') {
        const detailPayload = minigameInput.action === 'start'
          ? createRpsChoicePayload()
          : createMinigameDetailPayload(minigameInput, interaction);

        if (!detailPayload) {
          await replyUnknownMinigame(interaction);
          return;
        }

        await interaction.reply(detailPayload);
        return;
      }

      const playDate = getKoreanDateString();
      const result = createMinigameResult({
        ...minigameInput,
        userId: interaction.user.id,
        dateString: playDate,
      });

      if (!result) {
        await replyUnknownMinigame(interaction);
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

const { EmbedBuilder } = require('discord.js');
const {
  createWebgameRepository,
  getDailySeed,
  getDayKey,
  getIsoWeekKey,
} = require('./webgameRepository');
const {
  GAME_DEFINITIONS,
  getCommunalGoal,
  listRankableGames,
} = require('./webgameApi');

const CODE_VALID_MINUTES = 10;

function getMemberDisplayName(user, member) {
  if (member && typeof member.displayName === 'string' && member.displayName.trim()) {
    return member.displayName.trim();
  }

  return user.username;
}

function buildLinkCodeEmbed(code) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('웹게임 계정 연결 코드')
    .setDescription(
      [
        `코드: **${code}**`,
        '웹게임의 기록 탭 → 계정 연결에 코드를 입력해 주세요. 10분 안에요.',
      ].join('\n')
    )
    .setFooter({ text: `유효 시간: ${CODE_VALID_MINUTES}분` });
}

function buildRankingEmbed(gameTitle, weekKey, ranking) {
  const lines = ranking.length > 0
    ? ranking.map((entry) => {
      const cheerText = entry.cheers > 0 ? ` 👏 ${entry.cheers}` : '';
      return `${entry.rank}. ${entry.displayName} — ${entry.score.toLocaleString('ko-KR')}점${cheerText}`;
    })
    : ['이번 주 기록이 아직 없어요.'];

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`${gameTitle} 이번 주 랭킹`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `주차: ${weekKey}` });
}

function buildDailyRankingEmbed(gameTitle, dayKey, participants, ranking) {
  const lines = [
    `오늘 ${participants.toLocaleString('ko-KR')}명이 함께 도전했어요.`,
    '',
    ...(ranking.length > 0
      ? ranking.map((entry) => {
        const cheerText = entry.cheers > 0 ? ` 👏 ${entry.cheers}` : '';
        return `${entry.rank}. ${entry.displayName} — ${entry.score.toLocaleString('ko-KR')}점${cheerText}`;
      })
      : ['오늘의 도전 기록이 아직 없어요.']),
  ];

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`${gameTitle} 오늘의 도전`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `날짜: ${dayKey} · 시드: ${getDailySeed(dayKey)}` });
}

function buildGoalProgressBar(total, goal) {
  const percent = goal > 0 ? Math.min(100, Math.floor((total / goal) * 100)) : 0;
  const filled = Math.min(10, Math.floor(percent / 10));
  return `${'▓'.repeat(filled)}${'░'.repeat(10 - filled)} ${percent}%`;
}

function buildCommunalGoalEmbed(weekKey, progress, goal) {
  const achieved = progress.total >= goal;
  const lines = [
    `목표량: ${goal.toLocaleString('ko-KR')}개`,
    `현재 총합: ${progress.total.toLocaleString('ko-KR')}개`,
    buildGoalProgressBar(progress.total, goal),
    `참여 인원: ${progress.participants.toLocaleString('ko-KR')}명`,
    achieved ? '이번 주 목표를 함께 달성했어요! 🎉' : '각자의 속도로 만든 간식이 함께 모이고 있어요.',
  ];

  return new EmbedBuilder()
    .setColor(achieved ? 0x57f287 : 0xfee75c)
    .setTitle('이번 주 다 같이 간식 만들기')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `주차: ${weekKey}` });
}

function mergeCheers(repository, gameId, periodKey, ranking) {
  const cheerCounts = repository.countCheers(gameId, periodKey);
  return ranking.map((entry) => ({
    ...entry,
    cheers: cheerCounts.get(entry.discordId) || 0,
  }));
}

// /게임연결 실행 로직. DM 발송을 우선 시도하고, 실패하면 에페메랄 응답으로 대체한다.
// 재실행 시 기존 코드는 issueLinkCode 쪽에서 자동 폐기된다.
async function runLinkCommand(interaction, options = {}) {
  const repository = options.repository || createWebgameRepository();
  const now = options.now || (() => new Date());

  const displayName = getMemberDisplayName(interaction.user, interaction.member);
  const { code, expiresAt } = repository.issueLinkCode({
    discordId: interaction.user.id,
    displayName,
  }, now());

  const embed = buildLinkCodeEmbed(code);
  let sentByDm = false;

  if (typeof interaction.user.send === 'function') {
    try {
      await interaction.user.send({ embeds: [embed] });
      sentByDm = true;
    } catch (error) {
      sentByDm = false;
    }
  }

  if (sentByDm) {
    await interaction.reply({
      content: 'DM으로 연결 코드를 보냈어요. DM함을 확인해 주세요.',
      ephemeral: true,
    });
    return { sentByDm: true, code, expiresAt };
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
  return { sentByDm: false, code, expiresAt };
}

// /게임랭킹 실행 로직.
async function runRankingCommand(interaction, options = {}) {
  const repository = options.repository || createWebgameRepository();
  const now = options.now || (() => new Date());
  const gameId = interaction.options.getString('게임');
  const period = interaction.options.getString('기간') || 'week';

  const gameDefinition = GAME_DEFINITIONS[gameId];
  if (!gameDefinition) {
    await interaction.reply({
      content: '알 수 없는 게임이에요.',
      ephemeral: true,
    });
    return { ok: false, reason: 'UNKNOWN_GAME' };
  }

  if (!gameDefinition.rankable) {
    const weekKey = getIsoWeekKey(now());
    const progress = repository.getCommunalGoalProgress(weekKey);
    const embed = buildCommunalGoalEmbed(weekKey, progress, getCommunalGoal());
    const content = period === 'daily'
      ? '간식 공방 키우기에는 오늘의 도전이 없어요. 대신 이번 주 공동 목표가 있어요.'
      : undefined;
    await interaction.reply({
      content,
      embeds: [embed],
    });
    return { ok: true, gameId, weekKey, progress };
  }

  if (period === 'daily' && !gameDefinition.dailyCapable) {
    // rankable:true지만 dailyCapable:false인 게임(검은 종 생존전 - 실시간 입력 의존
    // 장르라 "같은 판" 보장이 안 돼 오늘의 도전 비대상, docs/survivors-improvement-plan.md
    // 0·6절). idle(rankable:false)과는 다른 경로라 여기서 명시적으로 안내한다.
    await interaction.reply({
      content: `${gameDefinition.title}에는 오늘의 도전이 없어요. 이번 주 랭킹을 보여드릴게요.`,
    });
    const weekKeyForFallback = getIsoWeekKey(now());
    const fallbackRanking = mergeCheers(
      repository,
      gameId,
      weekKeyForFallback,
      repository.listWeeklyRanking(gameId, weekKeyForFallback, { limit: 10 })
    );
    await interaction.followUp({
      embeds: [buildRankingEmbed(gameDefinition.title, weekKeyForFallback, fallbackRanking)],
    });
    return { ok: true, gameId, weekKey: weekKeyForFallback, ranking: fallbackRanking, notDaily: true };
  }

  if (period === 'daily') {
    const dayKey = getDayKey(now());
    const ranking = mergeCheers(
      repository,
      gameId,
      dayKey,
      repository.listDailyRanking(gameId, dayKey, { limit: 10 })
    );
    const participants = repository.countDailyParticipants(gameId, dayKey);

    await interaction.reply({
      embeds: [buildDailyRankingEmbed(gameDefinition.title, dayKey, participants, ranking)],
    });

    return { ok: true, gameId, dayKey, ranking, participants };
  }

  const weekKey = getIsoWeekKey(now());
  const ranking = mergeCheers(repository, gameId, weekKey, repository.listWeeklyRanking(gameId, weekKey, { limit: 10 }));

  await interaction.reply({
    embeds: [buildRankingEmbed(gameDefinition.title, weekKey, ranking)],
  });

  return { ok: true, gameId, weekKey, ranking };
}

module.exports = {
  runLinkCommand,
  runRankingCommand,
  buildLinkCodeEmbed,
  buildRankingEmbed,
  buildDailyRankingEmbed,
  buildCommunalGoalEmbed,
  listRankableGames,
};

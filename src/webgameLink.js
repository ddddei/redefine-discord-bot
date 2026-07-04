const { EmbedBuilder } = require('discord.js');
const { createWebgameRepository, getIsoWeekKey } = require('./webgameRepository');
const { GAME_DEFINITIONS, listRankableGames } = require('./webgameApi');

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
    ? ranking.map((entry) => `${entry.rank}. ${entry.displayName} — ${entry.score.toLocaleString('ko-KR')}점`)
    : ['이번 주 기록이 아직 없어요.'];

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`${gameTitle} 이번 주 랭킹`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `주차: ${weekKey}` });
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

  const gameDefinition = GAME_DEFINITIONS[gameId];
  if (!gameDefinition) {
    await interaction.reply({
      content: '알 수 없는 게임이에요.',
      ephemeral: true,
    });
    return { ok: false, reason: 'UNKNOWN_GAME' };
  }

  if (!gameDefinition.rankable) {
    await interaction.reply({
      content: `${gameDefinition.title}는 랭킹 대상이 아니에요. 참여 기록만 서버에 남아요.`,
      ephemeral: true,
    });
    return { ok: false, reason: 'NOT_RANKABLE' };
  }

  const weekKey = getIsoWeekKey(now());
  const ranking = repository.listWeeklyRanking(gameId, weekKey, { limit: 10 });

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
  listRankableGames,
};

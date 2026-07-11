const { MINIGAMES } = require('./minigameData');
const { buildDungeonworldAnalytics } = require('./dungeonworld');
const { createGuideEmbed } = require('./embeds');
const {
  getKoreanDateString,
  getMinigamePlayDate,
} = require('./pointsRepository');

const DAILY_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function getTransactionGameId(transaction) {
  const parts = String(transaction.relatedId || '').split(':');
  return parts.length >= 2 ? parts.slice(1).join(':') : '';
}

function getGameTitle(gameId) {
  return MINIGAMES[gameId] ? MINIGAMES[gameId].title : (gameId || '알 수 없는 게임');
}

function summarizeTransactions(transactions) {
  return {
    playCount: transactions.length,
    uniqueUserCount: new Set(transactions.map((transaction) => transaction.userId)).size,
    totalPoints: transactions.reduce((sum, transaction) => sum + Math.max(0, transaction.amount || 0), 0),
  };
}

function buildRecentDates(now) {
  return Array.from({ length: DAILY_WINDOW_DAYS }, (unused, index) => {
    return getKoreanDateString(new Date(now.getTime() - index * DAY_MS));
  });
}

function buildPerGameSummaries(transactions) {
  const byGameId = new Map();

  for (const transaction of transactions) {
    const gameId = getTransactionGameId(transaction);
    const current = byGameId.get(gameId) || {
      gameId,
      title: getGameTitle(gameId),
      playCount: 0,
      uniqueUsers: new Set(),
      zeroRewardCount: 0,
      totalPoints: 0,
    };
    current.playCount += 1;
    current.uniqueUsers.add(transaction.userId);
    const amount = Math.max(0, transaction.amount || 0);
    if (amount === 0) {
      current.zeroRewardCount += 1;
    }
    current.totalPoints += amount;
    byGameId.set(gameId, current);
  }

  return Array.from(byGameId.values())
    .map((entry) => ({
      gameId: entry.gameId,
      title: entry.title,
      playCount: entry.playCount,
      uniqueUserCount: entry.uniqueUsers.size,
      zeroRewardCount: entry.zeroRewardCount,
      zeroRewardRate: entry.playCount > 0 ? Math.round((entry.zeroRewardCount / entry.playCount) * 100) : 0,
      totalPoints: entry.totalPoints,
    }))
    .sort((left, right) => {
      if (right.playCount !== left.playCount) {
        return right.playCount - left.playCount;
      }

      return left.title.localeCompare(right.title, 'ko');
    });
}

function buildDungeonworldSection(dungeonworldRepository) {
  if (!dungeonworldRepository) {
    return null;
  }

  const totalPlayCount = dungeonworldRepository.getPlayCount();
  const analytics = buildDungeonworldAnalytics(
    totalPlayCount > 0 ? dungeonworldRepository.listRecentPlays(totalPlayCount) : []
  );

  return {
    totalPlayCount: analytics.totalPlayCount,
    uniqueUserCount: analytics.uniqueUserCount,
    sessionCounts: analytics.sessionCounts,
  };
}

function buildMinigameReport({ pointsRepository, dungeonworldRepository, now = new Date() }) {
  const transactions = pointsRepository.listMinigameRewardTransactions();
  const todayString = getKoreanDateString(now);
  const recentDates = buildRecentDates(now);
  const recentDateSet = new Set(recentDates);

  const withDates = transactions.map((transaction) => ({
    transaction,
    playDate: getMinigamePlayDate(transaction),
  }));
  const todayTransactions = withDates
    .filter((entry) => entry.playDate === todayString)
    .map((entry) => entry.transaction);
  const recentTransactions = withDates
    .filter((entry) => recentDateSet.has(entry.playDate))
    .map((entry) => entry.transaction);

  const dailyCounts = recentDates.map((dateString) => {
    const dayTransactions = withDates
      .filter((entry) => entry.playDate === dateString)
      .map((entry) => entry.transaction);
    return {
      date: dateString,
      playCount: dayTransactions.length,
      uniqueUserCount: new Set(dayTransactions.map((transaction) => transaction.userId)).size,
    };
  });

  return {
    generatedDateKst: todayString,
    hub: {
      today: summarizeTransactions(todayTransactions),
      recent7Days: summarizeTransactions(recentTransactions),
      total: summarizeTransactions(transactions),
      dailyCounts,
      perGame: buildPerGameSummaries(transactions),
    },
    dungeonworld: buildDungeonworldSection(dungeonworldRepository),
  };
}

function formatWindowLine(label, summary) {
  return `- ${label}: 확정 결과 ${summary.playCount}건 / 참여자 ${summary.uniqueUserCount}명 / 지급 ${summary.totalPoints}P`;
}

function createMinigameReportEmbed(report) {
  const hasHubData = report.hub.total.playCount > 0;
  const hasDungeonworldData = Boolean(report.dungeonworld && report.dungeonworld.totalPlayCount > 0);

  if (!hasHubData && !hasDungeonworldData) {
    return createGuideEmbed(
      '🎮 미니게임 참여 리포트',
      [
        `기준 날짜(KST): ${report.generatedDateKst}`,
        '',
        '아직 미니게임 참여 기록이 없어요.',
        '참여가 시작되면 게임별 플레이 수와 참여자 수를 여기서 확인할 수 있어요.',
      ].join('\n')
    );
  }

  const hubLines = [
    '전체 (버튼형 허브)',
    formatWindowLine('오늘', report.hub.today),
    formatWindowLine('최근 7일', report.hub.recent7Days),
    formatWindowLine('누적', report.hub.total),
    '',
    '최근 7일 일별 참여',
    ...report.hub.dailyCounts.map((day) => `- ${day.date}: ${day.playCount}건 / ${day.uniqueUserCount}명`),
    '',
    '게임별 (누적, 플레이 수 순)',
    ...(report.hub.perGame.length > 0
      ? report.hub.perGame.map((game) => {
        return `- ${game.title}: ${game.playCount}건 / ${game.uniqueUserCount}명 / 0P 비율 ${game.zeroRewardRate}% / 지급 ${game.totalPoints}P`;
      })
      : ['- 아직 버튼형 미니게임 기록이 없어요.']),
  ];

  const dungeonworldLines = report.dungeonworld
    ? [
      '',
      '던전월드 (솔로 어드벤처, 포인트 없음)',
      `- 누적 플레이 ${report.dungeonworld.totalPlayCount}건 / 참여자 ${report.dungeonworld.uniqueUserCount}명`,
      report.dungeonworld.sessionCounts.length > 0
        ? `- 회차별 플레이: ${report.dungeonworld.sessionCounts.map((session) => `${session.sessionTitle} ${session.count}건`).join(' · ')}`
        : '- 아직 던전월드 플레이 기록이 없어요.',
    ]
    : [];

  return createGuideEmbed(
    '🎮 미니게임 참여 리포트',
    [
      `기준 날짜(KST): ${report.generatedDateKst}`,
      '',
      ...hubLines,
      ...dungeonworldLines,
      '',
      '평가가 아닌 운영 참고용 집계예요. 개인별 확인은 `/포인트로그`, 원본 백업은 `/운영내보내기`를 사용해 주세요.',
    ].join('\n')
  );
}

module.exports = {
  buildMinigameReport,
  createMinigameReportEmbed,
};

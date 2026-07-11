// 웹게임 주간 랭킹 반자동 지급(docs/webgame-point-payout-plan.md).
// 이 모듈은 지급 계획 계산과 실행만 담당하는 순수 로직이다 — Discord 객체를 만지지
// 않고, 포인트 상태 변경은 전부 pointsRepository.awardWebgameWeeklyReward 경유.
const { getIsoWeekKey } = require('./webgameRepository');
const { GAME_DEFINITIONS, getCommunalGoal } = require('./webgameApi');
const { getWebgameWeeklyRewardRelatedId } = require('./pointsRepository');
const crypto = require('crypto');

// 지급 대상 게임(2026-07-11 운영 확정: 생존전 포함 4게임 중 랭킹 대상 3종).
// idle은 랭킹 비대상이라 공동 목표 보상으로만 지급된다.
const WEEKLY_PAYOUT_GAME_IDS = ['match3', 'deck', 'survivors'];
// 1~3위 금액(2026-07-04 운영 확정).
const WEEKLY_RANK_REWARDS = [3000, 2000, 1000];
// 참여 보상: 게임 불문 주당 1회, 순위 보상 수령자 제외(2026-07-11 운영 확정 — 결정 칸 A).
const WEEKLY_PARTICIPATION_REWARD = 500;
const PARTICIPATION_RELATED_GAME_ID = 'all';
// 공동 목표 달성 보상: 그 주 idle 제출자 전원, 랭킹 보상과 중복 허용(2026-07-04 운영 확정).
const COMMUNAL_GOAL_REWARD = 500;
// 주간 참여 규모(60~100명)를 넉넉히 덮는 전수 조회 상한.
const PARTICIPANT_SCAN_LIMIT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getPayoutWeekKey(period, now = new Date()) {
  if (period === 'current') {
    return getIsoWeekKey(now);
  }

  return getIsoWeekKey(new Date(now.getTime() - 7 * DAY_MS));
}

function buildWeeklyPayoutPlan({ webgameRepository, pointsRepository, weekKey, communalGoal = getCommunalGoal() }) {
  const paidTransactions = pointsRepository.listWebgameWeeklyRewardTransactions(weekKey);
  const paidKeys = new Set(paidTransactions.map((transaction) => `${transaction.userId}|${transaction.relatedId}`));

  function isAlreadyPaid(discordId, gameId, kind) {
    return paidKeys.has(`${discordId}|${getWebgameWeeklyRewardRelatedId(weekKey, gameId, kind)}`);
  }

  const rankWinnerIds = new Set();
  const participantsById = new Map();

  const games = WEEKLY_PAYOUT_GAME_IDS.map((gameId) => {
    const winners = webgameRepository.listWeeklyRanking(gameId, weekKey, { limit: WEEKLY_RANK_REWARDS.length })
      .map((entry) => {
        rankWinnerIds.add(entry.discordId);
        return {
          discordId: entry.discordId,
          displayName: entry.displayName,
          rank: entry.rank,
          score: entry.score,
          amount: WEEKLY_RANK_REWARDS[entry.rank - 1],
          kind: `rank${entry.rank}`,
          alreadyPaid: isAlreadyPaid(entry.discordId, gameId, `rank${entry.rank}`),
        };
      });

    webgameRepository.listWeeklyRanking(gameId, weekKey, { limit: PARTICIPANT_SCAN_LIMIT })
      .forEach((entry) => {
        if (!participantsById.has(entry.discordId)) {
          participantsById.set(entry.discordId, entry.displayName);
        }
      });

    return { gameId, gameTitle: GAME_DEFINITIONS[gameId].title, winners };
  });

  const participationRecipients = Array.from(participantsById.entries())
    .filter(([discordId]) => !rankWinnerIds.has(discordId))
    .map(([discordId, displayName]) => ({
      discordId,
      displayName,
      alreadyPaid: isAlreadyPaid(discordId, PARTICIPATION_RELATED_GAME_ID, 'participation'),
    }));

  const progress = webgameRepository.getCommunalGoalProgress(weekKey);
  const achieved = progress.total >= communalGoal;
  const communalRecipients = achieved
    ? Array.from(progress.contributions.keys()).map((discordId) => {
      const link = webgameRepository.getLinkByDiscordId(discordId);
      return {
        discordId,
        displayName: link && link.displayName ? link.displayName : discordId,
        alreadyPaid: isAlreadyPaid(discordId, 'idle', 'communal'),
      };
    })
    : [];

  const mismatchRecords = webgameRepository.getReplayMismatchData().records.filter((record) => {
    if (!record.at) {
      return false;
    }
    const at = new Date(record.at);
    return !Number.isNaN(at.getTime()) && getIsoWeekKey(at) === weekKey;
  });
  const mismatchUserCount = new Set(
    mismatchRecords.map((record) => record.discordId).filter(Boolean)
  ).size;

  const payableEntries = [
    ...games.flatMap((game) => game.winners),
    ...participationRecipients.map((recipient) => ({ ...recipient, amount: WEEKLY_PARTICIPATION_REWARD })),
    ...communalRecipients.map((recipient) => ({ ...recipient, amount: COMMUNAL_GOAL_REWARD })),
  ];

  return {
    weekKey,
    games,
    participation: {
      amount: WEEKLY_PARTICIPATION_REWARD,
      recipients: participationRecipients,
    },
    communal: {
      achieved,
      total: progress.total,
      goal: communalGoal,
      participants: progress.participants,
      amount: COMMUNAL_GOAL_REWARD,
      recipients: communalRecipients,
    },
    mismatchWarning: mismatchRecords.length > 0
      ? { count: mismatchRecords.length, userCount: mismatchUserCount }
      : null,
    totals: {
      payableAmount: payableEntries.filter((entry) => !entry.alreadyPaid)
        .reduce((sum, entry) => sum + entry.amount, 0),
      payableCount: payableEntries.filter((entry) => !entry.alreadyPaid).length,
      alreadyPaidCount: payableEntries.filter((entry) => entry.alreadyPaid).length,
    },
  };
}

function executeWeeklyPayoutPlan(plan, { pointsRepository, operatorId }) {
  const result = { paid: 0, skipped: 0, paidAmount: 0, failed: [] };

  function award(entry, { amount, gameId, kind, reason }) {
    try {
      const awarded = pointsRepository.awardWebgameWeeklyReward({
        user: { userId: entry.discordId, displayName: entry.displayName },
        amount,
        weekKey: plan.weekKey,
        gameId,
        kind,
        reason,
        operatorId,
      });

      if (awarded.ok) {
        result.paid += 1;
        result.paidAmount += amount;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      result.failed.push({ displayName: entry.displayName, message: error.message });
    }
  }

  plan.games.forEach((game) => {
    game.winners.forEach((winner) => {
      award(winner, {
        amount: winner.amount,
        gameId: game.gameId,
        kind: winner.kind,
        reason: `${game.gameTitle} ${plan.weekKey} 주간 랭킹 ${winner.rank}위`,
      });
    });
  });

  plan.participation.recipients.forEach((recipient) => {
    award(recipient, {
      amount: plan.participation.amount,
      gameId: PARTICIPATION_RELATED_GAME_ID,
      kind: 'participation',
      reason: `웹게임 ${plan.weekKey} 주간 참여 보상`,
    });
  });

  if (plan.communal.achieved) {
    plan.communal.recipients.forEach((recipient) => {
      award(recipient, {
        amount: plan.communal.amount,
        gameId: 'idle',
        kind: 'communal',
        reason: `간식 공방 키우기 ${plan.weekKey} 공동 목표 달성`,
      });
    });
  }

  return result;
}

function getWeeklyPayoutSnapshotToken(plan) {
  const snapshot = {
    weekKey: plan.weekKey,
    games: plan.games.map((game) => ({
      gameId: game.gameId,
      winners: game.winners.map((winner) => ({
        discordId: winner.discordId,
        displayName: winner.displayName,
        rank: winner.rank,
        score: winner.score,
        amount: winner.amount,
        kind: winner.kind,
        alreadyPaid: winner.alreadyPaid,
      })),
    })),
    participation: plan.participation.recipients.map((recipient) => ({
      discordId: recipient.discordId,
      displayName: recipient.displayName,
      alreadyPaid: recipient.alreadyPaid,
    })),
    communal: {
      achieved: plan.communal.achieved,
      total: plan.communal.total,
      goal: plan.communal.goal,
      recipients: plan.communal.recipients.map((recipient) => ({
        discordId: recipient.discordId,
        displayName: recipient.displayName,
        alreadyPaid: recipient.alreadyPaid,
      })),
    },
  };
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function buildAdminWeeklyPayoutPreview(plan) {
  return {
    ...plan,
    snapshotToken: getWeeklyPayoutSnapshotToken(plan),
  };
}

function formatAmount(amount) {
  return `${amount.toLocaleString('ko-KR')}P`;
}

function buildPayoutPreviewLines(plan) {
  const lines = [
    `주차: ${plan.weekKey}`,
    '지급 전 내역을 확인해 주세요. 승인하면 아래 항목이 한 번에 지급돼요.',
    '',
  ];

  plan.games.forEach((game) => {
    lines.push(`**${game.gameTitle}** 주간 랭킹`);
    if (game.winners.length === 0) {
      lines.push('이번 주 기록이 없어요.');
    } else {
      game.winners.forEach((winner) => {
        const paidText = winner.alreadyPaid ? ' — 지급됨' : '';
        lines.push(`${winner.rank}위 ${winner.displayName} · ${winner.score.toLocaleString('ko-KR')}점 · ${formatAmount(winner.amount)}${paidText}`);
      });
    }
    lines.push('');
  });

  const unpaidParticipation = plan.participation.recipients.filter((recipient) => !recipient.alreadyPaid).length;
  const paidParticipation = plan.participation.recipients.length - unpaidParticipation;
  lines.push(`**주간 참여 보상** (순위 보상 제외, 주당 1회 ${formatAmount(plan.participation.amount)})`);
  lines.push(
    plan.participation.recipients.length === 0
      ? '대상자가 없어요.'
      : `대상 ${plan.participation.recipients.length}명${paidParticipation > 0 ? ` (이미 지급 ${paidParticipation}명)` : ''}`
  );
  lines.push('');

  lines.push('**간식 공방 키우기 공동 목표**');
  if (plan.communal.achieved) {
    const paidCommunal = plan.communal.recipients.filter((recipient) => recipient.alreadyPaid).length;
    lines.push(`달성 (${plan.communal.total.toLocaleString('ko-KR')} / ${plan.communal.goal.toLocaleString('ko-KR')}) — 제출자 ${plan.communal.recipients.length}명에게 ${formatAmount(plan.communal.amount)}${paidCommunal > 0 ? ` (이미 지급 ${paidCommunal}명)` : ''}`);
  } else {
    lines.push(`미달성 (${plan.communal.total.toLocaleString('ko-KR')} / ${plan.communal.goal.toLocaleString('ko-KR')}) — 지급 없음`);
  }
  lines.push('');

  if (plan.mismatchWarning) {
    lines.push(`⚠️ 이 주에 리플레이 검증 불일치 기록이 ${plan.mismatchWarning.count}건(${plan.mismatchWarning.userCount}명) 있어요.`);
    lines.push('/admin 웹게임 운영 현황에서 확인 후, 필요하면 취소하고 해당 건만 수동 처리해 주세요.');
    lines.push('');
  }

  lines.push(`지급 예정: ${plan.totals.payableCount}건 · ${formatAmount(plan.totals.payableAmount)}`);
  if (plan.totals.alreadyPaidCount > 0) {
    lines.push(`이미 지급된 항목 ${plan.totals.alreadyPaidCount}건은 건너뛰어요.`);
  }

  return lines;
}

function buildPayoutResultLines(weekKey, result) {
  const lines = [
    `주차: ${weekKey}`,
    `지급 완료: ${result.paid}건 · ${formatAmount(result.paidAmount)}`,
  ];

  if (result.skipped > 0) {
    lines.push(`이미 지급되어 건너뜀: ${result.skipped}건`);
  }

  if (result.failed.length > 0) {
    lines.push('');
    lines.push(`처리하지 못한 항목 ${result.failed.length}건 — 아래 대상은 /포인트관리로 직접 확인해 주세요.`);
    result.failed.forEach((failure) => {
      lines.push(`- ${failure.displayName}: ${failure.message}`);
    });
  }

  lines.push('');
  lines.push('지급 내역은 /포인트로그에서 사유로 추적할 수 있어요.');

  return lines;
}

module.exports = {
  WEEKLY_PAYOUT_GAME_IDS,
  WEEKLY_RANK_REWARDS,
  WEEKLY_PARTICIPATION_REWARD,
  COMMUNAL_GOAL_REWARD,
  getPayoutWeekKey,
  buildWeeklyPayoutPlan,
  executeWeeklyPayoutPlan,
  getWeeklyPayoutSnapshotToken,
  buildAdminWeeklyPayoutPreview,
  buildPayoutPreviewLines,
  buildPayoutResultLines,
};

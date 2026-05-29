const { createPointsRepository, getKoreanDateString } = require('./pointsRepository');

function createDefaultRepository() {
  return createPointsRepository();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseLimit(limit, fallback = 10) {
  const parsed = Number(limit || fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isTodayKst(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) === getKoreanDateString();
}

function sortNewestFirst(items, fields) {
  return toArray(items).slice().sort((left, right) => {
    const leftDate = fields.map((field) => left[field]).find(Boolean);
    const rightDate = fields.map((field) => right[field]).find(Boolean);
    return new Date(rightDate || 0).getTime() - new Date(leftDate || 0).getTime();
  });
}

function countByStatus(items) {
  return toArray(items).reduce((counts, item) => {
    const status = item && item.status ? item.status : 'unknown';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function readState(repository) {
  if (repository && typeof repository.loadState === 'function') {
    return repository.loadState();
  }

  return createDefaultRepository().loadState();
}

function readReactionApprovals(repository) {
  if (repository && typeof repository.getReactionApprovalData === 'function') {
    const data = repository.getReactionApprovalData();
    return toArray(data.records);
  }

  return [];
}

function buildAdminSummary(repository = createDefaultRepository()) {
  const state = readState(repository);
  const users = toArray(state.pointsData && state.pointsData.users);
  const pointTransactions = toArray(state.pointsData && state.pointsData.pointTransactions);
  const redemptions = toArray(state.redemptionsData && state.redemptionsData.redemptions);
  const submissions = toArray(state.submissionsData && state.submissionsData.submissions);
  const missions = toArray(state.missionsData && state.missionsData.missions);
  const shopItems = toArray(state.shopItemsData && state.shopItemsData.shopItems);
  const reactionApprovals = readReactionApprovals(repository);

  return {
    title: process.env.ADMIN_DASHBOARD_TITLE || '리디파인 운영 대시보드',
    usersCount: users.length,
    pointTransactionsCount: pointTransactions.length,
    todayPointTransactionsCount: pointTransactions.filter((transaction) => isTodayKst(transaction.createdAt)).length,
    todayEarnedPoints: pointTransactions
      .filter((transaction) => isTodayKst(transaction.createdAt) && Number(transaction.amount) > 0)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    pendingRedemptionsCount: redemptions.filter((redemption) => redemption.status === 'pending').length,
    pendingSubmissionsCount: submissions.filter((submission) => submission.status === 'pending').length,
    activeMissionsCount: missions.filter((mission) => mission.status === 'active').length,
    activeShopItemsCount: shopItems.filter((item) => item.status === 'active').length,
    todayReactionApprovalsCount: reactionApprovals.filter((record) => isTodayKst(record.reviewedAt || record.createdAt)).length,
    missionStatusCounts: countByStatus(missions),
    shopItemStatusCounts: countByStatus(shopItems),
    generatedAt: new Date().toISOString(),
  };
}

function listPendingRedemptions(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listPendingRedemptions === 'function') {
    return clone(repository.listPendingRedemptions(parseLimit(limit)));
  }

  const state = readState(repository);
  return sortNewestFirst(toArray(state.redemptionsData && state.redemptionsData.redemptions), ['requestedAt', 'createdAt'])
    .filter((redemption) => redemption.status === 'pending')
    .slice(0, parseLimit(limit));
}

function listPendingSubmissions(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listPendingSubmissions === 'function') {
    return clone(repository.listPendingSubmissions(parseLimit(limit)));
  }

  const state = readState(repository);
  return sortNewestFirst(toArray(state.submissionsData && state.submissionsData.submissions), ['createdAt', 'reviewedAt'])
    .filter((submission) => submission.status === 'pending')
    .slice(0, parseLimit(limit));
}

function listRecentPointTransactions(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listTransactions === 'function') {
    return clone(repository.listTransactions({ limit: parseLimit(limit) }));
  }

  const state = readState(repository);
  return sortNewestFirst(toArray(state.pointsData && state.pointsData.pointTransactions), ['createdAt'])
    .slice(0, parseLimit(limit));
}

function listMissionStatus(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listMissionsForAdmin === 'function') {
    return clone(repository.listMissionsForAdmin({ limit: parseLimit(limit) }));
  }

  const state = readState(repository);
  return sortNewestFirst(toArray(state.missionsData && state.missionsData.missions), ['updatedAt', 'createdAt', 'activeDate'])
    .slice(0, parseLimit(limit));
}

function listShopItemStatus(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listShopItemsForAdmin === 'function') {
    return clone(repository.listShopItemsForAdmin({ limit: parseLimit(limit) }));
  }

  const state = readState(repository);
  return sortNewestFirst(toArray(state.shopItemsData && state.shopItemsData.shopItems), ['updatedAt', 'createdAt'])
    .slice(0, parseLimit(limit));
}

function listRecentReactionApprovals(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listRecentReactionApprovals === 'function') {
    return clone(repository.listRecentReactionApprovals(parseLimit(limit)));
  }

  return sortNewestFirst(readReactionApprovals(repository), ['reviewedAt', 'createdAt'])
    .slice(0, parseLimit(limit));
}

module.exports = {
  buildAdminSummary,
  listMissionStatus,
  listPendingRedemptions,
  listPendingSubmissions,
  listRecentPointTransactions,
  listRecentReactionApprovals,
  listShopItemStatus,
  parseLimit,
};

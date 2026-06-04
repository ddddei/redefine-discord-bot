const { createPointsRepository, getKoreanDateString } = require('./pointsRepository');
const {
  filterOperationalRecords,
  isExampleLikeRecord,
  isExampleLikeValue,
} = require('./operationalRecords');

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

function isMissionSubmissionRecord(submission) {
  return submission && submission.type !== 'checkin';
}

function buildAdminMeta(exampleRecordsExcluded = 0) {
  return {
    exampleRecordsExcluded,
    storageMode: 'local-json',
    readOnly: true,
    generatedAt: new Date().toISOString(),
  };
}

function buildListResponse(records, originalRecords) {
  const filtered = filterOperationalRecords(records);
  const originalFiltered = originalRecords ? filterOperationalRecords(originalRecords) : filtered;

  return {
    data: clone(filtered.data),
    meta: buildAdminMeta(originalFiltered.excluded),
  };
}

function readState(repository) {
  if (repository && typeof repository.loadState === 'function') {
    return repository.loadState();
  }

  return createDefaultRepository().loadState();
}

function readStateForMeta(repository) {
  if (repository && typeof repository.loadState === 'function') {
    return repository.loadState();
  }

  return null;
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
  const usersResult = filterOperationalRecords(state.pointsData && state.pointsData.users);
  const pointTransactionsResult = filterOperationalRecords(state.pointsData && state.pointsData.pointTransactions);
  const redemptionsResult = filterOperationalRecords(state.redemptionsData && state.redemptionsData.redemptions);
  const submissionsResult = filterOperationalRecords(state.submissionsData && state.submissionsData.submissions);
  const missionsResult = filterOperationalRecords(state.missionsData && state.missionsData.missions);
  const shopItemsResult = filterOperationalRecords(state.shopItemsData && state.shopItemsData.shopItems);
  const reactionApprovalsResult = filterOperationalRecords(readReactionApprovals(repository));
  const users = usersResult.data;
  const pointTransactions = pointTransactionsResult.data;
  const redemptions = redemptionsResult.data;
  const submissions = submissionsResult.data;
  const missionSubmissions = submissions.filter(isMissionSubmissionRecord);
  const missions = missionsResult.data;
  const shopItems = shopItemsResult.data;
  const reactionApprovals = reactionApprovalsResult.data;
  const exampleRecordsExcluded = usersResult.excluded
    + pointTransactionsResult.excluded
    + redemptionsResult.excluded
    + submissionsResult.excluded
    + missionsResult.excluded
    + shopItemsResult.excluded
    + reactionApprovalsResult.excluded;

  return {
    title: process.env.ADMIN_DASHBOARD_TITLE || '리디파인 운영 대시보드',
    usersCount: users.length,
    pointTransactionsCount: pointTransactions.length,
    todayPointTransactionsCount: pointTransactions.filter((transaction) => isTodayKst(transaction.createdAt)).length,
    todayEarnedPoints: pointTransactions
      .filter((transaction) => isTodayKst(transaction.createdAt) && Number(transaction.amount) > 0)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    pendingRedemptionsCount: redemptions.filter((redemption) => redemption.status === 'pending').length,
    pendingSubmissionsCount: missionSubmissions.filter((submission) => submission.status === 'pending').length,
    reviewedSubmissionsCount: missionSubmissions.filter((submission) => {
      return submission.status === 'approved' || submission.status === 'rejected';
    }).length,
    activeMissionsCount: missions.filter((mission) => mission.status === 'active').length,
    activeShopItemsCount: shopItems.filter((item) => item.status === 'active').length,
    todayReactionApprovalsCount: reactionApprovals.filter((record) => isTodayKst(record.reviewedAt || record.createdAt)).length,
    submissionStatusCounts: countByStatus(missionSubmissions),
    missionStatusCounts: countByStatus(missions),
    shopItemStatusCounts: countByStatus(shopItems),
    exampleRecordsExcluded,
    storageMode: 'local-json',
    readOnly: true,
    generatedAt: new Date().toISOString(),
    meta: buildAdminMeta(exampleRecordsExcluded),
  };
}

function listPendingRedemptions(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listPendingRedemptions === 'function') {
    const state = readStateForMeta(repository);
    return buildListResponse(
      repository.listPendingRedemptions(parseLimit(limit)),
      state && toArray(state.redemptionsData && state.redemptionsData.redemptions)
        .filter((redemption) => redemption.status === 'pending')
    );
  }

  const state = readState(repository);
  return buildListResponse(sortNewestFirst(toArray(state.redemptionsData && state.redemptionsData.redemptions), ['requestedAt', 'createdAt'])
    .filter((redemption) => redemption.status === 'pending')
    .slice(0, parseLimit(limit)), toArray(state.redemptionsData && state.redemptionsData.redemptions)
    .filter((redemption) => redemption.status === 'pending'));
}

function listPendingSubmissions(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listPendingSubmissions === 'function') {
    const state = readStateForMeta(repository);
    return buildListResponse(
      repository.listPendingSubmissions(parseLimit(limit)),
      state && toArray(state.submissionsData && state.submissionsData.submissions)
        .filter(isMissionSubmissionRecord)
        .filter((submission) => submission.status === 'pending')
    );
  }

  const state = readState(repository);
  return buildListResponse(sortNewestFirst(toArray(state.submissionsData && state.submissionsData.submissions), ['createdAt', 'reviewedAt'])
    .filter(isMissionSubmissionRecord)
    .filter((submission) => submission.status === 'pending')
    .slice(0, parseLimit(limit)), toArray(state.submissionsData && state.submissionsData.submissions)
    .filter(isMissionSubmissionRecord)
    .filter((submission) => submission.status === 'pending'));
}

function listRecentPointTransactions(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listOperationalTransactions === 'function') {
    const state = readStateForMeta(repository);
    return buildListResponse(
      repository.listOperationalTransactions({ limit: parseLimit(limit) }),
      state && toArray(state.pointsData && state.pointsData.pointTransactions)
    );
  }

  const state = readState(repository);
  return buildListResponse(
    sortNewestFirst(toArray(state.pointsData && state.pointsData.pointTransactions), ['createdAt']).slice(0, parseLimit(limit)),
    toArray(state.pointsData && state.pointsData.pointTransactions)
  );
}

function listMissionStatus(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listMissionsForAdmin === 'function') {
    const state = readStateForMeta(repository);
    return buildListResponse(
      repository.listMissionsForAdmin({ limit: parseLimit(limit) }),
      state && toArray(state.missionsData && state.missionsData.missions)
    );
  }

  const state = readState(repository);
  return buildListResponse(
    sortNewestFirst(toArray(state.missionsData && state.missionsData.missions), ['updatedAt', 'createdAt', 'activeDate']).slice(0, parseLimit(limit)),
    toArray(state.missionsData && state.missionsData.missions)
  );
}

function listShopItemStatus(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.listShopItemsForAdmin === 'function') {
    const state = readStateForMeta(repository);
    return buildListResponse(
      repository.listShopItemsForAdmin({ limit: parseLimit(limit) }),
      state && toArray(state.shopItemsData && state.shopItemsData.shopItems)
    );
  }

  const state = readState(repository);
  return buildListResponse(
    sortNewestFirst(toArray(state.shopItemsData && state.shopItemsData.shopItems), ['updatedAt', 'createdAt']).slice(0, parseLimit(limit)),
    toArray(state.shopItemsData && state.shopItemsData.shopItems)
  );
}

function listRecentReactionApprovals(repository = createDefaultRepository(), limit = 10) {
  const reactionApprovals = readReactionApprovals(repository);
  if (repository && typeof repository.listRecentReactionApprovals === 'function') {
    return buildListResponse(repository.listRecentReactionApprovals(parseLimit(limit)), reactionApprovals);
  }

  return buildListResponse(
    sortNewestFirst(reactionApprovals, ['reviewedAt', 'createdAt']).slice(0, parseLimit(limit)),
    reactionApprovals
  );
}

module.exports = {
  buildAdminSummary,
  listMissionStatus,
  listPendingRedemptions,
  listPendingSubmissions,
  listRecentPointTransactions,
  listRecentReactionApprovals,
  listShopItemStatus,
  filterOperationalRecords,
  isExampleLikeRecord,
  isExampleLikeValue,
  parseLimit,
};

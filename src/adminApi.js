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

function getDateValue(record, fields) {
  return fields.map((field) => record && record[field]).find(Boolean) || null;
}

function getAgeHours(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.floor((Date.now() - date.getTime()) / (60 * 60 * 1000));
}

function createQueueWarning(type, severity, message, record) {
  return {
    type,
    severity,
    message,
    recordId: record && record.id ? record.id : null,
    createdAt: record ? getDateValue(record, ['requestedAt', 'createdAt', 'reviewedAt']) : null,
  };
}

function createQueueFollowUp(type, message, record) {
  return {
    type,
    message,
    recordId: record && record.id ? record.id : null,
    createdAt: record ? getDateValue(record, ['reviewedAt', 'createdAt']) : null,
    source: record && record.messageUrl ? record.messageUrl : null,
  };
}

function getDuplicateWarnings(items, fields, type, label) {
  const groups = items.reduce((map, item) => {
    const key = fields.map((field) => item[field] || '').join(':');
    if (!key.replace(/:/g, '')) {
      return map;
    }

    map[key] = map[key] || [];
    map[key].push(item);
    return map;
  }, {});

  return Object.values(groups)
    .filter((records) => records.length > 1)
    .map((records) => {
      const first = records[0];
      return createQueueWarning(
        type,
        'warning',
        `${label}: 같은 참여자와 대상 조합으로 ${records.length}건이 대기 중입니다.`,
        first
      );
    });
}

function getNotificationFollowUps(reactionApprovals) {
  return reactionApprovals.flatMap((record) => {
    const results = record.notificationResults || {};
    const followUps = [];

    if (results.dmUser === 'failed') {
      followUps.push(createQueueFollowUp('reactionApprovalDmFailed', 'DM 알림 실패: 참여자에게 처리 결과가 전달됐는지 확인해 주세요.', record));
    }

    if (results.publicReply === 'failed') {
      followUps.push(createQueueFollowUp('reactionApprovalPublicReplyFailed', '공개 답글 알림 실패: 인증 글에 처리 안내가 남았는지 확인해 주세요.', record));
    }

    return followUps;
  });
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

function buildTodayOperationsQueue(repository = createDefaultRepository(), limit = 10) {
  const safeLimit = parseLimit(limit, 10);
  const state = readState(repository);
  const usersResult = filterOperationalRecords(state.pointsData && state.pointsData.users);
  const pointTransactionsResult = filterOperationalRecords(state.pointsData && state.pointsData.pointTransactions);
  const redemptionsResult = filterOperationalRecords(state.redemptionsData && state.redemptionsData.redemptions);
  const submissionsResult = filterOperationalRecords(state.submissionsData && state.submissionsData.submissions);
  const missionsResult = filterOperationalRecords(state.missionsData && state.missionsData.missions);
  const shopItemsResult = filterOperationalRecords(state.shopItemsData && state.shopItemsData.shopItems);
  const reactionApprovalsResult = filterOperationalRecords(readReactionApprovals(repository));
  const pointTransactions = pointTransactionsResult.data;
  const redemptions = redemptionsResult.data;
  const submissions = submissionsResult.data.filter(isMissionSubmissionRecord);
  const missionsById = missionsResult.data.reduce((map, mission) => {
    map[mission.id] = mission;
    return map;
  }, {});
  const shopItemsById = shopItemsResult.data.reduce((map, item) => {
    map[item.id] = item;
    return map;
  }, {});
  const pendingRedemptions = sortNewestFirst(redemptions, ['requestedAt', 'createdAt'])
    .filter((redemption) => redemption.status === 'pending')
    .map((redemption) => ({
      ...redemption,
      itemName: redemption.itemName || (shopItemsById[redemption.itemId] && shopItemsById[redemption.itemId].name) || null,
    }));
  const pendingSubmissions = sortNewestFirst(submissions, ['createdAt', 'reviewedAt'])
    .filter((submission) => submission.status === 'pending')
    .map((submission) => ({
      ...submission,
      missionTitle: submission.missionTitle || (missionsById[submission.missionId] && missionsById[submission.missionId].title) || null,
      rewardPoints: submission.rewardPoints || (missionsById[submission.missionId] && missionsById[submission.missionId].rewardPoints) || 0,
    }));
  const todayReactionApprovals = sortNewestFirst(reactionApprovalsResult.data, ['reviewedAt', 'createdAt'])
    .filter((record) => isTodayKst(record.reviewedAt || record.createdAt));
  const todayPointTransactions = sortNewestFirst(pointTransactions, ['createdAt'])
    .filter((transaction) => isTodayKst(transaction.createdAt));
  const staleRedemptionWarnings = pendingRedemptions
    .filter((redemption) => getAgeHours(redemption.requestedAt || redemption.createdAt) >= 24)
    .map((redemption) => createQueueWarning(
      'stalePendingRedemption',
      'warning',
      `오래된 교환 대기: ${getAgeHours(redemption.requestedAt || redemption.createdAt)}시간째 pending 상태입니다.`,
      redemption
    ));
  const staleSubmissionWarnings = pendingSubmissions
    .filter((submission) => getAgeHours(submission.createdAt) >= 24)
    .map((submission) => createQueueWarning(
      'stalePendingSubmission',
      'warning',
      `오래된 인증 대기: ${getAgeHours(submission.createdAt)}시간째 pending 상태입니다.`,
      submission
    ));
  const missingReferenceWarnings = [
    ...pendingRedemptions
      .filter((redemption) => redemption.itemId && !shopItemsById[redemption.itemId])
      .map((redemption) => createQueueWarning('missingShopItem', 'warning', '교환 대기 항목의 상점 항목을 찾지 못했습니다.', redemption)),
    ...pendingSubmissions
      .filter((submission) => submission.missionId && !missionsById[submission.missionId])
      .map((submission) => createQueueWarning('missingMission', 'warning', '인증 대기 항목의 미션을 찾지 못했습니다.', submission)),
    ...todayReactionApprovals
      .filter((record) => record.status === 'approved' && record.rewardPoints > 0 && !record.transactionId)
      .map((record) => createQueueWarning('missingReactionTransaction', 'warning', '승인된 반응 기록에 포인트 거래 ID가 없습니다.', record)),
  ];
  const duplicateWarnings = [
    ...getDuplicateWarnings(pendingRedemptions, ['userId', 'itemId'], 'duplicatePendingRedemption', '중복 교환 대기'),
    ...getDuplicateWarnings(pendingSubmissions, ['userId', 'missionId'], 'duplicatePendingSubmission', '중복 인증 대기'),
  ];
  const exampleRecordsExcluded = usersResult.excluded
    + pointTransactionsResult.excluded
    + redemptionsResult.excluded
    + submissionsResult.excluded
    + missionsResult.excluded
    + shopItemsResult.excluded
    + reactionApprovalsResult.excluded;

  return {
    title: '오늘의 운영 큐',
    readOnly: true,
    storageMode: 'local-json',
    generatedAt: new Date().toISOString(),
    counts: {
      pendingRedemptions: pendingRedemptions.length,
      pendingSubmissions: pendingSubmissions.length,
      todayReactionApprovals: todayReactionApprovals.length,
      todayPointTransactions: todayPointTransactions.length,
      followUps: getNotificationFollowUps(todayReactionApprovals).length,
      qaWarnings: staleRedemptionWarnings.length
        + staleSubmissionWarnings.length
        + missingReferenceWarnings.length
        + duplicateWarnings.length,
    },
    pendingRedemptions: clone(pendingRedemptions.slice(0, safeLimit)),
    pendingSubmissions: clone(pendingSubmissions.slice(0, safeLimit)),
    todayReactionApprovals: clone(todayReactionApprovals.slice(0, safeLimit)),
    todayPointTransactions: clone(todayPointTransactions.slice(0, safeLimit)),
    followUps: clone(getNotificationFollowUps(todayReactionApprovals).slice(0, safeLimit)),
    qaWarnings: clone([
      ...staleRedemptionWarnings,
      ...staleSubmissionWarnings,
      ...missingReferenceWarnings,
      ...duplicateWarnings,
    ].slice(0, safeLimit)),
    meta: buildAdminMeta(exampleRecordsExcluded),
  };
}

module.exports = {
  buildAdminSummary,
  buildTodayOperationsQueue,
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

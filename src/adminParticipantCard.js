const {
  filterOperationalRecords,
  isExampleLikeRecord,
  isExampleLikeValue,
} = require('./operationalRecords');
const { getOpsDelayThresholds, getWaitingMetadata } = require('./opsDelayPolicy');

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function textOrNull(value) {
  return typeof value === 'string' ? value : null;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(50, Math.max(5, Math.trunc(parsed)));
}

function timestamp(value) {
  const parsed = new Date(value || '').getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestFirst(records, fields) {
  return records.slice().sort((left, right) => {
    const leftValue = fields.map((field) => left[field]).find(Boolean);
    const rightValue = fields.map((field) => right[field]).find(Boolean);
    const timeDifference = timestamp(rightValue) - timestamp(leftValue);
    if (timeDifference !== 0) return timeDifference;
    return String(left.id || '').localeCompare(String(right.id || ''));
  });
}

function countByStatus(records) {
  return records.reduce((result, record) => {
    const status = typeof record.status === 'string' && record.status ? record.status : 'unknown';
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {});
}

function warning(code, message, recordId) {
  return { code, message, recordId: textOrNull(recordId) };
}

function buildAdminParticipantCard(repository, options = {}) {
  const userId = typeof options.userId === 'string' ? options.userId.trim() : '';
  if (!/^\d{15,22}$/.test(userId) || isExampleLikeValue(userId, 'userId')) return null;

  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const limit = normalizeLimit(options.limit);
  const state = repository.loadState();
  const pointsData = state && state.pointsData ? state.pointsData : {};
  const submissionsData = state && state.submissionsData ? state.submissionsData : {};
  const redemptionsData = state && state.redemptionsData ? state.redemptionsData : {};
  const missionsData = state && state.missionsData ? state.missionsData : {};
  const shopItemsData = state && state.shopItemsData ? state.shopItemsData : {};
  const filtered = {
    users: filterOperationalRecords(pointsData.users),
    transactions: filterOperationalRecords(pointsData.pointTransactions),
    submissions: filterOperationalRecords(submissionsData.submissions),
    redemptions: filterOperationalRecords(redemptionsData.redemptions),
    missions: filterOperationalRecords(missionsData.missions),
    shopItems: filterOperationalRecords(shopItemsData.shopItems),
  };
  const participant = filtered.users.data.find((user) => user.userId === userId);
  if (!participant || isExampleLikeRecord(participant)) return null;

  const transactions = filtered.transactions.data.filter((record) => record.userId === userId);
  const allSubmissions = filtered.submissions.data.filter((record) => record.userId === userId);
  const checkins = allSubmissions.filter((record) => record.type === 'checkin');
  const submissions = allSubmissions.filter((record) => record.type !== 'checkin');
  const redemptions = filtered.redemptions.data.filter((record) => record.userId === userId);
  const missions = new Map(filtered.missions.data.map((mission) => [mission.id, mission]));
  const shopItems = new Map(filtered.shopItems.data.map((item) => [item.id, item]));
  const thresholds = getOpsDelayThresholds(options.env || process.env);
  const warnings = [];

  if (Number(participant.totalPoints) < 0) {
    warnings.push(warning('NEGATIVE_BALANCE', '현재 포인트가 0보다 작습니다. 포인트 원장을 확인해 주세요.'));
  }
  const sortedTransactions = newestFirst(transactions, ['createdAt']);
  if (sortedTransactions.length > 0
    && Number.isFinite(Number(sortedTransactions[0].balanceAfter))
    && Number(sortedTransactions[0].balanceAfter) !== Number(participant.totalPoints)) {
    warnings.push(warning('BALANCE_MISMATCH', '최신 포인트 거래의 잔액과 현재 포인트가 일치하지 않습니다.', sortedTransactions[0].id));
  }

  const recentSubmissions = newestFirst(submissions, ['createdAt', 'reviewedAt']).map((record) => {
    const mission = missions.get(record.missionId);
    if (!mission) warnings.push(warning('MISSION_NOT_FOUND', '연결된 미션을 찾을 수 없습니다.', record.id));
    const waiting = record.status === 'pending'
      ? getWaitingMetadata(record.createdAt, thresholds.submissionHours, now)
      : null;
    if (waiting && waiting.overdue) warnings.push(warning('SUBMISSION_OVERDUE', '검토 대기 시간이 기준을 넘은 인증이 있습니다.', record.id));
    return {
      id: textOrNull(record.id),
      missionId: textOrNull(record.missionId),
      missionTitle: mission ? textOrNull(mission.title) : null,
      status: textOrNull(record.status),
      rewardPoints: mission ? numberOrNull(mission.rewardPoints) : null,
      createdAt: textOrNull(record.createdAt),
      reviewedAt: textOrNull(record.reviewedAt),
      waitingHours: waiting ? waiting.waitingHours : null,
      overdue: waiting ? waiting.overdue : false,
    };
  });
  const recentRedemptions = newestFirst(redemptions, ['requestedAt', 'completedAt', 'cancelledAt', 'refundedAt']).map((record) => {
    const item = shopItems.get(record.itemId);
    if (!item) warnings.push(warning('SHOP_ITEM_NOT_FOUND', '연결된 상점 항목을 찾을 수 없습니다.', record.id));
    const waiting = record.status === 'pending'
      ? getWaitingMetadata(record.requestedAt || record.createdAt, thresholds.redemptionHours, now)
      : null;
    if (waiting && waiting.overdue) warnings.push(warning('REDEMPTION_OVERDUE', '처리 대기 시간이 기준을 넘은 교환이 있습니다.', record.id));
    return {
      id: textOrNull(record.id),
      itemId: textOrNull(record.itemId),
      itemName: item ? textOrNull(item.name) : null,
      status: textOrNull(record.status),
      cost: numberOrNull(record.cost),
      requestedAt: textOrNull(record.requestedAt) || textOrNull(record.createdAt),
      completedAt: textOrNull(record.completedAt),
      cancelledAt: textOrNull(record.cancelledAt),
      refundedAt: textOrNull(record.refundedAt),
      waitingHours: waiting ? waiting.waitingHours : null,
      overdue: waiting ? waiting.overdue : false,
    };
  });

  const excluded = Object.values(filtered).reduce((total, result) => total + result.excluded, 0);
  return {
    participant: {
      userId: textOrNull(participant.userId),
      displayName: textOrNull(participant.displayName),
      status: textOrNull(participant.status),
      totalPoints: numberOrNull(participant.totalPoints) === null ? 0 : participant.totalPoints,
      createdAt: textOrNull(participant.createdAt),
      updatedAt: textOrNull(participant.updatedAt),
    },
    counts: {
      checkins: checkins.length,
      submissions: countByStatus(submissions),
      redemptions: countByStatus(redemptions),
      pointTransactions: transactions.length,
    },
    recent: {
      checkins: newestFirst(checkins, ['createdAt', 'checkinDate']).slice(0, limit).map((record) => ({
        id: textOrNull(record.id),
        checkinDate: textOrNull(record.checkinDate),
        status: textOrNull(record.status),
        rewardPoints: numberOrNull(record.rewardPoints),
        createdAt: textOrNull(record.createdAt),
      })),
      submissions: recentSubmissions.slice(0, limit),
      redemptions: recentRedemptions.slice(0, limit),
      pointTransactions: sortedTransactions.slice(0, limit).map((record) => ({
        id: textOrNull(record.id),
        type: textOrNull(record.type),
        amount: numberOrNull(record.amount),
        balanceAfter: numberOrNull(record.balanceAfter),
        reason: textOrNull(record.reason),
        relatedType: textOrNull(record.relatedType),
        createdAt: textOrNull(record.createdAt),
      })),
    },
    warnings,
    meta: {
      generatedAt: now.toISOString(),
      limit,
      exampleRecordsExcluded: excluded,
      contentRedacted: true,
    },
  };
}

module.exports = { buildAdminParticipantCard, normalizeLimit };

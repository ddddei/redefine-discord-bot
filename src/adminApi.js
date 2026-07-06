const path = require('path');
const { createDmChatRepository } = require('./dmChatRepository');
const { createPointsRepository, getKoreanDateString } = require('./pointsRepository');
const {
  filterOperationalRecords,
  isExampleLikeRecord,
  isExampleLikeValue,
} = require('./operationalRecords');
const {
  createWebgameRepository,
  getIsoWeekKey,
  getDayKey,
} = require('./webgameRepository');
const { GAME_DEFINITIONS, getCommunalGoal } = require('./webgameApi');

function createDefaultRepository() {
  return createPointsRepository();
}

function createDefaultDmChatRepository() {
  const logPath = process.env.DM_CHAT_LOG_PATH || path.join(__dirname, '..', 'data', 'dm-chat-logs.local.json');
  return createDmChatRepository(logPath);
}

function createDefaultWebgameRepository() {
  return createWebgameRepository();
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
      followUps.push(createQueueFollowUp('reactionApprovalDmFailed', 'DM 알림 실패: 원본 인증 글, `/운영현황 종류:반응후속확인`, `/포인트로그`에서 처리 결과 전달 여부를 확인해 주세요.', record));
    }

    if (results.publicReply === 'failed') {
      followUps.push(createQueueFollowUp('reactionApprovalPublicReplyFailed', '공개 답글 알림 실패: 인증 채널 메시지 권한과 원본 인증 글 답글 여부를 확인해 주세요.', record));
    }

    if (record.status === 'approved' && Number(record.rewardPoints || 0) > 0 && !record.transactionId) {
      followUps.push(createQueueFollowUp('reactionApprovalMissingTransaction', '승인 기록에 포인트 거래 ID가 없습니다. `/포인트로그`, `/운영내보내기 종류:포인트`, 원본 메시지를 대조해 주세요.', record));
    }

    return followUps;
  });
}

function createRiskCheck(level, title, detail, command) {
  return {
    level,
    title,
    detail,
    command: command || null,
  };
}

function isChannelReady(check) {
  return Boolean(check && check.configured && check.found && check.accessible && check.canSendMessages);
}

function getChannelCheck(channelChecks, envName) {
  return toArray(channelChecks).find((check) => check && check.envName === envName) || null;
}

function buildFirstDayRiskChecks({
  channelChecks = [],
  activeMissionsCount = 0,
  activeShopItemsCount = 0,
  pendingRedemptionsCount = 0,
  pendingSubmissionsCount = 0,
  reactionFollowUpsCount = 0,
  exampleRecordsExcluded = 0,
  backupReminderEnabled = false,
} = {}) {
  const risks = [];
  const logChannel = getChannelCheck(channelChecks, 'LOG_CHANNEL_ID');
  const missionSubmissionChannel = getChannelCheck(channelChecks, 'MISSION_SUBMISSION_CHANNEL_ID');
  const activityReviewChannel = getChannelCheck(channelChecks, 'ACTIVITY_REVIEW_CHANNEL_ID');
  const pointRedeemChannel = getChannelCheck(channelChecks, 'POINT_REDEEM_CHANNEL_ID');

  if (!isChannelReady(logChannel)) {
    risks.push(createRiskCheck(
      backupReminderEnabled ? 'critical' : 'warning',
      '운영 로그 채널 확인 필요',
      backupReminderEnabled
        ? '백업 리마인더가 켜져 있지만 LOG_CHANNEL_ID가 전송 가능한 상태가 아닙니다. 리마인더가 운영진에게 도착하지 않을 수 있습니다.'
        : 'LOG_CHANNEL_ID가 전송 가능한 상태가 아니면 기본 운영 로그와 fallback 알림을 놓칠 수 있습니다.',
      '/운영현황 종류:환경설정점검'
    ));
  }

  if (missionSubmissionChannel && missionSubmissionChannel.configured && !isChannelReady(missionSubmissionChannel)) {
    risks.push(createRiskCheck(
      'critical',
      '별도 인증 채널 권한 확인 필요',
      'MISSION_SUBMISSION_CHANNEL_ID가 설정됐지만 봇이 채널을 보거나 메시지를 보낼 수 없습니다. 참여자 인증 안내와 운영자 확인 위치가 어긋날 수 있습니다.',
      '/운영현황 종류:환경설정점검'
    ));
  } else if (!missionSubmissionChannel || !missionSubmissionChannel.configured) {
    risks.push(createRiskCheck(
      activeMissionsCount > 0 ? 'warning' : 'optional',
      '별도 인증 채널 미설정',
      activeMissionsCount > 0
        ? 'active 미션이 있습니다. 별도 인증 채널을 운영할 계획이라면 MISSION_SUBMISSION_CHANNEL_ID와 채널 권한을 확인해 주세요.'
        : '별도 인증 채널을 쓰지 않는 운영이면 선택 항목입니다.',
      '/운영현황 종류:첫날점검'
    ));
  }

  if (activeMissionsCount === 0) {
    risks.push(createRiskCheck(
      'warning',
      'active 미션 없음',
      '참여자가 `/미션`에서 볼 운영 미션이 없습니다. 첫 운영 전에 `/미션관리`에서 오늘 노출할 미션을 active로 확인해 주세요.',
      '/미션관리'
    ));
  }

  if (activeShopItemsCount === 0) {
    risks.push(createRiskCheck(
      'warning',
      'active 상점 항목 없음',
      '참여자가 `/상점`에서 볼 교환 항목이 없습니다. 교환 운영을 할 경우 `/상점관리`에서 항목 상태를 확인해 주세요.',
      '/상점관리'
    ));
  }

  if (pendingRedemptionsCount > 0 && !isChannelReady(pointRedeemChannel) && !isChannelReady(logChannel)) {
    risks.push(createRiskCheck(
      'warning',
      '교환 대기 알림 채널 확인 필요',
      '교환 대기가 있는데 POINT_REDEEM_CHANNEL_ID 또는 LOG_CHANNEL_ID 알림 경로가 전송 가능한 상태가 아닙니다. `/운영현황 종류:교환대기`와 `/교환관리`를 직접 확인해 주세요.',
      '/운영현황 종류:교환대기'
    ));
  }

  if (pendingSubmissionsCount > 0 && !isChannelReady(activityReviewChannel) && !isChannelReady(logChannel)) {
    risks.push(createRiskCheck(
      'warning',
      '인증 검토 알림 채널 확인 필요',
      '인증 대기가 있는데 ACTIVITY_REVIEW_CHANNEL_ID 또는 LOG_CHANNEL_ID 알림 경로가 전송 가능한 상태가 아닙니다. `/운영현황 종류:인증대기`와 `/인증관리`를 직접 확인해 주세요.',
      '/운영현황 종류:인증대기'
    ));
  }

  if (reactionFollowUpsCount > 0) {
    risks.push(createRiskCheck(
      'warning',
      '반응 승인 후속 확인 필요',
      'DM 실패, 공개 답글 실패, 포인트 거래 ID 누락 항목이 있습니다. 원본 인증 글과 `/포인트로그`를 대조해 주세요.',
      '/운영현황 종류:반응후속확인'
    ));
  }

  if (exampleRecordsExcluded > 0) {
    risks.push(createRiskCheck(
      'critical',
      '예시 데이터 혼입 차단',
      'example/demo/sample/2030년대 예시 데이터가 local 운영 데이터에서 제외됐습니다. 운영 전 `data/*.local.json`에 예시 레코드가 섞였는지 확인해 주세요.',
      'node scripts/check-local-operation-data.js'
    ));
  }

  if (risks.length === 0) {
    risks.push(createRiskCheck(
      'optional',
      '큰 사전 경고 없음',
      '읽기 전용 점검 기준에서 치명/주의 항목이 없습니다. 실제 Discord 리허설로 마지막 흐름을 확인해 주세요.',
      '/운영내보내기 종류:전체 형식:JSON'
    ));
  }

  return risks;
}

function buildTodayActions(riskChecks) {
  const actions = [];
  const hasCritical = riskChecks.some((risk) => risk.level === 'critical');
  if (hasCritical) {
    actions.push('치명 항목을 먼저 확인하고, Railway Variables와 Discord 채널 권한을 맞춥니다.');
  }
  actions.push('`/미션관리`와 `/상점관리`에서 active 미션/상점 항목이 오늘 운영 기준과 맞는지 확인합니다.');
  actions.push('`/운영현황 종류:교환대기`, `종류:인증대기`, `종류:반응후속확인`을 보고 처리할 ID를 확인합니다.');
  actions.push('운영 시작 전 또는 종료 전 `/운영내보내기 종류:전체 형식:JSON`으로 백업 파일을 확보합니다.');
  actions.push('예시 데이터 제외 건수가 0이 아니면 `node scripts/check-local-operation-data.js`로 local JSON을 점검합니다.');

  return actions.slice(0, 5);
}

function buildAdminMeta(exampleRecordsExcluded = 0) {
  return {
    exampleRecordsExcluded,
    exampleDataWarning: exampleRecordsExcluded > 0
      ? 'example/demo/sample/2030년대 예시 데이터는 운영 데이터에서 제외됐습니다. local JSON 혼입 여부를 확인해 주세요.'
      : null,
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
    reactionFollowUpsCount: getNotificationFollowUps(reactionApprovals).length,
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

function buildFirstDayCheck(repository = createDefaultRepository(), options = {}) {
  const state = readState(repository);
  const usersResult = filterOperationalRecords(state.pointsData && state.pointsData.users);
  const pointTransactionsResult = filterOperationalRecords(state.pointsData && state.pointsData.pointTransactions);
  const redemptionsResult = filterOperationalRecords(state.redemptionsData && state.redemptionsData.redemptions);
  const submissionsResult = filterOperationalRecords(state.submissionsData && state.submissionsData.submissions);
  const missionsResult = filterOperationalRecords(state.missionsData && state.missionsData.missions);
  const shopItemsResult = filterOperationalRecords(state.shopItemsData && state.shopItemsData.shopItems);
  const reactionApprovalsResult = filterOperationalRecords(readReactionApprovals(repository));
  const supportSummary = repository && typeof repository.getOperatorSupportSummary === 'function'
    ? repository.getOperatorSupportSummary(parseLimit(options.limit, 10))
    : { trackedUsersCount: 0, guidanceSentCount: 0, faqCandidates: [] };
  const missionSubmissions = submissionsResult.data.filter(isMissionSubmissionRecord);
  const exampleRecordsExcluded = usersResult.excluded
    + pointTransactionsResult.excluded
    + redemptionsResult.excluded
    + submissionsResult.excluded
    + missionsResult.excluded
    + shopItemsResult.excluded
    + reactionApprovalsResult.excluded;
  const pendingRedemptions = redemptionsResult.data.filter((redemption) => redemption.status === 'pending');
  const pendingSubmissions = missionSubmissions.filter((submission) => submission.status === 'pending');
  const channelChecks = toArray(options.channelChecks);
  const channelReadyCount = channelChecks.filter((check) => {
    return check && check.configured && check.found && check.accessible && check.canSendMessages;
  }).length;

  const activeMissionsCount = missionsResult.data.filter((mission) => mission.status === 'active').length;
  const activeShopItemsCount = shopItemsResult.data.filter((item) => item.status === 'active').length;
  const reactionFollowUpsCount = getNotificationFollowUps(reactionApprovalsResult.data).length;
  const backupReminderEnabled = process.env.OPERATION_BACKUP_REMINDER_ENABLED === 'true';
  const riskChecks = buildFirstDayRiskChecks({
    channelChecks,
    activeMissionsCount,
    activeShopItemsCount,
    pendingRedemptionsCount: pendingRedemptions.length,
    pendingSubmissionsCount: pendingSubmissions.length,
    reactionFollowUpsCount,
    exampleRecordsExcluded,
    backupReminderEnabled,
  });

  return {
    readOnly: true,
    storageMode: 'local-json',
    generatedAt: new Date().toISOString(),
    channelChecks,
    channelReadyCount,
    channelCheckCount: channelChecks.length,
    googleSheetsCheck: options.googleSheetsCheck || {},
    activeMissionsCount,
    activeShopItemsCount,
    pendingRedemptionsCount: pendingRedemptions.length,
    pendingSubmissionsCount: pendingSubmissions.length,
    reactionFollowUpsCount,
    exampleRecordsExcluded,
    exampleDataExcluded: exampleRecordsExcluded >= 0,
    exampleDataWarning: exampleRecordsExcluded > 0
      ? 'example/demo/sample/2030년대 예시 데이터는 운영 데이터로 표시하지 않고 제외했습니다.'
      : null,
    backupReminderEnabled,
    exportGuideCommand: '/운영내보내기 종류:전체 형식:JSON',
    onboardingTrackedUsersCount: supportSummary.trackedUsersCount || 0,
    missionGuidanceSentCount: supportSummary.guidanceSentCount || 0,
    faqCandidateCount: toArray(supportSummary.faqCandidates).length,
    riskChecks,
    todayActions: buildTodayActions(riskChecks),
    meta: buildAdminMeta(exampleRecordsExcluded),
  };
}

function buildReactionFollowUpQueue(repository = createDefaultRepository(), limit = 10) {
  const reactionApprovals = filterOperationalRecords(readReactionApprovals(repository)).data;
  const followUps = sortNewestFirst(
    getNotificationFollowUps(reactionApprovals),
    ['createdAt']
  ).slice(0, parseLimit(limit, 10));

  return {
    title: '반응 승인 후속 확인',
    readOnly: true,
    storageMode: 'local-json',
    generatedAt: new Date().toISOString(),
    counts: {
      followUps: getNotificationFollowUps(reactionApprovals).length,
    },
    followUps: clone(followUps),
    meta: buildAdminMeta(filterOperationalRecords(readReactionApprovals(repository)).excluded),
  };
}

function buildOnboardingSignals(repository = createDefaultRepository(), limit = 10) {
  if (repository && typeof repository.getOperatorSupportSummary === 'function') {
    return repository.getOperatorSupportSummary(parseLimit(limit, 10));
  }

  return {
    readOnly: true,
    storageMode: 'local-json',
    generatedAt: new Date().toISOString(),
    trackedCommands: ['안내', '포인트', '미션', '상점'],
    commandCounts: {},
    trackedUsersCount: 0,
    guidanceSentCount: 0,
    helpSignals: [],
    faqCandidates: [],
  };
}

function buildFaqCandidateQueue(repository = createDefaultRepository(), limit = 10) {
  const signals = buildOnboardingSignals(repository, limit);

  return {
    readOnly: true,
    storageMode: 'local-json',
    generatedAt: new Date().toISOString(),
    faqCandidates: toArray(signals.faqCandidates),
  };
}

function buildDmChatTodaySummary(repository = null, now = new Date()) {
  const dmRepository = repository && typeof repository.summarizeToday === 'function'
    ? repository
    : createDefaultDmChatRepository();

  return dmRepository.summarizeToday(now);
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
  const state = readStateForMeta(repository);
  if (state) {
    const missionsResult = filterOperationalRecords(state.missionsData && state.missionsData.missions);
    return buildListResponse(
      sortNewestFirst(missionsResult.data, ['updatedAt', 'createdAt', 'activeDate']).slice(0, parseLimit(limit)),
      toArray(state.missionsData && state.missionsData.missions)
    );
  }

  if (repository && typeof repository.listMissionsForAdmin === 'function') {
    return buildListResponse(
      repository.listMissionsForAdmin({ limit: parseLimit(limit) }),
      null
    );
  }

  const fallbackState = readState(repository);
  const missionsResult = filterOperationalRecords(fallbackState.missionsData && fallbackState.missionsData.missions);
  return buildListResponse(
    sortNewestFirst(missionsResult.data, ['updatedAt', 'createdAt', 'activeDate']).slice(0, parseLimit(limit)),
    toArray(fallbackState.missionsData && fallbackState.missionsData.missions)
  );
}

function listShopItemStatus(repository = createDefaultRepository(), limit = 10) {
  const state = readStateForMeta(repository);
  if (state) {
    const shopItemsResult = filterOperationalRecords(state.shopItemsData && state.shopItemsData.shopItems);
    return buildListResponse(
      sortNewestFirst(shopItemsResult.data, ['updatedAt', 'createdAt']).slice(0, parseLimit(limit)),
      toArray(state.shopItemsData && state.shopItemsData.shopItems)
    );
  }

  if (repository && typeof repository.listShopItemsForAdmin === 'function') {
    return buildListResponse(
      repository.listShopItemsForAdmin({ limit: parseLimit(limit) }),
      null
    );
  }

  const fallbackState = readState(repository);
  const shopItemsResult = filterOperationalRecords(fallbackState.shopItemsData && fallbackState.shopItemsData.shopItems);
  return buildListResponse(
    sortNewestFirst(shopItemsResult.data, ['updatedAt', 'createdAt']).slice(0, parseLimit(limit)),
    toArray(fallbackState.shopItemsData && fallbackState.shopItemsData.shopItems)
  );
}

function listRecentReactionApprovals(repository = createDefaultRepository(), limit = 10) {
  const reactionApprovals = readReactionApprovals(repository);

  return buildListResponse(
    sortNewestFirst(filterOperationalRecords(reactionApprovals).data, ['reviewedAt', 'createdAt']).slice(0, parseLimit(limit)),
    reactionApprovals
  );
}

function summarizeSafetyDetection(detection) {
  if (!detection || typeof detection !== 'object') {
    return null;
  }

  return {
    category: detection.category || null,
    severity: detection.severity || null,
  };
}

function normalizeDmChatLogOptions(options = {}) {
  if (typeof options !== 'object' || options === null) {
    return {
      limit: parseLimit(options, 10),
      safetyOnly: false,
      userId: null,
    };
  }

  return {
    limit: parseLimit(options.limit, 10),
    safetyOnly: options.safetyOnly === true || String(options.safetyOnly || '').toLowerCase() === 'true',
    userId: typeof options.userId === 'string' && options.userId.trim()
      ? options.userId.trim()
      : null,
  };
}

function listRecentDmChatMessages(repository = null, options = 10) {
  const normalizedOptions = normalizeDmChatLogOptions(options);
  const dmRepository = repository && typeof repository.listRecentMessagesForAdmin === 'function'
    ? repository
    : createDefaultDmChatRepository();
  const records = dmRepository.listRecentMessagesForAdmin();
  const filtered = filterOperationalRecords(records);
  const visibleRecords = filtered.data.filter((message) => {
    if (normalizedOptions.userId && message.userId !== normalizedOptions.userId) {
      return false;
    }

    if (normalizedOptions.safetyOnly && !message.safetyDetection) {
      return false;
    }

    return true;
  });

  return {
    data: clone(sortNewestFirst(visibleRecords, ['createdAt']).slice(0, normalizedOptions.limit).map((message) => ({
      id: message.id || null,
      createdAt: message.createdAt || null,
      userId: message.userId || null,
      username: message.username || null,
      displayName: message.displayName || message.username || message.userId || null,
      role: message.role || null,
      content: message.content || '',
      hasSafetyDetection: Boolean(message.safetyDetection),
      safetyDetection: summarizeSafetyDetection(message.safetyDetection),
    }))),
    meta: {
      ...buildAdminMeta(filtered.excluded),
      filters: {
        userId: normalizedOptions.userId,
        safetyOnly: normalizedOptions.safetyOnly,
        limit: normalizedOptions.limit,
      },
    },
  };
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

const WEBGAME_LABELS = Object.keys(GAME_DEFINITIONS).reduce((map, gameId) => {
  map[gameId] = GAME_DEFINITIONS[gameId].title;
  return map;
}, {});

// 예시 데이터 최상위 플래그(isExample)면 운영 데이터로 취급하지 않고 빈 결과 + 제외 건수만 반환한다.
// 링크/스코어/소셜 저장소는 개별 레코드에도 filterOperationalRecords를 적용해 example 레코드를 걸러낸다.
function readOperationalLinksData(webgameRepository) {
  const linksData = webgameRepository.getLinksData();
  if (linksData.isExample === true) {
    return { links: [], excluded: toArray(linksData.links).length };
  }

  const linksResult = filterOperationalRecords(linksData.links);
  return { links: linksResult.data, excluded: linksResult.excluded };
}

function readOperationalScoresData(webgameRepository) {
  const scoresData = webgameRepository.getScoresData();
  if (scoresData.isExample === true) {
    return { scores: [], excluded: toArray(scoresData.scores).length };
  }

  const scoresResult = filterOperationalRecords(scoresData.scores);
  return { scores: scoresResult.data, excluded: scoresResult.excluded };
}

function readOperationalSocialData(webgameRepository) {
  const socialData = webgameRepository.getSocialData();
  if (socialData.isExample === true) {
    return { cheers: [], excluded: toArray(socialData.cheers).length };
  }

  const cheersResult = filterOperationalRecords(socialData.cheers);
  return { cheers: cheersResult.data, excluded: cheersResult.excluded };
}

function resolveNow(now) {
  if (typeof now === 'function') {
    return now();
  }

  return now instanceof Date ? now : new Date();
}

function buildDisplayNameMap(links) {
  return new Map(links.map((link) => [link.discordId, link.displayName]));
}

// 랭킹 요약은 repository helper를 그대로 쓰므로, example 유사 레코드가 로컬 데이터에
// 섞여 있어도 대시보드에 노출되지 않도록 항목 단위로 한 번 더 거른다 (금기 조항).
function excludeExampleRankingEntries(entries) {
  return entries.filter((entry) => !isExampleLikeRecord({
    discordId: entry.discordId,
    displayName: entry.displayName,
  }));
}

function summarizeWeeklyRanking(webgameRepository, gameId, weekKey, limit) {
  const ranking = excludeExampleRankingEntries(webgameRepository.listWeeklyRanking(gameId, weekKey, { limit }));
  const cheersByDiscordId = webgameRepository.countCheers(gameId, weekKey);
  return ranking.map((entry) => ({
    rank: entry.rank,
    discordId: entry.discordId,
    displayName: entry.displayName,
    score: entry.score,
    cheers: cheersByDiscordId.get(entry.discordId) || 0,
  }));
}

function summarizeDailyRanking(webgameRepository, gameId, dayKey, limit) {
  const ranking = excludeExampleRankingEntries(webgameRepository.listDailyRanking(gameId, dayKey, { limit }));
  const cheersByDiscordId = webgameRepository.countCheers(gameId, dayKey);
  return ranking.map((entry) => ({
    rank: entry.rank,
    discordId: entry.discordId,
    displayName: entry.displayName,
    score: entry.score,
    cheers: cheersByDiscordId.get(entry.discordId) || 0,
  }));
}

function summarizeFlaggedScores(scores, displayNameByDiscordId, limit) {
  const flagged = scores.filter((score) => score.flagged === true);
  const sorted = sortNewestFirst(flagged, ['submittedAt']).slice(0, limit);

  return sorted.map((score) => ({
    discordId: score.discordId,
    displayName: displayNameByDiscordId.get(score.discordId) || '알 수 없음',
    gameId: score.gameId,
    score: score.score,
    mode: score.mode || 'free',
    weekKey: score.weekKey || null,
    dayKey: score.dayKey || null,
    submittedAt: score.submittedAt || null,
  }));
}

function summarizeCheerStats(webgameRepository, weekKey, dayKey) {
  const rankableGameIds = Object.keys(GAME_DEFINITIONS).filter((gameId) => GAME_DEFINITIONS[gameId].rankable);

  return rankableGameIds.map((gameId) => {
    const weeklyCheers = Array.from(webgameRepository.countCheers(gameId, weekKey).values())
      .reduce((sum, count) => sum + count, 0);
    const dailyCheers = Array.from(webgameRepository.countCheers(gameId, dayKey).values())
      .reduce((sum, count) => sum + count, 0);

    return {
      gameId,
      label: WEBGAME_LABELS[gameId] || gameId,
      cheersThisWeek: weeklyCheers,
      cheersToday: dailyCheers,
    };
  });
}

function buildWebgameOperationsSummary(webgameRepository = createDefaultWebgameRepository(), options = {}) {
  const nowDate = resolveNow(options.now);
  const weekKey = options.weekKey || getIsoWeekKey(nowDate);
  const dayKey = options.dayKey || getDayKey(nowDate);
  const limit = parseLimit(options.limit, 10);

  const linksResult = readOperationalLinksData(webgameRepository);
  const scoresResult = readOperationalScoresData(webgameRepository);
  const socialResult = readOperationalSocialData(webgameRepository);
  const displayNameByDiscordId = buildDisplayNameMap(linksResult.links);

  const rankableGameIds = ['match3', 'deck'];
  const weeklyRankings = rankableGameIds.reduce((map, gameId) => {
    map[gameId] = summarizeWeeklyRanking(webgameRepository, gameId, weekKey, limit);
    return map;
  }, {});

  const dailyChallenges = rankableGameIds.reduce((map, gameId) => {
    map[gameId] = {
      participants: webgameRepository.countDailyParticipants(gameId, dayKey),
      ranking: summarizeDailyRanking(webgameRepository, gameId, dayKey, limit),
    };
    return map;
  }, {});

  const wordDistribution = webgameRepository.getDailyResultDistribution('word', dayKey);
  dailyChallenges.word = {
    participants: wordDistribution.participants,
    distribution: wordDistribution.distribution,
  };

  const communalGoalProgress = webgameRepository.getCommunalGoalProgress(weekKey);
  const communalGoal = {
    weekKey,
    goal: getCommunalGoal(),
    total: communalGoalProgress.total,
    participants: communalGoalProgress.participants,
    achieved: communalGoalProgress.total >= getCommunalGoal(),
  };

  const flaggedScores = summarizeFlaggedScores(scoresResult.scores, displayNameByDiscordId, limit);
  const cheerStats = summarizeCheerStats(webgameRepository, weekKey, dayKey);

  const weeklyParticipants = Object.keys(GAME_DEFINITIONS).reduce((map, gameId) => {
    const participants = new Set();
    scoresResult.scores.forEach((score) => {
      if (score.gameId === gameId && score.weekKey === weekKey && score.flagged !== true) {
        participants.add(score.discordId);
      }
    });
    map[gameId] = participants.size;
    return map;
  }, {});

  const dailyParticipants = {
    match3: dailyChallenges.match3.participants,
    deck: dailyChallenges.deck.participants,
    word: dailyChallenges.word.participants,
  };

  const cheersThisWeek = cheerStats.reduce((sum, entry) => sum + entry.cheersThisWeek, 0);
  const cheersToday = cheerStats.reduce((sum, entry) => sum + entry.cheersToday, 0);

  const exampleRecordsExcluded = linksResult.excluded + scoresResult.excluded + socialResult.excluded;

  return {
    title: '웹게임 운영 현황',
    readOnly: true,
    storageMode: 'local-json',
    generatedAt: new Date().toISOString(),
    weekKey,
    dayKey,
    labels: WEBGAME_LABELS,
    counts: {
      linkedUsers: linksResult.links.length,
      flaggedScores: scoresResult.scores.filter((score) => score.flagged === true).length,
      weeklyParticipants,
      dailyParticipants,
      cheersThisWeek,
      cheersToday,
    },
    weeklyRankings,
    dailyChallenges,
    communalGoal,
    flaggedScores,
    cheerStats,
    meta: buildAdminMeta(exampleRecordsExcluded),
  };
}

module.exports = {
  buildAdminSummary,
  buildDmChatTodaySummary,
  buildFaqCandidateQueue,
  buildFirstDayCheck,
  buildOnboardingSignals,
  buildReactionFollowUpQueue,
  buildTodayOperationsQueue,
  buildWebgameOperationsSummary,
  createDefaultWebgameRepository,
  listMissionStatus,
  listPendingRedemptions,
  listPendingSubmissions,
  listRecentPointTransactions,
  listRecentReactionApprovals,
  listRecentDmChatMessages,
  listShopItemStatus,
  filterOperationalRecords,
  isExampleLikeRecord,
  isExampleLikeValue,
  parseLimit,
};

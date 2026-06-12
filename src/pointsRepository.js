const fs = require('fs');
const path = require('path');
const {
  canRedeem,
  cancelRedemption,
  completeRedemption,
  createPointTransaction,
  createRedemption,
  getShopItem,
  getUser,
  getUserPoints,
  listPointTransactions,
  loadJsonFile,
  refundRedemption,
  saveJsonFile,
} = require('./pointsStore');
const defaultGoogleSheetsLogger = require('./googleSheetsLogger');
const { filterOperationalRecords } = require('./operationalRecords');

const DATA_DIR = path.join(__dirname, '..', 'data');

const DEFAULT_PATHS = {
  points: process.env.POINTS_DATA_PATH || path.join(DATA_DIR, 'points.local.json'),
  pointsFallback: path.join(DATA_DIR, 'points.example.json'),
  shopItems: process.env.SHOP_ITEMS_DATA_PATH || path.join(DATA_DIR, 'shop-items.local.json'),
  shopItemsFallback: path.join(DATA_DIR, 'shop-items.example.json'),
  redemptions: process.env.REDEMPTIONS_DATA_PATH || path.join(DATA_DIR, 'redemptions.local.json'),
  redemptionsFallback: path.join(DATA_DIR, 'redemptions.example.json'),
  missions: process.env.MISSIONS_DATA_PATH || path.join(DATA_DIR, 'missions.local.json'),
  missionsFallback: path.join(DATA_DIR, 'missions.example.json'),
  submissions: process.env.SUBMISSIONS_DATA_PATH || path.join(DATA_DIR, 'submissions.local.json'),
  submissionsFallback: path.join(DATA_DIR, 'submissions.example.json'),
  reactionApprovals: process.env.REACTION_APPROVALS_DATA_PATH || path.join(DATA_DIR, 'reaction-approvals.local.json'),
};

const CHECKIN_REWARD_POINTS = 10;
const MINIGAME_DAILY_REWARD_CAP = 10;
const MINIGAME_REWARD_RELATED_TYPE = 'minigameReward';
const MISSION_STATUSES = new Set(['draft', 'active', 'paused', 'closed', 'archived']);
const SHOP_ITEM_STATUSES = new Set(['active', 'paused', 'soldOut', 'hidden']);
const SHOP_ITEM_TYPES = new Set(['youthCenterPoint', 'reward', 'goods', 'event']);
const SHOP_DISPLAY_PREFIX = 'S';
const MISSION_DISPLAY_PREFIX = 'M';

function createTimestamp() {
  return new Date().toISOString();
}

function createOperationId(prefix) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${suffix}`;
}

function getKoreanDateString(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function loadWithFallback(primaryPath, fallbackPath) {
  if (fs.existsSync(primaryPath)) {
    return loadJsonFile(primaryPath);
  }

  return loadJsonFile(fallbackPath);
}

function loadOptionalWithFallback(primaryPath, fallbackPath, collectionName) {
  if (fs.existsSync(primaryPath)) {
    return loadJsonFile(primaryPath);
  }

  if (fs.existsSync(fallbackPath)) {
    return loadJsonFile(fallbackPath);
  }

  return {
    isExample: false,
    description: `Empty ${collectionName} export data.`,
    [collectionName]: [],
  };
}

function createInitialActivityData(fallbackPath, collectionName) {
  const fallbackData = loadJsonFile(fallbackPath);
  return {
    ...fallbackData,
    isExample: false,
    description: `Local ${collectionName} data for point activity MVP. JSON storage is for MVP operation only.`,
    [collectionName]: [],
  };
}

function loadActivityWithFallback(primaryPath, fallbackPath, collectionName) {
  if (fs.existsSync(primaryPath)) {
    return loadJsonFile(primaryPath);
  }

  const initialData = createInitialActivityData(fallbackPath, collectionName);
  saveJsonFile(primaryPath, initialData);
  return initialData;
}

function createInitialReactionApprovalsData() {
  return {
    version: 1,
    isExample: false,
    description: 'Local reaction approval data for mission submission channel MVP. JSON storage is for MVP operation only.',
    records: [],
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sortNewestFirst(items, dateFields) {
  return items.slice().sort((left, right) => {
    const leftDate = dateFields.map((field) => left[field]).find(Boolean);
    const rightDate = dateFields.map((field) => right[field]).find(Boolean);
    return new Date(rightDate || 0).getTime() - new Date(leftDate || 0).getTime();
  });
}

function limitItems(items, limit) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit || 50)));
  return Array.isArray(items) ? items.slice(0, safeLimit) : [];
}

function getOperationalRecords(records) {
  return filterOperationalRecords(records).data;
}

function createDisplayCode(prefix, index) {
  return `${prefix}${String(index + 1).padStart(3, '0')}`;
}

function normalizeIdentifier(identifier) {
  return typeof identifier === 'string' ? identifier.trim() : '';
}

function attachDisplayCodes(items, prefix) {
  return items.map((item, index) => ({
    ...item,
    displayCode: createDisplayCode(prefix, index),
  }));
}

function findByIdOrDisplayCode(items, identifier) {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  return items.find((item) => {
    return item.id === normalizedIdentifier
      || String(item.displayCode || '').toUpperCase() === normalizedIdentifier.toUpperCase();
  }) || null;
}

function requireTrimmedString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} 값이 필요합니다.`);
  }

  return value.trim();
}

function requirePositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} 값은 0보다 큰 정수여야 합니다.`);
  }
}

function requireNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} 값은 0 이상의 정수여야 합니다.`);
  }
}

function createPointsRepository(paths = {}, options = {}) {
  const resolvedPaths = {
    ...DEFAULT_PATHS,
    ...paths,
  };
  const googleSheetsLogger = options.googleSheetsLogger || defaultGoogleSheetsLogger;

  if (!paths.reactionApprovals && paths.submissions) {
    resolvedPaths.reactionApprovals = path.join(path.dirname(paths.submissions), 'reaction-approvals.local.json');
  }

  function loadState() {
    return {
      pointsData: loadWithFallback(resolvedPaths.points, resolvedPaths.pointsFallback),
      shopItemsData: loadWithFallback(resolvedPaths.shopItems, resolvedPaths.shopItemsFallback),
      redemptionsData: loadWithFallback(resolvedPaths.redemptions, resolvedPaths.redemptionsFallback),
      missionsData: loadActivityWithFallback(resolvedPaths.missions, resolvedPaths.missionsFallback, 'missions'),
      submissionsData: loadActivityWithFallback(resolvedPaths.submissions, resolvedPaths.submissionsFallback, 'submissions'),
    };
  }

  function loadExportState() {
    return {
      pointsData: loadOptionalWithFallback(resolvedPaths.points, resolvedPaths.pointsFallback, 'pointTransactions'),
      shopItemsData: loadOptionalWithFallback(resolvedPaths.shopItems, resolvedPaths.shopItemsFallback, 'shopItems'),
      redemptionsData: loadOptionalWithFallback(resolvedPaths.redemptions, resolvedPaths.redemptionsFallback, 'redemptions'),
      missionsData: loadOptionalWithFallback(resolvedPaths.missions, resolvedPaths.missionsFallback, 'missions'),
      submissionsData: loadOptionalWithFallback(resolvedPaths.submissions, resolvedPaths.submissionsFallback, 'submissions'),
    };
  }

  function getMissionsData() {
    return loadActivityWithFallback(resolvedPaths.missions, resolvedPaths.missionsFallback, 'missions');
  }

  function saveMissionsData(missionsData) {
    saveJsonFile(resolvedPaths.missions, missionsData);
  }

  function getSubmissionsData() {
    return loadActivityWithFallback(
      resolvedPaths.submissions,
      resolvedPaths.submissionsFallback,
      'submissions'
    );
  }

  function saveSubmissionsData(submissionsData) {
    saveJsonFile(resolvedPaths.submissions, submissionsData);
  }

  function getReactionApprovalData() {
    if (fs.existsSync(resolvedPaths.reactionApprovals)) {
      const data = loadJsonFile(resolvedPaths.reactionApprovals);
      return {
        ...data,
        records: Array.isArray(data.records) ? data.records : [],
      };
    }

    const initialData = createInitialReactionApprovalsData();
    saveJsonFile(resolvedPaths.reactionApprovals, initialData);
    return initialData;
  }

  function saveReactionApprovalData(reactionApprovalData) {
    saveJsonFile(resolvedPaths.reactionApprovals, {
      version: 1,
      isExample: false,
      description: reactionApprovalData.description || createInitialReactionApprovalsData().description,
      records: Array.isArray(reactionApprovalData.records) ? reactionApprovalData.records : [],
    });
  }

  function saveState(state) {
    saveJsonFile(resolvedPaths.points, state.pointsData);
    saveJsonFile(resolvedPaths.shopItems, state.shopItemsData);
    saveJsonFile(resolvedPaths.redemptions, state.redemptionsData);
  }

  function ensureUser(pointsData, userInput) {
    const now = createTimestamp();
    let user = getUser(pointsData, userInput.userId);

    if (user) {
      return user;
    }

    user = {
      userId: userInput.userId,
      displayName: userInput.displayName || userInput.userId,
      nickname: userInput.nickname || userInput.displayName || userInput.userId,
      totalPoints: 0,
      createdAt: now,
      updatedAt: now,
      status: 'active',
      note: '운영 명령으로 생성됨',
    };

    pointsData.users = Array.isArray(pointsData.users) ? pointsData.users : [];
    pointsData.users.push(user);
    return user;
  }

  function updateUserBalance(user, balanceAfter, displayName) {
    user.totalPoints = balanceAfter;
    user.updatedAt = createTimestamp();
    if (displayName) {
      user.displayName = displayName;
      user.nickname = displayName;
    }
  }

  function addTransaction(pointsData, transactionInput) {
    pointsData.pointTransactions = Array.isArray(pointsData.pointTransactions)
      ? pointsData.pointTransactions
      : [];
    const transaction = createPointTransaction(transactionInput);
    pointsData.pointTransactions.push(transaction);
    return transaction;
  }

  function appendPointTransactionLog(transaction, context = {}) {
    if (!transaction || !googleSheetsLogger) {
      return;
    }

    try {
      const append = googleSheetsLogger.logPointTransaction || googleSheetsLogger.appendPointTransaction;
      if (typeof append !== 'function') return;
      Promise.resolve(append.call(googleSheetsLogger, transaction, context)).catch((error) => {
        console.warn('Google Sheets point transaction append failed:', error.message);
      });
    } catch (error) {
      console.warn('Google Sheets point transaction append failed:', error.message);
    }
  }

  function appendMissionSubmissionLog(submission, context = {}) {
    if (!submission || !googleSheetsLogger) {
      return;
    }

    try {
      const append = googleSheetsLogger.logMissionSubmission || googleSheetsLogger.appendMissionSubmission;
      if (typeof append !== 'function') return;
      Promise.resolve(append.call(googleSheetsLogger, submission, context.mission || null, context)).catch((error) => {
        console.warn('Google Sheets mission submission append failed:', error.message);
      });
    } catch (error) {
      console.warn('Google Sheets mission submission append failed:', error.message);
    }
  }

  function appendMissionReviewLog(submission, context = {}) {
    if (!submission || !googleSheetsLogger) {
      return;
    }

    try {
      const append = googleSheetsLogger.logMissionReview || googleSheetsLogger.appendMissionReview;
      if (typeof append !== 'function') return;
      Promise.resolve(append.call(googleSheetsLogger, submission, context)).catch((error) => {
        console.warn('Google Sheets mission review append failed:', error.message);
      });
    } catch (error) {
      console.warn('Google Sheets mission review append failed:', error.message);
    }
  }

  function adjustUserPoints(input) {
    const state = loadState();
    const pointsData = cloneJson(state.pointsData);
    const user = ensureUser(pointsData, input.user);
    const currentPoints = getUserPoints(pointsData, input.user.userId);
    const balanceAfter = currentPoints + input.amount;

    if (balanceAfter < 0) {
      throw new Error('포인트 잔액이 부족해 차감할 수 없습니다.');
    }

    const transaction = addTransaction(pointsData, {
      id: createOperationId('tx_manual'),
      userId: input.user.userId,
      type: input.amount >= 0 ? 'earn' : 'adjust',
      amount: input.amount,
      balanceAfter,
      reason: input.reason,
      relatedType: 'manual',
      relatedId: null,
      createdBy: input.operatorId,
      note: input.note || null,
    });

    updateUserBalance(user, balanceAfter, input.user.displayName);
    const nextState = { ...state, pointsData };
    saveState(nextState);
    appendPointTransactionLog(transaction, {
      user,
      sourceSurface: 'operator_command',
    });

    return { user, transaction };
  }

  function getMinigameRewardRelatedId(dateString, gameId) {
    return `${dateString}:${gameId}`;
  }

  function listUserMinigameTransactions(pointsData, userId, dateString) {
    const transactions = Array.isArray(pointsData.pointTransactions)
      ? pointsData.pointTransactions
      : [];
    const relatedPrefix = `${dateString}:`;
    return transactions.filter((transaction) => {
      return transaction.userId === userId
        && transaction.relatedType === MINIGAME_REWARD_RELATED_TYPE
        && String(transaction.relatedId || '').startsWith(relatedPrefix);
    });
  }

  function awardMinigameReward(input) {
    const playDate = input.playDate || getKoreanDateString();
    const relatedId = getMinigameRewardRelatedId(playDate, input.gameId);
    const state = loadState();
    const pointsData = cloneJson(state.pointsData);
    const existingTransaction = (Array.isArray(pointsData.pointTransactions) ? pointsData.pointTransactions : [])
      .find((transaction) => {
        return transaction.userId === input.user.userId
          && transaction.relatedType === MINIGAME_REWARD_RELATED_TYPE
          && transaction.relatedId === relatedId;
      });

    if (existingTransaction) {
      return {
        ok: false,
        reason: 'ALREADY_REWARDED',
        playDate,
        relatedId,
        transaction: existingTransaction,
      };
    }

    const user = ensureUser(pointsData, input.user);
    const currentPoints = getUserPoints(pointsData, input.user.userId);
    const dailyRewardTotal = listUserMinigameTransactions(pointsData, input.user.userId, playDate)
      .reduce((sum, transaction) => sum + Math.max(0, transaction.amount || 0), 0);
    const remainingDailyReward = Math.max(0, MINIGAME_DAILY_REWARD_CAP - dailyRewardTotal);
    const requestedReward = Math.max(0, input.rewardPoints || 0);
    const awardedPoints = Math.min(requestedReward, remainingDailyReward);
    const balanceAfter = currentPoints + awardedPoints;
    const transaction = addTransaction(pointsData, {
      id: createOperationId('tx_minigame'),
      userId: input.user.userId,
      type: awardedPoints > 0 ? 'earn' : 'adjust',
      amount: awardedPoints,
      balanceAfter,
      reason: input.reason || `미니게임 보상: ${input.gameTitle || input.gameId}`,
      relatedType: MINIGAME_REWARD_RELATED_TYPE,
      relatedId,
      createdBy: input.user.userId,
      note: input.note || null,
    });

    updateUserBalance(user, balanceAfter, input.user.displayName);
    saveState({ ...state, pointsData });
    appendPointTransactionLog(transaction, {
      user,
      sourceSurface: 'minigame_hub',
      playDate,
      gameId: input.gameId,
    });

    return {
      ok: true,
      user,
      transaction,
      playDate,
      relatedId,
      requestedReward,
      awardedPoints,
      dailyRewardTotal,
      remainingDailyReward,
      dailyRewardCap: MINIGAME_DAILY_REWARD_CAP,
    };
  }

  function requestRedemption(input) {
    const state = loadState();
    const pointsData = cloneJson(state.pointsData);
    const shopItemsData = cloneJson(state.shopItemsData);
    const redemptionsData = cloneJson(state.redemptionsData);
    const resolvedItem = resolveActiveShopItem(input.itemId);
    const redemptionItemId = resolvedItem ? resolvedItem.id : input.itemId;
    const eligibility = canRedeem(pointsData, shopItemsData, input.user.userId, redemptionItemId);

    if (!eligibility.ok) {
      return { ok: false, reason: eligibility.reason };
    }

    const item = getShopItem(shopItemsData, redemptionItemId);
    const user = getUser(pointsData, input.user.userId);
    const currentPoints = getUserPoints(pointsData, input.user.userId);
    const balanceAfter = currentPoints - item.cost;
    const redemptionId = createOperationId('rd');
    const transaction = addTransaction(pointsData, {
      id: createOperationId('tx_redeem'),
      userId: input.user.userId,
      type: 'redeem',
      amount: -item.cost,
      balanceAfter,
      reason: `${item.name} 신청 차감`,
      relatedType: 'redemption',
      relatedId: redemptionId,
      createdBy: input.user.userId,
      note: input.note || null,
    });
    const redemption = createRedemption({
      id: redemptionId,
      userId: input.user.userId,
      itemId: item.id,
      cost: item.cost,
      transactionId: transaction.id,
      note: input.note || null,
    });

    updateUserBalance(user, balanceAfter, input.user.displayName);

    if (typeof item.stock === 'number') {
      item.stock = Math.max(0, item.stock - 1);
      item.updatedAt = createTimestamp();
      if (item.stock === 0) {
        item.status = 'soldOut';
      }
    }

    redemptionsData.redemptions = Array.isArray(redemptionsData.redemptions)
      ? redemptionsData.redemptions
      : [];
    redemptionsData.redemptions.push(redemption);
    saveState({ pointsData, shopItemsData, redemptionsData });
    appendPointTransactionLog(transaction, {
      user,
      sourceSurface: 'slash_command',
    });

    return {
      ok: true,
      user,
      item: {
        ...item,
        displayCode: resolvedItem ? resolvedItem.displayCode : undefined,
      },
      transaction,
      redemption,
    };
  }

  function findRedemption(redemptionsData, redemptionId) {
    const redemptions = Array.isArray(redemptionsData.redemptions) ? redemptionsData.redemptions : [];
    const index = redemptions.findIndex((redemption) => redemption.id === redemptionId);

    if (index === -1) {
      return { redemption: null, index: -1 };
    }

    return { redemption: redemptions[index], index };
  }

  function reviewRedemption(input) {
    const state = loadState();
    const pointsData = cloneJson(state.pointsData);
    const redemptionsData = cloneJson(state.redemptionsData);
    const { redemption, index } = findRedemption(redemptionsData, input.redemptionId);

    if (!redemption) {
      throw new Error('교환 신청을 찾을 수 없습니다.');
    }

    let nextRedemption;
    let refundTransaction = null;

    if (input.action === 'complete') {
      nextRedemption = completeRedemption(redemption, input.operatorId);
    } else if (input.action === 'cancel') {
      nextRedemption = cancelRedemption(redemption, input.operatorId, input.note || '운영자 취소');
    } else if (input.action === 'refund') {
      if (redemption.status !== 'cancelled') {
        throw new Error('cancelled 상태의 교환 신청만 환불 처리할 수 있습니다.');
      }

      const user = getUser(pointsData, redemption.userId);
      if (!user) {
        throw new Error('환불 대상 사용자를 찾을 수 없습니다.');
      }

      const currentPoints = getUserPoints(pointsData, redemption.userId);
      const balanceAfter = currentPoints + redemption.cost;
      refundTransaction = addTransaction(pointsData, {
        id: createOperationId('tx_refund'),
        userId: redemption.userId,
        type: 'refund',
        amount: redemption.cost,
        balanceAfter,
        reason: input.note || '교환 취소에 따른 포인트 반환',
        relatedType: 'redemption',
        relatedId: redemption.id,
        createdBy: input.operatorId,
        note: input.note || null,
      });
      updateUserBalance(user, balanceAfter);
      nextRedemption = refundRedemption(redemption, refundTransaction.id);
    } else {
      throw new Error('지원하지 않는 교환 관리 작업입니다.');
    }

    redemptionsData.redemptions[index] = nextRedemption;
    saveState({ ...state, pointsData, redemptionsData });
    if (refundTransaction) {
      appendPointTransactionLog(refundTransaction, {
        user: getUser(pointsData, refundTransaction.userId),
        sourceSurface: 'operator_command',
      });
    }

    return { redemption: nextRedemption, refundTransaction };
  }

  function listTransactions(options = {}) {
    const state = loadState();
    return listPointTransactions(state.pointsData, options.userId, {
      type: options.type,
      latestFirst: true,
    }).slice(0, options.limit || 10);
  }

  function listOperationalTransactions(options = {}) {
    const state = loadState();
    const transactions = listPointTransactions(state.pointsData, options.userId, {
      type: options.type,
      latestFirst: true,
    });
    return getOperationalRecords(transactions).slice(0, options.limit || 10);
  }

  function listActiveMissions() {
    const missionsData = getMissionsData();
    const missions = Array.isArray(missionsData.missions) ? missionsData.missions : [];
    return attachDisplayCodes(
      missions.filter((mission) => mission.status === 'active'),
      MISSION_DISPLAY_PREFIX
    );
  }

  function resolveActiveMission(missionIdOrCode) {
    return findByIdOrDisplayCode(listActiveMissions(), missionIdOrCode);
  }

  function listMissionsForAdmin(options = {}) {
    const missionsData = getMissionsData();
    const missions = Array.isArray(missionsData.missions) ? missionsData.missions : [];
    const sorted = sortNewestFirst(missions, ['updatedAt', 'createdAt', 'activeDate', 'startAt']);
    return sorted.slice(0, options.limit || 10);
  }

  function findMission(missionId) {
    const missionsData = getMissionsData();
    const missions = Array.isArray(missionsData.missions) ? missionsData.missions : [];
    return missions.find((mission) => mission.id === missionId) || null;
  }

  function createMission(input) {
    const title = requireTrimmedString(input.title, '제목');
    const description = requireTrimmedString(input.description, '설명');
    requirePositiveInteger(input.rewardPoints, '포인트');

    const missionsData = cloneJson(getMissionsData());
    missionsData.missions = Array.isArray(missionsData.missions) ? missionsData.missions : [];

    const id = input.id && input.id.trim() ? input.id.trim() : createOperationId('mission');
    if (missionsData.missions.some((mission) => mission.id === id)) {
      throw new Error('이미 같은 미션 ID가 있습니다.');
    }

    const now = createTimestamp();
    const mission = {
      id,
      title,
      description,
      rewardPoints: input.rewardPoints,
      activeDate: input.activeDate || getKoreanDateString(),
      startAt: null,
      endAt: null,
      status: input.status || 'draft',
      requiresSubmission: input.requiresSubmission !== false,
      maxPerUser: 1,
      createdAt: now,
      updatedAt: now,
      note: input.note || null,
    };

    if (!MISSION_STATUSES.has(mission.status)) {
      throw new Error('지원하지 않는 미션 상태입니다.');
    }

    missionsData.missions.push(mission);
    saveMissionsData(missionsData);
    return mission;
  }

  function updateMission(missionId, updates) {
    requireTrimmedString(missionId, '미션id');
    const missionsData = cloneJson(getMissionsData());
    const missions = Array.isArray(missionsData.missions) ? missionsData.missions : [];
    const index = missions.findIndex((mission) => mission.id === missionId);

    if (index === -1) {
      throw new Error('미션을 찾을 수 없습니다.');
    }

    const nextUpdates = {};
    if (updates.title !== undefined && updates.title !== null) {
      nextUpdates.title = requireTrimmedString(updates.title, '제목');
    }
    if (updates.description !== undefined && updates.description !== null) {
      nextUpdates.description = requireTrimmedString(updates.description, '설명');
    }
    if (updates.rewardPoints !== undefined && updates.rewardPoints !== null) {
      requirePositiveInteger(updates.rewardPoints, '포인트');
      nextUpdates.rewardPoints = updates.rewardPoints;
    }
    if (updates.requiresSubmission !== undefined && updates.requiresSubmission !== null) {
      nextUpdates.requiresSubmission = Boolean(updates.requiresSubmission);
    }
    if (updates.activeDate !== undefined && updates.activeDate !== null) {
      nextUpdates.activeDate = updates.activeDate;
    }
    if (updates.note !== undefined) {
      nextUpdates.note = updates.note || null;
    }
    if (updates.status !== undefined && updates.status !== null) {
      if (!MISSION_STATUSES.has(updates.status)) {
        throw new Error('지원하지 않는 미션 상태입니다.');
      }
      nextUpdates.status = updates.status;
    }

    const mission = {
      ...missions[index],
      ...nextUpdates,
      updatedAt: createTimestamp(),
    };
    missions[index] = mission;
    missionsData.missions = missions;
    saveMissionsData(missionsData);
    return mission;
  }

  function setMissionStatus(missionId, status) {
    if (!MISSION_STATUSES.has(status)) {
      throw new Error('지원하지 않는 미션 상태입니다.');
    }

    return updateMission(missionId, { status });
  }

  function findShopItem(itemId) {
    const { shopItemsData } = loadState();
    return getShopItem(shopItemsData, itemId);
  }

  function listActiveShopItemsWithCodes() {
    const { shopItemsData } = loadState();
    const shopItems = Array.isArray(shopItemsData.shopItems) ? shopItemsData.shopItems : [];
    return attachDisplayCodes(
      shopItems.filter((item) => item.status === 'active'),
      SHOP_DISPLAY_PREFIX
    );
  }

  function resolveActiveShopItem(itemIdOrCode) {
    return findByIdOrDisplayCode(listActiveShopItemsWithCodes(), itemIdOrCode);
  }

  function listShopItemsForAdmin(options = {}) {
    const { shopItemsData } = loadState();
    const shopItems = Array.isArray(shopItemsData.shopItems) ? shopItemsData.shopItems : [];
    const sorted = sortNewestFirst(shopItems, ['updatedAt', 'createdAt']);
    return sorted.slice(0, options.limit || 10);
  }

  function createShopItem(input) {
    const name = requireTrimmedString(input.name, '이름');
    const description = requireTrimmedString(input.description, '설명');
    requirePositiveInteger(input.cost, '비용');

    if (!SHOP_ITEM_TYPES.has(input.type)) {
      throw new Error('지원하지 않는 상점 항목 유형입니다.');
    }

    if (input.stock !== null && input.stock !== undefined) {
      requireNonNegativeInteger(input.stock, '재고');
    }

    if (input.monthlyLimit !== null && input.monthlyLimit !== undefined) {
      requireNonNegativeInteger(input.monthlyLimit, '월한도');
    }

    const state = loadState();
    const shopItemsData = cloneJson(state.shopItemsData);
    shopItemsData.shopItems = Array.isArray(shopItemsData.shopItems) ? shopItemsData.shopItems : [];

    const id = input.id && input.id.trim() ? input.id.trim() : createOperationId('item');
    if (shopItemsData.shopItems.some((item) => item.id === id)) {
      throw new Error('이미 같은 상점 항목 ID가 있습니다.');
    }

    const now = createTimestamp();
    const item = {
      id,
      name,
      description,
      cost: input.cost,
      stock: input.stock ?? null,
      monthlyLimit: input.monthlyLimit ?? null,
      status: input.status || 'paused',
      type: input.type,
      createdAt: now,
      updatedAt: now,
      note: input.note || null,
    };

    if (!SHOP_ITEM_STATUSES.has(item.status)) {
      throw new Error('지원하지 않는 상점 항목 상태입니다.');
    }

    shopItemsData.shopItems.push(item);
    saveState({ ...state, shopItemsData });
    return item;
  }

  function updateShopItem(itemId, updates) {
    requireTrimmedString(itemId, '항목id');
    const state = loadState();
    const shopItemsData = cloneJson(state.shopItemsData);
    const shopItems = Array.isArray(shopItemsData.shopItems) ? shopItemsData.shopItems : [];
    const index = shopItems.findIndex((item) => item.id === itemId);

    if (index === -1) {
      throw new Error('상점 항목을 찾을 수 없습니다.');
    }

    const nextUpdates = {};
    if (updates.name !== undefined && updates.name !== null) {
      nextUpdates.name = requireTrimmedString(updates.name, '이름');
    }
    if (updates.description !== undefined && updates.description !== null) {
      nextUpdates.description = requireTrimmedString(updates.description, '설명');
    }
    if (updates.cost !== undefined && updates.cost !== null) {
      requirePositiveInteger(updates.cost, '비용');
      nextUpdates.cost = updates.cost;
    }
    if (updates.stock !== undefined) {
      if (updates.stock !== null) {
        requireNonNegativeInteger(updates.stock, '재고');
      }
      nextUpdates.stock = updates.stock;
    }
    if (updates.monthlyLimit !== undefined) {
      if (updates.monthlyLimit !== null) {
        requireNonNegativeInteger(updates.monthlyLimit, '월한도');
      }
      nextUpdates.monthlyLimit = updates.monthlyLimit;
    }
    if (updates.type !== undefined && updates.type !== null) {
      if (!SHOP_ITEM_TYPES.has(updates.type)) {
        throw new Error('지원하지 않는 상점 항목 유형입니다.');
      }
      nextUpdates.type = updates.type;
    }
    if (updates.note !== undefined) {
      nextUpdates.note = updates.note || null;
    }
    if (updates.status !== undefined && updates.status !== null) {
      if (!SHOP_ITEM_STATUSES.has(updates.status)) {
        throw new Error('지원하지 않는 상점 항목 상태입니다.');
      }
      nextUpdates.status = updates.status;
    }

    const item = {
      ...shopItems[index],
      ...nextUpdates,
      updatedAt: createTimestamp(),
    };
    shopItems[index] = item;
    shopItemsData.shopItems = shopItems;
    saveState({ ...state, shopItemsData });
    return item;
  }

  function setShopItemStatus(itemId, status) {
    if (!SHOP_ITEM_STATUSES.has(status)) {
      throw new Error('지원하지 않는 상점 항목 상태입니다.');
    }

    return updateShopItem(itemId, { status });
  }

  function hasCheckedInToday(userId, dateString = getKoreanDateString()) {
    const submissionsData = getSubmissionsData();
    const submissions = Array.isArray(submissionsData.submissions) ? submissionsData.submissions : [];
    return submissions.some((submission) => {
      return submission.type === 'checkin'
        && submission.userId === userId
        && submission.checkinDate === dateString
        && submission.status === 'approved';
    });
  }

  function createCheckin(input) {
    const checkinDate = input.checkinDate || getKoreanDateString();

    if (hasCheckedInToday(input.user.userId, checkinDate)) {
      return { ok: false, reason: 'ALREADY_CHECKED_IN', checkinDate };
    }

    const state = loadState();
    const pointsData = cloneJson(state.pointsData);
    const submissionsData = cloneJson(getSubmissionsData());
    const user = ensureUser(pointsData, input.user);
    const currentPoints = getUserPoints(pointsData, input.user.userId);
    const balanceAfter = currentPoints + CHECKIN_REWARD_POINTS;
    const checkinId = createOperationId('checkin');
    const transaction = addTransaction(pointsData, {
      id: createOperationId('tx_checkin'),
      userId: input.user.userId,
      type: 'earn',
      amount: CHECKIN_REWARD_POINTS,
      balanceAfter,
      reason: '오늘의 체크인',
      relatedType: 'checkin',
      relatedId: checkinId,
      createdBy: input.user.userId,
      note: input.content || null,
    });
    const now = createTimestamp();
    const checkin = {
      id: checkinId,
      type: 'checkin',
      missionId: null,
      userId: input.user.userId,
      displayName: input.user.displayName || input.user.userId,
      content: input.content || null,
      checkinDate,
      status: 'approved',
      reviewedBy: 'system',
      createdAt: now,
      reviewedAt: now,
      rewardTransactionId: transaction.id,
      note: '일일 체크인 자동 지급',
    };

    updateUserBalance(user, balanceAfter, input.user.displayName);
    submissionsData.submissions = Array.isArray(submissionsData.submissions)
      ? submissionsData.submissions
      : [];
    submissionsData.submissions.push(checkin);
    saveState({ ...state, pointsData });
    saveSubmissionsData(submissionsData);
    appendPointTransactionLog(transaction, {
      user,
      sourceSurface: 'slash_command',
    });

    return { ok: true, user, transaction, checkin, checkinDate };
  }

  function findSubmission(submissionId) {
    const submissionsData = getSubmissionsData();
    const submissions = Array.isArray(submissionsData.submissions) ? submissionsData.submissions : [];
    return submissions.find((submission) => submission.id === submissionId) || null;
  }

  function hasOpenMissionSubmission(userId, missionId) {
    const submissionsData = getSubmissionsData();
    const submissions = Array.isArray(submissionsData.submissions) ? submissionsData.submissions : [];
    return submissions.some((submission) => {
      return submission.type !== 'checkin'
        && submission.userId === userId
        && submission.missionId === missionId
        && ['pending', 'approved'].includes(submission.status);
    });
  }

  function createMissionSubmission(input) {
    const activeMission = resolveActiveMission(input.missionId);
    const mission = activeMission || findMission(input.missionId);

    if (!mission) {
      return { ok: false, reason: 'MISSION_NOT_FOUND' };
    }

    if (mission.status !== 'active') {
      return { ok: false, reason: 'MISSION_NOT_ACTIVE', mission };
    }

    if (hasOpenMissionSubmission(input.user.userId, mission.id)) {
      return { ok: false, reason: 'DUPLICATE_SUBMISSION', mission };
    }

    const submissionsData = cloneJson(getSubmissionsData());
    const submission = {
      id: createOperationId('submission'),
      type: 'mission',
      missionId: mission.id,
      userId: input.user.userId,
      displayName: input.user.displayName || input.user.userId,
      content: input.content,
      attachment: input.attachment || null,
      status: 'pending',
      reviewedBy: null,
      createdAt: createTimestamp(),
      reviewedAt: null,
      rewardTransactionId: null,
      note: null,
    };

    submissionsData.submissions = Array.isArray(submissionsData.submissions)
      ? submissionsData.submissions
      : [];
    submissionsData.submissions.push(submission);
    saveSubmissionsData(submissionsData);
    appendMissionSubmissionLog(submission, {
      mission,
      sourceSurface: 'slash_command',
    });

    return { ok: true, mission, submission };
  }

  function createTodayMissionSubmission(input) {
    requireTrimmedString(input.user && input.user.userId, 'userId');
    requirePositiveInteger(input.rewardPoints, 'rewardPoints');

    const now = createTimestamp();
    const submissionsData = cloneJson(getSubmissionsData());
    const content = typeof input.content === 'string' ? input.content : '';
    const attachmentCount = Number.isInteger(input.attachmentCount) && input.attachmentCount > 0
      ? input.attachmentCount
      : 0;
    const todayMissionDate = input.todayMissionDate || getKoreanDateString();
    const submission = {
      id: createOperationId('today_submission'),
      type: 'todayMission',
      missionId: null,
      missionTitle: '오늘의 미션',
      userId: input.user.userId,
      displayName: input.user.displayName || input.user.userId,
      content,
      contentSummary: content.trim().slice(0, 500),
      attachment: null,
      attachmentCount,
      attachmentUrls: Array.isArray(input.attachmentUrls) ? input.attachmentUrls.filter(Boolean) : [],
      status: 'pending',
      reviewedBy: null,
      createdAt: now,
      reviewedAt: null,
      rewardTransactionId: null,
      note: null,
      rewardPoints: input.rewardPoints,
      todayMissionDate,
      source: 'todayMissionChannel',
      messageId: input.messageId || null,
      channelId: input.channelId || null,
      guildId: input.guildId || null,
      messageUrl: input.messageUrl || null,
      duplicateRewardBlocked: false,
    };
    const mission = {
      id: 'today_mission',
      title: '오늘의 미션',
      rewardPoints: input.rewardPoints,
      status: 'active',
    };

    submissionsData.submissions = Array.isArray(submissionsData.submissions)
      ? submissionsData.submissions
      : [];
    submissionsData.submissions.push(submission);
    saveSubmissionsData(submissionsData);
    appendMissionSubmissionLog(submission, {
      mission,
      sourceSurface: 'today_mission_channel',
      discordMessageUrl: submission.messageUrl,
    });

    return { ok: true, mission, submission };
  }

  function hasPaidTodayMissionReward(userId, todayMissionDate, ignoredSubmissionId = null) {
    const submissionsData = getSubmissionsData();
    const submissions = Array.isArray(submissionsData.submissions) ? submissionsData.submissions : [];

    return submissions.some((submission) => {
      return submission.id !== ignoredSubmissionId
        && submission.type === 'todayMission'
        && submission.userId === userId
        && submission.todayMissionDate === todayMissionDate
        && submission.status === 'approved'
        && Boolean(submission.rewardTransactionId)
        && submission.duplicateRewardBlocked !== true;
    });
  }

  function getSubmissionMission(submission) {
    if (!submission) {
      return null;
    }

    if (submission.type === 'todayMission') {
      return {
        id: 'today_mission',
        title: submission.missionTitle || '오늘의 미션',
        rewardPoints: typeof submission.rewardPoints === 'number' ? submission.rewardPoints : 0,
        status: 'active',
      };
    }

    return findMission(submission.missionId);
  }

  function reviewSubmissionById(submissionId, action, reviewer, note) {
    const state = loadState();
    const pointsData = cloneJson(state.pointsData);
    const submissionsData = cloneJson(getSubmissionsData());
    const submissions = Array.isArray(submissionsData.submissions) ? submissionsData.submissions : [];
    const index = submissions.findIndex((submission) => submission.id === submissionId);

    if (index === -1) {
      throw new Error('인증 제출을 찾을 수 없습니다.');
    }

    const submission = submissions[index];

    if (submission.status !== 'pending') {
      throw new Error('이미 처리된 인증 제출입니다.');
    }

    if (action === 'reject') {
      const rejectedSubmission = {
        ...submission,
        status: 'rejected',
        reviewedBy: reviewer.userId,
        reviewedAt: createTimestamp(),
        note: note || null,
      };
      submissions[index] = rejectedSubmission;
      submissionsData.submissions = submissions;
      saveSubmissionsData(submissionsData);
      appendMissionReviewLog(rejectedSubmission, {
        action: 'reject',
        reviewer,
        transaction: null,
        discordMessageUrl: rejectedSubmission.messageUrl || '',
      });
      return { submission: rejectedSubmission, transaction: null, mission: getSubmissionMission(submission) };
    }

    if (action !== 'approve') {
      throw new Error('지원하지 않는 인증 관리 작업입니다.');
    }

    const mission = getSubmissionMission(submission);

    if (!mission) {
      throw new Error('연결된 미션을 찾을 수 없습니다.');
    }

    const rewardPoints = typeof mission.rewardPoints === 'number' ? mission.rewardPoints : 0;

    if (submission.type === 'todayMission'
      && hasPaidTodayMissionReward(submission.userId, submission.todayMissionDate, submission.id)) {
      const duplicateBlockedSubmission = {
        ...submission,
        status: 'approved',
        reviewedBy: reviewer.userId,
        reviewedAt: createTimestamp(),
        rewardTransactionId: null,
        duplicateRewardBlocked: true,
        note: note || '이미 오늘의 미션 포인트 지급 완료',
      };

      submissions[index] = duplicateBlockedSubmission;
      submissionsData.submissions = submissions;
      saveSubmissionsData(submissionsData);

      appendMissionReviewLog(duplicateBlockedSubmission, {
        action: 'duplicate_reward_blocked',
        reviewer,
        transaction: null,
        discordMessageUrl: duplicateBlockedSubmission.messageUrl || '',
      });

      return { submission: duplicateBlockedSubmission, transaction: null, mission };
    }

    const user = ensureUser(pointsData, {
      userId: submission.userId,
      displayName: submission.displayName || submission.userId,
    });
    const currentPoints = getUserPoints(pointsData, submission.userId);
    const balanceAfter = currentPoints + rewardPoints;
    const transaction = addTransaction(pointsData, {
      id: createOperationId('tx_mission'),
      userId: submission.userId,
      type: 'earn',
      amount: rewardPoints,
      balanceAfter,
      reason: submission.type === 'todayMission'
        ? `오늘의 미션 인증 승인: ${submission.todayMissionDate || getKoreanDateString()}`
        : `미션 인증 승인: ${mission.title || mission.id}`,
      relatedType: submission.type === 'todayMission' ? 'todayMissionSubmission' : 'missionSubmission',
      relatedId: submission.id,
      createdBy: reviewer.userId,
      note: note || null,
    });
    const approvedSubmission = {
      ...submission,
      status: 'approved',
      reviewedBy: reviewer.userId,
      reviewedAt: createTimestamp(),
      rewardTransactionId: transaction.id,
      duplicateRewardBlocked: false,
      note: note || null,
    };

    updateUserBalance(user, balanceAfter, submission.displayName);
    submissions[index] = approvedSubmission;
    submissionsData.submissions = submissions;
    saveState({ ...state, pointsData });
    saveSubmissionsData(submissionsData);
    appendPointTransactionLog(transaction, {
      user,
      sourceSurface: submission.type === 'todayMission' ? 'today_mission_channel' : 'operator_command',
      discordMessageUrl: submission.messageUrl || '',
    });
    appendMissionReviewLog(approvedSubmission, {
      action: 'approve',
      reviewer,
      transaction,
      discordMessageUrl: approvedSubmission.messageUrl || '',
    });

    return { submission: approvedSubmission, transaction, mission };
  }

  function approveSubmissionById(submissionId, reviewer, note) {
    return reviewSubmissionById(submissionId, 'approve', reviewer, note);
  }

  function rejectSubmissionById(submissionId, reviewer, note) {
    return reviewSubmissionById(submissionId, 'reject', reviewer, note);
  }

  function findReactionApprovalByMessageId(messageId) {
    const data = getReactionApprovalData();
    const records = Array.isArray(data.records) ? data.records : [];
    return records.find((record) => record.messageId === messageId) || null;
  }

  function hasReactionMessageBeenReviewed(messageId) {
    return Boolean(findReactionApprovalByMessageId(messageId));
  }

  function createReactionApprovalRecord(input) {
    const now = createTimestamp();
    return {
      id: input.id || createOperationId('reaction_approval'),
      messageId: input.messageId,
      channelId: input.channelId,
      guildId: input.guildId,
      authorId: input.authorId,
      authorDisplayName: input.authorDisplayName || input.authorId,
      status: input.status,
      rewardPoints: input.rewardPoints || 0,
      transactionId: input.transactionId || null,
      reviewedBy: input.reviewedBy,
      reviewedByDisplayName: input.reviewedByDisplayName || input.reviewedBy,
      reviewEmoji: input.reviewEmoji,
      messageUrl: input.messageUrl || null,
      createdAt: input.createdAt || now,
      reviewedAt: input.reviewedAt || now,
    };
  }

  function approveReactionMessage(input) {
    if (hasReactionMessageBeenReviewed(input.messageId)) {
      return {
        ok: false,
        reason: 'ALREADY_REVIEWED',
        record: findReactionApprovalByMessageId(input.messageId),
        transaction: null,
      };
    }

    const rewardPoints = input.rewardPoints;
    requireNonNegativeInteger(rewardPoints, 'rewardPoints');

    const state = loadState();
    const pointsData = cloneJson(state.pointsData);
    const approvalsData = cloneJson(getReactionApprovalData());
    const user = ensureUser(pointsData, {
      userId: input.authorId,
      displayName: input.authorDisplayName || input.authorId,
    });
    const currentPoints = getUserPoints(pointsData, input.authorId);
    const balanceAfter = currentPoints + rewardPoints;
    const transaction = addTransaction(pointsData, {
      id: createOperationId('tx_reaction'),
      userId: input.authorId,
      type: 'earn',
      amount: rewardPoints,
      balanceAfter,
      reason: '미션 인증 채널 반응 승인',
      relatedType: 'missionReactionApproval',
      relatedId: input.messageId,
      createdBy: input.reviewedBy,
      note: [
        input.messageUrl ? `messageUrl=${input.messageUrl}` : null,
        input.reviewEmoji ? `emoji=${input.reviewEmoji}` : null,
      ].filter(Boolean).join(' ') || null,
    });
    const record = createReactionApprovalRecord({
      ...input,
      status: 'approved',
      transactionId: transaction.id,
    });

    updateUserBalance(user, balanceAfter, input.authorDisplayName);
    approvalsData.records = Array.isArray(approvalsData.records) ? approvalsData.records : [];
    approvalsData.records.push(record);
    saveState({ ...state, pointsData });
    saveReactionApprovalData(approvalsData);
    appendPointTransactionLog(transaction, {
      user,
      sourceSurface: 'reaction_approval',
      discordMessageUrl: input.messageUrl || '',
    });

    return { ok: true, record, transaction };
  }

  function rejectReactionMessage(input) {
    if (hasReactionMessageBeenReviewed(input.messageId)) {
      return {
        ok: false,
        reason: 'ALREADY_REVIEWED',
        record: findReactionApprovalByMessageId(input.messageId),
        transaction: null,
      };
    }

    const approvalsData = cloneJson(getReactionApprovalData());
    const record = createReactionApprovalRecord({
      ...input,
      status: 'rejected',
      rewardPoints: 0,
      transactionId: null,
    });

    approvalsData.records = Array.isArray(approvalsData.records) ? approvalsData.records : [];
    approvalsData.records.push(record);
    saveReactionApprovalData(approvalsData);

    return { ok: true, record, transaction: null };
  }

  function listRecentReactionApprovals(limit = 10) {
    const data = getReactionApprovalData();
    const records = Array.isArray(data.records) ? data.records : [];
    return sortNewestFirst(records, ['reviewedAt', 'createdAt']).slice(0, limit);
  }

  function listRecentSubmissions(limit = 10) {
    const submissionsData = getSubmissionsData();
    const submissions = Array.isArray(submissionsData.submissions) ? submissionsData.submissions : [];
    return submissions.slice().sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }).slice(0, limit);
  }

  function listPendingSubmissions(limit = 10) {
    return getOperationalRecords(listRecentSubmissions(1000))
      .filter((submission) => submission.status === 'pending')
      .filter((submission) => submission.type !== 'checkin')
      .map((submission) => {
        const mission = findMission(submission.missionId);
        return {
          ...submission,
          missionTitle: mission ? mission.title : null,
          rewardPoints: mission ? mission.rewardPoints : submission.rewardPoints,
        };
      })
      .slice(0, limit);
  }

  function listPendingRedemptions(limit = 10) {
    const { redemptionsData } = loadState();
    const redemptions = Array.isArray(redemptionsData.redemptions) ? redemptionsData.redemptions : [];
    return getOperationalRecords(sortNewestFirst(redemptions, ['requestedAt', 'createdAt']))
      .filter((redemption) => redemption.status === 'pending')
      .map((redemption) => {
        const item = findShopItem(redemption.itemId);
        return {
          ...redemption,
          itemName: item ? item.name : null,
        };
      })
      .slice(0, limit);
  }

  function listTodayCheckins(dateString = getKoreanDateString()) {
    const submissionsData = getSubmissionsData();
    const submissions = Array.isArray(submissionsData.submissions) ? submissionsData.submissions : [];
    return submissions.filter((submission) => {
      return submission.type === 'checkin'
        && submission.checkinDate === dateString
        && submission.status === 'approved';
    });
  }

  function listRecentActivityLogs(limit = 10) {
    return listOperationalTransactions({ limit });
  }

  function getOperationSummary() {
    const state = loadState();
    const users = getOperationalRecords(state.pointsData.users);
    const pointTransactions = getOperationalRecords(state.pointsData.pointTransactions);
    const redemptions = getOperationalRecords(state.redemptionsData.redemptions);
    const submissions = getOperationalRecords(state.submissionsData.submissions);
    const missionSubmissions = submissions.filter((submission) => submission.type !== 'checkin');
    const missions = getOperationalRecords(state.missionsData.missions);
    const reactionApprovalsData = getReactionApprovalData();
    const reactionApprovals = getOperationalRecords(reactionApprovalsData.records);
    const activeShopItems = Array.isArray(state.shopItemsData.shopItems)
      ? getOperationalRecords(state.shopItemsData.shopItems).filter((item) => item.status === 'active')
      : [];
    const today = getKoreanDateString();
    const isToday = (value) => {
      if (!value) {
        return false;
      }

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return false;
      }

      return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) === today;
    };
    const countByStatus = (items) => items.reduce((counts, item) => {
      const status = item && item.status ? item.status : 'unknown';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});

    return {
      usersCount: users.length,
      pointTransactionsCount: pointTransactions.length,
      pendingRedemptionsCount: listPendingRedemptions(1000).length,
      pendingSubmissionsCount: listPendingSubmissions(1000).length,
      reviewedSubmissionsCount: missionSubmissions.filter((submission) => {
        return submission.status === 'approved' || submission.status === 'rejected';
      }).length,
      reactionApprovalsCount: listRecentReactionApprovals(1000).length,
      todayReactionApprovalsCount: reactionApprovals.filter((record) => isToday(record.reviewedAt || record.createdAt)).length,
      activeMissionsCount: listActiveMissions().length,
      activeShopItemsCount: activeShopItems.length,
      todayCheckinsCount: listTodayCheckins().length,
      todayPointTransactionsCount: pointTransactions.filter((transaction) => isToday(transaction.createdAt)).length,
      submissionStatusCounts: countByStatus(missionSubmissions),
      missionStatusCounts: countByStatus(missions),
      shopItemStatusCounts: countByStatus(getOperationalRecords(state.shopItemsData.shopItems)),
      recentTransactions: listOperationalTransactions({ limit: 5 }),
      recentMissions: getOperationalRecords(listMissionsForAdmin({ limit: 1000 })).slice(0, 5),
      recentShopItems: getOperationalRecords(listShopItemsForAdmin({ limit: 1000 })).slice(0, 5),
      recentRedemptions: sortNewestFirst(
        redemptions,
        ['requestedAt', 'createdAt']
      ).slice(0, 5),
      recentSubmissions: sortNewestFirst(submissions, ['createdAt', 'reviewedAt']).slice(0, 5),
      recentReactionApprovals: listRecentReactionApprovals(5),
    };
  }

  function buildExportSummary(state) {
    const users = Array.isArray(state.pointsData.users) ? state.pointsData.users : [];
    const pointTransactions = Array.isArray(state.pointsData.pointTransactions)
      ? state.pointsData.pointTransactions
      : [];
    const redemptions = Array.isArray(state.redemptionsData.redemptions) ? state.redemptionsData.redemptions : [];
    const submissions = Array.isArray(state.submissionsData.submissions) ? state.submissionsData.submissions : [];
    const missions = Array.isArray(state.missionsData.missions) ? state.missionsData.missions : [];
    const shopItems = Array.isArray(state.shopItemsData.shopItems) ? state.shopItemsData.shopItems : [];
    const reactionApprovalsData = getReactionApprovalData();
    const reactionApprovals = Array.isArray(reactionApprovalsData.records) ? reactionApprovalsData.records : [];

    return {
      usersCount: users.length,
      pointTransactionsCount: pointTransactions.length,
      redemptionsCount: redemptions.length,
      pendingRedemptionsCount: redemptions.filter((redemption) => redemption.status === 'pending').length,
      submissionsCount: submissions.length,
      pendingSubmissionsCount: submissions.filter((submission) => submission.status === 'pending').length,
      reactionApprovalsCount: reactionApprovals.length,
      approvedReactionApprovalsCount: reactionApprovals.filter((record) => record.status === 'approved').length,
      rejectedReactionApprovalsCount: reactionApprovals.filter((record) => record.status === 'rejected').length,
      missionsCount: missions.length,
      activeMissionsCount: missions.filter((mission) => mission.status === 'active').length,
      shopItemsCount: shopItems.length,
      activeShopItemsCount: shopItems.filter((item) => item.status === 'active').length,
      todayCheckinsCount: submissions.filter((submission) => {
        return submission.type === 'checkin'
          && submission.checkinDate === getKoreanDateString()
          && submission.status === 'approved';
      }).length,
    };
  }

  function getPointsExportData(limit = 50) {
    const state = loadExportState();
    const pointTransactions = sortNewestFirst(
      Array.isArray(state.pointsData.pointTransactions) ? state.pointsData.pointTransactions : [],
      ['createdAt']
    );

    return {
      kind: 'points',
      summary: buildExportSummary(state),
      users: Array.isArray(state.pointsData.users) ? cloneJson(state.pointsData.users) : [],
      pointTransactions: cloneJson(limitItems(pointTransactions, limit)),
    };
  }

  function getRedemptionsExportData(limit = 50) {
    const state = loadExportState();
    const redemptions = sortNewestFirst(
      Array.isArray(state.redemptionsData.redemptions) ? state.redemptionsData.redemptions : [],
      ['requestedAt', 'createdAt', 'completedAt', 'cancelledAt', 'refundedAt']
    );

    return {
      kind: 'redemptions',
      summary: buildExportSummary(state),
      redemptions: cloneJson(limitItems(redemptions, limit)),
    };
  }

  function getSubmissionsExportData(limit = 50) {
    const state = loadExportState();
    const submissions = sortNewestFirst(
      Array.isArray(state.submissionsData.submissions) ? state.submissionsData.submissions : [],
      ['createdAt', 'reviewedAt']
    );

    return {
      kind: 'submissions',
      summary: buildExportSummary(state),
      submissions: cloneJson(limitItems(submissions, limit)),
    };
  }

  function getMissionsExportData(limit = 50) {
    const state = loadExportState();
    const missions = sortNewestFirst(
      Array.isArray(state.missionsData.missions) ? state.missionsData.missions : [],
      ['updatedAt', 'createdAt', 'activeDate', 'startAt']
    );

    return {
      kind: 'missions',
      summary: buildExportSummary(state),
      missions: cloneJson(limitItems(missions, limit)),
    };
  }

  function getShopItemsExportData(limit = 50) {
    const state = loadExportState();
    const shopItems = sortNewestFirst(
      Array.isArray(state.shopItemsData.shopItems) ? state.shopItemsData.shopItems : [],
      ['updatedAt', 'createdAt']
    );

    return {
      kind: 'shopItems',
      summary: buildExportSummary(state),
      shopItems: cloneJson(limitItems(shopItems, limit)),
    };
  }

  function getSummaryExportData() {
    const state = loadExportState();
    return {
      kind: 'summary',
      summary: buildExportSummary(state),
    };
  }

  function getAllOperationData(limit = 50) {
    const state = loadExportState();

    return {
      kind: 'all',
      summary: buildExportSummary(state),
      points: {
        users: Array.isArray(state.pointsData.users) ? cloneJson(state.pointsData.users) : [],
        pointTransactions: getPointsExportData(limit).pointTransactions,
      },
      redemptions: {
        redemptions: getRedemptionsExportData(limit).redemptions,
      },
      submissions: {
        submissions: getSubmissionsExportData(limit).submissions,
      },
      reactionApprovals: {
        records: listRecentReactionApprovals(limit),
      },
      missions: {
        missions: getMissionsExportData(limit).missions,
      },
      shopItems: {
        shopItems: getShopItemsExportData(limit).shopItems,
      },
    };
  }

  function getExportData(kind = 'summary', limit = 50) {
    if (kind === 'all') return getAllOperationData(limit);
    if (kind === 'points') return getPointsExportData(limit);
    if (kind === 'redemptions') return getRedemptionsExportData(limit);
    if (kind === 'submissions') return getSubmissionsExportData(limit);
    if (kind === 'missions') return getMissionsExportData(limit);
    if (kind === 'shopItems') return getShopItemsExportData(limit);
    return getSummaryExportData();
  }

  return {
    adjustUserPoints,
    awardMinigameReward,
    approveSubmissionById,
    approveReactionMessage,
    createCheckin,
    createMission,
    createMissionSubmission,
    createTodayMissionSubmission,
    createShopItem,
    findMission,
    findShopItem,
    findReactionApprovalByMessageId,
    findSubmission,
    getAllOperationData,
    getExportData,
    getMissionsData,
    getMissionsExportData,
    getOperationSummary,
    getPointsExportData,
    getRedemptionsExportData,
    getShopItemsExportData,
    getSubmissionsExportData,
    getSummaryExportData,
    getSubmissionsData,
    getReactionApprovalData,
    hasCheckedInToday,
    hasPaidTodayMissionReward,
    hasReactionMessageBeenReviewed,
    listMissionsForAdmin,
    listOperationalTransactions,
    listTransactions,
    listActiveMissions,
    listActiveShopItemsWithCodes,
    listPendingRedemptions,
    listPendingSubmissions,
    listRecentSubmissions,
    listRecentActivityLogs,
    listRecentReactionApprovals,
    listShopItemsForAdmin,
    listTodayCheckins,
    loadState,
    requestRedemption,
    rejectSubmissionById,
    rejectReactionMessage,
    reviewSubmissionById,
    reviewRedemption,
    resolveActiveMission,
    resolveActiveShopItem,
    saveMissionsData,
    saveSubmissionsData,
    saveReactionApprovalData,
    saveState,
    setMissionStatus,
    setShopItemStatus,
    updateMission,
    updateShopItem,
  };
}

module.exports = {
  CHECKIN_REWARD_POINTS,
  DEFAULT_PATHS,
  MINIGAME_DAILY_REWARD_CAP,
  MINIGAME_REWARD_RELATED_TYPE,
  createPointsRepository,
  getKoreanDateString,
};

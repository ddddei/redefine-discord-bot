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
const { MINIGAMES } = require('./minigameData');
const { getOperationDataPaths } = require('./operationDataPaths');
const { saveJsonFilesGroup } = require('./jsonStorage');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OPERATION_PATHS = getOperationDataPaths();

const DEFAULT_PATHS = {
  points: OPERATION_PATHS.points,
  pointsFallback: path.join(DATA_DIR, 'points.example.json'),
  shopItems: OPERATION_PATHS.shopItems,
  shopItemsFallback: path.join(DATA_DIR, 'shop-items.example.json'),
  redemptions: OPERATION_PATHS.redemptions,
  redemptionsFallback: path.join(DATA_DIR, 'redemptions.example.json'),
  missions: OPERATION_PATHS.missions,
  missionsFallback: path.join(DATA_DIR, 'missions.example.json'),
  missionTemplates: OPERATION_PATHS.missionTemplates,
  missionTemplatesFallback: path.join(DATA_DIR, 'mission-templates.example.json'),
  submissions: OPERATION_PATHS.submissions,
  submissionsFallback: path.join(DATA_DIR, 'submissions.example.json'),
  reactionApprovals: OPERATION_PATHS.reactionApprovals,
  operatorSupport: OPERATION_PATHS.operatorSupport,
};

const CHECKIN_REWARD_POINTS = 10;
const MINIGAME_DAILY_PLAY_LIMIT = 4;
const MINIGAME_DAILY_REWARD_CAP = 40;
const MINIGAME_REWARD_RELATED_TYPE = 'minigameReward';
const MINIGAME_RANKING_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
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

function getMinigamePlayDate(transaction) {
  const relatedDate = String(transaction.relatedId || '').split(':')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(relatedDate)) {
    return relatedDate;
  }

  if (!transaction.createdAt) {
    return '';
  }

  const createdAt = new Date(transaction.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return '';
  }

  return getKoreanDateString(createdAt);
}

function buildRecentKoreanDateStrings(now, days) {
  return Array.from({ length: days }, (unused, index) => {
    return getKoreanDateString(new Date(now.getTime() - index * DAY_MS));
  });
}

function getKoreanWeekday(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return weekdays[kstDate.getUTCDay()];
}

function createInitialPointsData() {
  return { isExample: false, description: 'Local points data. JSON storage is for MVP operation only.', users: [], pointTransactions: [] };
}

function createInitialShopItemsData() {
  return { isExample: false, description: 'Local shop item data. JSON storage is for MVP operation only.', shopItems: [] };
}

function createInitialRedemptionsData() {
  return { isExample: false, description: 'Local redemption data. JSON storage is for MVP operation only.', redemptions: [] };
}

function loadOrCreateOperationalData(primaryPath, createInitial) {
  if (fs.existsSync(primaryPath)) return loadJsonFile(primaryPath);
  const initial = createInitial();
  saveJsonFile(primaryPath, initial);
  return initial;
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

function createInitialActivityData(_fallbackPath, collectionName) {
  return {
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

function createInitialOperatorSupportData() {
  return {
    version: 1,
    isExample: false,
    description: 'Local read-only operator support signals. JSON storage is for MVP operation only.',
    commandFirstUse: [],
    missionSubmissionGuidance: [],
    faqCandidates: [],
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
  if (!paths.operatorSupport && paths.submissions) {
    resolvedPaths.operatorSupport = path.join(path.dirname(paths.submissions), 'operator-support.local.json');
  }

  function loadState() {
    return {
      pointsData: loadOrCreateOperationalData(resolvedPaths.points, createInitialPointsData),
      shopItemsData: loadOrCreateOperationalData(resolvedPaths.shopItems, createInitialShopItemsData),
      redemptionsData: loadOrCreateOperationalData(resolvedPaths.redemptions, createInitialRedemptionsData),
      missionsData: loadActivityWithFallback(resolvedPaths.missions, resolvedPaths.missionsFallback, 'missions'),
      submissionsData: loadActivityWithFallback(resolvedPaths.submissions, resolvedPaths.submissionsFallback, 'submissions'),
    };
  }

  function loadExportState() {
    return {
      pointsData: loadOrCreateOperationalData(resolvedPaths.points, createInitialPointsData),
      shopItemsData: loadOrCreateOperationalData(resolvedPaths.shopItems, createInitialShopItemsData),
      redemptionsData: loadOrCreateOperationalData(resolvedPaths.redemptions, createInitialRedemptionsData),
      missionsData: loadActivityWithFallback(resolvedPaths.missions, resolvedPaths.missionsFallback, 'missions'),
      submissionsData: loadActivityWithFallback(resolvedPaths.submissions, resolvedPaths.submissionsFallback, 'submissions'),
    };
  }

  function getMissionsData() {
    return loadActivityWithFallback(resolvedPaths.missions, resolvedPaths.missionsFallback, 'missions');
  }

  function saveMissionsData(missionsData) {
    saveJsonFile(resolvedPaths.missions, missionsData);
  }

  function getMissionTemplatesData() {
    const data = loadOptionalWithFallback(
      resolvedPaths.missionTemplates,
      resolvedPaths.missionTemplatesFallback,
      'missionTemplates'
    );

    return {
      ...data,
      isExample: data.isExample === true,
      missionTemplates: Array.isArray(data.missionTemplates) ? data.missionTemplates : [],
      weekdayRecommendations: Array.isArray(data.weekdayRecommendations) ? data.weekdayRecommendations : [],
    };
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

  function getOperatorSupportData() {
    if (fs.existsSync(resolvedPaths.operatorSupport)) {
      const data = loadJsonFile(resolvedPaths.operatorSupport);
      return {
        ...createInitialOperatorSupportData(),
        ...data,
        isExample: data.isExample === true,
        commandFirstUse: Array.isArray(data.commandFirstUse) ? data.commandFirstUse : [],
        missionSubmissionGuidance: Array.isArray(data.missionSubmissionGuidance) ? data.missionSubmissionGuidance : [],
        faqCandidates: Array.isArray(data.faqCandidates) ? data.faqCandidates : [],
      };
    }

    const initialData = createInitialOperatorSupportData();
    saveJsonFile(resolvedPaths.operatorSupport, initialData);
    return initialData;
  }

  function saveOperatorSupportData(operatorSupportData) {
    saveJsonFile(resolvedPaths.operatorSupport, {
      ...createInitialOperatorSupportData(),
      ...operatorSupportData,
      isExample: false,
      commandFirstUse: Array.isArray(operatorSupportData.commandFirstUse) ? operatorSupportData.commandFirstUse : [],
      missionSubmissionGuidance: Array.isArray(operatorSupportData.missionSubmissionGuidance) ? operatorSupportData.missionSubmissionGuidance : [],
      faqCandidates: Array.isArray(operatorSupportData.faqCandidates) ? operatorSupportData.faqCandidates : [],
    });
  }

  function saveState(state) {
    saveJsonFilesGroup([
      { filePath: resolvedPaths.points, data: { ...state.pointsData, isExample: false } },
      { filePath: resolvedPaths.shopItems, data: { ...state.shopItemsData, isExample: false } },
      { filePath: resolvedPaths.redemptions, data: { ...state.redemptionsData, isExample: false } },
    ]);
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

  function getMinigameGameIdFromRelatedId(relatedId) {
    const parts = String(relatedId || '').split(':');
    return parts.length >= 2 ? parts.slice(1).join(':') : '';
  }

  function getMinigameGameTitle(transaction) {
    const gameId = getMinigameGameIdFromRelatedId(transaction.relatedId);
    if (MINIGAMES[gameId]) {
      return MINIGAMES[gameId].title;
    }

    const reason = String(transaction.reason || '');
    return reason.replace(/^미니게임 보상:\s*/, '').trim() || gameId || '미니게임';
  }

  function listMinigameTransactionsByDate(pointsData, dateString) {
    const transactions = Array.isArray(pointsData.pointTransactions)
      ? pointsData.pointTransactions
      : [];
    return getOperationalRecords(transactions).filter((transaction) => {
      return transaction.relatedType === MINIGAME_REWARD_RELATED_TYPE
        && getMinigamePlayDate(transaction) === dateString;
    });
  }

  function listUserMinigameTransactions(pointsData, userId, dateString) {
    return listMinigameTransactionsByDate(pointsData, dateString).filter((transaction) => {
      return transaction.userId === userId;
    });
  }

  function createMinigameTransactionView(transaction) {
    return {
      id: transaction.id,
      userId: transaction.userId,
      amount: Math.max(0, transaction.amount || 0),
      gameId: getMinigameGameIdFromRelatedId(transaction.relatedId),
      gameTitle: getMinigameGameTitle(transaction),
      reason: transaction.reason,
      note: transaction.note || null,
      createdAt: transaction.createdAt,
    };
  }

  function getTodayMinigameRecord(userId, dateString = getKoreanDateString()) {
    const state = loadState();
    const dailyTransactions = listUserMinigameTransactions(state.pointsData, userId, dateString)
      .map(createMinigameTransactionView)
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
    const earnedPoints = dailyTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const playedGames = dailyTransactions.map((transaction) => transaction.gameTitle);

    return {
      dateString,
      playCount: dailyTransactions.length,
      playLimit: MINIGAME_DAILY_PLAY_LIMIT,
      earnedPoints,
      rewardCap: MINIGAME_DAILY_REWARD_CAP,
      remainingPlays: Math.max(0, MINIGAME_DAILY_PLAY_LIMIT - dailyTransactions.length),
      remainingRewardPoints: Math.max(0, MINIGAME_DAILY_REWARD_CAP - earnedPoints),
      playedGames,
      recentResult: dailyTransactions[0] || null,
      transactions: dailyTransactions,
    };
  }

  function buildMinigameRanking(transactions, usersById, limit) {
    const rankingByUserId = new Map();

    transactions.forEach((transaction) => {
      const current = rankingByUserId.get(transaction.userId) || {
        userId: transaction.userId,
        displayName: usersById.get(transaction.userId)?.displayName || transaction.userId,
        earnedPoints: 0,
        playCount: 0,
      };
      current.earnedPoints += Math.max(0, transaction.amount || 0);
      current.playCount += 1;
      rankingByUserId.set(transaction.userId, current);
    });

    return Array.from(rankingByUserId.values())
      .filter((entry) => entry.earnedPoints > 0)
      .sort((left, right) => {
        if (right.earnedPoints !== left.earnedPoints) {
          return right.earnedPoints - left.earnedPoints;
        }

        if (right.playCount !== left.playCount) {
          return right.playCount - left.playCount;
        }

        return left.displayName.localeCompare(right.displayName, 'ko');
      })
      .slice(0, Math.max(1, limit));
  }

  function getMinigameRankingContext() {
    const state = loadState();
    const users = Array.isArray(state.pointsData.users) ? state.pointsData.users : [];
    const usersById = new Map(users.map((user) => [user.userId, user]));
    const transactions = Array.isArray(state.pointsData.pointTransactions)
      ? getOperationalRecords(state.pointsData.pointTransactions)
      : [];
    const minigameTransactions = transactions.filter((transaction) => {
      return transaction.relatedType === MINIGAME_REWARD_RELATED_TYPE;
    });

    return { usersById, minigameTransactions };
  }

  function listTodayMinigameRanking(dateString = getKoreanDateString(), limit = 5) {
    const { usersById, minigameTransactions } = getMinigameRankingContext();
    const todayTransactions = minigameTransactions.filter((transaction) => {
      return getMinigamePlayDate(transaction) === dateString;
    });

    return buildMinigameRanking(todayTransactions, usersById, limit);
  }

  function listMinigameRankings({ now = new Date(), limit = 5 } = {}) {
    const { usersById, minigameTransactions } = getMinigameRankingContext();
    const todayString = getKoreanDateString(now);
    const recentDateSet = new Set(buildRecentKoreanDateStrings(now, MINIGAME_RANKING_WINDOW_DAYS));
    const todayTransactions = [];
    const recentTransactions = [];

    minigameTransactions.forEach((transaction) => {
      const playDate = getMinigamePlayDate(transaction);
      if (playDate === todayString) {
        todayTransactions.push(transaction);
      }
      if (recentDateSet.has(playDate)) {
        recentTransactions.push(transaction);
      }
    });

    return {
      today: buildMinigameRanking(todayTransactions, usersById, limit),
      recent7Days: buildMinigameRanking(recentTransactions, usersById, limit),
      total: buildMinigameRanking(minigameTransactions, usersById, limit),
      generatedDateKst: todayString,
    };
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
      const dailyTransactions = listUserMinigameTransactions(pointsData, input.user.userId, playDate);
      const dailyRewardTotal = dailyTransactions
        .reduce((sum, transaction) => sum + Math.max(0, transaction.amount || 0), 0);
      return {
        ok: false,
        reason: 'ALREADY_REWARDED',
        playDate,
        relatedId,
        transaction: existingTransaction,
        dailyPlayCount: dailyTransactions.length,
        dailyPlayLimit: MINIGAME_DAILY_PLAY_LIMIT,
        dailyRewardTotal,
        remainingDailyReward: Math.max(0, MINIGAME_DAILY_REWARD_CAP - dailyRewardTotal),
        remainingDailyRewardAfterAward: Math.max(0, MINIGAME_DAILY_REWARD_CAP - dailyRewardTotal),
        dailyRewardCap: MINIGAME_DAILY_REWARD_CAP,
      };
    }

    const dailyTransactions = listUserMinigameTransactions(pointsData, input.user.userId, playDate);
    const dailyRewardTotal = dailyTransactions
      .reduce((sum, transaction) => sum + Math.max(0, transaction.amount || 0), 0);

    if (dailyTransactions.length >= MINIGAME_DAILY_PLAY_LIMIT) {
      return {
        ok: false,
        reason: 'DAILY_PLAY_LIMIT_REACHED',
        playDate,
        relatedId,
        dailyPlayCount: dailyTransactions.length,
        dailyPlayLimit: MINIGAME_DAILY_PLAY_LIMIT,
        dailyRewardTotal,
        remainingDailyReward: Math.max(0, MINIGAME_DAILY_REWARD_CAP - dailyRewardTotal),
        remainingDailyRewardAfterAward: Math.max(0, MINIGAME_DAILY_REWARD_CAP - dailyRewardTotal),
        dailyRewardCap: MINIGAME_DAILY_REWARD_CAP,
      };
    }

    const user = ensureUser(pointsData, input.user);
    const currentPoints = getUserPoints(pointsData, input.user.userId);
    const remainingDailyReward = Math.max(0, MINIGAME_DAILY_REWARD_CAP - dailyRewardTotal);
    const requestedReward = Math.max(0, input.rewardPoints || 0);
    const awardedPoints = Math.min(requestedReward, remainingDailyReward);
    const remainingDailyRewardAfterAward = Math.max(0, remainingDailyReward - awardedPoints);
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
      remainingDailyRewardAfterAward,
      dailyPlayCount: dailyTransactions.length,
      dailyPlayCountAfterAward: dailyTransactions.length + 1,
      dailyPlayLimit: MINIGAME_DAILY_PLAY_LIMIT,
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
    const reviewedAt = createTimestamp();
    const reviewNote = input.note ? String(input.note).trim() : '';
    const reviewEntry = {
      action: input.action,
      operatorId: input.operatorId,
      note: reviewNote || null,
      reviewedAt,
    };

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

    nextRedemption = {
      ...nextRedemption,
      reviewedAt,
      reviewNote: reviewNote || nextRedemption.note || null,
      reviewHistory: [
        ...(Array.isArray(redemption.reviewHistory) ? redemption.reviewHistory : []),
        reviewEntry,
      ],
    };
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

  function listMinigameRewardTransactions() {
    const state = loadState();
    const transactions = Array.isArray(state.pointsData.pointTransactions)
      ? state.pointsData.pointTransactions
      : [];
    return getOperationalRecords(transactions)
      .filter((transaction) => transaction.relatedType === MINIGAME_REWARD_RELATED_TYPE);
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

  function normalizeMissionTemplate(template) {
    const rewardPoints = Number.isInteger(template.rewardPoints)
      ? template.rewardPoints
      : template.defaultRewardPoints;

    return {
      id: String(template.id || '').trim(),
      title: template.title || '제목 없음',
      description: template.description || '설명 없음',
      rewardPoints,
      requiresSubmission: template.requiresSubmission !== false,
      category: template.category || template.type || 'daily',
      type: template.type || template.category || 'daily',
      recommendedDay: template.recommendedDay || template.weekday || null,
      weekday: template.weekday || template.recommendedDay || null,
      status: template.status || 'draft',
      note: template.note || template.operatorNote || null,
    };
  }

  function listMissionTemplates(options = {}) {
    const data = getMissionTemplatesData();
    const templates = data.missionTemplates
      .map(normalizeMissionTemplate)
      .filter((template) => template.id && template.status !== 'archived')
      .map((template) => ({
        ...template,
        isExample: data.isExample === true,
      }));
    return templates.slice(0, options.limit || 25);
  }

  function listWeekdayMissionRecommendations() {
    const data = getMissionTemplatesData();
    const templatesById = new Map(listMissionTemplates({ limit: 200 })
      .map((template) => [template.id, template]));
    return data.weekdayRecommendations.map((recommendation) => {
      const template = templatesById.get(recommendation.templateId) || null;
      return {
        weekday: recommendation.weekday,
        label: recommendation.label || recommendation.weekday,
        templateId: recommendation.templateId,
        title: recommendation.title || (template ? template.title : '추천 미션 없음'),
        note: recommendation.note || (template ? template.note : null),
        template,
      };
    });
  }

  function getTodayMissionRecommendation(date = new Date()) {
    const weekday = getKoreanWeekday(date);
    return listWeekdayMissionRecommendations()
      .find((recommendation) => recommendation.weekday === weekday) || null;
  }

  function findMissionTemplate(templateId) {
    return listMissionTemplates({ limit: 200 })
      .find((template) => template.id === templateId) || null;
  }

  function findMission(missionId) {
    const missionsData = getMissionsData();
    const missions = Array.isArray(missionsData.missions) ? missionsData.missions : [];
    return missions.find((mission) => mission.id === missionId) || null;
  }

  function findTodayActiveMission(dateString = getKoreanDateString()) {
    const missionsData = getMissionsData();
    const missions = Array.isArray(missionsData.missions) ? missionsData.missions : [];
    const candidates = missions.filter((mission) => {
      return mission.status === 'active' && mission.activeDate === dateString;
    });
    return sortNewestFirst(candidates, ['updatedAt', 'createdAt', 'activeDate', 'startAt'])[0] || null;
  }

  function getTodayMissionNoticeRecords() {
    const missionsData = getMissionsData();
    return Array.isArray(missionsData.todayMissionNotices) ? missionsData.todayMissionNotices : [];
  }

  function findTodayMissionNotice(dateString = getKoreanDateString()) {
    return getTodayMissionNoticeRecords()
      .find((record) => record.date === dateString && ['publishing', 'published'].includes(record.status)) || null;
  }

  function hasTodayMissionNoticeBeenPublished(dateString = getKoreanDateString()) {
    return Boolean(findTodayMissionNotice(dateString));
  }

  function reserveTodayMissionNoticePublication(input) {
    requireTrimmedString(input && input.missionId, 'missionId');
    requireTrimmedString(input && input.channelId, 'channelId');

    const missionsData = cloneJson(getMissionsData());
    missionsData.todayMissionNotices = Array.isArray(missionsData.todayMissionNotices)
      ? missionsData.todayMissionNotices
      : [];

    const dateString = input.date || getKoreanDateString();
    const existingNotice = missionsData.todayMissionNotices
      .find((record) => record.date === dateString && ['publishing', 'published'].includes(record.status));
    if (existingNotice) {
      return { ok: false, reason: 'ALREADY_RESERVED', record: existingNotice };
    }

    const record = {
      id: createOperationId('today_notice'),
      date: dateString,
      missionId: input.missionId,
      missionTitle: input.missionTitle || null,
      channelId: input.channelId,
      messageId: null,
      messageUrl: null,
      status: 'publishing',
      publishedBy: input.publishedBy || null,
      reservedAt: createTimestamp(),
      publishedAt: null,
      failedAt: null,
      failureReason: null,
    };
    missionsData.todayMissionNotices.push(record);
    saveMissionsData(missionsData);
    return { ok: true, record };
  }

  function updateTodayMissionNoticeRecord(recordId, updates) {
    requireTrimmedString(recordId, 'recordId');
    const missionsData = cloneJson(getMissionsData());
    const records = Array.isArray(missionsData.todayMissionNotices) ? missionsData.todayMissionNotices : [];
    const index = records.findIndex((record) => record.id === recordId);

    if (index === -1) {
      throw new Error('오늘의 미션 게시 기록을 찾을 수 없습니다.');
    }

    const record = {
      ...records[index],
      ...updates,
    };
    records[index] = record;
    missionsData.todayMissionNotices = records;
    saveMissionsData(missionsData);
    return record;
  }

  function completeTodayMissionNoticePublication(recordId, input = {}) {
    return updateTodayMissionNoticeRecord(recordId, {
      messageId: input.messageId || null,
      messageUrl: input.messageUrl || null,
      status: 'published',
      publishedAt: createTimestamp(),
      failedAt: null,
      failureReason: null,
    });
  }

  function failTodayMissionNoticePublication(recordId, reason) {
    return updateTodayMissionNoticeRecord(recordId, {
      status: 'failed',
      failedAt: createTimestamp(),
      failureReason: reason || 'send_failed',
    });
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

    if (input.category) mission.category = input.category;
    if (input.type) mission.type = input.type;
    if (input.sourceTemplateId) mission.sourceTemplateId = input.sourceTemplateId;
    if (input.sourceTemplateTitle) mission.sourceTemplateTitle = input.sourceTemplateTitle;
    if (input.recommendedDay) mission.recommendedDay = input.recommendedDay;

    if (!MISSION_STATUSES.has(mission.status)) {
      throw new Error('지원하지 않는 미션 상태입니다.');
    }

    missionsData.missions.push(mission);
    saveMissionsData(missionsData);
    return mission;
  }

  function createMissionFromTemplateForToday(templateId, options = {}) {
    const template = findMissionTemplate(templateId);
    if (!template) {
      return { ok: false, reason: 'TEMPLATE_NOT_FOUND' };
    }

    const activeDate = options.activeDate || getKoreanDateString();
    const missionsData = getMissionsData();
    const missions = Array.isArray(missionsData.missions) ? missionsData.missions : [];
    const existingActiveMission = missions.find((mission) => {
      return mission.status === 'active' && mission.activeDate === activeDate;
    });

    if (existingActiveMission) {
      return {
        ok: false,
        reason: 'TODAY_MISSION_EXISTS',
        mission: existingActiveMission,
        template,
      };
    }

    const mission = createMission({
      title: template.title,
      description: template.description,
      rewardPoints: template.rewardPoints,
      requiresSubmission: template.requiresSubmission,
      activeDate,
      status: 'active',
      note: template.note,
      category: template.category,
      type: template.type,
      sourceTemplateId: template.id,
      sourceTemplateTitle: template.title,
      recommendedDay: template.recommendedDay,
    });

    return { ok: true, mission, template };
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

  function isDuplicateMissionRewardGuardHealthy(dateString = getKoreanDateString()) {
    const submissionsData = getSubmissionsData();
    const submissions = Array.isArray(submissionsData.submissions) ? submissionsData.submissions : [];

    const paidByUser = new Map();
    for (const submission of submissions) {
      if (submission.type !== 'todayMission'
        || submission.todayMissionDate !== dateString
        || submission.status !== 'approved'
        || !submission.rewardTransactionId
        || submission.duplicateRewardBlocked === true) {
        continue;
      }

      const previousCount = paidByUser.get(submission.userId) || 0;
      if (previousCount >= 1) {
        return false;
      }
      paidByUser.set(submission.userId, previousCount + 1);
    }

    return true;
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
      notificationSettings: input.notificationSettings || null,
      notificationResults: input.notificationResults || null,
      createdAt: input.createdAt || now,
      reviewedAt: input.reviewedAt || now,
    };
  }

  function updateReactionApprovalNotifications(recordId, notificationSettings, notificationResults) {
    const approvalsData = cloneJson(getReactionApprovalData());
    const records = Array.isArray(approvalsData.records) ? approvalsData.records : [];
    const index = records.findIndex((record) => record.id === recordId);

    if (index === -1) {
      return null;
    }

    const updatedRecord = {
      ...records[index],
      notificationSettings: notificationSettings || null,
      notificationResults: notificationResults || null,
    };

    records[index] = updatedRecord;
    approvalsData.records = records;
    saveReactionApprovalData(approvalsData);
    return updatedRecord;
  }

  function createSupportRecordId(prefix) {
    return createOperationId(prefix);
  }

  function normalizeQuestionKey(question) {
    return String(question || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, 160);
  }

  function recordParticipantCommandFirstUse(input = {}) {
    const userId = requireTrimmedString(input.userId, 'userId');
    const commandName = requireTrimmedString(input.commandName, 'commandName');
    const supportData = cloneJson(getOperatorSupportData());
    const records = Array.isArray(supportData.commandFirstUse) ? supportData.commandFirstUse : [];
    const existing = records.find((record) => record.userId === userId && record.commandName === commandName);

    if (existing) {
      return { recorded: false, record: existing };
    }

    const record = {
      id: createSupportRecordId('cmd_first_use'),
      userId,
      commandName,
      firstUsedAt: input.usedAt || createTimestamp(),
    };

    supportData.commandFirstUse = [...records, record];
    saveOperatorSupportData(supportData);
    return { recorded: true, record };
  }

  function hasSentMissionSubmissionGuidance(userId, channelId) {
    const supportData = getOperatorSupportData();
    const records = Array.isArray(supportData.missionSubmissionGuidance)
      ? supportData.missionSubmissionGuidance
      : [];

    return records.some((record) => record.userId === userId && record.channelId === channelId);
  }

  function recordMissionSubmissionGuidance(input = {}) {
    const userId = requireTrimmedString(input.userId, 'userId');
    const channelId = requireTrimmedString(input.channelId, 'channelId');
    const supportData = cloneJson(getOperatorSupportData());
    const records = Array.isArray(supportData.missionSubmissionGuidance)
      ? supportData.missionSubmissionGuidance
      : [];
    const existing = records.find((record) => record.userId === userId && record.channelId === channelId);

    if (existing) {
      return { recorded: false, record: existing };
    }

    const record = {
      id: createSupportRecordId('mission_guidance'),
      userId,
      channelId,
      messageId: input.messageId || null,
      guidedAt: input.guidedAt || createTimestamp(),
    };

    supportData.missionSubmissionGuidance = [...records, record];
    saveOperatorSupportData(supportData);
    return { recorded: true, record };
  }

  function recordFaqFallbackCandidate(input = {}) {
    const question = requireTrimmedString(input.question, 'question');
    const questionKey = normalizeQuestionKey(question);
    const supportData = cloneJson(getOperatorSupportData());
    const candidates = Array.isArray(supportData.faqCandidates) ? supportData.faqCandidates : [];
    const now = input.seenAt || createTimestamp();
    const index = candidates.findIndex((candidate) => candidate.questionKey === questionKey);

    if (index !== -1) {
      const current = candidates[index];
      const updated = {
        ...current,
        count: Number(current.count || 0) + 1,
        lastSeenAt: now,
        latestQuestion: question.slice(0, 300),
      };
      candidates[index] = updated;
      supportData.faqCandidates = candidates;
      saveOperatorSupportData(supportData);
      return updated;
    }

    const candidate = {
      id: createSupportRecordId('faq_candidate'),
      questionKey,
      sampleQuestion: question.slice(0, 300),
      latestQuestion: question.slice(0, 300),
      count: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      source: input.source || '/질문 fallback',
    };

    supportData.faqCandidates = [...candidates, candidate];
    saveOperatorSupportData(supportData);
    return candidate;
  }

  function getOperatorSupportSummary(limit = 10) {
    const supportData = getOperatorSupportData();
    const commandRecords = getOperationalRecords(supportData.commandFirstUse);
    const guidanceRecords = getOperationalRecords(supportData.missionSubmissionGuidance);
    const faqCandidates = getOperationalRecords(supportData.faqCandidates);
    const trackedCommands = ['안내', '포인트', '미션', '상점'];
    const commandsByUser = commandRecords.reduce((map, record) => {
      map[record.userId] = map[record.userId] || new Set();
      map[record.userId].add(record.commandName);
      return map;
    }, {});
    const helpSignals = Object.entries(commandsByUser).map(([userId, commandSet]) => {
      const usedCommands = trackedCommands.filter((commandName) => commandSet.has(commandName));
      const missingCommands = trackedCommands.filter((commandName) => !commandSet.has(commandName));
      const firstUsedAtValues = commandRecords
        .filter((record) => record.userId === userId)
        .map((record) => record.firstUsedAt)
        .filter(Boolean)
        .sort();

      return {
        userId,
        usedCommands,
        missingCommands,
        usedCount: usedCommands.length,
        firstSeenAt: firstUsedAtValues[0] || null,
        lastSeenAt: firstUsedAtValues[firstUsedAtValues.length - 1] || null,
      };
    }).sort((left, right) => {
      return left.usedCount - right.usedCount
        || new Date(right.lastSeenAt || 0).getTime() - new Date(left.lastSeenAt || 0).getTime();
    });
    const commandCounts = trackedCommands.reduce((counts, commandName) => {
      counts[commandName] = commandRecords.filter((record) => record.commandName === commandName).length;
      return counts;
    }, {});

    return {
      readOnly: true,
      storageMode: 'local-json',
      generatedAt: createTimestamp(),
      trackedCommands,
      commandCounts,
      trackedUsersCount: Object.keys(commandsByUser).length,
      guidanceSentCount: guidanceRecords.length,
      helpSignals: cloneJson(limitItems(helpSignals, limit)),
      faqCandidates: cloneJson(sortNewestFirst(faqCandidates, ['lastSeenAt', 'firstSeenAt']).slice(0, limit)),
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
    return sortNewestFirst(getOperationalRecords(records), ['reviewedAt', 'createdAt']).slice(0, limit);
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
    createMissionFromTemplateForToday,
    createMissionSubmission,
    createTodayMissionSubmission,
    createShopItem,
    completeTodayMissionNoticePublication,
    failTodayMissionNoticePublication,
    findMission,
    findTodayActiveMission,
    findTodayMissionNotice,
    findShopItem,
    findReactionApprovalByMessageId,
    findSubmission,
    getAllOperationData,
    getExportData,
    getMissionsData,
    getMissionsExportData,
    getMissionTemplatesData,
    getOperationSummary,
    getOperatorSupportData,
    getOperatorSupportSummary,
    getPointsExportData,
    getRedemptionsExportData,
    getTodayMinigameRecord,
    getShopItemsExportData,
    getSubmissionsExportData,
    getSummaryExportData,
    getSubmissionsData,
    getTodayMissionRecommendation,
    getReactionApprovalData,
    hasCheckedInToday,
    hasPaidTodayMissionReward,
    hasSentMissionSubmissionGuidance,
    isDuplicateMissionRewardGuardHealthy,
    hasReactionMessageBeenReviewed,
    hasTodayMissionNoticeBeenPublished,
    listMissionsForAdmin,
    listMissionTemplates,
    listMinigameRankings,
    listMinigameRewardTransactions,
    listOperationalTransactions,
    listTodayMinigameRanking,
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
    listWeekdayMissionRecommendations,
    loadState,
    recordFaqFallbackCandidate,
    recordMissionSubmissionGuidance,
    recordParticipantCommandFirstUse,
    requestRedemption,
    rejectSubmissionById,
    rejectReactionMessage,
    reserveTodayMissionNoticePublication,
    reviewSubmissionById,
    reviewRedemption,
    resolveActiveMission,
    resolveActiveShopItem,
    updateReactionApprovalNotifications,
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
  MINIGAME_DAILY_PLAY_LIMIT,
  MINIGAME_DAILY_REWARD_CAP,
  MINIGAME_REWARD_RELATED_TYPE,
  createPointsRepository,
  createInitialPointsData,
  createInitialRedemptionsData,
  createInitialShopItemsData,
  getKoreanDateString,
  getKoreanWeekday,
  getMinigamePlayDate,
};

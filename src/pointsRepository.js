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
};

const CHECKIN_REWARD_POINTS = 10;
const MISSION_STATUSES = new Set(['draft', 'active', 'paused', 'closed', 'archived']);
const SHOP_ITEM_STATUSES = new Set(['active', 'paused', 'soldOut', 'hidden']);
const SHOP_ITEM_TYPES = new Set(['youthCenterPoint', 'reward', 'goods', 'event']);

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

function createPointsRepository(paths = {}) {
  const resolvedPaths = {
    ...DEFAULT_PATHS,
    ...paths,
  };

  function loadState() {
    return {
      pointsData: loadWithFallback(resolvedPaths.points, resolvedPaths.pointsFallback),
      shopItemsData: loadWithFallback(resolvedPaths.shopItems, resolvedPaths.shopItemsFallback),
      redemptionsData: loadWithFallback(resolvedPaths.redemptions, resolvedPaths.redemptionsFallback),
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

    return { user, transaction };
  }

  function requestRedemption(input) {
    const state = loadState();
    const pointsData = cloneJson(state.pointsData);
    const shopItemsData = cloneJson(state.shopItemsData);
    const redemptionsData = cloneJson(state.redemptionsData);
    const eligibility = canRedeem(pointsData, shopItemsData, input.user.userId, input.itemId);

    if (!eligibility.ok) {
      return { ok: false, reason: eligibility.reason };
    }

    const item = getShopItem(shopItemsData, input.itemId);
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

    return { ok: true, user, item, transaction, redemption };
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

    return { redemption: nextRedemption, refundTransaction };
  }

  function listTransactions(options = {}) {
    const state = loadState();
    return listPointTransactions(state.pointsData, options.userId, {
      type: options.type,
      latestFirst: true,
    }).slice(0, options.limit || 10);
  }

  function listActiveMissions() {
    const missionsData = getMissionsData();
    const missions = Array.isArray(missionsData.missions) ? missionsData.missions : [];
    return missions.filter((mission) => mission.status === 'active');
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
    const mission = findMission(input.missionId);

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

    return { ok: true, mission, submission };
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
      return { submission: rejectedSubmission, transaction: null, mission: findMission(submission.missionId) };
    }

    if (action !== 'approve') {
      throw new Error('지원하지 않는 인증 관리 작업입니다.');
    }

    const mission = findMission(submission.missionId);

    if (!mission) {
      throw new Error('연결된 미션을 찾을 수 없습니다.');
    }

    const rewardPoints = typeof mission.rewardPoints === 'number' ? mission.rewardPoints : 0;
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
      reason: `미션 인증 승인: ${mission.title || mission.id}`,
      relatedType: 'missionSubmission',
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
      note: note || null,
    };

    updateUserBalance(user, balanceAfter, submission.displayName);
    submissions[index] = approvedSubmission;
    submissionsData.submissions = submissions;
    saveState({ ...state, pointsData });
    saveSubmissionsData(submissionsData);

    return { submission: approvedSubmission, transaction, mission };
  }

  function approveSubmissionById(submissionId, reviewer, note) {
    return reviewSubmissionById(submissionId, 'approve', reviewer, note);
  }

  function rejectSubmissionById(submissionId, reviewer, note) {
    return reviewSubmissionById(submissionId, 'reject', reviewer, note);
  }

  function listRecentSubmissions(limit = 10) {
    const submissionsData = getSubmissionsData();
    const submissions = Array.isArray(submissionsData.submissions) ? submissionsData.submissions : [];
    return submissions.slice().sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }).slice(0, limit);
  }

  function listPendingSubmissions(limit = 10) {
    return listRecentSubmissions(1000)
      .filter((submission) => submission.status === 'pending')
      .slice(0, limit);
  }

  function listPendingRedemptions(limit = 10) {
    const { redemptionsData } = loadState();
    const redemptions = Array.isArray(redemptionsData.redemptions) ? redemptionsData.redemptions : [];
    return sortNewestFirst(redemptions, ['requestedAt', 'createdAt'])
      .filter((redemption) => redemption.status === 'pending')
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
    return listTransactions({ limit });
  }

  function getOperationSummary() {
    const state = loadState();
    const activeShopItems = Array.isArray(state.shopItemsData.shopItems)
      ? state.shopItemsData.shopItems.filter((item) => item.status === 'active')
      : [];

    return {
      pendingRedemptionsCount: listPendingRedemptions(1000).length,
      pendingSubmissionsCount: listPendingSubmissions(1000).length,
      activeMissionsCount: listActiveMissions().length,
      activeShopItemsCount: activeShopItems.length,
      todayCheckinsCount: listTodayCheckins().length,
      recentTransactions: listTransactions({ limit: 5 }),
      recentRedemptions: sortNewestFirst(
        Array.isArray(state.redemptionsData.redemptions) ? state.redemptionsData.redemptions : [],
        ['requestedAt', 'createdAt']
      ).slice(0, 5),
    };
  }

  return {
    adjustUserPoints,
    approveSubmissionById,
    createCheckin,
    createMission,
    createMissionSubmission,
    createShopItem,
    findMission,
    findShopItem,
    findSubmission,
    getMissionsData,
    getOperationSummary,
    getSubmissionsData,
    hasCheckedInToday,
    listMissionsForAdmin,
    listTransactions,
    listActiveMissions,
    listPendingRedemptions,
    listPendingSubmissions,
    listRecentSubmissions,
    listRecentActivityLogs,
    listShopItemsForAdmin,
    listTodayCheckins,
    loadState,
    requestRedemption,
    rejectSubmissionById,
    reviewSubmissionById,
    reviewRedemption,
    saveMissionsData,
    saveSubmissionsData,
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
  createPointsRepository,
  getKoreanDateString,
};

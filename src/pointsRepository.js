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
  points: process.env.POINTS_DATA_PATH || path.join(DATA_DIR, 'points.json'),
  pointsFallback: path.join(DATA_DIR, 'points.example.json'),
  shopItems: process.env.SHOP_ITEMS_DATA_PATH || path.join(DATA_DIR, 'shop-items.json'),
  shopItemsFallback: path.join(DATA_DIR, 'shop-items.example.json'),
  redemptions: process.env.REDEMPTIONS_DATA_PATH || path.join(DATA_DIR, 'redemptions.json'),
  redemptionsFallback: path.join(DATA_DIR, 'redemptions.example.json'),
};

function createTimestamp() {
  return new Date().toISOString();
}

function createOperationId(prefix) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${suffix}`;
}

function loadWithFallback(primaryPath, fallbackPath) {
  if (fs.existsSync(primaryPath)) {
    return loadJsonFile(primaryPath);
  }

  return loadJsonFile(fallbackPath);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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

  return {
    adjustUserPoints,
    listTransactions,
    loadState,
    requestRedemption,
    reviewRedemption,
    saveState,
  };
}

module.exports = {
  DEFAULT_PATHS,
  createPointsRepository,
};

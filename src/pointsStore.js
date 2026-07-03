const fs = require('fs');
const { saveJsonFileAtomic } = require('./jsonStorage');

const TRANSACTION_TYPES = new Set([
  'earn',
  'spend',
  'adjust',
  'redeem',
  'refund',
  'cancel',
]);
const CREDIT_TYPES = new Set(['earn', 'refund']);
const DEBIT_TYPES = new Set(['spend', 'redeem']);

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
}

function requireNumber(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }
}

function createId(prefix, timestamp) {
  return `${prefix}_${new Date(timestamp).getTime()}`;
}

function loadJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to load JSON file "${filePath}": ${error.message}`);
  }
}

function saveJsonFile(filePath, data) {
  saveJsonFileAtomic(filePath, data);
}

function getUser(pointsData, userId) {
  requireNonEmptyString(userId, 'userId');
  const users = Array.isArray(pointsData.users) ? pointsData.users : [];
  return users.find((user) => user.userId === userId) || null;
}

function getUserPoints(pointsData, userId) {
  const user = getUser(pointsData, userId);
  return user ? user.totalPoints : 0;
}

function listPointTransactions(pointsData, userId, options = {}) {
  if (userId !== undefined && userId !== null) {
    requireNonEmptyString(userId, 'userId');
  }

  let transactions = Array.isArray(pointsData.pointTransactions)
    ? pointsData.pointTransactions.slice()
    : [];

  if (userId !== undefined && userId !== null) {
    transactions = transactions.filter((transaction) => transaction.userId === userId);
  }

  if (options.type !== undefined) {
    if (!TRANSACTION_TYPES.has(options.type)) {
      throw new Error(`Unknown point transaction type: ${options.type}`);
    }
    transactions = transactions.filter((transaction) => transaction.type === options.type);
  }

  if (options.latestFirst || options.newestFirst || options.sort === 'desc') {
    transactions.sort((left, right) => {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }

  return transactions;
}

function calculateUserBalance(pointsData, userId) {
  return listPointTransactions(pointsData, userId).reduce((balance, transaction) => {
    requireNumber(transaction.amount, 'transaction.amount');
    return balance + transaction.amount;
  }, 0);
}

function validateUserBalance(pointsData, userId) {
  const storedBalance = getUserPoints(pointsData, userId);
  const calculatedBalance = calculateUserBalance(pointsData, userId);
  const difference = storedBalance - calculatedBalance;

  return {
    ok: difference === 0,
    userId,
    storedBalance,
    calculatedBalance,
    difference,
  };
}

function listActiveShopItems(shopItemsData) {
  const shopItems = Array.isArray(shopItemsData.shopItems) ? shopItemsData.shopItems : [];
  return shopItems.filter((item) => item.status === 'active');
}

function getShopItem(shopItemsData, itemId) {
  requireNonEmptyString(itemId, 'itemId');
  const shopItems = Array.isArray(shopItemsData.shopItems) ? shopItemsData.shopItems : [];
  return shopItems.find((item) => item.id === itemId) || null;
}

function canRedeem(pointsData, shopItemsData, userId, itemId) {
  const user = getUser(pointsData, userId);
  const item = getShopItem(shopItemsData, itemId);

  if (!user) {
    return { ok: false, reason: 'USER_NOT_FOUND' };
  }

  if (!item) {
    return { ok: false, reason: 'ITEM_NOT_FOUND' };
  }

  if (item.status === 'soldOut' || (typeof item.stock === 'number' && item.stock <= 0)) {
    return { ok: false, reason: 'SOLD_OUT' };
  }

  if (item.status !== 'active') {
    return { ok: false, reason: 'ITEM_NOT_ACTIVE' };
  }

  const currentPoints = getUserPoints(pointsData, userId);
  if (currentPoints < item.cost) {
    return { ok: false, reason: 'INSUFFICIENT_POINTS' };
  }

  return {
    ok: true,
    userId,
    itemId,
    cost: item.cost,
    currentPoints,
    reason: null,
  };
}

function createPointTransaction(input) {
  requireNonEmptyString(input.userId, 'userId');
  requireNonEmptyString(input.type, 'type');
  requireNumber(input.amount, 'amount');
  requireNonEmptyString(input.reason, 'reason');
  requireNumber(input.balanceAfter, 'balanceAfter');
  requireNonEmptyString(input.relatedType, 'relatedType');
  requireNonEmptyString(input.createdBy, 'createdBy');

  if (!Object.hasOwn(input, 'relatedId')) {
    throw new Error('relatedId is required.');
  }

  if (!TRANSACTION_TYPES.has(input.type)) {
    throw new Error(`Unknown point transaction type: ${input.type}`);
  }

  if (CREDIT_TYPES.has(input.type) && input.amount <= 0) {
    throw new Error(`${input.type} transaction amount must be positive.`);
  }

  if (DEBIT_TYPES.has(input.type) && input.amount >= 0) {
    throw new Error(`${input.type} transaction amount must be negative.`);
  }

  const createdAt = input.createdAt || new Date().toISOString();
  const id = input.id || createId('tx', createdAt);
  requireNonEmptyString(id, 'id');

  return {
    id,
    userId: input.userId,
    type: input.type,
    amount: input.amount,
    balanceAfter: input.balanceAfter,
    reason: input.reason,
    relatedType: input.relatedType,
    relatedId: input.relatedId,
    createdBy: input.createdBy,
    createdAt,
    note: input.note || null,
  };
}

function createRedemption(input) {
  requireNonEmptyString(input.userId, 'userId');
  requireNonEmptyString(input.itemId, 'itemId');
  requireNumber(input.cost, 'cost');
  requireNonEmptyString(input.transactionId, 'transactionId');

  if (input.cost <= 0) {
    throw new Error('cost must be positive.');
  }

  const requestedAt = input.requestedAt || new Date().toISOString();
  const id = input.id || createId('rd', requestedAt);
  requireNonEmptyString(id, 'id');

  return {
    id,
    userId: input.userId,
    itemId: input.itemId,
    cost: input.cost,
    status: 'pending',
    requestedAt,
    completedAt: null,
    cancelledAt: null,
    refundedAt: null,
    reviewedBy: null,
    transactionId: input.transactionId,
    refundTransactionId: null,
    note: input.note || null,
  };
}

function requirePendingRedemption(redemption) {
  if (!redemption || redemption.status !== 'pending') {
    throw new Error('Only pending redemptions can be reviewed.');
  }
}

function completeRedemption(redemption, reviewer) {
  requirePendingRedemption(redemption);
  requireNonEmptyString(reviewer, 'reviewer');

  return {
    ...redemption,
    status: 'completed',
    completedAt: new Date().toISOString(),
    reviewedBy: reviewer,
  };
}

function cancelRedemption(redemption, reviewer, note) {
  requirePendingRedemption(redemption);
  requireNonEmptyString(reviewer, 'reviewer');
  requireNonEmptyString(note, 'note');

  return {
    ...redemption,
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
    reviewedBy: reviewer,
    note,
  };
}

function refundRedemption(redemption, refundTransactionId) {
  if (!redemption || redemption.status !== 'cancelled') {
    throw new Error('Only cancelled redemptions can be refunded.');
  }
  requireNonEmptyString(refundTransactionId, 'refundTransactionId');

  return {
    ...redemption,
    status: 'refunded',
    refundedAt: new Date().toISOString(),
    refundTransactionId,
  };
}

module.exports = {
  calculateUserBalance,
  canRedeem,
  cancelRedemption,
  completeRedemption,
  createPointTransaction,
  createRedemption,
  getShopItem,
  getUser,
  getUserPoints,
  listActiveShopItems,
  listPointTransactions,
  loadJsonFile,
  refundRedemption,
  saveJsonFile,
  validateUserBalance,
};

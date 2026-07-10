const fs = require('fs');
const path = require('path');
const {
  isExampleLikeRecord,
  isExampleLikeValue,
} = require('../src/operationalRecords');
const { isProductionDataStrict, resolveOperationDataDir } = require('../src/operationDataPaths');

const DATA_DIR = process.env.LOCAL_OPERATION_DATA_DIR || resolveOperationDataDir();

const FILE_DEFINITIONS = [
  {
    file: 'points.local.json',
    collections: [
      {
        key: 'users',
        idField: 'userId',
        required: ['userId', 'totalPoints'],
        allowedStatuses: ['active', 'inactive'],
      },
      {
        key: 'pointTransactions',
        idField: 'id',
        required: ['id', 'userId', 'type', 'amount', 'balanceAfter', 'createdAt'],
        allowedStatuses: null,
      },
    ],
  },
  {
    file: 'redemptions.local.json',
    collections: [{
      key: 'redemptions',
      idField: 'id',
      required: ['id', 'userId', 'itemId', 'cost', 'status', 'requestedAt'],
      allowedStatuses: ['pending', 'completed', 'cancelled', 'refunded'],
    }],
  },
  {
    file: 'submissions.local.json',
    collections: [{
      key: 'submissions',
      idField: 'id',
      required: ['id', 'userId', 'status', 'createdAt'],
      allowedStatuses: ['pending', 'approved', 'rejected'],
    }],
  },
  {
    file: 'missions.local.json',
    collections: [{
      key: 'missions',
      idField: 'id',
      required: ['id', 'title', 'status'],
      allowedStatuses: ['draft', 'active', 'paused', 'closed'],
    }],
  },
  {
    file: 'shop-items.local.json',
    collections: [{
      key: 'shopItems',
      idField: 'id',
      required: ['id', 'name', 'cost', 'status'],
      allowedStatuses: ['draft', 'active', 'paused', 'soldOut', 'hidden'],
    }],
  },
  {
    file: 'reaction-approvals.local.json',
    collections: [{
      key: 'records',
      idField: 'id',
      required: ['id', 'messageId', 'authorId', 'status', 'reviewedAt'],
      allowedStatuses: ['approved', 'rejected'],
    }],
  },
];
const FILE_DEFINITION_BY_NAME = new Map(FILE_DEFINITIONS.map((definition) => [definition.file, definition]));
const REQUIRED_FILES = [
  'points.local.json',
  'shop-items.local.json',
  'redemptions.local.json',
  'missions.local.json',
  'submissions.local.json',
];

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function addIssue(issues, file, message) {
  issues.push(`${file}: ${message}`);
}

function readLocalJson(filePath, file, issues) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    addIssue(issues, file, `JSON parse 실패 - ${error.message}`);
    return null;
  }
}

function hasExampleLikeValueDeep(value, key = '') {
  if (isExampleLikeValue(value, key)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasExampleLikeValueDeep(item, key));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).some(([childKey, childValue]) => {
      return hasExampleLikeValueDeep(childValue, childKey);
    });
  }

  return false;
}

function checkDuplicateIds(records, idField, file, collectionKey, issues) {
  const seen = new Set();
  for (const record of records) {
    const id = record && record[idField];
    if (!id) {
      continue;
    }

    if (seen.has(id)) {
      addIssue(issues, file, `${collectionKey}.${idField} 중복 - ${id}`);
      continue;
    }

    seen.add(id);
  }
}

function checkRequiredFields(records, requiredFields, file, collectionKey, issues) {
  records.forEach((record, index) => {
    for (const field of requiredFields) {
      if (record[field] === undefined || record[field] === null || record[field] === '') {
        addIssue(issues, file, `${collectionKey}[${index}] 필수 필드 누락 - ${field}`);
      }
    }
  });
}

function checkAllowedStatuses(records, allowedStatuses, file, collectionKey, issues) {
  if (!allowedStatuses) {
    return;
  }

  const allowed = new Set(allowedStatuses);
  records.forEach((record, index) => {
    if (record.status && !allowed.has(record.status)) {
      addIssue(issues, file, `${collectionKey}[${index}] 잘못된 status - ${record.status}`);
    }
  });
}

function checkExampleMix(records, file, collectionKey, issues) {
  records.forEach((record, index) => {
    if (isExampleLikeRecord(record) || hasExampleLikeValueDeep(record)) {
      addIssue(issues, file, `${collectionKey}[${index}] example/demo/sample/2030년대 예시 데이터 혼입 의심`);
    }
  });
}

function checkNumericFields(records, fields, file, collectionKey, issues) {
  records.forEach((record, index) => {
    for (const field of fields) {
      if (record[field] === undefined || record[field] === null) {
        continue;
      }

      const value = Number(record[field]);
      if (!Number.isFinite(value)) {
        addIssue(issues, file, `${collectionKey}[${index}] 숫자 필드가 아닙니다 - ${field}`);
      }
    }
  });
}

function checkPointsConsistency(pointsData, file, issues) {
  const users = toArray(pointsData.users);
  const transactions = toArray(pointsData.pointTransactions);
  const usersById = new Map(users.map((user) => [user.userId, user]));
  const transactionsByUser = new Map();

  for (const user of users) {
    if (Number(user.totalPoints) < 0) {
      addIssue(issues, file, `users.totalPoints 음수 - ${user.userId}`);
    }
  }

  for (const transaction of transactions) {
    if (!usersById.has(transaction.userId)) {
      addIssue(issues, file, `pointTransactions 사용자 없음 - ${transaction.id}`);
    }

    if (Number(transaction.balanceAfter) < 0) {
      addIssue(issues, file, `pointTransactions.balanceAfter 음수 - ${transaction.id}`);
    }

    const group = transactionsByUser.get(transaction.userId) || [];
    group.push(transaction);
    transactionsByUser.set(transaction.userId, group);
  }

  for (const [userId, group] of transactionsByUser.entries()) {
    const sorted = group.slice().sort((left, right) => {
      return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
    });
    const latest = sorted[sorted.length - 1];
    const user = usersById.get(userId);
    if (user && latest && Number(user.totalPoints) !== Number(latest.balanceAfter)) {
      addIssue(issues, file, `users.totalPoints와 마지막 거래 balanceAfter 불일치 - ${userId}`);
    }
  }
}

function checkCrossReferences(files, issues) {
  const points = files.get('points.local.json') || {};
  const missions = files.get('missions.local.json') || {};
  const shopItems = files.get('shop-items.local.json') || {};
  const users = new Set(toArray(points.users).map((user) => user.userId));
  const transactions = new Set(toArray(points.pointTransactions).map((transaction) => transaction.id));
  const transactionsById = new Map(toArray(points.pointTransactions).map((transaction) => [transaction.id, transaction]));
  const missionIds = new Set(toArray(missions.missions).map((mission) => mission.id));
  const itemIds = new Set(toArray(shopItems.shopItems).map((item) => item.id));

  const redemptions = toArray((files.get('redemptions.local.json') || {}).redemptions);
  redemptions.forEach((redemption) => {
    if (redemption.userId && users.size > 0 && !users.has(redemption.userId)) {
      addIssue(issues, 'redemptions.local.json', `사용자 참조 없음 - ${redemption.id}`);
    }
    if (redemption.itemId && itemIds.size > 0 && !itemIds.has(redemption.itemId)) {
      addIssue(issues, 'redemptions.local.json', `상점 항목 참조 없음 - ${redemption.id}`);
    }
    if (redemption.transactionId && transactions.size > 0 && !transactions.has(redemption.transactionId)) {
      addIssue(issues, 'redemptions.local.json', `차감 거래 참조 없음 - ${redemption.id}`);
    }
    const debit = transactionsById.get(redemption.transactionId);
    if (debit && (debit.relatedId !== redemption.id || debit.type !== 'redeem')) {
      addIssue(issues, 'redemptions.local.json', `차감 거래 상호 참조 불일치 - ${redemption.id}`);
    }
    if (redemption.status === 'refunded') {
      const refund = transactionsById.get(redemption.refundTransactionId);
      if (!refund || refund.relatedId !== redemption.id || refund.type !== 'refund') {
        addIssue(issues, 'redemptions.local.json', `환불 거래 상호 참조 불일치 - ${redemption.id}`);
      }
    }
  });

  const submissions = toArray((files.get('submissions.local.json') || {}).submissions);
  submissions.forEach((submission) => {
    if (submission.userId && users.size > 0 && !users.has(submission.userId)) {
      addIssue(issues, 'submissions.local.json', `사용자 참조 없음 - ${submission.id}`);
    }
    if (submission.missionId && missionIds.size > 0 && !missionIds.has(submission.missionId)) {
      addIssue(issues, 'submissions.local.json', `미션 참조 없음 - ${submission.id}`);
    }
    if (submission.rewardTransactionId && transactions.size > 0 && !transactions.has(submission.rewardTransactionId)) {
      addIssue(issues, 'submissions.local.json', `지급 거래 참조 없음 - ${submission.id}`);
    }
  });

  const reactionRecords = toArray((files.get('reaction-approvals.local.json') || {}).records);
  reactionRecords.forEach((record) => {
    if (record.transactionId && !transactions.has(record.transactionId)) {
      addIssue(issues, 'reaction-approvals.local.json', `지급 거래 참조 없음 - ${record.id}`);
    }
  });
}

function checkGenericLocalFile(file, data, issues) {
  if (data && data.isExample === true) {
    addIssue(issues, file, 'local 파일에 isExample=true가 설정되어 있습니다.');
  }

  if (hasExampleLikeValueDeep(data)) {
    addIssue(issues, file, 'example/demo/sample/2030년대 예시 데이터 혼입 의심');
  }
}

function checkLocalOperationData(dataDir = DATA_DIR, options = {}) {
  const issues = [];
  const files = new Map();
  let checkedFiles = 0;
  const localFiles = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter((file) => file.endsWith('.local.json')).sort()
    : [];
  if (options.strict) {
    for (const file of REQUIRED_FILES) {
      if (!localFiles.includes(file)) addIssue(issues, file, 'strict 모드 필수 파일 누락');
    }
  }

  for (const file of localFiles) {
    const definition = FILE_DEFINITION_BY_NAME.get(file);
    const filePath = path.join(dataDir, file);
    const data = readLocalJson(filePath, file, issues);
    if (!data) {
      continue;
    }

    checkedFiles += 1;
    files.set(file, data);

    if (!definition) {
      checkGenericLocalFile(file, data, issues);
      continue;
    }

    if (data.isExample === true) {
      addIssue(issues, file, 'local 파일에 isExample=true가 설정되어 있습니다.');
    }

    for (const collection of definition.collections) {
      const records = toArray(data[collection.key]);
      if (!Array.isArray(data[collection.key])) {
        addIssue(issues, file, `컬렉션 배열 누락 - ${collection.key}`);
        continue;
      }

      checkDuplicateIds(records, collection.idField, file, collection.key, issues);
      checkRequiredFields(records, collection.required, file, collection.key, issues);
      checkAllowedStatuses(records, collection.allowedStatuses, file, collection.key, issues);
      checkExampleMix(records, file, collection.key, issues);
    }
  }

  if (files.has('points.local.json')) {
    const points = files.get('points.local.json');
    checkNumericFields(toArray(points.users), ['totalPoints'], 'points.local.json', 'users', issues);
    checkNumericFields(toArray(points.pointTransactions), ['amount', 'balanceAfter'], 'points.local.json', 'pointTransactions', issues);
    checkPointsConsistency(points, 'points.local.json', issues);
  }

  if (files.has('missions.local.json')) {
    checkNumericFields(toArray(files.get('missions.local.json').missions), ['rewardPoints'], 'missions.local.json', 'missions', issues);
  }

  if (files.has('shop-items.local.json')) {
    checkNumericFields(toArray(files.get('shop-items.local.json').shopItems), ['cost', 'stock', 'monthlyLimit'], 'shop-items.local.json', 'shopItems', issues);
    toArray(files.get('shop-items.local.json').shopItems).forEach((item) => {
      if (Number(item.stock) < 0) addIssue(issues, 'shop-items.local.json', `재고 음수 - ${item.id}`);
    });
  }

  if (files.has('redemptions.local.json')) {
    checkNumericFields(toArray(files.get('redemptions.local.json').redemptions), ['cost'], 'redemptions.local.json', 'redemptions', issues);
  }

  checkCrossReferences(files, issues);

  return {
    ok: issues.length === 0,
    checkedFiles,
    issues,
  };
}

function main() {
  const strict = isProductionDataStrict();
  const result = checkLocalOperationData(DATA_DIR, { strict });
  if (!result.ok) {
    console.error(`local 운영 데이터 점검 실패: ${result.issues.length}건`);
    result.issues.forEach((issue) => console.error(`- ${issue}`));
    process.exit(1);
  }

  if (result.checkedFiles === 0) {
    console.log('local 운영 데이터 점검: data/*.local.json 파일이 없어 건너뜁니다.');
    return;
  }

  console.log(`local 운영 데이터 점검 통과: ${result.checkedFiles}개 파일`);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkLocalOperationData,
};

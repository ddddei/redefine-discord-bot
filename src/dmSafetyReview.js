const fs = require('fs');
const { saveJsonFileAtomic } = require('./jsonStorage');
const { getOperationDataPaths } = require('./operationDataPaths');

const REVIEW_STATUSES = new Set(['pending', 'reviewed', 'followUp', 'closed']);
const REVIEW_ACTION_STATUSES = new Set(['reviewed', 'followUp', 'closed']);
const MAX_REVIEW_NOTE_LENGTH = 500;

function createInitialSafetyReviewData() {
  return {
    version: 1,
    isExample: false,
    description: 'DM safety detection review workflow. Records reference DM logs and do not copy message content.',
    reviews: [],
  };
}

function normalizeData(data) {
  const reviews = Array.isArray(data && data.reviews) ? data.reviews : [];
  reviews.forEach((review) => validateStatus(review && review.status));
  return {
    ...createInitialSafetyReviewData(),
    ...data,
    version: 1,
    isExample: false,
    reviews,
  };
}

function normalizeNote(note) {
  const value = String(note || '').trim();
  if (value.length > MAX_REVIEW_NOTE_LENGTH) {
    throw new Error(`운영 메모는 ${MAX_REVIEW_NOTE_LENGTH}자 이하여야 합니다.`);
  }
  return value || null;
}

function validateStatus(status, allowed = REVIEW_STATUSES) {
  if (!allowed.has(status)) {
    throw new Error('허용되지 않은 DM 안전 확인 상태입니다.');
  }
  return status;
}

function createReviewId() {
  return `dm_review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDmSafetyReviewRepository(filePath = getOperationDataPaths().dmSafetyReviews) {
  function load() {
    if (!fs.existsSync(filePath)) return createInitialSafetyReviewData();
    return normalizeData(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }

  function save(data) {
    saveJsonFileAtomic(filePath, normalizeData(data));
  }

  function createForDetection(input) {
    if (!input || !input.sourceLogId || !input.userId) {
      throw new Error('DM 안전 확인 레코드에는 sourceLogId와 userId가 필요합니다.');
    }
    if (input.direction !== 'input' && input.direction !== 'output') {
      throw new Error('DM 안전 확인 direction은 input 또는 output이어야 합니다.');
    }

    const data = load();
    const existing = data.reviews.find((review) => review.sourceLogId === input.sourceLogId);
    if (existing) return { created: false, review: existing };

    const now = input.detectedAt || new Date().toISOString();
    const review = {
      id: createReviewId(),
      sourceLogId: input.sourceLogId,
      userId: input.userId,
      direction: input.direction,
      status: 'pending',
      detectedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      note: null,
      updatedAt: now,
      history: [{ status: 'pending', changedAt: now, changedBy: null }],
    };
    data.reviews.push(review);
    save(data);
    return { created: true, review };
  }

  function getById(reviewId) {
    return load().reviews.find((review) => review.id === reviewId) || null;
  }

  function list(options = {}) {
    const limit = Math.min(50, Math.max(1, Number(options.limit || 10)));
    const statuses = Array.isArray(options.statuses) ? options.statuses : null;
    if (statuses) statuses.forEach((status) => validateStatus(status));
    return load().reviews
      .filter((review) => !statuses || statuses.includes(review.status))
      .slice()
      .sort((left, right) => new Date(right.detectedAt || 0) - new Date(left.detectedAt || 0))
      .slice(0, limit);
  }

  function countByStatus() {
    return load().reviews.reduce((counts, review) => {
      if (REVIEW_STATUSES.has(review.status)) counts[review.status] += 1;
      return counts;
    }, { pending: 0, reviewed: 0, followUp: 0, closed: 0 });
  }

  function transition(reviewId, input) {
    const status = validateStatus(input && input.status, REVIEW_ACTION_STATUSES);
    const data = load();
    const index = data.reviews.findIndex((review) => review.id === reviewId);
    if (index < 0) return { ok: false, reason: 'NOT_FOUND', review: null };

    const current = data.reviews[index];
    if (input.expectedUpdatedAt && current.updatedAt !== input.expectedUpdatedAt) {
      return { ok: false, reason: 'CONFLICT', review: current };
    }

    const changedAt = input.changedAt || new Date().toISOString();
    const next = {
      ...current,
      status,
      reviewedAt: changedAt,
      reviewedBy: input.reviewedBy || null,
      note: normalizeNote(input.note),
      updatedAt: changedAt,
      history: [
        ...(Array.isArray(current.history) ? current.history : []),
        { status, changedAt, changedBy: input.reviewedBy || null },
      ],
    };
    data.reviews[index] = next;
    save(data);
    return { ok: true, reason: 'UPDATED', review: next };
  }

  return { countByStatus, createForDetection, getById, list, transition };
}

module.exports = {
  MAX_REVIEW_NOTE_LENGTH,
  REVIEW_ACTION_STATUSES,
  REVIEW_STATUSES,
  createDmSafetyReviewRepository,
  createInitialSafetyReviewData,
  normalizeNote,
  validateStatus,
};

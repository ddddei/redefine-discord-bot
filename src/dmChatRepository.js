const fs = require('fs');
const path = require('path');
const { filterOperationalRecords } = require('./operationalRecords');
const { saveJsonFile } = require('./pointsStore');
const { getKoreanDateString } = require('./pointsRepository');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_DM_CHAT_LOG_PATH = process.env.DM_CHAT_LOG_PATH || path.join(DATA_DIR, 'dm-chat-logs.local.json');
const CURRENT_DM_CHAT_LOG_VERSION = 3;

function createTimestamp() {
  return new Date().toISOString();
}

function createLogId(prefix) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${suffix}`;
}

function createInitialData() {
  return {
    version: CURRENT_DM_CHAT_LOG_VERSION,
    isExample: false,
    description: 'Local DM chat logs for conversation-practice MVP. JSON storage is for MVP operation only.',
    notices: [],
    messages: [],
    historyResets: [],
  };
}

function getRecordKoreanDateString(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return getKoreanDateString(date);
}

function loadData(logPath) {
  if (!fs.existsSync(logPath)) {
    return createInitialData();
  }

  return JSON.parse(fs.readFileSync(logPath, 'utf8'));
}

function normalizeData(data) {
  return {
    ...createInitialData(),
    ...data,
    version: CURRENT_DM_CHAT_LOG_VERSION,
    notices: Array.isArray(data && data.notices) ? data.notices : [],
    messages: Array.isArray(data && data.messages) ? data.messages : [],
    historyResets: Array.isArray(data && data.historyResets) ? data.historyResets : [],
  };
}

function resolveUserId(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }

  return user.id || user.userId || null;
}

function isAfterReset(message, resetAt) {
  if (!resetAt) {
    return true;
  }

  const messageTime = new Date(message && message.createdAt).getTime();
  const resetTime = new Date(resetAt).getTime();

  if (Number.isNaN(messageTime) || Number.isNaN(resetTime)) {
    return true;
  }

  return messageTime > resetTime;
}

function isSafetyRecord(message) {
  return Boolean(message && message.safetyDetection);
}

function createDmChatRepository(logPath = DEFAULT_DM_CHAT_LOG_PATH) {
  function save(data) {
    saveJsonFile(logPath, normalizeData(data));
  }

  function load() {
    return normalizeData(loadData(logPath));
  }

  function hasNotice(userId) {
    const data = load();
    return data.notices.some((notice) => notice.userId === userId);
  }

  function recordNotice(user) {
    const data = load();

    if (!data.notices.some((notice) => notice.userId === user.id)) {
      data.notices.push({
        userId: user.id,
        username: user.username || null,
        displayName: user.displayName || user.globalName || user.username || user.id,
        sentAt: createTimestamp(),
      });
      save(data);
    }
  }

  function appendMessage(entry) {
    const data = load();
    const record = {
      id: createLogId('dm_chat'),
      createdAt: createTimestamp(),
      userId: entry.userId,
      username: entry.username || null,
      displayName: entry.displayName || entry.username || entry.userId,
      role: entry.role,
      content: entry.content,
      safetyDetection: entry.safetyDetection || null,
      safetyDetectionSource: entry.safetyDetectionSource || null,
      error: entry.error || null,
    };

    data.messages.push(record);
    save(data);
    return record;
  }

  function recordHistoryReset(user, resetAt = createTimestamp()) {
    const userId = resolveUserId(user);
    if (!userId) {
      return null;
    }

    const data = load();
    const existingIndex = data.historyResets.findIndex((reset) => reset.userId === userId);
    const record = {
      userId,
      username: user.username || null,
      displayName: user.displayName || user.globalName || user.username || userId,
      resetAt,
    };

    if (existingIndex >= 0) {
      data.historyResets[existingIndex] = record;
    } else {
      data.historyResets.push(record);
    }

    save(data);
    return record;
  }

  function getHistoryResetAt(userId) {
    const data = load();
    const reset = data.historyResets.find((record) => record.userId === userId);
    return reset && reset.resetAt ? reset.resetAt : null;
  }

  function listRecentMessages(userId, limit = 8) {
    const safeLimit = Math.min(20, Math.max(1, Number(limit || 8)));
    const data = load();
    const resetAt = getHistoryResetAt(userId);

    return data.messages
      .filter((message) => message.userId === userId && !message.error && isAfterReset(message, resetAt))
      .slice(-safeLimit);
  }

  function listRecentMessagesForAdmin(limit = null) {
    const hasLimit = limit !== null && limit !== undefined;
    const parsedLimit = hasLimit ? Number(limit) : NaN;
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(100, Math.max(1, parsedLimit))
      : null;
    const data = load();
    const messages = data.messages
      .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
      .slice()
      .sort((left, right) => {
        return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
      });

    return safeLimit ? messages.slice(0, safeLimit) : messages;
  }

  function countRecentUserMessages(userId, sinceDate, now = new Date()) {
    const sinceMs = sinceDate instanceof Date ? sinceDate.getTime() : new Date(sinceDate).getTime();
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

    if (Number.isNaN(sinceMs)) {
      return 0;
    }

    const data = load();

    return data.messages.filter((message) => {
      if (!message || message.userId !== userId || message.role !== 'user') {
        return false;
      }

      const messageMs = new Date(message.createdAt).getTime();
      return !Number.isNaN(messageMs) && messageMs >= sinceMs && messageMs <= nowMs;
    }).length;
  }

  function countTodayUserMessages(userId, now = new Date()) {
    const dateString = getRecordKoreanDateString(now);
    const data = load();

    return data.messages.filter((message) => {
      return message
        && message.userId === userId
        && message.role === 'user'
        && getRecordKoreanDateString(message.createdAt) === dateString;
    }).length;
  }

  function summarizeToday(now = new Date()) {
    const dateString = getRecordKoreanDateString(now);
    const data = load();
    const filtered = filterOperationalRecords(data.messages);
    const todayMessages = filtered.data.filter((message) => {
      return message && getRecordKoreanDateString(message.createdAt) === dateString;
    });
    const userMessages = todayMessages.filter((message) => message.role === 'user');
    const assistantMessages = todayMessages.filter((message) => message.role === 'assistant');
    const safetyMessages = todayMessages.filter(isSafetyRecord);
    const distinctUserIds = new Set(userMessages.map((message) => message.userId).filter(Boolean));
    const latestMessage = todayMessages.slice().sort((left, right) => {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    })[0] || null;

    return {
      title: 'DM 대화 현황',
      readOnly: true,
      storageMode: 'local-json',
      date: dateString,
      generatedAt: createTimestamp(),
      counts: {
        users: distinctUserIds.size,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        aiResponses: assistantMessages.length,
        safetyDetections: safetyMessages.length,
        inputSafetyDetections: safetyMessages.filter((message) => {
          return message.safetyDetectionSource === 'input'
            || (!message.safetyDetectionSource && message.role === 'user');
        }).length,
        outputSafetyDetections: safetyMessages.filter((message) => {
          return message.safetyDetectionSource === 'output';
        }).length,
        errors: todayMessages.filter((message) => message.error).length,
      },
      lastMessageAt: latestMessage ? latestMessage.createdAt : null,
      meta: {
        exampleRecordsExcluded: filtered.excluded,
        storageMode: 'local-json',
        readOnly: true,
        generatedAt: createTimestamp(),
      },
    };
  }

  return {
    appendMessage,
    countRecentUserMessages,
    countTodayUserMessages,
    getHistoryResetAt,
    hasNotice,
    listRecentMessagesForAdmin,
    listRecentMessages,
    recordHistoryReset,
    recordNotice,
    summarizeToday,
  };
}

module.exports = {
  createDmChatRepository,
};

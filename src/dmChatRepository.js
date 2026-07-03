const fs = require('fs');
const path = require('path');
const { saveJsonFile } = require('./pointsStore');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_DM_CHAT_LOG_PATH = process.env.DM_CHAT_LOG_PATH || path.join(DATA_DIR, 'dm-chat-logs.local.json');

function createTimestamp() {
  return new Date().toISOString();
}

function createLogId(prefix) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${suffix}`;
}

function createInitialData() {
  return {
    version: 1,
    isExample: false,
    description: 'Local DM chat logs for conversation-practice MVP. JSON storage is for MVP operation only.',
    notices: [],
    messages: [],
  };
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
    notices: Array.isArray(data && data.notices) ? data.notices : [],
    messages: Array.isArray(data && data.messages) ? data.messages : [],
  };
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
      error: entry.error || null,
    };

    data.messages.push(record);
    save(data);
    return record;
  }

  function listRecentMessages(userId, limit = 8) {
    const safeLimit = Math.min(20, Math.max(1, Number(limit || 8)));
    const data = load();

    return data.messages
      .filter((message) => message.userId === userId && !message.error)
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

  return {
    appendMessage,
    hasNotice,
    listRecentMessagesForAdmin,
    listRecentMessages,
    recordNotice,
  };
}

module.exports = {
  createDmChatRepository,
};

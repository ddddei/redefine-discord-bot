const fs = require('fs');
const { filterOperationalRecords } = require('./operationalRecords');
const { saveJsonFile } = require('./pointsStore');
const { getKoreanDateString } = require('./pointsRepository');
const { getOperationDataPaths } = require('./operationDataPaths');

const DEFAULT_DM_CHAT_LOG_PATH = getOperationDataPaths().dmChatLogs;
const CURRENT_DM_CHAT_LOG_VERSION = 4;
const CURRENT_NOTICE_VERSION = 3;

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
    activeScenarios: [],
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

function normalizeNotice(notice) {
  return {
    ...notice,
    // noticeVersion 없음은 최초 고지만 받은 것으로 간주한다.
    noticeVersion: Number.isInteger(notice && notice.noticeVersion) ? notice.noticeVersion : 1,
  };
}

function normalizeData(data) {
  return {
    ...createInitialData(),
    ...data,
    version: CURRENT_DM_CHAT_LOG_VERSION,
    notices: Array.isArray(data && data.notices) ? data.notices.map(normalizeNotice) : [],
    messages: Array.isArray(data && data.messages) ? data.messages : [],
    historyResets: Array.isArray(data && data.historyResets) ? data.historyResets : [],
    activeScenarios: Array.isArray(data && data.activeScenarios) ? data.activeScenarios : [],
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

  function getNotice(userId) {
    const data = load();
    return data.notices.find((notice) => notice.userId === userId) || null;
  }

  function hasNotice(userId) {
    const notice = getNotice(userId);
    return Boolean(notice && notice.noticeVersion >= CURRENT_NOTICE_VERSION);
  }

  function recordNotice(user) {
    const data = load();
    const existingIndex = data.notices.findIndex((notice) => notice.userId === user.id);
    const record = {
      userId: user.id,
      username: user.username || null,
      displayName: user.displayName || user.globalName || user.username || user.id,
      sentAt: createTimestamp(),
      noticeVersion: CURRENT_NOTICE_VERSION,
    };

    if (existingIndex >= 0) {
      data.notices[existingIndex] = record;
    } else {
      data.notices.push(record);
    }

    save(data);
    return record;
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
      outcome: entry.outcome || null,
      tokens: entry.role === 'assistant' && entry.tokens ? entry.tokens : null,
    };

    data.messages.push(record);
    save(data);
    return record;
  }

  function appendOperationalEvent(entry) {
    return appendMessage({
      userId: entry.userId,
      username: null,
      displayName: entry.userId,
      role: 'event',
      content: '',
      outcome: entry.outcome,
    });
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

  function getActiveScenario(userId, now = new Date()) {
    const data = load();
    const scenario = data.activeScenarios.find((record) => record.userId === userId);

    if (!scenario) {
      return null;
    }

    const startedDateString = getRecordKoreanDateString(scenario.startedAt);
    const nowDateString = getRecordKoreanDateString(now);

    if (startedDateString && nowDateString && startedDateString !== nowDateString) {
      // 다음 날(KST)이 되면 자동 해제한다.
      return null;
    }

    return scenario;
  }

  function setActiveScenario(userId, scenarioId, startedAt = createTimestamp()) {
    const data = load();
    const existingIndex = data.activeScenarios.findIndex((record) => record.userId === userId);
    const record = { userId, scenarioId, startedAt };

    if (existingIndex >= 0) {
      data.activeScenarios[existingIndex] = record;
    } else {
      data.activeScenarios.push(record);
    }

    save(data);
    return record;
  }

  function clearActiveScenario(userId) {
    const data = load();
    const nextScenarios = data.activeScenarios.filter((record) => record.userId !== userId);

    if (nextScenarios.length === data.activeScenarios.length) {
      return false;
    }

    data.activeScenarios = nextScenarios;
    save(data);
    return true;
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
    const todayMessages = filtered.data.filter((message) => message && getRecordKoreanDateString(message.createdAt) === dateString);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentMessages = filtered.data.filter((message) => {
      const time = new Date(message && message.createdAt).getTime();
      return !Number.isNaN(time) && time >= sevenDaysAgo.getTime() && time <= now.getTime();
    });
    const userMessages = todayMessages.filter((message) => message.role === 'user');
    const assistantMessages = todayMessages.filter((message) => message.role === 'assistant');
    const safetyMessages = todayMessages.filter(isSafetyRecord);
    const distinctUserIds = new Set(userMessages.map((message) => message.userId).filter(Boolean));
    const latestMessage = todayMessages.slice().sort((left, right) => {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    })[0] || null;

    function summarizeWindow(messages) {
      const users = messages.filter((message) => message.role === 'user');
      const assistants = messages.filter((message) => message.role === 'assistant');
      return {
        userMessages: users.length,
        assistantMessages: assistants.length,
        aiSuccesses: messages.filter((message) => message.outcome === 'aiSuccess').length,
        aiErrors: messages.filter((message) => message.outcome === 'aiError').length,
        aiTimeouts: messages.filter((message) => message.outcome === 'aiTimeout').length,
        dailyLimitHits: messages.filter((message) => message.outcome === 'dailyLimit').length,
        burstLimitHits: messages.filter((message) => message.outcome === 'burstLimit').length,
        tokens: assistants.reduce((totals, message) => {
          if (message.tokens && Number.isFinite(message.tokens.input)) { totals.input += message.tokens.input; totals.hasData = true; }
          if (message.tokens && Number.isFinite(message.tokens.output)) { totals.output += message.tokens.output; totals.hasData = true; }
          return totals;
        }, { input: 0, output: 0, hasData: false }),
      };
    }
    const todayWindow = summarizeWindow(todayMessages);
    const sevenDayWindow = summarizeWindow(recentMessages);

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
        aiResponses: todayWindow.aiSuccesses,
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
      tokens: todayWindow.tokens,
      periods: { today: todayWindow, sevenDays: sevenDayWindow },
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
    appendOperationalEvent,
    clearActiveScenario,
    countRecentUserMessages,
    countTodayUserMessages,
    getActiveScenario,
    getHistoryResetAt,
    getNotice,
    hasNotice,
    listRecentMessagesForAdmin,
    listRecentMessages,
    recordHistoryReset,
    recordNotice,
    setActiveScenario,
    summarizeToday,
  };
}

module.exports = {
  CURRENT_DM_CHAT_LOG_VERSION,
  CURRENT_NOTICE_VERSION,
  DEFAULT_DM_CHAT_LOG_PATH,
  createDmChatRepository,
};

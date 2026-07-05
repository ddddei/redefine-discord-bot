const { ChannelType } = require('discord.js');
const { getDmChatReply } = require('./ai');
const { createDmChatRepository } = require('./dmChatRepository');
const {
  sendDmChatGlobalErrorAlert,
  sendDmChatOperatorLog,
  sendDmChatSafetyAlert,
} = require('./dmChatLogging');
const { detectSensitiveQuestion, getSensitiveQuestionUserMessage } = require('./safety');

const DEFAULT_RETENTION_DAYS = 90;

function getRetentionDays() {
  const parsed = Number.parseInt(process.env.DM_CHAT_RETENTION_DAYS || `${DEFAULT_RETENTION_DAYS}`, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_RETENTION_DAYS;
  }

  return parsed;
}

function getRetentionNoticeLine() {
  const retentionDays = getRetentionDays();

  if (retentionDays === 0) {
    return '대화 기록은 운영 종료 시까지 보관되며, 원하면 언제든 삭제를 요청할 수 있어요.';
  }

  return `대화 기록은 ${retentionDays}일 뒤 자동 정리되고, 원하면 언제든 삭제를 요청할 수 있어요.`;
}

function buildFirstNotice() {
  return [
    '리디파인 DM 대화 연습을 시작할게요.',
    '',
    '이 DM은 참가자 보호와 운영 지원을 위해 기록되며 운영진이 확인할 수 있어요.',
    '자해, 폭력, 괴롭힘, 긴급한 위험과 관련된 내용은 빠른 도움을 위해 운영진에게 전달될 수 있습니다.',
    getRetentionNoticeLine(),
    '',
    '이 봇은 상담이나 진단을 하지 않고, 사람들과 대화하기 전 짧게 연습하는 용도로만 도와드려요.',
    '『연습 메뉴』라고 보내면 연습 주제를, 『새로 시작』이라고 보내면 대화를 새로 시작할 수 있어요.',
  ].join('\n');
}

const FIRST_NOTICE = buildFirstNotice();

const CONFIGURATION_FALLBACK = [
  '지금은 DM 대화 기능을 준비 중이에요.',
  '운영진이 OpenAI API 설정을 마치면 여기서 짧은 대화 연습을 할 수 있습니다.',
].join('\n');

const DAILY_LIMIT_FALLBACK = '오늘은 연습을 충분히 했어요. 내일 다시 이어서 연습해요. 급한 일이나 어려운 일이 있다면 운영진에게 문의해 주세요.';
const OUTPUT_SAFETY_FALLBACK = '지금은 답변을 만들지 못했어요. 잠시 후 다시 말을 걸어 주세요.';
const HISTORY_RESET_TRIGGER = '새로 시작';
const HISTORY_RESET_CONFIRMATION = '좋아요, 새 마음으로 다시 시작해요. 편하게 말을 걸어 주세요.';
const NON_MEMBER_NOTICE = '이 DM 연습은 리디파인 참여자에게 열려 있어요.';
const BURST_LIMIT_FALLBACK = '조금 천천히 이야기해요. 잠시 후 다시 보내 주세요.';
const DEFAULT_BURST_LIMIT_PER_MINUTE = 5;
const BURST_WINDOW_MS = 60 * 1000;
const DISCORD_MESSAGE_LIMIT = 2000;
const MAX_MESSAGE_CHUNKS = 2;
const CHUNK_TRUNCATION_SUFFIX = '…';
const GLOBAL_AI_ERROR_WINDOW_MS = 10 * 60 * 1000;
const GLOBAL_AI_ERROR_THRESHOLD = 5;
const GLOBAL_AI_ERROR_ALERT_THROTTLE_MS = 10 * 60 * 1000;

const nonMemberNoticeSent = new Set();
const burstLimitLastNoticeAt = new Map();
const userProcessingChains = new Map();
let globalAiErrorTimestamps = [];
let globalAiErrorAlertLastSentAt = 0;

function splitReplyIntoChunks(content) {
  if (typeof content !== 'string' || content.length <= DISCORD_MESSAGE_LIMIT) {
    return [content];
  }

  const chunks = [];
  let remaining = content;

  while (remaining.length > 0 && chunks.length < MAX_MESSAGE_CHUNKS) {
    if (remaining.length <= DISCORD_MESSAGE_LIMIT) {
      chunks.push(remaining);
      remaining = '';
      break;
    }

    const isLastAllowedChunk = chunks.length === MAX_MESSAGE_CHUNKS - 1;
    const limit = isLastAllowedChunk
      ? DISCORD_MESSAGE_LIMIT - CHUNK_TRUNCATION_SUFFIX.length
      : DISCORD_MESSAGE_LIMIT;
    const window = remaining.slice(0, limit);

    let splitIndex = -1;
    for (const boundary of ['. ', '! ', '? ', '\n']) {
      const index = window.lastIndexOf(boundary);
      if (index > splitIndex) {
        splitIndex = index + boundary.length;
      }
    }

    if (splitIndex <= 0) {
      splitIndex = window.length;
    }

    let chunk = remaining.slice(0, splitIndex).trimEnd();
    remaining = remaining.slice(splitIndex).trimStart();

    if (isLastAllowedChunk && remaining.length > 0) {
      chunk = `${chunk}${CHUNK_TRUNCATION_SUFFIX}`;
      remaining = '';
    }

    chunks.push(chunk);
  }

  return chunks;
}

async function sendPossiblySplitReply(message, content) {
  const chunks = splitReplyIntoChunks(content);

  for (const chunk of chunks) {
    // eslint-disable-next-line no-await-in-loop
    await sendDirectMessage(message, chunk);
  }
}

function recordGlobalAiError(now = Date.now()) {
  globalAiErrorTimestamps.push(now);
  globalAiErrorTimestamps = globalAiErrorTimestamps.filter(
    (timestamp) => now - timestamp < GLOBAL_AI_ERROR_WINDOW_MS
  );
  return globalAiErrorTimestamps.length;
}

function shouldSendGlobalAiErrorAlert(now = Date.now()) {
  if (now - globalAiErrorAlertLastSentAt < GLOBAL_AI_ERROR_ALERT_THROTTLE_MS) {
    return false;
  }

  globalAiErrorAlertLastSentAt = now;
  return true;
}

async function maybeSendGlobalAiErrorAlert(client, errorMessage) {
  const now = Date.now();
  const recentErrorCount = recordGlobalAiError(now);

  if (recentErrorCount < GLOBAL_AI_ERROR_THRESHOLD) {
    return false;
  }

  if (!shouldSendGlobalAiErrorAlert(now)) {
    return false;
  }

  await sendDmChatGlobalErrorAlert(client, {
    recentErrorCount,
    windowMinutes: Math.round(GLOBAL_AI_ERROR_WINDOW_MS / 60000),
    lastErrorMessage: errorMessage,
  });
  return true;
}

function getMemberCache() {
  if (!global.__dmChatMemberCache) {
    global.__dmChatMemberCache = new Map();
  }
  return global.__dmChatMemberCache;
}

const MEMBER_CACHE_TTL_MS = 10 * 60 * 1000;

function isMemberOnlyEnabled() {
  return process.env.DM_CHAT_MEMBER_ONLY !== 'false';
}

async function isGuildMember(client, userId) {
  const guildId = process.env.GUILD_ID;

  if (!guildId) {
    return true;
  }

  const cache = getMemberCache();
  const cached = cache.get(userId);
  const now = Date.now();

  if (cached && now - cached.checkedAt < MEMBER_CACHE_TTL_MS) {
    return cached.isMember;
  }

  try {
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);

    if (!guild) {
      console.warn('[dm-chat] member check: guild not found, falling back to allow.');
      return true;
    }

    let member = guild.members.cache.get(userId);

    if (!member) {
      member = await guild.members.fetch(userId).catch((error) => {
        // Discord의 "알 수 없는 멤버" 오류는 정상적인 비멤버 판정이다.
        // 그 외 오류(네트워크/권한 등)는 상위 catch로 전달해 허용 쪽으로 폴백한다.
        if (error && (error.code === 10007 || error.code === 'UNKNOWN_MEMBER')) {
          return null;
        }
        throw error;
      });
    }

    const isMember = Boolean(member);
    cache.set(userId, { isMember, checkedAt: now });
    return isMember;
  } catch (error) {
    console.warn('[dm-chat] member check failed, falling back to allow:', error.message);
    return true;
  }
}

function getBurstLimitPerMinute() {
  const parsed = Number.parseInt(process.env.DM_CHAT_BURST_LIMIT_PER_MINUTE || `${DEFAULT_BURST_LIMIT_PER_MINUTE}`, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_BURST_LIMIT_PER_MINUTE;
  }

  return parsed;
}

function isBurstLimitReached(repository, userId, now = new Date()) {
  const limit = getBurstLimitPerMinute();

  if (limit <= 0) {
    return false;
  }

  if (!repository || typeof repository.countRecentUserMessages !== 'function') {
    return false;
  }

  const since = new Date(now.getTime() - BURST_WINDOW_MS);
  return repository.countRecentUserMessages(userId, since, now) > limit;
}

function shouldSendBurstNotice(userId, now = Date.now()) {
  const lastSentAt = burstLimitLastNoticeAt.get(userId);

  if (lastSentAt && now - lastSentAt < BURST_WINDOW_MS) {
    return false;
  }

  burstLimitLastNoticeAt.set(userId, now);
  return true;
}

function runSequential(userId, task) {
  const previous = userProcessingChains.get(userId) || Promise.resolve();
  const next = previous.then(task, task);
  const settled = next.catch(() => {});
  userProcessingChains.set(userId, settled);
  settled.finally(() => {
    if (userProcessingChains.get(userId) === settled) {
      userProcessingChains.delete(userId);
    }
  });
  return next;
}

function resetDmChatAccessControlStateForTest() {
  nonMemberNoticeSent.clear();
  burstLimitLastNoticeAt.clear();
  userProcessingChains.clear();
  getMemberCache().clear();
  globalAiErrorTimestamps = [];
  globalAiErrorAlertLastSentAt = 0;
}

function isDmChatEnabled() {
  return process.env.DM_CHAT_ENABLED === 'true';
}

function getDmChatDailyLimit() {
  const parsedLimit = Number.parseInt(process.env.DM_CHAT_DAILY_LIMIT || '30', 10);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 0) {
    return 30;
  }

  return parsedLimit;
}

function getTodayUserMessageCount(repository, userId) {
  if (!repository || typeof repository.countTodayUserMessages !== 'function') {
    return 0;
  }

  return repository.countTodayUserMessages(userId);
}

function isDailyLimitReached(todayUserMessageCount) {
  const dailyLimit = getDmChatDailyLimit();
  return dailyLimit > 0 && todayUserMessageCount >= dailyLimit;
}

function getDmChatConfigurationStatus() {
  const provider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();

  return {
    dmChatEnabled: isDmChatEnabled(),
    aiEnabled: process.env.AI_ENABLED === 'true',
    provider: provider || 'none',
    modelConfigured: Boolean(String(process.env.AI_MODEL || '').trim()),
    openAiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    dmLogChannelConfigured: Boolean(process.env.DM_CHAT_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID),
    safetyChannelConfigured: Boolean(
      process.env.SAFETY_ALERT_CHANNEL_ID
      || process.env.DM_CHAT_LOG_CHANNEL_ID
      || process.env.LOG_CHANNEL_ID
    ),
  };
}

function logDmChatConfiguration() {
  const status = getDmChatConfigurationStatus();

  console.info('[dm-chat] configuration', JSON.stringify(status));

  if (!status.dmChatEnabled) {
    console.info('[dm-chat] disabled: set DM_CHAT_ENABLED=true to receive DM practice messages.');
    return;
  }

  if (!status.aiEnabled) {
    console.warn('[dm-chat] AI is disabled: set AI_ENABLED=true for generated replies.');
  }

  if (status.provider === 'openai' && (!status.modelConfigured || !status.openAiKeyConfigured)) {
    console.warn('[dm-chat] OpenAI provider is selected but AI_MODEL or OPENAI_API_KEY is missing.');
  }

  if (!status.dmLogChannelConfigured) {
    console.warn('[dm-chat] no DM log channel configured: set DM_CHAT_LOG_CHANNEL_ID or LOG_CHANNEL_ID.');
  }
}

function isDirectUserDm(message) {
  return Boolean(
    message
    && message.channel
    && message.channel.type === ChannelType.DM
    && message.author
    && !message.author.bot
  );
}

function isDirectUserMessage(message) {
  return Boolean(
    isDirectUserDm(message)
    && typeof message.content === 'string'
    && message.content.trim()
  );
}

function getDisplayName(message) {
  return message.author.globalName || message.author.username || message.author.id;
}

function createUserRecord(message) {
  return {
    id: message.author.id,
    username: message.author.username || null,
    displayName: getDisplayName(message),
  };
}

async function sendDirectMessage(message, content) {
  await message.channel.send(content);
}

async function logAndNotify(client, repository, record) {
  await sendDmChatOperatorLog(client, record);
  return record;
}

async function handleSensitiveDmMessage(message, client, repository, userRecord, detection, userMessageRecord) {
  await sendDmChatSafetyAlert(client, userMessageRecord, detection);

  const reply = getSensitiveQuestionUserMessage(detection);
  const assistantRecord = repository.appendMessage({
    userId: userRecord.id,
    username: userRecord.username,
    displayName: userRecord.displayName,
    role: 'assistant',
    content: reply,
    safetyDetection: detection,
    safetyDetectionSource: 'input',
  });

  await logAndNotify(client, repository, assistantRecord);
  await sendDirectMessage(message, reply);
}

async function handleHistoryResetMessage(message, client, repository, userRecord, userMessageRecord) {
  repository.recordHistoryReset(userRecord, userMessageRecord.createdAt);

  const assistantRecord = repository.appendMessage({
    userId: userRecord.id,
    username: userRecord.username,
    displayName: userRecord.displayName,
    role: 'assistant',
    content: HISTORY_RESET_CONFIRMATION,
  });

  await logAndNotify(client, repository, assistantRecord);
  await sendDirectMessage(message, HISTORY_RESET_CONFIRMATION);
}

async function generateAndSendAiReply(message, client, repository, userRecord, userMessageRecord) {
  const historyLimit = Number.parseInt(process.env.DM_CHAT_HISTORY_LIMIT || '8', 10);
  const history = repository.listRecentMessages(userRecord.id, historyLimit)
    .filter((record) => record.id !== userMessageRecord.id);

  try {
    const result = await getDmChatReply({
      message: message.content,
      history,
      userDisplayName: userRecord.displayName,
    }, message.__dmChatAiOptions || {});
    const reply = result && typeof result === 'object' ? result.text : result;
    const usage = result && typeof result === 'object' ? result.usage : null;
    const outputDetection = reply ? detectSensitiveQuestion(reply) : null;
    const safeReply = outputDetection ? OUTPUT_SAFETY_FALLBACK : reply || CONFIGURATION_FALLBACK;
    const assistantRecord = repository.appendMessage({
      userId: userRecord.id,
      username: userRecord.username,
      displayName: userRecord.displayName,
      role: 'assistant',
      content: safeReply,
      safetyDetection: outputDetection,
      safetyDetectionSource: outputDetection ? 'output' : null,
      tokens: usage,
    });

    await logAndNotify(client, repository, assistantRecord);
    await sendDmChatReply(message, safeReply);
    console.info(`[dm-chat] replied to user=${userRecord.id}`);
    return true;
  } catch (error) {
    const fallback = '지금은 답변을 만드는 중에 문제가 생겼어요. 잠시 후 다시 말을 걸어 주세요.';
    const assistantRecord = repository.appendMessage({
      userId: userRecord.id,
      username: userRecord.username,
      displayName: userRecord.displayName,
      role: 'assistant',
      content: fallback,
      error: error.message,
    });

    await logAndNotify(client, repository, assistantRecord);
    await sendDirectMessage(message, fallback);
    console.warn('DM 대화 응답 생성 실패:', error.message);
    await maybeSendGlobalAiErrorAlert(client, error.message);
    return true;
  }
}

async function sendDmChatReply(message, content) {
  await sendPossiblySplitReply(message, content);
}

async function handleDmChatMessage(message, client, options = {}) {
  if (!isDirectUserDm(message)) {
    return false;
  }

  if (!isDmChatEnabled()) {
    console.info('[dm-chat] ignored DM because DM_CHAT_ENABLED is not true.');
    return false;
  }

  const repository = options.repository || createDmChatRepository();
  const userRecord = createUserRecord(message);

  if (isMemberOnlyEnabled()) {
    const isMember = await isGuildMember(client, userRecord.id);

    if (!isMember) {
      if (!nonMemberNoticeSent.has(userRecord.id)) {
        nonMemberNoticeSent.add(userRecord.id);
        await sendDirectMessage(message, NON_MEMBER_NOTICE);
        console.info(`[dm-chat] non-member DM from user=${userRecord.id}, sent notice once and will stay silent.`);
      } else {
        console.info(`[dm-chat] non-member DM from user=${userRecord.id}, staying silent.`);
      }
      return true;
    }
  }

  if (!isDirectUserMessage(message)) {
    console.warn(`[dm-chat] received DM event from user=${userRecord.id} but message content is empty. Check Discord Message Content Intent and DM payload permissions.`);
    await sendDirectMessage(message, '메시지를 받았지만 내용을 읽지 못했어요. 운영진이 봇의 Discord Message Content Intent 설정을 확인해야 합니다.');
    return true;
  }

  console.info(`[dm-chat] received DM from user=${userRecord.id}`);

  if (!repository.hasNotice(userRecord.id)) {
    await sendDirectMessage(message, buildFirstNotice());
    repository.recordNotice(userRecord);
  }

  const detection = detectSensitiveQuestion(message.content);
  const todayUserMessageCount = getTodayUserMessageCount(repository, userRecord.id);
  const userMessageRecord = repository.appendMessage({
    userId: userRecord.id,
    username: userRecord.username,
    displayName: userRecord.displayName,
    role: 'user',
    content: message.content,
    safetyDetection: detection,
    safetyDetectionSource: detection ? 'input' : null,
  });
  await logAndNotify(client, repository, userMessageRecord);

  if (detection) {
    // 안전 흐름은 어떤 제한(분당/순차 처리 포함)보다 우선한다.
    await handleSensitiveDmMessage(message, client, repository, userRecord, detection, userMessageRecord);
    return true;
  }

  if (message.content.trim() === HISTORY_RESET_TRIGGER) {
    await handleHistoryResetMessage(message, client, repository, userRecord, userMessageRecord);
    return true;
  }

  if (isBurstLimitReached(repository, userRecord.id)) {
    console.info(`[dm-chat] burst limit reached for user=${userRecord.id}`);

    if (shouldSendBurstNotice(userRecord.id)) {
      const assistantRecord = repository.appendMessage({
        userId: userRecord.id,
        username: userRecord.username,
        displayName: userRecord.displayName,
        role: 'assistant',
        content: BURST_LIMIT_FALLBACK,
      });

      await logAndNotify(client, repository, assistantRecord);
      await sendDirectMessage(message, BURST_LIMIT_FALLBACK);
    }

    return true;
  }

  if (isDailyLimitReached(todayUserMessageCount)) {
    const assistantRecord = repository.appendMessage({
      userId: userRecord.id,
      username: userRecord.username,
      displayName: userRecord.displayName,
      role: 'assistant',
      content: DAILY_LIMIT_FALLBACK,
    });

    await logAndNotify(client, repository, assistantRecord);
    await sendDirectMessage(message, DAILY_LIMIT_FALLBACK);
    console.info(`[dm-chat] daily limit reached for user=${userRecord.id}`);
    return true;
  }

  message.__dmChatAiOptions = options.ai || {};

  try {
    await message.channel.sendTyping();
  } catch (error) {
    // 타이핑 표시 실패는 무시한다 (응답 자체에는 영향 없음).
  }

  await runSequential(userRecord.id, () => (
    generateAndSendAiReply(message, client, repository, userRecord, userMessageRecord)
  ));

  return true;
}

module.exports = {
  BURST_LIMIT_FALLBACK,
  FIRST_NOTICE,
  HISTORY_RESET_CONFIRMATION,
  HISTORY_RESET_TRIGGER,
  NON_MEMBER_NOTICE,
  buildFirstNotice,
  getDmChatConfigurationStatus,
  handleDmChatMessage,
  isDirectUserDm,
  isDirectUserMessage,
  logDmChatConfiguration,
  resetDmChatAccessControlStateForTest,
  splitReplyIntoChunks,
};

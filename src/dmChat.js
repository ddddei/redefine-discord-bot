const { ChannelType } = require('discord.js');
const { getDmChatReply } = require('./ai');
const { createDmChatRepository } = require('./dmChatRepository');
const {
  sendDmChatOperatorLog,
  sendDmChatSafetyAlert,
} = require('./dmChatLogging');
const { detectSensitiveQuestion, getSensitiveQuestionUserMessage } = require('./safety');

const FIRST_NOTICE = [
  '리디파인 DM 대화 연습을 시작할게요.',
  '',
  '이 DM은 참가자 보호와 운영 지원을 위해 기록되며 운영진이 확인할 수 있어요.',
  '자해, 폭력, 괴롭힘, 긴급한 위험과 관련된 내용은 빠른 도움을 위해 운영진에게 전달될 수 있습니다.',
  '',
  '이 봇은 상담이나 진단을 하지 않고, 사람들과 대화하기 전 짧게 연습하는 용도로만 도와드려요.',
].join('\n');

const CONFIGURATION_FALLBACK = [
  '지금은 DM 대화 기능을 준비 중이에요.',
  '운영진이 OpenAI API 설정을 마치면 여기서 짧은 대화 연습을 할 수 있습니다.',
].join('\n');

const DAILY_LIMIT_FALLBACK = '오늘은 연습을 충분히 했어요. 내일 다시 이어서 연습해요. 급한 일이나 어려운 일이 있다면 운영진에게 문의해 주세요.';
const OUTPUT_SAFETY_FALLBACK = '지금은 답변을 만들지 못했어요. 잠시 후 다시 말을 걸어 주세요.';
const HISTORY_RESET_TRIGGER = '새로 시작';
const HISTORY_RESET_CONFIRMATION = '좋아요, 새 마음으로 다시 시작해요. 편하게 말을 걸어 주세요.';

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

  if (!isDirectUserMessage(message)) {
    console.warn(`[dm-chat] received DM event from user=${userRecord.id} but message content is empty. Check Discord Message Content Intent and DM payload permissions.`);
    await sendDirectMessage(message, '메시지를 받았지만 내용을 읽지 못했어요. 운영진이 봇의 Discord Message Content Intent 설정을 확인해야 합니다.');
    return true;
  }

  console.info(`[dm-chat] received DM from user=${userRecord.id}`);

  if (!repository.hasNotice(userRecord.id)) {
    await sendDirectMessage(message, FIRST_NOTICE);
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
    await handleSensitiveDmMessage(message, client, repository, userRecord, detection, userMessageRecord);
    return true;
  }

  if (message.content.trim() === HISTORY_RESET_TRIGGER) {
    await handleHistoryResetMessage(message, client, repository, userRecord, userMessageRecord);
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

  const historyLimit = Number.parseInt(process.env.DM_CHAT_HISTORY_LIMIT || '8', 10);
  const history = repository.listRecentMessages(userRecord.id, historyLimit)
    .filter((record) => record.id !== userMessageRecord.id);

  try {
    const reply = await getDmChatReply({
      message: message.content,
      history,
      userDisplayName: userRecord.displayName,
    }, options.ai || {});
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
    });

    await logAndNotify(client, repository, assistantRecord);
    await sendDirectMessage(message, safeReply);
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
    return true;
  }
}

module.exports = {
  FIRST_NOTICE,
  HISTORY_RESET_CONFIRMATION,
  HISTORY_RESET_TRIGGER,
  getDmChatConfigurationStatus,
  handleDmChatMessage,
  isDirectUserDm,
  isDirectUserMessage,
  logDmChatConfiguration,
};

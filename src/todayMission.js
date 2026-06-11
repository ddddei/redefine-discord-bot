const { sendMissionSubmissionReviewAlert } = require('./logging');
const { createPointsRepository, getKoreanDateString } = require('./pointsRepository');

const DEFAULT_DAILY_MISSION_REWARD_POINTS = 20;
const TODAY_MISSION_RECEIPT_EMOJI = '🌱';
const TODAY_MISSION_DM_FAILED_EMOJI = '⚠️';

let warnedMissingTodayMissionChannel = false;

function getTodayMissionChannelId() {
  return process.env.TODAY_MISSION_CHANNEL_ID || '';
}

function isTodayMissionChannel(channelId) {
  const configuredChannelId = getTodayMissionChannelId();

  if (!configuredChannelId) {
    if (!warnedMissingTodayMissionChannel) {
      console.warn('TODAY_MISSION_CHANNEL_ID가 설정되지 않아 오늘의 미션 자동 접수를 건너뜁니다.');
      warnedMissingTodayMissionChannel = true;
    }
    return false;
  }

  return channelId === configuredChannelId;
}

function getDailyMissionRewardPoints() {
  const parsed = Number.parseInt(
    process.env.DAILY_MISSION_REWARD_POINTS || String(DEFAULT_DAILY_MISSION_REWARD_POINTS),
    10
  );

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_MISSION_REWARD_POINTS;
  }

  return parsed;
}

function hasAttachment(message) {
  return Boolean(message && message.attachments && typeof message.attachments.size === 'number' && message.attachments.size > 0);
}

function getAttachmentUrls(message) {
  if (!message || !message.attachments || typeof message.attachments.values !== 'function') {
    return [];
  }

  return Array.from(message.attachments.values())
    .map((attachment) => attachment && attachment.url)
    .filter(Boolean);
}

function shouldIgnoreTodayMissionMessage(message, client) {
  if (!message) return true;
  if (!isTodayMissionChannel(message.channelId)) return true;
  if (!message.author) return true;
  if (message.author.bot) return true;
  if (client && client.user && message.author.id === client.user.id) return true;
  if (message.webhookId) return true;

  const content = typeof message.content === 'string' ? message.content.trim() : '';
  if (!content && !hasAttachment(message)) return true;

  return false;
}

function buildMessageUrl(guildId, channelId, messageId) {
  if (!guildId || !channelId || !messageId) {
    return null;
  }

  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function getDisplayName(message) {
  return (message.member && (message.member.displayName || message.member.nickname))
    || (message.author && (message.author.globalName || message.author.username || message.author.id))
    || 'unknown';
}

function buildTodayMissionReceiptText(rewardPoints) {
  return `좋아요, 오늘의 미션 인증이 접수됐어요 🌱\n운영자가 확인한 뒤 ${rewardPoints}P가 지급돼요.\n오늘의 미션 포인트는 하루 1회만 지급됩니다.`;
}

async function addTodayMissionReceiptReaction(message, emoji, failureLabel) {
  if (!message || typeof message.react !== 'function') {
    return false;
  }

  try {
    await message.react(emoji);
    return true;
  } catch (error) {
    console.warn(`${failureLabel}:`, error.message);
    return false;
  }
}

async function sendTodayMissionReceipt(message, rewardPoints) {
  await addTodayMissionReceiptReaction(
    message,
    TODAY_MISSION_RECEIPT_EMOJI,
    '오늘의 미션 접수 확인 반응 추가 실패'
  );

  if (!message || !message.author || typeof message.author.send !== 'function') {
    console.warn('오늘의 미션 접수 안내 DM 전송 실패: DM 전송 함수를 사용할 수 없습니다.');
    await addTodayMissionReceiptReaction(
      message,
      TODAY_MISSION_DM_FAILED_EMOJI,
      '오늘의 미션 DM 실패 반응 추가 실패'
    );
    return false;
  }

  try {
    await message.author.send(buildTodayMissionReceiptText(rewardPoints));
    return true;
  } catch (error) {
    console.warn('오늘의 미션 접수 안내 DM 전송 실패:', error.message);
    await addTodayMissionReceiptReaction(
      message,
      TODAY_MISSION_DM_FAILED_EMOJI,
      '오늘의 미션 DM 실패 반응 추가 실패'
    );
    return false;
  }
}

async function handleTodayMissionMessageCreate(message, client, options = {}) {
  try {
    if (shouldIgnoreTodayMissionMessage(message, client)) {
      return { ok: false, reason: 'IGNORED_MESSAGE' };
    }

    const repository = options.repository || createPointsRepository(options.paths, {
      googleSheetsLogger: options.googleSheetsLogger,
    });
    const attachmentUrls = getAttachmentUrls(message);
    const result = repository.createTodayMissionSubmission({
      user: {
        userId: message.author.id,
        displayName: getDisplayName(message),
      },
      content: typeof message.content === 'string' ? message.content : '',
      attachmentCount: message.attachments && typeof message.attachments.size === 'number'
        ? message.attachments.size
        : 0,
      attachmentUrls,
      channelId: message.channelId,
      guildId: message.guildId,
      messageId: message.id,
      messageUrl: buildMessageUrl(message.guildId, message.channelId, message.id),
      rewardPoints: getDailyMissionRewardPoints(),
      todayMissionDate: getKoreanDateString(),
    });

    if (!result.ok) {
      return result;
    }

    await sendMissionSubmissionReviewAlert({ client: client || message.client }, result.submission, result.mission);
    await sendTodayMissionReceipt(message, result.submission.rewardPoints || getDailyMissionRewardPoints());
    return result;
  } catch (error) {
    console.warn('오늘의 미션 자동 접수 처리 실패:', error.message);
    return { ok: false, reason: 'ERROR', error };
  }
}

module.exports = {
  addTodayMissionReceiptReaction,
  buildTodayMissionReceiptText,
  getDailyMissionRewardPoints,
  handleTodayMissionMessageCreate,
  isTodayMissionChannel,
  sendTodayMissionReceipt,
  shouldIgnoreTodayMissionMessage,
};

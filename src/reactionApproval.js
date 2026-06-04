const { PermissionFlagsBits } = require('discord.js');
const { sendMissionReactionApprovalLog } = require('./logging');
const { createPointsRepository } = require('./pointsRepository');

const DEFAULT_APPROVE_EMOJI = '✅';
const DEFAULT_REJECT_EMOJI = '❌';
const DEFAULT_REWARD_POINTS = 20;
const DEFAULT_PUBLIC_REPLY_ENABLED = false;
const DEFAULT_DM_USER_ENABLED = true;

let warnedMissingSubmissionChannel = false;

function getConfiguredApproveEmoji() {
  return process.env.MISSION_APPROVE_EMOJI || DEFAULT_APPROVE_EMOJI;
}

function getConfiguredRejectEmoji() {
  return process.env.MISSION_REJECT_EMOJI || DEFAULT_REJECT_EMOJI;
}

function getEmojiText(emoji) {
  if (!emoji) return '';
  if (typeof emoji === 'string') return emoji;
  return emoji.name || emoji.identifier || '';
}

function isApprovalEmoji(emoji) {
  return getEmojiText(emoji) === getConfiguredApproveEmoji();
}

function isRejectEmoji(emoji) {
  return getEmojiText(emoji) === getConfiguredRejectEmoji();
}

function isMissionSubmissionChannel(channelId) {
  if (channelId && process.env.TODAY_MISSION_CHANNEL_ID && channelId === process.env.TODAY_MISSION_CHANNEL_ID) {
    return false;
  }

  const submissionChannelId = process.env.MISSION_SUBMISSION_CHANNEL_ID;

  if (!submissionChannelId) {
    if (!warnedMissingSubmissionChannel) {
      console.warn('MISSION_SUBMISSION_CHANNEL_ID가 설정되지 않아 미션 인증 반응 승인 기능을 건너뜁니다.');
      warnedMissingSubmissionChannel = true;
    }
    return false;
  }

  return channelId === submissionChannelId;
}

function getReactionRewardPoints() {
  const rawValue = process.env.MISSION_REACTION_REWARD_POINTS;
  const parsed = Number.parseInt(rawValue || String(DEFAULT_REWARD_POINTS), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_REWARD_POINTS;
  }

  return parsed;
}

function parseBooleanEnv(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return value === 'true';
}

function shouldSendReactionApprovalPublicReply() {
  return parseBooleanEnv(process.env.REACTION_APPROVAL_PUBLIC_REPLY, DEFAULT_PUBLIC_REPLY_ENABLED);
}

function shouldDmReactionApprovalUser() {
  return parseBooleanEnv(process.env.REACTION_APPROVAL_DM_USER, DEFAULT_DM_USER_ENABLED);
}

function buildMessageUrl(guildId, channelId, messageId) {
  if (!guildId || !channelId || !messageId) {
    return null;
  }

  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function isOperatorMember(member) {
  if (!member) return false;

  if (member.permissions && typeof member.permissions.has === 'function') {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  }

  const operatorRoleId = process.env.OPERATOR_ROLE_ID;
  if (!operatorRoleId || !member.roles || !member.roles.cache) {
    return false;
  }

  if (typeof member.roles.cache.has === 'function') {
    return member.roles.cache.has(operatorRoleId);
  }

  return false;
}

function shouldIgnoreReaction(reaction, user) {
  if (!reaction || !user) return true;
  if (user.bot) return true;
  if (!isApprovalEmoji(reaction.emoji) && !isRejectEmoji(reaction.emoji)) return true;
  return false;
}

async function fetchPartial(value) {
  if (value && value.partial && typeof value.fetch === 'function') {
    return value.fetch();
  }

  return value;
}

async function fetchReactionContext(reaction, user) {
  const fullReaction = await fetchPartial(reaction);
  const fullUser = await fetchPartial(user);
  const message = await fetchPartial(fullReaction.message);

  return {
    reaction: fullReaction,
    user: fullUser,
    message,
  };
}

function getDisplayName(member, user) {
  return (member && (member.displayName || member.nickname))
    || (user && (user.globalName || user.username || user.id))
    || 'unknown';
}

async function sendReviewReply(message, text) {
  if (!shouldSendReactionApprovalPublicReply()) {
    return false;
  }

  if (!message || typeof message.reply !== 'function') {
    return false;
  }

  try {
    await message.reply({ content: text, allowedMentions: { repliedUser: false } });
    return true;
  } catch (error) {
    console.warn('미션 인증 반응 답글 전송 실패:', error.message);
    return false;
  }
}

async function sendReviewDm(user, text) {
  if (!shouldDmReactionApprovalUser()) {
    return false;
  }

  if (!user || typeof user.send !== 'function') {
    return false;
  }

  try {
    await user.send(text);
    return true;
  } catch (error) {
    console.warn('미션 인증 반응 DM 전송 실패:', error.message);
    return false;
  }
}

async function fetchMember(message, user) {
  if (!message || !message.guild || !message.guild.members || typeof message.guild.members.fetch !== 'function') {
    return null;
  }

  return message.guild.members.fetch(user.id);
}

async function handleMissionReactionApproval(reaction, user, client, options = {}) {
  try {
    if (shouldIgnoreReaction(reaction, user)) {
      return { ok: false, reason: 'IGNORED_REACTION' };
    }

    const context = await fetchReactionContext(reaction, user);
    const message = context.message;
    const reactor = context.user;
    const emoji = getEmojiText(context.reaction.emoji);

    if (message && message.channelId && process.env.TODAY_MISSION_CHANNEL_ID && message.channelId === process.env.TODAY_MISSION_CHANNEL_ID) {
      return { ok: false, reason: 'TODAY_MISSION_CHANNEL_REACTION_APPROVAL_DISABLED' };
    }

    if (!message || !isMissionSubmissionChannel(message.channelId)) {
      return { ok: false, reason: 'NOT_MISSION_SUBMISSION_CHANNEL' };
    }

    if (client && client.user && reactor.id === client.user.id) {
      return { ok: false, reason: 'BOT_REACTION' };
    }

    const member = await fetchMember(message, reactor);
    if (!isOperatorMember(member)) {
      return { ok: false, reason: 'NOT_OPERATOR' };
    }

    if (!message.author || message.author.bot) {
      return { ok: false, reason: 'MESSAGE_AUTHOR_NOT_PARTICIPANT' };
    }

    if (message.author.id === reactor.id) {
      return { ok: false, reason: 'SELF_REVIEW' };
    }

    const repository = options.repository || createPointsRepository(options.paths);
    if (repository.hasReactionMessageBeenReviewed(message.id)) {
      return {
        ok: false,
        reason: 'ALREADY_REVIEWED',
        record: repository.findReactionApprovalByMessageId(message.id),
      };
    }

    const reviewerName = getDisplayName(member, reactor);
    const commonInput = {
      messageId: message.id,
      channelId: message.channelId,
      guildId: message.guildId,
      authorId: message.author.id,
      authorDisplayName: message.member && message.member.displayName
        ? message.member.displayName
        : (message.author.globalName || message.author.username || message.author.id),
      reviewedBy: reactor.id,
      reviewedByDisplayName: reviewerName,
      reviewEmoji: emoji,
      messageUrl: buildMessageUrl(message.guildId, message.channelId, message.id),
    };

    const result = isApprovalEmoji(emoji)
      ? repository.approveReactionMessage({
        ...commonInput,
        rewardPoints: getReactionRewardPoints(),
      })
      : repository.rejectReactionMessage(commonInput);

    if (!result.ok) {
      return result;
    }

    const approved = result.record.status === 'approved';
    const participantDmText = approved
      ? `확인됐어요. 여정 포인트 ${result.record.rewardPoints}P가 지급됐습니다.\n\`/포인트\`에서 현재 포인트를 확인할 수 있어요.`
      : '운영진이 확인했어요. 이번에는 포인트 지급 대상은 아니에요.\n`/포인트`에서 현재 포인트를 확인할 수 있어요.';
    const publicReplyText = approved
      ? `확인했어요. 여정 포인트 ${result.record.rewardPoints}P가 지급됐습니다.`
      : '운영진이 확인했어요. 이번에는 포인트 지급 대상은 아니에요.';
    const notificationSettings = {
      dmUser: shouldDmReactionApprovalUser(),
      publicReply: shouldSendReactionApprovalPublicReply(),
    };

    await sendMissionReactionApprovalLog(client, {
      ...result.record,
      notificationSettings,
    });

    await sendReviewDm(message.author, participantDmText);
    await sendReviewReply(
      message,
      publicReplyText
    );

    return result;
  } catch (error) {
    console.error('미션 인증 반응 처리 실패:', error.message);
    return { ok: false, reason: 'ERROR', error };
  }
}

module.exports = {
  buildMessageUrl,
  fetchReactionContext,
  getReactionRewardPoints,
  handleMissionReactionApproval,
  isApprovalEmoji,
  isMissionSubmissionChannel,
  isOperatorMember,
  isRejectEmoji,
  sendReviewDm,
  sendReviewReply,
  shouldDmReactionApprovalUser,
  shouldIgnoreReaction,
  shouldSendReactionApprovalPublicReply,
};

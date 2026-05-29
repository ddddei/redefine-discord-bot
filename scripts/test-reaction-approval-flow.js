const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const {
  buildMessageUrl,
  getReactionRewardPoints,
  handleMissionReactionApproval,
  isApprovalEmoji,
  isMissionSubmissionChannel,
  isOperatorMember,
  isRejectEmoji,
} = require('../src/reactionApproval');
const { createPointsRepository } = require('../src/pointsRepository');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createTempPaths() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reaction-approval-'));
  const dataDir = path.join(__dirname, '..', 'data');

  return {
    points: path.join(tempDir, 'points.json'),
    pointsFallback: path.join(dataDir, 'points.example.json'),
    shopItems: path.join(tempDir, 'shop-items.json'),
    shopItemsFallback: path.join(dataDir, 'shop-items.example.json'),
    redemptions: path.join(tempDir, 'redemptions.json'),
    redemptionsFallback: path.join(dataDir, 'redemptions.example.json'),
    reactionApprovals: path.join(tempDir, 'reaction-approvals.json'),
  };
}

function createOperatorMember(roleIds = []) {
  return {
    displayName: '운영자 테스트',
    permissions: new PermissionsBitField(PermissionFlagsBits.ManageMessages),
    roles: {
      cache: {
        has: (roleId) => roleIds.includes(roleId),
      },
    },
  };
}

function createReaction({ messageId, authorId, emoji, channelId = 'mission_channel_test' }) {
  const message = {
    id: messageId,
    channelId,
    guildId: 'guild_test',
    author: {
      id: authorId,
      username: `participant_${authorId}`,
      bot: false,
    },
    member: {
      displayName: `참여자 ${authorId}`,
    },
    guild: {
      members: {
        fetch: async () => createOperatorMember(),
      },
    },
    replies: [],
    async reply(payload) {
      this.replies.push(payload);
      return payload;
    },
  };

  return {
    emoji: { name: emoji },
    message,
  };
}

async function main() {
  const previousEnv = {
    MISSION_APPROVE_EMOJI: process.env.MISSION_APPROVE_EMOJI,
    MISSION_REJECT_EMOJI: process.env.MISSION_REJECT_EMOJI,
    MISSION_REACTION_REWARD_POINTS: process.env.MISSION_REACTION_REWARD_POINTS,
    MISSION_SUBMISSION_CHANNEL_ID: process.env.MISSION_SUBMISSION_CHANNEL_ID,
    OPERATOR_ROLE_ID: process.env.OPERATOR_ROLE_ID,
  };

  process.env.MISSION_APPROVE_EMOJI = '✅';
  process.env.MISSION_REJECT_EMOJI = '❌';
  process.env.MISSION_REACTION_REWARD_POINTS = '';
  process.env.MISSION_SUBMISSION_CHANNEL_ID = 'mission_channel_test';
  process.env.OPERATOR_ROLE_ID = 'operator_role_test';

  try {
    assert.strictEqual(isApprovalEmoji('✅'), true);
    assert.strictEqual(isApprovalEmoji('❌'), false);
    assert.strictEqual(isRejectEmoji('❌'), true);
    assert.strictEqual(isRejectEmoji('✅'), false);
    assert.strictEqual(isMissionSubmissionChannel('mission_channel_test'), true);
    assert.strictEqual(isMissionSubmissionChannel('other_channel'), false);
    assert.strictEqual(
      buildMessageUrl('guild_test', 'mission_channel_test', 'message_test'),
      'https://discord.com/channels/guild_test/mission_channel_test/message_test'
    );
    assert.strictEqual(getReactionRewardPoints(), 20);

    process.env.MISSION_REACTION_REWARD_POINTS = '35';
    assert.strictEqual(getReactionRewardPoints(), 35);
    process.env.MISSION_REACTION_REWARD_POINTS = 'not-a-number';
    assert.strictEqual(getReactionRewardPoints(), 20);
    process.env.MISSION_REACTION_REWARD_POINTS = '20';

    assert.strictEqual(isOperatorMember(createOperatorMember()), true);
    assert.strictEqual(isOperatorMember({
      permissions: new PermissionsBitField(0n),
      roles: { cache: { has: (roleId) => roleId === 'operator_role_test' } },
    }), true);
    assert.strictEqual(isOperatorMember({
      permissions: new PermissionsBitField(0n),
      roles: { cache: { has: () => false } },
    }), false);

    const paths = createTempPaths();
    const repository = createPointsRepository(paths);
    const approved = repository.approveReactionMessage({
      messageId: 'message_direct_approve',
      channelId: 'mission_channel_test',
      guildId: 'guild_test',
      authorId: 'participant_direct_approve',
      authorDisplayName: '직접 승인 참여자',
      rewardPoints: 20,
      reviewedBy: 'operator_direct',
      reviewedByDisplayName: '직접 승인 운영자',
      reviewEmoji: '✅',
      messageUrl: buildMessageUrl('guild_test', 'mission_channel_test', 'message_direct_approve'),
    });

    assert.strictEqual(approved.ok, true);
    assert.strictEqual(approved.record.status, 'approved');
    assert.strictEqual(approved.transaction.type, 'earn');
    assert.strictEqual(approved.transaction.amount, 20);
    assert.strictEqual(approved.transaction.relatedType, 'missionReactionApproval');

    const duplicateApprove = repository.approveReactionMessage({
      messageId: 'message_direct_approve',
      channelId: 'mission_channel_test',
      guildId: 'guild_test',
      authorId: 'participant_direct_approve',
      authorDisplayName: '직접 승인 참여자',
      rewardPoints: 20,
      reviewedBy: 'operator_direct',
      reviewedByDisplayName: '직접 승인 운영자',
      reviewEmoji: '✅',
      messageUrl: buildMessageUrl('guild_test', 'mission_channel_test', 'message_direct_approve'),
    });

    assert.strictEqual(duplicateApprove.ok, false);
    assert.strictEqual(duplicateApprove.reason, 'ALREADY_REVIEWED');

    let pointsData = readJson(paths.points);
    assert.strictEqual(
      pointsData.pointTransactions.filter((transaction) => transaction.relatedId === 'message_direct_approve').length,
      1
    );

    const rejected = repository.rejectReactionMessage({
      messageId: 'message_direct_reject',
      channelId: 'mission_channel_test',
      guildId: 'guild_test',
      authorId: 'participant_direct_reject',
      authorDisplayName: '직접 반려 참여자',
      reviewedBy: 'operator_direct',
      reviewedByDisplayName: '직접 반려 운영자',
      reviewEmoji: '❌',
      messageUrl: buildMessageUrl('guild_test', 'mission_channel_test', 'message_direct_reject'),
    });

    assert.strictEqual(rejected.ok, true);
    assert.strictEqual(rejected.record.status, 'rejected');
    assert.strictEqual(rejected.transaction, null);

    const approveRejected = repository.approveReactionMessage({
      messageId: 'message_direct_reject',
      channelId: 'mission_channel_test',
      guildId: 'guild_test',
      authorId: 'participant_direct_reject',
      authorDisplayName: '직접 반려 참여자',
      rewardPoints: 20,
      reviewedBy: 'operator_direct',
      reviewedByDisplayName: '직접 승인 운영자',
      reviewEmoji: '✅',
      messageUrl: buildMessageUrl('guild_test', 'mission_channel_test', 'message_direct_reject'),
    });

    assert.strictEqual(approveRejected.ok, false);
    assert.strictEqual(approveRejected.reason, 'ALREADY_REVIEWED');

    pointsData = readJson(paths.points);
    assert.strictEqual(
      pointsData.pointTransactions.some((transaction) => transaction.relatedId === 'message_direct_reject'),
      false
    );

    const handlerPaths = createTempPaths();
    const handlerRepository = createPointsRepository(handlerPaths);
    const approveReaction = createReaction({
      messageId: 'message_handler_approve',
      authorId: 'participant_handler_approve',
      emoji: '✅',
    });
    const approveResult = await handleMissionReactionApproval(
      approveReaction,
      { id: 'operator_handler', username: 'operator_handler', bot: false },
      { user: { id: 'bot_test' } },
      { repository: handlerRepository }
    );

    assert.strictEqual(approveResult.ok, true);
    assert.strictEqual(approveResult.record.status, 'approved');
    assert.strictEqual(approveReaction.message.replies.length, 1);

    const duplicateHandlerResult = await handleMissionReactionApproval(
      approveReaction,
      { id: 'operator_handler', username: 'operator_handler', bot: false },
      { user: { id: 'bot_test' } },
      { repository: handlerRepository }
    );
    assert.strictEqual(duplicateHandlerResult.ok, false);
    assert.strictEqual(duplicateHandlerResult.reason, 'ALREADY_REVIEWED');

    const rejectReaction = createReaction({
      messageId: 'message_handler_reject',
      authorId: 'participant_handler_reject',
      emoji: '❌',
    });
    const rejectResult = await handleMissionReactionApproval(
      rejectReaction,
      { id: 'operator_handler', username: 'operator_handler', bot: false },
      { user: { id: 'bot_test' } },
      { repository: handlerRepository }
    );

    assert.strictEqual(rejectResult.ok, true);
    assert.strictEqual(rejectResult.record.status, 'rejected');
    assert.strictEqual(rejectReaction.message.replies.length, 1);

    console.log('reaction approval flow smoke test passed');
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

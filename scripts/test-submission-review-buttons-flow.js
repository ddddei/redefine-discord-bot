const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PermissionsBitField, PermissionFlagsBits } = require('discord.js');

const dataDir = path.join(__dirname, '..', 'data');

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function setupEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'submission-review-buttons-'));

  process.env.POINTS_DATA_PATH = path.join(tempDir, 'points.json');
  process.env.SHOP_ITEMS_DATA_PATH = path.join(tempDir, 'shop-items.json');
  process.env.REDEMPTIONS_DATA_PATH = path.join(tempDir, 'redemptions.json');
  process.env.MISSIONS_DATA_PATH = path.join(tempDir, 'missions.json');
  process.env.SUBMISSIONS_DATA_PATH = path.join(tempDir, 'submissions.json');
  process.env.REACTION_APPROVALS_DATA_PATH = path.join(tempDir, 'reaction-approvals.json');
  process.env.ACTIVITY_REVIEW_CHANNEL_ID = 'review_channel_test';
  process.env.LOG_CHANNEL_ID = '';

  return tempDir;
}

function createUser(id, username) {
  return { id, username };
}

function createMember(displayName, isOperator) {
  return {
    displayName,
    permissions: new PermissionsBitField(isOperator ? PermissionFlagsBits.ManageMessages : 0n),
  };
}

function createButtonInteraction(customId, message, isOperator = true) {
  return {
    customId,
    message,
    user: createUser(isOperator ? 'operator_button_test' : 'participant_button_test', isOperator ? '버튼 운영자' : '일반 참여자'),
    member: createMember(isOperator ? '버튼 운영자' : '일반 참여자', isOperator),
    client: {
      users: {
        async fetch(userId) {
          return {
            id: userId,
            sentMessages: [],
            async send(content) {
              this.sentMessages.push(content);
            },
          };
        },
      },
    },
    updatePayload: null,
    replyPayload: null,
    followUpPayload: null,
    isChatInputCommand() {
      return false;
    },
    isStringSelectMenu() {
      return false;
    },
    isButton() {
      return true;
    },
    isModalSubmit() {
      return false;
    },
    async update(payload) {
      this.updatePayload = payload;
    },
    async reply(payload) {
      this.replyPayload = payload;
    },
    async followUp(payload) {
      this.followUpPayload = payload;
    },
  };
}

async function main() {
  const tempDir = setupEnvironment();

  resetModule('../src/pointsRepository');
  resetModule('../src/logging');
  resetModule('../src/handlers');

  const { getUserPoints } = require('../src/pointsStore');
  const { createPointsRepository } = require('../src/pointsRepository');
  const { sendMissionSubmissionReviewAlert } = require('../src/logging');
  const { handleInteractionCreate } = require('../src/handlers');

  const repository = createPointsRepository();
  const mission = repository.createMission({
    title: '버튼 검토 테스트 미션',
    description: '버튼 검토 smoke test용 미션입니다.',
    rewardPoints: 25,
    requiresSubmission: true,
  });
  repository.setMissionStatus(mission.id, 'active');

  const submission = repository.createMissionSubmission({
    user: {
      userId: 'submission_button_user',
      displayName: '버튼 인증 사용자',
    },
    missionId: mission.id,
    content: '버튼으로 승인할 인증 내용',
  });
  assert.strictEqual(submission.ok, true);

  const sentMessages = [];
  const alertInteraction = {
    client: {
      channels: {
        async fetch(channelId) {
          assert.strictEqual(channelId, 'review_channel_test');
          return {
            async send(payload) {
              sentMessages.push(payload);
            },
          };
        },
      },
    },
  };

  await sendMissionSubmissionReviewAlert(alertInteraction, submission.submission, mission);
  assert.strictEqual(sentMessages.length, 1);
  assert.strictEqual(sentMessages[0].components.length, 1);
  const alertButtons = sentMessages[0].components[0].components.map((button) => button.toJSON());
  assert.deepStrictEqual(
    alertButtons.map((button) => button.custom_id),
    [
      `operator_submission_approve:${submission.submission.id}`,
      `operator_submission_reject:${submission.submission.id}`,
    ]
  );
  assert.deepStrictEqual(
    alertButtons.map((button) => button.label),
    ['승인하고 포인트 지급', '반려하기']
  );
  assert.match(
    sentMessages[0].embeds[0].data.fields.find((field) => field.name === '처리 안내').value,
    /아래 버튼으로 바로 처리/
  );

  const nonOperator = createButtonInteraction(
    `operator_submission_approve:${submission.submission.id}`,
    sentMessages[0],
    false
  );
  await handleInteractionCreate(nonOperator);
  assert.strictEqual(nonOperator.replyPayload.ephemeral, true);
  assert.match(nonOperator.replyPayload.content, /운영진만 처리/);

  const approveButton = createButtonInteraction(
    `operator_submission_approve:${submission.submission.id}`,
    sentMessages[0],
    true
  );
  await handleInteractionCreate(approveButton);
  assert.strictEqual(approveButton.updatePayload.components[0].components[0].toJSON().disabled, true);
  assert.strictEqual(approveButton.updatePayload.components[0].components[1].toJSON().disabled, true);
  assert.strictEqual(approveButton.updatePayload.embeds[0].data.title, '미션 인증 승인 완료');
  assert.strictEqual(approveButton.followUpPayload.ephemeral, true);
  assert.match(approveButton.followUpPayload.content, /승인 완료/);
  assert.match(approveButton.followUpPayload.content, /지급 포인트: 25P/);

  const pointsData = readJson(path.join(tempDir, 'points.json'));
  assert.strictEqual(getUserPoints(pointsData, 'submission_button_user'), 25);
  const submissionsData = readJson(path.join(tempDir, 'submissions.json'));
  assert.strictEqual(submissionsData.submissions.find((item) => item.id === submission.submission.id).status, 'approved');

  const duplicateButton = createButtonInteraction(
    `operator_submission_approve:${submission.submission.id}`,
    approveButton.updatePayload,
    true
  );
  await handleInteractionCreate(duplicateButton);
  assert.match(duplicateButton.followUpPayload.content, /이미 처리된 인증 제출/);
  assert.strictEqual(duplicateButton.updatePayload.components[0].components[0].toJSON().disabled, true);

  const rejectedSubmission = repository.createMissionSubmission({
    user: {
      userId: 'submission_reject_button_user',
      displayName: '버튼 반려 사용자',
    },
    missionId: mission.id,
    content: '버튼으로 반려할 인증 내용',
  });
  assert.strictEqual(rejectedSubmission.ok, true);

  const rejectButton = createButtonInteraction(
    `operator_submission_reject:${rejectedSubmission.submission.id}`,
    sentMessages[0],
    true
  );
  await handleInteractionCreate(rejectButton);
  assert.strictEqual(rejectButton.updatePayload.embeds[0].data.title, '미션 인증 반려 완료');
  assert.match(rejectButton.followUpPayload.content, /반려 완료/);

  const finalPointsData = readJson(path.join(tempDir, 'points.json'));
  assert.strictEqual(getUserPoints(finalPointsData, 'submission_reject_button_user'), 0);
  const finalSubmissionsData = readJson(path.join(tempDir, 'submissions.json'));
  assert.strictEqual(finalSubmissionsData.submissions.find((item) => item.id === rejectedSubmission.submission.id).status, 'rejected');

  console.log('submission review buttons flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

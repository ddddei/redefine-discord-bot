const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PermissionsBitField, PermissionFlagsBits } = require('discord.js');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

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
  process.env.TODAY_MISSION_CHANNEL_ID = 'today_mission_channel_test';
  process.env.DAILY_MISSION_REWARD_POINTS = '33';
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
  const sentDmMessages = [];
  const sentLogMessages = [];

  return {
    customId,
    message,
    sentDmMessages,
    sentLogMessages,
    user: createUser(isOperator ? 'operator_button_test' : 'participant_button_test', isOperator ? '버튼 운영자' : '일반 참여자'),
    member: createMember(isOperator ? '버튼 운영자' : '일반 참여자', isOperator),
    client: {
      channels: {
        async fetch(channelId) {
          assert.strictEqual(channelId, 'review_channel_test');
          return {
            async send(payload) {
              sentLogMessages.push(payload);
            },
          };
        },
      },
      users: {
        async fetch(userId) {
          return {
            id: userId,
            async send(content) {
              sentDmMessages.push({ userId, content });
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

function createOperationStatusInteraction(type = 'summary') {
  return {
    commandName: '운영현황',
    user: createUser('operator_button_test', '버튼 운영자'),
    member: createMember('버튼 운영자', true),
    options: {
      getString(name) {
        return name === '종류' ? type : null;
      },
      getInteger() {
        return 10;
      },
    },
    replyPayload: null,
    isChatInputCommand() {
      return true;
    },
    isStringSelectMenu() {
      return false;
    },
    isButton() {
      return false;
    },
    isModalSubmit() {
      return false;
    },
    async reply(payload) {
      this.replyPayload = payload;
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
  const { handleTodayMissionMessageCreate } = require('../src/todayMission');

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
    ['승인하고 지급', '반려하기']
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
  assert.match(
    approveButton.updatePayload.embeds[0].data.fields.find((field) => field.name === '처리 상태').value,
    /승인 완료/
  );
  assert.strictEqual(approveButton.followUpPayload.ephemeral, true);
  assert.match(approveButton.followUpPayload.content, /승인 완료/);
  assert.match(approveButton.followUpPayload.content, /지급 포인트: 25P/);
  assert.strictEqual(approveButton.sentDmMessages.length, 1);
  assert.strictEqual(approveButton.sentDmMessages[0].userId, 'submission_button_user');
  assert.match(approveButton.sentDmMessages[0].content, /미션 인증이 승인됐어요/);
  assert.match(approveButton.sentDmMessages[0].content, /25P가 지급됐어요/);
  assert.strictEqual(approveButton.sentLogMessages.length, 1);
  assert.strictEqual(approveButton.sentLogMessages[0].embeds[0].data.title, '미션 인증 버튼 승인');
  assert.match(
    approveButton.sentLogMessages[0].embeds[0].data.fields.find((field) => field.name === '처리 결과').value,
    /지급 완료 \(25P\)/
  );

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
  assert.strictEqual(duplicateButton.sentDmMessages.length, 0);
  assert.strictEqual(duplicateButton.sentLogMessages.length, 0);

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
  assert.strictEqual(rejectButton.sentDmMessages.length, 1);
  assert.match(rejectButton.sentDmMessages[0].content, /이번 인증은 반려됐어요/);
  assert.match(rejectButton.sentDmMessages[0].content, /안내 내용을 확인한 뒤 다시 제출해주세요/);
  assert.strictEqual(rejectButton.sentLogMessages.length, 1);
  assert.strictEqual(rejectButton.sentLogMessages[0].embeds[0].data.title, '미션 인증 버튼 반려');

  const finalPointsData = readJson(path.join(tempDir, 'points.json'));
  assert.strictEqual(getUserPoints(finalPointsData, 'submission_reject_button_user'), 0);
  const finalSubmissionsPath = path.join(tempDir, 'submissions.json');
  const finalSubmissionsData = readJson(finalSubmissionsPath);
  assert.strictEqual(finalSubmissionsData.submissions.find((item) => item.id === rejectedSubmission.submission.id).status, 'rejected');

  const todayMissionMessages = [];
  const todayMissionClient = {
    user: { id: 'bot_today_mission_test' },
    channels: {
      async fetch(channelId) {
        assert.strictEqual(channelId, 'review_channel_test');
        return {
          async send(payload) {
            todayMissionMessages.push(payload);
          },
        };
      },
    },
  };
  const ignoredEmptyMessage = await handleTodayMissionMessageCreate({
    id: 'today_empty_message',
    channelId: 'today_mission_channel_test',
    guildId: 'guild_today_test',
    content: '',
    attachments: { size: 0 },
    author: createUser('today_user_ignored', '빈 메시지 사용자'),
  }, todayMissionClient);
  assert.strictEqual(ignoredEmptyMessage.ok, false);
  assert.strictEqual(todayMissionMessages.length, 0);

  const ignoredBotMessage = await handleTodayMissionMessageCreate({
    id: 'today_bot_message',
    channelId: 'today_mission_channel_test',
    guildId: 'guild_today_test',
    content: '봇 공지',
    attachments: { size: 0 },
    author: { ...createUser('operator_bot_message', '운영자 봇'), bot: true },
  }, todayMissionClient);
  assert.strictEqual(ignoredBotMessage.ok, false);
  assert.strictEqual(todayMissionMessages.length, 0);

  const todayMissionSheetsEvents = [];
  const firstTodayReplies = [];
  const firstTodayReactions = [];
  const firstTodayDms = [];
  const firstTodaySubmission = await handleTodayMissionMessageCreate({
    id: 'today_message_001',
    channelId: 'today_mission_channel_test',
    guildId: 'guild_today_test',
    content: '오늘 산책 인증합니다.',
    attachments: {
      size: 2,
      values() {
        return [
          { url: 'https://cdn.discordapp.test/today-1.jpg' },
          { url: 'https://cdn.discordapp.test/today-2.jpg' },
        ][Symbol.iterator]();
      },
    },
    author: {
      ...createUser('today_mission_user', '오늘미션사용자'),
      async send(content) {
        firstTodayDms.push(content);
      },
    },
    member: createMember('오늘 미션 사용자', false),
    async react(emoji) {
      firstTodayReactions.push(emoji);
    },
    async reply(payload) {
      firstTodayReplies.push(payload);
    },
  }, todayMissionClient, {
    googleSheetsLogger: {
      logMissionSubmission(submission, mission) {
        todayMissionSheetsEvents.push({ submission, mission });
      },
    },
  });
  assert.strictEqual(firstTodaySubmission.ok, true);
  assert.strictEqual(firstTodaySubmission.submission.type, 'todayMission');
  assert.strictEqual(firstTodaySubmission.submission.rewardPoints, 33);
  assert.strictEqual(firstTodaySubmission.submission.attachmentCount, 2);
  assert.deepStrictEqual(firstTodayReactions, ['🌱']);
  assert.strictEqual(firstTodayReplies.length, 0);
  assert.strictEqual(firstTodayDms.length, 1);
  assert.match(firstTodayDms[0], /좋아요, 오늘의 미션 인증이 접수됐어요/);
  assert.match(firstTodayDms[0], /운영자가 확인한 뒤 33P가 지급돼요/);
  assert.match(firstTodayDms[0], /오늘의 미션 포인트는 하루 1회만 지급됩니다/);
  assert.strictEqual(todayMissionSheetsEvents.length, 1);
  assert.strictEqual(todayMissionSheetsEvents[0].submission.id, firstTodaySubmission.submission.id);
  assert.deepStrictEqual(todayMissionSheetsEvents[0].submission.attachmentUrls, [
    'https://cdn.discordapp.test/today-1.jpg',
    'https://cdn.discordapp.test/today-2.jpg',
  ]);
  assert.strictEqual(todayMissionMessages.length, 1);
  assert.strictEqual(todayMissionMessages[0].embeds[0].data.title, '오늘의 미션 인증 후보');
  assert.match(
    todayMissionMessages[0].embeds[0].data.fields.find((field) => field.name === '원본 메시지').value,
    /https:\/\/discord.com\/channels\/guild_today_test\/today_mission_channel_test\/today_message_001/
  );
  assert.strictEqual(
    todayMissionMessages[0].embeds[0].data.fields.find((field) => field.name === '첨부파일 개수').value,
    '2개'
  );
  assert.deepStrictEqual(
    todayMissionMessages[0].components[0].components.map((button) => button.toJSON().label),
    ['승인하고 지급', '반려하기']
  );

  const approveTodayButton = createButtonInteraction(
    `operator_submission_approve:${firstTodaySubmission.submission.id}`,
    todayMissionMessages[0],
    true
  );
  await handleInteractionCreate(approveTodayButton);
  assert.match(approveTodayButton.followUpPayload.content, /지급 포인트: 33P/);
  assert.match(approveTodayButton.sentDmMessages[0].content, /오늘의 미션 인증이 승인됐어요/);
  assert.match(approveTodayButton.sentDmMessages[0].content, /33P가 지급됐어요/);
  assert.strictEqual(approveTodayButton.sentLogMessages[0].embeds[0].data.title, '미션 인증 버튼 승인');
  assert.match(
    approveTodayButton.sentLogMessages[0].embeds[0].data.fields.find((field) => field.name === '처리 결과').value,
    /지급 완료 \(33P\)/
  );

  const secondTodaySubmission = await handleTodayMissionMessageCreate({
    id: 'today_message_002',
    channelId: 'today_mission_channel_test',
    guildId: 'guild_today_test',
    content: '',
    attachments: { size: 1 },
    author: {
      ...createUser('today_mission_user', '오늘미션사용자'),
      async send() {},
    },
    member: createMember('오늘 미션 사용자', false),
    async react() {},
  }, todayMissionClient);
  assert.strictEqual(secondTodaySubmission.ok, true);
  assert.strictEqual(todayMissionMessages.length, 2);

  const duplicateTodayButton = createButtonInteraction(
    `operator_submission_approve:${secondTodaySubmission.submission.id}`,
    todayMissionMessages[1],
    true
  );
  await handleInteractionCreate(duplicateTodayButton);
  assert.match(duplicateTodayButton.followUpPayload.content, /이미 오늘 지급 완료/);
  assert.match(
    duplicateTodayButton.updatePayload.embeds[0].data.fields.find((field) => field.name === '처리 상태').value,
    /이미 오늘 지급 완료/
  );
  assert.match(duplicateTodayButton.sentDmMessages[0].content, /이미 지급되어 추가 지급은 없어요/);

  const dmFailureReactions = [];
  const dmFailureReplies = [];
  const warnMessages = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnMessages.push(args.join(' '));
  let dmFailureSubmission;

  try {
    dmFailureSubmission = await handleTodayMissionMessageCreate({
      id: 'today_message_dm_failure',
      channelId: 'today_mission_channel_test',
      guildId: 'guild_today_test',
      content: 'DM 실패 테스트 인증입니다.',
      attachments: { size: 1 },
      author: {
        ...createUser('today_mission_dm_failure_user', 'DM실패사용자'),
        async send() {
          throw new Error('DM blocked');
        },
      },
      member: createMember('DM 실패 사용자', false),
      async react(emoji) {
        dmFailureReactions.push(emoji);
      },
      async reply(payload) {
        dmFailureReplies.push(payload);
      },
    }, todayMissionClient, {
      googleSheetsLogger: {
        logMissionSubmission(submission, mission) {
          todayMissionSheetsEvents.push({ submission, mission });
        },
      },
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.strictEqual(dmFailureSubmission.ok, true);
  assert.deepStrictEqual(dmFailureReactions, ['🌱', '⚠️']);
  assert.strictEqual(dmFailureReplies.length, 0);
  assert.strictEqual(todayMissionMessages.length, 3);
  assert.strictEqual(todayMissionSheetsEvents[todayMissionSheetsEvents.length - 1].submission.id, dmFailureSubmission.submission.id);
  assert.ok(warnMessages.some((message) => /오늘의 미션 접수 안내 DM 전송 실패/.test(message)));

  const rejectDmFailureButton = createButtonInteraction(
    `operator_submission_reject:${dmFailureSubmission.submission.id}`,
    todayMissionMessages[2],
    true
  );
  await handleInteractionCreate(rejectDmFailureButton);
  assert.match(rejectDmFailureButton.followUpPayload.content, /반려 완료/);

  const todayPointsData = readJson(path.join(tempDir, 'points.json'));
  assert.strictEqual(getUserPoints(todayPointsData, 'today_mission_user'), 33);
  const todaySubmissionsData = readJson(finalSubmissionsPath);
  assert.strictEqual(
    todaySubmissionsData.submissions.find((item) => item.id === secondTodaySubmission.submission.id).duplicateRewardBlocked,
    true
  );

  const checkin = repository.createCheckin({
    user: {
      userId: 'submission_button_checkin_user',
      displayName: '체크인 사용자',
    },
    content: '인증 처리 카운트에 포함되면 안 되는 체크인',
    checkinDate: '2030-06-04',
  });
  assert.strictEqual(checkin.ok, true);
  const submissionsWithMalformedCheckin = readJson(finalSubmissionsPath);
  submissionsWithMalformedCheckin.submissions.push({
    id: 'checkin_pending_malformed',
    type: 'checkin',
    missionId: null,
    userId: 'submission_button_checkin_user',
    displayName: '체크인 사용자',
    content: '수동 데이터 오류로 대기 상태가 된 체크인',
    checkinDate: '2030-06-05',
    status: 'pending',
    reviewedBy: null,
    createdAt: '2030-06-05T00:00:00.000Z',
    reviewedAt: null,
    rewardTransactionId: null,
    note: null,
  });
  fs.writeFileSync(finalSubmissionsPath, JSON.stringify(submissionsWithMalformedCheckin, null, 2));

  const operationSummary = createOperationStatusInteraction('summary');
  await handleInteractionCreate(operationSummary);
  assert.strictEqual(operationSummary.replyPayload.ephemeral, true);
  assert.match(operationSummary.replyPayload.embeds[0].data.description, /인증 대기: 0건/);
  assert.match(operationSummary.replyPayload.embeds[0].data.description, /인증 처리: 승인 3건 \/ 반려 2건/);

  const pendingSubmissions = createOperationStatusInteraction('pendingSubmissions');
  await handleInteractionCreate(pendingSubmissions);
  assert.match(pendingSubmissions.replyPayload.embeds[0].data.description, /표시할 인증 대기 건이 없어요/);

  console.log('submission review buttons flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function createOptions(values) {
  return {
    getString(name) {
      return Object.hasOwn(values, name) ? values[name] : null;
    },
    getInteger(name) {
      return Object.hasOwn(values, name) ? values[name] : null;
    },
    getBoolean(name) {
      return Object.hasOwn(values, name) ? values[name] : null;
    },
    getUser(name) {
      return Object.hasOwn(values, name) ? values[name] : null;
    },
  };
}

function createUser(id, username) {
  return { id, username };
}

function createMember(displayName) {
  return {
    displayName,
    permissions: {
      has() {
        return false;
      },
    },
  };
}

function createChatInputInteraction(commandName, optionValues, userId, displayName) {
  const interaction = {
    commandName,
    user: createUser(userId, displayName),
    member: createMember(displayName),
    options: createOptions(optionValues),
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

  return interaction;
}

function createSelectInteraction(customId, values, userId, displayName) {
  return {
    customId,
    values,
    user: createUser(userId, displayName),
    member: createMember(displayName),
    updatePayload: null,
    modal: null,
    replyPayload: null,
    isChatInputCommand() {
      return false;
    },
    isStringSelectMenu() {
      return true;
    },
    isButton() {
      return false;
    },
    isModalSubmit() {
      return false;
    },
    async update(payload) {
      this.updatePayload = payload;
    },
    async showModal(modal) {
      this.modal = modal;
    },
    async reply(payload) {
      this.replyPayload = payload;
    },
  };
}

function createButtonInteraction(customId, userId, displayName) {
  return {
    customId,
    user: createUser(userId, displayName),
    member: createMember(displayName),
    updatePayload: null,
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
  };
}

function createModalInteraction(customId, content, userId, displayName) {
  return {
    customId,
    user: createUser(userId, displayName),
    member: createMember(displayName),
    fields: {
      getTextInputValue(name) {
        assert.strictEqual(name, 'content');
        return content;
      },
    },
    replyPayload: null,
    isChatInputCommand() {
      return false;
    },
    isStringSelectMenu() {
      return false;
    },
    isButton() {
      return false;
    },
    isModalSubmit() {
      return true;
    },
    async reply(payload) {
      this.replyPayload = payload;
    },
  };
}

function getEmbedTitle(payload) {
  return payload.embeds[0].data.title;
}

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'participant-ux-flow-'));
  const dataDir = path.join(__dirname, '..', 'data');
  const paths = {
    points: path.join(tempDir, 'points.json'),
    shopItems: path.join(tempDir, 'shop-items.json'),
    redemptions: path.join(tempDir, 'redemptions.json'),
    missions: path.join(tempDir, 'missions.json'),
    submissions: path.join(tempDir, 'submissions.json'),
  };

  writeJson(paths.points, {
    isExample: false,
    users: [
      { userId: 'ux_user_shop', displayName: '상점 UX 사용자', totalPoints: 250, status: 'active' },
      { userId: 'ux_user_code', displayName: '코드 UX 사용자', totalPoints: 250, status: 'active' },
    ],
    pointTransactions: [],
  });
  writeJson(paths.shopItems, {
    isExample: false,
    shopItems: [
      {
        id: 'item_ux_active',
        name: 'UX 테스트 리워드',
        description: '선택 메뉴와 확인 버튼 테스트 항목입니다.',
        cost: 100,
        stock: 3,
        monthlyLimit: 1,
        status: 'active',
        type: 'reward',
      },
    ],
  });
  writeJson(paths.redemptions, { isExample: false, redemptions: [] });
  writeJson(paths.missions, {
    isExample: false,
    missions: [
      {
        id: 'mission_ux_active',
        title: 'UX 테스트 미션',
        description: '선택 메뉴와 인증 모달 테스트 미션입니다.',
        rewardPoints: 15,
        activeDate: '2030-07-01',
        status: 'active',
        requiresSubmission: true,
        maxPerUser: 1,
      },
    ],
  });
  writeJson(paths.submissions, { isExample: false, submissions: [] });

  process.env.POINTS_DATA_PATH = paths.points;
  process.env.SHOP_ITEMS_DATA_PATH = paths.shopItems;
  process.env.REDEMPTIONS_DATA_PATH = paths.redemptions;
  process.env.MISSIONS_DATA_PATH = paths.missions;
  process.env.SUBMISSIONS_DATA_PATH = paths.submissions;
  process.env.POINTS_DATA_FALLBACK = path.join(dataDir, 'points.example.json');

  resetModule('../src/pointsRepository');
  resetModule('../src/handlers');
  const { handleInteractionCreate } = require('../src/handlers');

  return Promise.resolve()
    .then(async () => {
      const shopCommand = createChatInputInteraction('상점', {}, 'ux_user_shop', '상점 UX 사용자');
      await handleInteractionCreate(shopCommand);
      assert.strictEqual(shopCommand.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(shopCommand.replyPayload), '여정 포인트 상점');
      assert.match(shopCommand.replyPayload.embeds[0].data.fields[0].name, /S001/);
      assert.strictEqual(shopCommand.replyPayload.components.length, 1);

      const shopSelect = createSelectInteraction(
        'participant_shop_select',
        ['S001'],
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(shopSelect);
      assert.strictEqual(getEmbedTitle(shopSelect.updatePayload), '교환 신청 확인');
      assert.match(shopSelect.updatePayload.embeds[0].data.description, /S001/);
      assert.strictEqual(shopSelect.updatePayload.components.length, 1);

      const redeemButton = createButtonInteraction(
        'participant_redeem_confirm:S001',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(redeemButton);
      assert.strictEqual(getEmbedTitle(redeemButton.updatePayload), '교환 신청이 접수됐어요');
      assert.match(redeemButton.updatePayload.embeds[0].data.description, /S001/);
      assert.strictEqual(redeemButton.updatePayload.components.length, 0);

      const redemptionsData = readJson(paths.redemptions);
      assert.strictEqual(redemptionsData.redemptions.length, 1);
      assert.strictEqual(redemptionsData.redemptions[0].itemId, 'item_ux_active');
      assert.strictEqual(redemptionsData.redemptions[0].status, 'pending');
      assert.strictEqual(readJson(paths.points).users.find((user) => user.userId === 'ux_user_shop').totalPoints, 150);

      const missionCommand = createChatInputInteraction('미션', {}, 'ux_user_mission', '미션 UX 사용자');
      await handleInteractionCreate(missionCommand);
      assert.strictEqual(missionCommand.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(missionCommand.replyPayload), '오늘 참여 가능한 미션');
      assert.match(missionCommand.replyPayload.embeds[0].data.description, /M001/);
      assert.strictEqual(missionCommand.replyPayload.components.length, 1);

      const missionSelect = createSelectInteraction(
        'participant_mission_select',
        ['M001'],
        'ux_user_mission',
        '미션 UX 사용자'
      );
      await handleInteractionCreate(missionSelect);
      assert.ok(missionSelect.modal);
      assert.strictEqual(missionSelect.modal.data.custom_id, 'participant_mission_submit:M001');

      const modalSubmit = createModalInteraction(
        'participant_mission_submit:M001',
        '미션 인증 모달 테스트 내용',
        'ux_user_mission',
        '미션 UX 사용자'
      );
      await handleInteractionCreate(modalSubmit);
      assert.strictEqual(modalSubmit.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(modalSubmit.replyPayload), '인증 제출이 접수됐어요');
      assert.match(modalSubmit.replyPayload.embeds[0].data.description, /M001/);

      const submissionsData = readJson(paths.submissions);
      assert.strictEqual(submissionsData.submissions.length, 1);
      assert.strictEqual(submissionsData.submissions[0].missionId, 'mission_ux_active');
      assert.strictEqual(submissionsData.submissions[0].status, 'pending');

      const codeRedemption = createChatInputInteraction(
        '교환',
        { 항목: 'S001', 메모: null },
        'ux_user_code',
        '코드 UX 사용자'
      );
      await handleInteractionCreate(codeRedemption);
      assert.strictEqual(getEmbedTitle(codeRedemption.replyPayload), '교환 신청이 접수됐어요');

      const codeSubmission = createChatInputInteraction(
        '인증',
        { 미션id: 'M001', 내용: '표시 코드 인증 테스트' },
        'ux_user_code',
        '코드 UX 사용자'
      );
      await handleInteractionCreate(codeSubmission);
      assert.strictEqual(getEmbedTitle(codeSubmission.replyPayload), '인증 제출이 접수됐어요');

      console.log('participant UX flow smoke test passed');
    });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

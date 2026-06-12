const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

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
    getAttachment(name) {
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
    modal: null,
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
    async showModal(modal) {
      this.modal = modal;
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
    replyPayload: null,
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
      { userId: 'ux_user_internal_item', displayName: '내부 항목 UX 사용자', totalPoints: 250, status: 'active' },
      { userId: 'ux_user_low_points', displayName: '포인트 부족 UX 사용자', totalPoints: 20, status: 'active' },
    ],
    pointTransactions: [],
  });
  writeJson(paths.shopItems, {
    isExample: false,
    shopItems: [
      {
        id: 'item_ux_active',
        name: 'UX 테스트 리워드',
        description: '짧게 교환 신청을 확인할 수 있어요.',
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
  resetModule('../src/components');
  resetModule('../src/embeds');
  const { handleInteractionCreate } = require('../src/handlers');
  const { GUIDE_HUB_OPTIONS, GUIDE_HUB_SELECT_ID } = require('../src/components');

  return Promise.resolve()
    .then(async () => {
      assert.strictEqual(GUIDE_HUB_SELECT_ID, 'guide_hub_select');
      assert.deepStrictEqual(
        GUIDE_HUB_OPTIONS.map((option) => option.value),
        ['start', 'today', 'points', 'shop', 'mission', 'question']
      );
      assert.notStrictEqual(GUIDE_HUB_SELECT_ID, 'participant_shop_select');
      assert.notStrictEqual(GUIDE_HUB_SELECT_ID, 'participant_mission_select');

      const guideCommand = createChatInputInteraction('안내', {}, 'ux_user_shop', '상점 UX 사용자');
      await handleInteractionCreate(guideCommand);
      assert.strictEqual(guideCommand.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(guideCommand.replyPayload), '📌 리디파인 이용 메뉴');
      assert.match(guideCommand.replyPayload.embeds[0].data.description, /필요한 내용을 버튼으로 바로 확인/);
      assert.match(guideCommand.replyPayload.embeds[0].data.description, /본인에게만 보여요/);
      assert.strictEqual(guideCommand.replyPayload.components.length, 2);
      const guideButtons = guideCommand.replyPayload.components[0].components.map((button) => button.toJSON());
      assert.deepStrictEqual(
        guideButtons.map((button) => button.custom_id),
        [
          'participant_menu_today_mission',
          'participant_menu_points',
          'participant_menu_ranking',
          'participant_menu_minigames',
          'participant_menu_help',
        ]
      );
      assert.deepStrictEqual(
        guideButtons.map((button) => button.label),
        ['🌱 오늘의 미션 보기', '💰 내 포인트 확인', '🏆 랭킹 확인', '🎮 미니게임', '❓ 이용 방법 보기']
      );
      const guideSelect = guideCommand.replyPayload.components[1].components[0].toJSON();
      assert.strictEqual(guideSelect.custom_id, GUIDE_HUB_SELECT_ID);
      assert.strictEqual(guideSelect.placeholder, '궁금한 내용을 선택해 주세요');
      assert.deepStrictEqual(
        guideSelect.options.map((option) => option.value),
        ['start', 'today', 'points', 'shop', 'mission', 'question']
      );
      assert.deepStrictEqual(
        guideSelect.options.map((option) => option.label),
        ['처음 왔어요', '오늘 뭐 하면 되나요?', '내 포인트', '상점/교환', '미션/인증', '문의하기']
      );

      const todayMissionMenuButton = createButtonInteraction(
        'participant_menu_today_mission',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(todayMissionMenuButton);
      assert.strictEqual(todayMissionMenuButton.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(todayMissionMenuButton.replyPayload), '오늘의 미션 보기');
      assert.match(todayMissionMenuButton.replyPayload.embeds[0].data.description, /사진을 올리면 인증이 자동으로 접수/);
      assert.match(todayMissionMenuButton.replyPayload.embeds[0].data.description, /하루 1회만 지급/);

      const pointMenuButton = createButtonInteraction(
        'participant_menu_points',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(pointMenuButton);
      assert.strictEqual(pointMenuButton.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(pointMenuButton.replyPayload), '내 여정 포인트');
      assert.match(pointMenuButton.replyPayload.embeds[0].data.description, /현재 보유 여정 포인트: \*\*250P\*\*/);

      const rankingMenuButton = createButtonInteraction(
        'participant_menu_ranking',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(rankingMenuButton);
      assert.strictEqual(rankingMenuButton.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(rankingMenuButton.replyPayload), '랭킹 확인');
      assert.match(rankingMenuButton.replyPayload.embeds[0].data.description, /랭킹 기능은 준비 중입니다/);

      const minigameMenuButton = createButtonInteraction(
        'participant_menu_minigames',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(minigameMenuButton);
      assert.strictEqual(minigameMenuButton.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(minigameMenuButton.replyPayload), '미니게임 놀이터');
      assert.match(minigameMenuButton.replyPayload.embeds[0].data.description, /포인트 베팅이나 차감은 없고/);
      assert.deepStrictEqual(
        minigameMenuButton.replyPayload.components[0].components.map((button) => button.toJSON().custom_id),
        [
          'participant_minigame_treasure',
          'participant_minigame_rps:rock',
          'participant_minigame_rps:scissors',
          'participant_minigame_rps:paper',
          'participant_minigame_dice',
        ]
      );

      const helpMenuButton = createButtonInteraction(
        'participant_menu_help',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(helpMenuButton);
      assert.strictEqual(helpMenuButton.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(helpMenuButton.replyPayload), '이용 방법 보기');
      assert.match(helpMenuButton.replyPayload.embeds[0].data.description, /중복 지급/);
      assert.match(helpMenuButton.replyPayload.embeds[0].data.description, /승인|반려/);

      const guideCases = [
        ['start', '처음 안내', /천천히 둘러봐도 괜찮아요/],
        ['today', '오늘 뭐 하면 되나요?', /\/포인트`로 내 포인트를 확인/],
        ['points', '내 포인트', /현재 내 포인트: 250P/],
        ['shop', '상점\/교환', /선택만으로는 포인트가 차감되지 않아요/],
        ['mission', '미션\/인증', /직접 제출이 필요한 경우에는 `\/인증` 명령어/],
        ['question', '문의하기', /민감한 개인정보/],
      ];

      for (const [value, title, pattern] of guideCases) {
        const guideHubSelect = createSelectInteraction(
          GUIDE_HUB_SELECT_ID,
          [value],
          'ux_user_shop',
          '상점 UX 사용자'
        );
        await handleInteractionCreate(guideHubSelect);
        assert.strictEqual(getEmbedTitle(guideHubSelect.updatePayload), title);
        assert.ok(guideHubSelect.updatePayload.embeds[0].data.description.length > 20);
        assert.match(guideHubSelect.updatePayload.embeds[0].data.description, pattern);
        assert.strictEqual(guideHubSelect.updatePayload.components[0].components[0].toJSON().custom_id, GUIDE_HUB_SELECT_ID);
      }

      const shopCommand = createChatInputInteraction('상점', {}, 'ux_user_shop', '상점 UX 사용자');
      await handleInteractionCreate(shopCommand);
      assert.strictEqual(shopCommand.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(shopCommand.replyPayload), '여정 포인트 상점');
      assert.match(shopCommand.replyPayload.embeds[0].data.fields[0].name, /🎁 리워드/);
      assert.doesNotMatch(shopCommand.replyPayload.embeds[0].data.fields[0].name, /S001|item_ux_active/);
      assert.doesNotMatch(shopCommand.replyPayload.embeds[0].data.fields[0].value, /item_ux_active|표시 코드|설명/);
      assert.match(shopCommand.replyPayload.embeds[0].data.fields[0].value, /100P로 교환을 신청할 수 있어요/);
      assert.ok(shopCommand.replyPayload.embeds[0].data.fields[0].value.length <= 80);
      assert.strictEqual(shopCommand.replyPayload.components.length, 1);
      assert.match(shopCommand.replyPayload.components[0].components[0].toJSON().options[0].label, /S001/);
      assert.match(shopCommand.replyPayload.components[0].components[0].toJSON().options[0].description, /필요 포인트 100P/);

      const redemptionEntryCommand = createChatInputInteraction('교환', {}, 'ux_user_shop', '상점 UX 사용자');
      await handleInteractionCreate(redemptionEntryCommand);
      assert.strictEqual(redemptionEntryCommand.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(redemptionEntryCommand.replyPayload), '여정 포인트 상점');
      assert.strictEqual(redemptionEntryCommand.replyPayload.components.length, 1);
      assert.match(redemptionEntryCommand.replyPayload.components[0].components[0].toJSON().options[0].label, /S001/);

      const shopSelect = createSelectInteraction(
        'participant_shop_select',
        ['S001'],
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(shopSelect);
      assert.strictEqual(getEmbedTitle(shopSelect.updatePayload), '교환 신청 전 확인해 주세요');
      assert.match(shopSelect.updatePayload.embeds[0].data.description, /🎁 리워드/);
      assert.match(shopSelect.updatePayload.embeds[0].data.description, /신청 후 포인트: 150P/);
      assert.match(shopSelect.updatePayload.embeds[0].data.description, /직접 입력용 신청 코드: S001/);
      assert.doesNotMatch(shopSelect.updatePayload.embeds[0].data.description, /item_ux_active|항목 ID/);
      assert.strictEqual(shopSelect.updatePayload.components[0].components[1].toJSON().label, '신청하지 않기');
      assert.strictEqual(shopSelect.updatePayload.components.length, 1);

      const lowPointSelect = createSelectInteraction(
        'participant_shop_select',
        ['S001'],
        'ux_user_low_points',
        '포인트 부족 UX 사용자'
      );
      await handleInteractionCreate(lowPointSelect);
      assert.strictEqual(getEmbedTitle(lowPointSelect.updatePayload), '아직 포인트가 조금 부족해요');
      assert.match(lowPointSelect.updatePayload.embeds[0].data.description, /현재 포인트: 20P/);
      assert.match(lowPointSelect.updatePayload.embeds[0].data.description, /필요 포인트: 100P/);
      assert.match(lowPointSelect.updatePayload.embeds[0].data.description, /\/체크인/);
      assert.match(lowPointSelect.updatePayload.embeds[0].data.description, /\/미션/);
      assert.match(lowPointSelect.updatePayload.embeds[0].data.description, /\/포인트/);
      assert.doesNotMatch(lowPointSelect.updatePayload.embeds[0].data.description, /실패|오류|접수할 수 없습니다/);

      const cancelButton = createButtonInteraction(
        'participant_redeem_cancel_check:S001',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(cancelButton);
      assert.strictEqual(getEmbedTitle(cancelButton.updatePayload), '교환 신청을 종료할까요?');
      assert.match(cancelButton.updatePayload.embeds[0].data.description, /아직 포인트는 차감되지 않았어요/);
      assert.strictEqual(cancelButton.updatePayload.components[0].components[0].toJSON().label, '네, 종료할게요');
      assert.strictEqual(cancelButton.updatePayload.components[0].components[1].toJSON().label, '다시 확인할게요');

      const cancelBackButton = createButtonInteraction(
        'participant_redeem_cancel_back:S001',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(cancelBackButton);
      assert.strictEqual(getEmbedTitle(cancelBackButton.updatePayload), '교환 신청 전 확인해 주세요');
      assert.match(cancelBackButton.updatePayload.embeds[0].data.description, /직접 입력용 신청 코드: S001/);

      const cancelDoneButton = createButtonInteraction(
        'participant_redeem_cancel_done:S001',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(cancelDoneButton);
      assert.strictEqual(getEmbedTitle(cancelDoneButton.updatePayload), '교환 신청을 진행하지 않았어요');
      assert.match(cancelDoneButton.updatePayload.embeds[0].data.description, /포인트는 차감되지 않았어요/);

      const redeemButton = createButtonInteraction(
        'participant_redeem_confirm:S001',
        'ux_user_shop',
        '상점 UX 사용자'
      );
      await handleInteractionCreate(redeemButton);
      assert.strictEqual(getEmbedTitle(redeemButton.updatePayload), '교환 신청이 접수됐어요');
      assert.doesNotMatch(redeemButton.updatePayload.embeds[0].data.description, /S001|신청 ID|pending|item_ux_active/);
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
      assert.doesNotMatch(missionCommand.replyPayload.embeds[0].data.description, /M001/);
      assert.doesNotMatch(missionCommand.replyPayload.embeds[0].data.description, /mission_ux_active|미션 ID|표시 코드/);
      assert.match(missionCommand.replyPayload.embeds[0].data.description, /글로 남기면 15P를 받을 수 있어요/);
      assert.match(missionCommand.replyPayload.embeds[0].data.description, /첨부파일/);
      assert.match(missionCommand.replyPayload.components[0].components[0].toJSON().options[0].label, /M001/);
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
      assert.doesNotMatch(modalSubmit.replyPayload.embeds[0].data.description, /M001|제출 ID|pending|mission_ux_active/);

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
      assert.doesNotMatch(codeRedemption.replyPayload.embeds[0].data.description, /신청 ID|item_ux_active/);

      const internalIdRedemption = createChatInputInteraction(
        '교환',
        { 항목: 'item_ux_active', 메모: null },
        'ux_user_internal_item',
        '내부 항목 UX 사용자'
      );
      await handleInteractionCreate(internalIdRedemption);
      assert.strictEqual(getEmbedTitle(internalIdRedemption.replyPayload), '교환 신청이 접수됐어요');

      const codeSubmission = createChatInputInteraction(
        '인증',
        { 미션id: 'M001', 내용: '표시 코드 인증 테스트' },
        'ux_user_code',
        '코드 UX 사용자'
      );
      await handleInteractionCreate(codeSubmission);
      assert.strictEqual(getEmbedTitle(codeSubmission.replyPayload), '인증 제출이 접수됐어요');
      assert.doesNotMatch(codeSubmission.replyPayload.embeds[0].data.description, /M001|제출 ID|pending|mission_ux_active/);

      const submissionEntryCommand = createChatInputInteraction('인증', {}, 'ux_user_submission_entry', '인증 진입 UX 사용자');
      await handleInteractionCreate(submissionEntryCommand);
      assert.strictEqual(submissionEntryCommand.replyPayload.ephemeral, true);
      assert.strictEqual(getEmbedTitle(submissionEntryCommand.replyPayload), '오늘 참여 가능한 미션');
      assert.strictEqual(submissionEntryCommand.replyPayload.components.length, 1);
      assert.match(submissionEntryCommand.replyPayload.components[0].components[0].toJSON().options[0].label, /M001/);

      const missionOnlySubmission = createChatInputInteraction(
        '인증',
        { 미션: 'M001', 내용: null },
        'ux_user_submission_modal',
        '인증 모달 UX 사용자'
      );
      await handleInteractionCreate(missionOnlySubmission);
      assert.ok(missionOnlySubmission.modal);
      assert.strictEqual(missionOnlySubmission.modal.data.custom_id, 'participant_mission_submit:M001');

      const attachmentSubmission = createChatInputInteraction(
        '인증',
        {
          미션: 'M001',
          내용: '첨부파일 인증 테스트',
          첨부파일: {
            id: 'attachment_ux_photo',
            name: 'qa-photo.jpg',
            url: 'https://cdn.discordapp.example/qa-photo.jpg',
            contentType: 'image/jpeg',
            size: 12345,
          },
        },
        'ux_user_attachment',
        '첨부 UX 사용자'
      );
      await handleInteractionCreate(attachmentSubmission);
      assert.strictEqual(getEmbedTitle(attachmentSubmission.replyPayload), '인증 제출이 접수됐어요');
      assert.match(attachmentSubmission.replyPayload.embeds[0].data.description, /첨부파일: qa-photo.jpg/);
      const submissionsWithAttachment = readJson(paths.submissions).submissions;
      const attachmentRecord = submissionsWithAttachment.find((submission) => submission.userId === 'ux_user_attachment');
      assert.strictEqual(attachmentRecord.attachment.name, 'qa-photo.jpg');
      assert.strictEqual(attachmentRecord.attachment.contentType, 'image/jpeg');

      const internalIdSubmission = createChatInputInteraction(
        '인증',
        { 미션id: 'mission_ux_active', 내용: '내부 ID 호환 인증 테스트' },
        'ux_user_internal_mission',
        '내부 ID UX 사용자'
      );
      await handleInteractionCreate(internalIdSubmission);
      assert.strictEqual(getEmbedTitle(internalIdSubmission.replyPayload), '인증 제출이 접수됐어요');

      writeJson(paths.shopItems, {
        isExample: false,
        shopItems: [
          {
            id: 'item_ux_active',
            name: 'UX 테스트 리워드',
            description: '선택 메뉴와 인증 모달 테스트 항목입니다.',
            cost: 100,
            stock: 3,
            monthlyLimit: 1,
            status: 'paused',
            type: 'reward',
          },
        ],
      });

      const noShopRedemptionCommand = createChatInputInteraction('교환', {}, 'ux_user_shop_empty', '상점 없음 UX 사용자');
      await handleInteractionCreate(noShopRedemptionCommand);
      assert.strictEqual(getEmbedTitle(noShopRedemptionCommand.replyPayload), '여정 포인트 상점');
      assert.match(noShopRedemptionCommand.replyPayload.embeds[0].data.description, /지금 교환할 수 있는 항목이 없어요/);
      assert.match(noShopRedemptionCommand.replyPayload.embeds[0].data.description, /운영진이 새 항목을 열면/);
      assert.strictEqual(noShopRedemptionCommand.replyPayload.components, undefined);

      writeJson(paths.missions, {
        isExample: false,
        missions: [
          {
            id: 'mission_ux_active',
            title: 'UX 테스트 미션',
            description: '선택 메뉴와 인증 모달 테스트 미션입니다.',
            rewardPoints: 15,
            activeDate: '2030-07-01',
            status: 'paused',
            requiresSubmission: true,
            maxPerUser: 1,
          },
        ],
      });

      const noMissionCommand = createChatInputInteraction('미션', {}, 'ux_user_mission_empty', '미션 없음 UX 사용자');
      await handleInteractionCreate(noMissionCommand);
      assert.strictEqual(getEmbedTitle(noMissionCommand.replyPayload), '오늘 참여 가능한 미션');
      assert.match(noMissionCommand.replyPayload.embeds[0].data.description, /지금 바로 참여할 수 있는 미션은 없어요/);
      assert.match(noMissionCommand.replyPayload.embeds[0].data.description, /\/체크인/);
      assert.doesNotMatch(noMissionCommand.replyPayload.embeds[0].data.description, /active|시스템|표시할 수/);

      const noMissionSubmissionCommand = createChatInputInteraction('인증', {}, 'ux_user_submission_empty', '인증 없음 UX 사용자');
      await handleInteractionCreate(noMissionSubmissionCommand);
      assert.strictEqual(getEmbedTitle(noMissionSubmissionCommand.replyPayload), '오늘 참여 가능한 미션');
      assert.match(noMissionSubmissionCommand.replyPayload.embeds[0].data.description, /지금 바로 참여할 수 있는 미션은 없어요/);
      assert.match(noMissionSubmissionCommand.replyPayload.embeds[0].data.description, /\/체크인/);

      assert.ok(fs.existsSync(path.join(__dirname, '..', 'docs', 'participant-onboarding-notice.md')));
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'docs', 'first-time-participant-guide.md')));

      console.log('participant UX flow smoke test passed');
    });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

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

function setupEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-mission-hub-flow-'));

  process.env.POINTS_DATA_PATH = path.join(tempDir, 'points.json');
  process.env.SHOP_ITEMS_DATA_PATH = path.join(tempDir, 'shop-items.json');
  process.env.REDEMPTIONS_DATA_PATH = path.join(tempDir, 'redemptions.json');
  process.env.MISSIONS_DATA_PATH = path.join(tempDir, 'missions.json');
  process.env.MISSION_TEMPLATES_DATA_PATH = path.join(tempDir, 'mission-templates.json');
  process.env.SUBMISSIONS_DATA_PATH = path.join(tempDir, 'submissions.json');
  process.env.REACTION_APPROVALS_DATA_PATH = path.join(tempDir, 'reaction-approvals.json');

  fs.writeFileSync(process.env.MISSION_TEMPLATES_DATA_PATH, JSON.stringify({
    isExample: false,
    missionTemplates: [
      {
        id: 'template_monday_checkin',
        title: '월요일 가벼운 체크인',
        description: '이번 주를 시작하며 오늘의 컨디션과 해보고 싶은 작은 참여를 한 줄로 남겨 주세요.',
        rewardPoints: 15,
        requiresSubmission: true,
        category: 'checkin',
        recommendedDay: 'monday',
        status: 'active',
        note: '월요일 기본 추천',
      },
      {
        id: 'template_tuesday_photo',
        title: '화요일 사진 기록',
        description: '오늘 기억하고 싶은 장면을 사진으로 남겨 주세요. 얼굴이나 위치 정보는 가려도 괜찮아요.',
        rewardPoints: 20,
        requiresSubmission: true,
        category: 'photo',
        recommendedDay: 'tuesday',
        status: 'active',
        note: '사진 인증 추천',
      },
      {
        id: 'template_'.padEnd(130, 'x'),
        title: '긴 ID 템플릿',
        description: '컴포넌트 value와 custom id 제한을 확인하는 템플릿입니다.',
        rewardPoints: 10,
        requiresSubmission: true,
        category: 'edge',
        recommendedDay: 'wednesday',
        status: 'active',
        note: 'long id smoke test',
      },
    ],
    weekdayRecommendations: [
      {
        weekday: 'monday',
        label: '월요일',
        templateId: 'template_monday_checkin',
        title: '가벼운 체크인',
        note: '한 주 시작용 기본 미션',
      },
      {
        weekday: 'tuesday',
        label: '화요일',
        templateId: 'template_tuesday_photo',
        title: '사진 인증',
        note: '사진 기록형 미션',
      },
    ],
  }, null, 2));

  return tempDir;
}

function createMember(isOperator) {
  return {
    displayName: isOperator ? '허브 운영자' : '일반 참여자',
    permissions: new PermissionsBitField(isOperator ? PermissionFlagsBits.ManageMessages : 0n),
  };
}

function createBaseInteraction(isOperator = true) {
  return {
    user: {
      id: isOperator ? 'mission_hub_operator' : 'mission_hub_participant',
      username: isOperator ? '허브 운영자' : '일반 참여자',
    },
    member: createMember(isOperator),
    client: {
      user: {
        id: 'bot_user',
      },
      channels: {
        cache: {
          get() {
            return null;
          },
        },
        async fetch() {
          return null;
        },
      },
    },
    replyPayload: null,
    updatePayload: null,
    followUpPayload: null,
    shownModal: null,
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
      return false;
    },
    async reply(payload) {
      this.replyPayload = payload;
    },
    async update(payload) {
      this.updatePayload = payload;
    },
    async followUp(payload) {
      this.followUpPayload = payload;
    },
    async showModal(modal) {
      this.shownModal = modal;
    },
  };
}

function createSendableChannel(sentMessages) {
  return {
    id: 'today_mission_channel_test',
    async send(payload) {
      sentMessages.push(payload);
      return {
        id: `today_mission_notice_${sentMessages.length}`,
        url: `https://discord.test/channels/test/today_mission_notice_${sentMessages.length}`,
      };
    },
  };
}

function attachTodayMissionChannel(interaction, sentMessages) {
  const channel = createSendableChannel(sentMessages);
  interaction.client = {
    user: {
      id: 'bot_user',
    },
    channels: {
      cache: {
        get(channelId) {
          return channelId === channel.id ? channel : null;
        },
      },
      async fetch(channelId) {
        return channelId === channel.id ? channel : null;
      },
    },
  };
  return interaction;
}

function createDeferredSendChannel(sentMessages) {
  let releaseSend;
  const sendStarted = new Promise((resolve) => {
    releaseSend = resolve;
  });
  const channel = {
    id: 'today_mission_channel_test',
    async send(payload) {
      sentMessages.push(payload);
      await sendStarted;
      return {
        id: `today_mission_notice_${sentMessages.length}`,
        url: `https://discord.test/channels/test/today_mission_notice_${sentMessages.length}`,
      };
    },
  };

  return {
    channel,
    releaseSend,
  };
}

function attachDeferredTodayMissionChannel(interaction, channel) {
  interaction.client = {
    user: {
      id: 'bot_user',
    },
    channels: {
      cache: {
        get(channelId) {
          return channelId === channel.id ? channel : null;
        },
      },
      async fetch(channelId) {
        return channelId === channel.id ? channel : null;
      },
    },
  };
  return interaction;
}

function createHubSelectInteraction(value, isOperator = true) {
  return {
    ...createBaseInteraction(isOperator),
    customId: 'operator_hub_select',
    values: [value],
    isStringSelectMenu() {
      return true;
    },
  };
}

function createMissionSelectInteraction(missionId, isOperator = true) {
  return {
    ...createBaseInteraction(isOperator),
    customId: 'admin_mission_hub_select',
    values: [missionId],
    isStringSelectMenu() {
      return true;
    },
  };
}

function createMissionTemplateSelectInteraction(templateId, isOperator = true) {
  return {
    ...createBaseInteraction(isOperator),
    customId: 'admin_mission_template_select',
    values: [templateId],
    isStringSelectMenu() {
      return true;
    },
  };
}

function createButtonInteraction(customId, isOperator = true) {
  return {
    ...createBaseInteraction(isOperator),
    customId,
    isButton() {
      return true;
    },
  };
}

function createModalInteraction(customId, values, isOperator = true) {
  return {
    ...createBaseInteraction(isOperator),
    customId,
    fields: {
      getTextInputValue(name) {
        return values[name] || '';
      },
    },
    isModalSubmit() {
      return true;
    },
  };
}

function getEmbedTitle(payload) {
  return payload.embeds[0].data.title;
}

function findComponentByCustomId(payload, customId) {
  for (const row of payload.components) {
    for (const component of row.components) {
      if (component.data && component.data.custom_id === customId) {
        return component;
      }
    }
  }

  return null;
}

function getComponentCustomIds(payload) {
  return payload.components.flatMap((row) => {
    return row.components
      .map((component) => component.data && component.data.custom_id)
      .filter(Boolean);
  });
}

async function main() {
  setupEnvironment();
  const previousTodayMissionChannelId = process.env.TODAY_MISSION_CHANNEL_ID;

  resetModule('../src/pointsRepository');
  resetModule('../src/components');
  resetModule('../src/handlers');

  const {
    OPERATOR_HUB_OPTIONS,
    createOperatorMissionHubToken,
    createOperatorMissionTemplateToken,
  } = require('../src/components');
  const { createPointsRepository } = require('../src/pointsRepository');
  const {
    createMissionHubPayload,
    handleInteractionCreate,
  } = require('../src/handlers');

  assert.ok(OPERATOR_HUB_OPTIONS.some((option) => option.value === 'mission_management'));

  const repository = createPointsRepository();
  const templates = repository.listMissionTemplates();
  assert.ok(templates.some((template) => template.id === 'template_monday_checkin'));
  assert.ok(repository.listWeekdayMissionRecommendations()
    .some((recommendation) => recommendation.weekday === 'monday'));

  const seededMission = repository.createMission({
    title: '허브 기존 미션',
    description: '허브에서 선택해 수정할 기존 미션입니다.',
    rewardPoints: 20,
    requiresSubmission: true,
    status: 'draft',
  });
  const seededToken = createOperatorMissionHubToken(seededMission.id);

  const payload = createMissionHubPayload(seededMission.id);
  assert.strictEqual(getEmbedTitle(payload), '미션 관리 허브');
  assert.ok(findComponentByCustomId(payload, 'operator_hub_select'));
  assert.ok(findComponentByCustomId(payload, 'admin_mission_hub_select'));
  assert.ok(findComponentByCustomId(payload, 'admin_mission_template_select'));
  const customIds = getComponentCustomIds(payload);
  assert.strictEqual(new Set(customIds).size, customIds.length);
  payload.components.forEach((row) => row.toJSON());
  assert.match(payload.embeds[0].data.description, /참여자 안내문 미리보기/);
  assert.match(payload.embeds[0].data.description, /active 상태의 미션만 참여자/);
  assert.match(payload.embeds[0].data.description, /미션 템플릿/);
  assert.match(payload.embeds[0].data.description, /요일별 추천/);
  assert.match(payload.embeds[0].data.description, /오늘의 추천/);
  assert.ok(findComponentByCustomId(payload, 'admin_mission_hub:preview_today_notice'));
  assert.ok(findComponentByCustomId(payload, 'admin_mission_hub:publish_today_notice'));

  const hubSelect = createHubSelectInteraction('mission_management');
  await handleInteractionCreate(hubSelect);
  assert.strictEqual(getEmbedTitle(hubSelect.updatePayload), '미션 관리 허브');
  assert.strictEqual(hubSelect.updatePayload.components.length, 5);

  const missionSelect = createMissionSelectInteraction(seededToken);
  await handleInteractionCreate(missionSelect);
  assert.strictEqual(getEmbedTitle(missionSelect.updatePayload), '미션 관리 허브');
  assert.match(missionSelect.updatePayload.embeds[0].data.description, new RegExp(seededMission.id));

  const templateSelect = createMissionTemplateSelectInteraction(createOperatorMissionTemplateToken('template_monday_checkin'));
  await handleInteractionCreate(templateSelect);
  assert.strictEqual(getEmbedTitle(templateSelect.updatePayload), '미션 관리 허브');
  assert.match(templateSelect.updatePayload.embeds[0].data.description, /월요일 가벼운 체크인/);

  const applyTemplateButton = createButtonInteraction(`admin_mission_hub:apply_template:${createOperatorMissionTemplateToken('template_monday_checkin')}`);
  await handleInteractionCreate(applyTemplateButton);
  assert.strictEqual(getEmbedTitle(applyTemplateButton.updatePayload), '미션 관리 허브');
  assert.match(applyTemplateButton.followUpPayload.content, /오늘의 미션으로 저장/);
  assert.match(applyTemplateButton.followUpPayload.content, /공지 미리보기 후 게시/);

  const templateMission = repository.listMissionsForAdmin({ limit: 20 })
    .find((mission) => mission.sourceTemplateId === 'template_monday_checkin');
  assert.ok(templateMission);
  assert.strictEqual(templateMission.title, '월요일 가벼운 체크인');
  assert.strictEqual(templateMission.status, 'active');
  assert.strictEqual(templateMission.rewardPoints, 15);
  assert.strictEqual(templateMission.requiresSubmission, true);
  assert.strictEqual(templateMission.category, 'checkin');
  assert.strictEqual(templateMission.sourceTemplateId, 'template_monday_checkin');
  assert.match(templateMission.activeDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(repository.listActiveMissions().some((mission) => mission.id === templateMission.id));

  const duplicateApplyButton = createButtonInteraction(`admin_mission_hub:apply_template:${createOperatorMissionTemplateToken('template_tuesday_photo')}`);
  await handleInteractionCreate(duplicateApplyButton);
  assert.match(duplicateApplyButton.followUpPayload.content, /이미 오늘의 active 미션/);
  assert.strictEqual(
    repository.listMissionsForAdmin({ limit: 50 }).filter((mission) => mission.activeDate === templateMission.activeDate && mission.status === 'active').length,
    1
  );

  const submissionResult = repository.createMissionSubmission({
    missionId: templateMission.id,
    user: {
      userId: 'mission_template_submitter',
      displayName: '템플릿 제출자',
    },
    content: '오늘 미션 제출 구조 확인',
  });
  assert.strictEqual(submissionResult.ok, true);
  assert.strictEqual(submissionResult.mission.id, templateMission.id);
  assert.strictEqual(submissionResult.submission.type, 'mission');
  assert.strictEqual(submissionResult.submission.status, 'pending');

  const emptyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-mission-empty-preview-'));
  process.env.MISSIONS_DATA_PATH = path.join(emptyTempDir, 'empty-missions.json');
  process.env.MISSION_TEMPLATES_DATA_PATH = path.join(emptyTempDir, 'empty-templates.json');
  fs.writeFileSync(process.env.MISSION_TEMPLATES_DATA_PATH, JSON.stringify({
    isExample: false,
    missionTemplates: [],
    weekdayRecommendations: [],
  }, null, 2));
  resetModule('../src/pointsRepository');
  resetModule('../src/components');
  resetModule('../src/handlers');
  const emptyHandlers = require('../src/handlers');
  const emptyPreviewButton = createButtonInteraction('admin_mission_hub:preview_today_notice');
  await emptyHandlers.handleInteractionCreate(emptyPreviewButton);
  assert.strictEqual(emptyPreviewButton.replyPayload.ephemeral, true);
  assert.match(emptyPreviewButton.replyPayload.content, /오늘 게시할 active 미션이 없어요/);

  setupEnvironment();
  resetModule('../src/pointsRepository');
  resetModule('../src/components');
  resetModule('../src/handlers');
  const publishComponents = require('../src/components');
  const publishHandlers = require('../src/handlers');
  const publishRepository = require('../src/pointsRepository').createPointsRepository();
  const publishResult = publishRepository.createMissionFromTemplateForToday('template_monday_checkin');
  assert.strictEqual(publishResult.ok, true);

  const previewNoticeButton = createButtonInteraction('admin_mission_hub:preview_today_notice');
  await publishHandlers.handleInteractionCreate(previewNoticeButton);
  assert.strictEqual(previewNoticeButton.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(previewNoticeButton.replyPayload), '오늘의 미션 공지 미리보기');
  assert.match(previewNoticeButton.replyPayload.embeds[0].data.description, /월요일 가벼운 체크인/);
  assert.match(previewNoticeButton.replyPayload.embeds[0].data.description, /15P/);
  assert.match(previewNoticeButton.replyPayload.embeds[0].data.description, /#오늘의-미션/);
  assert.match(previewNoticeButton.replyPayload.embeds[0].data.description, /운영자 확인 후 지급/);

  delete process.env.TODAY_MISSION_CHANNEL_ID;
  const missingChannelPublish = createButtonInteraction('admin_mission_hub:publish_today_notice');
  await publishHandlers.handleInteractionCreate(missingChannelPublish);
  assert.strictEqual(missingChannelPublish.replyPayload.ephemeral, true);
  assert.match(missingChannelPublish.replyPayload.content, /TODAY_MISSION_CHANNEL_ID/);

  process.env.TODAY_MISSION_CHANNEL_ID = 'today_mission_channel_test';
  const sentMessages = [];
  const publishButton = attachTodayMissionChannel(
    createButtonInteraction('admin_mission_hub:publish_today_notice'),
    sentMessages
  );
  await publishHandlers.handleInteractionCreate(publishButton);
  assert.strictEqual(publishButton.replyPayload.ephemeral, true);
  assert.match(publishButton.replyPayload.content, /오늘의 미션을 게시했어요/);
  assert.strictEqual(sentMessages.length, 1);
  assert.match(sentMessages[0].embeds[0].data.description, /월요일 가벼운 체크인/);
  assert.match(sentMessages[0].embeds[0].data.description, /하루 1회/);
  assert.match(sentMessages[0].embeds[0].data.description, /운영자 확인 후 지급/);
  assert.strictEqual(publishRepository.findMission(publishResult.mission.id).status, 'active');
  assert.strictEqual(publishRepository.findMission(publishResult.mission.id).rewardPoints, 15);
  assert.ok(publishRepository.hasTodayMissionNoticeBeenPublished());

  const duplicatePublishButton = attachTodayMissionChannel(
    createButtonInteraction('admin_mission_hub:publish_today_notice'),
    sentMessages
  );
  await publishHandlers.handleInteractionCreate(duplicatePublishButton);
  assert.strictEqual(duplicatePublishButton.replyPayload.ephemeral, true);
  assert.match(duplicatePublishButton.replyPayload.content, /이미 오늘의 미션을 게시했어요/);
  assert.strictEqual(sentMessages.length, 1);

  setupEnvironment();
  process.env.TODAY_MISSION_CHANNEL_ID = 'today_mission_channel_test';
  resetModule('../src/pointsRepository');
  resetModule('../src/components');
  resetModule('../src/handlers');
  const concurrentHandlers = require('../src/handlers');
  const concurrentRepository = require('../src/pointsRepository').createPointsRepository();
  const concurrentMission = concurrentRepository.createMissionFromTemplateForToday('template_monday_checkin');
  assert.strictEqual(concurrentMission.ok, true);
  const concurrentMessages = [];
  const deferredChannel = createDeferredSendChannel(concurrentMessages);
  const firstConcurrentPublish = attachDeferredTodayMissionChannel(
    createButtonInteraction('admin_mission_hub:publish_today_notice'),
    deferredChannel.channel
  );
  const secondConcurrentPublish = attachDeferredTodayMissionChannel(
    createButtonInteraction('admin_mission_hub:publish_today_notice'),
    deferredChannel.channel
  );
  const firstPublishPromise = concurrentHandlers.handleInteractionCreate(firstConcurrentPublish);
  const secondPublishPromise = concurrentHandlers.handleInteractionCreate(secondConcurrentPublish);
  deferredChannel.releaseSend();
  await Promise.all([firstPublishPromise, secondPublishPromise]);
  assert.strictEqual(concurrentMessages.length, 1);
  assert.ok([
    firstConcurrentPublish.replyPayload.content,
    secondConcurrentPublish.replyPayload.content,
  ].some((content) => /이미 오늘의 미션을 게시했어요/.test(content)));
  assert.ok(concurrentRepository.hasTodayMissionNoticeBeenPublished());

  const nonOperatorPreview = createButtonInteraction('admin_mission_hub:preview_today_notice', false);
  await publishHandlers.handleInteractionCreate(nonOperatorPreview);
  assert.strictEqual(nonOperatorPreview.replyPayload.ephemeral, true);
  assert.match(nonOperatorPreview.replyPayload.content, /운영진 권한/);

  if (previousTodayMissionChannelId === undefined) {
    delete process.env.TODAY_MISSION_CHANNEL_ID;
  } else {
    process.env.TODAY_MISSION_CHANNEL_ID = previousTodayMissionChannelId;
  }
  setupEnvironment();
  resetModule('../src/pointsRepository');
  resetModule('../src/components');
  resetModule('../src/handlers');
  assert.strictEqual(typeof publishComponents.createOperatorMissionTemplateToken, 'function');

  const longTemplateToken = createOperatorMissionTemplateToken('template_'.padEnd(130, 'x'));
  const longTemplatePayload = createMissionHubPayload(null, 'template_'.padEnd(130, 'x'));
  longTemplatePayload.components.forEach((row) => row.toJSON());
  const longTemplateSelect = findComponentByCustomId(longTemplatePayload, 'admin_mission_template_select');
  assert.ok(longTemplateSelect.options.some((option) => option.data.value === longTemplateToken));
  const longApplyButton = getComponentCustomIds(longTemplatePayload)
    .find((customId) => customId.startsWith('admin_mission_hub:apply_template:'));
  assert.ok(longApplyButton.length <= 100);

  const farBackMission = repository.createMission({
    title: '오래된 오늘 active 미션',
    description: '200개 초과 상태에서도 중복 적용을 막아야 합니다.',
    rewardPoints: 10,
    requiresSubmission: true,
    activeDate: '2099-05-05',
    status: 'active',
  });
  for (let index = 0; index < 205; index += 1) {
    repository.createMission({
      title: `정렬 앞쪽 채움 미션 ${index}`,
      description: '중복 검사 범위 회귀 테스트용 미션입니다.',
      rewardPoints: 1,
      requiresSubmission: true,
      activeDate: `2099-06-${String((index % 28) + 1).padStart(2, '0')}`,
      status: 'draft',
    });
  }
  const duplicateBeyondLimit = repository.createMissionFromTemplateForToday('template_tuesday_photo', {
    activeDate: '2099-05-05',
  });
  assert.strictEqual(duplicateBeyondLimit.ok, false);
  assert.strictEqual(duplicateBeyondLimit.reason, 'TODAY_MISSION_EXISTS');
  assert.strictEqual(duplicateBeyondLimit.mission.id, farBackMission.id);

  const exampleTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-mission-template-example-'));
  const exampleRepository = createPointsRepository({
    missions: path.join(exampleTempDir, 'example-missions.json'),
    missionTemplates: path.join(exampleTempDir, 'missing-mission-templates.json'),
  });
  assert.ok(exampleRepository.listMissionTemplates().some((template) => template.isExample === true));
  const exampleApply = exampleRepository.createMissionFromTemplateForToday('template_monday_checkin_example');
  assert.strictEqual(exampleApply.ok, true);
  assert.strictEqual(exampleApply.template.isExample, true);
  assert.strictEqual(exampleApply.mission.status, 'active');
  assert.strictEqual(exampleApply.mission.sourceTemplateId, 'template_monday_checkin_example');
  assert.strictEqual(exampleApply.mission.title, '월요일 가벼운 체크인');
  assert.ok(exampleRepository.findTodayActiveMission());

  const primaryExampleTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-mission-template-primary-example-'));
  const primaryExampleTemplatePath = path.join(primaryExampleTempDir, 'primary-example-templates.json');
  fs.writeFileSync(primaryExampleTemplatePath, JSON.stringify({
    isExample: true,
    missionTemplates: [{
      id: 'template_primary_example',
      title: '기본 경로 예시 템플릿',
      description: '기본 경로가 isExample이어도 운영자가 선택하면 적용할 수 있습니다.',
      rewardPoints: 10,
      requiresSubmission: true,
      category: 'example',
      recommendedDay: 'monday',
      status: 'active',
      note: 'primary example apply smoke',
    }],
    weekdayRecommendations: [],
  }, null, 2));
  const primaryExampleRepository = createPointsRepository({
    missions: path.join(primaryExampleTempDir, 'primary-example-missions.json'),
    missionTemplates: primaryExampleTemplatePath,
  });
  const primaryExampleApply = primaryExampleRepository.createMissionFromTemplateForToday('template_primary_example');
  assert.strictEqual(primaryExampleApply.ok, true);
  assert.strictEqual(primaryExampleApply.template.isExample, true);
  assert.strictEqual(primaryExampleApply.mission.status, 'active');
  assert.strictEqual(primaryExampleApply.mission.category, 'example');
  assert.strictEqual(primaryExampleRepository.findTodayActiveMission().id, primaryExampleApply.mission.id);

  const exampleHandlerTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-mission-template-example-handler-'));
  process.env.MISSIONS_DATA_PATH = path.join(exampleHandlerTempDir, 'handler-example-missions.json');
  process.env.MISSION_TEMPLATES_DATA_PATH = path.join(exampleHandlerTempDir, 'missing-handler-example-templates.json');
  resetModule('../src/pointsRepository');
  resetModule('../src/components');
  resetModule('../src/handlers');
  const exampleHandlerComponents = require('../src/components');
  const exampleHandlers = require('../src/handlers');
  const exampleHandlerRepository = require('../src/pointsRepository').createPointsRepository();
  const exampleHandlerPayload = exampleHandlers.createMissionHubPayload(null, 'template_monday_checkin_example');
  assert.match(exampleHandlerPayload.embeds[0].data.description, /예시 템플릿입니다/);
  assert.doesNotMatch(exampleHandlerPayload.embeds[0].data.description, /local 템플릿 파일/);
  const exampleHandlerApply = createButtonInteraction(`admin_mission_hub:apply_template:${exampleHandlerComponents.createOperatorMissionTemplateToken('template_monday_checkin_example')}`);
  await exampleHandlers.handleInteractionCreate(exampleHandlerApply);
  assert.strictEqual(getEmbedTitle(exampleHandlerApply.updatePayload), '미션 관리 허브');
  assert.match(exampleHandlerApply.followUpPayload.content, /오늘의 미션으로 저장/);
  assert.match(exampleHandlerApply.followUpPayload.content, /예시 템플릿/);
  const exampleHandlerMission = exampleHandlerRepository.findTodayActiveMission();
  assert.ok(exampleHandlerMission);
  assert.strictEqual(exampleHandlerMission.status, 'active');
  assert.strictEqual(exampleHandlerMission.sourceTemplateId, 'template_monday_checkin_example');
  const exampleHandlerPreview = createButtonInteraction('admin_mission_hub:preview_today_notice');
  await exampleHandlers.handleInteractionCreate(exampleHandlerPreview);
  assert.match(exampleHandlerPreview.replyPayload.embeds[0].data.description, /월요일 가벼운 체크인/);
  assert.match(exampleHandlerPreview.replyPayload.embeds[0].data.description, /10P/);

  const missingTemplateButton = createButtonInteraction('admin_mission_hub:apply_template:mt_missing_token');
  await exampleHandlers.handleInteractionCreate(missingTemplateButton);
  assert.strictEqual(missingTemplateButton.replyPayload.ephemeral, true);
  assert.match(missingTemplateButton.replyPayload.content, /선택한 템플릿을 찾지 못했어요/);

  const manyTemplatesTempDir = setupEnvironment();
  const manyTemplates = [];
  for (let index = 0; index < 26; index += 1) {
    manyTemplates.push({
      id: `template_many_${index}`,
      title: `앞쪽 템플릿 ${index}`,
      description: '추천 템플릿 앞에 있는 템플릿입니다.',
      rewardPoints: 1,
      requiresSubmission: true,
      category: 'filler',
      recommendedDay: 'sunday',
      status: 'active',
      note: 'filler',
    });
  }
  manyTemplates.push({
    id: 'template_today_recommended_after_25',
    title: '25개 뒤 오늘 추천 템플릿',
    description: '선택 목록 첫 페이지 밖에 있어도 오늘 추천이면 적용 버튼 대상이어야 합니다.',
    rewardPoints: 30,
    requiresSubmission: true,
    category: 'recommended',
    recommendedDay: 'monday',
    status: 'active',
    note: 'after 25',
  });
  fs.writeFileSync(process.env.MISSION_TEMPLATES_DATA_PATH, JSON.stringify({
    isExample: false,
    missionTemplates: manyTemplates,
    weekdayRecommendations: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((weekday) => ({
      weekday,
      label: '월요일',
      templateId: 'template_today_recommended_after_25',
      title: '25개 뒤 추천',
      note: '첫 페이지 밖 추천',
    })),
  }, null, 2));
  resetModule('../src/pointsRepository');
  resetModule('../src/components');
  resetModule('../src/handlers');
  const manyTemplateComponents = require('../src/components');
  const manyTemplateHandlers = require('../src/handlers');
  const manyTemplatePayload = manyTemplateHandlers.createMissionHubPayload(null);
  const manyTemplateApplyButton = getComponentCustomIds(manyTemplatePayload)
    .find((customId) => customId.startsWith('admin_mission_hub:apply_template:'));
  assert.ok(manyTemplateApplyButton.endsWith(manyTemplateComponents.createOperatorMissionTemplateToken('template_today_recommended_after_25')));

  const nonOperatorCreate = createButtonInteraction('admin_mission_hub:create', false);
  await handleInteractionCreate(nonOperatorCreate);
  assert.strictEqual(nonOperatorCreate.replyPayload.ephemeral, true);
  assert.match(nonOperatorCreate.replyPayload.content, /운영진 권한/);

  const nonOperatorTemplateSelect = createMissionTemplateSelectInteraction(createOperatorMissionTemplateToken('template_monday_checkin'), false);
  await handleInteractionCreate(nonOperatorTemplateSelect);
  assert.strictEqual(nonOperatorTemplateSelect.replyPayload.ephemeral, true);
  assert.match(nonOperatorTemplateSelect.replyPayload.content, /운영진 권한/);

  const nonOperatorApplyTemplate = createButtonInteraction(`admin_mission_hub:apply_template:${createOperatorMissionTemplateToken('template_monday_checkin')}`, false);
  await handleInteractionCreate(nonOperatorApplyTemplate);
  assert.strictEqual(nonOperatorApplyTemplate.replyPayload.ephemeral, true);
  assert.match(nonOperatorApplyTemplate.replyPayload.content, /운영진 권한/);

  const nonOperatorModal = createModalInteraction('admin_mission_hub_modal:create', {
    title: '비운영자 생성 시도',
    description: '비운영자 저장은 막혀야 합니다.',
    rewardPoints: '10',
    status: 'active',
    note: '',
  }, false);
  await handleInteractionCreate(nonOperatorModal);
  assert.strictEqual(nonOperatorModal.replyPayload.ephemeral, true);
  assert.match(nonOperatorModal.replyPayload.content, /운영진 권한/);

  const createButton = createButtonInteraction('admin_mission_hub:create');
  await handleInteractionCreate(createButton);
  assert.strictEqual(createButton.shownModal.data.custom_id, 'admin_mission_hub_modal:create');
  assert.strictEqual(createButton.shownModal.data.title, '새 미션 만들기');

  const createModal = createModalInteraction('admin_mission_hub_modal:create', {
    title: '허브 생성 미션',
    description: '버튼과 모달로 생성한 미션입니다.',
    rewardPoints: '35',
    status: 'active',
    note: 'admin mission hub smoke test',
  });
  await handleInteractionCreate(createModal);
  assert.strictEqual(createModal.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(createModal.replyPayload), '미션 생성 완료');

  const createdMission = repository.listMissionsForAdmin({ limit: 20 })
    .find((mission) => mission.title === '허브 생성 미션');
  assert.ok(createdMission);
  const createdToken = createOperatorMissionHubToken(createdMission.id);
  assert.strictEqual(createdMission.status, 'active');
  assert.strictEqual(createdMission.rewardPoints, 35);

  const editButton = createButtonInteraction(`admin_mission_hub:edit:${createdToken}`);
  await handleInteractionCreate(editButton);
  assert.strictEqual(editButton.shownModal.data.custom_id, `admin_mission_hub_modal:update:${createdToken}`);
  assert.strictEqual(editButton.shownModal.data.title, '미션 수정');
  editButton.shownModal.toJSON();

  const updateModal = createModalInteraction(`admin_mission_hub_modal:update:${createdToken}`, {
    title: '허브 수정 미션',
    description: '수정된 미션 안내문입니다.',
    rewardPoints: '45',
    status: 'paused',
    note: 'updated by hub smoke test',
  });
  await handleInteractionCreate(updateModal);
  assert.strictEqual(getEmbedTitle(updateModal.replyPayload), '미션 수정 완료');

  const updatedMission = repository.findMission(createdMission.id);
  const updatedToken = createOperatorMissionHubToken(updatedMission.id);
  assert.strictEqual(updatedMission.title, '허브 수정 미션');
  assert.strictEqual(updatedMission.rewardPoints, 45);
  assert.strictEqual(updatedMission.status, 'paused');

  const toggleButton = createButtonInteraction(`admin_mission_hub:toggle:${updatedToken}`);
  await handleInteractionCreate(toggleButton);
  assert.strictEqual(repository.findMission(updatedMission.id).status, 'active');
  assert.strictEqual(getEmbedTitle(toggleButton.updatePayload), '미션 관리 허브');
  assert.match(toggleButton.followUpPayload.content, /active/);

  const closeButton = createButtonInteraction(`admin_mission_hub:close:${updatedToken}`);
  await handleInteractionCreate(closeButton);
  assert.strictEqual(repository.findMission(updatedMission.id).status, 'closed');
  assert.match(closeButton.followUpPayload.content, /종료 상태/);

  const refreshButton = createButtonInteraction('admin_mission_hub:refresh');
  await handleInteractionCreate(refreshButton);
  assert.strictEqual(getEmbedTitle(refreshButton.updatePayload), '미션 관리 허브');

  const missingTargetButton = createButtonInteraction('admin_mission_hub:edit:none');
  await handleInteractionCreate(missingTargetButton);
  assert.strictEqual(missingTargetButton.replyPayload.ephemeral, true);
  assert.match(missingTargetButton.replyPayload.content, /대상 미션을 찾지 못했어요/);

  const unknownButton = createButtonInteraction(`admin_mission_hub:bogus:${updatedToken}`);
  await handleInteractionCreate(unknownButton);
  assert.strictEqual(unknownButton.replyPayload.ephemeral, true);
  assert.match(unknownButton.replyPayload.content, /지원하지 않는 미션 관리 허브 버튼/);

  const longIdMission = repository.createMission({
    id: 'mission_'.padEnd(130, 'x'),
    title: '긴 ID 미션',
    description: '컴포넌트 custom id 제한 회귀 테스트입니다.',
    rewardPoints: 10,
    requiresSubmission: true,
    status: 'draft',
  });
  const longIdPayload = createMissionHubPayload(longIdMission.id);
  longIdPayload.components.forEach((row) => row.toJSON());
  assert.match(longIdPayload.embeds[0].data.description, /긴 ID 미션/);

  const invalidPointsModal = createModalInteraction('admin_mission_hub_modal:create', {
    title: '잘못된 포인트 미션',
    description: '포인트 검증용 미션입니다.',
    rewardPoints: '0',
    status: 'active',
    note: '',
  });
  await handleInteractionCreate(invalidPointsModal);
  assert.strictEqual(invalidPointsModal.replyPayload.ephemeral, true);
  assert.match(invalidPointsModal.replyPayload.content, /0보다 큰 정수/);

  const invalidStatusModal = createModalInteraction('admin_mission_hub_modal:create', {
    title: '잘못된 상태 미션',
    description: '상태 검증용 미션입니다.',
    rewardPoints: '10',
    status: 'visible',
    note: '',
  });
  await handleInteractionCreate(invalidStatusModal);
  assert.strictEqual(invalidStatusModal.replyPayload.ephemeral, true);
  assert.match(invalidStatusModal.replyPayload.content, /draft, active, paused, closed, archived/);

  console.log('admin mission hub flow smoke test passed');
}

main();

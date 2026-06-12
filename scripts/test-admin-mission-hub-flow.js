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
  process.env.SUBMISSIONS_DATA_PATH = path.join(tempDir, 'submissions.json');
  process.env.REACTION_APPROVALS_DATA_PATH = path.join(tempDir, 'reaction-approvals.json');

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

async function main() {
  setupEnvironment();

  resetModule('../src/pointsRepository');
  resetModule('../src/components');
  resetModule('../src/handlers');

  const { OPERATOR_HUB_OPTIONS, createOperatorMissionHubToken } = require('../src/components');
  const { createPointsRepository } = require('../src/pointsRepository');
  const {
    createMissionHubPayload,
    handleInteractionCreate,
  } = require('../src/handlers');

  assert.ok(OPERATOR_HUB_OPTIONS.some((option) => option.value === 'mission_management'));

  const repository = createPointsRepository();
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
  assert.strictEqual(payload.components[0].components[0].data.custom_id, 'operator_hub_select');
  assert.strictEqual(payload.components[1].components[0].data.custom_id, 'admin_mission_hub_select');
  payload.components.forEach((row) => row.toJSON());
  assert.match(payload.embeds[0].data.description, /참여자 안내문 미리보기/);
  assert.match(payload.embeds[0].data.description, /active 상태의 미션만 참여자/);

  const hubSelect = createHubSelectInteraction('mission_management');
  await handleInteractionCreate(hubSelect);
  assert.strictEqual(getEmbedTitle(hubSelect.updatePayload), '미션 관리 허브');
  assert.strictEqual(hubSelect.updatePayload.components.length, 3);

  const missionSelect = createMissionSelectInteraction(seededToken);
  await handleInteractionCreate(missionSelect);
  assert.strictEqual(getEmbedTitle(missionSelect.updatePayload), '미션 관리 허브');
  assert.match(missionSelect.updatePayload.embeds[0].data.description, new RegExp(seededMission.id));

  const nonOperatorCreate = createButtonInteraction('admin_mission_hub:create', false);
  await handleInteractionCreate(nonOperatorCreate);
  assert.strictEqual(nonOperatorCreate.replyPayload.ephemeral, true);
  assert.match(nonOperatorCreate.replyPayload.content, /운영진 권한/);

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

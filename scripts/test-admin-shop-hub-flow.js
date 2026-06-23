const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PermissionsBitField, PermissionFlagsBits } = require('discord.js');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function setupEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-shop-hub-flow-'));

  process.env.POINTS_DATA_PATH = path.join(tempDir, 'points.json');
  process.env.SHOP_ITEMS_DATA_PATH = path.join(tempDir, 'shop-items.json');
  process.env.REDEMPTIONS_DATA_PATH = path.join(tempDir, 'redemptions.json');
  process.env.MISSIONS_DATA_PATH = path.join(tempDir, 'missions.json');
  process.env.MISSION_TEMPLATES_DATA_PATH = path.join(tempDir, 'mission-templates.json');
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
      id: isOperator ? 'shop_hub_operator' : 'shop_hub_participant',
      username: isOperator ? '허브 운영자' : '일반 참여자',
    },
    member: createMember(isOperator),
    replyPayload: null,
    updatePayload: null,
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

function createShopSelectInteraction(itemToken, isOperator = true) {
  return {
    ...createBaseInteraction(isOperator),
    customId: 'admin_shop_hub_select',
    values: [itemToken],
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

async function main() {
  setupEnvironment();
  resetModule('../src/pointsRepository');
  resetModule('../src/components');
  resetModule('../src/handlers');

  const {
    OPERATOR_HUB_BUTTON_IDS,
    OPERATOR_HUB_OPTIONS,
    createOperatorShopHubToken,
  } = require('../src/components');
  const { createPointsRepository } = require('../src/pointsRepository');
  const {
    createShopHubPayload,
    handleInteractionCreate,
  } = require('../src/handlers');

  assert.ok(OPERATOR_HUB_OPTIONS.some((option) => option.value === 'shop_management'));

  const repository = createPointsRepository();

  const initialPayload = createShopHubPayload();
  assert.strictEqual(getEmbedTitle(initialPayload), '상점 관리 허브');
  assert.ok(findComponentByCustomId(initialPayload, 'admin_shop_hub:create'));
  assert.ok(findComponentByCustomId(initialPayload, 'admin_shop_hub:refresh'));

  const seededItem = repository.createShopItem({
    name: '허브 기존 항목',
    description: '허브에서 선택해 수정할 기존 항목입니다.',
    cost: 50,
    type: 'reward',
  });
  const seededToken = createOperatorShopHubToken(seededItem.id);

  const payload = createShopHubPayload(seededItem.id);
  assert.strictEqual(getEmbedTitle(payload), '상점 관리 허브');
  assert.ok(findComponentByCustomId(payload, 'operator_hub_select'));
  assert.ok(findComponentByCustomId(payload, 'admin_shop_hub_select'));
  assert.match(payload.embeds[0].data.description, new RegExp(seededItem.id));
  const customIds = payload.components.flatMap((row) => row.components.map((c) => c.data.custom_id));
  assert.strictEqual(new Set(customIds).size, customIds.length);
  payload.components.forEach((row) => row.toJSON());

  const hubSelect = createHubSelectInteraction('shop_management');
  await handleInteractionCreate(hubSelect);
  assert.strictEqual(getEmbedTitle(hubSelect.updatePayload), '상점 관리 허브');

  const shopSelect = createShopSelectInteraction(seededToken);
  await handleInteractionCreate(shopSelect);
  assert.strictEqual(getEmbedTitle(shopSelect.updatePayload), '상점 관리 허브');
  assert.match(shopSelect.updatePayload.embeds[0].data.description, /허브 기존 항목/);

  const createButton = createButtonInteraction('admin_shop_hub:create');
  await handleInteractionCreate(createButton);
  assert.ok(createButton.shownModal);
  assert.strictEqual(createButton.shownModal.data.custom_id, 'admin_shop_hub_modal:create');

  const createModal = createModalInteraction('admin_shop_hub_modal:create', {
    name: '새 상점 항목',
    description: '모달로 생성한 상점 항목입니다.',
    cost: '120',
    type: 'goods',
    status: 'active',
  });
  await handleInteractionCreate(createModal);
  assert.strictEqual(createModal.replyPayload.ephemeral, true);
  assert.strictEqual(getEmbedTitle(createModal.replyPayload), '상점 관리 허브');
  const createdItem = repository.listShopItemsForAdmin({ limit: 20 })
    .find((item) => item.name === '새 상점 항목');
  assert.ok(createdItem);
  assert.strictEqual(createdItem.cost, 120);
  assert.strictEqual(createdItem.type, 'goods');
  assert.strictEqual(createdItem.status, 'active');

  const createdToken = createOperatorShopHubToken(createdItem.id);
  const editButton = createButtonInteraction(`admin_shop_hub:edit:${createdToken}`);
  await handleInteractionCreate(editButton);
  assert.ok(editButton.shownModal);
  assert.strictEqual(editButton.shownModal.data.custom_id, `admin_shop_hub_modal:update:${createdToken}`);

  const editModal = createModalInteraction(`admin_shop_hub_modal:update:${createdToken}`, {
    name: '수정된 상점 항목',
    description: '모달로 수정한 상점 항목입니다.',
    cost: '200',
    type: 'goods',
    status: 'active',
  });
  await handleInteractionCreate(editModal);
  assert.strictEqual(editModal.replyPayload.ephemeral, true);
  const editedItem = repository.findShopItem(createdItem.id);
  assert.strictEqual(editedItem.name, '수정된 상점 항목');
  assert.strictEqual(editedItem.cost, 200);

  const toggleButton = createButtonInteraction(`admin_shop_hub:toggle:${createdToken}`);
  await handleInteractionCreate(toggleButton);
  assert.strictEqual(repository.findShopItem(createdItem.id).status, 'paused');
  const toggleBackButton = createButtonInteraction(`admin_shop_hub:toggle:${createdToken}`);
  await handleInteractionCreate(toggleBackButton);
  assert.strictEqual(repository.findShopItem(createdItem.id).status, 'active');

  const soldOutButton = createButtonInteraction(`admin_shop_hub:sold_out:${createdToken}`);
  await handleInteractionCreate(soldOutButton);
  assert.strictEqual(repository.findShopItem(createdItem.id).status, 'soldOut');

  const hideButton = createButtonInteraction(`admin_shop_hub:hide:${createdToken}`);
  await handleInteractionCreate(hideButton);
  assert.strictEqual(repository.findShopItem(createdItem.id).status, 'hidden');

  const refreshButton = createButtonInteraction('admin_shop_hub:refresh');
  await handleInteractionCreate(refreshButton);
  assert.strictEqual(getEmbedTitle(refreshButton.updatePayload), '상점 관리 허브');

  const invalidTypeModal = createModalInteraction('admin_shop_hub_modal:create', {
    name: '잘못된 유형 항목',
    description: '유형 검증용 항목입니다.',
    cost: '10',
    type: 'invalidType',
    status: 'paused',
  });
  await handleInteractionCreate(invalidTypeModal);
  assert.strictEqual(invalidTypeModal.replyPayload.ephemeral, true);
  assert.match(invalidTypeModal.replyPayload.content, /youthCenterPoint, reward, goods, event/);

  const nonOperatorButton = createButtonInteraction('admin_shop_hub:create', false);
  await handleInteractionCreate(nonOperatorButton);
  assert.strictEqual(nonOperatorButton.replyPayload.ephemeral, true);
  assert.match(nonOperatorButton.replyPayload.content, /운영진 권한/);

  const shopHubShortcutButton = createButtonInteraction(OPERATOR_HUB_BUTTON_IDS.prelaunchOpenShopHub);
  await handleInteractionCreate(shopHubShortcutButton);
  assert.strictEqual(getEmbedTitle(shopHubShortcutButton.replyPayload), '상점 관리 허브');
  assert.strictEqual(shopHubShortcutButton.replyPayload.ephemeral, true);

  console.log('admin shop hub flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

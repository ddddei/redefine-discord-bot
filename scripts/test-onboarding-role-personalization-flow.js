const assert = require('assert');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

const { handleGuideCommand, handleChannelGuideCommand } = require('../src/handlers');

function createMemberWithRoleNames(roleNames) {
  const roles = roleNames.map((name) => ({ name }));
  return {
    roles: {
      cache: new Map(roles.map((role, index) => [String(index), role])),
    },
  };
}

function createGuideInteraction(roleNames) {
  return {
    member: createMemberWithRoleNames(roleNames),
    replyPayload: null,
    async reply(payload) {
      this.replyPayload = payload;
    },
  };
}

function getEmbedDescription(payload) {
  return (payload.embeds[0].data && payload.embeds[0].data.description) || '';
}

async function main() {
  const slowGuide = createGuideInteraction(['온보딩-천천히']);
  await handleGuideCommand(slowGuide);
  assert.match(getEmbedDescription(slowGuide.replyPayload), /읽기, 이모지 반응, 질문도 모두 참여 방식이에요/);
  assert.strictEqual(slowGuide.replyPayload.ephemeral, true);

  const activeGuide = createGuideInteraction(['온보딩-활동']);
  await handleGuideCommand(activeGuide);
  assert.match(getEmbedDescription(activeGuide.replyPayload), /포인트와 랭킹은 경쟁이 아니라 가볍게 즐길 수 있는 요소예요/);

  const participantGuide = createGuideInteraction(['참여자']);
  await handleGuideCommand(participantGuide);
  assert.match(getEmbedDescription(participantGuide.replyPayload), /자신의 속도에 맞게 참여하면 됩니다/);

  const noRoleGuide = createGuideInteraction([]);
  await handleGuideCommand(noRoleGuide);
  const noRoleDescription = getEmbedDescription(noRoleGuide.replyPayload);
  assert.doesNotMatch(noRoleDescription, /읽기, 이모지 반응, 질문도 모두 참여 방식이에요/);
  assert.doesNotMatch(noRoleDescription, /포인트와 랭킹은 경쟁이 아니라 가볍게 즐길 수 있는 요소예요/);
  assert.match(noRoleDescription, /더 자세한 안내가 필요하면 아래 선택 메뉴도 함께 사용할 수 있어요/);

  const memberlessGuide = { replyPayload: null, async reply(payload) { this.replyPayload = payload; } };
  await handleGuideCommand(memberlessGuide);
  assert.match(getEmbedDescription(memberlessGuide.replyPayload), /더 자세한 안내가 필요하면/);

  const slowChannelGuide = createGuideInteraction(['온보딩-천천히']);
  await handleChannelGuideCommand(slowChannelGuide);
  assert.match(getEmbedDescription(slowChannelGuide.replyPayload), /지금 보이는 채널부터 천천히 확인하면 돼요/);

  const noRoleChannelGuide = createGuideInteraction([]);
  await handleChannelGuideCommand(noRoleChannelGuide);
  assert.match(getEmbedDescription(noRoleChannelGuide.replyPayload), /역할에 따라 보이는 채널이 다를 수 있어요/);

  console.log('onboarding role personalization flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

const ONBOARDING_ROLE_TYPES = new Map([
  ['온보딩-천천히', 'slow'],
  ['온보딩-기본', 'basic'],
  ['온보딩-활동', 'active'],
  ['참여자', 'participant'],
]);

const ONBOARDING_GUIDE_MESSAGES = {
  slow: [
    '처음부터 모든 채널을 다 확인하지 않아도 괜찮아요.',
    '읽기, 이모지 반응, 질문도 모두 참여 방식이에요.',
    '불편한 점이 있으면 언제든 운영진에게 문의해 주세요.',
  ].join('\n'),
  basic: [
    '공지, 자유채팅, 미션을 가능한 만큼 확인해 보세요.',
    '바로 이야기하지 않아도 괜찮아요.',
    '궁금한 점은 `/질문`을 사용하거나 운영진에게 문의해 주세요.',
  ].join('\n'),
  active: [
    '자유채팅, 챌린지, 출석, 포인트 채널을 확인할 수 있어요.',
    '포인트와 랭킹은 경쟁이 아니라 가볍게 즐길 수 있는 요소예요.',
    '부담되는 때에는 쉬어가도 괜찮아요.',
  ].join('\n'),
  participant: [
    '공지, 일정, 활동 채널에서 전체 참여 흐름을 확인할 수 있어요.',
    '앞으로도 자신의 속도에 맞게 참여하면 됩니다.',
  ].join('\n'),
  default: '',
};

const CHANNEL_GUIDE_ROLE_NOTES = {
  slow: [
    '지금 보이는 채널부터 천천히 확인하면 돼요.',
    '자유채팅이나 활동 채널을 바로 모두 살펴보지 않아도 괜찮아요.',
    '익명고민채널, 운영진 문의, `/질문`을 먼저 활용해도 괜찮아요.',
  ].join('\n'),
  basic: [
    '공지, 자유채팅, 미션, 출석 채널을 가능한 만큼 확인해 보세요.',
    '바로 말하지 않고 보기만 해도 괜찮아요.',
    '궁금한 점은 `/질문`을 사용하거나 운영진에게 문의해 주세요.',
  ].join('\n'),
  active: [
    '자유채팅, 챌린지, 출석, 포인트 관련 채널을 확인할 수 있어요.',
    '포인트와 랭킹은 경쟁이 아니라 가볍게 즐기는 요소예요.',
    '부담되는 때에는 쉬어가도 괜찮아요.',
  ].join('\n'),
  participant: [
    '공지, 일정, 활동 채널을 전체 흐름에 맞춰 확인해 보세요.',
    '앞으로도 자신의 속도에 맞게 참여하면 됩니다.',
  ].join('\n'),
  default: [
    '역할에 따라 보이는 채널이 다를 수 있어요.',
    '지금 보이는 채널부터 확인하면 됩니다.',
  ].join('\n'),
};

function getOnboardingRoleType(member) {
  if (!member || !member.roles || !member.roles.cache) {
    return 'default';
  }

  const roles = typeof member.roles.cache.values === 'function'
    ? Array.from(member.roles.cache.values())
    : [];
  const roleNames = new Set(roles.map((role) => role && role.name).filter(Boolean));

  // This role check personalizes guidance only; it does not determine Discord permissions.
  for (const [roleName, roleType] of ONBOARDING_ROLE_TYPES) {
    if (roleNames.has(roleName)) {
      return roleType;
    }
  }

  return 'default';
}

function getOnboardingGuideMessage(roleType) {
  return ONBOARDING_GUIDE_MESSAGES[roleType] || ONBOARDING_GUIDE_MESSAGES.default;
}

function getChannelGuideRoleNote(roleType) {
  return CHANNEL_GUIDE_ROLE_NOTES[roleType] || CHANNEL_GUIDE_ROLE_NOTES.default;
}

module.exports = {
  getChannelGuideRoleNote,
  getOnboardingGuideMessage,
  getOnboardingRoleType,
};

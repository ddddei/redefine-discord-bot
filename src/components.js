const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const crypto = require('crypto');

const DUNGEONWORLD_CHOICE_PREFIX = 'dungeonworld:choice:';
const OPERATOR_DUNGEONWORLD_MANAGE_PREFIX = 'dungeonworld_manage:';
const OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS = {
  previous: `${OPERATOR_DUNGEONWORLD_MANAGE_PREFIX}prev`,
  next: `${OPERATOR_DUNGEONWORLD_MANAGE_PREFIX}next`,
  clearOverride: `${OPERATOR_DUNGEONWORLD_MANAGE_PREFIX}clear`,
  refresh: `${OPERATOR_DUNGEONWORLD_MANAGE_PREFIX}refresh`,
};

const GUIDE_HUB_SELECT_ID = 'guide_hub_select';
const OPERATOR_HUB_SELECT_ID = 'operator_hub_select';
const OPERATOR_MISSION_HUB_SELECT_ID = 'admin_mission_hub_select';
const OPERATOR_MISSION_TEMPLATE_SELECT_ID = 'admin_mission_template_select';
const OPERATOR_SHOP_HUB_SELECT_ID = 'admin_shop_hub_select';
const OPERATOR_HUB_BUTTON_IDS = {
  invitationNotice: 'operator_hub:invitation_notice',
  prelaunchCheck: 'operator_hub:prelaunch_check',
  prelaunchOpenEnvironmentCheck: 'operator_hub:prelaunch_open_environment_check',
  prelaunchOpenMissionHub: 'operator_hub:prelaunch_open_mission_hub',
  prelaunchOpenShopHub: 'operator_hub:prelaunch_open_shop_hub',
};
const OPERATOR_MISSION_HUB_BUTTON_IDS = {
  create: 'admin_mission_hub:create',
  editPrefix: 'admin_mission_hub:edit:',
  togglePrefix: 'admin_mission_hub:toggle:',
  closePrefix: 'admin_mission_hub:close:',
  toggleSubmissionPrefix: 'admin_mission_hub:toggle_submission:',
  applyTemplatePrefix: 'admin_mission_hub:apply_template:',
  previewTodayNotice: 'admin_mission_hub:preview_today_notice',
  publishTodayNotice: 'admin_mission_hub:publish_today_notice',
  refresh: 'admin_mission_hub:refresh',
};
const OPERATOR_SHOP_HUB_BUTTON_IDS = {
  create: 'admin_shop_hub:create',
  editPrefix: 'admin_shop_hub:edit:',
  togglePrefix: 'admin_shop_hub:toggle:',
  soldOutPrefix: 'admin_shop_hub:sold_out:',
  hidePrefix: 'admin_shop_hub:hide:',
  refresh: 'admin_shop_hub:refresh',
};

function createOperatorMissionHubToken(missionId) {
  return `mh_${crypto
    .createHash('sha1')
    .update(String(missionId || ''))
    .digest('hex')
    .slice(0, 16)}`;
}

function createOperatorMissionTemplateToken(templateId) {
  return `mt_${crypto
    .createHash('sha1')
    .update(String(templateId || ''))
    .digest('hex')
    .slice(0, 16)}`;
}

function createOperatorShopHubToken(itemId) {
  return `sh_${crypto
    .createHash('sha1')
    .update(String(itemId || ''))
    .digest('hex')
    .slice(0, 16)}`;
}

const GUIDE_HUB_OPTIONS = [
  {
    label: '처음 왔어요',
    value: 'start',
    description: '처음 들어온 분을 위한 기본 안내',
  },
  {
    label: '오늘 뭐 하면 되나요?',
    value: 'today',
    description: '오늘 참여할 수 있는 흐름 보기',
  },
  {
    label: '내 포인트',
    value: 'points',
    description: '여정 포인트 확인 방법',
  },
  {
    label: '상점/교환',
    value: 'shop',
    description: '포인트 사용과 교환 신청 안내',
  },
  {
    label: '미션/인증',
    value: 'mission',
    description: '미션 참여와 인증 방법 안내',
  },
  {
    label: '문의하기',
    value: 'question',
    description: '질문과 문의 방법 안내',
  },
];

const OPERATOR_HUB_OPTIONS = [
  {
    label: '전체 요약',
    value: 'overview',
    description: '핵심 운영 숫자와 확인 필요 항목',
  },
  {
    label: '오늘의 운영 큐',
    value: 'today_queue',
    description: '오늘 먼저 확인할 처리 대기와 주의 항목',
  },
  {
    label: '첫날 점검',
    value: 'first_day_check',
    description: '첫 운영 전 환경, 대기열, 백업 확인',
  },
  {
    label: '교환 대기',
    value: 'redemptions',
    description: 'pending 교환 신청 목록',
  },
  {
    label: '인증 대기',
    value: 'submissions',
    description: 'pending 미션 인증 제출 목록',
  },
  {
    label: '최근 포인트 로그',
    value: 'points',
    description: '최근 포인트 거래 기록',
  },
  {
    label: '미션/상점 상태',
    value: 'missions_shop',
    description: '미션과 상점 항목 운영 상태',
  },
  {
    label: '미션 관리 허브',
    value: 'mission_management',
    description: '미션 확인, 생성, 수정, 상태 변경',
  },
  {
    label: '상점 관리 허브',
    value: 'shop_management',
    description: '상점 항목 확인, 생성, 상태 변경',
  },
  {
    label: '반응 승인 기록',
    value: 'reaction_approvals',
    description: '미션 인증 채널 이모지 처리 기록',
  },
  {
    label: '반응 후속 확인',
    value: 'reaction_followups',
    description: 'DM/답글 실패와 거래 누락 확인',
  },
  {
    label: '도움 필요 신호',
    value: 'onboarding_signals',
    description: '기본 명령어 첫 사용 흐름 확인',
  },
  {
    label: 'FAQ 후보',
    value: 'faq_candidates',
    description: '반복 fallback 질문 묶음 확인',
  },
  {
    label: 'DM 대화',
    value: 'dm_chat',
    description: '오늘 DM 대화 수와 안전 감지 요약',
  },
  {
    label: '참여자 초대 안내문',
    value: 'invitation_notice',
    description: '초대 전 복사용 공지문 미리보기',
  },
  {
    label: '초대 전 점검',
    value: 'prelaunch_check',
    description: '참여자 초대 준비 상태 체크리스트',
  },
  {
    label: '환경 설정 점검',
    value: 'environment_check',
    description: '주요 환경변수와 Discord 채널 권한 확인',
  },
  {
    label: '내보내기 안내',
    value: 'exports',
    description: '운영 데이터 백업 명령어 안내',
  },
  {
    label: '운영 체크리스트',
    value: 'checklist',
    description: '운영 전후 점검 항목',
  },
];

function createGuideHubSelectRow(selectedValue = null) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(GUIDE_HUB_SELECT_ID)
      .setPlaceholder('궁금한 내용을 선택해 주세요')
      .addOptions(GUIDE_HUB_OPTIONS.map((option) => ({
        ...option,
        default: option.value === selectedValue,
      })))
  );
}

function createOperatorHubSelectRow(selectedValue = null) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(OPERATOR_HUB_SELECT_ID)
      .setPlaceholder('확인할 운영 메뉴를 선택해 주세요')
      .addOptions(OPERATOR_HUB_OPTIONS.map((option) => ({
        ...option,
        default: option.value === selectedValue,
      })))
  );
}

function createDungeonworldChoiceRow(choices) {
  return new ActionRowBuilder().addComponents(
    ...choices.map((choice) => new ButtonBuilder()
      .setCustomId(`${DUNGEONWORLD_CHOICE_PREFIX}${choice.id}`)
      .setLabel(choice.label)
      .setStyle(ButtonStyle.Secondary))
  );
}

function createDungeonworldManageRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.previous)
      .setLabel('이전 회차')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.next)
      .setLabel('다음 회차')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.clearOverride)
      .setLabel('오버라이드 해제')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.refresh)
      .setLabel('새로고침')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createOperatorInvitationNoticeButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(OPERATOR_HUB_BUTTON_IDS.invitationNotice)
      .setLabel('참여자 초대 안내문')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(OPERATOR_HUB_BUTTON_IDS.prelaunchCheck)
      .setLabel('초대 전 점검')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createOperatorPrelaunchCheckActionRow(issues = {}) {
  const buttons = [];

  if (issues.hasEnvironmentIssue) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(OPERATOR_HUB_BUTTON_IDS.prelaunchOpenEnvironmentCheck)
        .setLabel('환경 설정 점검 열기')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (issues.hasMissionIssue) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(OPERATOR_HUB_BUTTON_IDS.prelaunchOpenMissionHub)
        .setLabel('미션 관리 허브 열기')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (issues.hasShopIssue) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(OPERATOR_HUB_BUTTON_IDS.prelaunchOpenShopHub)
        .setLabel('상점 관리 허브 열기')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (buttons.length === 0) {
    return null;
  }

  return new ActionRowBuilder().addComponents(...buttons);
}

function createOperatorShopHubRows(items = [], selectedItemId = null) {
  const selectedItem = items.find((item) => item.id === selectedItemId) || items[0] || null;
  const selectedId = selectedItem ? selectedItem.id : '';
  const rows = [];

  if (items.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(OPERATOR_SHOP_HUB_SELECT_ID)
        .setPlaceholder('관리할 상점 항목을 선택해 주세요')
        .addOptions(items.slice(0, 25).map((item) => ({
          label: String(item.name || item.id).slice(0, 100),
          description: `상태 ${item.status || 'unknown'} / ${item.cost || 0}P`,
          value: createOperatorShopHubToken(item.id),
          default: item.id === selectedId,
        })))
    ));
  }

  const isActive = selectedItem && selectedItem.status === 'active';
  const selectedToken = selectedItem ? createOperatorShopHubToken(selectedItem.id) : 'none';
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(OPERATOR_SHOP_HUB_BUTTON_IDS.create)
      .setLabel('새 항목')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${OPERATOR_SHOP_HUB_BUTTON_IDS.editPrefix}${selectedToken}`)
      .setLabel('수정')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!selectedItem),
    new ButtonBuilder()
      .setCustomId(`${OPERATOR_SHOP_HUB_BUTTON_IDS.togglePrefix}${selectedToken}`)
      .setLabel(isActive ? '비활성화' : '활성화')
      .setStyle(isActive ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(!selectedItem),
    new ButtonBuilder()
      .setCustomId(`${OPERATOR_SHOP_HUB_BUTTON_IDS.soldOutPrefix}${selectedToken}`)
      .setLabel('품절 처리')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!selectedItem || selectedItem.status === 'soldOut'),
    new ButtonBuilder()
      .setCustomId(`${OPERATOR_SHOP_HUB_BUTTON_IDS.hidePrefix}${selectedToken}`)
      .setLabel('숨김')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!selectedItem || selectedItem.status === 'hidden')
  ));

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(OPERATOR_SHOP_HUB_BUTTON_IDS.refresh)
      .setLabel('새로고침')
      .setStyle(ButtonStyle.Secondary)
  ));

  return rows;
}

function createOperatorMissionHubRows(missions = [], selectedMissionId = null) {
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) || missions[0] || null;
  const selectedId = selectedMission ? selectedMission.id : '';
  const rows = [];

  if (missions.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(OPERATOR_MISSION_HUB_SELECT_ID)
        .setPlaceholder('관리할 미션을 선택해 주세요')
        .addOptions(missions.slice(0, 25).map((mission) => ({
          label: String(mission.title || mission.id).slice(0, 100),
          description: `상태 ${mission.status || 'unknown'} / ${mission.rewardPoints || 0}P`,
          value: createOperatorMissionHubToken(mission.id),
          default: mission.id === selectedId,
        })))
    ));
  }

  const isActive = selectedMission && selectedMission.status === 'active';
  const requiresSubmission = !selectedMission || selectedMission.requiresSubmission !== false;
  const selectedToken = selectedMission ? createOperatorMissionHubToken(selectedMission.id) : 'none';
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(OPERATOR_MISSION_HUB_BUTTON_IDS.create)
      .setLabel('새 미션')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${OPERATOR_MISSION_HUB_BUTTON_IDS.editPrefix}${selectedToken}`)
      .setLabel('수정')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!selectedMission),
    new ButtonBuilder()
      .setCustomId(`${OPERATOR_MISSION_HUB_BUTTON_IDS.togglePrefix}${selectedToken}`)
      .setLabel(isActive ? '비활성화' : '활성화')
      .setStyle(isActive ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(!selectedMission),
    new ButtonBuilder()
      .setCustomId(`${OPERATOR_MISSION_HUB_BUTTON_IDS.closePrefix}${selectedToken}`)
      .setLabel('종료')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!selectedMission || selectedMission.status === 'closed'),
    new ButtonBuilder()
      .setCustomId(`${OPERATOR_MISSION_HUB_BUTTON_IDS.toggleSubmissionPrefix}${selectedToken}`)
      .setLabel(requiresSubmission ? '인증 필요 끄기' : '인증 필요 켜기')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!selectedMission)
  ));

  return rows;
}

function createOperatorMissionTemplateRows(templates = [], selectedTemplateId = null) {
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || templates[0] || null;
  const rows = [];

  if (templates.length > 0) {
    rows.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(OPERATOR_MISSION_TEMPLATE_SELECT_ID)
        .setPlaceholder('오늘의 미션으로 적용할 템플릿을 선택해 주세요')
        .addOptions(templates.slice(0, 25).map((template) => ({
          label: String(template.title || template.id).slice(0, 100),
          description: `${template.recommendedDay || '요일 미지정'} / ${template.rewardPoints || 0}P`,
          value: createOperatorMissionTemplateToken(template.id),
          default: selectedTemplate ? template.id === selectedTemplate.id : false,
        })))
    ));
  }

  const selectedTemplateIdValue = selectedTemplate ? createOperatorMissionTemplateToken(selectedTemplate.id) : 'none';
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${OPERATOR_MISSION_HUB_BUTTON_IDS.applyTemplatePrefix}${selectedTemplateIdValue}`)
      .setLabel('템플릿을 오늘의 미션으로 적용')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!selectedTemplate),
    new ButtonBuilder()
      .setCustomId(OPERATOR_MISSION_HUB_BUTTON_IDS.previewTodayNotice)
      .setLabel('공지 미리보기')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(OPERATOR_MISSION_HUB_BUTTON_IDS.publishTodayNotice)
      .setLabel('오늘의 미션 게시')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(OPERATOR_MISSION_HUB_BUTTON_IDS.refresh)
      .setLabel('새로고침')
      .setStyle(ButtonStyle.Secondary)
  ));

  return rows;
}

module.exports = {
  DUNGEONWORLD_CHOICE_PREFIX,
  GUIDE_HUB_OPTIONS,
  GUIDE_HUB_SELECT_ID,
  OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS,
  OPERATOR_DUNGEONWORLD_MANAGE_PREFIX,
  OPERATOR_MISSION_HUB_BUTTON_IDS,
  OPERATOR_MISSION_HUB_SELECT_ID,
  OPERATOR_MISSION_TEMPLATE_SELECT_ID,
  OPERATOR_SHOP_HUB_BUTTON_IDS,
  OPERATOR_SHOP_HUB_SELECT_ID,
  OPERATOR_HUB_BUTTON_IDS,
  OPERATOR_HUB_OPTIONS,
  OPERATOR_HUB_SELECT_ID,
  createOperatorMissionHubToken,
  createOperatorMissionTemplateToken,
  createOperatorShopHubToken,
  createGuideHubSelectRow,
  createOperatorHubSelectRow,
  createOperatorInvitationNoticeButtonRow,
  createOperatorPrelaunchCheckActionRow,
  createOperatorMissionHubRows,
  createOperatorMissionTemplateRows,
  createOperatorShopHubRows,
  createDungeonworldManageRow,
  createDungeonworldChoiceRow,
};

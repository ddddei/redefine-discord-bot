const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { OPERATOR_CHECK_FOOTER, createGuideEmbed, formatPoints, getShopTypeLabel, truncateText } = require('./embeds');
const {
  OPERATOR_MISSION_HUB_BUTTON_IDS,
  createOperatorMissionHubToken, createOperatorMissionTemplateToken, createOperatorShopHubToken,
  createOperatorMissionHubRows, createOperatorMissionTemplateRows, createOperatorShopHubRows,
} = require('./components');
const { formatNullableCount } = require('./operatorInteractionUi');

function formatAdminMissionLine(mission) {
  return [
    `- ID: \`${mission.id}\``,
    `  제목: ${mission.title || '제목 없음'}`,
    `  상태: ${mission.status || '상태 없음'} / 포인트: ${formatPoints(mission.rewardPoints || 0)} / 날짜: ${mission.activeDate || '미지정'}`,
  ].join('\n');
}

function formatAdminShopItemLine(item) {
  return [
    `- ID: \`${item.id}\``,
    `  이름: ${item.name || '이름 없음'}`,
    `  상태: ${item.status || '상태 없음'} / 비용: ${formatPoints(item.cost || 0)} / 재고: ${formatNullableCount(item.stock, '개')} / 유형: ${item.type || '미지정'}`,
  ].join('\n');
}


function createAdminMissionListEmbed(missions) {
  if (missions.length === 0) {
    return createEmptyListEmbed('미션 관리 목록', '등록된 미션이 없어요. `/미션관리 작업:추가`로 먼저 생성해 주세요.');
  }

  return createGuideEmbed(
    '미션 관리 목록',
    [
      ...missions.map(formatAdminMissionLine),
      '',
      'status가 active인 미션만 참여자 `/미션`에 노출됩니다.',
    ].join('\n\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function getMissionHubSelection(missions, selectedMissionId = null) {
  if (!Array.isArray(missions) || missions.length === 0) {
    return null;
  }

  return missions.find((mission) => mission.id === selectedMissionId) || missions[0];
}

function formatMissionParticipantPreview(mission) {
  if (!mission) {
    return [
      '아직 미리볼 미션이 없어요.',
      '새 미션을 만든 뒤 참여자 `/미션` 안내문을 확인할 수 있어요.',
    ].join('\n');
  }

  return [
    `**${mission.title || '제목 없음'}**`,
    truncateText(mission.description || '설명 없음', 700, '설명 없음'),
    '',
    `지급 포인트: ${formatPoints(mission.rewardPoints || 0)}`,
    mission.requiresSubmission === false
      ? '인증 제출 없이 운영 기준에 따라 처리되는 미션입니다.'
      : '참여자는 `/미션` 또는 `/인증` 흐름으로 인증 내용을 제출합니다.',
  ].join('\n');
}

function formatMissionTemplateLine(template, selectedTemplateId = null) {
  const marker = template.id === selectedTemplateId ? '>' : '-';
  return `${marker} \`${template.id}\` ${truncateText(template.title || '제목 없음', 48, '제목 없음')} / ${template.recommendedDay || '요일 미지정'} / ${formatPoints(template.rewardPoints || 0)}`;
}

function formatMissionTemplatePreview(template) {
  if (!template) {
    return [
      '선택된 템플릿이 없습니다.',
      '템플릿을 선택하면 오늘의 미션으로 적용하기 전 안내문을 확인할 수 있어요.',
    ].join('\n');
  }

  return [
    `선택 템플릿: \`${template.id}\``,
    `제목: ${template.title || '제목 없음'}`,
    `추천 요일: ${template.recommendedDay || '미지정'} / 분류: ${template.category || template.type || '미지정'}`,
    `지급: ${formatPoints(template.rewardPoints || 0)} / 인증 필요: ${template.requiresSubmission === false ? '아니오' : '예'}`,
    template.isExample ? '예시 템플릿입니다. 운영자가 선택하면 오늘의 미션으로 복사 생성할 수 있어요.' : null,
    truncateText(template.description || '설명 없음', 500, '설명 없음'),
    template.note ? `운영 메모: ${truncateText(template.note, 180, '')}` : null,
  ].filter(Boolean).join('\n');
}

function formatWeekdayRecommendationLine(recommendation) {
  const templateTitle = recommendation.template ? recommendation.template.title : recommendation.title;
  return `- ${recommendation.label || recommendation.weekday}: ${templateTitle || '추천 미션 없음'}${recommendation.note ? ` (${truncateText(recommendation.note, 45, '')})` : ''}`;
}

function formatTodayMissionRecommendation(recommendation) {
  if (!recommendation || !recommendation.template) {
    return '오늘 요일에 연결된 추천 템플릿이 없습니다. 필요하면 템플릿 목록에서 직접 선택해 주세요.';
  }

  return [
    `${recommendation.label || recommendation.weekday} 추천: ${recommendation.template.title}`,
    truncateText(recommendation.template.description || '설명 없음', 280, '설명 없음'),
    `적용하면 오늘 날짜의 active 미션으로 저장됩니다.`,
  ].join('\n');
}

function buildTodayMissionNoticeEmbed(mission) {
  return createGuideEmbed(
    '오늘의 미션',
    [
      `**${mission.title || '오늘의 미션'}**`,
      truncateText(mission.description || '오늘 편하게 참여할 수 있는 작은 미션입니다.', 700, '오늘 편하게 참여할 수 있는 작은 미션입니다.'),
      '',
      '오늘 할 일',
      '가능한 만큼 해보고, 글이나 사진으로 짧게 남겨 주세요.',
      '',
      '인증 방법',
      mission.requiresSubmission === false
        ? '#오늘의-미션 채널 안내를 확인하고 운영 기준에 맞게 참여해 주세요.'
        : '#오늘의-미션 채널에 글, 사진, 영상 중 편한 방식으로 인증을 올려 주세요.',
      '',
      `지급 포인트: ${formatPoints(mission.rewardPoints || 0)}`,
      '주의사항',
      '- 오늘의 미션 포인트는 하루 1회만 지급됩니다.',
      '- 운영자 확인 후 지급됩니다.',
      '- 얼굴, 주소, 연락처처럼 민감한 정보는 가려도 괜찮아요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildTodayMissionNoticePayload(mission) {
  return {
    embeds: [buildTodayMissionNoticeEmbed(mission)],
    allowedMentions: { parse: [] },
  };
}


function createAdminMissionHubEmbed(missions, selectedMissionId = null, templates = [], selectedTemplateId = null, recommendations = [], todayRecommendation = null) {
  const selectedMission = getMissionHubSelection(missions, selectedMissionId);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)
    || (todayRecommendation && todayRecommendation.template)
    || templates[0]
    || null;
  const missionLines = missions.length > 0
    ? missions.slice(0, 8).map((mission) => {
      const marker = selectedMission && mission.id === selectedMission.id ? '>' : '-';
      return `${marker} \`${mission.id}\` ${truncateText(mission.title || '제목 없음', 60, '제목 없음')} / ${mission.status || 'unknown'} / ${formatPoints(mission.rewardPoints || 0)}`;
    })
    : ['등록된 미션이 없습니다.'];
  const selectedLines = selectedMission
    ? [
      `선택 미션: \`${selectedMission.id}\``,
      `상태: ${selectedMission.status || 'unknown'} / 지급: ${formatPoints(selectedMission.rewardPoints || 0)}`,
      `인증 필요: ${selectedMission.requiresSubmission === false ? '아니오' : '예'}`,
      `날짜: ${selectedMission.activeDate || '미지정'}`,
    ]
    : ['선택된 미션이 없습니다.'];
  const templateLines = templates.length > 0
    ? templates.slice(0, 8).map((template) => formatMissionTemplateLine(template, selectedTemplate ? selectedTemplate.id : null))
    : ['등록된 템플릿이 없습니다.'];
  const recommendationLines = recommendations.length > 0
    ? recommendations.map(formatWeekdayRecommendationLine)
    : ['요일별 추천이 없습니다.'];

  return createGuideEmbed(
    '미션 관리 허브',
    [
      '운영진 전용 미션 관리 화면입니다.',
      '아래에서 현재 미션을 확인하고 버튼으로 생성, 수정, 상태 변경을 진행할 수 있어요.',
      '',
      '현재 미션',
      ...missionLines,
      '',
      ...selectedLines,
      '',
      '참여자 안내문 미리보기',
      formatMissionParticipantPreview(selectedMission),
      '',
      '미션 템플릿',
      ...templateLines,
      '',
      '선택 템플릿 미리보기',
      formatMissionTemplatePreview(selectedTemplate),
      '',
      '요일별 추천',
      ...recommendationLines,
      '',
      '오늘의 추천',
      formatTodayMissionRecommendation(todayRecommendation),
      '',
      'active 상태의 미션만 참여자 `/미션`에 노출됩니다.',
      '템플릿 적용은 미션을 저장할 뿐 자동 공지는 보내지 않습니다.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}


function getMissionHubTokenFromCustomId(customId) {
  const parts = String(customId || '').split(':');
  const token = parts.slice(2).join(':');
  return token && token !== 'none' ? token : '';
}

function getMissionTemplateIdFromCustomId(customId) {
  const prefix = OPERATOR_MISSION_HUB_BUTTON_IDS.applyTemplatePrefix;
  return String(customId || '').startsWith(prefix)
    ? String(customId).slice(prefix.length)
    : '';
}

function getMissionHubStatusInput(value, fallbackStatus = 'draft') {
  const normalized = String(value || fallbackStatus || 'draft').trim();
  const aliases = {
    활성: 'active',
    비활성: 'paused',
    일시중지: 'paused',
    종료: 'closed',
    초안: 'draft',
  };
  const status = aliases[normalized] || normalized;

  if (!['draft', 'active', 'paused', 'closed', 'archived'].includes(status)) {
    throw new Error('상태는 draft, active, paused, closed, archived 중 하나로 입력해 주세요.');
  }

  return status;
}

function createMissionHubModal(action, mission = null) {
  const isUpdate = action === 'update';
  const customId = isUpdate
    ? `admin_mission_hub_modal:update:${createOperatorMissionHubToken(mission.id)}`
    : 'admin_mission_hub_modal:create';

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(isUpdate ? '미션 수정' : '새 미션 만들기')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('미션 제목')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setValue(mission && mission.title ? truncateText(mission.title, 100, '') : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('미션 설명/안내 문구')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setValue(mission && mission.description ? truncateText(mission.description, 1000, '') : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('rewardPoints')
          .setLabel('지급 포인트')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(8)
          .setValue(mission && mission.rewardPoints ? String(mission.rewardPoints) : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('status')
          .setLabel('상태')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setPlaceholder('draft, active, paused, closed')
          .setValue(mission && mission.status ? mission.status : 'draft')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('activeDate')
          .setLabel('미션 날짜 (YYYY-MM-DD)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(10)
          .setPlaceholder('비우면 오늘 날짜 또는 기존 날짜를 유지합니다.')
          .setValue(mission && mission.activeDate ? mission.activeDate : '')
      )
    );
}

function getMissionHubModalInput(interaction, fallbackStatus = 'draft', fallbackActiveDate = null) {
  const rewardPoints = Number.parseInt(interaction.fields.getTextInputValue('rewardPoints'), 10);
  if (!Number.isInteger(rewardPoints) || rewardPoints <= 0) {
    throw new Error('지급 포인트는 0보다 큰 정수로 입력해 주세요.');
  }

  const activeDateInput = interaction.fields.getTextInputValue('activeDate').trim();
  if (activeDateInput && !/^\d{4}-\d{2}-\d{2}$/.test(activeDateInput)) {
    throw new Error('미션 날짜는 YYYY-MM-DD 형식으로 입력해 주세요.');
  }

  return {
    title: interaction.fields.getTextInputValue('title'),
    description: interaction.fields.getTextInputValue('description'),
    rewardPoints,
    status: getMissionHubStatusInput(interaction.fields.getTextInputValue('status'), fallbackStatus),
    activeDate: activeDateInput || fallbackActiveDate,
  };
}

function createAdminShopListEmbed(items) {
  if (items.length === 0) {
    return createEmptyListEmbed('상점 관리 목록', '등록된 상점 항목이 없어요. `/상점관리 작업:추가`로 먼저 생성해 주세요.');
  }

  return createGuideEmbed(
    '상점 관리 목록',
    [
      ...items.map(formatAdminShopItemLine),
      '',
      'status가 active인 항목만 참여자 `/상점`에 노출됩니다.',
    ].join('\n\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function getShopHubSelection(items, selectedItemId = null) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items.find((item) => item.id === selectedItemId) || items[0];
}

function createAdminShopHubEmbed(items, selectedItemId = null) {
  const selectedItem = getShopHubSelection(items, selectedItemId);
  const itemLines = items.length > 0
    ? items.slice(0, 8).map((item) => {
      const marker = selectedItem && item.id === selectedItem.id ? '>' : '-';
      return `${marker} \`${item.id}\` ${truncateText(item.name || '이름 없음', 60, '이름 없음')} / ${item.status || 'unknown'} / ${formatPoints(item.cost || 0)}`;
    })
    : ['등록된 상점 항목이 없습니다.'];
  const selectedLines = selectedItem
    ? [
      `선택 항목: \`${selectedItem.id}\``,
      `상태: ${selectedItem.status || 'unknown'} / 비용: ${formatPoints(selectedItem.cost || 0)}`,
      `재고: ${formatNullableCount(selectedItem.stock, '개')} / 월한도: ${formatNullableCount(selectedItem.monthlyLimit, '회')}`,
      `유형: ${selectedItem.type || '미지정'}`,
      truncateText(selectedItem.description || '설명 없음', 500, '설명 없음'),
    ]
    : ['선택된 상점 항목이 없습니다.'];

  return createGuideEmbed(
    '상점 관리 허브',
    [
      '운영진 전용 상점 관리 화면입니다.',
      '아래에서 현재 상점 항목을 확인하고 버튼으로 생성, 수정, 상태 변경을 진행할 수 있어요.',
      '',
      '현재 상점 항목',
      ...itemLines,
      '',
      ...selectedLines,
      '',
      'active 상태의 항목만 참여자 `/상점`에 노출됩니다.',
      '재고, 월한도 등 세부 값은 `/상점관리`로도 조정할 수 있어요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function getShopHubTokenFromCustomId(customId) {
  const parts = String(customId || '').split(':');
  const token = parts.slice(2).join(':');
  return token && token !== 'none' ? token : '';
}

function getShopHubTypeInput(value, fallbackType = 'reward') {
  const normalized = String(value || fallbackType || 'reward').trim();
  const aliases = {
    청년동포인트: 'youthCenterPoint',
    리워드: 'reward',
    굿즈: 'goods',
    이벤트: 'event',
  };
  const type = aliases[normalized] || normalized;

  if (!['youthCenterPoint', 'reward', 'goods', 'event'].includes(type)) {
    throw new Error('유형은 youthCenterPoint, reward, goods, event 중 하나로 입력해 주세요.');
  }

  return type;
}

function getShopHubStatusInput(value, fallbackStatus = 'paused') {
  const normalized = String(value || fallbackStatus || 'paused').trim();
  const aliases = {
    활성: 'active',
    비활성: 'paused',
    일시중지: 'paused',
    품절: 'soldOut',
    숨김: 'hidden',
  };
  const status = aliases[normalized] || normalized;

  if (!['active', 'paused', 'soldOut', 'hidden'].includes(status)) {
    throw new Error('상태는 active, paused, soldOut, hidden 중 하나로 입력해 주세요.');
  }

  return status;
}

function createShopHubModal(action, item = null) {
  const isUpdate = action === 'update';
  const customId = isUpdate
    ? `admin_shop_hub_modal:update:${createOperatorShopHubToken(item.id)}`
    : 'admin_shop_hub_modal:create';

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(isUpdate ? '상점 항목 수정' : '새 상점 항목 만들기')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('항목 이름')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setValue(item && item.name ? truncateText(item.name, 100, '') : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('항목 설명')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setValue(item && item.description ? truncateText(item.description, 1000, '') : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cost')
          .setLabel('필요 포인트')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(8)
          .setValue(item && item.cost ? String(item.cost) : '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('type')
          .setLabel('유형')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setPlaceholder('youthCenterPoint, reward, goods, event')
          .setValue(item && item.type ? item.type : 'reward')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('status')
          .setLabel('상태')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20)
          .setPlaceholder('active, paused, soldOut, hidden')
          .setValue(item && item.status ? item.status : 'paused')
      )
    );
}

function getShopHubModalInput(interaction, fallbackType = 'reward', fallbackStatus = 'paused') {
  const cost = Number.parseInt(interaction.fields.getTextInputValue('cost'), 10);
  if (!Number.isInteger(cost) || cost <= 0) {
    throw new Error('필요 포인트는 0보다 큰 정수로 입력해 주세요.');
  }

  return {
    name: interaction.fields.getTextInputValue('name'),
    description: interaction.fields.getTextInputValue('description'),
    cost,
    type: getShopHubTypeInput(interaction.fields.getTextInputValue('type'), fallbackType),
    status: getShopHubStatusInput(interaction.fields.getTextInputValue('status'), fallbackStatus),
  };
}


module.exports = {
  buildTodayMissionNoticeEmbed, buildTodayMissionNoticePayload, createAdminMissionHubEmbed,
  createAdminMissionListEmbed, createAdminShopHubEmbed, createAdminShopListEmbed,
  createMissionHubModal, createShopHubModal, formatAdminMissionLine, formatAdminShopItemLine,
  getMissionHubModalInput, getMissionHubSelection, getMissionHubStatusInput,
  getMissionHubTokenFromCustomId, getMissionTemplateIdFromCustomId, getShopHubModalInput,
  getShopHubSelection, getShopHubStatusInput, getShopHubTokenFromCustomId, getShopHubTypeInput,
};

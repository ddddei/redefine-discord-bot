const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const {
  formatPoints,
  formatTransactionDate,
  truncateText,
} = require('./embeds');

const PARTICIPANT_MENU_BUTTON_IDS = {
  onboarding: 'participant_menu_onboarding',
  todayMission: 'participant_menu_today_mission',
  points: 'participant_menu_points',
  ranking: 'participant_menu_ranking',
  minigames: 'participant_menu_minigames',
  help: 'participant_menu_help',
};

function createInsufficientPointsDescription({ currentPoints = 0, requiredPoints = 0 } = {}) {
  return [
    '아직 포인트가 조금 부족해요.', '',
    `현재 포인트: ${formatPoints(currentPoints)}`,
    `필요 포인트: ${formatPoints(requiredPoints)}`, '',
    '체크인이나 미션 참여 후 다시 신청할 수 있어요.', '',
    '- `/체크인`으로 오늘의 기록 남기기',
    '- `/미션`에서 참여 가능한 활동 확인하기',
    '- `/포인트`로 내 포인트 다시 확인하기',
  ].join('\n');
}

function getRedemptionFailureMessage(reason) {
  const messages = {
    USER_NOT_FOUND: [
      '현재 포인트 기록이 없어 아직 신청할 수 없어요.', '',
      '먼저 체크인이나 미션 참여 후 다시 확인해 주세요.', '',
      '- `/체크인`으로 오늘의 기록 남기기',
      '- `/미션`에서 참여 가능한 활동 확인하기',
      '- `/포인트`로 내 포인트 다시 확인하기',
    ].join('\n'),
    ITEM_NOT_FOUND: '해당 항목을 찾지 못했어요. `/상점`에서 신청 코드를 다시 확인해 주세요.',
    SOLD_OUT: '해당 항목은 현재 재고가 없어 신청할 수 없어요.',
    ITEM_NOT_ACTIVE: '해당 항목은 현재 신청 가능한 상태가 아니에요.',
    INSUFFICIENT_POINTS: createInsufficientPointsDescription(),
  };
  return messages[reason] || '교환 신청 조건을 확인하지 못했어요. 운영진에게 알려주세요.';
}

function formatShopLimit(item) {
  const stockText = typeof item.stock === 'number' ? `재고 ${item.stock}개` : '재고 운영진 확인';
  const monthlyLimitText = typeof item.monthlyLimit === 'number' ? `월 한도 ${item.monthlyLimit}회` : '월 한도 운영진 확인';
  return `${stockText} / ${monthlyLimitText}`;
}

function createShopSelectRow(items) {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId('participant_shop_select')
    .setPlaceholder('교환할 항목을 선택해 주세요')
    .addOptions(items.slice(0, 25).map((item) => ({
      label: truncateText(`${item.displayCode} ${item.name}`, 100, item.displayCode || item.id),
      description: truncateText(`필요 포인트 ${formatPoints(item.cost)}`, 100, '상점 항목'),
      value: item.displayCode || item.id,
    }))));
}

function createRedemptionConfirmRow(displayCode) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`participant_redeem_confirm:${displayCode}`).setLabel('교환 신청하기').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`participant_redeem_cancel_check:${displayCode}`).setLabel('신청하지 않기').setStyle(ButtonStyle.Secondary)
  );
}

function createParticipantMenuButtonRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(PARTICIPANT_MENU_BUTTON_IDS.onboarding).setLabel('🌱 처음 왔다면 여기부터').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(PARTICIPANT_MENU_BUTTON_IDS.todayMission).setLabel('🌱 오늘의 미션 보기').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(PARTICIPANT_MENU_BUTTON_IDS.points).setLabel('💰 내 포인트 확인').setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(PARTICIPANT_MENU_BUTTON_IDS.ranking).setLabel('🏆 랭킹 확인').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PARTICIPANT_MENU_BUTTON_IDS.minigames).setLabel('🎮 미니게임').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(PARTICIPANT_MENU_BUTTON_IDS.help).setLabel('❓ 이용 방법 보기').setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createParticipantOnboardingNextStepRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(PARTICIPANT_MENU_BUTTON_IDS.todayMission).setLabel('🌱 오늘의 미션 보기').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(PARTICIPANT_MENU_BUTTON_IDS.points).setLabel('💰 내 포인트 확인').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(PARTICIPANT_MENU_BUTTON_IDS.minigames).setLabel('🎮 미니게임').setStyle(ButtonStyle.Secondary)
  );
}

function createRedemptionCancelConfirmRow(displayCode) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`participant_redeem_cancel_done:${displayCode}`).setLabel('네, 종료할게요').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`participant_redeem_cancel_back:${displayCode}`).setLabel('다시 확인할게요').setStyle(ButtonStyle.Primary)
  );
}

function getEmbedJson(embed) {
  if (!embed) return {};
  if (typeof embed.toJSON === 'function') return embed.toJSON();
  return embed.data || embed;
}

function buildSubmissionReviewStatusEmbed(baseEmbed, result, reviewerDisplayName, alreadyProcessed = false) {
  const approved = result.submission.status === 'approved';
  const duplicateBlocked = result.submission.duplicateRewardBlocked === true;
  const baseJson = getEmbedJson(baseEmbed);
  const filteredFields = Array.isArray(baseJson.fields)
    ? baseJson.fields.filter((field) => !['처리 안내', '처리 상태', '처리자'].includes(field.name)) : [];
  const statusLine = alreadyProcessed ? `이미 ${approved ? '승인' : '반려'} 처리된 인증 제출이에요.` : `${approved ? '승인' : '반려'} 완료`;
  const pointLine = result.transaction ? `지급 포인트: ${formatPoints(result.transaction.amount)}`
    : (duplicateBlocked ? '지급 포인트: 이미 오늘 지급 완료 / 추가 지급 없음' : '지급 포인트: 없음');
  return new EmbedBuilder({
    ...baseJson,
    fields: [...filteredFields,
      { name: '처리 상태', value: [statusLine, pointLine, `처리 시간: ${formatTransactionDate(result.submission.reviewedAt)}`].join('\n') },
      { name: '처리자', value: truncateText(reviewerDisplayName || result.submission.reviewedBy || '운영진', 300) }],
  }).setColor(approved ? 0x5f8f6b : 0x8f6b5f).setTitle(approved ? '미션 인증 승인 완료' : '미션 인증 반려 완료');
}

function createMissionSelectRow(missions) {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId('participant_mission_select').setPlaceholder('인증할 미션을 선택해 주세요')
    .addOptions(missions.slice(0, 25).map((mission) => ({
      label: truncateText(`${mission.displayCode} ${mission.title || mission.id}`, 100, mission.displayCode || mission.id),
      description: truncateText(`지급 포인트 ${formatPoints(mission.rewardPoints || 0)}`, 100, '미션'),
      value: mission.displayCode || mission.id,
    }))));
}

function createMissionSubmissionModal(mission) {
  return new ModalBuilder().setCustomId(`participant_mission_submit:${mission.displayCode || mission.id}`)
    .setTitle(truncateText('미션 인증하기', 45, '미션 인증')).addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('content').setLabel('인증 내용')
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(2).setMaxLength(1000)
        .setPlaceholder('수행 내용을 필요한 만큼만 적어 주세요.'))
    );
}

module.exports = {
  PARTICIPANT_MENU_BUTTON_IDS, buildSubmissionReviewStatusEmbed, createInsufficientPointsDescription,
  createMissionSelectRow, createMissionSubmissionModal, createParticipantMenuButtonRows,
  createParticipantOnboardingNextStepRow, createRedemptionCancelConfirmRow, createRedemptionConfirmRow,
  createShopSelectRow, formatShopLimit, getEmbedJson, getRedemptionFailureMessage,
};

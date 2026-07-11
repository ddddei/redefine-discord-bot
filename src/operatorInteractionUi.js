const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  OPERATOR_CHECK_FOOTER,
  createGuideEmbed,
  formatPoints,
  formatTransactionAmount,
  formatTransactionDate,
  getNoticeTemplate,
} = require('./embeds');
const { buildPayoutPreviewLines } = require('./webgamePayout');

const WEBGAME_PAYOUT_CONFIRM_PREFIX = 'operator_webgame_payout_confirm:';
const WEBGAME_PAYOUT_CANCEL_ID = 'operator_webgame_payout_cancel';

function createPointTransactionLogEmbed(transactions) {
  const lines = transactions.length > 0
    ? transactions.map((transaction) => [
      `- ${formatTransactionDate(transaction.createdAt)}`, transaction.id, transaction.userId,
      transaction.type, formatTransactionAmount(transaction.amount),
      `잔액 ${formatPoints(transaction.balanceAfter)}`, transaction.reason,
    ].join(' / '))
    : ['아직 표시할 실제 포인트 로그가 없습니다.'];
  return createGuideEmbed('포인트 로그', lines.join('\n'), { footer: OPERATOR_CHECK_FOOTER });
}

function createEmptyListEmbed(title, guideText) {
  return createGuideEmbed(title, guideText, { footer: OPERATOR_CHECK_FOOTER });
}

function formatNullableCount(value, unit) {
  return typeof value === 'number' ? `${value}${unit}` : '운영진 확인';
}

function createNoticeEmbed(type) {
  return createGuideEmbed('공지 템플릿', [
    '아래 문안을 필요한 만큼 다듬어 공지 채널에 사용해 주세요.',
    '세부 내용은 운영진 안내를 기준으로 확인해 주세요.', '', '```', getNoticeTemplate(type), '```',
  ].join('\n'), { footer: OPERATOR_CHECK_FOOTER });
}

function createWebgamePayoutPreviewPayload(plan) {
  return {
    embeds: [createGuideEmbed('웹게임 주간 보상 지급 미리보기', buildPayoutPreviewLines(plan).join('\n'), { footer: OPERATOR_CHECK_FOOTER })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${WEBGAME_PAYOUT_CONFIRM_PREFIX}${plan.weekKey}`).setLabel('✅ 지급 승인').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(WEBGAME_PAYOUT_CANCEL_ID).setLabel('취소').setStyle(ButtonStyle.Secondary)
    )],
    ephemeral: true,
  };
}

function createOperationExportEmbed(payload) {
  return createGuideEmbed('운영 데이터 내보내기', [
    `종류: ${payload.kindLabel}`, `형식: ${payload.formatLabel}`, `포함 개수: ${payload.rowCount}`,
    `생성 시간: ${payload.generatedAt}`, '',
    payload.format === 'summary' ? payload.content : `파일명: \`${payload.filename}\``, '',
    '파일을 안전한 위치에 보관해 주세요.', '외부 공유 시 개인정보 포함 여부를 반드시 확인해 주세요.',
    '이 내보내기는 운영자 백업용이며 공개 채널에 공유하지 않는 것을 권장합니다.',
  ].join('\n'), { footer: OPERATOR_CHECK_FOOTER });
}

function createMissionAdminResultEmbed(title, mission, extraLines = []) {
  return createGuideEmbed(title, [
    `미션 ID: \`${mission.id}\``, `제목: ${mission.title || '제목 없음'}`, `상태: ${mission.status}`,
    `지급 포인트: ${formatPoints(mission.rewardPoints || 0)}`,
    `인증 필요: ${mission.requiresSubmission === false ? '아니오' : '예'}`,
    `날짜: ${mission.activeDate || '미지정'}`, ...extraLines,
  ].join('\n'), { footer: OPERATOR_CHECK_FOOTER });
}

function createShopAdminResultEmbed(title, item, extraLines = []) {
  return createGuideEmbed(title, [
    `항목 ID: \`${item.id}\``, `이름: ${item.name || '이름 없음'}`, `상태: ${item.status}`,
    `비용: ${formatPoints(item.cost || 0)}`, `재고: ${formatNullableCount(item.stock, '개')}`,
    `월한도: ${formatNullableCount(item.monthlyLimit, '회')}`, `유형: ${item.type || '미지정'}`, ...extraLines,
  ].join('\n'), { footer: OPERATOR_CHECK_FOOTER });
}

module.exports = {
  WEBGAME_PAYOUT_CANCEL_ID, WEBGAME_PAYOUT_CONFIRM_PREFIX, createEmptyListEmbed,
  createMissionAdminResultEmbed, createNoticeEmbed, createOperationExportEmbed,
  createPointTransactionLogEmbed, createShopAdminResultEmbed, createWebgamePayoutPreviewPayload,
  formatNullableCount,
};

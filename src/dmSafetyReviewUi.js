const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const BUTTON_PREFIX = 'dm_safety_review';

function createReviewToken(review) {
  const updatedMs = new Date(review.updatedAt).getTime();
  return `${review.id}.${updatedMs.toString(36)}`;
}

function parseReviewToken(value) {
  const token = String(value || '');
  const separator = token.lastIndexOf('.');
  if (separator < 1) return null;
  const updatedMs = Number.parseInt(token.slice(separator + 1), 36);
  if (!Number.isFinite(updatedMs)) return null;
  return { id: token.slice(0, separator), updatedAt: new Date(updatedMs).toISOString() };
}

function buildCustomId(action, review) {
  return `${BUTTON_PREFIX}:${action}:${createReviewToken(review)}`;
}

function parseCustomId(customId) {
  const parts = String(customId || '').split(':');
  if (parts.length !== 3 || parts[0] !== BUTTON_PREFIX) return null;
  const token = parseReviewToken(parts[2]);
  return token ? { action: parts[1], ...token } : null;
}

function createDmSafetyReviewRows(reviews = []) {
  return reviews.slice(0, 2).map((review) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(buildCustomId('reviewed', review)).setLabel('확인').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(buildCustomId('followUp', review)).setLabel('후속 필요').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(buildCustomId('closed', review)).setLabel('종료').setStyle(ButtonStyle.Success)
  ));
}

function buildDmSafetyReviewEmbed(summary = {}, reviews = []) {
  const counts = summary.reviewCounts || {};
  const lines = reviews.length ? reviews.map((review, index) => (
    `${index + 1}. ${review.direction === 'output' ? '출력' : '입력'} · ${review.detectedAt || '시각 미상'} · 사용자 ${review.userId} · 로그 ${review.sourceLogId}`
  )) : ['대기 중인 안전 확인 기록이 없습니다.'];

  return new EmbedBuilder()
    .setColor(0xb85c5c)
    .setTitle('DM 안전 확인 큐')
    .setDescription([
      `대기 ${counts.pending || 0}건 · 후속 필요 ${counts.followUp || 0}건`,
      '이 상태는 운영 처리 상태이며 참여자의 상태 판정이 아닙니다.',
      '',
      ...lines,
      '',
      '원문 상세는 운영진 전용 DM 로그에서 sourceLogId를 대조해 확인하세요.',
    ].join('\n'));
}

function createDmSafetyReviewPayload(summary, reviews) {
  return { embeds: [buildDmSafetyReviewEmbed(summary, reviews)], components: createDmSafetyReviewRows(reviews) };
}

module.exports = {
  BUTTON_PREFIX,
  buildCustomId,
  buildDmSafetyReviewEmbed,
  createDmSafetyReviewPayload,
  createDmSafetyReviewRows,
  parseCustomId,
};

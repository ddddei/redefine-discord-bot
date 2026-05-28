const { EmbedBuilder } = require('discord.js');
const {
  fallbackChannelGuide,
  fallbackContactNoticeTemplate,
  loadChannelGuide,
  noticeTemplates,
} = require('./data');

const EMBED_COLOR = 0x8f7a5f;
const EMBED_DESCRIPTION_LIMIT = 4096;
const EMBED_FIELD_VALUE_LIMIT = 1024;
const EMBED_FOOTER_LIMIT = 2048;
const TRUNCATED_SUFFIX = '\n\n내용이 길어 일부만 표시했어요. 필요한 경우 운영진에게 알려주세요.';
const DEFAULT_FOOTER = '리디파인 가이드 봇';
const OPERATOR_CHECK_FOOTER = '세부 내용은 운영진 안내를 기준으로 확인해 주세요.';

function truncateText(text, maxLength, fallbackText = '') {
  const value = String(text || '').trim();

  if (!value) {
    return fallbackText;
  }

  if (value.length <= maxLength) {
    return value;
  }

  const suffix = TRUNCATED_SUFFIX.length < maxLength ? TRUNCATED_SUFFIX : '...';
  return `${value.slice(0, maxLength - suffix.length)}${suffix}`;
}

function truncateEmbedValue(text, maxLength = 1000) {
  return truncateText(text, Math.min(maxLength, EMBED_FIELD_VALUE_LIMIT), '(질문 내용 없음)');
}

function createGuideEmbed(title, description, options = {}) {
  return new EmbedBuilder()
    .setColor(options.color || EMBED_COLOR)
    .setTitle(truncateText(title, 256, '리디파인 안내'))
    .setDescription(truncateText(description, EMBED_DESCRIPTION_LIMIT, '안내 내용을 불러오지 못했어요. 운영진에게 알려주세요.'))
    .setFooter({
      text: truncateText(options.footer || DEFAULT_FOOTER, EMBED_FOOTER_LIMIT, DEFAULT_FOOTER),
    });
}

function createKnowledgeEmbed(item) {
  return createGuideEmbed(
    item.title,
    [
      item.summary,
      '',
      item.content,
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function formatPoints(points) {
  const value = typeof points === 'number' && Number.isFinite(points) ? points : 0;
  return `${value}P`;
}

function formatTransactionAmount(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '0P';
  }

  return `${amount > 0 ? '+' : ''}${amount}P`;
}

function formatTransactionDate(createdAt) {
  if (!createdAt) {
    return '날짜 없음';
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '날짜 없음';
  }

  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function createPointBalanceEmbed({ currentPoints, transactions = [], balanceCheck }) {
  const recentTransactions = transactions.slice(0, 3);
  const transactionLines = recentTransactions.length > 0
    ? recentTransactions.map((transaction) => {
      const amount = formatTransactionAmount(transaction.amount);
      const reason = truncateText(transaction.reason, 80, '포인트 기록');
      return `- ${formatTransactionDate(transaction.createdAt)} ${amount} ${reason}`;
    })
    : ['아직 기록된 여정 포인트가 없어요.'];
  const balanceNote = balanceCheck && balanceCheck.ok === false
    ? [
      '',
      '저장된 포인트와 기록 합계가 달라 운영진 확인이 필요해요.',
    ]
    : [];

  return createGuideEmbed(
    '내 여정 포인트',
    [
      `현재 보유 여정 포인트: **${formatPoints(currentPoints)}**`,
      '',
      '최근 기록',
      ...transactionLines,
      ...balanceNote,
      '',
      '여정 포인트는 참여를 돕는 선택형 요소이며, 비교나 경쟁을 위한 점수가 아니에요.',
      '현재는 운영 전 조회형 v1이라 실제 운영 데이터 저장 방식은 확정 전이에요.',
    ].join('\n')
  );
}

function formatShopLimit(item) {
  const stockText = typeof item.stock === 'number'
    ? `재고 ${item.stock}개`
    : '재고 운영진 확인';
  const monthlyLimitText = typeof item.monthlyLimit === 'number'
    ? `월 한도 ${item.monthlyLimit}회`
    : '월 한도 운영진 확인';

  return `${stockText} / ${monthlyLimitText}`;
}

function createShopEmbed(items) {
  const embed = createGuideEmbed(
    '여정 포인트 상점',
    [
      '현재 확인 가능한 교환 항목입니다.',
      '',
      '/교환 기능은 아직 준비 중입니다.',
      '실제 항목과 비용, 재고, 월 한도는 운영진 확정 후 달라질 수 있어요.',
      '청년동 포인트 전환권은 청년동 내부 사용처에 한정된 운영진 처리 항목이에요.',
      '실제 신청 전 운영진 공지를 기준으로 확인해 주세요.',
    ].join('\n')
  );

  const fields = items.slice(0, 10).map((item) => ({
    name: truncateText(item.name, 256, '상점 항목'),
    value: truncateEmbedValue([
      `필요 포인트: ${formatPoints(item.cost)}`,
      `설명: ${truncateText(item.description, 220, '상세 설명은 운영진 안내를 확인해 주세요.')}`,
      formatShopLimit(item),
    ].join('\n')),
  }));

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (items.length > fields.length) {
    embed.addFields({
      name: '추가 항목',
      value: '표시 가능한 길이를 넘어 일부 항목만 보여드렸어요. 운영진 공지를 함께 확인해 주세요.',
    });
  }

  return embed;
}

function getNoticeTemplate(type) {
  const template = noticeTemplates[type] || noticeTemplates.contact;

  if (Array.isArray(template)) {
    return template.join('\n');
  }

  if (typeof template === 'string' && template.trim()) {
    return template;
  }

  return fallbackContactNoticeTemplate;
}

function formatChannelCategory(category) {
  return (category.channels || [])
    .map((channel) => `**#${channel.name}** - ${channel.description}`)
    .join('\n');
}

function createChannelGuideEmbed(options = {}) {
  const guide = loadChannelGuide();
  const intro = Array.isArray(guide.intro)
    ? guide.intro.join('\n')
    : String(guide.intro || fallbackChannelGuide.intro.join('\n'));
  const description = options.roleNote
    ? [intro, '', options.roleNote].join('\n')
    : intro;

  const embed = createGuideEmbed(guide.title || fallbackChannelGuide.title, description);
  const fields = (guide.categories || [])
    .map((category) => ({
      name: truncateText(category.name, 256),
      value: truncateEmbedValue(formatChannelCategory(category), EMBED_FIELD_VALUE_LIMIT),
    }))
    .filter((field) => field.name && field.value);

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

module.exports = {
  OPERATOR_CHECK_FOOTER,
  createChannelGuideEmbed,
  createGuideEmbed,
  createPointBalanceEmbed,
  createShopEmbed,
  createKnowledgeEmbed,
  getNoticeTemplate,
  truncateEmbedValue,
  truncateText,
};

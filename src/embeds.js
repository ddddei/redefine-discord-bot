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
      '체크인, 미션, 상점 이용 내역을 여기에서 가볍게 확인할 수 있어요.',
    ].join('\n')
  );
}

function createGuideHubEmbed() {
  return createGuideEmbed(
    '처음 오셨다면 여기서 시작해요',
    [
      '리디파인 봇은 미션, 포인트, 상점 이용을 도와주는 안내 봇이에요.',
      '아래 메뉴에서 궁금한 내용을 골라 확인해 주세요.',
      '',
      '처음에는 `/안내`, `/포인트`, `/미션`, `/상점`, `/체크인` 정도만 기억해도 충분해요.',
    ].join('\n')
  );
}

function createGuideHubDetailEmbed(value, options = {}) {
  const currentPoints = formatPoints(options.currentPoints);
  const activeMissionCount = typeof options.activeMissionCount === 'number'
    ? options.activeMissionCount
    : null;

  const details = {
    start: {
      title: '처음 안내',
      description: [
        '처음에는 천천히 둘러봐도 괜찮아요.',
        '',
        '리디파인 디스코드는 안내, 미션, 포인트, 상점, 문의가 한곳에 모여 있는 공간이에요.',
        '모든 활동은 강제 과제가 아니라, 가능한 범위에서 참여하는 선택형 활동입니다.',
        '',
        '먼저 해볼 수 있는 것:',
        '- `/체크인`으로 오늘의 상태를 가볍게 남기기',
        '- `/미션`에서 참여 가능한 활동 확인하기',
        '- `/포인트`로 내 여정 포인트 확인하기',
        '- `/상점`에서 교환 가능한 항목 둘러보기',
      ].join('\n'),
    },
    today: {
      title: '오늘 뭐 하면 되나요?',
      description: [
        '오늘은 이렇게 시작해도 좋아요.',
        '',
        ...(activeMissionCount === null ? [] : [`현재 참여 가능한 미션: ${activeMissionCount}개`, '']),
        '1. `/체크인`으로 오늘의 상태를 가볍게 남겨요.',
        '2. `/미션`에서 참여 가능한 미션을 확인해요.',
        '3. 인증이 필요한 활동은 미션 인증 채널에 올려요.',
        '4. 운영진 확인 후 포인트가 지급돼요.',
        '5. `/포인트`로 내 포인트를 확인해요.',
      ].join('\n'),
    },
    points: {
      title: '내 포인트',
      description: [
        '여정 포인트는 참여를 기록하기 위한 작은 보상이에요.',
        '',
        '포인트는 경쟁이나 순위를 위한 점수가 아니에요.',
        '체크인, 미션 참여, 프로그램 활동 등을 통해 받을 수 있고, 운영진이 정한 항목으로 교환할 수 있어요.',
        '',
        `현재 내 포인트: ${currentPoints}`,
        '',
        '확인 방법:',
        '- `/포인트`로 내 포인트 확인',
        '- `/상점`으로 교환 가능한 항목 확인',
      ].join('\n'),
    },
    shop: {
      title: '상점/교환',
      description: [
        '상점에서는 여정 포인트로 교환 가능한 항목을 볼 수 있어요.',
        '',
        '사용 방법:',
        '1. `/상점` 또는 `/교환`을 입력해요.',
        '2. 목록에서 원하는 항목을 선택해요.',
        '3. 신청 전 내용을 한 번 더 확인해요.',
        '4. 교환 신청이 접수되면 운영진이 순차적으로 확인해요.',
        '',
        '안내:',
        '- 선택만으로는 포인트가 차감되지 않아요.',
        '- 교환 신청을 완료하면 포인트가 차감돼요.',
        '- 단순 변심에 따른 취소나 환불은 원칙적으로 어려울 수 있어요.',
      ].join('\n'),
    },
    mission: {
      title: '미션/인증',
      description: [
        '미션은 가능한 범위에서 참여하는 선택형 활동이에요.',
        '',
        '기본 참여 방법:',
        '1. `/미션`으로 참여 가능한 미션을 확인해요.',
        '2. 미션 인증 채널에 글, 사진, 영상을 올려요.',
        '3. 운영진이 확인하면 ✅ 반응으로 승인해요.',
        '4. 승인되면 여정 포인트가 지급돼요.',
        '5. 지급 여부는 DM 또는 `/포인트`에서 확인할 수 있어요.',
        '',
        '보조 방법:',
        '직접 제출이 필요한 경우에는 `/인증` 명령어를 사용할 수 있어요.',
      ].join('\n'),
    },
    question: {
      title: '문의하기',
      description: [
        '궁금한 점은 편하게 남겨 주세요.',
        '',
        '가벼운 질문은 `/질문`으로 물어볼 수 있어요.',
        '운영진 확인이 필요한 내용은 운영진 문의 채널을 이용해 주세요.',
        '',
        '예시:',
        '- 프로그램 일정이 궁금해요.',
        '- 포인트가 지급되지 않은 것 같아요.',
        '- 교환 신청을 확인하고 싶어요.',
        '- 미션 인증 방법이 헷갈려요.',
        '',
        '민감한 개인정보는 공개 채널에 자세히 남기지 않는 편이 좋아요.',
        '위기 표현이나 긴급한 안전 문제가 담긴 문의는 운영진이 확인할 수 있어요.',
      ].join('\n'),
    },
  };

  const detail = details[value] || details.start;

  return createGuideEmbed(detail.title, detail.description);
}

function getShopTypeLabel(type) {
  const normalizedType = String(type || '').trim();
  const labels = {
    youthCenterPoint: '🟢 청년동 포인트',
    reward: '🎁 리워드',
    goods: '🎁 굿즈',
    event: '✨ 이벤트',
    subscription: '🎟️ 구독권',
  };

  if (labels[normalizedType]) {
    return labels[normalizedType];
  }

  if (/subscription|구독/.test(normalizedType)) {
    return '🎟️ 구독권';
  }

  return '🎁 리워드';
}

function formatShopParticipantSummary(item) {
  if (String(item.type || '').trim() === 'youthCenterPoint') {
    return `${formatPoints(item.cost)}로 청년동 포인트 전환을 신청할 수 있어요.`;
  }

  return `${formatPoints(item.cost)}로 교환을 신청할 수 있어요.`;
}

function createShopEmbed(items) {
  const embed = createGuideEmbed(
    '여정 포인트 상점',
    [
      '교환할 항목을 아래에서 골라주세요.',
      '선택만으로는 포인트가 차감되지 않아요.',
    ].join('\n')
  );

  const fields = items.slice(0, 10).map((item) => ({
    name: truncateText(`${getShopTypeLabel(item.type)}\n${item.name}`, 256, '상점 항목'),
    value: truncateEmbedValue(formatShopParticipantSummary(item), 80),
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
  createGuideHubDetailEmbed,
  createGuideHubEmbed,
  createGuideEmbed,
  createPointBalanceEmbed,
  createShopEmbed,
  createKnowledgeEmbed,
  formatPoints,
  formatTransactionAmount,
  formatTransactionDate,
  getShopTypeLabel,
  getNoticeTemplate,
  truncateEmbedValue,
  truncateText,
};

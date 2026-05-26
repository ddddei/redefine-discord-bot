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
  createKnowledgeEmbed,
  getNoticeTemplate,
  truncateEmbedValue,
  truncateText,
};

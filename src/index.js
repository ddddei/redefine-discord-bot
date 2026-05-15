require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
} = require('discord.js');

console.log('봇 실행 준비 중...');

const faqPath = path.join(__dirname, '..', 'data', 'faq.json');
const noticePath = path.join(__dirname, '..', 'data', 'notices.json');
const channelGuidePath = path.join(__dirname, '..', 'data', 'channels.json');
const logChannelId = process.env.LOG_CHANNEL_ID;

const fallbackFaqList = [
  {
    keywords: ['처음', '안내', '뭐부터', '시작', '공지', '참여 확인'],
    question: '처음 왔는데 무엇부터 보면 되나요?',
    answer: '처음 오셨다면 모든 채널을 한 번에 다 보지 않아도 괜찮아요.\n\n먼저 공지 채널에서 일정과 안내를 확인하고, 참여 확인 채널에서 필요한 내용을 천천히 진행해 주세요. 어디를 봐야 할지 헷갈리면 `/안내`나 `/채널안내`를 먼저 확인해도 좋아요.',
  },
  {
    keywords: ['문의', '연락', '운영진', '질문', '궁금'],
    question: '문의는 어디로 하면 되나요?',
    answer: '궁금한 점이 있으면 디스코드 문의 채널에 남겨주세요.\n\n운영진이 확인 후 순차적으로 답변드릴게요. 급한 내용이라면 공지된 연락 방법도 함께 확인해 주세요.',
  },
];

const fallbackContactNoticeTemplate = [
  '💬 [프로젝트 리디파인] 문의 안내',
  '',
  '궁금한 점이나 확인이 필요한 내용이 있다면',
  '디스코드 문의 채널에 남겨주세요.',
  '',
  '운영진이 확인 후 순차적으로 답변드리겠습니다.',
  '',
  '급한 내용이 아니라면 조금만 여유를 가지고 기다려주세요.',
  '놓치지 않도록 확인하겠습니다.',
].join('\n');

function loadJsonFile(filePath, fallbackValue, label, validate) {
  try {
    const parsedValue = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (validate && !validate(parsedValue)) {
      throw new Error('필요한 JSON 구조가 올바르지 않습니다.');
    }

    return parsedValue;
  } catch (error) {
    console.error(`${label}을(를) 읽지 못했습니다:`, error.message);
    return fallbackValue;
  }
}

const fallbackChannelGuide = {
  title: '리디파인 채널 안내',
  intro: [
    '지금은 채널 안내 파일을 불러오지 못했어요.',
    '처음 오셨다면 공지 채널과 참여 확인 채널부터 천천히 확인해 주세요.',
  ],
  categories: [
    {
      name: '기본 안내',
      channels: [
        {
          name: '공지 채널',
          description: '일정, 운영 안내, 변경사항을 확인하는 곳이에요.',
        },
        {
          name: '참여 확인 채널',
          description: '참여 전 필요한 확인을 진행하는 곳이에요.',
        },
        {
          name: '자유 채팅방',
          description: '가벼운 대화와 안부를 나누는 공간이에요.',
        },
      ],
    },
  ],
};

const fallbackNoticeTemplates = {
  contact: fallbackContactNoticeTemplate.split('\n'),
};

function isFaqItem(value) {
  return value
    && typeof value.question === 'string'
    && typeof value.answer === 'string'
    && Array.isArray(value.keywords);
}

const faqList = loadJsonFile(
  faqPath,
  fallbackFaqList,
  'FAQ 데이터',
  (value) => Array.isArray(value) && value.every(isFaqItem)
);

const noticeTemplates = loadJsonFile(
  noticePath,
  fallbackNoticeTemplates,
  '공지 템플릿',
  (value) => value && typeof value === 'object' && !Array.isArray(value)
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const MIN_FAQ_SCORE = 5;

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(text) {
  return normalizeText(text).replace(/\s/g, '');
}

function getSearchTokens(text) {
  return [...new Set(
    normalizeText(text)
      .split(' ')
      .filter((token) => token.length >= 2)
  )];
}

function getCharacterPairs(text) {
  const compactedText = compactText(text);

  if (compactedText.length < 2) {
    return compactedText ? [compactedText] : [];
  }

  const pairs = [];

  for (let index = 0; index < compactedText.length - 1; index += 1) {
    pairs.push(compactedText.slice(index, index + 2));
  }

  return pairs;
}

function getSimilarityScore(firstText, secondText) {
  const firstPairs = getCharacterPairs(firstText);
  const secondPairs = getCharacterPairs(secondText);

  if (firstPairs.length === 0 || secondPairs.length === 0) {
    return 0;
  }

  const secondPairSet = new Set(secondPairs);
  const commonCount = firstPairs.filter((pair) => secondPairSet.has(pair)).length;

  return commonCount / Math.max(firstPairs.length, secondPairs.length);
}

function scoreFaqItem(item, userQuestion) {
  const questionCompact = compactText(userQuestion);
  const questionTokens = getSearchTokens(userQuestion);
  const faqText = [item.question, ...(Array.isArray(item.keywords) ? item.keywords : [])].join(' ');
  const faqCompact = compactText(faqText);
  const itemQuestionCompact = compactText(item.question);

  let score = 0;

  if (questionCompact.length < 2) {
    return score;
  }

  if (itemQuestionCompact === questionCompact) {
    score += 20;
  }

  if (faqCompact.includes(questionCompact)) {
    score += questionCompact.length >= 4 ? 6 : 3;
  }

  for (const token of questionTokens) {
    if (faqCompact.includes(compactText(token))) {
      score += token.length >= 3 ? 2 : 1;
    }
  }

  for (const keyword of Array.isArray(item.keywords) ? item.keywords : []) {
    const keywordCompact = compactText(keyword);

    if (keywordCompact.length < 2) {
      continue;
    }

    if (questionCompact === keywordCompact) {
      score += 10;
      continue;
    }

    if (questionCompact.includes(keywordCompact)) {
      score += keywordCompact.length >= 3 ? 6 : 3;
      continue;
    }

    if (keywordCompact.includes(questionCompact) && questionCompact.length >= 3) {
      score += 4;
      continue;
    }

    const similarityScore = getSimilarityScore(questionCompact, keywordCompact);

    if (similarityScore >= 0.75) {
      score += 4;
    } else if (similarityScore >= 0.55 && questionCompact.length <= 8) {
      score += 2;
    }
  }

  return score;
}

function findFaqAnswer(userQuestion) {
  const normalizedQuestion = normalizeText(userQuestion);

  if (!normalizedQuestion) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const item of faqList) {
    const score = scoreFaqItem(item, normalizedQuestion);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestScore < MIN_FAQ_SCORE) {
    return null;
  }

  return bestMatch;
}

function createGuideEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x8f7a5f)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: '리디파인 가이드 봇',
    });
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

function loadChannelGuide() {
  return loadJsonFile(
    channelGuidePath,
    fallbackChannelGuide,
    '채널 안내',
    (guide) => guide && Array.isArray(guide.categories)
  );
}

function formatChannelCategory(category) {
  return (category.channels || [])
    .map((channel) => `**#${channel.name}** - ${channel.description}`)
    .join('\n');
}

function createChannelGuideEmbed() {
  const guide = loadChannelGuide();
  const intro = Array.isArray(guide.intro)
    ? guide.intro.join('\n')
    : String(guide.intro || fallbackChannelGuide.intro.join('\n'));

  const embed = createGuideEmbed(guide.title || fallbackChannelGuide.title, intro);
  const fields = (guide.categories || [])
    .map((category) => ({
      name: category.name,
      value: formatChannelCategory(category),
    }))
    .filter((field) => field.name && field.value);

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

function truncateEmbedValue(text, maxLength = 1000) {
  const value = String(text || '').trim();

  if (value.length <= maxLength) {
    return value || '(질문 내용 없음)';
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function formatKoreanTime(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

async function sendUnansweredQuestionLog(interaction, question) {
  if (!logChannelId) {
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(logChannelId);

    if (!channel || typeof channel.send !== 'function') {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xd6a35f)
      .setTitle('답변 실패 질문')
      .addFields(
        {
          name: '질문 내용',
          value: truncateEmbedValue(question),
        },
        {
          name: '시간',
          value: formatKoreanTime(),
        }
      );

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('답변 실패 질문 로그 전송 실패:', error.message);
  }
}

client.once('clientReady', () => {
  console.log(`${client.user.tag} 봇이 준비됐어요.`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === '공지') {
    const type = interaction.options.getString('종류');
    const noticeText = getNoticeTemplate(type);

    const embed = createGuideEmbed(
      '공지 템플릿',
      [
        '아래 문안을 복사해서 공지 채널에 맞게 수정해 사용하면 돼요.',
        '',
        '```',
        noticeText,
        '```',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (interaction.commandName === '안내') {
    const embed = createGuideEmbed(
      '처음 오셨다면 여기부터 확인해 주세요',
      [
        '안녕하세요. 여기는 프로젝트 리디파인 디스코드 공간이에요.',
        '',
        '처음에는 모든 채널을 다 볼 필요는 없어요.',
        '아래 순서대로만 확인해도 충분해요.',
        '',
        '1. 📢 공지 채널에서 일정과 안내 확인하기',
        '2. ✅ 참여 확인 채널에서 필요한 확인 진행하기',
        '3. 💬 자유 채팅방에서 편하게 머물기',
        '4. ❓ 궁금한 점은 `/질문`으로 물어보기',
        '',
        '예시:',
        '`/질문 내용: 결석하면 어떻게 하나요?`',
        '`/질문 내용: 준비물이 있나요?`',
        '`/질문 내용: 처음이라 어색하면 어떡하죠?`',
        '',
        '리디파인은 완벽하게 참여해야 하는 공간이라기보다,',
        '각자의 속도에 맞춰 천천히 이어가는 공간이에요.',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === '채널안내') {
    const embed = createChannelGuideEmbed();

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName === '질문') {
    const question = interaction.options.getString('내용');
    const matchedFaq = findFaqAnswer(question);

    if (!matchedFaq) {
      const embed = createGuideEmbed(
        '확인이 필요한 질문이에요',
        [
          '아직 제가 가진 FAQ 안에서는 딱 맞는 답변을 찾지 못했어요.',
          '',
          '조금 다르게 질문해보거나, 문의 채널에 남겨주세요.',
          '운영진이 확인 후 순차적으로 안내드릴게요.',
          '',
          '예시:',
          '`/질문 내용: 처음 왔는데 뭐부터 해요?`',
          '`/질문 내용: 참여동의 어디서 해요?`',
          '`/질문 내용: 오늘 못 갈 것 같아요`',
          '`/질문 내용: 포인트 어떻게 얻어요?`',
          '`/질문 내용: 음성채널 꼭 들어가야 해요?`',
        ].join('\n')
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      await sendUnansweredQuestionLog(interaction, question);
      return;
    }

    const embed = createGuideEmbed(
      matchedFaq.question,
      matchedFaq.answer
    );

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (interaction.commandName !== '리디') return;

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === '도움') {
    const embed = createGuideEmbed(
      '리디파인 안내 봇 사용법',
      [
        '안녕하세요. 리디파인 안내 봇이에요.',
        '',
        '아래 명령어로 필요한 내용을 확인할 수 있어요.',
        '',
        '`/안내` 처음 온 참여자용 안내',
        '`/채널안내` 주요 채널 용도 안내',
        '`/질문 내용:궁금한 내용` 자주 묻는 질문 검색',
        '`/공지 종류:일정안내` 운영진용 공지 템플릿',
        '`/공지 종류:봇사용안내` 운영진용 안내 봇 사용법 공지 템플릿',
        '`/리디 일정` 프로그램 일정 안내',
        '`/리디 규칙` 참여 규칙 안내',
        '`/리디 문의` 문의 방법 안내',
        '',
        '아직 제가 모르는 내용은 운영진 확인이 필요할 수 있어요.',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (subcommand === '일정') {
    const embed = createGuideEmbed(
      '리디파인 일정 안내',
      [
        '리디파인 프로그램은 운영진이 안내한 회차별 일정에 따라 진행돼요.',
        '',
        '정확한 날짜와 시간은 공지 채널을 확인해 주세요.',
        '일정이 변경될 경우 운영진이 디스코드 공지로 다시 안내드릴게요.',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (subcommand === '규칙') {
    const embed = createGuideEmbed(
      '리디파인 참여 규칙',
      [
        '리디파인은 서로의 속도를 존중하는 공간이에요.',
        '',
        '1. 다른 사람의 이야기를 평가하거나 단정하지 않기',
        '2. 참여를 강요하지 않기',
        '3. 불편한 상황이 있으면 운영진에게 알려주기',
        '4. 개인정보와 사적인 이야기는 조심스럽게 다루기',
        '',
        '완벽하게 참여해야 하는 공간이 아니라, 가능한 만큼 함께해도 괜찮은 공간이에요.',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (subcommand === '문의') {
    const embed = createGuideEmbed(
      '문의 방법',
      [
        '궁금한 점이 있으면 디스코드 문의 채널에 남겨주세요.',
        '',
        '운영진이 확인 후 순차적으로 답변드릴게요.',
        '급한 내용이라면 공지된 연락 방법을 함께 확인해 주세요.',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
    return;
  }
});

if (require.main === module) {
  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('봇 로그인 실패:', error);
  });
}

module.exports = {
  findFaqAnswer,
  normalizeText,
  scoreFaqItem,
};

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
const faqList = JSON.parse(fs.readFileSync(faqPath, 'utf-8'));
const noticePath = path.join(__dirname, '..', 'data', 'notices.json');

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

function loadNoticeTemplates() {
  try {
    return JSON.parse(fs.readFileSync(noticePath, 'utf-8'));
  } catch (error) {
    console.error('공지 템플릿을 읽지 못했습니다:', error.message);
    return {};
  }
}

const noticeTemplates = loadNoticeTemplates();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/[?!.~,]/g, '');
}

function findFaqAnswer(userQuestion) {
  const normalizedQuestion = normalizeText(userQuestion);

  let bestMatch = null;
  let bestScore = 0;

  for (const item of faqList) {
    let score = 0;

    const searchableText = normalizeText(
      [
        item.question,
        item.answer,
        ...(item.keywords || []),
      ].join(' ')
    );

    for (const keyword of item.keywords || []) {
      const normalizedKeyword = normalizeText(keyword);

      if (normalizedQuestion.includes(normalizedKeyword)) {
        score += 3;
      }

      if (searchableText.includes(normalizedQuestion)) {
        score += 2;
      }

      if (
        normalizedKeyword.length >= 2 &&
        normalizedQuestion.includes(normalizedKeyword.slice(0, 2))
      ) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestScore <= 0) {
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
    const embed = createGuideEmbed(
      '리디파인 채널 안내',
      [
        '처음에는 필요한 채널부터 천천히 확인해도 괜찮아요.',
        '아래 내용을 보고 어디에 무엇을 남기면 좋을지 편하게 살펴봐 주세요.',
        '',
        '📢 **공지 채널**',
        '일정, 운영 안내, 변경사항을 확인하는 곳이에요.',
        '',
        '✅ **참여 확인 채널**',
        '출석이나 참여 확인이 필요할 때 사용하는 곳이에요.',
        '',
        '💬 **자유 채팅방**',
        '가벼운 대화와 안부를 나누며 편하게 머무는 공간이에요.',
        '',
        '❓ **문의 채널**',
        '궁금한 점이나 확인이 필요한 내용을 남기는 곳이에요.',
        '',
        '🌿 **미션/활동 채널**',
        '회차별 활동이나 미션 내용을 함께 공유하는 곳이에요.',
      ].join('\n')
    );

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
          '`/질문 내용: 결석하면 어떻게 하나요?`',
          '`/질문 내용: 준비물이 있나요?`',
          '`/질문 내용: 처음이라 어색하면 어떡하죠?`',
        ].join('\n')
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
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

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('봇 로그인 실패:', error);
});

const fs = require('fs');
const path = require('path');

const faqPath = path.join(__dirname, '..', 'data', 'faq.json');
const knowledgePath = path.join(__dirname, '..', 'data', 'knowledge.json');
const noticePath = path.join(__dirname, '..', 'data', 'notices.json');
const channelGuidePath = path.join(__dirname, '..', 'data', 'channels.json');

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

function isFaqItem(value) {
  return value
    && typeof value.question === 'string'
    && typeof value.answer === 'string'
    && Array.isArray(value.keywords);
}

function isKnowledgeItem(value) {
  return value
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.summary === 'string'
    && typeof value.content === 'string'
    && Array.isArray(value.keywords);
}

const faqList = loadJsonFile(
  faqPath,
  fallbackFaqList,
  'FAQ 데이터',
  (value) => Array.isArray(value) && value.every(isFaqItem)
);

const knowledgeList = loadJsonFile(
  knowledgePath,
  [],
  '지식창고 데이터',
  (value) => Array.isArray(value) && value.every(isKnowledgeItem)
);

const noticeTemplates = loadJsonFile(
  noticePath,
  fallbackNoticeTemplates,
  '공지 템플릿',
  (value) => value && typeof value === 'object' && !Array.isArray(value)
);

function loadChannelGuide() {
  return loadJsonFile(
    channelGuidePath,
    fallbackChannelGuide,
    '채널 안내',
    (guide) => guide && Array.isArray(guide.categories)
  );
}

module.exports = {
  channelGuidePath,
  fallbackChannelGuide,
  fallbackContactNoticeTemplate,
  fallbackFaqList,
  fallbackNoticeTemplates,
  faqList,
  faqPath,
  knowledgeList,
  knowledgePath,
  loadChannelGuide,
  loadJsonFile,
  noticePath,
  noticeTemplates,
};

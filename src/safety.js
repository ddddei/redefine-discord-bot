const SENSITIVE_KEYWORD_GROUPS = [
  {
    category: 'selfHarm',
    severity: 'urgent',
    keywords: [
      '죽고 싶다',
      '죽고싶다',
      '자살',
      '자해',
      '자해하고 싶다',
      '사라지고 싶다',
      '없어지고 싶다',
      '끝내고 싶다',
    ],
  },
  {
    category: 'danger',
    severity: 'attention',
    keywords: [
      '위험해요',
      '무서워요',
      '위협',
      '협박',
      '폭력',
      '맞았어요',
      '괴롭힘',
      '성폭력',
    ],
  },
  {
    category: 'medicalCounseling',
    severity: 'attention',
    keywords: [
      '병원 가야 하나요',
      '병원에 가야 할지',
      '정신과',
      '상담기관',
      '상담 받을 수 있나요',
      '상담 받을 수 있는 기관',
      '상담기관을 알려주세요',
      '약 먹어야 하나요',
      '치료 받아야 하나요',
    ],
  },
  {
    category: 'unwantedContact',
    severity: 'attention',
    keywords: [
      'DM이 불편해요',
      '계속 연락이 와요',
      '원치 않는 연락',
      '친해지자고 계속',
      '같은 서버에 있어서 불편해요',
      '같은 서버에 있으면 불편해요',
    ],
  },
  {
    category: 'privacyReport',
    severity: 'attention',
    keywords: [
      '개인정보',
      '실명',
      '전화번호',
      '주소',
      '신고하고 싶어요',
      '캡처해서 신고',
      '누가 그랬어요',
    ],
  },
];

function normalizeQuestion(question) {
  return question.toLowerCase().replace(/\s+/g, ' ').trim();
}

// 키워드 기반으로 운영진 확인이 필요한 표현을 찾는 보조 함수입니다.
// 위기 여부를 판단하거나 상담, 진단, 치료를 대신하지 않습니다.
function detectSensitiveQuestion(question) {
  if (typeof question !== 'string' || !question.trim()) {
    return null;
  }

  const normalizedQuestion = normalizeQuestion(question);

  for (const group of SENSITIVE_KEYWORD_GROUPS) {
    for (const keyword of group.keywords) {
      const normalizedKeyword = normalizeQuestion(keyword);

      if (normalizedQuestion.includes(normalizedKeyword)) {
        return {
          category: group.category,
          matchedKeyword: keyword,
          severity: group.severity,
        };
      }
    }
  }

  return null;
}

function getSensitiveQuestionUserMessage(detection) {
  void detection;

  return [
    '남겨주신 내용은 봇이 바로 답변하기보다 운영진 확인이 필요할 수 있어요.',
    '',
    '혼자 감당하지 않아도 괜찮습니다. 운영진이 조심스럽게 확인할 수 있도록 연결하겠습니다.',
    '',
    '지금 긴급하거나 안전이 걱정되는 상황이라면 디스코드 답변을 기다리지 말고 주변의 신뢰할 수 있는 사람이나 전문 도움을 함께 요청해 주세요.',
    '',
    '봇은 상담이나 판단을 대신하지 않으며, 세부 내용은 운영진 안내를 기준으로 확인해 주세요.',
  ].join('\n');
}

module.exports = {
  detectSensitiveQuestion,
  getSensitiveQuestionUserMessage,
};

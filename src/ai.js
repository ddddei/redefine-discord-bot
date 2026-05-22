const SENSITIVE_KEYWORDS = [
  '죽고 싶다',
  '자해',
  '사라지고 싶다',
  '개인정보',
  '전화번호',
  '주소',
  '실명',
  '신고',
  '위험',
  '폭력',
  '위협',
  '자살',
  '죽음',
  '사망',
  '학대',
  '성폭력',
  '괴롭힘',
];

function hasSensitiveKeyword(question) {
  const normalizedQuestion = question.toLowerCase();

  return SENSITIVE_KEYWORDS.some((keyword) => normalizedQuestion.includes(keyword));
}

function getAiFallbackAnswer(question, options = {}) {
  if (typeof question !== 'string' || !question.trim()) {
    return null;
  }

  if (process.env.AI_ENABLED !== 'true') {
    return null;
  }

  if (hasSensitiveKeyword(question)) {
    return null;
  }

  const provider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();

  if (provider !== 'mock') {
    return null;
  }

  return [
    '현재 AI 보조 답변은 준비 중이며 운영진 확인이 필요합니다.',
    '문의 채널에 남겨 주시면 운영진이 확인 후 안내드릴게요.',
  ].join('\n');
}

module.exports = {
  getAiFallbackAnswer,
};

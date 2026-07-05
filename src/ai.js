const OpenAI = require('openai');

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

const DM_CHAT_INSTRUCTIONS = [
  '너는 리디파인 참가자가 DM에서 부담 없이 대화를 연습할 수 있도록 돕는 대화 파트너다.',
  '상담, 치료, 진단을 하지 않는다. 깊은 심리 분석 대신 짧고 자연스러운 대화를 이어간다.',
  '사용자가 사람에게 말 걸기, 디스코드 채널에 글쓰기, 오프라인 만남에서 첫마디를 연습하고 싶어 하면 바로 쓸 수 있는 문장 예시를 2개 이하로 제안한다.',
  '운영 정책, 일정, 확정되지 않은 리디파인 정보는 지어내지 말고 운영진 확인을 안내한다.',
  '자해, 자살, 폭력, 괴롭힘, 성적 피해, 개인정보 노출 같은 안전 이슈는 해결하려 들지 말고 운영진과 신뢰할 수 있는 사람에게 도움을 요청하도록 안내한다.',
  '한국어로 답하고, 답변은 보통 2-5문장으로 짧게 유지한다.',
].join('\n');

function hasSensitiveKeyword(question) {
  const normalizedQuestion = question.toLowerCase();

  return SENSITIVE_KEYWORDS.some((keyword) => normalizedQuestion.includes(keyword));
}

function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getConfiguredMaxOutputTokens() {
  const configuredValue = Number.parseInt(process.env.AI_MAX_TOKENS || '500', 10);

  if (!Number.isInteger(configuredValue) || configuredValue <= 0) {
    return 500;
  }

  return Math.min(configuredValue, 1000);
}

function createDmChatInput({ message, history = [], userDisplayName = '' }) {
  const recentMessages = history.slice(-8).map((item) => ({
    role: item.role === 'assistant' ? 'assistant' : 'user',
    content: item.content,
  }));

  return [
    {
      role: 'developer',
      content: [
        DM_CHAT_INSTRUCTIONS,
        userDisplayName ? `현재 대화 상대 표시명: ${userDisplayName}` : '',
      ].filter(Boolean).join('\n\n'),
    },
    ...recentMessages,
    {
      role: 'user',
      content: message,
    },
  ];
}

const DEFAULT_DM_CHAT_TIMEOUT_MS = 30000;

function getDmChatTimeoutMs() {
  const parsed = Number.parseInt(process.env.DM_CHAT_AI_TIMEOUT_MS || `${DEFAULT_DM_CHAT_TIMEOUT_MS}`, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_DM_CHAT_TIMEOUT_MS;
  }

  return parsed;
}

async function getDmChatReply(input, options = {}) {
  const message = input && input.message;

  if (typeof message !== 'string' || !message.trim()) {
    return { text: null, usage: null };
  }

  if (process.env.AI_ENABLED !== 'true') {
    return { text: null, usage: null };
  }

  if (hasSensitiveKeyword(message)) {
    return { text: null, usage: null };
  }

  const provider = String(process.env.AI_PROVIDER || '').trim().toLowerCase();

  if (provider === 'mock') {
    return {
      text: '좋아요. 여기서는 아주 짧게 연습해도 괜찮아요. 먼저 “안녕하세요, 저도 처음이라 조금 어색한데 같이 이야기해도 될까요?” 정도로 시작해볼 수 있어요.',
      usage: null,
    };
  }

  if (provider !== 'openai') {
    return { text: null, usage: null };
  }

  const model = String(process.env.AI_MODEL || '').trim();
  const client = options.openaiClient || getOpenAiClient();

  if (!model || !client) {
    return { text: null, usage: null };
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutMs = getDmChatTimeoutMs();
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const requestOptions = controller ? { signal: controller.signal } : undefined;
    const response = await client.responses.create(
      {
        model,
        input: createDmChatInput(input),
        max_output_tokens: getConfiguredMaxOutputTokens(),
      },
      requestOptions
    );

    const text = typeof response.output_text === 'string' && response.output_text.trim()
      ? response.output_text.trim()
      : null;
    const usage = response && response.usage
      ? {
        input: Number.isFinite(response.usage.input_tokens) ? response.usage.input_tokens : null,
        output: Number.isFinite(response.usage.output_tokens) ? response.usage.output_tokens : null,
      }
      : null;

    return { text, usage };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
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
  createDmChatInput,
  getDmChatReply,
  getAiFallbackAnswer,
};

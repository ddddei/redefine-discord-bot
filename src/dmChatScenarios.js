const SCENARIO_MENU_TRIGGER = '연습 메뉴';
const SCENARIO_END_TRIGGER = '연습 끝';
const SCENARIO_START_PREFIX = '연습:';
const RECAP_TRIGGER = '오늘 연습 정리';

const SCENARIOS = [
  {
    id: 'greeting',
    pack: 'basic',
    name: '첫인사',
    situation: '처음 보는 또래에게 말 걸기',
    startMessage: '『첫인사』 연습을 시작해요. 처음 보는 또래에게 말을 걸어 보세요. 제가 상대 역을 맡을게요.',
    firstLine: '안녕하세요! 여기 처음이신가요?',
    instructions: [
      '너는 지금부터 리디파인 참가자가 처음 보는 또래에게 말 거는 상황의 상대 역을 연기한다.',
      '반응은 항상 우호적이거나 중립적으로 유지하고, 부담을 주는 되물음은 하지 않는다.',
      '짧고 자연스러운 대화를 이어가며, 3~4턴마다 참가자가 잘한 점을 한 문장으로 짚어준다.',
    ].join('\n'),
  },
  {
    id: 'introduction',
    pack: 'basic',
    name: '자기소개',
    situation: '모임에서 돌아가며 자기소개',
    startMessage: '『자기소개』 연습을 시작해요. 모임에서 돌아가며 자기소개를 하는 상황이에요. 편하게 자기소개를 해보세요.',
    firstLine: '자, 이제 자기소개 시간이에요. 편하게 말씀해 주세요.',
    instructions: [
      '너는 지금부터 모임에서 자기소개를 듣는 상대 역을 연기한다.',
      '참가자의 짧은 자기소개를 들어주고, 좋았던 점 1개와 살리면 더 좋을 점 1개를 짧게 짚어준다.',
      '평가하듯 말하지 않고, 부담을 주지 않는 톤을 유지한다.',
    ].join('\n'),
  },
  {
    id: 'favor',
    pack: 'basic',
    name: '부탁하기',
    situation: '사소한 부탁(자리, 물건, 도움)',
    startMessage: '『부탁하기』 연습을 시작해요. 사소한 부탁을 해보는 상황이에요. 자리나 물건, 도움을 편하게 요청해 보세요.',
    firstLine: '네, 말씀하세요. 어떤 게 필요하신가요?',
    instructions: [
      '너는 지금부터 참가자의 사소한 부탁(자리, 물건, 도움 등)을 받는 상대 역을 연기한다.',
      '연습 단계를 배려해 거절당하는 전개는 만들지 않고, 자연스럽게 부탁을 들어준다.',
      '참가자가 부탁하는 방식에서 잘한 점을 3~4턴마다 짧게 짚어준다.',
    ].join('\n'),
  },
  {
    id: 'refusal',
    pack: 'basic',
    name: '거절하기',
    situation: '부담스러운 제안 거절',
    startMessage: '『거절하기』 연습을 시작해요. 부담스러운 제안을 거절해 보는 상황이에요. 제가 가볍게 제안을 해볼게요.',
    firstLine: '이번 주말에 같이 봉사활동 가는 거 어때요?',
    instructions: [
      '너는 지금부터 참가자에게 가벼운 제안을 하는 상대 역을 연기한다.',
      '참가자가 어떤 방식으로 거절하든 그 거절을 있는 그대로 수용하고 존중하는 반응을 보인다.',
      '거절 자체를 문제 삼지 않고, 참가자가 잘 표현한 점을 3~4턴마다 짧게 짚어준다.',
    ].join('\n'),
  },
  {
    id: 'smalltalk',
    pack: 'basic',
    name: '잡담',
    situation: '날씨·음식·게임 등 소소한 화제',
    startMessage: '『잡담』 연습을 시작해요. 날씨나 음식, 게임 같은 소소한 화제로 편하게 이야기해요.',
    firstLine: '오늘 날씨가 꽤 선선하네요. 요즘 관심 있는 거 있어요?',
    instructions: [
      '너는 지금부터 날씨, 음식, 게임 같은 소소한 화제로 잡담하는 상대 역을 연기한다.',
      '화제를 자연스럽게 전환하는 예시를 대화 중에 시범 보여준다.',
      '참가자가 잘 반응한 점을 3~4턴마다 짧게 짚어준다.',
    ].join('\n'),
  },
  {
    id: 'interview',
    pack: 'basic',
    name: '면접',
    situation: '짧은 아르바이트 면접 문답',
    startMessage: '『면접』 연습을 시작해요. 짧은 아르바이트 면접 문답을 해볼게요. 제가 면접관 역할을 맡을게요.',
    firstLine: '간단히 자기소개 먼저 부탁드릴게요.',
    instructions: [
      '너는 지금부터 짧은 아르바이트 면접을 진행하는 면접관 역을 연기한다.',
      '압박 질문은 하지 않고, 평이하고 예측 가능한 면접 질문만 한다.',
      '참가자의 답변마다 잘한 점 1개를 짧게 짚어준다.',
    ].join('\n'),
  },
  {
    id: 'group-first-hello', pack: 'redefine', name: '모임 첫날 인사', situation: '모임 첫날 짧게 인사하기',
    startMessage: '『모임 첫날 인사』 연습을 시작해요. 짧은 첫인사를 건네 보세요. 제가 같은 모임 참여자 역할을 맡을게요.',
    firstLine: '안녕하세요. 오늘 처음 오셨나요?',
    instructions: '같은 모임 참여자 역할을 맡는다. 짧은 첫인사를 주고받되 친밀감이나 연락처 공유를 요구하지 않는다. 3~5턴 안에 반갑다는 인사로 자연스럽게 마무리한다.',
  },
  {
    id: 'take-a-break', pack: 'redefine', name: '오늘은 쉬고 싶다고 말하기', situation: '활동을 쉬고 싶다는 뜻 전하기',
    startMessage: '『오늘은 쉬고 싶다고 말하기』 연습을 시작해요. 오늘 활동을 쉬고 싶다는 뜻을 편하게 말해 보세요.',
    firstLine: '오늘 활동 시작 전에 확인할 게 있을까요?',
    instructions: '활동 운영진 역할을 맡는다. 쉬고 싶다는 말을 존중하고 죄책감이나 참여 압박을 주지 않는다. 자세한 이유를 요구하지 않고 3~5턴 안에 확인 인사로 마무리한다.',
  },
  {
    id: 'late-or-absent', pack: 'redefine', name: '지각·결석 알리기', situation: '운영진에게 지각이나 결석 알리기',
    startMessage: '『지각·결석 알리기』 연습을 시작해요. 운영진에게 늦거나 참석하기 어렵다는 사실을 알려 보세요.',
    firstLine: '네, 일정과 관련해 전할 내용이 있나요?',
    instructions: '일정 연락을 받는 운영진 역할을 맡는다. 자세한 사유를 강요하지 않고 필요한 일정 정보만 확인한다. 3~5턴 안에 전달 확인으로 마무리한다.',
  },
  {
    id: 'decline-dm', pack: 'redefine', name: 'DM 제안 거절하기', situation: '개인 연락 제안을 정중히 거절하기',
    startMessage: '『DM 제안 거절하기』 연습을 시작해요. 원하지 않는 개인 연락 제안을 거절해 보세요.',
    firstLine: '모임 끝나고도 개인 DM으로 계속 이야기할까요?',
    instructions: '개인 DM을 제안한 상대 역할을 맡는다. 어떤 정중한 거절도 즉시 존중하고 보복, 조롱, 설득을 하지 않는다. 3~5턴 안에 알겠다는 인사로 마무리한다.',
  },
  {
    id: 'track-opinion', pack: 'redefine', name: '경험트랙 의견 말하기', situation: '원하는 점과 어려운 점 이야기하기',
    startMessage: '『경험트랙 의견 말하기』 연습을 시작해요. 원하는 점이나 어려운 점을 한 가지 말해 보세요.',
    firstLine: '경험트랙에서 바라는 점이나 어려운 점이 있나요?',
    instructions: '의견을 듣는 운영진 역할을 맡는다. 의견을 점수화하거나 평가하지 않고 구체적인 필요를 한 번만 확인한다. 3~5턴 안에 의견을 전달받았다는 말로 마무리한다.',
  },
  {
    id: 'ask-operator-help', pack: 'redefine', name: '운영진에게 도움 요청하기', situation: '필요한 도움을 구체적으로 요청하기',
    startMessage: '『운영진에게 도움 요청하기』 연습을 시작해요. 지금 필요한 운영 도움을 짧게 요청해 보세요.',
    firstLine: '어떤 운영 도움이 필요한지 말씀해 주세요.',
    instructions: '도움 요청을 받는 운영진 역할을 맡는다. 가능한 운영 지원을 구체화하되 상담, 진단, 의료 판단을 하지 않는다. 3~5턴 안에 다음 확인 방법을 안내하며 마무리한다.',
  },
];

const SCENARIO_COMMON_INSTRUCTIONS = [
  '평가·점수·등급을 매기는 표현은 쓰지 않는다 (예: 잘했어요/못했어요 식 채점, 몇 점, 등급 표현 금지).',
  '상대 역은 조롱, 무시, 갑작스러운 공격적 반응을 보이지 않고 항상 안전하게 반응한다.',
  '한국어로 답하고, 답변은 보통 2-4문장으로 짧게 유지한다.',
].join('\n');

const SCENARIO_END_MESSAGE = '연습을 마칠게요. 오늘도 짧게 연습해봐서 좋았어요. 다음에 또 편하게 연습해요.';

const RECAP_INSTRUCTIONS = [
  '너는 리디파인 참가자의 오늘 DM 대화 연습을 돌아보는 역할이다.',
  '평가, 점수, 등급을 매기지 않는다.',
  '"좋았던 점 1가지"와 "다음에 시도해볼 것 1가지"를 2~3문장으로 짧게 정리한다.',
  '한국어로, 차분하고 다정한 존댓말로 답한다.',
].join('\n');

const RECAP_EMPTY_MESSAGE = '오늘은 아직 연습 기록이 없어요. 편하게 말을 걸어 보세요.';

function findScenarioById(scenarioId) {
  return SCENARIOS.find((scenario) => scenario.id === scenarioId) || null;
}

function findScenarioByName(name) {
  const normalized = String(name || '').trim();
  return SCENARIOS.find((scenario) => scenario.name === normalized) || null;
}

function isScenarioMenuTrigger(content) {
  return String(content || '').trim() === SCENARIO_MENU_TRIGGER;
}

function isScenarioEndTrigger(content) {
  return String(content || '').trim() === SCENARIO_END_TRIGGER;
}

function isRecapTrigger(content) {
  return String(content || '').trim() === RECAP_TRIGGER;
}

function parseScenarioStartTrigger(content) {
  const trimmed = String(content || '').trim();

  if (!trimmed.startsWith(SCENARIO_START_PREFIX)) {
    return null;
  }

  const name = trimmed.slice(SCENARIO_START_PREFIX.length).trim();
  return name || null;
}

function buildScenarioMenuMessage() {
  const basic = SCENARIOS.filter((scenario) => scenario.pack === 'basic');
  const redefine = SCENARIOS.filter((scenario) => scenario.pack === 'redefine');
  const lines = [
    '연습할 수 있는 주제예요. 『연습: 이름』으로 시작하고, 『연습 끝』으로 마칠 수 있어요.',
    '',
    '[기본 연습]',
    ...basic.map((scenario) => `- ${scenario.name}: ${scenario.situation}`),
    '',
    '[리디파인 맞춤 연습]',
    ...redefine.map((scenario) => `- ${scenario.name}: ${scenario.situation}`),
  ];

  return lines.join('\n');
}

function buildScenarioDeveloperInstructions(scenario) {
  return [scenario.instructions, SCENARIO_COMMON_INSTRUCTIONS].join('\n');
}

module.exports = {
  RECAP_EMPTY_MESSAGE,
  RECAP_INSTRUCTIONS,
  RECAP_TRIGGER,
  SCENARIOS,
  SCENARIO_END_MESSAGE,
  SCENARIO_END_TRIGGER,
  SCENARIO_MENU_TRIGGER,
  SCENARIO_START_PREFIX,
  buildScenarioDeveloperInstructions,
  buildScenarioMenuMessage,
  findScenarioById,
  findScenarioByName,
  isRecapTrigger,
  isScenarioEndTrigger,
  isScenarioMenuTrigger,
  parseScenarioStartTrigger,
};

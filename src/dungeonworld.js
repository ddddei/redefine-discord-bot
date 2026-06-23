const fs = require('fs');
const path = require('path');
const { normalizeExportFormat, toCsv, toSafeJson } = require('./exportUtils');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DEFAULT_PATHS = {
  logs: process.env.DUNGEONWORLD_LOG_PATH || path.join(DATA_DIR, 'dungeonworld-logs.local.json'),
  logsFallback: path.join(DATA_DIR, 'dungeonworld-logs.example.json'),
};

// 회차(SESSION) 콘텐츠 정의.
// 새 회차를 추가하려면:
//   1. 아래와 같은 모양의 회차 객체를 새로 만든다
//      { id, title, intro, closingNote, choices: { <choiceId>: { id, label, approachLabel, outcomes: { strong, mixed, weak } }, ... } }
//   2. SESSIONS 맵에 등록하고 SESSION_ORDER 배열에 id를 추가한다.
//   3. 해당 회차를 참여자에게 보여줄 시점이 되면 DEFAULT_SESSION_ID를 그 회차 id로 바꾼다.
// 판정 메커닉(2d6, TIER_LABELS, resolveTier)은 회차 공통이라 회차 객체 밖에 둔다.

const SESSION_01_BLACK_BELL = {
  id: 'session_01_black_bell',
  title: '1회차. 변방 여관의 검은 종',
  intro: [
    '변방 여관 `마른 참나무`의 난로 곁, 여관 주인 마라가 묻습니다. "이런 밤에 이 마을까지 온 사람은 흔치 않은데, 당신은 무슨 일로 여기까지 왔소?" 문가에서는 경비병 토른이 창에 기대어 마을 어귀를 살피고 있습니다.',
    '대답할 틈도 없이 지도 조각이 문 아래로 밀려 들어오고, 멀리서 검은 종소리가 울립니다. 종소리는 마을 북쪽, 안개에 잠긴 탑 쪽에서 들려온 것 같습니다.',
    '고블린 정찰병이 그 지도 조각을 빼앗아 북쪽 숲길로 달아나려 합니다. 토른이 먼저 칼자루를 잡으며 당신을 돌아봅니다.',
  ].join('\n'),
  closingNote: '지도 조각과 숲길 표식이 다음 회차, 뿌리 아래로 이어진 길로 이어집니다. 다음에 이어서 해볼 수 있어요.',
  choices: {
    pursue: {
      id: 'pursue',
      label: '고블린을 바로 추격한다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '토른이 먼저 칼자루를 놓고 달려 나가고, 당신도 곧장 뒤따릅니다. 진흙투성이 비탈, 굵은 뿌리가 드러난 곳에서 고블린의 발이 걸리고 표식이 손에서 미끄러져 떨어집니다. 지도 조각은 흠 하나 없이 되찾았고, 떨어진 숲길 표식도 손에 넣었습니다. 흙을 털어내자 안쪽으로 파고든 뿌리 무늬가 또렷하게 드러나는데, 토른이 그 무늬를 보고 낯빛이 굳습니다. "이건 본 적 있는 무늬요. 안개 탑 아래 어딘가로 이어지는."',
        mixed: '토른과 함께 쫓았지만 고블린은 마지막 순간 몸을 던져 울타리 너머로 빠져나갑니다. 몸싸움 중 지도 조각 한 귀퉁이가 찢어지고, 토른의 방패에도 깊은 긁힌 흔적이 남습니다. 숨을 고르며 주워든 숲길 표식에는 뿌리 무늬가 반쪽만 남아 어디로 이어지는지는 알 수 없습니다. 토른이 찢어진 지도 조각을 살피며 낮게 말합니다. "서두르면 또 이렇게 될 거요."',
        weak: '고블린은 지도 조각 일부를 찢어 쥔 채 안개 자욱한 숲 가장자리 어둠 속으로 사라집니다. 토른이 횃불을 들어 바닥을 살피지만 어렴풋한 흙 자국 말고는 남은 게 없습니다. "이 상태로 더 들어가면 우리가 길을 잃을 거요." 지금 당장 뒤쫓는다면 뿌리 무늬도 읽지 못한 채 안개 속으로 들어서야 할 것 같습니다.',
      },
    },
    investigate: {
      id: 'investigate',
      label: '여관과 마을을 먼저 조사한다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '마라와 토른에게 차례로 묻습니다. 마라는 지도 조각이 들어온 틈으로 누군가 스쳐 지나가는 그림자를 봤다고 털어놓고, 토른은 우물가로 안내해 검은 종소리가 남긴 그을린 탑 표식을 짚어 줍니다. "이건 안개 탑 쪽 길에서만 나는 그을음이오. 흙 속 뿌리를 타고 올라오는 길이지." 지도 조각은 안전하게 보호했고, 마라의 보급품과 토른의 낡은 방패까지 챙겼습니다. 안개 탑으로 이어진 뿌리 길의 방향을 미리 알아둔 셈입니다.',
        mixed: '단서는 찾았지만 시간이 꽤 걸렸습니다. 마라는 그림자를 봤다고 인정하면서도 "보급을 내주려면 작은 부탁 하나는 들어줘야겠소"라며 조건을 붙입니다. 토른은 우물가에서 그을린 표식을 발견했지만, 빗물에 절반쯤 흐려진 자국을 보며 "방향은 알겠는데, 고블린은 이미 멀리 달아난 뒤요"라고 아쉬워합니다.',
        weak: '마을을 살피는 동안 고블린은 완전히 사라졌습니다. 지도 조각은 지켰지만, 우물가의 표식은 빗물에 거의 씻겨 나가 토른도 흙바닥을 한참 들여다보다 고개를 젓습니다. "이 흔적만으론 방향을 가늠할 수가 없소." 안개 탑으로 가는 길은 다음에 처음부터 다시 찾아야 할 듯합니다.',
      },
    },
    negotiate: {
      id: 'negotiate',
      label: '렌과 거래해 지도의 출처를 묻는다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '렌은 한동안 망설이다 결국 입을 엽니다. "그 지도, 원래는 뿌리 아래로 이어진 길을 그린 거요." 그는 숲길 표식의 정확한 위치까지 순순히 짚어 줍니다. 옆에서 듣던 토른이 중얼거립니다. "그 말이 맞다면, 우리가 가려는 곳은 생각보다 깊겠소." 다음 숲길 판정에 분명한 이점을 만들었습니다.',
        mixed: '렌은 거래에 응하지만 대가를 요구합니다. "공짜로 줄 만한 얘기는 아니지" 하며 지도의 출처가 안개 탑 아래 뿌리 길이라는 단서를 흘리는 대신, 작은 부탁 하나를 들어 달라고 못 박습니다. 렌에게 작은 빚을 지게 되었습니다.',
        weak: '렌은 지도의 출처를 먼저 숨기고 더 큰 거래를 요구합니다. "이런 얘기는 그만한 값을 치러야지." 토른이 옆에서 눈치를 주지만, 협상은 다음으로 미뤄야 할 것 같습니다. 안개 탑으로 가는 단서는 여전히 손에 잡히지 않습니다.',
      },
    },
  },
};

// 2회차/3회차를 추가할 때는 위 SESSION_01_BLACK_BELL과 같은 모양의 객체를 만들어
// 아래 SESSIONS / SESSION_ORDER에 등록한다. 예:
//   const SESSION_02_ROOTS_BELOW = { id: 'session_02_roots_below', title: '2회차. ...', ... };
//   SESSIONS[SESSION_02_ROOTS_BELOW.id] = SESSION_02_ROOTS_BELOW;
//   SESSION_ORDER.push(SESSION_02_ROOTS_BELOW.id);
const SESSIONS = {
  [SESSION_01_BLACK_BELL.id]: SESSION_01_BLACK_BELL,
};

const SESSION_ORDER = [SESSION_01_BLACK_BELL.id];

// 참여자가 `/던전월드`를 실행했을 때 기본으로 보여줄 회차.
// 다음 회차를 공개할 준비가 되면 이 값을 새 회차 id로 바꾼다.
const DEFAULT_SESSION_ID = SESSION_ORDER[0];

const TIER_LABELS = {
  strong: '10+ 원하는 대로 풀림',
  mixed: '7~9 해내지만 대가가 생김',
  weak: '6- 예상과 다른 전개',
};

function resolveSessionId(sessionId) {
  if (sessionId && SESSIONS[sessionId]) {
    return sessionId;
  }

  return DEFAULT_SESSION_ID;
}

function getSessionEntry(sessionId) {
  return SESSIONS[resolveSessionId(sessionId)];
}

const CLOSING_NOTE = SESSIONS[DEFAULT_SESSION_ID].closingNote;

function createEmptyLogsData() {
  return {
    isExample: false,
    description: 'Local solo dungeonworld minigame play log.',
    logs: [],
  };
}

function readLogsData(logsPath) {
  if (!fs.existsSync(logsPath)) {
    return createEmptyLogsData();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    return {
      ...createEmptyLogsData(),
      ...parsed,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch (error) {
    console.warn('던전월드 플레이 로그를 읽지 못했습니다:', error.message);
    return createEmptyLogsData();
  }
}

function saveLogsData(logsPath, data) {
  fs.mkdirSync(path.dirname(logsPath), { recursive: true });
  fs.writeFileSync(`${logsPath}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(`${logsPath}.tmp`, logsPath);
}

function createOperationId() {
  return `dw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function resolveTier(total) {
  if (total >= 10) {
    return 'strong';
  }

  if (total >= 7) {
    return 'mixed';
  }

  return 'weak';
}

function listSessions() {
  return SESSION_ORDER.map((sessionId) => {
    const session = SESSIONS[sessionId];
    return {
      id: session.id,
      title: session.title,
      intro: session.intro,
      closingNote: session.closingNote,
    };
  });
}

function getSession(sessionId) {
  const session = getSessionEntry(sessionId);
  return {
    id: session.id,
    title: session.title,
    intro: session.intro,
    closingNote: session.closingNote,
  };
}

function getChoice(choiceId, sessionId) {
  const session = getSessionEntry(sessionId);
  return session.choices[choiceId] || null;
}

function listChoices(sessionId) {
  const session = getSessionEntry(sessionId);
  return Object.values(session.choices);
}

function playChoice(choiceId, sessionId) {
  const session = getSessionEntry(sessionId);
  const choice = session.choices[choiceId];
  if (!choice) {
    throw new Error('지원하지 않는 선택지입니다.');
  }

  const die1 = rollD6();
  const die2 = rollD6();
  const total = die1 + die2;
  const tier = resolveTier(total);

  return {
    sessionId: session.id,
    sessionTitle: session.title,
    choice,
    die1,
    die2,
    total,
    tier,
    tierLabel: TIER_LABELS[tier],
    outcomeText: choice.outcomes[tier],
  };
}

function createDungeonworldRepository(paths = {}) {
  const resolvedPaths = {
    ...DEFAULT_PATHS,
    ...paths,
  };

  function recordPlay(input) {
    const data = readLogsData(resolvedPaths.logs);
    const fallbackSession = getSessionEntry(input.sessionId);
    const record = {
      id: createOperationId(),
      sessionId: input.sessionId || fallbackSession.id,
      sessionTitle: input.sessionTitle || fallbackSession.title,
      userId: input.userId,
      displayName: input.displayName || input.userId,
      choiceId: input.choiceId,
      choiceLabel: input.choiceLabel,
      die1: input.die1,
      die2: input.die2,
      total: input.total,
      tier: input.tier,
      tierLabel: input.tierLabel,
      outcomeText: input.outcomeText,
      createdAt: new Date().toISOString(),
    };

    data.isExample = false;
    data.logs = [...(Array.isArray(data.logs) ? data.logs : []), record];
    saveLogsData(resolvedPaths.logs, data);
    return record;
  }

  function listRecentPlays(limit = 50) {
    const data = readLogsData(resolvedPaths.logs);
    return [...data.logs].reverse().slice(0, Math.max(1, limit));
  }

  function getPlayCount() {
    const data = readLogsData(resolvedPaths.logs);
    return data.logs.length;
  }

  return {
    getPlayCount,
    listRecentPlays,
    recordPlay,
  };
}

const DUNGEONWORLD_CSV_COLUMNS = [
  ['id', '기록ID'],
  ['userId', '사용자ID'],
  ['displayName', '표시이름'],
  ['sessionId', '회차ID'],
  ['choiceId', '선택ID'],
  ['choiceLabel', '선택내용'],
  ['die1', '주사위1'],
  ['die2', '주사위2'],
  ['total', '합계'],
  ['tier', '결과등급'],
  ['outcomeText', '결과텍스트'],
  ['createdAt', '생성일시'],
];

function formatTimestampForFilename(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, '-');
}

function buildDungeonworldExportPayload(repository, options = {}) {
  const now = options.now || new Date();
  const generatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const format = normalizeExportFormat(options.format);
  const limit = Math.min(200, Math.max(1, Number(options.limit || 50)));
  const logs = repository.listRecentPlays(limit);
  const totalPlayCount = repository.getPlayCount();

  const summaryText = [
    '종류: 던전월드',
    `포함 개수: ${logs.length}`,
    `전체 플레이 수: ${totalPlayCount}`,
    `생성 시간: ${generatedAt}`,
    '',
    '최근 플레이',
    ...(logs.length > 0
      ? logs.slice(0, 10).map((log) => `- ${log.displayName} / ${log.choiceLabel} / ${log.tierLabel}`)
      : ['아직 플레이 기록이 없습니다.']),
  ].join('\n');

  if (format === 'summary') {
    return {
      kind: 'dungeonworld',
      kindLabel: '던전월드',
      format,
      formatLabel: '요약',
      limit,
      generatedAt,
      content: summaryText,
      summaryText,
      data: { logs, totalPlayCount },
      isAttachment: false,
      rowCount: logs.length,
    };
  }

  const content = format === 'csv'
    ? toCsv(logs, DUNGEONWORLD_CSV_COLUMNS)
    : toSafeJson({ exportedAt: generatedAt, kind: 'dungeonworld', limit, data: { logs, totalPlayCount } });
  const extension = format === 'csv' ? 'csv' : 'json';
  const filename = `operation-export-dungeonworld-${formatTimestampForFilename(now)}.${extension}`;

  return {
    kind: 'dungeonworld',
    kindLabel: '던전월드',
    format,
    formatLabel: format === 'csv' ? 'CSV' : 'JSON',
    limit,
    generatedAt,
    filename,
    content,
    buffer: Buffer.from(content, 'utf8'),
    summaryText,
    data: { logs, totalPlayCount },
    isAttachment: true,
    rowCount: logs.length,
  };
}

module.exports = {
  buildDungeonworldExportPayload,
  CLOSING_NOTE,
  TIER_LABELS,
  createDungeonworldRepository,
  getChoice,
  getSession,
  listChoices,
  listSessions,
  playChoice,
  resolveTier,
  rollD6,
};

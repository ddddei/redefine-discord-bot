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
    '변방 여관 `마른 참나무`. 마라가 묻습니다. "이런 밤에 이 마을까지 온 사람은 흔치 않은데, 당신은 무슨 일로 여기까지 왔소?"',
    '대답할 틈도 없이 지도 조각이 문 아래로 밀려 들어오고, 멀리서 검은 종소리가 울립니다.',
    '고블린 정찰병이 그 지도 조각을 빼앗아 북쪽 숲길로 달아나려 합니다.',
  ].join('\n'),
  closingNote: '지도 조각과 숲길 표식이 다음 회차, 뿌리 아래로 이어진 길로 이어집니다. 다음에 이어서 해볼 수 있어요.',
  choices: {
    pursue: {
      id: 'pursue',
      label: '고블린을 바로 추격한다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '날카롭게 뒤쫓아 고블린을 따라잡습니다. 지도 조각은 온전하고, 고블린이 떨어뜨린 숲길 표식까지 손에 넣었습니다. 다음에 숲길로 들어설 때 이 표식이 분명 도움이 될 겁니다.',
        mixed: '고블린을 거의 따라잡았지만, 몸싸움 중에 지도 조각 한 귀퉁이가 찢어집니다. 숲길 표식은 손에 들어왔지만, 어딘가 서두른 흔적이 남았습니다.',
        weak: '고블린은 지도 조각 일부를 찢어 쥔 채 어둠 속으로 사라집니다. 숲길 표식이 어렴풋이 보이지만, 지금 쫓는다면 아무 준비도 없이 출발해야 할 것 같습니다.',
      },
    },
    investigate: {
      id: 'investigate',
      label: '여관과 마을을 먼저 조사한다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '마라와 토른에게 차분히 묻고 우물가의 그을린 탑 표식까지 확인합니다. 지도 조각은 안전하게 보호했고, 마라의 보급품과 토른의 낡은 방패까지 챙겼습니다.',
        mixed: '단서는 찾았지만 시간이 꽤 걸렸습니다. 마라의 보급을 받으려면 작은 부탁을 들어줘야 할 것 같습니다. 고블린은 이미 멀리 달아난 뒤입니다.',
        weak: '마을을 살피는 동안 고블린은 완전히 사라졌습니다. 지도 조각은 지켰지만, 숲길 표식의 흔적은 거의 남지 않았습니다.',
      },
    },
    negotiate: {
      id: 'negotiate',
      label: '렌과 거래해 지도의 출처를 묻는다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '렌은 망설이다 지도의 출처를 알려주고, 숲길 표식의 위치까지 순순히 짚어줍니다. 다음 숲길 판정에 분명한 이점을 만들었습니다.',
        mixed: '렌은 거래에 응하지만 대가를 요구합니다. 지도의 출처에 대한 단서를 얻은 대신, 렌에게 작은 빚을 지게 되었습니다.',
        weak: '렌은 지도의 출처를 먼저 숨기고 더 큰 거래를 요구합니다. 협상은 다음으로 미뤄야 할 것 같습니다.',
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

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

const SESSION_02_ROOTS_BELOW = {
  id: 'session_02_roots_below',
  title: '2회차. 뿌리 아래 고블린 길',
  intro: [
    '북쪽 숲의 뿌리 아래에서 종소리와 웃음소리가 섞여 들립니다. 가짜 표식과 진짜 표식이 어지럽게 뒤섞여 있고, 그 사이로 작은 그림자가 빠르게 움직입니다.',
    '겁 많고 말 빠른 고블린 길잡이 픽이 뿌리 틈에서 고개를 내밀며 속삭입니다. "잠깐, 잠깐! 거기 그대로 서 있어요. 작은 왕님이 들으면 우리 둘 다 끝장이라고요."',
    '뿌리 아래 작은 왕이 다스리는 소굴이 바로 앞입니다. 진짜 표식과 신전으로 가는 길이 고블린들의 흥정거리 속에 함께 섞여 있습니다.',
  ].join('\n'),
  closingNote: '이끼 언덕 끝에서 물그릇 문양이 빛나고, 픽은 "돌로 만든 놈들이 그 조각을 지킨다"고 속삭입니다. 다음 회차에서 그 의미를 알게 될 것 같습니다.',
  choices: {
    trade: {
      id: 'trade',
      label: '고블린과 거래한다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '픽은 식은땀을 닦으며 고개를 끄덕입니다. "좋아요, 좋아요, 그쪽이 마음에 들어요! 작은 왕님은 반짝이는 거라면 뭐든 좋아하거든요." 작은 왕에게는 빛나는 작은 종 하나를 슬쩍 건네 시선을 돌리게 하고, 그 틈에 진짜 표식을 빼내 챙깁니다. 픽은 신전 입구의 함정 위치까지 손가락으로 가리키며 알려주고, 작은 왕은 종을 흔들며 만족스러운 웃음소리만 낼 뿐 통행을 순순히 허락합니다. 신전으로 가는 길과 픽의 길 안내까지 모두 손에 넣었습니다.',
        mixed: '작은 왕은 의자에 늘어져 앉은 채 손가락을 까딱이며 묻습니다. "지도 조각이냐, 반짝이는 장비냐, 둘 중 하나는 내놔야지. 빈손으로 내 길을 지나가겠다는 건 아니겠지?" 결국 장비 하나를 통행세로 내주고 진짜 표식을 손에 넣습니다. 픽은 안도하며 고마워하지만, 작은 왕에게 진 빚을 다음에 갚겠다는 약속을 남겨야 했고, 그 약속이 어떤 형태로 돌아올지는 아직 알 수 없습니다.',
        weak: '작은 왕은 눈을 가늘게 뜨며 코웃음을 칩니다. "흥, 가져온 게 이게 다냐? 그럼 지도 조각은 내가 갖고 있겠다. 다음에 더 좋은 걸 가져오면 생각해보지." 거래는 절반만 성사되어, 신전 길로 향하는 물그릇 문양만 겨우 보여줄 뿐 지도 조각은 끝내 돌려받지 못합니다. 픽은 미안한 얼굴로 슬쩍 시선을 피하며 작게 중얼거립니다. "다음엔 더 좋은 거 가져와요, 그래야 저도 도와줄 명분이 생기니까요." 협상은 다음 기회로 미뤄야 할 것 같습니다.',
      },
    },
    disarm: {
      id: 'disarm',
      label: '함정을 해체하며 간다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '고블린 함정꾼들이 진짜 표식을 가짜 표식 더미 속에 숨기려는 순간, 줄을 정확히 끊어 덫을 무력화합니다. 픽이 뒤에서 휘파람을 불며 뛰어나와 외칩니다. "와, 진짜 잘하네요! 작은 왕님 밑에서 십 년을 살아도 이런 솜씨는 처음 봐요. 그럼 저도 같이 가요, 안내는 제가 할게요!" 진짜 표식을 깔끔하게 손에 넣고 픽까지 길잡이로 얻은 채, 신전 입구의 함정 위치까지 미리 모두 파악했습니다.',
        mixed: '덫을 대부분 해체하지만 마지막 하나가 작동하며 뿌리 구덩이 일부가 무너져 내립니다. 픽이 흙먼지 속에서 다급하게 소리칩니다. "조심해요, 조심해요! 그거 건드리면 작은 왕님이 바로 알아챈다고요, 우리 다 잡혀가요!" 진짜 표식은 간신히 손에 넣었지만 지도 조각 한쪽이 찢어져, 3회차로 이어지는 신전 입구의 함정 하나가 이미 깨어 있는 상태로 남게 되었습니다. 픽은 다친 발을 절뚝이며 뒤따라옵니다.',
        weak: '덫의 줄을 잘못 건드려 요란한 종소리가 숲 전체에 울리고, 놀란 함정꾼이 진짜 표식을 낚아채 어둠 속으로 달아납니다. 픽이 머리를 감싸며 절규하듯 외칩니다. "안 돼, 안 돼요! 이제 작은 왕님이 직접 나올 거예요, 저 이제 죽었어요!" 파티는 무너진 뿌리 구덩이를 위험하게 건너뛸지, 픽에게 빚을 지고 도움을 받을지 그 자리에서 빠르게 선택해야 하며, 멀리서 발소리가 점점 가까워집니다.',
      },
    },
    bypass: {
      id: 'bypass',
      label: '소굴을 우회한다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '뒤집힌 표식판 무더기를 차분히 뒤지며 물그릇 문양이 새겨진 진짜 표식을 정확히 찾아냅니다. 픽이 멀리 뿌리 틈에서 손을 흔들며 작게 속삭입니다. "거기, 거기예요! 그쪽 길이 안전해요, 작은 왕님도 다리가 짧아서 잘 안 가는 곳이거든요. 잘 골랐네요." 소굴을 누구에게도 들키지 않고 빠져나가 이끼 언덕까지 곧장 도착하고, 신전 입구의 경보도 끝내 울리지 않았으며, 픽은 멀리서 손을 흔들며 배웅합니다.',
        mixed: '우회로를 찾는 데는 성공하지만 표식을 분간하는 데 시간이 꽤 걸립니다. 신전 길은 결국 열렸지만, 서두르는 사이 지도 조각 한쪽이 찢어져 3회차 입구의 함정 하나가 이미 깨어 있는 상태로 남았습니다. 픽은 멀리 그늘 속에서 "조심해서 가요, 다음엔 더 빨리 찾아봐요!"라고 외칠 뿐, 더 가까이 다가와 도와주지는 못하고 곧 어둑한 그늘 속으로 모습을 감춥니다. 시간이 늦어진 만큼 마음이 급해집니다.',
        weak: '우회로로 보였던 길이 사실은 가짜 표식이 만든 함정이었고, 발밑이 무너지며 젖은 신전 회랑으로 그대로 추락합니다. 멀리서 들리던 작은 왕의 웃음소리가 한층 더 커지며 뿌리 사이로 울립니다. "역시 멍청한 놈들이군, 다 그쪽이 알아서 떨어진 거다!" 신전을 지키는 석상이 파티의 도착을 먼저 알아챈 듯, 차가운 돌 시선이 어둠 속에서 천천히 이쪽을 향해 움직이는 것이 느껴집니다.',
      },
    },
  },
};

// 3회차를 추가할 때는 위 SESSION_01_BLACK_BELL / SESSION_02_ROOTS_BELOW와 같은 모양의 객체를 만들어
// 아래 SESSIONS / SESSION_ORDER에 등록한다. 예:
//   const SESSION_03_X = { id: 'session_03_x', title: '3회차. ...', ... };
//   SESSIONS[SESSION_03_X.id] = SESSION_03_X;
//   SESSION_ORDER.push(SESSION_03_X.id);
const SESSIONS = {
  [SESSION_01_BLACK_BELL.id]: SESSION_01_BLACK_BELL,
  [SESSION_02_ROOTS_BELOW.id]: SESSION_02_ROOTS_BELOW,
};

const SESSION_ORDER = [SESSION_01_BLACK_BELL.id, SESSION_02_ROOTS_BELOW.id];

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

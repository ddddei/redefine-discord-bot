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
        strong: '토른이 먼저 칼자루를 놓고 문을 박차며 달려 나가고, 당신도 곧장 그 뒤를 따라 차가운 밤공기 속으로 뛰어듭니다. "이 길로! 발자국이 비탈 쪽으로 꺾였소!" 토른이 외치는 대로 진흙투성이 비탈을 오르자, 굵은 뿌리가 땅 위로 솟은 자리에서 고블린의 발이 그대로 걸려 넘어집니다. 손에 쥐고 있던 지도 조각과 숲길 표식이 한꺼번에 허공으로 튕겨 나가고, 당신은 몸을 날려 둘 다 흠 하나 없이 받아 냅니다. 토른이 다가와 흙 묻은 표식을 받아 들고는, 안쪽에 파고든 무늬를 손끝으로 쓸어 보다 낯빛이 굳습니다. "이건… 본 적 있는 무늬요. 안개 탑 아래, 뿌리가 얽힌 길로 이어지는 표식이지." 그가 표식을 도로 건네며 낮게 덧붙입니다. "다음에 저 탑 밑으로 내려갈 일이 생기면, 이게 길잡이가 될 거요."',
        mixed: '토른과 함께 숲길로 뛰어들어 고블린의 등을 거의 따라잡았지만, 녀석은 마지막 순간 몸을 던져 낡은 울타리 너머로 빠져나갑니다. 뒤엉킨 몸싸움 중에 지도 조각 한 귀퉁이가 찢기고, 토른의 방패에도 깊게 긁힌 흔적이 남습니다. "괜찮소, 일단 숨을 돌립시다." 토른이 방패를 내려놓으며 거칠게 숨을 내쉽니다. 진흙 위에 떨어진 숲길 표식을 주워 들지만, 뿌리 무늬는 반쪽만 남아 어디로 이어지는지 가늠하기 어렵습니다. 토른이 찢어진 지도 조각을 불빛에 비춰 보며 고개를 젓습니다. "서두르면 또 이렇게 될 거요. 다음엔 이 반쪽짜리 무늬부터 제대로 맞춰 봐야겠소." 그 말이 마치 다음 걸음을 미리 일러 주는 것처럼 들립니다.',
        weak: '고블린은 지도 조각 일부를 찢어 손에 쥔 채 안개 자욱한 숲 가장자리, 어둠이 짙게 깔린 나무 사이로 사라져 버립니다. 토른이 횃불을 들고 바닥을 훑지만, 발자국은 금세 진흙과 안개 속에 뒤섞여 자취를 감춥니다. "이 상태로 더 들어가면 우리가 길을 잃을 거요." 토른이 횃불을 거두며 단호하게 말립니다. 멀리서 다시 한 번, 더 낮고 음울하게 검은 종소리가 울리고, 안개 너머 탑의 윤곽이 잠깐 드러났다가 곧 흐려집니다. 토른이 그 쪽을 바라보며 중얼거립니다. "저 탑 아래로 이어진 뿌리 길… 표식 없이 들어섰다간 우리가 먼저 삼켜질 거요." 지금은 물러서야겠지만, 그 뿌리 길은 분명 다음에 다시 마주치게 될 것 같습니다.',
      },
    },
    investigate: {
      id: 'investigate',
      label: '여관과 마을을 먼저 조사한다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '난로 곁에 머물러 마라와 토른에게 차례로 묻습니다. 여관 안은 장작 타는 냄새와 흐릿한 등불 빛으로 가득하고, 마라는 한참 머뭇거리다 입을 엽니다. "지도 조각이 문 아래로 들어오던 그 순간, 창밖으로 그림자 하나가 스쳐 지나가는 걸 봤소." 토른이 곧장 당신을 우물가로 이끕니다. 차가운 돌 틀에 둘러싸인 우물 옆, 검은 종소리가 남긴 그을음 자국이 또렷하게 찍혀 있습니다. 토른이 그 위에 손을 얹고 말합니다. "이건 안개 탑 쪽 길에서만 나는 그을음이오. 흙 속 뿌리를 타고 올라오는 길이지." 지도 조각은 손상 없이 보호했고, 마라의 보급품과 토른의 낡은 방패까지 챙겼으니, 안개 탑으로 이어진 뿌리 길의 방향을 이미 알아 둔 셈입니다. 토른이 표식을 가리키며 덧붙입니다. "다음에 저기로 내려갈 때, 이 자국이 입구를 알려 줄 거요."',
        mixed: '단서를 찾기는 했지만 시간이 꽤 걸렸습니다. 여관 안에서 마라가 그림자를 봤다고 인정하면서도 카운터를 손가락으로 두드리며 조건을 붙입니다. "보급을 내주려면, 작은 부탁 하나는 들어줘야겠소." 토른은 우물가로 안내해 그을린 표식을 발견하지만, 밤새 내린 빗물에 절반쯤 흐려진 자국을 보며 한숨을 내쉽니다. "방향은 알겠는데, 고블린은 이미 멀리 달아난 뒤요." 우물 너머 안개 속에서 탑의 윤곽이 잠깐 비쳤다가 다시 흐려집니다. 토른이 그쪽을 바라보며 말합니다. "흐려진 자국이라도 뿌리 길 방향은 가리키고 있소. 다음에 마라의 부탁부터 해결하고 가는 게 낫겠소." 마라에게 진 작은 빚이 다음 걸음을 무겁게 만들 듯합니다.',
        weak: '마을을 살피는 동안 고블린은 완전히 자취를 감췄습니다. 지도 조각은 지켜냈지만, 우물가의 표식은 밤새 내린 비에 거의 씻겨 나가 토른도 흙바닥에 무릎을 꿇고 한참을 들여다봅니다. "이 흔적만으론 방향을 가늠할 수가 없소." 그가 일어서며 고개를 젓습니다. 마라도 카운터 너머에서 조용히 지켜보다 말합니다. "그림자는 봤지만, 어디로 갔는지는 나도 모르겠소." 멀리 북쪽, 안개에 잠긴 탑 쪽에서 또 한 번 종소리가 낮게 울리고, 그 소리만이 뿌리 길이 여전히 그곳에서 기다리고 있음을 알려 줍니다. 안개 탑으로 가는 길은 다음에 처음부터 다시 찾아야 할 것 같습니다.',
      },
    },
    negotiate: {
      id: 'negotiate',
      label: '렌과 거래해 지도의 출처를 묻는다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '여관 구석, 어둑한 자리에 앉은 렌을 찾아가 지도의 출처를 묻습니다. 그는 한동안 손에 든 잔을 빙빙 돌리며 망설이다, 결국 목소리를 낮춰 입을 엽니다. "그 지도, 원래는 뿌리 아래로 이어진 길을 그린 거요. 안개 탑 밑에, 사람들이 잘 모르는 통로가 있지." 그는 탁자에 손가락으로 길을 그려 보이며 숲길 표식의 정확한 위치까지 순순히 짚어 줍니다. 옆에서 듣고 있던 토른이 팔짱을 끼고 중얼거립니다. "그 말이 맞다면, 우리가 가려는 곳은 생각보다 깊겠소." 렌이 잔을 비우며 마지막으로 한마디 덧붙입니다. "그 길, 끝까지 가 본 사람은 아직 못 봤소." 다음 숲길 판정에 분명한 이점을 만든 것은 물론, 뿌리 아래 길의 정체에 한 걸음 더 다가선 셈입니다.',
        mixed: '렌은 거래에 응하긴 하지만 순순히 넘어가지 않습니다. "공짜로 줄 만한 얘기는 아니지." 그가 잔을 내려놓으며 의자를 당겨 앉습니다. 지도의 출처가 안개 탑 아래 뿌리 길이라는 단서를 흘리는 대신, 그는 작은 부탁 하나를 들어 달라고 못을 박습니다. "어렵지 않은 일이오. 다만 지금 당장은 말 못 하지." 토른이 옆에서 못마땅한 얼굴로 헛기침을 하지만, 렌은 눈도 깜빡이지 않습니다. 결국 렌에게 작은 빚을 지게 되었고, 그 빚이 언제 어떤 모습으로 되돌아올지는 알 수 없습니다. 토른이 여관을 나서며 낮게 말합니다. "저런 자와 거래할 땐 늘 뒷맛이 남는 법이오. 다음에 뿌리 길로 들어설 때 다시 떠오를 거요."',
        weak: '렌은 지도의 출처를 먼저 숨기고 더 큰 거래를 요구합니다. "이런 얘기는 그만한 값을 치러야지." 그가 의자에 등을 기대며 팔짱을 끼고는 더 이상 말을 잇지 않습니다. 토른이 옆에서 눈치를 주지만 렌은 태연하게 잔을 다시 채울 뿐입니다. 협상은 다음으로 미뤄야 할 것 같고, 안개 탑으로 가는 단서는 여전히 손에 잡히지 않습니다. 여관 문밖에서 또 한 번 검은 종소리가 희미하게 울리고, 토른이 그 소리에 귀를 기울이며 말합니다. "렌이 입을 열든 안 열든, 저 종소리는 우리를 뿌리 길로 부르고 있소." 언젠가는 렌의 입을 열게 할 다른 방법을 찾아야 할 듯합니다.',
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

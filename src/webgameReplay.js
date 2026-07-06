// 서버 리플레이 검증기 (docs/replay-verification-plan.md 2절).
//
// 클라이언트가 신고한 점수를 "같은 로직으로 재현"해 검증한다. match3/deck 로직 파일은
// 이미 Node에서 로드 가능한 순수 로직으로 설계돼 있어(로직 테스트가 그 증거) 클라이언트가
// 쓰는 것과 동일한 파일을 그대로 require한다 — 이중 구현을 만들지 않는다.
//
// 판정 원칙(계획서 0절): 검증은 절대 제출 자체를 막지 않는다. 재현기 자체가 실패하면
// (require 실패, 예외, 로그 없음/버전 불일치/액션 초과) missing으로 폴백하고 콘솔 경고만
// 남긴다. mismatch는 도입기에 flagged로 자동 전환하지 않는다(별도 strict 스위치).

const path = require('path');

// v2: 매치3 특수 타일 도입으로 재현 의미가 바뀜(withSpecials) — 구버전 클라이언트
// (브라우저 캐시 등)의 v1 로그를 특수 포함으로 재현하면 정직한 제출이 mismatch가
// 되므로, 버전을 올려 v1 로그는 검증 없이 missing으로 무해하게 처리한다.
const REPLAY_LOG_VERSION = 2;
const MATCH3_MAX_ACTIONS = 30;
const DECK_MAX_ACTIONS = 2000;

const REPLAY_STATUS = {
  VERIFIED: 'verified',
  MISMATCH: 'mismatch',
  MISSING: 'missing',
  SKIPPED: 'skipped',
};

// 리플레이 검증 대상 게임(계획서 0.1). idle/word/survivors는 대상 외.
const REPLAYABLE_GAMES = new Set(['match3', 'deck']);

function isStrictModeEnabled() {
  return String(process.env.WEBGAME_REPLAY_STRICT || '').toLowerCase() === 'true';
}

function loadMatch3Modules() {
  // public/match3/*.js는 브라우저 UMD 패턴이라 require()로 그대로 로드된다(클라와 동일 파일).
  const Board = require(path.join('..', 'public', 'match3', 'board.js'));
  const Scoring = require(path.join('..', 'public', 'match3', 'scoring.js'));
  return { Board, Scoring };
}

function loadDeckModules() {
  const Content = require(path.join('..', 'public', 'deck', 'content.js'));
  const Engine = require(path.join('..', 'public', 'deck', 'engine.js'));
  return { Content, Engine };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// seed가 없는 제출(자유 플레이가 URL 시드/오늘의 도전 없이 시작된 경우, 클라이언트가
// Math.random() 기반의 진짜 무작위 시드를 쓰고 서버에 값 자체를 보내지 않는 경우)은
// Number(null) === 0처럼 우연히 유효한 숫자로 보여서는 안 된다 - 재현 불가능한 게임을
// mismatch로 오판하지 않도록 여기서 명시적으로 missing 처리한다.
function hasUsableSeed(seed) {
  if (seed === null || seed === undefined || seed === '') {
    return false;
  }
  return Number.isFinite(Number(seed));
}

function isValidMatch3Action(action) {
  return Array.isArray(action)
    && action.length === 4
    && action.every((value) => Number.isInteger(value));
}

// match3 재현: generateBoard(seed) + scoring.js의 applySwapMove를 game.js와 동일한
// 순서(성공 스왑만 로그에 있다는 전제)로 재생한다.
function replayMatch3(seed, actions) {
  let Board;
  let Scoring;
  try {
    ({ Board, Scoring } = loadMatch3Modules());
  } catch (error) {
    console.warn('[webgameReplay] match3 모듈 로드 실패 - missing 처리합니다.', error.message);
    return { status: REPLAY_STATUS.MISSING };
  }

  const numericSeed = Number(seed);
  if (!Number.isFinite(numericSeed)) {
    return { status: REPLAY_STATUS.MISSING };
  }

  if (!Array.isArray(actions) || actions.length > MATCH3_MAX_ACTIONS) {
    return { status: REPLAY_STATUS.MISSING };
  }

  if (!actions.every(isValidMatch3Action)) {
    return { status: REPLAY_STATUS.MISMATCH, reason: 'INVALID_ACTION_SHAPE' };
  }

  try {
    // withSpecials: true - 특수 타일 생성/발동까지 포함해 재현한다(클라이언트
    // game.js가 항상 특수 타일 로직을 사용하므로, 검증기도 같은 경로를 써야
    // 이중 구현 없이 점수가 일치한다. docs/match3-improvement-plan.md 1절).
    const result = Scoring.replayMatch3(numericSeed, actions, true);
    if (!result.ok) {
      return { status: REPLAY_STATUS.MISMATCH, reason: result.reason, replayScore: result.score };
    }
    return { status: REPLAY_STATUS.VERIFIED, replayScore: result.score };
  } catch (error) {
    console.warn('[webgameReplay] match3 재현 중 예외 - missing 처리합니다.', error.message);
    return { status: REPLAY_STATUS.MISSING };
  }
}

const DECK_ACTION_HANDLERS = {
  // ["n"] 다음 칸 진입
  n(state, tracker, Engine) {
    const result = Engine.enterCurrentNode(state, tracker);
    return result.success;
  },
  // ["p", cardId, handIndex] 카드 사용
  p(state, tracker, Engine, action) {
    const cardId = action[1];
    const handIndex = action[2];
    if (typeof cardId !== 'string') {
      return false;
    }
    if (!Engine.canPlayCard(state, cardId)) {
      return false;
    }
    const result = Engine.playCard(state, cardId, handIndex, tracker);
    return result.success;
  },
  // ["e"] 턴 종료
  e(state, tracker, Engine) {
    if (!state.combat) {
      return false;
    }
    Engine.endTurn(state, tracker);
    return true;
  },
  // ["r", cardId] 보상 선택
  r(state, tracker, Engine, action) {
    const cardId = action[1];
    if (typeof cardId !== 'string') {
      return false;
    }
    const result = Engine.chooseReward(state, cardId);
    return result.success;
  },
  // ["r0"] 보상 건너뛰기
  r0(state, tracker, Engine) {
    const result = Engine.chooseReward(state, null);
    return result.success;
  },
  // ["h"] 휴식 회복
  h(state, tracker, Engine) {
    const result = Engine.applyRestHeal(state);
    return result.success;
  },
  // ["x", deckIndex] 휴식 카드 제거
  x(state, tracker, Engine, action) {
    const deckIndex = action[1];
    if (!Number.isInteger(deckIndex)) {
      return false;
    }
    const result = Engine.applyRestRemoveCard(state, deckIndex);
    return result.success;
  },
  // ["a"] 다음 노드로
  a(state, tracker, Engine) {
    Engine.advanceToNextNode(state);
    return true;
  },
};

function isValidDeckAction(action) {
  if (!Array.isArray(action) || action.length === 0 || typeof action[0] !== 'string') {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(DECK_ACTION_HANDLERS, action[0]);
}

// 덱 재현: createNewRun(seed) + trackerFromState로 시작해 액션 타입별로 엔진 공개 함수를
// 그대로 호출한다. 각 액션 전 유효성을 그 함수 자신이 확인하므로(canPlayCard 등),
// 실패(success:false 또는 handler false)를 즉시 mismatch로 판정한다.
// 점수 산식: 도달 칸 x 1000 + 잔여 HP (webgameApi.js GAME_DEFINITIONS.deck 상수와 일치).
function replayDeck(seed, actions) {
  let Content;
  let Engine;
  try {
    ({ Content, Engine } = loadDeckModules());
  } catch (error) {
    console.warn('[webgameReplay] deck 모듈 로드 실패 - missing 처리합니다.', error.message);
    return { status: REPLAY_STATUS.MISSING };
  }

  const numericSeed = Number(seed);
  if (!Number.isFinite(numericSeed)) {
    return { status: REPLAY_STATUS.MISSING };
  }

  if (!Array.isArray(actions) || actions.length > DECK_MAX_ACTIONS) {
    return { status: REPLAY_STATUS.MISSING };
  }

  if (!actions.every(isValidDeckAction)) {
    return { status: REPLAY_STATUS.MISMATCH, reason: 'INVALID_ACTION_SHAPE' };
  }

  try {
    const state = Engine.createNewRun(numericSeed);
    let tracker = Engine.trackerFromState(state);

    for (let i = 0; i < actions.length; i += 1) {
      const action = actions[i];
      const handler = DECK_ACTION_HANDLERS[action[0]];
      const ok = handler(state, tracker, Engine, action);
      if (!ok) {
        return { status: REPLAY_STATUS.MISMATCH, reason: 'INVALID_DECK_ACTION', actionIndex: i };
      }
      Engine.commitTracker(state, tracker);
      tracker = Engine.trackerFromState(state);

      if (state.finished) {
        break;
      }
    }

    if (!state.finished) {
      // 로그가 런 종료 전에 끊긴 경우 - 서버가 임의로 점수를 매길 수 없으므로 mismatch.
      return { status: REPLAY_STATUS.MISMATCH, reason: 'RUN_NOT_FINISHED' };
    }

    const totalNodes = Content.RUN_LAYOUT.length;
    const reachedStage = Math.min(state.runIndex + 1, totalNodes);
    const remainingHp = Math.max(0, state.player.hp);
    const replayScore = reachedStage * 1000 + remainingHp;

    return { status: REPLAY_STATUS.VERIFIED, replayScore };
  } catch (error) {
    console.warn('[webgameReplay] deck 재현 중 예외 - missing 처리합니다.', error.message);
    return { status: REPLAY_STATUS.MISSING };
  }
}

// 진입점: gameId·score·replayLog를 받아 판정 결과를 돌려준다.
// { status, replayScore?, reason? }. 예외를 던지지 않는다(항상 missing 폴백).
function verifyReplay({ gameId, score, seed, replayLog }) {
  try {
    if (!REPLAYABLE_GAMES.has(gameId)) {
      return { status: REPLAY_STATUS.SKIPPED };
    }

    if (!isPlainObject(replayLog)) {
      return { status: REPLAY_STATUS.MISSING };
    }

    if (replayLog.v !== REPLAY_LOG_VERSION) {
      return { status: REPLAY_STATUS.MISSING };
    }

    if (!Array.isArray(replayLog.actions)) {
      return { status: REPLAY_STATUS.MISSING };
    }

    if (!hasUsableSeed(seed)) {
      return { status: REPLAY_STATUS.MISSING };
    }

    const result = gameId === 'match3'
      ? replayMatch3(seed, replayLog.actions)
      : replayDeck(seed, replayLog.actions);

    if (result.status === REPLAY_STATUS.VERIFIED) {
      if (result.replayScore !== score) {
        return { status: REPLAY_STATUS.MISMATCH, reason: 'SCORE_MISMATCH', replayScore: result.replayScore };
      }
      return { status: REPLAY_STATUS.VERIFIED, replayScore: result.replayScore };
    }

    return result;
  } catch (error) {
    console.warn('[webgameReplay] 검증 중 예외 발생 - missing 처리합니다.', error.message);
    return { status: REPLAY_STATUS.MISSING };
  }
}

module.exports = {
  verifyReplay,
  isStrictModeEnabled,
  REPLAY_STATUS,
  REPLAY_LOG_VERSION,
  REPLAYABLE_GAMES,
  MATCH3_MAX_ACTIONS,
  DECK_MAX_ACTIONS,
};

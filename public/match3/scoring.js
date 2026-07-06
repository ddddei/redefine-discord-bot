(function (root) {
  'use strict';

  // 순수 함수 모듈. board.js와 동일한 UMD 패턴(브라우저 window + Node module.exports 겸용).
  // match3 game.js(클라 표시 계층)와 서버 검증기(src/webgameReplay.js)가 이 모듈을
  // 함께 사용해, 스왑 1회의 판정·캐스케이드 처리·자동 셔플까지 한 흐름으로 이중 구현 없이 공유한다.
  //
  // board.js 자체(무수정 대상)에 손대지 않고, board.js가 제공하는 프리미티브
  // (tryApplySwap/resolveCascades/hasAvailableMove/shuffleBoard)를 게임이 실제로
  // 소비하는 순서 그대로 조합한 오케스트레이션 계층이다.

  var Board = (typeof root !== 'undefined' && root.Match3Board)
    || (typeof require === 'function' ? require('./board') : null);

  // 스왑 이후 캐스케이드를 모두 해소한다. game.js의 resolveBoard가 그리는 화면과
  // 서버 검증기가 계산하는 점수가 정확히 같은 호출 하나를 거치도록 하는 공용 지점이다.
  // 자동 셔플 여부 판단(hasAvailableMove/shuffleBoard)은 클라이언트 쪽 UI 연출
  // (checkForShuffleNeeded)이 캐스케이드 렌더링 이후 별도 시점에 수행하므로 여기 포함하지
  // 않는다 — 대신 replayMatch3가 game.js와 동일한 순서로 두 단계를 이어붙인다.
  function resolveCascadeStep(grid, rng) {
    return Board.resolveCascades(grid, rng);
  }

  // 스왑 1회를 적용한다. 무효 스왑은 grid를 바꾸지 않고 rng도 소비하지 않는다
  // (되돌려진 무효 스왑이 RNG를 소비하지 않는다는 계획서 전제와 일치).
  // 유효 스왑은 캐스케이드까지 모두 해소한 뒤, 필요하면 보드를 섞는다(자동 셔플도
  // rng를 소비하므로 재현에 포함해야 한다 — game.js의 attemptSwap → resolveBoard →
  // checkForShuffleNeeded 세 단계를 같은 순서로 이어붙인 것과 동등하다).
  function applySwapMove(grid, first, second, rng) {
    var swapResult = Board.tryApplySwap(grid, first, second);
    if (!swapResult.valid) {
      return {
        valid: false,
        grid: grid,
        score: 0,
        cascadeCount: 0,
        maxMultiplier: 1,
        shuffled: false,
      };
    }

    var cascadeResult = resolveCascadeStep(swapResult.grid, rng);
    var nextGrid = cascadeResult.grid;
    var shuffled = false;

    if (!Board.hasAvailableMove(nextGrid)) {
      nextGrid = Board.shuffleBoard(nextGrid, rng);
      shuffled = true;
    }

    return {
      valid: true,
      grid: nextGrid,
      score: cascadeResult.score,
      cascadeCount: cascadeResult.cascadeCount,
      maxMultiplier: cascadeResult.maxMultiplier,
      steps: cascadeResult.steps,
      shuffled: shuffled,
    };
  }

  // 스왑 좌표 시퀀스를 처음부터 재생해 최종 점수를 계산한다. 서버 검증기가 사용한다.
  // actions: [[r1,c1,r2,c2], ...]. 무효 스왑을 만나면 즉시 중단하고 invalid를 표시한다
  // (계획서: 무효 액션 포함 로그는 mismatch 처리 대상).
  function replayMatch3(seed, actions) {
    var initial = Board.generateBoard(seed);
    var grid = initial.grid;
    var rng = initial.rng;
    var totalScore = 0;
    var bestCombo = 1;

    for (var i = 0; i < actions.length; i += 1) {
      var action = actions[i];
      var first = { row: action[0], col: action[1] };
      var second = { row: action[2], col: action[3] };

      var moveResult = applySwapMove(grid, first, second, rng);
      if (!moveResult.valid) {
        return {
          ok: false,
          reason: 'INVALID_SWAP',
          score: totalScore,
          bestCombo: bestCombo,
          actionIndex: i,
        };
      }

      grid = moveResult.grid;
      totalScore += moveResult.score;
      bestCombo = Math.max(bestCombo, moveResult.maxMultiplier);
    }

    return {
      ok: true,
      score: totalScore,
      bestCombo: bestCombo,
      grid: grid,
    };
  }

  var Match3Scoring = {
    resolveCascadeStep: resolveCascadeStep,
    applySwapMove: applySwapMove,
    replayMatch3: replayMatch3,
  };

  root.Match3Scoring = Match3Scoring;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Match3Scoring;
  }
})(typeof window !== 'undefined' ? window : this);

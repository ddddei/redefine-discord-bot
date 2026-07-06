(function (root) {
  'use strict';

  // 목표 판 모드 콘텐츠 상수(docs/match3-improvement-plan.md 3절). 로직(board.js)이
  // 아니라 순수 데이터 - 판 정의는 고정 시드 + 목표 + 수 제한이다. 서버 제출이 없는
  // 랭킹 무관 완료형 트랙이라 서버 검증기와는 무관하다.
  //
  // 목표 타입:
  //  - 'collect': type(간식 종류) 기준 개수 이상 수집
  //  - 'combo':   플레이 중 최고 콤보 배수가 target 이상
  //  - 'special': 특수 타일 발동 횟수가 target 이상
  var GOAL_TYPE = {
    COLLECT: 'collect',
    COMBO: 'combo',
    SPECIAL: 'special',
  };

  // 12종 목표 판. 1~4번은 계획서 예시를 그대로 쓰고, 5~12번은 플레이 테스트
  // 시뮬레이션(단순 정책 자동 플레이로 도달 가능한 점수/수집량/콤보/특수 발동
  // 횟수를 관찰)을 근거로 점진적으로 난도를 올려 확정했다 - 구현 시 확정값을
  // 보고에 남긴다.
  var GOAL_BOARDS = [
    { id: 1, seed: 1001, moves: 20, type: GOAL_TYPE.COLLECT, tile: 'strawberry', target: 12, title: '딸기 12개', description: '이동 20회 안에 딸기 12개를 모아 보세요.' },
    { id: 2, seed: 1002, moves: 25, type: GOAL_TYPE.COMBO, target: 4, title: '콤보 ×4 달성', description: '이동 25회 안에 콤보 배수 ×4를 만들어 보세요.' },
    { id: 3, seed: 1003, moves: 25, type: GOAL_TYPE.COLLECT, tile: 'jelly', target: 18, title: '젤리 18개', description: '이동 25회 안에 젤리 18개를 모아 보세요.' },
    { id: 4, seed: 1004, moves: 20, type: GOAL_TYPE.SPECIAL, target: 2, title: '특수 타일 2회 발동', description: '이동 20회 안에 특수 타일을 2번 발동해 보세요.' },
    { id: 5, seed: 1005, moves: 18, type: GOAL_TYPE.COLLECT, tile: 'orange', target: 12, title: '오렌지 12개', description: '이동 18회 안에 오렌지 12개를 모아 보세요.' },
    { id: 6, seed: 1006, moves: 22, type: GOAL_TYPE.COMBO, target: 2, title: '콤보 ×2 달성', description: '이동 22회 안에 콤보 배수 ×2를 만들어 보세요.' },
    { id: 7, seed: 1007, moves: 22, type: GOAL_TYPE.SPECIAL, target: 2, title: '특수 타일 2회 발동', description: '이동 22회 안에 특수 타일을 2번 발동해 보세요.' },
    { id: 8, seed: 1008, moves: 24, type: GOAL_TYPE.COLLECT, tile: 'cupcake', target: 18, title: '컵케이크 18개', description: '이동 24회 안에 컵케이크 18개를 모아 보세요.' },
    { id: 9, seed: 1009, moves: 24, type: GOAL_TYPE.COLLECT, tile: 'candy', target: 16, title: '사탕 16개', description: '이동 24회 안에 사탕 16개를 모아 보세요.' },
    { id: 10, seed: 1010, moves: 28, type: GOAL_TYPE.COMBO, target: 3, title: '콤보 ×3 달성(고난도 판)', description: '이동 28회 안에 콤보 배수 ×3을 만들어 보세요.' },
    { id: 11, seed: 1011, moves: 26, type: GOAL_TYPE.SPECIAL, target: 2, title: '특수 타일 2회 발동', description: '이동 26회 안에 특수 타일을 2번 발동해 보세요.' },
    { id: 12, seed: 1012, moves: 30, type: GOAL_TYPE.COLLECT, tile: 'strawberry', target: 25, title: '딸기 25개 (최종)', description: '이동 30회 안에 딸기 25개를 모아 보세요.' },
  ];

  function getGoalBoards() {
    return GOAL_BOARDS;
  }

  function getGoalBoardById(id) {
    var numericId = Number(id);
    for (var i = 0; i < GOAL_BOARDS.length; i += 1) {
      if (GOAL_BOARDS[i].id === numericId) {
        return GOAL_BOARDS[i];
      }
    }
    return null;
  }

  // 목표 달성 여부 판정. state: { clearedByType, bestCombo, specialActivationCount }.
  function isGoalAchieved(goal, state) {
    if (!goal || !state) {
      return false;
    }
    if (goal.type === GOAL_TYPE.COLLECT) {
      var collected = (state.clearedByType && state.clearedByType[goal.tile]) || 0;
      return collected >= goal.target;
    }
    if (goal.type === GOAL_TYPE.COMBO) {
      return (state.bestCombo || 1) >= goal.target;
    }
    if (goal.type === GOAL_TYPE.SPECIAL) {
      return (state.specialActivationCount || 0) >= goal.target;
    }
    return false;
  }

  function getGoalProgressText(goal, state) {
    if (!goal || !state) {
      return '';
    }
    if (goal.type === GOAL_TYPE.COLLECT) {
      var collected = (state.clearedByType && state.clearedByType[goal.tile]) || 0;
      return collected + '/' + goal.target;
    }
    if (goal.type === GOAL_TYPE.COMBO) {
      return '×' + (state.bestCombo || 1) + '/×' + goal.target;
    }
    if (goal.type === GOAL_TYPE.SPECIAL) {
      return (state.specialActivationCount || 0) + '/' + goal.target;
    }
    return '';
  }

  var Match3Goals = {
    GOAL_TYPE: GOAL_TYPE,
    GOAL_BOARDS: GOAL_BOARDS,
    getGoalBoards: getGoalBoards,
    getGoalBoardById: getGoalBoardById,
    isGoalAchieved: isGoalAchieved,
    getGoalProgressText: getGoalProgressText,
  };

  root.Match3Goals = Match3Goals;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Match3Goals;
  }
})(typeof window !== 'undefined' ? window : this);

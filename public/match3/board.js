(function (root) {
  'use strict';

  var BOARD_SIZE = 8;
  var TILE_TYPES = ['strawberry', 'orange', 'candy', 'cookie', 'cupcake', 'jelly'];
  var MAX_MOVES = 30;
  var SCORE_BY_MATCH_SIZE = {
    3: 30,
    4: 60,
  };
  var SCORE_FIVE_PLUS = 120;

  function createRng(seed) {
    var state = (typeof seed === 'number' && Number.isFinite(seed))
      ? Math.floor(seed) % 2147483647
      : Math.floor(Math.random() * 2147483646) + 1;

    if (state <= 0) {
      state += 2147483646;
    }

    return function next() {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }

  function randomTileType(rng) {
    var index = Math.floor(rng() * TILE_TYPES.length);
    if (index >= TILE_TYPES.length) {
      index = TILE_TYPES.length - 1;
    }
    return TILE_TYPES[index];
  }

  function cloneGrid(grid) {
    return grid.map(function (row) {
      return row.slice();
    });
  }

  // ---- 특수 타일 (docs/match3-improvement-plan.md 1절) ----
  // specialGrid: grid와 같은 크기의 병렬 배열. 각 칸은 null 또는
  // 'line-h'(가로줄 제거) / 'line-v'(세로줄 제거) / 'wrap'(3x3 폭발) / 'color'(동종 제거)
  // 중 하나다. 간식 종류(grid)와 별개로 관리해, 특수 타일도 일반 매치의 재료로
  // 계속 쓰일 수 있게 한다(계획서 1.1).
  var SPECIAL_KIND = {
    LINE_H: 'line-h',
    LINE_V: 'line-v',
    WRAP: 'wrap',
    COLOR: 'color',
  };

  var SPECIAL_ACTIVATION_BONUS = {
    'line-h': 100,
    'line-v': 100,
    wrap: 150,
    color: 300,
  };

  function createEmptySpecialGrid() {
    var grid = [];
    for (var row = 0; row < BOARD_SIZE; row += 1) {
      grid.push(new Array(BOARD_SIZE).fill(null));
    }
    return grid;
  }

  function cloneSpecialGrid(specialGrid) {
    if (!specialGrid) {
      return createEmptySpecialGrid();
    }
    return specialGrid.map(function (row) {
      return row.slice();
    });
  }

  // 매치 그룹의 모양을 분류한다. 결정적 - 셀 좌표만으로 판정하므로 RNG 미사용.
  // 'line': 한 행 또는 한 열에 모두 놓인 매치(가로/세로 일렬).
  // 'cross': 그 외(교차하는 T/L자 형태 - findMatches의 flood-fill이 가로 런과
  // 세로 런이 겹치는 셀에서 두 그룹을 하나로 합치므로 자연히 나타난다).
  function classifyGroupShape(group) {
    var cells = group.cells;
    var sameRow = cells.every(function (cell) {
      return cell[0] === cells[0][0];
    });
    var sameCol = cells.every(function (cell) {
      return cell[1] === cells[0][1];
    });
    if (sameRow) {
      return { shape: 'line', orientation: 'horizontal' };
    }
    if (sameCol) {
      return { shape: 'line', orientation: 'vertical' };
    }
    return { shape: 'cross' };
  }

  // 교차점 셀(T/L자의 코너)을 찾는다: 가로로도 2개 이상, 세로로도 2개 이상
  // 이웃(매치 그룹 내)을 가진 셀. 결정적으로 좌상단부터 스캔해 첫 후보를 쓴다.
  function findIntersectionCell(group) {
    var cellSet = {};
    group.cells.forEach(function (cell) {
      cellSet[cell[0] + ',' + cell[1]] = true;
    });

    var sorted = group.cells.slice().sort(function (a, b) {
      return (a[0] - b[0]) || (a[1] - b[1]);
    });

    for (var i = 0; i < sorted.length; i += 1) {
      var r = sorted[i][0];
      var c = sorted[i][1];
      var horizNeighbors = (cellSet[r + ',' + (c - 1)] ? 1 : 0) + (cellSet[r + ',' + (c + 1)] ? 1 : 0);
      var vertNeighbors = (cellSet[(r - 1) + ',' + c] ? 1 : 0) + (cellSet[(r + 1) + ',' + c] ? 1 : 0);
      if (horizNeighbors > 0 && vertNeighbors > 0) {
        return [r, c];
      }
    }
    // Fallback (이론상 도달하지 않음): 최좌상단 셀.
    return sorted[0];
  }

  // 매치 그룹의 최좌상단 셀 - 캐스케이드로 유발된 매치의 특수 타일 생성 위치
  // (계획서 1.1: "캐스케이드 유발 시 매치 그룹의 최좌상단 셀").
  function topLeftCell(group) {
    var sorted = group.cells.slice().sort(function (a, b) {
      return (a[0] - b[0]) || (a[1] - b[1]);
    });
    return sorted[0];
  }

  // 매치 그룹 하나에서 생성될 특수 타일 종류와 위치를 결정한다(결정적, RNG 미사용).
  // swapCell: 이번 스왑으로 실제로 옮겨진 두 칸 중 이 그룹에 포함된 셀(있으면 그 자리에
  // 생성) - 없으면(캐스케이드 유발) 최좌상단/교차점 규칙을 쓴다.
  function planSpecialForGroup(group, swapCells) {
    var size = group.cells.length;
    if (size < 4) {
      return null;
    }

    var shape = classifyGroupShape(group);
    var swapCellInGroup = null;
    if (swapCells) {
      swapCellInGroup = group.cells.find(function (cell) {
        return swapCells.some(function (sc) {
          return sc[0] === cell[0] && sc[1] === cell[1];
        });
      }) || null;
    }

    if (shape.shape === 'cross') {
      // T/L자(교차 5~6개) -> 폭발 타일, 교차점 셀에 생성.
      var spawnCell = findIntersectionCell(group);
      return { kind: SPECIAL_KIND.WRAP, cell: spawnCell, type: group.type };
    }

    // 일렬 매치: 스왑으로 유발됐으면 스왑된 셀, 아니면 최좌상단 셀.
    var lineSpawnCell = swapCellInGroup || topLeftCell(group);

    if (size >= 5) {
      return { kind: SPECIAL_KIND.COLOR, cell: lineSpawnCell, type: group.type };
    }

    // size === 4
    var kind = shape.orientation === 'horizontal' ? SPECIAL_KIND.LINE_V : SPECIAL_KIND.LINE_H;
    // 가로로 4개가 늘어선 매치는 "세로줄 제거" 타일을 만든다(계획서 1.1 표) - 즉
    // 매치 방향과 생성 타일의 제거 방향은 반대다.
    return { kind: kind, cell: lineSpawnCell, type: group.type };
  }

  // 특수 타일 발동 시 제거되는 셀 좌표 목록을 계산한다(자기 자신 포함).
  // colorTargetType: 'color' 타일 발동 시 제거할 간식 종류(스왑 상대 또는
  // 보드에서 가장 많은 종류 - 계획서 1.2).
  function computeActivationCells(kind, row, col, grid) {
    var cells = [];
    if (kind === SPECIAL_KIND.LINE_H) {
      for (var c = 0; c < BOARD_SIZE; c += 1) {
        cells.push([row, c]);
      }
    } else if (kind === SPECIAL_KIND.LINE_V) {
      for (var r = 0; r < BOARD_SIZE; r += 1) {
        cells.push([r, col]);
      }
    } else if (kind === SPECIAL_KIND.WRAP) {
      for (var dr = -1; dr <= 1; dr += 1) {
        for (var dc = -1; dc <= 1; dc += 1) {
          var nr = row + dr;
          var nc = col + dc;
          if (inBounds(nr, nc)) {
            cells.push([nr, nc]);
          }
        }
      }
    }
    return cells;
  }

  // 보드에서 가장 많은 간식 종류를 찾는다(동수면 TILE_TYPES 순서 - 계획서 1.2
  // "동수면 간식 id 순"). 컬러 타일이 캐스케이드로 소모될 때(스왑 상대가 없을 때) 쓴다.
  function findMostCommonType(grid) {
    var counts = {};
    TILE_TYPES.forEach(function (type) {
      counts[type] = 0;
    });
    grid.forEach(function (row) {
      row.forEach(function (tile) {
        if (tile !== null && Object.prototype.hasOwnProperty.call(counts, tile)) {
          counts[tile] += 1;
        }
      });
    });

    var bestType = TILE_TYPES[0];
    var bestCount = -1;
    TILE_TYPES.forEach(function (type) {
      if (counts[type] > bestCount) {
        bestCount = counts[type];
        bestType = type;
      }
    });
    return bestType;
  }

  function inBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  function wouldMatchAt(grid, row, col, type) {
    // Horizontal check.
    var left = 0;
    for (var c = col - 1; c >= 0 && grid[row][c] === type; c -= 1) {
      left += 1;
    }
    var right = 0;
    for (var c2 = col + 1; c2 < BOARD_SIZE && grid[row][c2] === type; c2 += 1) {
      right += 1;
    }
    if (left + right + 1 >= 3) {
      return true;
    }

    // Vertical check.
    var up = 0;
    for (var r = row - 1; r >= 0 && grid[r][col] === type; r -= 1) {
      up += 1;
    }
    var down = 0;
    for (var r2 = row + 1; r2 < BOARD_SIZE && grid[r2][col] === type; r2 += 1) {
      down += 1;
    }
    return up + down + 1 >= 3;
  }

  // Builds the initial board row by row, column by column, avoiding matches
  // by directly inspecting the real grid being filled so no post-hoc match
  // cleanup is needed.
  function generateBoard(seed) {
    var rng = createRng(seed);
    var grid = [];
    for (var row = 0; row < BOARD_SIZE; row += 1) {
      grid.push(new Array(BOARD_SIZE).fill(null));
    }

    for (var r = 0; r < BOARD_SIZE; r += 1) {
      for (var c = 0; c < BOARD_SIZE; c += 1) {
        var candidates = TILE_TYPES.slice();
        var chosen = null;
        while (candidates.length > 0) {
          var idx = Math.floor(rng() * candidates.length);
          if (idx >= candidates.length) idx = candidates.length - 1;
          var candidate = candidates[idx];
          grid[r][c] = candidate;
          if (!wouldMatchAt(grid, r, c, candidate)) {
            chosen = candidate;
            break;
          }
          candidates.splice(idx, 1);
          grid[r][c] = null;
        }
        if (chosen === null) {
          // Fallback: no candidate avoids a match (rare); pick a random one.
          chosen = randomTileType(rng);
          grid[r][c] = chosen;
        }
      }
    }

    return { grid: grid, rng: rng, specialGrid: createEmptySpecialGrid() };
  }

  function findMatches(grid) {
    var matched = [];
    for (var i = 0; i < BOARD_SIZE; i += 1) {
      matched.push(new Array(BOARD_SIZE).fill(false));
    }

    // Horizontal runs.
    for (var row = 0; row < BOARD_SIZE; row += 1) {
      var runStart = 0;
      for (var col = 1; col <= BOARD_SIZE; col += 1) {
        var currentType = col < BOARD_SIZE ? grid[row][col] : null;
        var prevType = grid[row][col - 1];
        if (currentType !== prevType) {
          var runLength = col - runStart;
          if (runLength >= 3 && prevType !== null) {
            for (var k = runStart; k < col; k += 1) {
              matched[row][k] = true;
            }
          }
          runStart = col;
        }
      }
    }

    // Vertical runs.
    for (var col2 = 0; col2 < BOARD_SIZE; col2 += 1) {
      var vRunStart = 0;
      for (var row2 = 1; row2 <= BOARD_SIZE; row2 += 1) {
        var currentType2 = row2 < BOARD_SIZE ? grid[row2][col2] : null;
        var prevType2 = grid[row2 - 1][col2];
        if (currentType2 !== prevType2) {
          var runLength2 = row2 - vRunStart;
          if (runLength2 >= 3 && prevType2 !== null) {
            for (var k2 = vRunStart; k2 < row2; k2 += 1) {
              matched[k2][col2] = true;
            }
          }
          vRunStart = row2;
        }
      }
    }

    var groups = groupMatchedCells(grid, matched);
    return { mask: matched, groups: groups };
  }

  function groupMatchedCells(grid, mask) {
    var visited = [];
    for (var i = 0; i < BOARD_SIZE; i += 1) {
      visited.push(new Array(BOARD_SIZE).fill(false));
    }

    var groups = [];

    for (var row = 0; row < BOARD_SIZE; row += 1) {
      for (var col = 0; col < BOARD_SIZE; col += 1) {
        if (!mask[row][col] || visited[row][col]) {
          continue;
        }

        var type = grid[row][col];
        var stack = [[row, col]];
        var cells = [];
        visited[row][col] = true;

        while (stack.length > 0) {
          var cur = stack.pop();
          var cr = cur[0];
          var cc = cur[1];
          cells.push([cr, cc]);

          var neighbors = [[cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]];
          for (var n = 0; n < neighbors.length; n += 1) {
            var nr = neighbors[n][0];
            var nc = neighbors[n][1];
            if (
              inBounds(nr, nc)
              && mask[nr][nc]
              && !visited[nr][nc]
              && grid[nr][nc] === type
            ) {
              visited[nr][nc] = true;
              stack.push([nr, nc]);
            }
          }
        }

        groups.push({ type: type, cells: cells });
      }
    }

    return groups;
  }

  function hasAnyMatch(grid) {
    var result = findMatches(grid);
    return result.groups.length > 0;
  }

  function isAdjacent(a, b) {
    var rowDiff = Math.abs(a.row - b.row);
    var colDiff = Math.abs(a.col - b.col);
    return (rowDiff + colDiff) === 1;
  }

  function swapCells(grid, a, b) {
    var next = cloneGrid(grid);
    var temp = next[a.row][a.col];
    next[a.row][a.col] = next[b.row][b.col];
    next[b.row][b.col] = temp;
    return next;
  }

  // tryApplySwap(grid, a, b, specialGrid?): specialGrid를 넘기면 결과에
  // specialGrid(스왑 반영분)도 함께 돌려주고, 스왑된 두 칸 중 하나라도 특수
  // 타일이면 일반 매치가 없어도 유효한 스왑으로 취급한다(계획서 1.2: "스왑
  // 대상이 되면 즉시 발동, 스왑 상대가 일반 타일이어도"). specialGrid를 넘기지
  // 않으면 기존 동작(특수 타일 개념 없음)을 그대로 유지한다 - 기존 테스트 무수정 보장.
  function tryApplySwap(grid, a, b, specialGrid) {
    if (!isAdjacent(a, b)) {
      return { valid: false, grid: grid };
    }

    var swapped = swapCells(grid, a, b);
    var matchResult = findMatches(swapped);

    var aIsSpecial = Boolean(specialGrid && specialGrid[a.row][a.col]);
    var bIsSpecial = Boolean(specialGrid && specialGrid[b.row][b.col]);
    var triggersSpecial = aIsSpecial || bIsSpecial;

    if (matchResult.groups.length === 0 && !triggersSpecial) {
      return { valid: false, grid: grid };
    }

    var result = { valid: true, grid: swapped, swapCells: [[a.row, a.col], [b.row, b.col]] };
    if (specialGrid) {
      result.specialGrid = swapCells(specialGrid, a, b);
      result.triggeredSwapSpecials = triggersSpecial;
    }
    return result;
  }

  function scoreForGroup(group) {
    var size = group.cells.length;
    if (size >= 5) {
      return SCORE_FIVE_PLUS;
    }
    return SCORE_BY_MATCH_SIZE[size] || SCORE_BY_MATCH_SIZE[3];
  }

  // removeMatchesAndCollapse(grid, rng, options?)
  // options: { specialGrid, swapCells, triggeredSwapSpecials } - 전부 생략하면
  // 기존 동작(특수 타일 없음)과 완전히 같다(기존 테스트 무수정 보장).
  //
  // 특수 타일이 있는 경우의 처리 순서(계획서 1.1~1.3, 결정적 - RNG 미소비):
  // 1) 이번 스왑이 특수 타일 자체를 움직였다면(트리거) 그 칸도 제거 집합에 포함한다.
  // 2) 일반 매치 그룹을 찾고, 4개 이상인 그룹마다 생성될 특수 타일을 결정한다
  //    (planSpecialForGroup - 스왑 유발이면 스왑 셀, 캐스케이드 유발이면 최좌상단/교차점).
  // 3) 제거 대상 셀 중 이미 특수 타일이 있는 칸(체인)을 좌상단부터 행 우선으로
  //    순서대로 발동시켜, 발동 범위를 제거 집합에 계속 합친다(체인 순서 결정적).
  // 4) 컬러 타일은 스왑 상대의 종류(스왑 트리거) 또는 보드에서 가장 흔한 종류
  //    (캐스케이드 트리거)를 제거 대상에 추가한다.
  // 5) 새로 생성되는 특수 타일의 스폰 셀은 제거하지 않고 specialGrid에 심는다
  //    (단, 그 칸 자체가 체인 발동으로 이미 제거됐다면 생성 시도는 무효 - 실제로는
  //    스폰 셀이 자기 그룹 안이라 거의 발생하지 않는다).
  function removeMatchesAndCollapse(grid, rng, options) {
    options = options || {};
    var specialGrid = options.specialGrid || null;
    var swapCellsList = options.swapCells || null;
    var triggeredSwapSpecials = Boolean(options.triggeredSwapSpecials);

    var next = cloneGrid(grid);
    var nextSpecial = specialGrid ? cloneSpecialGrid(specialGrid) : null;
    var matchResult = findMatches(next);

    if (matchResult.groups.length === 0 && !triggeredSwapSpecials) {
      return {
        grid: next,
        specialGrid: nextSpecial,
        cleared: 0,
        score: 0,
        groups: [],
        activations: [],
      };
    }

    var baseScore = 0;
    var clearedCount = 0;
    var activations = [];
    // 제거 대상 셀을 'row,col' 키 집합으로 관리해 중복 제거를 막는다.
    var toClear = {};
    function markClear(r, c) {
      toClear[r + ',' + c] = true;
    }

    matchResult.groups.forEach(function (group) {
      baseScore += scoreForGroup(group);
      clearedCount += group.cells.length;
      group.cells.forEach(function (cell) {
        markClear(cell[0], cell[1]);
      });
    });

    // 스왑 자체가 특수 타일을 움직여 발동시킨 경우(일반 매치 유무와 무관) 그 두
    // 칸도 발동 대기열에 넣는다.
    var pendingActivationCells = [];
    if (specialGrid && triggeredSwapSpecials && swapCellsList) {
      swapCellsList.forEach(function (cell) {
        if (specialGrid[cell[0]][cell[1]]) {
          pendingActivationCells.push(cell);
        }
      });
    }

    // 특수 타일 생성 계획: 아직 그리드에 반영하지 않고, 나중에 "생성 셀이 제거되지
    // 않았다면" 심는다. swapCells 있으면 스왑 유발, 없으면 캐스케이드 유발로 본다.
    var spawnPlans = [];
    if (specialGrid) {
      matchResult.groups.forEach(function (group) {
        var plan = planSpecialForGroup(group, swapCellsList);
        if (plan) {
          spawnPlans.push(plan);
        }
      });
    }

    // 체인 발동: toClear에 포함된 기존 특수 타일들을 좌상단부터 행 우선으로
    // 처리한다(계획서 1.2 "처리 순서: 좌상단부터 행 우선 - 결정적"). 발동으로
    // 제거 범위가 늘어나면 그 범위에 포함된 다른 특수 타일도 이어서 처리한다.
    if (specialGrid) {
      var processedActivation = {};
      function collectPendingFromClearSet() {
        var found = [];
        for (var r = 0; r < BOARD_SIZE; r += 1) {
          for (var c = 0; c < BOARD_SIZE; c += 1) {
            var key = r + ',' + c;
            if (toClear[key] && specialGrid[r][c] && !processedActivation[key]) {
              found.push([r, c]);
            }
          }
        }
        return found;
      }

      var queue = pendingActivationCells.slice();
      var guard = 0;
      while (queue.length > 0 || true) {
        if (queue.length === 0) {
          queue = collectPendingFromClearSet();
          if (queue.length === 0) {
            break;
          }
        }
        guard += 1;
        if (guard > BOARD_SIZE * BOARD_SIZE * 2) {
          break; // 안전장치 - 이론상 도달하지 않음.
        }

        var cell = queue.shift();
        var key = cell[0] + ',' + cell[1];
        if (processedActivation[key]) {
          continue;
        }
        var kind = specialGrid[cell[0]][cell[1]];
        if (!kind) {
          continue;
        }
        processedActivation[key] = true;

        var activationCells;
        if (kind === SPECIAL_KIND.COLOR) {
          var targetType;
          if (swapCellsList && swapCellsList.some(function (sc) { return sc[0] === cell[0] && sc[1] === cell[1]; })) {
            // 스왑으로 발동된 컬러 타일: 스왑 상대의 간식 종류를 제거(계획서 1.2).
            var otherCell = swapCellsList[0][0] === cell[0] && swapCellsList[0][1] === cell[1]
              ? swapCellsList[1] : swapCellsList[0];
            targetType = grid[otherCell[0]][otherCell[1]];
          } else {
            // 캐스케이드로 소모: 보드에서 가장 많은 간식 종류(동수면 id 순).
            targetType = findMostCommonType(next);
          }
          activationCells = [];
          for (var rr = 0; rr < BOARD_SIZE; rr += 1) {
            for (var cc = 0; cc < BOARD_SIZE; cc += 1) {
              if (next[rr][cc] === targetType) {
                activationCells.push([rr, cc]);
              }
            }
          }
          activations.push({ kind: kind, cell: cell, targetType: targetType, cellCount: activationCells.length });
        } else {
          activationCells = computeActivationCells(kind, cell[0], cell[1], next);
          activations.push({ kind: kind, cell: cell, cellCount: activationCells.length });
        }

        activationCells.forEach(function (ac) {
          markClear(ac[0], ac[1]);
        });
        baseScore += SPECIAL_ACTIVATION_BONUS[kind] || 0;

        // 이번 발동으로 새로 포함된 특수 타일을 대기열에 추가(체인).
        activationCells.forEach(function (ac) {
          var acKey = ac[0] + ',' + ac[1];
          if (specialGrid[ac[0]][ac[1]] && !processedActivation[acKey]) {
            queue.push(ac);
          }
        });
      }
    }

    // 최종 제거 집합을 적용: 그리드/스페셜그리드에서 지운다.
    Object.keys(toClear).forEach(function (key) {
      var parts = key.split(',');
      var r = Number(parts[0]);
      var c = Number(parts[1]);
      next[r][c] = null;
      if (nextSpecial) {
        nextSpecial[r][c] = null;
      }
    });
    clearedCount = Object.keys(toClear).length;

    // 생성 계획 적용: 스폰 셀이 이번에 제거되지 않았다면(거의 항상 자기 그룹
    // 안이라 제거되지만, 방어적으로) 심는다. 스폰 셀이 제거됐다면 그 자리에는
    // 그리드 리필이 새 일반 타일을 채우므로 생성은 조용히 무산된다.
    if (nextSpecial) {
      spawnPlans.forEach(function (plan) {
        var key = plan.cell[0] + ',' + plan.cell[1];
        if (!toClear[key]) {
          return;
        }
        next[plan.cell[0]][plan.cell[1]] = plan.type;
        nextSpecial[plan.cell[0]][plan.cell[1]] = plan.kind;
      });
    }

    applyGravityAndRefill(next, rng, nextSpecial);

    return {
      grid: next,
      specialGrid: nextSpecial,
      cleared: clearedCount,
      score: baseScore,
      groups: matchResult.groups,
      activations: activations,
    };
  }

  // applyGravityAndRefill(grid, rng, specialGrid?) - specialGrid를 넘기면 grid와
  // 같은 낙하 순서로 함께 떨어뜨린다(각 칸의 특수 여부가 타일을 그대로 따라간다).
  // 새로 채워지는 칸(리필)은 항상 특수 없음 - 리필 자체는 계획서 1.1대로 기존
  // RNG 경로만 사용하고 특수 타일을 만들지 않는다.
  function applyGravityAndRefill(grid, rng, specialGrid) {
    for (var col = 0; col < BOARD_SIZE; col += 1) {
      var stack = [];
      var specialStack = [];
      for (var row = BOARD_SIZE - 1; row >= 0; row -= 1) {
        if (grid[row][col] !== null) {
          stack.push(grid[row][col]);
          specialStack.push(specialGrid ? specialGrid[row][col] : null);
        }
      }

      var writeRow = BOARD_SIZE - 1;
      for (var i = 0; i < stack.length; i += 1) {
        grid[writeRow][col] = stack[i];
        if (specialGrid) {
          specialGrid[writeRow][col] = specialStack[i];
        }
        writeRow -= 1;
      }

      while (writeRow >= 0) {
        grid[writeRow][col] = randomTileType(rng);
        if (specialGrid) {
          specialGrid[writeRow][col] = null;
        }
        writeRow -= 1;
      }
    }

    return grid;
  }

  var MAX_CASCADE_STEPS = 40;

  // resolveCascades(grid, rng, options?)
  // options: { specialGrid, swapCells, triggeredSwapSpecials } - 첫 스텝에만 스왑
  // 컨텍스트를 적용한다(2번째 스텝부터는 캐스케이드 유발이므로 스왑 셀 없음).
  // options를 생략하면 기존 동작과 완전히 같다.
  function resolveCascades(grid, rng, options) {
    options = options || {};
    var currentGrid = cloneGrid(grid);
    var currentSpecial = options.specialGrid ? cloneSpecialGrid(options.specialGrid) : null;
    var totalScore = 0;
    var totalCleared = 0;
    var cascadeCount = 0;
    var multiplier = 1;
    var steps = [];
    var allActivations = [];

    var swapCellsForStep = options.swapCells || null;
    var triggeredSwapSpecials = Boolean(options.triggeredSwapSpecials);

    while (cascadeCount < MAX_CASCADE_STEPS) {
      var matchResult = findMatches(currentGrid);
      var hasSwapTrigger = cascadeCount === 0 && triggeredSwapSpecials;
      if (matchResult.groups.length === 0 && !hasSwapTrigger) {
        break;
      }

      var stepOptions = {
        specialGrid: currentSpecial,
        swapCells: cascadeCount === 0 ? swapCellsForStep : null,
        triggeredSwapSpecials: hasSwapTrigger,
      };
      var stepResult = removeMatchesAndCollapse(currentGrid, rng, stepOptions);
      var stepScore = stepResult.score * multiplier;

      totalScore += stepScore;
      totalCleared += stepResult.cleared;
      cascadeCount += 1;
      steps.push({
        cleared: stepResult.cleared,
        baseScore: stepResult.score,
        multiplier: multiplier,
        score: stepScore,
        groups: stepResult.groups,
        activations: stepResult.activations,
      });
      allActivations = allActivations.concat(stepResult.activations || []);

      currentGrid = stepResult.grid;
      currentSpecial = stepResult.specialGrid;
      multiplier += 1;
    }

    return {
      grid: currentGrid,
      specialGrid: currentSpecial,
      score: totalScore,
      cleared: totalCleared,
      cascadeCount: cascadeCount,
      maxMultiplier: Math.max(1, multiplier - 1),
      steps: steps,
      activations: allActivations,
    };
  }

  function hasAvailableMove(grid) {
    for (var row = 0; row < BOARD_SIZE; row += 1) {
      for (var col = 0; col < BOARD_SIZE; col += 1) {
        if (col + 1 < BOARD_SIZE) {
          var right = tryApplySwap(grid, { row: row, col: col }, { row: row, col: col + 1 });
          if (right.valid) {
            return true;
          }
        }
        if (row + 1 < BOARD_SIZE) {
          var down = tryApplySwap(grid, { row: row, col: col }, { row: row + 1, col: col });
          if (down.valid) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function shuffleBoard(grid, rng) {
    var attempts = 0;
    var next;

    do {
      var flat = [];
      grid.forEach(function (row) {
        row.forEach(function (tile) {
          flat.push(tile);
        });
      });

      for (var i = flat.length - 1; i > 0; i -= 1) {
        var j = Math.floor(rng() * (i + 1));
        if (j > i) j = i;
        var temp = flat[i];
        flat[i] = flat[j];
        flat[j] = temp;
      }

      next = [];
      var cursor = 0;
      for (var row2 = 0; row2 < BOARD_SIZE; row2 += 1) {
        var rowValues = [];
        for (var col2 = 0; col2 < BOARD_SIZE; col2 += 1) {
          rowValues.push(flat[cursor]);
          cursor += 1;
        }
        next.push(rowValues);
      }

      attempts += 1;
    } while ((hasAnyMatch(next) || !hasAvailableMove(next)) && attempts < 200);

    if (hasAnyMatch(next) || !hasAvailableMove(next)) {
      // Extremely unlikely fallback: regenerate from scratch deterministically.
      return generateBoard(Math.floor(rng() * 1000000)).grid;
    }

    return next;
  }

  var Match3Board = {
    BOARD_SIZE: BOARD_SIZE,
    TILE_TYPES: TILE_TYPES,
    MAX_MOVES: MAX_MOVES,
    createRng: createRng,
    generateBoard: generateBoard,
    createInitialBoard: generateBoard,
    findMatches: findMatches,
    hasAnyMatch: hasAnyMatch,
    isAdjacent: isAdjacent,
    tryApplySwap: tryApplySwap,
    removeMatchesAndCollapse: removeMatchesAndCollapse,
    applyGravityAndRefill: applyGravityAndRefill,
    resolveCascades: resolveCascades,
    hasAvailableMove: hasAvailableMove,
    shuffleBoard: shuffleBoard,
    scoreForGroup: scoreForGroup,
    cloneGrid: cloneGrid,
    SPECIAL_KIND: SPECIAL_KIND,
    SPECIAL_ACTIVATION_BONUS: SPECIAL_ACTIVATION_BONUS,
    createEmptySpecialGrid: createEmptySpecialGrid,
    cloneSpecialGrid: cloneSpecialGrid,
    classifyGroupShape: classifyGroupShape,
    findIntersectionCell: findIntersectionCell,
    planSpecialForGroup: planSpecialForGroup,
    computeActivationCells: computeActivationCells,
    findMostCommonType: findMostCommonType,
  };

  root.Match3Board = Match3Board;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Match3Board;
  }
})(typeof window !== 'undefined' ? window : this);

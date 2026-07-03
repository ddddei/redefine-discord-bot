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

    return { grid: grid, rng: rng };
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

  function tryApplySwap(grid, a, b) {
    if (!isAdjacent(a, b)) {
      return { valid: false, grid: grid };
    }

    var swapped = swapCells(grid, a, b);
    var matchResult = findMatches(swapped);

    if (matchResult.groups.length === 0) {
      return { valid: false, grid: grid };
    }

    return { valid: true, grid: swapped };
  }

  function scoreForGroup(group) {
    var size = group.cells.length;
    if (size >= 5) {
      return SCORE_FIVE_PLUS;
    }
    return SCORE_BY_MATCH_SIZE[size] || SCORE_BY_MATCH_SIZE[3];
  }

  function removeMatchesAndCollapse(grid, rng) {
    var next = cloneGrid(grid);
    var matchResult = findMatches(next);

    if (matchResult.groups.length === 0) {
      return {
        grid: next,
        cleared: 0,
        score: 0,
        groups: [],
      };
    }

    var baseScore = 0;
    var clearedCount = 0;
    matchResult.groups.forEach(function (group) {
      baseScore += scoreForGroup(group);
      clearedCount += group.cells.length;
      group.cells.forEach(function (cell) {
        next[cell[0]][cell[1]] = null;
      });
    });

    applyGravityAndRefill(next, rng);

    return {
      grid: next,
      cleared: clearedCount,
      score: baseScore,
      groups: matchResult.groups,
    };
  }

  function applyGravityAndRefill(grid, rng) {
    for (var col = 0; col < BOARD_SIZE; col += 1) {
      var stack = [];
      for (var row = BOARD_SIZE - 1; row >= 0; row -= 1) {
        if (grid[row][col] !== null) {
          stack.push(grid[row][col]);
        }
      }

      var writeRow = BOARD_SIZE - 1;
      for (var i = 0; i < stack.length; i += 1) {
        grid[writeRow][col] = stack[i];
        writeRow -= 1;
      }

      while (writeRow >= 0) {
        grid[writeRow][col] = randomTileType(rng);
        writeRow -= 1;
      }
    }

    return grid;
  }

  var MAX_CASCADE_STEPS = 40;

  function resolveCascades(grid, rng) {
    var currentGrid = cloneGrid(grid);
    var totalScore = 0;
    var totalCleared = 0;
    var cascadeCount = 0;
    var multiplier = 1;
    var steps = [];

    while (cascadeCount < MAX_CASCADE_STEPS) {
      var matchResult = findMatches(currentGrid);
      if (matchResult.groups.length === 0) {
        break;
      }

      var stepResult = removeMatchesAndCollapse(currentGrid, rng);
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
      });

      currentGrid = stepResult.grid;
      multiplier += 1;
    }

    return {
      grid: currentGrid,
      score: totalScore,
      cleared: totalCleared,
      cascadeCount: cascadeCount,
      maxMultiplier: Math.max(1, multiplier - 1),
      steps: steps,
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
  };

  root.Match3Board = Match3Board;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Match3Board;
  }
})(typeof window !== 'undefined' ? window : this);

(function (root) {
  'use strict';

  // 순수 로직 모듈. DOM, localStorage, Date.now(), Math.random()을 직접 참조하지 않는다.
  // 난수가 필요한 모든 함수는 rng 함수(또는 rng를 감싼 tracker)를 인자로 받는다.

  var Content = (typeof root !== 'undefined' && root.DeckContent)
    || (typeof require === 'function' ? require('./content') : null);

  // ---- 시드 RNG (match3 board.js와 동일한 LCG 패턴) ----

  function createRng(seed) {
    var state = (typeof seed === 'number' && Number.isFinite(seed))
      ? Math.floor(seed) % 2147483647
      : 1;

    if (state <= 0) {
      state += 2147483646;
    }

    return function next() {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }

  // 저장/복원 후에도 이후 셔플이 동일하도록, 호출 횟수를 세는 RNG 래퍼를 만든다.
  // tracker.rng()를 호출할 때마다 tracker.callCount가 증가한다.
  function createRngTracker(seed, callCount) {
    var rng = createRng(seed);
    var count = 0;
    var skip = typeof callCount === 'number' && callCount > 0 ? callCount : 0;
    for (var i = 0; i < skip; i += 1) {
      rng();
      count += 1;
    }
    return {
      seed: seed,
      next: function () {
        count += 1;
        return rng();
      },
      getCallCount: function () {
        return count;
      },
    };
  }

  function randomInt(tracker, maxExclusive) {
    var index = Math.floor(tracker.next() * maxExclusive);
    if (index >= maxExclusive) {
      index = maxExclusive - 1;
    }
    if (index < 0) {
      index = 0;
    }
    return index;
  }

  // Fisher-Yates 셔플. 원본 배열은 변경하지 않는다.
  function shuffle(tracker, list) {
    var result = list.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var j = randomInt(tracker, i + 1);
      var temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  function pickN(tracker, list, n) {
    var shuffled = shuffle(tracker, list);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  // ---- 콘텐츠 조회 ----

  function findCard(id) {
    for (var i = 0; i < Content.CARDS.length; i += 1) {
      if (Content.CARDS[i].id === id) {
        return Content.CARDS[i];
      }
    }
    return null;
  }

  function findEnemy(id) {
    for (var i = 0; i < Content.ENEMIES.length; i += 1) {
      if (Content.ENEMIES[i].id === id) {
        return Content.ENEMIES[i];
      }
    }
    return null;
  }

  function cardsByRarity(rarity) {
    return Content.CARDS.filter(function (card) {
      return card.rarity === rarity;
    });
  }

  function enemiesByTier(tier) {
    return Content.ENEMIES.filter(function (enemy) {
      return enemy.tier === tier;
    });
  }

  // ---- 갈림길 맵 생성 (13층, 시드 결정적 — docs/deck-improvement-plan.md 3.1) ----
  //
  // 전용 RNG 소비 규칙: 맵 생성은 createNewRun에서 "1회만" 일어나고, 이후 전투/보상/
  // 이벤트 진행 중에는 맵을 다시 생성하거나 트래커를 되감지 않는다. 소비하는 tracker.next()
  // 호출 횟수는 같은 시드에 대해서는 항상 동일하다(같은 시드 = 같은 rngCallCount 진행 —
  // 엔진의 기존 계약과 동일). 서로 다른 시드 사이에서는 층별 노드 수(1~3, 아래 1항)에
  // 따라 셔플 대상 슬롯 수가 달라지므로 호출 횟수 자체는 소폭(약 34~38회) 달라질 수
  // 있지만, 상한을 두어(아래 각 단계) 무한 반복이나 거부 샘플링(rejection loop)은
  // 전혀 쓰지 않는다 — 모든 단계가 입력 크기에 비례하는 고정된 횟수만 소비하므로
  // "몇 번 호출할지 미리 정해진 상한 안에서만 움직인다"는 재현성 요구를 만족한다.
  //
  // 1) 층별 노드 수(층 2~12, 11개 층): 층마다 정확히 1회 randomInt 호출 → 11회 고정.
  //    분포를 정규분포에 가깝게 만들어(1개 70%, 2개 20%, 3개 10%) 대부분 좁은 갈림길이
  //    나오게 하고, 총합이 계획서 분포 제약(일반 노드 상한 7)을 넘으면 RNG를 더 쓰지
  //    않고 결정적으로(뒤쪽 층부터 순환) 초과분을 깎는다(추가 RNG 호출 없음).
  // 2) 노드 타입 배정: 내부 슬롯(층 2~12 전체) 목록을 만들어 셔플 1회(Fisher-Yates는
  //    슬롯 수 n에 대해 항상 "n-1"회의 호출만 쓴다 — 슬롯 구성이 1항에서 이미 정해진
  //    값이므로 이 단계의 호출 수도 결정적이다) → 앞에서부터 정예 2·휴식 2·이벤트
  //    2~3(이벤트 수는 슬롯 총수의 홀짝에서 결정적으로 파생, 추가 RNG 없음)을 배정하고
  //    나머지는 전부 일반으로 채운다. 정예 분포(7층 이하 1·이상 1)와 휴식 연속 금지는
  //    배정 후 결정적 보정(스왑, RNG 미사용)으로 강제한다.
  // 3) 층간 연결: 인접 열로만, 각 노드가 최소 1개 이상의 상행 연결을 갖도록 결정적으로
  //    배선한다(RNG 미사용 - 배선 알고리즘 자체가 결정적이므로 시드 재현에는 영향 없음).
  var MAP_INTERIOR_FLOOR_COUNT = Content.MAP_FLOOR_COUNT - 2; // 층 2~12
  var ELITE_NODE_COUNT = 2;
  var REST_NODE_COUNT = 2;
  var EVENT_NODE_COUNT_MIN = 2;
  var EVENT_NODE_COUNT_MAX = 3;

  function rollFloorNodeCounts(tracker) {
    var counts = [];
    for (var i = 0; i < MAP_INTERIOR_FLOOR_COUNT; i += 1) {
      var roll = randomInt(tracker, 10); // 고정 1회
      var count;
      if (roll < 7) {
        count = 1;
      } else if (roll < 9) {
        count = 2;
      } else {
        count = 3;
      }
      counts.push(count);
    }

    // 결정적 보정(RNG 미사용): 인터리어 총합이 상한을 넘으면 뒤쪽 층부터 1씩 줄여
    // 되돌린다. 각 층은 최소 1개를 유지한다. 상한은 13 - 정예(2)·휴식(2) 고정분과
    // 이벤트(2~3, deriveEventCount가 총합 홀짝으로 결정)를 뺀 나머지가 일반 노드가
    // 되므로, 13으로 잡으면 이벤트가 2든 3이든 일반이 계획서 상한(7)을 넘지 않는다
    // (13 - 2 - 2 - 2 = 7, 13 - 2 - 2 - 3 = 6).
    var maxTotal = 13;
    var total = counts.reduce(function (sum, c) { return sum + c; }, 0);
    var guard = 0;
    while (total > maxTotal && guard < counts.length * 3) {
      var cursor = guard % counts.length;
      if (counts[cursor] > 1) {
        counts[cursor] -= 1;
        total -= 1;
      }
      guard += 1;
    }

    return counts;
  }

  // 이벤트 노드 수(2~3)를 셔플 결과와 무관한 별도 RNG 호출 없이, 인터리어 슬롯 총수의
  // 홀짝으로 결정적으로 파생한다(추가 RNG 소비 없이 2~3 범위를 안정적으로 얻기 위함).
  function deriveEventCount(totalInteriorSlots) {
    return (totalInteriorSlots % 2 === 0) ? EVENT_NODE_COUNT_MIN : EVENT_NODE_COUNT_MAX;
  }

  function buildMap(tracker) {
    var floorNodeCounts = rollFloorNodeCounts(tracker);
    var totalInteriorSlots = floorNodeCounts.reduce(function (sum, c) { return sum + c; }, 0);

    // 슬롯 목록: { floor(1-indexed, 2~12), idx(열 인덱스, 0-based) }
    var slots = [];
    floorNodeCounts.forEach(function (count, floorOffset) {
      var floor = floorOffset + 2; // 층 2부터 시작
      for (var idx = 0; idx < count; idx += 1) {
        slots.push({ floor: floor, idx: idx });
      }
    });

    // 고정 호출 셔플(슬롯 수 - 1회) - 앞에서부터 순서대로 특수 타입을 배정한다.
    var shuffledSlots = shuffle(tracker, slots);

    var eventCount = deriveEventCount(totalInteriorSlots);
    var typeBySlotKey = {};
    function slotKey(slot) {
      return slot.floor + ':' + slot.idx;
    }

    var cursor = 0;
    for (var e = 0; e < ELITE_NODE_COUNT && cursor < shuffledSlots.length; e += 1, cursor += 1) {
      typeBySlotKey[slotKey(shuffledSlots[cursor])] = Content.NODE_TYPES.ELITE;
    }
    for (var r = 0; r < REST_NODE_COUNT && cursor < shuffledSlots.length; r += 1, cursor += 1) {
      typeBySlotKey[slotKey(shuffledSlots[cursor])] = Content.NODE_TYPES.REST;
    }
    for (var ev = 0; ev < eventCount && cursor < shuffledSlots.length; ev += 1, cursor += 1) {
      typeBySlotKey[slotKey(shuffledSlots[cursor])] = Content.NODE_TYPES.EVENT;
    }
    // 나머지는 전부 일반 전투.
    slots.forEach(function (slot) {
      var key = slotKey(slot);
      if (!typeBySlotKey[key]) {
        typeBySlotKey[key] = Content.NODE_TYPES.NORMAL;
      }
    });

    // 층 목록 구성(1층: 일반 고정, 13층: 보스 고정).
    var floors = [];
    floors.push([{ id: 'f1-0', floor: 1, idx: 0, type: Content.NODE_TYPES.NORMAL }]);
    floorNodeCounts.forEach(function (count, floorOffset) {
      var floor = floorOffset + 2;
      var floorNodes = [];
      for (var idx = 0; idx < count; idx += 1) {
        floorNodes.push({
          id: 'f' + floor + '-' + idx,
          floor: floor,
          idx: idx,
          type: typeBySlotKey[floor + ':' + idx],
        });
      }
      floors.push(floorNodes);
    });
    floors.push([{ id: 'f' + Content.MAP_FLOOR_COUNT + '-0', floor: Content.MAP_FLOOR_COUNT, idx: 0, type: Content.NODE_TYPES.BOSS }]);

    // ---- 결정적 보정(RNG 미사용) ----
    // (a) 정예 분포: 7층 이하에 1개 이상, 8층 이상에 1개 이상. 전부 한쪽에 몰리면
    // 가장 먼 정예를 반대쪽 최근접 일반 노드와 타입을 맞바꾼다(위치는 그대로, 타입만 교환).
    enforceEliteSpread(floors);
    // (b) 휴식 연속 금지: 같은 층 또는 바로 다음 층에 휴식이 겹치면 뒤쪽 휴식을 일반과 교환.
    enforceRestNoAdjacent(floors);

    // ---- 층간 연결 (인접 열로만, RNG 미사용) ----
    var edges = buildMapEdges(floors);

    return { floors: floors, edges: edges };
  }

  function findAllNodesFlat(floors) {
    var flat = [];
    floors.forEach(function (floorNodes) {
      floorNodes.forEach(function (node) {
        flat.push(node);
      });
    });
    return flat;
  }

  function enforceEliteSpread(floors) {
    var eliteNodes = [];
    floors.forEach(function (floorNodes) {
      floorNodes.forEach(function (node) {
        if (node.type === Content.NODE_TYPES.ELITE) {
          eliteNodes.push(node);
        }
      });
    });
    var hasLow = eliteNodes.some(function (n) { return n.floor <= 7; });
    var hasHigh = eliteNodes.some(function (n) { return n.floor > 7; });
    if (hasLow && hasHigh) {
      return;
    }
    // 둘 중 하나가 없다: 반대편에서 가장 가까운 일반 노드를 찾아 타입을 맞바꾼다.
    // 1층(항상 일반 전투 고정)과 13층(항상 보스 고정)은 교환 대상에서 제외한다.
    var needLow = !hasLow;
    var swapTargetFloorPredicate = needLow
      ? function (f) { return f > 1 && f <= 7; }
      : function (f) { return f > 7 && f < Content.MAP_FLOOR_COUNT; };
    var candidateNormal = null;
    floors.forEach(function (floorNodes) {
      floorNodes.forEach(function (node) {
        if (node.type === Content.NODE_TYPES.NORMAL && swapTargetFloorPredicate(node.floor)) {
          if (!candidateNormal || node.floor < candidateNormal.floor) {
            candidateNormal = node;
          }
        }
      });
    });
    if (candidateNormal && eliteNodes.length > 0) {
      var swapSource = eliteNodes[eliteNodes.length - 1];
      var tempType = swapSource.type;
      swapSource.type = candidateNormal.type;
      candidateNormal.type = tempType;
    }
  }

  function enforceRestNoAdjacent(floors) {
    var restNodes = [];
    floors.forEach(function (floorNodes) {
      floorNodes.forEach(function (node) {
        if (node.type === Content.NODE_TYPES.REST) {
          restNodes.push(node);
        }
      });
    });
    restNodes.sort(function (a, b) { return a.floor - b.floor; });

    // 다른 모든 휴식 노드로부터 층 거리 2 이상 떨어진 일반 노드를 찾는다(현재 검토 중인
    // 휴식 노드 자신은 거리 계산에서 제외한다). 뒤쪽 층부터(먼 곳)/앞쪽 층부터(가까운
    // 곳) 양방향으로 후보를 찾아 더 가까운 쪽을 택한다 - 13층처럼 뒤쪽에 여유가 없는
    // 경우에도 앞쪽에서 교환 대상을 찾을 수 있게 한다.
    for (var i = 1; i < restNodes.length; i += 1) {
      if (restNodes[i].floor - restNodes[i - 1].floor > 1) {
        continue;
      }
      var others = restNodes.filter(function (n) { return n !== restNodes[i]; });
      var candidate = null;
      var bestDistance = Infinity;
      floors.forEach(function (floorNodes) {
        floorNodes.forEach(function (node) {
          // 1층(항상 일반 전투 고정)은 교환 대상에서 제외한다.
          if (node.type !== Content.NODE_TYPES.NORMAL || node.floor === 1) {
            return;
          }
          var tooClose = others.some(function (rest) {
            return Math.abs(rest.floor - node.floor) <= 1;
          });
          if (tooClose) {
            return;
          }
          var distance = Math.abs(node.floor - restNodes[i].floor);
          if (distance < bestDistance) {
            bestDistance = distance;
            candidate = node;
          }
        });
      });
      if (candidate) {
        var tempType = restNodes[i].type;
        restNodes[i].type = candidate.type;
        candidate.type = tempType;
      }
    }
  }

  // 인접 열로만 연결한다: 현재 층 노드 idx를 다음 층 노드 수 비율로 사상해 가까운
  // 열 1~2개와 연결한다(각 노드가 상행 경로를 최소 1개 갖도록 보장). RNG를 쓰지 않는
  // 순수 결정적 배선이라 시드 재현에는 영향이 없다.
  function buildMapEdges(floors) {
    var edges = [];
    for (var f = 0; f < floors.length - 1; f += 1) {
      var current = floors[f];
      var next = floors[f + 1];
      var connectedNext = {};

      current.forEach(function (fromNode, fromIdx) {
        var ratio = current.length <= 1 ? 0 : fromIdx / (current.length - 1);
        var targetIdx = Math.min(next.length - 1, Math.round(ratio * (next.length - 1)));
        edges.push({ from: fromNode.id, to: next[targetIdx].id });
        connectedNext[targetIdx] = true;
        // 폭이 늘어나는 구간에서는 인접 열도 함께 이어 갈림길을 만든다.
        if (next.length > current.length) {
          var altIdx = targetIdx + 1 < next.length ? targetIdx + 1 : targetIdx - 1;
          if (altIdx >= 0 && altIdx < next.length && altIdx !== targetIdx) {
            edges.push({ from: fromNode.id, to: next[altIdx].id });
            connectedNext[altIdx] = true;
          }
        }
      });

      // 다음 층에서 아무 연결도 받지 못한 노드가 있으면 가장 가까운 현재 층 노드와 잇는다.
      next.forEach(function (toNode, toIdx) {
        if (connectedNext[toIdx]) {
          return;
        }
        var ratio = next.length <= 1 ? 0 : toIdx / (next.length - 1);
        var sourceIdx = Math.min(current.length - 1, Math.round(ratio * (current.length - 1)));
        edges.push({ from: current[sourceIdx].id, to: toNode.id });
      });
    }
    return edges;
  }

  function findNodeById(map, nodeId) {
    for (var f = 0; f < map.floors.length; f += 1) {
      for (var i = 0; i < map.floors[f].length; i += 1) {
        if (map.floors[f][i].id === nodeId) {
          return map.floors[f][i];
        }
      }
    }
    return null;
  }

  function getAvailableNextNodes(map, currentNodeId) {
    if (currentNodeId === null || currentNodeId === undefined) {
      return [map.floors[0][0]];
    }
    var options = [];
    map.edges.forEach(function (edge) {
      if (edge.from === currentNodeId) {
        var node = findNodeById(map, edge.to);
        if (node) {
          options.push(node);
        }
      }
    });
    return options;
  }

  // ---- 적 배정 (전투 노드에 일반/정예 적을 시드 셔플로 배정) ----

  function buildEnemyAssignment(tracker, map) {
    var normalIds = enemiesByTier('normal').map(function (e) { return e.id; });
    var eliteIds = enemiesByTier('elite').map(function (e) { return e.id; });
    var bossId = enemiesByTier('boss')[0].id;

    var allNodes = findAllNodesFlat(map.floors);
    var normalCount = allNodes.filter(function (n) { return n.type === Content.NODE_TYPES.NORMAL; }).length;
    var eliteCount = allNodes.filter(function (n) { return n.type === Content.NODE_TYPES.ELITE; }).length;

    var shuffledNormal = shuffle(tracker, normalIds);
    var shuffledElite = shuffle(tracker, eliteIds);

    var normalCursor = 0;
    var eliteCursor = 0;
    var assignment = {};

    allNodes.forEach(function (node) {
      if (node.type === Content.NODE_TYPES.NORMAL) {
        assignment[node.id] = shuffledNormal[normalCursor % shuffledNormal.length];
        normalCursor += 1;
      } else if (node.type === Content.NODE_TYPES.ELITE) {
        assignment[node.id] = shuffledElite[eliteCursor % shuffledElite.length];
        eliteCursor += 1;
      } else if (node.type === Content.NODE_TYPES.BOSS) {
        assignment[node.id] = bossId;
      }
    });

    return assignment;
  }

  // ---- 이벤트 배정 (이벤트 노드에 이벤트를 시드 셔플로 배정) ----

  function buildEventAssignment(tracker, map) {
    var allNodes = findAllNodesFlat(map.floors);
    var eventNodes = allNodes.filter(function (n) { return n.type === Content.NODE_TYPES.EVENT; });
    var shuffledEventIds = shuffle(tracker, Content.EVENT_IDS);

    var assignment = {};
    eventNodes.forEach(function (node, index) {
      assignment[node.id] = shuffledEventIds[index % shuffledEventIds.length];
    });
    return assignment;
  }

  // ---- 새 런 상태 ----

  // deckPresetId: 오늘의 도전 요일 프리셋(docs/deck-improvement-plan.md 5절). 미지정 시
  // 기본 시작 덱. 'free'는 서버가 자유 선택으로 내려준 경우로, 기본 덱과 동일하게 취급한다
  // (선택 UI 자체는 game.js가 처리 — 엔진은 이미 정해진 preset id만 받는다).
  function buildStarterDeck(deckPresetId) {
    var override = deckPresetId && Content.DECK_PRESET_STARTER_OVERRIDES
      ? Content.DECK_PRESET_STARTER_OVERRIDES[deckPresetId]
      : null;
    var entries = override || Content.STARTER_DECK;
    var deck = [];
    entries.forEach(function (entry) {
      for (var i = 0; i < entry.count; i += 1) {
        deck.push(entry.id);
      }
    });
    return deck;
  }

  // previousStats: 이전 런의 stats. 통산 기록(클리어 횟수·최고 도달 칸)은 새 런에도
  // 이어지고, 처치 수는 런 단위로 초기화한다. deckPresetId: 오늘의 도전 요일 프리셋.
  function createNewRun(seed, previousStats, deckPresetId) {
    var tracker = createRngTracker(seed, 0);
    var map = buildMap(tracker);
    var enemyAssignment = buildEnemyAssignment(tracker, map);
    var eventAssignment = buildEventAssignment(tracker, map);

    return {
      version: Content.SAVE_VERSION,
      seed: seed,
      rngCallCount: tracker.getCallCount(),
      map: map,
      currentNodeId: null,
      visitedPath: [],
      revealedNodeIds: [],
      screen: 'run',
      player: {
        hp: Content.PLAYER_MAX_HP,
        maxHp: Content.PLAYER_MAX_HP,
        deck: buildStarterDeck(deckPresetId),
        drawPile: [],
        discardPile: [],
        hand: [],
        energy: Content.PLAYER_ENERGY_PER_TURN,
        pendingStrength: 0,
        pendingEnemyHpPenalty: 0,
      },
      // v2 신규 상태(저장 버전 상향 사유): 지속형 파워 카드 효과, 획득한 유물, 이벤트/강화 보류 상태.
      powers: [],
      relics: [],
      cardUpgrades: {},
      pendingEventAction: null,
      lastRelicGained: null,
      skipNextEliteRelicGrant: false,
      enemyAssignment: enemyAssignment,
      eventAssignment: eventAssignment,
      combat: null,
      pendingReward: null,
      pendingRest: false,
      pendingEvent: null,
      stats: {
        clearCount: (previousStats && previousStats.clearCount) || 0,
        bestNodeReached: (previousStats && previousStats.bestNodeReached) || 0,
        enemiesDefeated: 0,
      },
      finished: false,
      victory: false,
    };
  }

  // ---- 트래커 생성 헬퍼 (state로부터) ----

  function trackerFromState(state) {
    return createRngTracker(state.seed, state.rngCallCount);
  }

  function commitTracker(state, tracker) {
    state.rngCallCount = tracker.getCallCount();
  }

  // ---- 덱 셔플/드로우/버림 ----

  // 뽑을 덱(drawPile)이 비어 있으면 버림 더미(discardPile)를 셔플해 새 drawPile로 삼는다.
  function reshuffleIfNeeded(player, tracker) {
    if (player.drawPile.length === 0 && player.discardPile.length > 0) {
      player.drawPile = shuffle(tracker, player.discardPile);
      player.discardPile = [];
    }
  }

  function drawCards(player, count, tracker) {
    var drawn = [];
    for (var i = 0; i < count; i += 1) {
      reshuffleIfNeeded(player, tracker);
      if (player.drawPile.length === 0) {
        // 버림 더미도 비어 있으면 더 뽑을 카드가 없다.
        break;
      }
      var card = player.drawPile.pop();
      player.hand.push(card);
      drawn.push(card);
    }
    return drawn;
  }

  function discardHand(player) {
    player.discardPile = player.discardPile.concat(player.hand);
    player.hand = [];
  }

  // ---- 전투 시작/턴 진행 ----

  function startCombat(state, enemyId, tracker) {
    var enemy = findEnemy(enemyId);
    var player = state.player;

    player.drawPile = shuffle(tracker, player.deck);
    player.discardPile = [];
    player.hand = [];
    player.energy = Content.PLAYER_ENERGY_PER_TURN;
    state.powers = [];

    state.combat = {
      enemyId: enemyId,
      enemyHp: enemy.maxHp,
      enemyMaxHp: enemy.maxHp,
      enemyBlock: 0,
      enemyStrength: 0,
      enemyWeak: 0,
      enemyVulnerable: 0,
      enemyPatternIndex: 0,
      playerBlock: 0,
      playerStrength: 0,
      playerWeak: 0,
      playerVulnerable: 0,
      turn: 1,
      firstCardDiscountUsed: false,
      log: [],
    };

    // 유물: 청동 반죽틀(전투 시작 시 방어도)·화덕 잉걸(전투 시작 시 적에게 피해).
    getRelicEffects(state).forEach(function (effect) {
      if (effect.combatStartBlock) {
        state.combat.playerBlock += effect.combatStartBlock;
      }
      if (effect.combatStartDamage) {
        playerHitsEnemy(state, effect.combatStartDamage);
      }
    });

    drawCards(player, getDrawPerTurn(state), tracker);

    return state.combat;
  }

  // ---- 유물 조회 ----

  function getRelicEffects(state) {
    return (state.relics || []).map(function (relicId) {
      var relic = findRelic(relicId);
      return relic ? relic.effect : {};
    });
  }

  function findRelic(id) {
    for (var i = 0; i < Content.RELICS.length; i += 1) {
      if (Content.RELICS[i].id === id) {
        return Content.RELICS[i];
      }
    }
    return null;
  }

  function getHandSizeBonus(state) {
    var bonus = 0;
    getRelicEffects(state).forEach(function (effect) {
      if (effect.handSizeBonus) {
        bonus += effect.handSizeBonus;
      }
    });
    return bonus;
  }

  // 여분의 앞치마(손패 상한 +2): 손패 한도 관리가 없는 현재 구조에서는 턴당 드로우
  // 수를 늘리는 것으로 구현한다(더 많은 카드를 손에 쥐고 운용할 수 있다는 효과 의도는
  // 동일하게 유지된다).
  function getDrawPerTurn(state) {
    return Content.PLAYER_DRAW_PER_TURN + getHandSizeBonus(state);
  }

  function getRewardCountBonus(state) {
    var bonus = 0;
    getRelicEffects(state).forEach(function (effect) {
      if (effect.rewardCountBonus) {
        bonus += effect.rewardCountBonus;
      }
    });
    return bonus;
  }

  function getDebuffDurationReduction(state) {
    var reduction = 0;
    getRelicEffects(state).forEach(function (effect) {
      if (effect.debuffDurationReduction) {
        reduction += effect.debuffDurationReduction;
      }
    });
    return reduction;
  }

  function getRestHealBonusPercent(state) {
    var bonus = 0;
    getRelicEffects(state).forEach(function (effect) {
      if (effect.restHealBonusPercent) {
        bonus += effect.restHealBonusPercent;
      }
    });
    return bonus;
  }

  // 약화/취약 등 디버프 부여량에 소금 부적(지속 -1턴, 최소 1턴)을 적용한다.
  function applyDebuffReduction(state, amount) {
    var reduction = getDebuffDurationReduction(state);
    var reduced = amount - reduction;
    return Math.max(1, reduced);
  }

  function getEnemyIntent(state) {
    var combat = state.combat;
    var enemy = findEnemy(combat.enemyId);
    var index = combat.enemyPatternIndex % enemy.pattern.length;
    return enemy.pattern[index];
  }

  // ---- 피해 계산 ----
  // 순서: (기본 피해 + 힘) × 약화(0.75, 내림) × 취약(1.5, 내림) → 방어도 차감 → HP 차감.
  // 곱연산 직후 내림을 적용한다. 다단 히트는 히트마다 방어도 차감을 반복한다.
  // 약화는 "공격자"가 주는 피해를 줄이고, 취약은 "방어자"가 받는 피해를 늘린다.
  function computeHitDamage(baseDamage, attackerStrength, attackerWeak, defenderVulnerable) {
    var amount = baseDamage + (attackerStrength || 0);
    if (amount < 0) {
      amount = 0;
    }
    if (attackerWeak > 0) {
      amount = Math.floor(amount * Content.WEAK_MULTIPLIER);
    }
    if (defenderVulnerable > 0) {
      amount = Math.floor(amount * Content.VULNERABLE_MULTIPLIER);
    }
    return amount;
  }

  // 방어도를 먼저 소모하고 남은 만큼 HP를 깎는다. { block, hpLoss }를 반환.
  function applyDamageToTarget(target, amount) {
    var block = target.block || 0;
    var absorbed = Math.min(block, amount);
    var remaining = amount - absorbed;
    target.block = block - absorbed;
    var hpLoss = remaining;
    return { absorbed: absorbed, hpLoss: hpLoss };
  }

  // 플레이어가 적에게 히트를 가한다 (다단 히트 시 히트마다 호출).
  // 내 공격은 "내" 약화와 "적"의 취약에 영향을 받는다.
  function playerHitsEnemy(state, baseDamage) {
    var combat = state.combat;
    var amount = computeHitDamage(baseDamage, combat.playerStrength, combat.playerWeak || 0, combat.enemyVulnerable || 0);
    var target = { block: combat.enemyBlock };
    var result = applyDamageToTarget(target, amount);
    combat.enemyBlock = target.block;
    combat.enemyHp = Math.max(0, combat.enemyHp - result.hpLoss);
    return { amount: amount, hpLoss: result.hpLoss };
  }

  // 적이 플레이어에게 히트를 가한다. 적의 공격은 "적"의 약화와 "플레이어"의 취약에 영향을 받는다.
  function enemyHitsPlayer(state, baseDamage) {
    var combat = state.combat;
    var amount = computeHitDamage(baseDamage, combat.enemyStrength, combat.enemyWeak || 0, combat.playerVulnerable);
    var target = { block: combat.playerBlock };
    var result = applyDamageToTarget(target, amount);
    combat.playerBlock = target.block;
    state.player.hp = Math.max(0, state.player.hp - result.hpLoss);
    return { amount: amount, hpLoss: result.hpLoss };
  }

  // ---- 카드 사용 ----

  // 설탕 모래시계(턴당 1회 첫 카드 비용 -1)를 감안한 실제 비용을 계산한다.
  function getEffectiveCost(state, card) {
    var cost = card.cost;
    var hasDiscountRelic = getRelicEffects(state).some(function (effect) {
      return effect.firstCardDiscount;
    });
    if (hasDiscountRelic && state.combat && !state.combat.firstCardDiscountUsed) {
      cost = Math.max(0, cost - 1);
    }
    return cost;
  }

  function canPlayCard(state, cardId) {
    var card = findCard(cardId);
    if (!card) {
      return false;
    }
    if (state.combat === null) {
      return false;
    }
    if (state.combat.enemyHp <= 0 || state.player.hp <= 0) {
      return false;
    }
    return state.player.energy >= getEffectiveCost(state, card);
  }

  // 카드 효과를 프리미티브 조합으로 해석해 적용한다. 카드별 if 분기를 두지 않는다.
  // attacksPlayedThisTurn: 연격 시너지(bonusDamagePerAttackPlayed) 계산에 쓰인다 —
  // 이 카드를 포함해 이번 턴에 사용한 공격 카드 수(damage 보유 카드).
  function applyCardEffect(state, card, attacksPlayedThisTurn) {
    var effect = getEffectiveCardEffect(state, card.id) || card.effect;
    var combat = state.combat;
    var player = state.player;
    var results = { hits: [] };

    if (effect.strength) {
      combat.playerStrength += effect.strength;
    }
    if (effect.block) {
      combat.playerBlock += effect.block;
    }
    if (effect.damage) {
      var bonusPerHit = effect.bonusDamagePerAttackPlayed
        ? effect.bonusDamagePerAttackPlayed * (attacksPlayedThisTurn || 1)
        : 0;
      var hitCount = effect.hits || 1;
      for (var i = 0; i < hitCount; i += 1) {
        results.hits.push(playerHitsEnemy(state, effect.damage + bonusPerHit));
      }
    }
    if (effect.weak) {
      combat.enemyWeak = (combat.enemyWeak || 0) + applyDebuffReduction(state, effect.weak);
    }
    if (effect.vulnerable) {
      combat.enemyVulnerable = (combat.enemyVulnerable || 0) + applyDebuffReduction(state, effect.vulnerable);
    }
    if (effect.selfWeak) {
      combat.playerWeak = (combat.playerWeak || 0) + effect.selfWeak;
    }
    if (effect.heal) {
      player.hp = Math.min(player.maxHp, player.hp + effect.heal);
    }
    if (effect.selfDamage) {
      player.hp = Math.max(0, player.hp - effect.selfDamage);
    }
    if (effect.energy) {
      player.energy += effect.energy;
    }
    if (effect.blockCarryover) {
      combat.blockCarryover = (combat.blockCarryover || 0) + effect.blockCarryover;
    }
    if (effect.draw) {
      // draw는 호출부(playCard)에서 tracker를 받아 처리한다.
      results.drawCount = effect.draw;
    }
    if (effect.randomFromDiscard) {
      results.randomFromDiscardCount = effect.randomFromDiscard;
    }

    return results;
  }

  function playCard(state, cardId, handIndex, tracker) {
    if (!canPlayCard(state, cardId)) {
      return { success: false, reason: 'CANNOT_PLAY' };
    }
    var card = findCard(cardId);
    var player = state.player;
    var combat = state.combat;

    var index = handIndex;
    if (index === undefined || index === null || player.hand[index] !== cardId) {
      index = player.hand.indexOf(cardId);
    }
    if (index === -1) {
      return { success: false, reason: 'NOT_IN_HAND' };
    }

    var effectiveCost = getEffectiveCost(state, card);
    var usedDiscount = effectiveCost < card.cost;
    var isFirstPlayThisTurn = !combat.hasPlayedCardThisTurn;

    player.energy -= effectiveCost;
    if (usedDiscount) {
      combat.firstCardDiscountUsed = true;
    }
    player.hand.splice(index, 1);
    if (card.type === 'power') {
      // 파워(지속) 카드: 버림/소멸 더미로 가지 않고 이번 전투 동안 지속 효과 목록에 등록된다.
      // 전투가 끝나면 checkCombatOutcome이 state.powers를 비운다(전투 단위 지속).
      state.powers = (state.powers || []).concat([{ cardId: cardId }]);
    } else if (card.effect.exile) {
      // 소멸(런 중 1회성): 버림 더미로 가지 않고 덱에서 이 카드 1장이 영구히 제외된다.
      var deckIndex = state.player.deck.indexOf(cardId);
      if (deckIndex !== -1) {
        state.player.deck.splice(deckIndex, 1);
      }
    } else {
      player.discardPile.push(cardId);
    }

    var isAttackCard = Boolean(card.effect.damage);
    combat.attacksPlayedThisTurn = (combat.attacksPlayedThisTurn || 0) + (isAttackCard ? 1 : 0);

    var results = applyCardEffect(state, card, combat.attacksPlayedThisTurn);

    // 티라미수 비축 시너지: 이번 턴 첫 카드가 비용 0으로 나가면 추가 드로우.
    if (card.effect.freeIfFirstPlayNoCost && isFirstPlayThisTurn && effectiveCost === 0) {
      results.drawCount = (results.drawCount || 0) + card.effect.freeIfFirstPlayNoCost;
    }

    combat.hasPlayedCardThisTurn = true;

    if (results.drawCount) {
      drawCards(player, results.drawCount, tracker);
    }
    if (results.randomFromDiscardCount && player.discardPile.length > 0) {
      for (var r = 0; r < results.randomFromDiscardCount; r += 1) {
        if (player.discardPile.length === 0) {
          break;
        }
        var pickIndex = randomInt(tracker, player.discardPile.length);
        var pickedId = player.discardPile.splice(pickIndex, 1)[0];
        player.hand.push(pickedId);
      }
    }

    checkCombatOutcome(state, tracker);

    return { success: true, card: card, results: results };
  }

  // ---- 적 행동 실행 ----

  function executeEnemyTurn(state, tracker) {
    var combat = state.combat;
    var intent = getEnemyIntent(state);
    var record = { intent: intent, hits: [] };

    if (intent.type === 'attack') {
      var hitCount = intent.hits || 1;
      for (var i = 0; i < hitCount; i += 1) {
        record.hits.push(enemyHitsPlayer(state, intent.amount));
      }
    } else if (intent.type === 'block') {
      combat.enemyBlock += intent.amount;
    } else if (intent.type === 'strength') {
      combat.enemyStrength += intent.amount;
    } else if (intent.type === 'weak') {
      combat.playerWeak += intent.amount;
    } else if (intent.type === 'vulnerable') {
      combat.playerVulnerable += intent.amount;
    }

    combat.enemyPatternIndex += 1;
    checkCombatOutcome(state, tracker);

    return record;
  }

  // 턴 종료 흐름. 각 상태 효과는 "그 효과가 발휘되는 턴"이 끝날 때 1턴 감소한다:
  //  - 플레이어의 약화(내 공격 감소)·적의 취약(내 공격 증폭)은 플레이어 턴이 끝날 때
  //  - 적의 약화(적 공격 감소)·플레이어의 취약(적 공격 증폭)은 적 턴이 끝날 때
  // 방어도는 "자기 턴 시작 시" 소멸한다 — 플레이어 방어도는 적의 공격을 받아낸 뒤
  // 다음 플레이어 턴이 시작될 때 비운다 (적 행동 전에 비우면 방어 카드가 무의미해진다).
  function endTurn(state, tracker) {
    var combat = state.combat;
    var player = state.player;

    discardHand(player);

    if (combat.playerWeak > 0) {
      combat.playerWeak -= 1;
    }
    if (combat.enemyVulnerable > 0) {
      combat.enemyVulnerable -= 1;
    }

    if (state.combat && combat.enemyHp > 0 && player.hp > 0) {
      // 적 턴 시작: 적이 이전 턴에 얻은 방어도가 소멸한다 (이번 턴에 새로 얻는 방어도는 유지됨).
      combat.enemyBlock = 0;
      executeEnemyTurn(state, tracker);
      if (state.combat) {
        if (combat.enemyWeak > 0) {
          combat.enemyWeak -= 1;
        }
        if (combat.playerVulnerable > 0) {
          combat.playerVulnerable -= 1;
        }
      }
    }

    if (state.combat && combat.enemyHp > 0 && state.player.hp > 0) {
      // 플레이어 턴 시작: 슈크림 방벽 등 이월 방어도만 남기고, 지난 턴 방어도는 소멸한다.
      combat.playerBlock = combat.blockCarryover || 0;
      combat.blockCarryover = 0;
      combat.turn += 1;
      combat.firstCardDiscountUsed = false;
      combat.hasPlayedCardThisTurn = false;
      combat.attacksPlayedThisTurn = 0;
      player.energy = Content.PLAYER_ENERGY_PER_TURN;

      // 파워(지속 카드) 발동: 시나몬 각성(힘 +N)·꿀 코팅(방어도 +N) — 매 턴 시작 시.
      (state.powers || []).forEach(function (power) {
        var powerCard = findCard(power.cardId);
        if (!powerCard) {
          return;
        }
        if (powerCard.effect.strengthPerTurn) {
          combat.playerStrength += powerCard.effect.strengthPerTurn;
        }
        if (powerCard.effect.blockPerTurn) {
          combat.playerBlock += powerCard.effect.blockPerTurn;
        }
      });

      drawCards(player, getDrawPerTurn(state), tracker);
    }

    return state.combat;
  }

  // ---- 승패 판정 ----

  // 도달 층수(점수 공식·통산 기록에 쓰인다). 진입 전(currentNodeId 없음)에는 0.
  function getReachedFloor(state) {
    if (!state.currentNodeId) {
      return 0;
    }
    var node = findNodeById(state.map, state.currentNodeId);
    return node ? node.floor : 0;
  }

  function grantRelic(state, relicId) {
    if (relicId && state.relics.indexOf(relicId) === -1) {
      state.relics.push(relicId);
      var relic = findRelic(relicId);
      if (relic && relic.effect.maxHpBonus) {
        state.player.maxHp += relic.effect.maxHpBonus;
      }
      if (relic && relic.effect.immediateHeal) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + relic.effect.immediateHeal);
      }
    }
  }

  function checkCombatOutcome(state, tracker) {
    var combat = state.combat;
    if (!combat) {
      return null;
    }
    if (combat.enemyHp <= 0) {
      var enemy = findEnemy(combat.enemyId);
      state.stats.enemiesDefeated += 1;
      state.combat = null;
      state.powers = [];
      state.player.hand = [];
      state.player.discardPile = [];
      state.player.drawPile = [];
      var reachedFloor = getReachedFloor(state);
      if (enemy.tier === 'boss') {
        state.stats.clearCount += 1;
        state.stats.bestNodeReached = Math.max(state.stats.bestNodeReached, reachedFloor);
        state.finished = true;
        state.victory = true;
        state.screen = 'result';
      } else {
        state.screen = 'reward';
        if (enemy.tier === 'elite' && !state.skipNextEliteRelicGrant) {
          // 정예 승리 확정 유물 1개(시드 RNG 선택 - docs/deck-improvement-plan.md 2절).
          var candidateRelics = Content.RELICS.filter(function (relic) {
            return state.relics.indexOf(relic.id) === -1;
          });
          if (candidateRelics.length > 0) {
            var picked = pickN(tracker, candidateRelics, 1)[0];
            grantRelic(state, picked.id);
            state.lastRelicGained = picked.id;
          }
        }
        state.skipNextEliteRelicGrant = false;
        offerReward(state, tracker);
      }
      return 'victory';
    }
    if (state.player.hp <= 0) {
      state.combat = null;
      state.powers = [];
      state.stats.bestNodeReached = Math.max(state.stats.bestNodeReached, getReachedFloor(state));
      state.finished = true;
      state.victory = false;
      state.screen = 'result';
      return 'defeat';
    }
    return null;
  }

  // ---- 카드 보상 ----

  function generateCardReward(state, nodeType, tracker) {
    var pool = nodeType === 'elite' || nodeType === 'boss'
      ? cardsByRarity('common').concat(cardsByRarity('elite'))
      : cardsByRarity('common');

    var rewardCount = Content.REWARD_CARD_COUNT + getRewardCountBonus(state);
    var options;
    if (nodeType === 'elite' || nodeType === 'boss') {
      var eliteOptions = pickN(tracker, cardsByRarity('elite'), 1);
      var rest = pickN(tracker, pool.filter(function (c) {
        return c.id !== eliteOptions[0].id;
      }), rewardCount - 1);
      options = eliteOptions.concat(rest);
    } else {
      options = pickN(tracker, pool, rewardCount);
    }

    return options.map(function (card) {
      return card.id;
    });
  }

  function offerReward(state, tracker) {
    var node = findNodeById(state.map, state.currentNodeId);
    var rewardIds = generateCardReward(state, node.type, tracker);
    state.pendingReward = rewardIds;
    return rewardIds;
  }

  function chooseReward(state, cardId) {
    if (state.screen !== 'reward') {
      return { success: false, reason: 'NO_REWARD' };
    }
    if (cardId !== null && (!state.pendingReward || state.pendingReward.indexOf(cardId) === -1)) {
      return { success: false, reason: 'INVALID_CARD' };
    }
    if (cardId !== null) {
      state.player.deck.push(cardId);
    }
    state.pendingReward = null;
    returnToMap(state);
    return { success: true };
  }

  // ---- 휴식 ----

  function applyRestHeal(state) {
    if (state.screen !== 'rest') {
      return { success: false, reason: 'NOT_RESTING' };
    }
    // 부동소수점 오차(0.3 * 1.5 = 0.44999999999999996 등)로 회복량이 1 낮게 내림되는
    // 것을 막기 위해, 기본 회복량을 먼저 정수로 내림한 뒤 유물 배율을 곱하고 반올림한다.
    var baseHealAmount = Math.floor(state.player.maxHp * Content.REST_HEAL_PERCENT);
    var healAmount = Math.round(baseHealAmount * (1 + getRestHealBonusPercent(state)));
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmount);
    returnToMap(state);
    return { success: true, healAmount: healAmount };
  }

  function applyRestRemoveCard(state, deckIndex) {
    if (state.screen !== 'rest') {
      return { success: false, reason: 'NOT_RESTING' };
    }
    if (deckIndex < 0 || deckIndex >= state.player.deck.length) {
      return { success: false, reason: 'INVALID_INDEX' };
    }
    var removed = state.player.deck.splice(deckIndex, 1);
    returnToMap(state);
    return { success: true, removedCardId: removed[0] };
  }

  // ---- 이벤트 칸 ----

  function findEvent(id) {
    for (var i = 0; i < Content.EVENTS.length; i += 1) {
      if (Content.EVENTS[i].id === id) {
        return Content.EVENTS[i];
      }
    }
    return null;
  }

  // 이벤트 노드 진입: pendingEvent에 이벤트 정의를 얹고 'event' 화면으로 전환한다.
  function enterEventNode(state) {
    var eventId = state.eventAssignment[state.currentNodeId];
    var event = findEvent(eventId);
    state.pendingEvent = { eventId: eventId };
    state.screen = 'event';
    return event;
  }

  // 이벤트 선택지를 해석한다. 결과가 다음 전투를 예약하는 경우(잠든 수호묘 등)를 제외하면
  // 이벤트 칸 소비 후 지도로 복귀한다. tracker는 무작위 결과(random resultType)에 쓰인다.
  function resolveEventChoice(state, choiceId, tracker) {
    if (state.screen !== 'event' || !state.pendingEvent) {
      return { success: false, reason: 'NO_EVENT' };
    }
    var event = findEvent(state.pendingEvent.eventId);
    if (!event) {
      return { success: false, reason: 'INVALID_EVENT' };
    }
    var choice = event.choices.filter(function (c) { return c.id === choiceId; })[0];
    if (!choice) {
      return { success: false, reason: 'INVALID_CHOICE' };
    }

    var outcome = applyEventResult(state, choice, tracker);
    state.pendingEvent = null;

    if (outcome && outcome.forcedElite) {
      // 잠든 수호묘: 현재(이벤트) 노드에서 즉시 정예 전투를 시작한다(맵 노드 타입은
      // 이미 소비된 이벤트로 유지 — 적 배정만 정예로 덮어써 전투를 발생시킨다).
      var eliteIds = enemiesByTier('elite').map(function (e) { return e.id; });
      var eliteId = eliteIds[randomInt(tracker, eliteIds.length)];
      state.enemyAssignment[state.currentNodeId] = eliteId;
      grantRelic(state, outcome.guaranteedRelicId);
      state.skipNextEliteRelicGrant = true;
      startCombat(state, eliteId, tracker);
      state.screen = 'combat';
    } else if (outcome && outcome.goToReward) {
      state.screen = 'reward';
      offerReward(state, tracker);
    } else {
      returnToMap(state);
    }

    return { success: true, choiceId: choiceId, outcome: outcome };
  }

  // 선택지 하나를 결과로 해석한다. 카드별 applyCardEffect와 같은 원칙 — resultType별
  // 프리미티브 처리로, 이벤트별 if 분기를 최소화한다.
  function applyEventResult(state, choice, tracker) {
    switch (choice.resultType) {
      case 'noop':
        return {};
      case 'heal':
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + choice.amount);
        return { healed: choice.amount };
      case 'maxHpBonus':
        state.player.maxHp += choice.amount;
        return { maxHpGained: choice.amount };
      case 'strength':
        // 전투 밖 힘 부여는 다음 전투 시작 시 적용되도록 player에 보류값을 쌓는다.
        state.player.pendingStrength = (state.player.pendingStrength || 0) + choice.amount;
        return { strengthGained: choice.amount };
      case 'selfDamage':
        state.player.hp = Math.max(0, state.player.hp - choice.amount);
        return { hpLost: choice.amount };
      case 'payHpForRelic': {
        state.player.hp = Math.max(0, state.player.hp - choice.hpCost);
        var candidateRelics = Content.RELICS.filter(function (relic) {
          return state.relics.indexOf(relic.id) === -1;
        });
        if (candidateRelics.length > 0) {
          var picked = pickN(tracker, candidateRelics, 1)[0];
          grantRelic(state, picked.id);
          return { relicGained: picked.id, hpPaid: choice.hpCost };
        }
        return { hpPaid: choice.hpCost };
      }
      case 'removeCardChoice':
        // 실제 카드 선택은 game.js가 UI로 받아 applyEventRemoveCard를 별도 호출한다.
        state.pendingEventAction = { type: 'removeCard' };
        return { requiresFollowUp: 'removeCard' };
      case 'upgradeCardChoice':
        state.pendingEventAction = { type: 'upgradeCard' };
        return { requiresFollowUp: 'upgradeCard' };
      case 'cardRewardChoice':
        return { goToReward: true };
      case 'relicWithCurse': {
        state.player.deck.push('soggy-bread');
        var pool = Content.RELICS.filter(function (relic) {
          return state.relics.indexOf(relic.id) === -1;
        });
        if (pool.length > 0) {
          var relicPicked = pickN(tracker, pool, 1)[0];
          grantRelic(state, relicPicked.id);
          return { relicGained: relicPicked.id, curseGained: 'soggy-bread' };
        }
        return { curseGained: 'soggy-bread' };
      }
      case 'giveCardForNextCombatDebuff':
        state.pendingEventAction = { type: 'giveCard', enemyHpPenalty: choice.enemyHpPenalty };
        return { requiresFollowUp: 'giveCard' };
      case 'revealNextFloor': {
        var currentNode = findNodeById(state.map, state.currentNodeId);
        var nextOptions = currentNode ? getAvailableNextNodes(state.map, state.currentNodeId) : [];
        nextOptions.forEach(function (node) {
          if (state.revealedNodeIds.indexOf(node.id) === -1) {
            state.revealedNodeIds.push(node.id);
          }
        });
        return { revealedCount: nextOptions.length };
      }
      case 'forceEliteWithRelic': {
        var candidateForElite = Content.RELICS.filter(function (relic) {
          return state.relics.indexOf(relic.id) === -1;
        });
        var guaranteedRelicId = candidateForElite.length > 0
          ? pickN(tracker, candidateForElite, 1)[0].id
          : null;
        return { forcedElite: true, guaranteedRelicId: guaranteedRelicId };
      }
      case 'random': {
        var totalWeight = choice.outcomes.reduce(function (sum, o) { return sum + o.weight; }, 0);
        var roll = randomInt(tracker, totalWeight);
        var cursor = 0;
        var selected = choice.outcomes[0];
        for (var i = 0; i < choice.outcomes.length; i += 1) {
          cursor += choice.outcomes[i].weight;
          if (roll < cursor) {
            selected = choice.outcomes[i];
            break;
          }
        }
        return applyEventResult(state, selected, tracker);
      }
      default:
        return {};
    }
  }

  // 이벤트 후속 조치: 카드 제거(떠돌이 상인/조용한 제단/굶주린 아기 새 공통 경로).
  function applyEventRemoveCard(state, deckIndex) {
    if (!state.pendingEventAction || (state.pendingEventAction.type !== 'removeCard' && state.pendingEventAction.type !== 'giveCard')) {
      return { success: false, reason: 'NO_PENDING_ACTION' };
    }
    if (deckIndex < 0 || deckIndex >= state.player.deck.length) {
      return { success: false, reason: 'INVALID_INDEX' };
    }
    var enemyHpPenalty = state.pendingEventAction.enemyHpPenalty;
    var removed = state.player.deck.splice(deckIndex, 1);
    if (enemyHpPenalty) {
      state.player.pendingEnemyHpPenalty = (state.player.pendingEnemyHpPenalty || 0) + enemyHpPenalty;
    }
    state.pendingEventAction = null;
    returnToMap(state);
    return { success: true, removedCardId: removed[0] };
  }

  // 이벤트 후속 조치: 카드 강화(버려진 오븐). 카드가 가진 효과(피해 또는 방어)에 시드
  // 결정적으로 +3을 더한다. 이 게임은 카드를 id로만 다루므로(인스턴스 구분 없음), 강화는
  // "그 id를 가진 모든 카드"에 적용되는 런 전역 오버레이(state.cardUpgrades)로 구현한다.
  function applyEventUpgradeCard(state, deckIndex) {
    if (!state.pendingEventAction || state.pendingEventAction.type !== 'upgradeCard') {
      return { success: false, reason: 'NO_PENDING_ACTION' };
    }
    if (deckIndex < 0 || deckIndex >= state.player.deck.length) {
      return { success: false, reason: 'INVALID_INDEX' };
    }
    var cardId = state.player.deck[deckIndex];
    var card = findCard(cardId);
    if (!card) {
      return { success: false, reason: 'INVALID_CARD' };
    }
    var upgradeKey = card.effect.damage !== undefined ? 'damage' : (card.effect.block !== undefined ? 'block' : null);
    if (upgradeKey) {
      state.cardUpgrades = state.cardUpgrades || {};
      state.cardUpgrades[cardId] = (state.cardUpgrades[cardId] || 0) + 3;
    }
    state.pendingEventAction = null;
    returnToMap(state);
    return { success: true, upgradedCardId: cardId, upgradeKey: upgradeKey };
  }

  // cardId의 강화 적용 효과를 계산한다(원본 effect + state.cardUpgrades 오버레이).
  // 원본 CARDS 배열은 불변으로 유지하고, 매 조회 시 얕은 복제로 오버레이를 얹는다.
  function getEffectiveCardEffect(state, cardId) {
    var card = findCard(cardId);
    if (!card) {
      return null;
    }
    var bonus = (state.cardUpgrades && state.cardUpgrades[cardId]) || 0;
    if (!bonus) {
      return card.effect;
    }
    var overlay = {};
    Object.keys(card.effect).forEach(function (key) {
      overlay[key] = card.effect[key];
    });
    if (overlay.damage !== undefined) {
      overlay.damage += bonus;
    } else if (overlay.block !== undefined) {
      overlay.block += bonus;
    }
    return overlay;
  }

  // ---- 런 진행 (갈림길 맵) ----

  // 전투/휴식/이벤트 처리를 마치고 지도 화면으로 돌아간다. 다음 노드 선택 UI가
  // getAvailableNextNodes(state.map, state.currentNodeId)를 그려준다.
  function returnToMap(state) {
    if (!getAvailableNextNodes(state.map, state.currentNodeId).length) {
      state.screen = 'result';
      state.finished = true;
      return;
    }
    state.screen = 'run';
  }

  // 지도에서 다음 노드를 선택해 진입한다. optionIndex는 getAvailableNextNodes가 돌려주는
  // 배열의 인덱스(리플레이 로그 ["m", nodeIndex] 액션과 1:1 대응).
  function selectMapNode(state, optionIndex, tracker) {
    if (state.screen !== 'run') {
      return { success: false, reason: 'NOT_ON_MAP' };
    }
    var options = getAvailableNextNodes(state.map, state.currentNodeId);
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
      return { success: false, reason: 'INVALID_NODE_INDEX' };
    }
    var node = options[optionIndex];
    state.currentNodeId = node.id;
    state.visitedPath.push(node.id);
    state.stats.bestNodeReached = Math.max(state.stats.bestNodeReached, node.floor);

    if (node.type === Content.NODE_TYPES.REST) {
      state.screen = 'rest';
      return { success: true, type: 'rest', nodeId: node.id };
    }
    if (node.type === Content.NODE_TYPES.EVENT) {
      enterEventNode(state);
      return { success: true, type: 'event', nodeId: node.id };
    }

    var enemyId = state.enemyAssignment[node.id];
    var pendingStrength = state.player.pendingStrength || 0;
    var pendingEnemyHpPenalty = state.player.pendingEnemyHpPenalty || 0;
    state.player.pendingStrength = 0;
    state.player.pendingEnemyHpPenalty = 0;

    startCombat(state, enemyId, tracker);
    if (pendingStrength) {
      state.combat.playerStrength += pendingStrength;
    }
    if (pendingEnemyHpPenalty) {
      state.combat.enemyHp = Math.max(0, state.combat.enemyHp - pendingEnemyHpPenalty);
    }
    state.screen = 'combat';
    return { success: true, type: 'combat', nodeId: node.id, enemyId: enemyId };
  }

  // ---- 저장/불러오기 ----

  function serializeState(state) {
    return JSON.stringify(state);
  }

  function isValidLoadedState(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }
    if (candidate.version !== Content.SAVE_VERSION) {
      return false;
    }
    if (typeof candidate.seed !== 'number') {
      return false;
    }
    if (typeof candidate.rngCallCount !== 'number' || candidate.rngCallCount < 0) {
      return false;
    }
    if (!candidate.map || !Array.isArray(candidate.map.floors) || !Array.isArray(candidate.map.edges)) {
      return false;
    }
    if (!candidate.player || typeof candidate.player !== 'object') {
      return false;
    }
    if (typeof candidate.player.hp !== 'number' || candidate.player.hp < 0) {
      return false;
    }
    if (typeof candidate.player.maxHp !== 'number' || candidate.player.maxHp <= 0) {
      return false;
    }
    if (!Array.isArray(candidate.player.deck)) {
      return false;
    }
    if (!candidate.enemyAssignment || typeof candidate.enemyAssignment !== 'object') {
      return false;
    }
    if (!candidate.stats || typeof candidate.stats !== 'object') {
      return false;
    }
    return true;
  }

  // 구버전(v1, 선형 11칸) 세이브 판별 - 버전 필드가 다르거나 없고, 통산 기록으로 쓸 만한
  // stats 구조가 남아 있는 경우를 가리킨다(docs/deck-improvement-plan.md 6절).
  function isLegacyV1Save(candidate) {
    return Boolean(
      candidate
      && typeof candidate === 'object'
      && candidate.version !== Content.SAVE_VERSION
      && candidate.stats
      && typeof candidate.stats === 'object'
    );
  }

  // 구버전 세이브에서 통산 기록(stats)만 추출한다. 크래시 없이 형태가 어긋난 필드는
  // 0/기본값으로 관용 처리한다.
  function extractLegacyStats(candidate) {
    var stats = (candidate && candidate.stats) || {};
    return {
      clearCount: typeof stats.clearCount === 'number' ? stats.clearCount : 0,
      bestNodeReached: typeof stats.bestNodeReached === 'number' ? stats.bestNodeReached : 0,
      enemiesDefeated: 0,
    };
  }

  // deserializeState는 유효하지 않은 세이브를 전부 null로 돌려준다 - 마이그레이션
  // 여부 판단(통산 기록 보존)은 game.js가 isLegacyV1Save/extractLegacyStats로 직접 처리한다.
  function deserializeState(raw) {
    if (typeof raw !== 'string' || raw.length === 0) {
      return null;
    }
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    if (!isValidLoadedState(parsed)) {
      return null;
    }
    return parsed;
  }

  // ---- 콘텐츠 안전망 검증 ----

  var KNOWN_EFFECT_KEYS = [
    'damage', 'hits', 'block', 'draw', 'energy', 'strength', 'weak', 'vulnerable', 'heal', 'selfDamage',
    'bonusDamagePerAttackPlayed', 'blockCarryover', 'freeIfFirstPlayNoCost', 'exile', 'selfWeak',
    'strengthPerTurn', 'blockPerTurn', 'randomFromDiscard',
  ];
  var KNOWN_INTENT_TYPES = ['attack', 'block', 'strength', 'weak', 'vulnerable'];
  var KNOWN_RELIC_EFFECT_KEYS = [
    'combatStartBlock', 'firstCardDiscount', 'debuffDurationReduction', 'combatStartDamage',
    'handSizeBonus', 'rewardCountBonus', 'maxHpBonus', 'immediateHeal', 'restHealBonusPercent',
  ];
  var KNOWN_EVENT_RESULT_TYPES = [
    'noop', 'heal', 'maxHpBonus', 'strength', 'selfDamage', 'payHpForRelic', 'removeCardChoice',
    'upgradeCardChoice', 'cardRewardChoice', 'relicWithCurse', 'giveCardForNextCombatDebuff',
    'revealNextFloor', 'forceEliteWithRelic', 'random',
  ];

  function validateContent() {
    var problems = [];

    Content.CARDS.forEach(function (card) {
      Object.keys(card.effect).forEach(function (key) {
        if (KNOWN_EFFECT_KEYS.indexOf(key) === -1) {
          problems.push('card ' + card.id + '의 effect 키 "' + key + '"가 엔진에 알려지지 않음');
        }
      });
    });

    Content.RELICS.forEach(function (relic) {
      Object.keys(relic.effect).forEach(function (key) {
        if (KNOWN_RELIC_EFFECT_KEYS.indexOf(key) === -1) {
          problems.push('relic ' + relic.id + '의 effect 키 "' + key + '"가 엔진에 알려지지 않음');
        }
      });
    });

    Content.EVENTS.forEach(function (event) {
      if (!Array.isArray(event.choices) || event.choices.length === 0) {
        problems.push('event ' + event.id + '의 choices가 비어 있음');
        return;
      }
      event.choices.forEach(function (choice) {
        if (choice.resultType === 'random') {
          if (!Array.isArray(choice.outcomes) || choice.outcomes.length === 0) {
            problems.push('event ' + event.id + '의 선택지 "' + choice.id + '"에 outcomes가 없음');
          } else {
            choice.outcomes.forEach(function (outcome) {
              if (KNOWN_EVENT_RESULT_TYPES.indexOf(outcome.resultType) === -1) {
                problems.push('event ' + event.id + '의 random 결과 타입 "' + outcome.resultType + '"이 엔진에 알려지지 않음');
              }
            });
          }
        } else if (KNOWN_EVENT_RESULT_TYPES.indexOf(choice.resultType) === -1) {
          problems.push('event ' + event.id + '의 선택지 "' + choice.id + '" resultType "' + choice.resultType + '"이 엔진에 알려지지 않음');
        }
      });
    });

    Content.ENEMIES.forEach(function (enemy) {
      if (!Array.isArray(enemy.pattern) || enemy.pattern.length === 0) {
        problems.push('enemy ' + enemy.id + '의 pattern이 비어 있음');
        return;
      }
      enemy.pattern.forEach(function (action) {
        if (KNOWN_INTENT_TYPES.indexOf(action.type) === -1) {
          problems.push('enemy ' + enemy.id + '의 행동 타입 "' + action.type + '"이 엔진에 알려지지 않음');
        }
      });
    });

    if (enemiesByTier('normal').length === 0) {
      problems.push('일반 전투에 대응하는 적이 없음');
    }
    if (enemiesByTier('elite').length === 0) {
      problems.push('정예 전투에 대응하는 적이 없음');
    }
    if (enemiesByTier('boss').length === 0) {
      problems.push('보스 전투에 대응하는 적이 없음');
    }

    return problems;
  }

  var DeckEngine = {
    createRng: createRng,
    createRngTracker: createRngTracker,
    randomInt: randomInt,
    shuffle: shuffle,
    pickN: pickN,
    findCard: findCard,
    findEnemy: findEnemy,
    findRelic: findRelic,
    findEvent: findEvent,
    cardsByRarity: cardsByRarity,
    enemiesByTier: enemiesByTier,
    buildMap: buildMap,
    findNodeById: findNodeById,
    getAvailableNextNodes: getAvailableNextNodes,
    buildEnemyAssignment: buildEnemyAssignment,
    buildEventAssignment: buildEventAssignment,
    buildStarterDeck: buildStarterDeck,
    createNewRun: createNewRun,
    trackerFromState: trackerFromState,
    commitTracker: commitTracker,
    reshuffleIfNeeded: reshuffleIfNeeded,
    drawCards: drawCards,
    discardHand: discardHand,
    startCombat: startCombat,
    getEnemyIntent: getEnemyIntent,
    computeHitDamage: computeHitDamage,
    applyDamageToTarget: applyDamageToTarget,
    playerHitsEnemy: playerHitsEnemy,
    enemyHitsPlayer: enemyHitsPlayer,
    canPlayCard: canPlayCard,
    getEffectiveCost: getEffectiveCost,
    getEffectiveCardEffect: getEffectiveCardEffect,
    applyCardEffect: applyCardEffect,
    playCard: playCard,
    executeEnemyTurn: executeEnemyTurn,
    endTurn: endTurn,
    checkCombatOutcome: checkCombatOutcome,
    getReachedFloor: getReachedFloor,
    grantRelic: grantRelic,
    generateCardReward: generateCardReward,
    offerReward: offerReward,
    chooseReward: chooseReward,
    applyRestHeal: applyRestHeal,
    applyRestRemoveCard: applyRestRemoveCard,
    enterEventNode: enterEventNode,
    resolveEventChoice: resolveEventChoice,
    applyEventResult: applyEventResult,
    applyEventRemoveCard: applyEventRemoveCard,
    applyEventUpgradeCard: applyEventUpgradeCard,
    returnToMap: returnToMap,
    selectMapNode: selectMapNode,
    getRelicEffects: getRelicEffects,
    getHandSizeBonus: getHandSizeBonus,
    getDrawPerTurn: getDrawPerTurn,
    getRewardCountBonus: getRewardCountBonus,
    getDebuffDurationReduction: getDebuffDurationReduction,
    getRestHealBonusPercent: getRestHealBonusPercent,
    serializeState: serializeState,
    isValidLoadedState: isValidLoadedState,
    isLegacyV1Save: isLegacyV1Save,
    extractLegacyStats: extractLegacyStats,
    deserializeState: deserializeState,
    validateContent: validateContent,
  };

  root.DeckEngine = DeckEngine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeckEngine;
  }
})(typeof window !== 'undefined' ? window : this);

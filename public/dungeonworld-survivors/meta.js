(function (root) {
  'use strict';

  // 검은 종 생존전 메타 진행(고도화 v1 계획서 5절). 순수 함수 모듈 - 브라우저(game.js)와
  // Node(scripts/test-survivors-meta.js) 양쪽에서 로드 가능한 UMD 패턴을 match3/deck의
  // scoring.js·engine.js와 동일하게 따른다. localStorage 접근은 이 파일에 두지 않고
  // game.js가 담당한다(순수 로직/부수효과 분리 - Node에서 테스트하기 쉽게).

  const STORAGE_KEY = 'survivors-meta-v1';
  const STORAGE_VERSION = 1;

  // 종잔향(재화) 공식(계획서 5절): floor(생존초/10) + floor(처치/5) + (보스 격파 ? 500 : 0)
  // 퀵 런 기준. long 런도 동일 공식(시간이 길어 유리하지만 재화는 랭킹이 아니므로 무해).
  function calculateBellEssenceReward(runSummary) {
    const survivalSeconds = Math.max(0, Math.floor(runSummary.survivalTime || 0));
    const kills = Math.max(0, Math.floor(runSummary.kills || 0));
    const bossDefeated = Boolean(runSummary.won);
    const survivalReward = Math.floor(survivalSeconds / 10);
    const killReward = Math.floor(kills / 5);
    const bossReward = bossDefeated ? 500 : 0;
    return survivalReward + killReward + bossReward;
  }

  // 해금 12종(계획서 5절 가격표). 해금은 난이도를 낮추는 방향만(공격력 직접 상승 없음 -
  // 랭킹 공정성 고려). 예외: '대장간 신세'(시작 무기 Lv.2)는 난이도 완화가 아니라 시작
  // 상태 강화이므로 명시적으로 예외 처리하고, 랭킹 점수 상한(webgameApi GAME_DEFINITIONS.
  // survivors.maxScore)에는 이미 넉넉한 여유가 반영되어 있어 상한을 별도로 낮추지 않는다.
  const UNLOCKS = [
    {
      id: 'innBreakfast1', groupId: 'innBreakfast', tier: 1,
      title: '여관의 아침식사 I', price: 300,
      copy: '시작 체력 +10.',
      effect: { type: 'startHealth', amount: 10 },
    },
    {
      id: 'innBreakfast2', groupId: 'innBreakfast', tier: 2,
      title: '여관의 아침식사 II', price: 900,
      copy: '시작 체력 +20.',
      effect: { type: 'startHealth', amount: 20 },
    },
    {
      id: 'innBreakfast3', groupId: 'innBreakfast', tier: 3,
      title: '여관의 아침식사 III', price: 2000,
      copy: '시작 체력 +30.',
      effect: { type: 'startHealth', amount: 30 },
    },
    {
      id: 'guideBoots1', groupId: 'guideBoots', tier: 1,
      title: '길잡이 부츠 I', price: 400,
      copy: '이동 속도 +4%.',
      effect: { type: 'moveSpeedPercent', amount: 0.04 },
    },
    {
      id: 'guideBoots2', groupId: 'guideBoots', tier: 2,
      title: '길잡이 부츠 II', price: 1200,
      copy: '이동 속도 +8%.',
      effect: { type: 'moveSpeedPercent', amount: 0.08 },
    },
    {
      id: 'oldCharm', groupId: 'oldCharm', tier: 1,
      title: '낡은 호신부', price: 1500,
      copy: '피격 무적 시간 +0.2초.',
      effect: { type: 'invulnerabilityBonus', amount: 0.2 },
    },
    {
      id: 'bigPouch1', groupId: 'bigPouch', tier: 1,
      title: '큰 주머니 I', price: 300,
      copy: '보석 자석 반경 +20%.',
      effect: { type: 'magnetPercent', amount: 0.2 },
    },
    {
      id: 'bigPouch2', groupId: 'bigPouch', tier: 2,
      title: '큰 주머니 II', price: 900,
      copy: '보석 자석 반경 +40%.',
      effect: { type: 'magnetPercent', amount: 0.4 },
    },
    {
      id: 'smithyFavor', groupId: 'smithyFavor', tier: 1,
      title: '대장간 신세', price: 2500,
      copy: '시작 무기 Lv.2(예외 - 난이도 완화가 아니라 시작 상태 강화).',
      effect: { type: 'startWeaponLevel', amount: 2 },
      isDifficultyException: true,
    },
    {
      id: 'blackTowerMap', groupId: 'blackTowerMap', tier: 1,
      title: '검은탑의 지도', price: 600,
      copy: '시작 시 첫 웨이브 구성 미리보기.',
      effect: { type: 'firstWavePreview', amount: 1 },
    },
    {
      id: 'bellKeeperMemory1', groupId: 'bellKeeperMemory', tier: 1,
      title: '종지기의 기억 I', price: 1000,
      copy: '레벨업 선택지 리롤 런당 1회.',
      effect: { type: 'levelUpReroll', amount: 1 },
    },
    {
      id: 'bellKeeperMemory2', groupId: 'bellKeeperMemory', tier: 2,
      title: '종지기의 기억 II', price: 3000,
      copy: '레벨업 선택지 리롤 런당 2회.',
      effect: { type: 'levelUpReroll', amount: 2 },
    },
  ];

  // 도전 과제 12종(계획서 5절): 직업별 궁극기 달성 6 + 무피격 3분·진화 2개 동시·보스
  // 격파 등 6. 보상은 종잔향 소액. condition(runSummary, meta) => boolean.
  const ACHIEVEMENTS = [
    {
      id: 'ultimateFighter', title: '철문 파쇄자 완성', reward: 200,
      copy: '전사로 궁극기 조건을 완성하세요.',
      condition: (summary) => summary.playbookId === 'fighter' && summary.classUltimate && summary.classUltimate.ready,
    },
    {
      id: 'ultimateThief', title: '그림자 칼비꾼 완성', reward: 200,
      copy: '도적으로 궁극기 조건을 완성하세요.',
      condition: (summary) => summary.playbookId === 'thief' && summary.classUltimate && summary.classUltimate.ready,
    },
    {
      id: 'ultimateCleric', title: '태양환 사면자 완성', reward: 200,
      copy: '사제로 궁극기 조건을 완성하세요.',
      condition: (summary) => summary.playbookId === 'cleric' && summary.classUltimate && summary.classUltimate.ready,
    },
    {
      id: 'ultimateDruid', title: '고대 뿌리 문지기 완성', reward: 200,
      copy: '드루이드로 궁극기 조건을 완성하세요.',
      condition: (summary) => summary.playbookId === 'druid' && summary.classUltimate && summary.classUltimate.ready,
    },
    {
      id: 'ultimateWizard', title: '검은 서고 유성술사 완성', reward: 200,
      copy: '마법사로 궁극기 조건을 완성하세요.',
      condition: (summary) => summary.playbookId === 'wizard' && summary.classUltimate && summary.classUltimate.ready,
    },
    {
      id: 'ultimateRanger', title: '파수꾼 사냥매 완성', reward: 200,
      copy: '레인저로 궁극기 조건을 완성하세요.',
      condition: (summary) => summary.playbookId === 'ranger' && summary.classUltimate && summary.classUltimate.ready,
    },
    {
      id: 'noHit3Min', title: '무피격 3분', reward: 300,
      copy: '위험 구역·적 공격에 3분 동안 피격 없이 버티세요.',
      condition: (summary) => (summary.longestNoHitStreak || 0) >= 180,
    },
    {
      id: 'twoEvolutionsAtOnce', title: '진화 2개 동시 보유', reward: 400,
      copy: '한 런에서 진화 무기를 2개 이상 동시에 보유하세요.',
      condition: (summary) => (summary.evolvedWeaponCount || 0) >= 2,
    },
    {
      id: 'firstBossKill', title: '첫 보스 격파', reward: 500,
      copy: '검은 종 파수꾼을 처음으로 쓰러뜨리세요.',
      condition: (summary) => Boolean(summary.won),
    },
    {
      id: 'firstElite', title: '첫 엘리트 처치', reward: 100,
      copy: '엘리트를 처음으로 처치하세요.',
      condition: (summary) => (summary.eliteKills || 0) >= 1,
    },
    {
      id: 'firstChest', title: '첫 상자 획득', reward: 100,
      copy: '엘리트 상자를 처음으로 얻으세요.',
      condition: (summary) => (summary.chestsOpened || 0) >= 1,
    },
    {
      id: 'levelEightBeforeBoss', title: '문 앞의 레벨 8', reward: 250,
      copy: '보스 등장 전 레벨 8에 도달하세요.',
      condition: (summary) => (summary.levelAtBoss || 0) >= 8,
    },
  ];

  function getDefaultMeta() {
    return {
      version: STORAGE_VERSION,
      bellEssence: 0,
      totalBellEssenceEarned: 0,
      unlockedIds: [],
      achievementIds: [],
      runsCompleted: 0,
    };
  }

  // 저장 스키마 관용 로드(계획서 7절): 손상되거나 낡은 값이 섞여 있어도 항상 유효한
  // 기본 형태로 정규화한다. 예외를 던지지 않는다.
  function normalizeMeta(rawMeta) {
    const defaults = getDefaultMeta();
    if (!rawMeta || typeof rawMeta !== 'object') return defaults;
    const unlockIds = new Set(UNLOCKS.map((entry) => entry.id));
    const achievementIds = new Set(ACHIEVEMENTS.map((entry) => entry.id));
    return {
      version: STORAGE_VERSION,
      bellEssence: Number.isFinite(rawMeta.bellEssence) && rawMeta.bellEssence >= 0 ? Math.floor(rawMeta.bellEssence) : 0,
      totalBellEssenceEarned: Number.isFinite(rawMeta.totalBellEssenceEarned) && rawMeta.totalBellEssenceEarned >= 0
        ? Math.floor(rawMeta.totalBellEssenceEarned)
        : 0,
      unlockedIds: Array.isArray(rawMeta.unlockedIds)
        ? Array.from(new Set(rawMeta.unlockedIds.filter((id) => unlockIds.has(id))))
        : [],
      achievementIds: Array.isArray(rawMeta.achievementIds)
        ? Array.from(new Set(rawMeta.achievementIds.filter((id) => achievementIds.has(id))))
        : [],
      runsCompleted: Number.isInteger(rawMeta.runsCompleted) && rawMeta.runsCompleted >= 0 ? rawMeta.runsCompleted : 0,
    };
  }

  function serializeMeta(meta) {
    return JSON.stringify(normalizeMeta(meta));
  }

  function parseMeta(rawJson) {
    if (!rawJson) return getDefaultMeta();
    try {
      return normalizeMeta(JSON.parse(rawJson));
    } catch (error) {
      return getDefaultMeta();
    }
  }

  function isUnlocked(meta, unlockId) {
    return normalizeMeta(meta).unlockedIds.includes(unlockId);
  }

  function getUnlockGroupLevel(meta, groupId) {
    const normalized = normalizeMeta(meta);
    return UNLOCKS.filter((entry) => entry.groupId === groupId && normalized.unlockedIds.includes(entry.id)).length;
  }

  function getNextUnlockInGroup(meta, groupId) {
    const level = getUnlockGroupLevel(meta, groupId);
    return UNLOCKS.find((entry) => entry.groupId === groupId && entry.tier === level + 1) || null;
  }

  function canPurchaseUnlock(meta, unlockId) {
    const normalized = normalizeMeta(meta);
    const unlock = UNLOCKS.find((entry) => entry.id === unlockId);
    if (!unlock) return { ok: false, reason: 'UNKNOWN_UNLOCK' };
    if (normalized.unlockedIds.includes(unlockId)) return { ok: false, reason: 'ALREADY_UNLOCKED' };
    const previousTiersUnlocked = UNLOCKS
      .filter((entry) => entry.groupId === unlock.groupId && entry.tier < unlock.tier)
      .every((entry) => normalized.unlockedIds.includes(entry.id));
    if (!previousTiersUnlocked) return { ok: false, reason: 'PREVIOUS_TIER_REQUIRED' };
    if (normalized.bellEssence < unlock.price) return { ok: false, reason: 'INSUFFICIENT_ESSENCE' };
    return { ok: true };
  }

  // 해금 구매: 새 meta 객체를 돌려준다(원본 불변 - 순수 함수).
  function purchaseUnlock(meta, unlockId) {
    const check = canPurchaseUnlock(meta, unlockId);
    if (!check.ok) return { ok: false, reason: check.reason, meta: normalizeMeta(meta) };
    const normalized = normalizeMeta(meta);
    const unlock = UNLOCKS.find((entry) => entry.id === unlockId);
    return {
      ok: true,
      meta: {
        ...normalized,
        bellEssence: normalized.bellEssence - unlock.price,
        unlockedIds: normalized.unlockedIds.concat(unlockId),
      },
    };
  }

  // 런 종료 후 종잔향 지급 + 도전 과제 판정을 한 번에 처리한다. runSummary는
  // systems.getRunSummary()의 반환값에 playbookId/longestNoHitStreak/evolvedWeaponCount/
  // eliteKills/chestsOpened/levelAtBoss를 추가로 담아 넘겨야 한다(game.js가 조립).
  function applyRunResult(meta, runSummary) {
    const normalized = normalizeMeta(meta);
    const earned = calculateBellEssenceReward(runSummary);
    const newlyAchieved = ACHIEVEMENTS.filter((entry) => (
      !normalized.achievementIds.includes(entry.id) && entry.condition(runSummary)
    ));
    const achievementReward = newlyAchieved.reduce((sum, entry) => sum + entry.reward, 0);
    const totalEarned = earned + achievementReward;
    return {
      earned,
      achievementReward,
      totalEarned,
      newlyAchieved,
      meta: {
        ...normalized,
        bellEssence: normalized.bellEssence + totalEarned,
        totalBellEssenceEarned: normalized.totalBellEssenceEarned + totalEarned,
        achievementIds: normalized.achievementIds.concat(newlyAchieved.map((entry) => entry.id)),
        runsCompleted: normalized.runsCompleted + 1,
      },
    };
  }

  // 해금이 적용된 시작 상태 보정치를 계산한다(계획서: 해금은 난이도 완화 방향만).
  // player 객체에 직접 적용하지 않고 보정 델타만 반환 - systems.js의 createPlayer가
  // 소비한다(순수 함수 유지).
  function getUnlockedPlayerAdjustments(meta) {
    const normalized = normalizeMeta(meta);
    const adjustments = {
      startHealthBonus: 0,
      moveSpeedPercent: 0,
      invulnerabilityBonus: 0,
      magnetPercent: 0,
      startWeaponLevel: 1,
      levelUpRerolls: 0,
      firstWavePreview: false,
    };
    UNLOCKS.forEach((unlock) => {
      if (!normalized.unlockedIds.includes(unlock.id)) return;
      const effect = unlock.effect;
      if (effect.type === 'startHealth') adjustments.startHealthBonus = Math.max(adjustments.startHealthBonus, effect.amount);
      else if (effect.type === 'moveSpeedPercent') adjustments.moveSpeedPercent = Math.max(adjustments.moveSpeedPercent, effect.amount);
      else if (effect.type === 'invulnerabilityBonus') adjustments.invulnerabilityBonus = Math.max(adjustments.invulnerabilityBonus, effect.amount);
      else if (effect.type === 'magnetPercent') adjustments.magnetPercent = Math.max(adjustments.magnetPercent, effect.amount);
      else if (effect.type === 'startWeaponLevel') adjustments.startWeaponLevel = Math.max(adjustments.startWeaponLevel, effect.amount);
      else if (effect.type === 'levelUpReroll') adjustments.levelUpRerolls = Math.max(adjustments.levelUpRerolls, effect.amount);
      else if (effect.type === 'firstWavePreview') adjustments.firstWavePreview = true;
    });
    return adjustments;
  }

  // 결과 화면 "다음 목표" 1줄(계획서 4·5절): 미해금 항목 중 가장 저렴한 것을 우선한다.
  function getNextGoalPreview(meta) {
    const normalized = normalizeMeta(meta);
    const affordableSoon = UNLOCKS
      .filter((entry) => canPurchaseUnlock(normalized, entry.id).ok || canPurchaseUnlock(normalized, entry.id).reason === 'INSUFFICIENT_ESSENCE')
      .sort((a, b) => a.price - b.price)[0];
    if (affordableSoon) {
      const remaining = Math.max(0, affordableSoon.price - normalized.bellEssence);
      return remaining > 0
        ? `다음 목표: ${affordableSoon.title} (종잔향 ${remaining} 더 필요)`
        : `다음 목표: ${affordableSoon.title} 해금 가능`;
    }
    const nextAchievement = ACHIEVEMENTS.find((entry) => !normalized.achievementIds.includes(entry.id));
    if (nextAchievement) return `다음 목표: ${nextAchievement.title}`;
    return '다음 목표: 모든 해금과 도전 과제를 완료했습니다.';
  }

  const SurvivorsMeta = {
    STORAGE_KEY,
    STORAGE_VERSION,
    UNLOCKS,
    ACHIEVEMENTS,
    getDefaultMeta,
    normalizeMeta,
    serializeMeta,
    parseMeta,
    calculateBellEssenceReward,
    isUnlocked,
    getUnlockGroupLevel,
    getNextUnlockInGroup,
    canPurchaseUnlock,
    purchaseUnlock,
    applyRunResult,
    getUnlockedPlayerAdjustments,
    getNextGoalPreview,
  };

  root.DungeonworldSurvivorsMeta = SurvivorsMeta;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SurvivorsMeta;
  }
})(typeof window !== 'undefined' ? window : this);

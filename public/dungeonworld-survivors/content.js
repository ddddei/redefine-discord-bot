(function () {
  const scenes = [
    {
      at: 0,
      title: '마른 참나무 여관 앞',
      copy: '마라가 문을 걸어 잠그고, 토른이 방패를 들어 첫 고블린 무리를 막아섭니다.',
    },
    {
      at: 45,
      title: '뿌리 아래 고블린 길',
      copy: '픽이 가짜 표식 사이에서 손짓합니다. 작은 왕의 정찰병들이 뿌리 틈으로 몰려옵니다.',
    },
    {
      at: 90,
      title: '무너진 신전의 물그릇',
      copy: '정지 문양이 흔들리고 슬라임과 미믹이 첫 번째 열쇠를 둘러싸기 시작합니다.',
    },
    {
      at: 135,
      title: '오크 다리와 기억의 숲',
      copy: '바루크의 창선 너머로 그림자 늑대와 빈 갑옷이 함께 발소리를 맞춥니다.',
    },
    {
      at: 190,
      title: '검은탑의 마지막 문',
      copy: '헤르의 눈이 열리고 검은 종 파수꾼이 문 그림자를 끌어올립니다.',
    },
  ];

  const enemyTypes = {
    goblin: {
      name: '고블린 정찰병',
      colorToken: '--accent-primary',
      behavior: 'skirmisher',
      hp: 16,
      speed: 64,
      radius: 12,
      damage: 8,
      xp: 2,
    },
    slime: {
      name: '물그릇 슬라임',
      colorToken: '--status-info',
      behavior: 'lurcher',
      hp: 28,
      speed: 38,
      radius: 15,
      damage: 10,
      xp: 3,
    },
    armor: {
      name: '빈 갑옷',
      colorToken: '--text-secondary',
      behavior: 'bulwark',
      hp: 48,
      speed: 31,
      radius: 17,
      damage: 14,
      xp: 5,
    },
    wolf: {
      name: '그림자 늑대',
      colorToken: '--status-error',
      behavior: 'charger',
      hp: 24,
      speed: 86,
      radius: 13,
      damage: 11,
      xp: 4,
    },
    sentinel: {
      name: '검은 종 파수꾼',
      colorToken: '--accent-bell',
      behavior: 'boss',
      hp: 340,
      speed: 25,
      radius: 28,
      damage: 18,
      xp: 18,
    },
  };

  const wavePatterns = [
    {
      id: 'skirmish',
      at: 0,
      until: 45,
      title: '정찰 웨이브',
      copy: '고블린 정찰병이 좌우 가장자리에서 얇게 파고듭니다.',
      moveName: '위험 돌파',
      checkStat: 'dex',
      cadence: 1.05,
      pressure: 1,
      packs: [
        { type: 'goblin', count: 2, formation: 'split' },
      ],
    },
    {
      id: 'roots',
      at: 45,
      until: 90,
      title: '뿌리 매복',
      copy: '고블린은 옆으로 흔들고 슬라임은 느린 덩어리로 길을 막습니다.',
      moveName: '상황 파악',
      checkStat: 'wis',
      cadence: 1.18,
      pressure: 1.18,
      packs: [
        { type: 'goblin', count: 2, formation: 'arc' },
        { type: 'slime', count: 1, formation: 'line' },
      ],
    },
    {
      id: 'basin',
      at: 90,
      until: 135,
      title: '물그릇 압박',
      copy: '슬라임 무리가 중앙을 누르고 빈 갑옷이 느리게 길목을 닫습니다.',
      moveName: '정면 방어',
      checkStat: 'str',
      cadence: 1.34,
      pressure: 1.28,
      packs: [
        { type: 'slime', count: 3, formation: 'line' },
        { type: 'armor', count: 1, formation: 'split' },
      ],
    },
    {
      id: 'forest',
      at: 135,
      until: 205,
      title: '숲의 추격',
      copy: '그림자 늑대가 돌진하고 빈 갑옷이 뒤에서 압박합니다.',
      moveName: '의지 유지',
      checkStat: 'will',
      cadence: 1.42,
      pressure: 1.42,
      packs: [
        { type: 'wolf', count: 2, formation: 'arc' },
        { type: 'armor', count: 2, formation: 'line' },
      ],
    },
    {
      id: 'finalGate',
      at: 205,
      until: 999,
      title: '마지막 문',
      copy: '검은 종 파수꾼을 쓰러뜨려야 문이 열립니다.',
      moveName: '마지막 문 돌파',
      checkStat: 'str',
      cadence: 1.55,
      pressure: 1.5,
      packs: [
        { type: 'wolf', count: 2, formation: 'split' },
        { type: 'armor', count: 1, formation: 'arc' },
      ],
    },
  ];

  const playbooks = [
    {
      id: 'fighter',
      title: '전사',
      role: '근접 방어',
      sheetLine: '근력 +2, 정신력 +1 / 기본 공격: 철의 베기',
      text: '적 안으로 파고들어 짧은 호로 베어냅니다. 방어와 체력이 높고 접촉 피해를 버티며 길을 엽니다.',
      learned: '전사 플레이북: 철의 베기와 방패벽',
      loadout: '시작 장비: 낡은 검, 방패벽, 철의 베기',
      stats: { str: 2, dex: 0, wis: 0, will: 1 },
      attack: 'cleave',
      survival: '방패벽: 방어 +3, 긴장 상승을 크게 줄입니다.',
      upgradePool: ['fighter', 'martial', 'survival'],
      apply: (player) => {
        player.maxHealth += 22;
        player.health = player.maxHealth;
        player.damage += 10;
        player.armor += 3;
        player.attackCooldown = 0.72;
        player.cleaveRange = 76;
        player.cleaveArc = Math.PI * 0.72;
        player.tensionResist += 0.35;
      },
    },
    {
      id: 'thief',
      title: '도적',
      role: '기동 암습',
      sheetLine: '민첩 +2, 지혜 +1 / 기본 공격: 숨은 칼',
      text: '거리를 벌리고 얇은 각도로 칼을 뿌립니다. 빠르고 회피가 높지만 오래 맞서 버티지는 못합니다.',
      learned: '도적 플레이북: 빠른 발과 숨은 칼',
      loadout: '시작 장비: 숨은 칼, 부엌칼, 그림자 걸음',
      stats: { str: 0, dex: 2, wis: 1, will: 0 },
      attack: 'knives',
      survival: '그림자 걸음: 이동 속도와 회피가 높고 경험치 회수가 빠릅니다.',
      upgradePool: ['thief', 'mobility', 'trick'],
      apply: (player) => {
        player.maxHealth -= 8;
        player.health = player.maxHealth;
        player.speed *= 1.2;
        player.magnet += 44;
        player.attackCooldown = 0.48;
        player.damage += 1;
        player.dodgeChance += 0.18;
        player.fanKnives = 1;
      },
    },
    {
      id: 'cleric',
      title: '사제',
      role: '지원 의식',
      sheetLine: '지혜 +2, 정신력 +1 / 기본 공격: 축성의 빛',
      text: '가까운 적을 태우며 자신을 조금씩 회복합니다. 폭발력은 낮지만 판정과 회복이 안정적입니다.',
      learned: '사제 플레이북: 축성의 빛과 치유 기도',
      loadout: '시작 장비: 축성의 빛, 치유 기도, 잎 표식',
      stats: { str: 0, dex: 0, wis: 2, will: 1 },
      attack: 'radiance',
      survival: '치유 기도: 주기적으로 체력을 회복하고 2d6 판정 실패 피해를 낮춥니다.',
      upgradePool: ['cleric', 'faith', 'survival'],
      apply: (player) => {
        player.attackCooldown = 0.88;
        player.damage += 2;
        player.aura = true;
        player.auraDamage += 8;
        player.auraRange += 18;
        player.healPulse = 1;
        player.moveGrace += 1;
        player.health = Math.min(player.maxHealth, player.health + 14);
      },
    },
    {
      id: 'druid',
      title: '드루이드',
      role: '주술 제어',
      sheetLine: '지혜 +2, 민첩 +1 / 기본 공격: 가시뿌리',
      text: '땅을 깨워 적을 느리게 묶습니다. 숲의 징표와 변신 본능으로 포위망을 느슨하게 만듭니다.',
      learned: '드루이드 플레이북: 가시뿌리와 짐승의 형상',
      loadout: '시작 장비: 가시뿌리, 잎 고리, 짐승의 형상',
      stats: { str: 0, dex: 1, wis: 2, will: 0 },
      attack: 'roots',
      survival: '짐승의 형상: 긴장이 높아질수록 이동 속도와 둔화 범위가 커집니다.',
      upgradePool: ['druid', 'wild', 'control'],
      apply: (player) => {
        player.speed *= 1.08;
        player.attackCooldown = 0.82;
        player.damage += 4;
        player.rootSlow = 1.2;
        player.aura = true;
        player.auraDamage += 4;
        player.auraRange += 28;
        player.tensionSpeed = 0.018;
      },
    },
    {
      id: 'wizard',
      title: '마법사',
      role: '원거리 주문',
      sheetLine: '정신력 +2, 지혜 +1 / 기본 공격: 마력탄',
      text: '얇은 몸으로 거리를 잡고 관통 주문을 겹칩니다. 화력은 높지만 접촉 피해와 긴장에 취약합니다.',
      learned: '마법사 플레이북: 마력탄과 검은 서고',
      loadout: '시작 장비: 마력탄, 비전 보호막, 검은 서고',
      stats: { str: -1, dex: 0, wis: 1, will: 2 },
      attack: 'missile',
      survival: '비전 보호막: 일정 시간마다 한 번 접촉 피해를 줄입니다.',
      upgradePool: ['wizard', 'arcane', 'control'],
      apply: (player) => {
        player.maxHealth -= 14;
        player.health = player.maxHealth;
        player.attackCooldown = 0.66;
        player.damage += 7;
        player.pierce += 1;
        player.projectileSpeed += 70;
        player.arcaneShield = 1;
        player.arcaneShieldTimer = 0;
        player.tensionResist -= 0.08;
      },
    },
    {
      id: 'ranger',
      title: '레인저',
      role: '원거리 추적',
      sheetLine: '민첩 +2, 지혜 +1 / 기본 공격: 검은 화살',
      text: '가장 먼 위협을 먼저 꿰고 동료 매가 빈틈을 찍습니다. 위치 선정과 긴 사거리가 강점입니다.',
      learned: '레인저 플레이북: 검은 화살과 동료 매',
      loadout: '시작 장비: 검은 화살, 동료 매, 추적자의 거리',
      stats: { str: 0, dex: 2, wis: 1, will: 0 },
      attack: 'arrow',
      survival: '동료 매: 주기적으로 약한 적을 찍어 경험치 흐름을 만듭니다.',
      upgradePool: ['ranger', 'martial', 'mobility'],
      apply: (player) => {
        player.speed *= 1.08;
        player.attackCooldown = 0.74;
        player.damage += 12;
        player.pierce += 2;
        player.projectileSpeed += 140;
        player.projectileLife += 0.35;
        player.companionStrike = 1;
      },
    },
  ];

  const upgrades = [
    {
      id: 'thornShield',
      title: '토른의 방패',
      family: 'survival',
      pools: ['survival', 'martial'],
      maxLevel: 3,
      text: '최대 체력 +18, 접촉 피해를 조금 줄입니다. 다음 선택부터 토른의 방패 II/III로 강화됩니다.',
      apply: (player, level) => {
        player.maxHealth += 18;
        player.health = Math.min(player.maxHealth, player.health + 18);
        player.armor += level === 3 ? 3 : 2;
      },
    },
    {
      id: 'pickShortcut',
      title: '픽의 지름길',
      family: 'mobility',
      pools: ['mobility', 'trick'],
      maxLevel: 3,
      text: '이동 속도 +12%, 경험치 자석 범위가 넓어집니다.',
      apply: (player) => {
        player.speed *= 1.12;
        player.magnet += 34;
      },
    },
    {
      id: 'basinRune',
      title: '물그릇 정지 문양',
      family: 'weapon',
      pools: ['arcane', 'faith', 'control'],
      maxLevel: 4,
      text: '자동 공격 재사용 시간이 짧아집니다.',
      apply: (player) => {
        player.attackCooldown = Math.max(0.28, player.attackCooldown - 0.08);
      },
    },
    {
      id: 'barukLine',
      title: '바루크의 창선',
      family: 'weapon',
      pools: ['martial', 'ranger'],
      maxLevel: 4,
      text: '투사체 피해 +7, 관통 +1을 얻습니다.',
      apply: (player) => {
        player.damage += 7;
        player.pierce += 1;
      },
    },
    {
      id: 'rameLeaves',
      title: '라메의 잎 표식',
      family: 'control',
      pools: ['control', 'wild', 'faith'],
      maxLevel: 3,
      text: '잎 고리가 가까운 적을 느리게 하고 조금씩 피해를 줍니다.',
      apply: (player, level) => {
        player.aura = true;
        player.auraDamage += 5 + level * 2;
        player.auraRange += 12;
      },
    },
    {
      id: 'blackBell',
      title: '검은 종 파편',
      family: 'weapon',
      pools: ['arcane', 'fighter', 'wizard'],
      maxLevel: 3,
      text: '자동 공격이 두 발씩 나가지만 적 웨이브도 조금 거칠어집니다.',
      apply: (player) => {
        player.shots += 1;
        player.spawnPressure += 0.08;
      },
    },
    {
      id: 'fanKnives',
      title: '마라의 부엌칼',
      family: 'weapon',
      pools: ['thief', 'trick'],
      maxLevel: 3,
      text: '부채꼴 단검을 추가로 던져 가까운 무리를 정리합니다.',
      apply: (player, level) => {
        player.fanKnives = level;
      },
    },
    {
      id: 'oathSpear',
      title: '바루크의 맹세창',
      family: 'weapon',
      pools: ['martial', 'fighter'],
      maxLevel: 3,
      text: '주위를 도는 창이 닿은 적에게 꾸준히 피해를 줍니다.',
      apply: (player, level) => {
        player.orbitingSpears = level;
      },
    },
    {
      id: 'bellWave',
      title: '검은 종 반향',
      family: 'weapon',
      pools: ['arcane', 'faith'],
      maxLevel: 2,
      text: '느리지만 넓은 종파가 가장 가까운 적을 향해 퍼집니다.',
      apply: (player, level) => {
        player.bellWave = level;
      },
    },
    {
      id: 'shieldBash',
      title: '방패 밀어붙이기',
      family: 'playbook',
      pools: ['fighter'],
      maxLevel: 3,
      text: '전사의 베기 범위가 넓어지고 명중한 적을 짧게 늦춥니다.',
      apply: (player, level) => {
        player.cleaveRange += 16;
        player.cleaveArc += 0.08;
        player.cleaveSlow = 0.5 + level * 0.18;
      },
    },
    {
      id: 'shadowStep',
      title: '그림자 걸음',
      family: 'playbook',
      pools: ['thief'],
      maxLevel: 3,
      text: '회피율과 이동 속도가 오르고 부채꼴 단검 재사용 시간이 짧아집니다.',
      apply: (player) => {
        player.dodgeChance += 0.08;
        player.speed *= 1.06;
        player.fanCooldownBonus += 0.12;
      },
    },
    {
      id: 'healingLitany',
      title: '치유 기도문',
      family: 'playbook',
      pools: ['cleric'],
      maxLevel: 3,
      text: '치유 파동이 강해지고 웨이브 판정 실패의 긴장 증가를 줄입니다.',
      apply: (player) => {
        player.healPulse += 1;
        player.moveGrace += 1;
        player.tensionResist += 0.08;
      },
    },
    {
      id: 'beastForm',
      title: '짐승의 형상',
      family: 'playbook',
      pools: ['druid'],
      maxLevel: 3,
      text: '긴장이 높을수록 더 빨라지고 가시뿌리 둔화 시간이 늘어납니다.',
      apply: (player) => {
        player.tensionSpeed += 0.012;
        player.rootSlow += 0.38;
        player.auraRange += 10;
      },
    },
    {
      id: 'grimGrimoire',
      title: '검은 서고',
      family: 'playbook',
      pools: ['wizard'],
      maxLevel: 3,
      text: '마력탄 피해와 관통이 오르지만 웨이브 압박이 아주 조금 강해집니다.',
      apply: (player) => {
        player.damage += 9;
        player.pierce += 1;
        player.spawnPressure += 0.04;
      },
    },
    {
      id: 'hawkCompanion',
      title: '동료 매의 급강하',
      family: 'playbook',
      pools: ['ranger'],
      maxLevel: 3,
      text: '동료 매가 더 자주, 더 강하게 가장 약한 적을 찍습니다.',
      apply: (player, level) => {
        player.companionStrike = level + 1;
      },
    },
    {
      id: 'farShot',
      title: '먼 사격',
      family: 'weapon',
      pools: ['ranger', 'martial'],
      maxLevel: 3,
      text: '투사체 속도와 생존 시간이 늘어 먼 적을 먼저 정리합니다.',
      apply: (player) => {
        player.projectileSpeed += 75;
        player.projectileLife += 0.22;
      },
    },
    {
      id: 'wildThicket',
      title: '가시 덤불',
      family: 'control',
      pools: ['druid', 'wild'],
      maxLevel: 3,
      text: '가시뿌리 피해와 잎 고리 피해가 함께 오릅니다.',
      apply: (player) => {
        player.damage += 5;
        player.auraDamage += 5;
      },
    },
  ];

  window.DungeonworldSurvivorsContent = { scenes, enemyTypes, wavePatterns, playbooks, upgrades };
})();

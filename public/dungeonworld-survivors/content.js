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
      cadence: 1.55,
      pressure: 1.5,
      packs: [
        { type: 'wolf', count: 2, formation: 'split' },
        { type: 'armor', count: 1, formation: 'arc' },
      ],
    },
  ];

  const upgrades = [
    {
      id: 'thornShield',
      title: '토른의 방패',
      family: 'survival',
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
      maxLevel: 2,
      text: '느리지만 넓은 종파가 가장 가까운 적을 향해 퍼집니다.',
      apply: (player, level) => {
        player.bellWave = level;
      },
    },
  ];

  window.DungeonworldSurvivorsContent = { scenes, enemyTypes, wavePatterns, upgrades };
})();

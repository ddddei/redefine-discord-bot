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
      hp: 16,
      speed: 58,
      radius: 12,
      damage: 8,
      xp: 2,
    },
    slime: {
      name: '물그릇 슬라임',
      colorToken: '--status-info',
      hp: 28,
      speed: 38,
      radius: 15,
      damage: 10,
      xp: 3,
    },
    armor: {
      name: '빈 갑옷',
      colorToken: '--text-secondary',
      hp: 48,
      speed: 31,
      radius: 17,
      damage: 14,
      xp: 5,
    },
    wolf: {
      name: '그림자 늑대',
      colorToken: '--status-error',
      hp: 24,
      speed: 86,
      radius: 13,
      damage: 11,
      xp: 4,
    },
    sentinel: {
      name: '검은 종 파수꾼',
      colorToken: '--accent-bell',
      hp: 220,
      speed: 28,
      radius: 28,
      damage: 18,
      xp: 18,
    },
  };

  const upgrades = [
    {
      id: 'thornShield',
      title: '토른의 방패',
      text: '최대 체력 +18, 접촉 피해를 조금 줄입니다.',
      apply: (player) => {
        player.maxHealth += 18;
        player.health = Math.min(player.maxHealth, player.health + 18);
        player.armor += 2;
      },
    },
    {
      id: 'pickShortcut',
      title: '픽의 지름길',
      text: '이동 속도 +12%, 경험치 자석 범위가 넓어집니다.',
      apply: (player) => {
        player.speed *= 1.12;
        player.magnet += 34;
      },
    },
    {
      id: 'basinRune',
      title: '물그릇 정지 문양',
      text: '자동 공격 재사용 시간이 짧아집니다.',
      apply: (player) => {
        player.attackCooldown = Math.max(0.28, player.attackCooldown - 0.08);
      },
    },
    {
      id: 'barukLine',
      title: '바루크의 창선',
      text: '투사체 피해 +7, 관통 +1을 얻습니다.',
      apply: (player) => {
        player.damage += 7;
        player.pierce += 1;
      },
    },
    {
      id: 'rameLeaves',
      title: '라메의 잎 표식',
      text: '3초마다 가까운 적을 느리게 하는 잎 고리가 돕습니다.',
      apply: (player) => {
        player.aura = true;
      },
    },
    {
      id: 'blackBell',
      title: '검은 종 파편',
      text: '자동 공격이 두 발씩 나가지만 적 웨이브도 조금 거칠어집니다.',
      apply: (player) => {
        player.shots += 1;
        player.spawnPressure += 0.08;
      },
    },
  ];

  window.DungeonworldSurvivorsContent = { scenes, enemyTypes, upgrades };
})();

(function () {
  const scenes = [
    {
      at: 0,
      title: '마른 참나무 여관 앞',
      copy: '마라가 문을 걸어 잠그고, 토른이 방패를 들어 첫 고블린 무리를 막아섭니다.',
      backgroundKey: 'inn',
    },
    {
      at: 45,
      title: '뿌리 아래 고블린 길',
      copy: '픽이 가짜 표식 사이에서 손짓합니다. 작은 왕의 정찰병들이 뿌리 틈으로 몰려옵니다.',
      backgroundKey: 'ruins',
    },
    {
      at: 90,
      title: '무너진 신전의 물그릇',
      copy: '정지 문양이 흔들리고 슬라임과 미믹이 첫 번째 열쇠를 둘러싸기 시작합니다.',
      backgroundKey: 'basin',
    },
    {
      at: 135,
      title: '오크 다리와 기억의 숲',
      copy: '바루크의 창선 너머로 그림자 늑대와 빈 갑옷이 함께 발소리를 맞춥니다.',
      backgroundKey: 'forest',
    },
    {
      at: 190,
      title: '검은탑의 마지막 문',
      copy: '헤르의 눈이 열리고 검은 종 파수꾼이 문 그림자를 끌어올립니다.',
      backgroundKey: 'towerGate',
    },
  ];

  const balance = {
    earlyGame: {
      spawnGrace: 1.6,
      baseSpawnCadence: 1.28,
      contactDamageScale: 0.62,
      contactDamageScaleUntil: 75,
      xpCurve: { firstLevel: 4, growth: 1.28, flat: 3 },
      classAdjustments: {
        fighter: { damage: 2, magnet: 14 },
        cleric: { auraDamage: 2, firstHealTimer: 2.6 },
        thief: { damage: 1, magnet: 18 },
        druid: { damage: 2, auraDamage: 2, auraRange: 8, magnet: 14, rootSlow: 0.12 },
        wizard: { magnet: 10, projectileSpeed: 20, arcaneShieldTimer: 2.4 },
        ranger: { magnet: 28, companionTimer: 1.8, projectileLife: 0.12 },
      },
    },
    boss: {
      spawnAt: 198,
      targetLevel: 8,
      hpScale: 0.92,
      firstPatternDelay: 1,
    },
  };

  // 성능 예산(고도화 v1 계획서 1절 작업 A). CPU 4x 스로틀 + 375x812 뷰포트에서
  // tick+render 프레임 비용을 실측(방법: state.enemies/projectiles/particles를 이
  // 상한으로 채운 뒤 200프레임 반복 측정, 격리된 QA 하네스 - game.js runPerfProbe).
  // 실측 결과(스로틀 미지원 환경에서 실측 후 4배 스케일 적용, 방법론은 계획서/보고에
  // 명시): 상한 동시 충족 시 combined avg ~0.94ms, p95 ~3.6ms(4배 투영 시 avg ~3.8ms,
  // p95 ~14.4ms) - 30fps 프레임 예산(33.3ms) 내 여유 확보. 목표 예산 그대로 확정.
  const performanceBudget = {
    maxConcurrentEnemies: 120,
    maxConcurrentProjectiles: 80,
    maxConcurrentParticles: 60,
    targetFps: 30,
    measuredAt: '2026-07-06',
    measurementNote: 'CPU 4x 스로틀 프로파일 실측 - 격리 하네스(runPerfProbe)로 상한 개체수에서 tick+render 프레임 비용 측정 후 4배 스케일 투영, 375x812 뷰포트 기준',
  };

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
      attackProfile: {
        range: 58,
        windup: 0.38,
        recovery: 1.1,
        shape: 'cone',
        arc: Math.PI * 0.45,
        reach: 68,
        damageScale: 0.75,
        warningColorToken: '--accent-ember',
        warningLabel: '비껴 찌르기',
      },
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
      attackProfile: {
        range: 76,
        windup: 0.62,
        recovery: 1.45,
        shape: 'circle',
        radius: 58,
        damageScale: 0.85,
        warningColorToken: '--status-info',
        warningLabel: '점액 분출',
      },
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
      attackProfile: {
        range: 88,
        windup: 0.74,
        recovery: 1.65,
        shape: 'arc',
        arc: Math.PI * 0.7,
        reach: 86,
        damageScale: 1,
        warningColorToken: '--text-secondary',
        warningLabel: '녹슨 휘두르기',
      },
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
      attackProfile: {
        range: 128,
        windup: 0.45,
        recovery: 1.3,
        shape: 'line',
        length: 150,
        width: 28,
        damageScale: 0.95,
        warningColorToken: '--status-error',
        warningLabel: '그림자 돌진',
      },
    },
    mimic: {
      name: '물그릇 미믹',
      colorToken: '--accent-ember',
      behavior: 'ambusher',
      hp: 42,
      speed: 46,
      radius: 18,
      damage: 13,
      xp: 7,
      attackProfile: {
        range: 112,
        windup: 0.7,
        recovery: 1.55,
        shape: 'cone',
        arc: Math.PI * 0.58,
        reach: 116,
        damageScale: 1.08,
        warningColorToken: '--accent-ember',
        warningLabel: '상자 이빨',
      },
    },
    cultist: {
      name: '검은 종 신도',
      colorToken: '--accent-bell',
      behavior: 'caster',
      hp: 34,
      speed: 42,
      radius: 14,
      damage: 12,
      xp: 6,
      attackProfile: {
        range: 168,
        windup: 0.86,
        recovery: 1.75,
        shape: 'ring',
        radius: 86,
        width: 28,
        damageScale: 0.95,
        warningColorToken: '--accent-bell',
        warningLabel: '종말 기도',
      },
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
      attackProfile: {
        range: 145,
        windup: 0.78,
        recovery: 1.55,
        shape: 'ring',
        radius: 118,
        width: 34,
        damageScale: 1.1,
        warningColorToken: '--accent-bell',
        warningLabel: '검은 종 울림',
      },
      bossPhases: [
        {
          id: 'gateBell',
          threshold: 1,
          title: '문 앞의 종',
          warning: '검은 종 원형 파동',
          pattern: 'ring',
          cadence: 3.2,
        },
        {
          id: 'towerGaze',
          threshold: 0.66,
          title: '탑의 시선',
          warning: '탑 그림자 직선 예고',
          pattern: 'line',
          cadence: 2.7,
        },
        {
          id: 'lastToll',
          threshold: 0.33,
          title: '마지막 종소리',
          warning: '협공 소환과 넓은 종파',
          pattern: 'summon',
          cadence: 2.4,
        },
        {
          id: 'brokenGate',
          threshold: 0.18,
          title: '무너진 문턱',
          warning: '십자형 종압과 신도 소환',
          pattern: 'cross',
          cadence: 2.15,
        },
      ],
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
      objective: '정찰병의 얇은 포위를 뚫고 길을 여세요.',
      backgroundKey: 'inn',
      pressureRule: 'edge-skirmish',
      hazards: [],
      cadence: 1.18,
      pressure: 0.9,
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
      objective: '뿌리 표식이 빛나기 전에 안전한 길을 골라 움직이세요.',
      backgroundKey: 'ruins',
      pressureRule: 'snare-circles',
      hazards: [
        { kind: 'rootSnare', cadence: 5.4, warning: 0.9, duration: 2.2, radius: 62, slow: 1.2, tension: 0.5, colorToken: '--class-druid', label: '뿌리 매듭' },
      ],
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
      objective: '물그릇 주변의 느린 웅덩이를 피해 갑옷의 길목 봉쇄를 버티세요.',
      backgroundKey: 'basin',
      pressureRule: 'basin-pools',
      hazards: [
        { kind: 'basinPool', cadence: 4.8, warning: 0.8, duration: 2.8, radius: 74, damage: 2.6, slow: 1.6, colorToken: '--status-info', label: '물그릇 웅덩이' },
        { kind: 'mimicBite', cadence: 6.4, warning: 0.82, duration: 1.3, radius: 58, damage: 6, tension: 0.45, colorToken: '--accent-ember', label: '미믹 이빨' },
      ],
      cadence: 1.34,
      pressure: 1.28,
      packs: [
        { type: 'slime', count: 3, formation: 'line' },
        { type: 'armor', count: 1, formation: 'split' },
        { type: 'mimic', count: 1, formation: 'arc' },
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
      objective: '늑대의 직선 돌진로를 읽고 빈 갑옷 사이를 빠져나가세요.',
      backgroundKey: 'forest',
      pressureRule: 'charge-lanes',
      hazards: [
        { kind: 'wolfLane', cadence: 4.2, warning: 0.72, duration: 1.25, length: 280, width: 42, damage: 7, tension: 0.7, colorToken: '--status-error', label: '늑대 돌진로' },
        { kind: 'thornCross', cadence: 6.2, warning: 0.9, duration: 1.45, length: 210, width: 34, damage: 5, slow: 1.1, colorToken: '--class-druid', label: '가시 십자로' },
      ],
      cadence: 1.42,
      pressure: 1.42,
      packs: [
        { type: 'wolf', count: 2, formation: 'arc' },
        { type: 'armor', count: 2, formation: 'line' },
        { type: 'mimic', count: 1, formation: 'split' },
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
      objective: '파수꾼의 종파와 탑 그림자를 읽고 보스를 쓰러뜨리세요.',
      backgroundKey: 'towerGate',
      pressureRule: 'bell-rings',
      hazards: [
        { kind: 'bellRing', cadence: 4.6, warning: 0.95, duration: 1.7, radius: 112, width: 34, damage: 8, tension: 0.9, colorToken: '--accent-bell', label: '검은 종파' },
        { kind: 'towerGaze', cadence: 5.8, warning: 1, duration: 1.2, length: 360, width: 54, damage: 9, tension: 0.65, colorToken: '--accent-bell', label: '탑의 눈길' },
      ],
      cadence: 1.55,
      pressure: 1.5,
      packs: [
        { type: 'wolf', count: 2, formation: 'split' },
        { type: 'armor', count: 1, formation: 'arc' },
        { type: 'cultist', count: 2, formation: 'line' },
      ],
    },
  ];

  const standardScenes = [
    { at: 0, title: '마른 참나무 여관 앞', copy: '첫 3분은 보석을 모으고 시작 무기를 익히는 시간입니다.', backgroundKey: 'inn' },
    { at: 180, title: '뿌리 아래 고블린 길', copy: '웨이브가 길어집니다. 같은 무기와 패시브를 반복해 진화 조건을 준비하세요.', backgroundKey: 'ruins' },
    { at: 360, title: '무너진 신전의 물그릇', copy: '미믹과 슬라임이 보석 길을 막습니다. 엘리트 상자를 노릴 준비를 합니다.', backgroundKey: 'basin' },
    { at: 540, title: '오크 다리와 기억의 숲', copy: '늑대 돌진과 빈 갑옷이 겹칩니다. 생존 패시브가 빛나는 구간입니다.', backgroundKey: 'forest' },
    { at: 720, title: '검은 종의 중턱', copy: '15분을 향해 압박이 올라갑니다. 진화 무기가 있다면 런의 방향이 선명해집니다.', backgroundKey: 'forest' },
    { at: 900, title: '검은탑으로 가는 긴 길', copy: '20분까지는 화력과 자석 범위가 성장 속도를 가릅니다.', backgroundKey: 'forest' },
    { at: 1200, title: '마지막 문 앞 숲', copy: '25분 이후에는 엘리트와 위험 구역을 모두 읽어야 합니다.', backgroundKey: 'towerGate' },
    { at: 1500, title: '검은 종 아래', copy: '29분까지 살아남으면 마지막 문의 균열이 열리기 시작합니다.', backgroundKey: 'towerGate' },
    { at: 1740, title: '마지막 문', copy: '30분까지 버티세요. 검은 종 파수꾼이 마지막 문을 지키고 있습니다.', backgroundKey: 'towerGate' },
  ];

  const standardWavePatterns = [
    {
      id: 'standard-0-3',
      at: 0,
      until: 180,
      title: '0~3분: 여관 앞 정찰',
      copy: '고블린 정찰병과 슬라임이 얇게 밀려옵니다.',
      moveName: '위험 돌파',
      checkStat: 'dex',
      objective: '보석을 먹어 첫 레벨업을 만들고 시작 무기를 강화하세요.',
      backgroundKey: 'inn',
      pressureRule: 'edge-skirmish',
      hazards: [],
      cadence: 1.18,
      pressure: 0.92,
      packs: [
        { type: 'goblin', count: 2, formation: 'split' },
      ],
    },
    {
      id: 'standard-3-6',
      at: 180,
      until: 360,
      title: '3~6분: 뿌리 매복',
      copy: '뿌리 매듭이 길을 묶고 고블린 무리가 양쪽에서 흔듭니다.',
      moveName: '상황 파악',
      checkStat: 'wis',
      objective: '무기 Lv.8과 맞는 패시브 조합을 의식하며 선택지를 고르세요.',
      backgroundKey: 'ruins',
      pressureRule: 'snare-circles',
      hazards: [
        { kind: 'rootSnare', cadence: 5.8, warning: 1, duration: 2.1, radius: 64, slow: 1.15, tension: 0.45, colorToken: '--class-druid', label: '뿌리 매듭' },
      ],
      cadence: 1.26,
      pressure: 1.08,
      packs: [
        { type: 'goblin', count: 2, formation: 'arc' },
        { type: 'slime', count: 1, formation: 'line' },
      ],
    },
    {
      id: 'standard-6-9',
      at: 360,
      until: 540,
      title: '6~9분: 물그릇 압박',
      copy: '미믹과 슬라임이 경험치 길을 막고 빈 갑옷이 뒤늦게 닫습니다.',
      moveName: '정면 방어',
      checkStat: 'str',
      objective: '첫 엘리트 상자 이후 진화 조건을 완성할 방향을 잡으세요.',
      backgroundKey: 'basin',
      pressureRule: 'basin-pools',
      hazards: [
        { kind: 'basinPool', cadence: 4.8, warning: 0.8, duration: 2.8, radius: 74, damage: 3, slow: 1.6, colorToken: '--status-info', label: '물그릇 웅덩이' },
        { kind: 'mimicBite', cadence: 6.2, warning: 0.82, duration: 1.3, radius: 60, damage: 6, tension: 0.45, colorToken: '--accent-ember', label: '미믹 이빨' },
      ],
      cadence: 1.28,
      pressure: 1.32,
      packs: [
        { type: 'slime', count: 3, formation: 'line' },
        { type: 'mimic', count: 1, formation: 'arc' },
        { type: 'armor', count: 1, formation: 'split' },
      ],
    },
    {
      id: 'standard-9-12',
      at: 540,
      until: 720,
      title: '9~12분: 숲의 추격',
      copy: '그림자 늑대와 빈 갑옷이 직선 돌진로를 만들며 몰아붙입니다.',
      moveName: '의지 유지',
      checkStat: 'will',
      objective: '위험 구역을 읽고 상자를 먹을 안전한 틈을 만드세요.',
      backgroundKey: 'forest',
      pressureRule: 'charge-lanes',
      hazards: [
        { kind: 'wolfLane', cadence: 4.2, warning: 0.72, duration: 1.25, length: 300, width: 42, damage: 7, tension: 0.7, colorToken: '--status-error', label: '늑대 돌진로' },
        { kind: 'thornCross', cadence: 6.2, warning: 0.9, duration: 1.45, length: 230, width: 34, damage: 5, slow: 1.1, colorToken: '--class-druid', label: '가시 십자로' },
      ],
      cadence: 1.38,
      pressure: 1.45,
      packs: [
        { type: 'wolf', count: 2, formation: 'arc' },
        { type: 'armor', count: 2, formation: 'line' },
        { type: 'mimic', count: 1, formation: 'split' },
      ],
    },
    {
      id: 'standard-12-15',
      at: 720,
      until: 900,
      title: '12~15분: 검은 종 중턱',
      copy: '검은 종 신도가 원형 기도를 겹치고 숲의 적들이 뒤섞입니다.',
      moveName: '마지막 문 예감',
      checkStat: 'will',
      objective: '무기 Lv.8과 패시브를 맞춰 다음 상자 진화를 노리세요.',
      backgroundKey: 'forest',
      pressureRule: 'bell-rings',
      hazards: [
        { kind: 'bellRing', cadence: 5, warning: 0.95, duration: 1.7, radius: 112, width: 34, damage: 8, tension: 0.8, colorToken: '--accent-bell', label: '검은 종파' },
      ],
      cadence: 1.42,
      pressure: 1.56,
      packs: [
        { type: 'cultist', count: 2, formation: 'line' },
        { type: 'wolf', count: 2, formation: 'split' },
        { type: 'armor', count: 2, formation: 'arc' },
      ],
    },
    {
      id: 'standard-15-20',
      at: 900,
      until: 1200,
      title: '15~20분: 긴 검은 길',
      copy: '중반 이후 적 밀도가 커지고 종파와 돌진로가 번갈아 열립니다.',
      moveName: '압박 견디기',
      checkStat: 'str',
      objective: '진화 무기를 한 개 이상 확보하면 20분 이후가 안정됩니다.',
      backgroundKey: 'forest',
      pressureRule: 'mixed-pressure',
      hazards: [
        { kind: 'bellRing', cadence: 4.7, warning: 0.9, duration: 1.7, radius: 118, width: 36, damage: 8, tension: 0.85, colorToken: '--accent-bell', label: '검은 종파' },
        { kind: 'wolfLane', cadence: 4, warning: 0.68, duration: 1.2, length: 330, width: 44, damage: 7, tension: 0.7, colorToken: '--status-error', label: '늑대 돌진로' },
      ],
      cadence: 1.5,
      pressure: 1.78,
      packs: [
        { type: 'cultist', count: 2, formation: 'arc' },
        { type: 'wolf', count: 3, formation: 'split' },
        { type: 'mimic', count: 2, formation: 'line' },
      ],
    },
    {
      id: 'standard-20-25',
      at: 1200,
      until: 1500,
      title: '20~25분: 문 앞 숲',
      copy: '탑의 눈길이 길게 지나가며 빈 갑옷과 신도가 문 앞을 채웁니다.',
      moveName: '문턱 버티기',
      checkStat: 'wis',
      objective: '상자 보상은 진화 조건을 먼저 확인합니다. 조건이 맞으면 진화가 우선입니다.',
      backgroundKey: 'towerGate',
      pressureRule: 'tower-gaze',
      hazards: [
        { kind: 'towerGaze', cadence: 5.4, warning: 1, duration: 1.2, length: 390, width: 56, damage: 9, tension: 0.7, colorToken: '--accent-bell', label: '탑의 눈길' },
        { kind: 'thornCross', cadence: 5.8, warning: 0.86, duration: 1.45, length: 250, width: 36, damage: 6, slow: 1.2, colorToken: '--class-druid', label: '가시 십자로' },
      ],
      cadence: 1.58,
      pressure: 2.05,
      packs: [
        { type: 'armor', count: 3, formation: 'line' },
        { type: 'cultist', count: 3, formation: 'arc' },
        { type: 'wolf', count: 2, formation: 'split' },
      ],
    },
    {
      id: 'standard-25-29',
      at: 1500,
      until: 1740,
      title: '25~29분: 검은 종 아래',
      copy: '모든 적군이 섞이고 상자를 먹는 순간도 위험해집니다.',
      moveName: '마지막 호흡',
      checkStat: 'dex',
      objective: '남은 상자로 핵심 무기나 패시브를 마지막 단계까지 밀어 올리세요.',
      backgroundKey: 'towerGate',
      pressureRule: 'last-hold',
      hazards: [
        { kind: 'bellRing', cadence: 4.4, warning: 0.86, duration: 1.6, radius: 124, width: 38, damage: 9, tension: 0.95, colorToken: '--accent-bell', label: '검은 종파' },
        { kind: 'towerGaze', cadence: 5.1, warning: 0.95, duration: 1.2, length: 420, width: 58, damage: 10, tension: 0.75, colorToken: '--accent-bell', label: '탑의 눈길' },
      ],
      cadence: 1.66,
      pressure: 2.32,
      packs: [
        { type: 'cultist', count: 3, formation: 'line' },
        { type: 'wolf', count: 3, formation: 'arc' },
        { type: 'armor', count: 3, formation: 'split' },
        { type: 'mimic', count: 2, formation: 'arc' },
      ],
    },
    {
      id: 'standard-29-30',
      at: 1740,
      until: 1800,
      title: '29~30분: 마지막 문',
      copy: '마지막 문이 열리기 전 검은 종 파수꾼이 직접 나타납니다.',
      moveName: '마지막 문 돌파',
      checkStat: 'str',
      objective: '30분까지 버티고 검은 종 파수꾼의 마지막 전조를 넘기세요.',
      backgroundKey: 'towerGate',
      pressureRule: 'final-door',
      hazards: [
        { kind: 'bellRing', cadence: 4.2, warning: 0.86, duration: 1.6, radius: 130, width: 40, damage: 10, tension: 1, colorToken: '--accent-bell', label: '검은 종파' },
        { kind: 'towerGaze', cadence: 4.8, warning: 0.9, duration: 1.18, length: 450, width: 60, damage: 11, tension: 0.8, colorToken: '--accent-bell', label: '탑의 눈길' },
      ],
      cadence: 1.72,
      pressure: 2.55,
      packs: [
        { type: 'cultist', count: 4, formation: 'line' },
        { type: 'armor', count: 3, formation: 'arc' },
        { type: 'wolf', count: 4, formation: 'split' },
      ],
    },
  ];

  const runGoals = [
    {
      id: 'fighter-close-vow',
      playbooks: ['fighter'],
      type: 'level_before_boss',
      title: '문 앞에 설 힘',
      copy: '보스 등장 전까지 레벨 8에 도달하세요.',
      target: 8,
      near: 7,
    },
    {
      id: 'thief-clean-bell',
      playbooks: ['thief'],
      type: 'boss_avoid',
      title: '종소리 밑의 발놀림',
      copy: '보스 패턴을 3번 피하고, 보스 패턴 피격은 1회 이하로 끝내세요.',
      avoidTarget: 3,
      maxHits: 1,
      nearAvoid: 2,
    },
    {
      id: 'cleric-faith-anchor',
      playbooks: ['cleric'],
      type: 'tag_combo',
      title: '기도 닻 완성',
      copy: '#faith 또는 #survival 태그를 합쳐 3개 완성하세요.',
      tags: ['faith', 'survival'],
      target: 3,
      near: 2,
    },
    {
      id: 'druid-safe-forest',
      playbooks: ['druid'],
      type: 'hazard_damage',
      title: '숲의 상처 줄이기',
      copy: '위험 구역 피해를 12 이하로 억제하세요.',
      maxDamage: 12,
      nearDamage: 18,
    },
    {
      id: 'wizard-arcane-ward',
      playbooks: ['wizard'],
      type: 'tag_combo',
      title: '비전 결계 완성',
      copy: '#arcane 또는 #shield 태그를 합쳐 3개 완성하세요.',
      tags: ['arcane', 'shield'],
      target: 3,
      near: 2,
    },
    {
      id: 'ranger-marked-gate',
      playbooks: ['ranger'],
      type: 'boss_time',
      title: '표식이 사라지기 전에',
      copy: '보스 등장 후 45초 안에 파수꾼을 쓰러뜨리세요.',
      targetSeconds: 45,
      nearSeconds: 60,
    },
    {
      id: 'shared-forest-hunt',
      playbooks: ['fighter', 'thief', 'cleric', 'druid', 'wizard', 'ranger'],
      type: 'wave_kills',
      title: '숲의 추격 돌파',
      copy: '숲의 추격 웨이브에서 적 18체를 처치하세요.',
      waveId: 'forest',
      target: 18,
      near: 14,
    },
    {
      id: 'shared-boss-build',
      playbooks: ['fighter', 'thief', 'cleric', 'druid', 'wizard', 'ranger'],
      type: 'tag_combo',
      title: '마지막 문 빌드',
      copy: '#boss, #bell, #pierce 중 2개를 완성하세요.',
      tags: ['boss', 'bell', 'pierce'],
      target: 2,
      near: 1,
    },
  ];

  const elitePatterns = {
    armor: {
      title: '철문 봉쇄',
      modifier: 'guardBreak',
      warningLabel: '엘리트 철문 휘두르기',
      copy: '빈 갑옷 엘리트는 더 넓은 호로 길목을 닫습니다.',
    },
    mimic: {
      title: '굶주린 상자',
      modifier: 'jawAmbush',
      warningLabel: '엘리트 상자 이빨',
      copy: '미믹 엘리트는 이빨 예고가 넓고 상자 근처 압박이 큽니다.',
    },
    cultist: {
      title: '검은 종 성가',
      modifier: 'bellChoir',
      warningLabel: '엘리트 종말 기도',
      copy: '신도 엘리트는 원형 종파를 더 자주 겹칩니다.',
    },
    wolf: {
      title: '긴 그림자 돌진',
      modifier: 'longCharge',
      warningLabel: '엘리트 그림자 돌진',
      copy: '늑대 엘리트는 길고 얇은 돌진로를 남깁니다.',
    },
  };

  const playbooks = [
    {
      id: 'fighter',
      title: '전사',
      role: '근접 방어',
      crest: 'shield',
      combatMood: 'heavy-metal',
      visualCue: '두꺼운 방패선과 짧은 쇳빛 베기',
      accentToken: '--class-fighter',
      secondaryToken: '--class-fighter-soft',
      sheetLine: '근력 +2, 정신력 +1 / 기본 공격: 철의 베기',
      text: '적 안으로 파고들어 짧은 호로 베어냅니다. 방어와 체력이 높고 접촉 피해를 버티며 길을 엽니다.',
      learned: '전사 플레이북: 철의 베기와 방패벽',
      loadout: '시작 장비: 낡은 검, 방패벽, 철의 베기',
      stats: { str: 2, dex: 0, wis: 0, will: 1 },
      attack: 'cleave',
      survival: '방패벽: 방어 +3, 긴장 상승을 크게 줄입니다.',
      upgradePool: ['fighter', 'martial', 'survival'],
      ultimate: {
        title: '철문 파쇄자',
        resultName: '철문 파쇄자',
        tags: ['shield', 'boss'],
        copy: '방패선과 보스 압박을 갖추면 마지막 문 앞에서 버티며 밀어붙이는 전사 빌드입니다.',
      },
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
      crest: 'blade',
      combatMood: 'ambush',
      visualCue: '얇은 단검 잔상과 빠른 후퇴선',
      accentToken: '--class-thief',
      secondaryToken: '--class-thief-soft',
      sheetLine: '민첩 +2, 지혜 +1 / 기본 공격: 숨은 칼',
      text: '거리를 벌리고 얇은 각도로 칼을 뿌립니다. 빠르고 회피가 높지만 오래 맞서 버티지는 못합니다.',
      learned: '도적 플레이북: 빠른 발과 숨은 칼',
      loadout: '시작 장비: 숨은 칼, 부엌칼, 그림자 걸음',
      stats: { str: 0, dex: 2, wis: 1, will: 0 },
      attack: 'knives',
      survival: '그림자 걸음: 이동 속도와 회피가 높고 경험치 회수가 빠릅니다.',
      upgradePool: ['thief', 'mobility', 'trick'],
      ultimate: {
        title: '그림자 칼비꾼',
        resultName: '그림자 칼비꾼',
        tags: ['blade', 'mobility'],
        copy: '칼날 박자와 기동 태그가 모이면 보스 전조 뒤 폭딜 창을 여는 도적 빌드입니다.',
      },
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
      crest: 'halo',
      combatMood: 'consecration',
      visualCue: '원형 빛 파동과 치유 잔광',
      accentToken: '--class-cleric',
      secondaryToken: '--class-cleric-soft',
      sheetLine: '지혜 +2, 정신력 +1 / 기본 공격: 축성의 빛',
      text: '가까운 적을 태우며 자신을 조금씩 회복합니다. 폭발력은 낮지만 판정과 회복이 안정적입니다.',
      learned: '사제 플레이북: 축성의 빛과 치유 기도',
      loadout: '시작 장비: 축성의 빛, 치유 기도, 잎 표식',
      stats: { str: 0, dex: 0, wis: 2, will: 1 },
      attack: 'radiance',
      survival: '치유 기도: 주기적으로 체력을 회복하고 2d6 판정 실패 피해를 낮춥니다.',
      upgradePool: ['cleric', 'faith', 'survival'],
      ultimate: {
        title: '태양환 사면자',
        resultName: '태양환 사면자',
        tags: ['faith', 'bell'],
        copy: '기도 닻과 검은 종 사면을 함께 챙긴 사제는 피격 뒤 회복으로 전선을 붙잡습니다.',
      },
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
      crest: 'root',
      combatMood: 'wild-ritual',
      visualCue: '갈라지는 땅과 뿌리 사슬',
      accentToken: '--class-druid',
      secondaryToken: '--class-druid-soft',
      sheetLine: '지혜 +2, 민첩 +1 / 기본 공격: 가시뿌리',
      text: '땅을 깨워 적을 느리게 묶습니다. 숲의 징표와 변신 본능으로 포위망을 느슨하게 만듭니다.',
      learned: '드루이드 플레이북: 가시뿌리와 짐승의 형상',
      loadout: '시작 장비: 가시뿌리, 잎 고리, 짐승의 형상',
      stats: { str: 0, dex: 1, wis: 2, will: 0 },
      attack: 'roots',
      survival: '짐승의 형상: 긴장이 높아질수록 이동 속도와 둔화 범위가 커집니다.',
      upgradePool: ['druid', 'wild', 'control'],
      ultimate: {
        title: '고대 뿌리 문지기',
        resultName: '고대 뿌리 문지기',
        tags: ['root', 'control'],
        copy: '뿌리와 제어 태그를 모으면 보스 패턴 뒤 둔화로 문 앞 공간을 되찾습니다.',
      },
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
      crest: 'rune',
      combatMood: 'arcane',
      visualCue: '각진 룬과 보랏빛 보호막',
      accentToken: '--class-wizard',
      secondaryToken: '--class-wizard-soft',
      sheetLine: '정신력 +2, 지혜 +1 / 기본 공격: 마력탄',
      text: '얇은 몸으로 거리를 잡고 관통 주문을 겹칩니다. 화력은 높지만 접촉 피해와 긴장에 취약합니다.',
      learned: '마법사 플레이북: 마력탄과 검은 서고',
      loadout: '시작 장비: 마력탄, 비전 보호막, 검은 서고',
      stats: { str: -1, dex: 0, wis: 1, will: 2 },
      attack: 'missile',
      survival: '비전 보호막: 일정 시간마다 한 번 접촉 피해를 줄입니다.',
      upgradePool: ['wizard', 'arcane', 'control'],
      ultimate: {
        title: '검은 서고 유성술사',
        resultName: '검은 서고 유성술사',
        tags: ['arcane', 'pierce'],
        copy: '비전 결계와 관통 주문을 겹친 마법사는 보호막 뒤 주문 피해를 끌어올립니다.',
      },
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
      crest: 'hawk',
      combatMood: 'hunt',
      visualCue: '긴 화살 궤적과 매의 표식',
      accentToken: '--class-ranger',
      secondaryToken: '--class-ranger-soft',
      sheetLine: '민첩 +2, 지혜 +1 / 기본 공격: 검은 화살',
      text: '가장 먼 위협을 먼저 꿰고 동료 매가 빈틈을 찍습니다. 위치 선정과 긴 사거리가 강점입니다.',
      learned: '레인저 플레이북: 검은 화살과 동료 매',
      loadout: '시작 장비: 검은 화살, 동료 매, 추적자의 거리',
      stats: { str: 0, dex: 2, wis: 1, will: 0 },
      attack: 'arrow',
      survival: '동료 매: 주기적으로 약한 적을 찍어 경험치 흐름을 만듭니다.',
      upgradePool: ['ranger', 'martial', 'mobility'],
      ultimate: {
        title: '파수꾼 사냥매',
        resultName: '파수꾼 사냥매',
        tags: ['hunt', 'pierce'],
        copy: '추적 표식과 관통을 갖춘 레인저는 거리를 유지하며 마지막 문 보스를 녹입니다.',
      },
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
    {
      id: 'ironVow',
      title: '철의 맹세',
      family: 'playbook',
      pools: ['fighter'],
      maxLevel: 3,
      text: '보스와 빈 갑옷에게 주는 피해가 오르고 몸싸움 피해를 더 낮춥니다.',
      apply: (player, level) => {
        player.bossDamageBonus += 0.06 + level * 0.02;
        player.armor += 1;
        player.tensionResist += 0.04;
      },
    },
    {
      id: 'guardedAdvance',
      title: '방패 전진',
      family: 'playbook',
      pools: ['fighter'],
      maxLevel: 3,
      text: '베기 후 짧게 빨라지고 경험치 자석 범위가 넓어집니다.',
      apply: (player) => {
        player.speed *= 1.04;
        player.magnet += 22;
        player.cleaveSlow += 0.16;
      },
    },
    {
      id: 'backstabRhythm',
      title: '뒤찌르기 박자',
      family: 'playbook',
      pools: ['thief'],
      maxLevel: 3,
      text: '단검과 부채꼴 칼 피해가 오르고 회피 직후 공격 주기가 짧아집니다.',
      apply: (player, level) => {
        player.damage += 3 + level;
        player.fanCooldownBonus += 0.08;
        player.dodgeChance += 0.03;
      },
    },
    {
      id: 'smokePocket',
      title: '연막 주머니',
      family: 'playbook',
      pools: ['thief'],
      maxLevel: 2,
      text: '위험 구역 둔화 시간이 짧아지고 긴장 상승을 조금 줄입니다.',
      apply: (player) => {
        player.hazardResist = (player.hazardResist || 0) + 0.18;
        player.tensionResist += 0.06;
        player.speed *= 1.04;
      },
    },
    {
      id: 'sanctuaryCircle',
      title: '성역 원',
      family: 'playbook',
      pools: ['cleric'],
      maxLevel: 3,
      text: '축성의 빛 범위와 치유량이 함께 오릅니다.',
      apply: (player, level) => {
        player.auraRange += 12;
        player.auraDamage += 3;
        player.healBonus = (player.healBonus || 0) + level;
      },
    },
    {
      id: 'bellAbsolution',
      title: '종소리 사면',
      family: 'playbook',
      pools: ['cleric'],
      maxLevel: 2,
      text: '검은 종 계열 피해가 오르고 보스 패턴에 맞은 뒤 회복 파동이 빨라집니다.',
      apply: (player) => {
        player.bellWave = Math.max(player.bellWave, 1);
        player.bossDamageBonus += 0.05;
        player.healPulse += 1;
      },
    },
    {
      id: 'rootMaze',
      title: '뿌리 미로',
      family: 'playbook',
      pools: ['druid'],
      maxLevel: 3,
      text: '가시뿌리 둔화와 제어 태그 효과가 강화됩니다.',
      apply: (player, level) => {
        player.rootSlow += 0.28;
        player.damage += 2 + level;
        player.magnet += 12;
      },
    },
    {
      id: 'moonPelt',
      title: '달빛 가죽',
      family: 'playbook',
      pools: ['druid'],
      maxLevel: 2,
      text: '긴장이 높을수록 덜 아프고 더 빠르게 빠져나갑니다.',
      apply: (player) => {
        player.tensionResist += 0.1;
        player.tensionSpeed += 0.008;
        player.maxHealth += 8;
        player.health = Math.min(player.maxHealth, player.health + 8);
      },
    },
    {
      id: 'sigilBattery',
      title: '문양 축전',
      family: 'playbook',
      pools: ['wizard'],
      maxLevel: 3,
      text: '마력탄 속도와 보호막 회복이 좋아집니다.',
      apply: (player) => {
        player.projectileSpeed += 45;
        player.arcaneShield = Math.max(player.arcaneShield, 1);
        player.arcaneShieldCooldownBonus = (player.arcaneShieldCooldownBonus || 0) + 0.35;
      },
    },
    {
      id: 'forkedMissile',
      title: '갈라진 마력탄',
      family: 'playbook',
      pools: ['wizard'],
      maxLevel: 2,
      text: '추가 투사체를 얻고 관통 피해가 보스에게 더 잘 들어갑니다.',
      apply: (player) => {
        player.shots += 1;
        player.pierce += 1;
        player.bossDamageBonus += 0.04;
      },
    },
    {
      id: 'hawkMark',
      title: '매의 표식',
      family: 'playbook',
      pools: ['ranger'],
      maxLevel: 3,
      text: '동료 매가 더 강하게 찍고 표식 뒤 화살 피해가 오릅니다.',
      apply: (player, level) => {
        player.companionStrike += 1;
        player.damage += 2 + level;
        player.bossDamageBonus += 0.03;
      },
    },
    {
      id: 'snareArrow',
      title: '올가미 화살',
      family: 'playbook',
      pools: ['ranger'],
      maxLevel: 3,
      text: '검은 화살이 적을 늦추고 관통 빌드가 더 안정적으로 굴러갑니다.',
      apply: (player) => {
        player.rootSlow += 0.22;
        player.pierce += 1;
        player.projectileLife += 0.12;
      },
    },
    {
      id: 'campfireRation',
      title: '여관 비상식량',
      family: 'survival',
      pools: ['survival', 'faith', 'mobility'],
      maxLevel: 2,
      text: '초반 레벨업 사이를 버틸 체력과 자석 범위를 얻습니다.',
      apply: (player) => {
        player.maxHealth += 12;
        player.health = Math.min(player.maxHealth, player.health + 18);
        player.magnet += 18;
      },
    },
    {
      id: 'silverThread',
      title: '은실 매듭',
      family: 'control',
      pools: ['control', 'arcane', 'trick'],
      maxLevel: 2,
      text: '적 공격 예고가 조금 더 길어지고 위험 구역의 둔화가 줄어듭니다.',
      apply: (player) => {
        player.warningGrace = (player.warningGrace || 0) + 0.08;
        player.hazardResist = (player.hazardResist || 0) + 0.14;
      },
    },
    {
      id: 'bossOmen',
      title: '파수꾼의 징조',
      family: 'weapon',
      pools: ['martial', 'arcane', 'hunt', 'faith'],
      maxLevel: 2,
      text: '보스에게 주는 피해가 오르고 마지막 문 도달 뒤 빌드가 선명해집니다.',
      apply: (player) => {
        player.bossDamageBonus += 0.08;
        player.projectileLife += 0.08;
        player.auraRange += 6;
      },
    },
  ];

  const upgradeMeta = {
    thornShield: { rarity: 'common', tags: ['shield', 'survival'], classHint: '전사와 근접 직업에게 안정적입니다.', synergyText: 'shield 2개부터 접촉 피해를 추가로 줄입니다.' },
    pickShortcut: { rarity: 'common', tags: ['mobility', 'hunt'], classHint: '도적과 레인저가 경험치 흐름을 빠르게 잡습니다.', synergyText: 'mobility 2개부터 위험 구역 둔화 시간이 짧아집니다.' },
    basinRune: { rarity: 'rare', tags: ['arcane', 'control'], classHint: '마법사, 사제, 드루이드의 자동 공격 주기를 당깁니다.', synergyText: 'control 2개부터 적 경고 시간이 조금 길어집니다.' },
    barukLine: { rarity: 'uncommon', tags: ['martial', 'pierce'], classHint: '레인저와 전사가 단단한 적을 빨리 정리합니다.', synergyText: 'pierce 2개부터 투사체가 첫 명중 후 피해를 덜 잃습니다.' },
    rameLeaves: { rarity: 'uncommon', tags: ['root', 'faith', 'control'], classHint: '사제와 드루이드가 포위망을 늦춥니다.', synergyText: 'root/faith가 함께 있으면 치유와 둔화가 같이 강화됩니다.' },
    blackBell: { rarity: 'rare', tags: ['bell', 'risk', 'arcane'], classHint: '화력을 올리지만 웨이브 압박도 커집니다.', synergyText: 'bell 2개부터 보스에게 주는 피해가 조금 오릅니다.' },
    fanKnives: { rarity: 'uncommon', tags: ['blade', 'trick'], classHint: '도적의 가까운 무리 정리에 잘 맞습니다.', synergyText: 'blade 2개부터 부채꼴 단검이 더 자주 나갑니다.' },
    oathSpear: { rarity: 'rare', tags: ['spear', 'martial', 'shield'], classHint: '전사가 적 안쪽에서 버틸 때 강합니다.', synergyText: 'martial 2개부터 회전 무기 피해가 상승합니다.' },
    bellWave: { rarity: 'rare', tags: ['bell', 'faith', 'arcane'], classHint: '사제와 마법사가 넓은 보스 압박을 만듭니다.', synergyText: 'bell 2개부터 종파 반경이 넓어집니다.' },
    shieldBash: { rarity: 'class', tags: ['shield', 'martial'], classHint: '전사 전용 핵심 강화입니다.', synergyText: 'shield 2개부터 피격 긴장 증가가 줄어듭니다.' },
    shadowStep: { rarity: 'class', tags: ['blade', 'mobility', 'trick'], classHint: '도적 전용 생존 강화입니다.', synergyText: 'mobility와 blade가 함께 있으면 회피 후 짧게 가속합니다.' },
    healingLitany: { rarity: 'class', tags: ['faith', 'survival'], classHint: '사제 전용 회복 강화입니다.', synergyText: 'faith 2개부터 치유 파동이 긴장을 낮춥니다.' },
    beastForm: { rarity: 'class', tags: ['wild', 'root', 'mobility'], classHint: '드루이드 전용 변신 강화입니다.', synergyText: 'wild/root가 함께 있으면 위험 구역에서 빠져나오기 쉬워집니다.' },
    grimGrimoire: { rarity: 'class', tags: ['arcane', 'bell', 'risk'], classHint: '마법사 전용 고위험 화력 강화입니다.', synergyText: 'arcane 2개부터 보호막 재사용 시간이 줄어듭니다.' },
    hawkCompanion: { rarity: 'class', tags: ['hunt', 'pierce'], classHint: '레인저 전용 추적 강화입니다.', synergyText: 'hunt 2개부터 매가 보스도 표시합니다.' },
    farShot: { rarity: 'uncommon', tags: ['hunt', 'pierce', 'mobility'], classHint: '레인저와 원거리 빌드가 먼 위협을 먼저 지웁니다.', synergyText: 'hunt/pierce가 함께 있으면 첫 명중 피해가 상승합니다.' },
    wildThicket: { rarity: 'uncommon', tags: ['root', 'wild', 'control'], classHint: '드루이드의 둔화와 피해를 함께 올립니다.', synergyText: 'root 2개부터 가시뿌리 명중 시 작은 균열을 남깁니다.' },
    ironVow: { rarity: 'class', tags: ['shield', 'martial', 'boss'], classHint: '전사가 보스와 갑옷을 오래 붙잡는 빌드입니다.', synergyText: 'shield/boss 태그를 모으면 마지막 문 화력이 안정됩니다.' },
    guardedAdvance: { rarity: 'class', tags: ['shield', 'mobility'], classHint: '전사가 전진하면서 경험치를 놓치지 않게 합니다.', synergyText: 'mobility 2개부터 위험 구역 회피가 쉬워집니다.' },
    backstabRhythm: { rarity: 'class', tags: ['blade', 'trick'], classHint: '도적의 칼날 빌드 핵심 피해 선택입니다.', synergyText: 'blade 2개부터 칼날 박자가 열립니다.' },
    smokePocket: { rarity: 'class', tags: ['mobility', 'trick', 'survival'], classHint: '도적이 중후반 위험 구역을 흘려보내게 합니다.', synergyText: 'mobility/survival 조합은 반복 런 안정성을 높입니다.' },
    sanctuaryCircle: { rarity: 'class', tags: ['faith', 'control', 'survival'], classHint: '사제의 회복과 영역 제어를 함께 키웁니다.', synergyText: 'faith 2개부터 기도 닻이 열립니다.' },
    bellAbsolution: { rarity: 'class', tags: ['faith', 'bell', 'boss'], classHint: '사제가 보스전에서도 기여하는 빌드입니다.', synergyText: 'bell 2개부터 검은 종 합창이 열립니다.' },
    rootMaze: { rarity: 'class', tags: ['root', 'control', 'wild'], classHint: '드루이드가 적 속도를 무너뜨리는 제어 선택입니다.', synergyText: 'root/control 누적은 판정의 틈과 뿌리 고리를 당깁니다.' },
    moonPelt: { rarity: 'class', tags: ['wild', 'survival', 'mobility'], classHint: '드루이드가 긴장 높은 웨이브를 버티게 합니다.', synergyText: 'wild/mobility 조합은 숲의 추격에서 강합니다.' },
    sigilBattery: { rarity: 'class', tags: ['arcane', 'shield'], classHint: '마법사의 보호막과 주문 속도를 안정화합니다.', synergyText: 'arcane 2개부터 비전 결계가 열립니다.' },
    forkedMissile: { rarity: 'class', tags: ['arcane', 'pierce', 'boss'], classHint: '마법사가 보스와 줄지은 적을 동시에 압박합니다.', synergyText: 'pierce/boss 조합은 마지막 문 피해를 밀어줍니다.' },
    hawkMark: { rarity: 'class', tags: ['hunt', 'boss'], classHint: '레인저가 강한 표적을 빠르게 녹입니다.', synergyText: 'hunt 2개부터 추적 표식이 열립니다.' },
    snareArrow: { rarity: 'class', tags: ['hunt', 'control', 'pierce'], classHint: '레인저가 먼 적을 묶고 줄지은 적을 꿰뚫습니다.', synergyText: 'control/pierce 조합은 웨이브 정리에 좋습니다.' },
    campfireRation: { rarity: 'common', tags: ['survival', 'mobility'], classHint: '모든 직업의 초반 2분 안정성을 올립니다.', synergyText: 'survival 2개부터 결과 화면에 안정 빌드가 선명해집니다.' },
    silverThread: { rarity: 'uncommon', tags: ['control', 'mobility'], classHint: '전조를 읽고 피하는 빌드에 잘 맞습니다.', synergyText: 'control 2개부터 판정의 틈이 열립니다.' },
    bossOmen: { rarity: 'rare', tags: ['boss', 'bell'], classHint: '보스 도달 이후 화력이 부족한 런을 보완합니다.', synergyText: 'boss/bell 태그는 파수꾼 처치 동기를 만듭니다.' },
  };

  upgrades.forEach((upgrade) => {
    const meta = upgradeMeta[upgrade.id] || {};
    upgrade.rarity = meta.rarity || 'common';
    upgrade.tags = meta.tags || [upgrade.family];
    upgrade.classHint = meta.classHint || '현재 플레이북의 성장 방향과 맞습니다.';
    upgrade.synergyText = meta.synergyText || `${upgrade.family} 선택을 이어가면 빌드 정체성이 강해집니다.`;
  });

  const itemCatalog = {
    weapons: [
      { id: 'cleave', title: '철의 베기', attack: 'cleave', maxLevel: 8, playbookId: 'fighter', type: 'weapon', effect: '베기 범위와 피해가 오릅니다.', evolutionHint: '방패선 패시브와 함께 Lv.8 달성 후 상자에서 진화합니다.' },
      { id: 'knives', title: '숨은 칼', attack: 'knives', maxLevel: 8, playbookId: 'thief', type: 'weapon', effect: '단검 수와 공격 주기가 좋아집니다.', evolutionHint: '그림자 걸음 패시브와 함께 Lv.8 달성 후 상자에서 진화합니다.' },
      { id: 'radiance', title: '축성의 빛', attack: 'radiance', maxLevel: 8, playbookId: 'cleric', type: 'weapon', effect: '빛 피해와 회복 흐름이 강해집니다.', evolutionHint: '라메의 잎 패시브와 함께 Lv.8 달성 후 상자에서 진화합니다.' },
      { id: 'roots', title: '가시뿌리', attack: 'roots', maxLevel: 8, playbookId: 'druid', type: 'weapon', effect: '둔화와 뿌리 피해가 커집니다.', evolutionHint: '고대 뿌리 패시브와 함께 Lv.8 달성 후 상자에서 진화합니다.' },
      { id: 'missile', title: '마력탄', attack: 'missile', maxLevel: 8, playbookId: 'wizard', type: 'weapon', effect: '관통과 투사체 속도가 오릅니다.', evolutionHint: '검은 서고 패시브와 함께 Lv.8 달성 후 상자에서 진화합니다.' },
      { id: 'arrow', title: '검은 화살', attack: 'arrow', maxLevel: 8, playbookId: 'ranger', type: 'weapon', effect: '먼 적을 꿰는 피해와 관통이 오릅니다.', evolutionHint: '파수꾼 표식 패시브와 함께 Lv.8 달성 후 상자에서 진화합니다.' },
    ],
    passives: [
      { id: 'shieldLine', title: '방패선', maxLevel: 5, type: 'passive', effect: '방어와 긴장 저항이 오릅니다.' },
      { id: 'shadowStepPassive', title: '그림자 걸음', maxLevel: 5, type: 'passive', effect: '이동 속도와 회피가 오릅니다.' },
      { id: 'rameLeafPassive', title: '라메의 잎', maxLevel: 5, type: 'passive', effect: '치유와 둔화 범위가 좋아집니다.' },
      { id: 'ancientRootPassive', title: '고대 뿌리', maxLevel: 5, type: 'passive', effect: '제어 시간과 위험 구역 저항이 오릅니다.' },
      { id: 'blackLibraryPassive', title: '검은 서고', maxLevel: 5, type: 'passive', effect: '주문 피해와 보호막 회전이 좋아집니다.' },
      { id: 'sentinelMarkPassive', title: '파수꾼 표식', maxLevel: 5, type: 'passive', effect: '사거리와 보스 피해가 오릅니다.' },
    ],
    evolutions: [
      { id: 'shieldLineSpinningBlade', title: '방패선의 회전검', weaponId: 'cleave', passiveId: 'shieldLine', type: 'evolvedWeapon', effect: '방패선 주위를 도는 검이 가까운 적을 지속적으로 베어냅니다.' },
      { id: 'shadowKnifeRain', title: '그림자 칼비', weaponId: 'knives', passiveId: 'shadowStepPassive', type: 'evolvedWeapon', effect: '회피 후 짧은 칼비가 주변 적을 쓸어냅니다.' },
      { id: 'rameSolarHalo', title: '라메의 태양환', weaponId: 'radiance', passiveId: 'rameLeafPassive', type: 'evolvedWeapon', effect: '축성의 빛이 넓은 태양환으로 번지며 회복을 강화합니다.' },
      { id: 'ancientRootPrison', title: '고대 뿌리 감옥', weaponId: 'roots', passiveId: 'ancientRootPassive', type: 'evolvedWeapon', effect: '가시뿌리가 적을 오래 묶는 감옥으로 변합니다.' },
      { id: 'blackLibraryMeteor', title: '검은 서고의 유성', weaponId: 'missile', passiveId: 'blackLibraryPassive', type: 'evolvedWeapon', effect: '마력탄이 관통 후 유성 파편을 남깁니다.' },
      { id: 'sentinelHuntingHawk', title: '파수꾼 사냥매', weaponId: 'arrow', passiveId: 'sentinelMarkPassive', type: 'evolvedWeapon', effect: '검은 화살이 동료 매 표식과 함께 보스와 엘리트를 추적합니다.' },
    ],
  };

  window.DungeonworldSurvivorsContent = {
    scenes,
    standardScenes,
    balance,
    enemyTypes,
    wavePatterns,
    standardWavePatterns,
    elitePatterns,
    itemCatalog,
    playbooks,
    upgrades,
    runGoals,
    performanceBudget,
  };
})();

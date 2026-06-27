(function () {
  const content = window.DungeonworldSurvivorsContent;
  const systems = window.DungeonworldSurvivorsSystems;
  const renderer = window.DungeonworldSurvivorsRenderer;
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const input = { up: false, down: false, left: false, right: false };
  const elements = {
    start: document.getElementById('start-button'),
    pause: document.getElementById('pause-button'),
    sceneTitle: document.getElementById('stage-title'),
    sceneCopy: document.getElementById('scene-copy'),
    time: document.getElementById('time-value'),
    health: document.getElementById('health-value'),
    level: document.getElementById('level-value'),
    xp: document.getElementById('xp-value'),
    kills: document.getElementById('kill-value'),
    goal: document.getElementById('goal-value'),
    wave: document.getElementById('wave-value'),
    objective: document.getElementById('objective-value'),
    upgrades: document.getElementById('upgrade-list'),
    runGoals: document.getElementById('run-goal-list'),
    sheetCard: document.getElementById('sheet-card'),
    role: document.getElementById('role-value'),
    attack: document.getElementById('attack-value'),
    survival: document.getElementById('survival-value'),
    modal: document.getElementById('modal'),
    modalKicker: document.getElementById('modal-kicker'),
    modalTitle: document.getElementById('modal-title'),
    modalCopy: document.getElementById('modal-copy'),
    modalPrimary: document.getElementById('modal-primary'),
    modalSecondary: document.getElementById('modal-secondary'),
    upgradeOptions: document.getElementById('upgrade-options'),
    qaPanel: document.getElementById('qa-panel'),
  };
  let state = systems.createState(content, 'fighter', { mode: getRequestedMode() });
  let lastFrame = 0;
  let pendingUpgrades = [];
  let pendingChestReward = null;
  let previousFocus = null;

  function getRequestedMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') || 'demo';
  }

  function resetGame(playbookId) {
    state = systems.createState(content, playbookId, { mode: getRequestedMode() });
    lastFrame = performance.now();
    elements.pause.disabled = false;
    elements.pause.textContent = '일시정지';
    elements.start.textContent = '다시 시작';
    hideModal();
    canvas.focus();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    if (state.status === 'running') {
      const result = systems.tick(state, input, dt);
      if (result === 'level') openUpgradeModal();
      if (result === 'chest') openChestModal();
      if (result === 'won') finishGame(true);
      if (result === 'lost') finishGame(false);
    }
    renderer.render(ctx, state, systems.WORLD);
    updateDom();
    if (state.status === 'running' || state.status === 'paused' || state.status === 'level' || state.status === 'chest') {
      requestAnimationFrame(loop);
    }
  }

  function startGame(playbookId) {
    resetGame(typeof playbookId === 'string' ? playbookId : state.playbook.id);
    state.status = 'running';
  }

  function togglePause() {
    if (state.status === 'running') {
      state.status = 'paused';
      elements.pause.textContent = '계속';
      showMessage('일시정지', '검은 종소리도 잠깐 멈췄습니다.', '계속', resumeGame);
      return;
    }
    if (state.status === 'paused') resumeGame();
  }

  function resumeGame() {
    hideModal();
    state.status = 'running';
    elements.pause.textContent = '일시정지';
    lastFrame = performance.now();
    requestAnimationFrame(loop);
    canvas.focus();
  }

  function openUpgradeModal() {
    state.status = 'level';
    pendingUpgrades = systems.pickUpgrades(state);
    elements.modalKicker.textContent = `레벨 ${state.player.level}`;
    elements.modalTitle.textContent = '어떤 도움을 붙잡을까요?';
    elements.modalCopy.textContent = '무기와 패시브를 반복해서 고르면 레벨이 오릅니다. 무기 Lv.8과 지정 패시브를 맞춘 뒤 엘리트 상자를 먹으면 진화가 열립니다.';
    elements.modalPrimary.classList.add('hidden');
    elements.modalSecondary.classList.add('hidden');
    renderUpgradeOptions();
    showModal('upgrade');
  }

  function renderUpgradeOptions() {
    elements.upgradeOptions.innerHTML = '';
    pendingUpgrades.forEach((upgrade) => {
      const nextLevel = (state.upgradeLevels[upgrade.id] || 0) + 1;
      const button = document.createElement('button');
      button.className = `upgrade-option rarity-${upgrade.rarity || 'common'}`;
      button.type = 'button';
      button.innerHTML = [
        '<span class="card-seal" aria-hidden="true"></span>',
        `<span class="recommendation-pill">${upgrade.recommendationRole || '추천'}</span>`,
        `<span class="option-meta">${formatRarity(upgrade.rarity)} · ${formatItemType(upgrade)}</span>`,
        `<strong>${upgrade.title} ${formatLevel(nextLevel)}</strong>`,
        `<span class="rune-badges">${formatTagBadges(upgrade.tags)}</span>`,
        `<span class="level-line">현재 레벨 ${nextLevel - 1} → 다음 레벨 ${nextLevel} / 최대 ${upgrade.maxLevel}</span>`,
        `<span class="effect-line">이번 선택: ${upgrade.effectPreview || upgrade.text}</span>`,
        `<span class="evolution-line">${upgrade.evolutionCondition || '진화 조건: 무기 Lv.8 + 지정 패시브 + 엘리트 상자'}</span>`,
        `<span class="recommendation-reason">추천 이유: ${upgrade.recommendationReason || '현재 런의 선택지를 넓힙니다.'}</span>`,
        `<span class="build-line">${describeBuildDirection(upgrade)}</span>`,
        `<span class="synergy-hint">역할/태그: ${upgrade.classHint}</span>`,
        `<span class="synergy-hint">시너지 힌트: ${upgrade.synergyText}</span>`,
      ].join('');
      button.addEventListener('click', () => chooseUpgrade(upgrade));
      elements.upgradeOptions.appendChild(button);
    });
  }

  function renderPlaybookOptions() {
    elements.upgradeOptions.innerHTML = '';
    content.playbooks.forEach((playbook) => {
      const button = document.createElement('button');
      button.className = `upgrade-option playbook-option ${playbook.id}`;
      button.type = 'button';
      button.dataset.playbook = playbook.id;
      button.innerHTML = [
        '<span class="card-seal" aria-hidden="true"></span>',
        `<span class="playbook-role">${playbook.role}</span>`,
        `<strong>${playbook.title}</strong>`,
        `<span class="option-meta">${playbook.combatMood}</span>`,
        `<span class="rune-badges">${formatTagBadges(playbook.upgradePool)}</span>`,
        `<span>${playbook.sheetLine}</span>`,
        `<span>${playbook.text}</span>`,
        `<span class="visual-cue">${playbook.visualCue}</span>`,
        `<span>${playbook.survival}</span>`,
      ].join('');
      button.addEventListener('click', () => startGame(playbook.id));
      elements.upgradeOptions.appendChild(button);
    });
  }

  function chooseUpgrade(upgrade) {
    systems.applyUpgrade(state, upgrade);
    hideModal();
    state.status = 'running';
    lastFrame = performance.now();
    requestAnimationFrame(loop);
    canvas.focus();
  }

  function openChestModal() {
    state.status = 'chest';
    pendingChestReward = state.pendingChestRewards[0] || null;
    elements.modalKicker.textContent = '엘리트 상자';
    elements.modalTitle.textContent = pendingChestReward && pendingChestReward.type === 'evolution'
      ? '무기가 진화합니다'
      : '상자 보상을 고릅니다';
    elements.modalCopy.textContent = '엘리트를 쓰러뜨려 상자가 열렸습니다. 진화 조건을 만족한 무기가 있으면 진화가 먼저 적용됩니다.';
    elements.modalPrimary.classList.add('hidden');
    elements.modalSecondary.classList.add('hidden');
    renderChestReward();
    showModal('chest');
  }

  function renderChestReward() {
    elements.upgradeOptions.innerHTML = '';
    const button = document.createElement('button');
    button.className = 'upgrade-option rarity-rare chest-reward-option';
    button.type = 'button';
    const title = formatChestRewardTitle(pendingChestReward);
    const copy = formatChestRewardCopy(pendingChestReward);
    button.innerHTML = [
      '<span class="card-seal" aria-hidden="true"></span>',
      '<span class="recommendation-pill">상자 보상</span>',
      `<span class="option-meta">${pendingChestReward ? formatChestRewardType(pendingChestReward.type) : '보상'}</span>`,
      `<strong>${title}</strong>`,
      `<span class="effect-line">${copy}</span>`,
      '<span class="evolution-line">진화 우선 규칙: 무기 Lv.8 + 지정 패시브 보유 + 상자 획득</span>',
      '<span class="recommendation-reason">추천 이유: 상자 보상은 즉시 적용되어 다음 웨이브를 버틸 힘을 만듭니다.</span>',
    ].join('');
    button.addEventListener('click', claimChestReward);
    elements.upgradeOptions.appendChild(button);
  }

  function claimChestReward() {
    systems.claimChestReward(state);
    pendingChestReward = null;
    hideModal();
    state.status = 'running';
    lastFrame = performance.now();
    requestAnimationFrame(loop);
    canvas.focus();
  }

  function finishGame(won) {
    state.status = won ? 'won' : 'lost';
    state.runSummary = systems.getRunSummary(state);
    elements.pause.disabled = true;
    elements.modalKicker.textContent = won ? '생존 성공' : '다시 정비';
    elements.modalTitle.textContent = won ? '마지막 문이 열렸습니다' : '검은 종소리에 밀렸습니다';
    elements.modalCopy.textContent = won
      ? '검은 종 파수꾼을 쓰러뜨렸습니다. 아래 기록은 브라우저 안에서만 끝나며 포인트 지급은 없습니다.'
      : '여관으로 물러나 숨을 고릅니다. 다시 시작해도 포인트나 Discord 기록은 남지 않습니다.';
    elements.modalPrimary.classList.remove('hidden');
    elements.modalSecondary.classList.remove('hidden');
    elements.modalPrimary.textContent = '다시 시작';
    elements.modalPrimary.onclick = startGame;
    elements.modalSecondary.textContent = '닫기';
    elements.modalSecondary.onclick = hideModalOnly;
    renderResultSummary(state.runSummary);
    showModal('result');
  }

  function updateDom() {
    const scene = state.scenes[state.sceneIndex];
    elements.sceneTitle.textContent = scene.title;
    elements.sceneCopy.textContent = scene.copy;
    elements.time.textContent = renderer.formatTime(state.duration - state.elapsed);
    elements.health.textContent = `${Math.max(0, Math.ceil(state.player.health))} / ${state.player.maxHealth}`;
    elements.level.textContent = String(state.player.level);
    elements.xp.textContent = `${state.player.xp} / ${state.player.nextXp}`;
    elements.kills.textContent = String(state.kills);
    document.getElementById('tension-value').textContent = `${Math.ceil(state.player.tension)} / ${state.player.maxTension}`;
    document.getElementById('move-result-value').textContent = state.lastMoveResult;
    document.getElementById('playbook-value').textContent = state.playbook.title;
    elements.sheetCard.style.setProperty('--active-class', `var(${state.playbook.accentToken || '--accent-primary'})`);
    elements.sheetCard.style.setProperty('--active-class-soft', `var(${state.playbook.secondaryToken || '--surface-parchment'})`);
    elements.role.textContent = state.playbook.role;
    elements.attack.textContent = formatAttack(state.playbook.attack);
    elements.survival.textContent = state.playbook.survival.split(':')[0];
    document.getElementById('stat-str-value').textContent = formatStat(state.player.stats.str);
    document.getElementById('stat-dex-value').textContent = formatStat(state.player.stats.dex);
    document.getElementById('stat-wis-value').textContent = formatStat(state.player.stats.wis);
    document.getElementById('stat-will-value').textContent = formatStat(state.player.stats.will);
    const wave = state.waves[state.waveIndex];
    elements.wave.textContent = wave.title;
    elements.objective.textContent = state.bossSpawned
      ? '검은 종 파수꾼을 쓰러뜨리세요'
      : (wave.objective || wave.copy);
    elements.goal.textContent = state.bossSpawned ? '보스전' : `${state.mode.title}`;
    elements.upgrades.innerHTML = state.learnedUpgrades.map((name) => `<li>${name}</li>`).join('');
    elements.runGoals.innerHTML = systems.evaluateRunGoals(state).map((goal) => (
      `<li><strong>${goal.title}</strong><span>${goal.progress}</span></li>`
    )).join('');
    updateQaOverlay();
  }

  function showMessage(title, copy, primaryLabel, primaryAction) {
    elements.modalKicker.textContent = '상태';
    elements.modalTitle.textContent = title;
    elements.modalCopy.textContent = copy;
    elements.upgradeOptions.innerHTML = '';
    elements.modalPrimary.classList.remove('hidden');
    elements.modalSecondary.classList.remove('hidden');
    elements.modalPrimary.textContent = primaryLabel;
    elements.modalPrimary.onclick = primaryAction;
    elements.modalSecondary.textContent = '닫기';
    elements.modalSecondary.onclick = hideModalOnly;
    showModal('pause');
  }

  function showIntro() {
    elements.modalKicker.textContent = '플레이북 선택';
    elements.modalTitle.textContent = '누구로 버틸까요?';
    elements.modalCopy.textContent = '보석을 먹으면 경험치가 오르고, 레벨업하면 무기나 패시브를 고릅니다. 같은 무기를 여러 번 고르면 강해지며, 무기 Lv.8과 특정 패시브를 맞춘 뒤 엘리트 상자를 먹으면 진화할 수 있습니다. 30분 정식 런에서는 엘리트를 잡아 상자를 얻고, 30분까지 버티면 마지막 문이 열립니다. 포인트나 Discord 계정 연동은 없습니다.';
    elements.modalPrimary.classList.add('hidden');
    elements.modalSecondary.classList.remove('hidden');
    elements.modalSecondary.textContent = '닫기';
    elements.modalSecondary.onclick = hideModalOnly;
    renderPlaybookOptions();
    showModal('intro');
  }

  function formatLevel(level) {
    return ['I', 'II', 'III', 'IV'][level - 1] || String(level);
  }

  function formatStat(value) {
    return value > 0 ? `+${value}` : String(value);
  }

  function formatAttack(attack) {
    const attackNames = {
      cleave: '철의 베기',
      knives: '숨은 칼',
      radiance: '축성의 빛',
      roots: '가시뿌리',
      missile: '마력탄',
      arrow: '검은 화살',
    };
    return attackNames[attack] || '자동 공격';
  }

  function formatItemType(upgrade) {
    if (upgrade.itemType) return upgrade.itemType;
    if (upgrade.family === 'weapon') return '무기';
    if (upgrade.family === 'survival' || upgrade.family === 'mobility' || upgrade.family === 'control') return '패시브';
    return '강화';
  }

  function formatChestRewardType(type) {
    if (type === 'evolution') return '진화 무기';
    if (type === 'weapon') return '무기 강화';
    if (type === 'passive') return '패시브 강화';
    return '강화';
  }

  function formatChestRewardTitle(reward) {
    if (!reward) return '상자 보상';
    if (reward.type === 'evolution') return reward.evolution.title;
    if (reward.item) return `${reward.item.title} Lv.${reward.item.level + 1}`;
    if (reward.upgrade) return reward.upgrade.title;
    return '상자 보상';
  }

  function formatChestRewardCopy(reward) {
    if (!reward) return '상자 보상을 확인합니다.';
    if (reward.type === 'evolution') return reward.evolution.effect;
    if (reward.item) return `${reward.item.title}을 한 단계 강화합니다. 현재 Lv.${reward.item.level}에서 Lv.${reward.item.level + 1}이 됩니다.`;
    if (reward.upgrade) return reward.upgrade.text;
    return '보유 무기나 패시브를 강화합니다.';
  }

  function formatRarity(rarity) {
    const labels = {
      class: '전용',
      common: '일반',
      rare: '희귀',
      uncommon: '비범',
    };
    return labels[rarity] || '일반';
  }

  function formatTags(tags) {
    return (tags || []).map((tag) => `#${tag}`).join(' ');
  }

  function formatTagBadges(tags) {
    return (tags || []).map((tag) => `<span class="rune-badge">${tag}</span>`).join('');
  }

  function formatGoalStatus(status) {
    if (status === 'achieved') return '달성';
    if (status === 'close') return '아까움';
    return '실패';
  }

  function describeBuildDirection(upgrade) {
    const tags = upgrade.tags || [];
    if (tags.includes('boss')) return '빌드 방향: 마지막 문 보스 화력을 확보합니다.';
    if (tags.includes('shield') || tags.includes('survival')) return '빌드 방향: 맞아도 무너지지 않는 안정 런입니다.';
    if (tags.includes('blade') || tags.includes('pierce')) return '빌드 방향: 처치 속도를 올려 XP 흐름을 당깁니다.';
    if (tags.includes('control') || tags.includes('root')) return '빌드 방향: 전조를 읽고 적 속도를 꺾는 제어 런입니다.';
    if (tags.includes('bell') || tags.includes('arcane')) return '빌드 방향: 고위험 화력과 보스 압박을 키웁니다.';
    if (tags.includes('hunt') || tags.includes('mobility')) return '빌드 방향: 거리 유지와 보석 회수로 성장 속도를 냅니다.';
    return '빌드 방향: 현재 플레이북의 빈틈을 메웁니다.';
  }

  function renderResultSummary(summary) {
    const upgrades = summary.selectedUpgrades.length > 0
      ? summary.selectedUpgrades.map((upgrade) => (
        `<li><strong>${upgrade.title} ${formatLevel(upgrade.level)}</strong><span>${formatRarity(upgrade.rarity)} · ${upgrade.family}</span><span class="rune-badges">${formatTagBadges(upgrade.tags)}</span></li>`
      )).join('')
      : '<li><strong>선택한 업그레이드 없음</strong><span>첫 레벨업 전에 런이 끝났습니다.</span></li>';
    const tags = summary.buildTags.length > 0
      ? summary.buildTags.map((entry) => `<span class="result-tag">${entry.tag}<strong>${entry.count}</strong></span>`).join('')
      : '<span class="result-tag">태그 없음<strong>0</strong></span>';
    const synergies = summary.synergies.length > 0
      ? summary.synergies.map((synergy) => `<li><strong>${synergy.title}</strong><span>${synergy.text}</span></li>`).join('')
      : '<li><strong>시너지 미발동</strong><span>같은 태그의 선택지를 더 모으면 빌드 효과가 열립니다.</span></li>';
    const goals = summary.goals.map((goal) => (
      `<li class="goal-${goal.status}"><strong>${formatGoalStatus(goal.status)} · ${goal.title}</strong><span>${goal.progress}</span><span>${goal.close}</span></li>`
    )).join('');
    const contribution = summary.bossContribution;
    elements.upgradeOptions.innerHTML = [
      '<section class="result-ledger-head">',
      `<span class="card-seal" aria-hidden="true"></span><div><p class="retry-copy">${summary.buildVerdict}</p>`,
      `<h3>${summary.buildName}</h3><span>${summary.buildSummary}</span></div>`,
      '</section>',
      '<div class="result-grid">',
      `<article><span>생존 시간</span><strong>${renderer.formatTime(summary.survivalTime)}</strong></article>`,
      `<article><span>플레이북</span><strong>${summary.playbook}</strong></article>`,
      `<article><span>처치</span><strong>${summary.kills}</strong></article>`,
      `<article><span>레벨</span><strong>${summary.level}</strong></article>`,
      '</div>',
      `<div class="result-tags">${tags}</div>`,
      '<p class="retry-copy">다음 런에서는 같은 룬 배지를 두 장 이상 모아 시너지를 먼저 여는 쪽이 보스 도달이 안정적입니다.</p>',
      `<h3 class="result-heading">런 목표</h3><ul class="result-list goal-result-list">${goals}</ul>`,
      `<h3 class="result-heading">보스전 기여</h3><ul class="result-list"><li><strong>${contribution.label}</strong><span>${contribution.text}</span><span>발동 ${contribution.triggers}회 · 추가 피해 ${contribution.bonusDamage} · 완화 ${contribution.preventedDamage} · 회복 ${contribution.recoveredHealth} · 제어 ${contribution.controlTime}초</span></li></ul>`,
      `<h3 class="result-heading">선택한 업그레이드</h3><ul class="result-list">${upgrades}</ul>`,
      `<h3 class="result-heading">빌드 시너지</h3><ul class="result-list">${synergies}</ul>`,
    ].join('');
  }

  function showModal(mode) {
    previousFocus = document.activeElement;
    elements.modal.dataset.mode = mode || 'message';
    elements.modal.classList.remove('hidden');
    const modalCard = elements.modal.querySelector('.modal-card');
    if (modalCard) modalCard.scrollTop = 0;
    elements.upgradeOptions.scrollTop = 0;
    const firstAction = elements.upgradeOptions.querySelector('button')
      || (!elements.modalPrimary.classList.contains('hidden') ? elements.modalPrimary : elements.modalSecondary);
    const focusTarget = mode === 'result' ? elements.modalTitle : firstAction;
    if (mode === 'result') elements.modalTitle.setAttribute('tabindex', '-1');
    window.setTimeout(() => {
      if (focusTarget) focusTarget.focus();
    }, 0);
  }

  function hideModal() {
    elements.modal.classList.add('hidden');
    elements.modalPrimary.classList.remove('hidden');
    elements.modalSecondary.classList.remove('hidden');
    delete elements.modal.dataset.mode;
  }

  function hideModalOnly() {
    elements.modal.classList.add('hidden');
    delete elements.modal.dataset.mode;
    if (state.status === 'running' || state.status === 'level' || state.status === 'chest') {
      canvas.focus();
      return;
    }
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    else canvas.focus();
  }

  function setKey(event, pressed) {
    const key = event.key.toLowerCase();
    const keyMap = {
      arrowup: 'up',
      w: 'up',
      arrowdown: 'down',
      s: 'down',
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right',
    };
    const direction = keyMap[key];
    if (!direction) return;
    input[direction] = pressed;
    event.preventDefault();
  }

  function qaModeEnabled() {
    return (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
      && window.location.search.includes('qa=1');
  }

  function updateQaOverlay() {
    if (!elements.qaPanel) return;
    if (!qaModeEnabled()) {
      elements.qaPanel.classList.add('hidden');
      elements.qaPanel.textContent = '';
      return;
    }
    const wave = state.waves[state.waveIndex];
    const boss = state.enemies.find((enemy) => enemy.behavior === 'boss');
    const bossState = boss
      ? `${state.bossPhase ? state.bossPhase.title : '대기'} ${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`
      : (state.bossSpawned ? '처치됨' : '미등장');
    const recent = state.selectedUpgrades.slice(-3).map((upgrade) => `${upgrade.title} ${formatLevel(upgrade.level)}`).join(', ') || '없음';
    const goals = systems.evaluateRunGoals(state).map((goal) => `${goal.title}:${goal.progress}`).join(' / ');
    const recommendation = pendingUpgrades.map((upgrade) => `${upgrade.recommendationRole || '추천'}-${upgrade.title}`).join(' / ') || '대기';
    const contribution = state.bossContribution;
    elements.qaPanel.classList.remove('hidden');
    elements.qaPanel.innerHTML = [
      `<strong>QA balance</strong>`,
      `<span>생존 ${renderer.formatTime(state.elapsed)} · 처치 ${state.kills}</span>`,
      `<span>모드 ${state.mode.title} · 남은 시간 ${renderer.formatTime(state.duration - state.elapsed)}</span>`,
      `<span>레벨 ${state.player.level} · XP ${state.player.xp} / ${state.player.nextXp}</span>`,
      `<span>웨이브 ${wave.title} · 적 ${state.enemies.length}</span>`,
      `<span>위험 ${state.hazards.length} · 상자 ${state.chests.length} · 보스 ${bossState}</span>`,
      `<span>최근 업그레이드 ${recent}</span>`,
      `<span>추천 ${recommendation}</span>`,
      `<span>런 목표 ${goals}</span>`,
      `<span>보스 기여 ${contribution.label} · 발동 ${contribution.triggers} · 추가 ${Math.round(contribution.bonusDamage)}</span>`,
    ].join('');
  }

  function handleQaShortcut(event) {
    if (!qaModeEnabled() || !event.shiftKey || state.status !== 'running') return false;
    const key = event.key.toLowerCase();
    if (key === 'b') {
      state.elapsed = state.mode.bossAt + 1;
      state.spawnTimer = 99;
      state.enemies = [];
      systems.tick(state, input, 0.02);
      renderer.render(ctx, state, systems.WORLD);
      updateDom();
      event.preventDefault();
      return true;
    }
    if (key === 'n') {
      const boss = state.enemies.find((enemy) => enemy.behavior === 'boss');
      if (!boss) return false;
      boss.hp = 0;
      const result = systems.tick(state, input, 0.016);
      if (result === 'won') finishGame(true);
      renderer.render(ctx, state, systems.WORLD);
      updateDom();
      event.preventDefault();
      return true;
    }
    return false;
  }

  window.addEventListener('keydown', (event) => {
    if (handleQaShortcut(event)) return;
    setKey(event, true);
  });
  window.addEventListener('keyup', (event) => setKey(event, false));
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || elements.modal.classList.contains('hidden')) return;
    if (state.status === 'paused') {
      resumeGame();
      return;
    }
    if (state.status === 'ready' || state.status === 'won' || state.status === 'lost') hideModalOnly();
  });
  elements.start.addEventListener('click', showIntro);
  elements.pause.addEventListener('click', togglePause);
  elements.modalPrimary.onclick = startGame;
  elements.modalSecondary.onclick = hideModalOnly;

  state.status = 'ready';
  updateDom();
  renderer.render(ctx, state, systems.WORLD);
  showIntro();
})();

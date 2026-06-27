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
  };
  let state = systems.createState(content);
  let lastFrame = 0;
  let pendingUpgrades = [];

  function resetGame(playbookId) {
    state = systems.createState(content, playbookId);
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
      if (result === 'won') finishGame(true);
      if (result === 'lost') finishGame(false);
    }
    renderer.render(ctx, state, systems.WORLD);
    updateDom();
    if (state.status === 'running' || state.status === 'paused' || state.status === 'level') {
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
    elements.modalCopy.textContent = '전투가 잠깐 멈췄습니다. 다음 웨이브를 버틸 방법을 하나 선택해 주세요.';
    elements.modalPrimary.classList.add('hidden');
    elements.modalSecondary.classList.add('hidden');
    renderUpgradeOptions();
    showModal();
  }

  function renderUpgradeOptions() {
    elements.upgradeOptions.innerHTML = '';
    pendingUpgrades.forEach((upgrade) => {
      const nextLevel = (state.upgradeLevels[upgrade.id] || 0) + 1;
      const button = document.createElement('button');
      button.className = 'upgrade-option';
      button.type = 'button';
      button.innerHTML = `<strong>${upgrade.title} ${formatLevel(nextLevel)}</strong><span>${upgrade.text}</span>`;
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
        `<strong>${playbook.title}</strong>`,
        `<span class="option-meta">${playbook.role} · ${playbook.combatMood}</span>`,
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
    const nextLevel = (state.upgradeLevels[upgrade.id] || 0) + 1;
    state.upgradeLevels[upgrade.id] = nextLevel;
    upgrade.apply(state.player, nextLevel);
    state.learnedUpgrades.push(`${upgrade.title} ${formatLevel(nextLevel)}`);
    hideModal();
    state.status = 'running';
    lastFrame = performance.now();
    requestAnimationFrame(loop);
    canvas.focus();
  }

  function finishGame(won) {
    state.status = won ? 'won' : 'lost';
    elements.pause.disabled = true;
    elements.modalKicker.textContent = won ? '생존 성공' : '다시 정비';
    elements.modalTitle.textContent = won ? '마지막 문이 열렸습니다' : '검은 종소리에 밀렸습니다';
    elements.modalCopy.textContent = won
      ? `검은 종 파수꾼을 쓰러뜨렸습니다. 처치 ${state.kills}회, 레벨 ${state.player.level}. 포인트 지급 없이 브라우저 안에서만 끝나는 기록입니다.`
      : '여관으로 물러나 숨을 고릅니다. 다시 시작해도 포인트나 Discord 기록은 남지 않습니다.';
    elements.modalPrimary.classList.remove('hidden');
    elements.modalSecondary.classList.remove('hidden');
    elements.modalPrimary.textContent = '다시 시작';
    elements.modalPrimary.onclick = startGame;
    elements.modalSecondary.textContent = '닫기';
    elements.modalSecondary.onclick = hideModalOnly;
    elements.upgradeOptions.innerHTML = '';
    showModal();
  }

  function updateDom() {
    const scene = content.scenes[state.sceneIndex];
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
    const wave = content.wavePatterns[state.waveIndex];
    elements.wave.textContent = wave.title;
    elements.objective.textContent = state.bossSpawned
      ? '검은 종 파수꾼을 쓰러뜨리세요'
      : wave.copy;
    elements.goal.textContent = state.bossSpawned ? '보스전' : '생존';
    elements.upgrades.innerHTML = state.learnedUpgrades.map((name) => `<li>${name}</li>`).join('');
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
    showModal();
  }

  function showIntro() {
    elements.modalKicker.textContent = '플레이북 선택';
    elements.modalTitle.textContent = '누구로 버틸까요?';
    elements.modalCopy.textContent = '웨이브가 바뀔 때 던전월드식 2d6 판정이 일어나고, 결과에 따라 회복이나 긴장, 추가 압박이 생깁니다. 포인트나 Discord 계정 연동은 없습니다.';
    elements.modalPrimary.classList.add('hidden');
    elements.modalSecondary.classList.remove('hidden');
    elements.modalSecondary.textContent = '닫기';
    elements.modalSecondary.onclick = hideModalOnly;
    renderPlaybookOptions();
    showModal();
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

  function showModal() {
    elements.modal.classList.remove('hidden');
  }

  function hideModal() {
    elements.modal.classList.add('hidden');
    elements.modalPrimary.classList.remove('hidden');
    elements.modalSecondary.classList.remove('hidden');
  }

  function hideModalOnly() {
    elements.modal.classList.add('hidden');
    canvas.focus();
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

  window.addEventListener('keydown', (event) => setKey(event, true));
  window.addEventListener('keyup', (event) => setKey(event, false));
  elements.start.addEventListener('click', showIntro);
  elements.pause.addEventListener('click', togglePause);
  elements.modalPrimary.onclick = startGame;
  elements.modalSecondary.onclick = hideModalOnly;

  state.status = 'ready';
  updateDom();
  renderer.render(ctx, state, systems.WORLD);
  showIntro();
})();

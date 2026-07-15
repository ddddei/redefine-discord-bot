(function () {
  var storageKey = 'redefineOrientationSelections.v1';
  var currentSelectionKey = 'redefineOrientationCurrentSelection.v1';

  var tracks = [
    {
      id: 'dance-theatre',
      type: 'track',
      title: '무용극',
      summary: '몸의 움직임과 장면 만들기로 이야기를 구성하는 트랙입니다.',
      fit: ['말보다 장면과 감각으로 표현해 보고 싶은 사람', '함께 움직이며 결과물을 만들어 보고 싶은 사람'],
      accentClass: 'accent-primary',
      index: 'TRACK 01',
      capacity: '정원 추후 공개',
    },
    {
      id: 'trpg',
      type: 'track',
      title: 'TRPG',
      summary: '테이블 롤플레잉으로 캐릭터, 선택, 서사를 함께\u00A0만들어\u00A0가는 트랙입니다.',
      fit: ['이야기 속 역할을 맡아 선택해 보고 싶은 사람', '규칙 있는 공동 창작을 경험하고 싶은 사람'],
      accentClass: 'accent-bell',
      index: 'TRACK 02',
      capacity: '정원 추후 공개',
    },
  ];

  var labs = [
    {
      id: 'writers-room',
      type: 'lab',
      title: "Writer's Room",
      summary: '아이디어를 나누고 장면, 대사, 구조를 함께 다듬는 랩입니다.',
      fit: ['쓰고 말하고 고쳐 보는 과정을 좋아하는 사람', '혼자 완성하기보다 같이 정리해 보고 싶은 사람'],
      accentClass: 'accent-info',
      index: 'LAB 01',
      capacity: '운영진 확인 중',
    },
    {
      id: 'band-session',
      type: 'lab',
      title: 'Band Session',
      summary: '소리와 리듬, 합을 맞추는 감각으로 함께 세션을 만드는 랩입니다.',
      fit: ['합주나 사운드 실험이 궁금한 사람', '정교한 실력보다 같이 맞춰 보는 과정에 끌리는 사람'],
      accentClass: 'accent-brass',
      index: 'LAB 02',
      capacity: '운영진 확인 중',
    },
    {
      id: 'worker-lab',
      type: 'lab',
      title: '직장인 랩',
      summary: '운영진이 방향을 조금 더 고민 중인 랩입니다.',
      fit: ['세부 소개가 확정되면 다시 안내됩니다.'],
      accentClass: 'accent-clay',
      index: 'LAB 03',
      capacity: '검토 중',
      disabled: true,
    },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatPhone(value) {
    var digits = normalizePhone(value).slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return digits.slice(0, 3) + '-' + digits.slice(3);
    return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
  }

  function readSelections() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeSelections(items) {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  }

  function findOption(items, id) {
    return items.find(function (item) { return item.id === id; }) || null;
  }

  function optionCard(option) {
    return [
      '<article class="option-card ' + option.accentClass + '" data-disabled="' + Boolean(option.disabled) + '">',
      '<div class="option-topline">',
      '<span class="option-index">' + option.index + '</span>',
      '<span class="option-state">' + (option.disabled ? '검토 중' : '선택 가능') + '</span>',
      '</div>',
      '<h3>' + escapeHtml(option.title) + '</h3>',
      '<p>' + escapeHtml(option.summary) + '</p>',
      '<div class="fit-block">',
      '<span class="fit-label">이런 사람이면</span>',
      '<ul>',
      option.fit.map(function (line) { return '<li>' + escapeHtml(line) + '</li>'; }).join(''),
      '</ul>',
      '</div>',
      '<div class="option-meta">',
      '<span class="pill">' + (option.type === 'track' ? '트랙' : '랩') + '</span>',
      '<span class="pill">' + escapeHtml(option.capacity) + '</span>',
      '</div>',
      '</article>',
    ].join('');
  }

  function choiceCard(group, option) {
    var disabled = option.disabled ? ' disabled' : '';
    return [
      '<label class="choice-card ' + option.accentClass + '" data-disabled="' + Boolean(option.disabled) + '">',
      '<input type="radio" name="' + group + '" value="' + option.id + '"' + disabled + ' required>',
      '<span class="choice-copy">',
      '<span class="choice-heading"><strong>' + escapeHtml(option.title) + '</strong><span class="choice-state" aria-hidden="true">선택됨</span></span>',
      '<span class="choice-summary">' + escapeHtml(option.summary) + '</span>',
      '</span>',
      '</label>',
    ].join('');
  }

  function renderOptions() {
    $('track-list').innerHTML = tracks.map(optionCard).join('');
    $('lab-list').innerHTML = labs.map(optionCard).join('');
    $('track-choice-list').innerHTML = tracks.map(function (track) { return choiceCard('track', track); }).join('');
    $('lab-choice-list').innerHTML = labs.map(function (lab) { return choiceCard('lab', lab); }).join('');
  }

  function countBy(items, key, options) {
    return options.map(function (option) {
      return {
        option: option,
        count: items.filter(function (item) { return item[key] === option.id; }).length,
      };
    });
  }

  function renderDistribution(containerId, counts, total) {
    $(containerId).innerHTML = counts.map(function (entry) {
      var percent = total > 0 ? Math.round((entry.count / total) * 100) : 0;
      return [
        '<div class="distribution-row ' + entry.option.accentClass + '">',
        '<div class="distribution-label">',
        '<span>' + escapeHtml(entry.option.title) + '</span>',
        '<span>' + entry.count + '명 · ' + percent + '%</span>',
        '</div>',
        '<div class="bar" aria-hidden="true"><div class="bar-fill" data-scale="' + (percent / 100) + '"></div></div>',
        '</div>',
      ].join('');
    }).join('');

    window.requestAnimationFrame(function () {
      $(containerId).querySelectorAll('.bar-fill').forEach(function (fill) {
        fill.style.transform = 'scaleX(' + fill.dataset.scale + ')';
      });
    });
  }

  function formatDate(value) {
    if (!value) return '-';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderStatus() {
    var selections = readSelections();
    var total = selections.length;
    var latest = selections.reduce(function (current, item) {
      return !current || item.updatedAt > current ? item.updatedAt : current;
    }, '');
    var currentId = window.localStorage.getItem(currentSelectionKey);
    var current = selections.find(function (item) { return item.id === currentId; });
    var currentTrack = current ? findOption(tracks, current.trackId) : null;
    var currentLab = current ? findOption(labs, current.labId) : null;

    $('total-count').textContent = String(total);
    $('last-updated').textContent = latest ? formatDate(latest) : '-';
    $('status-caption').textContent = total
      ? '이 브라우저에 저장된 선택 현황입니다.'
      : '아직 이 브라우저에 저장된 선택이 없습니다.';
    renderDistribution('track-status-list', countBy(selections, 'trackId', tracks), total);
    renderDistribution('lab-status-list', countBy(selections, 'labId', labs.filter(function (lab) { return !lab.disabled; })), total);

    if (current && currentTrack && currentLab) {
      $('my-selection').hidden = false;
      $('my-selection').innerHTML = '<strong>내 현재 선택</strong><p>' + escapeHtml(currentTrack.title)
        + ' / ' + escapeHtml(currentLab.title)
        + '<br>같은 전화번호로 다시 바꿀 수 있습니다.</p>';
    } else {
      $('my-selection').hidden = true;
      $('my-selection').innerHTML = '';
    }
  }

  function setChecked(name, value) {
    var input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (input) input.checked = true;
  }

  function hydrateCurrentSelection() {
    var currentId = window.localStorage.getItem(currentSelectionKey);
    if (!currentId) return;
    var current = readSelections().find(function (item) { return item.id === currentId; });
    if (!current) return;
    $('participant-name').value = current.name;
    $('participant-phone').value = formatPhone(current.phone);
    setChecked('track', current.trackId);
    setChecked('lab', current.labId);
  }

  function showMessage(type, message) {
    var success = $('form-success');
    var error = $('form-error');
    success.hidden = true;
    error.hidden = true;
    if (type === 'success') {
      success.textContent = message;
      success.hidden = false;
    } else {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function selectedValue(name) {
    var input = document.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : '';
  }

  function handleSubmit(event) {
    event.preventDefault();
    var name = $('participant-name').value.trim();
    var phone = normalizePhone($('participant-phone').value);
    var trackId = selectedValue('track');
    var labId = selectedValue('lab');

    if (name.length < 2) {
      showMessage('error', '본명을 두 글자 이상 입력해 주세요.');
      return;
    }
    if (phone.length < 10 || phone.length > 11) {
      showMessage('error', '전화번호를 10~11자리 숫자로 입력해 주세요.');
      return;
    }
    if (!trackId || !labId) {
      showMessage('error', '트랙과 랩을 각각 하나씩 선택해 주세요.');
      return;
    }

    var now = new Date().toISOString();
    var selections = readSelections();
    var existingIndex = selections.findIndex(function (item) { return item.phone === phone; });
    var existing = existingIndex >= 0 ? selections[existingIndex] : null;
    var next = {
      id: existing ? existing.id : 'local-' + phone,
      name: name,
      phone: phone,
      trackId: trackId,
      labId: labId,
      submittedAt: existing ? existing.submittedAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      selections[existingIndex] = next;
      showMessage('success', '선택을 변경했습니다. 같은 정보로 언제든 수정할 수 있습니다.');
    } else {
      selections.push(next);
      showMessage('success', '선택을 저장했습니다. 운영진 안내에 따라 최종 저장소가 연결됩니다.');
    }

    writeSelections(selections);
    window.localStorage.setItem(currentSelectionKey, next.id);
    $('participant-phone').value = formatPhone(phone);
    renderStatus();
  }

  function resetForm() {
    $('selection-form').reset();
    $('form-success').hidden = true;
    $('form-error').hidden = true;
    window.localStorage.removeItem(currentSelectionKey);
    renderStatus();
  }

  function bindEvents() {
    $('selection-form').addEventListener('submit', handleSubmit);
    $('reset-form').addEventListener('click', resetForm);
    $('participant-phone').addEventListener('input', function (event) {
      event.target.value = formatPhone(event.target.value);
    });
  }

  renderOptions();
  hydrateCurrentSelection();
  bindEvents();
  renderStatus();
}());


/* ============================================================
   Dysel Bel · Invitation
   script.js
   ============================================================ */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- screen navigation ---------- */
  const screens = {
    invite:   $('#screen-invite'),
    question: $('#screen-question'),
    plan:     $('#screen-plan'),
    confirm:  $('#screen-confirm')
  };
  let current = 'invite';

  $$('.screen').forEach(s => s.classList.remove('is-active'));
  requestAnimationFrame(() => requestAnimationFrame(() => screens.invite.classList.add('is-active')));

  function goTo(name) {
    if (!screens[name] || name === current) return;
    screens[current].classList.remove('is-active');
    const next = screens[name];
    next.classList.add('is-active');
    next.scrollTop = 0;
    current = name;
  }

  /* ---------- ambient particles ---------- */
  const canvas = $('#particles');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, parts = [];

  function resize() {
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function makeParts() {
    const n = prefersReduced ? 0 : Math.min(80, Math.round((W * H) / 18000));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + .4,
      vx: (Math.random() - .5) * .12,
      vy: -Math.random() * .22 - .04,
      a: Math.random() * .5 + .15,
      tw: Math.random() * Math.PI * 2
    }));
  }
  window.addEventListener('resize', () => { resize(); makeParts(); });
  resize(); makeParts();

  let last = performance.now();
  function tick(t) {
    const dt = Math.min(40, t - last) / 16.67;
    last = t;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.tw += .02 * dt;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;

      const a = p.a * (0.6 + 0.4 * Math.sin(p.tw));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `rgba(243,226,182,${a})`);
      g.addColorStop(1, 'rgba(243,226,182,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  if (!prefersReduced) requestAnimationFrame(tick);

  /* ============================================================
     MUSIC  ·  lester.mp3
     ============================================================ */
  const MUSIC_URL = 'lester.mp3';

  let audioCtx = null;
  let musicGain = null;
  let musicOn = false;
  let musicStarted = false;
  let synthActive = false;
  let synthGraph = null;
  let musicEl = null;
  let activeSource = null; // 'mp3' | 'synth'

  const musicBtn = $('#musicBtn');
  const vol = $('#volume');
  vol.value = 65;

  function startMp3() {
    if (!musicEl) {
      musicEl = new Audio(MUSIC_URL);
      musicEl.loop = true;
      musicEl.preload = 'auto';
      musicEl.addEventListener('error', () => {
        console.warn('lester.mp3 not found — falling back to built-in synth.');
        if (activeSource !== 'synth') { activeSource = 'synth'; startSynth(); }
      });
    }
    musicEl.volume = vol.value / 100;
    const p = musicEl.play();
    if (p && p.catch) {
      p.catch(err => {
        console.warn('lester.mp3 blocked — using built-in synth:', err);
        activeSource = 'synth';
        startSynth();
      });
    }
  }
  function pauseMp3() { if (musicEl) musicEl.pause(); }

  function buildSynthGraph() {
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.0001;
    musicGain.connect(audioCtx.destination);

    const delay = audioCtx.createDelay(2);
    delay.delayTime.value = 0.38;
    const fb  = audioCtx.createGain(); fb.gain.value  = 0.42;
    const wet = audioCtx.createGain(); wet.gain.value = 0.5;
    delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(musicGain);

    const pad = audioCtx.createGain();
    pad.gain.value = 0.16;
    pad.connect(musicGain);
    pad.connect(delay);
    [130.81, 196.00, 261.63, 329.63].forEach((f, i) => {
      const o = audioCtx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const g = audioCtx.createGain();
      g.gain.value = 0.12;
      const lfo = audioCtx.createOscillator();
      lfo.frequency.value = 0.06 + i * 0.017;
      const lg = audioCtx.createGain();
      lg.gain.value = 0.05;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g);    g.connect(pad);
      o.start();       lfo.start();
    });

    synthGraph = { delay, pad };
  }

  function fadeMaster(target, secs) {
    if (!musicGain) return;
    const t = audioCtx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), t);
    musicGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), t + secs);
  }

  const SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
  const PATTERNS = [
    [0, 2, 4, 6, 4, 2, 4, 5],
    [2, 4, 6, 8, 6, 4, 5, 7],
    [4, 6, 7, 6, 4, 2, 4, 2],
    [0, 2, 4, 7, 6, 4, 2, 0]
  ];
  let patternIdx = 0, notePos = 0, nextNoteTime = 0, schedulerRunning = false;

  function scheduleSynth() {
    if (schedulerRunning) return;
    schedulerRunning = true;
    if (!nextNoteTime) nextNoteTime = audioCtx.currentTime + 0.4;
    loop();
  }
  function loop() {
    if (!synthActive) { schedulerRunning = false; return; }
    const now = audioCtx.currentTime;
    while (nextNoteTime < now + 1.2) {
      const pat  = PATTERNS[patternIdx];
      const freq = SCALE[pat[notePos % pat.length]];
      pianoNote(freq, nextNoteTime, 0.9, 0.32);
      nextNoteTime += 0.68;
      notePos++;
      if (notePos % pat.length === 0) {
        if (Math.random() < 0.35) nextNoteTime += 0.68;
        if (Math.random() < 0.55) patternIdx = (patternIdx + 1) % PATTERNS.length;
      }
    }
    setTimeout(loop, 180);
  }
  function pianoNote(freq, time, dur, amp) {
    const o1 = audioCtx.createOscillator();
    o1.type = 'triangle'; o1.frequency.value = freq;
    const o2 = audioCtx.createOscillator();
    o2.type = 'sine';     o2.frequency.value = freq * 2;

    const g1 = audioCtx.createGain(); g1.gain.value = 0.55;
    const g2 = audioCtx.createGain(); g2.gain.value = 0.25;

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(amp, time + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.7);

    o1.connect(g1); o2.connect(g2);
    g1.connect(env); g2.connect(env);
    env.connect(musicGain);
    env.connect(synthGraph.delay);

    o1.start(time); o2.start(time);
    o1.stop(time + dur + 1); o2.stop(time + dur + 1);
  }

  function startSynth() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { console.warn('WebAudio not supported'); return; }
      audioCtx = new AC();
      buildSynthGraph();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    fadeMaster((vol.value / 100) * 0.55, 2.0);
    synthActive = true;
    scheduleSynth();
  }
  function pauseSynth() {
    synthActive = false;
    fadeMaster(0.0001, 0.4);
  }

  function setMusicOn(on) {
    musicOn = on;
    musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    musicBtn.setAttribute('aria-label', on ? 'Pause background music' : 'Play background music');
  }

  function startMusic() {
    activeSource = MUSIC_URL ? 'mp3' : 'synth';
    if (activeSource === 'mp3') startMp3();
    else startSynth();
    setMusicOn(true);
  }
  function pauseMusic() {
    if (activeSource === 'mp3') pauseMp3();
    else pauseSynth();
    setMusicOn(false);
  }

  function firstInteraction() {
    if (musicStarted) return;
    musicStarted = true;
    startMusic();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, firstInteraction, { once: true, passive: true })
  );

  musicBtn.addEventListener('click', () => {
    firstInteraction();
    if (musicOn) pauseMusic();
    else startMusic();
  });

  vol.addEventListener('input', () => {
    const v = vol.value / 100;
    if (activeSource === 'mp3' && musicEl) {
      musicEl.volume = v;
    } else if (musicGain && audioCtx) {
      const target = musicOn ? v * 0.55 : 0.0001;
      musicGain.gain.setTargetAtTime(Math.max(0.0001, target), audioCtx.currentTime, 0.06);
    }
  });

  /* ---------- fx ---------- */
  const fx = $('#fxLayer');

  function spawnSpark(x, y) {
    const el = document.createElement('div');
    el.className = 'fx-spark';
    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 140;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.setProperty('--dx', (Math.cos(ang) * dist) + 'px');
    el.style.setProperty('--dy', (Math.sin(ang) * dist - 40) + 'px');
    el.style.setProperty('--dur', (0.9 + Math.random() * 0.9) + 's');
    el.style.width = el.style.height = (4 + Math.random() * 6) + 'px';
    fx.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function spawnHeart(x, y) {
    const el = document.createElement('div');
    el.className = 'fx-heart';
    el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-heart"/></svg>';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.setProperty('--dx', ((Math.random() - .5) * 120) + 'px');
    el.style.setProperty('--dy', (-80 - Math.random() * 120) + 'px');
    el.style.setProperty('--dur', (1.6 + Math.random() * .8) + 's');
    el.style.width = el.style.height = (14 + Math.random() * 10) + 'px';
    fx.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function flash(x, y) {
    const el = document.createElement('div');
    el.className = 'flash';
    el.style.setProperty('--x', x + 'px');
    el.style.setProperty('--y', y + 'px');
    document.body.appendChild(el);
    el.classList.add('is-on');
    setTimeout(() => el.remove(), 1200);
  }

  function celebrate(x, y) {
    flash(x, y);
    if (prefersReduced) return;
    for (let i = 0; i < 46; i++) {
      setTimeout(() => spawnSpark(x + (Math.random() - .5) * 40, y + (Math.random() - .5) * 40), i * 14);
    }
    for (let i = 0; i < 8; i++) {
      setTimeout(() => spawnHeart(x + (Math.random() - .5) * 160, y + (Math.random() - .5) * 40), i * 90);
    }
  }

  /* ---------- invite -> question ---------- */
  $('#openBtn').addEventListener('click', () => {
    firstInteraction();
    goTo('question');
  });

  /* ---------- No button (playful dodge) ---------- */
  const noBtn = $('#noBtn');
  const tease = $('#tease');
  const teaseLines = [
    "That button is a little shy.",
    "Try the other one — it's much friendlier.",
    "It keeps slipping away, doesn't it?",
    "I think the universe is telling you something.",
    "The Yes button is waiting for you.",
    "Okay, okay — it's really not the one to pick."
  ];
  let dodgeCount = 0;
  const MAX_DODGES = 9;

  function moveNo() {
    if (dodgeCount >= MAX_DODGES) return;
    dodgeCount++;

    const r = noBtn.getBoundingClientRect();
    const curX = r.left, curY = r.top;
    const vw = window.innerWidth, vh = window.innerHeight;

    let tx = curX + (Math.random() - .5) * Math.min(320, vw * .6);
    let ty = curY + (Math.random() - .5) * Math.min(240, vh * .4);

    tx = Math.max(12, Math.min(vw - r.width - 12, tx));
    ty = Math.max(12, Math.min(vh - r.height - 12, ty));

    noBtn.style.transform = `translate(${tx - curX}px, ${ty - curY}px)`;

    if (dodgeCount >= MAX_DODGES) {
      tease.textContent = "Alright, it'll stay still now. (But Yes is still right there.)";
    } else {
      tease.textContent = teaseLines[Math.min(dodgeCount - 1, teaseLines.length - 1)];
    }
  }

  document.addEventListener('pointermove', (e) => {
    if (current !== 'question') return;
    const r = noBtn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = Math.hypot(e.clientX - cx, e.clientY - cy);
    const trigger = Math.max(r.width, r.height) * .75 + 24;
    if (d < trigger) moveNo();
  });

  noBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    moveNo();
  }, { passive: false });

  noBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (dodgeCount < MAX_DODGES) { moveNo(); return; }
    tease.textContent = "Okay, I'll take that as a 'maybe'. 😊 The Yes button is right there.";
    noBtn.style.transform = '';
  });

  window.addEventListener('resize', () => {
    noBtn.style.transform = '';
    dodgeCount = 0;
    tease.textContent = '';
  });

  /* ---------- YES ---------- */
  $('#yesBtn').addEventListener('click', () => {
    const r = $('#yesBtn').getBoundingClientRect();
    celebrate(r.left + r.width / 2, r.top + r.height / 2);
    setTimeout(() => {
      goTo('plan');
      noBtn.style.transform = '';
      dodgeCount = 0;
    }, prefersReduced ? 200 : 750);
  });

  /* ---------- plan state ---------- */
  const STORAGE_KEY = 'dysel-date-v1';
  const state = {
    date: '',
    time: '',
    location: '',
    locationCustom: '',
    food: '',
    foodCustom: '',
    notes: ''
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw) || {});
  } catch (_) {}

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  /* date */
  const dateInput = $('#dateInput');
  if (state.date) dateInput.value = state.date;

  const today = new Date();
  dateInput.min =
    today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  dateInput.addEventListener('change', () => {
    state.date = dateInput.value;
    clearInvalid('fieldDate');
    saveState();
  });

  /* generic radio group */
  function bindRadioGroup(groupEl, key, onChange) {
    const opts = $$('.option', groupEl);

    const apply = (val) => {
      opts.forEach(o => {
        const on = o.dataset.value === val;
        o.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    };
    if (state[key]) apply(state[key]);

    opts.forEach((o, idx) => {
      o.addEventListener('click', () => {
        state[key] = o.dataset.value;
        apply(state[key]);
        saveState();
        onChange && onChange(state[key]);
        const field = groupEl.closest('.field');
        if (field) field.classList.remove('is-invalid');
      });
      o.addEventListener('keydown', (e) => {
        let dir = 0;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') dir = 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') dir = -1;
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); o.click(); return; }
        if (dir) {
          e.preventDefault();
          const next = (idx + dir + opts.length) % opts.length;
          opts[next].focus();
          opts[next].click();
        }
      });
    });
  }

  /* location */
  const customLocWrap = $('#customLocWrap');
  const customLocInput = $('#customLocInput');
  if (state.locationCustom) customLocInput.value = state.locationCustom;

  bindRadioGroup($('#locationOptions'), 'location', (val) => {
    const isCustom = val === 'custom';
    customLocWrap.hidden = !isCustom;
    if (isCustom) setTimeout(() => customLocInput.focus(), 60);
  });
  customLocWrap.hidden = state.location !== 'custom';

  customLocInput.addEventListener('input', () => {
    state.locationCustom = customLocInput.value;
    saveState();
    const field = customLocWrap.closest('.field');
    if (field) field.classList.remove('is-invalid');
  });

  /* food */
  const customFoodWrap = $('#customFoodWrap');
  const customFoodInput = $('#customFoodInput');
  if (state.foodCustom) customFoodInput.value = state.foodCustom;

  bindRadioGroup($('#foodOptions'), 'food', (val) => {
    const isCustom = val === 'custom';
    customFoodWrap.hidden = !isCustom;
    if (isCustom) setTimeout(() => customFoodInput.focus(), 60);
  });
  customFoodWrap.hidden = state.food !== 'custom';

  customFoodInput.addEventListener('input', () => {
    state.foodCustom = customFoodInput.value;
    saveState();
    const field = customFoodWrap.closest('.field');
    if (field) field.classList.remove('is-invalid');
  });

  /* notes */
  const notesInput = $('#notesInput');
  if (state.notes) notesInput.value = state.notes;
  notesInput.addEventListener('input', () => {
    state.notes = notesInput.value;
    saveState();
  });

  function markInvalid(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('is-invalid');
    void el.offsetWidth;
    el.classList.add('is-invalid');
  }
  function clearInvalid(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('is-invalid');
  }

  /* ---------- confirm ---------- */
  const planForm = $('#planForm');
  planForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const errors = [];
    if (!state.date) { markInvalid('fieldDate'); errors.push('date'); }
    if (!state.time) { markInvalid('fieldTime'); errors.push('time'); }
    if (!state.location) { markInvalid('fieldLocation'); errors.push('location'); }
    else if (state.location === 'custom' && !state.locationCustom.trim()) {
      markInvalid('fieldLocation'); errors.push('location');
    }
    if (!state.food) { markInvalid('fieldFood'); errors.push('food'); }
    else if (state.food === 'custom' && !state.foodCustom.trim()) {
      markInvalid('fieldFood'); errors.push('food');
    }

    if (errors.length) {
      const first = document.querySelector('.field.is-invalid');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    saveState();
    fillSummary();
    goTo('confirm');
    setTimeout(() => celebrate(window.innerWidth / 2, window.innerHeight * 0.28),
               prefersReduced ? 0 : 250);
  });

  /* ---------- summary helpers ---------- */
  function prettyDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  function locationText() {
    if (state.location === 'custom') return state.locationCustom.trim() || 'A place of your choosing';
    return state.location || '—';
  }
  function foodText() {
    if (state.food === 'custom') return state.foodCustom.trim() || 'Something delicious';
    return state.food || '—';
  }

  function fillSummary() {
    $('#sumDate').textContent = prettyDate(state.date);
    $('#sumTime').textContent = state.time || '—';
    $('#sumLocation').textContent = locationText();
    $('#sumFood').textContent = foodText();

    const notes = (state.notes || '').trim();
    if (notes) {
      $('#sumNotesRow').hidden = false;
      $('#sumNotes').textContent = notes;
    } else {
      $('#sumNotesRow').hidden = true;
    }
  }
  fillSummary();

  /* ---------- save as .txt ---------- */
  $('#saveBtn').addEventListener('click', () => {
    const lines = [
      'A little date to look forward to',
      '',
      'For:       Dysel Bel',
      'Date:      ' + prettyDate(state.date),
      'Time:      ' + (state.time || '—'),
      'Location:  ' + locationText(),
      'Food:      ' + foodText(),
      (state.notes || '').trim() ? 'Notes:     ' + state.notes.trim() : null,
      '',
      'Saved ' + new Date().toLocaleString(),
      '— made with care'
    ].filter(v => v !== null);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dysel-bel-date.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);

    const r = $('#saveBtn').getBoundingClientRect();
    celebrate(r.left + r.width / 2, r.top + r.height / 2);
  });

  /* ---------- edit ---------- */
  $('#editBtn').addEventListener('click', () => {
    fillFormFromState();
    goTo('plan');
  });

  function fillFormFromState() {
    dateInput.value = state.date || '';
    ['time', 'location', 'food'].forEach(key => {
      const groupSel = '#' + key + 'Options';
      $$(groupSel + ' .option').forEach(o => {
        o.setAttribute('aria-checked', o.dataset.value === state[key] ? 'true' : 'false');
      });
    });
    customLocWrap.hidden = state.location !== 'custom';
    customFoodWrap.hidden = state.food !== 'custom';
    customLocInput.value = state.locationCustom || '';
    customFoodInput.value = state.foodCustom || '';
    notesInput.value = state.notes || '';
  }

  if (state.time || state.location || state.food) fillFormFromState();

  /* ---------- keyboard shortcuts ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (current === 'confirm') { fillFormFromState(); goTo('plan'); }
    else if (current === 'plan') { goTo('question'); }
  });
})();

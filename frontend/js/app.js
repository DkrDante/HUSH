/**
 * HUSH App – Main JavaScript (v2)
 * Fixes: init order, buttons always active, auto-add mode, word dictionary
 */
'use strict';

const WS_URL = `ws://${location.host}/ws`;
const FRAME_INTERVAL_MS = 150;
const STABLE_HOLD_MS = 1800;   // hold time before auto-add (ms)
const AUTO_COOLDOWN_MS = 1200; // cooldown after auto-add (ms)
const ISL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''); // ← moved here

// ─── ISL Word Dictionary ──────────────────────────────────────
const WORD_DICT = [
  'HOPE', 'LOVE', 'PEACE', 'HAPPY', 'HELLO', 'HELP', 'GOOD', 'GREAT',
  'WATER', 'FOOD', 'HOME', 'HOUSE', 'FAMILY', 'FRIEND', 'PLEASE',
  'SORRY', 'THANK', 'YES', 'NO', 'GO', 'COME', 'STOP', 'WORK',
  'EAT', 'DRINK', 'SLEEP', 'LEARN', 'SIGN', 'HAND', 'DAY', 'NIGHT',
  'INDIA', 'MOTHER', 'FATHER', 'BROTHER', 'SISTER', 'SCHOOL', 'BOOK',
  'OPEN', 'WANT', 'NEED', 'KNOW', 'SEE', 'HEAR', 'FEEL', 'THINK',
  'SPEAK', 'WRITE', 'READ', 'PLAY', 'RUN', 'WALK', 'SIT', 'STAND',
  'GIVE', 'TAKE', 'MAKE', 'LIKE', 'TIME', 'SAFE', 'FREE', 'BRAVE',
  'STRONG', 'FAST', 'SLOW', 'BEAUTIFUL', 'NICE', 'KIND', 'PAIN',
  'HURT', 'SICK', 'WELL', 'DOCTOR', 'NAME', 'WHERE', 'WHEN', 'HOW',
  'WHAT', 'WHO', 'WHY', 'HELP', 'CALL', 'FIRE', 'POLICE', 'LOST',
  'COME', 'WAIT', 'DONE', 'OKAY', 'FINE', 'SURE', 'MAYBE', 'HOLD',
  'LOVE', 'HATE', 'FEAR', 'HOPE', 'WISH', 'DREAM', 'LIFE', 'LIVE',
  'CARE', 'LAUGH', 'CRY', 'SING', 'DANCE', 'SWIM', 'JUMP', 'FALL',
  'OPEN', 'CLOSE', 'LIGHT', 'DARK', 'BIG', 'SMALL', 'HOT', 'COLD'
];

// ─── ISL Tips ─────────────────────────────────────────────────
const TIPS = {
  A: "Fist with thumb resting on the side of index finger.",
  B: "All 4 fingers up, thumb folded across palm.",
  C: "Curve all fingers and thumb to form a 'C'.",
  D: "Index up, thumb touches middle finger.",
  E: "All fingers bent at middle joints, thumb tucked.",
  F: "Index+thumb circle (OK), 3 fingers extended.",
  G: "Index points sideways, thumb parallel.",
  H: "Index+middle extended horizontally together.",
  I: "Only pinky extended upright.",
  J: "Pinky up, trace a 'J' arc in the air.",
  K: "V sign with thumb between index and middle.",
  L: "Index up + thumb out = L shape.",
  M: "Three fingers folded over thumb.",
  N: "Two fingers (index+middle) folded over thumb.",
  O: "All fingertips meet thumb forming an 'O'.",
  P: "K shape tilted downward.",
  Q: "G shape tilted downward.",
  R: "Index and middle fingers crossed.",
  S: "Fist with thumb wrapped over curled fingers.",
  T: "Fist with thumb between index and middle.",
  U: "Index+middle extended upright together.",
  V: "Peace sign – index+middle spread apart.",
  W: "Index, middle, ring fingers spread upward.",
  X: "Index finger bent/hooked like a hook.",
  Y: "Thumb+pinky extended outward (shaka sign).",
  Z: "Index extended, trace a 'Z' in the air.",
};

// ─── State ────────────────────────────────────────────────────
const state = {
  ws: null,
  stream: null,
  frameTimer: null,
  paused: false,
  flipped: false,
  currentLetter: null,
  word: '',
  frames: 0,
  detected: 0,
  letterCounts: {},
  streakCount: 0,
  lastStreak: null,
  autoMode: false,
  autoTimer: null,
  autoCooldown: false,
  autoProgress: 0,
  autoProgressTimer: null,
};

// ─── DOM ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const video = $('video');
const canvas = $('canvas');
const noHandOverlay = $('no-hand-overlay');
const permOverlay = $('permission-overlay');
const resultLetter = $('result-letter');
const resultState = $('result-state');
const confidenceBar = $('confidence-bar');
const confidenceVal = $('confidence-value');
const confidenceWrap = $('confidence-wrap');
const tipText = $('tip-text');
const statusDot = $('status-dot');
const statusText = $('status-text');
const srAnnounce = $('sr-announcement');
const wordDisplay = $('word-display');
const addLetterBtn = $('add-letter-btn');
const spaceBtn = $('space-btn');
const backspaceBtn = $('backspace-btn');
const clearBtn = $('clear-btn');
const copyWordBtn = $('copy-word-btn');
const charCount = $('word-char-count');
const statFrames = $('stat-frames');
const statDetected = $('stat-detected');
const statLetters = $('stat-letters');
const statStreak = $('stat-streak');
const topList = $('top-letters-list');
const resetBtn = $('reset-stats-btn');
const toggleCamBtn = $('toggle-camera-btn');
const flipCamBtn = $('flip-camera-btn');
const hcBtn = $('hc-btn');
const reqCamBtn = $('request-camera-btn');
const autoModeBtn = $('auto-mode-btn');
const autoProgress = $('auto-progress');
const suggestionsEl = $('word-suggestions');
const quickGrid = $('quick-ref-grid');
const toastCnt = $('toast-container');
const holdRing = $('hold-ring');

// ─── Init — controls FIRST, then async ───────────────────────
setupControls();   // ← always runs, no await needed
buildQuickRef();
startCamera().catch(err => {
  console.error('Camera start failed:', err);
  toast('📷 Allow camera access to start', 'error');
});
connectWS();
updateWordDisplay();

// ─── Camera ──────────────────────────────────────────────────
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  state.stream = stream;
  video.srcObject = stream;
  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
  };
  hideOverlay(permOverlay);
  showOverlay(noHandOverlay);
  startFrameLoop();
  toast('📷 Camera ready!', 'success');
}

function startFrameLoop() {
  clearInterval(state.frameTimer);
  state.frameTimer = setInterval(() => {
    if (!state.paused && state.ws?.readyState === WebSocket.OPEN
      && video.srcObject) {   // stream assigned is enough
      sendFrame();
    }
  }, FRAME_INTERVAL_MS);
}

function sendFrame() {
  try {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1); // always mirror for selfie view
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    const b64 = canvas.toDataURL('image/jpeg', 0.65).split(',')[1];
    state.ws.send(b64);
  } catch (e) { /* ignore single frame errors */ }
}

// ─── WebSocket ────────────────────────────────────────────────
function connectWS() {
  setStatus('connecting');
  const ws = new WebSocket(WS_URL);
  state.ws = ws;

  ws.onopen = () => { setStatus('connected'); toast('🔗 Connected', 'info'); };
  ws.onclose = () => { setStatus('disconnected'); setTimeout(connectWS, 2500); };
  ws.onerror = () => ws.close();

  ws.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.type === 'result') handleResult(d);
    } catch (err) {
      console.error('[HUSH] WS handler error:', err);
    }
  };
}

// ─── Result ───────────────────────────────────────────────────
function handleResult(data) {
  state.frames++;
  if (statFrames) statFrames.textContent = state.frames;

  if (!data.hand_detected) {
    showOverlay(noHandOverlay);
    clearDetection();
    clearAutoTimer();
    return;
  }
  hideOverlay(noHandOverlay);
  state.detected++;
  if (statDetected) statDetected.textContent = state.detected;

  const letter = data.letter;
  const pending = data.pending_letter;
  const confidence = data.confidence || 0;

  if (letter) {
    if (letter !== state.currentLetter) {
      // New letter — reset auto-add timer
      state.currentLetter = letter;
      clearAutoTimer();
      animateLetter(letter);
      updateStreak(letter);
      quickGridHighlight(letter);
      announceToSR(`Detected: ${letter}`);
      if (TIPS[letter]) tipText.textContent = TIPS[letter];
      addLetterBtn.disabled = false;
      addLetterBtn.dataset.letter = letter;
      resultState.textContent = 'Detected ✓';

      // Start auto-add timer if enabled
      if (state.autoMode) startAutoTimer(letter);

    } else if (state.autoMode && !state.autoCooldown && !_autoProgressInterval) {
      // Same letter, auto mode on, no timer running — start it
      startAutoTimer(letter);
    }
  } else if (pending) {
    // Not stable yet — show pending
    resultLetter.textContent = pending;
    resultLetter.style.opacity = '0.4';
    resultState.textContent = 'Stabilizing…';
    clearAutoTimer();
    state.currentLetter = null;
    addLetterBtn.disabled = true;
  }

  setConfidence(Math.round(confidence * 100));
}

function clearDetection() {
  if (!state.currentLetter) return;
  state.currentLetter = null;
  resultLetter.textContent = '–';
  resultLetter.style.opacity = '1';
  resultState.textContent = 'Show your hand…';
  setConfidence(0);
  addLetterBtn.disabled = true;
  addLetterBtn.dataset.letter = '';
  tipText.textContent = 'Hold a clear ISL letter in frame.';
  quickGridClearHighlight();
  setAutoProgress(0);
}

function animateLetter(letter) {
  resultLetter.style.opacity = '1';
  resultLetter.textContent = letter;
  resultLetter.classList.remove('pop');
  void resultLetter.offsetWidth;
  resultLetter.classList.add('pop');
}

function updateStreak(letter) {
  state.letterCounts[letter] = (state.letterCounts[letter] || 0) + 1;
  if (statLetters) statLetters.textContent = Object.keys(state.letterCounts).length;
  if (letter === state.lastStreak) { state.streakCount++; }
  else { state.streakCount = 1; state.lastStreak = letter; }
  if (statStreak) statStreak.textContent = state.streakCount;
  updateTopLetters();
}

function setConfidence(pct) {
  if (!confidenceBar) return;
  confidenceBar.style.width = pct + '%';
  if (confidenceVal) confidenceVal.textContent = pct + '%';
  if (confidenceWrap) confidenceWrap.setAttribute('aria-valuenow', pct);
  const color = pct >= 80
    ? 'linear-gradient(90deg,var(--accent-green),var(--accent-cyan))'
    : pct >= 50
      ? 'linear-gradient(90deg,var(--accent-yellow),var(--accent-cyan))'
      : 'linear-gradient(90deg,var(--accent-pink),var(--accent-purple))';
  confidenceBar.style.background = color;
}

// ─── Auto-Add ────────────────────────────────────────────────
let _autoProgressInterval = null;
let _autoStartTime = 0;

function startAutoTimer(letter) {
  clearAutoTimer();
  _autoStartTime = Date.now();
  _autoProgressInterval = setInterval(() => {
    const elapsed = Date.now() - _autoStartTime;
    const pct = Math.min(100, (elapsed / STABLE_HOLD_MS) * 100);
    setAutoProgress(pct);
    if (pct >= 100) {
      clearAutoTimer();
      if (state.currentLetter === letter && !state.autoCooldown) {
        doAutoAdd(letter);
      }
    }
  }, 50);
}

function clearAutoTimer() {
  clearInterval(_autoProgressInterval);
  _autoProgressInterval = null;
  setAutoProgress(0);
}

function doAutoAdd(letter) {
  state.autoCooldown = true;
  addToWord(letter);
  toast(`✅ Auto-added: ${letter}`, 'success', 1200);
  setTimeout(() => { state.autoCooldown = false; }, AUTO_COOLDOWN_MS);
}

function setAutoProgress(pct) {
  if (holdRing) {
    holdRing.style.background =
      `conic-gradient(var(--accent-cyan) ${pct}%, rgba(255,255,255,0.06) ${pct}%)`;
    holdRing.style.opacity = pct > 0 ? '1' : '0';
  }
  if (autoProgress) {
    autoProgress.style.width = pct + '%';
    autoProgress.parentElement.style.opacity = pct > 0 ? '1' : '0';
  }
}

// ─── Word Builder ────────────────────────────────────────────
function addToWord(letter) {
  state.word += letter;
  updateWordDisplay();
  updateSuggestions();
}

function updateWordDisplay() {
  if (!wordDisplay) return;
  const w = state.word.trim();
  wordDisplay.textContent = state.word || '';
  if (!state.word) {
    wordDisplay.innerHTML = '<span class="word-placeholder">Your word appears here…</span>';
  }
  if (charCount) charCount.textContent = state.word.length + ' chars';
}

// ─── Word Suggestions ────────────────────────────────────────
function updateSuggestions() {
  if (!suggestionsEl) return;
  const current = state.word.replace(/\s/g, '').toUpperCase();
  if (current.length < 2) {
    suggestionsEl.innerHTML = '';
    return;
  }
  // Last partial word (after last space)
  const parts = state.word.toUpperCase().split(' ');
  const partial = parts[parts.length - 1];

  let matches = WORD_DICT.filter(w => w.startsWith(partial) && w !== partial);
  // Also check full match
  const exact = WORD_DICT.includes(partial);

  if (exact && partial.length >= 3) {
    matches = [partial + ' ✓', ...matches.filter(m => m !== partial)];
  }
  matches = matches.slice(0, 6);

  if (!matches.length) { suggestionsEl.innerHTML = ''; return; }

  suggestionsEl.innerHTML = `
    <div class="suggestions-label">Suggestions</div>
    <div class="suggestions-chips">
      ${matches.map(m => `
        <button class="suggestion-chip ${m.endsWith('✓') ? 'exact' : ''}"
          data-word="${m.replace(' ✓', '')}"
          aria-label="Use word ${m}">
          ${m}
        </button>`).join('')}
    </div>`;

  suggestionsEl.querySelectorAll('.suggestion-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.dataset.word;
      // Replace last partial word
      const parts = state.word.split(' ');
      parts[parts.length - 1] = w;
      state.word = parts.join(' ') + ' ';
      updateWordDisplay();
      updateSuggestions();
      toast(`💬 Used "${w}"`, 'success', 1500);
    });
  });
}

// ─── Top Letters ─────────────────────────────────────────────
function updateTopLetters() {
  if (!topList) return;
  const sorted = Object.entries(state.letterCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = sorted[0]?.[1] || 1;
  topList.innerHTML = sorted.map(([l, c]) => `
    <div class="top-letter-row">
      <span class="top-letter-key">${l}</span>
      <div class="top-letter-bar progress-bar" style="height:6px">
        <div class="progress-fill" style="width:${Math.round(c / max * 100)}%"></div>
      </div>
      <span class="top-letter-count">${c}</span>
    </div>`).join('');
}

function buildQuickRef() {
  if (!quickGrid) return;
  quickGrid.innerHTML = ISL_LETTERS.map(l => `
    <button class="qref-tile" id="qref-${l}" aria-label="${l}: ${TIPS[l] || ''}">${l}</button>
  `).join('');
  quickGrid.querySelectorAll('.qref-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      const l = btn.textContent.trim();
      toast(`${l} — ${TIPS[l] || 'ISL gesture'}`, 'info', 3000);
    });
  });
}

function quickGridHighlight(letter) {
  quickGridClearHighlight();
  document.getElementById(`qref-${letter}`)?.classList.add('highlight');
}
function quickGridClearHighlight() {
  document.querySelectorAll('.qref-tile.highlight').forEach(e => e.classList.remove('highlight'));
}

// ─── Overlays ────────────────────────────────────────────────
function showOverlay(el) { el?.classList.remove('hidden'); }
function hideOverlay(el) { el?.classList.add('hidden'); }

// ─── Status ──────────────────────────────────────────────────
function setStatus(s) {
  if (statusDot) { statusDot.className = 'pulse-dot ' + s; }
  if (statusText) statusText.textContent = { connected: 'Connected', disconnected: 'Reconnecting…', connecting: 'Connecting…' }[s] || s;
}

// ─── Controls Setup ──────────────────────────────────────────
function setupControls() {
  // Camera request
  reqCamBtn?.addEventListener('click', () => startCamera().catch(console.error));

  // Add letter
  addLetterBtn?.addEventListener('click', () => {
    const l = state.currentLetter || addLetterBtn.dataset.letter;
    if (l) addToWord(l);
  });

  // Space
  spaceBtn?.addEventListener('click', () => {
    state.word += ' ';
    updateWordDisplay();
    updateSuggestions();
  });

  // Backspace
  backspaceBtn?.addEventListener('click', () => {
    state.word = state.word.slice(0, -1);
    updateWordDisplay();
    updateSuggestions();
  });

  // Clear
  clearBtn?.addEventListener('click', () => {
    state.word = '';
    updateWordDisplay();
    if (suggestionsEl) suggestionsEl.innerHTML = '';
    toast('Cleared', 'info', 1200);
  });

  // Copy
  copyWordBtn?.addEventListener('click', async () => {
    if (!state.word.trim()) { toast('Nothing to copy', 'error'); return; }
    try {
      await navigator.clipboard.writeText(state.word.trim());
      toast('📋 Copied!', 'success');
    } catch { toast('Copy failed — select text manually', 'error'); }
  });

  // Pause / resume camera
  toggleCamBtn?.addEventListener('click', () => {
    state.paused = !state.paused;
    toggleCamBtn.innerHTML = state.paused ? '▶ Resume' : '⏸ Pause';
    toast(state.paused ? 'Paused' : 'Resumed', 'info', 1200);
  });

  // Flip camera
  flipCamBtn?.addEventListener('click', () => {
    state.flipped = !state.flipped;
    video.style.transform = state.flipped ? 'scaleX(1)' : 'scaleX(-1)';
    toast('🔄 Flipped', 'info', 1200);
  });

  // High contrast
  hcBtn?.addEventListener('click', () => {
    document.body.classList.toggle('high-contrast');
    toast('🌓 Contrast toggled', 'info', 1200);
  });

  // Auto mode toggle
  autoModeBtn?.addEventListener('click', () => {
    state.autoMode = !state.autoMode;
    autoModeBtn.classList.toggle('active', state.autoMode);
    autoModeBtn.innerHTML = state.autoMode ? '🤖 Auto ON' : '🤖 Auto';
    toast(state.autoMode
      ? '🤖 Auto-add ON — hold a letter to add it automatically'
      : '🤖 Auto-add OFF', 'info', 2500);
    if (!state.autoMode) clearAutoTimer();
  });

  // Reset stats
  resetBtn?.addEventListener('click', async () => {
    Object.assign(state, { frames: 0, detected: 0, letterCounts: {}, streakCount: 0, lastStreak: null });
    ['stat-frames', 'stat-detected', 'stat-letters', 'stat-streak']
      .forEach(id => { const el = $(id); if (el) el.textContent = '0'; });
    if (topList) topList.innerHTML = '';
    await fetch('/api/stats/reset', { method: 'POST' }).catch(() => { });
    toast('Stats reset', 'info', 1200);
  });

  // Common word chips
  document.querySelectorAll('.word-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      addToWord(btn.dataset.word + ' ');
      toast(`💬 Added "${btn.dataset.word}"`, 'success', 1500);
    });
  });

  // Keyboard shortcuts  
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'Enter' && state.currentLetter) {
      addToWord(state.currentLetter);
    }
    if (e.key === ' ') {
      e.preventDefault(); state.word += ' ';
      updateWordDisplay(); updateSuggestions();
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      state.word = state.word.slice(0, -1);
      updateWordDisplay(); updateSuggestions();
    }
  });
}

// ─── Toast ───────────────────────────────────────────────────
function toast(msg, type = 'info', dur = 3000) {
  if (!toastCnt) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastCnt.appendChild(el);
  setTimeout(() => el.remove(), dur);
}

// ─── SR Announce ─────────────────────────────────────────────
let _srTimer;
function announceToSR(msg) {
  clearTimeout(_srTimer);
  if (srAnnounce) srAnnounce.textContent = '';
  _srTimer = setTimeout(() => { if (srAnnounce) srAnnounce.textContent = msg; }, 80);
}

// ─── Navbar scroll ───────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.querySelector('.navbar')?.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

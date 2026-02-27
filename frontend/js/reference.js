/**
 * HUSH – Reference Page (v2)
 * Fixed: simpler rendering, reliable click handlers, modal focus
 */
'use strict';

let gestures = [];

const grid = document.getElementById('alpha-grid');
const searchInput = document.getElementById('ref-search');
const showAllBtn = document.getElementById('show-all-btn');
const modal = document.getElementById('detail-modal');
const backdrop = document.getElementById('modal-backdrop');
const closeBtn = document.getElementById('modal-close');
const toastCnt = document.getElementById('toast-container');

const modalLetterBig = document.getElementById('modal-letter');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalFingersVal = document.getElementById('modal-fingers-val');
const modalTipVal = document.getElementById('modal-tip-val');
const modalBadges = document.getElementById('modal-badges');

// ─── Boot ──────────────────────────────────────────────────────
(async function init() {
    document.querySelector('.navbar')?.classList.add('scrolled');
    await loadGestures();
    renderGrid(gestures);
    setupSearch();
    setupModal();
})();

// ─── Load gestures from API ───────────────────────────────────
async function loadGestures() {
    try {
        const res = await fetch('/api/gestures');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        gestures = data.letters || [];
        if (!gestures.length) throw new Error('Empty response');
    } catch (err) {
        console.warn('API fallback:', err);
        // Inline fallback data
        const TIPS = {
            A: "Fist with thumb on the side of index finger.",
            B: "4 fingers extended up, thumb folded across palm.",
            C: "Curve all fingers and thumb in a 'C' shape.",
            D: "Index up, thumb touches middle finger.",
            E: "All fingers bent at middle joints, thumb tucked.",
            F: "Index+thumb OK circle, 3 fingers up.",
            G: "Index points sideways, thumb parallel.",
            H: "Index+middle horizontal together.",
            I: "Only pinky extended.",
            J: "Pinky up, trace a J arc.",
            K: "V sign with thumb between fingers.",
            L: "Index up + thumb out = L.",
            M: "Three fingers folded over thumb.",
            N: "Two fingers folded over thumb.",
            O: "All fingertips meet thumb forming O.",
            P: "K shape pointed down.",
            Q: "G shape pointed down.",
            R: "Index+middle crossed.",
            S: "Fist, thumb over fingers.",
            T: "Thumb between index and middle.",
            U: "Index+middle up together.",
            V: "Peace sign, fingers spread.",
            W: "Three fingers spread upward.",
            X: "Index hooked down.",
            Y: "Thumb+pinky out (shaka).",
            Z: "Index traces a Z."
        };
        gestures = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => ({
            letter: l,
            description: TIPS[l] || `ISL gesture for letter ${l}`,
            fingers: '—',
            tip: `Hold the ${l} gesture steady in frame.`
        }));
        toast('Using cached data (server not reachable)', 'info');
    }
}

// ─── Render grid ──────────────────────────────────────────────
function renderGrid(items) {
    if (!grid) return;

    if (!items.length) {
        grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🤷</div>
        <p>No letters match your search.</p>
      </div>`;
        return;
    }

    // Build HTML without opacity tricks — pure CSS transitions
    grid.innerHTML = items.map((g) => `
    <article class="alpha-card"
      role="listitem"
      tabindex="0"
      aria-label="ISL letter ${g.letter}: ${g.description}"
      data-letter="${g.letter}"
    >
      <div class="card-letter">${g.letter}</div>
      <div class="card-fingers">${g.fingers || '—'}</div>
      <div class="card-desc">${(g.description || '').substring(0, 72)}${(g.description || '').length > 72 ? '…' : ''}</div>
    </article>
  `).join('');

    // Attach click + keyboard handlers to every card
    grid.querySelectorAll('.alpha-card').forEach(card => {
        const letter = card.dataset.letter;
        card.addEventListener('click', () => openModal(letter));
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openModal(letter);
            }
        });
    });
}

// ─── Search ───────────────────────────────────────────────────
function setupSearch() {
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        if (!q) { renderGrid(gestures); return; }
        const filtered = gestures.filter(g =>
            g.letter.toLowerCase().includes(q) ||
            (g.description || '').toLowerCase().includes(q) ||
            (g.fingers || '').toLowerCase().includes(q)
        );
        renderGrid(filtered);
    });

    showAllBtn?.addEventListener('click', () => {
        searchInput.value = '';
        renderGrid(gestures);
    });
}

// ─── Modal ────────────────────────────────────────────────────
let _prevFocus = null;

function setupModal() {
    closeBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });
}

function openModal(letter) {
    const g = gestures.find(x => x.letter === letter);
    if (!g || !modal) return;

    _prevFocus = document.activeElement;

    if (modalLetterBig) { modalLetterBig.textContent = g.letter; }
    if (modalTitle) { modalTitle.textContent = `Letter ${g.letter}`; }
    if (modalDesc) { modalDesc.textContent = g.description || '—'; }
    if (modalFingersVal) { modalFingersVal.textContent = g.fingers || '—'; }
    if (modalTipVal) { modalTipVal.textContent = g.tip || '—'; }
    if (modalBadges) {
        modalBadges.innerHTML = `
    <span class="badge badge-purple badge-dot">ISL</span>
    <span class="badge badge-cyan">Static</span>`;
    }

    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    // Focus the close button (accessible)
    setTimeout(() => closeBtn?.focus(), 50);
}

function closeModal() {
    if (!modal) return;
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
    _prevFocus?.focus();
}

// ─── Toast ────────────────────────────────────────────────────
function toast(msg, type = 'info', dur = 3000) {
    if (!toastCnt) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    toastCnt.appendChild(el);
    setTimeout(() => el.remove(), dur);
}

// Navbar scroll
window.addEventListener('scroll', () => {
    document.querySelector('.navbar')?.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

/**
 * HUSH – Landing Page JS
 * Demo animation, navbar scroll, hero letter cycle
 */

// Navbar scroll effect
window.addEventListener('scroll', () => {
    document.querySelector('.navbar')?.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// Demo letter cycling in hero card
const demoLetters = document.querySelectorAll('.demo-letter');
const demoHand = document.querySelector('.demo-hand');
const demoBar = document.getElementById('demo-bar');

const handEmojis = ['🤟', '✌️', '👆', '🤙', '👋', '🤘', '👌', '🖐️'];
const pairs = [
    { idx: 0, letter: 'I', emoji: '🤟', conf: 87 },
    { idx: 1, letter: 'S', emoji: '✊', conf: 91 },
    { idx: 2, letter: 'L', emoji: '🤙', conf: 83 },
];

let pairIdx = 0;
function cycleLetter() {
    const prev = pairs[(pairIdx - 1 + pairs.length) % pairs.length].idx;
    demoLetters[prev]?.classList.remove('active');

    const p = pairs[pairIdx];
    demoLetters[p.idx]?.classList.add('active');
    if (demoHand) demoHand.textContent = p.emoji;
    if (demoBar) {
        demoBar.style.width = p.conf + '%';
        demoBar.nextElementSibling && (demoBar.nextElementSibling.textContent = p.conf + '%');
    }
    // Update confidence display
    const confSpan = document.querySelector('.demo-confidence .mono');
    if (confSpan) confSpan.textContent = p.conf + '%';

    pairIdx = (pairIdx + 1) % pairs.length;
}
setInterval(cycleLetter, 1800);
cycleLetter();

// Animate sections on scroll
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.querySelectorAll('.animate-fade-up').forEach((el, i) => {
                el.style.animationDelay = (i * 0.1) + 's';
                el.style.opacity = '';
                el.classList.add('animate-fade-up');
            });
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.section').forEach(s => observer.observe(s));

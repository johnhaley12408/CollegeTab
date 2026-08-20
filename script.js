const root = document.documentElement;
const cursor = document.querySelector('.cursor-dot');
const orbs = [...document.querySelectorAll('.orb')];

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let smoothX = mouseX;
let smoothY = mouseY;

window.addEventListener('pointermove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  root.style.setProperty('--mx', `${(e.clientX / innerWidth) * 100}%`);
  root.style.setProperty('--my', `${(e.clientY / innerHeight) * 100}%`);
  if (cursor) {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  }
});

function animateField() {
  smoothX += (mouseX - smoothX) * 0.055;
  smoothY += (mouseY - smoothY) * 0.055;
  const dx = (smoothX / innerWidth - 0.5);
  const dy = (smoothY / innerHeight - 0.5);
  orbs.forEach((orb, i) => {
    const m = (i + 1) * 18;
    orb.style.transform = `translate3d(${dx * m}px, ${dy * m}px, 0)`;
  });
  requestAnimationFrame(animateField);
}
animateField();

document.querySelectorAll('a, button, input').forEach(el => {
  el.addEventListener('pointerenter', () => cursor?.classList.add('is-link'));
  el.addEventListener('pointerleave', () => cursor?.classList.remove('is-link'));
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Subtle magnetic pull — used sparingly on primary actions.
document.querySelectorAll('.magnetic').forEach(el => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    el.style.transform = `translate(${x * 0.07}px, ${y * 0.07}px)`;
  });
  el.addEventListener('pointerleave', () => {
    el.style.transform = '';
  });
});

// Small 3D response on dense interactive surfaces.
document.querySelectorAll('[data-tilt-card]').forEach(card => {
  card.addEventListener('pointermove', (e) => {
    if (matchMedia('(max-width: 980px)').matches) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(1100px) rotateX(${y * -1.8}deg) rotateY(${x * 2.3}deg)`;
  });
  card.addEventListener('pointerleave', () => card.style.transform = '');
});

const cost = document.getElementById('schoolCost');
const salary = document.getElementById('salary');
const savings = document.getElementById('savings');
const costOut = document.getElementById('schoolCostOut');
const salaryOut = document.getElementById('salaryOut');
const savingsOut = document.getElementById('savingsOut');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function updatePreviewInputs() {
  if (!cost || !salary || !savings) return;
  costOut.textContent = money.format(Number(cost.value));
  salaryOut.textContent = money.format(Number(salary.value));
  savingsOut.textContent = money.format(Number(savings.value));
}
[cost, salary, savings].forEach(input => input?.addEventListener('input', updatePreviewInputs));
updatePreviewInputs();

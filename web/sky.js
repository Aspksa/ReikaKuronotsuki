'use strict';
// The night scene's life: stars, petals, shooting stars, pointer parallax and the moonlight that follows the pointer.
// With "reduced motion" nothing moves: stars are drawn once, no petals, no shooting stars, no parallax.
(function () {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rand = (min, max) => min + Math.random() * (max - min);
  const px = (n) => `${n.toFixed(2)}px`;

  // ---- stars: three tints, different sizes, each twinkling at its own pace ----
  const stars = $('stars');
  if (stars) {
    const tints = ['#ffffff', '#cfdcff', '#ffe9c7'];
    for (let i = 0; i < 110; i++) {
      const s = document.createElement('span');
      s.className = 'star';
      const size = Math.random() < 0.12 ? rand(2, 3) : rand(0.8, 1.7);
      s.style.cssText = `left:${rand(0, 100).toFixed(2)}%;top:${rand(0, 74).toFixed(2)}%;`;
      s.style.setProperty('--s', px(size));
      s.style.setProperty('--c', tints[Math.floor(Math.random() * tints.length)]);
      s.style.setProperty('--d', `${rand(2.5, 7).toFixed(2)}s`);
      s.style.setProperty('--delay', `${(-rand(0, 7)).toFixed(2)}s`);
      stars.appendChild(s);
    }
  }

  // ---- sakura petals ----
  const petals = $('petals');
  if (petals && !reduce) {
    for (let i = 0; i < 16; i++) {
      const p = document.createElement('span');
      p.className = 'petal';
      p.style.left = `${Math.round(Math.random() * 100)}%`;
      p.style.animationDuration = `${14 + Math.random() * 14}s`;
      p.style.animationDelay = `${-Math.random() * 28}s`;
      p.style.setProperty('--sway', px(20 + Math.random() * 50));
      p.style.setProperty('--size', px(7 + Math.random() * 8));
      petals.appendChild(p);
    }
  }

  // ---- an occasional shooting star ----
  const sky = document.querySelector('.sky');
  function shoot() {
    if (!sky || document.hidden) return schedule();
    const s = document.createElement('span');
    s.className = 'shooting-star';
    s.style.left = `${rand(35, 95).toFixed(1)}%`;
    s.style.top = `${rand(2, 34).toFixed(1)}%`;
    sky.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
    schedule();
  }
  function schedule() { setTimeout(shoot, rand(18_000, 45_000)); }
  if (!reduce) setTimeout(shoot, rand(6_000, 14_000));

  // ---- pointer: parallax of the scene + a soft moonlight spotlight on ".lit" surfaces ----
  if (!reduce) {
    let frame = 0, mx = 0, my = 0;
    const SPREAD = 180; // the light reaches this far outside an element
    const update = () => {
      frame = 0;
      root.style.setProperty('--px', ((mx / window.innerWidth) * 2 - 1).toFixed(3));
      root.style.setProperty('--py', ((my / window.innerHeight) * 2 - 1).toFixed(3));
      for (const el of document.querySelectorAll('.lit')) {
        const r = el.getBoundingClientRect();
        const near = mx > r.left - SPREAD && mx < r.right + SPREAD && my > r.top - SPREAD && my < r.bottom + SPREAD;
        el.style.setProperty('--lit', near ? '1' : '0');
        if (near) { el.style.setProperty('--lx', px(mx - r.left)); el.style.setProperty('--ly', px(my - r.top)); }
      }
    };
    window.addEventListener('pointermove', (event) => { mx = event.clientX; my = event.clientY; if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    document.addEventListener('pointerleave', () => { for (const el of document.querySelectorAll('.lit')) el.style.setProperty('--lit', '0'); });
  }
})();

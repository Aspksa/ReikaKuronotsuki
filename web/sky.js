'use strict';
// Background life: falling sakura petals. With "reduced motion" nothing moves.
(function () {
  const $ = (id) => document.getElementById(id);
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const px = (n) => `${n.toFixed(2)}px`;

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
})();

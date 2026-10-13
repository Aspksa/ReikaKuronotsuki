'use strict';
// Background life: falling sakura petals and a soft light that follows the pointer on ".lit" surfaces.
// With "reduced motion" nothing moves: no petals, no pointer light.
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

  // ---- pointer light on ".lit" surfaces (cards, panels, the chat window, menu items) ----
  if (!reduce) {
    let frame = 0, mx = 0, my = 0;
    const SPREAD = 180; // the light reaches this far outside an element
    const update = () => {
      frame = 0;
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

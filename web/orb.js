'use strict';
// The floating logo ("orb"): click opens the chat, drag moves it anywhere on the page, arrow keys nudge it.
// Its place is remembered as fractions of the window, so it stays sensible after a resize.
(function () {
  const $ = (id) => document.getElementById(id);
  const orb = $('orb'), panel = $('chat-panel'), navChat = $('nav-chat');
  if (!orb || !panel) return;

  const KEY = 'reika.orb.v1';
  const SIZE = 64, GAP = 8, DRAG_THRESHOLD = 5;
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const vw = () => document.documentElement.clientWidth;
  const vh = () => window.innerHeight;

  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && Number.isFinite(v.fx) && Number.isFinite(v.fy)) return { fx: clamp(v.fx, 0, 1), fy: clamp(v.fy, 0, 1) }; } catch { /* none */ }
    return null;
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch { /* private mode */ } };
  let pos = load() || { fx: 0.97, fy: 0.93 }; // bottom-right by default

  const spanX = () => vw() - SIZE - 2 * GAP;
  const spanY = () => vh() - SIZE - 2 * GAP;
  const toPx = () => ({ x: GAP + pos.fx * spanX(), y: GAP + pos.fy * spanY() });
  function fromPx(x, y) { pos = { fx: spanX() > 0 ? clamp((x - GAP) / spanX(), 0, 1) : 0, fy: spanY() > 0 ? clamp((y - GAP) / spanY(), 0, 1) : 0 }; }

  // The panel opens above or below the orb (whichever has more room). If neither fits, it opens to the left or
  // right of the orb, so the orb itself is never covered.
  const MIN_H = 360, MIN_W = 280;
  function placePanel(x, y) {
    if (panel.hidden) return;
    const prefW = Math.min(400, vw() - 2 * GAP);
    const above = y - 2 * GAP, below = vh() - (y + SIZE) - 2 * GAP;
    let w = prefW, h, left, top;
    if (Math.max(above, below) >= MIN_H) {
      const useBelow = below >= above;
      h = Math.min(600, useBelow ? below : above);
      top = useBelow ? y + SIZE + GAP : y - GAP - h;
      left = x + SIZE / 2 > vw() / 2 ? x + SIZE - w : x;
    } else {
      const right = vw() - (x + SIZE) - 2 * GAP, leftRoom = x - 2 * GAP;
      const useRight = right >= leftRoom;
      w = Math.min(prefW, Math.max(useRight ? right : leftRoom, MIN_W));
      h = Math.min(600, vh() - 2 * GAP);
      left = useRight ? x + SIZE + GAP : x - GAP - w;
      top = y + SIZE / 2 - h / 2;
    }
    panel.style.width = `${w}px`;
    panel.style.height = `${h}px`;
    panel.style.left = `${clamp(left, GAP, vw() - w - GAP)}px`;
    panel.style.top = `${clamp(top, GAP, vh() - h - GAP)}px`;
  }
  function place() { const { x, y } = toPx(); orb.style.left = `${x}px`; orb.style.top = `${y}px`; placePanel(x, y); }

  // ---- open / close ----
  function setOpen(open) {
    panel.hidden = !open;
    orb.setAttribute('aria-expanded', String(open));
    navChat.setAttribute('aria-expanded', String(open));
    navChat.classList.toggle('active', open);
    orb.classList.toggle('open', open);
    if (open) { place(); setTimeout(() => $('input').focus({ preventScroll: true }), 0); const log = $('log'); log.scrollTop = log.scrollHeight; }
  }
  const toggle = () => setOpen(panel.hidden);
  window.ReikaOrb = { open: () => setOpen(true), close: () => setOpen(false), toggle };
  navChat.addEventListener('click', toggle);
  $('chat-close').addEventListener('click', () => { setOpen(false); orb.focus(); });
  $('hero-chat').addEventListener('click', () => setOpen(true));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) { setOpen(false); orb.focus(); } });

  // ---- drag ----
  let start = null, moved = false, justDragged = false;
  orb.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    orb.setPointerCapture(event.pointerId);
    start = { x: event.clientX, y: event.clientY, ox: orb.offsetLeft, oy: orb.offsetTop };
    moved = false;
  });
  orb.addEventListener('pointermove', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) { moved = true; orb.classList.add('dragging'); }
    if (!moved) return;
    const x = clamp(start.ox + dx, GAP, vw() - SIZE - GAP), y = clamp(start.oy + dy, GAP, vh() - SIZE - GAP);
    orb.style.left = `${x}px`; orb.style.top = `${y}px`;
    fromPx(x, y);
    placePanel(x, y);
  });
  const endDrag = () => {
    if (!start) return;
    if (moved) { save(); justDragged = true; setTimeout(() => { justDragged = false; }, 0); }
    orb.classList.remove('dragging');
    start = null;
  };
  orb.addEventListener('pointerup', endDrag);
  orb.addEventListener('pointercancel', endDrag);
  orb.addEventListener('click', () => { if (!justDragged) toggle(); }); // a drag must not also toggle the chat

  // ---- keyboard: arrows move the orb (Shift = bigger steps) ----
  orb.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 60 : 12;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const { x, y } = toPx();
    fromPx(clamp(x + delta[0], GAP, vw() - SIZE - GAP), clamp(y + delta[1], GAP, vh() - SIZE - GAP));
    save(); place();
  });

  window.addEventListener('resize', place);
  place();
})();

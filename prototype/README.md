# Animated Reika prototype

Open `prototype/index.html` locally in a modern browser (no build tools or dependencies). This is a **stylized SVG** character, not the final approved portrait or a Live2D rig.

Features:
- Exactly nine independently animated SVG tail elements.
- Moving left/right ears, front hair, head bob, periodic blinking and manual blink.
- Five mood states, adjustable tail intensity (0–100%) and animation speed (20–200%).
- Pause/resume, reset, and reduced-motion media preference support.
- Responsive mobile/desktop layout, accessible form labels and status.

Verification (manual): open the page, inspect the 9 <g> tail children, toggle all controls, pause and resume, and test browser prefers-reduced-motion setting. The code has no automated browser test pipeline yet.

Future: replace the SVG art with approved layered artwork, refine physics and interpolate emotional expressions, and integrate rendering into the desktop assistant.

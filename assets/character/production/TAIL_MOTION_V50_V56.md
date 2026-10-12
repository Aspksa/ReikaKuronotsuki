# v50–v56 — Experimental nine-tail motion preview

The browser composition editor now includes seven incremental additions:

- v50: calm/lively/still motion presets
- v51: secondary harmonic for richer rhythmic movement
- v52: deterministic individual phase offsets across nine tails
- v53: scrubber for manual timeline preview (0–10 seconds)
- v54: playback/pause with frame-time clamping and tab visibility handling
- v55: reset-to-still and preference for reduced motion
- v56: validation and unit/Chromium regression tests

This preview deliberately disables the older competing animation writer when active. The scene remains an experimental 2D tail mockup; no completed Live2D deformer, art restoration or physical constraints are implied. The standalone v56 preview works on the v35 position settings and does not package image binaries in saved JSON.

# v36–v42 — Seven-stage tail composition editor

The browser-only composition sandbox now offers: **v36** JSON download and validation-based import, **v37** per-tail pivot coordinates and selected-tail markers, **v38** sinusoidal motion preview, **v39** pause control respecting reduced-motion on startup, **v40** fan/default layout presets, **v41** undo for pivot changes and presets (up to 30 snapshots), and **v42** stronger input bounds plus Node and Chromium regression coverage.

Load nine experimental PNGs using the original v35 uploader. JSON saves positions, z-order, pivots and animation parameters, **not image contents**. The animation is a visual approximation; it does not simulate spring dynamics or a production Live2D rig. Undo does not yet cover every legacy v35 slider. File imports reject incompatible versions and invalid transforms. Drawing and hidden anatomy still require an artist.

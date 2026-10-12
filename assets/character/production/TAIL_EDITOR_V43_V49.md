# Tail Editor Quality v43–v49

This release refines the experimental nine-tail editor without pretending the artwork is a production Live2D rig.

- **v43:** JSON roundtrip now preserves all nine pivot coordinates.
- **v44:** Imported pivot values are validated and copied defensively.
- **v45:** Version 35 layouts remain importable with safe default pivots.
- **v46:** Redo added alongside undo for supported editing operations.
- **v47:** Undo checkpoints now cover legacy position, scale, rotation and layer-order controls.
- **v48:** Pausing restores the static tail pose; reduced-motion changes and hidden tabs stop the preview.
- **v49:** Node and Chromium tests exercise import, undo/redo, constraints and browser interaction.

JSON does not include actual PNG images. Undo still stores up to 30 checkpoints; dragging a slider generates multiple checkpoints. Tail pivots are visual guides, not validated anatomical joints. Images still require manual mask cleanup and artist review.

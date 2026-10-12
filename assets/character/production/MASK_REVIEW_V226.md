# v226 — Artist mask review

Run `python tools/mask_review_v226.py concept.png regions.json review_out` with a v225 polygon annotation file. It creates `mask_overlay.png` and `annotation_report.json`, preserving the full source canvas and reporting coverage and per-part mask area.

This is a **human review step** before `tools/assisted_mattes_v225.py`. Inspect every polygon against the actual concept, fix misplaced contours and visually overlapping objects, and paint missing occluded anatomy on the resulting PNGs. The overlay and coverage metrics cannot verify artistic accuracy. The tool deliberately never claims finished art, Live2D ArtMeshes, native `.cmo3` or `.moc3` exports. The prior 37-layer workspace remains blank until actual individual art is completed.

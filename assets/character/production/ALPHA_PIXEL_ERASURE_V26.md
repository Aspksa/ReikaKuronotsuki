# v26 — Per-pixel alpha erasure safeguard

A net alpha-coverage comparison can miss damage: a cleaned layer may delete a narrow strand while blurring opaque pixels into surrounding transparent areas, keeping the total number of visible pixels unchanged or even increasing it.

`tools/build_assets.py` now measures both the net reduction in nontransparent pixels and the fraction of original visible pixels that became **completely transparent** at their original coordinates. Either exceeding `--max-alpha-loss` aborts the build. The manifest records `alpha_erased_pixel_fraction_by_layer` in addition to the earlier net coverage metric.

This does not assert artistic correctness. Altered colors, misaligned masks, incomplete hidden anatomy, or excessive blur can still require manual review; no original artwork is modified.

# v27 — Atomic asset packaging

`python tools/build_assets.py SOURCE OUTPUT` prepares cleaned PNGs, diagnostics, manifest and ZIP in a temporary sibling directory. The completed bundle is moved to `OUTPUT` only after validation and packaging finish. Failed builds clean up their temporary files and leave no incomplete output folder. Existing output folders are never overwritten, even if empty: choose a new destination or explicitly remove the old one.

Original source PNGs remain untouched. A successful package still needs manual visual inspection; no image reconstruction is performed.

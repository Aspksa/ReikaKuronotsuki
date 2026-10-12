# Alpha and edge quality audit

Run `python tools/audit_alpha_edges.py path/to/17/png/layers --output edge-report.json`.

The report contains per-layer alpha coverage, fully opaque pixels, partially transparent pixels (feathering), bounding boxes and canvas-edge contact. Missing expected layers and fully opaque or empty masks fail the automated acceptance check. Border contact is a warning rather than a hard error because tails and hair can legitimately reach the edge.

**Important:** no original character PNGs have been added to the repository. These metrics are diagnostic only, and do not guarantee clean cutouts, recovered hidden anatomy, or production Live2D quality.

# Layer Rig Readiness v14

Use `python tools/rig_readiness.py path/to/layers --output readiness.json` to audit the 17-layer character stack.

The report checks presence of the required files, matching canvas dimensions, non-empty alpha and presence of transparency. It always carries `MANUAL_REVIEW_REQUIRED`, even if automated checks pass. A clean report does not certify a working Live2D model or correctly recovered hidden pixels.

Recommended next steps: manually review each of the nine tails, repaint occluded content, create distinct eye open/closed art and jaw/mouth shapes, specify independent attachment pivots and add rig deformation tests.

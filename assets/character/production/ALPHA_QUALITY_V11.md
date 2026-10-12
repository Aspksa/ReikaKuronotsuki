# Alpha inspection v11

Run `python tools/inspect_cutouts.py path/to/layers --output report.json` (requires Pillow). It reports each layer's visible-alpha fraction, non-empty bounds, and pairwise alpha overlap counts. Compare results and visually inspect tails, hair and garments before animating them.

This is a **diagnostic**, not an automatic background remover, inpainting system, segmentation accuracy metric, or Live2D approval. Existing rough polygon masks remain experimental and hidden image regions remain unresolved.

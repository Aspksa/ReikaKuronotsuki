# v32 — Nine tail artwork swatches

The concept-sheet reference made in v30 includes a bottom strip containing nine independently drawn tail studies. Run `python tools/tail_references_v32.py Reika_Kuronotsuki_Reference_v30.png output/tails` to extract nine source-resolution PNG **reference crops** and a manifest with bounding boxes. The original reference is not modified; existing destinations are not overwritten.

**Important:** the cropped PNGs include the illustration's dark background and have not been alpha-matted, had hidden root geometry reconstructed, or been attached to a rig. They are useful as artist references for the upcoming proper cutouts, but are **not** `reika_tail_1.png` through `reika_tail_9.png` production files. Artist approval and original painting remain necessary. The generated artwork ZIP is separately available to the user; it is not committed to the GitHub repository.

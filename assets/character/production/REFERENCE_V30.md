# v30 — Reference portrait and visual review

The new reference concept sheet of Reika Kuronotsuki is a **1024 × 1536 PNG**, depicting silver-white hair, fox ears, red eyes, black/red/white clothing and nine fluffy tails. It is an **illustrative reference**, not verified source artwork, a transparent cutout set or a Live2D rig.

To run the review locally, first save the portrait as `Reika_Kuronotsuki_Reference_v30.png` and prepare a folder with any of the standardized `reika_<part>.png` cutout layers. Then run:

```sh
python tools/reference_v30.py Reika_Kuronotsuki_Reference_v30.png /path/to/layers /path/to/comparison.png
```

The command outputs a side-by-side comparison PNG and JSON to standard output showing reference hash/dimensions, detected layers and missing layers. **Do not interpret a valid report as visual approval**: hair anatomy, face shape, tail separation, palette fidelity and missing/occluded art require manual review.

The repository includes the import/comparison utility and tests; the freshly generated binary reference image is supplied separately to the user for downloading, because this code change does not upload or replace canonical character artwork.

# Experimental alpha cleanup v12

Run `python tools/clean_cutouts.py input/layers output/cleaned --threshold 10 --median 3 --feather 1` (Pillow required).

The original files are preserved. This can remove isolated alpha specks and soften hard mask boundaries. Compare before/after images and run `inspect_cutouts.py` on both folders. Median filtering can erase tiny ornaments or details; feathering can introduce semi-transparent halos.

**Not accomplished:** semantic background removal, reconstruction of obscured hair/fur, separation of overlapping tails, or production-quality Live2D segmentation. Human review remains mandatory.

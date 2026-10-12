# Reika offline asset build v13

From the repository root, install Pillow and run:

```sh
python -m pip install 'Pillow>=10,<12'
python tools/build_assets.py path/to/raw_layers path/to/output --require-complete
```

The output directory will contain cleaned PNGs, `manifest.json`, `alpha-report.json`, and `reika_cleaned_experimental.zip`. Defaults are alpha threshold 10, median filter 3 and Gaussian feather radius 1. Run without `--require-complete` for a partial experimental layer set.

Input files are never overwritten. Existing output PNGs are not overwritten. The pipeline checks filenames, PNG dimensions, missing layers and alpha overlaps. **It does not remove a semantic background, reconstruct obscured parts or generate a production-ready Live2D model.** Inspect each exported PNG in an image editor before using it for animation.

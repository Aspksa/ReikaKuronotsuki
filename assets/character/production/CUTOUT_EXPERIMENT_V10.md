# Experimental portrait cutouts v10

This is a reproducible **non-production** approximation, not Live2D-ready art. It generates 17 full-canvas transparent PNG layers using hand-authored *rough polygon masks* on the flattened approved portrait (nine tails, face, body, two ears, two eyes, front/back hair). Areas overlap; background pixels and other anatomical elements may be present. Occluded parts are **not reconstructed**.

Run `python -m pip install Pillow` and then:

```sh
python tools/build_experimental_cutouts.py path/to/reference.png output/layers
python tools/validate_assets.py output/layers --require-complete --output experimental.zip
```

The actual generated image files are supplied in the conversation as `Reika_Experimental_Cutouts_v10.zip`, **not committed as binaries**. Manual review and redrawing are required before attaching any animation physics.

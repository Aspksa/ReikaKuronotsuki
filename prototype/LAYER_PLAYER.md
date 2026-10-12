# Layered PNG Player v6

Load transparent PNGs exported by Cutout Studio. The player's stack accepts body, face, two ears, two eyes, front/back hair, and all nine separately named tails. It uses the existing nine-tail rig math to animate individual image elements in the browser. Input is kept local and temporary. No binary character artwork is checked into the repository.

## Important limitations
- All layers must be exported at equal original-image dimensions with transparency. The player aligns them to a common canvas.
- The current rotational animation uses a common 50%/65% pivot approximation, not per-tail skeletal weighting or mesh deformation. Hair and eyes have simple transforms.
- Even a complete layered stack does not reconstruct the hidden pixels of a flattened picture.
- PNG files are manually selected; no uploads to a server.
- Automated browser verification still needs to be added. The existing math tests do not validate visuals.

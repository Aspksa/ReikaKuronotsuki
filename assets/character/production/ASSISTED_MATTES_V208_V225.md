# v208–v225 — Assisted artist matte extraction

This step turns **artist-reviewed polygon annotations** on a flattened reference PNG into full-canvas transparent PNG drafts that can be individually painted and retouched.

```bash
python tools/assisted_mattes_v225.py reference.png annotations.json ./draft_layers
```

An annotation file contains `{"version":225,"regions":{"tail_1":[[[0.1,0.2],[0.4,0.1],[0.5,0.6]]]}}`. Coordinates are normalized 0–1 in the source image. Multiple polygons can cover a single part. Supported names are the original 17 production parts (`reika_face.png`, `reika_tail_1.png`, etc.). Each output is the same canvas size as the input and has alpha outside its polygons. Outputs include SHA-256 checksums.

**Important limitation:** a concept is a flattened image. Polygon mattes cannot recover hidden tail anatomy, separate overlapping hair or magically erase background. Every exported image is explicitly marked `DRAFT_MASK_REQUIRES_MANUAL_PAINT_OVER`, and the manifest sets `ready_for_live2d: false`. Artists must manually mask and paint every relevant layer, including back-filled hidden sections, before any Cubism ArtMesh/deformer rigging or authentic `.moc3` export.

The CLI validates coordinates, names, image size, file format and refuses to overwrite an existing destination. This is an assisted production tool, not finished character artwork or a native Live2D file.

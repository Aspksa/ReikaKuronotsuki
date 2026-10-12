# Portrait Cutout Studio v5

A zero-dependency manual layering tool inside the prototype. Load the approved portrait locally, choose a layer, click contour points, and export a full-resolution transparent PNG using browser Canvas clipping.

### Supported layer IDs
`body`, `face`, `hair_back`, `hair_front`, `ear_left`, `ear_right`, `eye_left`, `eye_right`, and `tail_1` through `tail_9`.

### Workflow
1. Open `prototype/index.html`; choose a local portrait.
2. Pick a layer and click along its visible contour. At least 3 points.
3. Export a transparent PNG and repeat for other layers.
4. Save the JSON manifest with normalized contour coordinates.
5. Check every layer in an image editor: source image occlusion means manual reconstruction of hidden pixels is required for real articulation.

### Limitations
- This is a **manual polygon cutting tool**, not automatic AI segmentation or a fully rigged Live2D PSD.
- Each layer is cropped from the *same flat image*, so overlapped regions and hidden anatomy cannot be reconstructed.
- Layers have full original dimensions to preserve alignment; coordinates are normalized for re-editing.
- All processing is local within the browser. Exports go to the browser's Downloads folder.
- No source art binaries were uploaded to GitHub.

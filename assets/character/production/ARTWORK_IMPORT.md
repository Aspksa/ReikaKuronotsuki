# Artwork ingestion pipeline

The approved Reika portrait and concept collage were generated in the conversation as **flattened** PNG images. They cannot truthfully be called rigged body parts.

1. Download the reference artwork ZIP from the project conversation.
2. Use the existing `prototype/index.html` portrait viewer for full-image preview.
3. Use Cutout Studio to manually trace and export `reika_tail_1.png` through `reika_tail_9.png`, plus `reika_face.png`, `reika_body.png`, `reika_hair_back.png`, `reika_hair_front.png`, `reika_ear_left.png`, `reika_ear_right.png`, `reika_eye_left.png`, `reika_eye_right.png`.
4. Verify consistent dimensions and pack the layer set:

```sh
python tools/validate_assets.py path/to/layers --require-complete --output reika_layers.zip
```

5. Inspect the exported parts manually: portions hidden behind clothing or overlapping tails require original repainting. Import valid PNG files into the layered player.

Do not mistake PNG dimensional checks for full image decoding, alpha validation, or visual acceptance. No official reference PNG or transparent layer set is committed by this PR. The source art package is provided as a separate download in the conversation.

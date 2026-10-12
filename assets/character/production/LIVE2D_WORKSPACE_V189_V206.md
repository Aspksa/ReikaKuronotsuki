# Reika Cubism artist workspace — v189–v206

Use an approved flat concept-art PNG as an **artist reference**, not as layered rig artwork:

```bash
python tools/live2d_workspace_v206.py ./concept.png ./out/Reika_Cubism_Source
```

Requires Python 3.12+ and Pillow. The generated workspace contains `reference.png`, `manifest.json`, `ARTIST_README.txt` and **37 unpainted transparent RGBA layer templates** at the reference canvas size, including nine separate tails and additional mouth/eye/hair/hand regions.

## Cubism Editor handoff

1. A human artist should draw and isolate each named layer against the reference, reconstruct hidden geometry and determine the anatomical pivot locations.
2. Assemble the **actually painted** layers in your graphics editor, export an organized PSD with correct depth order, and import the PSD into Live2D Cubism Editor.
3. In Cubism Editor, create the ArtMeshes, warp/rotation deformers and parameters for face angles, blinks, mouth opening, body movement and nine individual tails. Review clipping and occluded geometry at extreme angles.
4. Export native model data through Cubism Editor as permitted by your software license; a runnable Live2D web display additionally needs the appropriate Cubism SDK, actual `.moc3`, textures, model JSON and motions.

The script and project **cannot install Cubism Editor onto a user's computer** and **do not generate a genuine `.cmo3` or `.moc3` rig**. Installing Live2D Cubism Editor remains a separate user action, using its official installer on a supported desktop operating system. No proprietary SDK, cracked files or third-party binaries are bundled.

Checks in tests cover blank transparency, nine tails, correct dimensions, overwrite protection and malformed input. The package is a valid manual production starting point, not finished Live2D artwork.

# Rigging preparation from Reika's painted artwork

The new `tools/cubism_rig_blueprint_v207.py` audits all **37 individually painted RGBA layers** and generates a manifest describing suggested Cubism parameter IDs for nine tails, face angles, eye blinks, mouth form/opening and body movement.

```bash
python tools/cubism_rig_blueprint_v207.py ./layers --output ./rig-blueprint.json
python tools/cubism_rig_blueprint_v207.py ./layers --require-painted --output ./rig-blueprint.json
```

The `--require-painted` flag blocks a handoff until all 37 layers have nontransparent artwork. Pivots are **provisional alpha-bounding-box centers**, not anatomically verified joints. The handoff explicitly lists missing and empty layers. Artists must still draw the hidden geometry, check seams/overlap, establish pivot roots and mesh topology, and rig deformers/keyforms in **Live2D Cubism Editor**. Only Cubism can export a valid native `.moc3` after that work. This script deliberately never writes a fake `.moc3`.

If using the previously generated v206 workspace, its PNG files are **blank**, so it fails this gate. A finished model is **not yet available**.
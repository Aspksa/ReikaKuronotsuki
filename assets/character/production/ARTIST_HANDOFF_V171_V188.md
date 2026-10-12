# v171–v188 — Artist/rigging handoff package

This stage prepares the character's actual **artist-supplied RGBA PNG** layers for manual quality review and later rigging. It does not manufacture artwork or imply a rig exists.

## Command

```bash
python tools/artist_handoff_v188.py ./my-real-layers ./out/reika-artist-handoff.zip
python tools/artist_handoff_v188.py ./my-real-layers ./out/reika-complete.zip --strict
```

The archive contains a `layers/` directory with supplied images, `contact_sheet.png` for visual inspection and `manifest.json` with the v170 readiness audit, exact filename, byte size and SHA-256 for each included layer. In strict mode all 17 layers must exist, share the same dimensions, be RGBA PNG, and contain visible alpha. It rejects missing input directories, bad PNGs, inconsistent canvases, oversized layers and attempts to overwrite source files.

## Milestones v171–v188

Input handoff folder; canonical 17-part order; nonempty input; RGBA/PIL integrity; canvas uniformity; per-file limits; transparent layer notices; strict 17-layer requirement; alpha-edge QA report; SHA-256 of source bytes; per-file byte size; manifest version; explicit not-rig-ready status; contact sheet; export ZIP; preserve original source bytes; output safety guard; regression testing.

**What is still needed:** professionally drawn and manually separated art for the face, eyes, hair, ears, body and nine tails, plus hidden geometry behind occlusions, an artist's sign-off and a real Live2D deformer rig. The contact sheet does not prove anatomical accuracy or animation readiness. Nothing is uploaded to external services by this script.

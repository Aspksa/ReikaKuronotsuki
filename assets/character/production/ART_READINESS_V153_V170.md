# v153–v170 — Art readiness QA for Reika's layer handoff

This release introduces an **honest, reproducible** artwork readiness report for the 17 expected full-canvas layers (hair, nine tails, body, ears, face and eyes).

## Usage

```bash
python tools/artwork_readiness_v170.py my-layer-directory --report results/artwork-qa.json
python tools/artwork_readiness_v170.py my-layer-directory --require-complete
```

Inputs are named `reika_<part>.png` and **must be RGBA PNG** with one shared canvas. A layer is marked `blank` if all alpha pixels are zero; visible alpha touching an image border triggers a clipping-review warning. `--require-complete` fails if any layer is missing or entirely transparent. These are **technical heuristics only**: visible alpha does not establish that the art is correctly segmented, anatomically complete, or rig-ready.

## 18 incremental QA checks

v153 required folder; v154 exact layer inventory; v155 missing layer report; v156 no false readiness for blank templates; v157 RGBA format check; v158 shared dimensions; v159 canvas limit; v160 per-file size limit; v161 PNG integrity verification; v162 visible alpha count; v163 opaque alpha count; v164 partial alpha count; v165 nontransparent bounds; v166 perimeter clipping warning; v167 extra PNG inventory; v168 strict completion mode; v169 machine-readable JSON export; v170 regression coverage.

A complete 17/17 report is **necessary but not sufficient** for high-quality Live2D artwork. Human artist checks remain required for occluded geometry, shading, tail roots, expression layers, proper depth order and manual deformer rigging. No actual finished artist layers or Live2D binaries are added here.

The validator does not transmit files outside the local machine.

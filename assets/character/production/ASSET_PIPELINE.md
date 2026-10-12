# Character Asset Pipeline v1.0

## Source of truth
- [VISUAL_CANON.md](../canon/VISUAL_CANON.md): immutable character identity.
- [colors.json](../canon/colors.json): palette tokens.
- [MASTER_PROMPT.txt](../canon/MASTER_PROMPT.txt): image generation baseline.
- [EXPRESSIONS.md](../expressions/EXPRESSIONS.md), [POSES.md](../poses/POSES.md), [OUTFITS.md](../outfits/OUTFITS.md): production variants.

## Planned outputs
- `assets/character/canon/reference.png`: approved final full-body portrait (not tracked until uploaded).
- `assets/character/expressions/sheet.png`: 12 consistent expressions.
- `assets/character/poses/turnaround.png`: five orthogonal/three-quarter views.
- `assets/character/outfits/*.png`: approved outfit reference sheets.

## Verification gates
1. Identity match to approved image (face, gold ornaments, hair, silhouette).
2. Exact nine distinguishable silver-white tails and correct fox ears.
3. Eye color sky-blue. Check rendering under warm ambient light.
4. Garment details match chosen outfit ID.
5. Correct license/source notes for imported assets.
6. Export master PNG plus compressed web previews; record dimensions and revision.
7. Review the final rendered artwork manually; image generation alone does not guarantee exact tail counts.

## Live2D handoff
Split source into separately authored eye-open/closed, pupil, brow, mouth, face, front/back hair, ear rotation, body and **nine independent tail** layers. A flattened generated PNG is a visual reference, not a layered Live2D model.

## Release status
Specifications may be approved before image binaries are uploaded. Never mark missing assets as delivered.

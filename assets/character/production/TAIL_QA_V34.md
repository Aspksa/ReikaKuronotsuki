# v34 Nine-tail visual QA

Run `python tools/tail_qa_v34.py path/to/v33/tails --report reports/tail-qa.json --preview reports/tail-qa.png` on nine `tail_matte_study_XX.png` files. The tool reports visibility, partial alpha pixels, empty/opaque mattes, frame contact and creates a 3×3 contact sheet for manual review. Both outputs must be outside the input directory and existing outputs are never overwritten.

**Important:** edge contact can be legitimate, and semi-transparency does not prove correct feathering. The metrics **do not detect every halo** or repair artwork. Tail bases, background contamination, occluded anatomy and rig-pivot alignment require visual inspection and artwork editing. This is an inspection tool, not production Live2D artwork.

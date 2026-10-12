# v25: Protect alpha details during cleaning

The PNG build compares nonzero alpha pixel counts per layer before and after cleaning. By default, the build rejects a layer if more than 50% of its visible pixels disappear; use `--max-alpha-loss 0.1` for a stricter limit. The build still leaves original PNGs unchanged. The manifest records `alpha_pixel_loss_by_layer` and `max_alpha_loss` for review.

This is a coarse diagnostic guard rather than an image-fidelity metric: it cannot detect displaced pixels, incorrect contours, lost interior anatomy, or other artistic defects. A successful build still requires human approval. A rejected build may leave a partial output directory; delete it before retrying.

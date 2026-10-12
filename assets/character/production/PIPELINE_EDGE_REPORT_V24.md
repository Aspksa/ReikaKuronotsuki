# v24: quality report in the asset pipeline

`python tools/build_assets.py INPUT_FOLDER OUTPUT_FOLDER` now writes `edge-report.json` alongside `alpha-report.json` and `manifest.json`, and packages all three into `reika_cleaned_experimental.zip`. The manifest contains `alpha_checks_pass`; this automated result can be false even if packaging succeeds, for example when the input set is incomplete or a layer is fully opaque. It is not an approval of the cutouts.

The edge report measures occupancy, feathering and pixels touching canvas boundaries. A touching edge can be intentional and is not, on its own, treated as a failure. Original images remain untouched. Production artwork still needs human visual review and manual reconstruction of obscured regions.

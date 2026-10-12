#!/usr/bin/env python3
"""Validate flattened references and PNG cutout layers without external packages."""
import argparse
import json
import struct
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

PARTS = ("hair_back", *(f"tail_{i}" for i in range(1, 10)),
         "body", "ear_left", "ear_right", "face", "eye_left",
         "eye_right", "hair_front")


def png_dimensions(path: Path):
    with path.open("rb") as f:
        header = f.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError(f"Not a valid PNG header: {path}")
    width, height = struct.unpack(">II", header[16:24])
    if not (0 < width <= 32768 and 0 < height <= 32768):
        raise ValueError(f"Invalid dimensions: {path}")
    return width, height


def validate_layers(folder: Path):
    found = {}
    for path in sorted(folder.glob("reika_*.png")):
        key = path.stem.removeprefix("reika_")
        if key in PARTS:
            if key in found:
                raise ValueError(f"Duplicate layer {key}")
            found[key] = path
    if not found:
        raise ValueError("No reika_<layer>.png files found")
    dimensions = {png_dimensions(path) for path in found.values()}
    if len(dimensions) != 1:
        raise ValueError("Layer canvas dimensions differ")
    missing = [x for x in PARTS if x not in found]
    return found, next(iter(dimensions)), missing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path)
    parser.add_argument("--output", type=Path, default=None,
                        help="Write a ZIP of the valid layers and manifest")
    parser.add_argument("--require-complete", action="store_true",
                        help="Fail if any of the 17 layer images are missing")
    args = parser.parse_args()
    found, (width, height), missing = validate_layers(args.folder)
    print(f"Found {len(found)}/{len(PARTS)} layers at {width}x{height}")
    if missing:
        print("Missing:", ", ".join(missing))
    if args.require_complete and missing:
        return 1
    if args.output:
        manifest = {"version": 1, "width": width, "height": height,
                    "layers": sorted(found.keys()), "missing": missing,
                    "status": "unverified_visual_cutouts"}
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with ZipFile(args.output, "w", compression=ZIP_DEFLATED) as z:
            for key, file in found.items():
                z.write(file, arcname=file.name)
            z.writestr("manifest.json", json.dumps(manifest, indent=2))
        print("Wrote:", args.output)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError) as exc:
        print("Validation error:", exc, file=sys.stderr)
        sys.exit(2)

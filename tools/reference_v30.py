#!/usr/bin/env python3
"""Generate an honest side-by-side review board for an approved PNG reference and cutouts."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps
from validate_assets import PARTS, validate_layers

SIZE = (640, 760)

def open_png(path):
    path = Path(path)
    if path.suffix.lower() != ".png":
        raise ValueError("Reference must be a PNG")
    with Image.open(path) as image:
        if image.format != "PNG":
            raise ValueError("Reference must be a genuine PNG")
        image.load()
        if min(image.size) < 512:
            raise ValueError("Reference must be at least 512 pixels in each dimension")
        return image.convert("RGBA")

def board(reference, layers_dir, output):
    reference = Path(reference).resolve()
    layers_dir = Path(layers_dir).resolve()
    output = Path(output).resolve()
    if output.exists():
        raise ValueError("Refusing to overwrite an existing review board")
    if layers_dir in output.parents or output == layers_dir:
        raise ValueError("Review output cannot be inside the layer input directory")
    original = open_png(reference)
    found, dimensions, missing = validate_layers(layers_dir)
    composition = Image.new("RGBA", dimensions, (0, 0, 0, 0))
    for part in PARTS:
        if part in found:
            with Image.open(found[part]) as layer:
                layer.load()
                composition.alpha_composite(layer.convert("RGBA"))
    result = Image.new("RGB", (SIZE[0]*2, SIZE[1]+70), "#20202c")
    draw = ImageDraw.Draw(result)
    for i, (label, image) in enumerate((("Reference portrait", original), ("Experimental PNG composition", composition))):
        x = i*SIZE[0]
        checker = Image.new("RGB", SIZE, "#e5e2eb")
        small = ImageOps.contain(image, SIZE, Image.Resampling.LANCZOS)
        px, py = (SIZE[0]-small.width)//2, (SIZE[1]-small.height)//2
        checker.paste(small, (px, py), small)
        result.paste(checker, (x, 70))
        draw.text((x+16, 24), label, fill="white")
    output.parent.mkdir(parents=True, exist_ok=True)
    result.save(output, format="PNG")
    return {
        "version": 30, "status": "MANUAL_VISUAL_REVIEW_REQUIRED",
        "reference_sha256": hashlib.sha256(reference.read_bytes()).hexdigest(),
        "reference_dimensions": list(original.size),
        "layer_dimensions": list(dimensions),
        "present": [name for name in PARTS if name in found],
        "missing": missing,
        "comparison_board": output.name,
        "disclaimer": "This is a review image only. It does not prove similarity or create repaired Live2D layers."
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("layers", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        report = board(args.reference, args.layers, args.output)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps(report, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

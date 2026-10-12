#!/usr/bin/env python3
"""Non-destructive alpha cleanup for experimental cutout PNGs."""
import argparse
import math
from pathlib import Path
from PIL import Image, ImageFilter

def clean(image, threshold=10, median=3, feather=1.0):
    if isinstance(threshold,bool) or not isinstance(threshold,int) or not 0 <= threshold <= 255:
        raise ValueError("threshold must be 0..255")
    if isinstance(median,bool) or not isinstance(median,int) or median < 1 or median % 2 == 0:
        raise ValueError("median must be a positive odd integer")
    if isinstance(feather,bool) or not isinstance(feather,(int,float)) or not math.isfinite(feather) or not 0 <= feather <= 8:
        raise ValueError("feather must be 0..8")
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    if median > 1:
        alpha = alpha.filter(ImageFilter.MedianFilter(median))
    if threshold:
        alpha = alpha.point(lambda n: 0 if n < threshold else n)
    if feather:
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    out = image.copy()
    out.putalpha(alpha)
    return out

def process(source, destination, threshold=10, median=3, feather=1.0):
    source = Path(source).resolve()
    destination = Path(destination).resolve()
    if source in destination.parents:
        raise ValueError('Output must not be inside source directory')
    if source == destination:
        raise ValueError("Input and output folders must differ")
    inputs = sorted(source.glob("reika_*.png"))
    if not inputs:
        raise ValueError("No layer PNGs found")
    destination.mkdir(parents=True, exist_ok=True)
    for file in inputs:
        with Image.open(file) as im:
            output = clean(im, threshold, median, feather)
            output.save(destination / file.name)
    return len(inputs)

if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source",type=Path)
    parser.add_argument("destination",type=Path)
    parser.add_argument("--threshold",type=int,default=10)
    parser.add_argument("--median",type=int,default=3)
    parser.add_argument("--feather",type=float,default=1.0)
    args=parser.parse_args()
    print("Processed",process(args.source,args.destination,args.threshold,args.median,args.feather),"PNG layers")

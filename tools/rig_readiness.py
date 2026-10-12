#!/usr/bin/env python3
"""Generate an honest readiness report for a Reika layer directory."""
import argparse
import json
from pathlib import Path
from PIL import Image
from validate_assets import PARTS, validate_layers

def assess(folder):
    folder=Path(folder)
    found, size, missing=validate_layers(folder)
    measurements={}
    warnings=[]
    for name,path in found.items():
        with Image.open(path) as source:
            rgba=source.convert("RGBA")
            alpha=rgba.getchannel("A")
            bbox=alpha.getbbox()
            extrema=alpha.getextrema()
            measurements[name]={"bbox":list(bbox) if bbox else None,
                                "has_transparency":extrema[0]<255,
                                "empty":bbox is None}
            if bbox is None:warnings.append(name+": empty mask")
            if extrema[0]==255:warnings.append(name+": fully opaque, likely not cut out")
    if missing:warnings.append(str(len(missing))+" layer(s) missing")
    warnings.append("Occluded regions, anatomy, edge quality and facial likeness require visual human approval")
    return {"version":1,"status":"MANUAL_REVIEW_REQUIRED","canvas":list(size),
            "present":sorted(found),"missing":missing,"layers":measurements,
            "automated_checks_pass":not missing and all(not x["empty"] and x["has_transparency"] for x in measurements.values()),
            "warnings":warnings}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder",type=Path)
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    try: report=assess(args.folder)
    except (OSError,ValueError) as e:parser.error(str(e))
    text=json.dumps(report,indent=2)
    if args.output:args.output.write_text(text,encoding="utf-8")
    else:print(text)
    return 0 if report["automated_checks_pass"] else 1

if __name__=="__main__":
    raise SystemExit(main())

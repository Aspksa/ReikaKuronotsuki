#!/usr/bin/env python3
"""Measure PNG layer edge and alpha issues without claiming art approval."""
import argparse
import json
from pathlib import Path
from PIL import Image
from validate_assets import validate_layers

def audit(folder):
    found, canvas, missing = validate_layers(Path(folder))
    measurements={}
    for name,path in sorted(found.items()):
        with Image.open(path) as source:
            rgba=source.convert("RGBA")
            alpha=rgba.getchannel("A")
            hist=alpha.histogram()
            pixels=rgba.width*rgba.height
            bbox=alpha.getbbox()
            border=list(alpha.crop((0,0,rgba.width,1)).getdata())
            if rgba.height>1:border+=list(alpha.crop((0,rgba.height-1,rgba.width,rgba.height)).getdata())
            if rgba.height>2:
                border+=list(alpha.crop((0,1,1,rgba.height-1)).getdata())
                if rgba.width>1:border+=list(alpha.crop((rgba.width-1,1,rgba.width,rgba.height-1)).getdata())
            occupied=sum(hist[1:])
            opaque=hist[255]
            semitransparent=sum(hist[1:255])
            edge_touch=sum(value>0 for value in border)
            measurements[name]={
                "bbox":list(bbox) if bbox else None,
                "alpha_coverage":round(occupied/pixels,6),
                "opaque_fraction":round(opaque/pixels,6),
                "feather_fraction":round(semitransparent/pixels,6),
                "border_occupied_pixels":edge_touch,
                "border_occupancy_fraction":round(edge_touch/len(border),6),
                "warnings":(["empty alpha"] if not occupied else [])+
                           (["fully opaque alpha"] if occupied==pixels else [])+
                           (["touches canvas border"] if edge_touch else [])
            }
    return {
        "status":"MANUAL_REVIEW_REQUIRED",
        "canvas":list(canvas),
        "missing":missing,
        "layers":measurements,
        "automated_checks_pass":not missing and bool(measurements) and all(not ({"empty alpha","fully opaque alpha"} & set(v["warnings"])) for v in measurements.values()),
        "disclaimer":"Edge occupancy and feather fractions are diagnostics, not proof of defects. Human approval of masks and hidden anatomy is required."
    }

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("folder",type=Path)
    p.add_argument("--output",type=Path)
    args=p.parse_args()
    try: result=audit(args.folder)
    except (OSError,ValueError) as error:p.error(str(error))
    encoded=json.dumps(result,ensure_ascii=False,indent=2)
    if args.output:args.output.write_text(encoded,encoding="utf-8")
    else:print(encoded)
    return 0 if result["automated_checks_pass"] else 1
if __name__=="__main__":
    raise SystemExit(main())

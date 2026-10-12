#!/usr/bin/env python3
"""Generate honest, editable blank PNG layer canvases for artist handoff."""
import argparse
import json
from pathlib import Path
from PIL import Image
from reference_v30 import open_png
from validate_assets import PARTS

def create_kit(reference, destination):
    reference=Path(reference).resolve()
    destination=Path(destination).resolve()
    if destination.exists():
        raise ValueError("Refusing to overwrite existing kit")
    if reference.parent == destination or reference in destination.parents:
        raise ValueError("Destination cannot replace the reference")
    portrait=open_png(reference)
    destination.mkdir(parents=True)
    try:
        layers=destination/"layers"
        layers.mkdir()
        for part in PARTS:
            Image.new("RGBA",portrait.size,(0,0,0,0)).save(layers/("reika_"+part+".png"))
        portrait.save(destination/"reference.png")
        data={"version":31,"status":"BLANK_ARTIST_TEMPLATES_NOT_CUTOUTS",
              "canvas":list(portrait.size),"parts":list(PARTS),
              "ready_for_animation":False,
              "instructions":"Paint each PNG separately; extend occluded hair and tail anatomy manually. Blank templates must not be imported as finished character art."}
        (destination/"manifest.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
        return data
    except BaseException:
        import shutil
        shutil.rmtree(destination)
        raise

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("reference",type=Path)
    p.add_argument("destination",type=Path)
    args=p.parse_args()
    print(json.dumps(create_kit(args.reference,args.destination),indent=2))
if __name__=="__main__":
    main()

#!/usr/bin/env python3
"""Assess 17 full-canvas RGBA character layers; never claim a Live2D rig exists."""
import argparse
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops
from validate_assets import PARTS

LIMIT=4096
def inspect(folder, require_complete=False):
    folder=Path(folder)
    if not folder.is_dir(): raise ValueError("Layer directory missing")
    expected={f"reika_{part}.png":part for part in PARTS}
    observed={p.name:p for p in folder.iterdir() if p.is_file() and p.name.lower().endswith(".png")}
    extras=sorted(set(observed)-set(expected))
    records=[]
    canvas=None
    for name,part in expected.items():
        if name not in observed:
            records.append({"part":part,"status":"missing"});continue
        p=observed[name]
        if p.stat().st_size>20*1024*1024: raise ValueError(f"PNG over 20 MiB: {name}")
        with Image.open(p) as im:
            im.verify()
        with Image.open(p) as im:
            if im.format!="PNG" or im.mode!="RGBA":raise ValueError(f"Expected RGBA PNG: {name}")
            width,height=im.size
            if not (1<=width<=LIMIT and 1<=height<=LIMIT):raise ValueError(f"Invalid canvas dimensions: {name}")
            if canvas is None:canvas=(width,height)
            if canvas!=(width,height):raise ValueError(f"Canvas mismatch: {name}")
            alpha=im.getchannel("A")
            hist=alpha.histogram()
            total=width*height
            visible=total-hist[0]
            full=hist[255]
            partial=sum(hist[1:255])
            bbox=alpha.getbbox()
            edge=0
            if bbox:
                edge=sum(1 for v in alpha.crop((0,0,width,1)).getdata() if v)+sum(1 for v in alpha.crop((0,height-1,width,height)).getdata() if v)
                if height>2:
                    edge+=sum(1 for v in alpha.crop((0,1,1,height-1)).getdata() if v)
                    edge+=sum(1 for v in alpha.crop((width-1,1,width,height-1)).getdata() if v)
            status="blank" if visible==0 else "visible"
            records.append({"part":part,"status":status,"visible_pixels":visible,"visible_fraction":round(visible/total,6),"opaque_pixels":full,"partial_alpha_pixels":partial,"touches_canvas_edge":edge>0,"alpha_bounds":list(bbox) if bbox else None})
    missing=[r["part"] for r in records if r["status"]=="missing"]
    blank=[r["part"] for r in records if r["status"]=="blank"]
    edge=[r["part"] for r in records if r.get("touches_canvas_edge")]
    warnings=[]
    if missing:warnings.append("Missing artwork layers")
    if blank:warnings.append("Blank template layers are not finished artwork")
    if edge:warnings.append("Visible alpha touches canvas edges; review clipping")
    if extras:warnings.append("Extra PNG files found; ignored")
    complete=not missing and not blank
    if require_complete and not complete:raise ValueError("Incomplete artwork: "+", ".join(missing+blank))
    return {"version":170,"status":"ARTWORK_HEURISTIC_QA_NOT_LIVE2D","canvas":list(canvas) if canvas else None,"expected_layers":len(PARTS),"visible_layers":sum(r["status"]=="visible" for r in records),"complete_visible_set":complete,"missing":missing,"blank":blank,"edge_review":edge,"extra_png":extras,"warnings":warnings,"layers":records}

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("folder",type=Path)
    p.add_argument("--report",type=Path)
    p.add_argument("--require-complete",action="store_true")
    args=p.parse_args(argv)
    result=inspect(args.folder,args.require_complete)
    out=json.dumps(result,ensure_ascii=False,indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(out+"\n",encoding="utf-8")
    print(out)
    return 0
if __name__=="__main__":
    try:sys.exit(main())
    except (OSError,ValueError,SyntaxError) as err:
        print("Artwork QA failed:",err,file=sys.stderr)
        sys.exit(2)

#!/usr/bin/env python3
"""Audit polygon masks before extracting draft artist layers; no automatic art claims."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw
from assisted_mattes_v225 import validate_regions

def audit(reference,annotations,output):
    reference=Path(reference);annotations=Path(annotations);output=Path(output)
    if output.exists():raise ValueError("Refusing to overwrite existing report")
    with Image.open(reference) as im:
        if im.format!="PNG" or im.width>4096 or im.height>4096:raise ValueError("Invalid reference PNG")
        canvas=im.convert("RGBA")
    regions=validate_regions(json.loads(annotations.read_text(encoding="utf-8")))
    if not regions:raise ValueError("No annotated regions")
    count=Image.new("L",canvas.size,0)
    coverage=Image.new("L",canvas.size,0)
    colors=[(255,75,97,115),(66,190,240,115),(248,183,60,115),(130,215,152,115)]
    overlay=Image.new("RGBA",canvas.size,(0,0,0,0))
    records=[]
    for idx,(part,polys) in enumerate(regions.items()):
        mask=Image.new("L",canvas.size,0)
        d=ImageDraw.Draw(mask)
        for polygon in polys:
            points=[(round(x*(canvas.width-1)),round(y*(canvas.height-1))) for x,y in polygon]
            d.polygon(points,fill=255)
        pixels=mask.histogram()[255]
        if pixels==0:raise ValueError("Degenerate polygon: "+part)
        records.append({"part":part,"pixels":pixels,"fraction":round(pixels/(canvas.width*canvas.height),5)})
        from PIL import ImageChops
        count=ImageChops.add(count,mask,scale=1,offset=0)
        coverage=ImageChops.lighter(coverage,mask)
        color=Image.new("RGBA",canvas.size,colors[idx%len(colors)])
        overlay.alpha_composite(Image.composite(color,Image.new("RGBA",canvas.size,(0,0,0,0)),mask))
    total=coverage.histogram()[255]
    preview=Image.alpha_composite(canvas,overlay)
    output.mkdir(parents=True)
    preview.save(output/"mask_overlay.png")
    data={"version":226,"status":"REVIEW_REQUIRED_NOT_RIG_READY","canvas":[canvas.width,canvas.height],"annotated_parts":len(regions),"covered_pixels":total,"covered_fraction":round(total/(canvas.width*canvas.height),5),"regions":records,"ready_for_live2d":False}
    (output/"annotation_report.json").write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    return data

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("reference",type=Path);p.add_argument("annotations",type=Path);p.add_argument("output",type=Path)
    a=p.parse_args();print(json.dumps(audit(a.reference,a.annotations,a.output),ensure_ascii=False,indent=2))
if __name__=="__main__":main()

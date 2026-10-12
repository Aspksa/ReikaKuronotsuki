#!/usr/bin/env python3
"""Audit experimental tail mattes for visual review, without certifying cutout quality."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw

def inspect(image):
    rgba=image.convert("RGBA")
    alpha=rgba.getchannel("A")
    hist=alpha.histogram()
    width,height=rgba.size
    total=width*height
    border=[]
    border.extend(alpha.crop((0,0,width,1)).getdata())
    if height>1:border.extend(alpha.crop((0,height-1,width,height)).getdata())
    if height>2:
        border.extend(alpha.crop((0,1,1,height-1)).getdata())
        if width>1:border.extend(alpha.crop((width-1,1,width,height-1)).getdata())
    visible=total-hist[0]
    return {"size":[width,height],
            "visible_fraction":round(visible/total,5),
            "partial_alpha_fraction":round(sum(hist[1:255])/total,5),
            "border_visible_pixels":sum(a>0 for a in border),
            "empty":visible==0,
            "fully_opaque":hist[255]==total,
            "warnings":(["no visible tail" ] if not visible else [])+
                       (["all pixels opaque"] if hist[255]==total else [])+
                       (["alpha touches frame"] if any(a>0 for a in border) else [])}

def analyze(folder,report_path=None,preview_path=None):
    folder=Path(folder).resolve()
    files=[folder/f"tail_matte_study_{n:02}.png" for n in range(1,10)]
    if any(not f.is_file() for f in files):
        raise ValueError("All nine tail_matte_study_XX.png files are required")
    for target in (report_path,preview_path):
        if target is not None:
            target=Path(target).resolve()
            if target.exists():raise ValueError("Refusing to overwrite a report or preview")
            if folder==target or folder in target.parents:raise ValueError("Outputs must be outside the input directory")
    if report_path is not None and preview_path is not None and Path(report_path).resolve()==Path(preview_path).resolve():
        raise ValueError("Report and preview paths must differ")
    results=[]
    for index,file in enumerate(files,1):
        with Image.open(file) as image:
            image.load()
            if image.format!="PNG":raise ValueError("Expected PNG: "+file.name)
            results.append({"index":index,"file":file.name,**inspect(image)})
    summary={"version":34,"status":"MANUAL_REVIEW_REQUIRED",
             "tails":results,
             "warning":"Border and partial alpha metrics are not a halo detector. Artist must inspect against dark and light backgrounds and reconstruct obscured tail roots."}
    if preview_path is not None:
        from PIL import ImageOps
        size=220
        canvas=Image.new("RGB",(3*size,3*(size+32)),"#282633")
        draw=ImageDraw.Draw(canvas)
        for i,file in enumerate(files):
            with Image.open(file) as image:
                rgba=ImageOps.contain(image.convert("RGBA"),(size-20,size-20))
            x=(i%3)*size+(size-rgba.width)//2
            y=(i//3)*(size+32)+32+(size-rgba.height)//2
            canvas.paste(rgba,(x,y),rgba)
            draw.text(((i%3)*size+10,(i//3)*(size+32)+8),f"Tail {i+1}",fill="white")
        Path(preview_path).parent.mkdir(parents=True,exist_ok=True)
        canvas.save(preview_path)
    if report_path is not None:
        Path(report_path).parent.mkdir(parents=True,exist_ok=True)
        Path(report_path).write_text(json.dumps(summary,indent=2),encoding="utf-8")
    return summary

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder",type=Path)
    parser.add_argument("--report",type=Path)
    parser.add_argument("--preview",type=Path)
    args=parser.parse_args()
    print(json.dumps(analyze(args.folder,args.report,args.preview),indent=2))

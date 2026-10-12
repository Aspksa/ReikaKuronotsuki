#!/usr/bin/env python3
"""Experimental boundary-connected background removal for tail art studies."""
import argparse
import json
import shutil
from collections import deque
from pathlib import Path
from PIL import Image

def matte(image,tolerance=48,feather=18):
    if not (0<=tolerance<=160 and 0<=feather<=80):
        raise ValueError("Invalid tolerance or feather")
    rgb=image.convert("RGB");w,h=rgb.size;pixel=rgb.load()
    corners=[pixel[x,y] for x,y in ((0,0),(w-1,0),(0,h-1),(w-1,h-1))]
    background=tuple(sum(sorted(c[i] for c in corners)[1:3])/2 for i in range(3))
    def distance(x,y):
        p=pixel[x,y]
        return max(abs(p[k]-background[k]) for k in range(3))
    exterior=bytearray(w*h);queue=deque()
    for x in range(w):
        for y in (0,h-1):
            if distance(x,y)<=tolerance:queue.append((x,y))
    for y in range(h):
        for x in (0,w-1):
            if distance(x,y)<=tolerance:queue.append((x,y))
    while queue:
        x,y=queue.popleft();i=y*w+x
        if exterior[i] or distance(x,y)>tolerance:continue
        exterior[i]=1
        if x:queue.append((x-1,y))
        if x+1<w:queue.append((x+1,y))
        if y:queue.append((x,y-1))
        if y+1<h:queue.append((x,y+1))
    result=image.convert("RGBA");pixels=list(result.getdata())
    processed=[]
    for idx,(r,g,b,a) in enumerate(pixels):
        x,y=idx%w,idx//w
        if exterior[idx]:alpha=0
        else:alpha=min(a,round(255*max(0,min(1,(distance(x,y)-tolerance+feather)/max(1,feather)))))
        processed.append((r,g,b,alpha))
    result.putdata(processed)
    return result

def export(folder,output,tolerance=48,feather=18):
    folder=Path(folder).resolve();output=Path(output).resolve()
    if output.exists():raise ValueError("Output exists")
    if folder==output or folder in output.parents:raise ValueError("Output inside source")
    files=[folder/f"tail_reference_{i:02}.png" for i in range(1,10)]
    if not all(f.is_file() for f in files):raise ValueError("Nine source tails required")
    output.mkdir(parents=True)
    try:
        stats=[]
        for number,path in enumerate(files,1):
            with Image.open(path) as image:
                result=matte(image,tolerance,feather)
            result.save(output/f"tail_matte_study_{number:02}.png")
            counts=result.getchannel("A").histogram()
            stats.append({"index":number,"size":list(result.size),
                          "visible_fraction":round(sum(counts[1:])/(result.width*result.height),4),
                          "source":path.name})
        manifest={"version":33,"status":"EXPERIMENTAL_BACKGROUND_REMOVAL_NOT_LIVE2D",
                  "tolerance":tolerance,"feather":feather,"tails":stats,
                  "pivot_suggestions_normalized":[[0.5,0.9] for _ in range(9)],
                  "warning":"Matting may leave halos or background. Pivot values are placeholders. Manual retouch and hidden-part reconstruction are required."}
        (output/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
        return manifest
    except BaseException:
        shutil.rmtree(output)
        raise

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("folder",type=Path);p.add_argument("output",type=Path)
    p.add_argument("--tolerance",type=int,default=48)
    p.add_argument("--feather",type=int,default=18)
    a=p.parse_args()
    print(json.dumps(export(a.folder,a.output,a.tolerance,a.feather),indent=2))

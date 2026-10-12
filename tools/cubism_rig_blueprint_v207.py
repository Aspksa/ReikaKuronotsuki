#!/usr/bin/env python3
"""Create a reviewed Cubism rigging blueprint from real painted PNG layers.

This tool does NOT generate .cmo3/.moc3 files or a deformation mesh.
"""
import argparse
import json
from pathlib import Path
from PIL import Image
from artwork_readiness_v170 import inspect

EXTRA=("brow_left","brow_right","eye_white_left","eye_white_right","iris_left","iris_right","upper_lid_left","upper_lid_right","mouth_closed","mouth_open","mouth_inner","nose","ear_inner_left","ear_inner_right","hair_side_left","hair_side_right","arm_left","arm_right","hand_left","hand_right")
CORE=("hair_back",*[f"tail_{i}" for i in range(1,10)],"body","ear_left","ear_right","face","eye_left","eye_right","hair_front")
PARTS=CORE+EXTRA

def plan(folder):
    folder=Path(folder)
    report=inspect(folder)
    records=[]
    for part in PARTS:
        file=folder/f"reika_{part}.png"
        if not file.is_file():
            records.append({"part":part,"state":"missing","pivot":None});continue
        with Image.open(file) as im:
            if im.format!="PNG" or im.mode!="RGBA":raise ValueError(f"Invalid RGBA layer: {part}")
            bbox=im.getchannel("A").getbbox()
            width,height=im.size
            if report["canvas"] and [width,height]!=report["canvas"]:raise ValueError(f"Canvas mismatch: {part}")
            if bbox:
                cx=(bbox[0]+bbox[2])/2/width
                cy=(bbox[1]+bbox[3])/2/height
                pivot=[round(cx,4),round(cy,4)]
            else:pivot=None
            records.append({"part":part,"state":"painted" if bbox else "blank","pivot":pivot})
    parameters=[
        {"id":"ParamAngleX","min":-30,"default":0,"max":30,"targets":["face","hair_front","hair_back","nose","eye_left","eye_right"]},
        {"id":"ParamAngleY","min":-30,"default":0,"max":30,"targets":["face","hair_front","hair_back","ear_left","ear_right"]},
        {"id":"ParamAngleZ","min":-30,"default":0,"max":30,"targets":["face","hair_front","hair_back"]},
        {"id":"ParamBodyAngleX","min":-15,"default":0,"max":15,"targets":["body","arm_left","arm_right"]},
        {"id":"ParamEyeLOpen","min":0,"default":1,"max":1,"targets":["eye_left","upper_lid_left"]},
        {"id":"ParamEyeROpen","min":0,"default":1,"max":1,"targets":["eye_right","upper_lid_right"]},
        {"id":"ParamMouthOpenY","min":0,"default":0,"max":1,"targets":["mouth_closed","mouth_open","mouth_inner"]},
        {"id":"ParamMouthForm","min":-1,"default":0,"max":1,"targets":["mouth_closed","mouth_open"]},
    ]
    for i in range(1,10):
        parameters.append({"id":f"ParamTail{i}Swing","min":-30,"default":0,"max":30,"targets":[f"tail_{i}"]})
    ready=all(record["state"]=="painted" for record in records)
    return {"version":207,"format":"CUBISM_MANUAL_RIG_BLUEPRINT","ready_for_manual_rig_review":ready,
       "native_cubism_project_created":False,"moc3_created":False,
       "notes":["Pivots inferred from nontransparent bounding boxes are provisional; an artist must set anatomical joint roots.",
                "A painted layer does not prove independent non-occluded topology or acceptable deformation.",
                "Import painted PSD into Cubism Editor and manually construct ArtMeshes, deformers and keyforms."],
       "core_audit":report,"artworks":records,"parameters":parameters}

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("layers",type=Path)
    parser.add_argument("--output",type=Path)
    parser.add_argument("--require-painted",action="store_true")
    args=parser.parse_args(argv)
    result=plan(args.layers)
    if args.require_painted and not result["ready_for_manual_rig_review"]:
        parser.error("Not all 37 layers are painted")
    serialized=json.dumps(result,indent=2,ensure_ascii=False)+"\n"
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(serialized,encoding="utf-8")
    else:print(serialized)
if __name__=="__main__":main()

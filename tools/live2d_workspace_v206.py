#!/usr/bin/env python3
"""Prepare an editable Cubism artist workspace from concept art (NOT a .cmo3 rig)."""
import argparse, json, shutil, sys
from pathlib import Path
from PIL import Image
from validate_assets import PARTS

EXTRA = ("brow_left","brow_right","eye_white_left","eye_white_right",
 "iris_left","iris_right","upper_lid_left","upper_lid_right",
 "mouth_closed","mouth_open","mouth_inner","nose",
 "ear_inner_left","ear_inner_right","hair_side_left","hair_side_right",
 "arm_left","arm_right","hand_left","hand_right")
ORDER=tuple(PARTS)+EXTRA

def prepare(reference,destination):
    reference=Path(reference).resolve();destination=Path(destination).resolve()
    if not reference.is_file(): raise ValueError("Reference image does not exist")
    if destination.exists(): raise ValueError("Refusing to overwrite existing workspace")
    if destination==reference.parent or destination in reference.parents:raise ValueError("Unsafe output location")
    with Image.open(reference) as original:
        if original.format!="PNG":raise ValueError("Expected PNG reference")
        if not (256<=original.width<=4096 and 256<=original.height<=4096):raise ValueError("Reference dimensions out of range")
        image=original.convert("RGBA");size=image.size
    destination.mkdir(parents=True)
    try:
        (destination/"layers").mkdir()
        image.save(destination/"reference.png")
        for part in ORDER:
            Image.new("RGBA",size,(0,0,0,0)).save(destination/"layers"/("reika_"+part+".png"))
        manifest={"version":206,"status":"BLANK_CUBISM_ARTIST_WORKSPACE_NOT_RIGGED",
         "reference":"reference.png","canvas":list(size),"layer_count":len(ORDER),
         "layers":[{"name":"reika_"+part+".png","part":part,"painted":False} for part in ORDER],
         "rig_parameters":["ParamAngleX","ParamAngleY","ParamAngleZ","ParamEyeLOpen",
           "ParamEyeROpen","ParamMouthOpenY","ParamMouthForm",
           "ParamBodyAngleX"]+[f"ParamTail{i}Swing" for i in range(1,10)],
         "ready_for_live2d":False,
         "note":"Paint and complete occluded geometry on each transparent full-canvas layer. Import the resulting layers into Cubism Editor and manually create meshes, deformers and parameters. No native .cmo3 is produced."}
        (destination/"manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
        (destination/"ARTIST_README.txt").write_text(
          "REIKA — BLANK ARTIST WORKSPACE, NOT A RIG\n"
          "1. reference.png is flat concept art; do not confuse with finished separated layers.\n"
          "2. Paint individual transparent layers under layers/ with matching canvas.\n"
          "3. Restore hidden portions of hair, body, ears and nine tail roots.\n"
          "4. Import completed art into Live2D Cubism Editor; create ArtMeshes/deformers and motions.\n"
          "5. Export using your licensed Cubism Editor. This workspace does not contain .cmo3/.moc3.\n",
          encoding="utf-8")
        return manifest
    except BaseException:
        shutil.rmtree(destination,ignore_errors=True);raise

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference",type=Path)
    parser.add_argument("destination",type=Path)
    args=parser.parse_args(argv)
    result=prepare(args.reference,args.destination)
    print(json.dumps({"destination":str(args.destination),"count":result["layer_count"],"status":result["status"]},ensure_ascii=False))
if __name__=="__main__":
    try:main()
    except (OSError,ValueError) as error:
        print(error,file=sys.stderr);sys.exit(2)

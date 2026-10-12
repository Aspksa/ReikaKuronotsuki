#!/usr/bin/env python3
"""Package validated artist layers with a contact sheet and reproducible manifest."""
import argparse
import hashlib
import io
import json
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image, ImageDraw
from artwork_readiness_v170 import inspect
from validate_assets import PARTS

MAX_BYTES = 20 * 1024 * 1024
def build(folder, output, strict=False):
    folder,output=Path(folder).resolve(),Path(output).resolve()
    audit=inspect(folder, require_complete=strict)
    files=[(part,folder / ("reika_"+part+".png")) for part in PARTS if (folder / ("reika_"+part+".png")).is_file()]
    if not files: raise ValueError("No usable layers; refusing empty handoff")
    if output in [p for _,p in files]: raise ValueError("Output cannot overwrite a layer")
    records=[]
    cells=[]
    for part,source in files:
        if source.stat().st_size>MAX_BYTES:raise ValueError("Layer too large")
        data=source.read_bytes()
        records.append({"name":source.name,"part":part,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data)})
        with Image.open(source) as image:
            preview=image.convert("RGBA")
            preview.thumbnail((200,200))
            cells.append((part,preview.copy()))
    columns=4
    rows=(len(cells)+columns-1)//columns
    sheet=Image.new("RGB",(columns*230,rows*250),(38,38,46))
    draw=ImageDraw.Draw(sheet)
    for i,(part,image) in enumerate(cells):
        x=(i%columns)*230+15;y=(i//columns)*250+15
        tile=Image.new("RGBA",(200,200),(70,70,78,255))
        tile.alpha_composite(image,((200-image.width)//2,(200-image.height)//2))
        sheet.paste(tile.convert("RGB"),(x,y))
        draw.text((x,y+210),part,fill=(255,255,255))
    buffer=io.BytesIO();sheet.save(buffer,format="PNG")
    manifest={"version":188,"status":"ARTIST_HANDOFF_NOT_RIG_READY","audit":audit,"files":records,"preview":"contact_sheet.png","ready_for_live2d":False}
    output.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(output,"w",compression=ZIP_DEFLATED) as z:
        z.writestr("manifest.json",json.dumps(manifest,indent=2,ensure_ascii=False))
        z.writestr("contact_sheet.png",buffer.getvalue())
        for record in records:
            z.write(folder/record["name"],arcname="layers/"+record["name"])
    return manifest

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("folder",type=Path)
    p.add_argument("output",type=Path)
    p.add_argument("--strict",action="store_true",help="Require all 17 layers with visible alpha")
    args=p.parse_args(argv)
    result=build(args.folder,args.output,args.strict)
    print(json.dumps({"output":str(args.output),"included":len(result["files"]),"missing":result["audit"]["missing"],"blank":result["audit"]["blank"],"status":result["status"]},ensure_ascii=False,indent=2))
    return 0
if __name__=="__main__":
    try:sys.exit(main())
    except (OSError,ValueError) as error:
        print("Handoff failed:",error,file=sys.stderr)
        sys.exit(2)

#!/usr/bin/env python3
"""Extract artist-reviewed polygon masks from a flat reference, no fabricated rig."""
import argparse,hashlib,json,sys
from pathlib import Path
from PIL import Image,ImageDraw
from validate_assets import PARTS
MAX=4096
def validate_regions(data):
 if not isinstance(data,dict) or data.get("version")!=225 or not isinstance(data.get("regions"),dict):raise ValueError("Expected version 225 regions")
 regions={}
 for part,polys in data["regions"].items():
  if part not in PARTS:raise ValueError("Unknown layer: "+part)
  if not isinstance(polys,list) or not polys or len(polys)>64:raise ValueError("Invalid polygons")
  checked=[]
  for poly in polys:
   if not isinstance(poly,list) or not 3<=len(poly)<=300:raise ValueError("Invalid polygon size")
   points=[]
   for point in poly:
    if not isinstance(point,list) or len(point)!=2 or any(type(v) not in (int,float) or not 0<=v<=1 for v in point):raise ValueError("Invalid point")
    points.append(tuple(point))
   checked.append(points)
  regions[part]=checked
 return regions
def extract(reference,annotation,out_dir):
 reference=Path(reference);annotation=Path(annotation);out_dir=Path(out_dir)
 if out_dir.exists():raise ValueError("Refusing to overwrite output")
 if not reference.is_file():raise ValueError("Missing reference")
 with Image.open(reference) as source:
  if source.format!="PNG" or not 32<=source.width<=MAX or not 32<=source.height<=MAX:raise ValueError("Unsupported PNG")
  image=source.convert("RGBA")
 regions=validate_regions(json.loads(annotation.read_text(encoding="utf-8")))
 out_dir.mkdir(parents=True)
 records=[]
 try:
  for part,polys in regions.items():
   mask=Image.new("L",image.size,0);draw=ImageDraw.Draw(mask)
   for polygon in polys:draw.polygon([(round(x*(image.width-1)),round(y*(image.height-1))) for x,y in polygon],fill=255)
   layer=image.copy();existing=layer.getchannel("A")
   from PIL import ImageChops
   layer.putalpha(ImageChops.multiply(existing,mask))
   output=out_dir/f"reika_{part}.png";layer.save(output)
   records.append({"part":part,"pixels":mask.histogram()[255],"sha256":hashlib.sha256(output.read_bytes()).hexdigest(),"status":"DRAFT_MASK_REQUIRES_MANUAL_PAINT_OVER"})
  manifest={"version":225,"status":"FLAT_ART_POLYGON_EXTRACTS_NOT_ANIMATABLE","reference_sha256":hashlib.sha256(reference.read_bytes()).hexdigest(),"dimensions":list(image.size),"layers":records,"ready_for_live2d":False,
   "warning":"These polygon extracts retain flattened background and occlusion artifacts. Draw missing geometry, correct alpha manually and rig in Cubism Editor."}
  (out_dir/"manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
  return manifest
 except BaseException:
  import shutil;shutil.rmtree(out_dir,ignore_errors=True);raise
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument("reference",type=Path);p.add_argument("annotations",type=Path);p.add_argument("output",type=Path)
 args=p.parse_args();print(json.dumps(extract(args.reference,args.annotations,args.output),ensure_ascii=False,indent=2))
if __name__=="__main__":
 try:main()
 except (OSError,ValueError) as e:print(e,file=sys.stderr);sys.exit(2)

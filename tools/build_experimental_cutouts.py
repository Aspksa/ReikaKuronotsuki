#!/usr/bin/env python3
"""EXPERIMENTAL polygon cutouts of a flattened portrait; NOT production-ready rig layers."""
import argparse, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
REGIONS={
"tail_1":[(.22,.04),(.42,.01),(.49,.14),(.33,.24),(.12,.23),(.05,.16)],
"tail_2":[(.06,.13),(.29,.11),(.38,.27),(.29,.37),(.07,.37),(.01,.27)],
"tail_3":[(.04,.31),(.33,.29),(.39,.45),(.26,.55),(.02,.50)],
"tail_4":[(.06,.49),(.32,.44),(.43,.55),(.35,.70),(.14,.73),(.06,.62)],
"tail_5":[(.49,.01),(.67,0),(.72,.16),(.63,.25),(.50,.24)],
"tail_6":[(.67,.08),(.92,.07),(.99,.21),(.89,.34),(.68,.31),(.60,.22)],
"tail_7":[(.70,.27),(.96,.22),(1,.39),(.91,.48),(.71,.44)],
"tail_8":[(.78,.40),(1,.38),(1,.64),(.88,.72),(.70,.62)],
"tail_9":[(.68,.48),(.87,.43),(.92,.60),(.78,.84),(.64,.77),(.60,.60)],
"body":[(.36,.19),(.63,.20),(.79,.89),(.97,.93),(.77,.95),(.20,.94),(.25,.78)],
"face":[(.44,.06),(.60,.06),(.62,.14),(.57,.20),(.44,.19),(.40,.13)],
"hair_front":[(.37,.03),(.65,.03),(.69,.44),(.59,.45),(.54,.23),(.43,.37),(.34,.34)],
"hair_back":[(.29,.05),(.71,.04),(.73,.52),(.62,.48),(.35,.50),(.28,.22)],
"ear_left":[(.43,0),(.52,0),(.51,.09),(.46,.12)],
"ear_right":[(.57,.01),(.70,.01),(.64,.12),(.56,.11)],
"eye_left":[(.48,.115),(.525,.115),(.53,.15),(.48,.15)],
"eye_right":[(.55,.118),(.595,.115),(.6,.15),(.55,.153)]}
def build(source,out):
 out.mkdir(parents=True,exist_ok=True)
 image=Image.open(source).convert('RGBA');w,h=image.size
 for name,polygon in REGIONS.items():
  mask=Image.new('L',(w,h),0)
  ImageDraw.Draw(mask).polygon([(round(x*w),round(y*h)) for x,y in polygon],fill=255)
  mask=mask.filter(ImageFilter.GaussianBlur(max(1,round(w/350))))
  layer=image.copy();layer.putalpha(mask);layer.save(out/('reika_'+name+'.png'),compress_level=1)
 (out/'manifest.json').write_text(json.dumps({'source':source.name,'width':w,'height':h,'status':'EXPERIMENTAL_APPROXIMATE_MASKS','layers':list(REGIONS),'warnings':['Not independently segmented','Occluded regions not reconstructed','Includes overlap/background artifacts','Must be reviewed and repainted before rigging']},indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('output',type=Path);a=p.parse_args();build(a.source,a.output)

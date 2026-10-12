#!/usr/bin/env python3
"""Assess experiment masks; diagnostics cannot certify clean segmentation."""
import argparse, json
from pathlib import Path
from PIL import Image, ImageFilter, ImageChops
def report(folder):
 files=sorted(folder.glob('reika_*.png'))
 if not files: raise ValueError('No reika_*.png layers found')
 result={}
 masks={}
 for f in files:
  im=Image.open(f).convert('RGBA')
  alpha=im.getchannel('A')
  hist=alpha.histogram()
  occupied=sum(hist[1:])
  bounds=alpha.getbbox()
  masks[f.stem]=alpha
  result[f.stem]={'size':list(im.size),'nonzero_alpha_fraction':round(occupied/(im.width*im.height),6),'bbox':list(bounds) if bounds else None}
 names=list(masks);overlaps={}
 for i,a in enumerate(names):
  for b in names[i+1:]:
   if masks[a].size!=masks[b].size: raise ValueError('Layer canvas mismatch')
   alpha=ImageChops.multiply(masks[a],masks[b])
   overlap=sum(alpha.histogram()[1:])
   if overlap:overlaps[a+' + '+b]=overlap
 return {'status':'EXPERIMENTAL_DIAGNOSTIC_ONLY','layers':result,'overlap_pixels':overlaps,'warning':'Nonzero overlap can be expected for layered characters; this report does not prove clean alpha or correct segmentation.'}
if __name__=='__main__':
 parser=argparse.ArgumentParser()
 parser.add_argument('folder',type=Path)
 parser.add_argument('--output',type=Path)
 args=parser.parse_args()
 data=report(args.folder)
 encoded=json.dumps(data,indent=2)
 if args.output:args.output.write_text(encoded,encoding='utf-8')
 else:print(encoded)

#!/usr/bin/env python3
"""Extract 9 visual tail swatches from the v30 concept sheet, not rig-ready layers."""
import argparse
import json
import os
import tempfile
from pathlib import Path
from reference_v30 import open_png

TAIL_RECTS=((14,1137,86,1258),(87,1137,169,1258),(171,1137,247,1258),
            (248,1137,325,1258),(328,1137,403,1258),(405,1137,489,1258),
            (490,1137,571,1258),(571,1137,655,1258),(659,1137,742,1258))

def extract(reference,destination):
    reference=Path(reference).resolve()
    destination=Path(destination).resolve()
    if destination.exists():
        raise ValueError('Refusing to overwrite an existing destination')
    sheet=open_png(reference)
    if sheet.size!=(1024,1536):
        raise ValueError('v32 tail positions require a 1024x1536 reference')
    if destination==reference.parent or reference in destination.parents:
        raise ValueError('Do not overwrite reference source')
    destination.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.reika-tail-',dir=destination.parent) as tmp:
        stage=Path(tmp)/'swatches'
        stage.mkdir()
        for index,rect in enumerate(TAIL_RECTS,1):
            sheet.crop(rect).save(stage/f'tail_reference_{index:02}.png')
        report={'version':32,'status':'REFERENCE_CROPS_NOT_RIG_LAYERS',
                'reference_dimensions':list(sheet.size),'count':len(TAIL_RECTS),
                'coordinates':[list(x) for x in TAIL_RECTS],
                'warning':'Crops retain concept-sheet background. Individual tails need manual alpha masking, hidden-area painting and rigging.'}
        (stage/'manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        os.replace(stage,destination)
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference',type=Path)
    parser.add_argument('destination',type=Path)
    args=parser.parse_args()
    print(json.dumps(extract(args.reference,args.destination),indent=2))

#!/usr/bin/env python3
"""Reika offline asset build: validate, clean, inspect, and ZIP. Sources untouched."""
import argparse
import math
import json
import sys
import os
import tempfile
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image
from clean_cutouts import process
from inspect_cutouts import report
from audit_alpha_edges import audit
from validate_assets import validate_layers

def build(source, output, *, require_complete=False, threshold=10, median=3, feather=1, max_alpha_loss=0.5):
    if isinstance(max_alpha_loss,bool) or not isinstance(max_alpha_loss,(int,float)) or not math.isfinite(max_alpha_loss) or not 0 <= max_alpha_loss <= 1:
        raise ValueError('max_alpha_loss must be between 0 and 1')
    source=Path(source).resolve()
    output=Path(output).resolve()
    if source==output or source in output.parents:
        raise ValueError("Output must not be inside the source directory")
    raw, dimensions, missing=validate_layers(source)
    if require_complete and missing:
        raise ValueError("Missing required layers: "+", ".join(missing))
    if output.exists():
        raise ValueError("Refusing to overwrite an existing output directory")
    output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".reika-build-",dir=output.parent) as temporary:
        stage=Path(temporary)/"prepared"
        stage.mkdir()
        cleaned=stage/"layers"
        count=process(source,cleaned,threshold,median,feather)
        checked, processed_dims, processed_missing=validate_layers(cleaned)
        if dimensions!=processed_dims or set(raw)!=set(checked):
            raise ValueError("Cleaned layer set differs from input")
        losses={}
        erased={}
        for name, original in raw.items():
            with Image.open(original) as before, Image.open(checked[name]) as after:
                before_count=sum(before.convert('RGBA').getchannel('A').histogram()[1:])
                after_count=sum(after.convert('RGBA').getchannel('A').histogram()[1:])
                removed=sum(a>0 and b==0 for a,b in zip(before.convert('RGBA').getchannel('A').getdata(),after.convert('RGBA').getchannel('A').getdata()))
            loss=round(max(0,before_count-after_count)/before_count,6) if before_count else 0.0
            losses[name]=loss
            erased[name]=round(removed/before_count,6) if before_count else 0.0
            if before_count and (loss > max_alpha_loss or erased[name] > max_alpha_loss):
                raise ValueError(f'{name}: cleanup removed {max(loss,erased[name]):.1%} of visible pixels (limit {max_alpha_loss:.1%})')
        diagnostic=report(cleaned)
        edge_audit=audit(cleaned)
        manifest={"version":1,"status":"EXPERIMENTAL_REQUIRES_MANUAL_REVIEW",
                  "dimensions":list(processed_dims),"layer_count":count,
                  "missing_layers":processed_missing,
                  "settings":{"threshold":threshold,"median":median,"feather":feather},
                  "alpha_checks_pass":edge_audit["automated_checks_pass"],
                  "alpha_pixel_loss_by_layer":losses,
                  "alpha_erased_pixel_fraction_by_layer":erased,
                  "max_alpha_loss":max_alpha_loss,
                  "warning":"No semantic segmentation or reconstruction of hidden pixels is performed."}
        (stage/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
        (stage/"alpha-report.json").write_text(json.dumps(diagnostic,indent=2),encoding="utf-8")
        (stage/"edge-report.json").write_text(json.dumps(edge_audit,indent=2),encoding="utf-8")
        archive=stage/"reika_cleaned_experimental.zip"
        with ZipFile(archive,"w",ZIP_DEFLATED) as z:
            for path in sorted(cleaned.glob("reika_*.png")):
                z.write(path,"layers/"+path.name)
            for name in ("manifest.json","alpha-report.json","edge-report.json"):
                z.write(stage/name,name)
        os.replace(stage,output)
        return output/archive.name
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("input",type=Path)
    p.add_argument("output",type=Path)
    p.add_argument("--require-complete",action="store_true")
    p.add_argument("--threshold",type=int,default=10)
    p.add_argument("--median",type=int,default=3)
    p.add_argument("--feather",type=float,default=1)
    p.add_argument("--max-alpha-loss",type=float,default=0.5,help="Maximum acceptable fraction of visible pixels removed per layer")
    args=p.parse_args()
    try:
        print("Build:",build(args.input,args.output,require_complete=args.require_complete,
                              threshold=args.threshold,median=args.median,feather=args.feather,
                              max_alpha_loss=args.max_alpha_loss))
    except (OSError, ValueError) as e:
        print("Asset build failed:",e,file=sys.stderr)
        return 1
    return 0
if __name__=="__main__":
    sys.exit(main())

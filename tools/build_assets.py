#!/usr/bin/env python3
"""Reika offline asset build: validate, clean, inspect, and ZIP. Sources untouched."""
import argparse
import json
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from clean_cutouts import process
from inspect_cutouts import report
from validate_assets import validate_layers

def build(source, output, *, require_complete=False, threshold=10, median=3, feather=1):
    source=Path(source).resolve()
    output=Path(output).resolve()
    if source==output or source in output.parents:
        raise ValueError("Output must not be inside the source directory")
    raw, dimensions, missing=validate_layers(source)
    if require_complete and missing:
        raise ValueError("Missing required layers: "+", ".join(missing))
    cleaned=output/"layers"
    if cleaned.exists() and any(cleaned.iterdir()):
        raise ValueError("Refusing to overwrite existing processed files")
    count=process(source,cleaned,threshold,median,feather)
    checked, processed_dims, processed_missing=validate_layers(cleaned)
    if dimensions!=processed_dims or set(raw)!=set(checked):
        raise ValueError("Cleaned layer set differs from input")
    diagnostic=report(cleaned)
    manifest={"version":1,"status":"EXPERIMENTAL_REQUIRES_MANUAL_REVIEW",
              "dimensions":list(processed_dims),"layer_count":count,
              "missing_layers":processed_missing,
              "settings":{"threshold":threshold,"median":median,"feather":feather},
              "warning":"No semantic segmentation or reconstruction of hidden pixels is performed."}
    output.mkdir(parents=True,exist_ok=True)
    (output/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    (output/"alpha-report.json").write_text(json.dumps(diagnostic,indent=2),encoding="utf-8")
    archive=output/"reika_cleaned_experimental.zip"
    with ZipFile(archive,"w",ZIP_DEFLATED) as z:
        for path in sorted(cleaned.glob("reika_*.png")):
            z.write(path,"layers/"+path.name)
        for name in ("manifest.json","alpha-report.json"):
            z.write(output/name,name)
    return archive

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("input",type=Path)
    p.add_argument("output",type=Path)
    p.add_argument("--require-complete",action="store_true")
    p.add_argument("--threshold",type=int,default=10)
    p.add_argument("--median",type=int,default=3)
    p.add_argument("--feather",type=float,default=1)
    args=p.parse_args()
    try:
        print("Build:",build(args.input,args.output,require_complete=args.require_complete,
                              threshold=args.threshold,median=args.median,feather=args.feather))
    except (OSError, ValueError) as e:
        print("Asset build failed:",e,file=sys.stderr)
        return 1
    return 0
if __name__=="__main__":
    sys.exit(main())

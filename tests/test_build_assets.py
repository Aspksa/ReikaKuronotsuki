import json
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
TOOLS=Path(__file__).resolve().parents[1]/"tools"
sys.path.insert(0,str(TOOLS))
from build_assets import build

class PipelineTests(unittest.TestCase):
    def test_one_layer_build_preserves_input(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td);inp=base/"input";inp.mkdir()
            source=inp/"reika_tail_1.png"
            Image.new("RGBA",(32,32),(230,230,240,255)).save(source)
            before=source.read_bytes()
            out=base/"output"
            archive=build(inp,out)
            self.assertEqual(source.read_bytes(),before)
            with ZipFile(archive) as z:
                self.assertIn("layers/reika_tail_1.png",z.namelist())
                self.assertIn("alpha-report.json",z.namelist())
                self.assertIn("edge-report.json",z.namelist())
                edge=json.loads(z.read("edge-report.json"))
                manifest=json.loads(z.read("manifest.json"))
                self.assertEqual(edge["status"],"MANUAL_REVIEW_REQUIRED")
                self.assertEqual(edge["layers"]["tail_1"]["border_occupied_pixels"],124)
                self.assertFalse(manifest["alpha_checks_pass"])
                self.assertEqual(manifest["alpha_pixel_loss_by_layer"]["tail_1"],0)
                self.assertEqual(manifest["alpha_erased_pixel_fraction_by_layer"]["tail_1"],0)
            with self.assertRaises(ValueError):build(inp,base/"another",require_complete=True)
    def test_reject_destructive_cleaning(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td);src=base/"source";src.mkdir()
            image=Image.new("RGBA",(16,16),(255,255,255,0))
            image.putpixel((8,8),(255,255,255,255))
            image.save(src/"reika_tail_1.png")
            with self.assertRaisesRegex(ValueError,"cleanup removed"):
                build(src,base/"output",feather=0,max_alpha_loss=.25)
            self.assertEqual(Image.open(src/"reika_tail_1.png").getpixel((8,8))[3],255)
    def test_reject_bad_loss_limit(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td)
            with self.assertRaisesRegex(ValueError,"max_alpha_loss"):
                build(base,base/"output",max_alpha_loss=1.5)
    def test_removed_detail_not_hidden_by_feathered_new_pixels(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td);src=base/"source";src.mkdir()
            image=Image.new("RGBA",(25,25),(255,255,255,0))
            for y in range(9,14):
                for x in range(9,14):image.putpixel((x,y),(255,255,255,255))
            image.putpixel((23,23),(255,255,255,255))
            image.save(src/"reika_tail_1.png")
            with self.assertRaisesRegex(ValueError,"cleanup removed"):
                build(src,base/"out",median=3,feather=1,max_alpha_loss=.02)
    def test_refuse_in_source_directory(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td)
            with self.assertRaises(ValueError):build(base,base/"output")
if __name__=="__main__":unittest.main()

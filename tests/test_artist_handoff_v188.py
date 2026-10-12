"""Tests for v188 artwork handoff archives."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from artist_handoff_v188 import build
from validate_assets import PARTS

class TestHandoff(unittest.TestCase):
    @staticmethod
    def layer(folder,part,visible=True,size=(32,40)):
        image=Image.new("RGBA",size,(0,0,0,0))
        if visible:image.putpixel((9,10),(255,245,235,200))
        image.save(folder/("reika_"+part+".png"))
    def test_single_layer_package(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)/"layers";folder.mkdir()
            self.layer(folder,"face")
            output=Path(tmp)/"handoff.zip"
            report=build(folder,output)
            self.assertFalse(report["ready_for_live2d"])
            with ZipFile(output) as z:
                self.assertEqual(sorted(z.namelist()),["contact_sheet.png","layers/reika_face.png","manifest.json"])
                manifest=json.loads(z.read("manifest.json"))
                self.assertEqual(manifest["files"][0]["sha256"],hashlib.sha256(z.read("layers/reika_face.png")).hexdigest())
    def test_empty_layers_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError,"No usable layers"):build(tmp,Path(tmp)/"empty.zip")
    def test_strict_requires_complete_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            self.layer(folder,"face")
            with self.assertRaisesRegex(ValueError,"Incomplete artwork"):build(folder,folder/"handoff.zip",strict=True)
    def test_complete_strict_package(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)/"layers";folder.mkdir()
            for part in PARTS:self.layer(folder,part)
            result=build(folder,Path(tmp)/"handoff.zip",strict=True)
            self.assertEqual(len(result["files"]),17)
            self.assertTrue(result["audit"]["complete_visible_set"])
    def test_incomplete_blank_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            self.layer(folder,"face",visible=False)
            report=build(folder,folder/"handoff.zip")
            self.assertIn("face",report["audit"]["blank"])
    def test_mismatched_dimensions_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp)
            self.layer(folder,"face")
            self.layer(folder,"body",size=(50,50))
            with self.assertRaisesRegex(ValueError,"Canvas mismatch"):build(folder,folder/"handoff.zip")
    def test_path_protection(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);self.layer(folder,"face")
            with self.assertRaisesRegex(ValueError,"overwrite"):build(folder,folder/"reika_face.png")
if __name__=="__main__":unittest.main()

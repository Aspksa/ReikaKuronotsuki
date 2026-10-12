"""Regression checks for the v170 layered artwork readiness audit."""
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from artwork_readiness_v170 import inspect
from validate_assets import PARTS

class ArtReadinessTests(unittest.TestCase):
    def image(self,folder,name,pixels=None,size=(16,16),mode="RGBA"):
        im=Image.new(mode,size,(0,0,0,0) if mode=="RGBA" else (0,0,0))
        if pixels:
            for xy in pixels:im.putpixel(xy,(255,255,255,128))
        im.save(folder/name)
    def test_missing_all(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=inspect(tmp)
            self.assertEqual(len(r["missing"]),17)
            self.assertFalse(r["complete_visible_set"])
    def test_blank_template_is_not_ready(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.image(Path(tmp),"reika_face.png")
            r=inspect(tmp)
            self.assertIn("face",r["blank"])
            self.assertEqual(r["visible_layers"],0)
    def test_valid_partial_alpha_and_bounds(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.image(Path(tmp),"reika_face.png",[(7,6),(8,6)])
            record=next(x for x in inspect(tmp)["layers"] if x["part"]=="face")
            self.assertEqual(record["partial_alpha_pixels"],2)
            self.assertEqual(record["alpha_bounds"],[7,6,9,7])
            self.assertFalse(record["touches_canvas_edge"])
    def test_edge_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.image(Path(tmp),"reika_tail_1.png",[(0,0)])
            self.assertIn("tail_1",inspect(tmp)["edge_review"])
    def test_dimensions_must_match(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.image(Path(tmp),"reika_face.png",[(1,1)])
            self.image(Path(tmp),"reika_body.png",[(1,1)],size=(20,20))
            with self.assertRaisesRegex(ValueError,"Canvas mismatch"):inspect(tmp)
    def test_requires_rgba(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.image(Path(tmp),"reika_face.png",mode="RGB")
            with self.assertRaisesRegex(ValueError,"RGBA"):inspect(tmp)
    def test_complete_visible_layers(self):
        with tempfile.TemporaryDirectory() as tmp:
            for part in PARTS:self.image(Path(tmp),"reika_"+part+".png",[(5,5)])
            r=inspect(tmp,require_complete=True)
            self.assertTrue(r["complete_visible_set"])
            self.assertEqual(r["visible_layers"],17)
    def test_complete_flag_rejects_blanks(self):
        with tempfile.TemporaryDirectory() as tmp:
            for part in PARTS:self.image(Path(tmp),"reika_"+part+".png")
            with self.assertRaisesRegex(ValueError,"Incomplete artwork"):inspect(tmp,True)
    def test_unknown_png_is_ignored_and_flagged(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.image(Path(tmp),"some_other.png")
            self.assertEqual(inspect(tmp)["extra_png"],["some_other.png"])
    def test_no_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError,"missing"):inspect(Path(tmp)/"absent")
if __name__=="__main__":unittest.main()

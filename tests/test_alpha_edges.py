import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from audit_alpha_edges import audit

class EdgeAuditTests(unittest.TestCase):
    def test_transparent_center_is_detected(self):
        with tempfile.TemporaryDirectory() as td:
            folder=Path(td)
            im=Image.new("RGBA",(20,20),(255,255,255,0))
            for y in range(5,15):
                for x in range(5,15):im.putpixel((x,y),(255,255,255,255))
            im.save(folder/"reika_tail_1.png")
            r=audit(folder)
            self.assertEqual(r["layers"]["tail_1"]["border_occupied_pixels"],0)
            self.assertAlmostEqual(r["layers"]["tail_1"]["alpha_coverage"],.25)
            self.assertEqual(len(r["missing"]),16)
    def test_border_and_feather_are_reported(self):
        with tempfile.TemporaryDirectory() as td:
            folder=Path(td)
            im=Image.new("RGBA",(8,8),(0,0,0,0))
            im.putpixel((0,0),(255,255,255,128))
            im.save(folder/"reika_hair_front.png")
            r=audit(folder)["layers"]["hair_front"]
            self.assertEqual(r["border_occupied_pixels"],1)
            self.assertAlmostEqual(r["feather_fraction"],1/64)
            self.assertIn("touches canvas border",r["warnings"])
    def test_fully_opaque_flagged(self):
        with tempfile.TemporaryDirectory() as td:
            folder=Path(td)
            Image.new("RGBA",(8,8),(255,255,255,255)).save(folder/"reika_face.png")
            r=audit(folder)["layers"]["face"]
            self.assertIn("fully opaque alpha",r["warnings"])

if __name__=="__main__":unittest.main()

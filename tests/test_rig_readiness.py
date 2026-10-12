import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from rig_readiness import assess

class ReadinessTests(unittest.TestCase):
    def test_partial_set_marked_not_ready(self):
        with tempfile.TemporaryDirectory() as td:
            folder=Path(td)
            image=Image.new("RGBA",(32,32),(255,255,255,0))
            for y in range(10,20):
                for x in range(10,20):image.putpixel((x,y),(255,255,255,255))
            image.save(folder/"reika_tail_1.png")
            report=assess(folder)
            self.assertFalse(report["automated_checks_pass"])
            self.assertEqual(len(report["missing"]),16)
            self.assertTrue(report["layers"]["tail_1"]["has_transparency"])
    def test_fully_opaque_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            folder=Path(td)
            Image.new("RGBA",(16,16),(255,255,255,255)).save(folder/"reika_face.png")
            report=assess(folder)
            self.assertFalse(report["layers"]["face"]["has_transparency"])
            self.assertIn("face: fully opaque, likely not cut out",report["warnings"])

if __name__=="__main__":unittest.main()

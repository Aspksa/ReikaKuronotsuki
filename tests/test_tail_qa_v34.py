import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from tail_qa_v34 import inspect,analyze

class TailQATests(unittest.TestCase):
    def test_metrics_report_border_and_partial_alpha(self):
        image=Image.new("RGBA",(8,8),(0,0,0,0))
        image.putpixel((0,0),(255,255,255,128))
        summary=inspect(image)
        self.assertEqual(summary["border_visible_pixels"],1)
        self.assertEqual(summary["partial_alpha_fraction"],round(1/64,5))
        self.assertIn("alpha touches frame",summary["warnings"])
    def test_all_nine_and_preview(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td);folder=base/"tails";folder.mkdir()
            for i in range(1,10):
                Image.new("RGBA",(16,16),(255,255,255,128)).save(folder/f"tail_matte_study_{i:02}.png")
            output=base/"qa.json";preview=base/"preview.png"
            report=analyze(folder,output,preview)
            self.assertEqual(len(report["tails"]),9)
            self.assertTrue(output.is_file())
            self.assertEqual(Image.open(preview).size,(660,756))
            with self.assertRaisesRegex(ValueError,"overwrite"):
                analyze(folder,output)
    def test_missing_inputs_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaisesRegex(ValueError,"nine"):
                analyze(td)

if __name__=="__main__":unittest.main()

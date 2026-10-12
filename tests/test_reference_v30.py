import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from reference_v30 import board, open_png

class PortraitReviewTests(unittest.TestCase):
    def test_creates_comparison_with_missing_layers_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ref = root / "reika_reference.png"
            Image.new("RGB", (512, 768), (230, 225, 235)).save(ref)
            layers = root / "layers"
            layers.mkdir()
            Image.new("RGBA", (64, 64), (200, 150, 120, 128)).save(layers / "reika_tail_1.png")
            output = root / "comparison.png"
            report = board(ref, layers, output)
            self.assertEqual(report["status"], "MANUAL_VISUAL_REVIEW_REQUIRED")
            self.assertEqual(len(report["missing"]), 16)
            self.assertEqual(len(report["reference_sha256"]), 64)
            self.assertEqual(Image.open(output).size, (1280, 830))
            with self.assertRaisesRegex(ValueError, "overwrite"):
                board(ref, layers, output)

    def test_invalid_reference_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            small = root / "small.png"
            Image.new("RGB", (32, 32)).save(small)
            with self.assertRaisesRegex(ValueError, "512"):
                open_png(small)
            fake = root / "fake.png"
            fake.write_text("not a PNG")
            with self.assertRaises(OSError):
                open_png(fake)

    def test_reject_output_inside_layers(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ref = root / "ref.png"
            Image.new("RGB", (512, 512)).save(ref)
            layers = root / "layers"
            layers.mkdir()
            Image.new("RGBA", (8, 8)).save(layers / "reika_face.png")
            with self.assertRaisesRegex(ValueError, "inside"):
                board(ref, layers, layers / "comparison.png")

if __name__ == "__main__":
    unittest.main()

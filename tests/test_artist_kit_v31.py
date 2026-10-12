import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from artist_kit_v31 import create_kit
from validate_assets import PARTS

class ArtistKitTests(unittest.TestCase):
    def test_blank_layers_and_original_reference(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);ref=root/"reference.png"
            Image.new("RGB",(512,768),(80,90,100)).save(ref)
            destination=root/"kit"
            manifest=create_kit(ref,destination)
            self.assertFalse(manifest["ready_for_animation"])
            self.assertEqual(len(list((destination/"layers").glob("reika_*.png"))),len(PARTS))
            for layer in (destination/"layers").glob("*.png"):
                with Image.open(layer) as im:
                    self.assertEqual(im.size,(512,768))
                    self.assertIsNone(im.getchannel("A").getbbox())
            self.assertEqual(Image.open(destination/"reference.png").getpixel((0,0)),(80,90,100,255))
            with self.assertRaisesRegex(ValueError,"overwrite"):
                create_kit(ref,destination)
    def test_reject_small_reference_without_output(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td);ref=root/"tiny.png"
            Image.new("RGB",(10,10)).save(ref)
            with self.assertRaisesRegex(ValueError,"512"):
                create_kit(ref,root/"kit")
            self.assertFalse((root/"kit").exists())
if __name__=="__main__":unittest.main()

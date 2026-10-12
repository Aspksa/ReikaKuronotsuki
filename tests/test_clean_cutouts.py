import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image

spec=importlib.util.spec_from_file_location("cleanup",Path(__file__).resolve().parents[1]/"tools"/"clean_cutouts.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class CleanupTests(unittest.TestCase):
    def test_isolated_noise_removed_and_source_intact(self):
        original=Image.new("RGBA",(11,11),(200,100,50,0))
        original.putpixel((5,5),(200,100,50,255))
        result=mod.clean(original,threshold=10,median=3,feather=0)
        self.assertEqual(result.getpixel((5,5))[3],0)
        self.assertEqual(original.getpixel((5,5))[3],255)
    def test_opaque_region_preserved(self):
        original=Image.new("RGBA",(11,11),(200,100,50,0))
        for y in range(2,9):
            for x in range(2,9):original.putpixel((x,y),(200,100,50,255))
        result=mod.clean(original,median=3,feather=0)
        self.assertEqual(result.getpixel((5,5)),(200,100,50,255))
    def test_validations(self):
        with self.assertRaises(ValueError):mod.clean(Image.new("RGBA",(3,3)),median=2)
        with self.assertRaises(ValueError):mod.clean(Image.new("RGBA",(3,3)),threshold=256)
    def test_directory_processing(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td);src=base/"raw";dst=base/"clean";src.mkdir()
            Image.new("RGBA",(10,10),(1,2,3,255)).save(src/"reika_tail_1.png")
            self.assertEqual(mod.process(src,dst),1)
            self.assertTrue((dst/"reika_tail_1.png").exists())
            with self.assertRaises(ValueError):mod.process(src,src)
if __name__=="__main__":unittest.main()

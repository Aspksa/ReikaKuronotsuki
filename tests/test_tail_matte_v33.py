import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from tail_matte_v33 import matte,export

class TailMatteTests(unittest.TestCase):
    def test_dark_border_removed_light_center_preserved(self):
        image=Image.new("RGB",(32,32),(12,20,28))
        for y in range(8,24):
            for x in range(8,24):image.putpixel((x,y),(220,220,220))
        out=matte(image)
        self.assertEqual(out.getpixel((0,0))[3],0)
        self.assertGreater(out.getpixel((16,16))[3],200)
    def test_bad_settings(self):
        with self.assertRaises(ValueError):matte(Image.new("RGB",(8,8)),tolerance=999)
    def test_extract_all_nine(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/"source";source.mkdir()
            for i in range(1,10):
                image=Image.new("RGB",(32,32),(12,20,28))
                for y in range(8,24):
                    for x in range(8,24):image.putpixel((x,y),(220,220,220))
                image.save(source/f"tail_reference_{i:02}.png")
            output=root/"output";result=export(source,output)
            self.assertEqual(result["status"],"EXPERIMENTAL_BACKGROUND_REMOVAL_NOT_LIVE2D")
            self.assertEqual(len(list(output.glob("tail_matte_study_*.png"))),9)
            with self.assertRaises(ValueError):export(source,output)

if __name__=="__main__":unittest.main()

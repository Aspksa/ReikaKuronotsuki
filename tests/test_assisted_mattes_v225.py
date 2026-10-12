import json,sys,tempfile,unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from assisted_mattes_v225 import extract,validate_regions
class TestMattes(unittest.TestCase):
 def test_valid_polygon(self):
  r=validate_regions({"version":225,"regions":{"tail_1":[[[0,0],[1,0],[.5,1]]]}})
  self.assertEqual(len(r["tail_1"][0]),3)
 def test_reject_unrecognized_part(self):
  with self.assertRaises(ValueError):validate_regions({"version":225,"regions":{"fake":[[[0,0],[1,0],[.5,1]]]}})
 def test_reject_out_of_bounds(self):
  with self.assertRaises(ValueError):validate_regions({"version":225,"regions":{"face":[[[0,0],[2,0],[.5,1]]]}})
 def test_extract_preserves_canvas_with_transparency(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);img=d/"ref.png";Image.new("RGB",(64,80),(240,220,200)).save(img)
   annotations=d/"regions.json";annotations.write_text(json.dumps({"version":225,"regions":{"tail_1":[[[.1,.1],[.8,.1],[.4,.8]]]}}))
   manifest=extract(img,annotations,d/"out")
   self.assertFalse(manifest["ready_for_live2d"])
   with Image.open(d/"out"/"reika_tail_1.png") as im:
    self.assertEqual(im.size,(64,80));self.assertEqual(im.getpixel((0,0))[3],0);self.assertGreater(im.getpixel((28,20))[3],0)
 def test_refuses_overwrite(self):
  with tempfile.TemporaryDirectory() as d:
   d=Path(d);Image.new("RGB",(64,80)).save(d/"ref.png");(d/"region.json").write_text('{"version":225,"regions":{}}')
   (d/"out").mkdir()
   with self.assertRaisesRegex(ValueError,"overwrite"):extract(d/"ref.png",d/"region.json",d/"out")
if __name__=="__main__":unittest.main()

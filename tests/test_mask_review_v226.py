import json,sys,tempfile,unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from mask_review_v226 import audit
class MaskReviewTests(unittest.TestCase):
 def test_overlay_and_audit(self):
  with tempfile.TemporaryDirectory() as tmp:
   d=Path(tmp);Image.new("RGB",(80,80),(10,20,30)).save(d/"reference.png")
   (d/"regions.json").write_text(json.dumps({"version":225,"regions":{"tail_1":[[[.1,.1],[.8,.1],[.4,.8]]]}}))
   result=audit(d/"reference.png",d/"regions.json",d/"out")
   self.assertGreater(result["covered_pixels"],0)
   self.assertFalse(result["ready_for_live2d"])
   self.assertTrue((d/"out"/"mask_overlay.png").exists())
   self.assertEqual(json.loads((d/"out"/"annotation_report.json").read_text())["version"],226)
 def test_empty_regions_fail(self):
  with tempfile.TemporaryDirectory() as tmp:
   d=Path(tmp);Image.new("RGB",(80,80)).save(d/"reference.png")
   (d/"regions.json").write_text('{"version":225,"regions":{}}')
   with self.assertRaisesRegex(ValueError,"No annotated"):audit(d/"reference.png",d/"regions.json",d/"out")
 def test_refuse_overwrite(self):
  with tempfile.TemporaryDirectory() as tmp:
   d=Path(tmp);Image.new("RGB",(80,80)).save(d/"reference.png")
   (d/"regions.json").write_text('{"version":225,"regions":{"face":[[[0,0],[1,0],[.5,1]]]}}')
   (d/"out").mkdir()
   with self.assertRaisesRegex(ValueError,"overwrite"):audit(d/"reference.png",d/"regions.json",d/"out")
if __name__=="__main__":unittest.main()

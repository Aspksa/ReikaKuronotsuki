"""Test blueprint readiness and real parameter mapping."""
import sys,tempfile,unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from cubism_rig_blueprint_v207 import plan,PARTS

class TestBlueprint(unittest.TestCase):
 def make(self,folder,part,visible=True):
  im=Image.new("RGBA",(64,80),(0,0,0,0))
  if visible:im.putpixel((20,30),(250,220,220,255))
  im.save(folder/f"reika_{part}.png")
 def test_blank_workspace_not_ready(self):
  with tempfile.TemporaryDirectory() as tmp:
   for part in PARTS:self.make(Path(tmp),part,False)
   p=plan(tmp)
   self.assertFalse(p["ready_for_manual_rig_review"])
   self.assertFalse(p["moc3_created"])
   self.assertEqual(len(p["artworks"]),37)
 def test_painted_layers_have_provisional_pivots(self):
  with tempfile.TemporaryDirectory() as tmp:
   for part in PARTS:self.make(Path(tmp),part)
   p=plan(tmp)
   self.assertTrue(p["ready_for_manual_rig_review"])
   self.assertEqual(len([x for x in p["parameters"] if x["id"].startswith("ParamTail")]),9)
   self.assertEqual(next(x for x in p["artworks"] if x["part"]=="face")["pivot"],[.3203,.3812])
 def test_missing_layers_reported(self):
  with tempfile.TemporaryDirectory() as tmp:
   self.make(Path(tmp),"face")
   p=plan(tmp)
   self.assertEqual(sum(x["state"]=="missing" for x in p["artworks"]),36)
   self.assertFalse(p["ready_for_manual_rig_review"])
 def test_non_rgba_rejected(self):
  with tempfile.TemporaryDirectory() as tmp:
   Image.new("RGB",(64,80)).save(Path(tmp)/"reika_face.png")
   with self.assertRaisesRegex(ValueError,"RGBA"):plan(tmp)
if __name__=="__main__":unittest.main()

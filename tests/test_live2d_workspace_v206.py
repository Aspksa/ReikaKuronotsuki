"""Verify that Cubism source workspace is safe, complete and intentionally unpainted."""
import sys,tempfile,unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from live2d_workspace_v206 import ORDER,prepare

class WorkspaceTests(unittest.TestCase):
 def reference(self,folder):
  file=Path(folder)/"source.png";Image.new("RGB",(320,400),(255,200,200)).save(file);return file
 def test_all_templates_exist(self):
  with tempfile.TemporaryDirectory() as tmp:
   ref=self.reference(tmp);dest=Path(tmp)/"out";result=prepare(ref,dest)
   self.assertEqual(result["layer_count"],37)
   self.assertEqual(len(list((dest/"layers").glob("*.png"))),37)
   self.assertFalse(result["ready_for_live2d"])
 def test_all_templates_blank_and_same_size(self):
  with tempfile.TemporaryDirectory() as tmp:
   ref=self.reference(tmp);dest=Path(tmp)/"out";prepare(ref,dest)
   for part in ORDER:
    with Image.open(dest/"layers"/("reika_"+part+".png")) as im:
     self.assertEqual(im.mode,"RGBA");self.assertEqual(im.size,(320,400));self.assertIsNone(im.getchannel("A").getbbox())
 def test_refuses_overwrite(self):
  with tempfile.TemporaryDirectory() as tmp:
   ref=self.reference(tmp);dest=Path(tmp)/"out";prepare(ref,dest)
   with self.assertRaisesRegex(ValueError,"overwrite"):prepare(ref,dest)
 def test_rejects_non_png(self):
  with tempfile.TemporaryDirectory() as tmp:
   ref=Path(tmp)/"source.jpg";Image.new("RGB",(320,400)).save(ref)
   with self.assertRaisesRegex(ValueError,"PNG"):prepare(ref,Path(tmp)/"out")
 def test_rejects_missing_file(self):
  with tempfile.TemporaryDirectory() as tmp:
   with self.assertRaisesRegex(ValueError,"does not exist"):prepare(Path(tmp)/"missing.png",Path(tmp)/"out")
 def test_rejects_too_small(self):
  with tempfile.TemporaryDirectory() as tmp:
   ref=Path(tmp)/"source.png";Image.new("RGB",(10,10)).save(ref)
   with self.assertRaisesRegex(ValueError,"dimensions"):prepare(ref,Path(tmp)/"out")
 def test_requires_nine_tails(self):
  self.assertEqual(sum(x.startswith("tail_") for x in ORDER),9)
if __name__=="__main__":unittest.main()

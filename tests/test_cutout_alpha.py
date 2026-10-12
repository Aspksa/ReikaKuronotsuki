import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image
SCRIPT=Path(__file__).resolve().parents[1]/'tools'/'inspect_cutouts.py'
spec=importlib.util.spec_from_file_location('inspect_cutouts',SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class AlphaTests(unittest.TestCase):
 def test_single_layer_metrics(self):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp)
   image=Image.new('RGBA',(10,10),(255,255,255,0))
   for x in range(3):
    for y in range(4):image.putpixel((x,y),(255,255,255,255))
   image.save(folder/'reika_tail_1.png')
   data=mod.report(folder)
   self.assertEqual(data['layers']['reika_tail_1']['bbox'],[0,0,3,4])
   self.assertEqual(data['layers']['reika_tail_1']['nonzero_alpha_fraction'],.12)
 def test_mismatched_dimensions(self):
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp)
   Image.new('RGBA',(10,10)).save(folder/'reika_tail_1.png')
   Image.new('RGBA',(20,10)).save(folder/'reika_tail_2.png')
   with self.assertRaises(ValueError):mod.report(folder)
if __name__=='__main__':unittest.main()

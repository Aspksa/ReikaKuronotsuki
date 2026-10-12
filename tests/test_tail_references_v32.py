import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from tail_references_v32 import extract

class TailReferenceTests(unittest.TestCase):
    def test_nine_nonempty_reference_crops(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            source=root/'reference.png'
            Image.new('RGB',(1024,1536),(100,110,120)).save(source)
            output=root/'swatches'
            report=extract(source,output)
            self.assertEqual(report['count'],9)
            self.assertEqual(report['status'],'REFERENCE_CROPS_NOT_RIG_LAYERS')
            files=list(output.glob('tail_reference_*.png'))
            self.assertEqual(len(files),9)
            with Image.open(output/'tail_reference_01.png') as first:
                self.assertEqual(first.size,(72,121))
            with self.assertRaisesRegex(ValueError,'overwrite'):
                extract(source,output)
    def test_reject_different_sheet(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            source=root/'reference.png'
            Image.new('RGB',(512,768)).save(source)
            with self.assertRaisesRegex(ValueError,'1024x1536'):
                extract(source,root/'swatches')
            self.assertFalse((root/'swatches').exists())
if __name__=='__main__':
    unittest.main()

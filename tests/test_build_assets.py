import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
TOOLS=Path(__file__).resolve().parents[1]/"tools"
sys.path.insert(0,str(TOOLS))
from build_assets import build

class PipelineTests(unittest.TestCase):
    def test_one_layer_build_preserves_input(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td);inp=base/"input";inp.mkdir()
            source=inp/"reika_tail_1.png"
            Image.new("RGBA",(32,32),(230,230,240,255)).save(source)
            before=source.read_bytes()
            out=base/"output"
            archive=build(inp,out)
            self.assertEqual(source.read_bytes(),before)
            with ZipFile(archive) as z:
                self.assertIn("layers/reika_tail_1.png",z.namelist())
                self.assertIn("alpha-report.json",z.namelist())
            with self.assertRaises(ValueError):build(inp,base/"another",require_complete=True)
    def test_refuse_in_source_directory(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td)
            with self.assertRaises(ValueError):build(base,base/"output")
if __name__=="__main__":unittest.main()

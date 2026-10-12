import importlib.util
import struct
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "validate_assets.py"
spec = importlib.util.spec_from_file_location("validate_assets", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class AssetTests(unittest.TestCase):
    def test_png_size(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / "reika_tail_1.png"
            p.write_bytes(b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) +
                          b"IHDR" + struct.pack(">II", 1024, 2048))
            self.assertEqual(mod.png_dimensions(p), (1024, 2048))

    def test_invalid_header(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / "bad.png"
            p.write_bytes(b"not png")
            with self.assertRaises(ValueError):
                mod.png_dimensions(p)

    def test_missing_parts(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / "reika_tail_1.png"
            p.write_bytes(b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) +
                          b"IHDR" + struct.pack(">II", 100, 100))
            found, dims, missing = mod.validate_layers(Path(folder))
            self.assertEqual(len(found), 1)
            self.assertEqual(dims, (100, 100))
            self.assertEqual(len(missing), 16)


if __name__ == "__main__":
    unittest.main()

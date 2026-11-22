"""new_project.py — tạo thư mục dự án video mới cho ngách Bản Đồ Động & Countryball.
  python tools/new_project.py --name <slug> --title "<Tiêu đề video>" [--aspect 16:9|9:16] [--resolution 1080p]
"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import write_json

ap = argparse.ArgumentParser()
ap.add_argument("--name", required=True, help="Tên thư mục dự án (slug)")
ap.add_argument("--title", default="", help="Tiêu đề video hiển thị")
ap.add_argument("--aspect", default="16:9", choices=["16:9", "9:16"])
ap.add_argument("--resolution", default="1080p", choices=["1080p", "720p", "4k"])
ap.add_argument("--style", default="dark", help="Phong cách hiển thị (mặc định: dark)")
ap.add_argument("--captions", action="store_true", default=True, help="Hiển thị phụ đề đồng bộ giọng nói")
ap.add_argument("--pack", default="bando", help="Bộ phong cách ngách (mặc định: bando Dark Map & Countryball)")
ap.add_argument("--lang", default="vi", help="Ngôn ngữ thuyết minh & phụ đề (vi)")
a = ap.parse_args()

root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "projects", a.name)
for d in ["input", "anh", "timeline", "story", "scenes/sets", "scenes/shots", "build", "out"]:
    os.makedirs(os.path.join(root, d), exist_ok=True)

cfg = os.path.join(root, "config.json")
if not os.path.exists(cfg):
    write_json(cfg, {
        "title": a.title or a.name,
        "aspect": a.aspect,
        "resolution": a.resolution,
        "fps": 30,
        "style": a.style,
        "captions": True,
        "bars": "none",
        "fadeIn": 0.5,
        "fadeOut": 0.8,
        "pack": a.pack,
        "lang": a.lang,
        "music": {"enabled": True, "gainDb": -20},
        "sfx": {"enabled": True, "gainDb": -4},
        "loudness": -14
    })
print("Dự án Bản Đồ Động mới tạo tại:", root)

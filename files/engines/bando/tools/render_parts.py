"""render_parts.py — render video dai theo TUNG DOAN (mac dinh 4 phut), bi ngat thi chay lai se lam tiep doan con thieu,
xong tu ghep + tron am (mix.py) -> out/<tieu de>_1080p.mp4. Chay duoc tren Windows / macOS / Linux.
  python tools/render_parts.py --project projects/<slug> [--seg 240] [--workers 2] [--preset veryfast] [--crf 20] [--redo 3,4]
"""
import argparse, glob, json, os, re, subprocess, sys
KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--project", required=True); ap.add_argument("--seg", type=float, default=240)
ap.add_argument("--workers", default=""); ap.add_argument("--preset", default="veryfast"); ap.add_argument("--crf", default="20")
ap.add_argument("--redo", default="", help="danh sach doan can render lai, vd 0,3")
ap.add_argument("--no-mix", action="store_true")
a = ap.parse_args(); P = os.path.abspath(a.project)
story = json.load(open(os.path.join(P, "story", "shots.json"), encoding="utf-8")); dur = story.get("duration") or story["shots"][-1]["end"]
SEGD = os.path.join(P, "build", "segs"); os.makedirs(SEGD, exist_ok=True)
redo = {int(x) for x in a.redo.split(",") if x.strip()}
import math
n = max(1, math.ceil(dur / a.seg - 1e-9))
for i in range(n):
    name = f"seg_{i:02d}"; f = os.path.join(SEGD, name + ".mp4")
    if i in redo and os.path.exists(f): os.remove(f)
    if os.path.exists(f): print(f"[{i+1}/{n}] đã có {name}, bỏ qua"); continue
    s0, s1 = i * a.seg, min(dur, (i + 1) * a.seg)
    print(f"[{i+1}/{n}] render {s0:.0f}s → {s1:.0f}s")
    cmd = ["node", os.path.join(KIT, "render.mjs"), "--project", P, "--from", str(s0), "--to", str(s1), "--seg", name, "--preset", a.preset, "--crf", a.crf]
    if a.workers: cmd += ["--workers", a.workers]
    r = subprocess.run(cmd, cwd=KIT)
    if r.returncode or not os.path.exists(f): sys.exit(f"Lỗi ở đoạn {i}. Chạy lại lệnh này để làm tiếp.")
lst = os.path.join(SEGD, "list.txt")
with open(lst, "w", encoding="utf-8") as fh:
    for i in range(n): fh.write(f"file '{os.path.join(SEGD, f'seg_{i:02d}.mp4').replace(chr(92), '/')}'\n")
silent = os.path.join(P, "build", "video_silent.mp4")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent], check=True)
print("Đã ghép:", silent)
if not a.no_mix: subprocess.run([sys.executable, os.path.join(KIT, "tools", "mix.py"), "--project", P], check=True)

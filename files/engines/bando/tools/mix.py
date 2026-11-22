"""mix.py — tron voice + nhac nen + hieu ung am thanh theo story/shots.json, chuan -14 LUFS, ghep vao video.
  python tools/mix.py --project projects/<ten>            -> build/mix.wav (+ out/<tieu de>.mp4 neu da co build/video_silent.mp4)
shots.json:
  "music": [{"start":0,"end":42,"bed":"curious","gainDb":0}, {"start":42,"end":50,"bed":"none"}]   bed: wonder|curious|tension|emotional|triumph|mystery|none
  shot "sfx": [{"at":0.3,"name":"whoosh_fast","gain":-6}]  (at = giay tinh tu dau shot; name = ten file trong audio/sfx, khong can duoi)
  Khong co timeline/voice.wav (phim khong loi doc) thi chi tron nhac + SFX.
  shot "notes" co chu DROP -> tat nhac trong shot do.
"""
import argparse, glob, os, re, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import SR, load_audio, save_wav, read_json, run

KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument("--project", required=True); ap.add_argument("--no-video", action="store_true")
a = ap.parse_args(); P = a.project
cfg = read_json(os.path.join(P, "config.json"), {}); story = read_json(os.path.join(P, "story", "shots.json"), {})
shots = story.get("shots", []); dur = story.get("duration") or (shots[-1]["end"] if shots else 0)
N = int(dur * SR) + SR
# phim khong loi doc (vd pack dem): khong co timeline/voice.wav -> chi tron nhac + SFX
vpath = os.path.join(P, "timeline", "voice.wav")
voice = load_audio(vpath) if os.path.exists(vpath) else np.zeros(N); voice = np.pad(voice, (0, max(0, N - len(voice))))[:N]
db = lambda x: 10 ** (x / 20)
def loud(y):
    try:
        import pyloudnorm as pyln
        return pyln.Meter(SR).integrated_loudness(y.astype(np.float64))
    except Exception:
        e = y[np.abs(y) > 1e-4]; return 20 * np.log10(np.sqrt(np.mean(e ** 2)) + 1e-9) - 0.7 if len(e) else -70
if np.any(voice): voice *= db(-16 - loud(voice))
log = []

# ---------- nhac nen
music = np.zeros(N)
mcfg = cfg.get("music", {"enabled": True})
if mcfg.get("enabled", True):
    secs = story.get("music") or [{"start": 0, "end": dur, "bed": "curious"}]
    beds = {os.path.basename(f).split("_")[1]: f for f in glob.glob(os.path.join(KIT, "audio", "music", "bed_*.wav"))}
    if mcfg.get("file"): beds["user"] = os.path.join(P, mcfg["file"])
    gate = np.ones(N)
    for s in shots:
        if "DROP" in str(s.get("notes", "")).upper(): gate[int(s["start"] * SR):int(s["end"] * SR)] = 0
    cache = {}
    for sec in secs:
        name = sec.get("bed", "curious")
        if name in ("none", "drop"): continue
        if mcfg.get("file"): name = "user"
        if name not in beds: log.append(f"khong co nhac '{name}'"); continue
        if name not in cache:
            y = load_audio(beds[name]); y *= db(-16 + float(mcfg.get("gainDb", -13)) - loud(y)); cache[name] = y
        y = cache[name]; a0, a1 = int(sec["start"] * SR), min(N, int(sec["end"] * SR)); L = a1 - a0
        if L <= 0: continue
        seg = np.tile(y, L // len(y) + 1)[:L] * db(float(sec.get("gainDb", 0)))
        f = min(int(1.2 * SR), L // 3); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
        music[a0:a1] += seg
    # tat / mo nhac em (0.25 s)
    # Trung bình trượt O(N) bằng cumsum (np.convolve cũ là O(N×k): video 1 phút mất vài phút, video 30 phút mất hàng giờ)
    k = int(0.25 * SR); h = k // 2
    cs = np.concatenate(([0.0], np.cumsum(np.pad(gate, (h, k - h)))))
    sm = (cs[k:k + N] - cs[:N]) / k; del cs
    music *= sm

# ---------- hieu ung am thanh
sfx = np.zeros(N); scfg = cfg.get("sfx", {"enabled": True})
lib = {os.path.splitext(os.path.basename(f))[0]: f for f in glob.glob(os.path.join(KIT, "audio", "sfx", "*.wav"))}
def find(name):
    if os.path.exists(os.path.join(P, name)): return os.path.join(P, name), 0.0
    for k, f in lib.items():
        if k == name or k.startswith(name + "_") or k.startswith(name):
            m = re.search(r"hitAt(\d+)ms", k); return f, (int(m.group(1)) / 1000 if m else 0.0)
    return None, 0
cues = [(s["start"] + c.get("at", 0), c) for s in shots for c in s.get("sfx", [])] + [(c["t"], c) for c in story.get("sfx", [])]
if scfg.get("enabled", True):
    cache = {}
    for t, c in cues:
        f, off = find(c["name"])
        if not f: log.append(f"khong co sfx '{c['name']}'"); continue
        if f not in cache: cache[f] = load_audio(f)
        y = cache[f]; t0 = t - off - (0.12 if c["name"].startswith("whoosh") else 0)
        i0 = int(t0 * SR); y = y[max(0, -i0):]; i0 = max(0, i0); L = min(len(y), N - i0)
        if L > 0: sfx[i0:i0 + L] += y[:L] * db(float(c.get("gain", -8)) + float(scfg.get("gainDb", -4)))

mix = voice + music + sfx
lufs = cfg.get("loudness", -14)
cur_lufs = loud(mix)
if cur_lufs > -60:
    mix *= db(lufs - cur_lufs)
pk = np.max(np.abs(mix)) + 1e-9
if pk > 0.92:
    mix = np.tanh(mix / pk * 1.4) / np.tanh(1.4) * 0.92
os.makedirs(os.path.join(P, "build"), exist_ok=True)
out = os.path.join(P, "build", "mix.wav")
save_wav(out, mix)
print("Am thanh:", out, "|", "; ".join(sorted(set(log))) if log else "ok (1-pass fast LUFS)")
video = os.path.join(P, "build", "video_silent.mp4")
if os.path.exists(video) and not a.no_video:
    os.makedirs(os.path.join(P, "out"), exist_ok=True)
    final = os.path.join(P, "out", "video_1080p.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-i", video, "-i", out, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final])
    print("Video hoan chinh:", final)

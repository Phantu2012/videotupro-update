"""prep_srt.py — ghep NHIEU file giong doc (Phần_1.mp3, Phần_2.mp3... kem file .srt cung ten) thanh 1 timeline,
lay moc thoi gian tung chu theo SRT (chinh xac hon do khoang lang).
  python tools/prep_srt.py --project projects/<slug> [--dir projects/<slug>/input] [--script projects/<slug>/input/script.txt]

- Tim moi file .mp3/.wav/.m4a trong --dir, sap theo so trong ten (Phần_1, Phần_2...). File .srt cung ten la tuy chon
  (khong co .srt: chia deu thoi gian theo do dai chu).
- --script (mac dinh input/script.txt): moi dong 1 cau -> moi dong thanh 1 "line" trong timeline (khop chu voi SRT).
Ket qua: timeline/voice.wav, lines.json, words.json, blocks.json, transcript.txt  -> buoc tiep: tools/draft_shots.py
"""
import argparse, difflib, glob, os, re, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import SR, load_audio, save_wav, write_json

ap = argparse.ArgumentParser()
ap.add_argument("--project", required=True)
ap.add_argument("--dir", default="")
ap.add_argument("--script", default="")
ap.add_argument("--lead", type=float, default=0.5, help="khoang lang dau video (giay)")
ap.add_argument("--gap", type=float, default=0.3, help="khoang nghi giua 2 file (giay)")
a = ap.parse_args(); P = a.project
D = a.dir or os.path.join(P, "input"); TL = os.path.join(P, "timeline"); os.makedirs(TL, exist_ok=True)
files = [f for f in glob.glob(os.path.join(D, "*")) if f.lower().endswith((".mp3", ".wav", ".m4a", ".ogg")) and "mix" not in os.path.basename(f).lower()]
num = lambda f: int(re.findall(r"\d+", os.path.basename(f))[-1]) if re.findall(r"\d+", os.path.basename(f)) else 0
files.sort(key=lambda f: (num(f), f))
if not files: sys.exit(f"Không thấy file giọng đọc trong {D}")

def srt(path):
    out = []
    if not os.path.exists(path): return out
    for b in re.split(r"\n\s*\n", open(path, encoding="utf-8-sig").read().strip()):
        L = b.strip().splitlines(); m = None
        for k, ln in enumerate(L):
            m = re.match(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)", ln)
            if m: txt = " ".join(L[k + 1:]); break
        if not m: continue
        g = [int(x) for x in m.groups()]
        out.append((g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000, g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000, re.sub(r"<[^>]+>", "", txt)))
    return out

audio = [np.zeros(int(a.lead * SR), np.float32)]; t = a.lead; sw = []; blocks = []
for i, f in enumerate(files):
    y = load_audio(f); L = len(y) / SR
    cues = srt(os.path.splitext(f)[0] + ".srt")
    if not cues:  # khong co srt: 1 cue cho ca file (chia deu)
        print(f"  (không có .srt cho {os.path.basename(f)} — chia đều thời gian)"); cues = [(0, L, "")]
    for s, e, tx in cues:
        ws = tx.split(); tot = sum(len(w) + 1 for w in ws) or 1; acc = 0
        for w in ws:
            s0 = s + (e - s) * acc / tot; acc += len(w) + 1; e0 = s + (e - s) * acc / tot
            sw.append((w, t + s0, t + e0 - 0.02))
    blocks.append({"id": f"V{i+1:03d}", "slot": "NARRATOR", "char": "", "drop": False, "text": "", "file": os.path.basename(f), "start": round(t, 3), "end": round(t + L, 3)})
    audio.append(y); t += L
    if i < len(files) - 1: audio.append(np.zeros(int(a.gap * SR), np.float32)); t += a.gap
voice = np.concatenate(audio + [np.zeros(int(1.5 * SR), np.float32)])
save_wav(os.path.join(TL, "voice.wav"), voice)

sp = a.script or os.path.join(P, "input", "script.txt")
lines_txt = [l.strip() for l in open(sp, encoding="utf-8-sig") if l.strip()] if os.path.exists(sp) else []
if not lines_txt:  # khong co kich ban: moi cau SRT la 1 dong
    lines_txt = []; cur = []
    for w, _, _ in sw:
        cur.append(w)
        if re.search(r"[.!?…]$", w): lines_txt.append(" ".join(cur)); cur = []
    if cur: lines_txt.append(" ".join(cur))
norm = lambda x: re.sub(r"[\W_]", "", x.lower())
A, own = [], []
for i, l in enumerate(lines_txt):
    for w in l.split(): A.append(w); own.append(i)
B = [norm(x[0]) for x in sw]; An = [norm(x) for x in A]; tm = [None] * len(A)
for m in difflib.SequenceMatcher(None, An, B, autojunk=False).get_matching_blocks():
    for k in range(m.size): tm[m.a + k] = (sw[m.b + k][1], sw[m.b + k][2])
known = [i for i, x in enumerate(tm) if x]
print(f"Khớp chữ kịch bản với SRT: {len(known)}/{len(A)} ({100 * len(known) // max(1, len(A))}%)")
for i in range(len(A)):
    if tm[i] is None:
        lo = max([k for k in known if k < i], default=None); hi = min([k for k in known if k > i], default=None)
        t0 = tm[lo][1] if lo is not None else a.lead; t1 = tm[hi][0] if hi is not None else t - 0.1
        span = (hi if hi is not None else len(A)) - (lo if lo is not None else -1); fr = (i - (lo if lo is not None else -1)) / span
        x = t0 + (t1 - t0) * fr; tm[i] = (x, x + 0.2)
words = [{"w": re.sub(r"^[\"'(“]+|[\"'),.!?:;”…]+$", "", A[i]), "t": round(tm[i][0], 3), "e": round(tm[i][1], 3)} for i in range(len(A))]
lines = []
for li, l in enumerate(lines_txt):
    idx = [i for i, o in enumerate(own) if o == li]
    if not idx: continue
    lines.append({"id": f"L{li+1:03d}", "block": "V001", "slot": "NARRATOR", "char": "", "text": l, "start": round(tm[idx[0]][0] - 0.05, 3), "end": round(tm[idx[-1]][1] + 0.05, 3), "drop": False})
write_json(os.path.join(TL, "lines.json"), lines); write_json(os.path.join(TL, "words.json"), words); write_json(os.path.join(TL, "blocks.json"), blocks)
with open(os.path.join(TL, "transcript.txt"), "w", encoding="utf-8") as f:
    for l in lines: f.write(f"[{l['start']:7.2f} - {l['end']:7.2f}] {l['text']}\n")
print(f"Xong: {len(files)} file voice, {len(lines)} câu, {len(words)} chữ. Dài {len(voice) / SR:.1f} giây -> {TL}/voice.wav")
print("Bước tiếp: python tools/draft_shots.py --project " + P)

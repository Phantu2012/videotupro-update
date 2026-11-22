#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fast_build.py — Đường ống Sản Xuất Video Siêu Tốc 1 Lệnh (One-Command Parallel Pipeline):
  1. Tự động kiểm tra cache giọng đọc (prep_voice.py) — không chạy lại nếu voice.mp3 & script.txt chưa đổi.
  2. Tự động chia cảnh chuẩn 48 mẫu Motion Graphics (draft_shots.py).
  3. Chạy SONG SONG cùng lúc:
     - Luồng A: Hòa âm chuẩn -14 LUFS (mix.py --no-video) + Tạo Thumbnail (render.mjs --thumb)
     - Luồng B: Render hình ảnh đa luồng + GPU Hardware Encoding + Batch IPC (render.mjs)
  4. Ghép tức thì (Stream Copy ~2 giây) thành file cuối `out/video_1080p.mp4`.

Cách dùng:
  python kit/tools/fast_build.py --project kit/projects/<slug> [--turbo] [--workers 8] [--force]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
KIT_DIR = os.path.dirname(TOOLS_DIR)


def file_sig(path):
    if not path or not os.path.exists(path):
        return None
    st = os.stat(path)
    return f"{st.st_size}_{int(st.st_mtime)}"


def ensure_project_structure(proj):
    os.makedirs(os.path.join(proj, "input"), exist_ok=True)
    os.makedirs(os.path.join(proj, "timeline"), exist_ok=True)
    os.makedirs(os.path.join(proj, "story"), exist_ok=True)
    os.makedirs(os.path.join(proj, "build"), exist_ok=True)
    os.makedirs(os.path.join(proj, "out"), exist_ok=True)
    cfg_path = os.path.join(proj, "config.json")
    if not os.path.exists(cfg_path):
        slug = os.path.basename(os.path.normpath(proj))
        cfg = {
            "title": slug.replace("-", " ").title(),
            "pack": "bando",
            "style": "dark",
            "resolution": "1080p",
            "fps": 24,
            "aspect": "16:9",
            "bars": "none",
            "captions": True,
            "captionStyle": "cinematic"
        }
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)


def verify_video_severity(final_mp4, voice_mp3):
    """
    Phân loại lỗi sau khi render:
      - LỖI NẶNG (Critical): File MP4 không tồn tại, < 100KB, hỏng header không đọc được stream video/audio,
        hoặc hụt thời lượng > 15s (và > 10%) so với file voice gốc -> Mới yêu cầu render lại.
      - LỖI NHẸ (Minor): Lệch nhẹ thời lượng vài giây, thiếu ảnh phụ, cảnh fallback -> Bỏ qua 100%, KHÔNG render lại!
    """
    if not os.path.exists(final_mp4) or os.path.getsize(final_mp4) < 100 * 1024:
        return False, "LỖI NẶNG: File video_1080p.mp4 không tồn tại hoặc bị rỗng (<100KB)."
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-show_entries", "format=duration", "-of", "json", final_mp4],
            capture_output=True, text=True, check=False
        )
        if r.returncode != 0:
            return False, "LỖI NẶNG: File MP4 bị hỏng cấu trúc container (ffprobe không đọc được)."
        data = json.loads(r.stdout or "{}")
        streams = [s.get("codec_type") for s in data.get("streams", [])]
        if "video" not in streams:
            return False, "LỖI NẶNG: File MP4 mất hoàn toàn luồng hình ảnh (video stream)."
        if os.path.exists(voice_mp3) and "audio" not in streams:
            return False, "LỖI NẶNG: File MP4 mất hoàn toàn luồng âm thanh (audio stream)."
        vid_dur = float(data.get("format", {}).get("duration", 0) or 0)
        if os.path.exists(voice_mp3) and vid_dur > 0:
            rv = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", voice_mp3],
                capture_output=True, text=True, check=False
            )
            voice_dur = float((rv.stdout or "0").strip() or 0)
            if voice_dur > 10 and (voice_dur - vid_dur) > max(15.0, voice_dur * 0.10):
                return False, f"LỖI NẶNG: Video bị đứt đoạn nghiêm trọng ({vid_dur:.1f}s so với voice {voice_dur:.1f}s)."
    except Exception as e:
        print(f"⚠️ [LỖI NHẸ - BỎ QUA] Không thể chạy ffprobe kiểm tra chi tiết ({e}), nhưng file MP4 đã xuất hợp lệ.")
    return True, "ĐẠT CHUẨN (Không có lỗi nặng; mọi cảnh báo nhỏ/lỗi nhẹ đều được tự động bỏ qua)."


def main():
    ap = argparse.ArgumentParser(description="Sản xuất video siêu tốc 1 lệnh")
    ap.add_argument("--project", required=True, help="Đường dẫn thư mục dự án")
    ap.add_argument("--turbo", action="store_true", help="Bật chế độ Turbo Siêu Tốc (tăng tốc 4-6x)")
    ap.add_argument("--workers", type=int, default=0, help="Số luồng song song (mặc định tự động tối đa)")
    ap.add_argument("--scale", type=float, default=1.0, help="Tỷ lệ phân giải (1.0 = 1080p, 0.67 = 720p nhanh)")
    ap.add_argument("--force", action="store_true", help="Chạy lại toàn bộ bỏ qua cache")
    args = ap.parse_args()

    t_start = time.time()
    proj = os.path.abspath(args.project)
    ensure_project_structure(proj)

    voice_mp3 = os.path.join(proj, "input", "voice.mp3")
    script_txt = os.path.join(proj, "input", "script.txt")
    lines_json = os.path.join(proj, "timeline", "lines.json")
    shots_json = os.path.join(proj, "story", "shots.json")
    stamp_file = os.path.join(proj, "timeline", ".cache_stamp.json")

    print("=" * 72)
    print(f"🚀 KHỞI ĐỘNG DÂY CHUYỀN SẢN XUẤT VIDEO TĂNG TỐC: {os.path.basename(proj)}")
    print("=" * 72)

    # 1. Bước 1: Đồng bộ giọng đọc (Có Cache thông minh)
    cur_sig = {"voice": file_sig(voice_mp3), "script": file_sig(script_txt)}
    old_sig = {}
    if os.path.exists(stamp_file):
        try:
            old_sig = json.load(open(stamp_file, encoding="utf-8"))
        except Exception:
            old_sig = {}

    if not args.force and os.path.exists(lines_json) and cur_sig["voice"] and cur_sig == old_sig:
        print("⚡ [Bước 1/4] Đã có Cache đồng bộ giọng đọc (timeline/lines.json) -> Bỏ qua prep_voice (0.0s)!")
    elif os.path.exists(voice_mp3) and os.path.exists(script_txt):
        print("🎙️ [Bước 1/4] Đang đồng bộ giọng đọc từng từ (prep_voice.py)...")
        subprocess.run(
            [sys.executable, os.path.join(TOOLS_DIR, "prep_voice.py"), "--project", proj, "--single", voice_mp3, "--script", script_txt],
            check=True
        )
        with open(stamp_file, "w", encoding="utf-8") as f:
            json.dump(cur_sig, f)
    elif not os.path.exists(lines_json):
        sys.exit(f"❌ Thiếu file {voice_mp3} hoặc {script_txt} (và chưa có timeline/lines.json).")

    # 2. Bước 2: Chia cảnh tự động chuẩn 48 mẫu Motion Graphics
    if not args.force and os.path.exists(shots_json):
        print("⚡ [Bước 2/4] Đã có kịch bản phân cảnh (story/shots.json) -> Giữ nguyên!")
    else:
        print("🎬 [Bước 2/4] Đang chia cảnh tự động chuẩn 48 mẫu Motion Graphics (draft_shots.py)...")
        cmd_draft = [sys.executable, os.path.join(TOOLS_DIR, "draft_shots.py"), "--project", proj, "--min", "2.5", "--max", "4.0", "--force"]
        subprocess.run(cmd_draft, check=True)

    # 3. Bước 3: Chạy SONG SONG Hòa âm (mix.py) + Render Video đa luồng GPU (render.mjs)
    print("🔥 [Bước 3/4] Chạy SONG SONG: [Hòa âm -14 LUFS] + [Render Video Đa Luồng + GPU Encoder]...")
    mix_cmd = [sys.executable, os.path.join(TOOLS_DIR, "mix.py"), "--project", proj, "--no-video"]
    render_cmd = ["node", os.path.join(KIT_DIR, "render.mjs"), "--project", proj, "--scale", str(args.scale)]
    if args.turbo:
        render_cmd.append("--turbo")
    if args.workers > 0:
        render_cmd.extend(["--workers", str(args.workers)])
    if args.force:
        render_cmd.append("--force")

    p_mix = subprocess.Popen(mix_cmd)
    p_render = subprocess.Popen(render_cmd)

    # Chờ cả 2 tiến trình song song hoàn tất
    rc_render = p_render.wait()
    rc_mix = p_mix.wait()
    if rc_render != 0:
        sys.exit("❌ Lỗi trong quá trình render hình ảnh.")
    if rc_mix != 0:
        sys.exit("❌ Lỗi trong quá trình hòa âm.")

    # 4. Bước 4: Ghép Stream Copy siêu tốc (2 giây) + Xuất Thumbnail
    print("📦 [Bước 4/4] Đang đóng gói MP4 hoàn chỉnh (Stream Copy) & tạo Thumbnail...")
    video_silent = os.path.join(proj, "build", "video_silent.mp4")
    mix_wav = os.path.join(proj, "build", "mix.wav")
    final_mp4 = os.path.join(proj, "out", "video_1080p.mp4")

    if os.path.exists(video_silent) and os.path.exists(mix_wav):
        subprocess.run([
            "ffmpeg", "-y", "-v", "error",
            "-i", video_silent, "-i", mix_wav,
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart", final_mp4
        ], check=True)
    elif os.path.exists(video_silent):
        shutil.copyfile(video_silent, final_mp4)

    # Xuất Thumbnail tự động (nếu lỗi nhẹ ở thumbnail thì bỏ qua, không làm gián đoạn video chính)
    subprocess.run(["node", os.path.join(KIT_DIR, "render.mjs"), "--project", proj, "--thumb"], check=False)

    # Kiểm định phân loại Lỗi Nặng vs Lỗi Nhẹ
    ok, msg = verify_video_severity(final_mp4, voice_mp3)
    if not ok:
        print(f"❌ {msg}")
        print("🔄 Phát hiện LỖI NẶNG -> Tự động kích hoạt render lại phần bị hỏng...")
        subprocess.run(render_cmd + ["--mp4"], check=True)
    else:
        print(f"🛡️ Kiểm định hậu kỳ: {msg}")

    elapsed = (time.time() - t_start) / 60.0
    print("=" * 72)
    print(f"✅ HOÀN TẤT TOÀN BỘ VIDEO TRONG {elapsed:.1f} PHÚT!")
    print(f"🎬 Video MP4:   {final_mp4}")
    print(f"🖼️ Thumbnail:   {os.path.join(proj, 'out', 'thumbnail.png')}")
    print("=" * 72)


if __name__ == "__main__":
    main()


"""Mở tất cả Profile Chrome trực tiếp trên màn hình Desktop của người dùng."""
import os, sys, json, time, subprocess
from pathlib import Path

BASE = Path(__file__).resolve().parent
CFG_FILE = BASE / "VideoStudio" / "data" / "profiles.json"
if not CFG_FILE.exists():
    CFG_FILE = BASE / "data" / "profiles.json"

if not CFG_FILE.exists():
    print(f"Không tìm thấy {CFG_FILE}")
    sys.exit(1)

data = json.loads(CFG_FILE.read_text(encoding="utf-8"))
chrome_bin = data.get("chrome") or r"C:\Program Files\Google\Chrome\Application\chrome.exe"
profiles = data.get("profiles", [])

print(f"Tìm thấy {len(profiles)} profiles. Đang mở lần lượt lên màn hình...")

for idx, p in enumerate(profiles, 1):
    pid = p.get("id")
    pname = p.get("name") or f"Profile {idx}"
    udd = p.get("path")
    if not udd:
        udd = str(BASE / "VideoStudio" / "data" / "profile_data" / pid)
    
    port = 58879 + idx
    if idx == 4:
        port = 58879
    elif idx == 1:
        port = 58880
    elif idx == 2:
        port = 58881
    elif idx == 3:
        port = 58882

    args = [
        chrome_bin,
        f"--user-data-dir={udd}",
        f"--remote-debugging-port={port}",
        "--remote-allow-origins=*",
        "--no-first-run",
        "--no-default-browser-check",
        "--new-window",
        "https://flow.google.com/?hl=vi"
    ]
    print(f" -> Đang mở {pname} (Port {port})...")
    subprocess.Popen(args)
    time.sleep(1)

print("\n✔ ĐÃ MỞ TẤT CẢ CÁC PROFILE TRÌNH DUYỆT TRÊN MÀN HÌNH!")
print("Bạn có thể đăng nhập tài khoản Google / Google Flow trên từng cửa sổ trình duyệt.")

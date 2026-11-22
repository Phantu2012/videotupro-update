"""Mở tất cả Profile Chrome vào thẳng trang Google Flow trên màn hình Desktop của người dùng."""
import os, sys, json, time, subprocess, shutil
from pathlib import Path

BASE = Path(__file__).resolve().parent
CFG_FILE = BASE / "data" / "profiles.json"

if not CFG_FILE.exists():
    print(f"Không tìm thấy {CFG_FILE}")
    sys.exit(1)

def find_chrome():
    candidates = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return shutil.which("google-chrome") or shutil.which("chromium") or "chrome.exe"

data = json.loads(CFG_FILE.read_text(encoding="utf-8"))
chrome_bin = data.get("chrome") or find_chrome()
profiles = data.get("profiles", [])

print(f"Tìm thấy {len(profiles)} profiles. Đang mở lần lượt vào trang Google Flow...")

for idx, p in enumerate(profiles, 1):
    pid = p.get("id") or f"profile_{idx}"
    pname = p.get("name") or f"Profile {idx}"
    udd = p.get("path")
    if not udd or not os.path.exists(udd):
        udd = str(BASE / "data" / "profile_data" / pid)
    
    port = 58879 + (idx - 1)

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
    print(f" -> Đang mở {pname} (Port {port}) vào Google Flow...")
    subprocess.Popen(args)
    time.sleep(1)

print("\n✔ ĐÃ MỞ TẤT CẢ CÁC CỬA SỔ PROFILE VÀO TRANG GOOGLE FLOW!")
print("👉 Hãy kiểm tra các cửa sổ Chrome: đăng nhập tài khoản Google để sử dụng tạo video.")


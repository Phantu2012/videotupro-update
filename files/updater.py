"""VideoTuPro — TRÌNH TỰ CẬP NHẬT (chạy mỗi lần mở tool, trước khi khởi động máy chủ).

• Tải bản kê (manifest) từ kênh phát hành, KIỂM TRA CHỮ KÝ SỐ của chủ sở hữu → chỉ cài bản thật do chủ sở hữu phát hành
  (kẻ gian giả mạo/sửa file trên đường truyền sẽ bị từ chối).
• Chỉ tải những file thay đổi, kiểm tra mã băm từng file, sao lưu bản cũ rồi mới thay → mất mạng giữa chừng không hỏng tool.
• Không có mạng: bỏ qua, tool vẫn chạy bản hiện tại.

Dùng:  python updater.py --startup            (gọi từ 1_Bat_Dau_Chay_Videotupro.bat)
       python updater.py --check              (in trạng thái JSON)
       python updater.py --apply-and-restart  (tool gọi khi bấm "Cập nhật ngay")
       python updater.py --rollback           (quay về bản trước)
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

REPO = "Phantu2012/videotupro-update"
BRANCH = "main"
BASE_URL = f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/"
PUBLIC_KEY_HEX = "e6549334516a699a22a4c5b67debb85dee3154e2583638296cec03fef721cdbc"
PORT = 8765

ROOT = Path(__file__).resolve().parent
VERSION_FILE = ROOT / "version.json"
TMP = ROOT / ".update_tmp"
BAK = ROOT / ".update_backup"
PROTECT = ("data/", "storage/", ".update_tmp/", ".update_backup/")  # không bao giờ đụng dữ liệu người dùng

# ------------------------------------------------------------------ Ed25519 verify (RFC 8032)
_P = 2 ** 255 - 19
_L = 2 ** 252 + 27742317777372353535851937790883648493


def _inv(x):
    return pow(x, _P - 2, _P)


_D = -121665 * _inv(121666) % _P
_I = pow(2, (_P - 1) // 4, _P)


def _xr(y):
    xx = (y * y - 1) * _inv(_D * y * y + 1)
    x = pow(xx, (_P + 3) // 8, _P)
    if (x * x - xx) % _P:
        x = x * _I % _P
    return _P - x if x % 2 else x


_BY = 4 * _inv(5) % _P
_BX = _xr(_BY)
_B = (_BX, _BY, 1, _BX * _BY % _P)


def _add(a, b):
    x1, y1, z1, t1 = a
    x2, y2, z2, t2 = b
    A = (y1 - x1) * (y2 - x2) % _P
    Bv = (y1 + x1) * (y2 + x2) % _P
    C = 2 * t1 * t2 * _D % _P
    Dv = 2 * z1 * z2 % _P
    E, F, G, H = Bv - A, Dv - C, Dv + C, Bv + A
    return (E * F % _P, G * H % _P, F * G % _P, E * H % _P)


def _mul(s, p):
    q = (0, 1, 1, 0)
    while s:
        if s & 1:
            q = _add(q, p)
        p = _add(p, p)
        s >>= 1
    return q


def _dec(s):
    y = int.from_bytes(s, "little")
    sign = y >> 255
    y &= (1 << 255) - 1
    x = _xr(y)
    if (x & 1) != sign:
        x = _P - x
    if (-x * x + y * y - 1 - _D * x * x * y * y) % _P:
        raise ValueError
    return (x, y, 1, x * y % _P)


def verify(pk: bytes, msg: bytes, sig: bytes) -> bool:
    try:
        A, R = _dec(pk), _dec(sig[:32])
        s = int.from_bytes(sig[32:], "little")
        if s >= _L:
            return False
        h = int.from_bytes(hashlib.sha512(sig[:32] + pk + msg).digest(), "little") % _L
        p1, p2 = _mul(s, _B), _add(R, _mul(h, A))
        return (p1[0] * p2[2] - p2[0] * p1[2]) % _P == 0 and (p1[1] * p2[2] - p2[1] * p1[2]) % _P == 0
    except Exception:
        return False


# ------------------------------------------------------------------ tiện ích
def say(msg: str) -> None:
    try:
        print(msg, flush=True)
    except Exception:
        pass


def is_owner_source_copy() -> bool:
    """Bản gốc của chủ sở hữu (còn mã nguồn app/) KHÔNG được tự cập nhật đè lên."""
    return (ROOT / "app").is_dir() or (ROOT / "_ADMIN_KHONG_GIAO").exists()


def local_version() -> dict:
    try:
        return json.loads(VERSION_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"version": "0"}


def fetch(url: str, timeout: float = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "VideoTuPro-Updater", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def remote_manifest() -> dict:
    bust = f"?t={int(time.time())}"
    raw = fetch(BASE_URL + "manifest.json" + bust)
    sig = bytes.fromhex(fetch(BASE_URL + "manifest.sig" + bust).decode().strip())
    if not verify(bytes.fromhex(PUBLIC_KEY_HEX), raw, sig):
        raise RuntimeError("Chữ ký bản cập nhật KHÔNG hợp lệ — từ chối cài (có thể bị giả mạo).")
    return json.loads(raw.decode("utf-8"))


def _vkey(v: str) -> tuple:
    return tuple(int(x) if x.isdigit() else 0 for x in str(v).split("."))


def check() -> dict:
    cur = local_version()
    st = {"current": cur.get("version", "0"), "latest": None, "available": False, "notes": "", "error": ""}
    if is_owner_source_copy():
        st["error"] = "Bản gốc của chủ sở hữu — không tự cập nhật."
        return st
    try:
        m = remote_manifest()
        st.update(latest=m["version"], notes=m.get("notes", ""),
                  available=_vkey(m["version"]) > _vkey(st["current"]))
    except Exception as e:  # noqa: BLE001
        st["error"] = str(e)[:200]
    return st


def _safe_rel(rel: str) -> bool:
    p = Path(rel)
    return not p.is_absolute() and ".." not in p.parts and not rel.replace("\\", "/").startswith(PROTECT)


def apply_update(m: dict | None = None) -> bool:
    if is_owner_source_copy():
        return False
    m = m or remote_manifest()
    cur = local_version()
    if _vkey(m["version"]) <= _vkey(cur.get("version", "0")):
        say(f"✔ Đang dùng bản mới nhất ({cur.get('version')}).")
        return False
    say(f"🚀 Có bản mới {m['version']} (đang dùng {cur.get('version')}). {m.get('notes', '')}")
    files: dict = m.get("files", {})
    todo = [rel for rel, info in files.items()
            if _safe_rel(rel) and (not (ROOT / rel).exists() or sha256_file(ROOT / rel) != info["sha256"])]
    shutil.rmtree(TMP, ignore_errors=True)
    TMP.mkdir(parents=True, exist_ok=True)
    total = sum(files[r]["size"] for r in todo) or 1
    done = 0
    for i, rel in enumerate(todo, 1):
        info = files[rel]
        url = BASE_URL + "files/" + rel.replace("\\", "/") + f"?v={info['sha256'][:16]}"
        data = None
        for attempt in range(3):
            try:
                data = fetch(url, timeout=120)
                if hashlib.sha256(data).hexdigest() == info["sha256"]:
                    break
                data = None
            except Exception:
                data = None
            time.sleep(2 + attempt * 3)
        if data is None:
            shutil.rmtree(TMP, ignore_errors=True)
            raise RuntimeError(f"Tải lỗi hoặc sai mã băm: {rel} — giữ nguyên bản cũ, sẽ thử lại lần sau.")
        out = TMP / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        done += info["size"]
        say(f"   [{done * 100 // total:3d}%] {rel}")

    # Đã tải đủ & đúng → sao lưu bản cũ rồi thay
    bdir = BAK / str(cur.get("version", "0"))
    shutil.rmtree(BAK, ignore_errors=True)  # chỉ giữ 1 bản sao lưu gần nhất
    req_before = sha256_file(ROOT / "requirements.txt") if (ROOT / "requirements.txt").exists() else ""
    pkg_before = sha256_file(ROOT / "engines/bando/package.json") if (ROOT / "engines/bando/package.json").exists() else ""
    for rel in todo:
        dst = ROOT / rel
        if dst.exists():
            (bdir / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dst, bdir / rel)
        dst.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(10):  # Windows: file có thể đang bị khóa trong tích tắc
            try:
                os.replace(TMP / rel, dst)
                break
            except PermissionError:
                time.sleep(1)
        else:
            raise RuntimeError(f"Không thay được {rel} (file đang mở?). Hãy tắt tool rồi mở lại.")
    for rel in m.get("delete", []):
        p = ROOT / rel
        if _safe_rel(rel) and p.is_file():
            (bdir / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(p), str(bdir / rel))
    (bdir).mkdir(parents=True, exist_ok=True)
    if VERSION_FILE.exists():
        shutil.copy2(VERSION_FILE, bdir / "version.json")
    VERSION_FILE.write_text(json.dumps({"version": m["version"], "notes": m.get("notes", ""),
                                        "date": m.get("date", "")}, ensure_ascii=False), encoding="utf-8")
    shutil.rmtree(TMP, ignore_errors=True)

    # Thư viện thay đổi → cài bổ sung
    if (ROOT / "requirements.txt").exists() and sha256_file(ROOT / "requirements.txt") != req_before:
        say("   Cài thư viện Python mới…")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", str(ROOT / "requirements.txt")])
    pj = ROOT / "engines/bando/package.json"
    if pj.exists() and sha256_file(pj) != pkg_before and (ROOT / "engines/bando/node_modules").exists():
        say("   Cài thư viện Bản Đồ Động mới…")
        subprocess.run("npm install --no-audit --no-fund", cwd=str(pj.parent), shell=True)
    say(f"✔ Đã cập nhật lên bản {m['version']} ({len(todo)} file).")
    return True


def rollback() -> None:
    dirs = [d for d in BAK.iterdir() if d.is_dir()] if BAK.exists() else []
    if not dirs:
        say("Không có bản sao lưu để quay lại.")
        return
    b = dirs[0]
    for p in b.rglob("*"):
        if p.is_file():
            dst = ROOT / p.relative_to(b)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, dst)
    say(f"✔ Đã quay về bản {b.name}.")


def _port_busy(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def main() -> None:
    arg = sys.argv[1] if len(sys.argv) > 1 else "--startup"
    if arg == "--check":
        print(json.dumps(check(), ensure_ascii=False))
        return
    if arg == "--rollback":
        rollback()
        return
    if is_owner_source_copy():
        return
    if arg == "--apply-and-restart":
        for _ in range(60):  # chờ máy chủ cũ tắt hẳn
            if not _port_busy(PORT):
                break
            time.sleep(1)
        time.sleep(1.5)
    try:
        say("Đang kiểm tra bản cập nhật…")
        apply_update()
    except Exception as e:  # noqa: BLE001
        say(f"⚠ Bỏ qua cập nhật: {str(e)[:200]}")
    if arg == "--apply-and-restart":
        bat = ROOT / "1_Bat_Dau_Chay_Videotupro.bat"
        if os.name == "nt" and bat.exists():
            os.startfile(str(bat))  # type: ignore[attr-defined]


if __name__ == "__main__":
    main()

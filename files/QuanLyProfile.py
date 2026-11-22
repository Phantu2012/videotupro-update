# -*- coding: utf-8 -*-
"""
Quản Lý Profile - mỗi kênh một profile Chrome riêng + một proxy riêng.
Chỉ dùng thư viện có sẵn của Python. Chạy: python QuanLyProfile.py
Proxy hỗ trợ: ip:port | ip:port:user:pass | user:pass@ip:port | socks5://user:pass@ip:port
Tự động đồng bộ với VideoStudio và cấp Remote Debugging Port (CDP).
"""
import json, os, sys, socket, socketserver, threading, select, subprocess
import base64, uuid, shutil, ssl, time, urllib.request
from urllib.parse import urlsplit
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

if getattr(sys, "frozen", False):  # đang chạy dạng .exe
    BASE = os.path.dirname(sys.executable)
else:
    BASE = os.path.dirname(os.path.abspath(__file__))

# Ưu tiên đồng bộ với thư mục data của VideoStudio nếu có
CANDIDATE_DATA = os.path.join(BASE, "data", "profiles.json")
if not os.path.exists(CANDIDATE_DATA):
    cand2 = os.path.join(BASE, "VideoStudio", "data", "profiles.json")
    if os.path.exists(cand2):
        CANDIDATE_DATA = cand2

if os.path.exists(os.path.dirname(CANDIDATE_DATA)):
    DATA = CANDIDATE_DATA
    PDIR = os.path.join(os.path.dirname(CANDIDATE_DATA), "profile_data")
else:
    DATA = os.path.join(BASE, "profiles.json")
    PDIR = os.path.join(BASE, "profile_data")

os.makedirs(PDIR, exist_ok=True)


# ---------------- Proxy ----------------
def parse_proxy(s):
    s = (s or "").strip()
    if not s:
        return None
    scheme = "http"
    explicit = "://" in s
    if "://" in s:
        scheme, s = s.split("://", 1)
        scheme = scheme.lower()
    scheme = "socks5" if scheme.startswith("socks5") else "http"
    user = pw = ""
    if "@" in s:
        cred, hp = s.rsplit("@", 1)
        user, pw = cred.split(":", 1)
        host, port = hp.rsplit(":", 1)
    else:
        p = s.split(":")
        if len(p) == 2:
            host, port = p
        elif len(p) == 4:
            host, port, user, pw = p
        else:
            raise ValueError("Proxy sai định dạng")
    return dict(scheme=scheme, host=host, port=int(port), user=user, pw=pw, explicit=explicit)


def recv_exact(s, n):
    b = b""
    while len(b) < n:
        d = s.recv(n - len(b))
        if not d:
            raise IOError("socks closed")
        b += d
    return b


def upstream_connect(cfg, host, port):
    s = socket.create_connection((cfg["host"], cfg["port"]), timeout=12)
    if cfg["scheme"] == "socks5":
        auth = bool(cfg["user"])
        s.sendall(b"\x05\x02\x00\x02" if auth else b"\x05\x01\x00")
        r = recv_exact(s, 2)
        if r[1] == 2:
            u, p = cfg["user"].encode(), cfg["pw"].encode()
            s.sendall(b"\x01" + bytes([len(u)]) + u + bytes([len(p)]) + p)
            if recv_exact(s, 2)[1] != 0:
                raise IOError("Sai user/pass proxy")
        elif r[1] != 0:
            raise IOError("Proxy không hỗ trợ phương thức đăng nhập")
        h = host.encode()
        s.sendall(b"\x05\x01\x00\x03" + bytes([len(h)]) + h + port.to_bytes(2, "big"))
        hd = recv_exact(s, 4)
        if hd[1] != 0:
            raise IOError("SOCKS5 từ chối kết nối")
        if hd[3] == 1:
            recv_exact(s, 6)
        elif hd[3] == 3:
            recv_exact(s, recv_exact(s, 1)[0] + 2)
        else:
            recv_exact(s, 18)
    else:
        req = f"CONNECT {host}:{port} HTTP/1.1\r\nHost: {host}:{port}\r\n"
        if cfg["user"]:
            tok = base64.b64encode(f'{cfg["user"]}:{cfg["pw"]}'.encode()).decode()
            req += f"Proxy-Authorization: Basic {tok}\r\n"
        s.sendall((req + "\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            d = s.recv(4096)
            if not d:
                raise IOError("Proxy đóng kết nối")
            buf += d
        if int(buf.split()[1]) != 200:
            first = buf.split(b"\r\n")[0].decode(errors="ignore")
            body = buf.partition(b"\r\n\r\n")[2]
            try:
                s.settimeout(3)
                body += s.recv(400)
            except Exception:
                pass
            txt = " ".join(body.decode("utf-8", "ignore").split())[:200]
            s.close()
            raise IOError("Proxy từ chối: " + first + ((" | nội dung: " + txt) if txt else ""))
    s.settimeout(None)
    return s


def pipe(a, b):
    try:
        while True:
            r, _, x = select.select([a, b], [], [a, b], 300)
            if x or not r:
                return
            for s in r:
                d = s.recv(65536)
                if not d:
                    return
                (b if s is a else a).sendall(d)
    except Exception:
        pass
    finally:
        for s in (a, b):
            try:
                s.close()
            except Exception:
                pass


def make_handler(cfg):
    class H(socketserver.BaseRequestHandler):
        def handle(self):
            c = self.request
            up = None
            try:
                buf = b""
                while b"\r\n\r\n" not in buf:
                    d = c.recv(65536)
                    if not d or len(buf) > 262144:
                        return
                    buf += d
                head, _, rest = buf.partition(b"\r\n\r\n")
                lines = head.split(b"\r\n")
                method, target, ver = lines[0].decode("latin1").split(" ", 2)
                if method.upper() == "CONNECT":
                    host, port = target.rsplit(":", 1)
                    up = upstream_connect(cfg, host, int(port))
                    c.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                    if rest:
                        up.sendall(rest)
                else:
                    u = urlsplit(target)
                    path = (u.path or "/") + ("?" + u.query if u.query else "")
                    up = upstream_connect(cfg, u.hostname, u.port or 80)
                    lines[0] = f"{method} {path} {ver}".encode("latin1")
                    lines = [l for l in lines if not l.lower().startswith(b"proxy-")]
                    up.sendall(b"\r\n".join(lines) + b"\r\n\r\n" + rest)
                pipe(c, up)
            except Exception as e:
                log_err(cfg, e)
                try:
                    c.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                except Exception:
                    pass
                try:
                    c.close()
                except Exception:
                    pass
    return H


class Srv(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


def start_forwarder(cfg):
    srv = Srv(("127.0.0.1", 0), make_handler(cfg))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def log_err(cfg, e):
    try:
        with open(os.path.join(BASE, "loi_proxy.log"), "a", encoding="utf-8") as f:
            f.write(f'{time.strftime("%H:%M:%S")} {cfg["scheme"]}://{cfg["host"]}:{cfg["port"]} -> {e}\n')
    except Exception:
        pass


def friendly(e):
    m = str(e)
    if "407" in m:
        return "Proxy yêu cầu đăng nhập: SAI user/pass (hoặc proxy cần đăng nhập mà bạn chưa nhập)."
    if "403" in m:
        return ("Proxy từ chối (403). Nhiều proxy chỉ cho IP đã đăng ký: hãy vào trang nhà cung cấp "
                "proxy, thêm IP mạng nhà bạn vào danh sách cho phép (whitelist), rồi thử lại.")
    if "502" in m or "504" in m or "503" in m:
        return ("Proxy có phản hồi nhưng KHÔNG ra được internet (lỗi 502/503/504). Thường do: proxy hết hạn "
                "hoặc đã đổi IP/port, đường truyền của proxy đang tắt, hoặc proxy chưa cho phép IP máy bạn "
                "(cần whitelist). Hãy xem trang quản lý của nhà cung cấp proxy, hoặc thử đúng proxy này. Chi tiết: " + m)
    if "SOCKS5" in m or "socks" in m.lower():
        return "Proxy SOCKS5 từ chối: " + m
    if "Sai user" in m:
        return "Sai user/pass của proxy."
    if "timed out" in m or "refused" in m or "getaddrinfo" in m or "WinError" in m or "10060" in m or "10061" in m:
        return ("Không kết nối được tới proxy. Kiểm tra lại IP:port, proxy có thể đã hết hạn/hỏng, "
                "hoặc máy bạn chưa được phép dùng proxy này. Chi tiết: " + m)
    return m


def fetch_ip_via(c):
    try:
        return _fetch_ip(c)
    except Exception as e1:
        try:
            upstream_connect(c, "www.youtube.com", 443).close()
            return "(không lấy được IP, nhưng vào được YouTube)"
        except Exception:
            raise e1


def _fetch_ip(c):
    s = upstream_connect(c, "api.ipify.org", 443)
    ss = ssl.create_default_context().wrap_socket(s, server_hostname="api.ipify.org")
    ss.settimeout(15)
    ss.sendall(b"GET / HTTP/1.0\r\nHost: api.ipify.org\r\n\r\n")
    data = b""
    while True:
        d = ss.recv(4096)
        if not d:
            break
        data += d
    ss.close()
    return data.split(b"\r\n\r\n", 1)[1].decode().strip()


def geo_via(c):
    try:
        s = upstream_connect(c, "ip-api.com", 80)
        s.settimeout(10)
        s.sendall(b"GET /json/?fields=status,country,countryCode,timezone HTTP/1.0\r\nHost: ip-api.com\r\n\r\n")
        data = b""
        while True:
            d = s.recv(4096)
            if not d:
                break
            data += d
        s.close()
        j = json.loads(data.split(b"\r\n\r\n", 1)[1].decode())
        return j if j.get("status") == "success" else {}
    except Exception:
        return {}


def detect_proxy(c):
    cands = [c]
    if not c.get("explicit"):
        cands.append(dict(c, scheme="socks5" if c["scheme"] == "http" else "http"))
    first = None
    for cc in cands:
        try:
            return cc, fetch_ip_via(cc)
        except Exception as e:
            first = first or e
            log_err(cc, e)
    raise first


# ---------------- Chrome ----------------
def find_chrome():
    cands = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%APPDATA%\fastst-launcher\runtime\ShardX-Windows\chrome.exe"),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    ]
    for c in cands:
        if c and os.path.exists(c):
            return c
    return shutil.which("google-chrome") or shutil.which("chromium")


def is_port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            return True
    except Exception:
        return False


def allocate_cdp_port(start=58879):
    p = start
    while is_port_open(p):
        p += 1
    return p


# ---------------- Ứng dụng ----------------
NAVY, BLUE, ORANGE = "#1f2a3c", "#2b8cf0", "#f59e0b"
GREEN, RED, GRAY = "#22a559", "#e03131", "#6b7280"
BG, SEL, LINE = "#f3f4f6", "#e6f0fb", "#e5e7eb"
COLS = [(260, "Tên profile"), (130, "Thao tác"), (330, "Proxy"), (150, "Trạng thái (CDP)")]
FONT = ("Segoe UI", 10)


def btn(parent, text, cmd, bg, fg="white", pad=12, font=FONT):
    return tk.Button(parent, text=text, command=cmd, bg=bg, fg=fg, activebackground=bg,
                     activeforeground=fg, relief="flat", bd=0, padx=pad, pady=6,
                     font=font, cursor="hand2")


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Quản Lý Profile - mỗi kênh một proxy (Tích hợp VideoStudio)")
        self.geometry("1060x600")
        self.configure(bg=BG)
        self.running = {}      # id -> (proc, srv, cdp_port)
        self.pstate = {}       # id -> ("ok", ip) | ("err", msg)
        self.sel = None
        self.rows = {}
        self.search = tk.StringVar()
        self.cfg = {"chrome": "", "profiles": []}
        if os.path.exists(DATA):
            try:
                self.cfg = json.load(open(DATA, encoding="utf-8"))
            except Exception:
                pass

        top = tk.Frame(self, bg=NAVY)
        top.pack(fill="x")
        tk.Label(top, text="PROFILE MANAGER", bg=NAVY, fg="#4aa3ff",
                 font=("Segoe UI", 16, "bold")).pack(side="left", padx=16, pady=10)
        tk.Label(top, text="Tự động đồng bộ với VideoStudio • Tự cấp Remote Debugging Port (CDP)", bg=NAVY, fg="#9fb0c8",
                 font=FONT).pack(side="left")

        bar = tk.Frame(self, bg=BG)
        bar.pack(fill="x", padx=14, pady=(12, 6))
        btn(bar, "＋  Thêm mới", self.add, BLUE).pack(side="left", padx=(0, 6))
        btn(bar, "✎  Sửa", self.edit, "#ffffff", "#111827").pack(side="left", padx=3)
        btn(bar, "🔎  Kiểm tra proxy", self.check, ORANGE).pack(side="left", padx=3)
        btn(bar, "🗑  Xóa", self.delete, RED).pack(side="left", padx=3)
        btn(bar, "⚙  Chọn Chrome", self.pick_chrome, "#ffffff", "#111827").pack(side="left", padx=3)
        btn(bar, "▶  Mở Flow (tất cả)", self.launch_all_flow, "#10b981").pack(side="left", padx=3)
        e = tk.Entry(bar, textvariable=self.search, font=FONT, relief="solid", bd=1, width=24)
        e.pack(side="right", ipady=5)
        tk.Label(bar, text="🔍 Tìm:", bg=BG, font=FONT, fg=GRAY).pack(side="right", padx=6)
        self.search.trace_add("write", lambda *a: self.refresh())

        card = tk.Frame(self, bg="white", highlightbackground=LINE, highlightthickness=1)
        card.pack(fill="both", expand=True, padx=14, pady=(4, 6))
        hdr = tk.Frame(card, bg="#e9ecf0")
        hdr.pack(fill="x")
        self.grid_cols(hdr)
        for i, (_, t) in enumerate(COLS):
            tk.Label(hdr, text=t, bg="#e9ecf0", fg="#374151", font=("Segoe UI", 10, "bold"),
                     anchor="w").grid(row=0, column=i, sticky="w", padx=12, pady=10)
        wrap = tk.Frame(card, bg="white")
        wrap.pack(fill="both", expand=True)
        self.cv = tk.Canvas(wrap, bg="white", highlightthickness=0)
        sb = ttk.Scrollbar(wrap, orient="vertical", command=self.cv.yview)
        self.inner = tk.Frame(self.cv, bg="white")
        self.inner.bind("<Configure>", lambda e: self.cv.configure(scrollregion=self.cv.bbox("all")))
        win = self.cv.create_window((0, 0), window=self.inner, anchor="nw")
        self.cv.bind("<Configure>", lambda e: self.cv.itemconfig(win, width=e.width))
        self.cv.configure(yscrollcommand=sb.set)
        self.cv.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        self.bind_all("<MouseWheel>", lambda e: self.cv.yview_scroll(int(-e.delta / 120), "units"))

        self.foot = tk.Label(self, bg=BG, fg=GRAY, font=("Segoe UI", 9), anchor="w")
        self.foot.pack(fill="x", padx=16, pady=(0, 8))
        self.refresh()
        self.after(2000, self.poll)
        self.protocol("WM_DELETE_WINDOW", self.on_close)

    @staticmethod
    def grid_cols(f):
        for i, (w, _) in enumerate(COLS):
            f.grid_columnconfigure(i, minsize=w)
        f.grid_columnconfigure(len(COLS), weight=1)

    # ---- dữ liệu ----
    def save(self):
        json.dump(self.cfg, open(DATA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    def find(self, pid):
        return next((p for p in self.cfg["profiles"] if p["id"] == pid), None)

    def profile_path(self, p):
        if p.get("path") and os.path.exists(p["path"]):
            return p["path"]
        return os.path.join(PDIR, p["id"])

    # ---- hiển thị ----
    def refresh(self):
        for w in self.inner.winfo_children():
            w.destroy()
        self.rows = {}
        q = self.search.get().strip().lower()
        shown = [p for p in self.cfg["profiles"]
                 if q in p["name"].lower() or q in p.get("note", "").lower() or q in p.get("group", "").lower()]
        for p in shown:
            self.build_row(p)
        n_run = len(self.running)
        self.foot.config(text=f"Tổng số: {len(self.cfg['profiles'])} profile   •   Đang mở: {n_run}"
                              "   •   Bấm đúp vào dòng để mở profile (tự cấp port CDP cho VideoStudio)")
        if self.sel not in self.rows:
            self.sel = None

    def build_row(self, p):
        pid = p["id"]
        row = tk.Frame(self.inner, bg="white", highlightbackground=LINE, highlightthickness=0)
        row.pack(fill="x")
        tk.Frame(self.inner, bg=LINE, height=1).pack(fill="x")
        self.grid_cols(row)
        widgets = [row]

        c0 = tk.Frame(row, bg="white")
        c0.grid(row=0, column=0, sticky="w", padx=12, pady=10)
        tk.Label(c0, text="🌐 " + p["name"].upper(), bg="white", fg="#111827",
                 font=("Segoe UI", 10, "bold"), anchor="w").pack(anchor="w")
        tk.Label(c0, text=(p.get("group") or "Mặc định") + ((" • " + p["note"]) if p.get("note") else ""), bg="white", fg=GRAY,
                 font=("Segoe UI", 9), anchor="w").pack(anchor="w")
        widgets += [c0] + list(c0.winfo_children())

        running = pid in self.running
        b = btn(row, "■  Đóng" if running else "▶  Mở",
                (lambda i=pid: self.close_profile(i)) if running else (lambda i=pid: self.launch(i)),
                RED if running else GREEN, pad=14, font=("Segoe UI", 10, "bold"))
        b.grid(row=0, column=1, sticky="w", padx=12)

        c2 = tk.Frame(row, bg="white")
        c2.grid(row=0, column=2, sticky="w", padx=12)
        try:
            c = parse_proxy(p.get("proxy"))
        except Exception:
            c = "err"
        if c is None:
            tk.Label(c2, text="Không dùng proxy", bg="white", fg=GRAY, font=FONT).pack(side="left")
        elif c == "err":
            tk.Label(c2, text="Proxy sai định dạng", bg="white", fg=RED, font=FONT).pack(side="left")
        else:
            tk.Label(c2, text=c["scheme"].upper(), bg="white", fg=BLUE,
                     font=("Segoe UI", 8, "bold")).pack(side="left", padx=(0, 8))
            tk.Label(c2, text=f'{c["host"]}:{c["port"]}', bg="white", fg="#111827",
                     font=FONT).pack(side="left")
            st = self.pstate.get(pid)
            if st:
                ok = st[0] == "ok"
                tk.Label(c2, text=("  ✔ " + st[1] + (f" ({st[2]})" if len(st) > 2 and st[2] else "")) if ok else "  ✖ lỗi", bg="white",
                         fg=GREEN if ok else RED, font=("Segoe UI", 9, "bold")).pack(side="left")
        widgets += [c2] + list(c2.winfo_children())

        c3 = tk.Frame(row, bg="white")
        c3.grid(row=0, column=3, sticky="w", padx=12)
        port_txt = f" (CDP: {self.running[pid][2]})" if running else ""
        tk.Label(c3, text="●", bg="white", fg=GREEN if running else "#9ca3af",
                 font=("Segoe UI", 11)).pack(side="left")
        tk.Label(c3, text=(" Đang mở" + port_txt) if running else " Đã đóng", bg="white",
                 fg=GREEN if running else GRAY, font=("Segoe UI", 9, "bold" if running else "normal")).pack(side="left")
        widgets += [c3] + list(c3.winfo_children())

        self.rows[pid] = widgets
        for w in widgets:
            w.bind("<Button-1>", lambda e, i=pid: self.select(i))
            w.bind("<Double-1>", lambda e, i=pid: self.launch(i) if i not in self.running else None)
        if pid == self.sel:
            self.paint(pid, SEL)

    def paint(self, pid, color):
        for w in self.rows.get(pid, []):
            try:
                w.configure(bg=color)
            except Exception:
                pass

    def select(self, pid):
        if self.sel in self.rows:
            self.paint(self.sel, "white")
        self.sel = pid
        self.paint(pid, SEL)

    def selected(self):
        p = self.find(self.sel) if self.sel else None
        if not p:
            messagebox.showinfo("Thông báo", "Hãy bấm chọn một profile trong danh sách.")
        return p

    # ---- hộp thoại thêm/sửa ----
    def form(self, p=None):
        d = tk.Toplevel(self)
        d.title("Thông tin profile")
        d.configure(bg="white")
        d.grab_set()
        vals = {}
        rows = [("name", "Tên kênh"), ("proxy", "Proxy (ip:port hoặc ip:port:user:pass)"), ("group", "Nhóm (vd: Video AI)"), ("note", "Ghi chú")]
        for i, (k, label) in enumerate(rows):
            tk.Label(d, text=label, bg="white", font=FONT).grid(row=i, column=0, sticky="w", padx=14, pady=8)
            v = tk.StringVar(value=(p or {}).get(k, ""))
            tk.Entry(d, textvariable=v, width=50, font=FONT, relief="solid", bd=1).grid(row=i, column=1, padx=14, ipady=4)
            vals[k] = v
        out = {}

        def ok():
            if not vals["name"].get().strip():
                return messagebox.showwarning("Thiếu", "Nhập tên kênh.", parent=d)
            try:
                parse_proxy(vals["proxy"].get())
            except Exception as e:
                return messagebox.showwarning("Proxy lỗi", str(e), parent=d)
            out.update({k: v.get().strip() for k, v in vals.items()})
            d.destroy()
        btn(d, "Lưu", ok, BLUE, pad=24).grid(row=4, column=1, sticky="e", padx=14, pady=12)
        self.wait_window(d)
        return out or None

    def add(self):
        r = self.form()
        if r:
            r["id"] = uuid.uuid4().hex[:10]
            self.cfg.setdefault("profiles", []).append(r)
            self.save()
            self.sel = r["id"]
            self.refresh()

    def edit(self):
        p = self.selected()
        if not p:
            return
        if p["id"] in self.running:
            return messagebox.showinfo("Đang mở", "Hãy đóng profile trước khi sửa.")
        r = self.form(p)
        if r:
            p.update(r)
            self.pstate.pop(p["id"], None)
            self.save()
            self.refresh()

    def delete(self):
        p = self.selected()
        if not p:
            return
        if p["id"] in self.running:
            return messagebox.showinfo("Đang mở", "Hãy đóng profile trước khi xóa.")
        if messagebox.askyesno("Xóa", f'Xóa profile "{p["name"]}"?\nTOÀN BỘ đăng nhập/cookie của profile cũng bị xóa.'):
            shutil.rmtree(self.profile_path(p), ignore_errors=True)
            self.cfg["profiles"].remove(p)
            self.sel = None
            self.save()
            self.refresh()

    # ---- Chrome ----
    def pick_chrome(self):
        f = filedialog.askopenfilename(title="Chọn chrome.exe")
        if f:
            self.cfg["chrome"] = f
            self.save()

    def chrome(self):
        c = self.cfg.get("chrome") or find_chrome()
        if not c or not os.path.exists(c):
            messagebox.showinfo("Cần Chrome", "Không tìm thấy Chrome. Hãy chọn file chrome.exe.")
            self.pick_chrome()
            c = self.cfg.get("chrome")
        return c

    def launch(self, pid=None, target_url="https://flow.google.com/?hl=vi"):
        p = self.find(pid) if pid else self.selected()
        if not p:
            return
        if p["id"] in self.running:
            return
        chrome = self.chrome()
        if not chrome:
            return

        udd = self.profile_path(p)
        os.makedirs(udd, exist_ok=True)
        cdp_port = allocate_cdp_port(58879 + len(self.running))

        args = [
            chrome,
            f"--user-data-dir={udd}",
            f"--remote-debugging-port={cdp_port}",
            "--remote-allow-origins=*",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"
        ]
        srv = None
        try:
            c = parse_proxy(p.get("proxy"))
            if c:
                srv = start_forwarder(c)
                args.append(f"--proxy-server=http://127.0.0.1:{srv.server_address[1]}")
                args.append("--disable-quic")
                if p.get("country"):
                    args.append("--lang=vi" if p["country"] == "VN" else "--lang=en-US")
        except Exception as e:
            return messagebox.showerror("Proxy lỗi", str(e))

        args.append(target_url)
        proc = subprocess.Popen(args)
        self.running[p["id"]] = (proc, srv, cdp_port)
        self.refresh()

    def launch_all_flow(self):
        profs = self.cfg.get("profiles", [])
        for p in profs:
            if p["id"] not in self.running:
                self.launch(p["id"], target_url="https://flow.google.com/?hl=vi")
                time.sleep(0.5)

    def close_profile(self, pid):
        if pid not in self.running:
            return
        proc, srv, port = self.running.pop(pid, (None, None, None))
        try:
            if srv:
                srv.shutdown()
                srv.server_close()
        except Exception:
            pass
        # 1. Thử gửi lệnh Browser.close qua CDP
        if port:
            try:
                import urllib.request, json
                ver = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=0.8).read())
                bws = ver.get("webSocketDebuggerUrl")
                if bws:
                    import websockets.sync.client as wsc
                    with wsc.connect(bws, close_timeout=1) as ws:
                        ws.send(json.dumps({"id": 1, "method": "Browser.close"}))
            except Exception:
                pass
        # 2. Kill triệt để qua taskkill và CommandLine WMI
        try:
            if os.name == "nt":
                if proc:
                    subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                                   creationflags=0x08000000, capture_output=True)
                ps_cmd = (
                    f"Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | "
                    f"Where-Object {{ $_.CommandLine -match '{pid}' }} | "
                    f"ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }}"
                )
                subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd],
                               capture_output=True, timeout=5, creationflags=0x08000000)
            else:
                if proc:
                    proc.terminate()
        except Exception:
            pass
        self.after(400, self.poll_once)

    def poll_once(self):
        changed = False
        for pid in list(self.running):
            proc, srv, _ = self.running[pid]
            if proc.poll() is not None:
                if srv:
                    try:
                        srv.shutdown()
                        srv.server_close()
                    except Exception:
                        pass
                del self.running[pid]
                changed = True
        if changed:
            self.refresh()

    def poll(self):
        self.poll_once()
        self.after(2000, self.poll)

    def check(self):
        p = self.selected()
        if not p:
            return
        try:
            c = parse_proxy(p.get("proxy"))
        except Exception as e:
            return messagebox.showerror("Proxy lỗi", str(e))
        if not c:
            return messagebox.showinfo("Không có proxy", "Profile này chưa có proxy.")
        self.foot.config(text="Đang kiểm tra proxy (có thể mất vài chục giây)...")

        def work():
            geo = {}
            try:
                used, ip = detect_proxy(c)
                try:
                    geo = geo_via(used)
                except Exception:
                    geo = {}
                res = ("ok", ip, geo.get("countryCode", ""))
                msg = f"Proxy hoạt động tốt.\nIP đang dùng: {ip}"
                if geo:
                    msg += f"\nQuốc gia: {geo.get('country', '')}  •  Múi giờ: {geo.get('timezone', '')}"
                if used["scheme"] == "socks5" and not c.get("explicit"):
                    msg += "\n\n(Đây là proxy SOCKS5, ứng dụng đã tự ghi nhớ.)"
            except Exception as e:
                used, res, msg = None, ("err", str(e)), "Proxy lỗi:\n" + friendly(e)

            def done():
                if used and used["scheme"] == "socks5" and not c.get("explicit"):
                    p["proxy"] = "socks5://" + p["proxy"]
                    self.save()
                if geo.get("countryCode"):
                    p["country"] = geo["countryCode"]
                    self.save()
                self.pstate[p["id"]] = res
                self.refresh()
                (messagebox.showinfo if res[0] == "ok" else messagebox.showerror)("Kết quả kiểm tra", msg)
            self.after(0, done)
        threading.Thread(target=work, daemon=True).start()

    def on_close(self):
        for proc, srv, _ in self.running.values():
            if srv:
                try:
                    srv.shutdown()
                    srv.server_close()
                except Exception:
                    pass
        self.destroy()


if __name__ == "__main__":
    App().mainloop()

"""draft_shots.py — tạo khung story/shots.json từ timeline/lines.json chuẩn Đạo Diễn Motion Graphics.
Phong cách: Dark Map Documentary + Countryball (Kho 48 Mẫu Cảnh - 7 Nhóm).
Quy tắc:
  - Nhịp: 2.5 – 4.0s / shot theo từng ý thuyết minh.
  - Không quá 2 shot liên tiếp cùng 1 mẫu cảnh. Không quá 3 shot liên tiếp cùng 1 nhóm.
  - Đổi nền liên tục: dark_map / night_stars / navy_grid / chalkboard / brown_memorial / cream_paper / radar_scope.
  - Đổi chuyển động máy quay liên tục: zoom_in, zoom_out, pan_left, pan_right, parallax.
  - Mỗi video dùng ít nhất 20 mẫu cảnh khác nhau.
"""
import argparse, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import read_json, write_json

ap = argparse.ArgumentParser()
ap.add_argument("--project", required=True)
ap.add_argument("--force", action="store_true")
ap.add_argument("--lead", type=float, default=0.15)
ap.add_argument("--min", type=float, default=2.5)
ap.add_argument("--max", type=float, default=4.0)
a = ap.parse_args()
P = a.project

out = os.path.join(P, "story", "shots.json")
if os.path.exists(out) and not a.force:
    sys.exit("Đã có story/shots.json (thêm --force để ghi đè).")

lines = read_json(os.path.join(P, "timeline", "lines.json"), [])
words = read_json(os.path.join(P, "timeline", "words.json"), [])
if not lines:
    sys.exit("Chưa có timeline/lines.json. Chạy tools/prep_voice.py trước.")

CONJ = r",\s|;\s|:\s|\s—\s|\s-\s|\s(và|nhưng|rồi|thì|mà|nên|vì|còn|khi|lúc|sau khi|trước khi|đồng thời)\s"

def split_line(l):
    lw = [w for w in words if l["start"] - 0.01 <= w["t"] <= l["end"]]
    segs = [(l["start"], l["end"], l["text"], 0, len(l["text"].split()))]
    out_segs = []
    while segs:
        s0, s1, txt, w0, w1 = segs.pop(0)
        if s1 - s0 <= a.max or w1 - w0 < 5:
            out_segs.append((s0, s1, txt))
            continue
        best = None
        for m in re.finditer(CONJ, txt):
            k = m.start() + 1
            n = len(txt[:k].split())
            if n < 3 or w1 - w0 - n < 3:
                continue
            tm = lw[w0 + n]["t"] if w0 + n < len(lw) else (s0 + s1) / 2
            score = abs((tm - s0) - (s1 - s0) / 2)
            if best is None or score < best[0]:
                best = (score, k, n, tm)
        if not best:
            n = (w1 - w0) // 2
            ws = txt.split()
            k = len(" ".join(ws[:n])) + 1
            tm = lw[w0 + n]["t"] if w0 + n < len(lw) else (s0 + s1) / 2
            best = (0, k, n, tm)
        _, k, n, tm = best
        segs[:0] = [(s0, tm, txt[:k].strip(), w0, w0 + n), (tm, s1, txt[k:].strip(), w0 + n, w1)]
    return out_segs

cuts = []
for l in lines:
    for st, en, txt in split_line(l):
        cuts.append([st, txt, l, en])

# Gộp câu < min giây
merged = []
for c in cuts:
    if merged and (c[0] - merged[-1][0] < a.min):
        merged[-1][1] += " " + c[1]
        merged[-1][3] = max(merged[-1][3], c[3])
    else:
        merged.append(c)

# Bảng phân loại 48 mẫu cảnh
TEMPLATES = {
    # [1] MAP
    'M1': {'name': 'map_overview', 'group': 'MAP', 'bg': 'dark_map'},
    'M2': {'name': 'map_zoom_hotspot', 'group': 'MAP', 'bg': 'dark_map'},
    'M3': {'name': 'map_border_morph', 'group': 'MAP', 'bg': 'dark_map'},
    'M4': {'name': 'map_route_draw', 'group': 'MAP', 'bg': 'dark_map'},
    'M5': {'name': 'map_arrows_battle', 'group': 'MAP', 'bg': 'dark_map'},
    'M6': {'name': 'map_units_move', 'group': 'MAP', 'bg': 'dark_map'},
    'M7': {'name': 'map_siege', 'group': 'MAP', 'bg': 'dark_map'},
    'M8': {'name': 'map_split_compare', 'group': 'MAP', 'bg': 'dark_map'},
    'M9': {'name': 'map_night_lights', 'group': 'MAP', 'bg': 'dark_map'},
    'M10': {'name': 'map_terrain_3d', 'group': 'MAP', 'bg': 'dark_map'},
    'M11': {'name': 'map_population_dots', 'group': 'MAP', 'bg': 'dark_map'},
    'M12': {'name': 'minimap_jump', 'group': 'MAP', 'bg': 'dark_map'},

    # [2] BALL
    'B1': {'name': 'ball_stage', 'group': 'BALL', 'bg': 'night_stars'},
    'B2': {'name': 'ball_dialogue', 'group': 'BALL', 'bg': 'night_stars'},
    'B3': {'name': 'ball_spotlight', 'group': 'BALL', 'bg': 'night_stars'},
    'B4': {'name': 'ball_council', 'group': 'BALL', 'bg': 'night_stars'},
    'B5': {'name': 'ball_reaction', 'group': 'BALL', 'bg': 'night_stars'},
    'B6': {'name': 'ball_crowd', 'group': 'BALL', 'bg': 'night_stars'},

    # [3] DATA
    'D1': {'name': 'stat_card', 'group': 'DATA', 'bg': 'navy_grid'},
    'D2': {'name': 'stat_grid', 'group': 'DATA', 'bg': 'navy_grid'},
    'D3': {'name': 'versus_compare', 'group': 'DATA', 'bg': 'navy_grid'},
    'D4': {'name': 'bar_race', 'group': 'DATA', 'bg': 'navy_grid'},
    'D5': {'name': 'icon_count', 'group': 'DATA', 'bg': 'navy_grid'},
    'D6': {'name': 'timeline_horizontal', 'group': 'DATA', 'bg': 'navy_grid'},
    'D7': {'name': 'progress_bar', 'group': 'DATA', 'bg': 'navy_grid'},
    'D8': {'name': 'record_card', 'group': 'DATA', 'bg': 'navy_grid'},

    # [4] ARCHIVE
    'A1': {'name': 'archive_photo', 'group': 'ARCHIVE', 'bg': 'cream_paper'},
    'A2': {'name': 'newspaper', 'group': 'ARCHIVE', 'bg': 'cream_paper'},
    'A3': {'name': 'document_scroll', 'group': 'ARCHIVE', 'bg': 'cream_paper'},
    'A4': {'name': 'declassified', 'group': 'ARCHIVE', 'bg': 'cream_paper'},
    'A5': {'name': 'artifact_museum', 'group': 'ARCHIVE', 'bg': 'brown_memorial'},
    'A6': {'name': 'quote_card', 'group': 'ARCHIVE', 'bg': 'cream_paper'},

    # [5] EXPLAIN
    'E1': {'name': 'xray_cutaway', 'group': 'EXPLAIN', 'bg': 'radar_scope'},
    'E2': {'name': 'diagram_mechanism', 'group': 'EXPLAIN', 'bg': 'navy_grid'},
    'E3': {'name': 'cause_effect', 'group': 'EXPLAIN', 'bg': 'navy_grid'},
    'E4': {'name': 'cross_out', 'group': 'EXPLAIN', 'bg': 'navy_grid'},
    'E5': {'name': 'radar_scope', 'group': 'EXPLAIN', 'bg': 'radar_scope'},
    'E6': {'name': 'hud_view', 'group': 'EXPLAIN', 'bg': 'radar_scope'},

    # [6] MOOD
    'F1': {'name': 'memorial', 'group': 'MOOD', 'bg': 'brown_memorial'},
    'F2': {'name': 'chalkboard', 'group': 'MOOD', 'bg': 'chalkboard'},
    'F3': {'name': 'weather_fx', 'group': 'MOOD', 'bg': 'dark_map'},
    'F4': {'name': 'fire_smoke', 'group': 'MOOD', 'bg': 'dark_map'},
    'F5': {'name': 'explosion_beat', 'group': 'MOOD', 'bg': 'dark_map'},
    'F6': {'name': 'silence_beat', 'group': 'MOOD', 'bg': 'chalkboard'},

    # [7] CHAPTER
    'C1': {'name': 'chapter_card', 'group': 'CHAPTER', 'bg': 'dark_map'},
    'C2': {'name': 'date_flip', 'group': 'CHAPTER', 'bg': 'navy_grid'},
    'C3': {'zoom_out_world': 'zoom_out_world', 'group': 'CHAPTER', 'bg': 'dark_map'},
    'C4': {'name': 'ending_handshake', 'group': 'CHAPTER', 'bg': 'night_stars'}
}

CAMERAS = ['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'parallax']

def detect_raw(low, txt):
    # CHAPTER
    if any(k in low for k in ["chương", "mở đầu", "phần thứ", "giai đoạn mới"]):
        return 'C1'
    if any(k in low for k in ["năm 1", "năm 2", "chuyển giao năm", "tháng ngày"]):
        return 'C2'
    if any(k in low for k in ["khép lại", "bài học", "hòa bình", "tương lai"]):
        return 'C4'

    # MOOD
    if any(k in low for k in ["bắn rơi", "nổ tung", "bốc cháy", "gãy đôi", "tan xác", "tiêu diệt"]):
        return 'F5'
    if any(k in low for k in ["lưới lửa", "bão lửa", "khói đen", "thiêu rụi", "cháy ngùn ngụt"]):
        return 'F4'
    if any(k in low for k in ["tưởng niệm", "liệt sĩ", "hương khói", "nến", "ghi công"]):
        return 'F1'
    if any(k in low for k in ["sương mù", "mưa bão", "thời tiết", "tuyết"]):
        return 'F3'
    if any(k in low for k in ["bảng đen", "vạch đếm", "lập phương án", "tính toán"]):
        return 'F2'
    if any(k in low for k in ["giờ phút quyết định", "nín thở", "im lặng"]):
        return 'F6'

    # EXPLAIN
    if any(k in low for k in ["thất bại", "không diễn ra", "phá sản", "sụp đổ hoàn toàn"]):
        return 'E4'
    if any(k in low for k in ["mặt cắt", "tia x", "cấu tạo", "khoang bom", "kết cấu bên trong"]):
        return 'E1'
    if any(k in low for k in ["cơ chế", "thủy triều", "bãi cọc", "nguyên lý"]):
        return 'E2'
    if any(k in low for k in ["dẫn đến", "kết quả là", "nguyên nhân do", "hậu quả"]):
        return 'E3'
    if any(k in low for k in ["radar", "màn hiện sóng", "quét sóng", "vạch quét"]):
        return 'E5'
    if any(k in low for k in ["buồng lái", "kính ngắm", "phi công", "khóa mục tiêu", "ống nhòm"]):
        return 'E6'

    # ARCHIVE
    if any(k in low for k in ["khẳng định rằng", "trích lời", "tuyên thệ", "nói rằng:"]):
        return 'A6'
    if any(k in low for k in ["báo chí", "tờ báo", "nhân dân", "quân đội", "new york times", "trang nhất"]):
        return 'A2'
    if any(k in low for k in ["chiếu", "sắc phong", "hịch", "văn bia", "chỉ dụ"]):
        return 'A3'
    if any(k in low for k in ["giải mật", "tài liệu mật", "hồ sơ lầu năm góc", "top secret"]):
        return 'A4'
    if any(k in low for k in ["cổ vật", "hiện vật", "bảo tàng", "mũi tên đồng", "cọc gỗ"]):
        return 'A5'
    if any(k in low for k in ["bức ảnh", "hình ảnh", "tư liệu", "chứng tích"]):
        return 'A1'

    # DATA
    if any(k in low for k in ["kỷ lục", "lần đầu tiên", "chưa từng có"]):
        return 'D8'
    if any(k in low for k in ["so sánh", "tương quan", "đối đầu hai bên", "lực lượng"]):
        return 'D3'
    if any(k in low for k in ["thống kê", "con số", "thiệt hại", "tổn thất", "chiến công"]):
        return 'D2'
    if any(k in low for k in ["quy mô", "hàng trăm", "hàng ngàn", "chiến thuyền"]):
        return 'D5'
    if any(k in low for k in ["trục thời gian", "mốc thời gian", "diễn biến ngày"]):
        return 'D6'
    if any(k in low for k in ["tiến trình", "phần trăm", "%"]):
        return 'D7'
    if any(char.isdigit() for char in txt) or any(k in low for k in ["máy bay", "chiến hạm", "tấn"]):
        return 'D1'

    # BALL
    if any(k in low for k in ["hội nghị", "đàm phán", "bàn đàm phán", "hiệp định", "paris"]):
        return 'B4'
    if any(k in low for k in ["sốc", "kinh hoàng", "bất ngờ", "hoảng hốt"]):
        return 'B5'
    if any(k in low for k in ["toàn dân", "quân dân", "đoàn kết", "hàng ngũ", "binh sĩ"]):
        return 'B6'
    if any(k in low for k in ["tổng thống", "cá nhân", "quyết định của", "chỉ huy"]):
        return 'B3'
    if any(k in low for k in ["đối thoại", "tranh luận", "tuyên bố"]):
        return 'B2'

    # MAP
    if any(k in low for k in ["địa hình", "sông", "núi", "cửa biển"]):
        return 'M10'
    if any(k in low for k in ["sơ tán", "dân cư", "di cư", "dân chúng"]):
        return 'M11'
    if any(k in low for k in ["gọng kìm", "bao vây", "hai mũi"]):
        return 'M5'
    if any(k in low for k in ["hành quân", "đường bay", "tuyến đường", "tiến về"]):
        return 'M4'
    if any(k in low for k in ["đoàn xe", "đoàn tàu", "tiếp tế", "vận tải"]):
        return 'M6'
    if any(k in low for k in ["vòng vây", "khép chặt", "căn cứ"]):
        return 'M7'
    if any(k in low for k in ["hai miền", "chia cắt", "đối chiếu"]):
        return 'M8'
    if any(k in low for k in ["đêm", "bóng tối", "hỏa lực đêm"]):
        return 'M9'
    if any(k in low for k in ["vĩ tuyến", "biên giới", "ranh giới"]):
        return 'M3'
    if any(k in low for k in ["hà nội", "hải phòng", "sài gòn", "bạch đằng", "điện biên", "khâm thiên"]):
        return 'M2'

    return 'M1'

# ---------------------------------------------------------------------------
# Điền nội dung theo lời thoại: KHÔNG BAO GIỜ để mẫu cảnh hiện chữ mặc định (B-52, 1972, Linebacker…)
# không liên quan tới video. Mẫu xấu khi thiếu dữ liệu (ảnh, số liệu) được đổi sang mẫu an toàn.
# ---------------------------------------------------------------------------
CFG = read_json(os.path.join(P, "config.json"), {})
REMAP_WEAK = {'M2': 'M1', 'M8': 'M3', 'M12': 'M11', 'D4': 'D5', 'D7': 'D8', 'A1': 'A2', 'A5': 'A6', 'C3': 'C1'}
OPP = [  # (từ khóa, cờ, tên hiển thị)
    (("hoa kỳ", "người mỹ", "quân mỹ", "đế quốc mỹ", " mỹ"), "us", "HOA KỲ"),
    (("thực dân pháp", "quân pháp", "người pháp", " pháp"), "fr", "PHÁP"),
    (("liên xô",), "ussr", "LIÊN XÔ"),
    (("nguyên mông", "mông cổ", "quân nguyên", "nhà nguyên"), "mong", "NGUYÊN MÔNG"),
    (("nhà minh", "quân minh", "giặc minh"), "bac", "NHÀ MINH"),
    (("nhà thanh", "quân thanh", "mãn thanh"), "bac", "NHÀ THANH"),
    (("nhà tống", "quân tống"), "bac", "NHÀ TỐNG"),
    (("nam hán",), "bac", "NAM HÁN"),
    (("nhà hán", "quân hán", "đông hán"), "bac", "NHÀ HÁN"),
    (("trung quốc",), "cn", "TRUNG QUỐC"),
    (("campuchia", "khmer"), "kh", "CAMPUCHIA"),
    (("lào",), "laos", "LÀO"),
    (("liên hợp quốc",), "un", "LIÊN HỢP QUỐC"),
]
_ALL_LOW = " " + " ".join(l["text"] for l in lines).lower()

def find_opp(low):
    for keys, flag, name in OPP:
        if any(k in " " + low for k in keys):
            return flag, name
    for keys, flag, name in OPP:  # đối thủ chính của cả video
        if any(k in _ALL_LOW for k in keys):
            return flag, name
    return None, None

def short(txt, n=7):
    t = re.sub(r"\s+", " ", re.sub(r"[\"“”]", "", txt)).strip()
    head = re.split(r"[,.;:!?…]", t)[0].strip() or t
    ws = head.split()
    return (" ".join(ws[:n]) + ("…" if len(ws) > n else "")).upper()

def rest(txt, n=12):
    t = re.sub(r"\s+", " ", txt).strip()
    parts = re.split(r"(?<=[,.;:!?…])\s+", t, maxsplit=1)
    r = parts[1] if len(parts) > 1 else ""
    ws = r.split()
    return " ".join(ws[:n]) + ("…" if len(ws) > n else "")

def nums(txt):
    return re.findall(r"\d[\d.,]*\s*%?", txt)

def years(txt):
    return re.findall(r"\b(1\d{3}|20\d{2}|[1-9]\d{2})\b", txt)

def fill_args(code, txt):
    low = txt.lower(); H = short(txt); R = rest(txt)
    flag, oname = find_opp(low)
    ns = nums(txt); ys = years(txt)
    if code in REMAP_WEAK and not (code == 'E2' and ('cọc' in low or 'bạch đằng' in low)):
        code = REMAP_WEAK[code]
    if code == 'E2' and not ('cọc' in low or 'bạch đằng' in low):
        code = 'E3'
    if code in ('D1', 'D2', 'B5') and not ns:
        code = 'F2'
    if code in ('D6',) and len(ys) < 2:
        code = 'D5'
    if code == 'C2' and not ys:
        code = 'C1'
    if code in ('B1', 'B2', 'C4', 'D3') and not flag:
        code = {'B1': 'B6', 'B2': 'B3', 'C4': 'F1', 'D3': 'D5'}[code]
    a = {}
    if code in ('M3', 'M6', 'M9', 'M11'): a = {"label": H}
    elif code in ('M5', 'M10'): a = {"title": H}
    elif code == 'M7': a = {"target": H}
    elif code == 'B1': a = {"title": H, "sub": R.upper()[:60], "flag1": "vn", "flag2": flag}
    elif code == 'B2': a = {"flag1": "vn", "flag2": flag, "speech1": "", "speech2": ""}
    elif code == 'B3': a = {"name": H, "flag": flag or "vn", "mood": "thinking", "acc": "mu_coi" if not flag else "kinh_ram"}
    elif code == 'B4': a = {"title": H}
    elif code == 'B5': a = {"stat": ns[0].strip() + " " + " ".join(txt.split(ns[0], 1)[1].split()[:3]).upper(), "desc": H, "flag": flag or "vn"}
    elif code == 'B6': a = {"title": H, "flag": "vn"}
    elif code == 'D1':
        after = " ".join(txt.split(ns[0], 1)[1].split()[:5]).upper()
        a = {"value": ns[0].strip(), "unit": "", "label": after or H, "source": ""}
    elif code == 'D2':
        items = []
        for nn in ns[:4]:
            items.append({"num": nn.strip(), "label": " ".join(txt.split(nn, 1)[1].split()[:3]).upper()})
        a = {"title": H, "items": items}
    elif code == 'D3': a = {"title": H, "nameA": "ĐẠI VIỆT" if flag in ("mong", "bac") else "VIỆT NAM", "nameB": oname}
    elif code == 'D5': a = {"title": H, "desc": R.upper()[:70]}
    elif code == 'D6': a = {"title": H, "milestones": ys[:5]}
    elif code == 'D8': a = {"title": H, "desc": R.upper()[:80]}
    elif code == 'A2': a = {"paper": "TƯ LIỆU LỊCH SỬ", "headline": H, "sub": R[:90]}
    elif code == 'A3': a = {"title": H, "text": R[:120] or txt[:120]}
    elif code == 'A6': a = {"quote": " ".join(txt.split()[:18]), "author": ""}
    elif code == 'E1': a = {"title": H, "unit": ""}
    elif code == 'E3':
        ps = [x.strip().upper() for x in re.split(r"[,;]| rồi | nên | khiến ", txt) if len(x.strip()) > 3][:3]
        while len(ps) < 3: ps.append(H)
        a = {"title": H, "nodes": [" ".join(x.split()[:5]) for x in ps]}
    elif code == 'E4': a = {"target": H}
    elif code == 'E5': a = {"title": H}
    elif code in ('F1', 'F3', 'F4', 'F5'): a = {"title": H}
    elif code == 'F2': a = {"title": H, "sub": R.upper()[:80]}
    elif code == 'F6': a = {"text": txt[:110]}
    elif code == 'C1': a = {"num": "", "title": H}
    elif code == 'C2': a = {"year": ys[0], "sub": H}
    elif code == 'C4': a = {"message": H, "flag1": "vn", "flag2": flag}
    return code, a


shots = []
dur = lines[-1]["end"] if lines else 0

last_code = None
last_group = None
group_repeat = 0
last_bg = None
bg_repeat = 0
last_cam = None

pool_map = ['M1', 'M2', 'M4', 'M5', 'M6', 'M10']
pool_ball = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']
pool_data = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']
pool_archive = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']
pool_explain = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6']

used_templates = set()

for i, m in enumerate(merged):
    st, txt, l, en = m
    nxt_st = merged[i + 1][0] if i + 1 < len(merged) else dur
    sh_end = min(nxt_st, max(en, st + 2.0))
    low = txt.lower()

    code = detect_raw(low, txt)

    # 1. Luật không quá 2 shot liên tiếp cùng 1 template
    if code == last_code:
        grp = TEMPLATES.get(code, {}).get('group', 'MAP')
        if grp == 'MAP':
            code = pool_map[(pool_map.index(code) + 1) % len(pool_map)] if code in pool_map else 'M2'
        elif grp == 'DATA':
            code = pool_data[(pool_data.index(code) + 1) % len(pool_data)] if code in pool_data else 'D2'
        elif grp == 'BALL':
            code = pool_ball[(pool_ball.index(code) + 1) % len(pool_ball)] if code in pool_ball else 'B3'
        elif grp == 'ARCHIVE':
            code = pool_archive[(pool_archive.index(code) + 1) % len(pool_archive)] if code in pool_archive else 'A2'
        else:
            code = 'M1'

    cur_grp = TEMPLATES.get(code, {}).get('group', 'MAP')

    # 2. Luật không quá 3 shot liên tiếp cùng 1 nhóm
    if cur_grp == last_group:
        group_repeat += 1
        if group_repeat >= 3:
            # Luân chuyển nhóm
            if cur_grp == 'MAP':
                code = 'D1'
            elif cur_grp == 'DATA':
                code = 'B2'
            elif cur_grp == 'BALL':
                code = 'A1'
            elif cur_grp == 'ARCHIVE':
                code = 'E2'
            else:
                code = 'M1'
            cur_grp = TEMPLATES.get(code, {}).get('group', 'MAP')
            group_repeat = 1
    else:
        group_repeat = 1

    last_code = code
    last_group = cur_grp
    used_templates.add(code)

    code, auto_args = fill_args(code, txt)
    cur_grp = TEMPLATES.get(code, {}).get('group', cur_grp)
    used_templates.add(code)
    info = TEMPLATES.get(code, {'name': 'map_overview', 'group': 'MAP', 'bg': 'dark_map'})

    # 3. Luân chuyển background (không trùng quá 2 lần)
    bg = info.get('bg', 'dark_map')
    if bg == last_bg:
        bg_repeat += 1
        if bg_repeat >= 3:
            bg = 'navy_grid' if bg != 'navy_grid' else 'dark_map'
            bg_repeat = 1
    else:
        bg_repeat = 1
    last_bg = bg

    # 4. Luân chuyển camera
    cam = CAMERAS[i % len(CAMERAS)]
    if cam == last_cam:
        cam = CAMERAS[(i + 1) % len(CAMERAS)]
    last_cam = cam

    sh = {
        "id": f"s{i+1:04d}",
        "start": round(st, 2),
        "end": round(sh_end, 2),
        "block": l.get("block", "V001"),
        "text": txt,
        "code": code,
        "tpl": code,
        "canonical": info.get('name'),
        "group": cur_grp,
        "bg": bg,
        "camera": cam,
        "hud": {"date": CFG.get("hudDate", "")},
        "args": auto_args
    }
    shots.append(sh)

if shots:
    shots[-1]["end"] = dur

write_json(out, {
    "title": read_json(os.path.join(P, "config.json"), {}).get("title", ""),
    "duration": dur,
    "total_shots": len(shots),
    "unique_templates": len(used_templates),
    "shots": shots,
    "music": [{"start": 0, "end": dur, "bed": CFG.get("musicBed", "tension")}]
})

cfg = read_json(os.path.join(P, "config.json"), {})
cfg["duration"] = dur
write_json(os.path.join(P, "config.json"), cfg)

# Thống kê phân bố nhóm
stats = {}
for s in shots:
    g = s['group']
    stats[g] = stats.get(g, 0) + 1

print("=" * 60)
print(f"Xong {len(shots)} shot chuẩn Motion Graphics (Dài {dur:.1f}s)")
print(f"Số mẫu cảnh độc nhất đã dùng: {len(used_templates)} / 48 (Yêu cầu >= 20: {'ĐẠT' if len(used_templates) >= 20 else 'CHƯA ĐẠT'})")
print("Phân bố tỷ lệ nhóm:")
for k, v in sorted(stats.items()):
    pct = (v / len(shots)) * 100
    print(f"  - [{k}]: {v} shot ({pct:.1f}%)")
print("=" * 60)
print(f"Đã lưu kết quả -> {out}")

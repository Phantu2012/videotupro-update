// geo.js — ban do phong cach "phim tai lieu hoat hinh": dat xam, bien xanh, Viet Nam hong dat, song, thanh pho,
// camera lia/zoom muot theo kinh/vi do. Luon ve Quan dao Hoang Sa, Truong Sa (Viet Nam) va nhan Bien Dong.
import { E, clamp, lerp, ease, text } from '/engine/core.js';

export const MAPC = {
  sea: '#2C4A6E', sea2: '#3A6290', coastGlow: 'rgba(120,170,220,0.22)', land: '#6B6D70', land2: '#77797C', border: 'rgba(40,42,46,0.75)',
  vn: '#E2805F', vnEdge: '#A9502F', river: '#5E9BD0', label: '#FFFFFF', labelStroke: '#1B2430', city: '#FFFFFF',
};

let WORLD = null, FEAT = null;
export async function loadGeo() {
  if (WORLD) return;
  const topo = await import('/node_modules/topojson-client/src/index.js');
  const w = await (await fetch('/node_modules/world-atlas/countries-50m.json')).json();
  WORLD = topo.feature(w, w.objects.countries).features;
  FEAT = WORLD.map((f) => ({ name: f.properties.name, geom: f.geometry, bbox: bboxOf(f.geometry) }));
}
function bboxOf(gm) {
  let a = 180, b = 90, c = -180, d = -90;
  const polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
  for (const p of polys) for (const r of p) for (const [x, y] of r) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [a, b, c, d];
}

// ---------- dia danh (kinh do, vi do)
export const PLACES = {
  'Hà Nội': [105.85, 21.03], 'Hải Phòng': [106.68, 20.86], 'Điện Biên Phủ': [103.02, 21.39], 'Điện Biên': [103.02, 21.39], 'Mường Thanh': [103.02, 21.39], 'Mường Phăng': [103.12, 21.5],
  'Sơn La': [103.9, 21.33], 'Lai Châu': [103.15, 22.06], 'Tuần Giáo': [103.42, 21.59], 'Lào Cai': [103.97, 22.48], 'Hà Giang': [104.98, 22.82], 'Cao Bằng': [106.25, 22.67],
  'Lạng Sơn': [106.76, 21.85], 'Thái Nguyên': [105.84, 21.59], 'Tuyên Quang': [105.22, 21.82], 'Việt Bắc': [105.5, 22.0], 'Yên Bái': [104.87, 21.72], 'Hòa Bình': [105.34, 20.81],
  'Nam Định': [106.17, 20.42], 'Thái Bình': [106.34, 20.45], 'Hạ Long': [107.08, 20.95], 'Móng Cái': [107.97, 21.52], 'Thanh Hóa': [105.78, 19.81], 'Hàm Rồng': [105.8, 19.86],
  'Vinh': [105.68, 18.67], 'Nghệ An': [105.3, 19.0], 'Hà Tĩnh': [105.9, 18.34], 'Quảng Bình': [106.6, 17.47], 'Vĩ tuyến mười bảy': [107.05, 17.0], 'Quảng Trị': [107.19, 16.75],
  'Khe Sanh': [106.73, 16.62], 'Huế': [107.59, 16.46], 'Đà Nẵng': [108.22, 16.05], 'Quảng Nam': [108.0, 15.6], 'Quảng Ngãi': [108.8, 15.12], 'Kon Tum': [108.0, 14.35],
  'Pleiku': [108.0, 13.98], 'Tây Nguyên': [108.0, 13.5], 'Quy Nhơn': [109.22, 13.77], 'Buôn Ma Thuột': [108.05, 12.67], 'Nha Trang': [109.19, 12.24], 'Cam Ranh': [109.16, 11.92],
  'Đà Lạt': [108.44, 11.94], 'Phan Thiết': [108.1, 10.93], 'Xuân Lộc': [107.4, 10.93], 'Biên Hòa': [106.82, 10.95], 'Tây Ninh': [106.1, 11.31], 'Củ Chi': [106.49, 11.0],
  'Sài Gòn': [106.7, 10.78], 'Thành phố Hồ Chí Minh': [106.7, 10.78], 'Vũng Tàu': [107.08, 10.35], 'Cần Thơ': [105.78, 10.03], 'Côn Đảo': [106.6, 8.68], 'Cà Mau': [105.15, 9.18],
  'Hà Tiên': [104.48, 10.38], 'Phú Quốc': [103.97, 10.23],
  'Viêng Chăn': [102.6, 17.97], 'Luông Pha Băng': [102.13, 19.88], 'Thượng Lào': [102.6, 20.2], 'Trung Lào': [105.0, 17.0], 'Hạ Lào': [106.0, 15.0], 'Cánh đồng Chum': [103.2, 19.45],
  'Phnôm Pênh': [104.92, 11.56], 'Băng Cốc': [100.5, 13.75], 'U Tapao': [101.0, 12.68], 'Côn Minh': [102.7, 25.04], 'Quảng Châu': [113.26, 23.13], 'Bắc Kinh': [116.4, 39.9],
  'Hồng Kông': [114.17, 22.3], 'Ma-ni-la': [120.98, 14.6], 'Gu-am': [144.79, 13.44], 'Guam': [144.79, 13.44], 'Tô-ky-ô': [139.7, 35.7], 'Okinawa': [127.7, 26.3],
  'Pa-ri': [2.35, 48.86], 'Paris': [2.35, 48.86], 'Oa-sinh-tơn': [-77.04, 38.9], 'Washington': [-77.04, 38.9], 'Mát-xcơ-va': [37.62, 55.75], 'Giơ-ne-vơ': [6.14, 46.2],
  'Luân Đôn': [-0.13, 51.5], 'Hoàng Sa': [112.0, 16.5], 'Trường Sa': [114.0, 10.0], 'Biển Đông': [113.0, 13.5], 'Vịnh Bắc Bộ': [107.5, 19.8],
};
export const CITIES = ['Hà Nội', 'Hải Phòng', 'Sài Gòn', 'Huế', 'Đà Nẵng', 'Vinh', 'Thanh Hóa', 'Điện Biên Phủ', 'Lào Cai', 'Cao Bằng', 'Lạng Sơn', 'Nha Trang', 'Cần Thơ', 'Quy Nhơn', 'Buôn Ma Thuột', 'Viêng Chăn', 'Phnôm Pênh', 'Băng Cốc', 'Côn Minh', 'Hồng Kông', 'Ma-ni-la'];
const RIVERS = [
  [[102.2, 23.3], [103.0, 22.9], [103.96, 22.5], [104.4, 22.1], [104.87, 21.72], [105.2, 21.45], [105.43, 21.32], [105.85, 21.03], [106.05, 20.65], [106.35, 20.4], [106.6, 20.22]],
  [[102.5, 22.7], [103.15, 22.3], [103.15, 22.05], [103.6, 21.75], [104.05, 21.45], [104.6, 21.0], [105.1, 20.85], [105.32, 20.82], [105.4, 21.1], [105.43, 21.32]],
  [[104.98, 22.82], [105.1, 22.3], [105.22, 21.82], [105.35, 21.5], [105.43, 21.32]],
  [[103.4, 21.3], [103.9, 21.0], [104.3, 20.6], [104.9, 20.25], [105.4, 19.95], [105.8, 19.8], [105.95, 19.75]],
  [[103.9, 19.6], [104.5, 19.3], [105.0, 19.0], [105.4, 18.8], [105.7, 18.7]],
  [[100.1, 20.4], [101.0, 20.2], [102.13, 19.88], [101.8, 18.9], [101.7, 18.0], [102.6, 17.97], [103.6, 18.3], [104.75, 17.4], [105.6, 16.0], [105.8, 15.1], [105.9, 13.5], [105.95, 12.5], [104.92, 11.56], [105.4, 10.8], [105.78, 10.03], [106.4, 9.6]],
  [[106.75, 11.5], [106.6, 11.0], [106.72, 10.75], [106.95, 10.45]],
];
// lam mem song (Catmull-Rom) + uon khuc nho cho tu nhien
const RIVERS_S = RIVERS.map((pts, ri) => { const out = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const n = Math.max(6, Math.round(segLen * 40)); for (let s = 0; s < n; s++) { const t = s / n, t2 = t * t, t3 = t2 * t; const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3); const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3); const k = out.length; const w = Math.sin(k * 0.9 + ri) * 0.018 + Math.sin(k * 2.3 + ri * 3) * 0.009; const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1; out.push([x - dy / L * w, y + dx / L * w]); } } out.push(pts[pts.length - 1]); return out; });
const HOANG_SA = [[111.2, 16.9], [111.6, 16.55], [111.75, 16.8], [112.25, 16.95], [112.35, 16.7], [112.6, 16.45], [112.1, 16.3], [111.6, 16.25], [111.9, 17.05]];
const TRUONG_SA = [[111.9, 10.4], [112.6, 9.9], [113.2, 10.7], [114.3, 10.4], [114.1, 9.55], [114.9, 10.9], [115.5, 9.9], [113.8, 8.9], [112.9, 8.6], [114.6, 8.4], [115.8, 10.6], [111.6, 8.65], [113.4, 11.2], [115.2, 8.9]];

export const VIEWS = {
  world: [-170, -50, 190, 75], eurasia: [-12, -8, 150, 66], asia: [58, -12, 150, 56], sea: [90, -12, 136, 28], indochina: [96, 7, 120, 25], vn: [99, 7.5, 118, 24],
  vnNorth: [101.5, 18.6, 109.2, 23.6], tayBac: [101.3, 19.6, 106.8, 23.2], dbp: [101.6, 20.4, 104.6, 22.4], hanoi: [104.9, 20.4, 106.9, 21.7], center: [104.5, 14.5, 110.5, 18.5],
  south: [103.5, 8.3, 110.5, 13.0], saigon: [105.9, 10.2, 107.5, 11.3], laos: [99.5, 13.5, 108.5, 22.8], europe: [-12, 34, 42, 64], france: [-5, 42, 9, 51.5], usa: [-126, 24, -66, 50],
  pacific: [95, 0, 150, 40], china: [72, 16, 138, 54],
};
// tim khung nhin: ten view, [l,b,r,t], ten dia danh (+ do rong), hoac {at, span}
export function resolveView(v, span) {
  if (!v) return VIEWS.vn;
  if (Array.isArray(v) && v.length === 4) return v;
  if (typeof v === 'string' && VIEWS[v]) return VIEWS[v];
  const c = Array.isArray(v) ? v : PLACES[v] || (v.at && (Array.isArray(v.at) ? v.at : PLACES[v.at]));
  const s = (v && v.span) || span || 4;
  if (c) return [c[0] - s * 0.89, c[1] - s * 0.5, c[0] + s * 0.89, c[1] + s * 0.5];
  return VIEWS.vn;
}
export const placeOf = (p) => (Array.isArray(p) ? p : PLACES[p] || null);

// camera: {cx, cy, span(do cao tinh bang vi do), kx}
function camOf(b) { return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, span: Math.max(b[3] - b[1], (b[2] - b[0]) * Math.cos((b[1] + b[3]) / 2 * Math.PI / 180) * E.H / E.W) }; }
export function camAt(from, to, k) {
  const a = camOf(from), b = camOf(to || from), q = ease.inOut(clamp(k));
  return { cx: lerp(a.cx, b.cx, q), cy: lerp(a.cy, b.cy, q), span: Math.exp(lerp(Math.log(a.span), Math.log(b.span), q)) };
}
// projector cho 1 camera: P(lon,lat) -> [x,y] (don vi khung 1920x1080)
export function projOf(cam) {
  const kx = Math.cos(cam.cy * Math.PI / 180), s = E.H / cam.span;
  const P = (lon, lat) => [E.W / 2 + (lon - cam.cx) * kx * s, E.H / 2 - (lat - cam.cy) * s];
  P.scale = s; P.kx = kx; P.cam = cam;
  P.inv = (x, y) => [cam.cx + (x - E.W / 2) / (kx * s), cam.cy - (y - E.H / 2) / s];
  return P;
}

// Path2D theo toa do (lon,lat); duoc loc theo khung nhin (de nhanh)
const PCACHE = new Map();
function pathFor(feats) {
  const p = new Path2D();
  for (const f of feats) {
    const gm = f.geom; const polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
    for (const poly of polys) for (const ring of poly) { ring.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); }
  }
  return p;
}
function layersFor(box) {
  const key = box.map((x) => Math.round(x)).join(',');
  if (PCACHE.has(key)) return PCACHE.get(key);
  const pad = 6, [l, b, r, t] = [box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad];
  const inBox = FEAT.filter((f) => !(f.bbox[2] < l || f.bbox[0] > r || f.bbox[3] < b || f.bbox[1] > t));
  const out = { land: pathFor(inBox), vn: pathFor(inBox.filter((f) => f.name === 'Vietnam')), each: inBox.map((f) => ({ name: f.name, p: pathFor([f]) })) };
  if (PCACHE.size > 16) PCACHE.delete(PCACHE.keys().next().value);
  PCACHE.set(key, out); return out;
}
export function countryPath(box, name) { const L = layersFor(box); const f = L.each.find((x) => x.name === name); return f ? f.p : null; }

// ve ban do cho camera hien tai. o: {night, dim, highlight:{'France':'#..'}, rivers, labels:[ten] | true, islands}
export function paintMap(g, cam, o = {}) {
  if (!FEAT) throw new Error('chua nap ban do');
  const P = projOf(cam), s = P.scale, kx = P.kx;
  const box = [P.inv(0, 0)[0], P.inv(0, E.H)[1], P.inv(E.W, 0)[0], P.inv(0, 0)[1]];
  const L = layersFor([Math.floor(box[0] / 4) * 4, Math.floor(box[1] / 4) * 4, Math.ceil(box[2] / 4) * 4, Math.ceil(box[3] / 4) * 4]);
  // bien
  const sg = g.createRadialGradient(E.W * 0.5, E.H * 0.45, 100, E.W * 0.5, E.H * 0.5, E.W * 0.75);
  sg.addColorStop(0, o.night ? '#1E3350' : MAPC.sea2); sg.addColorStop(1, o.night ? '#121F33' : MAPC.sea);
  g.fillStyle = sg; g.fillRect(0, 0, E.W, E.H);
  g.save();
  g.setTransform(E.PX * kx * s, 0, 0, -E.PX * s, E.PX * (E.W / 2 - cam.cx * kx * s), E.PX * (E.H / 2 + cam.cy * s));
  const u = 1 / s; // 1 px khung
  // vien sang ven bien
  g.strokeStyle = MAPC.coastGlow; g.lineWidth = 26 * u; g.lineJoin = 'round'; g.stroke(L.land);
  g.strokeStyle = 'rgba(140,190,235,0.18)'; g.lineWidth = 10 * u; g.stroke(L.land);
  g.fillStyle = o.night ? '#4A4C50' : MAPC.land; g.fill(L.land);
  for (const [name, col] of Object.entries(o.highlight || {})) { const f = L.each.find((x) => x.name === name); if (f) { g.fillStyle = col; g.fill(f.p); } }
  if (o.vn !== false) { g.fillStyle = o.night ? '#B8664C' : MAPC.vn; g.fill(L.vn); }
  g.strokeStyle = MAPC.border; g.lineWidth = 1.6 * u; for (const f of L.each) g.stroke(f.p);
  if (o.vn !== false) { g.strokeStyle = MAPC.vnEdge; g.lineWidth = 2.4 * u; g.stroke(L.vn); }
  // song
  if (o.rivers !== false && s > 25) {
    g.strokeStyle = MAPC.river; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = clamp(s * 0.022, 1.6, 4) * u;
    for (const rv of RIVERS_S) { g.beginPath(); rv.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  }
  g.restore();
  // dao Hoang Sa, Truong Sa
  if (o.islands !== false) {
    const r = clamp(s * 0.05, 2.2, 6);
    for (const [lo, la] of [...HOANG_SA, ...TRUONG_SA]) { const q = P(lo, la); if (q[0] < -20 || q[0] > E.W + 20 || q[1] < -20 || q[1] > E.H + 20) continue; g.fillStyle = o.night ? '#B8664C' : MAPC.vn; g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill(); }
    if (s > 10) {
      const sz = clamp(s * 0.35, 15, 26), a = P(112.1, 16.0), b = P(113.6, 8.0), c = P(113.5, 13.6);
      const lab = (str, q, size, col = '#E6EEF8') => { if (q[0] > 0 && q[0] < E.W && q[1] > 0 && q[1] < E.H) text(g, str, q[0], q[1], { size, weight: 800, color: col, stroke: 3, strokeColor: '#1B2A40', font: '"Be Vietnam Pro", sans-serif' }); };
      lab('HOÀNG SA', a, sz); lab('TRƯỜNG SA', b, sz); if (s < 120) lab('BIỂN ĐÔNG', c, sz * 1.15, 'rgba(225,235,248,0.75)');
    }
  }
  // nhan thanh pho
  const labs = o.labels === false ? [] : Array.isArray(o.labels) ? o.labels : CITIES;
  for (const n of labs) { const c = PLACES[n]; if (!c) continue; const q = P(c[0], c[1]); if (q[0] < 40 || q[0] > E.W - 40 || q[1] < 40 || q[1] > E.H - 40) continue; cityLabel(g, n, q[0], q[1], o.labelSize); }
  // vignette nhe
  const vg = g.createRadialGradient(E.W / 2, E.H / 2, E.H * 0.45, E.W / 2, E.H / 2, E.W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)'); g.fillStyle = vg; g.fillRect(0, 0, E.W, E.H);
  if (o.night) { g.fillStyle = 'rgba(8,14,30,0.35)'; g.fillRect(0, 0, E.W, E.H); }
  return P;
}
export function cityLabel(g, name, x, y, size = 24, o = {}) {
  g.save(); g.fillStyle = '#FFFFFF'; g.strokeStyle = '#1B2430'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.stroke();
  text(g, name, x + (o.dx ?? 12), y + (o.dy ?? 0), { size, weight: 700, color: '#FFFFFF', align: o.align || 'left', stroke: 4, strokeColor: '#1B2430', font: '"Be Vietnam Pro", sans-serif' });
  g.restore();
}

// minimap the gioi (anh dem 1 lan)
let MINI = null;
export function miniWorld() {
  if (MINI || !FEAT) return MINI;
  const W = 520, H = 300, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#1E2F45'; x.fillRect(0, 0, W, H);
  x.setTransform(W / 360, 0, 0, -H / 160, W / 2, H * 0.78 / 160 * 160 * 0 + H * 0.5 + 10 * H / 160);
  x.fillStyle = '#7B7E83'; x.fill(pathFor(FEAT.filter((f) => f.bbox[1] > -60)));
  MINI = c; return c;
}
export const miniXY = (lon, lat, W, H) => [W / 2 + lon * W / 360, H * 0.5 + 10 * H / 160 - lat * H / 160];

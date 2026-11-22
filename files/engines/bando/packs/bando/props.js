// props.js — thu vien hinh ve vector phang (flat icon) co vien dam, dung cho ban do va infographic.
// Moi ham: draw(g, x, y, s, o) ve tam tai (x,y), s = kich thuoc (px). o.rot = goc xoay (rad).
import { E, clamp, ease, text, rng } from '/engine/core.js';

const OL = '#1B1F26';
function begin(g, x, y, s, o = {}) { g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot); if (o.flip) g.scale(-1, 1); g.scale(s / 100, s / 100); g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = 5; g.strokeStyle = OL; }
const end = (g) => g.restore();
function shape(g, pts, fill) { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); g.fillStyle = fill; g.fill(); g.stroke(); }
function rrect(g, x, y, w, h, r, fill, stroke = true) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = fill; g.fill(); if (stroke) g.stroke(); }
function circ(g, x, y, r, fill, stroke = true) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = fill; g.fill(); if (stroke) g.stroke(); }

// ---- may bay (mui huong sang phai, goc 0)
export function plane(g, x, y, s, o = {}) {
  begin(g, x, y, s, o); const kind = o.kind || 'fighter', c = o.color || '#9AA5AE', d = '#6C7780';
  if (kind === 'bomber') {
    shape(g, [[-10, -8], [30, -55], [44, -55], [26, -8]], d); shape(g, [[-10, 8], [30, 55], [44, 55], [26, 8]], d);
    shape(g, [[-60, -6], [40, -9], [58, -4], [62, 0], [58, 4], [40, 9], [-60, 6]], c);
    shape(g, [[-58, -4], [-74, -24], [-66, -24], [-48, -4]], d); shape(g, [[-58, 4], [-74, 24], [-66, 24], [-48, 4]], d);
    [[14, -30], [22, -42], [14, 30], [22, 42]].forEach(([a, b]) => rrect(g, a - 6, b - 4, 14, 8, 3, '#59636B'));
  } else if (kind === 'transport') {
    shape(g, [[-8, -6], [6, -60], [20, -60], [18, -6]], d); shape(g, [[-8, 6], [6, 60], [20, 60], [18, 6]], d);
    shape(g, [[-58, -10], [40, -12], [56, -6], [60, 0], [56, 6], [40, 12], [-58, 10]], c);
    shape(g, [[-54, -6], [-70, -28], [-60, -28], [-44, -6]], d); shape(g, [[-54, 6], [-70, 28], [-60, 28], [-44, 6]], d);
    circ(g, 6, -34, 7, '#59636B'); circ(g, 6, 34, 7, '#59636B');
  } else if (kind === 'heli') {
    rrect(g, -30, -16, 60, 32, 16, c); g.fillStyle = '#9FD3F5'; g.beginPath(); g.arc(20, 0, 12, -1.2, 1.2); g.fill(); g.stroke();
    shape(g, [[-30, -4], [-70, -3], [-70, 3], [-30, 4]], d); shape(g, [[-74, -12], [-66, -12], [-66, 12], [-74, 12]], d);
    const a = (o.t || 0) * 30; g.save(); g.rotate(a); g.fillStyle = 'rgba(40,40,40,0.55)'; g.fillRect(-60, -3, 120, 6); g.fillRect(-3, -60, 6, 120); g.restore();
  } else {
    shape(g, [[-4, -6], [14, -46], [24, -46], [20, -6]], d); shape(g, [[-4, 6], [14, 46], [24, 46], [20, 6]], d);
    shape(g, [[-52, -7], [38, -7], [62, 0], [38, 7], [-52, 7]], c);
    shape(g, [[-46, -5], [-62, -22], [-54, -22], [-38, -5]], d); shape(g, [[-46, 5], [-62, 22], [-54, 22], [-38, 5]], d);
    g.fillStyle = '#9FD3F5'; g.beginPath(); g.ellipse(26, 0, 10, 4, 0, 0, 7); g.fill();
  }
  if (o.mark) { circ(g, -36, 0, 7, o.mark, false); }
  end(g);
}
// vet bay (speed lines) phia sau may bay
export function trail(g, x, y, s, ang, len = 3, col = 'rgba(255,255,255,0.55)') {
  g.save(); g.translate(x, y); g.rotate(ang); g.strokeStyle = col; g.lineCap = 'round';
  for (let i = -1; i <= 1; i++) { g.lineWidth = s * 0.04; g.beginPath(); g.moveTo(-s * 0.7, i * s * 0.18); g.lineTo(-s * (0.7 + len * (i === 0 ? 1 : 0.6)), i * s * 0.18); g.stroke(); }
  g.restore();
}
export function truck(g, x, y, s, o = {}) {
  begin(g, x, y, s, o); const c = o.color || '#6E7F45';
  rrect(g, -50, -30, 62, 40, 6, c); rrect(g, 12, -22, 34, 32, 6, shadeHex(c, -0.12)); g.fillStyle = '#9FD3F5'; g.fillRect(24, -16, 16, 12);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let i = -40; i < 10; i += 12) { g.beginPath(); g.moveTo(i, -26); g.lineTo(i, 6); g.stroke(); } g.strokeStyle = OL; g.lineWidth = 5;
  const sp = (o.t || 0) * 12; [[-34, 14], [-6, 14], [32, 14]].forEach(([a, b]) => { circ(g, a, b, 11, '#2A2E33'); g.save(); g.translate(a, b); g.rotate(sp); g.fillStyle = '#9AA0A8'; g.fillRect(-3, -3, 6, 6); g.restore(); });
  end(g);
}
export function bicycle(g, x, y, s, o = {}) {
  begin(g, x, y, s, o); const sp = (o.t || 0) * 8;
  g.lineWidth = 5; [[-34, 22], [34, 22]].forEach(([a, b]) => { g.beginPath(); g.arc(a, b, 20, 0, 7); g.stroke(); g.save(); g.translate(a, b); g.rotate(sp); g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.moveTo(0, -20); g.lineTo(0, 20); g.lineWidth = 2; g.stroke(); g.restore(); });
  g.beginPath(); g.moveTo(-34, 22); g.lineTo(-6, -6); g.lineTo(26, -6); g.lineTo(34, 22); g.moveTo(-6, -6); g.lineTo(4, 22); g.lineTo(26, -6); g.stroke();
  // bao hang tho
  rrect(g, -40, -46, 50, 34, 8, '#C9A46A'); rrect(g, -18, -70, 40, 28, 8, '#B88F55'); g.beginPath(); g.moveTo(26, -6); g.lineTo(44, -26); g.stroke();
  end(g);
}
export function cannon(g, x, y, s, o = {}) {
  begin(g, x, y, s, o); const rec = o.fire ? Math.max(0, 1 - (o.fire % 1) * 5) * 10 : 0;
  g.save(); g.translate(-rec, 0); g.rotate(-0.42); rrect(g, -10, -9, 84, 18, 6, '#5C6B3E'); rrect(g, 64, -11, 14, 22, 4, '#47552F'); g.restore();
  shape(g, [[-34, 4], [12, -10], [22, 6], [-26, 24]], '#6E7D4A'); g.beginPath(); g.moveTo(-20, 18); g.lineTo(-70, 40); g.stroke();
  circ(g, -4, 26, 20, '#3A3F44'); circ(g, -4, 26, 7, '#9AA0A8');
  if (o.fire && (o.fire % 1) < 0.12) { g.save(); g.translate(-rec, 0); g.rotate(-0.42); g.fillStyle = '#FFD25A'; g.beginPath(); g.moveTo(80, 0); g.lineTo(118, -16); g.lineTo(108, 0); g.lineTo(122, 14); g.closePath(); g.fill(); g.restore(); }
  end(g);
}
export function aagun(g, x, y, s, o = {}) {
  begin(g, x, y, s, o); g.save(); g.rotate(-1.0); rrect(g, -6, -6, 74, 12, 4, '#5C6B3E'); rrect(g, -6, 8, 74, 10, 4, '#5C6B3E'); g.restore();
  rrect(g, -30, -6, 60, 30, 8, '#6E7D4A'); shape(g, [[-50, 24], [50, 24], [40, 34], [-40, 34]], '#4C5636');
  end(g);
}
export function tank(g, x, y, s, o = {}) {
  begin(g, x, y, s, o); const c = o.color || '#5E6E3E';
  rrect(g, -56, 4, 112, 30, 15, '#3A3F44'); for (let i = -42; i <= 42; i += 21) circ(g, i, 19, 8, '#6B7178');
  rrect(g, -50, -14, 100, 22, 8, c); rrect(g, -26, -36, 52, 26, 12, shadeHex(c, 0.08)); rrect(g, 24, -30, 52, 9, 4, shadeHex(c, -0.1));
  if (o.star) { g.fillStyle = '#FFD84A'; starPath(g, 0, -23, 8); g.fill(); }
  end(g);
}
export function ship(g, x, y, s, o = {}) {
  begin(g, x, y, s, o); const bob = Math.sin((o.t || 0) * 2) * 3; g.translate(0, bob);
  shape(g, [[-70, 0], [70, 0], [56, 22], [-60, 22]], o.color || '#7E8A94'); rrect(g, -30, -24, 50, 24, 4, '#9AA5AE'); rrect(g, -10, -42, 16, 18, 3, '#6C7780');
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-80, 26); g.quadraticCurveTo(-60, 20, -40, 26); g.moveTo(40, 26); g.quadraticCurveTo(60, 20, 80, 26); g.stroke();
  end(g);
}
export function parachute(g, x, y, s, o = {}) {
  begin(g, x, y, s, o); const sw = Math.sin((o.t || 0) * 2) * 0.12; g.rotate(sw);
  g.beginPath(); g.arc(0, -30, 44, Math.PI, 0); g.closePath(); g.fillStyle = '#E8E4D8'; g.fill(); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.moveTo(-44, -30); g.lineTo(-6, 30); g.moveTo(44, -30); g.lineTo(6, 30); g.moveTo(0, -30); g.lineTo(0, 30); g.stroke();
  g.lineWidth = 5; rrect(g, -14, 28, 28, 24, 4, '#8B6B3E'); end(g);
}
// tai lieu: to giay co nhan do o tren
export function doc(g, x, y, s, o = {}) {
  begin(g, x, y, s, o);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 18; g.shadowOffsetY = 8; rrect(g, -60, -80, 120, 160, 6, o.paper || '#F1E6CC', false); g.restore();
  g.strokeStyle = OL; g.lineWidth = 4; g.beginPath(); g.roundRect(-60, -80, 120, 160, 6); g.stroke();
  if (o.tag) { g.fillStyle = o.tagColor || '#C9473B'; g.fillRect(-48, -64, 96, 22); text(g, o.tag, 0, -53, { size: 15, weight: 800, color: '#FFF', font: '"Be Vietnam Pro", sans-serif' }); }
  g.fillStyle = 'rgba(60,60,60,0.45)'; for (let i = 0; i < (o.lines ?? 6); i++) g.fillRect(-46, -30 + i * 16, 92 - (i % 3) * 18, 6);
  if (o.seal) { circ(g, 38, 58, 13, '#C9473B'); g.fillStyle = '#C9473B'; g.beginPath(); g.moveTo(30, 66); g.lineTo(26, 84); g.lineTo(36, 76); g.lineTo(44, 84); g.lineTo(44, 66); g.fill(); }
  if (o.cross) { g.strokeStyle = '#D9473B'; g.lineWidth = 9; const k = clamp(o.cross); g.beginPath(); g.moveTo(-50, -60); g.lineTo(-50 + 100 * k, -60 + 120 * k); g.stroke(); if (k > 0.5) { const k2 = (k - 0.5) * 2; g.beginPath(); g.moveTo(50, -60); g.lineTo(50 - 100 * k2, -60 + 120 * k2); g.stroke(); } }
  end(g);
}
// con dau do (xoay nghieng), k: 0..1 hieu ung dap
export function stamp(g, x, y, str, size = 40, k = 1, o = {}) {
  if (k <= 0) return; const sc = 1 + (1 - ease.out(clamp(k))) * 1.6;
  g.save(); g.translate(x, y); g.rotate(o.rot ?? -0.18); g.scale(sc, sc); g.globalAlpha *= clamp(k * 2);
  g.font = `900 ${size}px "Be Vietnam Pro", sans-serif`; const lines = String(str).split('\n'); const w = Math.max(...lines.map((l) => g.measureText(l).width)) + size, h = lines.length * size * 1.15 + size * 0.5;
  g.strokeStyle = o.color || '#D9473B'; g.lineWidth = size * 0.12; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, size * 0.2); g.stroke();
  lines.forEach((l, i) => text(g, l, 0, -h / 2 + size * 0.25 + size * 1.15 * (i + 0.5), { size: i ? size * 0.75 : size, weight: 900, color: o.color || '#D9473B', font: '"Be Vietnam Pro", sans-serif' }));
  g.restore();
}
export function building(g, x, y, s, o = {}) {
  begin(g, x, y, s, o); const k = o.kind || 'house';
  if (k === 'station') { shape(g, [[-70, -10], [0, -50], [70, -10]], '#B5643C'); rrect(g, -60, -10, 120, 60, 2, '#E6CFA0'); rrect(g, -12, 14, 24, 36, 2, '#7A5236'); circ(g, 0, -22, 10, '#FFF'); [[-40, 6], [28, 6]].forEach(([a, b]) => rrect(g, a, b, 14, 14, 2, '#4C6E9A')); g.fillStyle = OL; g.fillRect(-80, 52, 160, 5); for (let i = -76; i < 80; i += 12) g.fillRect(i, 44, 4, 14); }
  else if (k === 'warehouse') { shape(g, [[-70, -10], [-60, -40], [60, -40], [70, -10]], '#9C8159'); rrect(g, -66, -10, 132, 60, 2, '#B89A6C'); shape(g, [[-30, 50], [-30, 4], [30, 4], [30, 50]], '#7A6040'); g.beginPath(); g.moveTo(-30, 4); g.lineTo(30, 50); g.moveTo(30, 4); g.lineTo(-30, 50); g.stroke(); rrect(g, -86, 30, 20, 20, 2, '#C9A46A'); rrect(g, 66, 30, 20, 20, 2, '#C9A46A'); }
  else if (k === 'capitol') { rrect(g, -80, 30, 160, 16, 2, '#E8E8E8'); rrect(g, -70, -10, 140, 40, 2, '#F2F2F2'); for (let i = -58; i <= 58; i += 23) rrect(g, i - 5, -6, 10, 34, 2, '#C8CCD2'); shape(g, [[-74, -10], [74, -10], [60, -22], [-60, -22]], '#E8E8E8'); g.beginPath(); g.arc(0, -22, 34, Math.PI, 0); g.fillStyle = '#F2F2F2'; g.fill(); g.stroke(); rrect(g, -4, -70, 8, 14, 2, '#E8E8E8'); }
  else if (k === 'factory') { rrect(g, -70, -10, 140, 60, 2, '#8C8F94'); shape(g, [[-70, -10], [-40, -36], [-40, -10], [-10, -36], [-10, -10], [20, -36], [20, -10]], '#A6A9AE'); rrect(g, 34, -60, 20, 50, 2, '#6C6F74'); }
  else if (k === 'bunker') { g.beginPath(); g.ellipse(0, 20, 76, 40, 0, Math.PI, 0); g.closePath(); g.fillStyle = '#7C7556'; g.fill(); g.stroke(); rrect(g, -30, 2, 60, 12, 3, '#2A2A26'); for (let i = -60; i <= 60; i += 20) rrect(g, i - 8, 18, 16, 10, 4, '#C2B07A'); }
  else if (k === 'hospital') { rrect(g, -60, -30, 120, 80, 4, '#F2F2F2'); g.fillStyle = '#D9473B'; g.fillRect(-8, -20, 16, 40); g.fillRect(-20, -8, 40, 16); }
  else if (k === 'bridge') { g.lineWidth = 6; g.beginPath(); g.moveTo(-90, 10); g.lineTo(90, 10); g.stroke(); for (let i = -60; i <= 60; i += 60) { g.beginPath(); g.arc(i, 10, 30, Math.PI, 0); g.stroke(); } g.fillStyle = '#5E9BD0'; g.fillRect(-90, 22, 180, 16); }
  else if (k === 'monument') { shape(g, [[-14, 40], [-8, -70], [8, -70], [14, 40]], '#D8D2C2'); rrect(g, -44, 40, 88, 14, 2, '#B9B2A0'); g.fillStyle = '#FFD84A'; starPath(g, 0, -82, 12); g.fill(); }
  else { shape(g, [[-60, -6], [0, -50], [60, -6]], '#B5643C'); rrect(g, -50, -6, 100, 56, 2, '#E6CFA0'); rrect(g, -12, 20, 24, 30, 2, '#7A5236'); }
  end(g);
}
export function candle(g, x, y, s, t = 0, seed = 0) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
  g.fillStyle = '#EDE4CF'; g.fillRect(-8, -10, 16, 60);
  const f = 1 + Math.sin(t * 9 + seed) * 0.12 + Math.sin(t * 23 + seed * 2) * 0.06;
  const rg = g.createRadialGradient(0, -24, 2, 0, -24, 60 * f); rg.addColorStop(0, 'rgba(255,200,90,0.55)'); rg.addColorStop(1, 'rgba(255,160,40,0)'); g.fillStyle = rg; g.beginPath(); g.arc(0, -24, 60 * f, 0, 7); g.fill();
  g.fillStyle = '#FFD25A'; g.beginPath(); g.ellipse(0, -24, 7 * f, 16 * f, 0, 0, 7); g.fill(); g.fillStyle = '#FFF6D0'; g.beginPath(); g.ellipse(0, -20, 3, 7, 0, 0, 7); g.fill();
  g.restore();
}
export function binoculars(g, x, y, s, o = {}) { begin(g, x, y, s, o); rrect(g, -42, -20, 34, 50, 12, '#3A3F44'); rrect(g, 8, -20, 34, 50, 12, '#3A3F44'); rrect(g, -10, -6, 20, 16, 4, '#2A2E33'); circ(g, -25, 30, 12, '#9FD3F5'); circ(g, 25, 30, 12, '#9FD3F5'); end(g); }
export function radio(g, x, y, s, o = {}) { begin(g, x, y, s, o); rrect(g, -50, -30, 100, 70, 8, '#5C6B3E'); circ(g, -22, 4, 14, '#2A2E33'); rrect(g, 4, -14, 34, 12, 3, '#2A2E33'); rrect(g, 4, 6, 34, 12, 3, '#C9A24A'); g.beginPath(); g.moveTo(36, -30); g.lineTo(52, -86); g.stroke(); end(g); }
export function sack(g, x, y, s, o = {}) { begin(g, x, y, s, o); g.beginPath(); g.moveTo(-34, 40); g.quadraticCurveTo(-46, -10, -20, -34); g.lineTo(20, -34); g.quadraticCurveTo(46, -10, 34, 40); g.closePath(); g.fillStyle = '#D6C49A'; g.fill(); g.stroke(); g.beginPath(); g.moveTo(-22, -34); g.lineTo(0, -46); g.lineTo(22, -34); g.stroke(); if (o.label) text(g, o.label, 0, 6, { size: 18, weight: 800, color: '#6A4E2A' }); end(g); }
export function crate(g, x, y, s, o = {}) { begin(g, x, y, s, o); rrect(g, -40, -36, 80, 72, 4, '#9C7A4C'); g.beginPath(); g.moveTo(-40, -36); g.lineTo(40, 36); g.moveTo(40, -36); g.lineTo(-40, 36); g.stroke(); end(g); }
export function shell(g, x, y, s, o = {}) { begin(g, x, y, s, o); shape(g, [[-14, 40], [-14, -10], [0, -44], [14, -10], [14, 40]], '#C9A24A'); g.fillStyle = '#8C6E2E'; g.fillRect(-14, 24, 28, 8); end(g); }
export function bomb(g, x, y, s, o = {}) { begin(g, x, y, s, o); g.beginPath(); g.ellipse(0, 0, 18, 40, 0, 0, 7); g.fillStyle = '#4A5058'; g.fill(); g.stroke(); shape(g, [[-18, -34], [0, -56], [18, -34]], '#3A3F44'); end(g); }
export function avatar(g, x, y, s, o = {}) { begin(g, x, y, s, o); circ(g, 0, 0, 50, o.bg || '#3B4656'); g.save(); g.beginPath(); g.arc(0, 0, 48, 0, 7); g.clip(); g.fillStyle = o.fg || '#8C97A8'; g.beginPath(); g.arc(0, -12, 20, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, 46, 38, 34, 0, 0, 7); g.fill(); g.restore(); end(g); }
export function flagIcon(g, x, y, s, flag = 'vn', t = 0) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.strokeStyle = '#E8E2D0'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 50); g.lineTo(0, -60); g.stroke();
  const w = Math.sin(t * 6) * 5, F = FLAGS[flag] || FLAGS.vn;
  g.save(); g.beginPath(); g.moveTo(0, -60); g.quadraticCurveTo(35, -60 + w, 70, -58); g.lineTo(70, -14); g.quadraticCurveTo(35, -16 + w, 0, -16); g.closePath(); g.clip(); F(g, 0, -60, 70, 46); g.restore(); g.restore();
}
export function starPath(g, cx, cy, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); }
export const FLAGS = {
  vn: (g, x, y, w, h) => { g.fillStyle = '#DA251D'; g.fillRect(x, y, w, h); g.fillStyle = '#FFDD00'; starPath(g, x + w / 2, y + h / 2, h * 0.32); g.fill(); },
  fr: (g, x, y, w, h) => { g.fillStyle = '#0055A4'; g.fillRect(x, y, w / 3, h); g.fillStyle = '#FFF'; g.fillRect(x + w / 3, y, w / 3, h); g.fillStyle = '#EF4135'; g.fillRect(x + 2 * w / 3, y, w / 3 + 1, h); },
  us: (g, x, y, w, h) => { for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#FFF' : '#B22234'; g.fillRect(x, y + i * h / 7, w, h / 7 + 1); } g.fillStyle = '#3C3B6E'; g.fillRect(x, y, w * 0.42, h * 0.55); },
  ussr: (g, x, y, w, h) => { g.fillStyle = '#CC0000'; g.fillRect(x, y, w, h); g.fillStyle = '#FFD700'; starPath(g, x + w * 0.2, y + h * 0.22, h * 0.1); g.fill(); },
  cn: (g, x, y, w, h) => { g.fillStyle = '#DE2910'; g.fillRect(x, y, w, h); g.fillStyle = '#FFDE00'; starPath(g, x + w * 0.2, y + h * 0.3, h * 0.16); g.fill(); },
};
// ---- hieu ung
// vu no: k 0..1 (tien trinh), co cau lua + khoi + manh vang
export function explosion(g, x, y, s, k, seed = 1) {
  if (k <= 0 || k >= 1) return; const r = rng(seed);
  const R = s * (0.3 + ease.out(clamp(k * 1.6)) * 0.8);
  // khoi
  for (let i = 0; i < 7; i++) { const a = r() * 7, d = R * (0.3 + r() * 0.5) * (0.6 + k), rr = R * (0.35 + r() * 0.3) * (0.7 + k * 0.6); g.fillStyle = `rgba(${70 + r() * 30},${66 + r() * 20},${64},${0.75 * (1 - k)})`; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 - k * s * 0.4, rr, 0, 7); g.fill(); }
  // lua
  if (k < 0.6) { const q = 1 - k / 0.6; const rg = g.createRadialGradient(x, y, 0, x, y, R); rg.addColorStop(0, `rgba(255,252,220,${q})`); rg.addColorStop(0.35, `rgba(255,190,70,${q})`); rg.addColorStop(0.75, `rgba(230,90,30,${0.8 * q})`); rg.addColorStop(1, 'rgba(160,40,20,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill(); }
  // manh
  g.fillStyle = `rgba(255,210,120,${1 - k})`; for (let i = 0; i < 10; i++) { const a = r() * 7, d = s * (0.2 + k * (0.6 + r() * 0.6)); g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d - k * k * s * 0.2, 4, 4); }
}
export function smoke(g, x, y, s, t, seed = 1) {
  const r = rng(seed);
  for (let i = 0; i < 6; i++) { const ph = (t * 0.35 + i / 6) % 1, ox = (r() - 0.5) * s * 0.3 + ph * s * 0.25; g.fillStyle = `rgba(60,60,64,${0.5 * (1 - ph)})`; g.beginPath(); g.arc(x + ox, y - ph * s * 1.2, s * (0.15 + ph * 0.3), 0, 7); g.fill(); }
}
export function fire(g, x, y, s, t, seed = 1) {
  for (let i = 0; i < 3; i++) { const f = 1 + Math.sin(t * 12 + i * 2 + seed) * 0.15; g.fillStyle = ['rgba(230,80,30,0.85)', 'rgba(255,170,50,0.9)', 'rgba(255,240,170,0.95)'][i]; g.beginPath(); g.ellipse(x, y - s * 0.25 * (1 - i * 0.2), s * (0.28 - i * 0.07) * f, s * (0.45 - i * 0.1) * f, 0, 0, 7); g.fill(); }
}
export function glowDot(g, x, y, r, col = '255,196,107', a = 0.85) { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(${col},${a})`); rg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
export function shadeHex(c, k) { const n = parseInt(c.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; const f = (v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return `rgb(${f(r)},${f(gg)},${f(b)})`; }
export const PROPS = { plane, truck, bicycle, cannon, aagun, tank, ship, parachute, doc, building, binoculars, radio, sack, crate, shell, bomb, avatar };
// ve icon theo ten: 'plane:bomber', 'building:station', 'truck'...
export function icon(g, name, x, y, s, o = {}) { const [a, b] = String(name).split(':'); const f = PROPS[a]; if (!f) return; f(g, x, y, s, b ? { ...o, kind: b } : o); }

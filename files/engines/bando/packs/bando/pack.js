// pack.js — Bo phong cach "bando": Dark Map Documentary + Countryball (1080p, nen toi, Countryball 2 mat).
import { E, registerShot, img, text } from '/engine/core.js';
import { loadWorld } from '../doodle/map.js';
import './templates.js';
export * from './countryball.js';
export * from './hud.js';
export * from './templates.js';

export async function init(E) {
  // Mac dinh nen toi
  E.cfg.style = 'dark';
  E.cfg.bars = 'none';
  E.cfg.captionStyle = 'cinematic';
  await loadWorld().catch(() => {});
}

// Phu de kieu phim tai lieu
export function captions(g, ws, idx, t, style) {
  // Nhóm cố định ~7 chữ (không trượt từng chữ gây rung mắt). Trước đây chuỗi font sai cú pháp
  // khiến trình duyệt rơi về chữ 10px — phụ đề gần như không đọc được.
  const N = E.vertical ? 5 : 7;
  const st = Math.floor(idx / N) * N;
  const words = ws.slice(st, st + N).map(w => w.w.replace(/[“”"]/g, ''));
  const str = words.join(' ');
  const size = E.vertical ? 58 : 46;
  const y = E.H * (E.vertical ? 0.80 : 0.905);
  g.save();
  g.font = `700 ${size}px "Be Vietnam Pro", sans-serif`;
  const tw = g.measureText(str).width;
  g.fillStyle = 'rgba(8, 12, 18, 0.55)';
  g.beginPath();
  g.roundRect(E.W / 2 - tw / 2 - 26, y - size * 0.82, tw + 52, size * 1.64, 14);
  g.fill();
  g.restore();
  text(g, str, E.W / 2, y, {
    size,
    font: '"Be Vietnam Pro", sans-serif',
    weight: 700,
    color: '#F2F2F2',
    stroke: 5,
    strokeColor: '#0E141C'
  });
}


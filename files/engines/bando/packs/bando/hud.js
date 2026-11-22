// hud.js — Ve cac thanh phan co dinh: Huy hieu ngay thang (flip so), Bo dem tien do, Minimap the gioi
import { E, clamp, ease } from '/engine/core.js';

export function drawHUD(g, o = {}) {
  // Không còn ngày mặc định 18.12.1972: chỉ hiện khi kịch bản có mốc thời gian thật
  const dateStr = String(o.date || o.hudDate || (E.cfg && E.cfg.hudDate) || '');
  const counterStr = String(o.counter || '');
  if (!dateStr && !counterStr && !(E.cfg && E.cfg.hudMinimap)) return;
  const flip = o.flip || 0; // 0..1 tien trinh lat so

  // 1. Huy hieu ngay thang (goc tren trai, x=80, y=60)
  const hx = 80, hy = 60, hw = 300, hh = 75;
  g.save();
  if (dateStr) {
  g.fillStyle = 'rgba(20, 27, 37, 0.9)'; // #141B25
  g.strokeStyle = '#C9A24A'; // Vang dong
  g.lineWidth = 2.5;

  g.beginPath();
  g.roundRect(hx, hy, hw, hh, 16);
  g.fill();
  g.stroke();

  // Icon lich ben trai
  g.fillStyle = '#C9A24A';
  g.fillRect(hx + 20, hy + 22, 28, 30);
  g.fillStyle = '#FFFFFF';
  g.fillRect(hx + 24, hy + 32, 20, 16);

  // Chu ngay thang bold 44px
  g.font = 'bold 38px "Be Vietnam Pro", sans-serif';
  g.fillStyle = '#FFFFFF';
  g.textAlign = 'left';
  g.textBaseline = 'middle';

  // Hieu ung lat so neu dang flip
  if (flip > 0 && flip < 1) {
    g.save();
    g.translate(hx + 70, hy + hh / 2);
    const scaleY = Math.cos(flip * Math.PI);
    g.scale(1, scaleY);
    g.fillText(dateStr, 0, 0);
    g.restore();
  } else {
    g.fillText(dateStr, hx + 70, hy + hh / 2);
  }

  }
  if (counterStr) {
  // 2. Bo dem tien do vien thuoc bo tron (ngay duoi huy hieu)
  const px = hx, py = hy + hh + 14, pw = 160, ph = 40;
  g.fillStyle = 'rgba(20, 27, 37, 0.85)';
  g.strokeStyle = '#7F8A99'; // Xam
  g.lineWidth = 1.5;

  g.beginPath();
  g.roundRect(px, py, pw, ph, 20);
  g.fill();
  g.stroke();

  // Icon trang / sao nho
  g.fillStyle = '#FFC46B';
  g.beginPath();
  g.arc(px + 22, py + ph / 2, 8, 0, Math.PI * 2);
  g.fill();

  g.font = '600 20px "Be Vietnam Pro", sans-serif';
  g.fillStyle = '#F2F2F2';
  g.fillText(counterStr, px + 40, py + ph / 2);

  }
  if (E.cfg && E.cfg.hudMinimap) {
  // 3. Minimap the gioi o goc duoi phai (260x150, x=W - 340, y=H - 210)
  const mx = E.W - 340, my = E.H - 210, mw = 260, mh = 150;
  g.fillStyle = 'rgba(20, 27, 37, 0.85)';
  g.strokeStyle = '#C9A24A';
  g.lineWidth = 1.5;

  g.beginPath();
  g.roundRect(mx, my, mw, mh, 10);
  g.fill();
  g.stroke();

  // Nen the gioi xam mo toi gian ben trong minimap
  g.fillStyle = 'rgba(53, 59, 68, 0.7)';
  // Bieu thi khoi chau luc co ban
  g.fillRect(mx + 30, my + 30, 70, 45); // Chau My
  g.fillRect(mx + 115, my + 25, 95, 55); // A-Au
  g.fillRect(mx + 120, my + 85, 45, 45); // Chau Phi
  g.fillRect(mx + 195, my + 100, 45, 35); // Chau Uc

  // Khung chu nhat do danh dau vung Viet Nam / Dong Nam A dang xem
  g.strokeStyle = '#E5484D';
  g.lineWidth = 2;
  g.strokeRect(mx + 175, my + 60, 30, 30);

  }
  g.restore();
}


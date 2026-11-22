// templates.js — 48 Mẫu Cảnh Chuẩn Motion Graphics (Dark Map Documentary + Countryball)
// Bao gồm 7 nhóm: [1] MAP (M1-M12), [2] BALL (B1-B6), [3] DATA (D1-D8), [4] ARCHIVE (A1-A6),
// [5] EXPLAIN (E1-E6), [6] MOOD (F1-F6), [7] CHAPTER (C1-C4)
import { E, registerShot, registerTemplate, text, img, clamp, ease } from '/engine/core.js';
import { drawCountryball } from './countryball.js';
import { drawHUD } from './hud.js';
import { drawMap as rawDrawMap } from '../doodle/map.js';

// Cache bản đồ nền vào Offscreen Canvas để tăng tốc vẽ cảnh bản đồ gấp 20 lần
const _mapCache = new Map();
function drawMap(g, view = 'vn', opts = {}) {
  const hl = opts.highlight ? JSON.stringify(opts.highlight) : '';
  const key = `${view}|${opts.sea || ''}|${opts.land || ''}|${hl}|${E.W}x${E.H}`;
  let cv = _mapCache.get(key);
  if (!cv && typeof document !== 'undefined') {
    cv = document.createElement('canvas');
    cv.width = E.W;
    cv.height = E.H;
    const cg = cv.getContext('2d', { alpha: false });
    rawDrawMap(cg, view, opts);
    if (_mapCache.size > 16) {
      const firstKey = _mapCache.keys().next().value;
      _mapCache.delete(firstKey);
    }
    _mapCache.set(key, cv);
  }
  if (cv) {
    g.drawImage(cv, 0, 0, E.W, E.H);
  } else {
    rawDrawMap(g, view, opts);
  }
}

// Bảng màu chuẩn ADN Motion Graphics
export const COLOR = {
  sea: '#1B2633',          // Nền biển tối
  land: '#353B44',         // Đất nền lạnh
  vn: '#B8897C',           // Đất Việt Nam / Đất chính
  ancient: '#C47A4E',      // Đất nung cổ đại
  copper: '#6E8F7A',       // Đồng xanh cổ đại
  gold: '#F5C443',         // Vàng nhấn thương hiệu, số liệu, HUD
  danger: '#E0453A',       // Đỏ cảnh báo, gạch chéo, tâm ngắm
  text: '#F2F2F2',         // Chữ chính
  radar: '#00FF66',        // Xanh phosphor radar
  hudBorder: '#F5C443'     // Viền vàng HUD
};

function wrapDef(def) {
  if (def._wrapped) return def;
  const raw = def.draw;
  const wrapped = {
    ...def,
    _wrapped: true,
    draw(g, lt, infoOrDur, maybeO) {
      let dur = 3.5;
      let o = {};
      if (typeof infoOrDur === 'number') {
        dur = infoOrDur || 3.5;
        o = maybeO || {};
      } else if (infoOrDur && typeof infoOrDur === 'object') {
        dur = infoOrDur.dur || 3.5;
        const sh = infoOrDur.shot || {};
        o = { ...sh, ...(sh.hud || {}), ...(infoOrDur.args || {}) };
      }
      return raw.call(this, g, lt, dur, o);
    }
  };
  return wrapped;
}

function helperRegister(code, name, def) {
  const w = wrapDef(def);
  registerShot(code, w);
  registerTemplate(code, w);
  if (name && name !== code) {
    registerShot(name, w);
    registerTemplate(name, w);
  }
}

// ============================================================================
// [1] NHÓM BẢN ĐỒ (MAP) — M1 đến M12
// ============================================================================

// M1: map_overview — Toàn cảnh khu vực, lãnh thổ tô màu từ từ, nhãn biển mờ
const tpl_M1 = {
  draw(g, lt, dur, o = {}) {
    const p = lt / dur;
    const zoom = 1 + p * 0.06;
    g.save();
    g.translate(E.W / 2, E.H / 2);
    g.scale(zoom, zoom);
    g.translate(-E.W / 2, -E.H / 2);

    drawMap(g, (o.view ?? 'vn'), {
      sea: COLOR.sea,
      land: COLOR.land,
      highlight: { 'Việt Nam': o.era === 'ancient' ? COLOR.ancient : COLOR.vn },
      islands: true,
      islandLabels: true
    });

    // Điểm nóng phát sáng nhẹ
    const gx = o.gx || E.W * 0.52;
    const gy = o.gy || E.H * 0.35;
    const gr = 35 + Math.sin(lt * 4) * 8;
    const rad = g.createRadialGradient(gx, gy, 5, gx, gy, gr * 2);
    rad.addColorStop(0, 'rgba(245, 196, 67, 0.85)');
    rad.addColorStop(1, 'rgba(224, 69, 58, 0)');
    g.fillStyle = rad;
    g.beginPath();
    g.arc(gx, gy, gr * 2, 0, Math.PI * 2);
    g.fill();

    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M1', 'map_overview', tpl_M1);
registerShot('map_establish', tpl_M1);

// M2: map_zoom_hotspot — Zoom mạnh vào 1 điểm/cứ điểm mục tiêu
const tpl_M2 = {
  draw(g, lt, dur, o = {}) {
    const p = clamp(lt / (dur * 0.45), 0, 1);
    const z = 1 + ease(p) * (o.targetZoom || 2.2);
    const cx = o.cx || E.W * 0.54;
    const cy = o.cy || E.H * 0.32;

    g.save();
    g.translate(cx, cy);
    g.scale(z, z);
    g.translate(-cx, -cy);

    drawMap(g, (o.view ?? 'vnNorth'), {
      sea: COLOR.sea,
      land: COLOR.land,
      highlight: { 'Việt Nam': COLOR.vn },
      islands: true
    });

    // Quầng sáng cam nhịp thở
    const glowR = 25 + Math.sin(lt * 6) * 10;
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 3 / z;
    g.beginPath();
    g.arc(cx, cy, glowR, 0, Math.PI * 2);
    g.stroke();

    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M2', 'map_zoom_hotspot', tpl_M2);
registerShot('map_zoom', tpl_M2);

// M3: map_border_morph — Biên giới co giãn qua các năm, số flip liên tục
const tpl_M3 = {
  draw(g, lt, dur, o = {}) {
    drawMap(g, (o.view ?? 'vn'), { sea: COLOR.sea, land: COLOR.land, highlight: { 'Việt Nam': COLOR.vn } });

    // Vạch biên giới / vĩ tuyến 17 chạy ngang
    const yLine = E.H * 0.52;
    g.save();
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 5;
    g.setLineDash([16, 10]);
    g.lineDashOffset = -lt * 40;
    g.beginPath();
    g.moveTo(E.W * 0.25, yLine);
    g.lineTo(E.W * 0.75, yLine);
    g.stroke();

    text(g, (o.label ?? 'VĨ TUYẾN 17 — GIỚI TUYẾN QUÂN SỰ TẠM THỜI'), E.W / 2, yLine - 30, {
      size: 28, weight: 800, color: COLOR.gold
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M3', 'map_border_morph', tpl_M3);
registerShot('map_border', tpl_M3);

// M4: map_route_draw — Tuyến đường hành quân / đường bay nét đứt vẽ dần
const tpl_M4 = {
  draw(g, lt, dur, o = {}) {
    drawMap(g, (o.view ?? 'vn'), { sea: COLOR.sea, land: COLOR.land, highlight: { 'Việt Nam': COLOR.vn } });
    const p = clamp(lt / (dur * 0.8), 0, 1);

    const pts = o.points || [
      { x: E.W * 0.75, y: E.H * 0.8 },
      { x: E.W * 0.65, y: E.H * 0.5 },
      { x: E.W * 0.52, y: E.H * 0.3 }
    ];

    g.save();
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 4;
    g.setLineDash([12, 8]);

    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    const curIdx = Math.min(pts.length - 1, Math.floor(p * (pts.length - 1)) + 1);
    for (let i = 1; i < curIdx; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }
    const prev = pts[curIdx - 1];
    const curr = pts[curIdx];
    const segP = (p * (pts.length - 1)) - (curIdx - 1);
    const ix = prev.x + (curr.x - prev.x) * segP;
    const iy = prev.y + (curr.y - prev.y) * segP;
    g.lineTo(ix, iy);
    g.stroke();

    // Mũi nhọn dẫn đầu
    g.fillStyle = COLOR.danger;
    g.beginPath();
    g.arc(ix, iy, 9, 0, Math.PI * 2);
    g.fill();
    g.restore();

    drawHUD(g, o);
  }
};
helperRegister('M4', 'map_route_draw', tpl_M4);
registerShot('map_route', tpl_M4);

// M5: map_arrows_battle — Mũi tên tấn công dày kiểu bản đồ tham mưu ép nhau
const tpl_M5 = {
  draw(g, lt, dur, o = {}) {
    drawMap(g, (o.view ?? 'vn'), { sea: COLOR.sea, land: COLOR.land });
    const p = clamp(lt / dur, 0, 1);

    g.save();
    // Mũi kìm trái
    drawArrowCurved(g, E.W * 0.25, E.H * 0.4, E.W * 0.46, E.H * 0.52, p, COLOR.gold);
    // Mũi kìm phải
    drawArrowCurved(g, E.W * 0.75, E.H * 0.4, E.W * 0.54, E.H * 0.52, p, COLOR.gold);

    text(g, (o.title ?? 'CHIẾN THUẬT GỌNG KÌM BAO VÂY'), E.W / 2, 100, {
      size: 38, weight: 900, color: COLOR.gold
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M5', 'map_arrows_battle', tpl_M5);
registerShot('map_pincer', tpl_M5);

// M6: map_units_move — Đoàn xe vận tải / tàu thuyền kéo vệt sáng
const tpl_M6 = {
  draw(g, lt, dur, o = {}) {
    drawMap(g, (o.view ?? 'vn'), { sea: COLOR.sea, land: COLOR.land });
    g.save();
    for (let i = 0; i < 7; i++) {
      const prog = ((lt * 0.25) + i * 0.14) % 1;
      const x = E.W * 0.45 + prog * (E.W * 0.15) + Math.sin(prog * 8) * 15;
      const y = E.H * 0.25 + prog * (E.H * 0.5);

      g.fillStyle = COLOR.gold;
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();

      // Vệt sáng theo sau
      g.strokeStyle = 'rgba(245, 196, 67, 0.35)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 20, y - 25);
      g.stroke();
    }
    text(g, (o.label ?? 'ĐOÀN VẬN TẢI CHI VIỆN CHIẾN TRƯỜNG'), E.W / 2, 90, {
      size: 34, weight: 800, color: COLOR.gold
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M6', 'map_units_move', tpl_M6);
registerShot('map_convoy', tpl_M6);

// M7: map_siege — Thành trì ở giữa, vòng vây khép dần sóng đỏ
const tpl_M7 = {
  draw(g, lt, dur, o = {}) {
    drawMap(g, (o.view ?? 'vn'), { sea: COLOR.sea, land: COLOR.land });
    const cx = E.W / 2;
    const cy = E.H * 0.52;
    const p = lt / dur;

    g.save();
    // Vòng vây khép lại
    const r = (E.W * 0.35) * (1 - p * 0.45);
    g.strokeStyle = COLOR.danger;
    g.lineWidth = 4;
    g.setLineDash([14, 10]);
    g.lineDashOffset = lt * 30;
    g.beginPath();
    g.arc(cx, cy, Math.max(40, r), 0, Math.PI * 2);
    g.stroke();

    // Điểm căn cứ ở giữa
    g.fillStyle = COLOR.gold;
    g.beginPath();
    g.arc(cx, cy, 18, 0, Math.PI * 2);
    g.fill();

    text(g, (o.target ?? 'TẬP ĐOÀN CỨ ĐIỂM BỊ KHÉP VÒNG VÂY'), cx, cy - r - 30, {
      size: 32, weight: 800, color: COLOR.danger
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M7', 'map_siege', tpl_M7);
registerShot('map_zone', tpl_M7);

// M8: map_split_compare — Chia đôi màn hình: đối chiếu 2 vùng/2 thời điểm
const tpl_M8 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0F1620';
    g.fillRect(0, 0, E.W, E.H);

    // Vách ngăn đôi
    g.save();
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(E.W / 2, 0);
    g.lineTo(E.W / 2, E.H);
    g.stroke();

    text(g, (o.titleA ?? 'MIỀN BẮC — HẬU PHƯƠNG LỚN'), E.W * 0.25, 120, { size: 30, weight: 800, color: COLOR.gold });
    text(g, (o.titleB ?? 'MIỀN NAM — TIỀN TUYẾN LỚN'), E.W * 0.75, 120, { size: 30, weight: 800, color: COLOR.danger });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M8', 'map_split_compare', tpl_M8);
registerShot('map_split_dual', tpl_M8);

// M9: map_night_lights — Bản đồ ban đêm, thành phố sáng đèn, lửa trận
const tpl_M9 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#080C12';
    g.fillRect(0, 0, E.W, E.H);

    // Điểm lửa bốc sáng
    g.save();
    for (let i = 0; i < 5; i++) {
      const fx = E.W * (0.3 + i * 0.1);
      const fy = E.H * (0.4 + (i % 2) * 0.15);
      const fr = 20 + Math.sin(lt * 10 + i) * 6;
      const g1 = g.createRadialGradient(fx, fy, 4, fx, fy, fr * 2);
      g1.addColorStop(0, 'rgba(255, 180, 50, 0.9)');
      g1.addColorStop(1, 'rgba(224, 69, 58, 0)');
      g.fillStyle = g1;
      g.beginPath();
      g.arc(fx, fy, fr * 2, 0, Math.PI * 2);
      g.fill();
    }
    text(g, (o.label ?? 'ĐÊM KHÔNG KÍCH — BẢN ĐỒ CHIẾN TRƯỜNG RỰC LỬA'), E.W / 2, 100, {
      size: 36, weight: 800, color: COLOR.gold
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M9', 'map_night_lights', tpl_M9);

// M10: map_terrain_3d — Mặt cắt địa hình 2.5D (núi, sông, bãi cọc thủy triều)
const tpl_M10 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#101722';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    // Vẽ dòng sông nghiêng phối cảnh
    g.fillStyle = '#1B354D';
    g.beginPath();
    g.moveTo(E.W * 0.1, E.H);
    g.lineTo(E.W * 0.9, E.H);
    g.lineTo(E.W * 0.65, E.H * 0.35);
    g.lineTo(E.W * 0.45, E.H * 0.35);
    g.closePath();
    g.fill();

    // Bãi cọc gỗ nhô lên theo thủy triều rút
    const tide = Math.sin(lt * 2) * 15;
    g.fillStyle = '#785233';
    g.strokeStyle = '#2B1A0D';
    g.lineWidth = 2;
    for (let c = 0; c < 9; c++) {
      const cx = E.W * (0.35 + c * 0.04);
      const cy = E.H * 0.65 + (c % 3) * 30 + tide;
      g.fillRect(cx, cy, 10, 45);
      g.strokeRect(cx, cy, 10, 45);
    }

    text(g, (o.title ?? 'MẶT CẮT ĐỊA HÌNH & TRẬN ĐỊA BÃI CỌC BẠCH ĐẰNG'), E.W / 2, 90, {
      size: 36, weight: 900, color: COLOR.gold
    });
    text(g, (o.sub ?? ''), E.W / 2, 145, {
      size: 24, weight: 600, color: COLOR.text
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M10', 'map_terrain_3d', tpl_M10);

// M11: map_population_dots — Đám chấm/mini-ball dân số, di cư, sơ tán
const tpl_M11 = {
  draw(g, lt, dur, o = {}) {
    drawMap(g, (o.view ?? 'vn'), { sea: COLOR.sea, land: COLOR.land });
    g.save();
    for (let i = 0; i < 40; i++) {
      const p = ((lt * 0.15) + (i * 0.025)) % 1;
      const x = E.W * 0.48 + (Math.sin(i * 1.5) * 80) + p * 60;
      const y = E.H * 0.32 + (Math.cos(i * 1.8) * 60) + p * 120;
      g.fillStyle = i % 2 === 0 ? COLOR.gold : COLOR.text;
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
    }
    text(g, (o.label ?? 'LÀN SÓNG SƠ TÁN HÀNG VẠN DÂN CƯ'), E.W / 2, 90, {
      size: 34, weight: 800, color: COLOR.gold
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('M11', 'map_population_dots', tpl_M11);

// M12: minimap_jump — Bay vút từ minimap thế giới vào chiến trường chính
const tpl_M12 = {
  draw(g, lt, dur, o = {}) {
    const p = clamp(lt / (dur * 0.6), 0, 1);
    const z = 0.5 + ease(p) * 2.5;

    g.save();
    g.translate(E.W / 2, E.H / 2);
    g.scale(z, z);
    g.translate(-E.W / 2, -E.H / 2);

    drawMap(g, 'vn', { sea: COLOR.sea, land: COLOR.land, highlight: { 'Việt Nam': COLOR.vn } });
    g.restore();

    text(g, (o.title ?? 'CHUYỂN TIẾP CHIẾN TRƯỜNG'), E.W / 2, E.H * 0.85, {
      size: 36, weight: 900, color: COLOR.gold
    });
    drawHUD(g, o);
  }
};
helperRegister('M12', 'minimap_jump', tpl_M12);

// ============================================================================
// [2] NHÂN VẬT (BALL) — B1 đến B6
// ============================================================================

// B1: ball_stage — Nền đêm có sao, tiêu đề lớn ở giữa, hai ball hai góc
const tpl_B1 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0B111A';
    g.fillRect(0, 0, E.W, E.H);

    // Sao đêm lấp lánh
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 137) % E.W;
      const sy = (i * 83) % (E.H * 0.7);
      g.fillRect(sx, sy, 2, 2);
    }

    drawCountryball(g, E.W * 0.22, E.H * 0.62, 110, { flag: (o.flag1 ?? 'vn'), accessory: 'mu_coi', mood: 'confident', t: lt });
    drawCountryball(g, E.W * 0.78, E.H * 0.62, 110, { flag: (o.flag2 ?? 'us'), accessory: 'kinh_ram', mood: 'angry', look: -1, t: lt });

    text(g, (o.title ?? 'ĐỐI ĐẦU LỊCH SỬ'), E.W / 2, E.H * 0.32, { size: 52, weight: 900, color: COLOR.gold });
    text(g, (o.sub ?? 'CUỘC ĐỌ SỨC CHIẾN LƯỢC'), E.W / 2, E.H * 0.44, { size: 30, weight: 600, color: COLOR.text });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('B1', 'ball_stage', tpl_B1);

// B2: ball_dialogue — Hai ball đối thoại bằng bong bóng chữ ngắn
const tpl_B2 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#101620';
    g.fillRect(0, 0, E.W, E.H);

    drawCountryball(g, E.W * 0.3, E.H * 0.6, 120, {
      flag: (o.flag1 ?? 'vn'),
      accessory: (o.acc1 ?? 'mu_coi'),
      mood: (o.mood1 ?? 'confident'),
      speech: (o.speech1 ?? ''),
      t: lt
    });

    drawCountryball(g, E.W * 0.7, E.H * 0.6, 120, {
      flag: (o.flag2 ?? 'us'),
      accessory: (o.acc2 ?? 'kinh_ram'),
      mood: (o.mood2 ?? 'angry'),
      look: -1,
      speech: (o.speech2 ?? ''),
      t: lt
    });
    drawHUD(g, o);
  }
};
helperRegister('B2', 'ball_dialogue', tpl_B2);
registerShot('balls_dialogue', tpl_B2);

// B3: ball_spotlight — Một ball dưới đèn sân khấu cô lập
const tpl_B3 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#080B10';
    g.fillRect(0, 0, E.W, E.H);

    // Luồng đèn rọi hình nón
    const cx = E.W / 2;
    const cy = E.H * 0.58;
    g.save();
    const cone = g.createRadialGradient(cx, cy, 30, cx, cy, 260);
    cone.addColorStop(0, 'rgba(245, 196, 67, 0.45)');
    cone.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cone;
    g.beginPath();
    g.arc(cx, cy, 260, 0, Math.PI * 2);
    g.fill();

    drawCountryball(g, cx, cy, 130, {
      flag: (o.flag ?? 'us'),
      accessory: (o.acc ?? 'kinh_ram'),
      mood: (o.mood ?? 'shock'),
      sweat: true,
      t: lt
    });

    text(g, (o.name ?? 'QUYẾT ĐỊNH CÂN NÃO'), cx, E.H * 0.22, { size: 44, weight: 900, color: COLOR.gold });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('B3', 'ball_spotlight', tpl_B3);

// B4: ball_council — Nhiều ball ngồi quanh bàn họp/hội nghị
const tpl_B4 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0E141D';
    g.fillRect(0, 0, E.W, E.H);

    // Bàn đàm phán bầu dục
    g.save();
    g.fillStyle = '#223040';
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(E.W / 2, E.H * 0.65, E.W * 0.38, 90, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Các countryball quanh bàn
    drawCountryball(g, E.W * 0.25, E.H * 0.52, 70, { flag: 'vn', mood: 'confident', t: lt });
    drawCountryball(g, E.W * 0.42, E.H * 0.48, 65, { flag: 'ussr', mood: 'normal', t: lt });
    drawCountryball(g, E.W * 0.58, E.H * 0.48, 65, { flag: 'fr', mood: 'normal', t: lt });
    drawCountryball(g, E.W * 0.75, E.H * 0.52, 70, { flag: 'us', mood: 'squint', t: lt });

    text(g, (o.title ?? 'HỘI NGHỊ ĐÀM PHÁN ĐA PHƯƠNG'), E.W / 2, 90, { size: 40, weight: 900, color: COLOR.gold });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('B4', 'ball_council', tpl_B4);
registerShot('balls_council', tpl_B4);

// B5: ball_reaction — Ball phản ứng sốc/giận bên cạnh thẻ số liệu
const tpl_B5 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#111722';
    g.fillRect(0, 0, E.W, E.H);

    // Thẻ số liệu bên trái
    g.save();
    g.fillStyle = '#1A2332';
    g.strokeStyle = COLOR.danger;
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(E.W * 0.1, E.H * 0.25, E.W * 0.45, E.H * 0.5, 16);
    g.fill();
    g.stroke();

    text(g, (o.stat ?? '34 PHÁO ĐÀI BAY B-52'), E.W * 0.32, E.H * 0.42, { size: 36, weight: 900, color: COLOR.danger });
    text(g, (o.desc ?? 'BỊ BẮN HẠ TRONG 12 NGÀY ĐÊM'), E.W * 0.32, E.H * 0.54, { size: 24, weight: 600, color: COLOR.text });

    // Countryball sốc bên phải
    drawCountryball(g, E.W * 0.75, E.H * 0.55, 120, {
      flag: (o.flag ?? 'us'),
      accessory: 'kinh_ram',
      mood: 'shock',
      sweat: true,
      t: lt
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('B5', 'ball_reaction', tpl_B5);

// B6: ball_crowd — Đám đông ball dàn hàng tràn ngập bản đồ
const tpl_B6 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0F151F';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) {
        const bx = E.W * 0.18 + col * (E.W * 0.11);
        const by = E.H * 0.45 + row * 110;
        drawCountryball(g, bx, by, 45, {
          flag: (o.flag ?? 'vn'),
          accessory: 'mu_coi',
          mood: 'determined',
          t: lt + col * 0.2
        });
      }
    }
    text(g, (o.title ?? 'Ý CHÍ TOÀN DÂN ĐOÀN KẾT KHÁNG CHIẾN'), E.W / 2, 90, { size: 40, weight: 900, color: COLOR.gold });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('B6', 'ball_crowd', tpl_B6);
registerShot('ball_trench', tpl_B6);

// ============================================================================
// [3] DỮ LIỆU & CON SỐ (DATA) — D1 đến D8
// ============================================================================

// D1: stat_card — Một con số khổng lồ màu vàng đếm tăng tốc
const tpl_D1 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0E131C';
    g.fillRect(0, 0, E.W, E.H);

    // "500.000" / "500,000" / "1.2 triệu"… : đếm lên đúng giá trị, định dạng kiểu Việt Nam (500.000)
    const raw = String(o.value ?? '81').trim();
    const digits = raw.replace(/[.,\s]/g, '');
    const isNum = /^\d+$/.test(digits) && digits.length > 0;
    const p = clamp(lt / (dur * 0.65), 0, 1);
    const curVal = isNum ? Math.round(ease(p) * Number(digits)).toLocaleString('vi-VN') : raw;

    g.save();
    // Thanh đỏ bên trái
    g.fillStyle = COLOR.danger;
    g.fillRect(E.W * 0.15, E.H * 0.3, 12, E.H * 0.4);

    text(g, String(curVal) + (o.unit ? ' ' + o.unit : ''), E.W * 0.18, E.H * 0.48, {
      size: 110, weight: 900, color: COLOR.gold, align: 'left'
    });

    text(g, (o.label ?? 'MÁY BAY MỸ BỊ TIÊU DIỆT TẠI CHỖ'), E.W * 0.18, E.H * 0.62, {
      size: 32, weight: 700, color: COLOR.text, align: 'left'
    });

    text(g, (o.source ?? 'NGUỒN: BỘ TỔNG THAM MƯU QĐND VIỆT NAM'), E.W * 0.18, E.H * 0.72, {
      size: 20, weight: 500, color: 'rgba(242,242,242,0.5)', align: 'left'
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('D1', 'stat_card', tpl_D1);
registerShot('unit_spec', tpl_D1);

// D2: stat_grid — Lưới 3-4 ô số liệu quan trọng pop lần lượt
const tpl_D2 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0F151F';
    g.fillRect(0, 0, E.W, E.H);

    const items = o.items || [
      { num: '12', label: 'NGÀY ĐÊM CHIẾN ĐẤU' },
      { num: '81', label: 'MÁY BAY BỊ BẮN HẠ' },
      { num: '34', label: 'PHÁO ĐÀI BAY B-52' },
      { num: '43', label: 'PHI CÔNG BỊ BẮT' }
    ];

    g.save();
    text(g, (o.title ?? 'TỔNG HỢP CHIẾN DỊCH'), E.W / 2, 90, { size: 40, weight: 900, color: COLOR.gold });

    items.forEach((it, idx) => {
      const delay = idx * 0.12;
      const prog = clamp((lt / dur - delay) * 4, 0, 1);
      const sc = ease(prog);

      const x = E.W * (0.2 + (idx % 2) * 0.35);
      const y = E.H * (0.35 + Math.floor(idx / 2) * 0.3);

      g.save();
      g.translate(x + 120, y + 60);
      g.scale(sc, sc);
      g.translate(-x - 120, -y - 60);

      g.fillStyle = '#1A2332';
      g.strokeStyle = COLOR.gold;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(x, y, 280, 140, 12);
      g.fill();
      g.stroke();

      text(g, it.num, x + 140, y + 65, { size: 52, weight: 900, color: COLOR.gold });
      text(g, it.label, x + 140, y + 110, { size: 18, weight: 700, color: COLOR.text });
      g.restore();
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('D2', 'stat_grid', tpl_D2);
registerShot('stat_counter_grid', tpl_D2);

// D3: versus_compare — Hai cột đối đầu chạy đua
const tpl_D3 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0F141D';
    g.fillRect(0, 0, E.W, E.H);

    const p = clamp(lt / (dur * 0.7), 0, 1);
    g.save();
    text(g, (o.title ?? 'TƯƠNG QUAN LỰC LƯỢNG'), E.W / 2, 100, { size: 42, weight: 900, color: COLOR.gold });

    // Thanh bên A
    const wA = E.W * 0.35 * ease(p);
    g.fillStyle = COLOR.gold;
    g.fillRect(E.W * 0.1, E.H * 0.45, wA, 60);
    text(g, (o.nameA ?? 'ĐẠI VIỆT'), E.W * 0.1, E.H * 0.4, { size: 28, weight: 800, color: COLOR.gold, align: 'left' });

    // Thanh bên B
    const wB = E.W * 0.35 * ease(p);
    g.fillStyle = COLOR.danger;
    g.fillRect(E.W * 0.55, E.H * 0.45, wB, 60);
    text(g, (o.nameB ?? 'NGUYÊN MÔNG'), E.W * 0.55, E.H * 0.4, { size: 28, weight: 800, color: COLOR.danger, align: 'left' });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('D3', 'versus_compare', tpl_D3);
registerShot('stat_compare', tpl_D3);
registerShot('versus_clash', tpl_D3);

// D4: bar_race — Biểu đồ thanh ngang chạy đua
const tpl_D4 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0E131C';
    g.fillRect(0, 0, E.W, E.H);

    const p = clamp(lt / (dur * 0.8), 0, 1);
    g.save();
    text(g, (o.title ?? 'THỐNG KÊ CHIẾN LỆCH THEO GIAI ĐOẠN'), E.W / 2, 90, { size: 36, weight: 900, color: COLOR.gold });

    for (let i = 0; i < 4; i++) {
      const y = E.H * (0.28 + i * 0.14);
      const barW = (E.W * (0.2 + (i * 0.15))) * ease(p);

      g.fillStyle = i === 2 ? COLOR.danger : COLOR.gold;
      g.fillRect(E.W * 0.25, y, barW, 40);

      text(g, 'GIAI ĐOẠN ' + (i + 1), E.W * 0.23, y + 28, { size: 22, weight: 700, color: COLOR.text, align: 'right' });
    }
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('D4', 'bar_race', tpl_D4);

// D5: icon_count — Hàng icon nhân bản minh họa số lượng
const tpl_D5 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0F1622';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    text(g, (o.title ?? 'QUY MÔ KHÍ TÀI HUY ĐỘNG'), E.W / 2, 100, { size: 40, weight: 900, color: COLOR.gold });

    // Hàng icon máy bay/thuyền
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 10; c++) {
        const ix = E.W * 0.15 + c * (E.W * 0.075);
        const iy = E.H * 0.42 + r * 100;
        g.fillStyle = COLOR.gold;
        g.beginPath();
        g.moveTo(ix, iy - 20);
        g.lineTo(ix + 18, iy + 15);
        g.lineTo(ix - 18, iy + 15);
        g.closePath();
        g.fill();
      }
    }
    text(g, (o.desc ?? 'HÀNG TRĂM CHIẾN THUYỀN VÀ KHÍ TÀI CHỦ LỰC'), E.W / 2, E.H * 0.75, { size: 28, weight: 700, color: COLOR.text });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('D5', 'icon_count', tpl_D5);

// D6: timeline_horizontal — Trục thời gian ngang, các mốc pop lên
const tpl_D6 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0D121B';
    g.fillRect(0, 0, E.W, E.H);

    const p = clamp(lt / (dur * 0.8), 0, 1);
    g.save();
    text(g, (o.title ?? 'DIỄN BIẾN NIÊN BIỂU CHIẾN DỊCH'), E.W / 2, 90, { size: 38, weight: 900, color: COLOR.gold });

    // Trục ngang
    const yLine = E.H * 0.55;
    g.strokeStyle = 'rgba(255,255,255,0.2)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(E.W * 0.1, yLine);
    g.lineTo(E.W * 0.9, yLine);
    g.stroke();

    const mocs = o.milestones || ['18/12', '20/12', '26/12', '30/12'];
    mocs.forEach((m, idx) => {
      const mx = E.W * (0.2 + idx * 0.2);
      if (p >= idx / mocs.length) {
        g.fillStyle = COLOR.gold;
        g.beginPath();
        g.arc(mx, yLine, 12, 0, Math.PI * 2);
        g.fill();

        text(g, m, mx, yLine - 30, { size: 28, weight: 800, color: COLOR.gold });
      }
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('D6', 'timeline_horizontal', tpl_D6);

// D7: progress_bar — Thanh tiến độ % tăng dần
const tpl_D7 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#101722';
    g.fillRect(0, 0, E.W, E.H);

    const p = clamp(lt / (dur * 0.75), 0, 1);
    const pct = Math.round(ease(p) * 100);

    g.save();
    text(g, (o.label ?? 'TIẾN TRÌNH KHÉP CHẶT VÒNG VÂY'), E.W / 2, E.H * 0.38, { size: 36, weight: 800, color: COLOR.text });

    // Thanh viền
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 4;
    g.strokeRect(E.W * 0.2, E.H * 0.48, E.W * 0.6, 50);

    // Thanh ruột
    g.fillStyle = COLOR.danger;
    g.fillRect(E.W * 0.2 + 4, E.H * 0.48 + 4, (E.W * 0.6 - 8) * ease(p), 42);

    text(g, pct + '%', E.W / 2, E.H * 0.62, { size: 48, weight: 900, color: COLOR.gold });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('D7', 'progress_bar', tpl_D7);

// D8: record_card — Thẻ kỷ lục / lần đầu tiên trong lịch sử
const tpl_D8 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0B0F17';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    g.fillStyle = '#16202E';
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(E.W * 0.15, E.H * 0.22, E.W * 0.7, E.H * 0.56, 16);
    g.fill();
    g.stroke();

    text(g, '★ KỶ LỤC LỊCH SỬ CHƯA TỪNG CÓ ★', E.W / 2, E.H * 0.34, { size: 30, weight: 800, color: COLOR.gold });
    text(g, (o.title ?? 'LẦN ĐẦU TIÊN "SIÊU PHÁO ĐÀI BAY B-52" BỊ BẮN RƠI TẠI CHỖ'), E.W / 2, E.H * 0.48, { size: 38, weight: 900, color: COLOR.text });
    text(g, (o.desc ?? 'ĐẬP TAN HUYỀN THOẠI BẤT KHẢ XÂM PHẠM CỦA KHÔNG LỰC HOA KỲ'), E.W / 2, E.H * 0.62, { size: 26, weight: 600, color: COLOR.danger });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('D8', 'record_card', tpl_D8);

// ============================================================================
// [4] TƯ LIỆU LỊCH SỬ (ARCHIVE) — A1 đến A6
// ============================================================================

// A1: archive_photo — Ảnh polaroid nghiêng nhẹ, Ken Burns
const tpl_A1 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#121820';
    g.fillRect(0, 0, E.W, E.H);

    const zoom = 1 + (lt / dur) * 0.05;
    g.save();
    g.translate(E.W / 2, E.H * 0.48);
    g.rotate(-0.02);
    g.scale(zoom, zoom);

    // Khung polaroid
    g.fillStyle = '#E8E4D8';
    g.fillRect(-260, -180, 520, 360);

    // Ảnh đen trắng bên trong
    g.fillStyle = '#222222';
    g.fillRect(-240, -160, 480, 270);

    g.fillStyle = '#666666';
    text(g, '[ ẢNH TƯ LIỆU LỊCH SỬ ]', 0, -20, { size: 24, weight: 700, color: '#AAAAAA' });

    text(g, (o.caption ?? 'Ảnh: Viện Lịch sử Quân sự Việt Nam / Tư liệu lịch sử'), 0, 150, { size: 16, weight: 600, color: '#333333' });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('A1', 'archive_photo', tpl_A1);

// A2: newspaper — Trang báo cũ, tiêu đề in đậm giật tít
const tpl_A2 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0F141C';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    // Tờ báo ngả vàng
    g.fillStyle = '#EDE7D5';
    g.fillRect(E.W * 0.15, E.H * 0.15, E.W * 0.7, E.H * 0.7);

    // Tên báo
    text(g, (o.paper ?? 'BÁO QUÂN ĐỘI NHÂN DÂN'), E.W / 2, E.H * 0.25, { size: 36, weight: 900, color: '#1A1A1A' });

    // Dòng kẻ ngăn
    g.strokeStyle = '#1A1A1A';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(E.W * 0.2, E.H * 0.3);
    g.lineTo(E.W * 0.8, E.H * 0.3);
    g.stroke();

    // Tiêu đề giật tít lớn
    text(g, (o.headline ?? 'HÀ NỘI BẮN RƠI PHÁO ĐÀI BAY B-52!'), E.W / 2, E.H * 0.45, { size: 48, weight: 900, color: '#B30000' });
    text(g, (o.sub ?? 'Đòn trừng phạt đích đáng giáng vào không quân Mỹ'), E.W / 2, E.H * 0.56, { size: 26, weight: 600, color: '#2A2A2A' });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('A2', 'newspaper', tpl_A2);
registerShot('archive_newspaper', tpl_A2);

// A3: document_scroll — Chiếu chỉ, sắc phong cuộn giấy, triện đỏ
const tpl_A3 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0D1118';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    // Cuộn giấy dó
    g.fillStyle = '#DFD4B8';
    g.beginPath();
    g.roundRect(E.W * 0.2, E.H * 0.18, E.W * 0.6, E.H * 0.64, 8);
    g.fill();

    text(g, (o.title ?? 'CHIẾU CẦN VƯƠNG / SẮC PHONG'), E.W / 2, E.H * 0.3, { size: 34, weight: 900, color: '#2C1D11' });
    text(g, (o.text ?? 'LỜI HỊCH HÀO HÙNG TRUYỀN HỊCH TƯỚNG SĨ'), E.W / 2, E.H * 0.48, { size: 32, weight: 800, color: '#3A2617' });

    // Dấu triện son đỏ
    g.fillStyle = '#B8281D';
    g.fillRect(E.W * 0.65, E.H * 0.6, 80, 80);
    text(g, 'TRIỆN', E.W * 0.65 + 40, E.H * 0.6 + 48, { size: 18, weight: 800, color: '#FFFFFF' });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('A3', 'document_scroll', tpl_A3);

// A4: declassified — Tài liệu mật bị bôi đen, tem đỏ "TOP SECRET"
const tpl_A4 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0E141D';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    g.fillStyle = '#E5E0D0';
    g.fillRect(E.W * 0.2, E.H * 0.15, E.W * 0.6, E.H * 0.7);

    // Dòng chữ giả lập bị bôi đen
    for (let i = 0; i < 5; i++) {
      const y = E.H * 0.35 + i * 50;
      g.fillStyle = '#111111';
      g.fillRect(E.W * 0.26, y, E.W * (0.35 + (i % 3) * 0.08), 24);
    }

    // Tem đỏ đóng dấu chéo
    g.save();
    g.translate(E.W * 0.65, E.H * 0.45);
    g.rotate(-0.25);
    g.strokeStyle = '#D92318';
    g.lineWidth = 6;
    g.strokeRect(-120, -40, 240, 80);
    text(g, 'TOP SECRET', 0, 12, { size: 36, weight: 900, color: '#D92318' });
    g.restore();
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('A4', 'declassified', tpl_A4);
registerShot('document_declassified', tpl_A4);

// A5: artifact_museum — Cổ vật bảo tàng trên bệ đá, đèn rọi
const tpl_A5 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0A0E14';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    // Ánh đèn rọi từ trần
    const rg = g.createRadialGradient(E.W / 2, E.H * 0.45, 20, E.W / 2, E.H * 0.45, 240);
    rg.addColorStop(0, 'rgba(245, 196, 67, 0.35)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(E.W / 2, E.H * 0.45, 240, 0, Math.PI * 2);
    g.fill();

    // Bệ đá
    g.fillStyle = '#2A3340';
    g.fillRect(E.W * 0.35, E.H * 0.62, E.W * 0.3, 80);

    text(g, (o.name ?? 'CỌC GỖ BẠCH ĐẰNG 1288'), E.W / 2, E.H * 0.45, { size: 42, weight: 900, color: COLOR.gold });
    text(g, (o.sub ?? ''), E.W / 2, E.H * 0.78, { size: 22, weight: 600, color: COLOR.text });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('A5', 'artifact_museum', tpl_A5);

// A6: quote_card — Thẻ kem bo góc, trích dẫn danh ngôn hào hùng
const tpl_A6 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0F1620';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    g.fillStyle = '#EBE5D3';
    g.beginPath();
    g.roundRect(E.W * 0.15, E.H * 0.22, E.W * 0.7, E.H * 0.56, 16);
    g.fill();

    text(g, '“ ' + ((o.quote ?? 'KHÔNG CÓ GÌ QUÝ HƠN ĐỘC LẬP TỰ DO')) + ' ”', E.W / 2, E.H * 0.46, {
      size: 40, weight: 900, color: '#1E2530', width: E.W * 0.62
    });

    text(g, '— ' + ((o.author ?? 'Chủ tịch Hồ Chí Minh')) + ' —', E.W / 2, E.H * 0.64, {
      size: 28, weight: 700, color: '#B3261E'
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('A6', 'quote_card', tpl_A6);

// ============================================================================
// [5] GIẢI THÍCH CƠ CHẾ (EXPLAIN) — E1 đến E6
// ============================================================================

// E1: xray_cutaway — Mặt cắt tia X bóc tách vũ khí, khoang bom
const tpl_E1 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#071018';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    g.strokeStyle = '#00FFCC';
    g.lineWidth = 3;
    g.strokeRect(E.W * 0.2, E.H * 0.35, E.W * 0.6, E.H * 0.3);

    // Khung lưới tia X
    g.strokeStyle = 'rgba(0, 255, 204, 0.2)';
    g.lineWidth = 1;
    for (let x = E.W * 0.2; x <= E.W * 0.8; x += 40) {
      g.beginPath(); g.moveTo(x, E.H * 0.35); g.lineTo(x, E.H * 0.65); g.stroke();
    }

    text(g, (o.title ?? 'MẶT CẮT KẾT CẤU: ') + ((o.unit ?? 'B-52 STRATOFORTRESS')), E.W / 2, 100, {
      size: 38, weight: 900, color: '#00FFCC'
    });
    text(g, (o.sub ?? ''), E.W / 2, E.H * 0.74, {
      size: 26, weight: 700, color: COLOR.gold
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('E1', 'xray_cutaway', tpl_E1);
registerShot('unit_xray', tpl_E1);

// E2: diagram_mechanism — Sơ đồ cơ chế (bãi cọc thủy triều, dòng tiền...)
const tpl_E2 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0D141E';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    text(g, (o.title ?? 'CƠ CHẾ TÁC CHIẾN BÃI CỌC THỦY TRIỀU'), E.W / 2, 90, { size: 38, weight: 900, color: COLOR.gold });

    // 3 khối bước
    const steps = (Array.isArray(o.steps) && o.steps.length) ? o.steps.slice(0, 3).map((x, i) => `${i + 1}. ${x}`) : ['1. NHỬ ĐỊCH KHI NƯỚC LỚN', '2. THỦY TRIỀU RÚT NHANH', '3. TỔNG LỰC PHẢN CÔNG'];
    steps.forEach((s, i) => {
      const x = E.W * (0.15 + i * 0.26);
      g.fillStyle = '#1B2636';
      g.strokeStyle = COLOR.gold;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(x, E.H * 0.38, E.W * 0.22, 160, 12);
      g.fill();
      g.stroke();

      text(g, s, x + E.W * 0.11, E.H * 0.48, { size: 22, weight: 800, color: COLOR.gold, width: E.W * 0.19 });
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('E2', 'diagram_mechanism', tpl_E2);

// E3: cause_effect — Chuỗi mũi tên A -> B -> C pop so le
const tpl_E3 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0F1521';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    text(g, (o.title ?? 'CHUỖI NGUYÊN NHÂN — KẾT QUẢ'), E.W / 2, 90, { size: 38, weight: 900, color: COLOR.gold });

    const nodes = o.nodes || ['MỸ RẢI THẢM B-52', 'LƯỚI LỬA ĐÁNH TRẢ', 'BUỘC KÝ HIỆP ĐỊNH PARIS'];
    nodes.forEach((n, idx) => {
      const cx = E.W * (0.2 + idx * 0.3);
      g.fillStyle = idx === 2 ? COLOR.danger : COLOR.gold;
      g.beginPath();
      g.roundRect(cx - 110, E.H * 0.42, 220, 100, 12);
      g.fill();

      text(g, n, cx, E.H * 0.48, { size: 20, weight: 800, color: '#111111', width: 200 });

      if (idx < 2) {
        text(g, '➔', cx + 135, E.H * 0.48, { size: 36, weight: 900, color: COLOR.text });
      }
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('E3', 'cause_effect', tpl_E3);

// E4: cross_out — Icon hoặc mục tiêu bị gạch chéo đỏ lớn ("THẤT BẠI")
const tpl_E4 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0C1017';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    text(g, (o.target ?? 'CHIẾN DỊCH LINEBACKER II'), E.W / 2, E.H * 0.38, { size: 52, weight: 900, color: COLOR.text });

    // Dấu gạch chéo đỏ khổng lồ
    g.strokeStyle = COLOR.danger;
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(E.W * 0.25, E.H * 0.25);
    g.lineTo(E.W * 0.75, E.H * 0.75);
    g.moveTo(E.W * 0.75, E.H * 0.25);
    g.lineTo(E.W * 0.25, E.H * 0.75);
    g.stroke();

    text(g, (o.verdict ?? 'HOÀN TOÀN THẤT BẠI'), E.W / 2, E.H * 0.82, { size: 44, weight: 900, color: COLOR.danger });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('E4', 'cross_out', tpl_E4);

// E5: radar_scope — Màn hình radar quét 360 độ, mục tiêu nhấp nháy
const tpl_E5 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#040B07';
    g.fillRect(0, 0, E.W, E.H);

    const cx = E.W / 2;
    const cy = E.H * 0.52;
    const r = 260;

    g.save();
    g.strokeStyle = COLOR.radar;
    g.lineWidth = 2;

    [r * 0.33, r * 0.66, r].forEach(cr => {
      g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.stroke();
    });

    // Tia quét xoay
    const ang = (lt * 3.2) % (Math.PI * 2);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    g.stroke();

    // Mục tiêu vàng nhấp nháy
    const tx = cx + r * 0.5;
    const ty = cy - r * 0.3;
    g.fillStyle = COLOR.gold;
    g.beginPath();
    g.arc(tx, ty, 8, 0, Math.PI * 2);
    g.fill();

    text(g, (o.title ?? 'MÀN HIỆN SÓNG RADAR PHÒNG KHÔNG'), cx, 80, { size: 36, weight: 900, color: COLOR.radar });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('E5', 'radar_scope', tpl_E5);
registerShot('radar_screen', tpl_E5);

// E6: hud_view — Buồng lái tiêm kích / kính ngắm ống nhòm
const tpl_E6 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#081018';
    g.fillRect(0, 0, E.W, E.H);

    const cx = E.W / 2;
    const cy = E.H / 2;
    g.save();
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 3;

    // Vòng ngắm trung tâm
    g.beginPath();
    g.arc(cx, cy, 140, 0, Math.PI * 2);
    g.stroke();

    // Dấu chữ thập
    g.beginPath();
    g.moveTo(cx - 180, cy); g.lineTo(cx - 140, cy);
    g.moveTo(cx + 140, cy); g.lineTo(cx + 180, cy);
    g.moveTo(cx, cy - 180); g.lineTo(cx, cy - 140);
    g.moveTo(cx, cy + 140); g.lineTo(cx, cy + 180);
    g.stroke();

    text(g, 'ALT: 10,000M', cx - 240, cy - 80, { size: 24, weight: 800, color: COLOR.gold });
    text(g, 'LOCK TARGET', cx, cy - 160, { size: 28, weight: 900, color: COLOR.danger });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('E6', 'hud_view', tpl_E6);
registerShot('cockpit_hud', tpl_E6);
registerShot('night_vision', tpl_E6);

// ============================================================================
// [6] KHÔNG KHÍ & CẢM XÚC (MOOD) — F1 đến F6
// ============================================================================

// F1: memorial — Tưởng niệm, hương khói, nến sáng, nhịp chậm 5-6s
const tpl_F1 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0C0A09';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    // Ánh nến ấm áp
    for (let i = 0; i < 5; i++) {
      const nx = E.W * (0.3 + i * 0.1);
      const ny = E.H * 0.65;
      const nr = 12 + Math.sin(lt * 8 + i) * 3;
      const grad = g.createRadialGradient(nx, ny, 2, nx, ny, nr * 3);
      grad.addColorStop(0, 'rgba(255, 180, 50, 0.9)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(nx, ny, nr * 3, 0, Math.PI * 2);
      g.fill();
    }

    text(g, (o.title ?? 'ĐỜI ĐỜI NHỚ ƠN CÁC ANH HÙNG LIỆT SĨ'), E.W / 2, E.H * 0.35, {
      size: 40, weight: 800, color: COLOR.gold
    });
    g.restore();
  }
};
helperRegister('F1', 'memorial', tpl_F1);

// F2: chalkboard — Bảng đen tác chiến kẻ ô, chữ phấn trắng
const tpl_F2 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#151D1A';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    // Viền bảng gỗ
    g.strokeStyle = '#5E442B';
    g.lineWidth = 16;
    g.strokeRect(40, 40, E.W - 80, E.H - 80);

    text(g, (o.title ?? 'PHƯƠNG ÁN TÁC CHIẾN ĐÁNH B-52'), E.W / 2, 120, {
      size: 44, weight: 900, color: '#EAEAEA'
    });
    text(g, (o.sub ?? 'TẬP TRUNG TÊN LỬA VÀ PHÁO CAO XẠ BẢO VỆ THỦ ĐÔ'), E.W / 2, E.H * 0.45, {
      size: 30, weight: 700, color: COLOR.gold
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('F2', 'chalkboard', tpl_F2);
registerShot('war_room', tpl_F2);

// F3: weather_fx — Mưa, bão, sương mù trên sông
const tpl_F3 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#121A24';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    // Vệt mưa rơi nghiêng
    g.strokeStyle = 'rgba(200, 220, 255, 0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 60; i++) {
      const rx = (i * 47 + lt * 800) % E.W;
      const ry = (i * 31 + lt * 1200) % E.H;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx - 15, ry + 35);
      g.stroke();
    }
    text(g, (o.title ?? 'SƯƠNG MÙ VÀ MƯA GIÓ BAO PHỦ CHIẾN TRƯỜNG'), E.W / 2, 100, {
      size: 34, weight: 800, color: COLOR.text
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('F3', 'weather_fx', tpl_F3);

// F4: fire_smoke — Chiến địa bốc hỏa, khói cuộn
const tpl_F4 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0B0A0C';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    // Lửa cháy bùng
    for (let i = 0; i < 7; i++) {
      const fx = E.W * (0.15 + i * 0.12);
      const fy = E.H * 0.75;
      const fh = 80 + Math.sin(lt * 12 + i) * 30;
      g.fillStyle = i % 2 === 0 ? COLOR.danger : COLOR.gold;
      g.beginPath();
      g.moveTo(fx - 25, fy);
      g.lineTo(fx, fy - fh);
      g.lineTo(fx + 25, fy);
      g.closePath();
      g.fill();
    }
    text(g, (o.title ?? 'CHIẾN TRƯỜNG BỐC CHÁY NGÙN NGỤT'), E.W / 2, 110, {
      size: 40, weight: 900, color: COLOR.gold
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('F4', 'fire_smoke', tpl_F4);
registerShot('flame_barrage', tpl_F4);

// F5: explosion_beat — Flash trắng 2 frame + rung khung + nổ bung
const tpl_F5 = {
  draw(g, lt, dur, o = {}) {
    const flash = lt < 0.12;
    if (flash) {
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, E.W, E.H);
      return;
    }

    g.fillStyle = '#08080A';
    g.fillRect(0, 0, E.W, E.H);

    const shake = Math.sin(lt * 35) * (lt < 0.5 ? 8 : 2);
    g.save();
    g.translate(shake, -shake);

    // Vụ nổ nở rộng
    const exR = clamp(lt * 350, 20, 280);
    const grad = g.createRadialGradient(E.W / 2, E.H / 2, 10, E.W / 2, E.H / 2, exR);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.3, COLOR.gold);
    grad.addColorStop(0.7, COLOR.danger);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    g.fillStyle = grad;
    g.beginPath();
    g.arc(E.W / 2, E.H / 2, exR, 0, Math.PI * 2);
    g.fill();

    text(g, (o.title ?? 'MỤC TIÊU BỊ TIÊU DIỆT!'), E.W / 2, E.H * 0.85, {
      size: 46, weight: 900, color: COLOR.gold
    });
    g.restore();
  }
};
helperRegister('F5', 'explosion_beat', tpl_F5);

// F6: silence_beat — Màn tối, dòng chữ trắng, im lặng 2-3s
const tpl_F6 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, E.W, E.H);

    text(g, (o.text ?? 'VÀ RỒI, GIỜ PHÚT QUYẾT ĐỊNH ĐÃ ĐẾN.'), E.W / 2, E.H / 2, {
      size: 40, weight: 800, color: COLOR.text
    });
  }
};
helperRegister('F6', 'silence_beat', tpl_F6);

// ============================================================================
// [7] CHUYỂN CHƯƠNG (CHAPTER) — C1 đến C4
// ============================================================================

// C1: chapter_card — Số chương La Mã lớn + tiêu đề
const tpl_C1 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0C1118';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    text(g, (o.num ?? 'CHƯƠNG II'), E.W / 2, E.H * 0.38, { size: 36, weight: 800, color: COLOR.gold });
    text(g, (o.title ?? 'TRẬN TẬP KÍCH CHIẾN LƯỢC'), E.W / 2, E.H * 0.52, { size: 54, weight: 900, color: COLOR.text });

    // Gạch chân vàng chạy
    const lineW = Math.min(E.W * 0.5, (lt / (dur * 0.5)) * (E.W * 0.5));
    g.fillStyle = COLOR.gold;
    g.fillRect(E.W / 2 - lineW / 2, E.H * 0.62, lineW, 4);
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('C1', 'chapter_card', tpl_C1);

// C2: date_flip — Full màn hình lật số năm cơ học
const tpl_C2 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#090D14';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    g.fillStyle = '#1E2530';
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 6;
    g.strokeRect(E.W * 0.25, E.H * 0.32, E.W * 0.5, E.H * 0.36);

    text(g, (o.year ?? '1288'), E.W / 2, E.H * 0.54, { size: 130, weight: 900, color: COLOR.gold });
    text(g, (o.sub ?? 'TRÙNG HƯNG THỨ TƯ'), E.W / 2, E.H * 0.76, { size: 32, weight: 700, color: COLOR.text });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('C2', 'date_flip', tpl_C2);

// C3: zoom_out_world — Kéo xa quả địa cầu tối rồi lao vào vùng mới
const tpl_C3 = {
  draw(g, lt, dur, o = {}) {
    const p = clamp(lt / dur, 0, 1);
    g.fillStyle = '#080C12';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    const globeR = 180 * (1 - Math.abs(p - 0.5) * 0.4);
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(E.W / 2, E.H / 2, globeR, 0, Math.PI * 2);
    g.stroke();

    text(g, (o.title ?? 'CỤC DIỆN TOÀN CẦU'), E.W / 2, 100, { size: 40, weight: 900, color: COLOR.gold });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('C3', 'zoom_out_world', tpl_C3);

// C4: ending_handshake — Hai ball cạnh nhau, hộp viền vàng chốt thông điệp
const tpl_C4 = {
  draw(g, lt, dur, o = {}) {
    g.fillStyle = '#0D131C';
    g.fillRect(0, 0, E.W, E.H);

    g.save();
    drawCountryball(g, E.W * 0.38, E.H * 0.45, 100, { flag: (o.flag1 ?? 'vn'), mood: 'confident', t: lt });
    drawCountryball(g, E.W * 0.62, E.H * 0.45, 100, { flag: (o.flag2 ?? 'us'), mood: 'confident', look: -1, t: lt });

    // Hộp thông điệp viền vàng
    g.fillStyle = '#1A2433';
    g.strokeStyle = COLOR.gold;
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(E.W * 0.15, E.H * 0.65, E.W * 0.7, 130, 14);
    g.fill();
    g.stroke();

    text(g, (o.message ?? 'KHÉP LẠI QUÁ KHỨ — HƯỚNG TỚI TƯƠNG LAI HÒA BÌNH'), E.W / 2, E.H * 0.73, {
      size: 30, weight: 800, color: COLOR.gold
    });
    g.restore();
    drawHUD(g, o);
  }
};
helperRegister('C4', 'ending_handshake', tpl_C4);
helperRegister('today_outro', null, tpl_C4);

// Đăng ký cảnh thumbnail mặc định ('thumb') chuẩn CTR cao cho kênh
helperRegister('thumb', null, {
  draw(g, lt, dur, o = {}) {
    drawMap(g, 'vn', {
      sea: COLOR.sea,
      land: COLOR.land,
      highlight: { 'Việt Nam': COLOR.vn },
      islands: true
    });
    g.save();
    // Vòng sóng radar & tâm ngắm đỏ
    g.strokeStyle = COLOR.danger;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(E.W * 0.52, E.H * 0.42, 160, 0, Math.PI * 2);
    g.stroke();

    drawCountryball(g, E.W * 0.24, E.H * 0.65, 145, { flag: 'vn', accessory: 'mu_coi', mood: 'determined', t: 1 });
    drawCountryball(g, E.W * 0.78, E.H * 0.65, 145, { flag: 'us', accessory: 'kinh_ram', mood: 'shock', sweat: true, look: -1, t: 1 });

    // Tiêu đề Thumbnail nổi bật
    const title = (E.cfg && E.cfg.title ? E.cfg.title : 'HỒ SƠ LỊCH SỬ VIỆT NAM').toUpperCase().slice(0, 38);
    g.fillStyle = 'rgba(10, 14, 20, 0.88)';
    g.fillRect(0, E.H * 0.06, E.W, 130);
    text(g, title, E.W / 2, E.H * 0.125, { size: 58, weight: 900, color: COLOR.gold, stroke: 8, strokeColor: '#000000' });
    g.restore();
  }
});

function drawArrowCurved(g, sx, sy, ex, ey, p, col) {
  g.save();
  g.strokeStyle = col;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(sx, sy);
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2 - 40;
  const cx = sx + (mx - sx) * p;
  const cy = sy + (my - sy) * p;
  g.quadraticCurveTo(mx, my, cx, cy);
  g.stroke();

  if (p > 0.8) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(ex, ey, 14, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

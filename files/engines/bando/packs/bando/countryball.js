// countryball.js — Ve Countryball lich su: chi co 2 mat trang, khong mui, khong mieng.
// Phu kien: mu coi, non la, mu sat M1, ong nhom, tai nghe radar/radio, bang do...
import { E, clamp, ease } from '/engine/core.js';

export const CB_FLAGS = {
  vn: { name: 'Việt Nam', bg: '#DA251D', star: '#FFFF00' },
  us: { name: 'Mỹ', bg: '#002868', stripes: ['#DA251D', '#FFFFFF'], canton: '#002868' },
  ussr: { name: 'Liên Xô', bg: '#CD0000', gold: '#FFD700' },
  fr: { name: 'Pháp', stripes: ['#0055A4', '#FFFFFF', '#EF4135'] },
  cn: { name: 'Trung Quốc', bg: '#EE1C25', star: '#FFFF00' },
  mong: { name: 'Nguyên Mông', bg: '#1F3A93' },
  bac: { name: 'Phương Bắc', bg: '#D4A62A' },
  laos: { name: 'Lào', stripes: ['#CE1126', '#002868', '#CE1126'], moon: '#FFFFFF' },
  kh: { name: 'Campuchia', stripes: ['#032EA6', '#ED1B24', '#032EA6'], temple: '#FFFFFF' },
  un: { name: 'Liên Hợp Quốc', bg: '#4B92DB', icon: '#FFFFFF' }
};

export function drawCountryball(g, x, y, r, o = {}) {
  const t = o.t || 0;
  const bounce = Math.sin(t * 4.5) * (r * 0.035);
  const cy = y + bounce;
  const flag = o.flag || 'vn';
  const look = o.look || 0; // -1: trai, 0: thang, 1: phai

  g.save();
  g.translate(x, cy);

  // 1. Mat cau co vien tay hoi run nhe
  g.save();
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.clip();

  // Ve quoc ky
  if (flag === 'vn') {
    g.fillStyle = '#DA251D';
    g.fillRect(-r, -r, r * 2, r * 2);
    // Ngoi sao vang
    drawStar(g, 0, 0, r * 0.45, r * 0.2, '#FFFF00');
  } else if (flag === 'us') {
    g.fillStyle = '#FFFFFF';
    g.fillRect(-r, -r, r * 2, r * 2);
    // Soc do trang
    g.fillStyle = '#DA251D';
    for (let i = -r; i < r; i += r * 0.28) {
      g.fillRect(-r, i, r * 2, r * 0.14);
    }
    // Goc xanh goc trai
    g.fillStyle = '#002868';
    g.fillRect(-r, -r, r * 1.1, r * 1.1);
  } else if (flag === 'ussr') {
    g.fillStyle = '#CD0000';
    g.fillRect(-r, -r, r * 2, r * 2);
    // Bua liem / ngoi sao vang
    drawStar(g, -r * 0.4, -r * 0.4, r * 0.25, r * 0.1, '#FFD700');
  } else if (flag === 'fr') {
    const sw = (r * 2) / 3;
    g.fillStyle = '#0055A4';
    g.fillRect(-r, -r, sw, r * 2);
    g.fillStyle = '#FFFFFF';
    g.fillRect(-r + sw, -r, sw, r * 2);
    g.fillStyle = '#EF4135';
    g.fillRect(-r + sw * 2, -r, sw, r * 2);
  } else if (flag === 'laos') {
    const stripeH = (r * 2) / 4;
    g.fillStyle = '#CE1126';
    g.fillRect(-r, -r, r * 2, stripeH);
    g.fillRect(-r, r - stripeH, r * 2, stripeH);
    g.fillStyle = '#002868';
    g.fillRect(-r, -r + stripeH, r * 2, stripeH * 2);
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    g.fill();
  } else if (flag === 'un') {
    g.fillStyle = '#4B92DB';
    g.fillRect(-r, -r, r * 2, r * 2);
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    g.stroke();
  } else if (flag === 'cn') {
    // Trung Quốc hiện đại: nền đỏ, 1 sao lớn + 4 sao nhỏ góc trên trái
    g.fillStyle = '#EE1C25';
    g.fillRect(-r, -r, r * 2, r * 2);
    drawStar(g, -r * 0.42, -r * 0.42, r * 0.26, r * 0.11, '#FFDE00');
    [[-0.12, -0.72], [0.02, -0.52], [0.02, -0.26], [-0.12, -0.08]].forEach(([sx, sy]) =>
      drawStar(g, r * sx, r * sy, r * 0.08, r * 0.035, '#FFDE00'));
  } else if (flag === 'mong') {
    // Nguyên Mông (thế kỷ XIII): nền xanh trời thảo nguyên + mặt trời vàng
    g.fillStyle = '#1F3A93';
    g.fillRect(-r, -r, r * 2, r * 2);
    g.fillStyle = '#E8B730';
    g.beginPath(); g.arc(0, -r * 0.08, r * 0.3, 0, Math.PI * 2); g.fill();
    g.fillRect(-r, r * 0.42, r * 2, r * 0.14);
  } else if (flag === 'bac') {
    // Triều đại phong kiến phương Bắc (Hán, Đường, Tống, Minh, Thanh): vàng hoàng triều, viền đỏ
    g.fillStyle = '#D4A62A';
    g.fillRect(-r, -r, r * 2, r * 2);
    g.fillStyle = '#9E1B1B';
    g.fillRect(-r, -r, r * 2, r * 0.32);
    g.fillRect(-r, r * 0.68, r * 2, r * 0.32);
  } else if (flag === 'kh') {
    g.fillStyle = '#032EA6';
    g.fillRect(-r, -r, r * 2, r * 2);
    g.fillStyle = '#ED1B24';
    g.fillRect(-r, -r * 0.5, r * 2, r);
    g.fillStyle = '#FFFFFF';
    g.fillRect(-r * 0.3, -r * 0.22, r * 0.6, r * 0.38);
  } else {
    g.fillStyle = '#B8897C';
    g.fillRect(-r, -r, r * 2, r * 2);
  }

  // Vet sang bong o goc tren tao chieu sau
  const grad = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.8, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = grad;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();

  // Vien den tay run nhe quanh cau
  g.lineWidth = r * 0.08;
  g.strokeStyle = '#181818';
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();

  // 2. Chi co 2 MAT TRANG - Khong co mui, khong co mieng
  const eyeR = r * 0.22;
  const eyeH = r * 0.32;
  const eyeOffset = r * 0.35;
  const eyeX = look * r * 0.15;
  const mood = o.mood || 'normal'; // normal, angry, shock, confident, squint, determined, thinking

  drawEye(g, -eyeOffset + eyeX, -r * 0.05, eyeR, eyeH, mood, -1, t);
  drawEye(g, eyeOffset + eyeX, -r * 0.05, eyeR, eyeH, mood, 1, t);

  // Giot mo hoi neu shock / cang thang
  if (mood === 'shock' || o.sweat) {
    g.fillStyle = '#73D0FF';
    g.strokeStyle = '#181818';
    g.lineWidth = 2;
    g.beginPath();
    const sx = eyeOffset * 1.5;
    const sy = -r * 0.45;
    g.arc(sx, sy, r * 0.09, 0, Math.PI);
    g.lineTo(sx, sy - r * 0.18);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // 3. Phu kien theo vai
  if (o.accessory === 'mu_coi') {
    drawMuCoi(g, 0, -r * 0.75, r * 1.05);
  } else if (o.accessory === 'non_la') {
    drawNonLa(g, 0, -r * 0.7, r * 1.3);
  } else if (o.accessory === 'mu_sat') {
    drawMuSat(g, 0, -r * 0.75, r * 1.15);
  } else if (o.accessory === 'kinh_ram') {
    drawKinhRam(g, eyeX, -r * 0.05, eyeOffset, eyeR);
  } else if (o.accessory === 'tai_nghe' || o.accessory === 'tai_nghe_radio') {
    drawTaiNghe(g, 0, 0, r, o.accessory === 'tai_nghe_radio');
  } else if (o.accessory === 'ong_nhom') {
    drawOngNhom(g, eyeX, r * 0.2, eyeOffset, eyeR);
  } else if (o.accessory === 'bang_do') {
    drawBangDo(g, 0, -r * 0.3, r);
  }

  // 4. Bong bong thoai ngan (neu co)
  if (o.speech) {
    drawSpeechBubble(g, r * 0.8, -r * 1.1, o.speech);
  }

  g.restore();
}

function drawEye(g, x, y, rw, rh, mood, side, t) {
  g.save();
  g.translate(x, y);

  if (mood === 'angry') {
    g.rotate(side * -0.25);
  } else if (mood === 'confident') {
    g.rotate(side * 0.15);
  } else if (mood === 'determined') {
    g.rotate(side * -0.18);
  } else if (mood === 'thinking') {
    if (side > 0) g.translate(0, -rh * 0.15);
  }

  g.fillStyle = '#FFFFFF';
  g.lineWidth = rw * 0.28;
  g.strokeStyle = '#181818';

  g.beginPath();
  if (mood === 'squint' || mood === 'confident') {
    // Mat nheo cong hinh nua vang trang
    g.arc(0, rh * 0.2, rw, Math.PI, 0, false);
    g.lineTo(rw, rh * 0.2);
  } else if (mood === 'shock') {
    // Mat mo to tron run ray
    const tremor = Math.sin((t || 0) * 20) * (rw * 0.08);
    g.arc(tremor, tremor, rw * 1.25, 0, Math.PI * 2);
  } else if (mood === 'determined') {
    // Mat sac ben kien cuong
    g.moveTo(-rw, -rh * 0.3);
    g.lineTo(rw, -rh * 0.6);
    g.quadraticCurveTo(rw * 0.8, rh * 0.9, -rw * 0.4, rh * 0.8);
    g.closePath();
  } else {
    // Mat hinh bau duc trang
    g.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
  }
  g.fill();
  g.stroke();

  g.restore();
}

function drawStar(g, cx, cy, ro, ri, color) {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = (i * 72 - 90) * Math.PI / 180;
    const a2 = ((i * 72) + 36 - 90) * Math.PI / 180;
    const x1 = cx + Math.cos(a1) * ro;
    const y1 = cy + Math.sin(a1) * ro;
    const x2 = cx + Math.cos(a2) * ri;
    const y2 = cy + Math.sin(a2) * ri;
    if (i === 0) g.moveTo(x1, y1);
    else g.lineTo(x1, y1);
    g.lineTo(x2, y2);
  }
  g.closePath();
  g.fill();
  g.restore();
}

function drawMuCoi(g, cx, cy, w) {
  g.save();
  g.fillStyle = '#3A5A35'; // Xanh la linh
  g.strokeStyle = '#181818';
  g.lineWidth = w * 0.05;

  // Vanh mu
  g.beginPath();
  g.ellipse(cx, cy + w * 0.25, w * 0.6, w * 0.18, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Chom mu
  g.beginPath();
  g.arc(cx, cy + w * 0.1, w * 0.42, Math.PI, 0);
  g.closePath();
  g.fill();
  g.stroke();

  // Ngoi sao do o giua mu coi
  drawStar(g, cx, cy + w * 0.05, w * 0.1, w * 0.045, '#DA251D');
  g.restore();
}

function drawMuSat(g, cx, cy, w) {
  g.save();
  g.fillStyle = '#4B5320'; // Mau quan dung olive drab
  g.strokeStyle = '#181818';
  g.lineWidth = w * 0.05;

  // Vom non sat
  g.beginPath();
  g.arc(cx, cy + w * 0.15, w * 0.52, Math.PI * 0.95, Math.PI * 2.05);
  g.quadraticCurveTo(cx, cy + w * 0.22, cx - Math.cos(Math.PI * 0.95) * w * 0.52, cy + w * 0.15);
  g.closePath();
  g.fill();
  g.stroke();

  // Dai luoi camo tren mu
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  for (let i = -w * 0.4; i <= w * 0.4; i += w * 0.15) {
    g.beginPath();
    g.moveTo(cx + i, cy - w * 0.25);
    g.lineTo(cx + i * 1.1, cy + w * 0.15);
    g.stroke();
  }
  g.restore();
}

function drawNonLa(g, cx, cy, w) {
  g.save();
  g.fillStyle = '#E8D49E'; // Vang nhat non la
  g.strokeStyle = '#6E5224';
  g.lineWidth = w * 0.04;

  g.beginPath();
  g.moveTo(cx, cy - w * 0.35);
  g.lineTo(cx + w * 0.55, cy + w * 0.2);
  g.lineTo(cx - w * 0.55, cy + w * 0.2);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

function drawKinhRam(g, cx, cy, eyeOffset, eyeR) {
  g.save();
  g.fillStyle = '#111111';
  g.strokeStyle = '#333333';
  g.lineWidth = 4;

  // 2 trong kinh phi cong
  [-eyeOffset, eyeOffset].forEach(ox => {
    g.beginPath();
    g.ellipse(cx + ox, cy, eyeR * 1.35, eyeR * 1.5, 0.05, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  });

  // Cau noi giua 2 mat kinh
  g.beginPath();
  g.moveTo(cx - eyeOffset * 0.3, cy - eyeR * 0.5);
  g.lineTo(cx + eyeOffset * 0.3, cy - eyeR * 0.5);
  g.stroke();
  g.restore();
}

function drawTaiNghe(g, cx, cy, r, hasMic = false) {
  g.save();
  g.strokeStyle = '#222222';
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.arc(cx, cy, r * 1.05, Math.PI * 0.9, Math.PI * 2.1);
  g.stroke();
  // Op tai
  g.fillStyle = '#444444';
  [-r * 1.05, r * 1.05].forEach(x => {
    g.beginPath();
    g.ellipse(cx + x, cy, r * 0.15, r * 0.3, 0, 0, Math.PI * 2);
    g.fill();
  });

  // Micro vươn ra miệng (dành cho bộ đàm / phi công)
  if (hasMic) {
    g.strokeStyle = '#333333';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - r * 1.05, cy + r * 0.1);
    g.quadraticCurveTo(cx - r * 0.7, cy + r * 0.6, cx - r * 0.2, cy + r * 0.45);
    g.stroke();
    g.fillStyle = '#111111';
    g.beginPath();
    g.arc(cx - r * 0.2, cy + r * 0.45, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawOngNhom(g, cx, cy, eyeOffset, eyeR) {
  g.save();
  g.fillStyle = '#2A2E33';
  g.strokeStyle = '#181818';
  g.lineWidth = 4;

  [-eyeOffset * 0.8, eyeOffset * 0.8].forEach(ox => {
    g.beginPath();
    g.roundRect(cx + ox - eyeR * 0.7, cy, eyeR * 1.4, eyeR * 2.2, 6);
    g.fill();
    g.stroke();
    // Vong ong kinh truoc
    g.fillStyle = '#3A4B58';
    g.beginPath();
    g.arc(cx + ox, cy + eyeR * 2.2, eyeR * 0.6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  });
  g.restore();
}

function drawBangDo(g, cx, cy, r) {
  g.save();
  g.fillStyle = '#DA251D';
  g.strokeStyle = '#181818';
  g.lineWidth = 3;
  g.beginPath();
  g.rect(cx - r * 0.95, cy, r * 1.9, r * 0.22);
  g.fill();
  g.stroke();
  // Dải ruy băng buộc phía sau
  g.beginPath();
  g.moveTo(cx + r * 0.9, cy + r * 0.1);
  g.lineTo(cx + r * 1.25, cy + r * 0.35);
  g.lineTo(cx + r * 0.9, cy + r * 0.2);
  g.fill();
  g.stroke();
  g.restore();
}

function drawSpeechBubble(g, x, y, text) {
  g.save();
  g.font = 'bold 32px "Be Vietnam Pro", sans-serif';
  const metrics = g.measureText(text);
  const bw = metrics.width + 40;
  const bh = 55;

  g.fillStyle = '#FFFFFF';
  g.strokeStyle = '#181818';
  g.lineWidth = 4;

  // Khung bo tron
  g.beginPath();
  g.roundRect(x, y - bh, bw, bh, 12);
  g.fill();
  g.stroke();

  // Mui ten tro vao Countryball
  g.beginPath();
  g.moveTo(x + 15, y);
  g.lineTo(x - 10, y + 15);
  g.lineTo(x + 30, y);
  g.fill();

  // Chu thoai ngan
  g.fillStyle = '#181818';
  g.fillText(text, x + 20, y - bh * 0.35);
  g.restore();
}

// render.mjs — H2 2D Studio (Bản Tăng Tốc Đa Luồng + GPU Hardware Encoding + Batch IPC):
//   node render.mjs --project projects/<ten> --sheet [--scale 0.5]          anh tong hop: 1 khung / shot
//   node render.mjs --project projects/<ten> --stills 3.2,7.5 [--scale 0.5] anh tai cac thoi diem
//   node render.mjs --project projects/<ten> --from 0 --to 30 [--scale 0.5] video xem truoc (build/preview.mp4, co voice)
//   node render.mjs --project projects/<ten> [--mp4] [--turbo] [--workers N] ban cuoi toc do cao (out/video_1080p.mp4)
//   node render.mjs --project projects/<ten> --thumb                        anh thumbnail tu canh 'thumb' -> out/thumbnail.png
//   node render.mjs --project projects/<ten> --check --scale 0.25           quet loi toan video, khong xuat file
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = {}; process.argv.slice(2).forEach((a, i, arr) => { if (a.startsWith('--')) { const k = a.slice(2); const v = arr[i + 1]; args[k] = v && !v.startsWith('--') ? v : true; } });
if (!args.project) { console.error('Thieu --project projects/<ten>'); process.exit(1); }
const PROJ = path.resolve(args.project);
const SCALE = +(args.scale || 1);
const TURBO = !!args.turbo;
const BUILD = path.join(PROJ, 'build'); fs.mkdirSync(BUILD, { recursive: true });
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

// ---------- Tu dong phat hien GPU Hardware Encoder (NVENC / QuickSync QSV / AMD AMF)
function detectEncoder(requested, crf, preview) {
  if (requested && requested !== 'auto') {
    return buildEncoderArgs(requested, crf, preview);
  }
  for (const enc of ['h264_nvenc', 'h264_qsv', 'h264_amf']) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=128x128:d=0.1', '-c:v', enc, '-f', 'null', '-']);
    if (r.status === 0) return buildEncoderArgs(enc, crf, preview);
  }
  return buildEncoderArgs('libx264', crf, preview);
}

function buildEncoderArgs(enc, crf, preview) {
  if (enc === 'h264_nvenc') {
    return { name: 'h264_nvenc (NVIDIA GPU)', flags: ['-c:v', 'h264_nvenc', '-preset', preview ? 'p1' : 'p3', '-rc', 'vbr', '-cq', String(crf), '-b:v', '5M', '-maxrate', '8M', '-pix_fmt', 'yuv420p'] };
  }
  if (enc === 'h264_qsv') {
    return { name: 'h264_qsv (Intel QuickSync GPU)', flags: ['-c:v', 'h264_qsv', '-preset', preview ? 'veryfast' : 'faster', '-global_quality', String(crf), '-maxrate', '8M', '-bufsize', '16M', '-pix_fmt', 'nv12'] };
  }
  if (enc === 'h264_amf') {
    return { name: 'h264_amf (AMD GPU)', flags: ['-c:v', 'h264_amf', '-quality', 'speed', '-rc', 'cqp', '-qp_i', String(crf), '-qp_p', String(crf), '-pix_fmt', 'yuv420p'] };
  }
  return { name: 'libx264 (CPU VeryFast)', flags: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-maxrate', '8M', '-bufsize', '16M', '-tune', 'animation', '-pix_fmt', 'yuv420p'] };
}

// ---------- may chu tinh (co cache file trong RAM de tang toc nap trang)
const fileCache = new Map();
function listScenes(dir) {
  const out = []; const base = path.join(dir, 'scenes');
  const walk = (d) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js') && !f.startsWith('_')) out.push(path.relative(dir, p).split(path.sep).join('/')); } };
  walk(path.join(base, 'sets')); walk(path.join(base, 'shots'));
  for (const f of fs.existsSync(base) ? fs.readdirSync(base).sort() : []) { if (f.endsWith('.js') && !f.startsWith('_') && f !== 'cast.js') out.push('scenes/' + f); }
  return out;
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__assets') { const d = path.join(PROJ, 'anh'); const list = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort().map((f) => ({ id: path.parse(f).name, file: 'anh/' + f })) : []; res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(list)); }
  if (u.pathname === '/__manifest') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(listScenes(PROJ))); }
  let file = u.pathname.startsWith('/proj/') ? path.join(PROJ, decodeURIComponent(u.pathname.slice(6))) : path.join(ROOT, decodeURIComponent(u.pathname));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'max-age=3600' });
  if (fs.statSync(file).size < 2 * 1024 * 1024) {
    let buf = fileCache.get(file);
    if (!buf) { buf = fs.readFileSync(file); fileCache.set(file, buf); }
    return res.end(buf);
  }
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

// ---------- trinh duyet (Toi uu co hieu Chromium tang toc Canvas 2D & tat throttling)
let _cfg = {}; try { _cfg = JSON.parse(fs.readFileSync(path.join(PROJ, 'config.json'), 'utf8')); } catch {}
const gl = args.gl || (process.platform === 'linux' && !_cfg.pack ? 'swiftshader' : 'auto');
const LAUNCH = {
  args: [
    '--disable-dev-shm-usage',
    '--font-render-hinting=none',
    '--disable-gpu-vsync',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-ipc-flooding-protection',
    ...(gl === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])
  ]
};
async function launch() {
  try { return await chromium.launch(LAUNCH); }
  catch (e) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH; let exe = null;
    if (base && fs.existsSync(base)) for (const d of fs.readdirSync(base)) { const c = path.join(base, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium-') && fs.existsSync(c)) exe = c; }
    if (!exe) throw new Error('Chua co Chromium. Chay: npx playwright install chromium\n' + e.message);
    return await chromium.launch({ ...LAUNCH, executablePath: exe });
  }
}
async function openPlayer(browser, style) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [trinh duyet]', m.text().slice(0, 300)); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/timeline/')) console.log('  [404]', r.url().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('  [loi trang]', String(e).slice(0, 300)));
  const qs = new URLSearchParams({ proj: '/proj', scale: String(SCALE) });
  await page.goto(`http://127.0.0.1:${PORT}/player.html?${qs}`);
  await page.waitForFunction(() => window.__ready || window.__bootError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__bootError); if (err) throw new Error('Khong khoi dong duoc player: ' + err);
  if (style) await page.evaluate((s) => { window.__setStyle && window.__setStyle(s); }, style);
  const info = await page.evaluate(() => window.__info);
  await page.setViewportSize({ width: Math.min(info.W, 4000), height: Math.min(info.H, 4000) });
  return { page, info };
}
const b64 = (d) => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
function report(info) {
  const miss = info.shots.filter((s) => !s.has).map((s) => s.id);
  if (miss.length) console.log(`  [LOI NHE - BO QUA] ${miss.length} shot dung mau du phong map_overview: ${miss.slice(0, 15).join(', ')}${miss.length > 15 ? ' ...' : ''}`);
  if (info.missingImages && info.missingImages.length) console.log(`  [LOI NHE - BO QUA] Thieu ${info.missingImages.length}/${info.images} anh phu (da tu dong ve vector thay the).`);
  if (info.importErrors.length) { console.log('  [CANH BAO NAP FILE CANH]:'); info.importErrors.forEach((e) => console.log('   - ' + e)); }
}
const voicePath = () => { for (const f of ['build/mix.wav', 'timeline/voice.wav']) { const p = path.join(PROJ, f); if (fs.existsSync(p)) return p; } return null; };
function ff(argv) { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...argv], { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg loi'); }

// ---------- che do
const browser = await launch();
try {
  if (args.thumb) {
    const { page } = await openPlayer(browser, args.style);
    const d = await page.evaluate((t) => window.renderThumb(t), +(args.at || 1));
    if (!d) throw new Error("Chua co canh 'thumb' (registerShot('thumb', ...) trong scenes/shots/).");
    fs.mkdirSync(path.join(PROJ, 'out'), { recursive: true }); const p = path.join(PROJ, 'out', 'thumbnail.png'); fs.writeFileSync(p, b64(d));
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', p, '-vf', 'scale=1280:-2', path.join(PROJ, 'out', 'thumbnail_1280.jpg')]); console.log('  ' + p);
  } else if (args.check) {
    const { page, info } = await openPlayer(browser, args.style); report(info);
    const errs = new Set(); page.on('console', (m) => { if (m.type() === 'error' && /SHOT|IMPORT/.test(m.text())) errs.add(m.text().slice(0, 200)); });
    for (let f = 0; f < info.frames; f += 3) await page.evaluate((f) => window.renderFrame(f, { q: 0.3, fast: true }).then(() => 0), f);
    console.log(errs.size ? 'LOI:\n' + [...errs].join('\n') : 'Khong co loi trong ' + info.frames + ' khung.');
  } else if (args.sheet || args.stills) {
    const { page, info } = await openPlayer(browser, args.style); report(info);
    const items = [];
    if (args.sheet) {
      const at = +(args.at || 0.45), sel = args.ids ? String(args.ids).split(',') : null;
      for (let i = 0; i < info.shots.length; i++) {
        const s = info.shots[i]; if (sel && !sel.includes(s.id)) continue;
        const t = s.start + (s.end - s.start) * at, f = Math.min(info.frames - 1, Math.round(t * info.fps));
        const src = await page.evaluate((f) => window.renderFrame(f, { fast: true }), f);
        items.push({ src, label: `${s.id} ${s.start.toFixed(1)}s ${s.line}` });
      }
    } else {
      for (const t of String(args.stills).split(',').map(Number)) { const f = Math.round(t * info.fps); const src = await page.evaluate((f) => window.renderFrame(f, { png: true }), f); fs.mkdirSync(path.join(BUILD, 'stills'), { recursive: true }); const p = path.join(BUILD, 'stills', `t_${t.toFixed(2)}.png`); fs.writeFileSync(p, b64(src)); console.log('  ' + p); items.push({ src, label: `${t}s` }); }
    }
    const dir = path.join(BUILD, 'sheets'); fs.mkdirSync(dir, { recursive: true });
    for (let k = 0, n = 1; k < items.length; k += 16, n++) {
      const sheet = await page.evaluate(([it]) => window.makeSheet(it, 4, 480), [items.slice(k, k + 16)]);
      const p = path.join(dir, `${args.stills ? 'stills' : 'sheet'}${args.style ? '_' + args.style : ''}_${String(n).padStart(2, '0')}.jpg`); fs.writeFileSync(p, b64(sheet)); console.log('  ' + p);
    }
  } else {
    // video: xem truoc hoac ban cuoi (Da luong Single-Browser + Batch IPC + GPU Encoder)
    const { page: p0, info } = await openPlayer(browser, args.style); report(info); await p0.close();
    const preview = args.from !== undefined || args.to !== undefined;
    const f0 = Math.max(0, Math.round(+(args.from || 0) * info.fps)), f1 = Math.min(info.frames, Math.round((args.to !== undefined ? +args.to : info.duration) * info.fps));
    const total = f1 - f0;
    const cpuCount = os.cpus().length;
    const W = Math.max(1, Math.min(+(args.workers || Math.min(8, cpuCount)), Math.ceil(total / 48)));
    const BATCH = Math.max(1, +(args.batch || 12));
    const STEP = TURBO ? 2 : +(args.step || 1);
    const JPEG_Q = TURBO ? 0.80 : +(args.q || 0.85);
    const encInfo = detectEncoder(args.encoder, +(args.crf || 21), preview);

    console.log(`⚡ Render Tang Toc: ${total} khung (${(total / info.fps).toFixed(1)}s) ${info.W}x${info.H} @${info.fps}fps`);
    console.log(`   - So luong song song: ${W} workers (Single-Browser Multi-Page) | Batch IPC: ${BATCH} khung/lan`);
    console.log(`   - Bo ma hoa Video: ${encInfo.name} | Che do: ${TURBO ? 'TURBO SIEU TOC (step=2)' : 'CHUAN MUOT (step=1)'}`);

    const parts = []; let done = 0; const t0 = Date.now();
    const tick = setInterval(() => {
      const el = (Date.now() - t0) / 1000, fps = done / Math.max(el, 0.1);
      const pct = ((done / Math.max(total, 1)) * 100).toFixed(1);
      console.log(`  [${pct}%] ${done}/${total} khung | Toc do: ${fps.toFixed(1)} fps (${(fps / info.fps).toFixed(2)}x realtime) | Con lai ~${Math.max(0, Math.round((total - done) / Math.max(fps, 0.01) / 60))} phut`);
    }, 10000);

    const chunk = Math.ceil(total / W);
    await Promise.all(Array.from({ length: W }, async (_, k) => {
      const a = f0 + k * chunk, b = Math.min(f1, a + chunk); if (a >= b) return;
      const out = path.join(BUILD, `part_${String(k).padStart(2, '0')}_${a}_${b}.mp4`); parts[k] = out;
      // Ho tro Resume: neu doan part nay da render xong tu lan truoc va khong co --force thi bo qua ngay!
      if (!args.force && fs.existsSync(out) && fs.statSync(out).size > 16384) {
        done += (b - a);
        console.log(`  [Resume] Bo qua part ${k} da hoan thanh (${b - a} khung).`);
        return;
      }
      // Co che: Loi nhe (1-2 frame) -> tu bu frame va bo qua. Loi nang (sap tab / file part 0 byte) -> chi render lai dung part k (toi da 2 lan)
      for (let attempt = 1; attempt <= 2; attempt++) {
        let page = null, enc = null, countedInAttempt = 0, lastValidBuf = null;
        try {
          const opened = await openPlayer(browser, args.style);
          page = opened.page;
          enc = spawn('ffmpeg', [
            '-v', 'error', '-y',
            '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'mjpeg', '-i', '-',
            ...encInfo.flags,
            '-r', String(info.fps), out
          ], { stdio: ['pipe', 'inherit', 'inherit'] });

          for (let f = a; f < b; f += BATCH) {
            const cnt = Math.min(BATCH, b - f);
            let urls = null;
            try {
              urls = await page.evaluate(
                ([fs, c, q, stp]) => window.renderBatch ? window.renderBatch(fs, c, { q, fast: true, step: stp }) : Promise.all(Array.from({ length: c }, (_, idx) => window.renderFrame(fs + idx, { q, fast: true }))),
                [f, cnt, JPEG_Q, STEP]
              );
            } catch (batchErr) {
              // Loi nhe tren 1 lo frame: bo qua loi, dung frame hop le lien truoc de bu, KHONG dung render!
              if (lastValidBuf) {
                console.log(`  [LOI NHE - BO QUA] Lo khung ${f}..${f + cnt - 1} bi nghen -> Tu dong bu khung lien ke.`);
                for (let idx = 0; idx < cnt; idx++) {
                  if (!enc.stdin.write(lastValidBuf)) await new Promise((r) => enc.stdin.once('drain', r));
                  done++; countedInAttempt++;
                }
                continue;
              } else {
                throw batchErr;
              }
            }
            for (const d of urls) {
              const buf = d ? b64(d) : lastValidBuf;
              if (buf) {
                lastValidBuf = buf;
                if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
              }
              done++; countedInAttempt++;
            }
          }
          enc.stdin.end(); await new Promise((r) => enc.on('close', r));
          await page.close(); page = null;
          if (fs.existsSync(out) && fs.statSync(out).size > 16384) {
            break; // Part k thanh cong!
          }
          throw new Error(`File part_${k} bi rong hoac hong (<16KB)`);
        } catch (severeErr) {
          done -= countedInAttempt;
          if (enc) { try { enc.kill('SIGKILL'); } catch {} }
          if (page) { try { await page.close(); } catch {} }
          try { if (fs.existsSync(out)) fs.unlinkSync(out); } catch {}
          if (attempt < 2) {
            console.log(`  [LOI NANG - RENDER LAI PHAN DOAN] Part ${k} (${a}..${b}) gap su co (${severeErr.message}) -> Tu dong render lai rieng part ${k}...`);
          } else {
            throw severeErr;
          }
        }
      }
    }));
    clearInterval(tick);
    const list = path.join(BUILD, 'parts.txt'); fs.writeFileSync(list, parts.filter(Boolean).map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    const silent = path.join(BUILD, preview ? 'preview_silent.mp4' : 'video_silent.mp4');
    ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
    parts.filter(Boolean).forEach((p) => { try { fs.unlinkSync(p); } catch {} }); try { fs.unlinkSync(list); } catch {}

    if (preview) {
      const vp = voicePath(), outp = path.join(BUILD, 'preview.mp4');
      if (vp) ff(['-i', silent, '-ss', String(f0 / info.fps), '-t', String(total / info.fps), '-i', vp, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', outp]);
      else fs.copyFileSync(silent, outp);
      console.log(`\n✅ Xong bản xem trước: ${outp}`);
    } else {
      console.log(`\n✅ Xong hình ảnh: ${silent} (${((Date.now() - t0) / 60000).toFixed(1)} phút).`);
      if (args.mp4) {
        const vp = voicePath();
        fs.mkdirSync(path.join(PROJ, 'out'), { recursive: true });
        const finalOut = path.join(PROJ, 'out', 'video_1080p.mp4');
        if (vp) {
          ff(['-i', silent, '-i', vp, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', finalOut]);
          console.log(`🎬 Xuất xong Video MP4 hoàn chỉnh: ${finalOut}`);
        } else {
          fs.copyFileSync(silent, finalOut);
          console.log(`🎬 Xuất xong Video MP4 (chưa có voice): ${finalOut}`);
        }
      }
    }
  }
} finally { await browser.close(); server.close(); }

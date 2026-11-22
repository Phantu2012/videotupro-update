/* VideoStudio — frontend (vanilla JS) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const state = { source: "url", render: "video", engine: "edge", aspect: "16:9", style: "", projects: [], activeJob: null, detail: null, settings: {}, serverOnline: true, failCount: 0, lastNotifiedJobDone: null, notifiedJobIds: new Set(), _lastChimeTs: 0 };

function isSoundEnabled() {
  if (state.settings && typeof state.settings.sound_enabled === "boolean") {
    return state.settings.sound_enabled;
  }
  const saved = localStorage.getItem("vs_sound_enabled");
  return saved === null ? true : saved === "true";
}

function updateSoundToggleUI() {
  const on = isSoundEnabled();
  const icon = $("#sound-toggle-icon");
  const txt = $("#sound-toggle-text");
  const box = $("#sound-toggle-box");
  const cb = $("#set-sound_enabled");
  if (icon) icon.textContent = on ? "🔔" : "🔕";
  if (txt) txt.textContent = on ? "Âm báo: Bật" : "Âm báo: Tắt";
  if (box) box.style.opacity = on ? "1" : "0.65";
  if (cb) cb.checked = on;
}

async function setSoundEnabled(on, showToastMsg = true) {
  const val = Boolean(on);
  localStorage.setItem("vs_sound_enabled", String(val));
  if (!state.settings) state.settings = {};
  state.settings.sound_enabled = val;
  updateSoundToggleUI();
  try {
    await api("/api/settings", { json: { sound_enabled: val } });
  } catch {}
  if (showToastMsg) {
    toast(val ? "🔔 Đã bật cảnh báo âm thanh (khi xong ảnh tham chiếu hoặc xong hết các cảnh)" : "🔕 Đã tắt cảnh báo âm thanh", "ok");
  }
}

function playChime(kind = "done", force = false) {
  if (!force && !isSoundEnabled()) return;
  const nowMs = Date.now();
  if (!force && state._lastChimeTs && nowMs - state._lastChimeTs < 2500) return;
  state._lastChimeTs = nowMs;

  try {
    if (kind === "done") {
      const a = new Audio("/static/finished.mp3");
      a.volume = 0.7;
      a.play().catch(() => {});
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    
    // Tạo 3 nốt nhạc du dương báo hiệu hoàn tất ảnh tham chiếu (master)
    const notes = kind === "master" ? [523.25, 659.25, 783.99] : [587.33, 739.99, 880.00, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      
      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.5);
    });
  } catch (e) {
    console.log("AudioContext chime error:", e);
  }
}

function setServerOffline() {
  if (state.serverOnline) {
    state.serverOnline = false;
    const dot = $("#health-dot");
    const txt = $("#health-text");
    if (dot) dot.className = "dot err";
    if (txt) txt.textContent = "Mất kết nối server (8765)";
    $("#fastst-dot")?.setAttribute("class", "dot err");
    if ($("#fastst-text")) $("#fastst-text").textContent = "FastST: Mất kết nối";
  }
  state.failCount++;
}

async function api(path, opts = {}) {
  const init = { ...opts };
  if (opts.json !== undefined) {
    init.method = opts.method || "POST";
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.json);
  }
  let r;
  try {
    r = await fetch(path, init);
  } catch (err) {
    setServerOffline();
    throw err;
  }
  if (!state.serverOnline) {
    state.serverOnline = true;
    state.failCount = 0;
    checkHealth();
  }
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  const ct = r.headers.get("content-type") || "";
  return ct.includes("json") ? r.json() : r.blob();
}

function toast(msg, type = "") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

/* ---------------- navigation ---------------- */
function go(view) {
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  if (view === "library") loadLibrary();
  if (view === "jobs") refreshJobs();
  if (view === "settings") loadSettings();
  if (view === "social") loadSocialView();
}
$$(".nav-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));

/* ---------------- segmented controls ---------------- */
function bindSeg(sel, key, attr, after) {
  $$(`${sel} [data-${attr}]`).forEach((b) =>
    b.addEventListener("click", () => {
      $$(`${sel} [data-${attr}]`).forEach((x) => x.classList.toggle("active", x === b));
      state[key] = b.dataset[attr];
      after && after();
    })
  );
}
bindSeg("#source-grid", "source", "source", updateForm);
bindSeg("#render-seg", "render", "render", updateForm);
bindSeg("#tts-seg", "engine", "engine", loadVoices);
bindSeg("#aspect-seg", "aspect", "aspect");

function updateForm() {
  const s = state.source, video = state.render === "video";
  $("#wrap-url").hidden = s !== "url";
  $("#wrap-text").hidden = s === "url";
  $("#wrap-file").hidden = s === "url" || s === "custom";
  $("#wrap-variant").hidden = s !== "story";
  $("#text-label").textContent = { custom: "Chủ đề / ý tưởng", news: "Nội dung tin tức", story: "Nội dung truyện" }[s] || "";
  $("#wrap-audio-mode").hidden = !video;
  $("#wrap-keyframe").hidden = !video;
  $("#cost-hint").textContent = video
    ? "⚠ Veo tính phí theo giây video. 1 phút ≈ 8 clip × 8 giây. Hãy thử với thời lượng ngắn trước."
    : "Mỗi scene = 1 ảnh AI + giọng đọc + hiệu ứng chuyển động. Chi phí thấp.";
}

/* ---------------- duration toggle & presets ---------------- */
const durToggle = $("#in-enable-duration");
durToggle.addEventListener("change", () => {
  const on = durToggle.checked;
  $("#wrap-duration-input").hidden = !on;
  $("#wrap-duration-box").classList.toggle("active", on);
  const badge = $("#duration-status-badge");
  const hint = $("#duration-hint");
  if (on) {
    badge.className = "pill running";
    badge.textContent = "Đã bật: Giới hạn theo yêu cầu";
    hint.textContent = "Hệ thống sẽ điều chỉnh/cô đọng kịch bản để video có độ dài chính xác theo thời lượng bạn chọn.";
  } else {
    badge.className = "pill queued";
    badge.textContent = state.ytOrigDuration ? `Mặc định: Bằng video gốc (${state.ytOrigDuration})` : "Mặc định: Bằng video gốc";
    hint.textContent = "Mặc định (khi tắt): Giữ nguyên 100% nội dung và làm đúng theo thời lượng của video gốc.";
  }
});

$$(".dur-preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    $("#in-duration").value = btn.dataset.sec;
    toast(`Đã chọn thời lượng: ${btn.textContent}`, "ok");
  });
});

/* ---------------- youtube info detection ---------------- */
let ytDebounce = null;
$("#in-url").addEventListener("input", (e) => {
  const val = e.target.value.trim();
  clearTimeout(ytDebounce);
  if (!val || (!val.includes("youtube.com") && !val.includes("youtu.be"))) {
    $("#yt-detect-box").hidden = true;
    state.ytOrigDuration = null;
    return;
  }
  ytDebounce = setTimeout(async () => {
    $("#yt-detect-box").hidden = false;
    $("#yt-info-title").textContent = "Đang phân tích video YouTube…";
    $("#yt-info-meta").textContent = "Đang tải thông tin thời lượng & transcript...";
    try {
      const info = await api(`/api/youtube/info?url=${encodeURIComponent(val)}`);
      if (info.ok) {
        state.ytOrigDuration = info.duration_str;
        $("#yt-info-title").textContent = info.title || "Video YouTube";
        $("#yt-info-meta").textContent = `⏱ Độ dài gốc: ${info.duration_str} (${info.duration}s) · Ước tính ~${info.estimated_scenes} cảnh (${info.word_count} từ)`;
        if (!durToggle.checked) {
          $("#duration-status-badge").textContent = `Mặc định: Bằng video gốc (${info.duration_str})`;
        }
      } else {
        $("#yt-info-title").textContent = info.title || "Video YouTube";
        $("#yt-info-meta").textContent = `⚠ Không lấy được phụ đề tự động (Gemini sẽ đọc trực tiếp)`;
      }
    } catch {
      $("#yt-detect-box").hidden = true;
    }
  }, 600);
});

/* ---------------- styles ---------------- */
let loadedStylesCache = {};

function openStyleEditor(key, styleObj, focusPrompt = false) {
  const box = $("#style-editor-box");
  if (!box) return;
  box.style.display = "block";
  $("#style-edit-title").textContent = styleObj.name || (key ? key : "Tạo mới");
  $("#style-edit-key").value = key || "";
  $("#style-edit-name").value = styleObj.name || "";
  $("#style-edit-desc").value = styleObj.description || "";
  $("#style-edit-prompt").value = styleObj.prompt || "";
  const delBtn = $("#btn-del-style");
  if (delBtn) delBtn.style.display = key ? "inline-block" : "none";
  if (focusPrompt) {
    $("#style-edit-prompt").focus();
  }
}

async function loadStyles() {
  const styles = await api("/api/styles");
  loadedStylesCache = styles;
  const grid = $("#style-grid");
  grid.innerHTML = `<button class="style-card ${!state.style ? 'active' : ''}" data-key="" id="style-none"><b>Không style</b><small>Để AI tự chọn</small></button>` +
    Object.entries(styles).map(([k, v]) => `
      <div class="style-card ${state.style === k ? 'active' : ''}" data-key="${esc(k)}" id="style-${esc(k)}" title="${esc(v.prompt)}">
        <button type="button" class="style-card-edit-btn" data-edit-key="${esc(k)}" title="Chỉnh sửa mô tả & prompt">✏️</button>
        <b>${esc(v.name)}</b>
        <small>${esc(v.description)}</small>
      </div>`).join("");

  $$(".style-card", grid).forEach((c) => c.addEventListener("click", (e) => {
    if (e.target.closest(".style-card-edit-btn")) return;
    $$(".style-card", grid).forEach((x) => x.classList.toggle("active", x === c));
    state.style = c.dataset.key;
    const k = c.dataset.key;
    if (k && loadedStylesCache[k]) {
      openStyleEditor(k, loadedStylesCache[k]);
    } else {
      const box = $("#style-editor-box");
      if (box) box.style.display = "none";
    }
  }));

  $$(".style-card-edit-btn", grid).forEach((btn) => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const k = btn.dataset.editKey;
    if (k && loadedStylesCache[k]) {
      const card = $(`#style-${k}`);
      if (card) {
        $$(".style-card", grid).forEach((x) => x.classList.toggle("active", x === card));
        state.style = k;
      }
      openStyleEditor(k, loadedStylesCache[k], true);
    }
  }));
}

$("#btn-add-style")?.addEventListener("click", () => {
  openStyleEditor("", { name: "", description: "", prompt: "" }, true);
});

$("#btn-close-style-edit")?.addEventListener("click", () => {
  const box = $("#style-editor-box");
  if (box) box.style.display = "none";
});

$("#btn-save-style")?.addEventListener("click", async () => {
  const key = $("#style-edit-key").value.trim();
  const name = $("#style-edit-name").value.trim();
  const desc = $("#style-edit-desc").value.trim();
  const prompt = $("#style-edit-prompt").value.trim();

  if (!name) return toast("Vui lòng nhập tên phong cách", "error");
  if (!prompt) return toast("Vui lòng nhập prompt câu lệnh phong cách", "error");

  try {
    if (key) {
      await api(`/api/styles/${enc(key)}`, { method: "PUT", json: { name, description: desc, prompt } });
      toast(`✔ Đã cập nhật phong cách: ${name}`, "ok");
    } else {
      await api("/api/styles", { method: "POST", json: { name, description: desc, prompt } });
      toast(`✔ Đã thêm phong cách mới: ${name}`, "ok");
    }
    await loadStyles();
    const box = $("#style-editor-box");
    if (box) box.style.display = "none";
  } catch (err) {
    toast(err.message, "error");
  }
});

$("#btn-del-style")?.addEventListener("click", async () => {
  const key = $("#style-edit-key").value.trim();
  if (!key) return;
  const name = $("#style-edit-name").value;
  if (!confirm(`Bạn có chắc muốn xoá phong cách "${name}"?`)) return;
  try {
    await api(`/api/styles/${enc(key)}`, { method: "DELETE" });
    toast("Đã xoá phong cách", "ok");
    state.style = "";
    const box = $("#style-editor-box");
    if (box) box.style.display = "none";
    await loadStyles();
  } catch (err) {
    toast(err.message, "error");
  }
});

/* ---------------- voices & language sync ---------------- */
const cachedVoices = {};

const PREVIEW_SAMPLES = {
  vi: "Xin chào, đây là giọng đọc thử của VideoStudio.",
  en: "Hello! Welcome to VideoStudio, your automated AI video creation studio.",
  ja: "こんにちは、VideoStudioの音声プレビューへようこそ。",
  ko: "안녕하세요, VideoStudio 음성 미리보기에 오신 것을 환영합니다.",
  zh: "你好，欢迎收听 VideoStudio 智能语音预览。",
  fr: "Bonjour, bienvenue dans l'aperçu vocal de VideoStudio.",
  es: "Hola, bienvenido a la vista previa de voz de VideoStudio.",
  de: "Hallo, willkommen bei der Sprachvorschau von VideoStudio.",
  th: "สวัสดี ยินดีต้อนรับสู่ตัวอย่างเสียงของ VideoStudio",
  ru: "Здравствуйте, добро пожаловать в голосовой предпросмотр VideoStudio.",
  pt: "Olá, bem-vindo à prévia de voz do VideoStudio.",
  id: "Halo, selamat datang di pratinjau suara VideoStudio.",
  hi: "नमस्ते, VideoStudio वॉयस प्रीव्यू में आपका स्वागत है।"
};

function getSelectedLangMeta() {
  const langSel = $("#in-language");
  const opt = langSel?.selectedOptions?.[0];
  return {
    value: langSel?.value || "Tiếng Việt",
    label: opt?.textContent || langSel?.value || "Tiếng Việt",
    locale: opt?.dataset?.locale || "vi",
    defaultVoice: opt?.dataset?.defaultVoice || "vi-VN-HoaiMyNeural"
  };
}

function updateLangHint() {
  const hint = $("#lang-sync-hint");
  if (!hint) return;
  const meta = getSelectedLangMeta();
  const voiceName = $("#in-voice")?.selectedOptions?.[0]?.textContent || $("#in-voice")?.value || "";
  hint.textContent = `✨ Nội dung kịch bản & lời thoại sẽ tạo 100% bằng [${meta.value}] · Giọng đọc: ${voiceName}`;
}

async function loadVoices(autoSelectForLang = true) {
  const sel = $("#in-voice");
  if (!cachedVoices[state.engine]) {
    sel.innerHTML = "<option>Đang tải…</option>";
  }
  try {
    const list = cachedVoices[state.engine] || await api(`/api/voices?engine=${state.engine}`);
    cachedVoices[state.engine] = list;
    const meta = getSelectedLangMeta();
    const locPrefix = meta.locale.toLowerCase();
    const langBase = locPrefix.split("-")[0];

    if (state.engine === "gemini") {
      const def = state.settings.gemini_voice || list[0]?.id;
      sel.innerHTML = list.map((v) => `<option value="${esc(v.id)}" ${v.id === def ? "selected" : ""}>${esc(v.name)}</option>`).join("");
      updateLangHint();
      return;
    }

    // Phân nhóm giọng khớp ngôn ngữ đang chọn lên đầu
    const matched = [];
    const others = [];
    for (const v of list) {
      const vLoc = String(v.locale || v.id || "").toLowerCase();
      if (vLoc.startsWith(locPrefix) || vLoc.startsWith(langBase + "-")) {
        matched.push(v);
      } else {
        others.push(v);
      }
    }

    const targetDefault = autoSelectForLang
      ? (meta.defaultVoice || matched[0]?.id || state.settings.edge_voice)
      : (sel.value || meta.defaultVoice || state.settings.edge_voice);

    if (matched.length) {
      sel.innerHTML =
        `<optgroup label="★ Giọng đọc phù hợp (${esc(meta.value)})">` +
        matched.map((v) => `<option value="${esc(v.id)}" ${v.id === targetDefault ? "selected" : ""}>${esc(v.name)}</option>`).join("") +
        `</optgroup>` +
        `<optgroup label="Tất cả giọng đọc khác">` +
        others.map((v) => `<option value="${esc(v.id)}" ${v.id === targetDefault ? "selected" : ""}>${esc(v.name)}</option>`).join("") +
        `</optgroup>`;
    } else {
      sel.innerHTML = list.map((v) => `<option value="${esc(v.id)}" ${v.id === targetDefault ? "selected" : ""}>${esc(v.name)}</option>`).join("");
    }
    updateLangHint();
  } catch (e) {
    sel.innerHTML = "";
    toast(e.message, "error");
  }
}

$("#in-language")?.addEventListener("change", async () => {
  await loadVoices(true);
  const meta = getSelectedLangMeta();
  toast(`🌐 Đã chọn ngôn ngữ: ${meta.label} — Nội dung & Giọng đọc sẽ tạo theo ngôn ngữ này!`, "ok");
});
$("#in-voice")?.addEventListener("change", updateLangHint);

$("#in-rate").addEventListener("input", (e) => ($("#rate-val").textContent = `${e.target.value >= 0 ? "+" : ""}${e.target.value}%`));
$("#in-volume").addEventListener("input", (e) => ($("#vol-val").textContent = `${e.target.value}%`));
$("#btn-preview").addEventListener("click", async (e) => {
  const b = e.currentTarget; b.classList.add("loading");
  try {
    const voiceId = $("#in-voice").value || "";
    const meta = getSelectedLangMeta();
    const vPrefix = (voiceId.split("-")[0] || meta.locale.split("-")[0] || "vi").toLowerCase();
    const sampleText = PREVIEW_SAMPLES[vPrefix] || PREVIEW_SAMPLES[meta.locale.split("-")[0]] || PREVIEW_SAMPLES.en;
    const blob = await api("/api/tts/preview", { json: { engine: state.engine, voice: voiceId, text: sampleText } });
    const a = $("#preview-audio"); a.src = URL.createObjectURL(blob); a.play();
  } catch (err) { toast(err.message, "error"); }
  b.classList.remove("loading");
});


/* ---------------- QUY TẮC KÊNH & ẢNH THAM CHIẾU CỐ ĐỊNH ---------------- */
const CHANNEL_TEMPLATES = {
  spiritual: {
    name: "Đạo & Tâm Linh - Chữa Lành",
    character_name: "CHÚA GIÊSU (JESUS CHRIST)",
    character_gender: "Nam (Male)",
    character_signature: "Sacred male in his 30s, compassionate serene facial expression, gentle brown eyes, wavy shoulder-length dark brown hair, well-groomed neat beard and mustache. Dressed in biblical woven ivory-white linen tunic, deep crimson-red mantle draped over one shoulder, humble leather sandals, gentle soft divine golden rim lighting around hair, pure timeless sacred presence.",
    system_prompt: "Kịch bản video tâm linh - chữa lành sâu sắc cho Shorts/Reels/TikTok. Cấu trúc chuẩn 3 hồi: Hook 3s chạm trúng nỗi cô đơn hoặc bế tắc của người xem -> Sự thấu suốt và an ủi nâng đỡ -> Lời chúc phúc bình an. Giọng điệu từ tốn, ấm áp, giàu tình thương.",
    aspect_ratio: "16:9",
    style: "cinematic",
    voice: "vi-VN-NamMinhNeural"
  },
  business: {
    name: "Kinh Doanh & Tri Thức Triệu View",
    character_name: "CHUYÊN GIA CHIẾN LƯỢC KINH DOANH",
    character_gender: "Nam (Male)",
    character_signature: "Sharp professional male strategist in early 30s, modern clean-cut hairstyle, intelligent confident gaze. Wearing a tailored midnight-navy modern business suit, crisp white shirt, minimalist dark silk tie, matte black smart watch. Sleek penthouse skyline office background.",
    system_prompt: "Kịch bản video tài chính & kinh doanh triệu view. Hook 3 giây phá vỡ một định kiến phổ biến -> Nêu case study thực tế với số liệu bất ngờ -> Đúc kết 3 bài học hành động tức thì -> Kêu gọi bình luận.",
    aspect_ratio: "9:16",
    style: "cinematic",
    voice: "vi-VN-NamMinhNeural"
  },
  wisdom: {
    name: "Bài Học Cuộc Sống & Đạo Lý",
    character_name: "NGƯỜI TRẢI ĐỜI & HIỀN TRIẾT",
    character_gender: "Nam (Male)",
    character_signature: "Wise, experienced man in his late 50s, warm crinkling smile around kind eyes, distinguished silver-streaked hair and neat silver beard. Wearing comfortable earthy knit cardigan over a collar shirt. Authentic, relatable, trustworthy demeanor.",
    system_prompt: "Kịch bản triết lý nhân sinh thấm đẫm cảm xúc. Mở đầu bằng một tình huống đời thường gần gũi -> Một cú twist bất ngờ phơi bày lòng người -> Đạo lý sống nhân văn để lại dư âm sâu sắc.",
    aspect_ratio: "9:16",
    style: "cinematic",
    voice: "vi-VN-NamMinhNeural"
  },
  history: {
    name: "Hào Khí Lịch Sử & Danh Nhân",
    character_name: "DANH TƯỚNG ANH HÙNG DÂN TỘC",
    character_gender: "Nam (Male)",
    character_signature: "Heroic ancient warrior general, imposing muscular build, commanding fierce yet noble gaze, traditional battle topknot. Wearing elaborate iron scale armor with dragon-embossed pauldrons, rich crimson silk war cape, holding an ornate command sword. Epic battlefield mist and battle banner backdrop.",
    system_prompt: "Kịch bản tài liệu lịch sử điện ảnh hào hùng. Hook mở đầu với tiếng trống trận dồn dập -> Tình thế hiểm nghèo ngàn cân treo sợi tóc -> Nước cờ quân sự thiên tài -> Chiến thắng vang dội muôn đời.",
    aspect_ratio: "16:9",
    style: "cinematic",
    voice: "vi-VN-NamMinhNeural"
  }
};

let currentChannelRules = null;

async function loadAndApplyChannelRules(projectName, autoApply = false) {
  if (!projectName) return;
  const badge = $("#badge-channel-rules-status");
  try {
    const rules = await api(`/api/channels/${encodeURIComponent(projectName)}/rules`);
    currentChannelRules = rules;
    if (badge) {
      if (rules.enabled) {
        badge.textContent = "BẬT";
        badge.style.background = "rgba(16, 185, 129, 0.2)";
        badge.style.color = "#34d399";
        badge.title = "Kênh đang chạy theo quy tắc và nhân vật cố định";
      } else {
        badge.textContent = "Mặc định";
        badge.style.background = "rgba(251, 191, 36, 0.15)";
        badge.style.color = "#fbbf24";
        badge.title = "Bấm để thiết lập quy tắc tự động cho kênh này";
      }
    }
    if (autoApply && rules.enabled) {
      if (rules.aspect_ratio && $("#in-aspect")) $("#in-aspect").value = rules.aspect_ratio;
      if (rules.style && $("#in-style")) $("#in-style").value = rules.style;
      if (rules.voice && $("#in-voice")) $("#in-voice").value = rules.voice;
    }
  } catch (err) {
    console.warn("Không thể tải quy tắc kênh:", err);
  }
}

async function openChannelRulesModal() {
  const projName = $("#in-project")?.value;
  if (!projName) {
    toast("Vui lòng chọn một Dự án / Kênh trước", "error");
    return;
  }
  const modal = $("#modal-channel-rules");
  if (!modal) return;
  modal.style.display = "flex";
  const nameEl = $("#cr-project-name");
  if (nameEl) nameEl.textContent = projName;

  // 1. Nạp danh sách Phong cách hình ảnh vào #cr-style
  const styleSel = $("#cr-style");
  if (styleSel) {
    let styles = loadedStylesCache;
    if (!styles || !Object.keys(styles).length) {
      try {
        styles = await api("/api/styles");
        loadedStylesCache = styles;
      } catch (e) {}
    }
    let html = `<option value="">— Mặc định (Để AI tự chọn style) —</option>`;
    if (styles) {
      for (const [k, v] of Object.entries(styles)) {
        html += `<option value="${esc(k)}">${esc(v.name || k)}</option>`;
      }
    }
    styleSel.innerHTML = html;
  }

  // 2. Nạp danh sách Giọng đọc TTS vào #cr-voice
  const voiceSel = $("#cr-voice");
  if (voiceSel) {
    let voices = cachedVoices["edge"];
    if (!voices || !voices.length) {
      try {
        voices = await api("/api/voices?engine=edge");
        cachedVoices["edge"] = voices;
      } catch (e) {}
    }
    let html = `<option value="">— Mặc định (Theo cài đặt chung) —</option>`;
    if (voices && voices.length) {
      const viVoices = voices.filter(v => (v.id || "").toLowerCase().startsWith("vi-"));
      const enVoices = voices.filter(v => (v.id || "").toLowerCase().startsWith("en-"));

      if (viVoices.length) {
        html += `<optgroup label="Giọng Tiếng Việt chuẩn">`;
        for (const v of viVoices) {
          const vLabel = v.id.includes("HoaiMy") ? "Hoài My — Nữ miền Nam (Tự nhiên, truyền cảm)" :
                         v.id.includes("NamMinh") ? "Nam Minh — Nam miền Bắc (Ấm áp, đĩnh đạc)" : (v.name || v.id);
          html += `<option value="${esc(v.id)}">${esc(vLabel)}</option>`;
        }
        html += `</optgroup>`;
      }

      html += `<optgroup label="Giọng Gemini AI">`;
      html += `<option value="Puck">Puck (Nam - Trẻ trung, tự nhiên)</option>`;
      html += `<option value="Charon">Charon (Nam - Trầm ấm, điềm đạm)</option>`;
      html += `<option value="Kore">Kore (Nữ - Dịu dàng, truyền cảm)</option>`;
      html += `<option value="Fenrir">Fenrir (Nam - Hùng hồn, mạnh mẽ)</option>`;
      html += `<option value="Aoede">Aoede (Nữ - Sâu lắng, thanh thoát)</option>`;
      html += `</optgroup>`;

      if (enVoices.length) {
        html += `<optgroup label="Giọng Tiếng Anh (English)">`;
        for (const v of enVoices.slice(0, 20)) {
          html += `<option value="${esc(v.id)}">${esc(v.name || v.id)}</option>`;
        }
        html += `</optgroup>`;
      }
    }
    voiceSel.innerHTML = html;
  }

  try {
    const rules = await api(`/api/channels/${encodeURIComponent(projName)}/rules`);
    currentChannelRules = rules;
    if ($("#cr-enabled")) $("#cr-enabled").checked = !!rules.enabled;
    if ($("#cr-character-name")) $("#cr-character-name").value = rules.character_name || "";
    if ($("#cr-character-gender")) $("#cr-character-gender").value = rules.character_gender || "Nam (Male)";
    if ($("#cr-character-sig")) $("#cr-character-sig").value = rules.character_visual_signature || "";
    if ($("#cr-system-prompt")) $("#cr-system-prompt").value = rules.system_prompt || "";

    const aspectVal = rules.aspect_ratio || "16:9";
    if ($("#cr-aspect")) $("#cr-aspect").value = aspectVal;
    if ($("#cr-aspect-ratio")) $("#cr-aspect-ratio").value = aspectVal;

    if (rules.style && styleSel) styleSel.value = rules.style;
    if (rules.voice && voiceSel) voiceSel.value = rules.voice;
  } catch (err) {
    toast("Lỗi tải quy tắc: " + err.message, "error");
  }

  await refreshChannelReferencePreview(projName);
}

async function refreshChannelReferencePreview(projName) {
  const imgEl = $("#cr-img-preview");
  const emptyEl = $("#cr-img-empty");
  const delBtn = $("#btn-cr-del-img");
  if (!imgEl) return;
  try {
    const res = await fetch(`/api/channels/${encodeURIComponent(projName)}/reference-image?t=${Date.now()}`);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 1000) {
        imgEl.src = URL.createObjectURL(blob);
        imgEl.style.display = "block";
        if (emptyEl) emptyEl.style.display = "none";
        if (delBtn) delBtn.style.display = "inline-flex";
        return;
      }
    }
  } catch (e) {}
  imgEl.style.display = "none";
  if (emptyEl) emptyEl.style.display = "block";
  if (delBtn) delBtn.style.display = "none";
}

function closeChannelRulesModal() {
  const modal = $("#modal-channel-rules");
  if (modal) modal.style.display = "none";
}

function initChannelRulesEvents() {
  $("#btn-channel-rules")?.addEventListener("click", openChannelRulesModal);
  $("#btn-close-cr")?.addEventListener("click", closeChannelRulesModal);
  $("#btn-cancel-cr")?.addEventListener("click", closeChannelRulesModal);

  $$(".cr-tpl-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tplKey = btn.dataset.tpl;
      const tpl = CHANNEL_TEMPLATES[tplKey];
      if (!tpl) return;
      if (confirm(`Áp dụng mẫu chuyên gia "${tpl.name}" cho kênh này?`)) {
        if ($("#cr-enabled")) $("#cr-enabled").checked = true;
        if ($("#cr-character-name")) $("#cr-character-name").value = tpl.character_name;
        if ($("#cr-character-gender")) $("#cr-character-gender").value = tpl.character_gender;
        if ($("#cr-character-sig")) $("#cr-character-sig").value = tpl.character_signature;
        if ($("#cr-system-prompt")) $("#cr-system-prompt").value = tpl.system_prompt;
        if (tpl.aspect_ratio) { if ($("#cr-aspect")) $("#cr-aspect").value = tpl.aspect_ratio; if ($("#cr-aspect-ratio")) $("#cr-aspect-ratio").value = tpl.aspect_ratio; }
        if (tpl.style && $("#cr-style")) $("#cr-style").value = tpl.style;
        if (tpl.voice && $("#cr-voice")) $("#cr-voice").value = tpl.voice;
        toast(`✔ Đã nạp mẫu "${tpl.name}"! Nhớ bấm 'Lưu Quy Tắc'.`, "ok");
      }
    });
  });

  $("#btn-save-cr")?.addEventListener("click", async () => {
    const projName = $("#in-project")?.value;
    if (!projName) return;
    const payload = {
      enabled: $("#cr-enabled")?.checked ?? false,
      character_name: $("#cr-character-name")?.value.trim() || "",
      character_gender: $("#cr-character-gender")?.value || "Nam (Male)",
      character_visual_signature: $("#cr-character-sig")?.value.trim() || "",
      system_prompt: $("#cr-system-prompt")?.value.trim() || "",
      aspect_ratio: $("#cr-aspect")?.value || $("#cr-aspect-ratio")?.value || "16:9",
      style: $("#cr-style")?.value || "cinematic",
      voice: $("#cr-voice")?.value || "vi-VN-NamMinhNeural"
    };
    try {
      await api(`/api/channels/${encodeURIComponent(projName)}/rules`, { method: "POST", json: payload });
      toast(`✔ Đã lưu thành công quy tắc cho kênh "${projName}"!`, "ok");
      closeChannelRulesModal();
      await loadAndApplyChannelRules(projName, true);
    } catch (err) {
      toast("Lỗi lưu quy tắc: " + err.message, "error");
    }
  });

  $("#cr-file-input")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const projName = $("#in-project")?.value;
    if (!projName) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      toast("Đang tải ảnh tham chiếu lên...", "ok");
      await api(`/api/channels/${encodeURIComponent(projName)}/reference-image`, { method: "POST", body: fd });
      toast("✔ Đã tải lên ảnh tham chiếu cố định cho kênh!", "ok");
      await refreshChannelReferencePreview(projName);
    } catch (err) {
      toast("Lỗi upload: " + err.message, "error");
    }
    e.target.value = "";
  });

  $("#btn-cr-del-img")?.addEventListener("click", async () => {
    const projName = $("#in-project")?.value;
    if (!projName || !confirm("Bạn có chắc muốn xóa ảnh tham chiếu cố định của kênh này?")) return;
    try {
      await api(`/api/channels/${encodeURIComponent(projName)}/reference-image`, { method: "DELETE" });
      toast("Đã xóa ảnh tham chiếu của kênh.", "ok");
      await refreshChannelReferencePreview(projName);
    } catch (err) {
      toast("Lỗi: " + err.message, "error");
    }
  });

  $("#btn-cr-gen-ai")?.addEventListener("click", async () => {
    const projName = $("#in-project")?.value;
    if (!projName) return;
    const charName = $("#cr-character-name")?.value.trim() || "MAIN CHARACTER";
    const charSig = $("#cr-character-sig")?.value.trim() || "";
    const gender = $("#cr-character-gender")?.value || "Nam (Male)";
    const style = $("#cr-style")?.value || "cinematic";

    const btn = $("#btn-cr-gen-ai");
    btn.disabled = true;
    btn.textContent = "⏳ AI đang vẽ 3 góc...";
    toast("⏳ Đang dùng AI vẽ bảng tham chiếu 3 góc nhìn (16:9)... Vui lòng đợi khoảng 15-30s", "ok");

    try {
      const res = await api(`/api/channels/${encodeURIComponent(projName)}/generate-reference`, {
        method: "POST",
        json: { character_name: charName, visual_signature: charSig, gender: gender, style: style }
      });
      if (res.ok) {
        toast("✔ Đã vẽ xong ảnh tham chiếu 3 góc nhìn chuẩn chỉ!", "ok");
        await refreshChannelReferencePreview(projName);
      }
    } catch (err) {
      toast("Lỗi vẽ ảnh: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "🎨 AI Vẽ Mới";
    }
  });
}

/* ---------------- projects & assets (Mỗi dự án = 1 Kênh với thư mục lưu trữ riêng) ---------------- */
async function loadProjects(selectName) {
  state.projects = await api("/api/projects");
  if (!state.projects.length) { await api("/api/projects", { json: { name: "Mặc định" } }); state.projects = await api("/api/projects"); }
  const opts = state.projects.map((p) => `<option value="${esc(p.name)}">${esc(p.name)} (${p.videos})${p.is_custom_dir ? " 📁" : ""}</option>`).join("");
  for (const id of ["#in-project", "#lib-project"]) {
    const cur = selectName || $(id).value;
    $(id).innerHTML = opts;
    if (cur && state.projects.some((p) => p.name === cur)) $(id).value = cur;
  }
  fillAssets();
  syncLibProjectPathUI();
  loadAndApplyChannelRules($("#in-project")?.value, false);
}

function syncCreateProjectPathUI(p) {
  const projName = p?.name || $("#in-project")?.value || "Mặc định";
  if ($("#lbl-active-project-name")) $("#lbl-active-project-name").textContent = projName;
  if ($("#in-project-path")) $("#in-project-path").value = p?.custom_dir || p?.path || "";
  const badge = $("#badge-project-path-mode");
  if (badge) {
    badge.textContent = p?.is_custom_dir ? "📁 Thư mục kênh riêng" : "Mặc định";
    badge.className = `pill ${p?.is_custom_dir ? "done" : "queued"}`;
  }
  if ($("#hint-project-active-path") && p?.path) {
    $("#hint-project-active-path").textContent = `📍 Đang lưu toàn bộ dữ liệu & video của kênh "${projName}" tại: ${p.path}`;
  }
}

function syncLibProjectPathUI() {
  const projName = $("#lib-project")?.value;
  const p = state.projects.find((x) => x.name === projName);
  if ($("#lib-project-path") && p) {
    $("#lib-project-path").value = p.custom_dir || p.path || "";
  }
}

function friendlyMusicName(f) {
  if (!f) return "— Không nhạc —";
  const map = {
    "01_Uplifting_Inspiring.mp3": "🎵 Truyền cảm hứng & Đoàn kết (Inspiring Upbeat)",
    "02_Lofi_Anime_Chill.mp3": "🌸 Anime & Lofi Thư Giãn (Chill)",
    "03_Happy_Upbeat.mp3": "☀️ Vui tươi & Tích cực (Happy Upbeat)",
    "04_Gentle_Acoustic.mp3": "🎸 Guitar Acoustic Mộc (Sâu lắng, ấm áp)",
    "05_Cinematic_Dramatic.mp3": "🎬 Kịch tính & Phim ảnh (Cinematic Dramatic)",
    "06_Deep_Ambient.mp3": "🌌 Ambient Không Gian (Bí ẩn, Lắng đọng)"
  };
  return map[f] || `🎵 ${f.replace(/\.[^/.]+$/, "")}`;
}

function friendlyLogoName(f) {
  if (!f) return "— Không logo —";
  const map = {
    "01_Logo_VideoStudio_Pro.png": "🏷️ Logo Video Studio Pro",
    "02_Logo_Ai_Channel.png": "⚡ Logo AI Studio Official",
    "03_Watermark_UltraHD.png": "✨ Watermark 4K Ultra HD"
  };
  return map[f] || `🏷️ ${f.replace(/\.[^/.]+$/, "")}`;
}

let _currentAudioPreview = null;
let _currentPreviewBtn = null;
function toggleMusicPreview(musicFile, btnEl) {
  if (_currentAudioPreview) {
    _currentAudioPreview.pause();
    _currentAudioPreview = null;
    if (_currentPreviewBtn) _currentPreviewBtn.textContent = "▶";
    if (btnEl === _currentPreviewBtn) return;
  }
  if (!musicFile) {
    toast("Vui lòng chọn một bản nhạc để nghe thử!", "info");
    return;
  }
  const audio = new Audio(`/api/assets/music/${encodeURIComponent(musicFile)}`);
  audio.volume = 0.5;
  _currentPreviewBtn = btnEl;
  if (btnEl) btnEl.textContent = "⏳";
  audio.play().then(() => {
    _currentAudioPreview = audio;
    if (btnEl) btnEl.textContent = "⏹";
    audio.onended = () => {
      _currentAudioPreview = null;
      if (btnEl) btnEl.textContent = "▶";
    };
  }).catch((err) => {
    if (btnEl) btnEl.textContent = "▶";
    toast(`Không thể phát nhạc: ${err.message}`, "error");
  });
}

function updateCreateLogoThumb() {
  const val = $("#in-logo")?.value;
  const thumb = $("#logo-preview-thumb");
  if (!thumb) return;
  if (val) {
    thumb.src = `/api/assets/logo/${encodeURIComponent(val)}`;
    thumb.style.display = "inline-block";
  } else {
    thumb.style.display = "none";
  }
}

function fillAssets() {
  const curProjName = $("#in-project")?.value || "Mặc định";
  const p = state.projects.find((x) => x.name === curProjName) || { name: curProjName, music: [], logo: [] };
  const curMusic = $("#in-music")?.value;
  const curLogo = $("#in-logo")?.value;

  // Thu thập toàn bộ nhạc & logo: gồm nhạc riêng của kênh này + kho nhạc chung của tool
  const allMusic = Array.from(new Set([
    ...(p.music || []),
    ...state.projects.flatMap((x) => x.music || []),
    "01_Uplifting_Inspiring.mp3",
    "02_Lofi_Anime_Chill.mp3",
    "03_Happy_Upbeat.mp3",
    "04_Gentle_Acoustic.mp3",
    "05_Cinematic_Dramatic.mp3",
    "06_Deep_Ambient.mp3"
  ])).filter(Boolean);

  const allLogo = Array.from(new Set([
    ...(p.logo || []),
    ...state.projects.flatMap((x) => x.logo || []),
    "01_Logo_VideoStudio_Pro.png",
    "02_Logo_Ai_Channel.png",
    "03_Watermark_UltraHD.png"
  ])).filter(Boolean);

  $("#in-music").innerHTML = `<option value="">— Không nhạc —</option>` + allMusic.map((m) => `<option value="${esc(m)}">${esc(friendlyMusicName(m))}</option>`).join("");
  $("#in-logo").innerHTML = `<option value="">— Không logo —</option>` + allLogo.map((m) => `<option value="${esc(m)}">${esc(friendlyLogoName(m))}</option>`).join("");

  if (curMusic && allMusic.includes(curMusic)) {
    $("#in-music").value = curMusic;
  } else if (allMusic.length) {
    $("#in-music").value = allMusic[0];
  }

  if (curLogo && allLogo.includes(curLogo)) {
    $("#in-logo").value = curLogo;
  }

  updateCreateLogoThumb();
  syncCreateProjectPathUI(p);
}

async function saveProjectCustomPath(projName, customDir) {
  if (!projName) return;
  try {
    const res = await api(`/api/projects/${enc(projName)}/path`, {
      method: "PUT",
      json: { custom_dir: (customDir || "").trim(), copy_existing: true }
    });
    await loadProjects(projName);
    toast(`✔ Đã lưu nơi lưu trữ cho kênh "${projName}": ${res.path}`, "ok");
  } catch (err) {
    toast(err.message, "error");
  }
}

$("#in-project").addEventListener("change", () => {
  fillAssets();
  loadAndApplyChannelRules($("#in-project").value, true);
});

/* ---------------- DUYỆT THƯ MỤC TRỰC QUAN TRÊN BROWSER ---------------- */
let fbCurrentCallback = null;
let fbParentPath = null;

async function navigateFolderBrowser(targetPath) {
  const listEl = $("#fb-folder-list");
  const pathIn = $("#fb-current-path");
  const quickList = $("#fb-quick-list");
  if (!listEl) return;

  listEl.innerHTML = '<span class="muted tiny">Đang tải danh sách thư mục...</span>';
  try {
    const q = targetPath ? `?path=${encodeURIComponent(targetPath)}` : "";
    const data = await api(`/api/fs/list-dirs${q}`);
    fbParentPath = data.parent;
    if (pathIn) pathIn.value = data.current || "";

    if (quickList) {
      let qHtml = "";
      for (const d of data.drives || []) {
        qHtml += `<button type="button" class="btn ghost sm fb-quick-item" data-path="${esc(d.path)}" style="padding:2px 8px;font-size:11px;border-color:rgba(168,85,247,0.4);color:#c084fc">💾 ${esc(d.name)}</button>`;
      }
      for (const qa of data.quick_access || []) {
        qHtml += `<button type="button" class="btn ghost sm fb-quick-item" data-path="${esc(qa.path)}" style="padding:2px 8px;font-size:11px">📁 ${esc(qa.name)}</button>`;
      }
      quickList.innerHTML = qHtml;
      $$(".fb-quick-item").forEach((b) => {
        b.addEventListener("click", () => navigateFolderBrowser(b.dataset.path));
      });
    }

    if (!data.folders || !data.folders.length) {
      listEl.innerHTML = '<span class="muted tiny" style="padding:10px">Thư mục này trống (hoặc không có thư mục con). Bấm "✔ Chọn Thư Mục Này" để sử dụng.</span>';
    } else {
      let fHtml = "";
      for (const f of data.folders) {
        fHtml += `
          <div class="fb-folder-row" data-path="${esc(f.path)}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;background:rgba(255,255,255,0.02);transition:background 0.15s">
            <span style="font-size:14px">📁</span>
            <span style="font-size:12px;color:#f1f5f9;font-weight:500">${esc(f.name)}</span>
          </div>
        `;
      }
      listEl.innerHTML = fHtml;
      $$(".fb-folder-row").forEach((row) => {
        row.addEventListener("mouseenter", () => { row.style.background = "rgba(168, 85, 247, 0.15)"; });
        row.addEventListener("mouseleave", () => { row.style.background = "rgba(255, 255, 255, 0.02)"; });
        row.addEventListener("click", () => {
          navigateFolderBrowser(row.dataset.path);
        });
      });
    }
  } catch (err) {
    listEl.innerHTML = `<span class="tiny" style="color:#f87171;padding:10px">Lỗi: ${esc(err.message)}</span>`;
  }
}

function openFolderBrowserModal(initialPath, onSelect) {
  fbCurrentCallback = onSelect;
  const modal = $("#modal-folder-browser");
  if (!modal) return;
  modal.style.display = "flex";
  navigateFolderBrowser(initialPath || "");
}

function closeFolderBrowserModal() {
  const modal = $("#modal-folder-browser");
  if (modal) modal.style.display = "none";
  fbCurrentCallback = null;
}

$("#btn-close-fb-modal")?.addEventListener("click", closeFolderBrowserModal);
$("#btn-cancel-fb")?.addEventListener("click", closeFolderBrowserModal);

$("#btn-fb-up")?.addEventListener("click", () => {
  if (fbParentPath) navigateFolderBrowser(fbParentPath);
});

$("#btn-fb-go")?.addEventListener("click", () => {
  const p = $("#fb-current-path")?.value || "";
  navigateFolderBrowser(p);
});

$("#fb-current-path")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") navigateFolderBrowser(e.target.value);
});

$("#btn-select-fb")?.addEventListener("click", () => {
  const chosen = $("#fb-current-path")?.value || "";
  if (fbCurrentCallback) fbCurrentCallback(chosen);
  closeFolderBrowserModal();
});

$("#btn-fb-create-folder")?.addEventListener("click", async () => {
  const parentPath = $("#fb-current-path")?.value || "";
  const name = $("#fb-new-folder-name")?.value.trim();
  if (!parentPath || !name) {
    toast("Vui lòng nhập tên thư mục mới!", "error");
    return;
  }
  try {
    const res = await api("/api/fs/create-dir", {
      method: "POST",
      json: { parent: parentPath, name: name }
    });
    if (res.ok && res.path) {
      toast(`✔ Đã tạo thư mục: ${name}`, "ok");
      $("#fb-new-folder-name").value = "";
      navigateFolderBrowser(res.path);
    }
  } catch (err) {
    toast(`Lỗi tạo thư mục: ${err.message}`, "error");
  }
});

$("#btn-browse-project-path")?.addEventListener("click", () => {
  const projName = $("#in-project").value;
  const curPath = $("#in-project-path")?.value || "";
  openFolderBrowserModal(curPath, async (selectedPath) => {
    if (selectedPath) {
      $("#in-project-path").value = selectedPath;
      await saveProjectCustomPath(projName, selectedPath);
    }
  });
});

$("#btn-save-project-path")?.addEventListener("click", async () => {
  const projName = $("#in-project").value;
  const pathVal = $("#in-project-path")?.value || "";
  await saveProjectCustomPath(projName, pathVal);
});

$("#btn-open-project-path")?.addEventListener("click", async () => {
  const projName = $("#in-project").value;
  await api("/api/open-folder", { json: { project: projName } });
});

$("#btn-new-project").addEventListener("click", async () => {
  const name = prompt("Nhập tên Dự án / Kênh mới (VD: Kênh Tài Chính, Kênh Hoạt Hình):");
  if (!name || !name.trim()) return;
  const customDir = prompt(
    `Nhập đường dẫn thư mục lưu trữ riêng cho kênh "${name.trim()}"\n(Hoặc để trống nếu muốn chọn sau bằng nút "📂 Chọn…"):`,
    ""
  );
  const meta = await api("/api/projects", { json: { name: name.trim(), custom_dir: (customDir || "").trim() } });
  await loadProjects(meta.project_name);
  toast(`✔ Đã tạo kênh "${meta.project_name}" (${meta.path || ""})`, "ok");
});
for (const kind of ["music", "logo"]) {
  $(`#up-${kind}`).addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    try {
      const r = await api(`/api/projects/${encodeURIComponent($("#in-project").value)}/assets/${kind}`, { method: "POST", body: fd });
      await loadProjects();
      $(`#in-${kind}`).value = r.file;
      if (kind === "logo") updateCreateLogoThumb();
      toast(`Đã tải lên ${r.file}`, "ok");
    } catch (err) { toast(err.message, "error"); }
    e.target.value = "";
  });
}

$("#btn-preview-music")?.addEventListener("click", () => {
  toggleMusicPreview($("#in-music")?.value, $("#btn-preview-music"));
});
$("#in-music")?.addEventListener("change", () => {
  if (_currentAudioPreview) toggleMusicPreview(null, $("#btn-preview-music"));
});
$("#in-logo")?.addEventListener("change", updateCreateLogoThumb);

/* file drop */
const drop = $("#file-drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
drop.addEventListener("drop", (e) => { if (e.dataTransfer.files[0]) { $("#in-file").files = e.dataTransfer.files; showFile(); } });
$("#in-file").addEventListener("change", showFile);
function showFile() { const f = $("#in-file").files[0]; $("#file-name").textContent = f ? `📄 ${f.name}` : "⬆ Kéo thả hoặc chọn file .txt"; }

/* ---------------- submit ---------------- */
async function submit(stopAfter) {
  const name = $("#in-name").value.trim() || `video-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
  const fd = new FormData();
  const fields = {
    project: $("#in-project").value, render: state.render, source: state.source, name,
    url: $("#in-url").value.trim(), input_text: $("#in-text").value, style: state.style,
    copy_ratio: $("#in-copy-ratio")?.value || "80",
    language: $("#in-language").value, tts_engine: state.engine, voice: $("#in-voice").value,
    tts_rate: $("#rate-val").textContent, aspect_ratio: state.aspect,
    enable_custom_duration: $("#in-enable-duration").checked,
    duration: $("#in-enable-duration").checked ? ($("#in-duration").value || 60) : 0,
    video_platform: $("#in-video-platform")?.value || "flow",
    story_variant: $("#in-variant").value, audio_mode: $("#in-audio-mode").value,
    keyframe: $("#in-keyframe").checked, use_master_image: $("#in-master").checked,
    burn_subtitles: $("#in-subs").checked,
    auto_publish: $("#in-auto-publish") ? $("#in-auto-publish").checked : false,
    music: $("#in-music").value, logo: $("#in-logo").value,
    music_volume: ($("#in-volume").value / 100).toFixed(2), extra_notes: $("#in-notes").value, stop_after: stopAfter || "",
  };
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  const f = $("#in-file").files[0];
  if (f && state.source !== "url") fd.append("file", f);
  try {
    const job = await api("/api/jobs", { method: "POST", body: fd });
    toast(`Đã thêm vào hàng đợi: ${job.title}`, "ok");
    state.activeJob = job.id;
    go("jobs");
  } catch (e) { toast(e.message, "error"); }
}
$("#btn-run").addEventListener("click", () => submit(""));
$("#btn-script-only").addEventListener("click", () => submit("script"));

/* ---------------- jobs ---------------- */
const statusText = { queued: "Chờ", running: "Đang chạy", done: "Xong", error: "Lỗi", cancelled: "Đã huỷ" };
async function refreshJobs() {
  let jobs = [];
  try { jobs = await api("/api/jobs"); } catch { return; }
  const running = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  $("#jobs-badge").hidden = !running; $("#jobs-badge").textContent = running;

  // Phát hiện job vừa hoàn tất: CHỈ reo chuông khi xong Ảnh tham chiếu (stop_after === 'master') HOẶC khi đã xong hết toàn bộ các cảnh
  const doneJobs = jobs.filter((j) => j.status === "done");
  if (state.lastNotifiedJobDone === null) {
    doneJobs.forEach((j) => state.notifiedJobIds.add(j.id));
    state.lastNotifiedJobDone = "__initialized__";
  } else {
    for (const dj of doneJobs) {
      if (!state.notifiedJobIds.has(dj.id)) {
        state.notifiedJobIds.add(dj.id);
        const stopAfter = dj.params?.stop_after || "";
        if (stopAfter === "master") {
          playChime("master");
          toast(`🎨 Đã vẽ xong ảnh tham chiếu nhân vật: ${dj.title}!`, "ok");
        } else if (stopAfter !== "script" && dj.kind !== "scene") {
          // Chỉ kêu khi hoàn tất toàn bộ các cảnh / ghép xong toàn bộ dự án (không kêu lẻ từng cảnh)
          playChime("done");
          toast(`🎉 Đã hoàn tất toàn bộ các cảnh: ${dj.title}!`, "ok");
        }
      }
    }
  }
  if (!$("#view-jobs").classList.contains("active")) return;
  $("#job-list").innerHTML = jobs.length ? jobs.map((j) => `
    <div class="job-item ${j.status} ${j.id === state.activeJob ? "active" : ""}" data-id="${j.id}" id="job-${j.id}">
      <div class="job-top">
        <b>${esc(j.title)}</b>
        <span class="pill ${j.status}">${statusText[j.status]}</span>
      </div>
      <div class="bar"><i style="width:${Math.round(j.progress * 100)}%"></i></div>
      <div class="job-bot">
        <small class="muted">${esc(j.step)}</small>
        <button type="button" class="btn-del-job" data-del-id="${j.id}" title="Xoá job này khỏi hàng đợi">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          Xóa
        </button>
      </div>
    </div>`).join("") : `<div class="empty">Chưa có job nào</div>`;

  $$(".job-item").forEach((el) => el.addEventListener("click", () => { state.activeJob = el.dataset.id; refreshJobs(); }));

  $$(".btn-del-job").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.delId;
      try {
        await api(`/api/jobs/${id}`, { method: "DELETE" });
        toast("Đã xoá job", "ok");
        if (state.activeJob === id) {
          state.activeJob = null;
          $("#job-detail").innerHTML = `<p class="muted center">Chọn một job để xem chi tiết</p>`;
        }
        await refreshJobs();
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });

  if (!state.activeJob && jobs[0]) state.activeJob = jobs[0].id;
  if (state.activeJob) renderJobDetail();
}
async function renderJobDetail() {
  let j;
  try { j = await api(`/api/jobs/${state.activeJob}`); } catch { return; }
  const box = $("#job-detail");
  const logs = box.querySelector(".logs");
  const atBottom = !logs || logs.scrollHeight - logs.scrollTop - logs.clientHeight < 30;
  const p = j.params;
  box.innerHTML = `
    <div class="job-top"><h2>${esc(j.title)}</h2><span class="pill ${j.status}">${statusText[j.status]}</span></div>
    <div class="bar ${j.status}"><i style="width:${Math.round(j.progress * 100)}%"></i></div>
    <div class="job-top"><span>${esc(j.step)}</span><b>${Math.round(j.progress * 100)}%</b></div>
    ${j.error ? `<div class="toast error" style="max-width:none;animation:none">${esc(j.error)}</div>` : ""}
    <div class="inline">
      ${["running", "queued"].includes(j.status) ? `<button class="btn danger sm" id="btn-cancel-job">Huỷ</button>` : ""}
      ${["error", "cancelled", "done"].includes(j.status) ? `<button class="btn ghost sm" id="btn-resume-job">↻ Tiếp tục / Render lại</button>` : ""}
      <button class="btn danger sm" id="btn-delete-job" title="Xoá job này khỏi danh sách">🗑 Xoá job</button>
      <button class="btn ghost sm" id="btn-open-video">▦ Mở trong thư viện</button>
    </div>
    <div class="logs">${esc((j.logs || []).join("\n"))}</div>`;
  const nl = box.querySelector(".logs");
  if (atBottom) nl.scrollTop = nl.scrollHeight;
  $("#btn-cancel-job")?.addEventListener("click", async () => { await api(`/api/jobs/${j.id}/cancel`, { json: {} }); toast("Đang huỷ…"); });
  $("#btn-resume-job")?.addEventListener("click", async () => {
    const nj = await api(`/api/videos/${enc(p.project)}/${enc(p.mode)}/${enc(p.name)}/resume`, { json: {} });
    state.activeJob = nj.id; refreshJobs();
  });
  $("#btn-delete-job")?.addEventListener("click", async () => {
    await api(`/api/jobs/${j.id}`, { method: "DELETE" });
    toast("Đã xoá job khỏi hàng đợi", "ok");
    state.activeJob = null;
    $("#job-detail").innerHTML = `<p class="muted center">Chọn một job để xem chi tiết</p>`;
    await refreshJobs();
  });
  $("#btn-open-video").addEventListener("click", () => { go("library"); $("#lib-project").value = p.project; openVideo(p.project, p.mode, p.name); });
}

$("#btn-clear-jobs")?.addEventListener("click", async () => {
  if (!confirm("Bạn có chắc chắn muốn xoá tất cả các job đã hoàn tất, lỗi hoặc đã huỷ?")) return;
  try {
    const res = await api("/api/jobs", { method: "DELETE" });
    toast(`Đã xoá ${res.deleted || 0} job khỏi hàng đợi`, "ok");
    state.activeJob = null;
    $("#job-detail").innerHTML = `<p class="muted center">Chọn một job để xem chi tiết</p>`;
    await refreshJobs();
  } catch (err) {
    toast(err.message, "error");
  }
});
const enc = encodeURIComponent;

async function syncDetailLive() {
  if (!state.currentDetailContext) return;
  const { project, mode, name } = state.currentDetailContext;
  try {
    const d = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}`);
    if (!d || !d.scenes) return;

    // 1. Cập nhật từng thẻ cảnh (KHÔNG phát âm báo lẻ từng cảnh, chỉ phát khi TẤT CẢ các cảnh đã xong hết)
    let newlyDoneCount = 0;
    for (const s of d.scenes) {
      const sid = s.scene_id;
      const card = $(`#scard-${sid}`);
      if (!card) continue;

      const mediaBox = card.querySelector(".scard-media");
      const hasVideo = mediaBox && mediaBox.querySelector("video");
      if (!hasVideo && s.clip_url) {
        mediaBox.innerHTML = `<video src="${s.clip_url}" poster="${s.thumb_url || ""}" controls preload="none"></video>`;
        card.classList.remove("has-error");
        const pill = $(`#pill-${sid}`);
        if (pill) {
          pill.className = "pill done";
          pill.textContent = "✔ Đã tạo video";
        }
        const errPill = card.querySelector(".scard-title-wrap .pill.error");
        if (errPill) errPill.remove();
        const fixBtn = card.querySelector('[data-act="fix-gen"]');
        if (fixBtn) fixBtn.remove();
        newlyDoneCount++;
        toast(`✔ Cảnh ${sid} đã tạo xong và sẵn sàng xem!`, "ok");
      }
    }

    const allScenesDone = d.scenes.length > 0 && d.scenes.every((s) => !!s.clip_url);
    if (newlyDoneCount > 0 && allScenesDone) {
      playChime("done");
      toast(`🎉 Đã tạo xong toàn bộ ${d.scenes.length}/${d.scenes.length} cảnh của dự án!`, "ok");
    }

    // Tự động quét Google Flow nền chỉ khi KHÔNG có job nào đang chạy (tránh tranh chấp thao tác chuột/DOM với luồng đang tạo cảnh!)
    const hasMissing = d.scenes.some((s) => !s.clip_url);
    const hasRunningJob = (state.jobs || []).some((j) => j.status === "running" || j.status === "queued");
    if (hasMissing && !hasRunningJob && (!state._lastFlowSync || Date.now() - state._lastFlowSync > 25000)) {
      state._lastFlowSync = Date.now();
      api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/sync-flow`, { method: "POST" })
        .then((r) => {
          if (r && r.synced_count > 0) {
            if (!r.missing || r.missing.length === 0) {
              playChime("done");
              toast(`🎉 Đã đồng bộ xong toàn bộ các cảnh từ Google Flow!`, "ok");
            } else {
              toast(`✔ Tự động đồng bộ ${r.synced_count} video từ Google Flow!`, "ok");
            }
            syncDetailLive();
          }
        })
        .catch(() => {});
    }

    // 2. Cập nhật ảnh tham chiếu Master Cast CHỈ khi vừa mới tạo xong (trước đó chưa có thẻ img)
    const masterWrap = $(".master-turnaround");
    if (masterWrap && d.sample_url) {
      const curImg = masterWrap.querySelector("img");
      if (!curImg) {
        const freshUrl = d.sample_url.includes('?') ? `${d.sample_url}&_t=${Date.now()}` : `${d.sample_url}?_t=${Date.now()}`;
        masterWrap.innerHTML = `<span class="badge-main">CHÍNH</span><img src="${freshUrl}" alt="Master Cast Turnaround" id="master-img" title="🔍 Bấm để xem phóng to toàn màn hình" style="cursor:zoom-in">`;
        playChime("master");
        toast("🎨 Đã vẽ xong & đồng bộ ảnh tham chiếu nhân vật (Master Cast)!", "ok");
      }
    }

    // 3. Cập nhật video hoàn chỉnh nếu vừa ghép xong
    if (d.final_url && !$("#final-video-box")) {
      const container = $("#video-detail");
      const topCard = `
      <div class="card" id="final-video-box" style="margin-bottom:20px">
        <div class="job-top">
          <h2>🎬 Video hoàn chỉnh: ${esc(d.meta?.title || name)}</h2>
          <div class="inline">
            <a class="btn primary sm" href="${d.final_url}" download>⬇ Tải MP4</a>
          </div>
        </div>
        <video src="${d.final_url}" controls style="width:100%;max-height:500px;border-radius:12px;background:#000;margin-top:12px"></video>
      </div>`;
      container.insertAdjacentHTML("afterbegin", topCard);
      playChime("done");
      toast("🎉 Video hoàn chỉnh đã ghép xong!", "ok");
    }
  } catch (err) {
    // Bỏ qua lỗi kết nối tạm thời
  }
}

setInterval(() => {
  if (document.hidden) return;
  if (!state.serverOnline && state.failCount % 5 !== 0) {
    state.failCount++;
    return;
  }
  refreshJobs();
  if (state.currentDetailContext && $("#view-library").classList.contains("active") && $("#video-detail").innerHTML.trim()) {
    syncDetailLive();
  }
}, 2000);

/* ---------------- library ---------------- */
const modeLabel = (m) => {
  const [r, s] = m.split("_");
  return `${r === "ai" ? "🎬 Video AI" : "🖼 Ảnh AI"} · ${{ url: "YouTube", custom: "Chủ đề", news: "Tin tức", story: "Truyện" }[s] || s}`;
};
async function loadLibrary() {
  await loadProjects();
  const proj = $("#lib-project").value;
  const vids = await api(`/api/projects/${enc(proj)}/videos`);
  $("#video-grid").innerHTML = vids.length ? vids.map((v) => `
    <div class="vcard" data-mode="${esc(v.mode)}" data-name="${esc(v.name)}" id="vcard-${esc(v.mode)}-${esc(v.name)}">
      <div class="vthumb">${v.thumb_url ? `<img src="${v.thumb_url}" alt="${esc(v.title)}" loading="lazy">` : "🎞"}
        <span class="pill ${v.final_url ? "done" : "queued"}">${v.final_url ? "Hoàn tất" : "Nháp"}</span></div>
      <div class="vbody"><b>${esc(v.title)}</b><small class="muted">${modeLabel(v.mode)} · ${v.scenes} scene</small></div>
    </div>`).join("") : `<div class="empty">Dự án chưa có video. Hãy tạo video mới ✦</div>`;
  $$(".vcard").forEach((c) => c.addEventListener("click", () => openVideo(proj, c.dataset.mode, c.dataset.name)));
  if (!state.detail || state.detail.project !== proj) $("#video-detail").innerHTML = "";
}
$("#lib-project").addEventListener("change", () => { state.detail = null; syncLibProjectPathUI(); loadLibrary(); });
$("#btn-open-folder").addEventListener("click", () => api("/api/open-folder", { json: { project: $("#lib-project").value } }));
$("#btn-lib-browse-path")?.addEventListener("click", async () => {
  const projName = $("#lib-project").value;
  const curPath = $("#lib-project-path")?.value || "";
  try {
    const res = await api("/api/browse-folder", {
      method: "POST",
      json: { initial_dir: curPath, title: `Chọn thư mục lưu trữ cho Kênh: ${projName}` }
    });
    if (res.ok && res.path) {
      $("#lib-project-path").value = res.path;
      await saveProjectCustomPath(projName, res.path);
      await loadLibrary();
    }
  } catch (err) {
    toast(err.message, "error");
  }
});
$("#btn-lib-save-path")?.addEventListener("click", async () => {
  const projName = $("#lib-project").value;
  const pathVal = $("#lib-project-path")?.value || "";
  await saveProjectCustomPath(projName, pathVal);
  await loadLibrary();
});
$("#btn-del-project").addEventListener("click", async () => {
  const p = $("#lib-project").value;
  if (!confirm(`Xoá toàn bộ dự án "${p}"? Không thể hoàn tác.`)) return;
  await api(`/api/projects/${enc(p)}`, { method: "DELETE" });
  toast("Đã xoá dự án", "ok"); state.detail = null; loadLibrary();
});

async function openVideo(project, mode, name) {
  let d;
  try { d = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}`); } catch (e) { return toast(e.message, "error"); }
  state.detail = d;
  state.currentDetailContext = { project, mode, name };
  const isVideo = mode.startsWith("ai_");
  const pk = isVideo ? "video_prompt" : "image_prompt";
  const vertical = (d.options.aspect_ratio || "") === "9:16";
  const selectedScenes = new Set();

  // Trích xuất danh sách tên nhân vật để match badge
  const charNames = (d.characters || []).map((c) => c.name.trim());
  const masterPromptText = d.master_cast_image_prompt || d.meta?.master_prompt || (d.characters.map((c) => `${c.name}: ${c.visual_signature}`).join("\n") || "Mô tả phong cách và ngoại hình nhân vật chính 3 góc nhìn (turnaround sheet)...");

  // Helper tìm nhân vật trong scene
  const getSceneChars = (sc) => {
    const text = `${sc.tts_script || ""} ${sc[pk] || ""}`.toLowerCase();
    const found = charNames.filter((name) => text.includes(name.toLowerCase()));
    if (found.length) return found;
    return charNames.length ? [charNames[0]] : [];
  };

  $("#video-detail").innerHTML = `
    <!-- STUDIO ACTION TOOLBAR (Ảnh 1 & 2) -->
    <div class="studio-toolbar">
      <button class="btn ghost sm" id="btn-back-lib">← Danh sách</button>
      <button class="btn-gold" id="btn-merge-all" title="Ghép tất cả các cảnh thành video hoàn chỉnh kèm nhạc nền & logo">✦ Ghép Video</button>
      <button class="btn-merge-sel" id="btn-merge-sel" title="Chỉ ghép những cảnh đang được tick chọn">🎬 Ghép cảnh đã chọn (<span id="sel-count">0</span>)</button>
      <button class="btn ghost sm" id="btn-studio-social-pub" style="border-color:#c084fc;color:#c084fc;font-weight:600" title="Đăng hoặc lên lịch video này lên YouTube, TikTok, Facebook">🚀 Đăng MXH / Lên lịch</button>
      <button class="btn ghost sm" id="btn-run-all">▶ Chạy tất cả</button>
      <button class="btn ghost sm" id="btn-sync-flow" style="border-color:#38bdf8;color:#38bdf8;font-weight:600" title="Kiểm tra và tự động kéo toàn bộ video đã render xong từ trình duyệt (Flow / Muse.ai) về tool">🔄 Đồng bộ từ Trình duyệt</button>
      <span style="display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(245,196,67,0.45);border-radius:8px;padding:2px 4px">
        <button class="btn ghost sm" id="btn-bando" style="border:none;color:#F5C443;font-weight:700" title="Dựng video hoạt hình tài liệu Bản Đồ Động + Countryball 100% bằng code từ kịch bản & giọng đọc của video này — không cần Google Flow/Muse, không tốn quota">🗺️ Dựng Bản Đồ Động</button>
        <select id="bando-bed" title="Nhạc nền cho video Bản Đồ Động" style="font-size:11px;padding:2px 4px;max-width:118px">
          <option value="tension">🎵 Căng thẳng</option>
          <option value="dark">🎵 U tối</option>
          <option value="mystery">🎵 Bí ẩn</option>
          <option value="rise">🎵 Hào hùng dâng trào</option>
          <option value="triumph">🎵 Chiến thắng</option>
          <option value="emotional">🎵 Xúc động</option>
          <option value="sad">🎵 Bi thương</option>
          <option value="hope">🎵 Hy vọng</option>
          <option value="none">🔇 Không nhạc</option>
        </select>
        <select id="bando-speed" title="Tốc độ dựng Bản Đồ Động" style="font-size:11px;padding:2px 4px;max-width:110px">
          <option value="std">🎞️ Chuẩn (mượt 30fps)</option>
          <option value="turbo">⚡ Nhanh x2 (kém mượt hơn)</option>
        </select>
      </span>
      <button class="btn ghost sm" id="btn-retry-err" style="border-color:rgba(239,68,68,0.4);color:#f87171">↻ Rà soát & chạy lại cảnh lỗi</button>
      <button class="btn ghost sm" id="btn-append-scene">＋ Thêm kịch bản</button>
      <button class="btn ghost sm" id="btn-toggle-all-prompts">⛶ Mở rộng toàn bộ</button>
      <div style="margin-left:auto;display:flex;gap:6px">
        <button class="btn ghost sm" id="btn-folder-video">📂 Thư mục</button>
        <button class="btn danger sm" id="btn-del-video">🗑 Xoá</button>
      </div>
    </div>

    <!-- CẤU HÌNH ÂM THANH & GHÉP VIDEO (Nhạc nền, Logo, Âm lượng) -->
    <div class="studio-audio-bar" style="background:rgba(15,23,42,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;flex-wrap:wrap;align-items:center;gap:14px;font-size:12px;">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="color:#fbbf24;font-weight:700">🎵 Nhạc nền:</span>
        <select id="studio-music" style="padding:4px 8px;font-size:12px;background:rgba(0,0,0,0.4);border:1px solid var(--line);border-radius:6px;color:var(--text);max-width:240px;"></select>
        <button type="button" class="btn ghost sm" id="btn-studio-preview-music" style="padding:2px 8px;font-size:11px" title="Nghe thử nhạc nền">▶</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="color:#94a3b8">🔊 Âm lượng nhạc:</span>
        <input type="range" id="studio-volume" min="0" max="50" value="12" style="width:90px" />
        <b id="studio-vol-val" style="color:#fbbf24;min-width:28px">12%</b>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="color:#94a3b8">🏷️ Logo:</span>
        <select id="studio-logo" style="padding:4px 8px;font-size:12px;background:rgba(0,0,0,0.4);border:1px solid var(--line);border-radius:6px;color:var(--text);max-width:200px;"></select>
        <img id="studio-logo-thumb" src="" alt="Logo" style="width:24px;height:24px;object-fit:contain;display:none;border-radius:4px;border:1px solid rgba(255,255,255,0.2)" />
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="color:#38bdf8;font-weight:700">🎙 Âm thanh clip Veo:</span>
        <select id="studio-audio-mode" style="padding:4px 8px;font-size:12px;background:rgba(0,0,0,0.4);border:1px solid var(--line);border-radius:6px;color:var(--text);max-width:210px;">
          <option value="tts">Dùng TTS (thay audio Veo)</option>
          <option value="mix">Trộn TTS + âm thanh Veo</option>
          <option value="keep">Giữ nguyên Veo (Veo tự nói)</option>
        </select>
        <button type="button" class="btn ghost sm" id="btn-apply-audio-mode" style="padding:2px 8px;font-size:11px;border-color:#38bdf8;color:#38bdf8" title="Cập nhật lại âm thanh (TTS / Trộn âm / Giữ nguyên Veo) cho toàn bộ các cảnh đã tải video">🔄 Áp dụng âm thanh</button>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
        <label class="switch sm" style="font-size:11px;margin:0"><input type="checkbox" id="studio-subs" checked /><span></span>Phụ đề</label>
      </div>
    </div>

    <!-- VIDEO HOÀN CHỈNH (NẾU CÓ) -->
    ${d.final_url ? `
    <div class="card" id="final-video-box" style="margin-bottom:20px">
      <div class="job-top">
        <h2>🎬 Video hoàn chỉnh: ${esc(d.meta.title || name)}</h2>
        <div class="inline">
          <a class="btn primary sm" href="${d.final_url}" download>⬇ Tải MP4</a>
          ${d.srt_url ? `<a class="btn ghost sm" href="${d.srt_url}" download>⬇ Tải SRT</a>` : ""}
        </div>
      </div>
      <video class="player" style="${vertical ? "aspect-ratio:9/16;max-height:65vh" : "max-height:60vh"}" src="${d.final_url}" controls></video>
    </div>` : ""}

    <!-- MASTER CAST IMAGE PROMPT (CHARACTER CONSISTENCY) -->
    <div class="master-box">
      <div class="master-title">★ MASTER CAST IMAGE PROMPT (CHARACTER CONSISTENCY)</div>
      <div class="master-layout">
        <div>
          <div class="master-turnaround">
            <span class="badge-main">CHÍNH</span>
            ${d.sample_url
              ? `<img src="${d.sample_url}${d.sample_url.includes('?') ? '&' : '?'}_t=${Date.now()}" alt="Master Cast Turnaround" id="master-img" title="🔍 Bấm để xem phóng to toàn màn hình" style="cursor:zoom-in">`
              : `<div class="scard-placeholder"><i>👤</i><span>CHƯA CÓ ẢNH THAM CHIẾU</span></div>`}
          </div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn ghost sm" id="btn-remaster" style="flex:1">🎨 Vẽ ảnh tham chiếu</button>
            <label class="btn ghost sm" style="cursor:pointer">＋ Thêm ảnh<input type="file" id="up-master" accept="image/*" hidden /></label>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${(d.characters && d.characters.length > 0) ? `
          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(251,191,36,0.25);border-radius:8px;padding:8px 10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="color:#fbbf24;font-size:12px;font-weight:700">👤 Hồ sơ tạo hình nhân vật của chủ đề này (${d.characters.length} nhân vật):</span>
              <button type="button" class="btn ghost sm" id="btn-rebuild-master" style="padding:2px 8px;font-size:11px;border-color:#fbbf24;color:#fbbf24" title="Tự động tổng hợp lại Prompt tham chiếu 3 góc nhìn từ mô tả ngoại hình các nhân vật bên dưới">🔄 Cập nhật nhân vật vào Prompt</button>
            </div>
            <div id="cast-profiles-list" style="display:flex;flex-direction:column;gap:6px;max-height:145px;overflow-y:auto">
              ${d.characters.map((c, idx) => `
                <div class="cast-prof-row" style="display:flex;gap:6px;align-items:center">
                  <input type="text" class="cast-prof-name" value="${esc(c.name)}" placeholder="TÊN NHÂN VẬT" style="width:140px;font-weight:700;font-size:12px;color:#c084fc;background:rgba(0,0,0,0.35);border:1px solid rgba(192,132,252,0.35);border-radius:6px;padding:4px 8px" />
                  <input type="text" class="cast-prof-vis" value="${esc(c.visual_signature || c.description || "")}" placeholder="Mô tả ngoại hình chi tiết (tuổi, khuôn mặt, kiểu tóc, quần áo từ đầu đến chân)..." style="flex:1;font-size:12px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:4px 8px" />
                </div>
              `).join("")}
            </div>
          </div>` : ""}
          <label style="color:#fbbf24;font-size:12px;font-weight:700">Prompt vẽ bảng tham chiếu nhân vật 3 góc (Turnaround Sheet gửi sang Google Flow):
            <textarea class="master-textarea" id="in-master-prompt">${esc(masterPromptText)}</textarea>
          </label>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <span class="muted tiny">Nhân vật trong phim:</span>
              ${(d.characters || []).map((c, i) => `<span class="badge-char ${i % 2 === 0 ? "purple" : "amber"}">${esc(c.name)}</span>`).join("") || `<span class="muted tiny">Không có</span>`}
            </div>
            <button class="btn primary sm" id="btn-save-master">💾 Lưu nhân vật & prompt tham chiếu</button>
          </div>
        </div>
      </div>
    </div>

    <!-- DANH SÁCH THẺ CẢNH (LƯỚI 3 CỘT CHUẨN THEO ẢNH NGƯỜI DÙNG) -->
    <div class="job-top" style="margin-bottom:8px">
      <h2>Danh sách thẻ cảnh (${d.scenes.length} cảnh)</h2>
      <span class="muted tiny">Tick chọn các cảnh để ghép video riêng biệt</span>
    </div>

    <div class="scene-cards-grid">${d.scenes.map((s, idx) => {
      const sid = s.scene_id;
      const matchedChars = getSceneChars(s);
      const isMissing = !s.clip_url && !s.thumb_url;
      return `
      <div class="scard ${isMissing ? 'has-error' : ''}" data-sid="${sid}" id="scard-${sid}">
        <!-- Header: Checkbox + CẢNH N + Badge Nhân vật -->
        <div class="scard-head">
          <div class="scard-title-wrap">
            <input type="checkbox" class="scard-cb" data-sid="${sid}" id="cb-${sid}" />
            <span class="scard-title">CẢNH ${sid}</span>
            ${s.clip_url
              ? `<span class="pill done" id="pill-${sid}" style="font-size:10px;padding:1px 6px">✔ Đã tạo video</span>`
              : s.status === "error"
                ? `<span class="pill error" id="pill-${sid}" title="${esc(s.error || "")}" style="font-size:10px;padding:1px 6px;background:rgba(239,68,68,.15);color:#f87171;border-color:rgba(239,68,68,.4)">✖ Lỗi: ${esc((s.error || "chưa tạo được").slice(0, 60))}</span>`
                : `<span class="pill queued" id="pill-${sid}" style="font-size:10px;padding:1px 6px">⏳ Chưa có video</span>`}
          </div>
          <div style="display:flex;gap:4px">
            ${matchedChars.map((ch, ci) => `<span class="badge-char ${ci % 2 === 0 ? "purple" : ""}">${esc(ch)}</span>`).join("")}
          </div>
        </div>

        <!-- Video Preview hoặc Placeholder 🎬 CHƯA CÓ VIDEO -->
        <div class="scard-media">
          ${s.clip_url
            ? `<video src="${s.clip_url}" poster="${s.thumb_url || ""}" controls preload="none"></video>`
            : s.thumb_url
              ? `<img src="${s.thumb_url}" alt="scene ${sid}" loading="lazy">`
              : `<div class="scard-placeholder"><i>🎬</i><span>CHƯA CÓ VIDEO</span></div>`}
        </div>

        <!-- Body: Lời thoại & Prompt có toggle Xem thêm -->
        <div class="scard-body">
          <label class="scard-tts-label">Lời thoại (TTS)
            <textarea class="scard-tts-text" data-k="tts_script">${esc(s.tts_script)}</textarea>
          </label>

          <div class="scard-prompt-box">
            <div class="scard-prompt-label">
              <span>Prompt ${isVideo ? "Video (Veo 3 Ultra)" : "Hình ảnh"}</span>
              <button type="button" class="scard-toggle-btn" data-toggle="${sid}">... Xem thêm ▼</button>
            </div>
            <textarea class="scard-prompt-text" data-k="${pk}" id="prompt-text-${sid}">${esc(s[pk] || "")}</textarea>
          </div>
        </div>

        <!-- Footer tác vụ -->
        <div class="scard-foot">
          <div class="scard-foot-left">
            <label class="btn ghost sm" style="cursor:pointer" title="Tải ảnh tham chiếu riêng cho cảnh này">
              ＋ Thêm ảnh
              <input type="file" class="up-scene-img" data-sid="${sid}" accept="image/*" hidden />
            </label>
            <button class="btn primary sm" data-act="gen-veo" data-sid="${sid}" title="Sinh video qua Veo / FastST">▶ Tạo</button>
            ${isMissing ? `<button class="btn danger sm" data-act="fix-gen" data-sid="${sid}" title="Lưu lại prompt và thử lại tạo video cảnh này">⚡ Thử lại</button>` : ''}
          </div>
          <div class="scard-foot-right">
            <button class="btn ghost sm" data-act="listen" data-sid="${sid}" title="Nghe thử giọng đọc">🔊 Nghe</button>
            <button class="btn ghost sm" data-act="save" data-sid="${sid}" title="Lưu thay đổi">💾</button>
          </div>
        </div>
      </div>`;
    }).join("")}</div>`;

  // --- Gắn sự kiện Cấu hình Âm thanh & Ghép Video trong Studio
  const pProj = state.projects.find((x) => x.name === project) || { music: [], logo: [] };
  const allStudioMusic = Array.from(new Set([
    ...(pProj.music || []),
    ...state.projects.flatMap((x) => x.music || []),
    "01_Uplifting_Inspiring.mp3",
    "02_Lofi_Anime_Chill.mp3",
    "03_Happy_Upbeat.mp3",
    "04_Gentle_Acoustic.mp3",
    "05_Cinematic_Dramatic.mp3",
    "06_Deep_Ambient.mp3"
  ])).filter(Boolean);

  const allStudioLogo = Array.from(new Set([
    ...(pProj.logo || []),
    ...state.projects.flatMap((x) => x.logo || []),
    "01_Logo_VideoStudio_Pro.png",
    "02_Logo_Ai_Channel.png",
    "03_Watermark_UltraHD.png"
  ])).filter(Boolean);

  const curOpts = d.meta?.options || {};
  if ($("#studio-music")) {
    $("#studio-music").innerHTML = `<option value="">— Không nhạc —</option>` + allStudioMusic.map((m) => `<option value="${esc(m)}">${esc(friendlyMusicName(m))}</option>`).join("");
    if (curOpts.music && allStudioMusic.includes(curOpts.music)) {
      $("#studio-music").value = curOpts.music;
    } else if (allStudioMusic.length) {
      $("#studio-music").value = allStudioMusic[0];
    }
  }
  if ($("#studio-logo")) {
    $("#studio-logo").innerHTML = `<option value="">— Không logo —</option>` + allStudioLogo.map((l) => `<option value="${esc(l)}">${esc(friendlyLogoName(l))}</option>`).join("");
    if (curOpts.logo && allStudioLogo.includes(curOpts.logo)) {
      $("#studio-logo").value = curOpts.logo;
    }
  }
  if ($("#studio-volume") && curOpts.music_volume != null) {
    const v = Math.round(curOpts.music_volume * 100);
    $("#studio-volume").value = v;
    if ($("#studio-vol-val")) $("#studio-vol-val").textContent = `${v}%`;
  }
  $("#studio-volume")?.addEventListener("input", (e) => {
    if ($("#studio-vol-val")) $("#studio-vol-val").textContent = `${e.target.value}%`;
  });
  $("#btn-studio-preview-music")?.addEventListener("click", () => {
    toggleMusicPreview($("#studio-music")?.value, $("#btn-studio-preview-music"));
  });
  $("#studio-music")?.addEventListener("change", () => {
    if (_currentAudioPreview) toggleMusicPreview(null, $("#btn-studio-preview-music"));
  });
  const updateStudioLogoThumb = () => {
    const val = $("#studio-logo")?.value;
    const thumb = $("#studio-logo-thumb");
    if (!thumb) return;
    if (val) {
      thumb.src = `/api/assets/logo/${encodeURIComponent(val)}`;
      thumb.style.display = "inline-block";
    } else {
      thumb.style.display = "none";
    }
  };
  $("#studio-logo")?.addEventListener("change", updateStudioLogoThumb);
  updateStudioLogoThumb();

  // Khởi tạo và gắn sự kiện Chế độ âm thanh clip Veo trong Studio
  if ($("#studio-audio-mode")) {
    $("#studio-audio-mode").value = d.options?.audio_mode || "tts";
  }
  $("#btn-apply-audio-mode")?.addEventListener("click", async () => {
    const amode = $("#studio-audio-mode")?.value || "tts";
    const btn = $("#btn-apply-audio-mode");
    btn.disabled = true;
    const oldTxt = btn.textContent;
    btn.textContent = "… Đang xử lý";
    try {
      const res = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/apply-audio-mode`, {
        method: "POST",
        json: { audio_mode: amode }
      });
      if (res.ok) {
        toast(`✔ Đã cập nhật chế độ âm thanh (${amode}) cho ${res.updated_count} cảnh!`, "ok");
        await openVideo(project, mode, name);
      }
    } catch (err) {
      toast("Lỗi cập nhật âm thanh: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = oldTxt;
    }
  });

  // --- Gắn sự kiện Toolbar
  $("#btn-back-lib")?.addEventListener("click", () => { state.currentDetailContext = null; $("#video-detail").innerHTML = ""; loadLibrary(); });

  // Nút Ghép Video (Toàn bộ)
  $("#btn-merge-all")?.addEventListener("click", async () => {
    const musicVal = $("#studio-music")?.value || "";
    const logoVal = $("#studio-logo")?.value || "";
    const volVal = parseFloat((($("#studio-volume")?.value || 12) / 100).toFixed(2));
    const subsVal = $("#studio-subs") ? $("#studio-subs").checked : true;
    const audioModeVal = $("#studio-audio-mode")?.value || "tts";
    const j = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/resume`, {
      json: { rerender: true, music: musicVal, logo: logoVal, music_volume: volVal, burn_subtitles: subsVal, audio_mode: audioModeVal }
    });
    state.activeJob = j.id; toast("Đang ghép toàn bộ video kèm nhạc nền & logo đã chọn…", "ok"); go("jobs");
  });

  // Nút Ghép cảnh đã chọn
  $("#btn-merge-sel")?.addEventListener("click", async () => {
    if (selectedScenes.size === 0) {
      return toast("Vui lòng tick chọn ít nhất 1 cảnh để ghép!", "error");
    }
    const arr = Array.from(selectedScenes).sort((a, b) => a - b);
    const musicVal = $("#studio-music")?.value || "";
    const logoVal = $("#studio-logo")?.value || "";
    const volVal = parseFloat((($("#studio-volume")?.value || 12) / 100).toFixed(2));
    const subsVal = $("#studio-subs") ? $("#studio-subs").checked : true;
    try {
      const j = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/merge-selected`, {
        json: { scene_ids: arr, music: musicVal, logo: logoVal, music_volume: volVal, burn_subtitles: subsVal }
      });
      state.activeJob = j.id;
      toast(`Đang ghép ${arr.length} cảnh đã chọn kèm nhạc nền & logo…`, "ok");
      go("jobs");
    } catch (err) { toast(err.message, "error"); }
  });

  // Nút Đăng MXH / Lên lịch
  $("#btn-studio-social-pub")?.addEventListener("click", () => {
    go("social");
    setTimeout(() => {
      if ($("#soc-project")) $("#soc-project").value = project;
      onSocialProjectChange(name);
    }, 150);
  });

  // Nút Chạy tất cả
  $("#btn-run-all")?.addEventListener("click", async () => {
    try {
      const j = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/generate-all`, { json: {} });
      state.activeJob = j.id; toast("Đã xếp hàng tạo tất cả cảnh", "ok"); go("jobs");
    } catch (err) { toast(err.message, "error"); }
  });

  // Nút Chạy lại các cảnh lỗi
  $("#btn-retry-err")?.addEventListener("click", async () => {
    const j = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/resume`, { json: {} });
    state.activeJob = j.id; toast("Đang chạy lại các cảnh thiếu hoặc lỗi…", "ok"); go("jobs");
  });

  // Nút Thêm kịch bản (Thêm Scene mới)
  $("#btn-append-scene")?.addEventListener("click", async () => {
    try {
      await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/scenes/append`, { json: {} });
      toast("Đã thêm một cảnh mới vào cuối kịch bản", "ok");
      openVideo(project, mode, name);
    } catch (err) { toast(err.message, "error"); }
  });

  // Nút Mở rộng / Thu gọn toàn bộ prompt
  let allExpanded = false;
  $("#btn-toggle-all-prompts")?.addEventListener("click", () => {
    allExpanded = !allExpanded;
    $$(".scard-prompt-text").forEach((ta) => ta.classList.toggle("expanded", allExpanded));
    $$(".scard-toggle-btn").forEach((btn) => (btn.textContent = allExpanded ? "Thu gọn ▲" : "... Xem thêm ▼"));
    $("#btn-toggle-all-prompts").textContent = allExpanded ? "⊟ Thu gọn toàn bộ" : "⛶ Mở rộng toàn bộ";
  });

  // Nút Đồng bộ video từ Trình duyệt (Flow / Muse.ai)
  const btnSyncFlow = $("#btn-sync-flow");
  if (btnSyncFlow) {
    btnSyncFlow.addEventListener("click", async () => {
      const origText = btnSyncFlow.textContent;
      btnSyncFlow.disabled = true;
      btnSyncFlow.textContent = "⏳ Đang quét Flow / Muse...";
      try {
        const r = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/sync-flow`, { method: "POST" });
        if (r.ok) {
          if (r.synced_count > 0) {
            playChime("done");
            toast(`🎉 ${r.message || `Đã đồng bộ thành công ${r.synced_count} video!`}`, "ok");
            await openVideo(project, mode, name);
          } else {
            toast(r.message || "Tất cả các cảnh đã được đồng bộ đầy đủ!", "ok");
          }
        } else {
          toast(r.error || "Không thể kết nối tab Flow/Muse trên trình duyệt", "error");
        }
      } catch (err) {
        toast(`Lỗi đồng bộ: ${err.message}`, "error");
      } finally {
        btnSyncFlow.disabled = false;
        btnSyncFlow.textContent = origText;
      }
    });
  }

  const collectCastProfiles = () => {
    const rows = $$(".cast-prof-row");
    if (!rows.length) return null;
    return rows.map((r) => ({
      name: (r.querySelector(".cast-prof-name")?.value || "").trim().toUpperCase(),
      visual_signature: (r.querySelector(".cast-prof-vis")?.value || "").trim()
    })).filter((c) => c.name);
  };

  $("#btn-rebuild-master")?.addEventListener("click", async () => {
    const chars = collectCastProfiles();
    const res = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/master`, {
      method: "PUT",
      json: { characters: chars || d.characters, rebuild_from_cast: true }
    });
    if (res.master_cast_image_prompt) {
      $("#in-master-prompt").value = res.master_cast_image_prompt;
    }
    toast("✔ Đã tổng hợp lại Prompt tham chiếu 3 góc từ hồ sơ nhân vật & cập nhật toàn bộ các cảnh!", "ok");
    openVideo(project, mode, name);
  });

  // Nút Master Cast: Vẽ lại, Lưu prompt & Thêm ảnh
  $("#btn-remaster")?.addEventListener("click", async () => {
    const chars = collectCastProfiles();
    const promptVal = $("#in-master-prompt")?.value?.trim();
    await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/master`, {
      method: "PUT",
      json: { ...(chars ? { characters: chars } : {}), ...(promptVal ? { prompt: promptVal } : {}) }
    });
    const j = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/resume`, { json: { regenerate_master: true, stop_after: "master" } });
    state.activeJob = j.id;
    toast("Đang tạo ảnh tham chiếu nhân vật trên Google Flow (🍌 Nano Banana Pro)… Sẽ báo âm thanh khi hoàn tất!", "ok");
  });
  $("#btn-save-master")?.addEventListener("click", async () => {
    const chars = collectCastProfiles();
    const promptVal = $("#in-master-prompt").value.trim();
    await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/master`, {
      method: "PUT",
      json: { ...(chars ? { characters: chars } : {}), prompt: promptVal }
    });
    toast("Đã lưu hồ sơ nhân vật & prompt tham chiếu", "ok");
  });
  $("#up-master")?.addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try {
      await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/master/upload`, { method: "POST", body: fd });
      toast("✔ Đã tải lên ảnh tham chiếu nhân vật!", "ok");
      openVideo(project, mode, name);
    } catch (err) {
      toast(err.message, "error");
    }
  });

  $("#btn-folder-video")?.addEventListener("click", () => api("/api/open-folder", { json: { project, mode } }));

  // Nút Dựng Bản Đồ Động (motion graphics bằng code từ kịch bản + giọng đọc)
  $("#btn-bando")?.addEventListener("click", async () => {
    try {
      const st = await api("/api/bando/status");
      if (!st.ok) {
        return toast(`Chưa sẵn sàng: ${(st.issues || []).join("; ")}. ${st.fix || ""}`, "error");
      }
      const j = await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/bando`, {
        json: { music_bed: $("#bando-bed")?.value || "tension", ai_direct: true, captions: true, turbo: $("#bando-speed")?.value === "turbo" }
      });
      state.activeJob = j.id;
      toast("Đang dựng video Bản Đồ Động — AI đạo diễn chọn cảnh, sau đó vẽ & hòa âm. File ra: final_videos/<tên>_BanDoDong.mp4", "ok");
      go("jobs");
    } catch (err) { toast(err.message, "error"); }
  });
  $("#btn-del-video")?.addEventListener("click", async () => {
    if (!confirm("Xoá video này và toàn bộ asset?")) return;
    await api(`/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}`, { method: "DELETE" });
    $("#video-detail").innerHTML = ""; state.detail = null; loadLibrary();
  });

  // --- Xử lý Checkbox & Đếm số cảnh đã chọn
  const updateSelectedUI = () => {
    $("#sel-count").textContent = selectedScenes.size;
    $$(".scard").forEach((card) => {
      const sid = Number(card.dataset.sid);
      card.classList.toggle("selected", selectedScenes.has(sid));
    });
  };

  $$(".scard-cb").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const sid = Number(e.target.dataset.sid);
      if (e.target.checked) selectedScenes.add(sid);
      else selectedScenes.delete(sid);
      updateSelectedUI();
    });
  });

  // --- Xử lý nút ... Xem thêm ▼ trên từng thẻ
  $$(".scard-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sid = btn.dataset.toggle;
      const ta = $(`#prompt-text-${sid}`);
      const isExp = ta.classList.toggle("expanded");
      btn.textContent = isExp ? "Thu gọn ▲" : "... Xem thêm ▼";
    });
  });

  // --- Xử lý các nút trên từng thẻ cảnh: Tạo, Nghe, Lưu, Thêm ảnh
  $$(".scard").forEach((el) => {
    const sid = Number(el.dataset.sid);
    const base = `/api/videos/${enc(project)}/${enc(mode)}/${enc(name)}/scenes/${sid}`;
    const getBody = () => Object.fromEntries($$("textarea", el).map((t) => [t.dataset.k, t.value]));

    // Nút Lưu
    el.querySelector('[data-act="save"]')?.addEventListener("click", async () => {
      await api(base, { method: "PUT", json: getBody() });
      toast(`Đã lưu cảnh ${sid}`, "ok");
    });

    // Nút Nghe thử TTS
    el.querySelector('[data-act="listen"]')?.addEventListener("click", async () => {
      const scriptText = el.querySelector('[data-k="tts_script"]').value.trim();
      if (!scriptText) return toast("Cảnh không có lời thoại", "error");
      try {
        const engine = state.engine || state.settings?.tts_engine || "edge";
        const voice = $("#in-voice")?.value || (engine === "edge" ? state.settings?.edge_voice : state.settings?.gemini_voice) || "vi-VN-HoaiMyNeural";
        const blob = await api("/api/tts/preview", { json: { engine, voice, text: scriptText } });
        const a = new Audio(URL.createObjectURL(blob));
        a.play();
      } catch (err) { toast(err.message, "error"); }
    });

    // Nút Tạo / Thử lại cảnh
    const triggerGenerate = async (btn) => {
      await api(base, { method: "PUT", json: getBody() });
      btn.disabled = true;
      const oldTxt = btn.textContent;
      btn.textContent = "… Đang gửi";
      try {
        const r = await api(`${base}/generate-veo`, { method: "POST" });
        if (r.ok && r.synced) {
          toast(`✔ Cảnh ${sid} đã tạo xong và đồng bộ về tool!`, "ok");
          await openVideo(project, mode, name);
          if (state.detail?.scenes?.length && state.detail.scenes.every((sc) => !!sc.clip_url)) {
            playChime("done");
            toast(`🎉 Đã hoàn tất toàn bộ tất cả các cảnh của dự án!`, "ok");
          }
        } else if (r.ok) {
          toast(`Đã gửi prompt Cảnh ${sid} sang Google Flow Veo 3 Ultra!`, "ok");
        } else {
          const j = await api(`${base}/regenerate`, { json: { what: isVideo ? "video" : "image" } });
          state.activeJob = j.id; toast(`Đang tạo cảnh ${sid}…`, "ok");
        }
      } catch (err) {
        const j = await api(`${base}/regenerate`, { json: { what: isVideo ? "video" : "image" } });
        state.activeJob = j.id; toast(`Đang tạo cảnh ${sid}…`, "ok");
      } finally {
        btn.disabled = false;
        btn.textContent = oldTxt;
      }
    };

    el.querySelector('[data-act="gen-veo"]')?.addEventListener("click", (e) => triggerGenerate(e.currentTarget));
    el.querySelector('[data-act="fix-gen"]')?.addEventListener("click", (e) => triggerGenerate(e.currentTarget));
    el.querySelector(".up-scene-img")?.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const fd = new FormData();
      fd.append("file", f);
      try {
        await api(`${base}/upload-image`, { method: "POST", body: fd });
        toast(`✔ Đã cập nhật ảnh cho Cảnh ${sid}!`, "ok");
        openVideo(project, mode, name);
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });

  $("#video-detail").scrollIntoView({ behavior: "smooth" });
}

/* ---------------- settings ---------------- */
const SETTING_KEYS = [
  "text_model", "image_model", "video_model", "tts_model", "language", "edge_voice", "gemini_voice", "fps", "min_scene_seconds", "ffmpeg_path",
  "fastst_api_url", "fastst_api_token", "fastst_rotation_mode", "fastst_scenes_per_profile", "fastst_ref_mode", "fastst_flow_model", "fastst_resolution", "fastst_aspect_ratio",
  "fastst_input_mode", "fastst_typing_speed", "subtitle_color", "music_volume",
  "cinematic_look", "scene_transition", "transition_duration", "loudness_normalize", "fade_in_out", "veo_slowmo_stretch"
];

async function renderFastSTProfiles() {
  const container = $("#fastst-profs-list");
  if (!container) return;
  try {
    const profs = await api("/api/profiles");
    if (!profs || profs.length === 0) {
      container.innerHTML = `<span class="muted tiny">Chưa có profile nào. Bấm <b>＋ Thêm Profile Mới</b> để tạo profile.</span>`;
      return;
    }
    container.innerHTML = profs.map((p) => {
      const isRun = p.running;
      const proxyInfo = p.proxy ? esc(p.proxy) : '<span style="color:#9ca3af">Mạng thường (Không proxy)</span>';
      return `
        <div style="background:rgba(255,255,255,0.05);border:1px solid ${isRun ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.1)"};border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;position:relative;">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
              <div class="dot ${isRun ? "ok" : ""}" style="width:10px;height:10px"></div>
              <span style="font-weight:700;font-size:14px;color:#f3f4f6">${esc(p.name)}</span>
              <span style="font-size:11px;background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;color:#cbd5e1">${esc(p.group || "Mặc định")}</span>
            </div>
            <span style="font-size:11px;font-weight:600;color:${isRun ? "#34d399" : "#9ca3af"}">
              ${isRun ? `CDP Port: <b style="color:#38bdf8">${p.port}</b>` : "Đã tắt"}
            </span>
          </div>

          <div style="font-size:12px;color:#94a3b8;display:flex;align-items:center;gap:6px;word-break:break-all">
            <span>🛡 Proxy:</span>
            <span>${proxyInfo}</span>
          </div>
          ${p.note ? `<div style="font-size:11px;color:#64748b;font-style:italic">${esc(p.note)}</div>` : ''}

          <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">
            <button type="button" class="btn ${isRun ? "danger" : "primary"} sm" data-prof-id="${esc(p.id)}" data-prof-act="${isRun ? "stop" : "start"}" style="padding:4px 10px;font-size:11px;font-weight:600">
              ${isRun ? "⏹ Đóng" : "▶ Mở Profile"}
            </button>
            ${p.proxy ? `<button type="button" class="btn ghost sm" data-prof-id="${esc(p.id)}" data-prof-act="check-proxy" style="padding:4px 8px;font-size:11px">🔎 Check</button>` : ''}
            <button type="button" class="btn ghost sm" data-prof-id="${esc(p.id)}" data-prof-act="edit" style="padding:4px 8px;font-size:11px">✎ Sửa</button>
            <button type="button" class="btn ghost sm" data-prof-id="${esc(p.id)}" data-prof-act="delete" style="padding:4px 8px;font-size:11px;color:#f87171">🗑 Xóa</button>
          </div>
        </div>
      `;
    }).join("");

    // Gắn sự kiện các nút trên từng profile
    $$("button[data-prof-id]", container).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const pid = e.currentTarget.dataset.profId;
        const act = e.currentTarget.dataset.profAct;
        const prof = profs.find((x) => x.id === pid);
        if (act === "start") {
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = "…";
          try {
            const res = await api(`/api/fastst/profiles/${pid}/start`, { json: {} });
            toast(`✔ Đã mở profile "${prof ? prof.name : pid}" trên cổng ${res.port}!`, "ok");
            await renderFastSTProfiles();
            await checkFastST();
          } catch (err) {
            toast(err.message, "error");
          } finally {
            e.currentTarget.disabled = false;
          }
        } else if (act === "stop") {
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = "…";
          try {
            await api(`/api/fastst/profiles/${pid}/stop`, { json: {} });
            toast(`Đã đóng profile "${prof ? prof.name : pid}".`, "ok");
            await renderFastSTProfiles();
            await checkFastST();
          } catch (err) {
            toast(err.message, "error");
          } finally {
            e.currentTarget.disabled = false;
          }
        } else if (act === "check-proxy") {
          if (!prof || !prof.proxy) return;
          e.currentTarget.textContent = "⏳…";
          try {
            const res = await api("/api/profiles/check-proxy", { json: { proxy: prof.proxy } });
            if (res.ok) {
              toast(`✔ Proxy hoạt động tốt! IP: ${res.ip} (${res.country || res.countryCode || ""})`, "ok");
            } else {
              toast(`❌ Lỗi proxy: ${res.msg}`, "error");
            }
          } catch (err) {
            toast(err.message, "error");
          } finally {
            e.currentTarget.textContent = "🔎 Check";
          }
        } else if (act === "edit") {
          if (!prof) return;
          $("#modal-prof-title").textContent = `✎ Sửa Profile: ${prof.name}`;
          $("#prof-modal-id").value = prof.id;
          $("#prof-modal-name").value = prof.name || "";
          $("#prof-modal-proxy").value = prof.proxy || "";
          $("#prof-modal-group").value = prof.group || "Mặc định";
          $("#prof-modal-note").value = prof.note || "";
          $("#prof-proxy-check-res").textContent = "";
          $("#modal-profile").style.display = "flex";
        } else if (act === "delete") {
          if (!prof) return;
          if (confirm(`Bạn có chắc chắn muốn xóa profile "${prof.name}"?`)) {
            try {
              await api("/api/profiles/delete", { json: { id: prof.id } });
              toast(`Đã xóa profile "${prof.name}".`, "ok");
              await renderFastSTProfiles();
              await checkFastST();
            } catch (err) {
              toast(err.message, "error");
            }
          }
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<span class="err tiny">Lỗi kết nối Profile API: ${esc(err.message)}</span>`;
  }
}

$("#btn-add-profile")?.addEventListener("click", () => {
  $("#modal-prof-title").textContent = "＋ Thêm Profile Mới";
  $("#prof-modal-id").value = "";
  $("#prof-modal-name").value = "";
  $("#prof-modal-proxy").value = "";
  $("#prof-modal-group").value = "Mặc định";
  $("#prof-modal-note").value = "";
  $("#prof-proxy-check-res").textContent = "";
  $("#modal-profile").style.display = "flex";
});

$("#btn-cancel-modal-prof")?.addEventListener("click", () => {
  $("#modal-profile").style.display = "none";
});

$("#btn-save-modal-prof")?.addEventListener("click", async (e) => {
  const pid = $("#prof-modal-id").value.trim();
  const name = $("#prof-modal-name").value.trim();
  const proxy = $("#prof-modal-proxy").value.trim();
  const group = $("#prof-modal-group").value.trim();
  const note = $("#prof-modal-note").value.trim();
  if (!name) {
    toast("Vui lòng nhập tên kênh / profile!", "error");
    return;
  }
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = "⏳ Đang lưu...";
  try {
    if (pid) {
      await api("/api/profiles/edit", { json: { id: pid, name, proxy, group, note } });
      toast(`✔ Đã cập nhật profile "${name}"!`, "ok");
    } else {
      await api("/api/profiles/add", { json: { name, proxy, group, note } });
      toast(`✔ Đã thêm profile "${name}" thành công!`, "ok");
    }
    $("#modal-profile").style.display = "none";
    await renderFastSTProfiles();
    await checkFastST();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Lưu Profile";
  }
});

$("#btn-test-modal-proxy")?.addEventListener("click", async () => {
  const prx = $("#prof-modal-proxy").value.trim();
  const resSpan = $("#prof-proxy-check-res");
  if (!prx) {
    resSpan.textContent = "Chưa nhập proxy";
    resSpan.style.color = "#f87171";
    return;
  }
  resSpan.textContent = "Đang kiểm tra...";
  resSpan.style.color = "#38bdf8";
  try {
    const res = await api("/api/profiles/check-proxy", { json: { proxy: prx } });
    if (res.ok) {
      resSpan.textContent = `✔ Hoạt động: ${res.ip} (${res.country || res.countryCode || ""})`;
      resSpan.style.color = "#34d399";
    } else {
      resSpan.textContent = `❌ Lỗi: ${res.msg}`;
      resSpan.style.color = "#f87171";
    }
  } catch (err) {
    resSpan.textContent = `❌ Lỗi: ${err.message}`;
    resSpan.style.color = "#f87171";
  }
});

$("#btn-open-profile-gui")?.addEventListener("click", async () => {
  try {
    await api("/api/profiles/open-gui", { json: {} });
    toast("✔ Đã mở cửa sổ Quản Lý Profile Desktop!", "ok");
  } catch (err) {
    toast(`Lỗi mở GUI: ${err.message}`, "error");
  }
});

$("#btn-refresh-fastst-profs")?.addEventListener("click", () => {
  renderFastSTProfiles();
});

/* ---------------- QUẢN LÝ CÂU LỆNH (PROMPT TEMPLATES) ---------------- */
const promptEditorState = {
  unlocked: false,
  password: "",
  prompts: [],
  activePrompt: null
};

function selectPromptForEditing(pid) {
  const p = promptEditorState.prompts.find((item) => item.id === pid);
  if (!p) return;
  promptEditorState.activePrompt = p;

  $$(".prompt-list-item").forEach((el) => {
    const isThis = el.dataset.pid === pid;
    el.style.background = isThis ? "rgba(168, 85, 247, 0.2)" : "transparent";
    el.style.borderColor = isThis ? "#a855f7" : "transparent";
  });

  const catEl = $("#pedit-category");
  if (catEl) catEl.textContent = p.category;
  const titleEl = $("#pedit-title");
  if (titleEl) titleEl.textContent = p.title;
  const idEl = $("#pedit-id");
  if (idEl) idEl.textContent = `ID: ${p.id}`;
  const tempEl = $("#pedit-temp");
  if (tempEl) tempEl.value = p.temperature ?? 0.7;
  const descEl = $("#pedit-desc");
  if (descEl) descEl.textContent = p.desc || "";

  const varsBox = $("#pedit-vars");
  if (varsBox) {
    varsBox.innerHTML = (p.variables || [])
      .map((v) => `<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;color:#38bdf8;font-size:11px">{{${v}}}</code>`)
      .join(" ");
  }

  const sysEl = $("#pedit-sys-text");
  if (sysEl) sysEl.value = p.system_instruction_text || "";
  const addEl = $("#pedit-add-text");
  if (addEl) addEl.value = p.system_instruction_addendum_text || "";
  const statEl = $("#pedit-status-msg");
  if (statEl) statEl.textContent = "";
}

function renderPromptsSidebar() {
  const container = $("#prompts-list-container");
  if (!container) return;
  if (!promptEditorState.prompts.length) {
    container.innerHTML = '<span class="muted tiny">Không có câu lệnh nào</span>';
    return;
  }

  let html = "";
  let lastCat = "";
  for (const p of promptEditorState.prompts) {
    if (p.category !== lastCat) {
      lastCat = p.category;
      html += `<div style="font-size:11px;font-weight:700;color:#c084fc;margin:8px 0 4px 4px;padding-top:4px;border-top:1px dashed rgba(255,255,255,0.08)">${esc(lastCat)}</div>`;
    }
    const isActive = promptEditorState.activePrompt && promptEditorState.activePrompt.id === p.id;
    html += `
      <div class="prompt-list-item" data-pid="${esc(p.id)}" style="cursor:pointer;padding:8px 10px;border-radius:6px;border:1px solid ${isActive ? '#a855f7' : 'transparent'};background:${isActive ? 'rgba(168,85,247,0.2)' : 'transparent'};transition:all 0.15s">
        <div style="font-weight:600;font-size:12px;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.title)}</div>
        <div style="font-size:10px;color:#94a3b8;font-family:monospace">${esc(p.id)}</div>
      </div>
    `;
  }
  container.innerHTML = html;

  $$(".prompt-list-item").forEach((el) => {
    el.addEventListener("click", () => {
      selectPromptForEditing(el.dataset.pid);
    });
  });
}

async function unlockPromptsManager(pwd) {
  const msgEl = $("#prompts-auth-msg");
  if (msgEl) msgEl.textContent = "";
  try {
    const res = await api("/api/prompt-templates/verify-password", {
      method: "POST",
      json: { password: pwd }
    });
    if (res.ok) {
      promptEditorState.unlocked = true;
      promptEditorState.password = pwd;
      $("#prompts-auth-box").style.display = "none";
      $("#prompts-editor-box").style.display = "block";
      const pill = $("#pill-prompt-lock");
      if (pill) {
        pill.className = "pill done";
        pill.textContent = "🔓 Đã Mở Khóa";
      }
      toast("✔ Đã mở khóa quyền chỉnh sửa câu lệnh!", "ok");

      const list = await api("/api/prompt-templates/list", { method: "POST", json: { password: pwd } });
      promptEditorState.prompts = list || [];
      renderPromptsSidebar();
      if (promptEditorState.prompts.length > 0) {
        selectPromptForEditing(promptEditorState.prompts[0].id);
      }
    }
  } catch (err) {
    if (msgEl) msgEl.textContent = "❌ " + (err.message || "Mật khẩu không chính xác!");
  }
}

function lockPromptsManager() {
  promptEditorState.unlocked = false;
  promptEditorState.password = "";
  promptEditorState.activePrompt = null;
  const passIn = $("#prompts-pass-input");
  if (passIn) passIn.value = "";
  const msgEl = $("#prompts-auth-msg");
  if (msgEl) msgEl.textContent = "";
  $("#prompts-auth-box").style.display = "flex";
  $("#prompts-editor-box").style.display = "none";
  const pill = $("#pill-prompt-lock");
  if (pill) {
    pill.className = "pill queued";
    pill.textContent = "🔒 Đang Khóa";
  }
  toast("🔒 Đã khóa lại trình chỉnh sửa câu lệnh.", "info");
}

async function saveCurrentPrompt() {
  if (!promptEditorState.activePrompt) return;
  const pid = promptEditorState.activePrompt.id;
  const sysText = $("#pedit-sys-text")?.value || "";
  const addText = $("#pedit-add-text")?.value || "";
  const temp = parseFloat($("#pedit-temp")?.value || "0.7");
  const statusMsg = $("#pedit-status-msg");

  if (statusMsg) {
    statusMsg.textContent = "⏳ Đang lưu...";
    statusMsg.style.color = "#38bdf8";
  }

  try {
    const res = await api("/api/prompt-templates/save", {
      method: "POST",
      json: {
        password: promptEditorState.password,
        id: pid,
        system_instruction_text: sysText,
        system_instruction_addendum_text: addText,
        temperature: temp
      }
    });

    if (res.ok) {
      promptEditorState.activePrompt.system_instruction_text = sysText;
      promptEditorState.activePrompt.system_instruction_addendum_text = addText;
      promptEditorState.activePrompt.temperature = temp;
      if (statusMsg) {
        statusMsg.textContent = `✔ Đã lưu thành công lúc ${new Date().toLocaleTimeString()}!`;
        statusMsg.style.color = "#34d399";
      }
      toast(`✔ Đã lưu câu lệnh "${promptEditorState.activePrompt.title}"!`, "ok");
    }
  } catch (err) {
    if (statusMsg) {
      statusMsg.textContent = `❌ Lỗi: ${err.message}`;
      statusMsg.style.color = "#f87171";
    }
    toast(`Lỗi lưu câu lệnh: ${err.message}`, "error");
  }
}

$("#btn-unlock-prompts")?.addEventListener("click", () => {
  const pwd = $("#prompts-pass-input")?.value || "";
  unlockPromptsManager(pwd);
});

$("#prompts-pass-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    unlockPromptsManager(e.target.value);
  }
});

$("#btn-lock-prompts")?.addEventListener("click", () => {
  lockPromptsManager();
});

$("#btn-save-current-prompt")?.addEventListener("click", saveCurrentPrompt);
$("#btn-save-current-prompt-2")?.addEventListener("click", saveCurrentPrompt);


$("#btn-start-all-fastst")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = "⏳ Đang mở cả 3 Profile...";
  try {
    const res = await api("/api/fastst/start-all", { json: {} });
    toast(`✔ Đã mở thành công ${res.running_count} Profile FastST & tab Google Flow!`, "ok");
    await renderFastSTProfiles();
    await checkFastST();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "▶ Mở cả 3 Profile & Flow";
  }
});

$("#btn-open-all-muse")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = "⏳ Đang mở Muse.ai trên các Profile...";
  try {
    const res = await api("/api/fastst/open-muse", { json: {} });
    toast(`✔ Đã mở tab Muse.ai trên ${res.opened_count || 0} Profile FastST!`, "ok");
    await renderFastSTProfiles();
    await checkFastST();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "🎬 Mở Muse.ai trên các Profile";
  }
});

$("#btn-stop-all-fastst")?.addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const res = await api("/api/fastst/stop-all", { json: {} });
    toast(`Đã tắt ${res.stopped_count} profile FastST`, "ok");
    await renderFastSTProfiles();
    await checkFastST();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

async function loadSettings() {
  const s = await api("/api/settings");
  state.settings = s;
  if (typeof s.sound_enabled === "boolean") {
    localStorage.setItem("vs_sound_enabled", String(s.sound_enabled));
  }
  updateSoundToggleUI();
  $("#set-key").value = s.gemini_api_key || "";
  $("#set-key").placeholder = s.has_api_key ? "Đã lưu — nhập để thay" : "AIza…";
  SETTING_KEYS.forEach((k) => {
    const el = $(`#set-${k}`);
    if (!el) return;
    const val = s[k] ?? "";
    if (el.tagName === "SELECT" && val) {
      if (!Array.from(el.options).some((o) => o.value === val)) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = `${val} (Tùy chỉnh)`;
        const customOpt = el.querySelector("option[value='__custom__']");
        if (customOpt) el.insertBefore(opt, customOpt);
        else el.appendChild(opt);
      }
    }
    el.value = val;
  });
  renderFastSTProfiles();
}

// Lắng nghe khi người dùng chọn "Nhập model khác (Tùy chỉnh)..."
["text_model", "image_model", "video_model", "tts_model"].forEach((k) => {
  const sel = $(`#set-${k}`);
  if (!sel) return;
  sel.addEventListener("change", (e) => {
    if (e.target.value === "__custom__") {
      const label = sel.parentElement?.textContent?.replace("✏️ Nhập model khác (Tùy chỉnh)...", "").trim() || k;
      const customName = prompt(`Nhập tên model [${label}] bạn muốn sử dụng (ví dụ: gemini-3.5-flash):`);
      if (customName && customName.trim()) {
        const val = customName.trim();
        let opt = Array.from(sel.options).find((o) => o.value === val);
        if (!opt) {
          opt = document.createElement("option");
          opt.value = val;
          opt.textContent = `${val} (Tùy chỉnh)`;
          sel.insertBefore(opt, sel.querySelector("option[value='__custom__']"));
        }
        sel.value = val;
      } else {
        sel.selectedIndex = 0;
      }
    }
  });
});

// Nút bật/tắt nhanh âm báo ở thanh bên (Sidebar) và trong Cài đặt
$("#sound-toggle-box")?.addEventListener("click", () => {
  setSoundEnabled(!isSoundEnabled(), true);
});
$("#set-sound_enabled")?.addEventListener("change", (e) => {
  setSoundEnabled(e.target.checked, true);
});
$("#btn-test-sound")?.addEventListener("click", () => {
  playChime("done", true);
  toast("🔊 Đang phát thử chuông báo hoàn tất!", "ok");
});

$("#btn-save-settings").addEventListener("click", async () => {
  const patch = {};
  SETTING_KEYS.forEach((k) => {
    const el = $(`#set-${k}`);
    if (el) patch[k] = el.value;
  });
  patch.fps = Number(patch.fps) || 30;
  patch.min_scene_seconds = Number(patch.min_scene_seconds) || 3;
  patch.fastst_scenes_per_profile = Number(patch.fastst_scenes_per_profile) || 10;
  if (patch.music_volume) patch.music_volume = Number(patch.music_volume) || 0.25;
  if ("transition_duration" in patch) patch.transition_duration = Math.min(1, Math.max(0.2, Number(patch.transition_duration) || 0.35));
  ["loudness_normalize", "fade_in_out", "veo_slowmo_stretch"].forEach((k) => {
    if (k in patch) patch[k] = String(patch[k]) === "true";
  });
  const soundCb = $("#set-sound_enabled");
  if (soundCb) {
    patch.sound_enabled = soundCb.checked;
    localStorage.setItem("vs_sound_enabled", String(soundCb.checked));
  }
  const key = $("#set-key").value.trim();
  if (key && !key.includes("…")) patch.gemini_api_key = key;
  try {
    state.settings = await api("/api/settings", { json: patch });
    updateSoundToggleUI();
    toast("Đã lưu toàn bộ cài đặt & cấu hình FastST", "ok");
    checkHealth();
    loadSettings();
  } catch (e) {
    toast(e.message, "error");
  }
});

async function checkHealth() {
  try {
    const h = await api("/api/health");
    state.settings = h.settings;
    if (typeof h.settings?.sound_enabled === "boolean") {
      localStorage.setItem("vs_sound_enabled", String(h.settings.sound_enabled));
    }
    updateSoundToggleUI();
    const ffOk = !String(h.ffmpeg).startsWith("ERROR");
    const ok = ffOk && h.settings.has_api_key;
    $("#health-dot").className = `dot ${ok ? "ok" : "err"}`;
    $("#health-text").textContent = !h.settings.has_api_key ? "Thiếu Gemini API key" : !ffOk ? "Thiếu FFmpeg" : "Sẵn sàng";
    if (!state._langInitialized && h.settings.language) {
      const langSel = $("#in-language");
      if (langSel && Array.from(langSel.options).some((o) => o.value === h.settings.language)) {
        langSel.value = h.settings.language;
      }
      state._langInitialized = true;
    }
  } catch { $("#health-dot").className = "dot err"; $("#health-text").textContent = "Mất kết nối server"; }
}

async function checkFastST() {
  try {
    const st = await api("/api/fastst/status");
    const dot = $("#fastst-dot");
    const txt = $("#fastst-text");
    if (!dot || !txt) return;
    if (st.running && st.flow_tab) {
      dot.className = "dot ok";
      txt.textContent = `Profile: Sẵn sàng (${st.active_port})`;
      txt.title = `Google Flow tab đang mở trên cổng ${st.active_port}`;
    } else if (st.running) {
      dot.className = "dot";
      txt.textContent = `Profile: Chạy (${st.active_port})`;
      txt.title = `Profile đang chạy trên cổng ${st.active_port}`;
    } else {
      dot.className = "dot err";
      txt.textContent = "Profile: Chưa bật";
      txt.title = "Bấm để bật Profile tự động";
    }
  } catch {
    $("#fastst-dot")?.setAttribute("class", "dot err");
    if ($("#fastst-text")) $("#fastst-text").textContent = "Profile: Chưa bật";
  }
}
setInterval(() => {
  if (document.hidden || !state.serverOnline) return;
  checkFastST();
}, 4000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshJobs();
    checkFastST();
  }
});

$("#fastst-box")?.addEventListener("click", async () => {
  try {
    const st = await api("/api/fastst/status");
    if (!st.running) {
      toast("Đang bật Profile trình duyệt...", "ok");
      await api("/api/fastst/profiles/1/start", { json: {} });
      toast("Đã bật profile thành công!", "ok");
    } else if (!st.flow_tab) {
      toast("Đang mở Google Flow trên trình duyệt...", "ok");
      await api("/api/fastst/open-flow", { json: {} });
      toast("Đã mở Google Flow!", "ok");
    } else {
      toast(`Profile đang hoạt động trên cổng ${st.active_port}!`, "ok");
    }
    await checkFastST();
  } catch (err) {
    toast(err.message, "error");
  }
});

/* ---------------- Lightbox (Phóng to xem toàn màn hình) ---------------- */
function openLightbox(src, title = "") {
  const modal = $("#img-lightbox-modal");
  const img = $("#lightbox-img");
  const caption = $("#lightbox-caption");
  if (!modal || !img || !src) return;
  img.src = src;
  if (caption) {
    caption.textContent = title || "Ảnh tham chiếu (Master Cast)";
    caption.style.display = title ? "block" : "none";
  }
  modal.removeAttribute("hidden");
}

function closeLightbox() {
  const modal = $("#img-lightbox-modal");
  if (modal) modal.setAttribute("hidden", "true");
}

document.addEventListener("click", (e) => {
  const target = e.target;
  if (!target) return;
  // Bấm vào ảnh Master Cast
  if (target.id === "master-img" || (target.matches && target.matches(".master-turnaround img"))) {
    e.preventDefault();
    const src = target.src || (target.getAttribute && target.getAttribute("src"));
    if (src) {
      openLightbox(src, "Ảnh tham chiếu nhân vật (Master Cast Turnaround Sheet - 16:9)");
    }
  } else if (target.closest && target.closest(".master-turnaround")) {
    const img = target.closest(".master-turnaround").querySelector("img");
    if (img && img.src) {
      e.preventDefault();
      openLightbox(img.src, "Ảnh tham chiếu nhân vật (Master Cast Turnaround Sheet - 16:9)");
    }
  } else if (target.id === "lightbox-close" || target.id === "lightbox-backdrop" || (target.classList && target.classList.contains("lightbox-backdrop"))) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

/* ---------------- SOCIAL AUTO-PUBLISHER & SCHEDULER ---------------- */
let currentSocialTasks = [];

async function loadSocialView() {
  await Promise.all([
    loadSocialSettings(),
    loadSocialProfiles(),
    loadSocialProjects(),
    loadSocialTasks()
  ]);
}

async function loadSocialSettings() {
  try {
    const s = await api("/api/social/settings");
    if ($("#soc-set-auto-on-complete")) {
      $("#soc-set-auto-on-complete").checked = !!s.auto_publish_on_complete;
    }
  } catch (err) {
    console.error("Lỗi tải cài đặt MXH:", err);
  }
}

async function loadSocialProfiles() {
  const sel = $("#soc-profile-port");
  if (!sel) return;
  try {
    const profs = await api("/api/fastst/profiles");
    sel.innerHTML = `<option value="">— Tự động chọn Profile FastST đang chạy —</option>` +
      (profs || []).map((p) => `<option value="${p.port || ''}">${esc(p.name || p.id)} (Port ${p.port || 'Tắt'}${p.running ? ' - Đang chạy' : ''})</option>`).join("");
  } catch (err) {
    console.warn("Không tải được profile FastST:", err);
  }
}

function loadSocialProjects() {
  const sel = $("#soc-project");
  if (!sel) return;
  sel.innerHTML = (state.projects || []).map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
  if (state.projects?.length) {
    onSocialProjectChange();
  }
}

async function onSocialProjectChange(selectVideoName = null) {
  const proj = $("#soc-project")?.value;
  const vidSel = $("#soc-video");
  if (!vidSel || !proj) return;
  try {
    const videos = await api(`/api/projects/${encodeURIComponent(proj)}/videos`);
    vidSel.innerHTML = (videos || []).map((v) => `<option value="${esc(v.name)}">${esc(v.title || v.name)} (${v.scenes_count || 0} cảnh)</option>`).join("");
    if (selectVideoName) {
      vidSel.value = selectVideoName;
    }
    onSocialVideoChange();
  } catch (err) {
    vidSel.innerHTML = `<option value="">(Chưa có video nào)</option>`;
  }
}

async function onSocialVideoChange() {
  const proj = $("#soc-project")?.value;
  const vname = $("#soc-video")?.value;
  if (!proj || !vname) return;
  try {
    const v = await api(`/api/projects/${encodeURIComponent(proj)}/videos/${encodeURIComponent(vname)}`);
    if (v) {
      if ($("#soc-title") && (!$("#soc-title").value || $("#soc-title").dataset.autofilled === "true")) {
        $("#soc-title").value = v.title || v.name;
        $("#soc-title").dataset.autofilled = "true";
      }
      if ($("#soc-desc") && (!$("#soc-desc").value || $("#soc-desc").dataset.autofilled === "true")) {
        $("#soc-desc").value = v.synopsis || v.theme || "";
        $("#soc-desc").dataset.autofilled = "true";
      }
    }
  } catch (err) {}
}

async function loadSocialTasks() {
  const listEl = $("#soc-task-list");
  if (!listEl) return;
  try {
    const tasks = await api("/api/social/tasks");
    currentSocialTasks = tasks || [];

    // Cập nhật badge
    const badge = $("#social-badge");
    const pendingCount = (tasks || []).filter(t => t.status === "pending" || t.status === "scheduled" || t.status === "publishing").length;
    if (badge) {
      badge.textContent = pendingCount;
      badge.hidden = pendingCount === 0;
    }

    if (!tasks || tasks.length === 0) {
      listEl.innerHTML = `<div class="empty-state" style="padding:30px 10px;text-align:center;color:#94a3b8">
        <i style="font-size:32px;display:block;margin-bottom:8px">📭</i>
        Chưa có lịch đăng video nào. Hãy chọn video và bấm "Tiến hành Đăng" ở khung bên trái!
      </div>`;
      return;
    }

    listEl.innerHTML = tasks.map((t) => {
      const isPending = t.status === "pending";
      const isSched = t.status === "scheduled";
      const isPub = t.status === "publishing";
      const isSuccess = t.status === "success";
      const isFailed = t.status === "failed";

      let statusColor = "#eab308";
      let statusText = "Đang chờ đăng";
      if (isSched) { statusColor = "#38bdf8"; statusText = `Lên lịch: ${t.schedule_time}`; }
      if (isPub) { statusColor = "#a855f7"; statusText = "Đang tải lên trình duyệt…"; }
      if (isSuccess) { statusColor = "#22c55e"; statusText = "✔ Đã đăng thành công"; }
      if (isFailed) { statusColor = "#ef4444"; statusText = "✖ Thất bại"; }

      const plats = (t.platforms || []).map(p => {
        if (p === "youtube") return `<span style="background:rgba(239,68,68,0.2);color:#f87171;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">YouTube</span>`;
        if (p === "tiktok") return `<span style="background:rgba(236,72,153,0.2);color:#f472b6;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">TikTok</span>`;
        if (p === "facebook") return `<span style="background:rgba(59,130,246,0.2);color:#60a5fa;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">Facebook</span>`;
        return `<span style="background:#334155;color:#e2e8f0;padding:2px 8px;border-radius:6px;font-size:11px">${p}</span>`;
      }).join(" ");

      return `
        <div style="background:rgba(30,41,59,0.7);border:1px solid #334155;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div>
              <b style="font-size:14px;color:#f8fafc">${esc(t.title || t.video_name)}</b>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px">Kênh: <b>${esc(t.project)}</b> · File: <code>${esc(t.video_name)}</code></div>
            </div>
            <span style="display:inline-block;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;color:${statusColor};border:1px solid ${statusColor}44;background:${statusColor}11">
              ${statusText}
            </span>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;flex-wrap:wrap;gap:6px">
            <div style="display:flex;gap:4px;align-items:center">${plats}</div>
            <div style="display:flex;gap:6px">
              ${!isPub && !isSuccess ? `<button type="button" class="btn primary sm" onclick="publishSocialTaskNow('${t.id}')">⚡ Đăng ngay</button>` : ''}
              <button type="button" class="btn ghost sm" onclick="showTaskLogs('${t.id}')">📋 Xem log</button>
              <button type="button" class="btn danger sm" onclick="deleteSocialTask('${t.id}')">🗑</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    listEl.innerHTML = `<p class="error">Lỗi tải danh sách: ${err.message}</p>`;
  }
}

window.publishSocialTaskNow = async function(taskId) {
  try {
    toast("Đang gửi lệnh kích hoạt đăng video...", "info");
    await api(`/api/social/tasks/${encodeURIComponent(taskId)}/publish-now`, { method: "POST" });
    toast("🚀 Đang mở trình duyệt FastST và tự động đăng video!", "ok");
    loadSocialTasks();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  }
};

window.deleteSocialTask = async function(taskId) {
  if (!confirm("Bạn có chắc chắn muốn xóa lịch đăng này không?")) return;
  try {
    await api(`/api/social/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
    toast("Đã xóa lịch đăng", "ok");
    loadSocialTasks();
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  }
};

window.showTaskLogs = function(taskId) {
  const t = currentSocialTasks.find(x => x.id === taskId);
  if (!t) return;
  const logsText = (t.logs || []).join("\n") || "Chưa có log ghi nhận.";
  alert(`=== NHẬT KÝ ĐĂNG VIDEO (${t.title || t.id}) ===\n\n${logsText}`);
};

// Event Listeners for Social View
$("#soc-project")?.addEventListener("change", () => onSocialProjectChange());
$("#soc-video")?.addEventListener("change", () => onSocialVideoChange());

$("#soc-schedule-type")?.addEventListener("change", (e) => {
  const wrap = $("#soc-datetime-wrap");
  if (wrap) wrap.style.display = e.target.value === "later" ? "block" : "none";
});

$("#btn-refresh-social-tasks")?.addEventListener("click", () => {
  toast("Đang làm mới danh sách lịch đăng...", "info");
  loadSocialTasks();
});

$("#btn-save-social-settings")?.addEventListener("click", async () => {
  const autoComplete = $("#soc-set-auto-on-complete")?.checked || false;
  try {
    await api("/api/social/settings", {
      method: "POST",
      json: { auto_publish_on_complete: autoComplete }
    });
    toast("✔ Đã lưu cài đặt tự động đăng MXH!", "ok");
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  }
});

$("#btn-check-logins")?.addEventListener("click", async () => {
  const btn = $("#btn-check-logins");
  if (btn) btn.textContent = "⏳ Đang kiểm tra đăng nhập…";
  toast("Đang mở trình duyệt kiểm tra đăng nhập YouTube, TikTok, Facebook...", "info");
  try {
    const res = await api("/api/social/check-logins", { method: "POST" });
    let msg = "KẾT QUẢ KIỂM TRA ĐĂNG NHẬP:\n\n";
    if (res.results) {
      for (const [plat, info] of Object.entries(res.results)) {
        if (info.logged_in) {
          msg += `✔ ${plat.toUpperCase()}: ĐÃ ĐĂNG NHẬP (${info.channel || info.username || 'Sẵn sàng'})\n`;
        } else {
          msg += `✖ ${plat.toUpperCase()}: CHƯA ĐĂNG NHẬP (${info.error || 'Cần đăng nhập'})\n`;
        }
      }
    }
    alert(msg);
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  } finally {
    if (btn) btn.textContent = "🔍 Kiểm tra đăng nhập các kênh";
  }
});

$("#btn-soc-ai-seo")?.addEventListener("click", async () => {
  const title = $("#soc-title")?.value || "";
  const desc = $("#soc-desc")?.value || "";
  const proj = $("#soc-project")?.value || "";
  const btn = $("#btn-soc-ai-seo");
  if (btn) btn.textContent = "⏳ Đang sáng tạo SEO…";
  try {
    const res = await api("/api/social/generate-seo", {
      method: "POST",
      json: { content: `${title}\n${desc}\nKênh: ${proj}` }
    });
    if (res.ok && res.seo) {
      if (res.seo.title) $("#soc-title").value = res.seo.title;
      if (res.seo.description) $("#soc-desc").value = res.seo.description;
      if (res.seo.tags) $("#soc-tags").value = res.seo.tags.join(" ");
      toast("✨ AI đã tối ưu Tiêu đề giật tít và Hashtag xu hướng!", "ok");
    }
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  } finally {
    if (btn) btn.textContent = "✨ AI Tối ưu Tiêu đề & Hashtag";
  }
});

$("#btn-submit-social-task")?.addEventListener("click", async () => {
  const proj = $("#soc-project")?.value;
  const vname = $("#soc-video")?.value;
  if (!proj || !vname) {
    toast("Vui lòng chọn Kênh và Video cần đăng tải!", "warn");
    return;
  }

  const platforms = [];
  if ($("#soc-plat-youtube")?.checked) platforms.push("youtube");
  if ($("#soc-plat-tiktok")?.checked) platforms.push("tiktok");
  if ($("#soc-plat-facebook")?.checked) platforms.push("facebook");

  if (platforms.length === 0) {
    toast("Vui lòng tick chọn ít nhất 1 nền tảng để đăng tải (YouTube, TikTok hoặc Facebook)!", "warn");
    return;
  }

  const title = ($("#soc-title")?.value || "").trim();
  const desc = ($("#soc-desc")?.value || "").trim();
  const rawTags = ($("#soc-tags")?.value || "").split(/[,\s]+/).filter(Boolean);
  const tags = rawTags.map(t => t.startsWith("#") ? t : `#${t}`);
  const visibility = $("#soc-visibility")?.value || "public";
  const schedType = $("#soc-schedule-type")?.value || "now";
  const portVal = parseInt($("#soc-profile-port")?.value, 10) || null;

  let scheduleTime = "";
  if (schedType === "later") {
    const dtVal = $("#soc-datetime")?.value;
    if (!dtVal) {
      toast("Vui lòng chọn ngày và giờ đăng!", "warn");
      return;
    }
    scheduleTime = new Date(dtVal).toISOString().slice(0, 19);
  }

  try {
    toast("Đang tạo lịch xuất bản video...", "info");
    const v = await api(`/api/projects/${encodeURIComponent(proj)}/videos/${encodeURIComponent(vname)}`);
    const videoPath = v?.final_path || "";

    const res = await api("/api/social/tasks", {
      method: "POST",
      json: {
        project: proj,
        video_path: videoPath,
        title: title || vname,
        description: desc,
        tags: tags,
        platforms: platforms,
        schedule_time: scheduleTime,
        visibility: visibility,
        profile_port: portVal
      }
    });

    if (res.ok) {
      if (schedType === "now") {
        toast("🚀 Đang khởi động trình duyệt FastST và tự động đăng video!", "ok");
      } else {
        toast(`📅 Đã lên lịch đăng video lúc ${scheduleTime}!`, "ok");
      }
      loadSocialTasks();
    }
  } catch (err) {
    toast(`Lỗi: ${err.message}`, "error");
  }
});

/* ---------------- init ---------------- */
(async function init() {
  initChannelRulesEvents();
  updateSoundToggleUI();
  updateForm();
  await checkHealth();
  await checkFastST();
  await Promise.all([loadStyles(), loadProjects(), loadVoices()]);
  refreshJobs();
})();

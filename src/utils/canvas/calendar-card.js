// src/utils/canvas/calendar-card.js
// Render ảnh 1080x1650.
// Yêu cầu: npm i canvas

import { createCanvas, loadImage, registerFont } from "canvas";
import fs from "fs";
// === THÊM MỚI: Import fs.promises ===
import { promises as fsPromises } from "fs";
import path from "path";
import { tempDir } from "../io-json.js";

// === THÊM MỚI: Lấy __dirname (để tìm thư mục ảnh của weather.js) ===
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === LỖI ĐÃ ĐƯỢC XÓA: Dòng "import ... zingmp3.js" đã bị gỡ bỏ ===

// ========================= CONFIG – CHỈNH Ở ĐÂY =========================
export const CONFIG = {
  canvas: { W: 1080, H: 1700 },

  // khung nền tối lớn (thường tắt)
  showBigCardBg: false,

  // panel giờ: "stack" (Hắc Đạo xuống dòng) | "side" (2 cột)
  panelLayout: "stack",

  // scale nhanh
  scale: { font: 1.0, space: 1.0 },

  // bo góc
  radius: {
    bigCard: 38,
    header: 15,
    event: 15,
    eventBadge: 15,
    hourPanel: 15,
    xuatHanh: 15,
  },

  // font
  font: {
    family: "Inter, Arial, sans-serif",
    header: {
      title: { weight: 800, size: 42 },
      time: { weight: 900, size: 140 },
      lunar: { weight: 900, size: 44 },
      canchi: { weight: 900, size: 40 },
    },
    event: {
      badge: { weight: 900, size: 26 },
      name: { weight: 900, size: 26 },
    },
    hours: {
      title: { weight: 900, size: 35 },
      item: { weight: 800, size: 30, min: 22 },
    },
    xuatHanh: {
      title: { weight: 900, size: 35 },
      body: { weight: 800, size: 30 },
    },
  },

  // Kích thước, khoảng cách
  layout: {
    safePad: 40, // chừa mép ngoài ảnh
    contentSide: 36, // lề trái/phải cho nội dung
    headerInset: 0, // header thụt 2 bên (0 => rộng bằng các panel)
    heights: {
      header: 340,
      eventRow: 90,
      hourPanel: 180,
      xuatHanh: 160,
    },
    gaps: {
      top: 28,
      headerToEvents: 24,
      eventsToPanels: 46,
      panelsToXuatHanh: 36,
      bottom: 28,
    },
    panelGaps: { x: 26, y: 20 }, // x: khi side, y: khi stack
    eventGap: 16, // khoảng cách giữa 2 dòng sự kiện
  },

  // Màu nhấn
  colors: {
    goodTitle: "#8FEFFF",
    badTitle: "#FF9DA7",
    xuatTitle: "#FFD470",
    eventBadgeTop: "#25944A",
    eventBadgeBottom: "#63AD7D",
    headerGradTop: "rgba(0,0,0,0.58)",
    headerGradBottom: "rgba(0,0,0,0.44)",
    cardGradTop: "rgba(10,30,56,0.82)",
    cardGradBottom: "rgba(7,24,46,0.78)",
  },
};
// =======================================================================

// === THÊM MỚI: Các hàm lấy BG Random (Giống weather.js) ===
/**
 * Lấy một đường dẫn ảnh .jpg ngẫu nhiên từ thư mục 'image'
 */
async function getRandomBackground() {
  try {
    // File này ở: src/utils/canvas/
    // Thư mục image ở: src/Nqduan-service/api-crawl/content/image/
    const bgDir = path.resolve(
      __dirname,
      "../../Nqduan-service/api-crawl/content/image",
    );

    const allFiles = await fsPromises.readdir(bgDir);
    const jpgFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".jpg"));

    if (jpgFiles.length === 0) {
      console.log("Không tìm thấy ảnh .jpg nào trong thư mục 'image'.");
      return null;
    }

    const randomImg = jpgFiles[Math.floor(Math.random() * jpgFiles.length)];
    return path.resolve(bgDir, randomImg);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("Không tìm thấy thư mục 'image'. Dùng nền màu mặc định.");
    } else {
      console.error("Lỗi khi đọc thư mục 'image':", err);
    }
    return null;
  }
}

/**
 * Vẽ ảnh nền kiểu "cover" (cắt và zoom cho vừa)
 */
function drawCoverImage(ctx, img, canvasWidth, canvasHeight) {
  const canvasRatio = canvasWidth / canvasHeight;
  const imgRatio = img.width / img.height;
  let sx = 0,
    sy = 0,
    sWidth = img.width,
    sHeight = img.height;

  if (imgRatio > canvasRatio) {
    sWidth = img.height * canvasRatio;
    sx = (img.width - sWidth) / 2;
  } else {
    sHeight = img.width / canvasRatio;
    sy = (img.height - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);
}

// ---------- TIỆN ÍCH ----------
const fmt2 = (n) => String(n).padStart(2, "0");
const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const CAN = [
  "Giáp",
  "Ất",
  "Bính",
  "Đinh",
  "Mậu",
  "Kỷ",
  "Canh",
  "Tân",
  "Nhâm",
  "Quý",
];
const COOL_CAN = new Set(["Tân", "Canh", "Nhâm"]);

function sz(px) {
  return Math.round(px * CONFIG.scale.font);
}
function sp(px) {
  return Math.round(px * CONFIG.scale.space);
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = String(text || "").split(/\s+/);
  let line = "",
    cy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxW && i > 0) {
      ctx.fillText(line.trim(), x, cy);
      line = words[i] + " ";
      cy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line.trim(), x, cy);
}

function fitOneLine(ctx, text, maxW, weight = 800, size = 26, min = 22) {
  let s = size;
  while (s >= min) {
    ctx.font = `${weight} ${sz(s)}px ${CONFIG.font.family}`;
    if (ctx.measureText(text).width <= maxW) break;
    s--;
  }
  return sz(s);
}

// ----- Căn giữa Can–Chi nhưng vẫn tô màu từng từ -----
function drawCanChiCentered(ctx, x, y, w, text, lineHeight, padX = sp(24)) {
  const tokens = String(text || "")
    .split(/\s+/)
    .map((raw) => {
      const clean = raw.replace(/[.,]/g, "");
      const isCan = CAN.includes(clean);
      const color = isCan
        ? COOL_CAN.has(clean)
          ? "#79E6FF"
          : "#94F38E"
        : "#DCEBFF";
      return { t: raw + " ", color };
    });

  const usableW = w - padX * 2;
  const lines = [];
  let line = [],
    lineW = 0;

  for (const seg of tokens) {
    const segW = ctx.measureText(seg.t).width;
    if (lineW + segW > usableW && line.length) {
      lines.push({ segs: line, w: lineW });
      line = [seg];
      lineW = segW;
    } else {
      line.push(seg);
      lineW += segW;
    }
  }
  if (line.length) lines.push({ segs: line, w: lineW });

  let cy = y;
  for (const L of lines) {
    let cx = x + (w - L.w) / 2;
    for (const seg of L.segs) {
      ctx.fillStyle = seg.color;
      ctx.fillText(seg.t, cx, cy);
      cx += ctx.measureText(seg.t).width;
    }
    cy += lineHeight;
  }
}

// ---------- RANDOM BG: (Hàm cũ đã bị xóa) ----------
// listImageFiles (Đã xóa)
// pickNextFromPool (Đã xóa)

// ---------- CÁC KHỐI VẼ ----------
function drawHeader(ctx, rect, now, lunarText, canchiText) {
  const { headerInset } = CONFIG.layout;
  const x = rect.x + sp(headerInset);
  const y = rect.y;
  const w = rect.w - sp(headerInset) * 2;
  const h = rect.h;

  rr(ctx, x, y, w, h, CONFIG.radius.header);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, CONFIG.colors.headerGradTop);
  g.addColorStop(1, CONFIG.colors.headerGradBottom);
  ctx.fillStyle = g;
  ctx.fill();

  const d = now instanceof Date ? now : new Date(now);
  const title = `${WEEKDAY_SHORT[d.getDay()]}, Ngày ${d.getDate()} Tháng ${d.getMonth() + 1} Năm ${d.getFullYear()}`;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFF";
  ctx.font = `${CONFIG.font.header.title.weight} ${sz(CONFIG.font.header.title.size)}px ${CONFIG.font.family}`;
  ctx.fillText(title, x + w / 2, y + sp(60));

  // giờ lớn gradient
  const time = `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
  const tg = ctx.createLinearGradient(x, 0, x + w, 0);
  tg.addColorStop(0, "#9AD8FF");
  tg.addColorStop(0.55, "#BFFFA8");
  tg.addColorStop(1, "#F4FF8A");
  ctx.font = `${CONFIG.font.header.time.weight} ${sz(CONFIG.font.header.time.size)}px ${CONFIG.font.family}`;
  ctx.fillStyle = tg;
  ctx.fillText(time, x + w / 2, y + sp(190));

  // Âm lịch
  ctx.font = `${CONFIG.font.header.lunar.weight} ${sz(CONFIG.font.header.lunar.size)}px ${CONFIG.font.family}`;
  ctx.fillStyle = "#FFF";
  ctx.fillText(
    `Âm Lịch - ${String(lunarText || "").replace(/-/g, "/")}`,
    x + w / 2,
    y + sp(250),
  );

  // Can–Chi (căn giữa)
  ctx.textAlign = "left";
  ctx.font = `${CONFIG.font.header.canchi.weight} ${sz(CONFIG.font.header.canchi.size)}px ${CONFIG.font.family}`;
  drawCanChiCentered(ctx, x, y + sp(304), w, canchiText, sp(44), sp(24));
  ctx.textAlign = "left";
}

function drawEvent(ctx, x, y, w, badge, text) {
  const h = sp(CONFIG.layout.heights.eventRow);
  rr(ctx, x, y, w, h, CONFIG.radius.event);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "rgba(0,0,0,0.52)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.font = `${CONFIG.font.event.badge.weight} ${sz(CONFIG.font.event.badge.size)}px ${CONFIG.font.family}`;
  const leftW = Math.min(w * 0.52, ctx.measureText(badge).width + sp(36));

  rr(ctx, x + sp(16), y + sp(9), leftW, h - sp(18), CONFIG.radius.eventBadge);
  const gm = ctx.createLinearGradient(0, y, 0, y + h);
  gm.addColorStop(0, CONFIG.colors.eventBadgeTop);
  gm.addColorStop(1, CONFIG.colors.eventBadgeBottom);
  ctx.fillStyle = gm;
  ctx.fill();

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#F4FFFA";
  ctx.fillText(badge, x + sp(34), y + h / 2);

  ctx.font = `${CONFIG.font.event.name.weight} ${sz(CONFIG.font.event.name.size)}px ${CONFIG.font.family}`;
  ctx.fillStyle = "#F3F8FF";
  ctx.fillText(text, x + leftW + sp(36), y + h / 2);
  ctx.textBaseline = "alphabetic";
}

function drawHourPanel3Cols(ctx, x, y, w, h, title, titleColor, items6) {
  rr(ctx, x, y, w, h, CONFIG.radius.hourPanel);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "rgba(0,0,0,0.46)");
  g.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${CONFIG.font.hours.title.weight} ${sz(CONFIG.font.hours.title.size)}px ${CONFIG.font.family}`;
  ctx.fillStyle = titleColor;
  ctx.fillText(title, x + w / 2, y + sp(46));

  const padX = sp(22),
    colGap = sp(28),
    colW = (w - padX * 2 - colGap * 2) / 3;
  const rowH = sp(36),
    startY = y + sp(88);
  ctx.textAlign = "left";
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c,
        txt = items6[idx] || "";
      if (!txt) continue;
      const s = fitOneLine(
        ctx,
        txt,
        colW,
        CONFIG.font.hours.item.weight,
        CONFIG.font.hours.item.size,
        CONFIG.font.hours.item.min,
      );
      ctx.font = `${CONFIG.font.hours.item.weight} ${s}px ${CONFIG.font.family}`;
      ctx.fillStyle = "#FFF";
      ctx.fillText(txt, x + padX + c * (colW + colGap), startY + r * rowH);
    }
  }
  ctx.textBaseline = "alphabetic";
}

function drawXuatHanh(ctx, x, y, w, text) {
  const XH_H = sp(CONFIG.layout.heights.xuatHanh);
  rr(ctx, x, y, w, XH_H, CONFIG.radius.xuatHanh);
  const g = ctx.createLinearGradient(0, y, 0, y + XH_H);
  g.addColorStop(0, "rgba(0,0,0,0.46)");
  g.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.font = `${CONFIG.font.xuatHanh.title.weight} ${sz(CONFIG.font.xuatHanh.title.size)}px ${CONFIG.font.family}`;
  ctx.fillStyle = CONFIG.colors.xuatTitle;
  ctx.fillText("Hướng xuất hành", x + w / 2, y + sp(52));

  ctx.textAlign = "left";
  ctx.font = `${CONFIG.font.xuatHanh.body.weight} ${sz(CONFIG.font.xuatHanh.body.size)}px ${CONFIG.font.family}`;
  ctx.fillStyle = "#FFF";
  wrap(ctx, text, x + sp(24), y + sp(94), w - sp(48), sp(34));
}

// ---------- ASSETS (quét thư mục ảnh) ----------
export function assetsPreset() {
  const root = process.cwd();

  // === THAY ĐỔI: Gỡ bỏ logic quét 'assets/images' ===
  // const imagesDir = path.join(root, "assets/images");
  // const bgPool = listImageFiles(imagesDir); // quét tất cả ảnh

  return {
    // bgPool, (Đã xóa)
    fonts: [
      {
        path: path.join(root, "assets/fonts/Inter-Regular.ttf"),
        family: "Inter",
        weight: "400",
      },
      {
        path: path.join(root, "assets/fonts/Inter-Bold.ttf"),
        family: "Inter",
        weight: "900",
      },
    ],
  };
}

// ---------- RENDER CHÍNH ----------
export async function renderCalendarCardExactToFile({
  // Defaults khớp ảnh mẫu 15:57 (có thể đổi)
  now = new Date("2025-09-09T15:57:00+07:00"),
  lunarText = "18/07/2025",
  canchiText = "Ngày Tân Tỵ. Tháng Ất Dậu Năm Ất Tỵ.",
  summary = "Xuất hành thuận lợi, gặp quý nhân phụ trợ, làm mọi việc vừa lòng, như ý muốn, đỗ phẩm vinh quy.",
  goodHours = [
    "Sửu (1:00-2:59)",
    "Thìn (7:00-8:59)",
    "Ngọ (11:00-12:59)",
    "Mùi (13:00-14:59)",
    "Tuất (19:00-20:59)",
    "Hợi (21:00-22:59)",
  ],
  badHours = [
    "Tí (23:00-0:59)",
    "Dần (3:00-4:59)",
    "Mão (5:00-6:59)",
    "Tỵ (9:00-10:59)",
    "Thân (15:00-16:59)",
    "Dậu (17:00-18:59)",
  ],
  countdowns = [
    "27 ngày nữa|Tết Trung thu",
    "31 ngày nữa|Ngày giải phóng Thủ Đô",
    "40 ngày nữa|Ngày Phụ nữ Việt Nam",
    "72 ngày nữa|Ngày Nhà giáo Việt Nam",
    "104 ngày nữa|Ngày TLQĐND Việt Nam",
  ],
  assets = assetsPreset(),
} = {}) {
  const { W, H } = CONFIG.canvas;
  const { safePad, contentSide, heights, gaps, panelGaps, eventGap } =
    CONFIG.layout;

  // Fonts (optional)
  try {
    assets.fonts?.forEach((f) => {
      if (fs.existsSync(f.path))
        registerFont(f.path, { family: f.family, weight: f.weight || "400" });
    });
  } catch {}

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // === THAY ĐỔI: Sử dụng logic random BG từ weather.js ===
  const bgPath = await getRandomBackground();
  let bgImage = null;

  if (bgPath) {
    try {
      bgImage = await loadImage(bgPath);
    } catch (err) {
      console.error("Lỗi khi tải ảnh nền, dùng màu mặc định:", err);
    }
  }

  if (bgImage) {
    // Vẽ ảnh nền (cover)
    drawCoverImage(ctx, bgImage, W, H);
  } else {
    // Fallback gradient nếu chưa có ảnh trong thư mục
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#6cc5ff");
    g.addColorStop(1, "#b7e9ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // === KẾT THÚC THAY ĐỔI BG ===

  // Big card nền tối (nếu bật)
  if (CONFIG.showBigCardBg) {
    const cardX = sp(safePad),
      cardY = sp(safePad);
    const cardW = W - sp(safePad) * 2,
      cardH = H - sp(safePad) * 2;
    rr(ctx, cardX, cardY, cardW, cardH, CONFIG.radius.bigCard);
    const cgrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    cgrad.addColorStop(0, CONFIG.colors.cardGradTop);
    cgrad.addColorStop(1, CONFIG.colors.cardGradBottom);
    ctx.fillStyle = cgrad;
    ctx.fill();
  }

  // Khung nội dung
  const contentFrameX = sp(safePad);
  const contentFrameW = W - sp(safePad) * 2;
  const contentX = contentFrameX + sp(contentSide);
  const contentW = contentFrameW - sp(contentSide) * 2;

  // Dòng chảy layout
  let y = sp(safePad) + sp(gaps.top);

  // Header
  drawHeader(
    ctx,
    { x: contentX, y, w: contentW, h: sp(heights.header) },
    now,
    lunarText,
    canchiText,
  );
  y += sp(heights.header) + sp(gaps.headerToEvents);

  // Events
  for (let i = 0; i < countdowns.length; i++) {
    const [badge, nameRaw] = countdowns[i].includes("|")
      ? countdowns[i].split("|")
      : countdowns[i].split("–");
    const name = (nameRaw || "").replace(/^[-–]\s*/, "").trim();
    drawEvent(ctx, contentX, y, contentW, (badge || "").trim(), name);
    y += sp(heights.eventRow) + (i < countdowns.length - 1 ? sp(eventGap) : 0);
  }
  y += sp(gaps.eventsToPanels);

  // Panels
  if (CONFIG.panelLayout === "stack") {
    drawHourPanel3Cols(
      ctx,
      contentX,
      y,
      contentW,
      sp(heights.hourPanel),
      "Giờ Hoàng Đạo",
      CONFIG.colors.goodTitle,
      goodHours,
    );
    y += sp(heights.hourPanel) + sp(panelGaps.y);
    drawHourPanel3Cols(
      ctx,
      contentX,
      y,
      contentW,
      sp(heights.hourPanel),
      "Giờ Hắc Đạo",
      CONFIG.colors.badTitle,
      badHours,
    );
    y += sp(heights.hourPanel) + sp(gaps.panelsToXuatHanh);
  } else {
    const panelW = Math.floor((contentW - sp(panelGaps.x)) / 2);
    drawHourPanel3Cols(
      ctx,
      contentX,
      y,
      panelW,
      sp(heights.hourPanel),
      "Giờ Hoàng Đạo",
      CONFIG.colors.goodTitle,
      goodHours,
    );
    drawHourPanel3Cols(
      ctx,
      contentX + panelW + sp(panelGaps.x),
      y,
      panelW,
      sp(heights.hourPanel),
      "Giờ Hắc Đạo",
      CONFIG.colors.badTitle,
      badHours,
    );
    y += sp(heights.hourPanel) + sp(gaps.panelsToXuatHanh);
  }

  // Hướng xuất hành
  drawXuatHanh(ctx, contentX, y, contentW, String(summary || "").trim());
  y += sp(heights.xuatHanh);

  // Lưu file
  const fileName = `calendar_${Date.now()}.jpg`;
  const filePath = path.join(tempDir, fileName);
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(
    filePath,
    canvas.toBuffer("image/jpeg", { quality: 0.92 }),
  );
  return filePath;
}

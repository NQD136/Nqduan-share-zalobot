import { createCanvas, loadImage, registerFont } from "canvas";
import fs from "fs";
import path from "path";
import * as cv from "./index.js";

// ĐĂNG KÝ FONT (BẮT BUỘC)
const fontPath = path.resolve("./assets/fonts/BeVietnamPro-Bold.ttf");
if (fs.existsSync(fontPath)) {
  registerFont(fontPath, { family: "BeVietnamPro" });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBox(ctx, x, y, w, h, title, titleColors = ["#4ECB71", "#1E90FF"]) {
  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.55)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  const titleGrad = ctx.createLinearGradient(x, y, x + w, y);
  titleGrad.addColorStop(0, titleColors[0]);
  titleGrad.addColorStop(1, titleColors[1]);
  ctx.fillStyle = titleGrad;
  ctx.font = "bold 36px BeVietnamPro";
  ctx.textAlign = "center";
  ctx.fillText(title, x + w / 2, y + 45);
}

function drawVerticalDivider(ctx, x, y, h) {
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 60);
  ctx.lineTo(x, y + h - 60);
  ctx.stroke();
}

function getRandomGradient(ctx, width = 400) {
  const colors = [
    ["#FF6B6B", "#FFB6C1"],
    ["#4ECB71", "#72D898"],
    ["#1E90FF", "#4DA6FF"],
    ["#FFD93D", "#FFEB3B"],
    ["#9366D6", "#B266FF"],
    ["#00E5FF", "#00B8D4"],
    ["#FF8E8E", "#FF6B6B"],
  ];
  const pair = colors[Math.floor(Math.random() * colors.length)];
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, pair[0]);
  grad.addColorStop(1, pair[1]);
  return grad;
}

export async function createGroupInfoImage(groupInfo, owner, onConfigs = [], offConfigs = []) {
  const WIDTH = 1500;
  const MARGIN = 60;
  const HEADER_H = 260; // Tăng lên để tên to hơn
  const HEADER_Y = 40;
  const AVATAR_SIZE = 180;

  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext("2d");

  // THAY ĐỔI MỚI: XÁC ĐỊNH LOẠI NHÓM ĐỂ HIỂN THỊ
  const groupTypeLabel = groupInfo.groupType === 2 
    ? "Cộng Đồng Chính Thức" 
    : "Nhóm Chat";

  const infoFields = [
    { label: "ID:", value: groupInfo.groupId || "N/A" },
    { label: "dagsdgadgasdga:", value: groupInfo.memberCount?.toString() || "0" },
    { label: "Ngày tạo:", value: groupInfo.createdTime || "N/A" },
    { label: "", value: groupTypeLabel }, // THAY ĐỔI MỚI
  ];

  const lineH = 62;
  const infoBoxH = infoFields.length * lineH + 110;

  const maxConfigItems = Math.max(onConfigs.length, offConfigs.length);
  const hasBoth = onConfigs.length > 0 && offConfigs.length > 0;
  const configBoxH = hasBoth 
    ? maxConfigItems * 50 + 150 
    : (onConfigs.length + offConfigs.length) * 62 + 170;

  const leftColumnHeight = infoBoxH + configBoxH + 60;

  const descText = groupInfo.desc || "Không có mô tả.";
  const descLines = descText.split("\n");
  const descBoxH = Math.max(320, descLines.length * 40 + 130);

  const totalHeight = Math.max(
    HEADER_Y + HEADER_H + 50 + leftColumnHeight,
    HEADER_Y + HEADER_H + 50 + descBoxH
  ) + 100;

  const canvas = createCanvas(WIDTH, totalHeight);
  const ctx = canvas.getContext("2d");

  // NỀN + METALLIC
  const bg = ctx.createLinearGradient(0, 0, 0, totalHeight);
  bg.addColorStop(0, "#0F2027");
  bg.addColorStop(0.5, "#203A43");
  bg.addColorStop(1, "#2C5364");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, totalHeight);

  const metallic = ctx.createLinearGradient(0, 0, WIDTH, totalHeight);
  metallic.addColorStop(0, "rgba(255,255,255,0.05)");
  metallic.addColorStop(0.5, "rgba(255,255,255,0.12)");
  metallic.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.fillStyle = metallic;
  ctx.fillRect(0, 0, WIDTH, totalHeight);

  // AVATAR SIÊU ĐẸP
  if (groupInfo.avt) {
    try {
      const avatar = await loadImage(groupInfo.avt);
      const cx = MARGIN + AVATAR_SIZE / 2;
      const cy = HEADER_Y + HEADER_H / 2;

      const ringGrad = ctx.createLinearGradient(cx - 90, cy - 90, cx + 90, cy + 90);
      ringGrad.addColorStop(0, "#4ECB71");
      ringGrad.addColorStop(1, "#1E90FF");
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 12;
      ctx.shadowColor = "#00eaff";
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(cx, cy, AVATAR_SIZE / 2 + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, AVATAR_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, MARGIN, HEADER_Y + 40, AVATAR_SIZE, AVATAR_SIZE);
      ctx.restore();
    } catch (e) { console.error("Avatar failed:", e); }
  }

  // TÊN NHÓM SIÊU TO – GRADIENT NGẪU NHIÊN
  const nameGrad = cv.getRandomGradient ? cv.getRandomGradient(ctx, 800) : getRandomGradient(ctx, 800);
  ctx.fillStyle = nameGrad;
  ctx.font = "bold 76px BeVietnamPro";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0, 234, 255, 0.6)";
  ctx.shadowBlur = 20;
  ctx.fillText(groupInfo.name || "Không tên", MARGIN + AVATAR_SIZE + 60, HEADER_Y + 140);
  ctx.shadowBlur = 0;

  // DÒNG PHỤ
  const subGrad = getRandomGradient(ctx, 500);
  ctx.fillStyle = subGrad;
  ctx.font = "italic bold 34px BeVietnamPro";
  ctx.fillText("Group Dashboard", MARGIN + AVATAR_SIZE + 60, HEADER_Y + 200);

  const contentY = HEADER_Y + HEADER_H + 50;
  const columnWidth = 620;
  const leftX = MARGIN;
  const rightX = WIDTH - MARGIN - columnWidth;

  let currentY = contentY;

  // THÔNG TIN NHÓM
  drawBox(ctx, leftX, currentY, columnWidth, infoBoxH, "Thông Tin Nhóm");
  infoFields.forEach((f, i) => {
    const labelGrad = getRandomGradient(ctx, 200);
    const valueGrad = getRandomGradient(ctx, 300);

    ctx.fillStyle = labelGrad;
    ctx.font = "bold 32px BeVietnamPro";
    ctx.textAlign = "left";
    ctx.fillText(f.label, leftX + 40, currentY + 110 + i * lineH);

    ctx.fillStyle = valueGrad;
    ctx.textAlign = "right";
    ctx.fillText(f.value, leftX + columnWidth - 40, currentY + 110 + i * lineH);
  });
  currentY += infoBoxH + 40;

  // CẤU HÌNH NHÓM
  if (onConfigs.length > 0 || offConfigs.length > 0) {
    drawBox(ctx, leftX, currentY, columnWidth, configBoxH, "Cấu Hình Nhóm", ["#FFD93D", "#FF4757"]);

    if (hasBoth) {
      drawVerticalDivider(ctx, leftX + columnWidth / 2, currentY, configBoxH);

      ctx.fillStyle = "#4ECB71";
      ctx.font = "bold 32px BeVietnamPro";
      ctx.textAlign = "left";
      ctx.fillText("Đang bật:", leftX + 40, currentY + 90);
      onConfigs.forEach((cfg, i) => {
        const g = getRandomGradient(ctx, 250);
        ctx.fillStyle = g;
        ctx.font = "28px BeVietnamPro";
        ctx.fillText(`${cfg}: ✅`, leftX + 40, currentY + 150 + i * 50);
      });

      ctx.fillStyle = "#FF4757";
      ctx.font = "bold 32px BeVietnamPro";
      ctx.fillText("Đang tắt:", leftX + columnWidth / 2 + 40, currentY + 90);
      offConfigs.forEach((cfg, i) => {
        const g = getRandomGradient(ctx, 250);
        ctx.fillStyle = g;
        ctx.font = "28px BeVietnamPro";
        ctx.fillText(`${cfg}: ❌`, leftX + columnWidth / 2 + 40, currentY + 150 + i * 50);
      });
    } else {
      const list = onConfigs.length > 0 ? onConfigs : offConfigs;
      const isOn = onConfigs.length > 0;
      const titleGrad = ctx.createLinearGradient(leftX, currentY, leftX + columnWidth, currentY);
      titleGrad.addColorStop(0, isOn ? "#4ECB71" : "#FF4757");
      titleGrad.addColorStop(1, isOn ? "#72D898" : "#FF6B6B");
      ctx.fillStyle = titleGrad;
      ctx.font = "bold 48px BeVietnamPro";
      ctx.textAlign = "center";
      ctx.fillText(isOn ? "Đang bật:" : "Đang tắt:", leftX + columnWidth / 2, currentY + 100);

      list.forEach((cfg, i) => {
        const g = getRandomGradient(ctx, 400);
        ctx.fillStyle = g;
        ctx.font = "bold 32px BeVietnamPro";
        ctx.textAlign = "center";
        ctx.fillText(`${cfg}: ${isOn ? "✅" : "❌"}`, leftX + columnWidth / 2, currentY + 180 + i * 62);
      });
    }
  }

  // MÔ TẢ NHÓM
  drawBox(ctx, rightX, contentY, columnWidth, descBoxH, "Mô Tả Nhóm", ["#9366D6", "#00E5FF"]);
  ctx.font = "28px BeVietnamPro";
  ctx.textAlign = "left";
  let y = contentY + 100;
  if (!groupInfo.desc || groupInfo.desc.trim() === "") {
    ctx.fillStyle = "#888888";
    ctx.textAlign = "center";
    ctx.fillText("Không có mô tả.", rightX + columnWidth / 2, contentY + descBoxH / 2);
  } else {
    for (const line of descLines) {
      if (y > contentY + descBoxH - 70) {
        ctx.fillStyle = "#FFD93D";
        ctx.textAlign = "center";
        ctx.fillText("... (xem thêm)", rightX + columnWidth / 2, y);
        break;
      }
      const lineGrad = getRandomGradient(ctx, columnWidth - 80);
      ctx.fillStyle = lineGrad;
      ctx.textAlign = "left";
      ctx.fillText(line, rightX + 40, y);
      y += 40;
    }
  }

  // XUẤT FILE
  const tempDir = path.resolve("./assets/temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const filePath = path.resolve(tempDir, `group_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}
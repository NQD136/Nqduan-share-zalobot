import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";

function formatNum(n) {
  const num = Number(n || 0);
  return num.toLocaleString("vi-VN");
}

export async function createCaroTopImage(entries = [], opts = {}) {
  const width = 900;
  const rowH = 56;
  const headerH = 90;
  const footerH = 40;
  const tableH = Math.max(entries.length, 1) * rowH + 56;
  const height = headerH + tableH + footerH;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(1, "#111827");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

 
  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🏆 BẢNG XẾP HẠNG CARO", width / 2, 50);
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#a3b2c7";
  ctx.fillText("Top 10 Cao Thủ", width / 2, 72);


  const tableX = 32;
  const tableY = headerH;
  const tableW = width - tableX * 2;
  const radius = 10;
  ctx.fillStyle = "#0b1220";
  roundRect(ctx, tableX, tableY, tableW, tableH, radius, true, false);


  const colHeaderH = 40;
  ctx.fillStyle = "#1e293b";
  roundRect(ctx, tableX + 4, tableY + 4, tableW - 8, colHeaderH, 8, true, false);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  const colRankX = tableX + 20;
  const colNameX = tableX + 110;
  const colPtsX = tableX + tableW - 260;
  const colStatsX = tableX + tableW - 120;
  ctx.fillText("Hạng", colRankX, tableY + 28);
  ctx.fillText("Tên", colNameX, tableY + 28);
  ctx.fillText("Điểm", colPtsX, tableY + 28);
  ctx.fillText("Thống kê", colStatsX, tableY + 28);

  const startY = tableY + colHeaderH + 6;
  for (let i = 0; i < Math.min(entries.length, 10); i++) {
    const y = startY + i * rowH;
   
    ctx.fillStyle = i === 0 ? "#153259" : (i % 2 === 0 ? "#0f1a2a" : "#0d1726");
    roundRect(ctx, tableX + 6, y, tableW - 12, rowH - 8, 8, true, false);

    const e = entries[i];
    const rank = `#${i + 1}`;
    ctx.fillStyle = i === 0 ? "#ffd166" : "#cbd5e1";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(rank, colRankX, y + 34);

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "16px sans-serif";
    let name = e.name || `UID ${e.uid}`;
    if (name.length > 22) name = name.slice(0, 20) + "…";
    ctx.fillText(name, colNameX, y + 34);

    ctx.textAlign = "right";
    ctx.fillStyle = i === 0 ? "#ffd166" : "#93c5fd";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(formatNum(e.points), colPtsX + 80, y + 34);

    ctx.textAlign = "left";
    ctx.fillStyle = "#9ca3af";
    ctx.font = "14px sans-serif";
    const stats = `Đ:${e.win || 0}/T:${e.lose || 0}/H:${e.draw || 0}`;
    ctx.fillText(stats, colStatsX, y + 34);
  }

  const footerY = tableY + tableH + 18;
  ctx.textAlign = "center";
  ctx.fillStyle = "#9fb1cc";
  const rank = opts.selfRank ? `#${opts.selfRank}` : "N/A";
  const pts = formatNum(opts.selfPoints || 0);
  ctx.font = "14px sans-serif";
  ctx.fillText(`Bạn đang xếp hạng ${rank} với ${pts} điểm Rank`, width / 2, footerY);
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#6b7280";
  ctx.fillText(`Dễ | Thường | Khó | TĐ-Thách đấu (cộng trừ điểm)`, width / 2, footerY + 18);

  const dir = path.resolve("./assets/temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `caro_top_${Date.now()}.png`);
  await new Promise((res, rej) => {
    const out = fs.createWriteStream(outPath);
    canvas.createPNGStream().pipe(out);
    out.on("finish", res);
    out.on("error", rej);
  });
  return outPath;
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof radius === "number") {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  } else {
    radius = { tl: radius.tl || 0, tr: radius.tr || 0, br: radius.br || 0, bl: radius.bl || 0 };
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

export default { createCaroTopImage };

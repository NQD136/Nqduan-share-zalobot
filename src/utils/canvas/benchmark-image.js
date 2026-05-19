import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";

const BG_ICONS = ["❤️", "💕", "🎉", "⚡️", "✨", "🔥", "⭐️", "💎", "🚀"];

export async function createBenchmarkImage(result, width = 900, height = 650) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0f172a"); // navy
  gradient.addColorStop(1, "#1e293b"); // dark slate
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Icon background mờ
  ctx.font = "40px Segoe UI Emoji";
  ctx.globalAlpha = 0.1;
  for (let i = 0; i < 60; i++) {
    const icon = BG_ICONS[Math.floor(Math.random() * BG_ICONS.length)];
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillText(icon, x, y);
  }
  ctx.globalAlpha = 1;

  // Title
  ctx.font = "bold 38px Tahoma";
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "center";
  ctx.shadowColor = "#facc15";
  ctx.shadowBlur = 15;
  ctx.fillText("== ĐÁNH GIÁ HIỆU NĂNG CPU ==", width / 2, 70);
  ctx.shadowBlur = 0;

  let y = 130;
  ctx.textAlign = "left";

  // Đơn luồng
  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = "#F87171";
  ctx.fillText("🧑‍💻 Đơn luồng", 60, y);
  y += 40;
  ctx.font = "24px Tahoma";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`- Số phép toán: ${result.single.ops.toLocaleString("vi-VN")}`, 80, y); y += 35;
  ctx.fillText(`- Thời gian chạy: ${result.single.durationMs} ms`, 80, y); y += 50;

  // Đa luồng
  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = "#34D399";
  ctx.fillText("🧑‍💻 Đa luồng", 60, y);
  y += 40;
  ctx.font = "24px Tahoma";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`- Số phép toán: ${result.multi.ops.toLocaleString("vi-VN")}`, 80, y); y += 35;
  ctx.fillText(`- Thời gian chạy: ${result.multi.durationMs} ms`, 80, y); y += 35;
  ctx.fillText(`- Số luồng (workers): ${result.multi.workers}`, 80, y); y += 50;

  // CPU hiệu quả
  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = "#60A5FA";
  ctx.fillText(`💡 Số lõi CPU hiệu quả: ${result.effectiveCores.toFixed(2)}`, 60, y);

  // Biểu đồ cột
  const chartX = 550;
  const chartY = 200;
  const chartW = 280;
  const chartH = 300;

  ctx.strokeStyle = "#ffffff44";
  ctx.strokeRect(chartX, chartY, chartW, chartH);

  const maxOps = Math.max(result.single.ops, result.multi.ops);
  const barW = 80;

  // Single bar
  const singleHeight = (result.single.ops / maxOps) * (chartH - 20);
  ctx.fillStyle = "#F87171";
  ctx.fillRect(chartX + 40, chartY + chartH - singleHeight, barW, singleHeight);
  ctx.fillStyle = "#fff";
  ctx.font = "20px Tahoma";
  ctx.fillText("Single", chartX + 45, chartY + chartH + 30);

  // Multi bar
  const multiHeight = (result.multi.ops / maxOps) * (chartH - 20);
  ctx.fillStyle = "#34D399";
  ctx.fillRect(chartX + 160, chartY + chartH - multiHeight, barW, multiHeight);
  ctx.fillStyle = "#fff";
  ctx.fillText("Multi", chartX + 170, chartY + chartH + 30);

  // Xuất file PNG
  const filePath = path.resolve(`./assets/temp/benchmark_${Date.now()}.png`);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}
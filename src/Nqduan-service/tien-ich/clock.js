// src/Nqduan-service/tien-ich/clock.js
import { createCanvas, registerFont } from "canvas";
import fs from "fs";
import path from "path";
import { sendMessageTag } from "../chat-zalo/chat-style/chat-style.js";

try {
  registerFont("./fonts/SF-Pro-Display-Bold.ttf", {
    family: "SF Pro Display",
    weight: "bold",
  });
  registerFont("./fonts/SF-Pro-Display-Medium.ttf", {
    family: "SF Pro Display",
    weight: "500",
  });
} catch (e) {
  /* không có font thì vẫn đẹp */
}

const TIME_TO_LIVE_MESSAGE = 86400000; // 24h như speedtest

export async function handleClockCommand(api, message) {
  const senderName = message.data?.dName || "Bạn";

  try {
    const imagePath = await createIOSClock();

    await sendMessageTag(api, message, {
      caption: `Đồng hồ hiện tại của ${senderName}\nChúc bạn một ngày thật vui!`,
      imagePath,
      ttl: TIME_TO_LIVE_MESSAGE,
    });

    setTimeout(() => {
      try {
        fs.unlinkSync(imagePath);
      } catch {}
    }, 20000);
  } catch (error) {
    console.error("Lỗi clock:", error);
    await sendMessageTag(api, message, {
      caption: "Đồng hồ hỏng rồi, thử lại sau nha!",
      ttl: 30000,
    });
  }
}

async function createIOSClock() {
  const now = new Date();
  const options = { timeZone: "Asia/Ho_Chi_Minh" };

  const time = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...options,
  }); // → "21:29:45"

  const [hours, minutes, seconds] = time.split(":");

  const weekday = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    ...options,
  });
  const dateStr = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...options,
  });

  const canvas = createCanvas(1200, 600);
  const ctx = canvas.getContext("2d");

  // Nền gradient + overlay
  const grad = ctx.createLinearGradient(0, 0, 1200, 600);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(0.45, "#1e293b");
  grad.addColorStop(1, "#334155");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 600);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, 0, 1200, 600);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // === GIỜ : PHÚT (to đùng, trắng) ===
  ctx.font = "bold 200px BeVietNamPro";
  ctx.fillStyle = "#00a5fdff";
  ctx.shadowColor = "#09ffb5ff";
  ctx.shadowBlur = 90;
  ctx.shadowOffsetY = 12;
  ctx.fillText(`${hours}:${minutes}`, 500, 270);

  // === DẤU : GIỮA PHÚT VÀ GIÂY (nhỏ hơn, xám) ===
  ctx.font = "bold 100px BeVietNamPro";
  ctx.fillStyle = "#05fe1ad4";
  ctx.shadowBlur = 0;
  ctx.fillText(":", 500 + 170, 270);

  // === GIÂY (xanh dương, to đẹp, nằm riêng bên phải) ===
  ctx.font = "bold 160px 'BeVietNamPro";
  ctx.fillStyle = "#60a5fa";
  ctx.shadowColor = "#1e40af";
  ctx.shadowBlur = 60;
  ctx.textAlign = "left";
  ctx.fillText(seconds, 500 + 230, 270);

  // === THỨ TRONG TUẦN ===
  ctx.shadowBlur = 0;
  ctx.textAlign = "center";
  ctx.font = "500 76px BeVietNamPro";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(weekday.charAt(0).toUpperCase() + weekday.slice(1), 600, 400);

  // === NGÀY THÁNG NĂM ===
  ctx.font = "500 62px BeVietNamPro";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(dateStr, 600, 475);

  // Viền bo góc đẹp lung linh
  ctx.strokeStyle = "rgba(255, 255, 255, 0.24)";
  ctx.lineWidth = 22;
  roundRect(ctx, 25, 25, 1150, 550, 140);
  ctx.stroke();

  // Lưu ảnh
  const dir = path.resolve("./assets/temp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `clock_${Date.now()}.png`);
  await fs.promises.writeFile(filePath, canvas.toBuffer("image/png"));

  return filePath;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

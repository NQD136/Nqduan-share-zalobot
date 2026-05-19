// File: src/Nqduan-service/tien-ich/lich-hoc.js
// Lệnh: /lg [tuần] → ảnh lịch học

import axios from "axios";
import { CookieJar } from "tough-cookie";
import FormData from "form-data";
import { createCanvas } from "canvas";
import fs from "fs/promises";
import path from "path";
import * as cheerio from "cheerio";
import { sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";

const CONFIG = {
  baseUrl: "https://sinhvien.bachkhoahanoi.edu.vn",
  loginUrl: "/DangNhap/Login", // TRỰC TIẾP GET ĐỂ LẤY TOKEN
  apiUrl: "/TraCuuLichHoc/DanhSachTuan",
  username: "2509620038",
  password: "2509620038",
  namHoc: "2025-2026",
  defaultTuan: 1,
};

const jar = new CookieJar();

async function getCookieHeader(url) {
  const cookies = await jar.getCookies(url);
  return cookies.map((c) => `${c.key}=${c.value}`).join("; ");
}

const client = axios.create({
  baseURL: CONFIG.baseUrl,
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "vi-VN,vi;q=0.9",
  },
});

client.interceptors.request.use(async (config) => {
  const cookieStr = await getCookieHeader(config.baseURL + (config.url || ""));
  if (cookieStr) config.headers.Cookie = cookieStr;
  return config;
});

client.interceptors.response.use((response) => {
  const setCookie = response.headers["set-cookie"];
  if (setCookie) {
    setCookie.forEach((cookie) => {
      jar.setCookieSync(cookie, CONFIG.baseUrl);
    });
  }
  return response;
});

// ==================== ĐĂNG NHẬP (TRỰC TIẾP GET /DangNhap/Login) ====================
async function login() {
  try {
    console.log("[Login] Bước 1: GET form đăng nhập tại /DangNhap/Login...");
    const loginPage = await client.get(CONFIG.loginUrl);
    const $ = cheerio.load(loginPage.data);

    const form = new FormData();
    form.append("txtTaiKhoan", CONFIG.username);
    form.append("txtMatKhau", CONFIG.password);
    form.append("Role", "1"); // Sinh viên

    const token = $('input[name="__RequestVerificationToken"]').val();
    if (!token) {
      console.error("[Login] LỖI: Không tìm thấy CSRF Token!");
      return false;
    }
    form.append("__RequestVerificationToken", token);
    console.log("[Login] CSRF Token: ĐÃ LẤY ĐƯỢC");

    const fullUrl = CONFIG.baseUrl + CONFIG.loginUrl;
    console.log("[Login] Bước 2: POST đăng nhập →", fullUrl);

    const res = await client.post(fullUrl, form, {
      headers: form.getHeaders(),
      maxRedirects: 0,
      validateStatus: () => true,
    });

    console.log("[Login] Status:", res.status);
    console.log("[Login] Location:", res.headers.location || "Không có");

    // DEBUG HTML
    const htmlPreview = res.data.slice(0, 600);
    console.log("[Login] Response preview:");
    console.log(htmlPreview);

    // KIỂM TRA LỖI
    if (
      res.data.includes("alert-danger") ||
      res.data.includes("Sai") ||
      res.data.includes("không đúng") ||
      res.data.includes("khóa")
    ) {
      console.log("[Login] LỖI: Tài khoản/mật khẩu sai hoặc bị khóa!");
      return false;
    }

    // THÀNH CÔNG: Có redirect + không về login
    const success =
      res.status === 302 &&
      res.headers.location &&
      !res.headers.location.includes("DangNhap");

    console.log("[Login] Kết quả:", success ? "THÀNH CÔNG!" : "THẤT BẠI");
    return success;
  } catch (err) {
    console.error("[Login] LỖI KẾT NỐI:", err.message);
    return false;
  }
}

// ==================== LẤY DỮ LIỆU ====================
async function fetchLichHoc(tuan) {
  try {
    const res = await client.get(
      `${CONFIG.apiUrl}?Nam_hoc=${CONFIG.namHoc}&Tuan_thu=${tuan}`,
    );
    const $ = cheerio.load(res.data);
    const rows = $("table tr").slice(1);
    const data = [];
    let lop = "Unknown";

    rows.each((i, row) => {
      const cols = $(row).find("td");
      if (cols.length >= 9) {
        const thuText = $(cols[0]).text().trim();
        const thu = parseInt(thuText);
        const ca = $(cols[1]).text().trim();
        const tiet = $(cols[2]).text().trim();
        const tenMon = $(cols[4]).text().trim();
        const lopHocPhan = $(cols[5]).text().trim();
        const phong = $(cols[7]).text().trim();
        const giangVien = $(cols[8]).text().trim();

        if (thu >= 2 && thu <= 7) {
          data.push({
            thu: thu - 1,
            ca: ca === "Sáng" ? 0 : 1,
            tenMon,
            giangVien,
            phong,
            tiet,
          });
        }

        if (i === 0 && lopHocPhan) {
          const parts = lopHocPhan.split("_");
          if (parts.length > 1) lop = parts[1].split("+")[0];
        }
      }
    });

    return { data, lop };
  } catch (err) {
    console.error("[API] Lỗi:", err.message);
    return null;
  }
}

// ==================== VẼ ẢNH (GIỮ NGUYÊN) ====================
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let py = y;
  for (let word of words) {
    const testLine = line + word + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== "") {
      ctx.fillText(line, x, py);
      line = word + " ";
      py += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, py);
}

async function drawGridImage({ data, lop }, tuan) {
  const cellWidth = 145;
  const cellHeight = 105;
  const headerHeight = 80;
  const leftColWidth = 80;
  const topRowHeight = 50;

  const width = leftColWidth + 6 * cellWidth + 40;
  const height = headerHeight + 2 * cellHeight + topRowHeight + 60;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#0F2027");
  grad.addColorStop(1, "#203A43");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.font = "bold 36px Arial, sans-serif";
  ctx.fillStyle = "#FFD700";
  ctx.textAlign = "center";
  ctx.fillText(`LỊCH HỌC TUẦN ${tuan}`, width / 2, 50);

  ctx.font = "24px Arial, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(`LỚP: ${lop}`, width / 2, 80);

  if (!data || data.length === 0) {
    ctx.font = "bold 34px Arial, sans-serif";
    ctx.fillStyle = "#FF6B6B";
    ctx.fillText("Không có lịch học", width / 2, height / 2 - 20);
    ctx.font = "22px Arial, sans-serif";
    ctx.fillStyle = "#CCCCCC";
    ctx.fillText(
      `Tuần ${tuan} - Năm học ${CONFIG.namHoc}`,
      width / 2,
      height / 2 + 20,
    );

    const filePath = path.join(
      "./assets/temp",
      `lich_empty_${tuan}_${Date.now()}.png`,
    );
    await fs.mkdir("./assets/temp", { recursive: true });
    await fs.writeFile(filePath, canvas.toBuffer("image/png"));
    return filePath;
  }

  const startX = leftColWidth + 20;
  const startY = headerHeight + topRowHeight + 20;

  ctx.fillStyle = "#FFC107";
  ctx.font = "bold 20px Arial, sans-serif";
  for (let i = 0; i < 6; i++) {
    const x = startX + i * cellWidth;
    ctx.fillRect(x - 10, headerHeight + 10, cellWidth, topRowHeight - 20);
    ctx.fillStyle = "#000000";
    ctx.fillText(`Thứ ${i + 2}`, x + cellWidth / 2, headerHeight + 35);
    ctx.fillStyle = "#FFC107";
  }

  ctx.fillStyle = "#4CAF50";
  ctx.font = "bold 18px Arial, sans-serif";
  ["Sáng", "Chiều"].forEach((ca, row) => {
    const y = startY + row * cellHeight - 35;
    ctx.fillRect(10, y, leftColWidth - 20, 40);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(ca, leftColWidth / 2, y + 25);
    ctx.fillStyle = "#4CAF50";
  });

  const grid = Array(2)
    .fill()
    .map(() => Array(6).fill(null));
  data.forEach((item) => {
    if (item.thu >= 1 && item.thu <= 6) grid[item.ca][item.thu - 1] = item;
  });

  grid.forEach((row, r) => {
    row.forEach((item, c) => {
      if (!item) return;
      const x = startX + c * cellWidth;
      const y = startY + r * cellHeight;

      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.roundRect(x - 10, y - 10, cellWidth, cellHeight - 10, 12);
      ctx.fill();

      const lines = [item.tenMon, item.giangVien, item.phong, item.tiet];
      let py = y + 8;
      lines.forEach((line, i) => {
        const fontSize = i === 0 ? 16 : 14;
        ctx.font =
          i === 0 ? "bold 16px Arial, sans-serif" : "14px Arial, sans-serif";
        ctx.fillStyle = i === 0 ? "#FFFFFF" : "#B0BEC5";
        wrapText(ctx, line, x, py, cellWidth - 20, fontSize + 4);
        py += i === 0 ? 24 : 18;
      });
    });
  });

  const filePath = path.join(
    "./assets/temp",
    `lich_grid_${tuan}_${Date.now()}.png`,
  );
  await fs.mkdir("./assets/temp", { recursive: true });
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

async function clearFile(filePath) {
  setTimeout(async () => {
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error("Lỗi xóa file:", err.message);
    }
  }, 10000);
}

export async function handleLichHocGridCommand(api, message, args = []) {
  const threadId = message.threadId;
  const tuan = parseInt(args[0]) || CONFIG.defaultTuan;

  if (tuan < 1 || tuan > 52) {
    await api.sendMessage("Tuần phải từ 1-52!", threadId);
    return;
  }

  try {
    await api.sendMessage(`Đang lấy lịch tuần ${tuan}...`, threadId);

    if (!(await login())) {
      await api.sendMessage(
        "Không thể đăng nhập! (Tài khoản/mật khẩu sai hoặc bị khóa)",
        threadId,
      );
      return;
    }

    const result = await fetchLichHoc(tuan);
    if (!result) {
      await api.sendMessage(`Lỗi khi lấy dữ liệu tuần ${tuan}!`, threadId);
      return;
    }

    const imagePath = await drawGridImage(result, tuan);

    const caption =
      result.data.length === 0
        ? `Không có lịch học tuần ${tuan}`
        : `Lịch học tuần ${tuan} - Lớp ${result.lop} (${result.data.length} môn)`;

    await api.sendMessage(caption, threadId, {
      attachment: fs.createReadStream(imagePath),
      quote: message?.messageId || message?.id,
    });

    await clearFile(imagePath);
  } catch (err) {
    console.error("[handleLichHocGridCommand] Lỗi:", err);
    await api.sendMessage("Lỗi hệ thống! Vui lòng thử lại.", threadId);
  }
}

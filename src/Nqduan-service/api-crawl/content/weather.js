//src/Nqduan-service/api-crawl/content/weather.js
import fetch from "node-fetch";
import { getGlobalPrefix } from "../../service.js";
import { removeMention } from "../../../utils/format-util.js";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import { deleteFile } from "../../../utils/util.js";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register custom fonts
import { registerFont } from "canvas";
const fontPath = path.resolve("./assets/fonts");
registerFont(path.join(fontPath, "BeVietnamPro-Regular.ttf"), {
  family: "BeVietnamPro",
});
registerFont(path.join(fontPath, "BeVietnamPro-Bold.ttf"), {
  family: "BeVietnamPro",
  weight: "bold",
});
registerFont(path.join(fontPath, "NotoEmoji-Bold.ttf"), {
  family: "NotoEmoji",
});

const WEATHER_API_KEY = "2e0d6409939a436d97392547251709";

// =GACHA BACKGROUND FUNCTION
// ====================== //
/**
 * Lấy một đường dẫn ảnh .jpg ngẫu nhiên từ thư mục 'image'
 */
async function getRandomBackground() {
  try {
    const bgDir = path.resolve(__dirname, "image");
    // === THAY ĐỔI: Dùng fsPromises ===
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
// ====================== //
//    LỆNH CHÍNH         //
// ====================== //
export async function weatherCommand(api, message) {
  let imagePath = null;
  try {
    const prefix = getGlobalPrefix();
    const content = removeMention(message);
    const threadId = message.threadId;

    let location = content.replace(`${prefix}thoitiet`, "").trim();

    if (!location) {
      await api.sendMessage(
        {
          msg: `❗ Vui lòng nhập địa điểm cần tra cứu thời tiết.\nVí dụ: ${prefix}thoitiet hà nội`,
          quote: message,
          ttl: 6000,
        },
        threadId,
        message.type,
      );
      return;
    }

    const isHourly = location.toLowerCase().endsWith(" time");
    if (isHourly) location = location.slice(0, -5).trim();

    const displayLocation = location;
    const searchLocation = normalizeToPlainText(location);
    const encodedLocation = encodeURIComponent(searchLocation);

    // Lấy 3 ngày dự báo và dữ liệu AQI
    const url = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodedLocation}&days=3&lang=vi&aqi=yes`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();

    if (data.error) {
      await api.sendMessage(
        {
          msg: `❌ Không tìm thấy địa điểm: ${displayLocation}. Vui lòng kiểm tra lại.`,
          quote: message,
          ttl: 6000,
        },
        threadId,
        message.type,
      );
      return;
    }

    const tempDir = path.resolve("./assets/temp");
    // === THAY ĐỔI: Dùng fsPromises ===
    try {
      await fsPromises.access(tempDir);
    } catch {
      await fsPromises.mkdir(tempDir, { recursive: true });
      console.log("Đã tạo thư mục:", tempDir);
    }

    // Tạo ảnh thời tiết (isHourly sẽ quyết định vẽ ảnh nào)
    imagePath = await createWeatherImage(data, isHourly);
    console.log("Đã tạo ảnh tại:", imagePath);

    // Gửi ảnh (đã bỏ msg - caption)
    await api.sendMessage(
      {
        msg: "", // Bỏ text caption, chỉ gửi ảnh
        attachments: [imagePath],
        quote: message,
        ttl: 8460000,
      },
      threadId,
      message.type,
    );

    console.log("Đã gửi ảnh thời tiết");
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh thời tiết:", error);
    await api.sendMessage(
      {
        msg: "⚠️ Đã xảy ra lỗi lấy hoặc hiển thị thời tiết. Vui lòng thử lại sau.",
        quote: message,
        ttl: 6000,
      },
      message.threadId,
      message.type,
    );
  } finally {
    if (imagePath) {
      try {
        deleteFile(imagePath);
        console.log("Đã xóa file ảnh:", imagePath);
      } catch (err) {
        console.error("Lỗi khi xóa file ảnh:", err);
      }
    }
  }
}

// ====================== //
//    VẼ ẢNH THỜI TIẾT    //
// ====================== //

/**
 * HÀM PHỤ TRỢ: Vẽ một tấm nền (panel) trong suốt
 */
function drawPanel(ctx, x, y, width, height) {
  // === THAY ĐỔI: Đổi màu xám đậm hơn (35%) ===
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)"; // Đổi từ 0.2 -> 0.35
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 20); // Bo góc 20px
  ctx.fill();
}

export async function createWeatherImage(data = {}, isHourly = false) {
  const { location = {}, current = {}, forecast = {} } = data;
  const dailyForecasts = forecast.forecastday || [];
  const today = dailyForecasts[0] || {};
  const tomorrow = dailyForecasts[1] || {}; // Lấy ngày mai
  const astro = today.astro || {};

  // === SỬA LỖI TIMEZONE (1/2): Hoàn lại, dùng giờ MÁY CHỦ ===
  const currentHour = new Date().getHours();

  // Lấy 6 giờ tới (bắt đầu từ giờ tiếp theo)
  const allHours = (today.hour || []).concat(tomorrow.hour || []);
  const hours = allHours.slice(currentHour + 1, currentHour + 7); // Lấy 6 giờ, bắt đầu từ +1

  const width = 1080;
  const height = 1480;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Vẽ nền ngẫu nhiên
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
    drawCoverImage(ctx, bgImage, width, height);
  } else {
    ctx.fillStyle = "#4A90E2";
    ctx.fillRect(0, 0, width, height);
  }

  // --- TÙY CHỌN VẼ ---
  if (isHourly) {
    // (Chế độ xem theo giờ đã đúng font)
    let y = 150;
    ctx.font = "bold 36px BeVietnamPro, NotoEmoji"; // Font stack
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("DỰ BÁO THEO GIỜ", width / 2, y);
    y += 80;
    ctx.font = "bold 24px BeVietnamPro, NotoEmoji"; // Font stack
    ctx.textAlign = "left";
    (today.hour || []).slice(0, 24).forEach((h) => {
      if (y > height - 60) return;
      const time = h.time ? h.time.split(" ")[1] : "??:??";
      const temp = `${safe(h.temp_c)}°C`;
      const cond = safe(h.condition?.text);
      const hourEmoji = getConditionEmoji(h.condition?.text);
      const precip = safe(h.chance_of_rain);
      ctx.font = "32px NotoEmoji";
      ctx.fillText(hourEmoji, 40, y);
      ctx.font = "bold 24px BeVietnamPro";
      ctx.fillText(`${time} - ${cond} | ${temp} | 💧 ${precip}%`, 100, y);
      y += 60;
    });
  } else {
    // --- CHẾ ĐỘ DASHBOARD ---
    const mainMargin = 40;
    const panelPadding = 40;
    const panelGap = 30;
    const panelX = mainMargin;
    const panelWidth = width - mainMargin * 2;
    const contentLeft = panelX + panelPadding;
    const contentRight = panelX + panelWidth - panelPadding;
    const contentCenter = panelX + panelWidth / 2;
    const rightTextX = contentCenter + 40;
    let y = 40;

    // === SỬA LỖI: Khai báo iconOffset 1 lần ===
    const iconOffset = 40; // Khoảng cách giữa icon và text

    // === 1. PANEL HIỆN TẠI ===
    const panel1Height = 450;
    drawPanel(ctx, panelX, y, panelWidth, panel1Height);
    let y_panel1 = y + panelPadding;
    ctx.fillStyle = "#FFFFFF";
    const locationText = `${safe(location.name)}, ${safe(location.country)}`;
    const dateText = getShortDate(location.localtime);

    // === SỬA LỖI TIMEZONE (2/2): Dùng giờ máy chủ ===
    const timeText = getShortTime(new Date()); // Dùng new Date()

    // === SỬA LỖI FONT LINUX: Tách riêng icon và text ===
    ctx.font = "bold 44px BeVietnamPro";
    ctx.textAlign = "left";
    ctx.fillText(locationText, contentLeft, y_panel1 + 10);
    // === THAY ĐỔI: Dùng BeVietnamPro-Bold ===
    ctx.font = "bold 36px BeVietnamPro"; // Dùng BOLD
    ctx.fillText(dateText, contentLeft, y_panel1 + 65);
    ctx.font = "bold 36px BeVietnamPro";
    ctx.textAlign = "right";
    ctx.fillText(timeText, contentRight, y_panel1 + 10);
    y_panel1 += 100;
    const leftColX = contentLeft + panelWidth / 4 - 50;
    ctx.textAlign = "center";

    // === THAY ĐỔI: Lùi icon xuống 15px ===
    ctx.font = "100px NotoEmoji";
    ctx.fillText(
      getConditionEmoji(current.condition?.text),
      leftColX,
      y_panel1 + 75,
    ); // Lùi từ 60 -> 75
    // === THAY ĐỔI: Lùi Temp xuống 10px ===
    ctx.font = "bold 120px BeVietnamPro";
    ctx.fillText(`${safe(current.temp_c)}°`, leftColX, y_panel1 + 230); // Lùi từ 220 -> 230
    // === THAY ĐỔI: Lùi Cảm giác xuống 10px ===
    ctx.font = "bold 32px BeVietnamPro"; // Dùng BOLD
    ctx.fillText(
      `Cảm giác: ${safe(current.feelslike_c)}°`,
      leftColX,
      y_panel1 + 300,
    ); // Lùi từ 290 -> 300

    // --- SỬA LỖI FONT: Cột phải panel 1 ---
    ctx.textAlign = "left";
    // === THAY ĐỔI: Lùi yRight để khớp với icon ===
    let yRight = y_panel1 + 75; // Lùi từ 60 -> 75
    // (Xóa khai báo 'const iconOffset' ở đây)

    // Gió
    ctx.font = "30px NotoEmoji";
    ctx.fillText("💨", rightTextX, yRight);
    ctx.font = "bold 30px BeVietnamPro";
    ctx.fillText(
      `Gió: ${safe(current.wind_dir)} ${safe(current.wind_kph)} km/h`,
      rightTextX + iconOffset,
      yRight,
    );
    yRight += 55;

    // Gió giật
    ctx.font = "30px NotoEmoji";
    ctx.fillText("🌬️", rightTextX, yRight); // (Emoji này có thể cần NotoEmoji)
    ctx.font = "bold 30px BeVietnamPro";
    ctx.fillText(
      `Gió giật: ${safe(current.gust_kph)} km/h`,
      rightTextX + iconOffset,
      yRight,
    );
    yRight += 55;

    // AQI
    const aqiData = current.air_quality;
    const aqiIndex = aqiData ? aqiData["us-epa-index"] : null;
    const aqiText = getAqiDescription(aqiIndex);
    ctx.font = "30px NotoEmoji";
    ctx.fillText("🍃", rightTextX, yRight);
    ctx.font = "bold 30px BeVietnamPro";
    ctx.fillText(`AQI: ${aqiText}`, rightTextX + iconOffset, yRight);
    yRight += 55;

    // Tầm nhìn
    ctx.font = "30px NotoEmoji";
    ctx.fillText("👁️", rightTextX, yRight);
    ctx.font = "bold 30px BeVietnamPro";
    ctx.fillText(
      `Tầm nhìn: ${safe(current.vis_km)} km`,
      rightTextX + iconOffset,
      yRight,
    );

    y += panel1Height + panelGap;

    // === 2. PANEL DỰ BÁO HÀNG GIỜ ===
    const panel2Height = 260;
    drawPanel(ctx, panelX, y, panelWidth, panel2Height);

    let y_panel2 = y + 40; // y-start (40px padding)
    const vGap = 60; // Khoảng cách dọc

    ctx.textAlign = "center";

    const hourlyWidth = (panelWidth - panelPadding * 2) / hours.length; // 6 giờ
    let hourlyX = contentLeft + hourlyWidth / 2;

    hours.forEach((h) => {
      const time = h.time ? h.time.split(" ")[1].split(":")[0] + "h" : "??h";
      const emoji = getConditionEmoji(h.condition?.text);
      const temp = `${safe(h.temp_c)}°`;
      const humidity = safe(h.humidity);

      ctx.fillStyle = "#FFFFFF";

      // === SẮP XẾP LẠI THỨ TỰ (4 Dòng) ===

      // Dòng 1: Giờ (y=40)
      ctx.font = "bold 32px BeVietnamPro";
      ctx.textAlign = "center";
      ctx.fillText(time, hourlyX, y_panel2);

      // Dòng 2: Icon Thời tiết (y=40 + 60 = 100)
      ctx.font = "48px NotoEmoji";
      ctx.textAlign = "center";
      ctx.fillText(emoji, hourlyX, y_panel2 + vGap);

      // Dòng 3: Nhiệt độ (y=100 + 60 = 160)
      ctx.font = "bold 32px BeVietnamPro";
      ctx.textAlign = "center";
      ctx.fillText(temp, hourlyX, y_panel2 + vGap * 2);

      // Dòng 4: Độ ẩm (y=160 + 60 = 220)
      // === SỬA LỖI FONT LINUX (PANEL 2) ===
      const humidityText = `${humidity}%`;
      const yPosHumidity = y_panel2 + vGap * 3;
      const gapHumidity = 5;

      // 1. Đo text
      ctx.font = "bold 32px BeVietnamPro";
      const textWidth = ctx.measureText(humidityText).width;

      // 2. Đo icon
      ctx.font = "32px NotoEmoji";
      ctx.fillText("", 0, 0); // (Dummy call để set font)
      const iconWidth = ctx.measureText("💦").width; // <<< SỬA TỪ 💧 THÀNH 💦

      // 3. Tính toán (Căn lề phải)
      const totalWidth = iconWidth + gapHumidity + textWidth;
      const colRightEdge = hourlyX + hourlyWidth / 2 - 10; // Lề phải cột
      let startX = colRightEdge - totalWidth;

      // 4. Vẽ icon
      ctx.font = "32px NotoEmoji"; // Đảm bảo đúng font
      ctx.fillText("💦", startX, yPosHumidity); // <<< SỬA TỪ 💧 THÀNH 💦

      // 5. Vẽ text
      ctx.font = "bold 32px BeVietnamPro";
      ctx.textAlign = "left"; // Căn trái để vẽ sau icon
      ctx.fillText(
        humidityText,
        startX + iconWidth + gapHumidity,
        yPosHumidity,
      );

      hourlyX += hourlyWidth;
    });
    y += panel2Height + panelGap;

    // === 3. PANEL THIÊN VĂN & ĐỘ ẨM ===
    const panel3Height = 300;
    drawPanel(ctx, panelX, y, panelWidth, panel3Height);
    let y_panel3 = y + panelPadding + 10;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    const col1X = contentLeft + 120;
    const col2X = contentCenter - 80;
    ctx.font = "50px NotoEmoji";
    ctx.fillText("☀️", col1X, y_panel3 + 20);
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillText("Mặt trời", col1X, y_panel3 + 90);
    ctx.font = "bold 30px BeVietnamPro"; // Dùng BOLD
    ctx.fillText(
      `Mọc: ${convertTo24Hour(safe(astro.sunrise))}`,
      col1X,
      y_panel3 + 140,
    );
    ctx.fillText(
      `Lặn: ${convertTo24Hour(safe(astro.sunset))}`,
      col1X,
      y_panel3 + 180,
    );
    ctx.font = "50px NotoEmoji";
    ctx.fillText("🌙", col2X, y_panel3 + 20);
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillText("Mặt trăng", col2X, y_panel3 + 90);
    ctx.font = "bold 30px BeVietnamPro"; // Dùng BOLD
    ctx.fillText(
      `Mọc: ${convertTo24Hour(safe(astro.moonrise))}`,
      col2X,
      y_panel3 + 140,
    );
    ctx.fillText(
      `Lặn: ${convertTo24Hour(safe(astro.moonset))}`,
      col2X,
      y_panel3 + 180,
    );

    // --- SỬA LỖI FONT: Cột phải panel 3 ---
    ctx.textAlign = "left";
    yRight = y + panelPadding + 30;
    // (Xóa khai báo 'const iconOffset' ở đây)

    // Mưa
    ctx.font = "30px NotoEmoji";
    ctx.fillText("💧", rightTextX, yRight);
    ctx.font = "bold 30px BeVietnamPro";
    ctx.fillText(
      `Mưa (hôm nay): ${safe(today.day?.totalprecip_mm, 0)} mm`,
      rightTextX + iconOffset,
      yRight,
    );
    yRight += 55;

    // Khả năng mưa
    ctx.font = "30px NotoEmoji";
    ctx.fillText("☔", rightTextX, yRight);
    ctx.font = "bold 30px BeVietnamPro";
    ctx.fillText(
      `Khả năng mưa: ${safe(today.day?.daily_chance_of_rain)}%`,
      rightTextX + iconOffset,
      yRight,
    );
    yRight += 55;

    // Độ ẩm
    ctx.font = "30px NotoEmoji";
    ctx.fillText("💦", rightTextX, yRight);
    ctx.font = "bold 30px BeVietnamPro";
    ctx.fillText(
      `Độ ẩm: ${safe(current.humidity)}%`,
      rightTextX + iconOffset,
      yRight,
    );
    yRight += 55;

    // UV Index
    ctx.font = "30px NotoEmoji";
    ctx.fillText("☀️", rightTextX, yRight);
    ctx.font = "bold 30px BeVietnamPro";
    ctx.fillText(
      `UV Index: ${safe(current.uv)}`,
      rightTextX + iconOffset,
      yRight,
    );

    y += panel3Height + panelGap;

    // === 4. PANEL DỰ BÁO 3 NGÀY ===
    const panel4Height = 300;
    drawPanel(ctx, panelX, y, panelWidth, panel4Height);
    let y_panel4 = y + 60;

    const colDay = contentLeft;
    const colEmoji = contentLeft + 300;
    const colTemp = contentCenter + 150;
    const colPrecip = contentRight;
    dailyForecasts.forEach((dayData, index) => {
      if (y_panel4 > y + panel4Height - 40) return;
      const dayName = formatDayName(dayData.date, index);
      const maxT = safe(dayData.day.maxtemp_c);
      const minT = safe(dayData.day.mintemp_c);
      const precip = safe(dayData.day.daily_chance_of_rain);
      const emoji = getConditionEmoji(dayData.day.condition?.text);
      ctx.fillStyle = "#FFFFFF";

      ctx.font = "bold 32px BeVietnamPro";
      ctx.textAlign = "left";
      ctx.fillText(dayName, colDay, y_panel4);

      ctx.font = "40px NotoEmoji";
      ctx.textAlign = "center";
      ctx.fillText(emoji, colEmoji, y_panel4);

      ctx.font = "bold 32px BeVietnamPro";
      ctx.textAlign = "right";
      ctx.fillText(`${maxT}° / ${minT}°`, colTemp, y_panel4);

      // --- SỬA LỖI FONT LINUX (PANEL 4) ---
      const precipText = `${precip}%`;
      const yPosPrecip = y_panel4;
      const gapPrecip = 5;

      // 1. Đo text
      ctx.font = "bold 32px BeVietnamPro";
      const precipTextWidth = ctx.measureText(precipText).width;

      // 2. Đo icon
      ctx.font = "32px NotoEmoji";
      const precipIconWidth = ctx.measureText("💧").width;

      // 3. Tính toán (Căn lề phải)
      const totalPrecipWidth = precipIconWidth + gapPrecip + precipTextWidth;
      let startXPrecip = colPrecip - totalPrecipWidth; // colPrecip là lề phải

      // 4. Vẽ icon
      ctx.fillText("💧", startXPrecip, yPosPrecip);

      // 5. Vẽ text
      ctx.font = "bold 32px BeVietnamPro";
      ctx.textAlign = "left"; // Căn trái
      ctx.fillText(
        precipText,
        startXPrecip + precipIconWidth + gapPrecip,
        yPosPrecip,
      );

      y_panel4 += 75;
    });
  }

  // --- Kết thúc vẽ ---

  const filePath = path.resolve(`./assets/temp/weather_${Date.now()}.png`);

  // === THAY ĐỔI: Dùng fs.createWriteStream (từ 'fs' đồng bộ) ===
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => {
      console.log("Hoàn tất tạo file ảnh:", filePath);
      resolve(filePath);
    });
    out.on("error", (err) => {
      console.error("Lỗi khi tạo file ảnh:", err);
      reject(err);
    });
  });
}

// === THÊM MỚI: Hàm cho Scheduler ===
export async function generateWeatherImageForTask(api, location) {
  let imagePath = null;
  try {
    if (!location) {
      return { imagePath: null, error: "Vị trí chưa được cài đặt." };
    }

    // Sử dụng các hàm đã có trong weather.js
    const searchLocation = normalizeToPlainText(location);
    const encodedLocation = encodeURIComponent(searchLocation);

    const url = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodedLocation}&days=3&lang=vi&aqi=yes`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Không tìm thấy địa điểm: ${location}`);
    }

    // Gọi hàm vẽ (isHourly = false)
    imagePath = await createWeatherImage(data, false);

    return { imagePath: imagePath, error: null };
  } catch (error) {
    console.error(`[generateWeatherImageForTask] Lỗi: ${error.message}`);
    if (imagePath) {
      // Dùng fsPromises (đã import ở đầu file)
      await fsPromises.unlink(imagePath).catch(() => {});
    }
    return { imagePath: null, error: error.message };
  }
}

// ====================== //
//      HÀM PHỤ TRỢ      //
// ====================== //

function convertTo24Hour(timeStr) {
  if (!timeStr || timeStr === "—") return "—";
  try {
    let [time, modifier] = timeStr.split(" ");
    if (!modifier) return timeStr; // Nếu đã là 24h (ví dụ: 14:15)

    let [hours, minutes] = time.split(":");

    if (hours === "12") {
      hours = "00";
    }
    if (modifier.toUpperCase() === "PM") {
      hours = parseInt(hours, 10) + 12;
    }
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  } catch (e) {
    return timeStr; // Trả về gốc nếu lỗi
  }
}

function getShortTime(dateTimeStr) {
  if (!dateTimeStr) return "--:--";
  // === SỬA LỖI TIMEZONE: Hoàn lại, dùng giờ MÁY CHỦ ===
  const serverDate = new Date(); // Lấy giờ server hiện tại
  const hours = serverDate.getHours().toString().padStart(2, "0");
  const minutes = serverDate.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getShortDate(dateTimeStr) {
  if (!dateTimeStr) return "DD/MM/YYYY";
  const date = new Date(dateTimeStr);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Hàm này dùng cho dự báo 3 ngày
function formatDayName(dateStr, index) {
  if (index === 0) return "H.nay";

  try {
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay(); // 0 = CN, 1 = T2...
    const days = ["CN", "T 2", "T 3", "T 4", "T 5", "T 6", "T 7"];
    return days[dayOfWeek];
  } catch {
    return "N.sau";
  }
}

function getAqiDescription(index) {
  if (index === null || typeof index === "undefined") return "Không rõ";
  switch (index) {
    case 1:
      return "Tốt";
    case 2:
      return "Vừa phải";
    case 3:
      return "Kém (nhạy cảm)";
    case 4:
      return "Xấu";
    case 5:
      return "Rất xấu";
    case 6:
      return "Nguy hại";
    default:
      return "Không rõ";
  }
}

function safe(value, fallback = "—") {
  if (value === null || typeof value === "undefined" || value === "")
    return fallback;
  return value;
}

// === THAY ĐỔI: Hoàn lại (Revert) Emojis về file gốc của bạn ===
const weatherEmojis = {
  unknown: "\u2753", // ❓
  sunny: "\u2600\uFE0F", // ☀️
  rain: "\u2614\uFE0F", // ☔️
  cloud: "\u2601\uFE0F", // ☁️
  fog: "\u2601\uFE0F", // ☁️ (thay thế cho sương mù)
  snow: "\u2744\uFE0F", // ❄️
  thunder: "\u26C8\uFE0F", // ⛈️
  hot: "\u2600\uFE0F", // ☀️ (thay thế cho nóng)
  cold: "\u2744\uFE0F", // ❄️ (thay thế cho lạnh)
  default: "\u2600\uFE0F", // ☀️
};

function getConditionEmoji(condition) {
  if (!condition) return weatherEmojis.unknown;
  const conditionLower = condition.toLowerCase();

  // === THAY ĐỔI: Sửa lỗi logic, ưu tiên Giông/Tuyết/Sương mù ===
  if (conditionLower.includes("nắng")) return weatherEmojis.sunny;

  // 1. Ưu tiên các trường hợp đặc biệt
  if (conditionLower.includes("giông") || conditionLower.includes("sấm"))
    return weatherEmojis.thunder; // ⛈️
  if (conditionLower.includes("tuyết")) return weatherEmojis.snow; // ❄️
  if (conditionLower.includes("sương mù")) return weatherEmojis.fog; // ☁️ (Giống mây)

  // 2. Mưa (nếu không phải giông/tuyết)
  if (conditionLower.includes("mưa")) return weatherEmojis.rain; // ☔️

  // 3. Mây (nếu không phải các trường hợp trên)
  if (conditionLower.includes("mây")) return weatherEmojis.cloud; // ☁️

  // 4. Nóng/Lạnh
  if (conditionLower.includes("nóng")) return weatherEmojis.hot; // ☀️
  if (conditionLower.includes("lạnh")) return weatherEmojis.cold; // ❄️

  // Kiểm tra các trường hợp cụ thể hơn (API tiếng Việt)
  if (conditionLower.includes("quang")) return weatherEmojis.sunny; // Trời quang

  return weatherEmojis.default; // ☀️
}
// === HẾT THAY ĐỔI EMOJI ===

function normalizeToPlainText(str) {
  if (!str) return "";
  let out = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  out = out.replace(/đ/g, "d").replace(/Đ/g, "D");
  out = out.replace(/[^\w\s-]/g, "");
  out = out.replace(/\s+/g, " ").trim().toLowerCase();
  return out;
}

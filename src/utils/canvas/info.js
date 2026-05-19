import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import * as cv from "./index.js";
import { formatCurrency } from "../format-util.js";


export function hanldeNameUser(name) {
  const words = name.split(" ");
  let line1 = "";
  let line2 = "";

  if (name.length <= 16) {
    return [name, ""];
  }

  if (words.length === 1) {
    line1 = name.substring(0, 16);
    line2 = name.substring(16);
  } else {
    for (let i = 0; i < words.length; i++) {
      if ((line1 + " " + words[i]).trim().length <= 16) {
        line1 += (line1 ? " " : "") + words[i];
      } else {
        line2 = words.slice(i).join(" ");
        break;
      }
    }
  }

  return [line1.trim(), line2.trim()];
}

export function handleNameLong(name, lengthLine = 16) {
  const words = name.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= lengthLine) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) {
        lines.push(currentLine.trim());
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  if (lines.length === 0) {
    lines.push(name);
  }

  return {
    lines: lines,
    totalLines: lines.length,
  };
}

function drawBox(ctx, x, y, w, h, title) {
  const boxGradient = ctx.createLinearGradient(x, y, x, y + h);
  boxGradient.addColorStop(0, "rgba(0, 0, 0, 0.55)");
  boxGradient.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  ctx.fillStyle = boxGradient;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  const titleGradient = ctx.createLinearGradient(x, y, x + w, y);
  titleGradient.addColorStop(0, "#4ECB71");
  titleGradient.addColorStop(1, "#1E90FF");
  ctx.fillStyle = titleGradient;
  ctx.font = "bold 36px BeVietnamPro";
  ctx.textAlign = "center";
  ctx.fillText(title, x + w / 2, y + 45);
}

function drawVerticalDivider(ctx, x, y, h) {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 60);
  ctx.lineTo(x, y + h - 60);
  ctx.stroke();
}

function measureTextWidth(ctx, text, font) {
  ctx.font = font;
  return ctx.measureText(text).width;
}

// Tạo Hình Lệnh !Info
export async function createUserInfoImage(userInfo) {
  const [nameLine1, nameLine2] = hanldeNameUser(userInfo.name);
  const width = 1000;
  let yTemp = 400;
  const lineBio = 35;

  // Thêm bio vào giữa bức ảnh
  if (userInfo.bio !== "Không có thông tin bio") {
    const bioLines = [...userInfo.bio.split("\n")];
    const lineHeight = lineBio;
    yTemp += 20;

    bioLines.forEach((line, index) => {
      const { lines, totalLines } = handleNameLong(line, 56);
      yTemp += lineHeight * totalLines;
    });
  }

  yTemp += 30;
  const height = yTemp > 430 ? yTemp : 430;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (userInfo.cover && cv.isValidUrl(userInfo.cover)) {
    try {
      const cover = await loadImage(userInfo.cover);
      ctx.drawImage(cover, 0, 0, width, height);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, width, height);

    } catch (error) {
      console.error("Lỗi load cover:", error);
      const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
      backgroundGradient.addColorStop(0, "#3B82F6");
      backgroundGradient.addColorStop(1, "#111827");
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    // Nếu Không có cover, sử dụng gradient mặc định
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
    backgroundGradient.addColorStop(0, "#3B82F6");
    backgroundGradient.addColorStop(1, "#111827");
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, width, height);
  }

  let xAvatar = 170;
  let widthAvatar = 180;
  let heightAvatar = 180;
  let yAvatar = 100; // Đặt yAvatar cố định là 100
  let yA1 = height / 2 - heightAvatar / 2 - yAvatar; // Tính toán lại yA1

  if (userInfo && cv.isValidUrl(userInfo.avatar)) {
    try {
      const avatar = await loadImage(userInfo.avatar);

      // Vẽ vòng tròn 7 màu cầu vồng
      const borderWidth = 10;
      const gradient = ctx.createLinearGradient(
        xAvatar - widthAvatar / 2 - borderWidth,
        yAvatar - borderWidth,
        xAvatar + widthAvatar / 2 + borderWidth,
        yAvatar + heightAvatar + borderWidth
      );

      const rainbowColors = [
        "#FF0000", // Đỏ
        "#FF7F00", // Cam
        "#FFFF00", // Vàng
        "#00FF00", // Lục
        "#0000FF", // Lam
        "#4B0082", // Chàm
        "#9400D3", // Tím
      ];

      // Xáo trộn mảng màu sắc
      const shuffledColors = [...rainbowColors].sort(() => Math.random() - 0.5);

      // Thêm các màu vào gradient
      shuffledColors.forEach((color, index) => {
        gradient.addColorStop(index / (shuffledColors.length - 1), color);
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2 + borderWidth,
        0,
        Math.PI * 2,
        true
      );
      ctx.fillStyle = gradient;
      ctx.fill();

      // Vẽ avatar
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2,
        0,
        Math.PI * 2,
        true
      );
      ctx.clip();
      ctx.drawImage(
        avatar,
        xAvatar - widthAvatar / 2,
        yAvatar,
        widthAvatar,
        heightAvatar
      );
      ctx.restore();

      // Vẽ chấm trạng thái
      const dotSize = 26;
      const dotX = xAvatar + widthAvatar / 2 - dotSize / 2;
      const dotY = yAvatar + heightAvatar - dotSize / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
      if (userInfo.isOnline) {
        ctx.fillStyle = "#00FF00"; // Màu xanh lá cây cho trạng thái hoạt động
      } else {
        ctx.fillStyle = "#808080"; // Màu xám cho trạng thái Không hoạt động
      }
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Vẽ tên người dùng dưới avatar
      ctx.font = "bold 32px Tahoma";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      const nameY = yAvatar + heightAvatar + 54;
      if (nameLine2) {
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine1, xAvatar, nameY);
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine2, xAvatar, nameY + 28);
      } else {
        ctx.fillText(nameLine1, xAvatar, nameY);
      }

      // Vẽ các biểu tượng
      const iconSize = 24;
      const iconSpacing = 10;
      const icons = [];

      if (userInfo.isActive) icons.push("📱");
      if (userInfo.isActivePC) icons.push("💻");
      if (userInfo.isActiveWeb) icons.push("🌐");

      const totalWidth =
        icons.length * iconSize + (icons.length - 1) * iconSpacing;
      const iconsY = nameY + (nameLine2 ? 68 : 40); // Đặt biểu tượng cách tên 40px

      ctx.font = `${iconSize}px Arial`;
      icons.forEach((icon, index) => {
        const x =
          xAvatar + (index - (icons.length - 1) / 2) * (iconSize + iconSpacing);
        ctx.fillText(icon, x, iconsY);
      });
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  let y1 = 60;

  ctx.textAlign = "center";
  ctx.font = "bold 48px BeVietnamPro";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText(userInfo.title, width / 2, y1);

  // Sau khi vẽ tên và biểu tượng
  // const nameWidth = ctx.measureText(nameLine1).width;
  const infoStartX = xAvatar + widthAvatar / 2 + 86;

  ctx.textAlign = "left";
  let y = y1 + 60;

  const fields = [
    { label: "🆔 Username", value: userInfo.username },
    { label: "🎂 Ngày sinh", value: userInfo.birthday },
    { label: "🧑‍🤝‍🧑 Giới tính", value: userInfo.gender },
    { label: "💼 Tài khoản Business", value: userInfo.businessType },
    { label: "📅 Ngày tạo tài khoản", value: userInfo.createdDate },
    { label: "🕰️ Lần cuối hoạt động", value: userInfo.lastActive },
  ];

  ctx.font = "bold 28px BeVietnamPro";
  for (const field of fields) {
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    const labelText = field.label + ":";
    const labelWidth = ctx.measureText(labelText).width;
    ctx.fillText(labelText, infoStartX, y);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(" " + field.value, infoStartX + labelWidth, y);
    y += 52;
  }

  if (userInfo.bio !== "Không có thông tin bio") {
    ctx.textAlign = "center";

    ctx.beginPath();
    ctx.moveTo(width * 0.05, y - 20);
    ctx.lineTo(width * 0.95, y - 20);
    ctx.strokeStyle = "rgba(255, 255, 255)";
    ctx.lineWidth = 2;
    ctx.stroke();

    y += 25;
    const bioLines = [...userInfo.bio.split("\n")];

    bioLines.forEach((line, index) => {
      const { lines } = handleNameLong(line, 56);
      for (const line of lines) {
        const lineGradient = cv.getRandomGradient(ctx, width);
        ctx.fillStyle = lineGradient;

        ctx.fillText(line, width / 2, y);
        y += lineBio;
      }
    });
  }

  const filePath = path.resolve(`./assets/temp/user_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

// Tạo Hình Card Game
export async function createUserCardGame(playerInfo) {
  const [nameLine1, nameLine2] = cv.hanldeNameUser(playerInfo.playerName);
  const width = 1080;

  const height = 535;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  cv.drawDynamicGradientBackground(ctx, width, height);
  cv.drawAnimatedBackground(ctx, width, height);

  let xAvatar = 180;
  let widthAvatar = 180;
  let heightAvatar = 180;
  let yAvatar = 100; // Đặt yAvatar cố định là 100
  let yA1 = height / 2 - heightAvatar / 2 - yAvatar; // Tính toán lại yA1

  if (playerInfo && cv.isValidUrl(playerInfo.avatar)) {
    try {
      const avatar = await loadImage(playerInfo.avatar);

      // Vẽ vòng tròn 7 màu cầu vồng
      const borderWidth = 10;
      const gradient = ctx.createLinearGradient(
        xAvatar - widthAvatar / 2 - borderWidth,
        yAvatar - borderWidth,
        xAvatar + widthAvatar / 2 + borderWidth,
        yAvatar + heightAvatar + borderWidth
      );

      const rainbowColors = [
        "#FF0000", // Đỏ
        "#FF7F00", // Cam
        "#FFFF00", // Vàng
        "#00FF00", // Lục
        "#0000FF", // Lam
        "#4B0082", // Chàm
        "#9400D3", // Tím
      ];

      // Xáo trộn mảng màu sắc
      const shuffledColors = [...rainbowColors].sort(() => Math.random() - 0.5);

      // Thêm các màu vào gradient
      shuffledColors.forEach((color, index) => {
        gradient.addColorStop(index / (shuffledColors.length - 1), color);
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2 + borderWidth,
        0,
        Math.PI * 2,
        true
      );
      ctx.fillStyle = gradient;
      ctx.fill();

      // Thêm hiệu ứng bóng mờ màu trắng xung quanh avatar
      ctx.shadowColor = "rgba(255, 255, 255, 0.5)"; // Màu trắng với độ trong suốt
      ctx.shadowBlur = 20; // Độ mờ của bóng
      ctx.shadowOffsetX = 0; // Không có độ lệch theo chiều ngang
      ctx.shadowOffsetY = 0; // Không có độ lệch theo chiều dọc

      // Vẽ avatar
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2,
        0,
        Math.PI * 2,
        true
      );
      ctx.clip();
      ctx.drawImage(
        avatar,
        xAvatar - widthAvatar / 2,
        yAvatar,
        widthAvatar,
        heightAvatar
      );
      ctx.restore();

      // Giữ lại hiệu ứng bóng mờ chỉ xung quanh avatar
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      // Vẽ chấm trạng thái
      const dotSize = 26;
      const dotX = xAvatar + widthAvatar / 2 - dotSize / 2;
      const dotY = yAvatar + heightAvatar - dotSize / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
      if (playerInfo.isOnline) {
        ctx.fillStyle = "#00FF00"; // Màu xanh lá cây cho trạng thái hoạt động
      } else {
        ctx.fillStyle = "#808080"; // Màu xám cho trạng thái Không hoạt động
      }
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Vẽ tên người dùng dưới avatar
      ctx.font = "bold 32px Tahoma";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      const nameY = yAvatar + heightAvatar + 54;
      if (nameLine2) {
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine1, xAvatar, nameY);
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine2, xAvatar, nameY + 28);
      } else {
        ctx.fillText(nameLine1, xAvatar, nameY);
      }

      // Thêm hiệu ứng gradient cho tên người dùng
      const nameGradient = ctx.createLinearGradient(
        xAvatar,
        nameY,
        xAvatar,
        nameY + 30
      );
      nameGradient.addColorStop(0, "#ff4b1f");
      nameGradient.addColorStop(1, "#1fddff");
      ctx.fillStyle = nameGradient;

      // Thêm khung và hiệu ứng cho avatar
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      // Vẽ các biểu tượng
      const iconSize = 24;
      const iconSpacing = 10;
      const icons = [];

      if (playerInfo.isActive) icons.push("📱");
      if (playerInfo.isActivePC) icons.push("💻");
      if (playerInfo.isActiveWeb) icons.push("🌐");
      const iconsY = nameY + (nameLine2 ? 68 : 40); // Đặt biểu tượng cách tên 40px

      ctx.font = `${iconSize}px Arial`;
      icons.forEach((icon, index) => {
        const x =
          xAvatar + (index - (icons.length - 1) / 2) * (iconSize + iconSpacing);
        ctx.fillText(icon, x, iconsY);
      });
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  let y1 = 60;

  ctx.textAlign = "center";
  ctx.font = "bold 48px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText(playerInfo.title, width / 2, y1);

  // Sau khi vẽ tên và biểu tượng
  const nameWidth = ctx.measureText(nameLine1).width;
  const infoStartX = Math.max(
    xAvatar + widthAvatar / 2 + 60,
    xAvatar + nameWidth / 2 - 20
  );

  ctx.textAlign = "left";
  let y = y1 + 45;

  // Danh sách các trường thông tin cần hiển thị
  const fields = [
    { label: "🆔 Tên Đăng Nhập", value: playerInfo.account },
    // { label: "🧑‍🤝‍🧑 Giới tính", value: playerInfo.gender },
    {
      label: "💰 Số Dư Hiện Tại",
      value: formatCurrency(playerInfo.balance) + " VNĐ",
    },
    {
      label: "🏆 Tổng Thắng",
      value: formatCurrency(playerInfo.totalWinnings) + " VNĐ",
    },
    {
      label: "💸 Tổng Thua",
      value: formatCurrency(playerInfo.totalLosses) + " VNĐ",
    },
    {
      label: "💹 Lợi Nhuận Ròng",
      value: formatCurrency(playerInfo.netProfit) + " VNĐ",
    },
    {
      label: "🎮 Số Lượt Chơi",
      value:
        playerInfo.totalGames +
        " Games " +
        "(" +
        playerInfo.totalWinGames +
        "W/" +
        (playerInfo.totalGames - playerInfo.totalWinGames) +
        "L)",
    },
    { label: "📊 Tỉ Lệ Thắng", value: playerInfo.winRate + "%" },
    { label: "📅 Created Time", value: playerInfo.registrationTime },
    { label: "🎁 Nhận Quà Daily", value: playerInfo.lastDailyReward },
  ];

  ctx.font = "bold 28px Tahoma";
  for (const field of fields) {
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    const labelText = field.label + ":";
    const labelWidth = ctx.measureText(labelText).width;
    ctx.fillText(labelText, infoStartX, y);

    if (field.label === "📊 Tỉ Lệ Thắng") {
      // Vẽ thanh trạng thái cho t�� lệ thắng
      const barWidth = 200; // Chiều dài tối đa của thanh trạng thái
      const winRate = parseFloat(field.value); // Giả sử field.value là chuỗi "50%"
      const filledWidth = (winRate / 100) * barWidth; // Tính toán chiều dài đã điền của thanh

      // Tạo gradient nhẹ nhàng cho thanh trạng thái
      const barGradient = ctx.createLinearGradient(
        infoStartX + labelWidth,
        y - 20,
        infoStartX + labelWidth + barWidth,
        y
      );
      barGradient.addColorStop(0, "#b8e994"); // Màu xanh nhạt
      barGradient.addColorStop(0.5, "#96e6a1"); // Màu xanh lá nhạt
      barGradient.addColorStop(1, "#b8e994"); // Màu xanh nhạt

      // Vẽ thanh nền với góc bo tròn
      ctx.fillStyle = "#ddd"; // Màu nền của thanh
      cv.roundRect(
        ctx,
        infoStartX + labelWidth + 20,
        y - 20,
        barWidth,
        20,
        5,
        true,
        false
      );

      // Vẽ phần đã điền của thanh với gradient và góc bo tròn
      ctx.fillStyle = barGradient;
      cv.roundRect(
        ctx,
        infoStartX + labelWidth + 20,
        y - 20,
        filledWidth,
        20,
        5,
        true,
        false
      );

      // Hiển thị phần trăm bên phải thanh trạng thái
      ctx.fillStyle = "#fff"; // Màu chữ
      ctx.fillText(field.value, infoStartX + labelWidth + 30 + barWidth + 5, y); // Vị trí hiển thị phần trăm
    } else {
      // Vẽ giá trị thông thường cho các trường khác
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(" " + field.value, infoStartX + labelWidth, y);
    }

    y += 42; // Tăng y cho trường tiếp theo
  }

  ctx.beginPath();
  ctx.moveTo(width * 0.05, y - 20);
  ctx.lineTo(width * 0.95, y - 20);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();
  y += 20; // Tăng y cho trường tiếp theo

  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.textAlign = "center";
  ctx.fillText("Chúc Bạn 8386 | Mãi Đỉnh Mãi Đỉnh", width / 2, y);

  const filePath = path.resolve(`./assets/temp/user_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

export async function createBotInfoImage(botInfo, uptime, botStats, onConfigs, offConfigs) {
  const width = 1400;
  const height = 900;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  /** Background **/
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, "#0f1117");
  bgGrad.addColorStop(1, "#1a1f2c");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  /** Box vẽ chung **/
  function drawBox(x, y, w, h, title) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    roundedRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,229,255,0.15)";
    ctx.lineWidth = 2;
    roundedRect(ctx, x, y, w, h, 16);
    ctx.stroke();
    ctx.restore();

    ctx.font = "bold 24px Tahoma";
    ctx.fillStyle = "#00E5FF";
    ctx.textAlign = "center";
    ctx.fillText(title, x + w / 2, y + 34);

    ctx.beginPath();
    ctx.moveTo(x + 15, y + 46);
    ctx.lineTo(x + w - 15, y + 46);
    ctx.strokeStyle = "rgba(0,229,255,0.25)";
    ctx.stroke();

    ctx.textAlign = "left";
  }

  /** Left column **/
  const leftX = 60;
  const boxW = width / 2 - 100;
  const boxH = 200;
  let currentY = 60;

  // System Info
drawBox(leftX, currentY, boxW, 200, "⚙️ System Info");
ctx.font = "16px Tahoma";
ctx.fillStyle = "#FFF";
let y = currentY + 70;

const sysInfo = [
  `Phiên bản: ${botStats.version}`,
  `Bộ nhớ bot: ${botStats.memoryUsage}`,
  `Hệ điều hành: ${botStats.os}`,
  `CPU: ${botStats.cpuModel}`,
  `CPU Usage: ${botStats.cpu}`
];

sysInfo.forEach(t => {
  y = drawWrappedText(ctx, t, leftX + 20, y, boxW - 40, 22);
});
currentY += 200 + 25;

// Resource Usage
drawBox(leftX, currentY, boxW, 150, "📊 Resource Usage");
ctx.font = "16px Tahoma";
ctx.fillStyle = "#FFF";
y = currentY + 70;

const resInfo = [
  `CPU Temp: ${botStats.cpuTemp || "N/A"}`,
  `RAM: ${botStats.ram}`,
  `Disk: ${botStats.disk}`
];

resInfo.forEach(t => {
  y = drawWrappedText(ctx, t, leftX + 20, y, boxW - 40, 22);
});
currentY += 150 + 25;

  // 🕒 Thời gian hiện tại
drawBox(leftX, currentY, boxW, 180, "🕒 Thời gian hiện tại");
y = currentY + 75;

const now = new Date();
const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });
const dateStr = now.toLocaleDateString("vi-VN");

// Lấy thứ trong tuần
const weekdays = ["Chủ nhật","Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy"];
const weekday = weekdays[now.getDay()];

const timeInfo = [
  `⏰ Giờ hệ thống: ${timeStr}`,
  `📅 Ngày: ${dateStr} - ${weekday}`,
  
];

ctx.font = "16px Tahoma";
ctx.fillStyle = "#FFF";

timeInfo.forEach(t => {
  y = drawWrappedText(ctx, t, leftX + 20, y, boxW - 40, 22);
});


currentY += 180 + 25; // sau box thời gian

// 👤 Account Info
drawBox(leftX, currentY, boxW, 200, "👤 Account Info");
let pY = currentY + 110; // căn giữa avatar theo box

if (botInfo.avatarPath) {
  try {
    const avatar = await loadImage(botInfo.avatarPath);
    const aSize = 90; // avatar to hơn
    ctx.save();
    ctx.beginPath();
    ctx.arc(leftX + 80, pY - 20, aSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, leftX + 35, pY - aSize / 2 - 20, aSize, aSize);
    ctx.restore();

    // viền sáng avatar
    ctx.beginPath();
    ctx.arc(leftX + 80, pY - 20, aSize / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "#00E5FF";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00E5FF";
    ctx.shadowBlur = 10;
    ctx.stroke();
  } catch (e) {
    console.log("Avatar lỗi:", e.message);
  }
}

/// Tên bot (to, nổi bật)
ctx.font = "bold 22px Tahoma";
ctx.fillStyle = "#00E5FF";
ctx.textAlign = "left";
ctx.fillText(`🤖 ${botInfo.name}`, leftX + 150, pY - 30);

// Ngày tạo (nhỏ, màu phụ)
ctx.font = "16px Tahoma";
ctx.fillStyle = "#A7B0BB";
ctx.fillText(
  `📅 Ngày tạo: ${botInfo.createdAt || "12:13 19/03/2022"}`,
  leftX + 150,
  pY
);

// Thời gian hoạt động (nổi bật xanh lá)
ctx.font = "16px Tahoma";
ctx.fillStyle = "#4ECB71";
ctx.fillText(
  `⏱️ Hoạt động: ${uptime || "0d 0h 0m"}`,
  leftX + 150,
  pY + 25
);




  /** Right column **/
  const cfgX = width / 2 + 20;
  const cfgY = 60;
  const cfgW = width / 2 - 80;
  const cfgH = height - 120;
  drawBox(cfgX, cfgY, cfgW, cfgH, "📋 Group Configs");

  ctx.font = "16px Tahoma";
  y = cfgY + 75;
  ctx.fillStyle = "#FF6B6B";
  ctx.fillText("❌ Đang tắt:", cfgX + 20, y);
  y += 28;
  offConfigs.forEach(t => { y = drawWrappedText(ctx, "- " + t, cfgX + 40, y, cfgW - 60, 22); });

  y += 20;
  ctx.fillStyle = "#4ECB71";
  ctx.fillText("✅ Đang bật:", cfgX + 20, y);
  y += 28;
  ctx.fillStyle = "#FFF";
  onConfigs.forEach(t => { y = drawWrappedText(ctx, "- " + t, cfgX + 40, y, cfgW - 60, 22); });

  /** Footer **/
  ctx.font = "16px Tahoma";
  ctx.fillStyle = "#A7B0BB";
  ctx.textAlign = "left";
  ctx.fillText(`TimeShow: ${new Date().toLocaleString()}`, 20, height - 20);
  ctx.textAlign = "right";
  ctx.fillText("✨ Powered by H w H ✨", width - 20, height - 20);

  /** Export **/
  const filePath = path.resolve(`./assets/temp/bot_info_${Date.now()}.png`);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

/** ---------------- Helpers ---------------- **/

function roundedRect(ctx, x, y, w, h, r = 16) {
  const min = Math.min(w, h);
  if (r > min / 2) r = min / 2;
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

/** ---------------- Optional helpers you can reuse ---------------- **/


/** ------------------------ MAIN ------------------------ **/

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  let lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

// Hàm vẽ bo góc
function roundRect(ctx, x, y, w, h, r = 16) {
  const min = Math.min(w, h);
  if (r > min / 2) r = min / 2;
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

// Hàm vẽ chữ glow
function glowingText(ctx, text, x, y, font, color = "#fff") {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

// Hàm chính
export async function createGroupInfoImage(groupInfo, owner) {
  let width = 1000;
  const headerH = 220;
  const headerY = 30;
  let yTemp = headerY + headerH + 30;
  const admins = groupInfo.adminIds || [];
  const creatorId = groupInfo.creatorId || "";
  const uniqueAdmins = new Set(admins);
  if (creatorId && !uniqueAdmins.has(creatorId)) {
    uniqueAdmins.add(creatorId);
  }
  const adminCount = uniqueAdmins.size;
  const fields = [
    { label: "🔢 ID:", value: groupInfo.groupId },
    { label: "👥 Số thành viên:", value: groupInfo.memberCount },
    { label: "🕰️ Ngày tạo:", value: groupInfo.createdTime },
    { label: "🏷️ Phân Loại:", value: groupInfo.groupType === 2 ? "Cộng Đồng" : "Nhóm" },
    { label: "👑 Số quản trị nhóm:", value: adminCount.toString() },
  ];
  const groupInfoBoxHeight = fields.length * 50 + 100;
  const settings = groupInfo.setting || {};
  const settingLabels = {
    blockName: "Chặn đổi tên",
    signAdminMsg: "Ký tên quản trị viên",
    addMemberOnly: "Chỉ quản trị viên thêm thành viên",
    setTopicOnly: "Chỉ quản trị viên đặt chủ đề",
    enableMsgHistory: "Lịch sử tin nhắn",
    lockCreatePost: "Khóa tạo bài viết",
    lockCreatePoll: "Khóa tạo bình chọn",
    joinAppr: "Phê duyệt tham gia",
    lockSendMsg: "Khóa gửi tin nhắn",
    lockViewMember: "Khóa xem thành viên",
  };
  const settingItems = Object.entries(settings).filter(([key]) => settingLabels[key]).map(([key, value]) => ({
    label: settingLabels[key],
    value: value === 1 ? "⏸️" : "▶️"
  }));
  const settingsBoxHeight = settingItems.length * 40 + 100;
  let descBoxHeight = 0;
  let descLines = [];
  let isTwoColumnLayout = false;
  let leftColumnWidth = width - 120;
  let rightColumnWidth = 0;
  let leftColumnX = 60;
  let rightColumnX = 0;
  if (groupInfo.desc !== "") {
    descLines = [...groupInfo.desc.split("\n")].flatMap(line => {
      const { lines } = handleNameLong(line, 56);
      return lines;
    });

    if (descLines.length > 12) {
      isTwoColumnLayout = true;
      const tempCanvas = createCanvas(1, 1);
      const tempCtx = tempCanvas.getContext("2d");
      let maxDescWidth = 0;
      descLines.forEach(line => {
        const textWidth = measureTextWidth(tempCtx, line, "bold 24px BeVietnamPro");
        maxDescWidth = Math.max(maxDescWidth, textWidth);
      });
      let maxInfoWidth = 0;
      fields.forEach(f => {
        const labelWidth = measureTextWidth(tempCtx, f.label, "bold 28px BeVietnamPro");
        const valueWidth = measureTextWidth(tempCtx, f.value, "bold 28px BeVietnamPro");
        maxInfoWidth = Math.max(maxInfoWidth, labelWidth + valueWidth + 20); 
      });
      let maxSettingsWidth = 0;
      settingItems.forEach(item => {
        const textWidth = measureTextWidth(tempCtx, `${item.label}: ${item.value}`, "bold 24px BeVietnamPro");
        maxSettingsWidth = Math.max(maxSettingsWidth, textWidth);
      });
      leftColumnWidth = Math.max(500, Math.max(maxInfoWidth, maxSettingsWidth) + 80); 
      rightColumnWidth = Math.max(500, maxDescWidth + 80);
      width = leftColumnWidth + rightColumnWidth + 120; 
      leftColumnX = 60;
      rightColumnX = leftColumnX + leftColumnWidth + 30;
      descBoxHeight = descLines.length * 35 + 100;
    } else {
      descBoxHeight = descLines.length * 35 + 100;
    }
  }
  const leftColumnHeight = groupInfoBoxHeight + settingsBoxHeight + 30 + 90; 
  const rightColumnHeight = isTwoColumnLayout ? descBoxHeight + 60 : 0;
  const singleColumnHeight = groupInfoBoxHeight + (descBoxHeight ? descBoxHeight + 30 : 0) + settingsBoxHeight + 90;
  const totalHeight = isTwoColumnLayout ? Math.max(leftColumnHeight, rightColumnHeight) + headerY + headerH + 30 : singleColumnHeight + headerY + headerH + 30;
  const canvas = createCanvas(width, totalHeight);
  const ctx = canvas.getContext("2d");

  // 🎨 Nền gradient đẹp
  const bg = ctx.createLinearGradient(0, 0, 0, totalHeight);
  bg.addColorStop(0, "#4facfe");   // xanh dương nhạt
  bg.addColorStop(0.5, "#6a11cb"); // tím
  bg.addColorStop(1, "#ff6a88");   // hồng nhạt
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, totalHeight);

  // ✨ Metallic overlay sáng hơn
  const metallicGradient = ctx.createLinearGradient(0, 0, width, totalHeight);
  metallicGradient.addColorStop(0, "rgba(255,255,255,0.08)");
  metallicGradient.addColorStop(0.5, "rgba(255,255,255,0.15)");
  metallicGradient.addColorStop(1, "rgba(255,255,255,0.08)");
  ctx.fillStyle = metallicGradient;
  ctx.fillRect(0, 0, width, totalHeight);

  drawBox(ctx, 60, headerY, width - 120, headerH, "⚡️ Group Card ⚡️");
  if (groupInfo && cv.isValidUrl(groupInfo.avt)) {
    try {
      const avatar = await loadImage(groupInfo.avt);
      const size = 140;
      const cx = 150;
      const cy = headerY + headerH / 2;
      const grad = ctx.createLinearGradient(cx - size/2, cy - size/2, cx + size/2, cy + size/2);
      grad.addColorStop(0, "#4ECB71");
      grad.addColorStop(1, "#1E90FF");
      ctx.beginPath();
      ctx.arc(cx, cy, size/2 + 8, 0, Math.PI*2);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, size/2, 0, Math.PI*2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, cx - size/2, cy - size/2, size, size);
      ctx.restore();
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  // 🎨 Bảng màu chữ
  const colors = {
    name: "#FFD700",     // vàng gold cho tên nhóm
    owner: "#FF69B4",    // hồng cho trưởng nhóm
    label: "#00E5FF",    // xanh ngọc cho nhãn
    value: "#FFFFFF",    // trắng cho giá trị
    desc: "#E0FFFF",     // xanh trắng nhạt cho mô tả
    setting: "#FFFFFF"   // trắng cho cài đặt
  };

  const { lines: nameLines, totalLines: nameTotalLines } = handleNameLong(groupInfo.name, 30);
  ctx.textAlign = "left";
  ctx.fillStyle = colors.name;
  ctx.font = "bold 32px BeVietnamPro";
  ctx.fillText(nameLines[0], 300, headerY + 100);
  if (nameTotalLines > 1) {
    ctx.font = "bold 32px BeVietnamPro";
    ctx.fillText(nameLines.slice(1).join(" "), 300, headerY + 140);
  }
  ctx.font = "bold 28px BeVietnamPro";
  ctx.fillStyle = colors.owner;
  ctx.fillText(`Trưởng Nhóm: ${owner.name}`, 300, headerY + (nameTotalLines > 1 ? 180 : 140));

  const groupInfoBoxY = yTemp;
  drawBox(ctx, leftColumnX, groupInfoBoxY, leftColumnWidth, groupInfoBoxHeight, "📋 Thông Tin 📋");
  let yInfo = groupInfoBoxY + 100;
  const lineHeight = 50;
  fields.forEach(f => {
    ctx.textAlign = "left";
    ctx.fillStyle = colors.label;
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillText(f.label, leftColumnX + 40, yInfo);
    ctx.textAlign = "right";
    ctx.fillStyle = colors.value;
    ctx.fillText(f.value, leftColumnX + leftColumnWidth - 40, yInfo);
    yInfo += lineHeight;
  });

  let descBoxY = groupInfoBoxY;
  if (descBoxHeight > 0) {
    if (isTwoColumnLayout) {
      drawBox(ctx, rightColumnX, descBoxY, rightColumnWidth, descBoxHeight, "📝 Mô Tả 📝");
      let yDesc = descBoxY + 100;
      ctx.textAlign = "left";
      ctx.font = "bold 24px BeVietnamPro";
      descLines.forEach(line => {
        ctx.fillStyle = colors.desc;
        ctx.fillText(line, rightColumnX + 40, yDesc);
        yDesc += 35;
      });
    } else {
      drawBox(ctx, leftColumnX, descBoxY + groupInfoBoxHeight + 20, leftColumnWidth, descBoxHeight, "Mô Tả");
      let yDesc = descBoxY + groupInfoBoxHeight + 30 + 100;
      ctx.textAlign = "center";
      ctx.font = "bold 24px BeVietnamPro";
      descLines.forEach(line => {
        ctx.fillStyle = colors.desc;
        ctx.fillText(line, leftColumnX + leftColumnWidth / 2, yDesc);
        yDesc += 35;
      });
    }
  }

  const settingsBoxY = isTwoColumnLayout ? groupInfoBoxY + groupInfoBoxHeight + 30 : descBoxY + groupInfoBoxHeight + (descBoxHeight ? descBoxHeight + 30 : 0);
  drawBox(ctx, leftColumnX, settingsBoxY, leftColumnWidth, settingsBoxHeight, "⚙️ Cài Đặt ⚙️");
  let ySettings = settingsBoxY + 100;
  settingItems.forEach(item => {
    ctx.textAlign = "left";
    ctx.fillStyle = colors.setting;
    ctx.font = "bold 24px BeVietnamPro";
    ctx.fillText(`${item.label}: ${item.value}`, leftColumnX + 40, ySettings);
    ySettings += 40;
  });

  const filePath = path.resolve(`./assets/temp/group_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

//src/commands/mybot/list-canvas.js
import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { loadImageBuffer } from "../../utils/util.js"; // Giả định đường dẫn
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js"; // Giả định đường dẫn

// --- HÀM VẼ AVATAR LỖI ---
function drawDefaultThumbnail(ctx, x, y, size) {
  ctx.fillStyle = "#fff3cd";
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.fill();

  ctx.strokeStyle = "#dc3545";
  ctx.lineWidth = 2;
  const padding = size * 0.2;

  ctx.beginPath();
  ctx.moveTo(x + padding, y + padding);
  ctx.lineTo(x + size - padding, y + size - padding);
  ctx.moveTo(x + size - padding, y + padding);
  ctx.lineTo(x + padding, y + size - padding);
  ctx.stroke();
}

// --- HÀM FORMAT THỜI GIAN ---

const TIME_COLORS = {
  YELLOW: "#FFD700", // Vĩnh viễn
  GREEN: "#00FF00", // > 15 ngày
  BLUE: "#00BFFF", // 5 - 15 ngày
  RED: "#FF0000", // <= 5 ngày
  GRAY: "#808080", // Hết hạn / Vô hiệu hóa
};

function formatTimeRemaining(
  expiryDate,
  now,
  isRejected,
  rejecter,
  isPermanent,
) {
  if (isRejected) {
    return {
      text: `Vô Hiệu Hóa Bởi ${rejecter || "Admin"}`,
      color: TIME_COLORS.GRAY,
    };
  }
  if (isPermanent) {
    return {
      text: "Vĩnh Viễn",
      color: TIME_COLORS.YELLOW,
    };
  }

  const diffMs = expiryDate - now;

  if (diffMs <= 0) {
    return {
      text: "Hết Hạn",
      color: TIME_COLORS.GRAY,
    };
  }

  // --- BẮT ĐẦU LOGIC CÓ HẠN SỬ DỤNG ---
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let timeColor;

  if (diffDays > 15) {
    timeColor = TIME_COLORS.GREEN;
  } else if (diffDays >= 5) {
    timeColor = TIME_COLORS.BLUE;
  } else {
    timeColor = TIME_COLORS.RED;
  }

  // Tính toán chuỗi thời gian
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffMonths / 12);

  let timeText; // Chuỗi thời gian gốc
  if (diffYears >= 1) {
    const remainingMonths = diffMonths % 12;
    timeText =
      remainingMonths > 0
        ? `${diffYears} năm ${remainingMonths} tháng`
        : `${diffYears} năm`;
  } else if (diffMonths >= 1) {
    const remainingDays = diffDays % 30;
    timeText =
      remainingDays > 0
        ? `${diffMonths} tháng ${remainingDays} ngày`
        : `${diffMonths} tháng`;
  } else if (diffDays >= 1) {
    const remainingHours = diffHours % 24;
    timeText =
      remainingHours > 0
        ? `${diffDays} ngày ${remainingHours} giờ`
        : `${diffDays} ngày`;
  } else if (diffHours >= 1) {
    const remainingMinutes = diffMinutes % 60;
    timeText =
      remainingMinutes > 0
        ? `${diffHours} giờ ${remainingMinutes} phút`
        : `${diffHours} giờ`;
  } else if (diffMinutes >= 1) {
    const remainingSeconds = diffSeconds % 60;
    timeText =
      remainingSeconds > 0
        ? `${diffMinutes} phút ${remainingSeconds} giây`
        : `${diffMinutes} phút`;
  } else {
    timeText = `${diffSeconds} giây`;
  }

  // Thêm prefix
  return {
    // text: '⏳ Thời hạn còn: ' + timeText, // Cách cũ
    text: "\u23F3 Thời hạn còn: " + timeText, // Cách mới
    color: timeColor,
  };
}

// --- HÀM VẼ ẢNH CHÍNH (Đã sửa logic màu số thứ tự) ---

export async function createBotListImage(bots, api) {
  const limitedBots = bots.slice(0, 50);

  const width = 660;
  const itemHeight = 100;
  const headerHeight = 100;
  const height = headerHeight + limitedBots.length * itemHeight + 20;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#004e92");
  gradient.addColorStop(1, "#000428");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Tiêu đề
  ctx.font = "bold 32px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DANH SÁCH BOT", width / 2, headerHeight / 2 - 15);

  ctx.font = "normal 18px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#FFD700";
  ctx.fillText("Danh Sách Quản Lý Bot", width / 2, headerHeight / 2 + 20);

  // Tải avatar
  const avatars = await Promise.all(
    limitedBots.map(async (bot) => {
      try {
        const userInfo = await getUserInfoData(api, bot.uid);
        if (userInfo && userInfo.avatar) {
          const processedThumbnail = await loadImageBuffer(userInfo.avatar);
          if (processedThumbnail) {
            return await loadImage(processedThumbnail);
          }
        }
        return null;
      } catch (error) {
        console.error(`Lỗi lấy avatar cho bot ${bot.uid}: ${error.message}`);
        return null;
      }
    }),
  );

  const moveRight = 30;

  // Vẽ từng bot
  limitedBots.forEach((bot, index) => {
    const yPos = headerHeight + index * itemHeight + 10;
    const centerY = yPos + (itemHeight - 10) / 2;

    // 1. Lấy thông tin màu sắc và thời gian
    const isRejected = bot.status === "rejected";
    const timeInfo = formatTimeRemaining(
      new Date(bot.expiryAt),
      new Date(),
      isRejected,
      bot.rejecter,
      bot.expiryAt === "-1",
    );

    // 2. Vẽ khung item (màu xám mờ)
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(10, yPos, width - 20, itemHeight - 10, 10);
    ctx.fill();

    // 3. Logic vẽ Avatar (vuông bo góc)
    const avatarSize = 70;
    const avatarX = 20 + moveRight;
    const avatarY = centerY - avatarSize / 2;
    const cornerRadius = 10;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.clip(); // Cắt

    if (avatars[index]) {
      ctx.drawImage(avatars[index], avatarX, avatarY, avatarSize, avatarSize);
    } else {
      drawDefaultThumbnail(ctx, avatarX, avatarY, avatarSize);
    }

    ctx.restore(); // Xóa clip

    // 4. VẼ KHUNG VIỀN AVATAR (Dùng màu thời gian)
    ctx.strokeStyle = timeInfo.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();

    // 5. VẼ TEXT
    const textX = avatarX + avatarSize + 20;

    // --- LOGIC TÊN BOT (ĐÃ SỬA) ---
    const defaultFontSize = 26;
    ctx.font = `bold ${defaultFontSize}px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const prefix = `${index + 1}. `;
    let name = bot.displayName;

    const maxNameWidth = width - textX - 20;
    let currentFontSize = defaultFontSize;

    // Tự động giảm cỡ chữ (dựa trên tổng độ rộng)
    while (
      ctx.measureText(prefix).width + ctx.measureText(name).width >
        maxNameWidth &&
      currentFontSize > 14
    ) {
      currentFontSize--;
      ctx.font = `bold ${currentFontSize}px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial`;
    }

    // Cắt ngắn nếu vẫn quá dài
    const prefixWidth = ctx.measureText(prefix).width;
    const availableNameWidth = maxNameWidth - prefixWidth;

    if (
      currentFontSize === 14 &&
      ctx.measureText(name).width > availableNameWidth
    ) {
      while (
        ctx.measureText(name + "...").width > availableNameWidth &&
        name.length > 0
      ) {
        name = name.slice(0, -1);
      }
      name = name + "...";
    }

    // --- VẼ SỐ THỨ TỰ (Màu TRẮNG) ---
    ctx.fillStyle = "#ffffff"; // Yêu cầu: Màu trắng
    ctx.fillText(prefix, textX, centerY - 15);

    // --- VẼ TÊN BOT (Màu trạng thái) ---
    const isRunning = bot.status === "running";
    ctx.fillStyle = isRunning ? "#00FF00" : "#808080"; // Xanh (bật) hoặc Xám (tắt)
    ctx.fillText(name, textX + prefixWidth, centerY - 15);
    // --- KẾT THÚC SỬA LOGIC TÊN ---

    // Dòng 2: Thời hạn (Dùng màu thời gian)
    ctx.font = "20px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = timeInfo.color;
    ctx.fillText(timeInfo.text, textX, centerY + 20);
  });

  // Lưu file
  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(`./assets/temp/bot_list_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

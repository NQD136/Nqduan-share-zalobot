import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';

// Nếu bạn có font chữ riêng, hãy bỏ comment dòng này
// registerFont(path.resolve('./assets/fonts/BeVietnamPro-Bold.ttf'), { family: 'BeVietnamPro' });

// Hàm vẽ một hình chữ nhật bo góc (hàm phụ trợ)
function drawRoundedRect(ctx, x, y, w, h, r) {
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
  ctx.fill();
}


export async function createGayCheckImage(data) {
  const width = 1000;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const FONT_FAMILY = 'Arial'; // Thay bằng 'BeVietnamPro' nếu đã đăng ký font

  // --- 1. Vẽ Nền ---
  const backgroundPath = path.resolve('./assets/background-gay.jpg');
  if (fs.existsSync(backgroundPath)) {
    const background = await loadImage(backgroundPath);
    ctx.drawImage(background, 0, 0, width, height);
  } else {
    // Nền gradient dự phòng
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#485563');
    gradient.addColorStop(1, '#29323c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // Lớp phủ tối để làm nổi bật nội dung
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, width, height);

  // --- 2. Vẽ Tiêu đề ---
  ctx.textAlign = 'center';
  ctx.font = `bold 52px ${FONT_FAMILY}`;
  const titleGradient = ctx.createLinearGradient(0, 0, width, 0);
  titleGradient.addColorStop(0.1, '#f8b500');
  titleGradient.addColorStop(0.5, '#43e97b');
  titleGradient.addColorStop(0.9, '#38f9d7');
  ctx.fillStyle = titleGradient;
  ctx.fillText(data.title, width / 2, 80);


  // --- 3. Vẽ Avatar ---
  const avatarSize = 180;
  const avatarX = 200;
  const avatarY = height / 2 + 30; // Dịch avatar xuống một chút
  const borderWidth = 10;

  try {
    const avatar = await loadImage(data.avatar);

    // Vẽ viền cầu vồng cho avatar
    const rainbow = ctx.createConicGradient(0, avatarX, avatarY);
    rainbow.addColorStop(0, "red");
    rainbow.addColorStop(1/6, "orange");
    rainbow.addColorStop(2/6, "yellow");
    rainbow.addColorStop(3/6, "green");
    rainbow.addColorStop(4/6, "blue");
    rainbow.addColorStop(5/6, "indigo");
    rainbow.addColorStop(1, "red");

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2 + borderWidth, 0, Math.PI * 2, true);
    ctx.fillStyle = rainbow;
    ctx.fill();

    // Vẽ avatar
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2, true);
    ctx.clip();
    ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
    ctx.restore();
  } catch (e) {
    console.error("Không thể tải avatar:", e.message);
  }

  // --- 4. Vẽ Khung Thông Tin ---
  const boxX = 390;
  const boxY = 140;
  const boxWidth = 550;
  const boxHeight = 280;
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 20);

  // --- 5. Vẽ Các Dòng Thông Tin ---
  const textStartX = boxX + 50;
  let currentY = boxY + 80;
  ctx.textAlign = 'left';

  // Dòng Tên
  ctx.font = `bold 34px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`👤 Tên: ${data.name}`, textStartX, currentY);
  currentY += 75;

  // Dòng Mức độ
  const percentageColor = data.percentage > 150 ? '#ff3838' : (data.percentage > 90 ? '#fbc531' : '#55efc4');
  ctx.font = `bold 34px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`🏳️‍🌈 ${data.label}:`, textStartX, currentY);

  // Vẽ phần trăm với màu riêng
  const labelWidth = ctx.measureText(`🏳️‍🌈 ${data.label}:`).width;
  ctx.fillStyle = percentageColor;
  ctx.fillText('${data.percentage}%, textStartX + labelWidth, currentY');
  currentY += 75;

  // Dòng Nhận xét
  ctx.fillStyle = '#ffffff';
  ctx.font = '30px ${FONT_FAMILY}';
  ctx.fillText('💬 Nhận xét: ${data.remark}, textStartX, currentY');

  // --- 6. Lưu Ảnh ---
  const filePath = path.resolve('./assets/temp/gay_check_\${Date.now()}.png');
  // Đảm bảo thư mục temp tồn tại
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on('finish', () => resolve(filePath));
    out.on('error', reject);
  });
}
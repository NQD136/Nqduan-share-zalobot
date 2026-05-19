import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch'; 
import { v4 as uuidv4 } from 'uuid'; 
import { 
  createCanvas, 
  loadImage, 
  registerFont 
} from 'canvas'; 

// --- Import từ project của bạn ---
import { getGlobalPrefix } from '../service.js';
import { removeMention } from '../../utils/format-util.js';
import { downloadFile } from '../../utils/util.js'; 
import { 
  sendMessageWarningRequest, 
  sendMessageStateQuote 
} from '../chat-zalo/chat-style/chat-style.js';
import { MessageType } from 'zlbotdqt'; 

// --- Cấu hình lệnh ---
export const des = {
  name: "cccd",
  type: 1,
  permission: "all", 
  countdown: 30, 
  active: true,
};

// --- Cài đặt đường dẫn tài nguyên ---
const ASSETS_PATH = path.join(process.cwd(), 'assets', 'cccd');
const TEMP_PATH = path.join(process.cwd(), 'assets', 'temp');
const TEMPLATE_FRONT = path.join(ASSETS_PATH, "cccd_mat_truoc.png");

// Font cũ
const FONT_ROBOTO_BOLD = path.join(ASSETS_PATH, "Roboto-Bold.ttf");
const FONT_ROBOTO_REGULAR = path.join(ASSETS_PATH, "Roboto-Regular.ttf");
const FONT_OCR_B = path.join(ASSETS_PATH, "OCR-B 10 BT.ttf");
const DEFAULT_AVATAR = path.join(ASSETS_PATH, "avatar.png");

// Font Kanit
const FONT_KANIT_BLACK = path.join(ASSETS_PATH, "Kanit-Black.ttf");
const FONT_KANIT_BOLD = path.join(ASSETS_PATH, "Kanit-Bold.ttf");
const FONT_KANIT_EXTRABOLD = path.join(ASSETS_PATH, "Kanit-ExtraBold.ttf");
const FONT_KANIT_LIGHT = path.join(ASSETS_PATH, "Kanit-Light.ttf");
const FONT_KANIT_MEDIUM = path.join(ASSETS_PATH, "Kanit-Medium.ttf");
const FONT_KANIT_REGULAR = path.join(ASSETS_PATH, "Kanit-Regular.ttf");
const FONT_KANIT_SEMIBOLD = path.join(ASSETS_PATH, "Kanit-SemiBold.ttf");
const FONT_KANIT_THIN = path.join(ASSETS_PATH, "Kanit-Thin.ttf");

// --- ĐĂNG KÝ FONT (ĐÃ SỬA LỖI) ---
// Đăng ký mỗi file font với 1 family name RIÊNG BIỆT
try {
  // Font cũ
  registerFont(FONT_ROBOTO_REGULAR, { family: 'Roboto' });
  registerFont(FONT_ROBOTO_BOLD, { family: 'Roboto', weight: 'bold' });
  registerFont(FONT_OCR_B, { family: 'OCR-B' }); 

  // --- ĐĂNG KÝ FONT KANIT VỚI TÊN RIÊNG ---
  registerFont(FONT_KANIT_REGULAR, { family: 'Kanit' }); // Giữ 'Kanit' làm font thường
  registerFont(FONT_KANIT_THIN, { family: 'Kanit Thin' });
  registerFont(FONT_KANIT_LIGHT, { family: 'Kanit Light' });
  registerFont(FONT_KANIT_MEDIUM, { family: 'Kanit Medium' });
  registerFont(FONT_KANIT_SEMIBOLD, { family: 'Kanit SemiBold' });
  registerFont(FONT_KANIT_BOLD, { family: 'Kanit Bold' });
  registerFont(FONT_KANIT_EXTRABOLD, { family: 'Kanit ExtraBold' });
  registerFont(FONT_KANIT_BLACK, { family: 'Kanit Black' });

} catch (e) {
  console.error("[cccd] Lỗi nghiêm trọng: Không thể tải file font. Bot không thể vẽ ảnh.", e);
}
// --- KẾT THÚC SỬA LỖI ---


// --- Cấu hình tọa độ vẽ ---
const TEXT_COLOR_FRONT = "#272727"; 
const AVATAR_POS = [42, 330];
const AVATAR_SIZE = [373, 514];
const QR_POS = [1250, 78];
const QR_SIZE = [222, 222];

// --- ĐÃ SỬA LỖI FONT ---
// Giờ đây, chúng ta gọi thẳng tên family của font, ví dụ "Kanit Medium"
// Bạn có thể đổi 'Kanit Medium' thành 'Kanit SemiBold' và nó sẽ hoạt động
const DULIEDATAZPXDEV = {
    // Để 'socccd' dùng font OCR-B cho giống thật
    'socccd':       { pos: [635, 400], font: 'bold 61px Roboto', size: 61 },
    
    // Họ và tên dùng font SemiBold (dày vừa)
    'hovaten':      { pos: [455, 533], font: 'bold 46px Roboto', size: 46, letterSpacing: '5px' }, 
    
    // Ngày sinh dùng OCR-B
    'ngaysinh':     { pos: [870, 595], font: 'bold 36px Roboto', size: 36 }, 
    
    // Giới tính dùng font Medium (dày vừa)
    'gioitinh':     { pos: [735, 659], font: 'bold 40px Roboto', size: 40 }, 
    'quoctich':     { pos: [1250, 655], font: 'bold 40px Roboto', size: 40 }, 
    
    // Quê quán dùng font thường (Regular)
    'quequan':      { pos: [455, 770], font: '45px "Kanit SemiBold"', size: 45, wrap: 40 }, 
    
    // Ngày hết hạn dùng font thường (Roboto)
    'ngayhethan':   { pos: [250, 850], font: '33px "Kanit SemiBold"', size: 33, color: "#202E27", letterSpacing: '5px' }, 
    
    // Thường trú dùng font thường (Regular)
    'thuongtru':    { pos: [455, 870], font: '45px "Kanit SemiBold"', size: 45, wrap: 40 }, 
};
// --- KẾT THÚC SỬA LỖI ---


// --- Hàm xử lý lệnh chính ---
export async function handleCccdCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);

  if (!content.startsWith(`${prefix}${aliasCommand}`)) {
    return false;
  }

  let avatarUrl = null;
  const quote = message.data?.quote;

  if (quote) {
    try {
      const parseMessage = JSON.parse(quote.attach);
      avatarUrl = parseMessage?.href || parseMessage?.thumb; 
    } catch (error) { }
  }

  if (!avatarUrl) {
    const object = {
      caption: `❌ Bạn cần phải reply (trả lời) vào một ảnh để dùng làm ảnh chân dung.`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return true;
  }

  const argsText = content.slice(prefix.length + aliasCommand.length).trim();
  const parts = argsText.split('|').map(p => p.trim());

  if (parts.length !== 8) {
    const guide = `
❌ Thông tin không đủ hoặc sai định dạng (${parts.length}/8 trường).
Vui lòng cung cấp đủ 8 trường theo cú pháp:
${prefix}${aliasCommand} [Họ và Tên] | [Ngày sinh] | [Giới tính] | [Quốc tịch] | [Quê quán] | [Nơi thường trú] | [Số CCCD] | [Ngày hết hạn]

Ví dụ:
${prefix}${aliasCommand} NGUYỄN VĂN A | 01/01/1990 | Nam | Việt Nam | Xã A, Huyện B, Tỉnh C | Số nhà X, Đường Y, Tỉnh Z | 001090123456 | 01/01/2090
`.trim();
    const object = { caption: guide };
    await sendMessageWarningRequest(api, message, object, 60000);
    return true;
  }

  const data = {
    'hovaten': parts[0],
    'ngaysinh': parts[1],
    'gioitinh': parts[2],
    'quoctich': parts[3],
    'quequan': parts[4],
    'thuongtru': parts[5],
    'socccd': parts[6],
    'ngayhethan': parts[7],
  };

  if (!isValidDate(data['ngaysinh'])) {
    await sendMessageWarningRequest(api, message, { caption: "❌ Ngày sinh không hợp lệ. Vui lòng nhập theo định dạng DD/MM/YYYY." }, 30000);
    return true;
  }
  if (!isValidDate(data['ngayhethan'])) {
    await sendMessageWarningRequest(api, message, { caption: "❌ Ngày hết hạn không hợp lệ. Vui lòng nhập theo định dạng DD/MM/YYYY." }, 30000);
    return true;
  }

 await sendMessageStateQuote(api, message, "Đang xử lý ảnh, vui lòng chờ trong giây lát...", true, 15000, true);

  let tempAvatarPath = null;
  let tempOutputPath = null;

  try {
    ensureDirectoryExists(TEMP_PATH);
    tempAvatarPath = path.join(TEMP_PATH, `cccd_avatar_${uuidv4()}.jpg`);
    await downloadFile(avatarUrl, tempAvatarPath);
    data['avatar'] = tempAvatarPath; 

    const generatedImageBuffer = await createCccdFront(data);

    tempOutputPath = path.join(TEMP_PATH, `cccd_out_${uuidv4()}.png`);
    fs.writeFileSync(tempOutputPath, generatedImageBuffer);

    await api.sendMessage(
      { 
        msg: "", 
        attachments: [tempOutputPath], 
        quote: message,
        ttl: 1800000 
      }, 
      message.threadId, 
      MessageType.GroupMessage
    );

  } catch (error) {
    console.error("[cccd] Lỗi khi tạo ảnh:", error);
    await sendMessageWarningRequest(api, message, { caption: `❌ Đã xảy ra lỗi khi tạo ảnh: ${error.message}` }, 30000);
  } finally {
    if (tempAvatarPath && fs.existsSync(tempAvatarPath)) {
      fs.unlinkSync(tempAvatarPath);
    }
    if (tempOutputPath && fs.existsSync(tempOutputPath)) {
      fs.unlinkSync(tempOutputPath);
    }
  }

  return true;
}

// --- Hàm vẽ ảnh (Chuyển từ Python) ---
async function createCccdFront(data) {
  try {
    const template = await loadImage(TEMPLATE_FRONT);
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(template, 0, 0);

    let avatar;
    try {
      avatar = await loadImage(data.avatar);
    } catch (e) {
      console.warn(`[cccd] Lỗi tải avatar (${data.avatar}), dùng ảnh mặc định.`);
      avatar = await loadImage(DEFAULT_AVATAR);
    }
    ctx.drawImage(avatar, AVATAR_POS[0], AVATAR_POS[1], AVATAR_SIZE[0], AVATAR_SIZE[1]);

    try {
      const qrcode_text = `${data.socccd}|${uuidv4().split('-')[0]}|${data.hovaten}|${data.ngaysinh.replace(/\//g, '')}|${data.gioitinh}|${data.thuongtru}|${data.ngayhethan.replace(/\//g, '')}`;
      const qr_url = `https://quickchart.io/qr?text=${encodeURIComponent(qrcode_text)}&light=0000&ecLevel=H&format=png&size=700`;
      
      const qrResponse = await fetch(qr_url);
      if (!qrResponse.ok) throw new Error(`API QR trả về lỗi ${qrResponse.status}`);
      
      const qrBuffer = await qrResponse.arrayBuffer();
      const qrImage = await loadImage(Buffer.from(qrBuffer));
      
      ctx.drawImage(qrImage, QR_POS[0], QR_POS[1], QR_SIZE[0], QR_SIZE[1]);
    } catch (qrError) {
      console.error("[cccd] Lỗi: Không thể tạo hoặc tải QR code:", qrError.message);
    }

    // Vẽ chữ
    for (const [key, config] of Object.entries(DULIEDATAZPXDEV)) {
      const text = data[key] || "";
      ctx.font = config.font;
      ctx.fillStyle = config.color || TEXT_COLOR_FRONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      if (config.wrap) {
        const lines = wrapTextByChars(text, config.wrap);
        let y_pos = config.pos[1];
        for (const line of lines) {
          ctx.fillText(line, config.pos[0], y_pos);
          y_pos += config.size + 10; 
        }
      } else {
        ctx.fillText(text, config.pos[0], config.pos[1]);
      }
    }

    return canvas.toBuffer("image/png");

  } catch (e) {
    console.error("[cccd] Lỗi trong hàm createCccdFront:", e);
    throw new Error("Lỗi khi xử lý file phôi hoặc font chữ.");
  }
}

// --- Các hàm tiện ích ---

function isValidDate(dateStr) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr);
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function wrapTextByChars(text, maxChars) {
  const lines = [];
  const words = text.split(' ');
  let current_line = "";
  for (const word of words) {
      if ((current_line + " " + word).length <= maxChars) {
          current_line += " " + word;
      } else {
          lines.push(current_line.trim());
          current_line = word;
      }
  }
  lines.push(current_line.trim());
  return lines.filter(line => line.length > 0);
}
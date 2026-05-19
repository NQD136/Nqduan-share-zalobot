// Tên file: check-user.js

import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
// Import các hàm tiện ích canvas từ file info.js (qua index.js)
import * as cv from "../../utils/canvas/index.js"; 
// Import hàm lấy data từ file user-info.js
import { getUserInfoData } from "./user-info.js"; 
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";


// =================================================================
// ===== BẮT ĐẦU CODE CHO LỆNH CHECK ================================
// =================================================================

/**
 * 1. HÀM XỬ LÝ LỆNH CHECK (Controller)
 * (Chỉ hoạt động khi có tag)
 */
export async function handleCheckCommand(api, message, aliasCommand) {
    const threadId = message.threadId;
    const prefix = getGlobalPrefix();
    let imagePath = null;

    try {
        // --- Logic: Chỉ hoạt động khi có tag ---
        const mentions = message.data.mentions;
        let targetUserId;

        // 1. Kiểm tra xem có tag hay không
        if (mentions && mentions.length > 0) {
            // Nếu có, lấy người được tag đầu tiên
            targetUserId = mentions[0].uid;
        } else {
            // 2. Nếu KHÔNG có tag, gửi tin nhắn lỗi và dừng lại
            await sendErrorMessage(
                api, 
                message, 
                threadId, 
                `❌ Lệnh này cần tag một người.\nVí dụ: ${prefix}${aliasCommand} @tên`
            );
            return; // Dừng thực thi hàm
        }
        // --- Kết thúc logic tag ---


        // Sử dụng lại hàm getUserInfoData để lấy thông tin
        const userInfo = await getUserInfoData(api, targetUserId);
        if (!userInfo) {
            await sendErrorMessage(api, message, threadId, "❌ Không thể lấy thông tin người dùng này.");
            return;
        }

        // === Logic check (giữ nguyên) ===
        const percent = Math.floor(Math.random() * 151); // Random 0 -> 150%
        const checkTitle = userInfo.genderId === 0 ? "Gay" : "Less";
        const description = getCheckDescription(percent, checkTitle);
        const fullTitle = `Kết Quả Check ${checkTitle.charAt(0).toUpperCase() + checkTitle.slice(1)}`; 
        // === Kết thúc logic check ===

        // Gọi hàm vẽ canvas (nằm ngay bên dưới file này)
        imagePath = await createCheckImage(userInfo, fullTitle, percent, description);
        await api.sendMessage({ msg: "", attachments: [imagePath], ttl: 3600000 }, threadId, message.type);

    } catch (error) {
        console.error("Lỗi khi thực hiện lệnh check:", error);
        await sendErrorMessage(
            api,
            message,
            threadId,
            "❌ Đã xảy ra lỗi khi check. Vui lòng thử lại sau."
        );
    } finally {
        // Dọn dẹp file ảnh tạm sau khi gửi
        if (imagePath) {
             try {
                fs.unlinkSync(imagePath);
            } catch (e) {
                console.error("Lỗi xóa file ảnh check:", e);
            }
        }
    }
}

/**
 * 2. HÀM PHỤ LẤY MÔ TẢ (Helper)
 * (Đã thêm nhiều nhận xét)
 */
function getCheckDescription(percent, title) {
    const term = title.toLowerCase(); // "gay" hoặc "less"
    if (percent === 0) return `Hoàn toàn bình thường. Chúc mừng!`;
    if (percent <= 10) return `Chỉ ${percent}%. Chắc là nhầm lẫn gì đó. 😌`;
    if (percent <= 20) return `Dưới 20%... Có chút dấu hiệu lạ...`;
    if (percent <= 30) return `Hmm, ${percent}% rồi. Cần xem xét lại bản thân. 😉`;
    if (percent <= 40) return `Con số này bắt đầu đáng nghi ngại.`;
    if (percent <= 50) return `Đạt mốc 50%. Nửa này nửa kia à? 🤔`;
    if (percent <= 60) return `Trên 50%. Thiên hướng ${term} bắt đầu rõ rệt.`;
    if (percent <= 70) return `Đã 70%! Xác định rồi đấy! 🥰`;
    if (percent <= 80) return `${percent}%... Không thể chối cãi!`;
    if (percent <= 90) return `Gần 90%! Đích thị là ${term} rồi! 🏳️‍🌈`;
    if (percent < 100) return `Trên 90%! Chỉ chờ ngày công khai thôi.`;
    if (percent === 100) return `100% ${term}. Chuẩn không cần chỉnh! ✨`;
    if (percent <= 120) return `Vượt 100%. Bạn là ${term} siêu cấp! 🚀`;
    if (percent < 150) return `Bạn có ${percent}% ${term}. Đã vượt ngưỡng bình thường!`;
    if (percent === 150) return `150%! ĐỈNH CỦA CHÓP! VUA CỦA ${title.toUpperCase()}! 👑`;
    return "Không xác định";
}


/**
 * 3. HÀM VẼ CANVAS (View)
 * (Layout Ngang 1000x450)
 */
async function createCheckImage(userInfo, checkTitle, percent, description) {
    const width = 1000;
    // ✅ THAY ĐỔI: Giảm chiều rộng (height) xuống 450px
    const height = 450;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // --- Vẽ Nền và Lớp phủ mờ ---
    const isValidUrl = (url) => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));

    if (userInfo.cover && isValidUrl(userInfo.cover)) {
        try {
            const cover = await loadImage(userInfo.cover);
            ctx.drawImage(cover, 0, 0, width, height);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Lớp phủ tối 50%
            ctx.fillRect(0, 0, width, height);
        } catch (error) {
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0, "#4a00e0");
            bgGrad.addColorStop(1, "#8e2de2");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);
        }
    } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, "#4a00e0");
        bgGrad.addColorStop(1, "#8e2de2");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
    }
    
    // --- Định vị Avatar (Bên trái) ---
    const avatarX = 200; 
    // ✅ THAY ĐỔI: Căn avatar vào giữa chiều cao mới
    const avatarY = height / 2; // = 225
    const avatarSize = 180;
    const borderWidth = 10;

    if (userInfo.avatar && isValidUrl(userInfo.avatar)) {
        try {
            const avatar = await loadImage(userInfo.avatar);
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarSize / 2 + borderWidth, 0, Math.PI * 2, true);
            ctx.fillStyle = "#FFC300";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.clip();
            ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
            ctx.restore();
        } catch (error) {
            console.error("Lỗi load avatar for check:", error);
        }
    }
    
    // --- Vẽ Tiêu đề (Ở trên) ---
    ctx.font = "bold 40px BeVietnamPro"; 
    const textGrad = ctx.createLinearGradient(0, 0, width, 0);
    textGrad.addColorStop(0, "#FFFF00");
    textGrad.addColorStop(1, "#00FF00");
    ctx.fillStyle = textGrad;
    ctx.textAlign = "center";
    ctx.fillText(checkTitle, width / 2, 70);

    // --- Vẽ Thông tin (Bên phải) ---
    const infoX = 420; // Căn lề trái cho khối text
    // ✅ THAY ĐỔI: Điều chỉnh Y cho vừa khung 450px
    let currentY = 150; 
    ctx.textAlign = "left";

    // 1. Tên
    ctx.font = "bold 28px BeVietnamPro"; 
    ctx.fillStyle = "#33FF33"; 
    const nameLabel = "🧑 Tên: "; 
    ctx.fillText(nameLabel, infoX, currentY);
    const nameLabelWidth = ctx.measureText(nameLabel).width; 
    
    ctx.fillStyle = "#FFFFFF";
    const [nameLine1] = cv.hanldeNameUser(userInfo.name);
    ctx.fillText(nameLine1, infoX + nameLabelWidth, currentY); 
    currentY += 70; // Giảm Y

    // 2. Mức độ
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillStyle = "#33FF33";
    const percentLabel = "🏳️‍🌈 Mức độ: "; 
    ctx.fillText(percentLabel, infoX, currentY);
    const percentLabelWidth = ctx.measureText(percentLabel).width; 

    ctx.fillStyle = "#FFD700"; 
    ctx.font = "bold 52px BeVietnamPro"; 
    ctx.fillText(`${percent}%`, infoX + percentLabelWidth + 5, currentY + 8); 
    currentY += 70; // Giảm Y

    // 3. Nhận xét
    ctx.font = "bold 28px BeVietnamPro";
    ctx.fillStyle = "#33FF33";
    ctx.fillText("💬 Nhận xét:", infoX, currentY);
    currentY += 45; 

    ctx.font = "italic 26px BeVietnamPro"; 
    ctx.fillStyle = "#FFFFFF";
    const { lines } = cv.handleNameLong(description, 35); 
    for (const line of lines) {
         ctx.fillText(line, infoX, currentY); 
         currentY += 35; 
         // Dừng nếu chữ tràn ra ngoài
         if (currentY > height - 20) break;
    }
    
    // --- Xuất file ---
    const filePath = path.resolve(process.cwd(), "assets", "temp", `user_check_${Date.now()}.png`);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    
    const out = fs.createWriteStream(filePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    return new Promise((resolve, reject) => {
        out.on("finish", () => resolve(filePath));
        out.on("error", reject);
    });
}


/**
 * 4. HÀM GỬI LỖI (Helper)
 */
async function sendErrorMessage(api, message, threadId, errorMsg) {
    await api.sendMessage({ msg: errorMsg, quote: message, ttl: 30000 }, threadId, message.type);
}
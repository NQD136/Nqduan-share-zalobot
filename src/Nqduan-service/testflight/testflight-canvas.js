import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";

// ✅ HÀM ĐÃ SỬA LỖI CĂN CHỈNH CHỮ
function drawStatusBadge(ctx, text, x, y) {
    const statusText = text.toLowerCase();
    let badgeColor;

    if (statusText.includes('đã đóng') || statusText.includes('đầy') || statusText.includes('gone')) {
        badgeColor = '#dc3545'; // Màu đỏ
    } else {
        badgeColor = '#28a745'; // Màu xanh
    }

    ctx.font = "bold 16px BeVietnamPro";
    const textWidth = ctx.measureText(text).width;
    const badgeWidth = textWidth + 20; // Thêm 10px padding mỗi bên
    const badgeX = x - badgeWidth; // Tọa độ X bên trái của badge

    // Vẽ nền badge
    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.roundRect(badgeX, y, badgeWidth, 30, 15);
    ctx.fill();

    // Vẽ chữ
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    
    // Đổi thành căn lề phải và cách lề phải của badge 10px
    ctx.textAlign = "right"; 
    ctx.fillText(text, x - 10, y + 15);
}

// Hàm chính để tạo ảnh
export async function createTestflightImage(apps) {
    const appsToDraw = apps.slice(0, 10);

    const itemWidth = 700;
    const itemHeight = 120;
    const padding = 20;
    const iconSize = 80;

    const canvasWidth = itemWidth;
    const canvasHeight = appsToDraw.length * itemHeight + padding;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, "#2c3e50");
    gradient.addColorStop(1, "#34495e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const iconPromises = appsToDraw.map(app => loadImage(app.icon).catch(() => null));
    const icons = await Promise.all(iconPromises);

    for (let i = 0; i < appsToDraw.length; i++) {
        const app = appsToDraw[i];
        const icon = icons[i];

        const xPos = padding;
        const yPos = padding / 2 + i * itemHeight;
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(xPos, yPos, itemWidth - padding * 2, itemHeight - 10, 15);
        ctx.fill();

        const iconX = xPos + 15;
        const iconY = yPos + (itemHeight - 10 - iconSize) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 15);
        ctx.clip();
        if (icon) {
            ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
        } else {
            ctx.fillStyle = "#7f8c8d";
            ctx.fillRect(iconX, iconY, iconSize, iconSize);
        }
        ctx.restore();

        const textX = iconX + iconSize + 20;
        const availableTextWidth = itemWidth - textX - padding * 2 - 100;

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px BeVietnamPro";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        let appName = app.ten;
        if (ctx.measureText(appName).width > availableTextWidth) {
            while (ctx.measureText(appName + "...").width > availableTextWidth && appName.length > 0) {
                appName = appName.slice(0, -1);
            }
            appName += "...";
        }
        ctx.fillText(appName, textX, iconY + 5);

        ctx.fillStyle = "#bdc3c7";
        ctx.font = "16px BeVietnamPro";
        ctx.fillText(app.the_loai, textX, iconY + 35);
        
        ctx.fillText(`🕒 ${app.thay_doi}`, textX, iconY + 60);

        // ✅ ĐÃ SỬA LẠI: Trả về vị trí ban đầu, logic căn chỉnh đã nằm trong hàm
        drawStatusBadge(ctx, app.trang_thai, itemWidth - padding * 2, yPos + 15);
    }
    
    const filePath = path.resolve(`./assets/temp/testflight_${Date.now()}.png`);
    await fs.writeFile(filePath, canvas.toBuffer());
    return filePath;
}
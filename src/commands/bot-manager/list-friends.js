// File: src/commands/bot-manager/dsbanbe.js
// LỆNH !dsbanbe – ĐẸP Y HỆT KEY-LIST CHÍNH CHỦ – PHIÊN BẢN CUỐI, KHÔNG CÒN GÌ ĐỂ SỬA!

import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";

function roundRect(ctx, x, y, w, h, r) {
    if (typeof r === "number") r = { tl: r, tr: r, br: r, bl: r };
    const tl = r?.tl ?? 0;
    const tr = r?.tr ?? 0;
    const br = r?.br ?? 0;
    const bl = r?.bl ?? 0;

    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
}

export const commandConfig = {
    name: "dsbanbe",
    aliases: ["dsbb", "banbe", "listfriend"],
    description: "Hiển thị danh sách bạn bè - đẹp như key-list chính chủ",
    usage: "!dsbanbe",
    cooldown: 25,
    permission: 1,
    credits: "HOÀN HẢO TUYỆT ĐỐI 2025"
};

export async function handleDsBanBe(api, message) {
    const threadId = message.threadId;
    const msgType = message.type || "GroupMessage";

    try {
        await api.sendMessage({ msg: "Đang tải danh sách bạn bè...", ttl: 15000 }, threadId, msgType);

        const result = await api.getAllFriends(30000, 1);
        if (result.error) throw new Error("Lỗi API");

        let friends = [];
        if (Array.isArray(result.data)) friends = result.data;
        else if (result.data?.data) friends = result.data.data;
        else if (result.data?.friends) friends = result.data.friends;
        else throw new Error("Không có dữ liệu");

        if (friends.length === 0) {
            return await api.sendMessage({ msg: "Không có bạn bè nào!", ttl: 30000 }, threadId, msgType);
        }

        const total = friends.length;
        const friendList = friends.map((f, i) => ({
            index: i + 1,
            name: (f.displayName || f.zaloName || "Người dùng Zalo").trim(),
            avatar: f.avatar && f.avatar.includes("http") ? f.avatar : "https://i.imgur.com/8Q3e1.jpg"
        }));

        const isTwoCol = total >= 10;
        const perCol = isTwoCol ? Math.ceil(total / 2) : total;
        const width = isTwoCol ? 1000 : 720;
        const itemHeight = 115;
        const headerHeight = 160;
        const height = headerHeight + perCol * itemHeight + 120;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#1877f2";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 52px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("DANH SÁCH BẠN BÈ", width / 2, 80);
        ctx.font = "32px Arial";
        ctx.fillStyle = "#e3f2fd";
        ctx.fillText(`${total.toLocaleString()} người bạn`, width / 2, 130);

        const avatars = await Promise.all(friendList.map(f => loadImage(f.avatar).catch(() => null)));

        const colWidth = isTwoCol ? width / 2 : width;
        const startX = isTwoCol ? [70, width / 2 + 70] : [width / 2 - 280];

        friendList.forEach((f, i) => {
            const col = isTwoCol ? Math.floor(i / perCol) : 0;
            const row = isTwoCol ? i % perCol : i;
            const baseX = startX[col];
            const baseY = headerHeight + row * itemHeight + 38;

            // Nền item
            ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
            roundRect(ctx, baseX, baseY - 32, colWidth - 140, itemHeight - 20, 32);
            ctx.fill();

            // Avatar
            const avatarSize = 84;
            const avatarX = baseX + 28;
            const avatarY = baseY - 26;

            ctx.save();
            roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 18);
            ctx.clip();
            if (avatars[i]) ctx.drawImage(avatars[i], avatarX, avatarY, avatarSize, avatarSize);
            else { ctx.fillStyle = "#cccccc"; ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize); }
            ctx.restore();

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 4;
            roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 18);
            ctx.stroke();

            // SỐ THỨ TỰ – ĐÃ ĐÚNG NHƯ KEY-LIST CHÍNH CHỦ 100%
            const numSize = 28;
            const numX = avatarX + avatarSize - numSize - 4;
            const numY = avatarY + avatarSize - numSize - 4;

            // BO 2 GÓC ĐỐI NHAU ĐÚNG: TRÊN TRÁI + DƯỚI PHẢI
            ctx.fillStyle = "#FFD700";
            roundRect(ctx, numX, numY, numSize, numSize, { tl: 16, tr: 0, br: 16, bl: 0 });
            ctx.fill();

            ctx.strokeStyle = "#DAA520";
            ctx.lineWidth = 2.5;
            roundRect(ctx, numX, numY, numSize, numSize, { tl: 16, tr: 0, br: 16, bl: 0 });
            ctx.stroke();

            ctx.fillStyle = "#000000";
            ctx.font = "bold 15px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(f.index > 999 ? "999+" : f.index, numX + numSize / 2, numY + numSize / 2 + 0.5);

            // Tên
            const textX = avatarX + avatarSize + 20;
            const displayName = f.name.length > 32 ? f.name.slice(0, 32) + "..." : f.name;
            ctx.font = "bold 22px Arial";
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(displayName, textX, baseY + 8);
        });

        await fs.mkdir("./cache", { recursive: true });
        const imgPath = path.join("./cache", `dsbanbe_${Date.now()}.png`);
        await fs.writeFile(imgPath, canvas.toBuffer());

        await api.sendMessage({
            msg: `Đã hiển thị toàn bộ ${total.toLocaleString()} bạn bè!`,
            attachments: [imgPath],
            ttl: 300000
        }, threadId, msgType);

        setTimeout(() => fs.unlink(imgPath).catch(() => {}), 600000);

    } catch (err) {
        console.error("[DSBANBE ERROR]", err);
        await api.sendMessage({ msg: `Lỗi: ${err.message}`, ttl: 30000 }, threadId, msgType);
    }
}
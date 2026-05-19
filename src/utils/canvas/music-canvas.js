import { createCanvas, loadImage } from "canvas";
import * as cv from "./index.js";
import path from "path";
import fsPromises from "fs/promises";
import { loadImageBuffer } from "../util.js";
import { formatStatistic } from "../format-util.js";

// Dữ liệu icon các nền tảng (Giữ nguyên)
const dataIconPlatform = {
    "zingmp3": {
        "linkIcon": "https://static-zmp3.zmdcdn.me/skins/zmp3-mobile-v5.2/images/favicon192.png",
        "shape": "circle"
    },
    "youtube": {
        "linkIcon": "https://www.youtube.com/s/desktop/c01ea7e3/img/logos/favicon_144x144.png",
        "shape": "rectangle"
    },
    "soundcloud": {
        "linkIcon": "https://a-v2.sndcdn.com/assets/images/sc-icons/ios-a62dfc8fe7.png",
        "shape": "circle"
    },
    "nhaccuatui": {
        "linkIcon": "https://stc-id.nixcdn.com/v11/images/logo_600x600.png",
        "shape": "circle"
    },
    "tiktok": {
        "linkIcon": "https://sf-static.tiktokcdn.com/obj/eden-sg/uhtyvueh7nulogpoguhm/tiktok-icon2.png",
        "shape": "circle"
    },
    "spotify": {
        "linkIcon": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/1200px-Spotify_icon.svg.png",
        "shape": "circle"
    },
    "telegram": {
        "linkIcon": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Telegram_2019_Logo.svg/1200px-Telegram_2019_Logo.svg.png",
        "shape": "circle"
    }
}

export async function createMusicCard(musicInfo, userCoverUrl) {
    const width = 660;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    try {
        // --- PHẦN VẼ NỀN (Giữ nguyên) ---
        let backgroundImage = null;
        if (userCoverUrl) {
            try {
                backgroundImage = await loadImage(userCoverUrl);
          _ } catch (e) {
                console.warn("Không tải được user cover, thử dùng thumbnail.");
            }
        }
        if (!backgroundImage && musicInfo.thumbnailPath) {
            try {
                const processedThumb = await loadImageBuffer(musicInfo.thumbnailPath);
                backgroundImage = await loadImage(processedThumb);
            } catch (e) {
                console.warn("Không tải được thumbnail làm nền.");
            }
        }

        if (backgroundImage) {
            ctx.filter = 'blur(10px)';
            ctx.drawImage(backgroundImage, -20, -20, width + 40, height + 40);
            ctx.filter = 'none';
            const overlay = ctx.createLinearGradient(0, 0, 0, height);
            overlay.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
            overlay.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
            ctx.fillStyle = overlay;
            ctx.fillRect(0, 0, width, height);
        } else {
            // Nền dự phòng
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, "#2C3E50");
            gradient.addColorStop(1, "#3498DB");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }
        // --- HẾT PHẦN VẼ NỀN ---


        // --- PHẦN VẼ THUMBNAIL BÀI HÁT (VUÔNG BO GÓC - Giữ nguyên) ---
        if (musicInfo.thumbnailPath) {
            try {
                const processedThumbnail = await loadImageBuffer(musicInfo.thumbnailPath);
                const thumbnail = await loadImage(processedThumbnail);

                const thumbSize = 150;
                const thumbX = 40;
                const thumbY = (height - thumbSize) / 2;
                const cornerRadius = 20; 

                // 1. Cắt (clip) thành hình vuông bo góc
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, cornerRadius);
                ctx.clip();
                ctx.drawImage(thumbnail, thumbX, thumbY, thumbSize, thumbSize);
                ctx.restore();

                // 2. Vẽ viền vuông bo góc
                ctx.strokeStyle = cv.getRandomGradient(ctx, width);
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, cornerRadius);
                ctx.stroke();

                // 3. Vẽ icon nền tảng (giữ nguyên)
                const source = musicInfo.source?.toLowerCase() || "zingmp3";
                const dataIcon = dataIconPlatform[source];

                if (dataIcon) {
                    try {
                        const iconSize = 45;
                        const iconX = thumbX + thumbSize - iconSize; 
                        const iconY = thumbY + thumbSize - iconSize; 

                        ctx.save();
                        ctx.beginPath();
                        if (dataIcon.shape === 'rectangle') {
                            const borderRadius = 8;
                            ctx.roundRect(iconX, iconY, iconSize, iconSize, borderRadius);
                        } else {
                            ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
                        } 
                        ctx.clip();
                        const icon = await loadImage(dataIcon.linkIcon);
                        ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
                        ctx.restore();
                    } catch (error) {
                        console.error("Lỗi khi vẽ icon nguồn nhạc:", error);
                    }
                }
            } catch (e) { 
                console.error("Lỗi khi vẽ thumbnail bài hát:", e);
            }
        }

        // --- PHẦN VẼ CHỮ (Đã sửa cỡ chữ và thêm dòng) ---
        const textX = 220;
        let textY = 40; // Đẩy lên 5px để có thêm không gian
        let lineHeight = 35; // Giữ nguyên cho logic ngắt dòng title
        let lineHeight2 = 8; // Giữ nguyên cho logic ngắt dòng title

        // Chiều cao mới cho các dòng
        let lineHeight3 = 20; // Khoảng cách sau title (nếu 2 dòng)
        let lineHeight4 = 28; // Khoảng cách sau artist
        let lineHeight5 = 28; // Khoảng cách sau "From..."
        let lineHeight6 = 25; // Khoảng cách sau Stats
        let lineHeight7 = 25; // Khoảng cách sau Developer
        
        const maxWidth = width - textX - 80;

        // 1. Vẽ Title (Giữ nguyên logic)
        const title = musicInfo.title || "Unknown Title";
        ctx.font = "bold 20px BeVietnamPro"; 
        const titleWidth = ctx.measureText(title).width;

        if (titleWidth > maxWidth) {
            ctx.font = "bold 20px BeVietnamPro";
            const words = title.split(' ');
            let firstLine = '';
            let secondLine = '';
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const testWidth = ctx.measureText(testLine).width;

                if (testWidth > maxWidth) {
                    if (!firstLine) {
                        firstLine = currentLine;
                        currentLine = word;
                    } else {
                        secondLine = currentLine + (currentLine ? ' ' : '') + word;
                        break;
                    }
                } else {
                    currentLine = testLine;
                }
            }

            if (!secondLine && currentLine) {
                if (!firstLine) {
                    firstLine = currentLine;
                } else {
                    secondLine = currentLine;
                }
            } 

            if (secondLine) {
                const secondLineWidth = ctx.measureText(secondLine).width;
                if (secondLineWidth > maxWidth) {
                    secondLine = secondLine.substring(0, Math.floor(secondLine.length * (maxWidth / secondLineWidth) - 3)) + "...";
                }
            }

            ctx.fillStyle = cv.getRandomGradient(ctx, width);
            textY -= 8; // Đẩy lên 1 chút nếu 2 dòng
            ctx.fillText(firstLine, textX, textY);

            if (secondLine) {
                textY += lineHeight - 10;
                ctx.fillText(secondLine, textX, textY);
            }

            textY += lineHeight2;
        } else {
            ctx.font = "bold 24px BeVietnamPro";
            ctx.fillStyle = cv.getRandomGradient(ctx, width);
            ctx.fillText(title, textX, textY);
            lineHeight3 = 32; // Khoảng cách sau title (nếu 1 dòng)
        }

        // 2. Vẽ Artist (GIẢM CỠ CHỮ)
        textY += lineHeight3;
        ctx.font = "18px BeVietnamPro"; // Giảm từ 20px
        ctx.fillStyle = cv.getRandomGradient(ctx, width);
        const artist = musicInfo.artists ? "Artist: " + musicInfo.artists : "Artist: Unknown";
        ctx.fillText(artist, textX, textY);

        // 3. Vẽ Nguồn & Rank (GIẢM CỠ CHỮ)
        textY += lineHeight4;
        ctx.fillStyle = cv.getRandomGradient(ctx, width);
        ctx.font = "18px BeVietnamPro"; // Giảm từ 18px
        ctx.fillText(`From ${musicInfo.source || "ZingMp3"}${musicInfo.rank ? ` - 🏆 Now is Top ${musicInfo.rank} BXH` : ""}`, textX, textY);

        // 4. Vẽ Stats (GIẢM CỠ CHỮ)
        textY += lineHeight5;
        ctx.font = "18px BeVietnamPro"; // Giảm từ 18px

        const stats = [
            { icon: "🎧", value: formatStatistic(musicInfo.listen) },
            { icon: "👀", value: formatStatistic(musicInfo.viewCount) },
            { icon: "💜", value: formatStatistic(musicInfo.like) },
            { icon: "💬", value: formatStatistic(musicInfo.comment) },
            { icon: "🔗", value: formatStatistic(musicInfo.share) },
            { icon: "📅", value: formatStatistic(musicInfo.publishedTime) }
        ].filter(stat => stat.value !== null);

        if (stats.length > 0) {
            const fixedSpacing = 10; 
            const statsWidths = stats.map(stat => {
                const text = `${stat.icon} ${stat.value}`;
                return ctx.measureText(text).width;
            });

            const startX = textX;
            let currentX = startX;
            stats.forEach((stat, index) => {
                ctx.fillText(`${stat.icon} ${stat.value}`, currentX, textY);
                currentX += statsWidths[index] + fixedSpacing;
            });
        }

        // --- 5. SỬA ĐỔI: Thêm Developer (dùng gradient) ---
        textY += lineHeight6;
        ctx.font = "18px BeVietnamPro";
        ctx.fillStyle = cv.getRandomGradient(ctx, width); // Đổi màu
        ctx.fillText("🎧 Chúc bạn nghe nhạc vui vẻ 💕", textX, textY);

        // --- 6. SỬA ĐỔI: Thêm Chúc bạn... (dùng gradient) ---
        textY += lineHeight7;
        ctx.font = "18px BeVietnamPro"; // Bỏ italic
        ctx.fillStyle = cv.getRandomGradient(ctx, width); // Đổi màu
        ctx.fillText("Developer: </>NguyenKhoiツ", textX, textY);


        // --- PHẦN VẼ AVATAR NGƯỜI DÙNG (GIỮ NGUYÊN HÌNH TRÒN) ---
        if (musicInfo.userAvatar) {
            try {
                const avatar = await loadImage(musicInfo.userAvatar);
                 const avatarSize = 60;
                const avatarX = width - avatarSize - 20;
                const avatarY = height - avatarSize - 20;

                // 1. Vẽ viền tròn
                ctx.beginPath();
                ctx.fillStyle = cv.getRandomGradient(ctx, width);
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
                ctx.fill();

                // 2. Cắt (clip) hình tròn
                ctx.save();
                ctx.beginPath(); 
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore(); 
            } catch (error) {
                console.error("Lỗi khi vẽ avatar người dùng:", error);
            } 
        }

    } catch (error) {
        console.error("Lỗi khi tạo music card:", error);
        throw error;
    }

    // --- PHẦN LƯU FILE (Giữ nguyên) ---
    const filePath = path.resolve(`./assets/temp/music_${Date.now()}.png`);
    await fsPromises.writeFile(filePath, canvas.toBuffer());
    return filePath;
}
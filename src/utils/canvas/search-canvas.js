import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { loadImageBuffer } from "../util.js";

// Hàm vẽ thumbnail mặc định (vẫn bo góc)
function drawDefaultThumbnail(ctx, x, y, size) {
	const cornerRadius = 15; 
	ctx.fillStyle = "#fff3cd";
	ctx.beginPath();
	const padding = 3;
	ctx.roundRect(x + padding, y + padding, size - padding * 2, size - padding * 2, cornerRadius - padding);
	ctx.fill();

	ctx.strokeStyle = "#dc3545";
	ctx.lineWidth = 4;
	const crossPadding = size * 0.2; 
	
	ctx.beginPath();
	ctx.moveTo(x + crossPadding, y + crossPadding);
	ctx.lineTo(x + size - crossPadding, y + size - crossPadding);
	ctx.moveTo(x + size - crossPadding, y + crossPadding);
	ctx.lineTo(x + crossPadding, y + size - crossPadding);
	ctx.stroke();
}

export async function createSearchResultImage(data) {
    // Chỉ lấy tối đa 50 kết quả
    const displayData = data.slice(0, 50);

    // Tạo canvas tạm để tính toán độ dài text
    const tempCanvas = createCanvas(1, 1);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = "bold 24px BeVietnamPro";

    // Tìm độ dài thực tế lớn nhất của các tiêu đề
    const maxTitleWidth = displayData.reduce((maxWidth, song) => {
        const title = song.title.length > 36 ? song.title.slice(0, 36) + "..." : song.title;
        const titleWidth = tempCtx.measureText(title).width;
        return titleWidth > maxWidth ? titleWidth : maxWidth;
    }, 0);

    // Kích thước cơ bản
    const thumbnailSize = 100;
    const padding = 20;
    const rowHeight = 150;
    const columnWidth = Math.max(600, maxTitleWidth + thumbnailSize + padding * 6);
    const cornerRadius = 15; // Bán kính bo góc thumbnail

    // Logic Bố Cục (>= 5 items là ngang)
    const numItems = displayData.length;
    const itemsPerColumn = 5; // 5 hàng (item) mỗi cột
    
    let numColumns;
    let canvasWidth;
    let canvasHeight;
    let numRowsInCanvas;

    if (numItems < itemsPerColumn) {
        // --- 1. Bố cục 1 CỘT DỌC (cho 1-4 bài hát) ---
        numColumns = 1;
        numRowsInCanvas = numItems;
        canvasWidth = columnWidth + padding * 2;
        canvasHeight = numRowsInCanvas * rowHeight + padding * 2;
    } else {
        // --- 2. Bố cục NGANG (cho 5-50 bài hát) ---
        numColumns = Math.ceil(numItems / itemsPerColumn); 
        numRowsInCanvas = itemsPerColumn; // Cố định 5 hàng
        canvasWidth = columnWidth * numColumns + padding * (numColumns + 1);
        canvasHeight = numRowsInCanvas * rowHeight + padding * 2;
    }
    // --- HẾT BỐ CỤC ---


    // Tạo canvas chính
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    try {
        const thumbnailPromises = displayData.map(async (song) => {
            try {
                if (song.thumbnailM) {
                    const processedThumbnail = await loadImageBuffer(song.thumbnailM);
                    if (processedThumbnail) {
                        return await loadImage(processedThumbnail);
                    }
                }
                return null;
            } catch (error) {
                return null;
            }
        });

        const thumbnails = await Promise.all(thumbnailPromises);

        // Vẽ nền canvas
        const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0.8)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.9)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        for (let i = 0; i < displayData.length; i++) {
            const song = displayData[i];

            const column = Math.floor(i / itemsPerColumn); 
            const row = i % itemsPerColumn; 

            const xPos = padding + column * (columnWidth + padding); 
            const yPos = padding + row * rowHeight; 

            // Vẽ nền mục
            ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            ctx.beginPath();
            ctx.roundRect(xPos, yPos, columnWidth, rowHeight - 20, 10);
            ctx.fill();

            // Vẽ viền
            const thumbX = xPos + padding;
            const thumbY = yPos + (rowHeight - thumbnailSize) / 2;

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(thumbX - 4, thumbY - 4, thumbnailSize + 8, thumbnailSize + 8, cornerRadius + 4); 
            ctx.strokeStyle = "#32CD32"; 
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();

            // --- SỬA ĐỔI: Vẽ thumbnail VÀ số thứ tự (dùng clip) ---
            ctx.save();
            ctx.beginPath();
            // 1. Tạo vùng cắt hình vuông bo góc
            ctx.roundRect(thumbX, thumbY, thumbnailSize, thumbnailSize, cornerRadius);
            ctx.clip();

            // 2. Vẽ thumbnail
            if (thumbnails[i]) {
                ctx.drawImage(
                    thumbnails[i],
                    thumbX,
                    thumbY,
                    thumbnailSize,
                    thumbnailSize
                );
            } else {
                drawDefaultThumbnail(ctx, thumbX, thumbY, thumbnailSize);
            }

            // 3. Vẽ số thứ tự
            const numberSize = 35; 
            const numberX = thumbX + thumbnailSize - numberSize; 
            const numberY = thumbY + thumbnailSize - numberSize; 

            // Vẽ nền xanh (bo góc đối xứng)
            ctx.fillStyle = "#4CAF50";
            ctx.beginPath();
            
            // --- ĐÂY LÀ DÒNG THAY ĐỔI ---
            // Radii: [TopLeft, TopRight, BottomRight, BottomLeft]
            // Bo góc TopLeft và BottomRight
            ctx.roundRect(numberX, numberY, numberSize, numberSize, [cornerRadius, 0, cornerRadius, 0]);
            // --- HẾT DÒNG THAY ĐỔI ---
            
            ctx.fill();

            // Vẽ chữ
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 20px BeVietnamPro";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                `${i + 1}`, 
                numberX + numberSize / 2, 
                numberY + numberSize / 2 + 1
            );
            
            // 4. Xóa clip
            ctx.restore();
            // --- HẾT SỬA ĐỔI ---

            // Vẽ vạch ngăn cách
            ctx.save();
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            ctx.fillRect(thumbX + thumbnailSize + padding, thumbY + 5, 3, 90); 
            ctx.restore();

            // Vẽ thông tin bài hát (giữ nguyên)
			const textX = thumbX + thumbnailSize + padding * 3; 
			const availableTextWidth = columnWidth - (textX - xPos) - padding;
			ctx.textAlign = "left";
			ctx.textBaseline = "top";
			ctx.font = "bold 18px BeVietnamPro";
			ctx.fillStyle = "#ffffff";
			let title = song.title || "Không có tiêu đề";
			if (ctx.measureText(title).width > availableTextWidth) {
				while (ctx.measureText(title + "...").width > availableTextWidth && title.length > 0) {
					title = title.slice(0, -1);
				}
				title += "...";
			}
			ctx.fillText(title, textX, thumbY);
			ctx.font = "18px BeVietnamPro";
			ctx.fillStyle = "#cccccc";
			let artist = song.artistsNames || "Không rõ nghệ sĩ";
			
			if (ctx.measureText(artist).width > availableTextWidth) {
				while (ctx.measureText(artist + "...").width > availableTextWidth && artist.length > 0) {
					artist = artist.slice(0, -1);
				}
				artist += "...";
			}
			ctx.fillText(artist, textX, thumbY + 30);
			
			// Thống kê
			const stats = [];
			if (song.rankChart || song.rank) stats.push(`🏆 Top ${song.rankChart || song.rank}`);
			if (song.view) stats.push(`👀 ${song.view.toLocaleString('vi-VN')}`);
			if (song.listen) stats.push(`🎧 ${song.listen.toLocaleString('vi-VN')}`);
			if (song.like) stats.push(`❤️ ${song.like.toLocaleString('vi-VN')}`);
			if (song.comment) stats.push(`💬 ${song.comment.toLocaleString('vi-VN')}`);
			if (song.isOfficial) stats.push(`✅ Official`);
			if (song.isHD) stats.push(`🎥 HD`);
			if (song.publishedTime) stats.push(`🕒 ${song.publishedTime}`);
			if (song.isPremium) stats.push(`💳 [ Premium ]`);
			
			ctx.font = "15px BeVietnamPro";
			ctx.fillStyle = "#ffffff";
			
			let statsText = stats.join(" • ");
			if (ctx.measureText(statsText).width > availableTextWidth) {
				while (ctx.measureText(statsText + "...").width > availableTextWidth && statsText.length > 0) {
					statsText = statsText.slice(0, -1);
				}
				statsText += "...";
			}
			ctx.fillText(statsText, textX, thumbY + 60);
        }

        const filePath = path.resolve(`./assets/temp/search_result_${Date.now()}.png`);
        await fs.writeFile(filePath, canvas.toBuffer());
        return filePath;

    } catch (error) {
        console.error("Lỗi khi tạo ảnh kết quả tìm kiếm:", error);
        throw error;
    }
}
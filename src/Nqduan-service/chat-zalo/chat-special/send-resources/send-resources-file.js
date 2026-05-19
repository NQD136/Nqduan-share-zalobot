// src/Nqduan-service/chat-zalo/chat-special/send-resources/send-resources-file.js

import fs from "fs";
import path from "path";
import { createCanvas } from "canvas";
import { sendMessageFailed } from "../../chat-style/chat-style.js";
import {
  getCachedMedia,
  setCacheData,
} from "../../../../utils/link-platform-cache.js";
import { getGlobalPrefix } from "../../../service.js";
import { removeMention } from "../../../../utils/format-util.js";
import { tempDir } from "../../../../utils/io-json.js";
import { deleteFile } from "../../../../utils/util.js";

const dataFilePath = path.join(process.cwd(), "assets", "resources", "file");
const PLATFORM = "ZaloFile";
const FONT_FAMILY = `"BeVietnamPro", "Segoe UI", "Arial"`;

/**
 * Vẽ văn bản và tự động co nhỏ font để vừa vặn.
 */
function fillTextShrinkToFit(
  ctx,
  text,
  x,
  y,
  maxWidth,
  baseFont,
  minFontSize = 18,
) {
  let fontSize = parseInt(baseFont.split("px")[0].split(" ").pop());
  ctx.font = baseFont;

  let width = ctx.measureText(text).width;

  if (width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  while (width > maxWidth && fontSize > minFontSize) {
    fontSize--;
    ctx.font = baseFont.replace(/\d+px/, `${fontSize}px`);
    width = ctx.measureText(text).width;
  }
  ctx.fillText(text, x, y);
}

/**
 * Tạo một ảnh danh sách các file (Bố cục 3 cột - Tối ưu)
 */
async function createFileListImage(files, prefix, aliasCommand) {
  // === BỐ CỤC 3 CỘT ===
  const PADDING = 40;
  const TITLE_HEIGHT = 60;
  const FOOTER_HEIGHT = 70; // Giảm chiều cao footer một chút

  const TITLE_FONT_SIZE = 48;
  const ITEM_NUM_FONT_SIZE = 36;
  const ITEM_NAME_FONT_SIZE = 28; // Giữ nguyên kích thước font chữ
  const FOOTER_FONT_SIZE = 30;

  const ITEM_WIDTH = 420; // ✅ Chiều rộng mỗi ô (hẹp hơn bản 2 cột, nhưng rộng hơn bản 3 cột lỗi)
  const ITEM_HEIGHT = 110; // ✅ Chiều cao mỗi ô (giảm chút để đỡ cao)
  const ITEM_GAP = 20; // Giảm khoảng cách
  const MAX_COLUMNS = 3; // ✅ Dùng 3 CỘT
  // ======================

  const numFiles = files.length;
  // Xử lý trường hợp ít file
  const actualColumns = Math.min(numFiles, MAX_COLUMNS);
  const numRows = Math.ceil(numFiles / actualColumns);

  const contentWidth =
    actualColumns * ITEM_WIDTH +
    (actualColumns > 0 ? (actualColumns - 1) * ITEM_GAP : 0);
  const contentHeight =
    numRows * ITEM_HEIGHT + (numRows > 0 ? (numRows - 1) * ITEM_GAP : 0);

  const canvasWidth = PADDING * 2 + contentWidth;
  // Chiều cao sẽ tự điều chỉnh theo số hàng
  const canvasHeight =
    PADDING * 2 +
    TITLE_HEIGHT +
    PADDING +
    contentHeight +
    PADDING +
    FOOTER_HEIGHT;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  // 1. Vẽ nền
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, "#2a2a2e");
  gradient.addColorStop(1, "#1e1e1e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Vẽ tiêu đề
  ctx.fillStyle = "#00bfff";
  ctx.font = `bold ${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    "DANH SÁCH FILE SHARE",
    canvasWidth / 2,
    PADDING + TITLE_HEIGHT / 2,
  );

  // 3. Vẽ các ô file
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  let currentX, currentY;

  for (let i = 0; i < numFiles; i++) {
    const file = files[i];
    const col = i % actualColumns;
    const row = Math.floor(i / actualColumns);

    currentX = PADDING + col * (ITEM_WIDTH + ITEM_GAP);
    currentY =
      PADDING + TITLE_HEIGHT + PADDING + row * (ITEM_HEIGHT + ITEM_GAP);

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(currentX, currentY, ITEM_WIDTH, ITEM_HEIGHT, 10);
    ctx.fill();

    // --- Vẽ số thứ tự ---
    ctx.fillStyle = "#ffcb6b";
    const numberFont = `bold ${ITEM_NUM_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.font = numberFont;

    const numberText = `${i + 1}.`;
    const numberX = currentX + PADDING / 2;
    const numberY = currentY + PADDING / 2;

    const numberTextWidth = ctx.measureText(numberText).width;
    ctx.fillText(numberText, numberX, numberY);

    // --- Vẽ tên file ---
    ctx.fillStyle = "#e0e0e0";
    const nameFont = `${ITEM_NAME_FONT_SIZE}px ${FONT_FAMILY}`;

    const nameX = numberX + numberTextWidth + 10; // Giảm khoảng cách chút
    const nameY = numberY + (ITEM_NUM_FONT_SIZE - ITEM_NAME_FONT_SIZE) / 2;

    const maxNameWidth = currentX + ITEM_WIDTH - nameX - PADDING / 2;

    // Sử dụng hàm co nhỏ chữ
    fillTextShrinkToFit(ctx, file, nameX, nameY, maxNameWidth, nameFont, 18); // Co nhỏ tới tối thiểu 18px
  }

  // 4. Vẽ footer
  ctx.fillStyle = "#28a745";
  ctx.font = `italic ${FOOTER_FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const footerText = `Dùng lệnh: ${prefix}${aliasCommand} <số thứ tự hoặc tên file>`;
  ctx.fillText(
    footerText,
    canvasWidth / 2,
    canvasHeight - PADDING / 2 - FOOTER_HEIGHT / 2,
  ); // Điều chỉnh Y footer

  return canvas.toBuffer("image/png");
}

// --- Các hàm handleSendFile và sendFile giữ nguyên như cũ ---

/**
 * Xử lý lệnh gửi file.
 */
export async function handleSendFile(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  const keyword = content.replace(prefix + aliasCommand, "").trim();

  if (!keyword) {
    let tempImagePath = null;
    try {
      const files = await fs.promises.readdir(dataFilePath);
      if (files.length === 0) {
        await sendMessageFailed(
          api,
          message,
          "Thư mục tài nguyên hiện đang trống.",
        );
        return;
      }

      const tempFileName = `file_list_${Date.now()}.png`;
      tempImagePath = path.join(tempDir, tempFileName);

      const imageBuffer = await createFileListImage(
        files,
        prefix,
        aliasCommand,
      );
      await fs.promises.mkdir(path.dirname(tempImagePath), { recursive: true });
      await fs.promises.writeFile(tempImagePath, imageBuffer);

      await api.sendMessage(
        {
          msg: "",
          attachments: [tempImagePath],
          ttl: 3600000,
        },
        message.threadId,
        message.type,
      );
    } catch (error) {
      console.error("Lỗi khi tạo và gửi ảnh danh sách file:", error);
      await sendMessageFailed(
        api,
        message,
        "Có lỗi xảy ra khi tạo ảnh danh sách file.",
      );
    } finally {
      if (tempImagePath) {
        try {
          await deleteFile(tempImagePath);
        } catch (err) {
          console.warn(
            `Không xóa được file tạm: ${tempImagePath}`,
            err?.message || err,
          );
        }
      }
    }
    return;
  }

  await sendFile(api, message, keyword);
}

/**
 * Gửi file cụ thể dựa trên keyword.
 */
async function sendFile(api, message, keyword) {
  try {
    const files = await fs.promises.readdir(dataFilePath);
    let resourceFile;

    if (/^\d+$/.test(keyword)) {
      const index = parseInt(keyword, 10) - 1;
      if (index >= 0 && index < files.length) {
        resourceFile = files[index];
      }
    } else {
      const lowerKeyword = keyword.toLowerCase();
      resourceFile = files.find(
        (file) => path.parse(file).name.toLowerCase() === lowerKeyword,
      );
    }

    if (!resourceFile) {
      await sendMessageFailed(
        api,
        message,
        "Không tìm thấy file với số thứ tự hoặc tên này.",
        false,
      );
      return;
    }

    const filePath = path.join(dataFilePath, resourceFile);
    const nameLocalFile = path.parse(resourceFile).name;
    const fullFileName = resourceFile;
    const fileExt = path.parse(resourceFile).ext;

    let cachedFile = await getCachedMedia(
      PLATFORM,
      resourceFile,
      fileExt,
      nameLocalFile,
    );
    let fileUrl;

    if (cachedFile && cachedFile.fileUrl) {
      fileUrl = cachedFile.fileUrl;
    } else {
      const linkUploadZalo = await api.uploadAttachment(
        [filePath],
        message.threadId,
        message.type,
      );
      fileUrl = linkUploadZalo[0].fileUrl || linkUploadZalo[0].normalUrl;

      setCacheData(
        PLATFORM,
        resourceFile,
        {
          fileUrl: fileUrl,
          title: nameLocalFile,
        },
        fileExt,
      );
    }

    await api.sendMessage(
      {
        msg: `File: ${fullFileName}`,
        attachments: [filePath],
        ttl: 3600000,
      },
      message.threadId,
      message.type,
    );
  } catch (error) {
    console.error("Lỗi khi gửi file:", error);
    await sendMessageFailed(api, message, "Có lỗi xảy ra khi gửi file.", false);
  }
}

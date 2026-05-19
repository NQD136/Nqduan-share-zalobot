//src/Nqduan-service/chat-zalo/chat-special/send-sticker/send-sticker.js
import axios from "axios";
import fs from "fs/promises"; // Sử dụng fs.promises
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { getGlobalPrefix } from "../../../service.js";

// Đảm bảo fluent-ffmpeg tìm thấy ffmpeg
ffmpeg.setFfmpegPath("ffmpeg");
import {
  checkExstentionFileRemote,
  deleteFile,
  downloadFile,
  execAsync,
} from "../../../../utils/util.js";
import { MessageMention, MessageType } from "../../../../api-zalo/index.js";
import { tempDir } from "../../../../utils/io-json.js";
import { removeMention } from "../../../../utils/format-util.js";
import { getVideoMetadata } from "../../../../api-zalo/utils.js";
import { isAdmin } from "../../../../index.js";
import { removeBackground } from "../../../utilities/remove-background.js";
import { appContext } from "../../../../api-zalo/context.js";

/**
 * Kiểm tra URL có phải là media hợp lệ Không
 */
async function isValidMediaUrl(url) {
  try {
    const ext = await checkExstentionFileRemote(url);
    if (!ext) {
      return { isValid: false, isVideo: false };
    }
    const videoExts = ["mp4", "mov", "webm"];
    const imageExts = ["png", "jpg", "jpeg", "gif", "jxl", "webp"];
    if (videoExts.includes(ext)) return { isValid: true, isVideo: true };
    if (imageExts.includes(ext)) return { isValid: true, isVideo: false };
    return { isValid: false, isVideo: false };
  } catch (error) {
    console.error("Lỗi khi kiểm tra URL:", error.message);
    return { isValid: false, isVideo: false };
  }
}

/**
 * Kiểm tra ffmpeg có sẵn
 */
async function ensureFfmpegAvailable() {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch (err) {
    throw new Error(
      "ffmpeg không được tìm thấy trên hệ thống. Vui lòng cài ffmpeg (Ví dụ trên Ubuntu: sudo apt update && sudo apt install -y ffmpeg)",
    );
  }
}

/**
 * Chuyển đổi ảnh hoặc video sang WebP (hỗ trợ animated WebP cho video) sử dụng ffmpeg
 * - inputPath: đường dẫn input (local)
 * - outputPath: đường dẫn output (.webp)
 * - options: { fps, maxSize, quality }
 */
export async function convertToWebp(inputPath, outputPath, options = {}) {
  const ext = path.extname(inputPath || "").toLowerCase();
  const fps = options.fps || 12;
  const maxSize = options.maxSize || 512; // kích thước tối đa (px)
  const quality = options.quality || 60; // 0-100, thấp hơn là giảm dung lượng tăng chất lượng

  await ensureFfmpegAvailable();

  // normalize output extension
  if (!outputPath.endsWith(".webp")) {
    outputPath = outputPath + ".webp";
  }

  try {
    if ([".mp4", ".mov", ".webm"].includes(ext)) {
      // Video -> animated webp
      // - fps: frame rate
      // - scale: giữ tỉ lệ, giới hạn chiều lớn nhất = maxSize
      // - loop 0: lặp vô hạn
      // - vcodec libwebp: encode to webp
      // Một command tương đối tương thích:
      const vf = `fps=${fps},scale='if(gt(iw,ih),${maxSize},-1)':'if(gt(ih,iw),${maxSize},-1)':flags=lanczos`;
      const cmd = `ffmpeg -y -i "${inputPath}" -vf "${vf}" -vcodec libwebp -loop 0 -preset default -qscale ${quality} "${outputPath}"`;
      await execAsync(cmd);
    } else if (
      // === SỬA ĐỔI TẠI ĐÂY ===
      // Đã thêm '.jxl' vào danh sách hỗ trợ
      [".png", ".jpg", ".jpeg", ".gif", ".webp", ".jxl"].includes(ext)
    ) {
      // Ảnh tĩnh or GIF -> WebP (tĩnh hoặc animated nếu là GIF có nhiều frame)
      // Dùng libwebp để tạo webp. GIF với nhiều frame sẽ trở thành animated webp.
      const vf = `scale='if(gt(iw,ih),${maxSize},-1)':'if(gt(ih,iw),${maxSize},-1)':flags=lanczos`;
      const cmd = `ffmpeg -y -i "${inputPath}" -vf "${vf}" -vcodec libwebp -preset default -qscale ${quality} "${outputPath}"`;
      await execAsync(cmd);
    } else {
      throw new Error(`Định dạng file không được hỗ trợ: ${ext}`);
    }
    return outputPath;
  } catch (err) {
    console.error("Lỗi khi convert sang webp:", err.message);
    throw new Error(`Lỗi khi chuyển đổi sang WebP: ${err.message}`);
  }
}

/**
 * Xử lý tạo và gửi sticker từ URL hoặc local path
 */
async function processAndSendSticker(api, message, mediaSource) {
  const senderName = message.data.dName || "Người dùng";
  const senderId = message.data.uidFrom;
  let pathSticker = path.join(tempDir, `sticker_${Date.now()}.templink`);
  let pathWebp = path.join(tempDir, `sticker_${Date.now()}.webp`);
  let isLocalFile = false;

  try {
    // Kiểm tra nếu mediaSource là file cục bộ
    try {
      await fs.access(mediaSource);
      isLocalFile = true;
    } catch {
      isLocalFile = false;
    }

    let ext = null;

    if (!isLocalFile) {
      ext = await checkExstentionFileRemote(mediaSource);
      if (!ext) throw new Error("Không xác định được định dạng file.");
      pathSticker = path.join(tempDir, `sticker_${Date.now()}.${ext}`);
      await downloadFile(mediaSource, pathSticker);
    } else {
      // Nếu là file local, lấy đuôi từ tên file
      ext = path.extname(mediaSource).replace(".", "").toLowerCase();
      pathSticker = mediaSource;
    }

    const isVideo = ["mp4", "mov", "webm"].includes(ext);

    // Chuyển đổi sang webp (hỗ trợ cả video và ảnh)
    await convertToWebp(pathSticker, pathWebp, {
      fps: 12,
      maxSize: 512,
      quality: 60,
    });

    // Upload file webp lên Zalo
    const linkUploadZalo = await api.uploadAttachment(
      [pathWebp],
      appContext.send2meId,
      MessageType.DirectMessage,
    );
    if (!linkUploadZalo || !linkUploadZalo[0])
      throw new Error(
        "Upload lên Zalo bị lỗi hoặc trả về dữ liệu không hợp lệ",
      );

    // Lấy metadata (dùng metadata từ file nguồn để có kích thước chính xác)
    let stickerData = { width: 512, height: 512 };
    try {
      stickerData = await getVideoMetadata(pathSticker);
      if (!stickerData || !stickerData.width || !stickerData.height) {
        stickerData = { width: 512, height: 512 };
      }
    } catch (err) {
      console.warn(
        "Không lấy được metadata, dùng mặc định 512x512:",
        err.message,
      );
    }

    const uploadInfo = linkUploadZalo[0];
    const finalUrl =
      uploadInfo.fileUrl || uploadInfo.normalUrl || uploadInfo.url || "";
    if (!finalUrl) throw new Error("Không lấy được URL sticker từ Zalo");

    // Thêm đuôi creator signature vào URL (an toàn, không ảnh hưởng hiển thị)
    let stickerUrlWithSignature = finalUrl;
    try {
      const creatorTag = encodeURIComponent("khoi.Nqduan");
      const separator = finalUrl.includes("?") ? "&" : "?";
      stickerUrlWithSignature = `${finalUrl}${separator}stickerCreatedBy=${creatorTag}`;
    } catch (err) {
      console.warn(
        "[Sticker] Không thêm được signature, dùng URL gốc:",
        err.message,
      );
    }

    // Gửi tin nhắn thông báos
    await api.sendMessage(
      {
        msg: `@${senderName} Sticker của bạn đây!`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length + 1, 0)],
        ttl: 300000,
      },
      message.threadId,
      message.type,
    );

    // Gửi sticker (custom)
    await api.sendCustomSticker(
      message,
      stickerUrlWithSignature,
      stickerUrlWithSignature,
      stickerData.width,
      stickerData.height,
      3600000,
    );

    return { success: true, pathSticker, pathWebp };
  } catch (error) {
    console.error("Lỗi khi xử lý sticker:", error.message);
    throw error;
  } finally {
    // Xóa file tạm, sử dụng deleteFile an toàn
    try {
      if (pathSticker && pathSticker !== mediaSource)
        await deleteFile(pathSticker);
    } catch (err) {
      console.warn("Không xóa được file sticker tạm:", err.message);
    }
    try {
      if (pathWebp) await deleteFile(pathWebp);
    } catch (err) {
      console.warn("Không xóa được file webp tạm:", err.message);
    }
  }
}

/**
 * Xử lý lệnh tạo sticker
 */
export async function handleStickerCommand(api, message) {
  const quote = message.data.quote;
  const senderName = message.data.dName || "Người dùng";
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const isAdminLevelHighest = isAdmin(senderId);
  const isAdminBot = isAdmin(senderId, threadId);
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const tempPath = path.join(tempDir, `sticker_${Date.now()}.png`);
  let tempPathCreated = false; // Theo dõi xem tempPath đã được tạo chưa

  // Tạo thư mục tempDir nếu chưa tồn tại
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.error("Lỗi khi tạo thư mục tempDir:", error.message);
    await api.sendMessage(
      {
        msg: `@${senderName}, Lỗi khi tạo thư mục tạm: ${error.message}`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length + 1, 0)],
        ttl: 30000,
      },
      threadId,
      message.type,
    );
    return;
  }

  if (!quote) {
    await api.sendMessage(
      {
        msg: `@${senderName}, Hãy reply vào tin nhắn chứa ảnh hoặc video cần tạo sticker và dùng lại lệnh ${prefix}sticker.`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length + 1, 0)],
        ttl: 30000,
      },
      threadId,
      message.type,
    );
    return;
  }

  const attach = quote.attach;
  if (!attach) {
    await api.sendMessage(
      {
        msg: `@${senderName}, Không có đính kèm nào trong nội dung reply của bạn.`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length + 1, 0)],
        ttl: 30000,
      },
      threadId,
      message.type,
    );
    return;
  }

  try {
    const attachData = JSON.parse(attach);
    const mediaUrl = attachData.hdUrl || attachData.href;

    if (!mediaUrl) {
      await api.sendMessage(
        {
          msg: `@${senderName}, Không tìm thấy URL trong đính kèm của tin nhắn bạn đã reply.`,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length + 1, 0)],
          ttl: 30000,
        },
        threadId,
        message.type,
      );
      return;
    }

    const decodedUrl = decodeURIComponent(mediaUrl.replace(/\\\//g, "/"));
    const mediaCheck = await isValidMediaUrl(decodedUrl);
    if (!mediaCheck.isValid) {
      console.error("URL Không hợp lệ:", decodedUrl);
      await api.sendMessage(
        {
          msg: `@${senderName}, URL trong tin nhắn bạn reply Không phải là ảnh, GIF hoặc video hợp lệ.`,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length + 1, 0)],
          ttl: 30000,
        },
        threadId,
        message.type,
      );
      return;
    }

    const isVideo = mediaCheck.isVideo;
    const isXoaPhong =
      content.includes("xp") ||
      content.includes("xphong") ||
      content.includes("xoaphong");

    if (isXoaPhong && isVideo) {
      await api.sendMessage(
        {
          msg: `@${senderName} Chưa hỗ trợ xóa phông cho sticker video!`,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length + 1, 0)],
          ttl: 6000,
        },
        threadId,
        message.type,
      );
      return;
    }

    if (!isAdminBot && isVideo) {
      await api.sendMessage(
        {
          msg: `@${senderName}, Đại ca tao Không cho phép thành viên tạo sticker video.`,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length + 1, 0)],
          ttl: 30000,
        },
        threadId,
        message.type,
      );
      return;
    }

    await api.sendMessage(
      {
        msg: `@${senderName} Ok, đang tạo sticker, chờ một chút!`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length + 1, 0)],
        ttl: 6000,
      },
      threadId,
      message.type,
    );

    if (isXoaPhong) {
      const imageData = await removeBackground(decodedUrl);
      if (!imageData) {
        await api.sendMessage(
          {
            msg: `@${senderName}, Ựa, xóa phông lỗi hoặc hết cụ mịa ròi.`,
            quote: message,
            mentions: [MessageMention(senderId, senderName.length + 1, 0)],
            ttl: 30000,
          },
          threadId,
          message.type,
        );
        return;
      }
      await fs.writeFile(tempPath, imageData);
      tempPathCreated = true; // Đánh dấu tempPath đã được tạo
      await processAndSendSticker(api, message, tempPath);
    } else {
      await processAndSendSticker(api, message, decodedUrl);
    }
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh sticker:", error.message);
    await api.sendMessage(
      {
        msg: `@${senderName} Lỗi Khi Xử Lý Lệnh Sticker -> ${error.message}`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length + 1, 0)],
        ttl: 30000,
      },
      threadId,
      message.type,
    );
  } finally {
    // Chỉ xóa tempPath nếu nó được tạo (trong trường hợp xóa phông)
    if (tempPathCreated) {
      await deleteFile(tempPath);
    }
  }
}

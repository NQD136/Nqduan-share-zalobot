// src/Nqduan-service/utilities/qr-heart.js
import axios from "axios";
import path from "path";
import fs from "fs";
import {
  sendMessageCompleteRequest,
  sendMessageWarningRequest,
} from "../chat-zalo/chat-style/chat-style.js";
import { tempDir } from "../../utils/io-json.js";
import { getGlobalPrefix } from "../service.js";
import { removeMention } from "../../utils/format-util.js";
import { deleteFile } from "../../utils/util.js";

const CONFIG = {
  API_URL: "https://api.zeidteam.xyz/image-generator/qrcode-heart",
  TIMEOUTS: {
    WARNING: 30000,
    IMAGE: 3600000,
  },
};

/**
 * Gọi API để tạo QR heart
 * @param {string} text - Nội dung QR
 * @param {string} caption - Caption cho QR
 * @returns {Promise<string>} Đường dẫn file PNG tạm
 */
async function generateQRHeartWithAPI(text, caption) {
  if (typeof text !== "string" || !text.trim())
    throw new Error("Text không hợp lệ");

  // Nếu caption rỗng hoặc không phải string, dùng dấu cách làm mặc định
  const safeCaption =
    typeof caption === "string" && caption.trim() ? caption.trim() : " ";

  const params = new URLSearchParams({
    text: text.trim(),
    caption: safeCaption,
  });
  const apiUrl = `${CONFIG.API_URL}?${params.toString()}`;

  try {
    console.log(`Gọi API QR Heart: ${apiUrl}`, { text, caption: safeCaption });
    const response = await axios.get(apiUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const contentType = response.headers["content-type"];
    if (!contentType || !contentType.startsWith("image/")) {
      let errorMsg = "API không trả về image";
      try {
        const errorData = JSON.parse(
          Buffer.from(response.data).toString("utf-8"),
        );
        errorMsg = errorData.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const fileName = `qrheart_api_${Date.now()}.png`;
    const qrPath = path.join(tempDir, fileName);
    await fs.promises.mkdir(path.dirname(qrPath), { recursive: true });
    await fs.promises.writeFile(qrPath, response.data);

    if (!fs.existsSync(qrPath)) {
      throw new Error("Không thể lưu file từ API response");
    }

    console.log(`Tạo QR Heart thành công qua API: ${qrPath}`);
    return qrPath;
  } catch (error) {
    console.error("Lỗi khi gọi API QR Heart:", {
      message: error.message,
      responseData: error.response?.data
        ? Buffer.from(error.response.data).toString("utf-8")
        : "No response data",
      status: error.response?.status,
    });
    throw new Error(`API lỗi: ${error.message}`);
  }
}

export async function handleCreateQRHeartCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  let text = content.replace(`${prefix}${aliasCommand}`, "").trim();
  let qrPath = null;
  let caption = " "; // Default caption là dấu cách

  try {
    const quote = message.data?.quote;
    if (quote && !text) {
      try {
        const parseMessage = JSON.parse(quote.attach || "{}");
        text = parseMessage.href || parseMessage.title || quote.msg || "";
      } catch (err) {
        text = quote.msg || "";
      }
    }

    if (text.includes("|")) {
      const parts = text.split("|", 2);
      text = parts[0].trim();
      caption = parts[1]?.trim() || " ";
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      const object = {
        caption: `Vui lòng nhập nội dung cần tạo QR code hoặc reply tin nhắn chứa nội dung hợp lệ.\nVí dụ: ${prefix}${aliasCommand} Nội dung QR | Caption tùy chọn`,
      };
      await sendMessageWarningRequest(
        api,
        message,
        object,
        CONFIG.TIMEOUTS.WARNING,
      );
      return;
    }

    qrPath = await generateQRHeartWithAPI(text, caption);

    const object = {
      caption: `Đây là mã QR trái tim của bạn!`,
      imagePath: qrPath,
    };

    await sendMessageCompleteRequest(
      api,
      message,
      object,
      CONFIG.TIMEOUTS.IMAGE,
    );
  } catch (error) {
    console.error(
      `Lỗi khi xử lý lệnh qrheart (messageId: ${message?.messageID}):`,
      {
        message: error.message,
        stack: error.stack,
      },
    );
    const object = {
      caption: `Đã xảy ra lỗi khi tạo mã QR: ${error?.message || "Không xác định"}`,
    };
    await sendMessageWarningRequest(
      api,
      message,
      object,
      CONFIG.TIMEOUTS.WARNING,
    );
  } finally {
    if (qrPath) {
      try {
        await deleteFile(qrPath);
      } catch (err) {
        console.warn(`Không xóa được file tạm: ${qrPath}`, err?.message || err);
      }
    }
  }
}

export default {
  generateQRHeartWithAPI,
  handleCreateQRHeartCommand,
};

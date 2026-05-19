import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";

import {
  sendMessageStateQuote,
  sendMessageFailed,
} from "../chat-zalo/chat-style/chat-style.js";

import { nameServer } from "../../database/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const des = {
  name: "uidfb",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
};

// Gộp tag và chữ đỏ vào 1 dòng duy nhất
const getCleanNameServer = () => {
  const lines = nameServer
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  const tagLine = lines.find((line) => line.startsWith("@"));
  const boldLine = lines.find(
    (line) => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line),
  );

  return [tagLine, boldLine].filter(Boolean).join(" ");
};

export async function handleUidfbCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}uidfb`)) return false;

  const args = content
    .slice(currentPrefix.length + 5)
    .trim()
    .split(/\s+/);

  // Yêu cầu đúng 1 tham số (URL)
  if (args.length !== 1) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Sai cú pháp! Dùng: ${currentPrefix}uidfb <url>`,
      true,
      60000,
      false,
    );
  }

  const fbUrl = args[0];

  // Kiểm tra URL hợp lệ
  if (!/^https?:\/\/(www\.)?facebook\.com\//.test(fbUrl)) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ URL Facebook không hợp lệ!`,
      true,
      60000,
      false,
    );
  }

  const apiUrl = `https://anhcode.sbs/anhcode/api/facebook/layid.php?url=${encodeURIComponent(fbUrl)}`;
  console.log("Gọi API:", apiUrl);

  try {
    const res = await fetch(apiUrl);
    const json = await res.json();

    if (json.error !== 0 || !json.id) {
      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}❌ Không tìm thấy thông tin cho URL ${fbUrl}.`,
        true,
        60000,
        false,
      );
    }

    const msg = `📱 THÔNG TIN FACEBOOK

👤 Người Dùng:
➤ Tên: ${json.name}
➤ UID: ${json.id}
➤ Trạng thái: ${json.msg}

🛠️ Created by: Nqduan`;

    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}${msg}`,
      true,
      1800000,
      false,
    );
  } catch (e) {
    console.error("Lỗi API UIDFB:", e);
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`,
      true,
    );
  }
}

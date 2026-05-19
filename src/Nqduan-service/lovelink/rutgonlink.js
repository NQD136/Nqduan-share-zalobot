import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";

import {
  sendMessageStateQuote,
  sendMessageFailed
} from "../chat-zalo/chat-style/chat-style.js";

import { nameServer } from "../../database/index.js";

// ✅ Lấy header cho tin nhắn
const getCleanNameServer = () => {
  const lines = nameServer
    .split("\n")
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith("@"));
  const boldLine = lines.find(
    line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line) // <--- ĐÃ SỬA LỖI REGEX
  );

  return [tagLine, boldLine].filter(Boolean).join(" ");
};

// ✅ Thông tin mô tả lệnh
export const des = {
  name: "rutgonlink",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
};

// ✅ Hàm xử lý chính cho lệnh
export async function handleRutgonlinkCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  // Kiểm tra nếu tin nhắn bắt đầu bằng lệnh này
  if (!content.startsWith(`${currentPrefix}rutgonlink`)) return false;

  // Lấy URL từ nội dung tin nhắn
  const args = content.slice(currentPrefix.length + "rutgonlink".length).trim().split(/\s+/);
  const urlToShorten = args[0];

  // ✅ Nếu không nhập URL
  if (!urlToShorten) {
    const guide = `❌ Vui lòng nhập URL bạn muốn rút gọn.
    
👉 Ví dụ: ${currentPrefix}rutgonlink https://www.google.com`;

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${guide}`, true, 60000, true);
  }

  const apiUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(urlToShorten)}`;
  console.log("Gọi API is.gd:", apiUrl);

  try {
    const res = await fetch(apiUrl);
    
    const data = await res.json();

    if (!res.ok || data.errormessage) {
      const errorText = data.errormessage || 'URL không hợp lệ hoặc không thể rút gọn.';
      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}❌ ${errorText}`,
        true,
        60000,
        false
      );
    }

    const shortUrl = data.shorturl;

    const msg = `✅ RÚT GỌN LINK THÀNH CÔNG

➤ Link rút gọn: ${shortUrl}`;

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${msg}`, true, 3600000, false);
  } catch (e) {
    console.error("Lỗi API rutgonlink:", e);
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`,
      true
    );
  }
}
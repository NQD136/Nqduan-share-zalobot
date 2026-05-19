import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";

import {
  sendMessageStateQuote,
  sendMessageFailed
} from "../chat-zalo/chat-style/chat-style.js";

import { nameServer } from "../../database/index.js";

// ✅ Lấy header cho tin nhắn (giữ nguyên từ file lovelink.js)
const getCleanNameServer = () => {
  const lines = nameServer
    .split("\n")
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith("@"));
  const boldLine = lines.find(
    line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line)
  );

  return [tagLine, boldLine].filter(Boolean).join(" ");
};

// ✅ Thông tin mô tả lệnh
export const des = {
  name: "reverse",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
};

// ✅ Hàm xử lý chính cho lệnh
export async function handleReverseCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  // Kiểm tra nếu tin nhắn bắt đầu bằng lệnh này
  if (!content.startsWith(`${currentPrefix}reverse`)) return false;

  // Lấy toàn bộ nội dung sau tên lệnh
  const textToReverse = content.slice(currentPrefix.length + "reverse".length).trim();

  // ✅ Nếu không nhập nội dung
  if (!textToReverse) {
    const guide = `❌ Vui lòng nhập nội dung bạn muốn đảo ngược.
    
👉 Ví dụ: ${currentPrefix}reverse chào bạn nhé`;

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${guide}`, true, 60000, true);
  }

  // Mã hóa nội dung để đưa vào URL
  const apiUrl = `https://apinvh.zzux.com/api/example?text=${encodeURIComponent(textToReverse)}`;
  console.log("Gọi API Reverse:", apiUrl);

  try {
    const res = await fetch(apiUrl);
    
    // API này trả về JSON
    const data = await res.json();

    if (!res.ok || !data.reversed) {
      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}❌ Văn bản không hợp lệ hoặc không thể đảo ngược.`,
        true,
        60000,
        false
      );
    }

    // Lấy kết quả từ key 'reversed' trong JSON
    const msg = `✅ ĐẢO NGƯỢC VĂN BẢN THÀNH CÔNG

➤ Gốc: ${data.original}
➤ Đảo ngược: ${data.reversed}`;

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${msg}`, true, 3600000, false);
  } catch (e) {
    console.error("Lỗi API reverse:", e);
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`,
      true
    );
  }
}
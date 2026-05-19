import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";
import {
  sendMessageStateQuote,
  sendMessageFailed
} from "../chat-zalo/chat-style/chat-style.js";

import { nameServer } from "../../database/index.js";

// ✅ Ghép tag + chữ đỏ vào header tin nhắn
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

export async function handlelovelinkCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}lovelink`)) return false;

  const args = content.slice(currentPrefix.length + 8).trim().split(/\s+/).filter(Boolean);

  if (args.length < 2) {
    const guide = `❌ Vui lòng nhập đúng định dạng
${currentPrefix}lovelink Text Audio

Trong đó Audio bao gồm:
- Nơi Này Có Anh: nnca
- Phép Màu: pm
- Tín Hiệu Từ Trái Tim: thttt
- Có Chắc Yêu Là Đây: ccyld
- Cô Gái M52: cgm52
- Hẹn Gặp Em Dưới Ánh Trăng: hgedat
- Mượn Rượu Tỏ Tình: mrtt
- Người Âm Phủ: nap

👉 Audio viết dạng viết tắt`;

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${guide}`, true, 60000, true);
  }

  // ✅ Text là toàn bộ từ đầu trừ tham số cuối cùng (audio)
  const audio = args[args.length - 1];
  const text = args.slice(0, -1).join(" ");

  const apiUrl = `https://api.nemg.me/love?text=${encodeURIComponent(text)}&audio=${encodeURIComponent(audio)}`;
  console.log("Gọi API lovelink:", apiUrl);

  try {
    const res = await fetch(apiUrl);
    const json = await res.json();

    if (!res.ok || !json.success) {
      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}❌ Không tạo được love link với dữ liệu đã nhập.`,
        true,
        60000,
        false
      );
    }

    const msg = `💖 LOVE LINK ĐÃ TẠO THÀNH CÔNG

➤ Text: ${text}
➤ Audio: ${json.audioName || audio}
➤ Link: ${json.url}`;

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${msg}`, true, 3600000, false);
  } catch (e) {
    console.error("Lỗi API lovelink:", e);
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`,
      true
    );
  }
}
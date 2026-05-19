import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js"; // Giả định đường dẫn này đúng
import {
  sendMessageStateQuote,
  sendMessageFailed
} from "../chat-zalo/chat-style/chat-style.js"; // Giả định đường dẫn này đúng
import { nameServer } from "../../database/index.js"; // Giả định đường dẫn này đúng

// ✅ Ghép tag + chữ đỏ vào header tin nhắn (sao chép từ lovelink.js)
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

// Cấu hình lệnh
export const des = {
  name: "likeff",
  type: 1,
  permission: "all",
  countdown: 10, // Đặt thời gian chờ 10s cho lệnh buff
  active: true,
};

// Hàm xử lý lệnh
export async function handlelikeffCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  // Kiểm tra xem tin nhắn có phải là lệnh likeff không
  if (!content.startsWith(`${currentPrefix}likeff`)) return false;

  // Tách các tham số
  const args = content.slice(currentPrefix.length + 6).trim().split(/\s+/).filter(Boolean); // "likeff" dài 6 ký tự
  const header = getCleanNameServer();

  // --- 1. Xác thực đầu vào ---
  // Kiểm tra xem người dùng có nhập đúng 1 tham số (UID) không
  if (args.length !== 1 || !/^\d+$/.test(args[0])) {
    const guide = `❌ Vui lòng nhập đúng định dạng
${currentPrefix}likeff [UID]

Ví dụ: ${currentPrefix}likeff 1188416114`;

    return sendMessageStateQuote(api, message, `${header}${guide}`, true, 60000, true);
  }

  const uid = args[0];
  const apiUrl = `https://likeff01.vercel.app/like?uid=${encodeURIComponent(uid)}&server_name=VN`;
  console.log("Gọi API LikeFF:", apiUrl);

  try {
    // --- 2. Gọi API ---
    await sendMessageStateQuote(api, message, `${header}Đang tiến hành buff like cho UID: ${uid}...\nVui lòng chờ trong giây lát.`, true, 60000, true);
    
    const res = await fetch(apiUrl);
    const json = await res.json();

    // --- 3. Xử lý Lỗi từ API ---
    // Dựa vào JSON mẫu, 'status: 1' là thành công
    if (!res.ok || json.status !== 1) {
      const errorMsg = json.message || "Không thể buff like cho UID này. Vui lòng kiểm tra lại UID hoặc thử lại sau.";
      return sendMessageStateQuote(
        api,
        message,
        `${header}❌ ${errorMsg}`,
        true,
        60000,
        false
      );
    }

    // --- 4. Xử lý Thành công ---
    // Format tin nhắn trả về dựa trên JSON mẫu bạn cung cấp
    const msg = `✅ BUFF LIKE THÀNH CÔNG

💖 Nickname: ${json.PlayerNickname}
🆔 UID: ${json.UID}
📈 Like trước: ${json.LikesbeforeCommand.toLocaleString()}
🔥 Đã buff: ${json.LikesGivenByAPI.toLocaleString()}
📊 Like sau: ${json.LikesafterCommand.toLocaleString()}

Cảm ơn bạn đã sử dụng dịch vụ!`;

    return sendMessageStateQuote(api, message, `${header}${msg}`, true, 300000, false); // Tự hủy sau 5 phút

  } catch (e) {
    // --- 5. Xử lý Lỗi Hệ thống/Mạng ---
    console.error("Lỗi API LikeFF:", e);
    return sendMessageFailed(
      api,
      message,
      `${header}❌ Lỗi hệ thống: ${e.message}`,
      true
    );
  }
}

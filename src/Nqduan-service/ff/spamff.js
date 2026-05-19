import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js"; // Giả định đường dẫn này đúng
import {
  sendMessageStateQuote,
  sendMessageFailed
} from "../chat-zalo/chat-style/chat-style.js"; // Giả định đường dẫn này đúng
import { nameServer } from "../../database/index.js"; // Giả định đường dẫn này đúng

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

// --- LỆNH SPAMFF ---

// Cấu hình lệnh spamff
export const des = {
  name: "spamff",
  type: 1,
  permission: "all",
  countdown: 15, // Đặt thời gian chờ 15s cho lệnh spam
  active: true,
};

// Hàm xử lý lệnh spamff
export async function handleSpamffCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  // Kiểm tra xem tin nhắn có phải là lệnh spamff không
  if (!content.startsWith(`${currentPrefix}spamff`)) return false;

  // Tách các tham số
  const args = content.slice(currentPrefix.length + 6).trim().split(/\s+/).filter(Boolean); // "spamff" dài 6 ký tự
  const header = getCleanNameServer();

  // --- 1. Xác thực đầu vào ---
  if (args.length !== 1 || !/^\d+$/.test(args[0])) {
    const guide = `❌ Vui lòng nhập đúng định dạng
${currentPrefix}spamff [UID]

Ví dụ: ${currentPrefix}spamff 1188416114`;

    return sendMessageStateQuote(api, message, `${header}${guide}`, true, 60000, true);
  }

  const uid = args[0];
  const apiUrl = `https://spam-api-six.vercel.app/send_requests?uid=${encodeURIComponent(uid)}`;
  console.log("Gọi API SpamFF:", apiUrl);

  try {
    // --- 2. Gọi API ---
    await sendMessageStateQuote(api, message, `${header}Đang tiến hành spam kết bạn cho UID: ${uid}...\nVui lòng chờ trong giây lát.`, true, 60000, true);
    
    const res = await fetch(apiUrl);
    const json = await res.json();

    // --- 3. Xử lý Lỗi từ API ---
    // Dựa vào JSON mẫu, 'status: 1' là thành công
    if (!res.ok || json.status !== 1) {
      const errorMsg = json.message || "Không thể spam kết bạn cho UID này. Vui lòng kiểm tra lại UID hoặc thử lại sau.";
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
    const msg = `✅ SPAM KẾT BẠN HOÀN TẤT

🆔 UID: ${uid}
✔️ Thành công: ${json.success_count}
❌ Thất bại: ${json.failed_count}

Lưu ý: Nếu như danh sách kết bạn đã full thì sẽ không thể gửi thêm được nữa.`;

    return sendMessageStateQuote(api, message, `${header}${msg}`, true, 300000, false); // Tự hủy sau 5 phút

  } catch (e) {
    // --- 5. Xử lý Lỗi Hệ thống/Mạng ---
    console.error("Lỗi API SpamFF:", e);
    return sendMessageFailed(
      api,
      message,
      `${header}❌ Lỗi hệ thống: ${e.message}`,
      true
    );
  }
}

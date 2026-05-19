/*
 * Tên file: setavatar-account.js (V3)
 * Chức năng: Xử lý lệnh đổi avatar của chính tài khoản Bot.
 *
 * CẬP NHẬT (V3 - Sửa lỗi 207):
 * - Thêm logic "Padding" (độn file).
 * - Sau khi tải ảnh, kiểm tra dung lượng (file size).
 * - Nếu file < 7KB, tự động thêm
 * dữ liệu rỗng (padding) vào file cho đến khi đủ 7KB
 * trước khi gọi 'api.changeAccountAvatar' (file 110).
 */

// Import các hằng số Type
import { MessageType } from "../../api-zalo/index.js";

// Import các hàm tiện ích
import { isAdmin } from "../../index.js";
import path from "path";
import fs from "fs/promises"; // (Quan trọng: Dùng 'fs/promises' để lấy 'stat')
import { fileURLToPath } from "url";

// Import hàm download (từ file 111)
import { downloadFile } from "../../utils/util.js";

// Import các hàm gửi tin nhắn CÓ STYLE (từ file 93)
import {
  sendMessageWarning,
  sendMessageStateQuote,
  sendMessageProcessingRequest,
  sendMessageFailed,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

// Định nghĩa thư mục tạm (giống file 87)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.resolve(__dirname, "cache");

// (Hàm V2 - file 115 - Lấy URL từ Reply)
function getReplyMediaUrl(message) {
  const quote = message.data?.quote;
  if (!quote || !quote.attach) return null;

  try {
    const attachData = JSON.parse(quote.attach);
    const imageUrl = attachData.params
      ? JSON.parse(attachData.params)?.hd || attachData.href
      : attachData.href;
    return imageUrl;
  } catch (e) {
    return null;
  }
}

/**
 * Lệnh để đổi avatar Bot
 * (Yêu cầu quyền Admin Bot và Reply ảnh)
 * Cú pháp: !setbotavatar
 */
export async function handleSetBotAvatarCommand(api, message, aliasCommand) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  let tempAvatarPath = null;

  try {
    // =================================================================
    // --- PHẦN 1: KIỂM TRA QUYỀN VÀ YÊU CẦU ---
    // =================================================================

    if (!isAdmin(senderId)) {
      await sendMessageWarning(
        api,
        message,
        "Chỉ CHỦ SỞ HỮU BOT mới có quyền đổi avatar của Bot.",
        false,
        true,
      );
      return;
    }

    const avatarUrl = getReplyMediaUrl(message); // (Hàm V2)

    if (!avatarUrl) {
      await sendMessageWarning(
        api,
        message,
        `❌ Vui lòng Reply (trả lời) vào một tin nhắn có chứa ảnh để đặt làm Avatar.`,
        false,
        true,
      );
      return;
    }

    // =================================================================
    // --- PHẦN 2: TẢI ẢNH VỀ (LOGIC FILE 111) ---
    // =================================================================

    await sendMessageProcessingRequest(
      api,
      message,
      { caption: "Đang tải ảnh và chuẩn bị đổi Avatar..." },
      60000,
    );

    await fs.mkdir(CACHE_DIR, { recursive: true });

    const fileName = `bot_avatar_${Date.now()}.jpg`;
    tempAvatarPath = path.join(CACHE_DIR, fileName);

    await downloadFile(avatarUrl, tempAvatarPath);

    // =================================================================
    // --- PHẦN 3: (*** CODE MỚI: SỬA LỖI 207 ***) ---
    // =================================================================

    const MIN_SIZE_KB = 7;
    const MIN_SIZE_BYTES = MIN_SIZE_KB * 1024; // (7KB = 7168 Bytes)

    // 1. Lấy thông tin dung lượng file vừa tải
    const stats = await fs.stat(tempAvatarPath);
    const currentSize = stats.size;

    // 2. Kiểm tra nếu file quá nhỏ
    if (currentSize < MIN_SIZE_BYTES) {
      console.warn(
        `[SetBotAvatar] Ảnh quá nhỏ (${currentSize} bytes). Đang thêm padding...`,
      );

      // 3. Tính toán dung lượng cần độn
      const paddingSize = MIN_SIZE_BYTES - currentSize;

      // 4. Tạo một Buffer (dữ liệu rỗng)
      const paddingBuffer = Buffer.alloc(paddingSize);

      // 5. Nối (độn) dữ liệu rỗng vào cuối file ảnh
      await fs.appendFile(tempAvatarPath, paddingBuffer);

      console.log(
        `[SetBotAvatar] Đã độn ${paddingSize} bytes. Dung lượng mới: ${MIN_SIZE_BYTES} bytes.`,
      );
    }
    // (*** KẾT THÚC SỬA LỖI 207 ***)

    // =================================================================
    // --- PHẦN 4: GỌI API (FILE 110) ---
    // =================================================================

    // Gọi API (V3 - file 113 - đã sửa lỗi 'formatTime' (file 110))
    await api.changeAccountAvatar(tempAvatarPath);

    // Gửi thông báo thành công
    await sendMessageStateQuote(
      api,
      message,
      `✅ Đã đổi Avatar của Bot thành công!`,
      true,
      300000,
    );
  } catch (error) {
    // --- PHẦN 5: BÁO LỖI ---
    console.error("Lỗi khi đổi Avatar Bot:", error);
    await sendMessageFailed(
      api,
      message,
      `❌ Lỗi khi đổi Avatar Bot: ${error.message}`,
      true,
    );
  } finally {
    // --- PHẦN 6: DỌN DẸP FILE TẠM ---
    if (tempAvatarPath) {
      try {
        await fs.unlink(tempAvatarPath);
        console.log(`[SetBotAvatar] Đã xóa file tạm: ${tempAvatarPath}`);
      } catch (e) {
        console.warn(`[SetBotAvatar] Lỗi khi xóa file tạm: ${e.message}`);
      }
    }
  }
}

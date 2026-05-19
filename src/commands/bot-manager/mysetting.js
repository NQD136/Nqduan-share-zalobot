/*
 * Tên file: mysettings.js (hoặc mysetting.js)
 * Chức năng: Xử lý lệnh xem cài đặt của chính tài khoản Bot.
 * API sử dụng: api.getSettings() (từ file 91)
 *
 * CẬP NHẬT (V3 - file 97):
 * - Đã sửa lại 'formatSettingValue' để xử lý 'view_birthday: 2'
 * (và 'view_birthday: 0') một cách chính xác.
 */

// Import các hàm tiện ích (giống file 87)
import { isAdmin } from "../../index.js";

// Import các hàm gửi tin nhắn CÓ STYLE (từ file 93)
import {
  sendMessageWarning,
  sendMessageCompleteRequest, // (Dùng để gửi text dài)
  sendMessageFailed,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

// (*** PHẦN MỚI: BẢNG DỊCH ***)
// Dịch các key từ log của bạn (file 93)
const labels = {
  add_friend_via_contact: "Thêm bạn qua danh bạ",
  display_on_recommend_friend: "Hiển thị ở gợi ý kết bạn",
  add_friend_via_group: "Thêm bạn qua nhóm chung",
  add_friend_via_qr: "Thêm bạn qua QR Code",
  quick_message_status: "Trạng thái tin nhắn nhanh",
  show_online_status: "Hiển thị trạng thái online",
  accept_stranger_call: "Nhận cuộc gọi từ người lạ",
  archived_chat_status: "Trạng thái trò chuyện lưu trữ",
  receive_message: "Nhận tin nhắn (từ người lạ)",
  add_friend_via_phone: "Thêm bạn qua số điện thoại",
  display_seen_status: 'Hiển thị trạng thái "Đã xem"',
  view_birthday: "Hiển thị sinh nhật",
  setting_2FA_status: "Trạng thái xác thực 2 bước (2FA)",
};

/**
 * (*** HÀM ĐÃ SỬA LỖI (V3 - file 97) ***)
 * Hàm helper để dịch các giá trị 1, 0, 2
 * (Đã cập nhật logic cho 'view_birthday')
 */
function formatSettingValue(key, value) {
  // Cài đặt chung (Bật/Tắt)
  if (value === 1 || value === true) {
    return "Đã Bật";
  }
  if (value === 0 || value === false) {
    // (*** LOGIC SỬA LỖI ***)
    // Nếu là 'view_birthday' (file 91), 0 có nghĩa là "Chỉ mình tôi"
    if (key === "view_birthday") {
      return "Chỉ mình tôi (Tắt)";
    }
    // (*** KẾT THÚC SỬA ***)
    return "Đã Tắt";
  }

  // Cài đặt riêng
  if (key === "accept_stranger_call" && value === 2) {
    return "Từ bạn bè của bạn bè";
  }

  // (*** LOGIC SỬA LỖI (THEO CÂU HỎI CỦA BẠN - file 96) ***)
  if (key === "view_birthday" && value === 2) {
    return "Hiển thị (Ẩn năm sinh)";
  }
  // (*** KẾT THÚC SỬA ***)

  // Trả về giá trị gốc nếu không nhận dạng được
  return value;
}
// (*** KẾT THÚC PHẦN MỚI ***)

/**
 * Lệnh để xem cài đặt của Bot
 * (Yêu cầu quyền Admin Bot)
 * Cú pháp: !mysettings
 */
export async function handleMySettingsCommand(api, message, aliasCommand) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom; // (Lấy theo file 20, 30)

  try {
    // =================================================================
    // --- PHẦN 1: KIỂM TRA QUYỀN (CHỦ BOT) ---
    // =================================================================

    if (!isAdmin(senderId)) {
      await sendMessageWarning(
        api,
        message,
        "Chỉ CHỦ SỞ HỮU BOT mới có quyền xem cài đặt này.",
        false,
        true,
      );
      return;
    }

    // =================================================================
    // --- PHẦN 2: GỌI API (FILE 91) ---
    // =================================================================

    // Gọi API từ file 91 (đã sửa lỗi 602 - file 94)
    const settingsData = await api.getSettings();

    if (!settingsData) {
      throw new Error("API (file 91) không trả về dữ liệu.");
    }

    // =================================================================
    // --- PHẦN 3: ĐỊNH DẠNG VÀ GỬI KẾT QUẢ (ĐÃ SỬA) ---
    // =================================================================

    let output = "⚙️ CÀI ĐẶT TÀI KHOẢN BOT ⚙️\n\n";

    // Lặp qua tất cả cài đặt
    for (const [key, value] of Object.entries(settingsData)) {
      // Lấy tên Tiếng Việt (từ bảng dịch)
      const label = labels[key] || key;

      // Lấy giá trị Tiếng Việt (từ hàm format đã sửa V3)
      const formattedValue = formatSettingValue(key, value);

      // Thêm vào tin nhắn
      output += `▶️ ${label}: ${formattedValue}\n`;
    }

    // Gửi kết quả (dùng style của file 93)
    await sendMessageCompleteRequest(
      api,
      message,
      { caption: output.trim() }, // .trim() để xóa dòng trắng cuối
      300000, // Tự xóa sau 5 phút
    );
  } catch (error) {
    // --- PHẦN 4: BÁO LỖI ---
    console.error("Lỗi khi lấy Cài đặt Bot:", error);
    await sendMessageFailed(
      api,
      message,
      `Lỗi khi lấy cài đặt (file 91): ${error.message}`,
      true,
    );
  }
}

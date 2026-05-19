/*
 * Tên file: dispersegroup.js
 * Chức năng: Xử lý lệnh giải tán (xóa) nhóm vĩnh viễn (Bản đơn giản).
 * API sử dụng: api.disperseGroup(groupId) (từ file 39)
 *
 * CẢNH BÁO: Lệnh này RẤT NGUY HIỂM.
 * Chỉ yêu cầu quyền Admin Nhóm.
 */

// Import các hằng số Type
import { MessageType } from "../../api-zalo/index.js";

// Import các hàm tiện ích
import { isAdmin } from "../../index.js"; // Giống file 20, 54

// Import các hàm gửi tin nhắn CÓ STYLE
import {
  sendMessageWarning,
  sendMessageFailed,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

/**
 * Lệnh để GIẢI TÁN VĨNH VIỄN nhóm
 * Cú pháp: !disperse
 */
export async function handleDisperseGroupCommand(api, message, aliasCommand) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom; // (Lấy theo file 20, 30, 54)

  try {
    // =================================================================
    // --- PHẦN 1: KIỂM TRA QUYỀN VÀ BỐI CẢNH ---
    // =================================================================

    // 1. Kiểm tra có phải nhóm không
    if (message.type !== MessageType.GroupMessage) {
      await sendMessageWarning(
        api,
        message,
        "Lệnh này chỉ có thể dùng trong nhóm chat.",
        false,
        true,
      );
      return;
    }

    // 2. Kiểm tra quyền Admin Nhóm
    if (!isAdmin(senderId, threadId)) {
      await sendMessageWarning(
        api,
        message,
        "Chỉ Quản trị viên nhóm mới có quyền giải tán nhóm.",
        false,
        true,
      );
      return;
    }

    // =================================================================
    // --- PHẦN 2: THỰC THI LỆNH ---
    // =================================================================

    // Gửi thông báo cuối cùng TRƯỚC KHI bị kick
    await sendMessageWarning(
      api,
      message,
      "⚠️ Đang tiến hành GIẢI TÁN NHÓM...",
      false,
      3000,
    );

    // Gọi API từ file 39
    await api.disperseGroup(threadId);

    // (Bot sẽ bị xóa khỏi nhóm ngay sau lệnh này,
    // nên không thể gửi tin nhắn "Thành công")
  } catch (error) {
    // Lỗi này thường xảy ra nếu bot KHÔNG PHẢI LÀ CHỦ NHÓM (Creator)
    console.error("Lỗi khi giải tán nhóm:", error);
    await sendMessageFailed(
      api,
      message,
      `Lỗi khi giải tán nhóm: ${error.message}\n(Lưu ý: Chỉ CHỦ NHÓM (Creator) mới có thể giải tán nhóm).`,
      true,
    );
  }
}

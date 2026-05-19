/*
 * Tên file: kiemtra.js
 * Chức năng: Xử lý lệnh kiểm tra trạng thái bạn bè.
 * API sử dụng: api.getFriendRequestStatus(friendId) (từ file 62)
 *
 * CẬP NHẬT:
 * - Import và sử dụng 'getUserInfoData' (từ file 30)
 * để lấy tên thật của người dùng thay vì dùng 'dName' từ mention.
 */

// Import các hằng số Type
import { MessageType } from "../../api-zalo/index.js";

// --- IMPORT MỚI (TỪ FILE 30) ---
// (Lấy đường dẫn chuẩn từ file 19, 29)
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";

// Import các hàm tiện ích
import { isAdmin } from "../../index.js";
import { removeMention } from "../../utils/format-util.js";

// Import các hàm gửi tin nhắn CÓ STYLE
import {
  sendMessageWarning,
  sendMessageComplete,
  sendMessageFailed,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

/**
 * Hàm thông dịch kết quả API (Đã sửa từ feedback)
 */
function formatFriendStatus(data) {
  if (data.is_friend === 1) {
    return "Đã là bạn bè.";
  }
  if (data.is_requesting === 1) {
    return "Đã nhận được lời mời kết bạn từ người này (Đang chờ bạn đồng ý).";
  }
  if (data.is_requested === 1) {
    return "Đã gửi lời mời kết bạn cho người này (Đang chờ họ đồng ý).";
  }
  return "Chưa phải là bạn bè.";
}

/**
 * Lệnh để kiểm tra trạng thái bạn bè
 * Cú pháp:
 * 1. !kiemtra @tag
 * 2. !kiemtra (và reply một người)
 */
export async function handlekiemtracommand(api, message, aliasCommand) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;

  try {
    // =================================================================
    // --- PHẦN 1: LẤY MỤC TIÊU (TARGET) (ĐÃ SỬA) ---
    // =================================================================

    let mentions = message.data?.mentions || [];
    let replyData = message.data?.reply;

    let targetUid;
    // (Xóa bỏ targetName cũ)

    // Ưu tiên Tag (Mention)
    if (mentions && Array.isArray(mentions) && mentions.length > 0) {
      targetUid = mentions[0].uid;
    }
    // Nếu không có Tag, kiểm tra Reply
    else if (replyData && replyData.uid) {
      targetUid = replyData.uid;
    }
    // Nếu không có cả hai, báo lỗi
    else {
      await sendMessageWarning(
        api,
        message,
        "Bạn phải @tag hoặc Reply (trả lời) một người để kiểm tra.",
        false,
        true,
      );
      return;
    }

    // --- (LOGIC MỚI: DÙNG FILE 30) ---
    // Lấy thông tin người dùng (từ file 30) để có tên chính xác
    const userInfo = await getUserInfoData(api, targetUid);

    // Nếu API (file 30) lỗi, dùng fallback "User [ID]"
    const targetName = userInfo ? userInfo.name : `User ${targetUid}`;
    // --- (KẾT THÚC LOGIC MỚI) ---

    // =================================================================
    // --- PHẦN 2: GỌI API (FILE 62) ---
    // =================================================================

    // Gọi API từ file 62
    const statusData = await api.getFriendRequestStatus(targetUid);

    // Thông dịch kết quả (với hàm đã sửa)
    const statusText = formatFriendStatus(statusData);

    // Gửi thông báo thành công (với tên đã được lấy)
    const successMsg = `Trạng thái kết bạn với "${targetName}":\n\n${statusText}`;

    await sendMessageComplete(api, message, successMsg, false, 60000);
  } catch (error) {
    // --- PHẦN 3: BÁO LỖI ---
    console.error("Lỗi khi kiểm tra trạng thái bạn bè:", error);
    await sendMessageFailed(
      api,
      message,
      `Lỗi khi kiểm tra: ${error.message}`,
      true,
    );
  }
}

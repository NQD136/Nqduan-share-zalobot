/*
 * Tên file: block-friend.js
 * Chức năng: Xử lý hai lệnh riêng biệt: !blockmessage và !unblockmessage.
 * API sử dụng: api.blockUser (file 107) và api.unblockUser (file 96)
 */

// Import các hằng số Type
import { MessageType } from "../../api-zalo/index.js";

// Import các hàm tiện ích
import { isAdmin } from "../../index.js"; // Dùng isAdmin global (chủ bot)
import { removeMention } from "../../utils/format-util.js";

// Import các hàm data (từ file 30)
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";

// Import các hàm gửi tin nhắn CÓ STYLE (từ file 93)
import {
  sendMessageWarning,
  sendMessageStateQuote,
  sendMessageFailed,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

/**
 * Hàm tiện ích lấy mục tiêu (TAG/REPLY)
 */
async function getTargetUser(api, message) {
  let mentions = message.data?.mentions || [];
  let replyData = message.data?.reply;

  let targetUid;

  // Ưu tiên Tag (Mention)
  if (mentions && Array.isArray(mentions) && mentions.length > 0) {
    targetUid = mentions[0].uid;
  }
  // Nếu không có Tag, kiểm tra Reply
  else if (replyData && replyData.uid) {
    targetUid = replyData.uid;
  }

  if (!targetUid) return null;

  // Lấy tên thật (file 30)
  const userInfo = await getUserInfoData(api, targetUid).catch((e) => null);
  const targetName = userInfo ? userInfo.name : `User ID: ${targetUid}`;

  return { targetUid, targetName };
}

// =================================================================
// --- LỆNH 1: CHẶN TIN NHẮN (!blockmessage) ---
// =================================================================
/**
 * Lệnh để chặn người dùng (Block Message)
 * Cú pháp: !blockmessage @tag
 */
export async function handleBlockMessageCommand(api, message, aliasCommand) {
  const senderId = message.data.uidFrom;

  if (!isAdmin(senderId)) {
    await sendMessageWarning(
      api,
      message,
      "Chỉ CHỦ SỞ HỮU BOT mới có quyền chặn người dùng.",
      false,
      true,
    );
    return;
  }

  const target = await getTargetUser(api, message);

  if (!target) {
    await sendMessageWarning(
      api,
      message,
      `❌ Vui lòng @tag hoặc Reply (trả lời) người dùng muốn chặn.`,
      false,
      true,
    );
    return;
  }

  const { targetUid, targetName } = target;

  const botId = await api.getOwnId();
  if (targetUid === botId) {
    await sendMessageWarning(
      api,
      message,
      "❌ Không thể tự chặn chính mình.",
      false,
      true,
    );
    return;
  }

  try {
    await api.blockUser(targetUid); //

    await sendMessageStateQuote(
      api,
      message,
      `✅ Đã chặn tin nhắn thành công với ${targetName}.\nBạn sẽ không nhận được tin nhắn từ người này nữa.`,
      true,
      300000,
    );
  } catch (error) {
    const errorMsg = error.message.includes("403")
      ? "Bot không đủ quyền thực hiện hành động này."
      : error.message;
    console.error(`Lỗi khi chặn tin nhắn:`, error);
    await sendMessageFailed(
      api,
      message,
      `❌ Lỗi khi chặn tin nhắn: ${errorMsg}`,
      true,
    );
  }
}

// =================================================================
// --- LỆNH 2: BỎ CHẶN TIN NHẮN (!unblockmessage) ---
// =================================================================
/**
 * Lệnh để bỏ chặn người dùng (Unblock Message)
 * Cú pháp: !unblockmessage @tag
 */
export async function handleUnblockMessageCommand(api, message, aliasCommand) {
  const senderId = message.data.uidFrom;

  if (!isAdmin(senderId)) {
    await sendMessageWarning(
      api,
      message,
      "Chỉ CHỦ SỞ HỮU BOT mới có quyền bỏ chặn người dùng.",
      false,
      true,
    );
    return;
  }

  const target = await getTargetUser(api, message);

  if (!target) {
    await sendMessageWarning(
      api,
      message,
      `❌ Vui lòng @tag hoặc Reply (trả lời) người dùng muốn bỏ chặn.`,
      false,
      true,
    );
    return;
  }

  const { targetUid, targetName } = target;

  try {
    await api.unblockUser(targetUid); //

    await sendMessageStateQuote(
      api,
      message,
      `✅ Đã bỏ chặn tin nhắn thành công với ${targetName}.\nBạn đã có thể nhận tin nhắn từ người này.`,
      true,
      300000,
    );
  } catch (error) {
    const errorMsg = error.message.includes("403")
      ? "Bot không đủ quyền thực hiện hành động này."
      : error.message;
    console.error(`Lỗi khi bỏ chặn tin nhắn:`, error);
    await sendMessageFailed(
      api,
      message,
      `❌ Lỗi khi bỏ chặn tin nhắn: ${errorMsg}`,
      true,
    );
  }
}

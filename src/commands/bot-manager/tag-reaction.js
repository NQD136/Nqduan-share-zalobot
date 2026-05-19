import { sendMessageFromSQL } from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { groupSettingsAll } from "../../automations/event-send-msg.js";
import { isAdmin } from "../../index.js";

export async function handleTagReactionCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const botId = api.getBotId();

  // Kiểm tra quyền admin bot
  const isAdminBot = isAdmin(botId, senderId, threadId);
  if (!isAdminBot) {
    const result = {
      success: false,
      message: "❌ Chỉ quản trị viên bot mới có thể sử dụng lệnh này!",
    };
    await sendMessageFromSQL(api, message, result, true, 10000);
    return false;
  }

  // Khởi tạo setting nếu chưa có
  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  // Toggle setting
  const currentSetting = groupSettings[threadId].tagReaction || false;
  groupSettings[threadId].tagReaction = !currentSetting;
  groupSettingsAll.setChanged();

  const statusText = groupSettings[threadId].tagReaction ? "BẬT" : "TẮT";
  const statusEmoji = groupSettings[threadId].tagReaction ? "✅" : "❌";

  const result = {
    success: true,
    message: `${statusEmoji} Đã ${statusText} tính năng phản ứng khi được tag!\n\n📝 Trạng thái: ${groupSettings[threadId].tagReaction ? "Bot sẽ thả nhiều reaction khi được tag" : "Bot sẽ không phản ứng khi được tag"}\n\n💡 Cách sử dụng: Tag tên bot trong tin nhắn để xem hiệu ứng`,
  };

  await sendMessageFromSQL(api, message, result, true, 10000);
  return true;
}

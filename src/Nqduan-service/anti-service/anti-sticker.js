import { removeMention } from "../../utils/format-util.js";
import { sendMessageStateQuote, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js"; 
import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
// Sửa import hàm tạo ảnh
import { createAntiStickerImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";

let stickerSendCount = {};
let stickerSendTime = {};

export async function handleAntiSticker(api, message, groupSettings) {
  const threadId = message.threadId, prefix = getGlobalPrefix(), content = removeMention(message).trim();
  if (!content.startsWith(`${prefix}antisticker`)) return false;
  if (!groupSettings[threadId]) groupSettings[threadId] = {};
  const parts = content.split(" ");
  if (parts.length === 1) groupSettings[threadId].antiSticker = !groupSettings[threadId].antiSticker;
  else if (parts[1] === "on") groupSettings[threadId].antiSticker = true;
  else if (parts[1] === "off") groupSettings[threadId].antiSticker = false;
  else { await sendMessageWarning(api, message, `❌ Sai cú pháp. Dùng: ${prefix}antisticker [on/off]`); return true; }
  const status = groupSettings[threadId].antiSticker ? "bật" : "tắt";
  await sendMessageStateQuote(api, message, `Chức năng chống gửi sticker hệ thống đã ${status}`, groupSettings[threadId].antiSticker, 300000);
  return true; 
}

export async function antiSticker(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf) {
  const threadId = message.threadId, senderId = message.data.uidFrom, senderName = message.data.dName, botId = getBotId();
  if (!botIsAdminBox || isAdminBox || isSelf || !groupSettings?.[threadId]?.antiSticker) return false;

  if (message?.data?.msgType === "chat.sticker") {
    await api.deleteMessage(message, false).catch(console.error);
    await updateStickerCount(api, message, threadId, senderId, senderName, botId, isAdminBox);
    return true;
  }
  return false;
}

async function updateStickerCount(api, message, threadId, senderId, senderName, botId, isAdminBox) {
  if (!stickerSendCount[senderId]) { stickerSendCount[senderId] = 0; stickerSendTime[senderId] = Date.now(); }
  stickerSendCount[senderId]++;
  if (isAdminBox && senderId !== botId) return;
  if (Date.now() - stickerSendTime[senderId] < 60 * 1000) {
    if (stickerSendCount[senderId] > 2) return await blockUser(api, message, threadId, senderId, senderName);
  } else { stickerSendCount[senderId] = 1; stickerSendTime[senderId] = Date.now(); }
  await sendWarningMessage(api, message, senderId, senderName, stickerSendCount[senderId]);
}

async function sendWarningMessage(api, message, senderId, senderName, count) {
  let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây không được phép gửi sticker`;
  if (count === 2) caption = `⚠️ Cảnh cáo ${senderName}!\nNgưng gửi sticker nếu không muốn bị kick khỏi nhóm!`;
  await api.sendMessage({ msg: caption, mentions: [MessageMention(senderId, senderName.length, "⚠️ Cảnh cáo ".length)], quote: message, ttl: 300000 },
    message.threadId, MessageType.GroupMessage);
}

async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId); const userInfo = await getUserInfoData(api, senderId);
    // Sửa hàm tạo ảnh
    const imagePath = await createAntiStickerImage(userInfo, groupInfo.name, groupInfo.groupType, userInfo.gender);
    // Xóa quote
    await api.sendMessage({ msg: `🚫 Người dùng [ ${senderName} ] đã bị chặn vì spam sticker!`, attachments: imagePath ? [imagePath] : [], ttl: 300000 },
      threadId, MessageType.GroupMessage);
    await clearImagePath(imagePath);
  } catch (err) { console.error(`Không thể chặn ${senderName}:`, err.message); }
}
import { removeMention } from "../../utils/format-util.js";
import { sendMessageStateQuote, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js"; 
import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
// Sửa import hàm tạo ảnh
import { createAntiVoiceImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";

let voiceSendCount = {};
let voiceSendTime = {};

export async function handleAntiVoice(api, message, groupSettings) {
  const threadId = message.threadId, prefix = getGlobalPrefix(), content = removeMention(message).trim();
  if (!content.startsWith(`${prefix}antivoice`)) return false;
  if (!groupSettings[threadId]) groupSettings[threadId] = {};
  const parts = content.split(" ");
  if (parts.length === 1) groupSettings[threadId].antiVoice = !groupSettings[threadId].antiVoice;
  else if (parts[1] === "on") groupSettings[threadId].antiVoice = true;
  else if (parts[1] === "off") groupSettings[threadId].antiVoice = false;
  else { await sendMessageWarning(api, message, `❌ Sai cú pháp. Dùng: ${prefix}antivoice [on/off]`); return true; }
  const status = groupSettings[threadId].antiVoice ? "bật" : "tắt";
  await sendMessageStateQuote(api, message, `Chức năng chống gửi voice đã ${status}`, groupSettings[threadId].antiVoice, 300000);
  return true;
}

export async function antiVoice(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf) {
  const threadId = message.threadId, senderId = message.data.uidFrom, senderName = message.data.dName, botId = getBotId();
  if (!botIsAdminBox || isAdminBox || isSelf || !groupSettings?.[threadId]?.antiVoice) return false;

  let isDelete = false, content = message.data.content || "";
  if (message?.data?.msgType === "chat.voice") { await api.deleteMessage(message, false).catch(console.error); isDelete = true; }
  if (typeof content === "string" && /\.(mp3|wav|aac)/i.test(content)) { await api.deleteMessage(message, false).catch(console.error); isDelete = true; }

  if (isDelete) { await updateVoiceCount(api, message, threadId, senderId, senderName, botId, isAdminBox); return true; }
  return false;
}

async function updateVoiceCount(api, message, threadId, senderId, senderName, botId, isAdminBox) {
  if (!voiceSendCount[senderId]) { voiceSendCount[senderId] = 0; voiceSendTime[senderId] = Date.now(); }
  voiceSendCount[senderId]++;
  if (isAdminBox && senderId !== botId) return;
  if (Date.now() - voiceSendTime[senderId] < 60 * 1000) {
    if (voiceSendCount[senderId] > 2) return await blockUser(api, message, threadId, senderId, senderName);
  } else { voiceSendCount[senderId] = 1; voiceSendTime[senderId] = Date.now(); }
  await sendWarningMessage(api, message, senderId, senderName, voiceSendCount[senderId]);
}

async function sendWarningMessage(api, message, senderId, senderName, count) {
  let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây không được phép gửi voice`;
  if (count === 2) caption = `⚠️ Cảnh cáo ${senderName}!\nNgưng gửi voice nếu không muốn bị kick khỏi nhóm!`;
  await api.sendMessage({ msg: caption, mentions: [MessageMention(senderId, senderName.length, "⚠️ Cảnh cáo ".length)], quote: message, ttl: 300000 },
    message.threadId, MessageType.GroupMessage);
}

async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId); const userInfo = await getUserInfoData(api, senderId);
    // Sửa hàm tạo ảnh
    const imagePath = await createAntiVoiceImage(userInfo, groupInfo.name, groupInfo.groupType, userInfo.gender);
    // Xóa quote
    await api.sendMessage({ msg: `🚫 Thành viên [ ${senderName} ] đã bị chặn vì spam voice!`,ttl: 3600000, attachments: imagePath ? [imagePath] : [],ttl: 3600000, },
      threadId, MessageType.GroupMessage);
    await clearImagePath(imagePath);
  } catch (err) { console.error(`Không thể chặn ${senderName}:`, err.message); }
}
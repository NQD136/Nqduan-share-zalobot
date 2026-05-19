import { removeMention } from "../../utils/format-util.js";
import { sendMessageStateQuote, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js"; 
import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
// Sửa import hàm tạo ảnh
import { createAntiVideoImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";

let videoSendCount = {};
let videoSendTime = {};

export async function handleAntiVideo(api, message, groupSettings) {
  const threadId = message.threadId, prefix = getGlobalPrefix(), content = removeMention(message).trim();
  if (!content.startsWith(`${prefix}antivideo`)) return false;
  if (!groupSettings[threadId]) groupSettings[threadId] = {};
  const parts = content.split(" ");
  if (parts.length === 1) groupSettings[threadId].antiVideo = !groupSettings[threadId].antiVideo;
  else if (parts[1] === "on") groupSettings[threadId].antiVideo = true;
  else if (parts[1] === "off") groupSettings[threadId].antiVideo = false;
  else { await sendMessageWarning(api, message, `❌ Sai cú pháp. Dùng: ${prefix}antivideo [on/off]`); return true; }
  const status = groupSettings[threadId].antiVideo ? "bật" : "tắt";
  await sendMessageStateQuote(api, message, `Chức năng chống gửi video đã ${status}`, groupSettings[threadId].antiVideo, 300000);
  return true;
}

export async function antiVideo(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf) {
  const threadId = message.threadId, senderId = message.data.uidFrom, senderName = message.data.dName, botId = getBotId();
  if (!botIsAdminBox || isAdminBox || isSelf || !groupSettings?.[threadId]?.antiVideo) return false;

  let isDelete = false, content = message.data.content || "";
  if (message?.data?.msgType === "chat.video.msg") { await api.deleteMessage(message, false).catch(console.error); isDelete = true; }
  if (typeof content === "string" && /\.mp4/i.test(content)) { await api.deleteMessage(message, false).catch(console.error); isDelete = true; }

  if (isDelete) { await updateVideoCount(api, message, threadId, senderId, senderName, botId, isAdminBox); return true; }
  return false;
}

async function updateVideoCount(api, message, threadId, senderId, senderName, botId, isAdminBox) {
  if (!videoSendCount[senderId]) { videoSendCount[senderId] = 0; videoSendTime[senderId] = Date.now(); }
  videoSendCount[senderId]++;
  if (isAdminBox && senderId !== botId) return;
  if (Date.now() - videoSendTime[senderId] < 60 * 1000) {
    if (videoSendCount[senderId] > 2) return await blockUser(api, message, threadId, senderId, senderName);
  } else { videoSendCount[senderId] = 1; videoSendTime[senderId] = Date.now(); }
  await sendWarningMessage(api, message, senderId, senderName, videoSendCount[senderId]);
}

async function sendWarningMessage(api, message, senderId, senderName, count) {
  let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây không được phép gửi video`;
  if (count === 2) caption = `⚠️ Cảnh cáo ${senderName}!\nNgưng gửi video nếu không muốn bị kick khỏi nhóm!`;
  await api.sendMessage({ msg: caption, mentions: [MessageMention(senderId, senderName.length, "⚠️ Cảnh cáo ".length)], quote: message, ttl: 300000 },
    message.threadId, MessageType.GroupMessage);
}

async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId); const userInfo = await getUserInfoData(api, senderId);
    // Sửa hàm tạo ảnh
    const imagePath = await createAntiVideoImage(userInfo, groupInfo.name, groupInfo.groupType, userInfo.gender);
    // Xóa quote
    await api.sendMessage({ msg: `🚫 Thành viên [ ${senderName} ] đã bị chặn vì spam video!`, attachments: imagePath ? [imagePath] : [], ttl: 300000 },
      threadId, MessageType.GroupMessage);
    await clearImagePath(imagePath);
  } catch (err) { console.error(`Không thể chặn ${senderName}:`, err.message); }
}
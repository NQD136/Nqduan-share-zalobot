import { removeMention } from "../../utils/format-util.js";
import { sendMessageStateQuote, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
// Sửa import hàm tạo ảnh
import { createAntiPhotoImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";

// Bộ đếm vi phạm
let photoSendCount = {};
let photoSendTime = {};

export async function handleAntiPhoto(api, message, groupSettings) {
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const content = removeMention(message).trim();

  if (!content.startsWith(`${prefix}antiphoto`)) return false;

  const parts = content.split(" ");
  if (!groupSettings[threadId]) groupSettings[threadId] = {};

  if (parts.length === 1) {
    groupSettings[threadId].antiPhoto = !groupSettings[threadId].antiPhoto;
  } else if (parts[1] === "on") {
    groupSettings[threadId].antiPhoto = true;
  } else if (parts[1] === "off") {
    groupSettings[threadId].antiPhoto = false;
  } else {
    await sendMessageWarning(api, message, `❌ Sai cú pháp. Dùng: ${prefix}antiphoto [on/off]`);
    return true;
  }

  const status = groupSettings[threadId].antiPhoto ? "bật" : "tắt";
  await sendMessageStateQuote(api, message, `Chức năng chống gửi ảnh và stickercustom đã ${status}`, groupSettings[threadId].antiPhoto, 300000);

  return true;
}

export async function antiPhoto(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const botId = getBotId();

  if (!botIsAdminBox || isAdminBox || isSelf || !groupSettings?.[threadId]?.antiPhoto) return false;

  let isDelete = false;
  const content = message.data.content || "";

  // 1. Tin nhắn dạng ảnh
  if (message?.data?.msgType === "chat.photo") {
    await api.deleteMessage(message, false).catch(console.error);
    isDelete = true;
  }

  // 2. Tin nhắn chứa link .jpg
  if (typeof content === "string" && /\.jpg/i.test(content)) {
    await api.deleteMessage(message, false).catch(console.error);
    isDelete = true;
  }

  if (isDelete) {
    await updatePhotoCount(api, message, threadId, senderId, senderName, botId, isAdminBox);
    return true;
  }

  return false;
}

// Đếm số lần vi phạm
async function updatePhotoCount(api, message, threadId, senderId, senderName, botId, isAdminBox) {
  if (!photoSendCount[senderId]) {
    photoSendCount[senderId] = 0;
    photoSendTime[senderId] = Date.now();
  }

  photoSendCount[senderId]++;

  if (isAdminBox && senderId !== botId) return;

  // Nếu vi phạm nhiều lần trong 1 phút
  if (Date.now() - photoSendTime[senderId] < 60 * 1000) {
    if (photoSendCount[senderId] > 2) {
      await blockUser(api, message, threadId, senderId, senderName);
      return;
    }
  } else {
    photoSendCount[senderId] = 1;
    photoSendTime[senderId] = Date.now();
  }

  await sendWarningMessage(api, message, senderId, senderName, photoSendCount[senderId]);
}

// Cảnh cáo
async function sendWarningMessage(api, message, senderId, senderName, count) {
  let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây không được phép gửi ảnh và stickercustom`;
  if (count === 2) caption = `⚠️ Cảnh cáo ${senderName}!\nNgưng gửi ảnh và stickercustom nếu không muốn bị kick khỏi nhóm!`;

  await api.sendMessage(
    {
      msg: caption,
      mentions: [MessageMention(senderId, senderName.length, "⚠️ Cảnh cáo ".length)],
      quote: message,
      ttl: 300000,
    },
    message.threadId,
    MessageType.GroupMessage
  );
}

// Block user spam
async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId);
    const userInfo = await getUserInfoData(api, senderId);
    // Sửa hàm tạo ảnh
    const imagePath = await createAntiPhotoImage(userInfo, groupInfo.name, groupInfo.groupType, userInfo.gender);

    await api.sendMessage(
      {
        // Sửa msg và xóa quote
        msg: `🚫 Người dùng [ ${senderName} ] đã bị chặn vì spam ảnh & stickercustom !`, 
        attachments: imagePath ? [imagePath] : [],
        ttl: 3600000,
      },
      threadId,
      MessageType.GroupMessage
    );

    await clearImagePath(imagePath);
  } catch (err) {
    console.error(`Không thể chặn người dùng ${senderName}:`, err.message);
  }
}
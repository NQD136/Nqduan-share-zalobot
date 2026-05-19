import { removeMention } from "../../utils/format-util.js";
import { sendMessageStateQuote, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js"; 
import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
// Sửa import hàm tạo ảnh
import { createAntiStickerEffectImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Lấy thư mục chứa file anti-stickereffect.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc danh sách sticker hiệu ứng từ file list.json
const stickerEffectList = JSON.parse(fs.readFileSync(path.join(__dirname, "list.json"), "utf8"));

// Biến lưu trữ số lần gửi sticker và thời gian
let stickerEffectSendCount = {};
let stickerEffectSendTime = {};

export async function handleAntiStickerEffect(api, message, groupSettings) {
  const threadId = message.threadId, prefix = getGlobalPrefix(), content = removeMention(message).trim();
  if (!content.startsWith(`${prefix}antistickereffect`)) return false;
  if (!groupSettings[threadId]) groupSettings[threadId] = {};
  const parts = content.split(" ");
  if (parts.length === 1) groupSettings[threadId].antiStickerEffect = !groupSettings[threadId].antiStickerEffect;
  else if (parts[1] === "on") groupSettings[threadId].antiStickerEffect = true;
  else if (parts[1] === "off") groupSettings[threadId].antiStickerEffect = false;
  else {
    await sendMessageWarning(api, message, `❌ Sai cú pháp. Dùng: ${prefix}antistickereffect [on/off]`);
    return true;
  }
  const status = groupSettings[threadId].antiStickerEffect ? "bật" : "tắt";
  await sendMessageStateQuote(api, message, `Chức năng chống gửi sticker hiệu ứng đã ${status}`, groupSettings[threadId].antiStickerEffect, 300000);
  return true; 
}

export async function antiStickerEffect(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf) {
  const threadId = message.threadId, senderId = message.data.uidFrom, senderName = message.data.dName, botId = getBotId();
  if (!botIsAdminBox || isAdminBox || isSelf || !groupSettings?.[threadId]?.antiStickerEffect) {
    return false;
  }

  if (message?.data?.msgType === "chat.sticker") {
    const { id: stickerId, catId: cateId, type: stickerType } = message?.data?.content || {};
    const isEffectSticker = stickerEffectList.some(
      (sticker) =>
        sticker.stickerType !== undefined &&
        sticker.stickerId === Number(stickerId) &&
        sticker.cateId === Number(cateId) &&
        sticker.stickerType === Number(stickerType)
    );
    if (isEffectSticker) {
      if (botIsAdminBox) {
        await api.deleteMessage(message, false).catch(error => console.error("Failed to delete sticker:", error.message));
      } else {
        console.log("Bot lacks admin permissions, sending warning only");
      }
      await updateStickerEffectCount(api, message, threadId, senderId, senderName, botId, isAdminBox, stickerId, cateId, stickerType);
      return true;
    }
    return false;
  }
  return false;
}

async function updateStickerEffectCount(api, message, threadId, senderId, senderName, botId, isAdminBox, stickerId, cateId, stickerType) {
  if (!stickerEffectSendCount[senderId]) {
    stickerEffectSendCount[senderId] = 0;
    stickerEffectSendTime[senderId] = Date.now();
  }
  stickerEffectSendCount[senderId]++;
  if (isAdminBox && senderId !== botId) return;
  if (Date.now() - stickerEffectSendTime[senderId] < 60 * 1000) {
    if (stickerEffectSendCount[senderId] > 2) return await blockUser(api, message, threadId, senderId, senderName);
  } else {
    stickerEffectSendCount[senderId] = 1;
    stickerEffectSendTime[senderId] = Date.now();
  }
  await sendWarningMessage(api, message, senderId, senderName, stickerEffectSendCount[senderId], stickerId, cateId, stickerType);
}

async function sendWarningMessage(api, message, senderId, senderName, count, stickerId, cateId, stickerType) {
  let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây không được phép gửi sticker hiệu ứng`;
  if (count === 2) {
    caption = `⚠️ Cảnh cáo ${senderName}!\nNgưng gửi sticker hiệu ứng nếu không muốn bị kick khỏi nhóm!`;
  }
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

async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId);
    const userInfo = await getUserInfoData(api, senderId);
    // Sửa hàm tạo ảnh
    const imagePath = await createAntiStickerEffectImage(userInfo, groupInfo.name, groupInfo.groupType, userInfo.gender);
    await api.sendMessage(
      {
        msg: `🚫 Thành viên [ ${senderName} ] đã bị chặn vì spam sticker hiệu ứng!`,
        attachments: imagePath ? [imagePath] : [],
        ttl: 3600000,
        // Đã xóa quote
      },
      threadId,
      MessageType.GroupMessage
    );
    await clearImagePath(imagePath);
  } catch (err) {
    console.error(`Không thể chặn ${senderName}:`, err.message);
  }
}
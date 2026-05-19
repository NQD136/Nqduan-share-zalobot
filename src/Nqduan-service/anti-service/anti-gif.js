import { removeMention } from "../../utils/format-util.js";
import { sendMessageStateQuote, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
import { createBlockSpamLinkImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";

let gifSendCount = {};
let gifSendTime = {};

// Lệnh bật/tắt antigif
export async function handleAntiGif(api, message, groupSettings) {
  const threadId = message.threadId,
        prefix = getGlobalPrefix(),
        content = removeMention(message).trim();

  if (!content.startsWith(`${prefix}antigif`)) return false;
  if (!groupSettings[threadId]) groupSettings[threadId] = {};

  const parts = content.split(" ");
  if (parts.length === 1) groupSettings[threadId].antiGif = !groupSettings[threadId].antiGif;
  else if (parts[1] === "on") groupSettings[threadId].antiGif = true;
  else if (parts[1] === "off") groupSettings[threadId].antiGif = false;
  else {
    await sendMessageWarning(api, message, `❌ Sai cú pháp. Dùng: ${prefix}antigif [on/off]`);
    return true;
  }

  const status = groupSettings[threadId].antiGif ? "bật" : "tắt";
  await sendMessageStateQuote(
    api,
    message,
    `Chức năng chống gửi GIF đã ${status}`,
    groupSettings[threadId].antiGif,
    300000
  );

  return true;
}

// Xử lý tin nhắn GIF
export async function antiAllEffectGif(
  api,
  message,
  isAdminBox,
  groupSettings,
  botIsAdminBox,
  isSelf
  ) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;
  const content = message.data.content;
  const msgType = message.data.msgType;

  if (
    isSelf ||
    isAdminBox ||
    !botIsAdminBox ||
    !groupSettings[threadId]?.allowGif
  ) {
    return false;
  }

  const currentTime = Date.now();
  if (gifCooldown[senderId] && currentTime - gifCooldown[senderId] < 1000) {
    return false;
  }
  gifCooldown[senderId] = currentTime;

  if (!content || typeof content !== "object" || !content.action) {
    return false;
  }

  if (content.action !== "recommend.gif") {
    return false;
  }

  const threshold = groupSettings[threadId]?.rules?.rule_giflag?.threshold || 3;
  let isDeleteGif = false;

  try {
    const result = await api.deleteMessage(message, false);
    
    if (!result || result.status !== 0) {
      await api.sendMessage(
        {
          msg: `Nhờn với bố mày à ;!`,
          quote: message,
          ttl: 300000,
        },
        threadId,
        MessageType.GroupMessage
      );
      await blockAllUser(api, message, threadId, senderId, senderName);
      return true;
    }

    isDeleteGif = true;
    await updateAllGifWarnings(
      api,
      message,
      threadId,
      senderId,
      senderName,
      threshold
    );
  } catch (error) {
    await api.sendMessage(
      {
        msg: `Lỗi khi xóa gif.`,
        ttl: 300000,
      },
      threadId,
      MessageType.GroupMessage
    );
    return false;
  }

  return isDeleteGif;
}
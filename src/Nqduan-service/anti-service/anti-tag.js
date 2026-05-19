import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
// Thêm các import cần thiết
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
import { createAntiTagImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";
import { getAntiState } from "./index.js";

let tagSendCount = {}; // Đếm số lần tag của mỗi người dùng
let tagSendTime = {}; // Thời gian gửi tag của mỗi người dùng

function checkTag(message) {
  const hasMentions = message.data.mentions && Array.isArray(message.data.mentions) && message.data.mentions.length > 0;
  const mentionCount = message.data.mentions ? message.data.mentions.length : 0;
  const isHiddenTag = hasMentions && (message.data.content || "").trim().length === 0;
  return { hasMentions, mentionCount, isHiddenTag };
}

export async function antiTag(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;

  if (isSelf || isAdminBox || !botIsAdminBox || !groupSettings[threadId]?.removeTags) {
    return false;
  }

  const isUserWhiteList = isInWhiteList(groupSettings, threadId, senderId);
  if (isUserWhiteList) {
    return false;
  }

  let isDeleteTag = false;
  const { hasMentions, mentionCount, isHiddenTag } = checkTag(message);

  if (hasMentions) {
    await api.deleteMessage(message, false).catch(() => {});
    isDeleteTag = true;
    await sendWarningMessage(api, message, senderId, senderName, mentionCount, isHiddenTag);
    
    if (mentionCount > 10) {
      await sendMessageWarning(api, message, senderId, senderName, mentionCount, isHiddenTag);
      await blockUser(api, message, threadId, senderId, senderName);
    }
  }

  if (isDeleteTag) {
    await updateTagCount(api, message, threadId, senderId, senderName, getBotId(), isAdminBox);
  }

  return isDeleteTag;
}

export async function handleAntiTagCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  let isChangeSetting = false;
  const content = removeMention(message);
  const status = content.split(" ")[1]?.toLowerCase();
  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  const newStatus = status === "on" ? true : status === "off" ? false : !groupSettings[threadId].removeTags;
  groupSettings[threadId].removeTags = newStatus;
  isChangeSetting = true;
  const statusText = newStatus ? "bật" : "tắt";
  const caption = `Chức năng chống nhắc đến đã được ${statusText}!`;
  await sendMessageStateQuote(api, message, caption, newStatus, 30000);

  return isChangeSetting;
}

async function updateTagCount(api, message, threadId, senderId, senderName, botId, isAdminBox) {
  if (!tagSendCount[senderId]) {
    tagSendCount[senderId] = 0;
    tagSendTime[senderId] = Date.now();
  }

  tagSendCount[senderId]++;

  if (isAdminBox && senderId !== botId) {
    return;
  }

  if (Date.now() - tagSendTime[senderId] < 60 * 1000) {
    if (tagSendCount[senderId] > 2) {
      await blockUser(api, message, threadId, senderId, senderName);
      return;
    }
  } else {
    tagSendCount[senderId] = 1;
    tagSendTime[senderId] = Date.now();
  }
}

// Sửa lại hàm blockUser
async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    
    // Logic tạo ảnh mới
    const groupInfo = await getGroupInfoData(api, threadId);
    const userInfo = await getUserInfoData(api, senderId);
    const imagePath = await createAntiTagImage(userInfo, groupInfo.name, groupInfo.groupType, userInfo.gender);
    
    await api.sendMessage(
      {
        msg: `🚫 Thành viên [ ${senderName} ] đã bị chặn khỏi nhóm vì tag người khác quá nhiều!`,
        attachments: imagePath ? [imagePath] : [], // Gửi kèm ảnh
        ttl: 3600000,
        // Đã xóa quote
      },
      threadId,
      MessageType.GroupMessage
    );
    await clearImagePath(imagePath); // Xóa ảnh sau khi gửi

    try {
      await api.sendMessage(
        // {
        //   msg: `Chào ${senderName}\nBạn đã bị chặn khỏi nhóm vì tag quá 10 người trong một tin nhắn!`,
        //   quote: message,
        // },
        senderId,
        MessageType.DirectMessage
      );
    } catch (error) {}
  } catch (error) {
     console.error(`Không thể chặn ${senderName} (spam tag):`, error.message);
  }
}

async function sendWarningMessage(api, message, senderId, senderName, mentionCount, isHiddenTag) {
  try {
    let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây không được phép tag người khác.`; 
    if (mentionCount > 10) {
      caption = `⚠️ Cảnh cáo ${senderName}!\nTag quá nhiều người sẽ bị chặn!`;
    }
    await api.sendMessage(
      {
        msg: caption,
        mentions: [
          MessageMention(senderId, senderName.length, "⚠️ Cảnh cáo ".length),
        ],
        quote: message,
        ttl: 300000,
      },
      message.threadId,
      MessageType.GroupMessage
    );
    await api.sendMessage(
      // {
      //   msg: `Admin đã chặn gửi tag trong nhóm, tag của ${senderName} bị xóa!`,
      //   quote: message,
      // },
      senderId,
      MessageType.DirectMessage
    );
  } catch (error) {}
}

async function sendMessageWarning(api, message, senderId, senderName, mentionCount, isHiddenTag) {
  try {
    const caption = `${senderName} ⚠️Cảnh báo rồi mà vẫn cố tình à\nBiến mẹ mày í!!!\n🚨🚨🚨`;
    await api.sendMessage(
      {
        msg: caption,
        mentions: [
          MessageMention(senderId, senderName.length, 0),
        ],
        quote: message,
        ttl: 300000,
      },
      message.threadId,
      MessageType.GroupMessage
    );
    await api.sendMessage(
      // {
      //   msg: `Chào ${senderName}\nBạn đã bị chặn khỏi nhóm vì tag ${mentionCount} người trong một tin nhắn!`,
      //   quote: message,
      // },
      senderId,
      MessageType.DirectMessage
    );
  } catch (error) {}
}
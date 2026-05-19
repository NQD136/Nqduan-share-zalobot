import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
// Sửa import hàm tạo ảnh
import { createBlockSpamLinkImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";
import { getAntiState } from "./index.js";
import { scanQRCode } from "../utilities/qr-scan.js";

async function loadLinkRegex() {
  try {
    const antiState = getAntiState();
    if (!antiState.data.linkRegex) {
      antiState.data.linkRegex =
        "(?:https?:\\/\\/|www\\.)\\S+|(?<!\\w)[a-zA-Z0-9-]+[.,](?:com|net|org|vn|info|biz|io|xyz|me|tv|online|store|club|site|app|blog|dev|tech|cloud|game|shop|click|space|asia|fun|tokyo|xyz|website)(?:\\/\\S*)?(?!\\w)";
    }
    return new RegExp(antiState.data.linkRegex, "gi");
  } catch (error) {
    console.error("Lỗi khi đọc regex link:", error);
    return null;
  }
}

const linkRegex = await loadLinkRegex();

let linkSendCount = {};
let linkSendTime = {};

function checkLink(content) {
  return linkRegex.test(content);
}

export async function antiLink(
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

  if (
    isSelf ||
    isAdminBox ||
    !botIsAdminBox ||
    !groupSettings[threadId]?.removeLinks
  )
    return false;

  
  await handleLinkMessage(
    api,
    message,
    groupSettings,
    isAdminBox,
    threadId,
    senderId,
    senderName
  );
}

export async function handleAntiLinkCommand(
  api,
  message,
  groupSettings
) {
  const threadId = message.threadId;
  let isChangeSetting = false;
  const content = removeMention(message);
  const status = content.split(" ")[1]?.toLowerCase();
  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  const newStatus =
    status === "on"
      ? true
      : status === "off"
        ? false
        : !groupSettings[threadId].removeLinks;
  groupSettings[threadId].removeLinks = newStatus;
  isChangeSetting = true;
  const statusText = newStatus ? "bật" : "tắt";
  const caption = `Chức năng xóa link đã được ${statusText}!`;
  await sendMessageStateQuote(api, message, caption, newStatus, 300000);

  return isChangeSetting;
}

async function handleLinkMessage(
  api,
  message,
  groupSettings,
  isAdminBox,
  threadId,
  senderId,
  senderName
) {
  let content = message.data.content;
  content = content.title ? content.title : content;
  const isRecommendedMessage = message.data.msgType === "chat.recommended";
  const isImage = message.data.msgType === "chat.photo";
  const isPlainText = typeof content === "string";
  let isDeleteLink = false;
  const botId = getBotId();
  const isUserWhiteList = isInWhiteList(groupSettings, threadId, senderId);

  

  if (isUserWhiteList) {
    
    return isDeleteLink;
  }

  if (isRecommendedMessage) {
    const result = await api.deleteMessage(message, false).catch((error) => {
      console.error(`Lỗi khi xóa tin nhắn (recommended, sender: ${senderId}):`, error);
      return null;
    });
    
    if (!result || result.status !== 0) {
      
      await api.sendMessage(
        {
          msg: "Nhờn với tào à ;!",
          quote: message,
          ttl: 300000,
        },
        threadId,
        MessageType.GroupMessage
      );
      await blockUser(api, message, threadId, senderId, senderName);
      return true; 
    }
    
    isDeleteLink = true;
  }

  if (!isDeleteLink && isImage) {
    const linkImage = message.data?.content?.href;
    if (linkImage) {
      const result = await scanQRCode(linkImage);
      if (result.success) {
        if (checkLink(result.data.content)) {
          const deleteResult = await api.deleteMessage(message, false).catch((error) => {
            console.error(`Lỗi khi xóa tin nhắn (image, sender: ${senderId}):`, error);
            return null;
          });
          
          if (!deleteResult || deleteResult.status !== 0) {
            
            await api.sendMessage(
              {
                msg: "Nhờn với tào à ;!",
                quote: message,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage
            );
            await blockUser(api, message, threadId, senderId, senderName);
            return true; 
          }
          isDeleteLink = true;
        }
      }
    }
  }

  const hasLink = isPlainText && checkLink(content);

  if (!isDeleteLink && hasLink) {
    const matches = content.match(linkRegex);
    if (matches) {
      const deleteResult = await api.deleteMessage(message, false).catch((error) => {
        console.error(`Lỗi khi xóa tin nhắn (text, sender: ${senderId}):`, error);
        return null;
      });
      
      if (!deleteResult || deleteResult.status !== 0) {
        
        await api.sendMessage(
          {
            msg: "Nhờn với tào à ;!",
            quote: message,
            ttl: 300000,
          },
          threadId,
          MessageType.GroupMessage
        );
        await blockUser(api, message, threadId, senderId, senderName);
        return true; 
      }
      
      isDeleteLink = true;
    }
  }

  if (isDeleteLink && !isUserWhiteList) {
    
    await updateLinkCount(
      api,
      message,
      threadId,
      senderId,
      senderName,
      botId,
      isAdminBox
    );
  }
  return isDeleteLink;
}

async function updateLinkCount(
  api,
  message,
  threadId,
  senderId,
  senderName,
  botId,
  isAdminBox
) {
  if (!linkSendCount[senderId]) {
    linkSendCount[senderId] = 0;
    linkSendTime[senderId] = Date.now();
  }

  linkSendCount[senderId]++;

  if (isAdminBox && senderId !== botId) {
    
    return;
  }

  if (Date.now() - linkSendTime[senderId] < 60 * 1000) {
    if (linkSendCount[senderId] > 2) {
      
      await blockUser(api, message, threadId, senderId, senderName);
      return;
    }
  } else {
    
    linkSendCount[senderId] = 1;
    linkSendTime[senderId] = Date.now();
  }

  
  await sendWarningMessage(api, message, senderId, senderName, linkSendCount[senderId]);
}

async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId);
    const userInfo = await getUserInfoData(api, senderId);
    const imagePath = await createBlockSpamLinkImage(
      userInfo,
      groupInfo.name,
      groupInfo.groupType,
      userInfo.gender
    );

    await api.sendMessage(
      {
        msg: `🚫 Thành viên [ ${senderName} ] đã bị chặn vì spam link!`,
        attachments: imagePath ? [imagePath] : [],
        ttl: 3600000,
        // ĐÃ XÓA QUOTE: MESSAGE
      },
      threadId,
      MessageType.GroupMessage
    );

    await clearImagePath(imagePath);
  } catch (error) {
    console.error(`Không thể chặn người dùng ${senderName} (spam link):`, error);
  }
}

async function sendWarningMessage(api, message, senderId, senderName, count) {
  try {
    let caption = `⚠️ Cảnh cáo ${senderName}!\nỞ đây tao cấm gửi link`;
    switch (count) {
      case 2:
        caption = `⚠️ Cảnh cáo ${senderName}!\nNgừng send link, trước khi, mọi chuyện dần tồi tệ hơn!`;
        break;
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
  } catch (error) {
    console.error(`Không thể gửi tin nhắn tới nhóm (sender: ${senderId}):`, error.message);
  }
}
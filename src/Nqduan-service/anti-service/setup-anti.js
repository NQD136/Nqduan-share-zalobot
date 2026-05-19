import { MessageMention, MessageType } from "zlbotdqt";
import { sendMessageStateQuote, sendMessageState } from "../chat-zalo/chat-style/chat-style.js";
import { removeMention } from "../../utils/format-util.js";
import { appContext } from "../../api-zalo/context.js";

const tagBehaviorMap = new Map();
const checkDelete = new Set();
const groupInfoCache = new Map();
const CACHE_DURATION = 10000;

const getShortUid = (uid) => String(uid).slice(0, 12);

async function getGroupInfoData(api, threadId) {
  if (!threadId) {
    await sendMessageState(api, threadId, "Lỗi: threadId không hợp lệ!", "warning", 86400000);
    return null;
  }
  const now = Date.now();
  const cachedData = groupInfoCache.get(threadId);
  if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
    return cachedData.data;
  }
  try {
    if (!api.getGroupInfo) {
      throw new Error("api.getGroupInfo không tồn tại");
    }
    const groupInfoResponse = await api.getGroupInfo(threadId);
    if (!groupInfoResponse || !groupInfoResponse.gridInfoMap || !groupInfoResponse.gridInfoMap[threadId]) {
      throw new Error(`Không tìm thấy gridInfoMap hoặc threadId ${threadId}`);
    }
    const gridInfo = groupInfoResponse.gridInfoMap[threadId];
    const processedInfo = {
      creatorId: String(gridInfo.creatorId) || null,
      adminIds: (gridInfo.adminIds || gridInfo.admins || []).map(String) 
    };
    if (processedInfo.creatorId && !processedInfo.adminIds.includes(processedInfo.creatorId)) {
      processedInfo.adminIds.push(processedInfo.creatorId);
    }
    groupInfoCache.set(threadId, {
      data: processedInfo,
      timestamp: now
    });
    return processedInfo;
  } catch (error) {
    await sendMessageState(api, threadId, "Lỗi: Không thể lấy danh sách quản trị viên nhóm!", "warning", 86400000);
    return null;
  }
}

function checkTagBehavior(senderId, mentionsCount, threadId) {
  const now = Date.now();
  if (!tagBehaviorMap.has(senderId)) {
    tagBehaviorMap.set(senderId, {
      count: 1,
      timestamps: [now],
      threadId: threadId
    });
    return false;
  }
  const userData = tagBehaviorMap.get(senderId);
  const tenSecondsAgo = now - 30000; 
  userData.timestamps = userData.timestamps.filter(time => time > tenSecondsAgo);
  userData.timestamps.push(now);
  userData.count = userData.timestamps.length;
  if (userData.count >= 2 && mentionsCount > 3) {
    tagBehaviorMap.delete(senderId); 
    return true;
  }
  return false;
}

export async function handleSetupAntiCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  let isChangeSetting = false;
  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {
      enableSetup: false,
      antiMention: false
    };
  }
  const newStatus = !groupSettings[threadId].enableSetup;
  groupSettings[threadId].enableSetup = newStatus;
  groupSettings[threadId].antiMention = newStatus;
  isChangeSetting = true;
  const statusText = newStatus ? "bật" : "tắt";
  const caption = `Chức năng bảo vệ group đã được ${statusText}!`;
  await sendMessageStateQuote(api, message, caption, newStatus, 300000);
  return isChangeSetting;
}

export async function superCheckBox(api, message, isSelf, botIsAdminBox, isAdminBox, groupSettings) {
  const threadId = message.threadId;

  // ✅ Nếu groupSettings chưa có thì tạo mới
  if (!groupSettings || typeof groupSettings !== 'object') {
    groupSettings = {};
  }

  // ✅ Nếu nhóm chưa có config thì gán mặc định
  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {
      enableSetup: false,
      antiMention: false
    };
  }

  const senderName = message.data.dName;
  const senderId = String(message.data.uidFrom); 
  const mentionsCount = message.data?.mentions?.length || 0;
  const ttl = message.data?.ttl;
  const isWebchat = message.data?.msgType === 'webchat';
  const isChatDelete = message.data?.msgType === 'chat.delete';

  // --- Logic check anti-xóa tin nhắn (đã có check enableSetup) ---
  if (isChatDelete && groupSettings[threadId]?.enableSetup) {
    if (!threadId) {
      await sendMessageState(api, threadId, "Lỗi: threadId không hợp lệ!", "warning", 86400000);
      return false;
    }
    const groupInfo = await getGroupInfoData(api, threadId);
    const creatorId = String(groupInfo?.creatorId); 
    const adminIds = groupInfo?.adminIds || [];
    if (!groupInfo || !adminIds.length) {
      await sendMessageState(api, threadId, "Lỗi: Không thể lấy danh sách quản trị viên nhóm!", "warning", 86400000);
      return false;
    }
    const uid = String(appContext.uid); 
    if (!uid) {
      await sendMessageState(api, threadId, "Lỗi: Không thể lấy UID của bot!", "warning", 86400000);
      return false;
    }
    if (uid !== creatorId) {
      return false;
    }
    if (getShortUid(senderId) === getShortUid(creatorId)) {
      return false;
    }
    const targetId = String(message.data.content?.[0]?.uidFrom); 
    if (!targetId) {
      return false;
    }
    if (getShortUid(senderId) === getShortUid(targetId)) {
      return false;
    }
    const spammerKey = `${senderId}:${threadId}`;
    if (checkDelete.has(spammerKey)) {
      return false;
    }
    const shortAdminIds = adminIds.map(getShortUid);
    const isSenderAdmin = shortAdminIds.includes(getShortUid(senderId));
    const isTargetAdmin = shortAdminIds.includes(getShortUid(targetId));
    if (isSenderAdmin && isTargetAdmin) {
      checkDelete.add(spammerKey);
      const caption = `${senderName}\nPhát hiện hành vi cấm chat key\nTiến hành block đối tượng`;
      const messagePayload = {
        mentions: [MessageMention(senderId, 2, senderName.length)],
        ttl: 86400000
      };
      if (!isWebchat) {
        messagePayload.quote = message;
      }

      try {
        await sendMessageState(api, threadId, caption, "warning", 86400000, messagePayload);
        await api.blockUsers(threadId, [senderId]);
        setTimeout(() => checkDelete.delete(spammerKey), 20000);
        return true;
      } catch (error) {
        checkDelete.delete(spammerKey);
        return false;
      }
    } else {
      return false;
    }
  }

  // --- Logic check các trường hợp không cần anti ---
  if (isSelf || isAdminBox || !botIsAdminBox) {
    return false;
  }

  // ✅ SỬA ĐỔI: Thêm check groupSettings[threadId]?.enableSetup ở đây
  // Toàn bộ logic anti-spam (trừ anti-delete ở trên) sẽ nằm trong block này
  if (groupSettings[threadId]?.enableSetup) {
    
    // --- Logic check tin nhắn bất thường (TTL) ---
    if (typeof ttl === 'number' && ttl > 0 && ttl < 6000) {
      const caption = `${senderName}\nPhát hiện tin nhắn bất thường\nTiến hành block đối tượng !`;
      const messagePayload = {
        mentions: [MessageMention(senderId, senderName.length, 0)],
        ttl: 86400000
      };
      if (!isWebchat) {
        messagePayload.quote = message;
      }
      await sendMessageState(api, threadId, caption, "warning", 86400000, messagePayload);
      try {
        await api.blockUsers(threadId, [senderId]);
        return true;
      } catch (error) {
        return false;
      }
    }

    // --- Logic check anti-mention ---
    // ✅ SỬA ĐỔI: Bỏ check enableSetup (vì đã check ở ngoài)
    if (groupSettings[threadId]?.antiMention && mentionsCount > 0) {
      const isSpammingTags = checkTagBehavior(senderId, mentionsCount, threadId);
      if (mentionsCount >= 10 || isSpammingTags) {
        const caption = `${senderName}\nTag nhiều thế cu, cút đi!`;
        const messagePayload = {
          mentions: [MessageMention(senderId, senderName.length, 0)],
          ttl: 86400000
        };
        if (!isWebchat) {
          messagePayload.quote = message;
        }

        await sendMessageState(api, threadId, caption, "warning", 86400000, messagePayload);
        try {
          await api.blockUsers(threadId, [senderId]);
          return true;
        } catch (error) {
          return false;
        }
      }
    }

  } // --- Kết thúc block check enableSetup ---

  return false;
}
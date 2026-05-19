import { MessageMention } from "zlbotdqt";
import { sendMessageState, sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { appContext } from "../../api-zalo/context.js";
import fs from 'fs/promises';
// Thêm các import cần thiết
import { getUserInfoData } from "../info-service/user-info.js";
import { createAntiBotImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";

// Lưu trữ thông tin nhóm để kiểm tra quyền
const groupInfoCache = new Map();
const CACHE_DURATION = 10000; // 10 giây cache

// Lưu trữ groupSettings vào file JSON
async function saveGroupSettings(groupSettings) {
  try {
    await fs.writeFile('groupSettings.json', JSON.stringify(groupSettings, null, 2));
  } catch (error) {
    console.error('Lỗi khi lưu groupSettings:', error);
  }
}

// Tải groupSettings từ file JSON
async function loadGroupSettings() {
  try {
    const data = await fs.readFile('groupSettings.json', 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Lấy thông tin nhóm từ API Zalo
async function getGroupInfoData(api, threadId) {
  if (!threadId) {
    await sendMessageState(api, threadId, "Lỗi: threadId không hợp lệ!", "warning", 60000);
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
    await sendMessageState(api, threadId, "Lỗi: Không thể lấy danh sách quản trị viên nhóm!", "warning", 60000);
    return null;
  }
}


export async function antiBotCheck(api, message, groupSettings) {
  const threadId = message.threadId;
  const senderName = message.data?.dName || "Người dùng không xác định";
  const senderId = String(message.data?.uidFrom || "");
  const ttl = message.data?.ttl;
  const isWebchat = message.data?.msgType === 'webchat';

  // Đảm bảo groupSettings là object
  if (typeof groupSettings !== 'object' || groupSettings === null) {
    groupSettings = await loadGroupSettings();
  }

  // Khởi tạo groupSettings[threadId] nếu chưa tồn tại
  if (!groupSettings[threadId]) {
    groupSettings[threadId] = { enableAntiBot: false };
    await saveGroupSettings(groupSettings);
  }

  // Bỏ qua nếu chế độ chống bot chưa được bật
  if (!groupSettings[threadId].enableAntiBot) {
    return false;
  }

  // Bỏ qua nếu là bot của bạn
  const botUid = String(appContext.uid);
  if (senderId === botUid) {
    return false;
  }

  // Lấy thông tin nhóm để kiểm tra quyền
  const groupInfo = await getGroupInfoData(api, threadId);
  if (!groupInfo) {
    return false;
  }
  const adminIds = groupInfo.adminIds || [];
  const isSenderAdmin = adminIds.includes(senderId);
  if (isSenderAdmin) {
    return false;
  }

  // Kiểm tra tin nhắn có TTL > 1000ms
  if (typeof ttl === 'number' && ttl > 1000) {
    const caption = `${senderName} Ai cho mày dùng bot!!!`;
    const messagePayload = {
      mentions: [MessageMention(senderId, senderName.length, 0)],
      ttl: 60000
    };
    if (!isWebchat) {
      messagePayload.quote = message;
    }

    // Sửa khối try...catch
    try {
      // Lấy thông tin để tạo ảnh
      const userInfo = await getUserInfoData(api, senderId);
      // Giả sử groupInfo đã có name và groupType (nếu không bạn cần getGroupInfo đầy đủ)
      const groupFullInfo = await getGroupInfoData(api, threadId); // Gọi lại để lấy full info nếu cần
      const imagePath = await createAntiBotImage(userInfo, groupFullInfo.name || "Nhóm", groupFullInfo.groupType, userInfo.gender);

      // Gửi tin nhắn cảnh báo (có thể giữ hoặc bỏ)
      await sendMessageState(api, threadId, caption, "warning", 60000, messagePayload);

      // Chặn người dùng
      await api.blockUsers(threadId, [senderId]);
      
      // Gửi thông báo ảnh
      await api.sendMessage({
        msg: `🚫Thành viên [ ${senderName} ] đã bị chặn vì sử dụng bot!`,
        attachments: imagePath ? [imagePath] : [],
        ttl: 3600000,
        // Đã xóa quote
      }, threadId);
      
      await clearImagePath(imagePath);
      
      return true;
    } catch (error) {
      await sendMessageState(api, threadId, `Lỗi khi chặn ${senderName}: ${error.message}`, "error", 60000);
      return false;
    }
  }

  return false;
}

// Hàm bật/tắt chế độ chống bot
export async function handleAntiBotCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  let isChangeSetting = false;

  // Đảm bảo groupSettings là object
  if (typeof groupSettings !== 'object' || groupSettings === null) {
    groupSettings = await loadGroupSettings();
  }

  // Khởi tạo groupSettings[threadId] nếu chưa tồn tại
  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {
      enableAntiBot: false
    };
    await saveGroupSettings(groupSettings);
  }

  const newStatus = !groupSettings[threadId].enableAntiBot;
  groupSettings[threadId].enableAntiBot = newStatus;
  isChangeSetting = true;

  await saveGroupSettings(groupSettings);

  const statusText = newStatus ? "bật" : "tắt";
  const caption = `Chức năng chống bot đã được ${statusText}!`;
  await sendMessageStateQuote(api, message, caption, newStatus, 300000);
  return isChangeSetting;
}
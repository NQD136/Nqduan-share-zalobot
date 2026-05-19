import { MessageMention, MessageType } from "zlbotdqt";
import { isAdmin } from "../../index.js";
import { sendMessageComplete, sendMessageQuery, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { readGroupSettings, writeGroupSettings } from "../../utils/io-json.js";
// --- ĐÃ SỬA: Bỏ import formatSeconds ---
import { removeMention } from "../../utils/format-util.js";

// --- IMPORT MỚI ĐỂ VẼ ẢNH ---
import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { clearImagePath } from "../../utils/canvas/index.js"; 
import { getUserInfoData } from "../info-service/user-info.js"; // Lấy info để có avatar

// Thêm hằng số để định nghĩa giá trị vô thời hạn
const PERMANENT_MUTE = -1;

// =================================================================
// --- HÀM FORMATSECONDS MỚI (Từ prompt trước) ---
// =================================================================
/**
 * Hàm format thời gian (mới)
 * Chuyển đổi giây sang định dạng năm, tháng, ngày, giờ, phút, giây
 * @param {number} totalSeconds - Tổng số giây (giả định là số nguyên)
 */
function formatSeconds(totalSeconds) {
  if (totalSeconds <= 0) {
    return "0s";
  }

  // Tuân theo logic của user: 30 ngày/tháng, 12 tháng/năm
  const SECONDS_PER_YEAR = 31104000; // 86400 * 30 * 12
  const SECONDS_PER_MONTH = 2592000; // 86400 * 30
  const SECONDS_PER_DAY = 86400;
  const SECONDS_PER_HOUR = 3600;
  const SECONDS_PER_MINUTE = 60;

  const years = Math.floor(totalSeconds / SECONDS_PER_YEAR);
  let remainingSeconds = totalSeconds % SECONDS_PER_YEAR;

  const months = Math.floor(remainingSeconds / SECONDS_PER_MONTH);
  remainingSeconds = remainingSeconds % SECONDS_PER_MONTH;

  const days = Math.floor(remainingSeconds / SECONDS_PER_DAY);
  remainingSeconds = remainingSeconds % SECONDS_PER_DAY;

  const hours = Math.floor(remainingSeconds / SECONDS_PER_HOUR);
  remainingSeconds = remainingSeconds % SECONDS_PER_HOUR;

  const minutes = Math.floor(remainingSeconds / SECONDS_PER_MINUTE);
  const seconds = remainingSeconds % SECONDS_PER_MINUTE;

  const parts = [];
  if (years > 0) parts.push(`${years} năm`);
  if (months > 0) parts.push(`${months} tháng`);
  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}p`);
  if (seconds > 0) parts.push(`${seconds}s`); 

  // Nếu parts rỗng (nghĩa là totalSeconds = 0), nó đã được handle ở đầu
  return parts.join(" ");
}

// =================================================================
// --- HÀM PARSETIME (ĐÃ CẬP NHẬT THEO YÊU CẦU MỚI) ---
// =================================================================
function parseTime(timeStr) {
  if (!timeStr) return PERMANENT_MUTE;

  // Tách số và đơn vị (cho phép số thập phân như 0.5h)
  const match = timeStr.match(/^(\d+(\.\d+)?)(s|p|m|h|d|w|th|y)$/i);

  // Nếu không khớp (ví dụ: "1000" không có đơn vị, hoặc "abc")
  if (!match) {
    // Kiểm tra xem có phải chỉ là số không (cho logic cũ)
    if (/^\d+$/.test(timeStr)) {
        // Trả về số nguyên (logic cũ: số không đơn vị = giây)
        return parseInt(timeStr); 
    }
    return PERMANENT_MUTE; // Mặc định là vĩnh viễn nếu sai cú pháp
  }

  const value = parseFloat(match[1]); // Dùng parseFloat để lấy số thập phân
  const unit = match[3].toLowerCase();

  if (isNaN(value)) return PERMANENT_MUTE;

  let seconds;
  switch (unit) {
    case "s": // Giây
      seconds = value;
      break;
    case "p": // Phút
    case "m": // Phút
      seconds = value * 60;
      break;
    case "h": // Giờ
      seconds = value * 3600;
      break;
    case "d": // Ngày
      seconds = value * 86400;
      break;
    case "w": // Tuần (MỚI)
      seconds = value * 604800; // 7 * 86400
      break;
    case "th": // Tháng (MỚI - 30 ngày)
      seconds = value * 2592000; // 30 * 86400
      break;
    case "y": // Năm (MỚI - 360 ngày)
      seconds = value * 31104000; // 12 * 30 * 86400
      break;
    default:
      return PERMANENT_MUTE; // Trường hợp không mong muốn
  }
  
  // Trả về số giây đã làm tròn
  return Math.round(seconds);
}
// =================================================================

function isMuted(groupSettings, threadId, senderId) {
  const muteInfo = groupSettings[threadId]?.muteList?.[senderId];
  if (!muteInfo) return false;

  if (muteInfo.timeMute === PERMANENT_MUTE) return true;
  
  const remainingTime = muteInfo.timeMute - Math.floor(Date.now() / 1000);
  if (remainingTime <= 0) {
    delete groupSettings[threadId].muteList[senderId];
    return false;
  }
  return true;
}

function isAllMuted(groupSettings, threadId) {
  const muteInfo = groupSettings[threadId]?.muteList?.[-1];
  if (!muteInfo) return false;

  if (muteInfo.timeMute === PERMANENT_MUTE) return true;

  const remainingTime = muteInfo.timeMute - Math.floor(Date.now() / 1000);
  if (remainingTime <= 0) {
    delete groupSettings[threadId].muteList[-1];
    return false;
  }
  return true;
}

export async function handleMute(api, message, groupSettings, isAdminBox, botIsAdminBox, isSelf) {
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;

  if (!groupSettings[threadId].muteList) {
    groupSettings[threadId].muteList = {};
  }
  
  if ( !isSelf && botIsAdminBox) {
    if (isAllMuted(groupSettings, threadId) || isMuted(groupSettings, threadId, senderId)) {
      if (isAdminBox) {
          const groupId = message.data.idTo;
          const muteId = message.data.uidFrom;
          if ( global.mutes && global.mutes[groupId] && global.mutes[groupId][muteId] ) {
            const cliMsgId = message.data.cliMsgId || Date.now().toString();
            // console.log(message);
            const uidFrom = message.data.uidFrom;
            const msgId = global.mutes[groupId][muteId];
            await api.zDeleteMessage({cliMsgId, msgId, uidFrom}, groupId, message.type).catch(console.error);
          }
        } else await api.deleteMessage(message, false).catch(console.error);
      return true;
    }
  }

  return false;
}

// =================================================================
// --- HÀM LIST MUTE (ĐÃ VIẾT LẠI ĐỂ VẼ ẢNH) ---
// =================================================================
export async function handleMuteList(api, message, groupSettings) {
  const threadId = message.threadId;
  let imagePath = null; // Để xóa file tạm

  if (!groupSettings[threadId] || !groupSettings[threadId].muteList || Object.keys(groupSettings[threadId].muteList).length === 0) {
    await sendMessageWarning(api, message, "Hiện Không có người dùng nào bị cấm chat.");
    return;
  }

  try {
    const currentTime = Math.floor(Date.now() / 1000);
    const muteDataList = []; // Mảng chứa data để vẽ

    // 1. Xử lý Mute All
    if (groupSettings[threadId].muteList[-1]) {
      const muteInfo = groupSettings[threadId].muteList[-1];
      
      const timeStr = muteInfo.timeMute === PERMANENT_MUTE 
        ? "Thời gian cấm chat: vô thời hạn"
        : `Thời gian cấm chat: ${formatSeconds(muteInfo.timeMute - currentTime)}`;
      
      muteDataList.push({
        id: -1,
        name: "Tất cả thành viên",
        avatar: null, // Sẽ vẽ ô màu xám
        role: timeStr, // Thông tin phụ là thời gian
        keyType: 'red' // Style viền đỏ
      });
    }

    // 2. Lấy thông tin các user bị mute khác
    const mutedUsers = Object.entries(groupSettings[threadId].muteList)
      .filter(([id]) => id !== "-1");

    if (mutedUsers.length > 0) {
      const userPromises = mutedUsers.map(async ([id, muteInfo]) => {
        
        const timeStr = muteInfo.timeMute === PERMANENT_MUTE
            ? "Thời gian cấm chat: vô thời hạn"
            : `Thời gian cấm chat: ${formatSeconds(muteInfo.timeMute - currentTime)}`;
            
        try {
          // Lấy info mới nhất (tên, avatar)
          const info = await getUserInfoData(api, id);
          return {
            ...info, // Gồm name, avatar
            id: id,
            role: timeStr, // Thông tin phụ
            keyType: 'red' // Style viền đỏ
          };
        } catch (e) {
          console.error(`[MuteList] Lỗi lấy info user ${id}: ${e.message}`);
          // Fallback: Dùng tên đã lưu khi mute
          return {
            id: id,
            name: muteInfo.name || id, // Dùng tên đã lưu
            avatar: null, // Không có avatar
            role: timeStr,
            keyType: 'red'
          };
        }
      });
      
      const userInfos = await Promise.all(userPromises);
      muteDataList.push(...userInfos);
    }
    
    // Nếu sau khi lọc, không có ai
    if (muteDataList.length === 0) {
        await sendMessageWarning(api, message, "Hiện Không có người dùng nào bị cấm chat.");
        return;
    }

    // 3. Vẽ ảnh
    imagePath = await createMuteListImage(muteDataList);

    // 4. Gửi ảnh
    await api.sendMessage({ msg: "", attachments: [imagePath], ttl: 600000, quote: message }, threadId, MessageType.GroupMessage);

  } catch (error) {
    console.error(`[handleMuteList] Lỗi: ${error.message}`);
    await sendMessageWarning(api, message, "Đã xảy ra lỗi khi tạo danh sách cấm chat.");
  } finally {
    // 5. Xóa file tạm
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
}

export async function addOrUpdateMute(api, message, userId, userName, duration, groupSettings) {
  const threadId = message.threadId;
  const currentTime = Math.floor(Date.now() / 1000);
  let isChangeSetting = false;

  if (!groupSettings[threadId].muteList[userId]) {
    groupSettings[threadId].muteList[userId] = {
      name: userName,
      timeMute: duration === PERMANENT_MUTE ? PERMANENT_MUTE : currentTime + duration,
    };
    const timeMsg = duration === PERMANENT_MUTE ? "vô thời hạn" : `trong ${formatSeconds(duration)}`;
    await sendMessageComplete(api, message, `Đã cấm chat người dùng ${userName} ${timeMsg}.`);
    isChangeSetting = true;
  } else {
    const existingMute = groupSettings[threadId].muteList[userId];
    const oldDuration =
      existingMute.timeMute === PERMANENT_MUTE
        ? "vô thời hạn"
        : formatSeconds(existingMute.timeMute - currentTime);

    existingMute.timeMute = duration === PERMANENT_MUTE ? PERMANENT_MUTE : currentTime + duration;
    const newDuration = duration === PERMANENT_MUTE ? "vô thời hạn" : `trong ${formatSeconds(duration)}`;

    await sendMessageComplete(
      api,
      message,
      `Đã cập nhật thời gian cấm chat cho ${userName}:\n- Cũ: ${oldDuration}\n- Mới: ${newDuration}`
    );
    isChangeSetting = true;
  }

  return isChangeSetting;
}

// =================================================================
// --- HÀM HANDLEMUTEUSER (ĐÃ SỬA LỖI LOGIC 1 Y) ---
// =================================================================
export async function handleMuteUser(api, message, groupSettings, groupAdmins) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  
  // --- SỬA LỖI: Lọc bỏ các khoảng trắng rỗng do removeMention gây ra ---
  const parts = content.split(" ").filter(p => p.length > 0);

  let isChangeSetting = false;

  // Xử lý 'mute all'
  // (!mute all 1y) hoặc (!mute all 1 y)
  if (parts[1] && parts[1].toLowerCase() === 'all') {
    let timeStr = parts[2]; // Mặc định là "!mute all 1y"
    const unitRegex = /^(s|p|m|h|d|w|th|y)$/i;

    // Kiểm tra trường hợp "!mute all 1 y"
    if (parts[2] && parts[3] && /^\d+(\.\d+)?$/.test(parts[2]) && unitRegex.test(parts[3])) {
        timeStr = parts[2] + parts[3]; // Ghép "1" và "y" thành "1y"
    }

    const duration = parseTime(timeStr); 
    isChangeSetting = await addOrUpdateMute(api, message, -1, "All Users", duration, groupSettings);
    return isChangeSetting;
  }
  
  const mentions = message.data.mentions;
  if (mentions && mentions.length > 0) {
    
    // --- SỬA LỖI: Logic tìm thời gian thông minh hơn ---
    let timeStr = parts[1]; // Mặc định là "!mute 1y @user"
    
    // Regex kiểm tra đơn vị (giống trong parseTime)
    const unitRegex = /^(s|p|m|h|d|w|th|y)$/i;
    
    // Kiểm tra trường hợp "!mute 1 y @user"
    if (parts[1] && parts[2] && /^\d+(\.\d+)?$/.test(parts[1]) && unitRegex.test(parts[2])) {
      timeStr = parts[1] + parts[2]; // Ghép "1" và "y" thành "1y"
    }
    // --- KẾT THÚC SỬA LỖI ---

    const duration = parseTime(timeStr); 

    for (const mention of mentions) {
      const userId = mention.uid;
      const userName = message.data.content.substr(mention.pos, mention.len).replace("@", "");

      if (isAdmin(userId, threadId, groupAdmins)) {
        // (Logic cấm chat admin giữ nguyên)
        const msgBotId = message.data.msgId;
        if (!global.mutes) global.mutes = {};
        if (!global.mutes[threadId]) global.mutes[threadId] = {};
        if (!global.mutes[threadId][userId]) {
          global.mutes[threadId][userId] = msgBotId;
          await sendMessageWarning(api, message, `Đã cấm chat key ${userName}`);
        }
      }

      isChangeSetting = await addOrUpdateMute(api, message, userId, userName, duration, groupSettings);
    }
  } else {
    await sendMessageQuery(api, message, "Vui lòng đề cập (@mention) người dùng cần cấm chat.");
  }
  return isChangeSetting;
}
// =================================================================


// =================================================================
// --- HÀM HANDLEUNMUTEUSER (ĐÃ THÊM TÍNH NĂNG UNMUTE BY INDEX) ---
// =================================================================
export async function handleUnmuteUser(api, message, groupSettings) {
  let isChangeSetting = false;
  const content = removeMention(message);
  const threadId = message.threadId;
  const parts = content.split(" ").filter(p => p.length > 0); // Lọc khoảng trắng

  // 1. Kiểm tra "unmute all"
  if (parts[1] && parts[1].toLowerCase() === 'all') {
    if (groupSettings[threadId].muteList[-1]) {
      delete groupSettings[threadId].muteList[-1];
      isChangeSetting = true;
      await sendMessageComplete(api, message, "Đã mở chat tất cả thành viên trong nhóm.");
    } else {
      await sendMessageWarning(api, message, "Tất cả thành viên chưa bị cấm chat.");
    }
    return isChangeSetting;
  }

  const unmuteReferences = message.data.mentions;

  // 2. Kiểm tra "unmute [index]" (VÀ không có mentions)
  if (parts[1] && /^\d+$/.test(parts[1]) && (!unmuteReferences || unmuteReferences.length === 0)) {
    const index = parseInt(parts[1]) - 1; // STT 1 là index 0

    // --- TÁI TẠO DANH SÁCH MUTE (Giống hệt handleMuteList) ---
    const currentTime = Math.floor(Date.now() / 1000);
    const muteDataList = [];

    // a. Kiểm tra Mute All
    if (groupSettings[threadId].muteList[-1]) {
      const muteInfo = groupSettings[threadId].muteList[-1];
      const timeStr = muteInfo.timeMute === PERMANENT_MUTE 
        ? "Thời gian cấm chat: vô thời hạn"
        : `Thời gian cấm chat: ${formatSeconds(muteInfo.timeMute - currentTime)}`;
      muteDataList.push({ id: -1, name: "Tất cả thành viên", role: timeStr });
    }

    // b. Lấy các user khác
    const mutedUsers = Object.entries(groupSettings[threadId].muteList)
      .filter(([id]) => id !== "-1");

    if (mutedUsers.length > 0) {
      const userPromises = mutedUsers.map(async ([id, muteInfo]) => {
        const timeStr = muteInfo.timeMute === PERMANENT_MUTE
          ? "Thời gian cấm chat: vô thời hạn"
          : `Thời gian cấm chat: ${formatSeconds(muteInfo.timeMute - currentTime)}`;
        try {
          const info = await getUserInfoData(api, id); 
          return { id: id, name: info.name, role: timeStr };
        } catch (e) {
          return { id: id, name: muteInfo.name || id, role: timeStr };
        }
      });
      const userInfos = await Promise.all(userPromises);
      muteDataList.push(...userInfos);
    }
    
    // c. Sắp xếp danh sách (QUAN TRỌNG)
    const sortedMuteList = muteDataList.sort((a, b) => {
      if (a.id === -1) return -1; // "All" luôn ở trên
      if (b.id === -1) return 1;
      return (a.name || '').localeCompare(b.name || ''); // Sắp xếp theo tên
    });
    // --- KẾT THÚC TÁI TẠO DANH SÁCH ---

    // d. Kiểm tra và thực thi
    if (index >= 0 && index < sortedMuteList.length) {
      const target = sortedMuteList[index];
      const targetId = target.id; 
      const targetName = target.name;

      if (groupSettings[threadId].muteList[targetId]) {
        delete groupSettings[threadId].muteList[targetId];
        isChangeSetting = true;
        // Gửi thông báo
        if (targetId === -1) {
          await sendMessageComplete(api, message, "Đã mở chat tất cả thành viên trong nhóm.");
        } else {
          await sendMessageComplete(api, message, `Đã mở chat người dùng ${targetName}.`);
        }
      }
      return isChangeSetting; 
    } else {
      // Số thứ tự không hợp lệ
      await sendMessageWarning(api, message, `⚠️ Số thứ tự không hợp lệ. Vui lòng kiểm tra lại danh sách cấm chat.`);
      return false;
    }
  }

  // 3. Kiểm tra "@mention"
  if (unmuteReferences && unmuteReferences.length > 0) {
    for (const mention of unmuteReferences) {
      const userId = mention.uid;
      if (groupSettings[threadId].muteList[userId]) {
        const userName = groupSettings[threadId].muteList[userId];
        delete groupSettings[threadId].muteList[userId];
        isChangeSetting = true;
        await sendMessageComplete(api, message, `Đã mở chat người dùng ${userName.name || userId || userName}.`);
      } else {
        const userName = message.data.content.substr(mention.pos, mention.pos + mention.len).replace("@", "");
        await sendMessageWarning(
          api,
          message,
          `Người dùng ${userName.name || userName || userId} Không tồn tại trong danh sách cấm chat.`
        );
      }
    }
    return isChangeSetting;
  }
  
  // 4. Fallback: Nếu không có "all", không có STT, không có mention
  await sendMessageQuery(api, message, "Vui lòng đề cập (@mention) hoặc nhập STT người dùng cần mở chat.");
  return isChangeSetting;
}
// =================================================================

let muteCheckInterval;
export async function startMuteCheck(api) {
  if (muteCheckInterval) {
    clearInterval(muteCheckInterval);
  }

  muteCheckInterval = setInterval(async () => {
    const groupSettings = readGroupSettings();
    let changeSetting = false;
    const currentTime = Math.floor(Date.now() / 1000);

    for (const [threadId, threadSettings] of Object.entries(groupSettings)) {
      if (!threadSettings.muteList) continue;

      for (const [userId, muteInfo] of Object.entries(threadSettings.muteList)) {
        if (muteInfo.timeMute === PERMANENT_MUTE) continue;
        
        if (currentTime >= muteInfo.timeMute) {
          delete threadSettings.muteList[userId];
          changeSetting = true;
          const name = userId === "-1" ? "Tất cả thành viên" : muteInfo.name;
          const capText = " đã được mở chat, hãy phát biểu tích cực hơn nhé!";
          await api.sendMessage(
            { msg: name + capText,ttl: 3600000, mentions: [MessageMention(userId, name.length, 0)] },
            threadId,
            MessageType.GroupMessage
          );
        }
      }
    }

    if (changeSetting) {
      writeGroupSettings(groupSettings);
    }
  }, 5000);
}

export async function extendMuteDuration(threadId, userId, userName, groupSettings, extensionDuration = 900) {
  const currentTime = Math.floor(Date.now() / 1000);
  let isChangeSetting = false;

  if (!groupSettings[threadId].muteList) {
    groupSettings[threadId].muteList = {};
  }

  if (!groupSettings[threadId].muteList[userId]) {
    groupSettings[threadId].muteList[userId] = {
      name: userName,
      timeMute: currentTime + extensionDuration,
    };
    isChangeSetting = true;
  } else {
    const existingMute = groupSettings[threadId].muteList[userId];
    
    // Nếu đang mute vĩnh viễn thì giữ nguyên
    if (existingMute.timeMute === PERMANENT_MUTE) {
      return isChangeSetting;
    }
    
    const remainingTime = Math.max(0, existingMute.timeMute - currentTime);
    existingMute.timeMute = currentTime + remainingTime + extensionDuration;
    isChangeSetting = true;
  }

  if (isChangeSetting) {
    writeGroupSettings(groupSettings);
  }
  return isChangeSetting;
}


// =================================================================
// --- HÀM VẼ CANVAS MỚI (THEO YÊU CẦU) ---
// =================================================================

/**
 * Hàm vẽ ảnh danh sách Mute (Phong cách admin-manager)
 * @param {Array} mutedUsers - Danh sách người bị mute (đã gộp "All" và user)
 */
async function createMuteListImage(mutedUsers) {
  // Sắp xếp: "Tất cả" (id: -1) luôn ở trên cùng
  const limitedUsers = mutedUsers
    .sort((a, b) => {
      if (a.id === -1) return -1;
      if (b.id === -1) return 1;
      // Sắp xếp theo tên
      return (a.name || '').localeCompare(b.name || '');
    })
    .slice(0, 50); // Giới hạn 50 người

  const width = 660;
  const itemHeight = 100;
  const headerHeight = 100;
  const height = headerHeight + limitedUsers.length * itemHeight + 20;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền (Giữ nguyên style gradient)
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#004e92");
  gradient.addColorStop(1, "#000428");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // --- Tiêu đề (ĐÃ THAY ĐỔI THEO YÊU CẦU) ---
  ctx.font = "bold 36px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Danh Sách Thành Viên Khóa Chat", width / 2, headerHeight / 2);

  // Tải avatar (song song)
  const avatars = await Promise.all(
    limitedUsers.map(async (user) => {
      try {
        // Sử dụng user.avatar (đã được lấy từ getUserInfoData)
        return user.avatar ? await loadImage(user.avatar) : null;
      } catch {
        return null;
      }
    })
  );

  const moveRight = 30;

  // Vẽ từng user
  limitedUsers.forEach((user, index) => {
    const yPos = headerHeight + index * itemHeight + 10;
    const centerY = yPos + (itemHeight - 10) / 2;

    // Khung item
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(10, yPos, width - 20, itemHeight - 10, 10);
    ctx.fill();

    // Kích thước và vị trí avatar
    const avatarSize = 70;
    const avatarX = 20 + moveRight;
    const avatarY = centerY - avatarSize / 2;
    const cornerRadius = 10;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.clip();

    // Vẽ avatar (hoặc ô xám nếu null)
    if (avatars[index]) {
      ctx.drawImage(avatars[index], avatarX, avatarY, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = "#555"; // Ô xám cho avatar lỗi/null
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }

    // Vẽ số thứ tự
    const numberSize = 20;
    const numberX = avatarX + avatarSize - numberSize;
    const numberY = avatarY + avatarSize - numberSize;

    // --- THAY ĐỔI: Nền STT màu Đỏ ---
    ctx.fillStyle = "#FF0000"; // Màu đỏ
    ctx.beginPath();
    ctx.roundRect(numberX, numberY, numberSize, numberSize, [cornerRadius, 0, cornerRadius, 0]);
    ctx.fill();

    // Chữ số
    ctx.fillStyle = "#FFFFFF"; // Chữ trắng cho nổi
    ctx.font = "bold 12px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${index + 1}`, numberX + numberSize / 2, numberY + numberSize / 2 + 1);
    
    ctx.restore();

    // --- THAY ĐỔI: Vẽ viền Đỏ ---
    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();

    // --- TEXT ---
    const textX = avatarX + avatarSize + 20;

    // Tên (Sử dụng user.name)
    ctx.font = "bold 26px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(user.name, textX, centerY - 15);

    // --- THAY ĐỔI: Chức vụ -> Thời gian cấm chat (màu Đỏ) ---
    ctx.font = "18px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#FF0000"; // Màu đỏ
    
    // Dùng user.role (đã gán thời gian cấm chat vào đây)
    ctx.fillText(user.role, textX, centerY + 20); 
  });

  // Lưu file
  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(`./assets/temp/mute_list_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}
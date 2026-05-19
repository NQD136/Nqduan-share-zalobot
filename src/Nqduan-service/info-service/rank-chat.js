import fs from "fs";
import path from "path";
import { MessageType } from "zlbotdqt";
import { readGroupSettings } from "../../utils/io-json.js";
import { getBotName, getProjectRoot } from "../../utils/env.js";

// --- Import canvas và các hàm cần thiết ---
import { createCanvas, loadImage } from "canvas";
import { getUserInfoData } from "./user-info.js"; 
import { getGroupInfoData } from "./group-info.js";
import { clearImagePath } from "../../utils/canvas/index.js"; 
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";

// --- Logic tìm đường dẫn (Giữ nguyên) ---
function resolveRankInfoPath() {
  const botName = getBotName();
  const projectRoot = getProjectRoot();
  const botSpecificPath = path.join(
    projectRoot,
    "mybot",
    "json-data",
    `rank_info-${botName}.json`
  );
  const defaultPath = path.join(
    projectRoot,
    "assets",
    "json-data",
    "rank-info.json"
  );

  if (fs.existsSync(botSpecificPath)) {
    return botSpecificPath;
  }
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }
  console.log(
    `[RankSystem] Sẽ tạo mới file rank tại: ${botSpecificPath}`
  );
  return botSpecificPath;
}

const rankInfoPath = resolveRankInfoPath();

// --- Hàm helper lấy ngày YYYY-MM-DD (Giữ nguyên) ---
function getTodayDateString() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const vnTime = new Date(utc + 3600000 * 7);
  
  const year = vnTime.getFullYear();
  const month = (vnTime.getMonth() + 1).toString().padStart(2, "0");
  const day = vnTime.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// --- Các hàm đọc/ghi/cập nhật Rank (Giữ nguyên) ---
export function readRankInfo() {
  try {
    const data = JSON.parse(fs.readFileSync(rankInfoPath, "utf8"));
    if (!data) data = { groups: {} };
    if (!data.groups) data.groups = {};

    for (const groupId in data.groups) {
      if (Array.isArray(data.groups[groupId].users)) {
        console.warn(`[RankSystem] Phát hiện cấu trúc 'users' dạng Mảng cũ cho group ${groupId}. Dữ liệu rank cũ có thể bị mất.`);
        data.groups[groupId].users = {}; 
      }
      if (!data.groups[groupId].users) {
         data.groups[groupId].users = {};
      }
    }
    return data;
  } catch (error) {
    console.error(`Lỗi khi đọc file ${rankInfoPath}, sẽ tạo file mới:`, error.message);
    return { groups: {} };
  }
}

function writeRankInfo(data) {
  try {
    fs.writeFileSync(rankInfoPath, JSON.stringify(data, null, 2), "utf8");
  } catch (error)
 {
    console.error(`Lỗi khi ghi file ${rankInfoPath}:`, error);
  }
}

export function updateUserRank(groupId, userId, userName, nameGroup) {
  const rankInfo = readRankInfo();
  const today = getTodayDateString();

  if (!rankInfo.groups[groupId]) {
    rankInfo.groups[groupId] = { nameGroup: nameGroup, users: {} };
  }
  
  if (nameGroup) {
      rankInfo.groups[groupId].nameGroup = nameGroup;
  }

  if (!rankInfo.groups[groupId].users[userId]) {
    rankInfo.groups[groupId].users[userId] = {
      UserName: userName,
      totalRank: 0,
      dailyRanks: {},
    };
  }

  rankInfo.groups[groupId].users[userId].UserName = userName;
  rankInfo.groups[groupId].users[userId].totalRank++;

  if (!rankInfo.groups[groupId].users[userId].dailyRanks[today]) {
    rankInfo.groups[groupId].users[userId].dailyRanks[today] = 0;
  }
  rankInfo.groups[groupId].users[userId].dailyRanks[today]++;

  writeRankInfo(rankInfo);
}

export async function initRankSystem() {
    // (Giữ nguyên logic)
  const groupSettings = readGroupSettings();
  const rankInfo = readRankInfo();

  for (const [groupId, groupData] of Object.entries(groupSettings)) {
    if (!rankInfo.groups[groupId]) {
      rankInfo.groups[groupId] = { users: {} };
    }

    if (groupData["adminList"]) {
      for (const [userId, userName] of Object.entries(groupData["adminList"])) {
        if (!rankInfo.groups[groupId].users[userId]) {
          rankInfo.groups[groupId].users[userId] = {
            UserName: userName,
            totalRank: 0,
            dailyRanks: {},
          };
        }
      }
    }
  }
  writeRankInfo(rankInfo);
}

// --- HÀM XỬ LÝ LỆNH TOPCHAT (ĐÃ CẬP NHẬT) ---
/**
 * Hàm điều phối chính cho lệnh 'topchat'
 */
export async function handleTopChatCommand(api, message) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const mentions = message.data.mentions; 
  const content = removeMention(message).toLowerCase();
  const prefix = getGlobalPrefix();

  // --- Logic xử lý 'topchat me' hoặc 'topchat @tag' ---
  let targetUserId = null;
  
  if (mentions && mentions.length > 0 && content.startsWith(`${prefix}topchat`)) {
      targetUserId = mentions[0].uid;
  } 
  else if (content === `${prefix}topchat me`) { 
      targetUserId = senderId;
  }

  if (targetUserId) {
      // Nếu có mục tiêu (me hoặc @tag), gọi hàm xử lý riêng và kết thúc
      return await handleSingleUserRank(api, message, targetUserId);
  }
  
  // --- LOGIC MỚI: Xử lý TOPCHAT TEXT ---
  if (content === `${prefix}topchat text`) {
      return await handleTextRankList(api, message, "all");
  } else if (content === `${prefix}topchat today text`) {
      return await handleTextRankList(api, message, "today");
  }
  // --- KẾT THÚC LOGIC MỚI ---

  // --- LOGIC CŨ (Bảng xếp hạng Top 10 Dạng Ảnh) ---
  let mode = "all"; 
  let title = "Bảng Xếp Hạng (Toàn bộ)"; 

  if (content.startsWith(`${prefix}topchat today`)) {
    mode = "today";
    title = `Bảng Xếp Hạng (Hôm nay)`;
  } else if (content.startsWith(`${prefix}topchat`)) {
     mode = "all";
     title = "Bảng Xếp Hạng (Toàn bộ)";
  } else {
     return false; // Không phải lệnh topchat nào cả
  }

  // (Phần logic xử lý Top 10)
  const rankInfo = readRankInfo();
  const groupUsers = rankInfo.groups[threadId]?.users || {};

  if (Object.keys(groupUsers).length === 0) {
    await api.sendMessage(
      { msg: "Chưa có dữ liệu xếp hạng cho nhóm này.", quote: message, ttl: 600000 },
      threadId,
      MessageType.GroupMessage
    );
    return true;
  }
  
  const groupInfo = await getGroupInfoData(api, threadId);
  const memberCount = groupInfo ? groupInfo.memberCount : '???';

  const today = getTodayDateString();
  let usersToRank = [];

  for (const [userId, userData] of Object.entries(groupUsers)) {
    if (mode === "all") {
      if(userData.totalRank > 0) {
        usersToRank.push({
          UID: userId,
          UserName: userData.UserName,
          Rank: userData.totalRank,
        });
      }
    } else if (mode === "today") {
      const todayRank = userData.dailyRanks[today];
      if (todayRank > 0) {
        usersToRank.push({
          UID: userId,
          UserName: userData.UserName,
          Rank: todayRank,
        });
      }
    }
  }
  
  const totalMessages = usersToRank.reduce((acc, user) => acc + user.Rank, 0);

  if (usersToRank.length === 0) {
    const msg = mode === 'today' 
      ? "Hôm nay chưa ai tương tác." 
      : "Chưa có dữ liệu xếp hạng.";
    await api.sendMessage(
      { msg: msg, quote: message, ttl: 600000 },
      threadId,
      MessageType.GroupMessage
    );
    return true;
  }

  const top10UsersData = usersToRank
    .sort((a, b) => b.Rank - a.Rank)
    .slice(0, 10);

  let imagePath = null;
  try {
    const finalUserList = [];
    const userInfoPromises = top10UsersData.map(user => 
      getUserInfoData(api, user.UID).catch(e => {
        console.error(`[TopChat] Lỗi lấy info user ${user.UID}: ${e.message}`);
        return { name: user.UserName, avatar: null, uid: user.UID }; 
      })
    );
    
    const userInfos = await Promise.all(userInfoPromises);

    for (let i = 0; i < userInfos.length; i++) {
        finalUserList.push({
            ...(userInfos[i] || { name: top10UsersData[i].UserName, avatar: null }),
            Rank: top10UsersData[i].Rank 
        });
    }

    imagePath = await createRankListImage(finalUserList, title, totalMessages, memberCount);

    await api.sendMessage(
      { msg: "", attachments: [imagePath], ttl: 600000, quote: message },
      threadId,
      MessageType.GroupMessage
    );

  } catch (error) {
    console.error(`[handleTopChatCommand] Lỗi: ${error.message}`, error.stack);
    await api.sendMessage(
      { msg: "Đã xảy ra lỗi khi tạo bảng xếp hạng.", quote: message },
      threadId,
      MessageType.GroupMessage
    );
  } finally {
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
  
  return true; 
}


// --- HÀM MỚI: Xử lý Rank List Dạng Text (Phân trang) ---
/**
 * Hàm hiển thị danh sách xếp hạng (tất cả thành viên) dưới dạng văn bản có phân trang.
 * @param {Object} api - Đối tượng API
 * @param {Object} message - Đối tượng tin nhắn
 * @param {string} mode - "all" (toàn bộ) hoặc "today" (hôm nay)
 */
export async function handleTextRankList(api, message, mode) {
    const threadId = message.threadId;
    const rankInfo = readRankInfo();
    const groupUsers = rankInfo.groups[threadId]?.users || {};
    const today = getTodayDateString();
    
    const sendMessageText = (msg) => api.sendMessage({ msg: msg, quote: message, ttl: 3600000 }, threadId, MessageType.GroupMessage);

    let usersToRank = [];
    let title = "";

    // 1. Lọc và Chuẩn bị dữ liệu
    if (mode === "all") {
        title = "BẢNG XẾP HẠNG (TOÀN BỘ)";
        for (const [userId, userData] of Object.entries(groupUsers)) {
            if (userData.totalRank > 0) {
                usersToRank.push({
                    UID: userId,
                    UserName: userData.UserName,
                    Rank: userData.totalRank,
                });
            }
        }
    } else if (mode === "today") {
        title = "BẢNG XẾP HẠNG (HÔM NAY)";
        for (const [userId, userData] of Object.entries(groupUsers)) {
            const todayRank = userData.dailyRanks[today];
            if (todayRank > 0) {
                usersToRank.push({
                    UID: userId,
                    UserName: userData.UserName,
                    Rank: todayRank,
                });
            }
        }
    }
    
    // Sắp xếp
    usersToRank.sort((a, b) => b.Rank - a.Rank);

    if (usersToRank.length === 0) {
        const msg = mode === 'today' 
          ? "Hôm nay chưa ai tương tác." 
          : "Chưa có dữ liệu xếp hạng.";
        await sendMessageText(msg);
        return true;
    }

    // 2. Cơ chế Phân trang (Chunking)
    const CHUNK_SIZE = 50; // 50 người dùng mỗi trang
    const chunks = [];
    
    for (let i = 0; i < usersToRank.length; i += CHUNK_SIZE) {
      const chunk = usersToRank.slice(i, i + CHUNK_SIZE);
      chunks.push(chunk);
    }
    
    // 3. Gửi tin nhắn từng phần
    for (const [chunkIndex, userChunk] of chunks.entries()) {
        let contentMessage = "";
        
        if (chunkIndex === 0) {
            contentMessage += `${title}\n\n`;
        } else {
            contentMessage += `TIẾP THEO\n\n`;
        }

        for (const [index, user] of userChunk.entries()) {
            const actualIndex = chunkIndex * CHUNK_SIZE + index + 1;
            
            // Định dạng: 1. [Tên user] - [Rank] tin nhắn
            contentMessage +=
              `${actualIndex}. ${user.UserName}: ${user.Rank} tin nhắn\n`;
        }
        
        const totalPages = chunks.length;
        if (totalPages > 1) {
            contentMessage += `(Trang ${chunkIndex + 1}/${totalPages})`;
        }

        await sendMessageText(contentMessage);
    }
    
    return true;
}


// --- HÀM Xử lý rank cá nhân (Giữ nguyên) ---
/**
 * Xử lý yêu cầu xếp hạng cho một người dùng cụ thể
 */
async function handleSingleUserRank(api, message, targetUserId) {
  const threadId = message.threadId;
  const rankInfo = readRankInfo();
  const groupUsers = rankInfo.groups[threadId]?.users || {};
  const userData = groupUsers[targetUserId];
  const today = getTodayDateString();

  if (!userData || (userData.totalRank === 0 && !userData.dailyRanks[today])) {
    await api.sendMessage(
      { msg: "Người dùng này chưa có dữ liệu tương tác trong nhóm.", quote: message, ttl: 600000 },
      threadId,
      MessageType.GroupMessage
    );
    return true;
  }

  let imagePath = null;
  try {
    // Lấy thông tin (Tên mới + Avatar)
    const userInfo = await getUserInfoData(api, targetUserId);
    if (!userInfo) {
       await api.sendMessage(
          { msg: "Không thể lấy thông tin của người dùng này.", quote: message },
          threadId,
          MessageType.GroupMessage
        );
        return true;
    }

    const totalRank = userData.totalRank || 0;
    const todayRank = userData.dailyRanks[today] || 0;

    // --- THAY ĐỔI: Gọi hàm vẽ hàng ngang mới ---
    imagePath = await createSingleUserRankRowImage(userInfo, totalRank, todayRank);

    // Gửi ảnh
    await api.sendMessage(
      { msg: "", attachments: [imagePath], ttl: 600000, quote: message },
      threadId,
      MessageType.GroupMessage
    );

  } catch (error) {
    console.error(`[handleSingleUserRank] Lỗi: ${error.message}`, error.stack);
    await api.sendMessage(
      { msg: "Đã xảy ra lỗi khi tạo ảnh xếp hạng cá nhân.", quote: message },
      threadId,
      MessageType.GroupMessage
    );
  } finally {
    // Xóa file tạm
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
  
  return true; // Đã xử lý lệnh
}

// --- HÀM Vẽ ảnh rank cá nhân (Giữ nguyên) ---
/**
 * Hàm vẽ ảnh cho rank cá nhân (kiểu hàng ngang)
 * @param {Object} userInfo - Thông tin user (từ getUserInfoData)
 * @param {Number} totalRank - Tổng rank
 * @param {Number} todayRank - Rank hôm nay
 */
async function createSingleUserRankRowImage(userInfo, totalRank, todayRank) {
  const width = 660;
  const itemHeight = 100;
  const headerHeight = 100;
  const listPadding = 20;
  
  // Chiều cao: Header + 1 hàng + padding
  const height = headerHeight + itemHeight + listPadding;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 1. Nền Gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#004e92");
  gradient.addColorStop(1, "#000428");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Tiêu đề
  ctx.font = "bold 36px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Thông Tin Tương Tác", width / 2, headerHeight / 2);

  // 3. Vẽ hàng
  const yPos = headerHeight + 10; // 10px padding từ header
  const centerY = yPos + (itemHeight - 10) / 2;
  const moveRight = 30;

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

  // Vẽ avatar
  try {
    if (userInfo.avatar && userInfo.avatar.startsWith('http')) {
      const avatarImg = await loadImage(userInfo.avatar);
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    } else {
      throw new Error("Avatar invalid");
    }
  } catch (e) {
    // Ảnh dự phòng nếu lỗi
    ctx.fillStyle = "#555";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  // Viền avatar (Viền xám tiêu chuẩn)
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
  ctx.stroke();

  // --- TEXT ---
  const textX = avatarX + avatarSize + 20;

  // Tên (Dùng user.name)
  ctx.font = "bold 26px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#ffffff"; // Màu trắng
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(userInfo.name || "Không rõ tên", textX, centerY - 15);

  // Rank (Hôm nay | Toàn bộ)
  const rankText = `Hôm nay: ${todayRank} tin nhắn | Toàn bộ: ${totalRank} tin nhắn`;
  ctx.font = "20px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#cccccc";
  ctx.fillText(rankText, textX, centerY + 20);

  // Lưu file
  const tempDir = path.resolve("./assets/temp");
  await fs.promises.mkdir(tempDir, { recursive: true });
  const filePath = path.join(tempDir, `rank_single_row_${Date.now()}.png`);
  await fs.promises.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}


// --- HÀM VẼ CANVAS (TOP 10) (ĐÃ CẬP NHẬT) ---
async function createRankListImage(users, title, totalMessages, memberCount) {
  const prefix = getGlobalPrefix();
  const footerText = `Dùng ${prefix}topchat today để xem bảng xếp hạng hằng ngày`;
  
  const width = 660;
  const itemHeight = 100;
  const headerHeight = 100;
  const listPadding = 20; 
  
  const isAllTimeChart = title.toLowerCase().indexOf('hôm nay') === -1;
  
  // --- THAY ĐỔI: Giảm chiều cao summary (còn 1 dòng) ---
  const summaryHeight = 40; 
  const footerHeight = isAllTimeChart ? 40 : 0;
  const height = headerHeight + users.length * itemHeight + listPadding + summaryHeight + footerHeight;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#004e92");
  gradient.addColorStop(1, "#000428");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Tiêu đề
  ctx.font = "bold 36px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, width / 2, headerHeight / 2);

  // Tải avatar
  const avatars = await Promise.all(
    users.map(async (user) => {
      try {
        return (user.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('http')) 
               ? await loadImage(user.avatar) 
               : null;
      } catch (e) {
        console.error(`[CanvasRank] Lỗi tải avatar (${user.avatar}): ${e.message}`);
        return null;
      }
    })
  );

  const moveRight = 30;

  // Vẽ từng user
  users.forEach((user, index) => {
    const yPos = headerHeight + index * itemHeight + 10;
    const centerY = yPos + (itemHeight - 10) / 2;

    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(10, yPos, width - 20, itemHeight - 10, 10);
    ctx.fill();

    const avatarSize = 70;
    const avatarX = 20 + moveRight;
    const avatarY = centerY - avatarSize / 2;
    const cornerRadius = 10;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.clip();

    if (avatars[index]) {
      ctx.drawImage(avatars[index], avatarX, avatarY, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = "#555";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }
    
    let medalColor = null;
    let textColor = "#ffffff"; 

    if (index === 0) {
        medalColor = "#FFD700"; 
        textColor = "#FFD700"; 
    } else if (index === 1) {
        medalColor = "#C0C0C0"; 
        textColor = "#C0C0C0"; 
    } else if (index === 2) {
        medalColor = "#CD7F32"; 
        textColor = "#CD7F32"; 
    }

    const numberSize = 20;
    const numberX = avatarX + avatarSize - numberSize;
    const numberY = avatarY + avatarSize - numberSize;
    const numberText = `${index + 1}`;
    
    const textX_Num = numberX + numberSize / 2;
    const textY_Num = numberY + numberSize / 2 + 1;

    if (medalColor) {
        ctx.fillStyle = medalColor;
        ctx.beginPath();
        ctx.roundRect(numberX, numberY, numberSize, numberSize, [cornerRadius, 0, cornerRadius, 0]);
        ctx.fill();
        ctx.fillStyle = "#000000";
    } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; 
        ctx.beginPath();
        ctx.roundRect(numberX, numberY, numberSize, numberSize, [cornerRadius, 0, cornerRadius, 0]);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
    }
    ctx.font = "bold 12px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(numberText, textX_Num, textY_Num);
    
    ctx.restore();

    if(medalColor) {
        ctx.strokeStyle = medalColor;
        ctx.lineWidth = 3;
    } else {
        ctx.strokeStyle = "#888"; 
        ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();

    const textX = avatarX + avatarSize + 20;

    ctx.font = "bold 26px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(user.name || "Không rõ tên", textX, centerY - 15); 

    ctx.font = "20px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#cccccc"; 
    ctx.fillText(`${user.Rank} tin nhắn`, textX, centerY + 20);
  });
  
  // --- THAY ĐỔI: Vẽ Tóm tắt (1 DÒNG) ---
  const summaryY_Start = headerHeight + users.length * itemHeight + listPadding;
  const isToday = title.toLowerCase().indexOf('hôm nay') !== -1;
  const totalMsgText = `Tổng tin nhắn ${isToday ? '(Hôm nay)' : '(Toàn bộ)'}: ${totalMessages}`;
  const totalMemberText = `Số thành viên: ${memberCount}`;
  
  // Gộp 2 dòng thành 1
  const summaryText = `${totalMsgText} | ${totalMemberText}`;
  
  // Vị trí Y cho dòng tóm tắt (ở giữa summaryHeight)
  const summaryY_Line = summaryY_Start + (summaryHeight / 2);
  
  ctx.font = "18px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#cccccc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(summaryText, width / 2, summaryY_Line);
  // --- KẾT THÚC VẼ TÓM TẮT ---

  // Vẽ Footer
  if (isAllTimeChart) {
    const footerY = height - footerHeight / 2 - 5; 
    ctx.font = "italic 16px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#aaaaaa"; 
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(footerText, width / 2, footerY);
  }

  // Lưu file
  const tempDir = path.resolve("./assets/temp");
  await fs.promises.mkdir(tempDir, { recursive: true });
  const filePath = path.join(tempDir, `rank_list_${Date.now()}.png`);
  await fs.promises.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}


// --- HÀM MỚI: Dùng cho Scheduler Task (Không tự gửi tin) ---
/**
 * Hàm tạo ảnh rank list (cho task) và trả về path
 * @param {Object} api
 * @param {String} threadId
 * @param {String} mode - 'all' hoặc 'today'
 * @returns {Promise<{imagePath: String|null, error: String|null}>}
 */
export async function generateRankImageForTask(api, threadId, mode = "today") {
  const rankInfo = readRankInfo();
  const groupUsers = rankInfo.groups[threadId]?.users || {};

  if (Object.keys(groupUsers).length === 0) {
    console.log(`[RankTask] Nhóm ${threadId} không có dữ liệu rank.`);
    return { imagePath: null, error: "Chưa có dữ liệu." };
  }

  // Lấy thông tin nhóm
  let memberCount = '???';
  try {
      const groupInfo = await getGroupInfoData(api, threadId);
      if(groupInfo) memberCount = groupInfo.memberCount;
  } catch (e) {
      console.warn(`[RankTask] Không thể lấy group info ${threadId}: ${e.message}`);
  }

  const today = getTodayDateString();
  let usersToRank = [];
  let title = "";

  // Logic lọc user (từ handleTopChatCommand)
  if (mode === "all") {
    title = "Bảng Xếp Hạng (Toàn bộ)";
    for (const [userId, userData] of Object.entries(groupUsers)) {
      if (userData.totalRank > 0) {
        usersToRank.push({
          UID: userId,
          UserName: userData.UserName,
          Rank: userData.totalRank,
        });
      }
    }
  } else if (mode === "today") {
    title = `Bảng Xếp Hạng (Hôm nay)`;
    for (const [userId, userData] of Object.entries(groupUsers)) {
      const todayRank = userData.dailyRanks[today];
      if (todayRank > 0) {
        usersToRank.push({
          UID: userId,
          UserName: userData.UserName,
          Rank: todayRank,
        });
      }
    }
  }

  const totalMessages = usersToRank.reduce((acc, user) => acc + user.Rank, 0);

  if (usersToRank.length === 0) {
    console.log(`[RankTask] Nhóm ${threadId} không có ai tương tác (${mode}).`);
    return { imagePath: null, error: "Không có ai tương tác." };
  }

  const top10UsersData = usersToRank
    .sort((a, b) => b.Rank - a.Rank)
    .slice(0, 10);

  let imagePath = null;
  try {
    const finalUserList = [];
    const userInfoPromises = top10UsersData.map(user =>
      getUserInfoData(api, user.UID).catch(e => {
        console.error(`[TopChat] Lỗi lấy info user ${user.UID}: ${e.message}`);
        return { name: user.UserName, avatar: null, uid: user.UID };
      })
    );

    const userInfos = await Promise.all(userInfoPromises);

    for (let i = 0; i < userInfos.length; i++) {
      finalUserList.push({
        ...(userInfos[i] || { name: top10UsersData[i].UserName, avatar: null }),
        Rank: top10UsersData[i].Rank,
      });
    }

    // Gọi hàm vẽ (đã có sẵn)
    imagePath = await createRankListImage(finalUserList, title, totalMessages, memberCount);

    return { imagePath: imagePath, error: null };

  } catch (error) {
    console.error(`[generateRankImageForTask] Lỗi: ${error.message}`, error.stack);
    return { imagePath: null, error: error.message };
  }
  // Lưu ý: Không xóa imagePath ở đây, hàm gọi (scheduler) sẽ xóa
}
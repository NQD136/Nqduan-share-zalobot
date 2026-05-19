import os from "os";
import si from "systeminformation";
import disk from "diskusage";
import { readFileSync } from "fs";
import { join } from "path";
import { getBotId } from "../../index.js";
import { getUserInfoData } from "./user-info.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { createBotInfoImage } from "../../utils/canvas/detail.js";

// ĐÃ SỬA: Thêm managerData làm tham số
export async function getBotDetails(api, message, groupSettings = {}, managerData = null) {
  const threadId = message.threadId;
  const uptime = getUptime();
  const memoryUsage = getMemoryUsage();
  
  // ĐÃ SỬA: Truyền managerData vào getConfigStatus
  const { onConfigs, offConfigs } = getConfigStatus(threadId, groupSettings, managerData);
  
  const botVersion = getBotVersion();
  const botId = getBotId();

  const botInfo = await getUserInfoData(api, botId);

  const path = os.platform() === 'win32' ? 'C:' : '/';
  const [cpuData, diskData] = await Promise.all([
    si.currentLoad(),
    disk.check(path)
  ]);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedRam = ((totalMem - freeMem) / 1024 / 1024 / 1024).toFixed(1);
  const totalRam = (totalMem / 1024 / 1024 / 1024).toFixed(1);
  const freeRam = (freeMem / 1024 / 1024 / 1024).toFixed(1);

  const diskUsage = diskData ? `${((diskData.total - diskData.available) / 1024 / 1024 / 1024).toFixed(1)}GB `
    + `/`
    + ` ${(diskData.total / 1024 / 1024 / 1024).toFixed(1)}GB`
    + ` (Free ${(diskData.available / 1024 / 1024 / 1024).toFixed(1)}GB)` : "N/A";

  const botStats = {
    version: botVersion,
    os: getOsInfo(),
    memoryUsage,
    cpu: `${os.cpus().length} Cores - Utilization ${cpuData.currentLoad.toFixed(1)}% `,
    ram: `${usedRam} GB / ${totalRam} GB (Free ${freeRam} GB)`,
    cpuModel: os.cpus()[0].model,
    cpuTemp: os.cpus()[0].temp,
    disk: diskUsage,
    network: si.networkInterfaces()
  };

  let imagePath = null;
  try {
    imagePath = await createBotInfoImage(botInfo, uptime, botStats, onConfigs, offConfigs);
    await api.sendMessage({ msg: "", attachments: [imagePath] ,ttl: 600000 }, threadId, message.type);
  } catch (error) {
    console.error("Lỗi khi tạo hình ảnh thông tin bot:", error);
  } finally {
    if (imagePath) await clearImagePath(imagePath);
  }
}

function getOsInfo() {
  let typeOs = "Unknown";
  switch (os.type()) {
    case "Linux":
      typeOs = "Linux";
      break;
    case "Darwin":
      typeOs = "macOS";
      break;
    case "Windows_NT":
      typeOs = "Windows";
      break;
  }
  return `${typeOs} ${os.release()}`;
}

function getUptime() {
  const uptimeInSeconds = process.uptime();
  const days = Math.floor(uptimeInSeconds / 86400);
  const hours = Math.floor((uptimeInSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeInSeconds % 60);

  return `${days} ngày, ${hours} giờ, ${minutes} phút, ${seconds} giây`;
}

function getMemoryUsage() {
  const usedMem = process.memoryUsage().heapUsed;
  return `${Math.round((usedMem / 1024 / 1024) * 100) / 100} MB`;
}

// ĐÃ SỬA: Toàn bộ hàm này
function getConfigStatus(threadId, groupSettings, managerData) {
  // --- SỬA LỖI: Thêm dấu ? (optional chaining) để tránh lỗi khi groupSettings là null ---
  const settings = groupSettings?.[threadId] || {}; 
  const onConfigs = [];
  const offConfigs = [];

  // --- THÊM LOGIC ĐỌC CÀI ĐẶT CHUNG (PRIVATE) ---
  if (managerData && managerData.data) {
    const globalSettings = {
      onBotPrivate: managerData.data.onBotPrivate, // Lấy từ managerData
      onGamePrivate: managerData.data.onGamePrivate, // Lấy từ managerData
    };

    Object.entries(globalSettings)
      .filter(([key, value]) => typeof value === "boolean")
      .forEach(([key, value]) => {
        const configLine = `${getSettingEmoji(key)} ${getSettingName(key)}`;
        if (value) {
          onConfigs.push(configLine);
        } else {
          offConfigs.push(configLine);
        }
      });
  }
  // --- KẾT THÚC LOGIC MỚI ---

  // Logic cũ cho cài đặt nhóm (giữ nguyên)
  Object.entries(settings)
    .filter(([key, value]) => typeof value === "boolean")
    .forEach(([key, value]) => {
      const status = value ? "✅" : "❌";
      const configLine = `${getSettingEmoji(key)} ${getSettingName(key)}`;
      if (value) {
        onConfigs.push(configLine);
      } else {
        offConfigs.push(configLine);
      }
    });

  return { onConfigs, offConfigs };
}


function getBotVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    return packageJson.version || "Không xác định";
  } catch (error) {
    console.error("Lỗi khi đọc phiên bản bot:", error);
    return "Không xác định";
  }
}

// ĐÃ SỬA: Thêm 2 emoji mới
function getSettingEmoji(settingKey) {
  const emojiMap = {
    onBotPrivate: "🔒", // <-- THÊM MỚI
    onGamePrivate: "🕹️", // <-- THÊM MỚI
    antiSpam: "🔰",
    removeLinks: "🔗",
    filterBadWords: "🚫",
    antiPhoto: "🖼️", 
    antiVideo: "🎥",
    antiSticker:"🚫",
    antiVoice: "🔊",
    antiGif: "🚫",
    antiFile: "🔗",
    autoJoin: "🔗",
    antiStickerEffect: "🧨",
    antiText: "💬",
    enableAntiBot: "🚫",
    welcomeGroup: "👋",
    byeGroup: "👋",
    learnEnabled: "💡",
    replyEnabled: "💬",
    activeBot: "🤖",
    activeGame: "🎮",
    memberApprove: "👥",
    antiNude: "🚫",
    removeTags: "🚫",
    antiUndo: "🚫",
    updateGroup: "🔔",
    sendTask: "🔔",
    ifMentioned : "📤",
    enableDownload: "🔗",
    enableSetup: "⚙️",
    antiMention: "🚫",
    sendstk: "💬",
    autoReplyCommand: "💬",
    blockForward: "🚫",
    prWelcomeEnabled: "👋",
    enableBlockImage: "🚫",
    enableKickImage: "🚫",
  };
  return emojiMap[settingKey] || "⚙️";
}

// ĐÃ SỬA: Thêm 2 tên mới
export function getSettingName(settingKey) {
  const nameMap = {
    onBotPrivate: "Tương tác lệnh riêng tư", // <-- THÊM MỚI
    onGamePrivate: "Tương tác game riêng tư", // <-- THÊM MỚI
    activeBot: "Tương tác với thành viên",
    activeGame: "Bật xử lý tương tác trò chơi",
    antiSpam: "Chống spam",
    removeTags: "Chống nhắc đến",
    antiText: "Chống gửi văn bản",
    enableAntiBot: "Chống bot",
    antiStickerEffect: "Chống sticker hiệu ứng",
    removeLinks: "Chặn liên kết",
    antiPhoto: "Chống gửi ảnh & stickercustom", 
    antiGif: "Chống gửi Gif",
    antiVideo: "Chống gửi video",
    antiVoice: "Chống gửi tin nhắn thoại",
    antiSticker: "Chống gửi sticker hệ thống",
    antiFile: "Chống gửi media file",
    filterBadWords: "Xoá tin nhắn thô tục",
    welcomeGroup: "Chào thành viên mới",
    byeGroup: "Báo thành viên rời nhóm",
    learnEnabled: "Học máy",
    replyEnabled: "Trả lời tin nhắn nhóm",
    onlyText: "Chỉ được nhắn tin văn bản",
    memberApprove: "Phê duyệt thành viên mới",
    antiNude: "Chống ảnh nhạy cảm",
    antiUndo: "Chống thu hồi tin nhắn",
    sendTask: "Gửi nội dung tự động",
    updateGroup: "Thông báo sự kiện nhóm",
    ifMentioned: "Trả lời tin nhắn nhắc đến",
    enableDownload: "Nhận diện và tải nội dung",
    antiMention: "Chống hành vi bất thường",
    enableSetup: "Setup hệ thống",
    autoJoin: "Tự động tham gia nhóm",
    sendstk: "Gửi sticker tự động",
    autoReplyCommand: "Trả lời tin nhắn nhắc đến AI-Reply",
    blockForward: "Chống chuyển tiếp tin nhắn",
    prWelcomeEnabled: "Pr cho thành viên mới",
    enableKickImage: "Thông báo thành viên bị kick",
    enableBlockImage: "Thông báo thành viên bị block",
  };
  return nameMap[settingKey] || settingKey;
}
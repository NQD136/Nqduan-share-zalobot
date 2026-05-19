import { MessageType } from "zlbotdqt";
import * as cv from "../../utils/canvas/index.js";
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";
import {
  sendMessageWarning,
  sendMessageFromSQL,
  sendMessageInsufficientAuthority,
  sendMessageStateQuote,
  sendMessageCompleteRequest,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import {
  tempDir,
  writeCommandConfig,
  writeGroupSettings,
} from "../../utils/io-json.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { getCommandConfig, isAdmin } from "../../index.js";
import { removeMention } from "../../utils/format-util.js";
import { managerData } from "./active-bot.js";
import fs from "fs/promises";
import fsOnly from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas, loadImage } from "canvas"; // (Cần cho Canvas)
import { deleteFile } from "../../utils/util.js";

// (Các import từ file 87 giữ nguyên)
import { spawn } from "child_process";
import fetch from "node-fetch";
import { setTimeout as delay } from "timers/promises";
import * as cheerio from "cheerio";
import qs from "qs";
import schedule from "node-schedule";
// ----------------------------------------

// =================================================================
// --- BIẾN TOÀN CỤC VÀ SCHEDULE (GIỮ NGUYÊN TỪ FILE 87) ---
// =================================================================
const waitingActionBlockedMembersMap = new Map();
const timeOutWaitingActionGroup = 600000;

schedule.scheduleJob("*/5 * * * * *", () => {
  const currentTime = Date.now();
  // Dọn dẹp map của blocked members
  for (const [msgId, data] of waitingActionBlockedMembersMap.entries()) {
    if (currentTime - data.timestamp > timeOutWaitingActionGroup) {
      waitingActionBlockedMembersMap.delete(msgId);
    }
  }
});
// =================================================================

let stop = false;

const baseDataPath = path.resolve(
  process.cwd(),
  "src",
  "service-dqt",
  "chat-zalo",
  "chat-special",
  "send-video",
  "data-api",
);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let activeTodo = false;

export function stopTodo() {
  activeTodo = false;
}

// =================================================================
// --- HÀM TIỆN ÍCH CHUNG (GIỮ NGUYÊN TỪ FILE 87) ---
// =================================================================

async function downloadFile(url, filePath) {
  const writer = (await import("fs")).createWriteStream(filePath);
  const response = await axios({ url, method: "GET", responseType: "stream" });
  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getReplyMediaUrl(message) {
  const quote = message.data?.quote;
  if (!quote || !quote.attach) return null;

  try {
    const attachData = JSON.parse(quote.attach);
    const imageUrl = attachData.params
      ? JSON.parse(attachData.params)?.hd || attachData.href
      : attachData.href;
    return imageUrl;
  } catch (e) {
    return null;
  }
}

// =================================================================
// --- HÀM KICK (GIỮ NGUYÊN TỪ FILE 87) ---
// =================================================================
export async function handleKick(api, message, groupInfo) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;

  // [SỬA LỖI NHÓM/CỘNG ĐỒNG] Lấy thông tin nhóm MỚI NHẤT
  let currentGroupInfo;
  try {
    const group = await api.getGroupInfo(threadId);
    currentGroupInfo = group.gridInfoMap[threadId];
  } catch (e) {
    console.error("Không thể lấy thông tin nhóm trong handleKick:", e);
    currentGroupInfo = groupInfo; // Dùng fallback là groupInfo cũ
  }

  const groupName = currentGroupInfo.name; // <-- SỬA
  const groupType = currentGroupInfo.type; // <-- SỬA

  if (!message.data.mentions || message.data.mentions.length === 0) {
    await sendMessageWarning(api, message, ":D Đại Ca muốn kick ai? 🚀", false);
    return;
  }

  const uids = [];
  const UserDataMentions = [];
  for (const mention of message.data.mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content
      .substring(mention.pos, mention.pos + mention.len)
      .replace("@", "");

    if (isAdmin(targetId, threadId)) {
      if (!isAdmin(senderId) || isAdmin(targetId)) {
        await sendMessageWarning(
          api,
          message,
          `Bạn không thể kick quản trị viên ${targetName}.`,
          false,
        );
        continue;
      }
    }

    uids.push(targetId);
    try {
      const userInfo = await getUserInfoData(api, targetId);
      if (userInfo) {
        UserDataMentions.push(userInfo);
      }
    } catch (error) {
      console.error(
        ` Không lấy được thông tin cho người dùng ${targetId}:`,
        error,
      );
    }
  }

  if (uids.length === 0) {
    return;
  }

  try {
    const result = await api.removeUserFromGroup(threadId, uids);
    if (result.errorMembers.length > 0) {
      await sendMessageWarning(
        api,
        message,
        "Đưa Em Key Vàng 🔑, Em Kick Cho Đại Ca Xem :D 🚀",
        false,
      );
      return;
    }

    const successfulKicks = UserDataMentions.filter(
      (user) =>
        uids.includes(user.uid) && !result.errorMembers.includes(user.uid),
    );
    for (const userInfo of successfulKicks) {
      let imagePath = null;
      try {
        imagePath = await cv.createKickImage(
          userInfo,
          groupName, // <-- SỬA
          groupType, // <-- SỬA
          userInfo.genderId,
          senderName,
        );

        const kickMessage = {
          msg: "",
          attachments: imagePath ? [imagePath] : [],
          ttl: 3600000, // [SỬA TTL]
        };

        await api.sendMessage(kickMessage, threadId, MessageType.GroupMessage);
      } catch (error) {
        console.error("Lỗi khi tạo và gửi ảnh kết quả kick:", error);
      } finally {
        await cv.clearImagePath(imagePath);
      }
    }
  } catch (error) {
    console.error("Lỗi trong quá trình thực hiện kick:", error);
    await sendMessageWarning(
      api,
      message,
      "Đã xảy ra lỗi khi thực hiện kick. Có thể bot không đủ quyền. 🔑",
      false,
    );
  }
}

// =================================================================
// --- CÁC HÀM KHÁC (GIỮ NGUYÊN TỪ FILE 87) ---
// =================================================================

export async function handleKickAll(api, message, groupInfo) {
  const threadId = message.threadId;
  const groupName = groupInfo.name;
  const senderName = message.data.dName;
  try {
    const group = await api.getGroupInfo(threadId);
    if (!group || !group.gridInfoMap || !group.gridInfoMap[threadId]) {
      console.error("Không thể lấy thông tin nhóm:", threadId);
      await sendMessageWarning(
        api,
        message,
        "Lỗi: Không thể lấy thông tin nhóm! 🚀",
        false,
      );
      return;
    }
    const groupData = group.gridInfoMap[threadId];
    const creatorId = groupData.creatorId || "";
    const memberList = groupData.memVerList
      ? groupData.memVerList.map((member) => member.split("_")[0])
      : [];
    if (!Array.isArray(memberList) || memberList.length === 0) {
      console.error("Danh sách thành viên nhóm không hợp lệ:", memberList);
      await sendMessageWarning(
        api,
        message,
        "Lỗi: Không thể lấy danh sách thành viên nhóm! 🚀",
        false,
      );
      return;
    }
    const membersToKick = memberList.filter(
      (uid) => uid !== creatorId && !isAdmin(uid, threadId),
    );
    if (membersToKick.length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Không có thành viên nào để kick! 🚀",
        false,
      );
      return;
    }
    const validMembers = [];
    const UserDataMentions = [];
    for (const uid of membersToKick) {
      try {
        const userInfo = await getUserInfoData(api, uid);
        if (userInfo) {
          validMembers.push(uid);
          UserDataMentions.push(userInfo);
        }
      } catch (error) {
        console.warn(
          `UID ${uid} không hợp lệ hoặc không tồn tại trong nhóm:`,
          error,
        );
      }
    }
    if (validMembers.length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Không tìm thấy thành viên hợp lệ để kick! 🚀",
        false,
      );
      return;
    }
    let kickedCount = 0;
    try {
      const result = await api.removeUserFromGroup(threadId, validMembers);
      if (result.errorMembers && result.errorMembers.length > 0) {
        console.warn(
          `Không thể kick một số thành viên: ${result.errorMembers.join(", ")}`,
        );
      }
      kickedCount = validMembers.length - result.errorMembers.length;
    } catch (error) {
      console.error("Lỗi khi kick tất cả thành viên:", error);
      return;
    }

    if (kickedCount === 0) {
      await sendMessageWarning(
        api,
        message,
        "Không thể kick bất kỳ thành viên nào! 🚀",
        false,
      );
      return;
    }

    await sendMessageStateQuote(
      api,
      message,
      `Đã kick ${kickedCount} thành viên!`,
      true,
      300000,
    );
  } catch (error) {
    console.error("Lỗi khi kick tất cả thành viên:", error);
    await sendMessageWarning(
      api,
      message,
      "Đưa Em Key Vàng 🔑, Em Kick Tất Cả Cho Đại Ca Xem :D 🚀",
      false,
    );
  }
}

export async function handleKickMe(api, message, groupInfo) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  let imagePath = null;

  // [SỬA LỖI NHÓM/CỘNG ĐỒNG] Lấy thông tin nhóm MỚI NHẤT
  let currentGroupInfo;
  try {
    const group = await api.getGroupInfo(threadId);
    currentGroupInfo = group.gridInfoMap[threadId];
  } catch (e) {
    console.error("Không thể lấy thông tin nhóm trong handleKickMe:", e);
    currentGroupInfo = groupInfo; // Dùng fallback là groupInfo cũ
  }

  const groupName = currentGroupInfo.name; // <-- SỬA
  const groupType = currentGroupInfo.type; // <-- SỬA

  try {
    let userInfo = null;
    try {
      userInfo = await getUserInfoData(api, senderId);
    } catch (infoError) {
      console.warn("Không thể lấy userInfo cho kickme:", infoError);
    }

    if (userInfo) {
      try {
        imagePath = await cv.createKickMeImage(
          // Giả định cv.createKickMeImage tồn tại
          userInfo,
          groupName, // <-- SỬA
          groupType, // <-- SỬA
          isAdmin(senderId, threadId),
        );
        await api.sendMessage(
          { msg: "", attachments: [imagePath], quote: message, ttl: 3600000 }, // [SỬA TTL]
          threadId,
          message.type,
        );
      } catch (imgError) {
        console.error("Lỗi khi tạo/gửi ảnh kickme:", imgError);
        await api.sendMessage(
          {
            msg: `🚀 Tạm biệt [ ${senderName} ], chơi ngu thì phải chịu\nĐừng có kêu`,
            quote: message,
            ttl: 3600000,
          },
          threadId,
          message.type,
        );
      } finally {
        if (imagePath) {
          setTimeout(() => cv.clearImagePath(imagePath), 60000);
        }
      }
    } else {
      await api.sendMessage(
        {
          msg: `🚀 Tạm biệt [ ${senderName} ], chơi ngu thì phải chịu\nĐừng có kêu`,
          quote: message,
          ttl: 3600000,
        },
        threadId,
        message.type,
      );
    }

    const result = await api.removeUserFromGroup(threadId, [senderId]);

    if (result.errorMembers && result.errorMembers.length > 0) {
      // (Không cần báo lỗi)
    }
  } catch (error) {
    console.error("Lỗi khi tự kick:", error);
    if (!imagePath) {
      await sendMessageWarning(
        api,
        message,
        "Đã xảy ra lỗi khi thực hiện tự kick. Có thể bot không đủ quyền. 🔑",
        false,
      );
    }
  }
}

export async function handleGroupManage(api, message, args) {
  const { threadId, senderId } = message;

  if (!isAdmin(senderId, threadId)) {
    await api.sendMessage("Bạn không có quyền sử dụng lệnh này!", threadId);
    return;
  }

  const config = getCommandConfig();
  console.log("Cấu hình lệnh:", config);

  await api.sendMessage("Đang xử lý lệnh quản lý nhóm...", threadId);
}

export async function handleBlock(api, message, groupInfo) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;

  // [SỬA LỖI NHÓM/CỘNG ĐỒNG] Lấy thông tin nhóm MỚI NHẤT
  let currentGroupInfo;
  try {
    const group = await api.getGroupInfo(threadId);
    currentGroupInfo = group.gridInfoMap[threadId];
  } catch (e) {
    console.error("Không thể lấy thông tin nhóm trong handleBlock:", e);
    currentGroupInfo = groupInfo; // Dùng fallback là groupInfo cũ
  }

  const groupName = currentGroupInfo.name; // <-- SỬA
  const groupType = currentGroupInfo.type; // <-- SỬA

  if (!message.data.mentions || message.data.mentions.length === 0) {
    await sendMessageWarning(api, message, ":D Đại Ca muốn chặn ai? 🚀", false);
    return;
  }

  const uids = [];
  const UserDataMentions = [];
  for (const mention of message.data.mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content
      .substring(mention.pos, mention.pos + mention.len)
      .replace("@", "");

    if (isAdmin(targetId, threadId)) {
      if (!isAdmin(senderId) || isAdmin(targetId)) {
        await sendMessageWarning(
          api,
          message,
          `Bạn không thể block quản trị viên ${targetName}.`,
          false,
        );
        continue;
      }
    }

    uids.push(targetId);
    try {
      const userInfo = await getUserInfoData(api, targetId);
      if (userInfo) {
        UserDataMentions.push(userInfo);
      }
    } catch (error) {
      console.error(`Không lấy thông tin cho người dùng ${targetId}:`, error);
    }
  }

  if (uids.length === 0) {
    return;
  }

  try {
    const result = await api.blockUsers(threadId, uids);
    if (result.errorMembers && result.errorMembers.length > 0) {
      await sendMessageWarning(
        api,
        message,
        "Đưa Em Key Vàng 🔑, Em Block Cho Đại Ca Xem :D 🚀",
        false,
      );
      return;
    }

    // [PHẦN ĐÃ SỬA LỖI]
    const errorMembers = result.errorMembers || [];
    const successfulBlocks = UserDataMentions.filter(
      (user) => uids.includes(user.uid) && !errorMembers.includes(user.uid),
    );

    for (const userInfo of successfulBlocks) {
      let imagePath = null;
      try {
        imagePath = await cv.createBlockImage(
          userInfo,
          groupName, // <-- SỬA
          groupType, // <-- SỬA
          userInfo.genderId,
          senderName,
        );

        const blockMessage = {
          msg: "",
          attachments: imagePath ? [imagePath] : [],
          ttl: 3600000, // [SỬA TTL]
        };

        await api.sendMessage(blockMessage, threadId, message.type);
      } catch (error) {
        console.error("Lỗi khi tạo và gửi ảnh kết quả block:", error);
      } finally {
        await cv.clearImagePath(imagePath);
      }
    }
  } catch (error) {
    console.error("Lỗi trong quá trình thực hiện block:", error);
    await sendMessageWarning(
      api,
      message,
      "Đã xảy ra lỗi khi thực hiện block. Có thể bot không đủ quyền. 🔑",
      false,
    );
  }
}

export async function handleBlockAll(api, message, groupInfo) {
  const threadId = message.threadId;
  const groupName = groupInfo.name;
  const senderId = message.data.uidFrom;

  function hasSilverKey(uid, threadId, groupData) {
    const adminIds = groupData.adminIds ? [...groupData.adminIds] : [];
    return adminIds.includes(uid);
  }

  try {
    if (!senderId) {
      await sendMessageWarning(
        api,
        message,
        "Lỗi: Không thể xác định người gửi! 🚀",
        false,
      );
      return;
    }

    const group = await api.getGroupInfo(threadId);
    if (!group || !group.gridInfoMap || !group.gridInfoMap[threadId]) {
      await sendMessageWarning(
        api,
        message,
        "Lỗi: Không thể lấy thông tin nhóm! 🚀",
        false,
      );
      return;
    }
    const groupData = group.gridInfoMap[threadId];
    const creatorId = groupData.creatorId || "";

    if (
      senderId !== creatorId &&
      !hasSilverKey(senderId, threadId, groupData)
    ) {
      await sendMessageWarning(
        api,
        message,
        "Bạn cần là creator hoặc có key bạc để thực hiện lệnh này! 🔑",
        false,
      );
      return;
    }

    const memberList = groupData.memVerList
      ? groupData.memVerList.map((member) => member.split("_")[0])
      : [];
    if (!Array.isArray(memberList) || memberList.length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Lỗi: Không thể lấy danh sách thành viên nhóm! 🚀",
        false,
      );
      return;
    }

    const membersToBlock = memberList.filter(
      (uid) =>
        uid !== creatorId &&
        !isAdmin(uid, threadId) &&
        !hasSilverKey(uid, threadId, groupData),
    );
    if (membersToBlock.length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Không có thành viên nào để chặn! 🚀",
        false,
      );
      return;
    }

    const validMembers = [];
    const UserDataMentions = [];
    for (const uid of membersToBlock) {
      try {
        const userInfo = await getUserInfoData(api, uid);
        if (userInfo) {
          validMembers.push(uid);
          UserDataMentions.push(userInfo);
        }
      } catch (error) {
        // Bỏ qua lỗi
      }
    }

    if (validMembers.length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Không tìm thấy thành viên hợp lệ để chặn! 🚀",
        false,
      );
      return;
    }

    let blockedCount = 0;
    try {
      const result = await api.blockUsers(threadId, validMembers);
      if (result.errorMembers && result.errorMembers.length > 0) {
        blockedCount = validMembers.length - result.errorMembers.length;
      } else {
        blockedCount = validMembers.length;
      }
    } catch (error) {
      await sendMessageWarning(
        api,
        message,
        "Đưa Em Key Vàng hoặc Key Bạc 🔑, Em Block Tất Cả Cho Đại Ca Xem :D 🚀",
        false,
      );
      return;
    }

    if (blockedCount === 0) {
      await sendMessageWarning(
        api,
        message,
        "Không thể chặn bất kỳ thành viên nào! 🚀",
        false,
      );
      return;
    }

    await sendMessageStateQuote(
      api,
      message,
      `Đã chặn ${blockedCount} thành viên!`,
      true,
      300000,
    );
  } catch (error) {
    await sendMessageWarning(
      api,
      message,
      "Đưa Em Key Vàng hoặc Key Bạc 🔑, Em Block Tất Cả Cho Đại Ca Xem :D 🚀",
      false,
    );
  }
}

export async function handleBlockMe(api, message, groupInfo) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  let imagePath = null;

  // [SỬA LỖI NHÓM/CỘNG ĐỒNG] Lấy thông tin nhóm MỚI NHẤT
  let currentGroupInfo;
  try {
    const group = await api.getGroupInfo(threadId);
    currentGroupInfo = group.gridInfoMap[threadId];
  } catch (e) {
    console.error("Không thể lấy thông tin nhóm trong handleBlockMe:", e);
    currentGroupInfo = groupInfo; // Dùng fallback là groupInfo cũ
  }

  const groupName = currentGroupInfo.name; // <-- SỬA
  const groupType = currentGroupInfo.type; // <-- SỬA

  try {
    let userInfo = null;
    try {
      userInfo = await getUserInfoData(api, senderId);
    } catch (infoError) {
      console.warn("Không thể lấy userInfo cho blockme:", infoError);
    }

    if (userInfo) {
      try {
        imagePath = await cv.createBlockMeImage(
          // Giả định cv.createBlockMeImage tồn tại
          userInfo,
          groupName, // <-- SỬA
          groupType, // <-- SỬA
          isAdmin(senderId, threadId),
        );
        await api.sendMessage(
          { msg: "", attachments: [imagePath], quote: message, ttl: 3600000 }, // [SỬA TTL]
          threadId,
          message.type,
        );
      } catch (imgError) {
        console.error("Lỗi khi tạo/gửi ảnh blockme:", imgError);
        await api.sendMessage(
          {
            msg: `🚀 Tạm biệt [ ${senderName} ], chơi ngu thì phải chịu\nĐừng có kêu`,
            quote: message,
            ttl: 3600000,
          },
          threadId,
          message.type,
        );
      } finally {
        if (imagePath) {
          setTimeout(() => cv.clearImagePath(imagePath), 60000);
        }
      }
    } else {
      await api.sendMessage(
        {
          msg: `🚀 Tạm biệt [ ${senderName} ], chơi ngu thì phải chịu\nĐừng có kêu`,
          quote: message,
          ttl: 3600000,
        },
        threadId,
        message.type,
      );
    }

    const result = await api.blockUsers(threadId, [senderId]);

    if (result.errorMembers && result.errorMembers.length > 0) {
      // (Không cần báo lỗi)
    }
  } catch (error) {
    console.error("Lỗi khi tự block:", error);
    if (!imagePath) {
      await sendMessageWarning(
        api,
        message,
        "Đã xảy ra lỗi khi thực hiện tự block. Có thể bot không đủ quyền. 🔑",
        false,
      );
    }
  }
}

// (TRONG FILE group-manage.js (file 87/90))
// =================================================================
// --- HÀM LISTBLOCKEDMEMBERS (V19 - SỬA LỖI CHIA 50) ---
// =================================================================
export async function handleListBlockedMembers(api, message, groupInfo) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  let imagePath = null;

  try {
    if (!managerData.data) {
      managerData.data = { groupBlockedMembers: [] };
    }

    let group;
    try {
      group = await api.getGroupInfo(threadId);
    } catch (error) {
      await sendMessageWarning(
        api,
        message,
        `Không thể lấy thông tin nhóm! 😭 Vui lòng thử lại sau.`,
        false,
      );
      return;
    }

    if (!group || !group.gridInfoMap?.[threadId]) {
      await sendMessageWarning(
        api,
        message,
        "Dữ liệu nhóm không hợp lệ, vui lòng thử lại! 😢",
        false,
      );
      return;
    }

    const groupData = group.gridInfoMap[threadId];
    const adminIds = groupData.adminIds ? [...groupData.adminIds] : [];
    const creatorId = groupData.creatorId || "";

    if (!adminIds.includes(senderId) && senderId !== creatorId) {
      await sendMessageInsufficientAuthority(
        api,
        message,
        "Bạn cần key bạc hoặc key vàng để xem danh sách này! 😎",
      );
      return;
    }

    let blockedMembers = [];
    try {
      blockedMembers = await getGroupBlockList(api, message);
    } catch (error) {
      blockedMembers = managerData.data.groupBlockedMembers || [];
      await sendMessageWarning(
        api,
        message,
        `Không lấy được danh sách từ server, dùng dữ liệu cục bộ nha! 😜`,
        false,
      );
    }

    if (!blockedMembers.length) {
      // [SỬA LOGIC NHÓM/CỘNG ĐỒNG] Truyền thêm groupData.type
      imagePath = await createBlockListImage(
        [],
        "Danh Sách Chặn",
        groupData.type,
      );

      await api.sendMessage(
        {
          msg: "",
          attachments: [imagePath],
          ttl: 3600000, // [SỬA TTL]
        },
        message.threadId,
        message.type,
      );
      return;
    }

    let blockedList = [];
    try {
      const blockedMemberIds = blockedMembers.map(
        (member) => member.id || member.uid || member.userId,
      );
      const blockedInfo = await api.getUserInfo(blockedMemberIds);

      if (
        !blockedInfo ||
        (!blockedInfo.unchanged_profiles && !blockedInfo.changed_profiles)
      ) {
        await sendMessageWarning(
          api,
          message,
          "Không lấy được thông tin thành viên bị chặn! 😓",
          false,
        );
        return;
      }
      blockedList = [
        ...Object.values(blockedInfo.unchanged_profiles || {}).map((user) => ({
          name: user.zaloName || user.displayName || "Không xác định",
          role: "Thành viên bị chặn",
          avatar: user.avatar || null,
          id: user.userId,
        })),
        ...Object.values(blockedInfo.changed_profiles || {}).map((user) => ({
          name: user.zaloName || user.displayName || "Không xác định",
          role: "Thành viên bị chặn",
          avatar: user.avatar || null,
          id: user.userId,
        })),
      ];

      managerData.data.groupBlockedMembers = blockedList.map((user) => ({
        idUserZalo: user.id,
        senderName: user.name,
      }));
    } catch (error) {
      blockedList = managerData.data.groupBlockedMembers.map((user) => ({
        name: user.senderName,
        role: "Thành viên bị chặn",
        avatar: null,
      }));
      await sendMessageWarning(
        api,
        message,
        `Không lấy được thông tin chi tiết, dùng dữ liệu cục bộ nha! 😜`,
        false,
      );
    }

    // [SỬA LOGIC NHÓM/CỘNG ĐỒNG] Truyền thêm groupData.type
    imagePath = await createBlockListImage(
      blockedList,
      groupData.name || "Danh Sách Chặn",
      groupData.type,
    );

    const fileExists = await fs
      .access(imagePath)
      .then(() => true)
      .catch(() => false);
    if (!fileExists) {
      await sendMessageWarning(
        api,
        message,
        `Không thể tạo hình ảnh! 😓 Vui lòng thử lại.`,
        false,
      );
      return;
    }

    await api.sendMessage(
      {
        msg: "",
        attachments: [imagePath],
        ttl: 3600000, // [SỬA TTL]
      },
      message.threadId,
      message.type,
    );
  } catch (error) {
    await sendMessageWarning(
      api,
      message,
      `Đã xảy ra lỗi khi xử lý danh sách thành viên bị chặn! 😓 Vui lòng thử lại.`,
      false,
    );
  } finally {
    if (imagePath) {
      setTimeout(async () => {
        try {
          await fs.unlink(imagePath);
        } catch (error) {}
      }, 30 * 1000);
    }
  }
}

export async function handleKeyCommands(
  api,
  message,
  groupSettings,
  isAdminLevelHighest,
) {
  const content = removeMention(message).toLowerCase().trim();
  const prefix = getGlobalPrefix();

  // Chỉ xử lý khi tin nhắn bắt đầu bằng "key" (có hoặc không có prefix)
  if (!content.startsWith("key") && !content.startsWith(prefix + "key")) {
    return false;
  }

  const cleanCmd = content.replace(prefix, "").trim(); // bỏ prefix nếu có

  // CASE 1: Chỉ gõ "key" hoặc "!key" → hiện hướng dẫn đẹp
  if (cleanCmd === "key" || cleanCmd === "key ") {
    const guide = `
🔑HƯỚNG DẪN LỆNH KEY
『${prefix}key gold』→ Đưa key vàng
『${prefix}key up @mention』→ Phong key bạc
『${prefix}key down @mention』→ Gỡ key bạc`.trim();

    await sendMessageStateQuote(api, message, guide, true, 600000);
    return true;
  }

  // CASE 2: Các lệnh thật sự (chỉ nhận đúng 3 lệnh này)
  if (
    !cleanCmd.startsWith("key gold") &&
    !cleanCmd.startsWith("key up") &&
    !cleanCmd.startsWith("key down")
  ) {
    return true; // đã xử lý hướng dẫn ở trên, không cần làm gì thêm
  }

  // Kiểm tra quyền chủ bot
  if (!isAdminLevelHighest) {
    await sendMessageInsufficientAuthority(
      api,
      message,
      "Chỉ chủ bot mới được dùng lệnh key!",
    );
    return true;
  }

  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const mentions = message.data.mentions || [];

  let action;
  if (cleanCmd.includes("key gold")) action = "gold";
  else if (cleanCmd.includes("key up")) action = "up";
  else action = "down";

  // Xử lý target
  if (mentions.length === 0) {
    // Không tag ai → áp dụng cho chính mình (dùng khi nhường key vàng)
    await doKeyAction(api, message, threadId, senderId, "bạn", action);
  } else {
    for (const mention of mentions) {
      const targetId = mention.uid;
      const targetName = message.data.content
        .substring(mention.pos, mention.pos + mention.len)
        .replace("@", "")
        .trim();
      await doKeyAction(
        api,
        message,
        threadId,
        targetId,
        targetName || "người này",
        action,
      );
    }
  }

  writeGroupSettings(groupSettings);
  return true;
}

// Hàm thực hiện key (gọn nhẹ)
async function doKeyAction(api, message, threadId, targetId, name, action) {
  try {
    if (action === "gold") {
      await api.changeGroupOwner(threadId, targetId);
      await sendMessageStateQuote(
        api,
        message,
        `Đã đưa key vàng cho ${name}`,
        true,
        300000,
      );
    } else if (action === "up") {
      await api.addGroupAdmins(threadId, targetId);
      await sendMessageStateQuote(
        api,
        message,
        `Đã phong key bạc cho ${name}`,
        true,
        300000,
      );
    } else if (action === "down") {
      await api.removeGroupAdmins(threadId, targetId);
      await sendMessageStateQuote(
        api,
        message,
        `Đã hạ key của ${name}`,
        true,
        300000,
      );
    }
  } catch (error) {
    const txt =
      action === "gold"
        ? "đưa key vàng"
        : action === "up"
          ? "phong key bạc"
          : "hạ key";
    await sendMessageStateQuote(
      api,
      message,
      `Không thể ${txt} cho ${name}\nKhông đủ quyền`,
      false,
      300000,
    );
  }
}

export async function handleBlockBot(api, message, groupSettings) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  let listIdBlock = [];
  let messageContent = "";

  if (!isAdmin(senderId, threadId)) {
    try {
      await sendMessageInsufficientAuthority(
        api,
        message,
        "Bạn không có quyền sử dụng lệnh này!",
      );
    } catch (error) {
      console.error("Lỗi khi gửi thông báo thiếu quyền:", error);
    }
    return;
  }

  if (!managerData.data) {
    managerData.data = { blockBot: [] };
  } else if (!managerData.data.blockBot) {
    managerData.data.blockBot = [];
  }

  try {
    if (groupSettings) {
      const mentions = message.data.mentions;
      if (mentions && mentions.length > 0) {
        for (const mention of mentions) {
          const targetId = mention.uid;
          const targetName = message.data.content
            .substring(mention.pos, mention.pos + mention.len)
            .replace("@", "");
          if (!isAdmin(targetId, threadId)) {
            listIdBlock.push({ targetId, targetName });
          } else {
            messageContent += `🚨 Không block được Quản Trị Cấp Cao: ${targetName}\n`;
          }
        }
      } else {
        messageContent = "🚨 Vui lòng đề cập người dùng qua @mention để chặn!";
      }
    } else {
      try {
        const userInfo = await getUserInfoData(api, senderId);
        if (!isAdmin(senderId, threadId)) {
          listIdBlock.push({ targetId: senderId, targetName: userInfo.name });
        } else {
          messageContent = `🚨 Không block được Quản Trị Cấp Cao: ${userInfo.name}\n`;
        }
      } catch (error) {
        console.error(`Lỗi khi lấy thông tin người dùng ${senderId}:`, error);
        messageContent =
          "🚨 Lỗi khi lấy thông tin người dùng, vui lòng thử lại!";
      }
    }

    if (listIdBlock.length > 0) {
      const blockData = managerData.data;
      let blockedUsers = [];
      let alreadyBlockedUsers = [];

      for (const item of listIdBlock) {
        const isBlocked = blockData.blockBot.some(
          (blocked) => blocked.idUserZalo === item.targetId,
        );
        if (isBlocked) {
          alreadyBlockedUsers.push(item.targetName);
        } else {
          blockData.blockBot.push({
            idUserZalo: item.targetId,
            senderName: item.targetName,
          });
          blockedUsers.push(item.targetName);
        }
      }

      if (blockedUsers.length > 0) {
        messageContent += `✅ Đã chặn tương tác bot đối với: ${blockedUsers.join(", ")}\n`;
      }
      if (alreadyBlockedUsers.length > 0) {
        messageContent += `❌ Những người đã bị chặn từ trước: ${alreadyBlockedUsers.join(", ")}\n`;
      }
    }

    if (messageContent.trim() === "") {
      messageContent = "🚨 Không có mục tiêu hợp lệ để chặn!";
    }

    await api.sendMessage(
      {
        msg: messageContent.trim(),
        quote: message,
        ttl: 300000,
      },
      threadId,
      message.type,
    );

    if (listIdBlock.length > 0) {
      managerData.hasChanges = true;
    }
  } catch (error) {
    console.error("Lỗi trong handleBlockBot:", error);
    try {
      await api.sendMessage(
        {
          msg: "🚨 Đã có lỗi xảy ra khi xử lý lệnh blockbot, vui lòng thử lại!",
          quote: message,
          ttl: 300000,
        },
        threadId,
        message.type,
      );
    } catch (sendError) {
      console.error("Lỗi khi gửi thông báo lỗi:", sendError);
    }
  }
}

export async function handleUnblockBot(api, message, groupSettings) {
  const threadId = message.threadId;
  const senderName = message.data.dName;
  let listIdUnblock = [];

  if (groupSettings) {
    const mentions = message.data.mentions;
    if (mentions && mentions.length > 0) {
      for (const mention of mentions) {
        const targetId = mention.uid;
        const targetName = message.data.content
          .substring(mention.pos, mention.pos + mention.len)
          .replace("@", "");
        listIdUnblock.push({ targetId, targetName });
      }
    } else {
      await api.sendMessage(
        {
          msg: "🚨 Vui lòng đề cập người dùng qua @mention để bỏ chặn!",
          quote: message,
          ttl: 300000,
        },
        message.threadId,
        message.type,
      );
      return;
    }
  } else {
    const userInfo = await getUserInfoData(api, threadId);
    listIdUnblock.push({ targetId: threadId, targetName: userInfo.name });
  }

  if (listIdUnblock.length > 0) {
    const blockData = managerData.data;
    let unblockUsers = [];
    let notBlockedUsers = [];

    for (const item of listIdUnblock) {
      const blockedUserIndex = blockData.blockBot.findIndex(
        (blocked) => blocked.idUserZalo === item.targetId,
      );

      if (blockedUserIndex !== -1) {
        blockData.blockBot.splice(blockedUserIndex, 1);
        unblockUsers.push(item.targetName);
      } else {
        notBlockedUsers.push(item.targetName);
      }
    }

    let messageContent = "";
    if (unblockUsers.length > 0) {
      messageContent += `✅ Đã bỏ chặn tương tác bot đối với: ${unblockUsers.join(", ")}\n`;
    }
    if (notBlockedUsers.length > 0) {
      messageContent += `❌ Các thành viên sau Không bị chặn: ${notBlockedUsers.join(", ")}`;
    }

    if (messageContent.trim() === "") {
      messageContent = "🚨 Những người bạn tag không ai đang bị chặn.";
    }

    await api.sendMessage(
      { msg: messageContent.trim(), quote: message, ttl: 300000 },
      message.threadId,
      message.type,
    );

    managerData.hasChanges = true;
  }
}

export async function handleListBlockBot(api, message) {
  const blockData = managerData.data;
  const listBlockedUserIds = blockData.blockBot.map(
    (blocked) => blocked.idUserZalo,
  );

  if (listBlockedUserIds.length === 0) {
    await api.sendMessage(
      { msg: `🚨 Không có ai bị chặn tương tác với bot`, ttl: 300000 },
      message.threadId,
      message.type,
    );
    return;
  }

  let formattedList = [];
  try {
    const userPromises = listBlockedUserIds.map((id) =>
      getUserInfoData(api, id).catch((e) => {
        console.error(`[BlockBotList] Lỗi lấy info ${id}: ${e.message}`);
        const storedUser = blockData.blockBot.find((u) => u.idUserZalo === id);
        return {
          uid: id,
          name: storedUser ? storedUser.senderName : "Người dùng bị ẩn",
          avatar: null,
        };
      }),
    );
    const userInfos = (await Promise.all(userPromises)).filter(
      (info) => info !== null,
    );

    for (const info of userInfos) {
      formattedList.push({
        ...info,
        role: "Bị chặn tương tác với bot",
        keyType: "blocked",
      });
    }
  } catch (error) {
    console.error("Lỗi khi fetch info list block bot:", error);
    await sendMessageWarning(
      api,
      message,
      "Đã xảy ra lỗi khi lấy thông tin chi tiết người bị chặn.",
    );
    return;
  }

  if (formattedList.length === 0) {
    await sendMessageWarning(
      api,
      message,
      "Không thể lấy thông tin chi tiết của người bị chặn.",
    );
    return;
  }

  try {
    const filePath = await createBlockedBotListImage(formattedList);
    await api.sendMessage(
      {
        msg: `🛑 Đây là danh sách người dùng bị chặn tương tác với bot.`,
        attachments: [filePath],
        ttl: 3600000, // [SỬA TTL]
      },
      message.threadId,
      message.type,
    );
    setTimeout(async () => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error("Lỗi khi xóa file:", error);
      }
    }, 30 * 1000);
  } catch (drawError) {
    console.error("Lỗi khi vẽ ảnh list block bot:", drawError);
    await sendMessageWarning(
      api,
      message,
      "Đã xảy ra lỗi khi tạo ảnh danh sách.",
    );
  }
}

async function createBlockedBotListImage(blockedUsers) {
  // (Giữ nguyên logic vẽ Canvas)
  const limitedUsers = blockedUsers
    .sort((a, b) => {
      if (!a.name || !b.name) return 0;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 50);

  const width = 660;
  const itemHeight = 100;
  const headerHeight = 100;
  const height = headerHeight + limitedUsers.length * itemHeight + 20;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#004e92");
  gradient.addColorStop(1, "#000428");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.font = "bold 36px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Danh sách chặn tương tác với bot", width / 2, headerHeight / 2);

  const avatars = await Promise.all(
    limitedUsers.map(async (user) => {
      try {
        return user.avatar ? await loadImage(user.avatar) : null;
      } catch {
        return null;
      }
    }),
  );

  const moveRight = 30;

  limitedUsers.forEach((user, index) => {
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

    const numberSize = 20;
    const numberX = avatarX + avatarSize - numberSize;
    const numberY = avatarY + avatarSize - numberSize;

    ctx.fillStyle = "#FF0000";

    ctx.beginPath();
    ctx.roundRect(numberX, numberY, numberSize, numberSize, [
      cornerRadius,
      0,
      cornerRadius,
      0,
    ]);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${index + 1}`,
      numberX + numberSize / 2,
      numberY + numberSize / 2 + 1,
    );

    ctx.restore();

    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();

    const textX = avatarX + avatarSize + 20;

    ctx.font = "bold 26px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(user.name, textX, centerY - 15);

    ctx.font = "20px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";

    ctx.fillStyle = "#FF0000";

    ctx.fillText(user.role, textX, centerY + 20);
  });

  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(
    `./assets/temp/blockbot_list_${Date.now()}.png`,
  );
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

export function isUserBlocked(senderId) {
  try {
    const blockData = managerData.data;
    if (!blockData || !blockData.blockBot) {
      return false;
    }

    return blockData.blockBot.some(
      (blocked) => blocked.idUserZalo === senderId,
    );
  } catch (error) {
    console.error("Lỗi khi kiểm tra trạng thái block:", error);
    return false;
  }
}

// =================================================================
// --- HÀM SETTINGGROUP (ĐÃ SỬA LOGIC GỌI BLOCK) (FILE 87) ---
// =================================================================

export async function handleSettingGroupCommand(
  api,
  message,
  groupInfo,
  aliasCommand,
) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const args = content.slice(prefix.length).trim().split(/\s+/);
  const senderId = message.data.uidFrom;

  args.shift();

  if (args.length < 1) {
    const result = {
      success: false,
      message:
        `Sử dụng: ${prefix}${aliasCommand} <loại config> <giá trị>` +
        `\n\n[Cài đặt Bật/Tắt] (on/off hoặc 1/0):` +
        `\n- lockchat: ${groupInfo.setting?.lockSendMsg ? "Tắt" : "Mở"} chat trong nhóm` +
        `\n- lockview: ${groupInfo.setting?.lockViewMember ? "Tắt" : "Mở"} xem thành viên trong nhóm` +
        `\n- history: ${groupInfo.setting?.enableMsgHistory ? "Mở" : "Tắt"} cho phép thành viên mới đọc tin nhắn gần nhất` +
        `\n- joinappr: ${groupInfo.setting?.joinAppr ? "Mở" : "Tắt"} chế độ phê duyệt thành viên` +
        `\n- showkey: ${groupInfo.setting?.signAdminMsg ? "Mở" : "Tắt"} hiển thị key quản trị` +
        `\n\n[Lệnh Danh Sách]:` +
        `\n- listblock: Xem danh sách thành viên bị chặn` +
        `\n- remove <số/all>: Xóa người bị chặn (theo STT hoặc 'all')` +
        `\n\n[Cài đặt Chuỗi]:` +
        `\n- name <tên mới>: Đổi tên nhóm`,
    };
    await sendMessageFromSQL(api, message, result, false, 60000);
    return;
  }

  const settingType = args[0].toLowerCase();
  const value = args.slice(1).join(" ");

  if (["name"].includes(settingType)) {
    if (!value) {
      await sendMessageStateQuote(
        api,
        message,
        `Vui lòng nhập giá trị cho cài đặt ${settingType}`,
        false,
        60000,
      );
      return;
    }
    try {
      switch (settingType) {
        case "name":
          await api.changeGroupName(threadId, value);
          await sendMessageStateQuote(
            api,
            message,
            `Tên nhóm đã được đổi thành ${value}`,
            true,
            60000,
          );
          break;
      }
      return;
    } catch (error) {
      console.error(`Lỗi khi thay đổi ${settingType}:`, error);
      await sendMessageStateQuote(
        api,
        message,
        `Không thể thay đổi ${settingType}: ${error.message}`,
        false,
        60000,
      );
      return;
    }
  }
  if (settingType === "remove" || settingType === "unblock") {
    if (!isAdmin(senderId, threadId)) {
      await sendMessageInsufficientAuthority(
        api,
        message,
        "Bạn cần quyền admin để gỡ chặn thành viên!",
      );
      return;
    }

    const target = args[1]?.toLowerCase(); // Lấy "all" hoặc "1", "2"...

    if (!target) {
      await sendMessageWarning(
        api,
        message,
        `📌 Dùng: ${prefix}${aliasCommand} remove <số> hoặc ${prefix}${aliasCommand} remove all`,
      );
      return;
    }

    // --- BƯỚC 1: LẤY DANH SÁCH TỪ CACHE (ĐÃ ĐÚNG STT) ---
    if (!managerData.data || !managerData.data.groupBlockedMembers) {
      await sendMessageWarning(
        api,
        message,
        "Không tìm thấy danh sách cache. Vui lòng chạy `%stg listblock` trước khi remove.",
        false,
      );
      return;
    }

    // Lấy danh sách đã được `listblock` lưu lại
    const blockedMembersFromCache = managerData.data.groupBlockedMembers;

    if (blockedMembersFromCache.length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Không tìm thấy ai bị chặn để gỡ (cache rỗng).",
      );
      return;
    }

    // --- BƯỚC 2: XỬ LÝ `remove all` HOẶC `remove <stt>` ---

    if (target === "all") {
      // --- XỬ LÝ REMOVE ALL ---
      const allBlockedIds = blockedMembersFromCache.map((m) => m.idUserZalo);

      try {
        // Gọi API gỡ chặn (thứ tự: memberId, groupId)
        await api.removeGroupBlockedMember(allBlockedIds, threadId);

        // Xóa cache
        managerData.data.groupBlockedMembers = [];
        managerData.hasChanges = true;

        await sendMessageStateQuote(
          api,
          message,
          `✅ Đã gỡ chặn cho TẤT CẢ ${allBlockedIds.length} thành viên.`,
          true,
          30000,
        );
      } catch (err) {
        await sendMessageWarning(
          api,
          message,
          `Lỗi khi gỡ chặn: ${err.message}.`,
        );
      }
    } else {
      // --- XỬ LÝ REMOVE <STT> ---
      const index = parseInt(target);
      if (isNaN(index) || index < 1) {
        try {
        } catch (e) {}
        await sendMessageWarning(api, message, "Số thứ tự không hợp lệ.");
        return;
      }

      if (index > blockedMembersFromCache.length) {
        try {
        } catch (e) {}
        await sendMessageWarning(
          api,
          message,
          `Số ${index} vượt quá danh sách (Chỉ có ${blockedMembersFromCache.length} người trong cache).`,
        );
        return;
      }

      // Lấy user từ cache (ĐÃ ĐÚNG STT)
      const userToUnblock = blockedMembersFromCache[index - 1];
      const targetId = userToUnblock.idUserZalo;
      const targetName = userToUnblock.senderName || `ID ${targetId}`;

      try {
        // Gọi API gỡ chặn (thứ tự: memberId, groupId)
        await api.removeGroupBlockedMember([targetId], threadId);

        // Xóa user này khỏi cache
        managerData.data.groupBlockedMembers.splice(index - 1, 1);
        managerData.hasChanges = true;

        await sendMessageStateQuote(
          api,
          message,
          `✅ Đã gỡ chặn cho: ${targetName} (STT ${index}).`,
          true,
          20000,
        );
      } catch (err) {
        console.error(`[UNBLOCK LỖI] ${err.message}`);

        await sendMessageWarning(
          api,
          message,
          `Lỗi khi gỡ chặn ${targetName}: ${err.message}.`,
        );
      }
    }
    return;
  }
  // =======================================================

  // === THÊM ĐIỀU KIỆN CHO listblock (vì nó không cần 'value') ===
  if (settingType === "listblock") {
    try {
      await handleListBlockedMembers(api, message, groupInfo);
    } catch (error) {
      console.error("Lỗi khi chạy stg listblock:", error);
      await sendMessageStateQuote(
        api,
        message,
        `Lỗi khi lấy danh sách chặn: ${error.message}`,
        false,
        60000,
      );
    }
    return; // Dừng lại sau khi chạy xong
  }
  // =======================================================

  if (!value || !["on", "off", "0", "1"].includes(value.toLowerCase())) {
    await sendMessageStateQuote(
      api,
      message,
      `Vui lòng chọn on/off hoặc 1/0 để thay đổi cài đặt`,
      false,
      60000,
    );
    return;
  }

  const newValue = ["on", "1"].includes(value.toLowerCase()) ? 1 : 0;
  const currentSettings = groupInfo.setting || {};

  try {
    switch (settingType) {
      case "lockchat":
        currentSettings.lockSendMsg = newValue;
        const status = newValue === 1 ? "tắt" : "mở";
        await updateGroupSetting(
          api,
          message,
          threadId,
          currentSettings,
          `Đã ${status} chat cho tất cả thành viên!`,
        );
        break;

      case "lockview":
        currentSettings.lockViewMember = newValue;
        const memberStatus = newValue === 1 ? "tắt" : "mở";
        await updateGroupSetting(
          api,
          message,
          threadId,
          currentSettings,
          `Đã ${memberStatus} xem thành viên trong nhóm!`,
        );
        break;

      case "history":
        currentSettings.enableMsgHistory = newValue;
        const historyStatus = newValue === 1 ? "mở" : "Tắt";
        await updateGroupSetting(
          api,
          message,
          threadId,
          currentSettings,
          `Đã ${historyStatus} cho phép thành viên mới đọc tin nhắn gần nhất!`,
        );
        break;

      case "joinappr":
        currentSettings.joinAppr = newValue;
        const joinApprStatus = newValue === 1 ? "mở" : "Tắt";
        await updateGroupSetting(
          api,
          message,
          threadId,
          currentSettings,
          `Đã ${joinApprStatus} chế độ phê duyệt thành viên!`,
        );
        break;

      case "showkey":
        currentSettings.signAdminMsg = newValue;
        const showKeyStatus = newValue === 1 ? "mở" : "Tắt";
        await updateGroupSetting(
          api,
          message,
          threadId,
          currentSettings,
          `Đã ${showKeyStatus} hiển thị key quản trị!`,
        );
        break;

      default:
        await sendMessageStateQuote(
          api,
          message,
          `Loại cài đặt '${settingType}' Không hợp lệ!`,
          false,
          60000,
        );
        break;
    }
  } catch (error) {
    console.error("Lỗi khi thay đổi cài đặt nhóm:", error);
    await sendMessageStateQuote(
      api,
      message,
      `Không thể thay đổi cài đặt nhóm: ${error.message}`,
      false,
      60000,
    );
  }
}

// =================================================================
// --- HÀM BLOCKLIST (ĐÃ SỬA LỖI API) (FILE 87) ---
// =================================================================
export async function handleGroupBlockList(
  api,
  message,
  args,
  aliasCommand,
  groupTypeString,
) {
  const prefix = getGlobalPrefix();
  const threadId = message.threadId;

  if (args.length < 1) {
    await sendMessageStateQuote(
      api,
      message,
      `Cú pháp câu lệnh: ${prefix}${aliasCommand} block <add/remove/list> <@mention|index>\n` +
        `list: hiển thị danh sách đối tượng chặn trong ${groupTypeString}.\n` +
        `add: thêm đối tượng vào danh sách chặn (thông qua mention hoặc uid chỉ định).\n` +
        `remove: xóa đối tượng khỏi danh sách chặn thông qua index hoặc 'all' để xóa toàn bộ.`,
      false,
      60000,
      false,
    );
    return;
  }

  const action = args[0].toLowerCase();
  switch (action) {
    case "add":
      const uid = args[1];
      let userInfo;
      try {
        userInfo = await getUserInfoData(api, uid);
      } catch (error) {
        console.error(`Không thể lấy thông tin cho người dùng ${uid}:`, error);
      }

      const result_add = await api.blockUsers(message.threadId, [uid]);
      if (result_add.errorMembers && result_add.errorMembers.length > 0) {
        await sendMessageWarning(
          api,
          message,
          "Ném Đây Cái Key Vàng 🔑, Tôi Block Cho Bạn Xem :D 🚀",
          false,
        );
        return;
      }

      await sendMessageStateQuote(
        api,
        message,
        `🚨 Đã chặn tài khoản sau khỏi ${groupTypeString}: ${userInfo ? userInfo.name : uid}.`,
        false,
        300000,
        false,
      );
      break;

    case "remove":
      // (*** PHẦN ĐÃ SỬA LỖI ***)
      try {
        const stt = args[1]?.toLowerCase();

        // 1. Gọi helper (Đã sửa) để lấy danh sách
        const blockList = await getGroupBlockList(api, message); // (Hàm helper ở dưới)

        if (blockList && blockList.length > 0) {
          if (stt === "all") {
            // --- Logic Unblock All ---
            const uidsToUnblock = blockList.map(
              (item) => item.userId || item.uid || item.id,
            ); // (Lấy ID - Sửa lỗi log 69)

            // 2. Gọi API Unblock (File 86)
            const result_remove_all = await api.removeGroupBlockedMember(
              message.threadId,
              uidsToUnblock,
            );
            // (Không check errorMembers vì API (file 86) sẽ ném lỗi nếu thất bại)

            await sendMessageStateQuote(
              api,
              message,
              `🚨 Đã mở chặn toàn bộ ${uidsToUnblock.length} tài khoản trong danh sách chặn của ${groupTypeString}.`,
              true, // Thành công
              300000,
              false,
            );
            return;
          }

          if (isNaN(stt)) {
            await sendMessageStateQuote(
              api,
              message,
              `🚨 Vui lòng nhập số thứ tự, uid của tài khoản cần mở chặn, hoặc 'all' để xóa toàn bộ trong ${groupTypeString}.\n` +
                `Để xem danh sách chặn, chat: ${prefix}${aliasCommand} block list`,
              false,
              60000,
              false,
            );
            return;
          }

          // --- Logic Unblock theo Index ---
          let target;
          target = blockList.find(
            (item) => (item.userId || item.uid || item.id) === stt,
          ); // (Tìm bằng ID)
          if (!target) {
            const index = parseInt(stt) - 1;
            if (index < 0 || index >= blockList.length) {
              await sendMessageStateQuote(
                api,
                message,
                `🚨 Số thứ tự không hợp lệ, vui lòng nhập lại hoặc kiểm tra lại danh sách chặn.\n` +
                  `Để xem danh sách chặn, chat: ${prefix}${aliasCommand} block list`,
                false,
                60000,
                false,
              );
              return;
            }
            target = blockList[index];
          }

          const targetId = target.userId || target.uid || target.id; // (Sửa lỗi log 69)
          const targetName = target.dName || target.name || "Không rõ tên";

          // 3. Gọi API Unblock (File 86)
          const result_remove = await api.removeGroupBlockedMember(
            message.threadId,
            [targetId],
          );

          await sendMessageStateQuote(
            api,
            message,
            `🚨 Đã mở chặn tài khoản sau trong ${groupTypeString}: ${targetName} (STT: ${stt}).`,
            true, // Thành công
            300000,
            false,
          );
        } else {
          await sendMessageStateQuote(
            api,
            message,
            `🚨 Không có ai bị chặn trong ${groupTypeString} này để mở chặn.`,
            false,
            60000,
            false,
          );
        }
      } catch (error) {
        console.error("Lỗi khi xử lý 'block remove':", error);
        await sendMessageStateQuote(
          api,
          message,
          `Không thể thực hiện mở chặn: ${error.message}`,
          false,
          60000,
          false,
        );
      }
      // (*** KẾT THÚC SỬA ***)
      break;

    case "list":
      // (*** PHẦN ĐÃ SỬA LỖI ***)
      try {
        // 1. Gọi helper (Đã sửa) để lấy danh sách
        const blockList = await getGroupBlockList(api, message); // (Hàm helper ở dưới)

        if (blockList && blockList.length > 0) {
          let imagePath = null;
          try {
            // 2. Lấy Tên Nhóm và Type
            const groupInfo = await api.getGroupInfo(threadId);
            const groupData = groupInfo.gridInfoMap[threadId]; // [SỬA LOGIC NHÓM/CỘNG ĐỒNG]
            const groupName = groupData.name || "Không rõ tên nhóm"; // [SỬA LOGIC NHÓM/CỘNG ĐỒNG]
            const groupType = groupData.type; // [SỬA LOGIC NHÓM/CỘNG ĐỒNG]

            // 3. Lấy Info chi tiết
            const infoPromises = blockList.map((member) => {
              const memberId = member.userId || member.uid || member.id; // (Sửa lỗi log 69)
              return getUserInfoData(api, memberId).catch((e) => null);
            });
            const memberInfos = (await Promise.all(infoPromises)).filter(
              (info) => info !== null,
            );

            // 4. Vẽ ảnh (Hàm Canvas (V14) - đã copy xuống dưới)
            // [SỬA LOGIC NHÓM/CỘNG ĐỒNG] Truyền thêm groupType
            imagePath = await createBlockListImage(
              memberInfos,
              groupName,
              groupType,
            );

            await api.sendMessage(
              {
                msg: "",
                attachments: [imagePath],
                ttl: 3600000,
                quote: message,
              }, // [SỬA TTL]
              message.threadId,
              message.type,
            );
          } catch (error) {
            console.error("Lỗi khi tạo ảnh block list:", error);
            // Fallback về text (Giữ nguyên file 87)
            const listBlockedUsers = blockList.map(
              (blocked) => blocked.dName || "Không rõ tên",
            );
            const chunksArr = chunkArray(listBlockedUsers, 50);
            await sendMessageStateQuote(
              api,
              message,
              `Danh sách tài khoản bị chặn trong ${groupTypeString} này:\n${chunksArr[0]
                .map((user, index) => `- ${index + 1}. ${user}`)
                .join("\n")}`,
              false,
              180000,
              false,
            );
            if (chunksArr.length > 1) {
              for (let i = 1; i < chunksArr.length; i++) {
                await sendMessageStateQuote(
                  api,
                  message,
                  chunksArr[i]
                    .map((user, index) => `- ${index + 1 + i * 50}. ${user}`)
                    .join("\n"),
                  false,
                  180000,
                  false,
                );
              }
            }
          } finally {
            deleteFile(imagePath);
          }
        } else {
          await sendMessageStateQuote(
            api,
            message,
            `🚨 Không có ai bị chặn trong ${groupTypeString} này.`,
            false,
            60000,
            false,
          );
        }
      } catch (error) {
        console.error("Lỗi khi xử lý 'block list':", error);
        await sendMessageStateQuote(
          api,
          message,
          `Không thể lấy được danh sách chặn thành viên từ ${groupTypeString}`,
          false,
          60000,
          false,
        );
      }
      // (*** KẾT THÚC SỬA ***)
      break;

    default:
      await sendMessageStateQuote(
        api,
        message,
        `Cú pháp câu lệnh: ${prefix}${aliasCommand} block <add/remove/list> <uid for add|index for remove>\n` +
          `list: hiển thị danh sách đối tượng chặn trong ${groupTypeString}.\n` +
          `add: thêm đối tượng vào danh sách chặn (thông qua mention hoặc uid chỉ định).\n` +
          `remove: xóa đối tượng khỏi danh sách chặn thông qua index hoặc 'all' để xóa toàn bộ.`,
        false,
        60000,
        false,
      );
      break;
  }
}

// =================================================================
// --- HÀM HELPER LẤY BLOCKLIST (ĐÃ SỬA API) (FILE 87) ---
// =================================================================

export async function getGroupBlockList(api, message) {
  const threadId = message.threadId;
  let listBlockedUsers = [];
  let continueGet = true;
  let page = 1;

  try {
    while (continueGet) {
      // (*** PHẦN ĐÃ SỬA LỖI ***)
      // Gọi đúng API (File 67) (Đã lấy 63 người - log 69)
      const payload = { page: page, count: 50 }; // (count 50 từ file 67)
      const blockList = await api.getGroupBlockedMember(payload, threadId);
      // (*** KẾT THÚC SỬA ***)

      const membersOnPage =
        blockList.blocked_members || blockList.data || blockList;

      if (membersOnPage && membersOnPage.length > 0) {
        const processedMembers = membersOnPage.map((member) => {
          if (member.avatar && !member.avatar.startsWith("https:")) {
            member.avatar = "https:" + member.avatar;
          }
          // (Sửa lỗi log 69: Đảm bảo có key 'id'/'uid'/'userId')
          member.id = member.id || member.uid || member.userId;
          return member;
        });

        listBlockedUsers = [...listBlockedUsers, ...processedMembers];

        // (Sửa logic 'has_more' (file 87))
        continueGet = membersOnPage.length === 50; // (Tiếp tục nếu trang đầy)
        page += 1;
      } else {
        continueGet = false;
      }
    }
    return listBlockedUsers;
  } catch (error) {
    throw error;
  }
}

// =================================================================
// --- HÀM VẼ CANVAS (COPY TỪ V14 (FILE 78)) ---
// =================================================================
// [SỬA LOGIC NHÓM/CỘNG ĐỒNG] Thêm 'groupType' vào hàm
async function createBlockListImage(members, groupName, groupType) {
  const isSingleMember = members.length === 1;
  const numColumns = isSingleMember ? 1 : 2;
  const maxMembersPerColumn = Math.ceil(members.length / numColumns);
  const columnWidth = isSingleMember ? 600 : 400;

  const itemHeight = 100;
  const headerHeight = 140;
  const padding = 20;

  const width = columnWidth * numColumns + padding * (numColumns + 1);
  const height = headerHeight + maxMembersPerColumn * itemHeight + padding;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#004e92");
  gradient.addColorStop(1, "#000428");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // [SỬA LOGIC NHÓM/CỘNG ĐỒNG] Thêm logic Nhóm/Cộng Đồng vào tiêu đề
  const typeString = groupType === 2 ? "Cộng Đồng" : "Nhóm";
  const fullTitle = `${groupName} (${typeString})`;

  // Auto Font Size (V14)
  const baseFont = "'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  let fontSize = 44;
  const maxWidth = width - padding * 2;
  ctx.font = `bold ${fontSize}px ${baseFont}`;

  // [SỬA LOGIC NHÓM/CỘNG ĐỒNG] Dùng 'fullTitle' để tính toán font
  while (ctx.measureText(fullTitle).width > maxWidth && fontSize > 24) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px ${baseFont}`;
  }
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // [SỬA LOGIC NHÓM/CỘNG ĐỒNG] Vẽ 'fullTitle'
  ctx.fillText(fullTitle, width / 2, headerHeight / 2);

  const avatars = await Promise.all(
    members.map(async (member) => {
      try {
        return member.avatar ? await loadImage(member.avatar) : null;
      } catch {
        return null;
      }
    }),
  );

  members.forEach((member, index) => {
    const columnIndex = Math.floor(index / maxMembersPerColumn);
    const itemIndex = index % maxMembersPerColumn;

    const xOffset = padding + columnIndex * (columnWidth + padding);
    const yPos = headerHeight + itemIndex * itemHeight;
    const centerY = yPos + itemHeight / 2;

    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(xOffset, yPos, columnWidth, itemHeight - 10, 10);
    ctx.fill();

    // STT (V13)
    const sttX = xOffset + 15;
    const sttWidth = 40;
    ctx.font = "bold 22px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${index + 1}.`, sttX + sttWidth / 2, centerY);

    // Avatar (V13)
    const avatarSize = 70;
    const avatarX = sttX + sttWidth;
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

    ctx.restore();

    // Viền ĐỎ (Avatar)
    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();

    // Tên (V12)
    const textX = avatarX + avatarSize + 15;
    ctx.font = "bold 24px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(member.name, textX, centerY);
  });

  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(`./assets/temp/blocked_list_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

// =================================================================
// --- CÁC HÀM CÒN LẠI (GIỮ NGUYÊN TỪ FILE 87) ---
// =================================================================

async function updateGroupSetting(
  api,
  message,
  threadId,
  settings,
  successMessage,
) {
  await api.changeGroupSetting(threadId, settings);
  await sendMessageStateQuote(api, message, successMessage, true, 60000);
}

const TAGET_FILE_PATH = path.join(__dirname, "tagetList.json");

async function readTagetList() {
  try {
    const data = await fs.readFile(TAGET_FILE_PATH, "utf8");
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      const initialData = {};
      await fs.writeFile(
        TAGET_FILE_PATH,
        JSON.stringify(initialData, null, 2),
        "utf8",
      );
      return initialData;
    }
    return {};
  }
}

async function writeTagetList(tagetData) {
  try {
    await fs.writeFile(
      TAGET_FILE_PATH,
      JSON.stringify(tagetData, null, 2),
      "utf8",
    );
  } catch (error) {
    throw new Error(`Không thể ghi vào tagetList.json: ${error.message}`);
  }
}

export async function isUserTagged(senderId, threadId) {
  try {
    const tagetData = await readTagetList();
    const normalizedSenderId = String(senderId);
    const groupData = tagetData[threadId] || { tagetList: [] };
    const isTagged = groupData.tagetList.some((tagged) => {
      const match = tagged.idUserZalo === normalizedSenderId;
      return match;
    });
    return isTagged;
  } catch (error) {
    return false;
  }
}

export async function handleTaget(api, message, groupInfo) {
  const threadId = message.threadId;
  const groupName = groupInfo.name;
  const senderId = message.data.uidFrom;

  if (!isAdmin(senderId, threadId)) {
    await sendMessageInsufficientAuthority(
      api,
      message,
      "Bạn không có quyền sử dụng lệnh này!",
    );
    return;
  }

  if (!message.data.mentions || message.data.mentions.length === 0) {
    await sendMessageWarning(
      api,
      message,
      ":D Đại Ca muốn taget ai? 🚀",
      false,
    );
    return;
  }

  const tagetData = await readTagetList();
  if (!tagetData[threadId]) {
    tagetData[threadId] = { tagetList: [] };
  }
  const uids = [];
  const userDataMentions = [];
  let messageContent = "";

  for (const mention of message.data.mentions) {
    const userId = String(mention.uid);
    if (isAdmin(userId, threadId)) {
      await sendMessageWarning(
        api,
        message,
        `Đại Ca không thể taget quản trị viên: ${userId} 🚀`,
        false,
      );
      continue;
    }
    uids.push(userId);
    try {
      const userInfo = await getUserInfoData(api, userId);
      if (userInfo) {
        userDataMentions.push(userInfo);
      } else {
      }
    } catch (error) {}
  }

  if (uids.length === 0) {
    await sendMessageWarning(
      api,
      message,
      "🚨 Không có người dùng hợp lệ để taget!",
      false,
    );
    return;
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = await api.blockUsers(threadId, uids);
    if (result.errorMembers && result.errorMembers.length > 0) {
      await sendMessageWarning(
        api,
        message,
        `🚨 Không thể chặn một số thành viên: ${result.errorMembers.join(", ")}`,
        false,
      );
      return;
    }

    let taggedUsers = [];
    let alreadyTaggedUsers = [];

    for (const userInfo of userDataMentions) {
      const userId = String(userInfo.uid);
      const isTagged = tagetData[threadId].tagetList.some(
        (tagged) => tagged.idUserZalo === userId,
      );
      if (isTagged) {
        alreadyTaggedUsers.push(userInfo.name);
      } else {
        tagetData[threadId].tagetList.push({
          idUserZalo: userId,
          senderName: userInfo.name || "Không xác định",
        });
        taggedUsers.push(userInfo.name);
      }

      await api.sendMessage(
        {
          msg: `🚨 Đã chặn và taget ${userInfo.name} trong nhóm!`,
          quote: message,
          ttl: 300000,
        },
        threadId,
        message.type,
      );
    }

    if (taggedUsers.length > 0) {
      messageContent += `✅ Đã taget và chặn: ${taggedUsers.join(", ")}\n`;
    }
    if (alreadyTaggedUsers.length > 0) {
      messageContent += `❌ Đã taget từ trước: ${alreadyTaggedUsers.join(", ")}\n`;
    }

    if (messageContent.trim() === "") {
      messageContent = "🚨 Không có mục tiêu hợp lệ để taget!";
    }

    await api.sendMessage(
      {
        msg: messageContent.trim(),
        quote: message,
        ttl: 300000,
      },
      threadId,
      message.type,
    );

    if (taggedUsers.length > 0) {
      await writeTagetList(tagetData);
    } else {
    }
  } catch (error) {
    await sendMessageWarning(
      api,
      message,
      `🚨 Lỗi khi xử lý lệnh taget: ${error.message}`,
      false,
    );
  }
}
export async function handleMemberJoin(api, event) {
  const threadId = event.threadId;
  const updateMembers = event.data?.updateMembers || [];
  const groupName = event.data?.groupName || "Nhóm";

  if (!updateMembers.length) {
    return;
  }

  let botId;
  try {
    botId = await api.getBotId();
    if (!botId) {
      throw new Error("ID bot trả về là undefined hoặc null");
    }
  } catch (error) {
    await api.sendMessage(
      {
        msg: `🚨 Cảnh báo: Không thể lấy ID bot từ API: ${error.message}. Tính năng chặn người dùng bị tạm vô hiệu hóa.`,
        ttl: 300000,
      },
      threadId,
      MessageType.GroupMessage,
    );
    return;
  }

  for (const member of updateMembers) {
    const userId = String(member.id);

    try {
      if (await isUserTagged(userId, threadId)) {
        let groupInfo;
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          groupInfo = await api.getGroupInfo(threadId);
          if (!groupInfo || !groupInfo.gridInfoMap?.[threadId]) {
            await api.sendMessage(
              {
                msg: `🚨 Lỗi: Không thể lấy thông tin nhóm ${threadId}!`,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage,
            );
            continue;
          }
        } catch (error) {
          await api.sendMessage(
            {
              msg: `🚨 Lỗi: Không thể lấy thông tin nhóm ${threadId}: ${error.message}`,
              ttl: 300000,
            },
            threadId,
            MessageType.GroupMessage,
          );
          continue;
        }

        let userName = "Không xác định";
        try {
          const userInfo = await getUserInfoData(api, userId);
          userName = userInfo.name || userName;
        } catch (error) {}

        try {
          if (!botId) {
            await api.sendMessage(
              {
                msg: `🚨 Lỗi: ID bot không được cấu hình! Vui lòng liên hệ quản trị viên hệ thống.`,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage,
            );
            continue;
          }
          if (!isAdmin(botId, threadId)) {
            await api.sendMessage(
              {
                msg: `🚨 Lỗi: Bot không có quyền chặn người dùng trong nhóm ${groupName}! Vui lòng thêm bot làm quản trị viên.`,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage,
            );
            continue;
          }
        } catch (error) {
          await api.sendMessage(
            {
              msg: `🚨 Lỗi: Không thể xác định quyền của bot trong nhóm ${groupName}: ${error.message}`,
              ttl: 300000,
            },
            threadId,
            MessageType.GroupMessage,
          );
          continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));

        try {
          const result = await api.blockUsers(threadId, [userId]);
          if (result.errorMembers && result.errorMembers.includes(userId)) {
            await api.sendMessage(
              {
                msg: `🚨 Lỗi khi chặn ${userName}: Không thể chặn! Error: ${JSON.stringify(result.errorMembers)}`,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage,
            );
            continue;
          }

          await api.sendMessage(
            {
              msg: `🚨 ${userName} đã bị chặn do nằm trong danh sách taget!`,
              ttl: 300000,
            },
            threadId,
            MessageType.GroupMessage,
          );
        } catch (error) {
          await api.sendMessage(
            {
              msg: `🚨 Lỗi khi chặn ${userName}: ${error.message}`,
              ttl: 300000,
            },
            threadId,
            MessageType.GroupMessage,
          );
          continue;
        }
      }
    } catch (error) {
      await api.sendMessage(
        {
          msg: `🚨 Lỗi xử lý thành viên tham gia ${userId}: ${error.message}`,
          ttl: 300000,
        },
        threadId,
        MessageType.GroupMessage,
      );
    }
  }
}

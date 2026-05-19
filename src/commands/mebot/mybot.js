import fs from "fs/promises";
import path from "path";
import { existsSync, readFileSync } from "fs"; // Import sync functions for admin check

// ================== IMPORT TỪ CÁC FILE KHÁC ==================
import { getBotId } from "../../index.js";
import { getBotInfo } from "../../utils/env.js";
import { myBotDetail } from "./mybot-info.js"; // File 2 (bên dưới)
// Import các hàm gốc
import { startBot } from "../mybot/myBotManager.js";
import {
  checkBotExists,
  checkPM2Status,
  stopPM2Process,
  updateBotStatus,
} from "../mybot/System/pm2-manager.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import {
  sendMessageComplete,
  sendMessageWarning,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

// ================== ĐỊNH NGHĨA ĐƯỜNG DẪN ==================
const projectRoot = path.resolve(process.cwd());
const myBotDir = path.join(projectRoot, "mybot");
const myBotsPath = path.join(myBotDir, "mybots.json");

// ================== CACHING (BỘ ĐỆM) ==================
let ownerUidCache = null;
let adminListCache = null;
let botConfigCache = null;

// ================== CÁC HÀM PHẢI SAO CHÉP TỪ myBotManager.js ==================
// (Các hàm này dùng cho lệnh 'set', logic không đổi)

async function _updateBotField(uidFrom, field, value) {
  try {
    if (!existsSync(myBotsPath)) {
      throw new Error("File mybots.json không tồn tại");
    }
    const myBots = JSON.parse(await fs.readFile(myBotsPath, "utf8"));
    if (!myBots[uidFrom]) {
      throw new Error("Bot không tồn tại trong danh sách");
    }
    myBots[uidFrom][field] = value;
    myBots[uidFrom].lastUpdated = new Date().toISOString();
    await fs.writeFile(myBotsPath, JSON.stringify(myBots, null, 2));
    console.log(`[mybot.js] Đã cập nhật ${field} cho bot ${uidFrom}`);
    return true;
  } catch (error) {
    console.error(`[mybot.js] Lỗi cập nhật ${field}: ${error.message}`);
    return false;
  }
}

async function _handleUpdateName(
  api,
  uidFrom,
  dName,
  newName,
  threadId,
  type,
  message,
) {
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      return await sendMessageWarning(
        api,
        message,
        "Bot của bạn không tồn tại!",
        true,
        false,
      );
    }
    if (!newName || newName.trim().length === 0) {
      return await sendMessageWarning(
        api,
        message,
        "Tên hiển thị không được để trống!",
        true,
        false,
      );
    }
    const trimmedName = newName.trim();
    const updated = await _updateBotField(uidFrom, "displayName", trimmedName);
    if (updated) {
      await sendMessageComplete(
        api,
        message,
        `Đã cập nhật tên hiển thị thành công!\nTên mới: ${trimmedName}`,
        true,
        false,
      );
    } else {
      await sendMessageWarning(
        api,
        message,
        "Không thể cập nhật tên hiển thị. Vui lòng thử lại!",
        true,
        false,
      );
    }
  } catch (error) {
    await _handleError(error, api, threadId, "cập nhật tên bot", type, message);
  }
}

async function _handleUpdateDescription(
  api,
  uidFrom,
  dName,
  newDescription,
  threadId,
  type,
  message,
) {
  try {
    const checkResult = await checkBotExists(uidFrom);
    if (!checkResult.exists) {
      return await sendMessageWarning(
        api,
        message,
        "Bot của bạn không tồn tại!",
        true,
        false,
      );
    }
    if (!newDescription || newDescription.trim().length === 0) {
      return await sendMessageWarning(
        api,
        message,
        "Mô tả không được để trống!",
        true,
        false,
      );
    }
    const trimmedDescription = newDescription.trim();
    const updated = await _updateBotField(
      uidFrom,
      "description",
      trimmedDescription,
    );
    if (updated) {
      await sendMessageComplete(
        api,
        message,
        `Đã cập nhật mô tả bot thành công!\n\nMô tả mới: ${trimmedDescription}`,
        true,
        false,
      );
    } else {
      await sendMessageWarning(
        api,
        message,
        "Không thể cập nhật mô tả. Vui lòng thử lại!",
        true,
        false,
      );
    }
  } catch (error) {
    await _handleError(
      error,
      api,
      threadId,
      "cập nhật mô tả bot",
      type,
      message,
    );
  }
}

async function _handleError(error, api, threadId, context, type, message) {
  console.error(`[mybot.js] Lỗi ${context}: ${error.message}`);
  await sendMessageWarning(
    api,
    message,
    `Đã xảy ra lỗi khi ${context}!\n\nChi tiết: ${error.message}`,
    true,
    false,
  );
}

// ================== HÀM SHUTDOWN / RESTART ĐÃ SỬA ==================

/**
 * Hàm tắt bot với thông báo tùy chỉnh (ĐÃ SỬA)
 */
async function _handleShutdown(api, message, ownerUid) {
  const { threadId, type } = message;
  try {
    const checkResult = await checkBotExists(ownerUid);
    if (!checkResult.exists) {
      return await sendMessageWarning(
        api,
        message,
        "Bot của bạn không tồn tại!",
        true,
        false,
      );
    }
    const botInfo = checkResult.botInfo;

    if (botInfo.status === "stopped") {
      return await sendMessageWarning(
        api,
        message,
        "Bot của bạn đã tắt từ trước.",
        true,
        false,
      );
    }

    const pm2Status = await checkPM2Status(ownerUid);
    if (!pm2Status.running) {
      await updateBotStatus(ownerUid, "stopped");
      return await sendMessageWarning(
        api,
        message,
        "Bot của bạn đã tắt từ trước.",
        true,
        false,
      );
    }

    // 1. GỬI THÔNG BÁO TRƯỚC
    const customMessage =
      "Bot của bạn sẽ tắt sau vài giây\nVui lòng yêu cầu chủ bot này liên hệ Admin Lader Nqduanツ và dùng lệnh mybot start để khởi động lại bot";
    await sendMessageComplete(api, message, customMessage, true, false);

    // 2. DỪNG TIẾN TRÌNH
    const stopSuccess = await stopPM2Process(ownerUid);

    if (stopSuccess) {
      // 3. Cập nhật trạng thái
      await updateBotStatus(ownerUid, "stopped");
    } else {
      // Nếu dừng lỗi, gửi thông báo (bot vẫn đang chạy)
      await sendMessageWarning(
        api,
        message,
        "Không thể dừng bot. Vui lòng thử lại!",
        true,
        false,
      );
    }
  } catch (error) {
    await _handleError(error, api, threadId, "tắt bot", type, message);
  }
}

/**
 * Hàm khởi động lại bot với thông báo SAU KHI bot online (HÀM MỚI)
 */
async function _handleRestart(api, message, ownerUid, modifiedMessage) {
  const { threadId, type } = message;
  try {
    await sendMessageComplete(
      api,
      message,
      "Đang gửi lệnh khởi động lại, vui lòng chờ khoảng 30s...\nSau 30s không thấy lên cần liên hệ Admin Lader Nqduanツ",
      true,
      false,
    );

    // 1. Gọi hàm startBot GỐC (nhưng ẩn thông báo của nó đi)
    const result = await startBot(api, modifiedMessage, false, [], true); // suppressMessages = true

    if (!result) {
      console.warn("[mybot.js] Hàm startBot (gốc) đã thất bại.");
      // startBot đã tự gửi cảnh báo lỗi rồi, nên không cần gửi nữa.
      return;
    }

    // 2. Chờ bot thực sự online
    await sendMessageComplete(
      api,
      message,
      "Đã gửi lệnh. Đang chờ bot online...",
      true,
      false,
    );
    let retries = 15; // Chờ tối đa 30 giây (15 * 2s)
    let isOnline = false;

    while (retries > 0) {
      const status = await checkPM2Status(ownerUid);
      if (status.running && status.status === "online") {
        isOnline = true;
        break;
      }
      retries--;
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Chờ 2 giây
    }

    // 3. Gửi thông báo kết quả
    if (isOnline) {
      await sendMessageComplete(
        api,
        message,
        "✅ Bot đã khởi động lại thành công và đang online!",
        true,
        false,
      );
    } else {
      await sendMessageWarning(
        api,
        message,
        "⚠️ Đã gửi lệnh khởi động lại, nhưng không thể xác nhận bot online. Vui lòng kiểm tra lại sau.",
        true,
        false,
      );
    }
  } catch (error) {
    await _handleError(
      error,
      api,
      threadId,
      "khởi động lại bot",
      type,
      message,
    );
  }
}

// ================== HÀM TRUY LẤY DỮ LIỆU BOT ==================

/**
 * Tìm UID của Owner dựa trên UID của Bot con (dùng cache)
 */
async function findOwnerUidByBotId(runningBotUid) {
  if (ownerUidCache) return ownerUidCache;

  try {
    if (!runningBotUid || runningBotUid === -1) {
      console.warn("[mybot.js] getBotId() trả về -1, chưa sẵn sàng.");
      return null;
    }
    const myBots = JSON.parse(await fs.readFile(myBotsPath, "utf8"));

    for (const [ownerUid, botInfo] of Object.entries(myBots)) {
      if (botInfo.uid_bot === runningBotUid) {
        ownerUidCache = ownerUid;
        return ownerUid;
      }
    }
    console.warn(
      `[mybot.js] Không tìm thấy bot (UID: ${runningBotUid}) trong mybots.json`,
    );
    return null;
  } catch (error) {
    console.error(`[mybot.js] Lỗi khi tìm Owner UID: ${error.message}`);
    return null;
  }
}

/**
 * Lấy danh sách admin từ file admin CỦA BOT NÀY (dùng cache)
 */
async function getBotAdminList() {
  if (adminListCache) return adminListCache;

  try {
    if (!botConfigCache) {
      botConfigCache = await getBotInfo();
    }

    if (!botConfigCache || !botConfigCache.adminFilePath) {
      console.warn(
        "[mybot.js] Không tìm thấy 'adminFilePath' trong config của bot này.",
      );
      return [];
    }

    const adminFilePath = botConfigCache.adminFilePath;

    if (existsSync(adminFilePath)) {
      const adminList = JSON.parse(readFileSync(adminFilePath, "utf8"));
      adminListCache = Array.isArray(adminList) ? adminList.map(String) : [];
      return adminListCache;
    } else {
      console.warn(`[mybot.js] File admin không tồn tại: ${adminFilePath}`);
      adminListCache = [];
      return [];
    }
  } catch (error) {
    console.error(`[mybot.js] Lỗi đọc file admin: ${error.message}`);
    return [];
  }
}

/**
 * Kiểm tra quyền của người dùng
 */
async function checkPermission(userUid) {
  const userUidStr = userUid.toString();

  const runningBotUid = getBotId();
  if (!runningBotUid || runningBotUid === -1) return false;

  const ownerUid = await findOwnerUidByBotId(runningBotUid);
  if (ownerUid === userUidStr) {
    return true; // Người dùng là Owner -> có quyền
  }

  const adminList = await getBotAdminList();
  if (adminList.includes(userUidStr)) {
    return true; // Người dùng có trong admin list -> có quyền
  }

  return false;
}

// ================== HÀM XỬ LÝ LỆNH CHÍNH ==================

export async function handleMyBotCommand(api, message, aliasCommand) {
  const {
    threadId,
    data: { uidFrom, dName, content },
    type,
  } = message;
  const args = content.split(/\s+/);
  const prefix = getGlobalPrefix();

  // 1. LẤY OWNER UID (Cần cho TẤT CẢ các lệnh)
  const runningBotUid = getBotId();
  const ownerUid = await findOwnerUidByBotId(runningBotUid);

  if (!ownerUid) {
    return await sendMessageWarning(
      api,
      message,
      "Lỗi: Bot này không được đăng ký trong hệ thống.",
      true,
      false,
    );
  }

  // 2. TẠO MESSAGE GIẢ LẬP (Cần cho TẤT CẢ các lệnh)
  const modifiedMessage = {
    ...message,
    data: {
      ...message.data,
      uidFrom: ownerUid,
    },
  };

  // 3. Phân tích lệnh
  const subCommand = args[1]?.toLowerCase();

  const helpMessage = `《 BẢNG ĐIỀU KHIỂN BOT 》

➤『${prefix}${aliasCommand} detail』
   • Xem thông tin chi tiết bot.

➤『${prefix}${aliasCommand} restart』
   • Khởi động lại bot.

➤『${prefix}${aliasCommand} shutdown』
   • Tắt bot.

➤『${prefix}${aliasCommand} set name [tên mới]』
   • Đổi tên hiển thị của bot.

➤『${prefix}${aliasCommand} set description [mô tả mới]』
   • Đổi mô tả của bot.`;

  // 4. XỬ LÝ LỆNH KHÔNG CẦN QUYỀN (help, detail)
  if (!subCommand || subCommand === "help") {
    return await sendMessageComplete(api, message, helpMessage, true, false);
  }

  try {
    if (subCommand === "detail") {
      // Gọi hàm myBotDetail (từ mybot-info.js) - KHÔNG CẦN QUYỀN
      await myBotDetail(api, modifiedMessage, false);
      return; // Xong
    }

    // 5. KIỂM TRA QUYỀN CHO CÁC LỆNH CÒN LẠI
    const hasPermission = await checkPermission(uidFrom);
    if (!hasPermission) {
      return await sendMessageWarning(
        api,
        message,
        "Bạn không có quyền sử dụng lệnh này cho bot.",
        true,
        false,
      );
    }

    // 6. XỬ LÝ CÁC LỆNH CẦN QUYỀN
    switch (subCommand) {
      case "restart":
      case "start":
        await _handleRestart(api, message, ownerUid, modifiedMessage);
        break;

      case "shutdown":
      case "stop":
        await _handleShutdown(api, message, ownerUid);
        break;

      case "set":
        const setType = args[2]?.toLowerCase();
        const setValue = args.slice(3).join(" ");

        if (setType === "name") {
          await _handleUpdateName(
            api,
            ownerUid,
            dName,
            setValue,
            threadId,
            type,
            message,
          );
        } else if (setType === "description") {
          await _handleUpdateDescription(
            api,
            ownerUid,
            dName,
            setValue,
            threadId,
            type,
            message,
          );
        } else {
          await sendMessageWarning(
            api,
            message,
            `Sai cú pháp. Dùng:\n• ${prefix}${aliasCommand} set name [tên]\n• ${prefix}${aliasCommand} set description [mô tả]`,
            true,
            false,
          );
        }
        break;

      default:
        await sendMessageWarning(
          api,
          message,
          `Không nhận dạng được lệnh "${subCommand}". Gõ "${prefix}${aliasCommand} help" để xem hướng dẫn.`,
          true,
          false,
        );
        break;
    }
  } catch (error) {
    await _handleError(
      error,
      api,
      threadId,
      `xử lý lệnh ${subCommand}`,
      type,
      message,
    );
  }
}

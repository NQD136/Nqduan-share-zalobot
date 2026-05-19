/* --- File: target-manage.js --- */
/*
 * Cập nhật:
 * 1. [target add]: Chỉ gửi tin nhắn text.
 * 2. [handleTargetOnJoin]: Gửi ảnh khi tự động chặn.
 * 3. [handleTargetList]: Gửi ảnh (không kèm text) và CÓ quote.
 */

import { MessageType } from "zlbotdqt";
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";
import {
  getGroupAdmins,
  getGroupInfoData,
} from "../../Nqduan-service/info-service/group-info.js";
import {
  sendMessageWarning,
  sendMessageInsufficientAuthority,
  sendMessageStateQuote,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getBotId, isAdmin } from "../../index.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { removeMention } from "../../utils/format-util.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// ===== IMPORTS MỚI (CHỈ CẦN 2 HÀM NÀY) =====
import { createAutoBlockTargetImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";

// ===== IMPORTS MỚI ĐỂ VẼ ẢNH LIST =====
import { createCanvas, loadImage } from "canvas";
// (fs và path đã import ở trên)

// --- Logic quản lý file JSON (Giữ nguyên) ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
    console.error("Lỗi khi đọc tagetList.json:", error);
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
    console.error(`Không thể ghi vào tagetList.json: ${error.message}`);
    throw new Error(`Không thể ghi vào tagetList.json: ${error.message}`);
  }
}

async function isUserTagged(senderId, threadId) {
  try {
    const tagetData = await readTagetList();
    const normalizedSenderId = String(senderId);
    const groupData = tagetData[threadId] || { tagetList: [] };
    return groupData.tagetList.some(
      (tagged) => tagged.idUserZalo === normalizedSenderId,
    );
  } catch (error) {
    console.error("Lỗi khi kiểm tra isUserTagged:", error);
    return false;
  }
}

// --- Logic Lệnh (ĐÃ CẬP NHẬT) ---

/**
 * Gửi tin nhắn hướng dẫn sử dụng (Giữ nguyên)
 */
async function sendUsageHelp(api, message) {
  const prefix = getGlobalPrefix();
  const helpText =
    `🚨 Sai cú pháp! 🚨\nSử dụng:\n` +
    `» ${prefix}target add @user (hoặc [UID]): Chặn và thêm vào danh sách target.\n` +
    `» ${prefix}target list: Xem danh sách target (dạng ảnh).\n` + // <-- Sửa chú thích
    `» ${prefix}target remove [số thứ tự]: Xóa khỏi danh sách target.\n` +
    `» ${prefix}target remove all: Xóa TẤT CẢ khỏi danh sách target.`;
  await sendMessageWarning(api, message, helpText, false);
}

/**
 * Xử lý: .target add @user / [UID] (ĐÃ BỎ GỬI ẢNH - Giữ nguyên)
 */
async function handleTargetAdd(api, message, args) {
  const threadId = message.threadId;

  const tagetData = await readTagetList();
  if (!tagetData[threadId]) {
    tagetData[threadId] = { tagetList: [] };
  }

  let uidsToBlockAttempt = [];
  let usersToProcess = [];

  // ===== LOGIC LẤY UID VÀ TÊN (Giữ nguyên) =====
  if (message.data.mentions && message.data.mentions.length > 0) {
    for (const mention of message.data.mentions) {
      const userId = String(mention.uid);
      if (isAdmin(userId, threadId)) {
        await sendMessageWarning(
          api,
          message,
          `Đại Ca không thể target quản trị viên: ${mention.name || userId} 🚀`,
          false,
        );
        continue;
      }
      const userName = message.data.content
        .substring(mention.pos, mention.pos + mention.len)
        .replace("@", "");
      uidsToBlockAttempt.push(userId);
      usersToProcess.push({ uid: userId, name: userName });
    }
  } else if (args && args.length > 0) {
    for (const uidArg of args) {
      const userId = String(uidArg);
      if (isNaN(userId) || userId.trim() === "") {
        await sendMessageWarning(
          api,
          message,
          `"${userId}" không phải là UID hợp lệ. 🚀`,
          false,
        );
        continue;
      }
      if (isAdmin(userId, threadId)) {
        await sendMessageWarning(
          api,
          message,
          `Đại Ca không thể target quản trị viên: ${userId} 🚀`,
          false,
        );
        continue;
      }

      try {
        const userInfo = await getUserInfoData(api, userId);
        const userName = userInfo.name || "Không rõ";
        uidsToBlockAttempt.push(userId);
        usersToProcess.push({ uid: userId, name: userName });
      } catch (error) {
        await sendMessageWarning(
          api,
          message,
          `Không tìm thấy tài khoản với UID: ${userId} 🚀`,
          false,
        );
      }
    }
  } else {
    await sendMessageWarning(
      api,
      message,
      ":D Đại Ca muốn target ai? 🚀 (Hãy @tag họ hoặc nhập UID)",
      false,
    );
    return;
  }

  if (usersToProcess.length === 0) {
    return;
  }

  // ===== LOGIC BLOCK VÀ THÊM TARGET (Giữ nguyên) =====
  let blockResult = { errorMembers: [] };
  let successfullyBlockedNames = [];
  let failedToBlockButTargetedNames = [];
  let alreadyTaggedUserNames = [];
  let addedNew = false;

  if (uidsToBlockAttempt.length > 0) {
    try {
      blockResult = await api.blockUsers(threadId, uidsToBlockAttempt);
    } catch (blockError) {
      console.error("Lỗi nghiêm trọng khi gọi api.blockUsers:", blockError);
      await sendMessageWarning(
        api,
        message,
        `🚨 Lỗi khi thực hiện block: ${blockError.message}. Vui lòng kiểm tra quyền admin của bot.`,
        false,
      );
      blockResult.errorMembers = [...uidsToBlockAttempt];
    }
  }

  for (const user of usersToProcess) {
    const isAlreadyTagged = tagetData[threadId].tagetList.some(
      (tagged) => tagged.idUserZalo === user.uid,
    );

    if (isAlreadyTagged) {
      alreadyTaggedUserNames.push(user.name);
      continue;
    }

    tagetData[threadId].tagetList.push({
      idUserZalo: user.uid,
      senderName: user.name,
    });
    addedNew = true;

    if (
      blockResult.errorMembers &&
      blockResult.errorMembers.includes(user.uid)
    ) {
      failedToBlockButTargetedNames.push(user.name);
    } else {
      successfullyBlockedNames.push(user.name);
    }
  }

  if (addedNew) {
    try {
      await writeTagetList(tagetData);
    } catch (writeError) {
      await sendMessageWarning(
        api,
        message,
        `🚨 Lỗi khi ghi vào file target list: ${writeError.message}`,
        false,
      );
      return;
    }
  }

  // Gửi thông báo kết quả (BẰNG TEXT - Giữ nguyên)
  let messageContent = "";
  if (successfullyBlockedNames.length > 0)
    messageContent += `✅ Đã target và chặn thành công: ${successfullyBlockedNames.join(", ")}\n`;
  if (failedToBlockButTargetedNames.length > 0)
    messageContent += `⚠️ Không tìm thấy trong nhóm nhưng ĐÃ THÊM vào target: ${failedToBlockButTargetedNames.join(", ")}\n`;
  if (alreadyTaggedUserNames.length > 0)
    messageContent += `❌ Đã target từ trước: ${alreadyTaggedUserNames.join(", ")}\n`;

  if (messageContent.length > 0) {
    await sendMessageStateQuote(
      api,
      message,
      messageContent.trim(),
      true,
      300000,
    );
  }
}

/**
 * Xử lý: .target list (ĐÃ SỬA LẠI: BỎ TEXT, CHỈ GỬI ẢNH + QUOTE)
 */
async function handleTargetList(api, message) {
  const threadId = message.threadId;
  const tagetData = await readTagetList();
  const targetList = tagetData[threadId]?.tagetList || [];

  if (targetList.length === 0) {
    await sendMessageStateQuote(
      api,
      message,
      "✅ Nhóm này chưa target ai.",
      true,
      300000,
    );
    return;
  }

  let imagePath = null;

  try {
    // 1. Lấy thông tin chi tiết (tên, avatar) của từng user trong danh sách
    const userPromises = targetList.map((target) =>
      getUserInfoData(api, target.idUserZalo).catch((e) => {
        // Fallback nếu không lấy được info (user bị xóa, lỗi API...)
        console.error(
          `[TargetList] Lỗi lấy info ${target.idUserZalo}: ${e.message}`,
        );
        return {
          id: target.idUserZalo,
          name: target.senderName || "Không rõ",
          avatar: null, // Sẽ vẽ nền xám
        };
      }),
    );
    const userInfos = await Promise.all(userPromises);

    // 2. Vẽ ảnh
    imagePath = await createTargetListImage(userInfos);

    // 3. Gửi ảnh (ĐÃ BỎ MSG)
    await api.sendMessage(
      {
        msg: "", // <-- BỎ TEXT Ở ĐÂY
        attachments: [imagePath],
        ttl: 300000, // TTL 5 phút
        quote: message, // <-- VẪN GIỮ TRÍCH DẪN
      },
      threadId,
      MessageType.GroupMessage,
    );
  } catch (error) {
    console.error(`[handleTargetList] Lỗi: ${error.message}`);
    await sendMessageWarning(
      api,
      message,
      "Đã xảy ra lỗi khi tạo danh sách target.",
    );
  } finally {
    // 4. Xóa file tạm
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
}

/**
 * Xử lý: .target remove [index] (ĐÃ SỬA LỖI LOGIC)
 * (Lưu ý: STT này dựa trên STT của ảnh)
 */
async function handleTargetRemove(api, message, args) {
  const threadId = message.threadId;
  const indexToRemove = parseInt(args[0]);

  if (isNaN(indexToRemove) || indexToRemove <= 0) {
    await sendMessageWarning(
      api,
      message,
      `🚨 Vui lòng nhập số thứ tự hợp lệ để xóa.\nDùng ${getGlobalPrefix()}target list để xem số.`,
      false,
    );
    return;
  }

  const tagetData = await readTagetList();
  let targetList = tagetData[threadId]?.tagetList || [];

  // ===== PHẦN SỬA LỖI BẮT ĐẦU TỪ ĐÂY =====
  // Lấy thông tin (ID và tên) để sắp xếp giống như ảnh
  // Chúng ta cần một mảng object thống nhất, luôn chứa ID gốc
  const userPromises = targetList.map(async (target) => {
    try {
      const userInfo = await getUserInfoData(api, target.idUserZalo);
      // Lấy info thành công: trả về object với ID GỐC và TÊN MỚI
      return {
        id: target.idUserZalo, // Luôn dùng ID gốc từ file JSON
        name: userInfo.name || target.senderName || "Không rõ", // Ưu tiên tên mới nhất
      };
    } catch (e) {
      // Lấy info thất bại: trả về object với ID GỐC và TÊN CŨ
      return {
        id: target.idUserZalo, // Luôn dùng ID gốc
        name: target.senderName || "Không rõ",
      };
    }
  });
  // ===== KẾT THÚC PHẦN SỬA LỖI =====

  const userInfos = await Promise.all(userPromises);

  // Sắp xếp theo tên, giống hệt hàm vẽ ảnh
  const sortedList = userInfos.sort((a, b) => {
    const nameA = a.name || "Không rõ";
    const nameB = b.name || "Không rõ";
    return nameA.localeCompare(nameB);
  });

  if (indexToRemove > sortedList.length) {
    await sendMessageWarning(
      api,
      message,
      `🚨 Số thứ tự ${indexToRemove} không có trong danh sách.`,
      false,
    );
    return;
  }

  // Lấy ID của user tại STT đó
  const userToRemove = sortedList[indexToRemove - 1];

  // Bây giờ userToRemove.id chắc chắn là idUserZalo
  const idToRemove = userToRemove.id;
  const nameToRemove = userToRemove.name;

  // Xóa user đó khỏi danh sách gốc (chưa sắp xếp)
  // Logic filter này bây giờ sẽ hoạt động chính xác
  tagetData[threadId].tagetList = targetList.filter(
    (t) => t.idUserZalo !== idToRemove,
  );

  await writeTagetList(tagetData);

  await sendMessageStateQuote(
    api,
    message,
    `✅ Đã xóa '${nameToRemove}' (STT ${indexToRemove}) khỏi danh sách target.`,
    true,
    300000,
  );
}

/**
 * Lệnh mới: .target remove all (Giữ nguyên)
 */
async function handleTargetRemoveAll(api, message) {
  const threadId = message.threadId;
  const tagetData = await readTagetList();
  const originalLength = (tagetData[threadId]?.tagetList || []).length;

  if (originalLength === 0) {
    await sendMessageStateQuote(
      api,
      message,
      `✅ Danh sách target đã trống.`,
      true,
      300000,
    );
    return;
  }

  tagetData[threadId].tagetList = []; // Xóa sạch
  await writeTagetList(tagetData);

  await sendMessageStateQuote(
    api,
    message,
    `✅ Đã xóa toàn bộ ${originalLength} người dùng khỏi danh sách target.`,
    true,
    300000,
  );
}

// =================================================================
// --- HÀM VẼ CANVAS MỚI CHO TARGET LIST ---
// =================================================================

/**
 * Hàm vẽ ảnh danh sách Target (Phong cách admin-list)
 * @param {Array} targets - Danh sách target (đã có info: name, avatar, id)
 */
async function createTargetListImage(targets) {
  // Sắp xếp theo tên
  const limitedTargets = targets
    .sort((a, b) => {
      const nameA = a.name || "Không rõ";
      const nameB = b.name || "Không rõ";
      return nameA.localeCompare(nameB);
    })
    .slice(0, 50); // Giới hạn 50 người

  const width = 660;
  const itemHeight = 100;
  const headerHeight = 100;
  const height = headerHeight + limitedTargets.length * itemHeight + 20;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#004e92");
  gradient.addColorStop(1, "#000428");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // --- Tiêu đề (ĐÃ THAY ĐỔI) ---
  ctx.font = "bold 36px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Target List", width / 2, headerHeight / 2); // Tiêu đề mới

  // Tải avatar (song song)
  const avatars = await Promise.all(
    limitedTargets.map(async (target) => {
      try {
        return target.avatar ? await loadImage(target.avatar) : null;
      } catch {
        return null;
      }
    }),
  );

  const moveRight = 30;

  // Vẽ từng target
  limitedTargets.forEach((target, index) => {
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

    // Vẽ avatar
    if (avatars[index]) {
      ctx.drawImage(avatars[index], avatarX, avatarY, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = "#555";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }

    // Vẽ số thứ tự
    const numberSize = 20;
    const numberX = avatarX + avatarSize - numberSize;
    const numberY = avatarY + avatarSize - numberSize;

    ctx.fillStyle = "#C0C0C0"; // Màu xám bạc
    ctx.beginPath();
    ctx.roundRect(numberX, numberY, numberSize, numberSize, [
      cornerRadius,
      0,
      cornerRadius,
      0,
    ]);
    ctx.fill();

    // Chữ số
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

    // --- THAY ĐỔI: Vẽ viền ĐỎ (Theo yêu cầu) ---
    ctx.strokeStyle = "#FF0000"; // Màu Đỏ
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();

    // --- TEXT ---
    const textX = avatarX + avatarSize + 20;

    // Tên (Căn giữa theo chiều dọc vì không có dòng role)
    ctx.font = "bold 26px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(target.name, textX, centerY); // Căn giữa tại centerY

    // (Đã BỎ dòng chức vụ)
  });

  // Lưu file
  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(`./assets/temp/target_list_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}

// =================================================================
// --- CÁC HÀM CÒN LẠI (GIỮ NGUYÊN) ---
// =================================================================

/**
 * Hàm điều hướng chính (Router) (Giữ nguyên)
 */
export async function handleTargetCommand(api, message) {
  const senderId = message.data.uidFrom;
  if (!isAdmin(senderId, message.threadId)) {
    await sendMessageInsufficientAuthority(
      api,
      message,
      "Bạn không có quyền sử dụng lệnh này!",
    );
    return;
  }

  const prefix = getGlobalPrefix();
  const content = removeMention(message).slice(prefix.length).trim();
  const args = content.split(/\s+/);
  const command = args.shift().toLowerCase(); // "target"
  const action = args.shift()?.toLowerCase(); // "add", "list", "remove"

  switch (action) {
    case "add":
      await handleTargetAdd(api, message, args); // Truyền 'args'
      break;
    case "list":
      await handleTargetList(api, message);
      break;
    case "remove":
      if (args[0]?.toLowerCase() === "all") {
        await handleTargetRemoveAll(api, message);
      } else {
        await handleTargetRemove(api, message, args); // args là [index]
      }
      break;
    default:
      await sendUsageHelp(api, message);
  }
}

// --- Logic Sự kiện (Giữ nguyên) ---

/**
 * Xử lý sự kiện khi thành viên tham gia nhóm
 */
export async function handleTargetOnJoin(api, event) {
  const threadId = event.threadId;
  const updateMembers = event.data?.updateMembers || [];

  if (!updateMembers.length) return;

  let groupAdmins = [];
  let groupInfo = {};
  try {
    groupInfo = await getGroupInfoData(api, threadId);
    groupAdmins = await getGroupAdmins(groupInfo);
  } catch (e) {
    console.error(
      `[TargetOnJoin] Không thể lấy thông tin admin nhóm ${threadId}:`,
      e.message,
    );
    return;
  }

  const botId = getBotId();
  if (!isAdmin(botId, threadId, groupAdmins)) {
    console.log(
      `[TargetOnJoin] Bot không có quyền admin (Key Bạc) trong nhóm ${threadId} (có thể do cache), bỏ qua.`,
    );
    return;
  }

  for (const member of updateMembers) {
    const userId = String(member.id);
    try {
      if (await isUserTagged(userId, threadId)) {
        let userName = member.name || "Không xác định";
        if (userName === "Không xác định") {
          try {
            const userInfo = await getUserInfoData(api, userId);
            userName = userInfo.name || userName;
          } catch (error) {}
        }

        await new Promise((resolve) => setTimeout(resolve, 500));

        try {
          const result = await api.blockUsers(threadId, [userId]);

          if (result.errorMembers && result.errorMembers.includes(userId)) {
            await api.sendMessage(
              {
                msg: `🚨 Bot không đủ quyền để chặn ${userName} (đang trong danh sách target)!`,
                ttl: 300000,
              },
              threadId,
              MessageType.GroupMessage,
            );
          } else {
            // ===== GỬI ẢNH TỰ ĐỘNG CHẶN (Giữ nguyên) =====
            try {
              const userInfo = await getUserInfoData(api, userId);
              const currentGroupInfo = await getGroupInfoData(api, threadId);
              const imagePath = await createAutoBlockTargetImage(
                userInfo,
                currentGroupInfo.name,
                currentGroupInfo.groupType,
                userInfo.gender,
              );

              await api.sendMessage(
                {
                  msg: `🚨 ${userName} đã bị chặn tự động do nằm trong danh sách target!`,
                  attachments: imagePath ? [imagePath] : [],
                  ttl: 3600000,
                },
                threadId,
                MessageType.GroupMessage,
              );
              await clearImagePath(imagePath);
            } catch (imgError) {
              console.error("Lỗi gửi ảnh auto-block (target join):", imgError);
              // Fallback (trả về tin nhắn text)
              await api.sendMessage(
                {
                  msg: `🚨 ${userName} đã bị chặn tự động do nằm trong danh sách target!`,
                  ttl: 300000,
                },
                threadId,
                MessageType.GroupMessage,
              );
            }
          }
        } catch (error) {
          await api.sendMessage(
            {
              msg: `🚨 Lỗi khi tự động chặn ${userName}: ${error.message}`,
              ttl: 300000,
            },
            threadId,
            MessageType.GroupMessage,
          );
        }
      }
    } catch (error) {
      console.error(`Lỗi xử lý sự kiện join của ${userId}:`, error);
    }
  }
}

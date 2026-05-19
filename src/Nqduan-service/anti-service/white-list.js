import { MessageType } from "zlbotdqt";
import { isAdmin } from "../../index.js";
import {
  sendMessageComplete,
  sendMessageQuery,
  sendMessageWarning,
} from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { removeMention } from "../../utils/format-util.js";

// --- IMPORT MỚI ĐỂ VẼ ẢNH ---
import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { getUserInfoData } from "../info-service/user-info.js";
import { clearImagePath } from "../../utils/canvas/index.js";
// --- KẾT THÚC IMPORT MỚI ---

export async function handleWhiteList(api, message, groupSettings, groupAdmins) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const parts = content.split(" ");
  const command = parts[1];
  let isChangeSetting = false;

  if (!command || (command !== "add" && command !== "remove")) {
    
    // --- BẮT ĐẦU LOGIC VẼ ẢNH (THAY THẾ CODE CŨ) ---
    const whiteListUserIds = Object.keys(groupSettings[threadId].whiteList || {});

    if (whiteListUserIds.length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Hiện Không có người dùng nào trong danh sách white-list."
      );
      return isChangeSetting;
    }

    // Lấy thông tin chi tiết (tên, avatar)
    let formattedList = [];
    try {
      const userPromises = whiteListUserIds.map(id =>
        getUserInfoData(api, id).catch(e => {
          console.error(`[WhiteList] Lỗi lấy info ${id}: ${e.message}`);
          // Fallback: Dùng data đã lưu nếu API lỗi
          const storedUser = groupSettings[threadId].whiteList[id];
          return {
            uid: id,
            name: storedUser ? storedUser.name : "Người dùng bị ẩn",
            avatar: null,
          };
        })
      );
      const userInfos = (await Promise.all(userPromises)).filter(info => info !== null);

      for (const info of userInfos) {
        formattedList.push({
          ...info, // Gồm: uid, name, avatar...
          role: "Người Dùng Được Miễn Trừ Vi Phạm", // Vai trò
          keyType: 'whitelist'     // KeyType để style màu
        });
      }
    } catch (error) {
      console.error("Lỗi khi fetch info white list:", error);
      await sendMessageWarning(api, message, "Đã xảy ra lỗi khi lấy thông tin chi tiết white list.");
      return isChangeSetting;
    }

    if (formattedList.length === 0) {
      await sendMessageWarning(api, message, "Không thể lấy thông tin chi tiết của người trong white list.");
      return isChangeSetting;
    }

    // Vẽ và gửi ảnh
    let imagePath = null;
    try {
      imagePath = await createWhiteListImage(formattedList); // Gọi hàm vẽ mới
      await api.sendMessage(
        {
          msg: `📝 Đây là danh sách người dùng trong white-list.`,
          attachments: [imagePath],
          ttl: 3600000,
        },
        message.threadId,
        message.type
      );
    } catch (drawError) {
      console.error("Lỗi khi vẽ ảnh white list:", drawError);
      await sendMessageWarning(api, message, "Đã xảy ra lỗi khi tạo ảnh danh sách.");
    } finally {
      // Tự động xóa file ảnh tạm
      if (imagePath) {
        setTimeout(async () => {
          await clearImagePath(imagePath);
        }, 30 * 1000);
      }
    }
    return isChangeSetting;
    // --- KẾT THÚC LOGIC VẼ ẢNH ---
  }

  // (Phần logic add/remove giữ nguyên)
  const mentions = message.data.mentions;
  
  if (command === "remove") {
    const indexToRemove = parseInt(parts[2]);
    if (!isNaN(indexToRemove)) {
      const whiteList = groupSettings[threadId].whiteList || {};
      const whiteListArray = Object.entries(whiteList);
      
      if (indexToRemove > 0 && indexToRemove <= whiteListArray.length) {
        const [userId, userInfo] = whiteListArray[indexToRemove - 1];
        delete groupSettings[threadId].whiteList[userId];
        await sendMessageComplete(
          api,
          message,
          `Đã xóa ${userInfo.name} khỏi danh sách white-list.`
        );
        return true;
      } else {
        await sendMessageWarning(
          api,
          message,
          `Số thứ tự Không hợp lệ. Vui lòng chọn số từ 1 đến ${whiteListArray.length}.`
        );
        return false;
      }
    }
  }

  if (!mentions || mentions.length === 0) {
    await sendMessageQuery(
      api,
      message,
      "Vui lòng đề cập (@mention) người dùng hoặc nhập số thứ tự để thêm/xóa khỏi white-list."
    );
    return isChangeSetting;
  }

  if (!groupSettings[threadId].whiteList) {
    groupSettings[threadId].whiteList = {};
  }

  for (const mention of mentions) {
    const userId = mention.uid;
    const userName = message.data.content
      .substr(mention.pos, mention.len)
      .replace("@", "");

    if (command === "add") {
      if (isAdmin(userId, threadId)) {
        await sendMessageWarning(
          api,
          message,
          `${userName} đã là quản trị viên nên Không cần thêm vào white-list`
        );
        continue;
      }

      if (!groupSettings[threadId].whiteList[userId]) {
        groupSettings[threadId].whiteList[userId] = {
          name: userName,
        };
        await sendMessageComplete(
          api,
          message,
          `Đã thêm ${userName} vào danh sách white-list.`
        );
        isChangeSetting = true;
      } else {
        await sendMessageWarning(
          api,
          message,
          `${userName} đã có trong danh sách white-list.`
        );
      }
    } else if (command === "remove") {
      if (groupSettings[threadId].whiteList[userId]) {
        const userName = groupSettings[threadId].whiteList[userId].name;
        delete groupSettings[threadId].whiteList[userId];
        await sendMessageComplete(
          api,
          message,
          `Đã xóa ${userName} khỏi danh sách white-list.`
        );
        isChangeSetting = true;
      } else {
        await sendMessageWarning(
          api,
          message,
          `${userName} Không có trong danh sách white-list.`
        );
      }
    }
  }

  return isChangeSetting;
}

export function isInWhiteList(groupSettings, threadId, senderId) {
  const whiteList = groupSettings[threadId]?.whiteList || {};
  return whiteList[senderId];
}

// =================================================================
// --- HÀM VẼ CANVAS MỚI ---
// =================================================================

/**
 * Hàm vẽ ảnh danh sách White List (Style Admin List)
 * @param {Array} whiteListUsers - Danh sách người dùng (đã có info từ getUserInfoData)
 */
async function createWhiteListImage(whiteListUsers) {
  // Sắp xếp theo tên
  const limitedUsers = whiteListUsers
    .sort((a, b) => {
      if (!a.name || !b.name) return 0;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 50); // Giới hạn 50 người

  const width = 660;
  const itemHeight = 100;
  const headerHeight = 100;
  const height = headerHeight + limitedUsers.length * itemHeight + 20;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền (Giữ nguyên gradient xanh)
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
  ctx.fillText("Danh Sách Trắng", width / 2, headerHeight / 2); // Đổi tiêu đề

  // Tải avatar (song song)
  const avatars = await Promise.all(
    limitedUsers.map(async (user) => {
      try {
        return user.avatar ? await loadImage(user.avatar) : null;
      } catch {
        return null; // Bỏ qua nếu avatar lỗi
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

    // Vẽ avatar
    if (avatars[index]) {
      ctx.drawImage(avatars[index], avatarX, avatarY, avatarSize, avatarSize);
    } else {
      // Avatar mặc định nếu lỗi
      ctx.fillStyle = "#555";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }

    // Vẽ số thứ tự
    const numberSize = 20;
    const numberX = avatarX + avatarSize - numberSize;
    const numberY = avatarY + avatarSize - numberSize;

    // --- THAY ĐỔI STYLE (Màu xanh lá cây mới) ---
    ctx.fillStyle = "#4CAF50"; // Màu Xanh Lá
    // --- KẾT THÚC THAY ĐỔI ---
    
    ctx.beginPath();
    ctx.roundRect(numberX, numberY, numberSize, numberSize, [cornerRadius, 0, cornerRadius, 0]);
    ctx.fill();

    // Chữ số (Chuyển sang màu trắng cho nổi)
    ctx.fillStyle = "#FFFFFF"; 
    ctx.font = "bold 12px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${index + 1}`, numberX + numberSize / 2, numberY + numberSize / 2 + 1);
    
    ctx.restore();

    // --- THAY ĐỔI STYLE VIỀN (Màu xanh lá cây mới) ---
    ctx.strokeStyle = "#4CAF50"; // Viền Xanh Lá
    ctx.lineWidth = 4;
    // --- KẾT THÚC THAY ĐỔI ---
    
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();

    // --- TEXT ---
    const textX = avatarX + avatarSize + 20;

    // Tên (Sử dụng user.name từ getUserInfoData)
    ctx.font = "bold 26px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(user.name, textX, centerY - 15);

    // Chức vụ (đã có từ data truyền vào)
    ctx.font = "20px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    
    // --- THAY ĐỔI: Thêm màu (Màu xanh lá cây mới) ---
    ctx.fillStyle = "#4CAF50"; // Màu Xanh Lá
    // --- KẾT THÚC THAY ĐỔI ---
    
    ctx.fillText(user.role, textX, centerY + 20); // Dùng user.role ("White List User")
  });

  // Lưu file (Đường dẫn này phải tồn tại)
  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(`./assets/temp/whitelist_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}
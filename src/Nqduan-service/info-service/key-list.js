import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { MessageType } from "zlbotdqt"; // Giả định đường dẫn
import { getGroupInfoData } from "./group-info.js"; // Giả định đường dẫn
import { getUserInfoData } from "./user-info.js"; // Giả định đường dẫn
import { sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js"; // Giả định đường dẫn

// --- HÀM XỬ LÝ LỆNH CHÍNH ---

export async function handleListKeyCommand(api, message) {
  const threadId = message.threadId;

  try {
    // 1. Lấy thông tin nhóm hiện tại
    const groupInfo = await getGroupInfoData(api, threadId);
    if (!groupInfo) {
      throw new Error("Không thể lấy thông tin nhóm.");
    }

    // 2. Xác định chức vụ
    const isCommunity = groupInfo.groupType === 2;
    const creatorRole = isCommunity ? "Trưởng cộng đồng" : "Trưởng nhóm";
    const adminRole = isCommunity ? "Phó cộng đồng" : "Phó nhóm";

    const adminList = [];

    // 3. Lấy thông tin Trưởng nhóm (Key Vàng)
    if (groupInfo.creatorId) {
      try {
        const creatorInfo = await getUserInfoData(api, groupInfo.creatorId);
        if (creatorInfo) {
          adminList.push({
            ...creatorInfo,
            role: creatorRole,
            keyType: 'gold' // Key Vàng
          });
        }
      } catch (e) {
        console.error(`[ListKey] Lỗi lấy info Trưởng nhóm ${groupInfo.creatorId}: ${e.message}`);
      }
    }

    // 4. Lấy thông tin Phó nhóm (Key Bạc)
    const adminIds = (groupInfo.adminIds || []).filter(id => id !== groupInfo.creatorId);
    
    if (adminIds.length > 0) {
      const adminPromises = adminIds.map(id => 
        getUserInfoData(api, id).catch(e => {
          console.error(`[ListKey] Lỗi lấy info Phó nhóm ${id}: ${e.message}`);
          return null;
        })
      );
      const adminInfos = (await Promise.all(adminPromises)).filter(info => info !== null);
      
      for (const info of adminInfos) {
        adminList.push({
          ...info,
          role: adminRole,
          keyType: 'silver' // Key Bạc
        });
      }
    }

    if (adminList.length === 0) {
      await sendMessageWarning(api, message, "Không tìm thấy thông tin Key nào trong nhóm này.");
      return;
    }

    // 5. Vẽ ảnh - Truyền cả danh sách và tên nhóm vào
    const imagePath = await createKeyListImage(adminList, groupInfo.name);
    
    // 6. Gửi ảnh
    await api.sendMessage({ msg: "", attachments: [imagePath], ttl: 3600000, quote: message }, threadId, MessageType.GroupMessage);
    
    // 7. Xóa file tạm
    await clearImagePath(imagePath);

  } catch (error) {
    console.error(`[handleListKeyCommand] Lỗi: ${error.message}`);
    await sendMessageWarning(api, message, "Đã xảy ra lỗi khi lấy danh sách Key.");
  }
}

// --- HÀM VẼ CANVAS (Phong cách listadmin.js) ---

// Hàm dọn dẹp file
export async function clearImagePath(filePath) {
  try {
    if (filePath && await fs.stat(filePath)) {
      await fs.unlink(filePath);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Lỗi khi xóa file tạm ${filePath}:`, error);
    }
  }
}

/**
 * Hàm vẽ ảnh chính (Phong cách dọc)
 * @param {Array} admins - Danh sách admin (đã gộp Trưởng và Phó)
 * @param {string} groupName - Tên của nhóm để vẽ tiêu đề
 */
export async function createKeyListImage(admins, groupName) {
  // Sắp xếp lại: Key Vàng (Trưởng) luôn ở trên cùng
  const limitedAdmins = admins
    .sort((a, b) => {
      if (a.keyType === 'gold' && b.keyType !== 'gold') return -1;
      if (a.keyType !== 'gold' && b.keyType === 'gold') return 1;
      return 0; // Giữ nguyên thứ tự nếu cùng loại key
    })
    .slice(0, 50); // Giới hạn 50 người

  const width = 660;
  // --- THAY ĐỔI: Tăng kích thước ---
  const itemHeight = 100; // Tăng từ 80 -> 100
  const headerHeight = 100; // Tăng chiều cao header để chứa 2 dòng
  const height = headerHeight + limitedAdmins.length * itemHeight + 20;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền XANH BIỂN gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#004e92"); // Xanh đậm
  gradient.addColorStop(1, "#000428"); // Xanh đen
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // --- Tiêu đề (ĐÃ THAY ĐỔI) ---
  // 1. Tên Group
  ctx.font = "bold 32px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(groupName, width / 2, headerHeight / 2 - 15); // Dòng 1

  // 2. Subtitle
  ctx.font = "normal 18px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#cccccc";
  ctx.fillText("Danh sách các key quản trị", width / 2, headerHeight / 2 + 20); // Dòng 2 (cách 10px)

  // Tải avatar (song song)
  const avatars = await Promise.all(
    limitedAdmins.map(async (admin) => {
      try {
        return admin.avatar ? await loadImage(admin.avatar) : null;
      } catch {
        return null;
      }
    })
  );

  const moveRight = 30; // dịch sang phải 30px

  // Vẽ từng admin (giống hệt listadmin.js)
  limitedAdmins.forEach((admin, index) => {
    const yPos = headerHeight + index * itemHeight + 10;
    const centerY = yPos + (itemHeight - 10) / 2;

    // Khung item
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(10, yPos, width - 20, itemHeight - 10, 10);
    ctx.fill();

    // --- THAY ĐỔI: LOGIC AVATAR VÀ SỐ THỨ TỰ ---
    
    // 1. Kích thước và vị trí avatar
    const avatarSize = 70; // Tăng từ 50 -> 70
    const avatarX = 20 + moveRight;
    const avatarY = centerY - avatarSize / 2;
    const cornerRadius = 10; // Bo góc cho avatar

    ctx.save();
    ctx.beginPath();
    // 2. Tạo vùng cắt avatar vuông bo góc
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.clip();

    // 3. Vẽ avatar
    if (avatars[index]) {
      ctx.drawImage(avatars[index], avatarX, avatarY, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = "#555";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }

    // 4. Vẽ số thứ tự (đè lên góc avatar)
    const numberSize = 20; // Kích thước ô số (giảm từ 24)
    const numberX = avatarX + avatarSize - numberSize;
    const numberY = avatarY + avatarSize - numberSize;

    // Nền ô số (Vàng/Bạc)
    ctx.fillStyle = admin.keyType === 'gold' ? "#FFD700" : "#C0C0C0";
    ctx.beginPath();
    // Bo góc trên bên trái (TopLeft) và góc dưới bên phải (BottomRight)
    ctx.roundRect(numberX, numberY, numberSize, numberSize, [cornerRadius, 0, cornerRadius, 0]);
    ctx.fill();

    // Chữ số
    ctx.fillStyle = "#000000"; // Chữ đen cho nổi
    ctx.font = "bold 12px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial"; // Giảm từ 14px
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${index + 1}`, numberX + numberSize / 2, numberY + numberSize / 2 + 1);
    
    // 5. Xóa clip
    ctx.restore();

    // 6. Vẽ viền Vàng/Bạc (bên ngoài clip)
    if (admin.keyType === 'gold') {
      ctx.strokeStyle = "#FFD700"; // Vàng
      ctx.lineWidth = 4;
    } else { // Bạc
      ctx.strokeStyle = "#C0C0C0"; // Bạc
      ctx.lineWidth = 3;
    }
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();
    // --- KẾT THÚC THAY ĐỔI ---


    // --- THAY ĐỔI: KÍCH THƯỚC FONT VÀ VỊ TRÍ TEXT ---
    const textX = avatarX + avatarSize + 20;

    // Tên
    ctx.font = "bold 26px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial"; // Tăng từ 20 -> 26
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(admin.name, textX, centerY - 15); // Điều chỉnh Y

    // Chức vụ (đã có từ logic trên)
    ctx.font = "20px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial"; // Tăng từ 16 -> 20
    ctx.fillStyle = "#cccccc";
    ctx.fillText(admin.role, textX, centerY + 20); // Điều chỉnh Y
  });
  
  // (Bỏ chữ ký ở cuối)

  // Lưu file
  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(`./assets/temp/key_list_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}


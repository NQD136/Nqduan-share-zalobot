/*
 * Tên file: listblock.js (list-block-group.js)
 * Chức năng: Xử lý lệnh lấy danh sách thành viên bị chặn (block) bằng ẢNH CANVAS.
 *
 * CẬP NHẬT (V14 - Tinh chỉnh Canvas):
 * - Canvas: Tên Group (Tiêu đề) sẽ TỰ ĐỘNG GIẢM FONT nếu quá dài,
 * đảm bảo luôn hiển thị đầy đủ (Fix lỗi "k hiện full dc").
 * - (Giữ nguyên các thay đổi V13: 1 cột (nếu 1 member), STT bên trái,
 * Tên Group font lớn, bỏ "Thành viên bị chặn").
 */

// Import các hằng số Type
import { MessageType } from "../../api-zalo/index.js";

// Import các hàm tiện ích
import { isAdmin } from "../../index.js";

// Import các hàm data (từ file 19, 30)
import { getGroupInfoData } from "../../Nqduan-service/info-service/group-info.js";
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";

// Import các hàm gửi tin nhắn CÓ STYLE
import {
  sendMessageFailed,
  sendMessageWarning,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

// Import các hàm vẽ và file (từ file 72)
import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";

const COUNT_PER_PAGE = 50;

/**
 * Lệnh để hiển thị danh sách thành viên bị chặn (bằng ảnh Canvas)
 * Cú pháp:
 * !listblock (ra ảnh)
 */
export async function handleListBlockCommand(api, message, aliasCommand) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  let imagePath = null;

  try {
    // =================================================================
    // --- PHẦN 1: KIỂM TRA QUYỀN VÀ BỐI CẢNH ---
    // =================================================================

    if (message.type !== MessageType.GroupMessage) {
      await sendMessageWarning(
        api,
        message,
        "Lệnh này chỉ có thể dùng trong nhóm chat.",
        false,
        true,
      );
      return;
    }

    if (!isAdmin(senderId, threadId)) {
      await sendMessageWarning(
        api,
        message,
        "Chỉ Quản trị viên nhóm mới xem được danh sách này.",
        false,
        true,
      );
      return;
    }

    // =================================================================
    // --- PHẦN 2: LẤY DỮ LIỆU (TÊN NHÓM & DANH SÁCH CHẶN) ---
    // =================================================================

    console.log(
      `[ListBlock] Bắt đầu quét danh sách chặn (V14) cho nhóm ${threadId}...`,
    );

    let allBlockedMembers = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      const payload = { page: currentPage, count: COUNT_PER_PAGE };
      const result = await api.getGroupBlockedMember(payload, threadId);

      const membersOnPage = result.blocked_members || result.data || result;

      if (
        !membersOnPage ||
        !Array.isArray(membersOnPage) ||
        membersOnPage.length === 0
      ) {
        console.log(
          `[ListBlock] Trang ${currentPage}: Không còn thành viên. Dừng quét.`,
        );
        hasMore = false;
        continue;
      }

      console.log(
        `[ListBlock] Trang ${currentPage}: Tìm thấy ${membersOnPage.length} thành viên.`,
      );
      allBlockedMembers = allBlockedMembers.concat(membersOnPage);
      currentPage++;
    }

    console.log(`[ListBlock] Quét xong. Tổng: ${allBlockedMembers.length}`);

    if (allBlockedMembers.length === 0) {
      await sendMessageWarning(
        api,
        message,
        "Nhóm này không có thành viên nào bị chặn.",
        false,
        true,
      );
      return;
    }

    // =================================================================
    // --- PHẦN 3: XỬ LÝ KẾT QUẢ (CHỈ CÓ CANVAS) ---
    // =================================================================

    // 1. Lấy Tên Nhóm (từ file 19)
    const groupInfo = await getGroupInfoData(api, threadId);
    const groupName = groupInfo ? groupInfo.name : "Không rõ tên nhóm";

    // 2. Lấy full info (từ file 30)
    const infoPromises = allBlockedMembers.map((member) => {
      const memberId = member.userId || member.uid || member.id; // (Sửa lỗi log 69)
      return getUserInfoData(api, memberId).catch((e) => null);
    });
    const memberInfos = (await Promise.all(infoPromises)).filter(
      (info) => info !== null,
    );

    // 3. Vẽ ảnh
    imagePath = await createBlockedListImage(memberInfos, groupName);

    // 4. Gửi ảnh
    await api.sendMessage(
      { msg: "", attachments: [imagePath], ttl: 600000, quote: message },
      threadId,
      MessageType.GroupMessage,
    );
  } catch (error) {
    // --- PHẦN 4: BÁO LỖI ---
    console.error("Lỗi khi lấy danh sách bị chặn:", error);
    await sendMessageFailed(
      api,
      message,
      `Đã xảy ra lỗi khi lấy danh sách bị chặn:\n${error.message}`,
      true,
    );
  } finally {
    // Xóa file tạm (nếu có)
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
}

// (ĐÃ XÓA HÀM 'handleActionBlockedMembersReply' VÌ KHÔNG CÒN DÙNG)

// =================================================================
// --- HÀM VẼ CANVAS (TỪ FILE 72) (V14 - AUTO FONT SIZE) ---
// =================================================================

/**
 * Hàm vẽ ảnh chính (Phong cách 2 cột)
 */
async function createBlockedListImage(members, groupName) {
  // (Logic V13)
  const isSingleMember = members.length === 1;
  const numColumns = isSingleMember ? 1 : 2;
  const maxMembersPerColumn = Math.ceil(members.length / numColumns);
  const columnWidth = isSingleMember ? 600 : 400;

  const itemHeight = 100;
  const headerHeight = 140; // (Từ V13)
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

  // (*** YÊU CẦU MỚI: TỰ ĐỘNG CHỈNH FONT TÊN GROUP ***)

  // 1. Định nghĩa Font cơ bản và kích thước tối đa
  const baseFont = "'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  let fontSize = 44; // Bắt đầu từ 44px (từ V13)
  const maxWidth = width - padding * 2; // Chiều rộng tối đa (width - 40px)

  // 2. Vòng lặp giảm font
  ctx.font = `bold ${fontSize}px ${baseFont}`;
  // Đặt giới hạn font tối thiểu là 24px
  while (ctx.measureText(groupName).width > maxWidth && fontSize > 24) {
    fontSize -= 2; // Giảm 2px mỗi lần
    ctx.font = `bold ${fontSize}px ${baseFont}`;
  }

  // 3. Vẽ tên Group (với font đã được điều chỉnh)
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(groupName, width / 2, headerHeight / 2); // Căn giữa
  // (*** KẾT THÚC SỬA ***)

  const avatars = await Promise.all(
    members.map(async (member) => {
      try {
        return member.avatar ? await loadImage(member.avatar) : null;
      } catch {
        return null;
      }
    }),
  );

  // (Fix lỗi 'memberInfos' (file 75))
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

    // (Vị trí STT từ V13)
    // 1. Vẽ STT trước
    const sttX = xOffset + 15;
    const sttWidth = 40;
    ctx.font = "bold 22px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${index + 1}.`, sttX + sttWidth / 2, centerY);

    // 2. Vẽ Avatar (sau STT)
    const avatarSize = 70;
    const avatarX = sttX + sttWidth; // (Vị trí V13)
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

    // 3. Vẽ Tên (sau Avatar)
    const textX = avatarX + avatarSize + 15;

    // (Giữ nguyên V12)
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

// Hàm dọn dẹp file (từ file 71)
async function clearImagePath(filePath) {
  try {
    if (filePath && (await fs.stat(filePath))) {
      await fs.unlink(filePath);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Lỗi khi xóa file tạm ${filePath}:`, error);
    }
  }
}

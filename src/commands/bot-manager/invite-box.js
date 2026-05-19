/*
 * Tên file: invite-box.js (hoặc danhsachloimoi.js)
 * PHIÊN BẢN CUỐI CÙNG V6:
 * 1. Đã sửa lỗi: Cannot read properties of undefined.
 * 2. Đã loại bỏ: Logic hiển thị Trưởng nhóm (creatorName).
 * 3. Luôn: Tải FULL danh sách lời mời trong 1 lần gọi.
 */
import {
  sendMessageWarning,
  sendMessageComplete,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

const prefix = "!";
const groupInviteCache = {};

/**
 * Hàm trợ giúp để trích xuất dữ liệu lời mời từ response
 */
function extractInvitationData(response) {
  let invitations = [];
  let total = 0;
  let hasMore = false;

  const dataContainers = [
    response,
    response.data,
    response.data?.list,
    response.data?.items,
    response.data?.data,
  ];

  for (const container of dataContainers) {
    if (
      container &&
      (Array.isArray(container.invitations) || Array.isArray(container))
    ) {
      const list = container.invitations || container;
      if (list.length > 0) {
        invitations = list;
        total =
          container.total ||
          container.totalCount ||
          response.total ||
          list.length;
        hasMore = container.hasMore || response.hasMore || false;
        break;
      }
    }
  }

  if (invitations.length > 0 && Array.isArray(invitations[0])) {
    invitations = invitations.flat();
  }

  return { invitations, total, hasMore };
}

/**
 * Xử lý lệnh lấy danh sách lời mời tham gia nhóm.
 */
export async function handleListGroupInviteCommand(
  api,
  message,
  aliasCommand,
  argsArray,
) {
  // FIX LỖI: Đảm bảo argsArray là mảng
  argsArray = argsArray || [];

  // Khởi tạo các biến để lặp và lưu trữ
  let allInvitations = [];
  let totalCount = 0;
  let currentPage = 1; // Luôn bắt đầu từ trang 1
  let hasMore = true;
  let firstFetch = true;

  // Các tham số phụ
  const page = parseInt(argsArray[2]) || 0;
  const invPerPage = parseInt(argsArray[3]) || 12;
  const mcount = parseInt(argsArray[4]) || 10;

  try {
    // Vòng lặp tải full danh sách
    while (hasMore) {
      const payload = {
        mpage: currentPage, // Tự động tăng
        page: page,
        invPerPage: invPerPage,
        mcount: mcount,
      };

      const response = await api.getGroupInviteBoxList(payload);

      if (!response) {
        if (firstFetch) {
          await sendMessageWarning(
            api,
            message,
            `❌ Không thể lấy danh sách lời mời tham gia nhóm. Phản hồi rỗng.`,
            false,
            30000,
          );
          return;
        }
        hasMore = false;
        break;
      }

      // Trích xuất dữ liệu
      const {
        invitations: currentInvitations,
        total: currentTotal,
        hasMore: currentHasMore,
      } = extractInvitationData(response);

      allInvitations.push(...currentInvitations);
      totalCount = currentTotal;
      hasMore = currentHasMore;

      firstFetch = false;

      // Chuyển sang trang tiếp theo (Tự động lặp)
      currentPage++;
    }

    const invitations = allInvitations;

    if (invitations.length === 0) {
      await sendMessageComplete(
        api,
        message,
        `📭 Không có lời mời tham gia nhóm nào.`,
        false,
        30000,
      );
      return;
    }

    // --- LƯU CACHE VÀ ĐỊNH DẠNG TIN NHẮN ---
    const botId = api.getBotId ? api.getBotId() : "bot";
    const userId = message.data?.uidFrom;
    if (!groupInviteCache[botId]) {
      groupInviteCache[botId] = {};
    }
    groupInviteCache[botId][userId] = {
      list: invitations,
      timestamp: Date.now(),
    };

    let messageText = `📬 Danh sách lời mời tham gia nhóm/cộng đồng (${invitations.length}${totalCount > 0 ? `/${totalCount}` : ""}):\n`;

    // Logic định dạng thông tin nhóm
    invitations.forEach((invitation, index) => {
      const groupInfo =
        invitation.groupInfo ||
        invitation.group ||
        invitation.groupData ||
        invitation ||
        {};
      const inviterInfo =
        invitation.inviterInfo ||
        invitation.inviter ||
        invitation.inviterData ||
        invitation.inviterUser ||
        invitation.user ||
        invitation.sender ||
        {};

      const groupName =
        groupInfo.name ||
        groupInfo.groupName ||
        groupInfo.title ||
        invitation.groupName ||
        invitation.name ||
        invitation.title ||
        invitation.group_name ||
        "Nhóm không tên";
      const groupId =
        groupInfo.groupId ||
        groupInfo.id ||
        groupInfo.grid ||
        groupInfo.gid ||
        invitation.groupId ||
        invitation.id ||
        invitation.grid ||
        invitation.gid ||
        invitation.group_id ||
        "N/A";
      const inviterName =
        inviterInfo.dName ||
        inviterInfo.zaloName ||
        inviterInfo.name ||
        inviterInfo.displayName ||
        inviterInfo.nickname ||
        invitation.inviterName ||
        invitation.inviter_name ||
        invitation.senderName ||
        invitation.userName ||
        invitation.dName ||
        "Người dùng";

      let expiredTs = "N/A";
      const expireKeys = [
        "expiredTs",
        "expiredTime",
        "expireTime",
        "expire_time",
      ];
      for (const key of expireKeys) {
        if (invitation[key]) {
          const ts =
            typeof invitation[key] === "string"
              ? parseInt(invitation[key])
              : invitation[key];
          if (!isNaN(ts) && ts > 0) {
            expiredTs = new Date(ts).toLocaleString("vi-VN");
            break;
          }
        }
      }

      // =================================================================
      // >>> ĐÃ LOẠI BỎ THÔNG TIN TRƯỞNG NHÓM (creatorName) <<<
      // =================================================================

      let inviterRole =
        invitation.inviterRole || invitation.role || groupInfo.role;
      let inviterRoleText = "";
      if (inviterRole) {
        inviterRoleText =
          inviterRole === 1
            ? " (Trưởng nhóm)"
            : inviterRole === 2
              ? " (Phó nhóm)"
              : "";
      }

      // --- ĐỊNH DẠNG CUỐI CÙNG (Không có Trưởng nhóm) ---
      messageText += `\n**${index + 1}. ${groupName}**\n`;
      messageText += `    🆔 ID: ${groupId}\n`;

      // Chỉ hiển thị vai trò nếu người mời có vai trò cụ thể
      messageText += `    👤 Người mời: ${inviterName}${inviterRoleText}\n`;

      if (expiredTs !== "N/A") {
        messageText += `    ⏰ Hết hạn: ${expiredTs}\n`;
      } else {
        messageText += `    ⏰ Hạn mời: Không rõ\n`;
      }
    });

    // Gửi tin nhắn hoàn thành
    await sendMessageComplete(api, message, messageText.trim(), true, 30000);
  } catch (error) {
    // --- XỬ LÝ LỖI ---
    console.error("❌ Lỗi khi lấy danh sách lời mời tham gia nhóm:", error);
    await sendMessageWarning(
      api,
      message,
      `❌ Lỗi khi lấy danh sách lời mời tham gia nhóm: ${error.message}`,
      false,
    );
  }
}

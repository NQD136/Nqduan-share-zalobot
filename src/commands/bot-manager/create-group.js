/*
 * Tên file: creategr.js
 * Chức năng: Xử lý lệnh tạo nhóm mới (đã tích hợp chat-style).
 * Hỗ trợ tạo nhóm bằng @tag hoặc Reply tin nhắn.
 *
 * CẬP NHẬT: Xóa bỏ tin nhắn chào mừng gửi vào nhóm mới.
 */

// Import các hàm tiện ích cơ bản
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { removeMention } from "../../utils/format-util.js";

// Import các hàm gửi tin nhắn CÓ STYLE từ chat-style.js
import {
  sendMessageWarning,
  sendMessageProcessingRequest,
  sendMessageComplete,
  sendMessageFailed,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

/**
 * Lệnh để tạo một nhóm chat mới
 * Cú pháp:
 * 1. !creategr <Tên Nhóm> @tag1 @tag2 ...
 * 2. !creategr <Tên Nhóm> (và reply tin nhắn của 1 người)
 */
export async function handleCreateGrCommand(api, message, aliasCommand) {
  const threadId = message.threadId; // Nơi lệnh được gọi
  const senderId = message.senderId; // Người gọi lệnh

  // =================================================================
  // --- PHẦN 1: LẤY DANH SÁCH THÀNH VIÊN ---
  // =================================================================

  const mentions = message.data.mentions;
  const replyData = message.data?.reply;

  const memberMap = new Map();
  memberMap.set(senderId, true);

  if (mentions && Array.isArray(mentions) && mentions.length > 0) {
    for (const mention of mentions) {
      if (mention.uid) {
        memberMap.set(mention.uid, true);
      }
    }
  }

  if (replyData && replyData.uid) {
    memberMap.set(replyData.uid, true);
  }

  const finalMemberIds = Array.from(memberMap.keys());

  if (finalMemberIds.length < 2) {
    const prefix = getGlobalPrefix();
    const caption =
      "❌ Bạn phải tag (mention) hoặc reply ít nhất một người khác để tạo nhóm.\n\n" +
      `Cú pháp: ${prefix}${aliasCommand} <Tên Nhóm> @mention1 @mention2,...`;

    await sendMessageWarning(api, message, caption, false, true);
    return;
  }

  // =================================================================
  // --- PHẦN 2: LẤY TÊN NHÓM ---
  // =================================================================

  let groupName = removeMention(message);
  const prefix = getGlobalPrefix();
  groupName = groupName.replace(`${prefix}${aliasCommand}`, "").trim();

  if (!groupName || groupName.length === 0) {
    const caption =
      "❌ Bạn chưa nhập tên nhóm.\n" +
      `Cú pháp: ${prefix}${aliasCommand} <Tên Nhóm> @tag1`;
    await sendMessageWarning(api, message, caption, false, true);
    return;
  }

  // =================================================================
  // --- PHẦN 3: GỌI API ---
  // =================================================================

  try {
    const options = {
      name: groupName,
      members: finalMemberIds,
    };

    // Thông báo đang xử lý
    await sendMessageProcessingRequest(
      api,
      message,
      {
        caption: `Đang tạo nhóm "${groupName}" với ${finalMemberIds.length} thành viên...`,
      },
      60000,
    );

    // Gọi hàm API
    const newGroupData = await api.createGroup(options);

    // Gửi thông báo thành công
    const successCaption =
      `Tạo nhóm thành công!\n` +
      `Tên nhóm: ${groupName}\n` +
      `ID nhóm: ${newGroupData.groupId}`;
    await sendMessageComplete(api, message, successCaption, true, false);

    //
    // *** ĐÃ XÓA TIN NHẮN CHÀO MỪNG THEO YÊU CẦU ***
    //
  } catch (error) {
    // Xử lý lỗi
    console.error("Lỗi khi tạo nhóm:", error);
    const errorCaption = `Đã xảy ra lỗi khi tạo nhóm: ${error.message || "Không thể thực hiện."}`;
    await sendMessageFailed(api, message, errorCaption, true);
  }
}

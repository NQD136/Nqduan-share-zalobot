import {
  sendMessageFromSQL,
  sendMessageWarningRequest,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { removeMention } from "../../utils/format-util.js";

export async function handleJoinLeaveGroup(api, message) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);

  const commandParts = content.split(" ");
  const linkJoin = commandParts[1];
  const iterations = parseInt(commandParts[2]);

  // Kiểm tra cú pháp
  if (!linkJoin || isNaN(iterations) || iterations < 1) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Cú pháp: ${prefix}joinleave [link] [số lần]\nVí dụ: ${prefix}joinleave https://zalo.me/g/abc123 5`,
      },
      false,
      30000,
    );
    return;
  }

  let groupInfo = null;
  try {
    groupInfo = await api.getGroupInfoByLink(linkJoin);
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Link này không tồn tại nhóm/cộng đồng nào!`,
      },
      true,
      30000,
    );
    return;
  }

  if (!groupInfo) return;

  let successfulIterations = 0; // Đếm số lần join/leave thành công
  let approvalErrors = 0; // Đếm số lần thất bại do duyệt thành viên
  let otherErrors = 0; // Đếm số lần thất bại do lỗi khác

  try {
    for (let i = 0; i < iterations; i++) {
      let joinedSuccessfully = false; // Biến kiểm tra xem có join thành công không

      // Tham gia nhóm
      try {
        await api.joinGroup(linkJoin);
        joinedSuccessfully = true;
        console.log(
          `Lần ${i + 1}: Tham gia nhóm "${groupInfo.name}" thành công`,
        );
      } catch (error) {
        console.log(`Lần ${i + 1}: Lỗi khi tham gia nhóm: ${error.message}`);
        if (error.message.includes("Waiting for approve")) {
          approvalErrors++;
          continue; // Bỏ qua lần này nếu nhóm yêu cầu duyệt
        } else if (error.message.includes("đã là thành viên")) {
          joinedSuccessfully = true; // Nếu đã là thành viên, vẫn thử rời nhóm
        } else {
          otherErrors++;
          continue; // Bỏ qua lần này nếu lỗi khác
        }
      }

      // Đợi 10 giây để tránh bị giới hạn
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Rời nhóm (chỉ nếu join thành công hoặc đã là thành viên)
      if (joinedSuccessfully) {
        try {
          await api.leaveGroup(groupInfo.groupId);
          successfulIterations++; // Tăng số lần thành công
          console.log(`Lần ${i + 1}: Rời nhóm "${groupInfo.name}" thành công`);
        } catch (error) {
          console.log(`Lần ${i + 1}: Lỗi khi rời nhóm: ${error.message}`);
          otherErrors++;
          // Tiếp tục vòng lặp ngay cả khi lỗi rời nhóm
        }
      }

      // Đợi 10 giây trước khi lặp lại
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Gửi thông báo hoàn thành
    let messageContent = `Hoàn thành ${successfulIterations} lần join và leave nhóm "${groupInfo.name}"!`;
    if (successfulIterations < iterations) {
      messageContent += `\nLưu ý: ${iterations - successfulIterations} lần thất bại`;
      if (approvalErrors > 0) {
        messageContent += ` (${approvalErrors} lần do nhóm yêu cầu duyệt thành viên)`;
      }
      if (otherErrors > 0) {
        messageContent += ` (${otherErrors} lần do lỗi khác, kiểm tra log để biết thêm)`;
      }
    }
    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: messageContent,
      },
      true,
      60000,
    );
  } catch (error) {
    console.log(`Lỗi không xác định: ${error.message}`);
    await sendMessageWarningRequest(
      api,
      message,
      {
        caption: `Lỗi không xác định: ${error.message}`,
      },
      60000,
    );
  }
}

import {
  sendMessageFailed,
  sendMessageStateQuote,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { isAdmin } from "../../index.js";

export async function handleUndoFriendRequest(api, message, aliasCommand) {
  try {
    const prefix = getGlobalPrefix();
    const senderId = message.data?.uidFrom;
    const senderName = message.data?.dName || "Người dùng";

    let mentions = message.data?.mentions || [];

    // Hỗ trợ reply nếu không mention
    if (mentions.length === 0 && message.data?.reply) {
      mentions.push({
        uid: message.data.reply.uid,
        dName: message.data.reply.dName || "Người dùng",
      });
    }

    // Nếu không có ai được tag/reply → báo lỗi
    if (mentions.length === 0) {
      await sendMessageStateQuote(
        api,
        message,
        `Cách dùng:\n` + `• ${prefix}${aliasCommand} @mention, reply\n`,
        false,
        60000,
      );
      return;
    }

    // Bắt đầu xử lý từng người
    const successList = [];
    const failedList = [];

    await sendMessageStateQuote(
      api,
      message,
      "Đang hủy lời mời kết bạn...",
      true,
      10000,
    );

    for (const mention of mentions) {
      const targetUid = mention.uid.toString();
      const targetName = mention.dName || targetUid;

      try {
        // GỌI API CHÍNH XÁC – dùng api.undoFriendRequest đã tách riêng
        await api.undoFriendRequest(targetUid);

        successList.push(`@${targetName}`);
      } catch (error) {
        console.error(`Lỗi hủy lời mời với ${targetUid}:`, error.message);
        failedList.push(
          `@${targetName} (lỗi: ${error.message.includes("not found") ? "không tồn tại lời mời" : "khác"})`,
        );
      }
    }

    // Tổng kết kết quả
    let resultMsg = `(@${senderName}) Kết quả hủy lời mời:\n\n`;

    if (successList.length > 0) {
      resultMsg += `Thành công:\n${successList.join("\n")}\n\n`;
    }

    if (failedList.length > 0) {
      resultMsg += `Thất bại:\n${failedList.join("\n")}`;
    }

    if (successList.length === 0) {
      resultMsg +=
        "Không hủy được ai cả. Có thể:\n" +
        "• Họ đã chấp nhận/hủy trước đó\n" +
        "• Bot chưa từng gửi lời mời cho họ\nDo zalo giới hạn";
    }

    // Gửi phản hồi + tag người dùng lệnh + người bị hủy
    const allMentions = [{ uid: senderId, pos: 1, len: senderName.length + 2 }];

    // Tag thêm những người được xử lý
    let currentPos = resultMsg.indexOf("Thành công:");
    mentions.forEach((m) => {
      const name = m.dName || m.uid;
      const search = `@${name}`;
      const pos = resultMsg.indexOf(search);
      if (pos !== -1) {
        allMentions.push({ uid: m.uid, pos, len: search.length });
      }
    });

    await api.sendMessage(
      {
        msg: resultMsg.trim(),
        mentions: allMentions,
        ttl: 120000,
      },
      message.threadId,
      message.type,
    );
  } catch (error) {
    console.error("Lỗi trong handleUndoFriendRequest:", error);
    await sendMessageFailed(api, message, `Lỗi hệ thống: ${error.message}`);
  }
}

import {
  sendMessageFailed,
  sendMessageStateQuote,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { isAdmin } from "../../index.js";
export async function handleRejectFriendRequest(api, message, aliasCommand) {
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

    if (mentions.length === 0) {
      await sendMessageStateQuote(
        api,
        message,
        `Cách dùng lệnh từ chối lời mời kết bạn:\n\n` +
          `${prefix}${aliasCommand} @mention, reply`,
        false,
        60000,
      );
      return;
    }

    // Kiểm tra quyền (chỉ admin mới được từ chối lời mời)
    if (!isAdmin(senderId)) {
      await sendMessageStateQuote(
        api,
        message,
        "Chỉ Admin mới được dùng lệnh này!",
        false,
        30000,
      );
      return;
    }

    await sendMessageStateQuote(
      api,
      message,
      "Đang từ chối lời mời kết bạn...",
      true,
      10000,
    );

    const successList = [];
    const failedList = [];

    for (const mention of mentions) {
      const targetUid = mention.uid.toString();
      const targetName = mention.dName || targetUid;

      try {
        // GỌI API TỪ CHỐI
        const result = await api.rejectFriendRequest(targetUid);

        if (!result.error) {
          successList.push(`@${targetName}`);
        } else {
          throw new Error(result.error.message || "Unknown error");
        }
      } catch (error) {
        console.error(`Lỗi từ chối lời mời với ${targetUid}:`, error.message);
        let reason = "lỗi không xác định";
        if (
          error.message.includes("not found") ||
          error.message.includes("không tồn tại")
        ) {
          reason = "không có lời mời";
        } else if (error.message.includes("already")) {
          reason = "đã xử lý trước đó";
        }
        failedList.push(`@${targetName} (${reason})`);
      }
    }

    // Tổng kết kết quả
    let resultMsg = `@${senderName} Kết quả từ chối lời mời:\n\n`;

    if (successList.length > 0) {
      resultMsg += `Đã từ chối:\n${successList.join("\n")}\n\n`;
    }

    if (failedList.length > 0) {
      resultMsg += `Không thể từ chối:\n${failedList.join("\n")}`;
    }

    if (successList.length === 0) {
      resultMsg +=
        "Không từ chối được ai cả.\nCó thể họ chưa gửi lời mời hoặc đã được xử lý trước đó\nCó thể do zalo giới hạn.";
    }

    // Tag người dùng lệnh + người bị từ chối
    const allMentions = [{ uid: senderId, pos: 1, len: senderName.length + 2 }];

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
    console.error("Lỗi trong handleRejectFriendRequest:", error);
    await sendMessageFailed(api, message, `Lỗi hệ thống: ${error.message}`);
  }
}

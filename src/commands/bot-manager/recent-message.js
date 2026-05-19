import { getBotId, isAdmin } from "../../index.js";
import { sendMessageStateQuote } from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { removeMention } from "../../utils/format-util.js";

export async function handleDeleteMessage(
  api,
  message,
  groupAdmins,
  aliasCommand,
) {
  const content = removeMention(message);
  const prefixGlobal = getGlobalPrefix(message);

  if (!content.startsWith(prefixGlobal + aliasCommand)) {
    return;
  }

  const keyContent = content
    .replace(`${prefixGlobal}${aliasCommand}`, "")
    .trim();
  const args = keyContent.split(" ");
  const idBot = getBotId();

  let targetUIDs = [];
  let count = 0;

  // --- Phân tích cú pháp lệnh MỚI (ĐÃ SỬA) ---

  // Lấy số lượng (count) TỪ CUỐI CÙNG của lệnh
  // Ví dụ: args = ["@Bún", "Đậu", "Nước", "Mắm", "10"]
  const potentialCount = args.pop(); // Lấy "10" ra
  count = parseInt(potentialCount) || 0;

  // Bây giờ args còn lại: ["@Bún", "Đậu", "Nước", "Mắm"]
  // Hoặc nếu là "all 10", args còn lại ["all"]
  // Hoặc nếu reply "10", args còn lại []

  // Lấy mục tiêu từ những gì còn lại
  let targetType = args[0] || "normal";
  if (message.data.mentions && message.data.mentions.length > 0) {
    targetType = "mention"; // Đặt cờ là "mention" nếu API trả về mention
  }

  if (message.data?.quote) {
    // Cú pháp: !del <số lượng> (khi đang quote)
    const quotedAuthorId = message.data.quote.ownerId;
    targetUIDs.push(quotedAuthorId === "0" ? idBot : quotedAuthorId);

    if (count <= 0) {
      await sendMessageStateQuote(
        api,
        message,
        "Hãy nhập số lượng tin nhắn cần xóa",
        false,
        10000,
      );
      return;
    }
  } else if (targetType === "mention") {
    // Cú pháp: !del @tag <số lượng>
    targetUIDs = message.data.mentions.map((m) => m.uid);

    if (count <= 0) {
      await sendMessageStateQuote(
        api,
        message,
        "Hãy nhập số lượng tin nhắn cần xóa",
        false,
        10000,
      );
      return;
    }
  } else if (targetType === "all") {
    // Cú pháp: !del all <số lượng>
    targetUIDs = null; // Cờ đặc biệt cho 'all'
    if (count <= 0) {
      await sendMessageStateQuote(
        api,
        message,
        "Hãy nhập số lượng tin nhắn cần xóa",
        false,
        10000,
      );
      return;
    }
  } else {
    // Không có quote, không có tag, không có 'all' -> Lỗi
    await sendMessageStateQuote(
      api,
      message,
      `Cú pháp không hợp lệ\nDùng ${prefixGlobal}${aliasCommand} [all] [số lượng] - Để xóa all\nDùng ${prefixGlobal}${aliasCommand} @memtion [số lượng] - Xóa tin nhắn của user được nhắc đến`,
      false,
      30000,
    );
    return;
  }

  // --- Logic QUÉT và XÓA (Giữ nguyên) ---

  let countDelete = 0;
  let deletePromises = [];
  let currentMsgId = message.data.msgId || message.msgId;
  const threadId = message.threadId || message.idTo;

  const oneDayInMs = 24 * 60 * 60 * 1000;
  const currentTime = Date.now();
  let hit24HourLimit = false;
  let attempts = 0;
  const maxAttempts = 100;

  try {
    while (countDelete < count && !hit24HourLimit && attempts < maxAttempts) {
      const recentMessage = await api.getRecentMessages(
        threadId,
        currentMsgId,
        50,
      );
      const parsedMessage = JSON.parse(recentMessage);
      const messages = parsedMessage.groupMsgs;

      if (!messages || messages.length === 0) {
        break;
      }

      messages.sort((a, b) => Number(b.ts) - Number(a.ts));

      for (const msg of messages) {
        if (currentTime - Number(msg.ts) > oneDayInMs) {
          hit24HourLimit = true;
          break;
        }

        let shouldDelete = false;
        if (targetUIDs === null) {
          shouldDelete = true;
        } else {
          if (targetUIDs.includes(msg.uidFrom)) shouldDelete = true;
          if (targetUIDs.includes(idBot) && msg.uidFrom === "0")
            shouldDelete = true;
        }

        if (shouldDelete) {
          if (countDelete >= count) {
            break;
          }

          const msgDel = {
            type: message.type,
            threadId: message.threadId,
            data: {
              cliMsgId: msg.cliMsgId,
              msgId: msg.msgId,
              uidFrom: msg.uidFrom === "0" ? idBot : msg.uidFrom,
            },
          };

          deletePromises.push(api.deleteMessage(msgDel, false));
          countDelete++;
        }
      }

      if (countDelete >= count || hit24HourLimit) {
        break;
      }

      currentMsgId = messages[messages.length - 1].msgId;
      attempts++;
    }

    const results = await Promise.allSettled(deletePromises);

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount = results.filter((r) => r.status === "rejected").length;

    const caption =
      `${successCount > 0 ? `Thành công xóa ${successCount} tin nhắn` : "Đếch có tin nhắn nào được xóa"}` +
      `${failCount > 0 ? `\nCó ${failCount} tin nhắn không xóa được` : ""}` +
      `${hit24HourLimit ? `\nĐã dừng quét do gặp tin nhắn cũ hơn 24 giờ` : ""}`;
    await sendMessageStateQuote(api, message, caption, true, 60000);
  } catch (error) {
    console.error("Lỗi khi quét và xóa tin nhắn:", error);
    await sendMessageStateQuote(
      api,
      message,
      "Đã xảy ra lỗi trong quá trình quét, vui lòng thử lại.",
      false,
      10000,
    );
  }
}

// (Các hàm getRecentMessage và findAndDeleteMessage vẫn được xóa)

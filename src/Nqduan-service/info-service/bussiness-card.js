//src/Nqduan-service/info-service/bussiness-card.js
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";

export async function userBussinessCardCommand(api, message, aliasCommand) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const prefixCommand = getGlobalPrefix();

  // 1. Lấy nội dung text, đã loại bỏ mention (vì mention dùng để target)
  const content = removeMention(message);
  const textString = content
    .replace(`${prefixCommand}${aliasCommand}`, "")
    .trim();

  let targetUids = [];
  let cardMessage = textString; // Mặc định message là toàn bộ textString

  try {
    // Ưu tiên 1: Lấy UID từ mentions (có thể tag nhiều người)
    if (message.data.mentions?.length > 0) {
      targetUids = message.data.mentions.map((mention) => mention.uid);
      // cardMessage đã đúng vì textString đã được removeMention từ đầu
    }
    // Ưu tiên 2: Nếu không có mention, kiểm tra xem textString có chứa UID không
    else {
      const uidRegex = /^(\d{10,20})/; // Kiểm tra UID ở *đầu* chuỗi
      const match = textString.match(uidRegex);

      if (match) {
        // Nếu có UID, target là UID đó
        const uid = match[1];
        targetUids = [uid];
        // Message là phần còn lại của chuỗi sau khi bỏ UID
        cardMessage = textString.replace(uidRegex, "").trim();
      } else {
        // Ưu tiên 3: Mặc định là người gửi
        targetUids = [senderId];
        // Message là toàn bộ textString (có thể rỗng)
        cardMessage = textString;
      }
    }

    // Lặp qua tất cả UID mục tiêu và gửi card
    for (const userId of targetUids) {
      await api.sendBusinessCard(
        null,
        userId, // UID của người cần gửi business card
        cardMessage, // Tin nhắn đính kèm
        message.type,
        threadId,
      );
    }
  } catch (error) {
    console.error("Lỗi khi gửi business card:", error);
  }
}

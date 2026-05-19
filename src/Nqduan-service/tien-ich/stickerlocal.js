import { MessageType } from "../../api-zalo/index.js";
import { removeMention } from "../../utils/format-util.js";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";

// Hàm xử lý lệnh gửi sticker theo ID
export async function handleStickerLocalCommand(api, message) {
  const threadId = message?.threadId || message?.data?.idTo;

  if (!threadId) {
    // console.warn(`[SendStickerLocal] Missing threadId`);
    return;
  }

  // Lấy nội dung tin nhắn và trích xuất ID sticker
  const content = removeMention(message);
  const args = content.split(" ").slice(1); // Bỏ qua lệnh, lấy các tham số
  const stickerId = args[0] ? parseInt(args[0], 10) : null;

  // Kiểm tra ID sticker hợp lệ
  if (!stickerId || isNaN(stickerId)) {
    try {
      await sendMessageStateQuote(
        api,
        message,
        "Vui lòng cung cấp ID sticker hợp lệ (số nguyên)!",
        false,
        300000
      );
      // console.log(`[SendStickerLocal] Sent invalid ID warning for thread ${threadId}`);
    } catch (error) {
      // console.error(`[SendStickerLocal] Error sending invalid ID warning: ${error.message}`);
    }
    return;
  }

  // Gửi sticker
  const sticker = { id: stickerId, cateId: 1, type: 1 };
  try {
    await api.sendSticker(sticker, threadId, MessageType.GroupMessage, 86400000);
    // console.log(`[SendStickerLocal] Sent sticker ${stickerId} to thread ${threadId}`);

    // Gửi thông báo xác nhận
    await sendMessageStateQuote(
      api,
      message,
      `Đã gửi sticker với ID ${stickerId}!`,
      true,
      300000
    );
  } catch (error) {
    // console.error(`[SendStickerLocal] Error sending sticker to thread ${threadId}: ${error.message}`);
    try {
      await sendMessageStateQuote(
        api,
        message,
        `Không thể gửi sticker với ID ${stickerId}. Vui lòng kiểm tra lại ID!`,
        false,
        300000
      );
    } catch (sendError) {
      // console.error(`[SendStickerLocal] Error sending error message: ${sendError.message}`);
    }
  }
}
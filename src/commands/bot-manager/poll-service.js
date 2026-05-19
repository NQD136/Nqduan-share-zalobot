// === Imports Cần Thiết ===
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { getContent } from "../../utils/format-util.js";
// Import các hàm style chat
import {
  sendMessageFailed,
  sendMessageQuery,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
// Import các hàm API và IO
import { writeGroupSettings } from "../../utils/io-json.js";
import { MessageType } from "../../api-zalo/index.js"; // Cần cho api.sendMessage

/**
 * Xử lý chính cho lệnh %poll (Đã tinh gọn, chỉ xử lý Tạo Poll)
 */
export async function handlePollCommand(
  api,
  message,
  aliasCommand,
  groupSettings,
) {
  try {
    const prefix = getGlobalPrefix();
    const rawContent = getContent(message);
    const commandString = `${prefix}${aliasCommand}`;
    const contentArgs = rawContent.slice(commandString.length).trim();
    const threadId = message.threadId;

    // --- Sửa Lỗi: Khởi tạo groupSettings[threadId] trước khi truy cập ---
    if (!groupSettings[threadId]) {
      groupSettings[threadId] = {};
    }
    if (!groupSettings[threadId].polls) {
      groupSettings[threadId].polls = {}; // Tạo 1 object để lưu { pollId: pollData }
    }
    // --- Kết thúc Khởi tạo Lỗi ---

    // Chỉ gọi hàm tạo poll (Nếu nội dung không phải là 'check' hay 'vote')
    if (contentArgs.startsWith("check") || contentArgs.startsWith("vote")) {
      await sendMessageQuery(
        api,
        message,
        `Lệnh check/vote đã bị loại bỏ. Vui lòng sử dụng cú pháp tạo poll: ${prefix}${aliasCommand} <Câu hỏi> | <LC 1> | <LC 2>`,
        false,
      );
    } else {
      await createPollAndSave(api, message, groupSettings, contentArgs);
    }
  } catch (error) {
    console.error("Lỗi nghiêm trọng khi xử lý handlePollCommand:", error);
    await sendMessageFailed(
      api,
      message,
      "Đã có lỗi bất ngờ xảy ra khi xử lý poll.",
      false,
    );
  }
}

// ====================================================================
// CHỨC NĂNG 1: TẠO VÀ LƯU BÌNH CHỌN
// ====================================================================

async function createPollAndSave(api, message, groupSettings, contentArgs) {
  const threadId = message.threadId;

  // 1. Phân tích lệnh
  let allowMulti = false;
  if (contentArgs.startsWith("[multi]")) {
    allowMulti = true;
    contentArgs = contentArgs.slice("[multi]".length).trim();
  }
  const parts = contentArgs.split("|").map((part) => part.trim());

  if (parts.length < 3 || parts[0] === "") {
    const prefix = getGlobalPrefix();
    await sendMessageQuery(
      api,
      message,
      `Cú pháp tạo poll: ${prefix}poll <Câu hỏi> | <LC 1> | <LC 2>`,
      false,
    );
    return;
  }

  const pollOptions = {
    question: parts[0],
    options: parts.slice(1),
    expiredTime: 0,
    allowMultiChoices: allowMulti,
    allowAddNewOption: false,
    hideVotePreview: false,
    isAnonymous: false,
  };

  // 2. Gọi API createPoll
  const result = await api.createPoll(pollOptions, threadId);

  // 3. Xử lý kết quả và LƯU LẠI
  if (result.error) {
    await sendMessageFailed(
      api,
      message,
      `Tạo poll thất bại: ${result.error.message}`,
      false,
    );
  } else {
    // TẠO POLL THÀNH CÔNG!
    const newPollId = result.data?.id;
    const question = pollOptions.question;

    if (newPollId) {
      // Lưu poll mới vào groupSettings (groupSettings[threadId].polls đã được đảm bảo tồn tại)
      groupSettings[threadId].polls[newPollId] = {
        question: question,
        options: pollOptions.options,
      };

      await writeGroupSettings(groupSettings);

      // Xóa tin nhắn lệnh gốc (tùy chọn)
      try {
        await api.deleteMessage(message);
      } catch (e) {}

      // Thông báo thành công
      await api.sendMessage(
        {
          msg: `✅ Poll "${question}" đã được tạo!`,
          ttl: 60000,
          linkOn: false,
        },
        threadId,
        message.type,
      );
    } else {
      await sendMessageFailed(
        api,
        message,
        "Tạo poll thành công nhưng không lấy được ID poll. Không thể lưu trữ.",
        false,
      );
    }
  }
}

import { getBotId, isAdmin } from "../../index.js";
import { getGroupInfoData } from "../../Nqduan-service/info-service/group-info.js";
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";
import {
  sendMessageComplete,
  sendMessageWarning,
  sendMessageStateQuote,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";

// ===================================================================
// ADD FRIEND ALL – DỰA TRÊN api.getGroupInfo() – CHUẨN BOT Nqduan 100%
// ===================================================================
export async function handleSendFriendRequestAll(api, message, aliasCommand) {
  const senderId = message.data.uidFrom.toString();
  const threadId = message.threadId.toString();
  const prefix = getGlobalPrefix();
  const startTime = Date.now();

  if (!isAdmin(senderId)) {
    await sendMessageStateQuote(
      api,
      message,
      "Chỉ admin cấp cao mới dùng được!",
      false,
      30000,
    );
    return;
  }

  await sendMessageStateQuote(
    api,
    message,
    "Đang quét memVerList từ getGroupInfo()...",
    true,
    60000,
  );

  // BƯỚC 1: DÙNG getGroupInfo() – HÀM CÓ THẬT TRONG BOT Nqduan
  let groupInfo;
  try {
    groupInfo = await api.getGroupInfo(threadId);
  } catch (err) {
    console.error("[AddFriendAll] Lỗi getGroupInfo:", err);
    await sendMessageWarning(
      api,
      message,
      "Lỗi kết nối Zalo. Không thể quét nhóm.",
    );
    return;
  }

  // BƯỚC 2: LẤY memVerList – FULL UID THẬT
  const memVerList = groupInfo?.gridInfoMap?.[threadId]?.memVerList;
  if (!memVerList || memVerList.length === 0) {
    await sendMessageWarning(
      api,
      message,
      "Không lấy được danh sách thành viên (bot bị kick hoặc nhóm lỗi).",
    );
    return;
  }

  const botId = getBotId().toString();

  // LỌC UID HỢP LỆ
  const validMembers = memVerList
    .map((m) => ({
      uid: m.uid?.toString() || m.userId?.toString(),
      name: m.dName || "Người dùng",
    }))
    .filter(
      (m) => m.uid && m.uid !== botId && m.uid.length >= 15 && m.uid !== "0",
    );

  if (validMembers.length === 0) {
    await sendMessageWarning(
      api,
      message,
      "Không có thành viên nào để gửi kết bạn.",
    );
    return;
  }

  await sendMessageStateQuote(
    api,
    message,
    `Tìm thấy ${validMembers.length} thành viên hợp lệ!\nBắt đầu gửi kết bạn...\nƯớc tính: ${Math.ceil((validMembers.length * 8) / 60)} phút`,
    true,
    600000,
  );

  const successList = [];
  const failedList = [];
  const customMessage = "Chào bạn! Mình là Bot của Nqduan đây ạ ❤️";

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  for (let i = 0; i < validMembers.length; i++) {
    const { uid, name } = validMembers[i];

    try {
      await api.sendFriendRequest(uid, customMessage, "vi");
      successList.push({ uid, name });
      console.log(
        `[AddFriendAll] [${i + 1}/${validMembers.length}] ĐÃ GỬI → ${name} (${uid})`,
      );

      if ((i + 1) % 10 === 0 || i === validMembers.length - 1) {
        await sendMessageStateQuote(
          api,
          message,
          `Đang gửi: ${i + 1}/${validMembers.length}\nThành công: ${successList.length}`,
          true,
          600000,
        );
      }

      await delay(7000 + Math.random() * 3000);
    } catch (err) {
      console.error(`[AddFriendAll] LỖI → ${name} (${uid}): ${err.message}`);
      failedList.push({ uid, name, reason: err.message });
    }
  }

  const totalTime = Math.ceil((Date.now() - startTime) / 1000);
  let report = `HOÀN TẤT ADD FRIEND ALL\n\n`;
  report += `Tổng thành viên: ${memVerList.length}\n`;
  report += `Hợp lệ: ${validMembers.length}\n`;
  report += `Thành công: ${successList.length}\n`;
  report += `Thời gian: ${totalTime}s\n`;
  report += `\nLệnh: ${prefix}${aliasCommand}`;

  await sendMessageComplete(api, message, report);
}

// XỬ LÝ LỆNH
export async function handleAddFriendAllCommand(api, message, aliasCommand) {
  const content = removeMessage(message).trim();
  const prefix = getGlobalPrefix();

  if (!content.startsWith(`${prefix}${aliasCommand}`)) return false;

  if (content.replace(`${prefix}${aliasCommand}`, "").trim()) {
    await sendMessageWarning(api, message, `Dùng: ${prefix}${aliasCommand}`);
    return true;
  }

  await handleSendFriendRequestAll(api, message, aliasCommand);
  return true;
}

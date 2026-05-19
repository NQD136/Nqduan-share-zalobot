import { isAdmin } from "../../index.js";
import {
  sendMessageComplete,
  sendMessageFailed,
  sendMessageQuery,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getContent } from "../../utils/format-util.js";
import {
  getFileInfoFromUrl,
  getImageMetaData,
  logger,
} from "../../api-zalo/utils.js";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
export async function handleRenameCommand(api, message) {
  const senderId = message.data?.uidFrom || message.senderID;
  if (!isAdmin(senderId)) {
    await sendMessageFailed(
      api,
      message,
      "Bạn không có quyền đổi tên bot!",
      false,
      10000,
    );
    return true;
  }
  const content = getContent(message);
  const args = content.split(" ");
  args.shift();
  const newName = args.join(" ").trim();
  if (!newName) {
    await sendMessageQuery(api, message, "Vui lòng nhập tên mới để đổi!");
    return true;
  }
  const defaultDob = "2000-01-01";
  const defaultGender = 0;
  try {
    await api.changeAccountSetting(newName, defaultDob, defaultGender);
    await sendMessageComplete(api, message, `Đã đổi tên bot thành: ${newName}`);
  } catch (err) {
    console.error(err);
    await sendMessageFailed(api, message, `Đổi tên thất bại: ${err.message}`);
  }
  return true;
}

import fs from "fs";
import path from "path";
import {
  getGlobalPrefix,
  setGlobalPrefix,
} from "../../Nqduan-service/service.js";
import {
  sendMessageQuery,
  sendMessageComplete,
  sendMessageFailed,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

const commandConfigPath = path.join(
  process.cwd(),
  "assets",
  "json-data",
  "command.json",
);

export async function handlePrefixCommand(api, message, threadId, isAdmin) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();
  if (
    !content.startsWith(`${currentPrefix}prefix`) &&
    !content.startsWith(`prefix`)
  ) {
    return false;
  }

  const args = content
    .slice(content.startsWith(currentPrefix) ? currentPrefix.length + 6 : 6)
    .trim();

  if (!args) {
    await sendMessageQuery(
      api,
      message,
      `Prefix hiện tại của bot là: ${currentPrefix || "(không có)"}`,
      false,
      300000,
    );
    return true;
  }

  if (!isAdmin) {
    await sendMessageFailed(
      api,
      message,
      "❌ Bạn không có quyền thay đổi prefix của bot!",
      false,
    );
    return true;
  }

  const newPrefix = args.toLowerCase() === "none" ? "" : args;

  if (newPrefix.includes(" ")) {
    await sendMessageFailed(
      api,
      message,
      "❌ Prefix không được chứa khoảng trắng!",
      false,
    );
    return true;
  }

  try {
    updatePrefix(newPrefix);
    setGlobalPrefix(newPrefix);

    await sendMessageComplete(
      api,
      message,
      `✅ Prefix của bot đã được cập nhật thành công!\nPrefix mới là: ${newPrefix || "(không có)"}`,
      false,
      120000,
    );
  } catch (error) {
    console.error("Lỗi khi cập nhật prefix:", error);

    await sendMessageFailed(
      api,
      message,
      "❌ Đã xảy ra lỗi khi thay đổi prefix!",
      false,
    );
  }

  return true;
}

function updatePrefix(newPrefix) {
  try {
    const config = JSON.parse(fs.readFileSync(commandConfigPath, "utf8"));
    config.prefix = newPrefix;
    fs.writeFileSync(commandConfigPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Lỗi khi ghi file prefix:", error);
    throw error;
  }
}

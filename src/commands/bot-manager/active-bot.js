import { MessageStyle, MessageType } from "../../api-zalo/index.js";
import { isAdmin } from "../../index.js";
import {
  sendMessageComplete,
  sendMessageFailed,
  sendMessageResultRequest,
  sendMessageWarning,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { removeMention } from "../../utils/format-util.js";
import { readManagerFile, writeManagerFile } from "../../utils/io-json.js";
import schedule from "node-schedule";
import { updateNameServer } from "../../database/index.js";
import fs from "fs/promises";
import path from "path";
import { clearImagePath } from "../../utils/canvas/index.js";
import { getBotInfo } from "../../utils/env.js";

const botInfo = await getBotInfo();
const configPath = botInfo?.databaseFile;
export let databaseConfig;

async function initializeDatabaseConfig() {
  if (!configPath) {
    console.error(
      "Error: databaseFile is undefined in getBotInfo(). Check utils/env.js.",
    );
    throw new Error("Configuration file path is not defined.");
  }
  try {
    const configRaw = await fs.readFile(configPath, "utf-8");
    databaseConfig = JSON.parse(configRaw);
  } catch (err) {
    console.error(
      `Error initializing databaseConfig from ${configPath}: ${err.message}`,
    );
    throw err;
  }
}

initializeDatabaseConfig().catch((err) => {
  console.error("Failed to initialize databaseConfig:", err.message);
  process.exit(1);
});

export async function handleNameServerCommand(
  api,
  message,
  botCommand,
  senderId,
) {
  if (!isAdmin(senderId)) {
    await sendMessageFailed(
      api,
      message,
      "Bạn không có quyền đổi tên server!",
      false,
      10000,
    );
    return true;
  }
  const newName = botCommand.replace("nameServer", "").trim();
  if (!newName) {
    await sendMessageFailed(
      api,
      message,
      "Vui lòng nhập tên mới cho server!",
      false,
      10000,
    );
    return true;
  }
  try {
    if (!configPath)
      throw new Error(
        "Configuration file path is not defined in getBotInfo().",
      );

    let config;
    try {
      const configRaw = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(configRaw);
    } catch (err) {
      throw new Error(
        `Failed to read or parse configuration file at ${configPath}: ${err.message}`,
      );
    }

    const oldName = config.nameServer || "Unknown";
    config.nameServer = newName;

    try {
      const tmpPath = configPath + ".tmp";
      await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), "utf-8");
      await fs.rename(tmpPath, configPath);
      databaseConfig = config;
    } catch (err) {
      throw new Error(
        `Failed to write configuration file at ${configPath}: ${err.message}`,
      );
    }

    try {
      if (typeof updateNameServer === "function") {
        await updateNameServer(newName);
      } else {
        console.warn(
          "updateNameServer is not a function. Skipping database update.",
        );
      }
    } catch (err) {
      console.warn(`Failed to update server name in database: ${err.message}`);
    }

    await sendMessageComplete(
      api,
      message,
      `✅ Đã đổi tên server từ ${oldName} thành ${newName}.`,
    );
  } catch (err) {
    console.error(`Error in handleNameServerCommand: ${err.message}`);
    await sendMessageFailed(
      api,
      message,
      `❌ Lỗi khi cập nhật tên server: ${err.message}`,
    );
  }
  return true;
}

export const managerData = {
  data: readManagerFile(),
  hasChanges: false,
};

export async function notifyResetGroup(api) {
  const groupRequiredReset = managerData.data.groupRequiredReset;
  if (groupRequiredReset !== "-1") {
    let group;
    try {
      group = await api.getGroupInfo(groupRequiredReset);
    } catch {
      group = null;
    }

    await sendMessageResultRequest(
      api,
      group ? MessageType.GroupMessage : MessageType.DirectMessage,
      groupRequiredReset,
      "Khởi động lại hoàn tất!\nBot đã hoạt động trở lại!",
      true,
      60000,
    );

    managerData.data.groupRequiredReset = "-1";
    managerData.hasChanges = true;
  }
}

export async function exitRestartBot(api, message) {
  try {
    const threadId = message.threadId;
    managerData.data.groupRequiredReset = threadId;
    managerData.hasChanges = true;
    saveManagerData();

    // ⚙️ Gửi thông báo restart (chỉ 1 lần duy nhất)
    await sendMessageResultRequest(
      api,
      MessageType.GroupMessage,
      threadId,
      "Bot is restarting…",
      true,
      30000,
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));
    process.exit(0);
  } catch (error) {
    await sendMessageFailed(
      api,
      message,
      "Không thể tắt bot: " + error.message,
      false,
      15000,
    );
  }
}

const saveManagerData = () => {
  writeManagerFile(managerData.data);
  managerData.hasChanges = false;
};

// Auto-save mỗi 5 giây
schedule.scheduleJob("*/5 * * * * *", () => {
  if (managerData.hasChanges) saveManagerData();
});

export async function handleActiveBotUser(api, message, groupSettings) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const prefix = getGlobalPrefix();
  const botCommand = content.replace(`${prefix}bot`, "").trim();

  if (!botCommand) {
    const helpMessage =
      `📖 Hướng dẫn sử dụng bot:\n\n` +
      `🔹 Bật/tắt tương tác với thành viên:\n ➤  ${prefix}bot on|off\n\n` +
      `🔹 Bật/tắt lệnh riêng tư:\n ➤  ${prefix}bot privatebot on|off\n\n` +
      `🔹 Bật/tắt game riêng tư:\n ➤  ${prefix}bot privategame on|off\n\n` +
      `🔹 Đổi tên server:\n ➤  ${prefix}bot nameServer <Tên mới>\n\n` +
      `🔹 Khởi động lại bot:\n ➤  ${prefix}bot restart`;
    await sendMessageComplete(api, message, helpMessage);
    return true;
  }

  if (botCommand === "on" || botCommand === "off") {
    if (groupSettings) {
      const newStatus = botCommand === "on";
      groupSettings[threadId].activeBot = newStatus;
      const caption = `Đã ${newStatus ? "kích hoạt" : "vô hiệu hóa"} tương tác bot trong nhóm này.`;
      if (newStatus) await sendMessageComplete(api, message, caption);
      else await sendMessageFailed(api, message, caption);
    } else {
      await sendMessageFailed(
        api,
        message,
        "Không thể setup nhóm ở tin nhắn riêng tư!",
      );
    }
    return true;
  }

  if (botCommand.includes("privatebot")) {
    const privateCommand = botCommand.replace("privatebot", "").trim();
    const newStatus = privateCommand === "on";
    managerData.data.onBotPrivate = newStatus;
    managerData.hasChanges = true;
    const caption = `Đã ${newStatus ? "kích hoạt" : "vô hiệu hóa"} lệnh bot trong tin nhắn riêng tư.`;
    if (newStatus) await sendMessageComplete(api, message, caption);
    else await sendMessageFailed(api, message, caption);
    return true;
  }

  if (botCommand.includes("privategame")) {
    const privateCommand = botCommand.replace("privategame", "").trim();
    const newStatus = privateCommand === "on";
    managerData.data.onGamePrivate = newStatus;
    managerData.hasChanges = true;
    const caption = `Đã ${newStatus ? "kích hoạt" : "vô hiệu hóa"} game trong tin nhắn riêng tư.`;
    if (newStatus) await sendMessageComplete(api, message, caption);
    else await sendMessageFailed(api, message, caption);
    return true;
  }

  // 🆕 --- Lệnh Restart cập nhật ---
  if (botCommand === "restart" || botCommand.includes("rs")) {
    try {
      const adminPath = path.resolve("./assets/data/list_admin.json");
      const rawData = await fs.readFile(adminPath, "utf-8");
      const adminList = JSON.parse(rawData); // File là mảng ["id1", "id2"]

      if (!Array.isArray(adminList) || !adminList.includes(senderId)) {
        await sendMessageFailed(
          api,
          message,
          `Xin lỗi, đây là Mini Bot nên không thể dùng lệnh này\nBạn muốn restart bot vui lòng sử dụng lệnh "mybot restart" lên Bot Leader Nqduanツ`,
          false,
          12000,
        );
        return false;
      }

      // ✅ Gọi hàm restart, KHÔNG gửi tin trùng nữa
      await exitRestartBot(api, message);
      return true;
    } catch (error) {
      console.error("Lỗi khi kiểm tra quyền admin:", error);
      await sendMessageFailed(
        api,
        message,
        `⚠️ Lỗi khi kiểm tra quyền admin: ${error.message}`,
        false,
        15000,
      );
      return false;
    }
  }

  if (botCommand.startsWith("nameServer")) {
    return await handleNameServerCommand(api, message, botCommand, senderId);
  }

  await sendMessageFailed(
    api,
    message,
    `❌ Cú pháp không hợp lệ. Vui lòng sử dụng đúng lệnh ${prefix}bot!`,
  );
  return false;
}

export async function handleActiveGameUser(api, message, groupSettings) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const gameCommand = `${prefix}gameactive`;

  if (content === `${gameCommand} on` || content === `${gameCommand} off`) {
    const newStatus = content.endsWith("on");
    groupSettings[threadId].activeGame = newStatus;
    const caption = `Đã ${newStatus ? "kích hoạt" : "vô hiệu hóa"} xử lý trò chơi trong nhóm này.`;
    if (newStatus) await sendMessageComplete(api, message, caption);
    else await sendMessageFailed(api, message, caption);
    return true;
  }

  await sendMessageFailed(
    api,
    message,
    `❌ Cú pháp không hợp lệ. Dùng: ${prefix}gameactive [on/off].`,
  );
  return false;
}

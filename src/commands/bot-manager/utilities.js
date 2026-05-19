//utilities v2.js
import { GroupMessage, Message, MessageMention } from "../../api-zalo/index.js";
//import {sendGifNPH, sendVideoNPH, sendImageNPH} from "../../Nqduan-service/chat-zalo/chat-special/send-voice/send-voice.js"
import { getCommandConfig, isAdmin } from "../../index.js";
import {
  sendMessageFailed,
  sendMessageFromSQL,
  sendMessageStateQuote,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { removeMention } from "../../utils/format-util.js";
import { writeCommandConfig } from "../../utils/io-json.js";
import { permissionLevels } from "../command.js";
import { getPermissionCommandName } from "../manager-command/set-command.js";
import { getBotId } from "../../index.js";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fetch from "node-fetch";
import { setTimeout as delay } from "timers/promises";
import * as cheerio from "cheerio";
import qs from "qs";

// --- IMPORT CẦN THIẾT CHO LOGIC MỚI ---
import { tempDir } from "../../utils/io-json.js"; // Giả định tempDir đã được định nghĩa ở đây
import { deleteFile } from "../../utils/util.js"; // Giả định deleteFile đã được định nghĩa ở đây
// ----------------------------------------

let stop = false;

const baseDataPath = path.resolve(
  process.cwd(),
  "src",
  "Nqduan-service",
  "chat-zalo",
  "chat-special",
  "send-video",
  "data-api",
);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let activeTodo = false;

export function stopTodo() {
  activeTodo = false;
}

// =================================================================
// --- HÀM TIỆN ÍCH CHUNG (DUPLICATE TỪ PHẦN KHÁC ĐỂ TRÁNH LỖI) ---
// =================================================================

/**
 * Hàm tải file về local (Đã sửa lại để dùng axios/fs)
 */
async function downloadFile(url, filePath) {
  const writer = (await import("fs")).createWriteStream(filePath);
  const response = await axios({ url, method: "GET", responseType: "stream" });
  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

/**
 * Kiểm tra file tồn tại
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lấy URL ảnh từ tin nhắn reply
 * (Lấy logic tương tự handleSetAvatarFromReply)
 */
function getReplyMediaUrl(message) {
  const quote = message.data?.quote;
  if (!quote || !quote.attach) return null;

  try {
    const attachData = JSON.parse(quote.attach);
    // Lấy URL ảnh HD hoặc URL thường
    const imageUrl = attachData.params
      ? JSON.parse(attachData.params)?.hd || attachData.href
      : attachData.href;
    return imageUrl;
  } catch (e) {
    return null;
  }
}

// =================================================================
// --- HÀM XỬ LÝ CHÍNH ---
// =================================================================

export async function handleChangeGroupLink(api, message) {
  try {
    const threadId = message.threadId;
    await api.changeGroupLink(threadId);
  } catch (error) {
    const result = {
      success: false,
      message: `Lỗi khi đổi link nhóm: ${error.message}`,
    };
    await sendMessageFailed(api, message, result);
  }
}

export async function handleUndoMessage(api, message) {
  try {
    await api.undoMessage(message);
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi xử lý lệnh undo: ${error.message}`,
      },
      false,
      30000,
    );
  }
}

/**
 * Tính độ tương đồng giữa 2 chuỗi sử dụng thuật toán Levenshtein Distance
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Tìm các lệnh tương tự dựa trên độ tương đồng của chuỗi
 */
function findSimilarCommands(command, availableCommands, threshold = 0.6) {
  const similarCommands = [];
  const commandLower = command.toLowerCase();

  // Tách command thành các ký tự riêng lẻ
  const commandChars = commandLower.split("");

  // Map các viết tắt phổ biến
  const commonShortcuts = {
    dy: "daily",
    dk: "dangky",
    nt: "nongtrai",
    tx: "taixiu",
    kbb: "keobuabao",
    tt: "thongtin",
    bg: "background",
  };

  for (const cmd of availableCommands) {
    const cmdNameLower = cmd.name.toLowerCase();

    // Kiểm tra các trường hợp:
    const isStartsWith = cmdNameLower.startsWith(commandLower);

    // Kiểm tra viết tắt phổ biến
    const isCommonShortcut = commonShortcuts[commandLower] === cmdNameLower;

    // Kiểm tra xem các ký tự của command có xuất hiện theo thứ tự trong tên lệnh Không
    let matchesSequence = true;
    let lastIndex = -1;
    for (const char of commandChars) {
      const index = cmdNameLower.indexOf(char, lastIndex + 1);
      if (index === -1) {
        matchesSequence = false;
        break;
      }
      lastIndex = index;
    }

    // Tính độ tương đồng bằng Levenshtein
    const distance = levenshteinDistance(commandLower, cmdNameLower);
    const similarity = 1 - distance / Math.max(command.length, cmd.name.length);

    // Thêm vào danh sách nếu thỏa mãn một trong các điều kiện
    if (
      isStartsWith ||
      isCommonShortcut ||
      matchesSequence ||
      similarity >= threshold
    ) {
      similarCommands.push({
        command: cmd,
        similarity: isStartsWith
          ? 1
          : isCommonShortcut
            ? 0.95
            : matchesSequence
              ? 0.9
              : similarity,
      });
    }
  }

  return similarCommands
    .sort((a, b) => {
      // Đầu tiên sắp xếp theo quyền hạn
      const permissionDiff =
        permissionLevels[a.permission] - permissionLevels[b.permission];
      if (permissionDiff !== 0) return permissionDiff;

      // Nếu cùng quyền hạn thì sắp xếp theo độ tương đồng (cao xuống thấp)
      return b.similarity - a.similarity;
    })
    .slice(0, 5)
    .map((item) => item.command);
}

/**
 * Kiểm tra và gợi ý lệnh khi Không tìm thấy command
 */
export async function checkNotFindCommand(
  api,
  message,
  command,
  availableCommands,
) {
  const prefix = getGlobalPrefix();

  if (!command || command.trim() === "") {
    // Trường hợp Không có lệnh
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          `Nếu Bạn Thắc Mắc Mình Có Những Lệnh Gì, Hãy:\n` +
          `${prefix}help - Xem hướng dẫn sử dụng\n` +
          `${prefix}game - Xem hướng dẫn chơi game\n` +
          `${prefix}command - Xem danh sách lệnh có sẵn`,
      },
      false,
      30000,
    );
    return;
  }

  // Tìm các lệnh tương tự
  const similarCommands = findSimilarCommands(command, availableCommands);

  if (similarCommands.length > 0) {
    // Có lệnh tương tự, đưa ra gợi ý
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          `Không tìm thấy lệnh "${command}"\n` +
          `Có phải bạn muốn dùng:\n` +
          similarCommands
            .map(
              (cmd) =>
                `${prefix}${cmd.name} [${getPermissionCommandName(cmd)}]`,
            )
            .join("\n"),
      },
      false,
      30000,
    );
  } else {
    // Không có lệnh tương tự
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          `Không tìm thấy lệnh "${command}". Vui lòng sử dụng:\n` +
          `${prefix}help - Xem hướng dẫn sử dụng\n` +
          `${prefix}game - Xem hướng dẫn chơi game\n` +
          `${prefix}command - Xem danh sách lệnh có sẵn`,
      },
      false,
      30000,
    );
  }
}

/**
 * Xử lý thêm alias cho command
 */
export async function handleAliasCommand(api, message, commandParts) {
  const prefix = getGlobalPrefix();
  const subCommand = commandParts[1]?.toLowerCase();
  const cmdName = commandParts[2]?.toLowerCase();
  const aliasName = commandParts[3]?.toLowerCase();

  if (!subCommand) {
    await handleListAlias(api, message);
    return;
  }

  switch (subCommand) {
    case "add":
      if (!cmdName || !aliasName) {
        await sendMessageFromSQL(
          api,
          message,
          {
            success: false,
            message: `Cú pháp Không đúng. Vui lòng sử dụng:\n${prefix}alias add [tên lệnh] [tên alias]`,
          },
          false,
          300000,
        );
        return;
      }
      await handleAddAlias(api, message, cmdName, aliasName);
      break;

    case "remove":
      if (!cmdName || !aliasName) {
        await sendMessageFromSQL(
          api,
          message,
          {
            success: false,
            message: `Cú pháp Không đúng. Vui lòng sử dụng:\n${prefix}alias remove [tên lệnh] [tên alias]`,
          },
          false,
          300000,
        );
        return;
      }
      await handleRemoveAlias(api, message, cmdName, aliasName);
      break;

    case "list":
      await handleListAlias(api, message, cmdName);
      break;

    default:
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message:
            `Cú pháp Không đúng. Sử dụng:\n` +
            `${prefix}alias add [tên lệnh] [tên alias] - Thêm alias\n` +
            `${prefix}alias remove [tên lệnh] [tên alias] - Xóa alias\n` +
            `${prefix}alias list [tên lệnh] - Xem danh sách alias\n` +
            `${prefix}alias - Xem tất cả alias`,
        },
        false,
        300000,
      );
      break;
  }
}

export async function handleAddAlias(api, message, commandName, aliasName) {
  try {
    const commandConfig = getCommandConfig();
    const command = commandConfig.commands.find(
      (cmd) => cmd.name === commandName,
    );

    if (!command) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy lệnh "${commandName}" để thêm alias`,
        },
        false,
        300000,
      );
      return;
    }

    if (!command.alias) {
      command.alias = [];
    }

    if (command.alias.includes(aliasName)) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Alias "${aliasName}" đã tồn tại cho lệnh "${commandName}"`,
        },
        false,
        300000,
      );
      return;
    }

    const isAliasExist = commandConfig.commands.some(
      (cmd) =>
        cmd.name === aliasName || (cmd.alias && cmd.alias.includes(aliasName)),
    );

    if (isAliasExist) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không thể thêm alias "${aliasName}" vì đã tồn tại như một lệnh hoặc alias khác`,
        },
        false,
        300000,
      );
      return;
    }

    command.alias.push(aliasName);
    writeCommandConfig(commandConfig);

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Đã thêm alias "${aliasName}" cho lệnh "${commandName}"`,
      },
      false,
      300000,
    );
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi thêm alias: ${error.message}`,
      },
      false,
      300000,
    );
  }
}

/**
 * Xử lý xóa alias của command
 */
export async function handleRemoveAlias(api, message, commandName, aliasName) {
  try {
    const commandConfig = getCommandConfig();
    const command = commandConfig.commands.find(
      (cmd) => cmd.name === commandName,
    );

    if (!command) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy lệnh "${commandName}" để xóa alias`,
        },
        false,
        300000,
      );
      return;
    }

    if (!command.alias || !command.alias.includes(aliasName)) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy alias "${aliasName}" trong lệnh "${commandName}"`,
        },
        false,
        300000,
      );
      return;
    }

    command.alias = command.alias.filter((a) => a !== aliasName);
    writeCommandConfig(commandConfig);

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Đã xóa alias "${aliasName}" khỏi lệnh "${commandName}"`,
      },
      false,
      300000,
    );
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi xóa alias: ${error.message}`,
      },
      false,
      300000,
    );
  }
}

/**
 * Xử lý hiển thị danh sách alias của command
 */
export async function handleListAlias(api, message, commandName) {
  try {
    const commandConfig = getCommandConfig();

    if (commandName) {
      const command = commandConfig.commands.find(
        (cmd) => cmd.name === commandName,
      );

      if (!command) {
        await sendMessageFromSQL(
          api,
          message,
          {
            success: false,
            message: `Không tìm thấy lệnh "${commandName}"`,
          },
          false,
          300000,
        );
        return;
      }

      const aliases = command.alias || [];
      await sendMessageFromSQL(
        api,
        message,
        {
          success: true,
          message:
            aliases.length > 0
              ? `Danh sách alias của lệnh "${commandName}":\n${aliases.join(", ")}`
              : `Lệnh "${commandName}" Không có alias nào`,
        },
        false,
        300000,
      );
    } else {
      const aliasInfo = commandConfig.commands
        .filter((cmd) => cmd.alias && cmd.alias.length > 0)
        .map((cmd) => `${cmd.name}: ${cmd.alias.join(", ")}`)
        .join("\n");

      await sendMessageFromSQL(
        api,
        message,
        {
          success: true,
          message:
            aliasInfo.length > 0
              ? `Danh sách alias của các lệnh:\n${aliasInfo}`
              : "Không có alias nào được cấu hình",
        },
        false,
        300000,
      );
    }
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi hiển thị alias: ${error.message}`,
      },
      false,
      300000,
    );
  }
}

export async function handleSendMessagePrivate(api, message) {
  const content = removeMention(message);
  const mentions = message.data.mentions;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const prefix = getGlobalPrefix();

  const parts = content.split("_");

  if (parts.length < 2) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          `Cú pháp Không đúng. Vui lòng sử dụng:\n` +
          `${prefix}sendp_[Nội dung tin nhắn]_[Số lần] @user\n` +
          `hoặc: ${prefix}sendp_[Nội dung tin nhắn]_[Số lần]_[ID người nhận]`,
      },
      false,
      30000,
    );
    return;
  }

  try {
    let smsContent = parts[1].trim();

    if (smsContent.length === 0) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không có nội dung tin nhắn!`,
        },
        false,
        30000,
      );
      return;
    }

    let repeatCount = 1;
    let userIds = [];

    if (parts.length >= 3) {
      const count = parseInt(parts[2]);
      if (!isNaN(count)) {
        repeatCount = count;
      }
    }

    if (!isAdmin(senderId) && repeatCount > 999) {
      repeatCount = 999;
    }

    if (mentions && Object.keys(mentions).length > 0) {
      userIds = Object.values(mentions).map((mention) => mention.uid);
    } else if (parts.length >= 4) {
      const specificId = parts[3].trim();
      if (specificId) {
        userIds = [specificId];
      }
    } else {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy người nhận!`,
        },
        false,
        30000,
      );
      return;
    }

    const userInfo = await getUserInfoData(api, userIds[0]);

    const targetText =
      userIds.length === 1 && userIds[0] === senderId
        ? "bản thân"
        : userIds.length === 1
          ? `người dùng ${userInfo.name}`
          : `${userIds.length} người`;

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Đã bắt đầu send tin nhắn riêng "${smsContent}" ${repeatCount} lần cho ${targetText}`,
      },
      false,
      30000,
    );

    for (const userId of userIds) {
      for (let i = 0; i < repeatCount; i++) {
        try {
          await api.sendMessage(smsContent, userId);
        } catch (error) {
          console.error(`Lỗi khi gửi tin nhắn riêng cho ${userId}:`, error);
          continue;
        }
      }
    }

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Đã hoàn thành gửi tin nhắn riêng cho ${targetText}`,
      },
      false,
      30000,
    );
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi gửi tin nhắn riêng: ${error.message}`,
      },
      false,
      30000,
    );
  }
}

export async function handleSendTaskCommand(api, message, groupSettings) {
  const content = removeMention(message);
  const status = content.split(" ")[1]?.toLowerCase();
  const threadId = message.threadId;

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  let newStatus;
  if (status === "on") {
    groupSettings[threadId].sendTask = true;
    newStatus = "bật";
  } else if (status === "off") {
    groupSettings[threadId].sendTask = false;
    newStatus = "tắt";
  } else {
    groupSettings[threadId].sendTask = !groupSettings[threadId].sendTask;
    newStatus = groupSettings[threadId].sendTask ? "bật" : "tắt";
  }

  const caption = `Đã ${newStatus} chức năng gửi nội dung tự động sau mỗi giờ vào nhóm này!`;
  await sendMessageStateQuote(
    api,
    message,
    caption,
    groupSettings[threadId].sendTask,
    300000,
  );

  return true;
}

export async function handleGetLinkInQuote(api, message) {
  const quote = message.data.quote;
  if (!quote || !quote.attach) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Không tìm thấy link trong tin nhắn được reply!`,
      },
      false,
      30000,
    );
    return;
  }

  try {
    const attachData = JSON.parse(quote.attach);

    if (!attachData.href) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Không tìm thấy link trong tin nhắn được reply!`,
        },
        false,
        30000,
      );
      return;
    }

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Link: ${attachData.href}`,
      },
      false,
      86400000,
    );
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi khi xử lý link: ${error.message}`,
      },
      false,
      30000,
    );
  }
}

export async function handleSetAvatarFromReply(api, message, groupInfo) {
  const groupId = groupInfo.groupId;
  if (!groupId) {
    await sendMessageStateQuote(
      api,
      message,
      "Lỗi: Không tìm thấy groupId.",
      false,
      30000,
    );
    return;
  }

  const quote = message.data?.quote;
  if (!quote || !quote.attach) {
    await sendMessageStateQuote(
      api,
      message,
      "Vui lòng reply vào một tin nhắn có ảnh để đặt làm ảnh đại diện!",
      false,
      30000,
    );
    return;
  }

  const attachData = JSON.parse(quote.attach);
  const imageUrl = attachData.params
    ? JSON.parse(attachData.params)?.hd || attachData.href
    : attachData.href;
  if (!imageUrl) {
    await sendMessageStateQuote(
      api,
      message,
      "Không tìm thấy URL ảnh hợp lệ trong tin nhắn được reply!",
      false,
      30000,
    );
    return;
  }

  const tempDir = path.resolve(__dirname, "cache");
  await fs.mkdir(tempDir, { recursive: true });

  const avatarPath = path.resolve(
    tempDir,
    `avatar_${groupId}_${Date.now()}.jpg`,
  );

  try {
    await downloadFile(imageUrl, avatarPath);
    await api.changeGroupAvatar(groupId, avatarPath);
    await sendMessageStateQuote(
      api,
      message,
      "Ảnh đại diện của group đã được thay đổi thành công!",
      true,
      30000,
    );
  } catch (error) {
    await sendMessageStateQuote(
      api,
      message,
      `Lỗi khi đổi ảnh đại diện nhóm: ${error.message}`,
      false,
      30000,
    );
  } finally {
    if (await fileExists(avatarPath)) await fs.unlink(avatarPath);
  }
}

export async function handleUploadReply(api, message, aliasCommand) {
  const quote = message.data?.quote;

  if (!quote || !quote.attach) {
    await sendMessageStateQuote(
      api,
      message,
      "Sếp Reply vào cái Video đó đi !",
      false,
      30000,
    );
    return;
  }

  const prefixCommand = getGlobalPrefix();
  let content = removeMention(message);
  if (aliasCommand) {
    content = content.replace(`${prefixCommand}${aliasCommand}`, "").trim();
  }

  const mentionRegex = /^@\w+\s+/;
  const contentWithoutMention = content.replace(mentionRegex, "").trim();
  const parts = contentWithoutMention.split(/\s+/);
  const param = parts.length >= 1 ? parts[parts.length - 1] : null;

  const fileName = param ? `${param}.txt` : "default.txt";
  const filePath = path.join(baseDataPath, fileName);

  try {
    const attachData = JSON.parse(quote.attach);
    const fileUrl =
      attachData.hdUrl ||
      attachData.href ||
      attachData.oriUrl ||
      attachData.normalUrl ||
      attachData.thumbUrl;

    if (!fileUrl) {
      await sendMessageStateQuote(
        api,
        message,
        "Không tìm thấy URL hợp lệ",
        false,
        30000,
      );
      return;
    }

    // Upload lên Catbox
    const payload = {
      reqtype: "urlupload",
      url: fileUrl,
    };

    let response;
    try {
      response = await axios.post(
        "https://catbox.moe/user/api.php",
        qs.stringify(payload),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 15000,
        },
      );
    } catch (error) {
      console.error("Lỗi khi gọi API upload:", error.message);
      await sendMessageStateQuote(
        api,
        message,
        `Upload thất bại do lỗi kết nối: ${error.message}`,
        false,
        30000,
      );
      return;
    }

    const resultUrl = response.data?.trim();
    if (!resultUrl || !resultUrl.startsWith("https://files.catbox.moe/")) {
      await sendMessageStateQuote(
        api,
        message,
        `Upload thất bại.`,
        false,
        30000,
      );
      return;
    }

    try {
      await fs.mkdir(baseDataPath, { recursive: true });
      await fs.appendFile(filePath, `${resultUrl}\n`, "utf8");
    } catch (error) {
      console.error("Lỗi khi ghi vào file:", error.message);
      await sendMessageStateQuote(
        api,
        message,
        `Đã xảy ra lỗi khi lưu link vào tệp ${fileName}.`,
        false,
        30000,
      );
      return;
    }

    await sendMessageStateQuote(
      api,
      message,
      `Xong rồi sếp ơi em lưu vào: ${fileName}`,
      true,
      30000,
    );
  } catch (error) {
    console.error("Lỗi khi xử lý upload:", error.message);
    await sendMessageStateQuote(
      api,
      message,
      `Đã xảy ra lỗi khi xử lý: ${error.message}`,
      false,
      30000,
    );
  }
}

export async function handle4KImage(api, message) {
  const threadId = message.threadId;
  const quote = message.data?.quote;
  const senderName = message.data?.dName || "Người dùng";
  const senderId = message.data?.uidFrom;

  if (!quote || !quote.attach) {
    console.log(
      `[WARN] Không tìm thấy quote hoặc attachment trong tin nhắn, threadId=${threadId}`,
    );
    await sendMessageStateQuote(
      api,
      message,
      "Vui lòng reply vào một tin nhắn chứa ảnh để đặt làm nét!",
      false,
      30000,
    );
    return;
  }

  try {
    const attachData = JSON.parse(quote.attach);
    const fileUrl =
      attachData.hdUrl ||
      attachData.href ||
      attachData.oriUrl ||
      attachData.normalUrl ||
      attachData.thumbUrl;

    if (!fileUrl) {
      throw new Error("Không tìm thấy URL hợp lệ từ ảnh được reply!");
    }

    const enhanceApiUrl = `https://hoangdev.io.vn/media/lamnet?input_url=${encodeURIComponent(fileUrl)}&apikey=1nX8L6HzUfd3hSWeic60eGJ30IOzkuEY`;

    const response = await axios.get(enhanceApiUrl);
    const result = response.data;

    // Kiểm tra success và url
    if (!result.success) {
      throw new Error(result.message || "API trả về thất bại, không rõ lý do.");
    }
    if (
      !result.url ||
      typeof result.url !== "string" ||
      result.url.trim() === ""
    ) {
      throw new Error(
        `URL trả về từ API không hợp lệ: ${JSON.stringify(result.url)}`,
      );
    }

    const enhancedImageUrl = result.url;

    const tempDir = path.resolve(__dirname, "cache");
    await fs.mkdir(tempDir, { recursive: true });
    const enhancedImagePath = path.resolve(
      tempDir,
      `enhanced_image_${Date.now()}.png`,
    );

    await downloadFile(enhancedImageUrl, enhancedImagePath);

    await api.sendMessage(
      {
        msg: `@${senderName}\nẢnh 4K của Anh đây`,
        mentions: [{ uid: senderId, pos: 0, len: senderName.length + 1 }],
        attachments: [enhancedImagePath],
        ttl: 5000000,
      },
      threadId,
      message.type,
    );

    if (await fileExists(enhancedImagePath)) {
      await fs.unlink(enhancedImagePath);
    }
  } catch (error) {
    console.error(
      `[ERROR] Lỗi khi xử lý làm nét ảnh: ${error.message}, threadId=${threadId}, senderId=${senderId}`,
    );
    await sendMessageStateQuote(
      api,
      message,
      `Không làm nét được ảnh, lỗi: ${error.message}`,
      false,
      30000,
    );
  }
}

export async function spamMessagesInGroup(api, message, aliasCommand) {
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const content = removeMention(message)
    .replace(`${prefix}${aliasCommand}`, "")
    .trim();
  const lowerContent = content.toLowerCase();
  const cacheFilePath = path.resolve(__dirname, "cache", "spam.txt");

  try {
    if (lowerContent.startsWith("start")) {
      const delayArg = content.slice(5).trim();
      let delayTime = 300;
      if (delayArg) {
        const match = delayArg.match(/^(\d+)(ms|s)$/);
        if (match) {
          const value = parseInt(match[1]);
          if (match[2] === "ms") {
            delayTime = value;
          } else if (match[2] === "s") {
            delayTime = value * 1000;
          }
        }
      }
      const spamContent = await fs.readFile(cacheFilePath, "utf8");
      if (stop) {
        stop = false;
        return;
      }
      stop = true;
      while (stop) {
        const response = await api.sendMessage(
          { msg: spamContent, ttl: 20 },
          threadId,
          message.type,
        );
        console.log("Gửi spam:", response);
        await delay(delayTime);
      }
      return;
    }
    if (lowerContent === "view") {
      try {
        const currentContent = await fs.readFile(cacheFilePath, "utf8");
        const preview = currentContent || "(File rỗng)";
        const response = await api.sendMessage(
          { msg: `Nội dung spam hiện tại:\n\n${preview}`, ttl: 100000 },
          threadId,
          message.type,
        );
      } catch (e) {
        const response = await api.sendMessage(
          { msg: "Không thể đọc file spam.", ttl: 100000 },
          threadId,
          message.type,
        );
      }
      return;
    }
    if (lowerContent.startsWith("add")) {
      const newLine = content.slice(4).trim();
      await fs.appendFile(cacheFilePath, `\n${newLine}`);
      const response = await api.sendMessage(
        { msg: "Đã thêm nội dung spam!", ttl: 100000 },
        threadId,
        message.type,
      );
      return;
    }
    if (lowerContent.startsWith("set")) {
      const newContent = content.slice(4).trim();
      await fs.writeFile(cacheFilePath, newContent);
      const response = await api.sendMessage(
        { msg: "Đã cập nhật nội dung spam!", ttl: 100000 },
        threadId,
        message.type,
      );
      return;
    }
    if (!content) {
      await api.sendMessage(
        {
          msg: `Lệnh không hợp lệ. Bạn có thể dùng:\n- ${prefix}${aliasCommand} view\n- ${prefix}${aliasCommand} set: nội dung\n- ${prefix}${aliasCommand} add: nội dung\n- ${prefix}${aliasCommand} start <delay: ms hoặc s>`,
          ttl: 100000,
        },
        threadId,
        message.type,
      );
      return;
    }
  } catch (error) {
    console.error("Lỗi khi xử lý spam:", error.message);
    if (error.code === "ENOENT") {
      const response = await api.sendMessage(
        { msg: "Không tìm thấy tệp cấu hình nội dung spam!" },
        threadId,
        message.type,
      );
      console.log("Lỗi ENOENT:", response);
    } else {
      const response = await api.sendMessage(
        { msg: `Lỗi: ${error.message}` },
        threadId,
        message.type,
      );
      console.log("Lỗi khác:", response);
    }
  }
}

const sentNumbers = {};
const queue = {};

export async function handleBlockedMembers(api, message) {
  const threadId = message.threadId;
  const senderName = message.data?.dName || "Người dùng";
  const senderId = message.data?.uidFrom;
  try {
    const response = await api.getBlockedGroupMembers(threadId);

    console.log(
      "[ZALO DEBUG] getBlockedGroupMembers response:",
      JSON.stringify(response, null, 2),
    );

    const blockedMembers = response?.blocked_members || [];
    // 👉 Log thêm số lượng người bị chặn
    console.log(`[ZALO DEBUG] Tổng số người bị chặn: ${blockedMembers.length}`);
    if (blockedMembers.length === 0) {
      await api.sendMessage(
        {
          msg: `@${senderName}\nKhông có thành viên nào bị chặn trong nhóm này.`,
          mentions: [{ uid: senderId, pos: 0, len: senderName.length + 1 }],
          ttl: 1000000,
        },
        threadId,
        message.type,
      );
      return;
    }

    let responseMsg = `@${senderName}\nDanh sách thành viên bị chặn:\n`;
    blockedMembers.forEach((member, index) => {
      responseMsg += `${index + 1}. ${member.dName}\n`;
    });

    await api.sendMessage(
      {
        msg: responseMsg,
        mentions: [{ uid: senderId, pos: 0, len: senderName.length + 1 }],
        ttl: 1000000,
      },
      threadId,
      message.type,
    );
  } catch (error) {
    console.error("Lỗi khi lấy danh sách thành viên bị chặn:", error.message);
    await api.sendMessage(
      {
        msg: `@${senderName}\nEm có key đâu mà lấy được danh sách mấy khứa bị block trong nhóm này đâu\nHong thì ném em cái KEY :d`,
        mentions: [{ uid: senderId, pos: 0, len: senderName.length + 1 }],
        ttl: 1000000,
      },
      threadId,
      message.type,
    );
  }
}

export async function handleSendFriendRequest(
  api,
  message,
  customMessage = "Chào Bạn, Tớ Là Bot của Nqduan ạ...",
) {
  try {
    const senderName = message.data?.dName || "Người dùng";
    const senderId = message.data?.uidFrom;
    let mentions = message.data?.mentions || [];

    if (mentions.length === 0 && message.data?.reply) {
      mentions.push({
        uid: message.data.reply.uid,
        dName: message.data.reply.dName || "Người dùng",
      });
    }

    if (mentions.length === 0) {
      await api.sendMessage(
        {
          msg: `(@${senderName}) Dùng kb @mention để gửi lời mời kết bạn!`,
          mentions: [{ uid: senderId, pos: 0, len: senderName.length + 3 }],
          ttl: 360000,
        },
        message.threadId,
        message.type,
      );
      return;
    }
    const successfulMentions = [];
    await Promise.all(
      mentions.map(async (mention) => {
        try {
          await api.sendFriendRequest(mention.uid, customMessage, "vi");
          successfulMentions.push({
            uid: mention.uid,
            dName: mention.dName || "Người dùng",
          });
        } catch {}
      }),
    );
    if (successfulMentions.length === 0) {
      await api.sendMessage(
        {
          msg: `(@${senderName}) ❌ Không thể gửi lời mời kết bạn đến bất kỳ ai.`,
          mentions: [{ uid: senderId, pos: 0, len: senderName.length + 3 }],
          ttl: 360000,
        },
        message.threadId,
        message.type,
      );
      return;
    }
    let mentionText = `(@${senderName}), \n📩 Đã gửi lời mời kết bạn đến: `;
    let mentionPos = mentionText.length;
    const mentionData = [{ uid: senderId, pos: 0, len: senderName.length + 3 }];

    successfulMentions.forEach((mention) => {
      const displayName = mention.dName || "Người dùng";
      mentionText += `(@${displayName}) \n✅✅`;
      mentionData.push({
        uid: mention.uid,
        pos: mentionPos,
        len: displayName.length + 3,
      });
      mentionPos += displayName.length + 4;
    });
    await api.sendMessage(
      {
        msg: mentionText.trim(),
        mentions: mentionData,
        ttl: 360000,
      },
      message.threadId,
      message.type,
    );
  } catch (error) {
    console.error("❌ Lỗi khi gửi kết bạn:", error);
    throw error;
  }
}

export async function handleRemoveFriend(api, message) {
  try {
    const senderName = message.data?.dName || "Người dùng";
    const senderId = message.data?.uidFrom;
    let mentions = message.data?.mentions || [];

    // Hỗ trợ reply nếu không mention
    if (mentions.length === 0 && message.data?.reply) {
      mentions.push({
        uid: message.data.reply.uid,
        dName: message.data.reply.dName || "Người dùng",
      });
    }

    if (mentions.length === 0) {
      await api.sendMessage(
        {
          msg: `(@${senderName}) Vui lòng @mention hoặc reply người bạn muốn hủy kết bạn!`,
          mentions: [{ uid: senderId, pos: 0, len: senderName.length + 3 }],
          ttl: 360000,
        },
        message.threadId,
        message.type,
      );
      return;
    }

    const successfulRemovals = [];
    await Promise.all(
      mentions.map(async (mention) => {
        try {
          // Gọi API hủy kết bạn (ĐÃ GỠ BỎ THAM SỐ NGÔN NGỮ "vi")
          await api.removeFriend(mention.uid);
          successfulRemovals.push({
            uid: mention.uid,
            dName: mention.dName || "Người dùng",
          });
        } catch (e) {
          console.error(`Lỗi khi hủy kết bạn với ${mention.uid}:`, e.message);
        }
      }),
    );

    if (successfulRemovals.length === 0) {
      await api.sendMessage(
        {
          msg: `(@${senderName}) ❌ Không thể hủy kết bạn với bất kỳ ai. (Có thể do không phải là bạn bè từ trước).`,
          mentions: [{ uid: senderId, pos: 0, len: senderName.length + 3 }],
          ttl: 360000,
        },
        message.threadId,
        message.type,
      );
      return;
    }

    let mentionText = `(@${senderName}), \n🗑️ Đã hủy kết bạn với: `;
    let mentionPos = mentionText.length;
    const mentionData = [{ uid: senderId, pos: 0, len: senderName.length + 3 }];

    successfulRemovals.forEach((mention) => {
      const displayName = mention.dName || "Người dùng";
      mentionText += `(@${displayName}) \n✅✅`;
      mentionData.push({
        uid: mention.uid,
        pos: mentionPos,
        len: displayName.length + 3,
      });
      mentionPos += displayName.length + 4;
    });

    await api.sendMessage(
      {
        msg: mentionText.trim(),
        mentions: mentionData,
        ttl: 360000,
      },
      message.threadId,
      message.type,
    );
  } catch (error) {
    console.error("❌ Lỗi khi hủy kết bạn:", error);
    await sendMessageFailed(api, message, `Lỗi: ${error.message}`);
  }
}

// =================================================================
// --- HÀM MỚI: ĐỔI AVATAR TÀI KHOẢN ZALO (SET AVATAR ACCOUNT) ---
// =================================================================
/**
 * Xử lý lệnh đổi ảnh đại diện tài khoản Zalo của Bot (!setavatar)
 * Yêu cầu reply vào một tin nhắn có chứa ảnh.
 */
export async function handleSetAvatarAccount(api, message, aliasCommand) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const prefix = getGlobalPrefix();
  let tempAvatarPath = null;

  // 1. Kiểm tra quyền hạn (Chỉ Admin cấp cao mới được đổi Avatar bot)
  if (!isAdmin(senderId)) {
    await sendMessageStateQuote(
      api,
      message,
      "Chỉ Admin cấp cao mới có quyền đổi Avatar Tài khoản Zalo của Bot!",
      false,
      30000,
    );
    return false;
  }

  // 2. Lấy URL ảnh từ tin nhắn reply
  const avatarUrl = getReplyMediaUrl(message); // Đảm bảo hàm này được import/định nghĩa đúng

  if (!avatarUrl) {
    await sendMessageStateQuote(
      api,
      message,
      `❌ Vui lòng reply vào một tin nhắn có chứa ảnh để đặt làm Avatar Tài khoản Zalo.\n\nCú pháp: ${prefix}${aliasCommand}`,
      false,
      30000,
    );
    return false;
  }

  // 3. Tải ảnh về
  try {
    await sendMessageStateQuote(
      api,
      message,
      "Đang tải ảnh và chuẩn bị đổi Avatar Tài khoản...",
      true,
      30000,
    );

    // Tải file về thư mục tạm.
    // Cần đảm bảo hàm downloadFile và tempDir đã được định nghĩa và import đúng cách.
    const fileName = `new_avatar_${Date.now()}.jpg`;
    // Giả định tempDir đã được định nghĩa ở đầu file hoặc import
    // Ví dụ: const tempDir = path.resolve(__dirname, 'cache');
    const cacheDir = path.resolve(__dirname, "cache"); // Đảm bảo cacheDir đúng
    await fs.mkdir(cacheDir, { recursive: true });
    tempAvatarPath = path.join(cacheDir, fileName);

    await downloadFile(avatarUrl, tempAvatarPath); // Đảm bảo hàm downloadFile hoạt động

    // 4. Gọi API đổi Avatar Tài khoản
    // TRUYỀN THẲNG ĐƯỜNG DẪN CỤC BỘ (STRING) VÀO API
    // Cần đảm bảo api.changeAccountAvatar đã được định nghĩa từ changeAccountAvatarFactory
    await api.changeAccountAvatar(tempAvatarPath);

    // 5. Gửi thông báo thành công
    await sendMessageStateQuote(
      api,
      message,
      "✅ Đã đổi Avatar Tài khoản Zalo thành công!",
      true,
      300000,
    );
  } catch (error) {
    console.error("❌ Lỗi khi đổi Avatar Tài khoản:", error);
    // Kiểm tra xem lỗi có phải do đường dẫn bị coi là Object không (mặc dù đã sửa ở API)
    if (
      error.code === "ERR_INVALID_ARG_TYPE" &&
      error.message.includes("Object")
    ) {
      await sendMessageStateQuote(
        api,
        message,
        `❌ Lỗi hệ thống: Đường dẫn file không hợp lệ khi gọi API. Vui lòng kiểm tra lại hàm changeAccountAvatar và getImageMetaData. (Lỗi: ${error.message})`,
        false,
        30000,
      );
    } else {
      await sendMessageStateQuote(
        api,
        message,
        `❌ Đã xảy ra lỗi khi đổi Avatar Tài khoản Zalo: ${error.message}`,
        false,
        30000,
      );
    }
  } finally {
    // 6. Xóa file tạm
    // Cần đảm bảo hàm fileExists và fs.unlink hoạt động
    if (tempAvatarPath && (await fileExists(tempAvatarPath))) {
      try {
        await fs.unlink(tempAvatarPath);
      } catch (err) {
        console.warn(`Không thể xóa file tạm: ${tempAvatarPath}`, err);
      }
    }
  }
  return true;
}

// =================================================================
// --- HÀM MỚI: TẮT/BẬT THÔNG BÁO NHÓM (SET MUTE) ---
// =================================================================

/**
 * Xử lý lệnh Tắt/Bật thông báo nhóm chỉ với ON/OFF
 */
export async function handleSetMuteCommand(api, message, aliasCommand) {
  const threadId = message.threadId;
  const content = removeMention(message)
    .replace(getGlobalPrefix() + aliasCommand, "")
    .trim()
    .toLowerCase();
  const senderId = message.data.uidFrom;
  const prefix = getGlobalPrefix();

  // Kiểm tra quyền hạn (Admin hoặc Admin cấp cao)
  if (!isAdmin(senderId, threadId)) {
    await sendMessageStateQuote(
      api,
      message,
      "Bạn không có quyền sử dụng lệnh này!",
      false,
      30000,
    );
    return false;
  }

  let action, messageText;

  // Xử lý tham số
  if (content === "on") {
    // Mute: action = 1, duration = -1 (vĩnh viễn)
    action = 1;
    messageText = "Đã tắt thông báo (Mute) vĩnh viễn cho cuộc trò chuyện này!";
  } else if (content === "off") {
    // Unmute: action = 3
    action = 3;
    messageText = "Đã bật lại thông báo (Unmute) cho cuộc trò chuyện này!";
  } else {
    // Hướng dẫn cú pháp nếu không hợp lệ
    await sendMessageStateQuote(
      api,
      message,
      `Cú pháp Không hợp lệ. Vui lòng sử dụng:\n` +
        `▶️ ${prefix}${aliasCommand} on để tắt thông báo.\n` +
        `▶️ ${prefix}${aliasCommand} off để bật lại thông báo.`,
      false,
      30000,
    );
    return false;
  }

  try {
    // Gọi API setMute
    // threadID, duration = -1, action = 1 (mute) hoặc 3 (unmute), type = 2 (Group)
    await api.setMute(threadId, -1, action, 2);

    // Gửi thông báo thành công
    await sendMessageStateQuote(api, message, messageText, true, 300000);
  } catch (error) {
    console.error(`Lỗi khi thực hiện setMute (${action}):`, error.message);

    // Xử lý lỗi API
    let errorMsg = "Đã xảy ra lỗi khi thực hiện lệnh.";
    if (error.message.includes("Missing required app context fields")) {
      errorMsg =
        "Lỗi hệ thống: Bot thiếu thông tin cấu hình (secretKey, imei...).";
    } else if (error.message.includes("216")) {
      // Mã 216 thường là thành công, nhưng nếu API wrapper vẫn throw lỗi
      await sendMessageStateQuote(api, message, messageText, true, 300000);
      return true;
    }

    await sendMessageStateQuote(api, message, errorMsg, false, 30000);
  }
  return true;
}

export async function spamCallInGroup(api, message, aliasCommand) {
  try {
    const senderName = message.data?.dName || "Người dùng";
    const senderId = message.data?.uidFrom;
    let mentions = message.data?.mentions || [];

    // Hỗ trợ reply nếu không mention
    if (mentions.length === 0 && message.data?.reply) {
      mentions.push({
        uid: message.data.reply.uid,
        dName: message.data.reply.dName || "Người dùng",
      });
    }

    const prefix = getGlobalPrefix();
    const rawContent = removeMention(message) || "";
    const content = rawContent.replace(`${prefix}${aliasCommand}`, "").trim();
    const args = content.split(" ");

    let targetUid, targetName, count;

    if (mentions.length > 0) {
      // ===== PATH 1: DÙNG MENTION (HOẶC REPLY) =====
      targetUid = String(mentions[0].uid);
      targetName = mentions[0].dName || "Người dùng";
      count = parseInt(args[0]);

      if (isNaN(count) || count <= 0) {
        await sendMessageFailed(
          api,
          message,
          `Cú pháp sai. Ví dụ: ${prefix}${aliasCommand} @user 5`,
        );
        return;
      }
    } else {
      // ===== PATH 2: DÙNG UID (NẾU KHÔNG CÓ MENTION) =====
      const potentialUid = args[0];
      const potentialCount = parseInt(args[1]);

      if (!potentialUid || isNaN(potentialCount) || potentialCount <= 0) {
        await sendMessageFailed(
          api,
          message,
          `Cú pháp sai. Vui lòng mention, reply, hoặc dùng: ${prefix}${aliasCommand} [UID] [Số lần]`,
        );
        return;
      }

      targetUid = String(potentialUid);
      count = potentialCount;
      // Khi dùng UID, chúng ta không có tên đẹp, nên sẽ dùng tạm UID
      targetName = `User ${targetUid}`;
    }

    // Hàm sleep
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

    for (let i = 0; i < count; i++) {
      try {
        await api.sendCallVoice(targetUid);
        console.log(`📞 Nhá máy máy ${i + 1}/${count} đến ${targetUid}`);
        if (i < count - 1) await sleep(3000);
      } catch (err) {
        console.error(`❌ Lỗi khi gọi lần ${i + 1}:`, err.message || err);
        break;
      }
    }

    // Điều chỉnh tin nhắn và danh sách mention
    const isMention = mentions.length > 0;
    const targetDisplayName = isMention ? `@${targetName}` : targetName;
    const msg = `@${senderName} Đã dùng bí thuật ${count} lần đến ${targetDisplayName}`;

    const mentionList = [{ uid: senderId, pos: 0, len: senderName.length + 1 }];

    // Chỉ thêm mục tiêu vào mentionList nếu họ được tag (để API tag tên)
    if (isMention) {
      mentionList.push({
        uid: targetUid,
        pos: msg.indexOf(targetDisplayName),
        len: targetName.length + 1,
      });
    }

    await api.sendMessage(
      {
        msg,
        mentions: mentionList,
        ttl: 30000,
      },
      message.threadId,
      message.type,
    );
  } catch (err) {
    console.error("❌ Lỗi spam call:", err);
    await sendMessageFailed(api, message, `Lỗi: ${err.message}`);
  }
}

export async function handleAcceptFriendRequest(api, message) {
  try {
    const senderName = message.data?.dName || "Người dùng";
    const senderId = message.data?.uidFrom;
    let mentions = message.data?.mentions || [];

    // Hỗ trợ reply nếu không mention (giống handleRemoveFriend)
    if (mentions.length === 0 && message.data?.reply) {
      mentions.push({
        uid: message.data.reply.uid,
        dName: message.data.reply.dName || "Người dùng",
      });
    }

    if (mentions.length === 0) {
      await api.sendMessage(
        {
          msg: `(@${senderName}) Vui lòng @mention hoặc reply người bạn muốn chấp nhận kết bạn!`,
          mentions: [{ uid: senderId, pos: 0, len: senderName.length + 3 }],
          ttl: 360000,
        },
        message.threadId,
        message.type,
      );
      return;
    }

    const successfulAccepts = [];
    await Promise.all(
      mentions.map(async (mention) => {
        try {
          // Gọi API chấp nhận kết bạn (từ file 44)
          await api.acceptFriendRequest(mention.uid);
          successfulAccepts.push({
            uid: mention.uid,
            dName: mention.dName || "Người dùng",
          });
        } catch (e) {
          console.error(
            `Lỗi khi chấp nhận kết bạn với ${mention.uid}:`,
            e.message,
          );
        }
      }),
    );

    if (successfulAccepts.length === 0) {
      await api.sendMessage(
        {
          msg: `(@${senderName}) ❌ Không thể chấp nhận kết bạn với bất kỳ ai. (Có thể do họ chưa gửi lời mời).`,
          mentions: [{ uid: senderId, pos: 0, len: senderName.length + 3 }],
          ttl: 360000,
        },
        message.threadId,
        message.type,
      );
      return;
    }

    // Gửi thông báo thành công (giống handleRemoveFriend)
    let mentionText = `(@${senderName}), \n🤝 Đã chấp nhận kết bạn với: `;
    let mentionPos = mentionText.length;
    const mentionData = [{ uid: senderId, pos: 0, len: senderName.length + 3 }];

    successfulAccepts.forEach((mention) => {
      const displayName = mention.dName || "Người dùng";
      mentionText += `(@${displayName}) \n✅✅`;
      mentionData.push({
        uid: mention.uid,
        pos: mentionPos,
        len: displayName.length + 3,
      });
      mentionPos += displayName.length + 4;
    });

    await api.sendMessage(
      {
        msg: mentionText.trim(),
        mentions: mentionData,
        ttl: 360000,
      },
      message.threadId,
      message.type,
    );
  } catch (error) {
    console.error("❌ Lỗi khi chấp nhận kết bạn:", error);
    await sendMessageFailed(api, message, `Lỗi: ${error.message}`);
  }
}

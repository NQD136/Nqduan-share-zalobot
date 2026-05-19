import fs from "fs";
import path from "path";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { getContent } from "../../utils/format-util.js";
import {
  sendMessageComplete,
  sendMessageFailed,
  sendMessageQuery,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

// ================= FILE PATH =================
const defaultFile = path.resolve("mybot/defaultCommand.json");
const dataDir = path.resolve("mybot/json-data");

// ================= CORE FUNCTIONS =================

// Hàm thêm command vào file
function addCommandToFile(filePath, cmdObj) {
  try {
    let data;

    if (!fs.existsSync(filePath)) {
      data = { prefix: "!", commands: [] };
    } else {
      const rawData = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(rawData);
      if (!Array.isArray(data.commands)) data.commands = [];
    }

    if (data.commands.some((cmd) => cmd.name === cmdObj.name)) {
      return false;
    }

    data.commands.push(cmdObj);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error(`Lỗi khi thêm lệnh vào ${filePath}:`, err);
    return false;
  }
}

// Hàm xoá command khỏi file
function removeCommandFromFile(filePath, cmdName) {
  try {
    if (!fs.existsSync(filePath)) return false;

    const rawData = fs.readFileSync(filePath, "utf-8");
    let data = JSON.parse(rawData);
    if (!Array.isArray(data.commands)) return false;

    const initialLength = data.commands.length;
    data.commands = data.commands.filter((cmd) => cmd.name !== cmdName);

    if (data.commands.length !== initialLength) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Lỗi khi xoá lệnh trong ${filePath}:`, err);
    return false;
  }
}

// Map permission số → chữ
function mapPermission(value) {
  switch (value) {
    case "1":
      return "all";
    case "2":
      return "adminBox";
    case "3":
      return "adminBot";
    case "4":
      return "adminLevelHigh";
    default:
      return "all";
  }
}

// ================= ADD CMD =================
export async function handleAddCmdCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = getContent(message);

  // args: addcmd "name" "description" "syntax" "permission" "countdown" "type" "author" "active"
  const args = content
    .replace(`${prefix}${aliasCommand}`, "")
    .trim()
    .match(/"([^"]+)"/g);

  if (!args || args.length < 7) {
    await sendMessageQuery(
      api,
      message,
      `📌 Cách dùng:\n${prefix}${aliasCommand} "name" "description" "syntax" "permission" "countdown" "type" "author" "active"`,
    );
    return;
  }

  try {
    const [
      name,
      description,
      syntax,
      permissionRaw,
      countdown,
      type,
      author,
      activeRaw,
    ] = args.map((s) => s.replace(/(^")|("$)/g, ""));

    const permission = mapPermission(permissionRaw);
    const active = activeRaw !== undefined ? activeRaw === "true" : true;

    const cmdObj = {
      name,
      description,
      syntax,
      permission,
      countdown: parseInt(countdown, 10) || 3,
      type: parseInt(type, 10) || 1,
      author,
      active,
    };

    let added = false;

    if (addCommandToFile(defaultFile, cmdObj)) added = true;

    if (fs.existsSync(dataDir)) {
      const files = fs
        .readdirSync(dataDir)
        .filter((f) => f.startsWith("command-") && f.endsWith(".json"));
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        if (addCommandToFile(filePath, cmdObj)) added = true;
      }
    }

    if (added) {
      await sendMessageComplete(
        api,
        message,
        `✅ Đã thêm thành công lệnh \`${cmdObj.name}\` vào dữ liệu!`,
        false,
      );
    } else {
      await sendMessageComplete(
        api,
        message,
        `⚠️ Lệnh \`${cmdObj.name}\` đã tồn tại, không thêm mới.`,
        false,
      );
    }
  } catch (error) {
    console.error("Lỗi khi xử lý addcmd:", error);
    await sendMessageFailed(api, message, "❌ Lỗi khi thêm lệnh!", true);
  }
}

// ================= REMOVE CMD =================
export async function handleRemoveCmdCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = getContent(message);

  const args = content
    .replace(`${prefix}${aliasCommand}`, "")
    .trim()
    .match(/"([^"]+)"/g);
  const cmdName = args ? args[0].replace(/(^")|("$)/g, "") : null;

  if (!cmdName) {
    await sendMessageQuery(
      api,
      message,
      `📌 Cách dùng:\n${prefix}${aliasCommand} "name"`,
    );
    return;
  }

  try {
    let removed = false;

    if (removeCommandFromFile(defaultFile, cmdName)) removed = true;

    if (fs.existsSync(dataDir)) {
      const files = fs
        .readdirSync(dataDir)
        .filter((f) => f.startsWith("command-") && f.endsWith(".json"));
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        if (removeCommandFromFile(filePath, cmdName)) removed = true;
      }
    }

    if (removed) {
      await sendMessageComplete(
        api,
        message,
        `✅ Đã xoá thành công lệnh \`${cmdName}\` khỏi dữ liệu!`,
        false,
      );
    } else {
      await sendMessageComplete(
        api,
        message,
        `⚠️ Không tìm thấy lệnh \`${cmdName}\`.`,
        false,
      );
    }
  } catch (error) {
    console.error("Lỗi khi xử lý removecmd:", error);
    await sendMessageFailed(
      api,
      message,
      "❌ Có lỗi xảy ra khi xoá lệnh!",
      true,
    );
  }
}

// ================= CMD FIND =================
export async function handleCmdFindCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = getContent(message);

  const args = content
    .replace(`${prefix}${aliasCommand}`, "")
    .trim()
    .match(/"([^"]+)"/g);
  const cmdName = args ? args[0].replace(/(^")|("$)/g, "") : null;

  if (!cmdName) {
    await sendMessageQuery(
      api,
      message,
      `📌 Cách dùng:\n${prefix}${aliasCommand} "name"`,
    );
    return;
  }

  try {
    const filesToScan = [defaultFile];
    if (fs.existsSync(dataDir)) {
      const files = fs
        .readdirSync(dataDir)
        .filter((f) => f.startsWith("command-") && f.endsWith(".json"));
      filesToScan.push(...files.map((f) => path.join(dataDir, f)));
    }

    let foundCommands = [];
    let activeCount = 0;
    let inactiveFiles = [];

    for (const filePath of filesToScan) {
      if (!fs.existsSync(filePath)) continue;

      const rawData = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(rawData);

      if (Array.isArray(data.commands)) {
        const cmd = data.commands.find((c) => c.name === cmdName);
        if (cmd) {
          foundCommands.push({ file: path.basename(filePath), cmd });
          if (cmd.active) {
            activeCount++;
          } else {
            inactiveFiles.push(path.basename(filePath));
          }
        }
      }
    }

    if (foundCommands.length === 0) {
      await sendMessageComplete(
        api,
        message,
        `⚠️ Không tìm thấy lệnh \`${cmdName}\` trong dữ liệu.`,
        false,
      );
      return;
    }

    let msg = `🔍 Đã quét toàn bộ: ${filesToScan.length} file\n`;
    for (const { file, cmd } of foundCommands) {
      msg += `\n📂 File: ${file}\n`;
      msg += `Lệnh: "${cmd.name}"\n`;
      msg += `Mô tả: ${cmd.description}\n`;
      msg += `Syntax: ${cmd.syntax}\n`;
      msg += `Permission: ${cmd.permission}\n`;
      msg += `Countdown: ${cmd.countdown}\n`;
      msg += `Type: ${cmd.type}\n`;
      msg += `Author: ${cmd.author}\n`;
      msg += `Active: ${cmd.active}\n`;
    }

    if (inactiveFiles.length === 0) {
      msg += `\n✅ Trạng thái active: all`;
    } else {
      msg += `\nTrạng thái active: ${activeCount}`;
      msg += `\nTrạng thái noactive: ${inactiveFiles.length} [${inactiveFiles.join(", ")}]`;
    }

    await sendMessageComplete(api, message, msg, false);
  } catch (error) {
    console.error("Lỗi khi xử lý cmdfind:", error);
    await sendMessageFailed(
      api,
      message,
      "❌ Có lỗi xảy ra khi tìm lệnh!",
      true,
    );
  }
}

// ================= FIX CMD =================
export async function handleFixCmdCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = getContent(message);

  const nameMatch = content.match(/"([^"]+)"/);
  const cmdName = nameMatch ? nameMatch[1] : null;

  if (!cmdName) {
    await sendMessageQuery(
      api,
      message,
      `📌 Cách dùng:\n${prefix}${aliasCommand} "name" key: value ...`,
    );
    return;
  }

  const afterName = content
    .replace(`${prefix}${aliasCommand}`, "")
    .replace(`"${cmdName}"`, "")
    .trim();
  const updates = {};
  const regex = /(\w+)\s*:\s*([^"]\S*|"[^"]*")/g;
  let match;
  while ((match = regex.exec(afterName)) !== null) {
    const key = match[1].toLowerCase();
    let value = match[2].replace(/^"|"$/g, "");

    switch (key) {
      case "description":
      case "mota":
        updates.description = value;
        break;
      case "syntax":
        updates.syntax = value;
        break;
      case "permission":
        updates.permission = mapPermission(value);
        break;
      case "countdown":
        updates.countdown = parseInt(value, 10) || 3;
        break;
      case "type":
        updates.type = parseInt(value, 10) || 1;
        break;
      case "author":
        updates.author = value;
        break;
      case "active":
        updates.active = value === "true";
        break;
    }
  }

  if (Object.keys(updates).length === 0) {
    await sendMessageQuery(api, message, `⚠️ Không có trường nào để cập nhật.`);
    return;
  }

  try {
    const filesToScan = [defaultFile];
    if (fs.existsSync(dataDir)) {
      const files = fs
        .readdirSync(dataDir)
        .filter((f) => f.startsWith("command-") && f.endsWith(".json"));
      filesToScan.push(...files.map((f) => path.join(dataDir, f)));
    }

    let updatedCount = 0;
    for (const filePath of filesToScan) {
      if (!fs.existsSync(filePath)) continue;

      const rawData = fs.readFileSync(filePath, "utf-8");
      let data = JSON.parse(rawData);

      if (Array.isArray(data.commands)) {
        const cmd = data.commands.find((c) => c.name === cmdName);
        if (cmd) {
          Object.assign(cmd, updates);
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await sendMessageComplete(
        api,
        message,
        `✅ Đã cập nhật lệnh \`${cmdName}\` trong ${updatedCount} file.`,
        false,
      );
    } else {
      await sendMessageComplete(
        api,
        message,
        `⚠️ Không tìm thấy lệnh \`${cmdName}\`.`,
        false,
      );
    }
  } catch (error) {
    console.error("Lỗi khi xử lý fixcmd:", error);
    await sendMessageFailed(
      api,
      message,
      "❌ Có lỗi xảy ra khi sửa lệnh!",
      true,
    );
  }
}

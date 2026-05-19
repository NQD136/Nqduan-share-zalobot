import fs from "fs";
import path from "path";
import { getProjectRoot } from "../../utils/env.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import {
  sendMessageComplete,
  sendMessageWarning,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

/**
 * Cấu hình lệnh
 */
export const des = {
  name: "clean",
  type: 1,
  permission: "qtv", // Chỉ Quản Trị Viên Cấp Cao
  countdown: 60,
  active: true,
};

/**
 * Hàm điều phối chính
 */
export async function handleCleanCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}clean`)) {
    return false;
  }

  // File handler chính sẽ kiểm tra quyền "qtv" dựa trên `des.permission`

  await api.sendMessage(
    {
      msg: "⏳ Bắt đầu quá trình dọn dẹp rác hệ thống...",
      quote: message,
      ttl: 1000,
    },
    message.threadId,
  );

  try {
    // Gọi logic dọn dẹp
    const result = performCleanup();

    if (!result.success) {
      await sendMessageWarning(api, message, `LỖI: ${result.error}`);
      return true;
    }

    let report = `✅ Dọn dẹp hoàn tất!\n\n`;
    report += `📂 Đã xóa file: ${result.filesDeleted}\n`;
    report += `📁 Đã xóa thư mục: ${result.foldersDeleted}\n`;

    if (result.errors.length > 0) {
      report += `\n⚠️ Gặp ${result.errors.length} lỗi (vui lòng kiểm tra console log).`;
    }

    await sendMessageComplete(api, message, report);
  } catch (err) {
    console.error("[Cleaner] Lỗi không mong muốn khi dọn dẹp:", err);
    await sendMessageWarning(
      api,
      message,
      `Đã xảy ra lỗi nghiêm trọng: ${err.message}`,
    );
  }

  return true; // Đã xử lý lệnh
}

/**
 * Hàm logic dọn dẹp cốt lõi
 */
function performCleanup() {
  const projectRoot = getProjectRoot();

  // 1. Lấy danh sách bot "name" hợp lệ từ mybot/mybots.json
  const myBotsPath = path.join(projectRoot, "mybot", "mybots.json");
  let validBotNames;
  try {
    const myBotsData = JSON.parse(fs.readFileSync(myBotsPath, "utf8"));
    validBotNames = new Set(Object.keys(myBotsData));
  } catch (error) {
    console.error(
      `[Cleaner] Lỗi: Không thể đọc file mybots.json tại ${myBotsPath}`,
      error,
    );
    return {
      success: false,
      error: `Không thể đọc file mybots.json: ${error.message}`,
    };
  }

  if (validBotNames.size === 0) {
    return {
      success: false,
      error: `File mybots.json không có bot nào. Hủy dọn dẹp.`,
    };
  }

  console.log(
    `[Cleaner] Các bot hợp lệ được giữ lại: ${[...validBotNames].join(", ")}`,
  );

  // 2. Định nghĩa các thư mục cần quét
  const directoriesToScan = [
    { type: "file", path: path.join(projectRoot, "mybot", "bots") },
    { type: "file", path: path.join(projectRoot, "mybot", "configs") },
    { type: "file", path: path.join(projectRoot, "mybot", "credentials") },
    { type: "file", path: path.join(projectRoot, "mybot", "json-data") },
    { type: "file", path: path.join(projectRoot, "mybot", "settings") },
    { type: "folder", path: path.join(projectRoot, "logs") },
    { type: "folder", path: path.join(projectRoot, "assets", "temp") },
  ];

  let filesDeleted = 0;
  let foldersDeleted = 0;
  const errors = [];

  // 3. Quét và dọn dẹp
  for (const dir of directoriesToScan) {
    let items;
    try {
      items = fs.readdirSync(dir.path);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log(`[Cleaner] Bỏ qua, thư mục không tồn tại: ${dir.path}`);
      } else {
        console.error(
          `[Cleaner] Không thể đọc thư mục ${dir.path}: ${err.message}`,
        );
        errors.push(`Lỗi đọc ${dir.path}`);
      }
      continue;
    }

    for (const itemName of items) {
      const fullPath = path.join(dir.path, itemName);
      let stats;
      try {
        stats = fs.statSync(fullPath);
      } catch (statErr) {
        console.error(
          `[Cleaner] Không thể lấy thông tin (stat) của ${fullPath}: ${statErr.message}`,
        );
        errors.push(`Lỗi stat ${itemName}`);
        continue;
      }

      if (dir.type === "file" && stats.isFile()) {
        if (itemName.endsWith(".json")) {
          // --- THAY ĐỔI: THÊM NGOẠI LỆ ---
          // Kiểm tra xem có phải file admin.json trong thư mục mybot/bots không
          const isBotsDir = dir.path.endsWith(path.join("mybot", "bots"));
          if (isBotsDir && itemName === "admin.json") {
            console.log(`[Cleaner] Giữ lại file đặc biệt: ${fullPath}`);
            continue; // Bỏ qua (không xóa) và đi đến file tiếp theo
          }
          // --- KẾT THÚC THAY ĐỔI ---

          const baseName = path.basename(itemName, ".json");

          let isFileValid = false;
          // Kiểm tra xem baseName có CHỨA bất kỳ UID hợp lệ nào không
          for (const validName of validBotNames) {
            if (baseName.includes(validName)) {
              isFileValid = true;
              break;
            }
          }

          if (!isFileValid) {
            try {
              fs.unlinkSync(fullPath);
              console.log(`[Cleaner] Đã xóa file: ${fullPath}`);
              filesDeleted++;
            } catch (delErr) {
              console.error(
                `[Cleaner] Lỗi xóa file ${fullPath}: ${delErr.message}`,
              );
              errors.push(`Lỗi xóa file ${itemName}`);
            }
          }
        }
      } else if (dir.type === "folder" && stats.isDirectory()) {
        // Logic cho folder: Tên folder PHẢI KHỚP CHÍNH XÁC với UID
        const folderName = itemName;
        if (!validBotNames.has(folderName)) {
          try {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`[Cleaner] Đã xóa thư mục: ${fullPath}`);
            foldersDeleted++;
          } catch (delErr) {
            console.error(
              `[Cleaner] Lỗi xóa thư mục ${fullPath}: ${delErr.message}`,
            );
            errors.push(`Lỗi xóa thư mục ${folderName}`);
          }
        }
      }
    }
  }

  return { success: true, filesDeleted, foldersDeleted, errors };
}

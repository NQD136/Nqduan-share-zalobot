// ✅ Import thêm 'existsSync' để kiểm tra file/folder tồn tại
import { readdirSync, statSync, existsSync } from "fs";
import { join, resolve } from "path";

// Import các hàm gốc
import { getGlobalPrefix } from "../service.js";
import {
  sendMessageStateQuote,
  sendMessageFailed,
} from "../chat-zalo/chat-style/chat-style.js";
import { nameServer } from "../../database/index.js";

// ⚠️⚠️⚠️ Đường dẫn gốc của project
// Dùng '/root/Nqduan' cho Linux (VPS)
const PROJECT_ROOT_PATH = "/root/Nqduan";
// Dùng 'D:/Nqduan' hoặc 'D:\\Nqduan' cho Windows
// const PROJECT_ROOT_PATH = 'D:/Nqduan';

// ✅ Giữ nguyên hàm này
const getCleanNameServer = () => {
  const lines = nameServer
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  const tagLine = lines.find((line) => line.startsWith("@"));
  const boldLine = lines.find(
    (line) => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line),
  );

  return [tagLine, boldLine].filter(Boolean).join(" ");
};

// ✅ Tên lệnh
export const des = {
  name: "showcode",
  type: 1,
  permission: "admin",
  countdown: 10,
  active: true,
};

// --- ✅ HÀM TÌM KIẾM ĐỆ QUY ---
// Hàm này sẽ tự gọi chính nó để đi sâu vào các thư mục con
function findFilesRecursive(dir, filename, results, rootPath) {
  // Kiểm tra xem thư mục có tồn tại không
  if (!existsSync(dir)) {
    return;
  }

  const items = readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = join(dir, item.name);

    if (item.isDirectory()) {
      // ⚠️ Bỏ qua các thư mục nặng/không cần thiết
      if (item.name === "node_modules" || item.name.startsWith(".")) {
        continue;
      }
      // Đệ quy: Gọi lại hàm này cho thư mục con
      findFilesRecursive(fullPath, filename, results, rootPath);
    } else if (item.isFile()) {
      // Nếu tên file khớp, thêm vào danh sách kết quả
      if (item.name === filename) {
        // Chỉ lưu đường dẫn tương đối (ví dụ: Nqduan/src/index.js)
        results.push(fullPath.replace(rootPath, "Nqduan"));
      }
    }
  }
}

// ✅ Hàm xử lý chính
export async function handleshowcodeCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  let commandName = "";
  if (content.startsWith(`${currentPrefix}showcode`)) {
    commandName = "showcode";
  } else if (content.startsWith(`${currentPrefix}shocode`)) {
    commandName = "shocode";
  } else {
    return false;
  }

  // ✅ Lấy toàn bộ nội dung sau tên lệnh
  const argString = content
    .slice(currentPrefix.length + commandName.length)
    .trim();
  const resolvedRoot = resolve(PROJECT_ROOT_PATH); // Chuẩn hóa đường dẫn gốc

  try {
    // --- LOGIC MỚI: TÌM KIẾM FILE (FIND) ---
    if (argString.startsWith("find ")) {
      const filenameToFind = argString.slice(5).trim(); // Lấy tên file sau chữ 'find '

      // Báo lỗi nếu người dùng nhập cả đường dẫn vào 'find'
      if (filenameToFind.includes("/") || filenameToFind.includes("\\")) {
        return sendMessageFailed(
          api,
          message,
          `${getCleanNameServer()}❌ Lỗi: Bạn chỉ cần nhập TÊN FILE (ví dụ: 'index.js'), không nhập đường dẫn.`,
          true,
        );
      }

      const searchResults = []; // Mảng chứa kết quả
      console.log(`[ShowCode] Bắt đầu tìm kiếm file: ${filenameToFind}`);

      // Bắt đầu tìm kiếm đệ quy từ thư mục gốc
      findFilesRecursive(
        resolvedRoot,
        filenameToFind,
        searchResults,
        resolvedRoot,
      );

      console.log(`[ShowCode] Tìm thấy ${searchResults.length} kết quả.`);

      let msg = `🔎 Kết quả tìm kiếm cho file: "${filenameToFind}"\n\n`;
      if (searchResults.length > 0) {
        msg += searchResults.map((path) => `  - ${path}`).join("\n");
      } else {
        msg += "  (Không tìm thấy file nào)";
      }

      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}${msg}`,
        true,
        120000,
        false,
      );
    }

    // --- LOGIC CŨ: LIỆT KÊ THƯ MỤC (LISTING) ---
    const pathArgs = argString.split(/\/|\\/).filter(Boolean);

    let targetPath = resolvedRoot;
    if (pathArgs.length > 0) {
      targetPath = join(resolvedRoot, ...pathArgs);
    }

    // ⚠️ Kiểm tra bảo mật (Path Traversal)
    if (!targetPath.startsWith(resolvedRoot)) {
      console.warn(
        `[SECURITY] Phát hiện Path Traversal: User ${message.senderId} | Input: ${argString}`,
      );
      return sendMessageFailed(
        api,
        message,
        `${getCleanNameServer()}❌ Lỗi bảo mật: Bạn không được phép truy cập đường dẫn này.`,
        true,
      );
    }

    // Bắt đầu logic liệt kê
    const pathStats = statSync(targetPath);
    const relativePath = targetPath.replace(resolvedRoot, "Nqduan");

    if (pathStats.isDirectory()) {
      const items = readdirSync(targetPath);
      const folders = [];
      const files = [];

      for (const item of items) {
        if (item.startsWith(".")) continue;

        const fullItemPath = join(targetPath, item);
        try {
          const stats = statSync(fullItemPath);
          if (stats.isDirectory()) {
            folders.push(item);
          } else if (stats.isFile()) {
            files.push(item);
          }
        } catch (statError) {
          console.warn(`Không thể đọc thông tin: ${item}`, statError.message);
        }
      }

      let msg = `🌳 Nội dung thư mục: ${relativePath || "Nqduan"}\n`;
      msg += "\n📂 Thư mục (Folders):\n";
      msg +=
        folders.length > 0
          ? folders.map((f) => `  - ${f}`).join("\n")
          : "  (Không có)";
      msg += "\n\n📄 Tệp (Files):\n";
      msg +=
        files.length > 0
          ? files.map((f) => `  - ${f}`).join("\n")
          : "  (Không có)";
      msg += `\n\n👉 Gõ ${currentPrefix}${commandName} [tên_thư_mục] để xem bên trong.`;
      msg += `\n👉 Gõ ${currentPrefix}${commandName} find [tên_file] để tìm file.`;

      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}${msg}`,
        true,
        120000,
        false,
      );
    } else {
      // Người dùng gõ đường dẫn đến 1 file (theo logic cũ)
      return sendMessageFailed(
        api,
        message,
        `${getCleanNameServer()}❌ Lỗi: "${relativePath}" là một TỆP TIN. Lệnh này chỉ dùng để xem thư mục.`,
        true,
      );
    }
  } catch (e) {
    // Xử lý lỗi chung
    console.error("Lỗi khi đọc project:", e);
    let errorMsg = `❌ Lỗi khi đọc: ${e.message}`;

    if (e.code === "ENOENT") {
      errorMsg = `❌ Lỗi: Đường dẫn "${argString}" không tồn tại.`;
    } else if (e.code === "EACCES") {
      errorMsg = `❌ Lỗi: Bot không có quyền truy cập vào đường dẫn đó.`;
    }

    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}${errorMsg}`,
      true,
    );
  }
}

import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import axios from "axios";
import os from "os";
import FormData from "form-data";
import { getGlobalPrefix } from "../../service.js";
import { removeMention } from "../../../utils/format-util.js";
import {
  sendMessageWarningRequest,
  sendMessageCompleteRequest,
  sendMessageFailed,
} from "../../chat-zalo/chat-style/chat-style.js";
import { isAdmin } from "../../../index.js";
import { getBotId } from "../../../index.js";

// Cấu hình
const CATBOX_USER_HASH =
  process.env.CATBOX_USER_HASH || "d87e47c1021ffc0928813f0c1";
const FIXED_SAVE_FOLDER = path.join(
  process.cwd(),
  "src",
  "Nqduan-service",
  "chat-zalo",
  "chat-special",
  "send-video",
  "data-api",
);
const MAX_SIZE_MB = 200;

export async function handleDownloadData(api, message, aliasCommand) {
  const botId = getBotId();
  const userId = message.data.uidFrom;
  const isAdminUser = await isAdmin(botId, userId);
  const prefix = getGlobalPrefix(botId);
  const content = removeMention(message);
  const args = content
    .replace(`${prefix}${aliasCommand}`, "")
    .trim()
    .split("|");

  const firstPart = args[0]?.trim();
  const fileUrl = await extractLinkFromMessage(message, args[1]?.trim());
  const saveFolder = FIXED_SAVE_FOLDER;

  // Danh sách file txt
  if ((firstPart === "list" || firstPart === "show") && args.length === 1) {
    try {
      const files = (await fs.readdir(saveFolder)).filter((f) =>
        f.endsWith(".txt"),
      );
      return sendMessageCompleteRequest(api, message, {
        caption: `📂 Danh sách file:\n${files.map((f) => `- ${f}`).join("\n") || "Không có file nào."}`,
      });
    } catch (err) {
      return sendMessageWarningRequest(api, message, {
        caption: `❌ Không thể đọc thư mục: ${err.message}`,
      });
    }
  }

  // Lệnh list <filename> (ai cũng được xem)
  if (firstPart?.startsWith("list ")) {
    let fileName = firstPart.substring(5).trim();
    if (!fileName.endsWith(".txt")) fileName += ".txt";

    const savePath = path.join(saveFolder, fileName);
    try {
      const contentFile = await fs.readFile(savePath, "utf8");
      const lines = contentFile.split("\n").filter(Boolean);

      return sendMessageCompleteRequest(
        api,
        message,
        {
          caption: `📄 File '${fileName}' chứa tổng cộng ${lines.length} link.`,
        },
        60000,
      );
    } catch {
      return sendMessageWarningRequest(api, message, {
        caption: `❌ Không tìm thấy file '${fileName}'.`,
      });
    }
  }

  // Lệnh show <filename> (chỉ Admin mới được xem chi tiết link)
  if (firstPart?.startsWith("show ")) {
    if (!isAdminUser) {
      return sendMessageWarningRequest(
        api,
        message,
        {
          caption: `❌ Chỉ Quản trị viên cấp cao mới được xem chi tiết link!`,
        },
        30000,
      );
    }

    let fileName = firstPart.substring(5).trim();
    if (!fileName.endsWith(".txt")) fileName += ".txt";

    const savePath = path.join(saveFolder, fileName);
    try {
      const contentFile = await fs.readFile(savePath, "utf8");
      const lines = contentFile.split("\n").filter(Boolean);

      return sendMessageCompleteRequest(
        api,
        message,
        {
          caption: `📄 File '${fileName}' có tổng cộng ${lines.length} link.`,
        },
        60000,
      );
    } catch {
      return sendMessageWarningRequest(api, message, {
        caption: `❌ Không tìm thấy file '${fileName}'.`,
      });
    }
  }

  // Xử lý add/remove file và remove link
  if (firstPart?.startsWith("add ") || firstPart?.startsWith("remove ")) {
    const [action, rawFileName] = firstPart.split(" ");
    const fileName = rawFileName?.endsWith(".txt")
      ? rawFileName
      : `${rawFileName}.txt`;
    const savePath = path.join(saveFolder, fileName);

    if (!isAdminUser) {
      const label = action === "add" ? "tạo" : "xóa";
      return sendMessageWarningRequest(
        api,
        message,
        {
          caption: `🔄 Chỉ Admin cấp cao mới được phép ${label} file!`,
        },
        30000,
      );
    }

    if (!rawFileName) {
      return sendMessageWarningRequest(
        api,
        message,
        {
          caption: `❌ Vui lòng cung cấp tên file sau '${action}'.`,
        },
        30000,
      );
    }

    await fs.mkdir(saveFolder, { recursive: true });

    if (action === "add") {
      try {
        await fs.access(savePath);
        return sendMessageWarningRequest(
          api,
          message,
          {
            caption: `⚠️ File '${fileName}' đã tồn tại.`,
          },
          20000,
        );
      } catch {
        await fs.writeFile(savePath, "", "utf8");
        return sendMessageCompleteRequest(
          api,
          message,
          {
            caption: `✅ Đã tạo file '${fileName}' thành công.`,
          },
          20000,
        );
      }
    }

    if (action === "remove") {
      if (args[1]) {
        const removeLink = args[1].trim();
        try {
          const contentFile = await fs.readFile(savePath, "utf8");
          const lines = contentFile.split("\n").filter(Boolean);
          const updated = lines.filter(
            (line) => line.trim() !== removeLink.trim(),
          );

          if (updated.length === lines.length) {
            return sendMessageWarningRequest(api, message, {
              caption: `⚠️ Link không tồn tại trong file '${fileName}'.`,
            });
          }

          await fs.writeFile(savePath, updated.join("\n") + "\n", "utf8");
          return sendMessageCompleteRequest(api, message, {
            caption: `✅ Đã xóa link khỏi file '${fileName}'`,
          });
        } catch {
          return sendMessageWarningRequest(api, message, {
            caption: `❌ Không tìm thấy file '${fileName}' để xóa link.`,
          });
        }
      }

      try {
        await fs.unlink(savePath);
        return sendMessageCompleteRequest(
          api,
          message,
          {
            caption: `✅ Đã xóa file '${fileName}' thành công.`,
          },
          20000,
        );
      } catch {
        return sendMessageWarningRequest(
          api,
          message,
          {
            caption: `❌ Không tìm thấy file '${fileName}' để xóa.`,
          },
          20000,
        );
      }
    }

    return;
  }

  // Upload hoặc ghi link
  let fileNameRaw = firstPart;
  if (!fileNameRaw) fileNameRaw = `data_${Date.now()}.txt`;
  const fileName = fileNameRaw.endsWith(".txt")
    ? fileNameRaw
    : `${fileNameRaw}.txt`;
  const savePath = path.join(saveFolder, fileName);

  if (!fileUrl || !/^https?:\/\//.test(fileUrl)) {
    return sendMessageWarningRequest(
      api,
      message,
      {
        caption: `❌ Vui lòng cung cấp link hợp lệ hoặc reply video.`,
      },
      30000,
    );
  }

  try {
    await fs.access(savePath);
  } catch {
    return sendMessageWarningRequest(
      api,
      message,
      {
        caption: `❌ File '${fileName}' chưa được tạo. Dùng lệnh '${prefix}${aliasCommand} add ${fileName}' trước.`,
      },
      30000,
    );
  }

  try {
    const existing = await fs.readFile(savePath, "utf8");
    const lines = new Set(existing.split("\n").filter(Boolean));
    const alreadyExists = [...lines].some(
      (line) => line.trim() === fileUrl.trim(),
    );

    if (alreadyExists) {
      return sendMessageCompleteRequest(
        api,
        message,
        {
          caption: `⚠️ Link đã tồn tại trong file '${fileName}'`,
        },
        30000,
      );
    }

    if (/^https:\/\/(files\.)?catbox\.moe\//.test(fileUrl)) {
      lines.add(fileUrl);
      await fs.writeFile(savePath, Array.from(lines).join("\n") + "\n", "utf8");
      return sendMessageCompleteRequest(
        api,
        message,
        {
          caption: `✅ Đã thêm link Catbox vào file '${fileName}'`,
        },
        30000,
      );
    }

    // Thử lấy kích thước file từ header
    let fileSize = 0;
    let headRes;
    try {
      headRes = await axios.head(fileUrl);
      fileSize = Number(headRes.headers["content-length"]);
    } catch {
      fileSize = 0;
    }

    const maxSize = MAX_SIZE_MB * 1024 * 1024;
    if (!fileSize || isNaN(fileSize)) {
      const response = await axios.get(fileUrl, { responseType: "stream" });
      fileSize = 0;

      await new Promise((resolve, reject) => {
        response.data.on("data", (chunk) => {
          fileSize += chunk.length;
          if (fileSize > maxSize) {
            response.data.destroy();
            reject(
              new Error(
                `File quá lớn (${(fileSize / 1024 / 1024).toFixed(2)}MB), giới hạn ${MAX_SIZE_MB}MB.`,
              ),
            );
          }
        });
        response.data.on("end", resolve);
        response.data.on("error", reject);
      }).catch((err) => {
        throw err;
      });
    }

    if (fileSize > maxSize) {
      return sendMessageWarningRequest(
        api,
        message,
        {
          caption: `❌ File quá lớn (${(fileSize / 1024 / 1024).toFixed(2)}MB), giới hạn ${MAX_SIZE_MB}MB.`,
        },
        30000,
      );
    }

    let ext = path.extname(new URL(fileUrl).pathname);
    if (!ext || !ext.includes(".")) ext = ".mp4";

    const tmpPath = path.join(os.tmpdir(), `download_${Date.now()}${ext}`);
    const downloadResponse = await axios.get(fileUrl, {
      responseType: "stream",
    });
    const writer = fsSync.createWriteStream(tmpPath);

    await new Promise((resolve, reject) => {
      downloadResponse.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    await sendMessageCompleteRequest(
      api,
      message,
      {
        caption: `📤 Đang tiến hành upload video, vui lòng chờ trong giây lát...`,
      },
      15000,
    );

    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("userhash", CATBOX_USER_HASH);
    form.append("fileToUpload", fsSync.createReadStream(tmpPath), {
      filename: `video${ext}`,
      contentType: `video/${ext.replace(".", "") || "mp4"}`,
    });

    const catboxRes = await axios.post(
      "https://catbox.moe/user/api.php",
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    await fs.unlink(tmpPath);

    const catboxUrl = catboxRes.data?.trim();

    if (!/^https:\/\/(files\.)?catbox\.moe\//.test(catboxUrl)) {
      return sendMessageWarningRequest(
        api,
        message,
        {
          caption: `❌ Upload thất bại: ${catboxUrl}`,
        },
        30000,
      );
    }

    if (!lines.has(catboxUrl)) {
      lines.add(catboxUrl);
      await fs.writeFile(savePath, Array.from(lines).join("\n") + "\n", "utf8");
      return sendMessageCompleteRequest(
        api,
        message,
        {
          caption: `Xong rồi sếp ơi video được lưu ở: ${fileName}`,
        },
        60000,
      );
    } else {
      return sendMessageCompleteRequest(
        api,
        message,
        {
          caption: `⚠️ Upload thành công nhưng link đã có sẵn trong '${fileName}'`,
        },
        60000,
      );
    }
  } catch (err) {
    console.error("Lỗi khi xử lý upload:", err);
    return sendMessageWarningRequest(
      api,
      message,
      {
        caption: `❌ Đã xảy ra lỗi: ${err.message}`,
      },
      30000,
    );
  }
}

async function extractLinkFromMessage(message, fallbackLink) {
  try {
    const attach = message?.data?.quote?.attach;
    if (!attach) return fallbackLink;
    const parsed = JSON.parse(attach);
    return (
      parsed.hdUrl ||
      parsed.href ||
      parsed.oriUrl ||
      parsed.normalUrl ||
      parsed.thumbUrl ||
      fallbackLink
    );
  } catch {
    return fallbackLink;
  }
}

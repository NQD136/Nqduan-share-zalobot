import fs from "fs";
import path from "path";
import os from "os";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { sendMessageFactory } from "../../api-zalo/apis/sendMessage.js";
import { getGlobalPrefix } from "../service.js";
import { nameServer } from "../../database/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const des = {
  name: "fb",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
};

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

async function downloadImage(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Không thể tải ảnh!");
  const buffer = await res.buffer();
  fs.writeFileSync(filePath, buffer);
}

export async function handleFbCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const sendMessage = sendMessageFactory(api);
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  let isGroup = threadId !== uid;
  if (typeof message.isGroup !== "undefined") isGroup = message.isGroup;

  if (!content.startsWith(`${currentPrefix}fb`)) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Lệnh không hợp lệ! Dùng: ${currentPrefix}fb <uid> 🚨`,
        ttl: 60000,
      },
      threadId,
      isGroup ? 1 : 0,
    );
  }

  const args = content
    .slice(currentPrefix.length + 2)
    .trim()
    .split(/\s+/);
  if (args.length < 1) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Thiếu UID! Dùng: ${currentPrefix}fb <uid>`,
        ttl: 60000,
      },
      threadId,
      isGroup ? 1 : 0,
    );
  }

  const fbUid = args[0];

  try {
    const apiUrl = `https://apinvh.zzux.com/api/getinfo?uid=${encodeURIComponent(fbUid)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok || !data?.name) {
      throw new Error("Không thể lấy dữ liệu từ API!");
    }

    const user = data;

    const msg = `${getCleanNameServer()}📘 Thông tin Facebook 📘

👤 Tên: ${user.name}
🆔 UID: ${user.uid}
🔗 Username: ${user.username}
🌍 Locale: ${user.locale}

👫 Giới tính: ${user.gender}
💍 Tình trạng: ${user.relationship_status}
❤️ Người yêu: ${user.love?.name || "Không công khai"}

📅 Tạo lúc: ${user.created_time}
🎂 Sinh nhật: ${user.birthday}
👥 Followers: ${user.follower}
✅ Tích xanh: ${user.tichxanh ? "Có ✅" : "Không ❌"}

📍 Địa chỉ: ${user.location || "Không rõ"}
🏡 Quê quán: ${user.hometown || "Không rõ"}
🔗 Website: ${user.web}

👤 Author: Nqduan`;

    // Tải avatar
    const tmpDir = path.join(os.tmpdir(), "fb-avatar");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    let attachments = [];
    if (user.avatar) {
      const avatarPath = path.join(tmpDir, `avatar_${user.uid}.jpg`);
      await downloadImage(user.avatar, avatarPath);
      attachments.push(avatarPath);
    }

    await sendMessage(
      { msg: msg, attachments, ttl: 3600000 },
      threadId,
      isGroup ? 1 : 0,
    );

    attachments.forEach((file) => fs.unlinkSync(file));
  } catch (err) {
    console.error("❌ Facebook Error:", err);
    await sendMessage(
      { msg: `${getCleanNameServer()}❌ Lỗi: ${err.message}`, ttl: 60000 },
      threadId,
      isGroup ? 1 : 0,
    );
  }
}

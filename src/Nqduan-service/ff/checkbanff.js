import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";

import {
  sendMessageStateQuote,
  sendMessageFailed,
} from "../chat-zalo/chat-style/chat-style.js";

import { nameServer } from "../../database/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const des = {
  name: "checkbanff",
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

export async function handleCheckbanffCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}checkbanff`)) return false;

  const args = content
    .slice(currentPrefix.length + 10)
    .trim()
    .split(/\s+/);

  if (args.length !== 1) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Sai cú pháp! Dùng: ${currentPrefix}checkbanff <uid>`,
      true,
      60000,
      false,
    );
  }

  const uid = args[0];

  if (!/^\d+$/.test(uid)) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ UID phải là số!`,
      true,
      60000,
      false,
    );
  }

  const apiUrl = `https://lkteam-bancheck.deno.dev/checkban?uid=${uid}`;
  console.log("Gọi API:", apiUrl);

  try {
    const res = await fetch(apiUrl);
    const json = await res.json();

    if (!res.ok || !json || !json.uid) {
      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}❌ Không tìm thấy thông tin cho UID ${uid}.`,
        true,
        60000,
        false,
      );
    }

    const msg = `🔍 KẾT QUẢ KIỂM TRA BAN FREE FIRE

👤 Tên: ${json.nickname || "Không rõ"}
🆔 UID: ${json.uid}
🌍 Khu vực: ${json.region || "Không rõ"}
🚫 Tình trạng: ${json.banned ? "🔴 ĐÃ BỊ CẤM" : "🟢 Không bị cấm"}

🛠️ Created by: Nqduan`;

    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}${msg}`,
      true,
      1800000,
      false,
    );
  } catch (e) {
    console.error("Lỗi API checkbanff:", e);
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`,
      true,
    );
  }
}

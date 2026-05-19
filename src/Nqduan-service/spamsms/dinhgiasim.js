import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";

import {
  sendMessageStateQuote,
  sendMessageFailed
} from "../chat-zalo/chat-style/chat-style.js";

import { nameServer } from "../../database/index.js";

// ✅ Ghép tag + chữ đỏ vào header tin nhắn
const getCleanNameServer = () => {
  const lines = nameServer
    .split("\n")
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith("@"));
  const boldLine = lines.find(
    line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line)
  );

  return [tagLine, boldLine].filter(Boolean).join(" ");
};

export const des = {
  name: "dinhgiasim",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
};

export async function handledinhgiasimCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}dinhgiasim`)) return false;

  const args = content.slice(currentPrefix.length + 11).trim().split(/\s+/).filter(Boolean);

  // ✅ Nếu không nhập số điện thoại
  if (args.length === 0) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Vui lòng nhập số điện thoại để định giá!\n👉 Cú pháp: ${currentPrefix}dinhgiasim <sdt>`,
      true,
      60000,
      false
    );
  }

  // ✅ Nếu nhập nhiều hơn 1 tham số
  if (args.length !== 1) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Sai cú pháp! Dùng: ${currentPrefix}dinhgiasim <sdt>`,
      true,
      60000,
      false
    );
  }

  const sdt = args[0];

  if (!/^\d{9,11}$/.test(sdt)) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Vui lòng nhập số điện thoại hợp lệ (9-11 chữ số)!`,
      true,
      60000,
      false
    );
  }

  const apiUrl = `https://api.nemg.me/valuation?sdt=${sdt}`;
  console.log("Gọi API định giá sim:", apiUrl);

  try {
    const res = await fetch(apiUrl);
    const json = await res.json();

    if (!res.ok || !json.success || !json.data?.valuation) {
      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}❌ Không tìm thấy định giá cho số ${sdt}.`,
        true,
        60000,
        false
      );
    }

    const valuation = json.data.valuation[sdt] || "Không rõ";

    const msg = `📱 ĐỊNH GIÁ SIM THÀNH CÔNG

➤ Số điện thoại: ${sdt}
➤ Định giá: ${valuation}

✨ Chúc bạn luôn 8386`;

    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}${msg}`,
      true,
      3600000,
      false
    );
  } catch (e) {
    console.error("Lỗi API định giá sim:", e);
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`,
      true
    );
  }
}
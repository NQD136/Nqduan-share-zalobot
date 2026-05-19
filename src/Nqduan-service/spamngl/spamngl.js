import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";
import {
  sendMessageStateQuote,
  sendMessageFailed,
} from "../chat-zalo/chat-style/chat-style.js";
import { nameServer } from "../../database/index.js";

export const des = {
  name: "ngl",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
};

// Danh sách User-Agent mẫu
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0",
  "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.65 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1",
];

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

export async function handleNglCommand(api, message) {
  const senderName = message.data.dName;
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}ngl`)) return false;

  const argsRaw = content.slice(currentPrefix.length + 3).trim();
  const parts = argsRaw.split("&&").map((p) => p.trim());
  if (parts.length !== 2) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Sai cú pháp! Dùng: ${currentPrefix}ngl <username> <message> && <count>`,
      true,
      60000,
      false,
    );
  }

  const firstPart = parts[0].split(/\s+/);
  if (firstPart.length < 2) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Sai cú pháp! Username và nội dung không được bỏ trống.`,
      true,
      60000,
      false,
    );
  }

  const username = firstPart[0];
  const msgText = firstPart.slice(1).join(" ");
  const count = parseInt(parts[1], 10);

  if (!username || !msgText) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Username hoặc nội dung không hợp lệ.`,
      true,
      60000,
      false,
    );
  }
  if (isNaN(count) || count <= 0) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Số lần spam phải là số nguyên dương.`,
      true,
      60000,
      false,
    );
  }
  if (count > 10000) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Số lần spam tối đa là 10,000.`,
      true,
      60000,
      false,
    );
  }

  // Thông báo bắt đầu
  await sendMessageStateQuote(
    api,
    message,
    `${getCleanNameServer()}🔄 Đang tiến hành spam NGL\n⏳ Vui lòng chờ...`,
    true,
    60000,
    false,
  );

  let success = 0;
  let bad = 0;

  for (let i = 0; i < count; i++) {
    const headers = {
      Host: "ngl.link",
      "sec-ch-ua":
        '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
      accept: "*/*",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      "sec-ch-ua-mobile": "?0",
      "user-agent": userAgents[Math.floor(Math.random() * userAgents.length)],
      "sec-ch-ua-platform": '"Windows"',
      origin: "https://ngl.link",
      referer: `https://ngl.link/${username}`,
      "accept-language": "en-US,en;q=0.9",
    };

    const body = new URLSearchParams({
      username: username,
      question: msgText,
      deviceId: "ABCDEF1234567890",
      gameSlug: "",
      referrer: "",
    });

    try {
      const res = await fetch("https://ngl.link/api/submit", {
        method: "POST",
        headers,
        body,
      });
      if (res.status === 200) {
        success++;
      } else {
        bad++;
      }
    } catch (err) {
      bad++;
    }

    // Delay 1 giây giữa các request
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const resultMsg = `✅ Spam hoàn tất
👤 Người gửi: ${senderName}
📛 Username: ${username}
💬 Nội dung: ${msgText}
🔢 Số lượng yêu cầu: ${count}
✅ Thành công: ${success}
❌ Thất bại: ${bad}

🛠️ Create By: Nqduan`;

  return sendMessageStateQuote(
    api,
    message,
    `${getCleanNameServer()}${resultMsg}`,
    true,
    60000,
    false,
  );
}

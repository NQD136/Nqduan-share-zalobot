import fs from "fs";
import path from "path";
import { sendMessageFactory } from "../../api-zalo/apis/sendMessage.js";
import { MessageType } from "../../api-zalo/models/Message.js";

const commandConfigPath = path.join(
  process.cwd(),
  "assets",
  "json-data",
  "command.json",
);

function getBotPrefix() {
  try {
    const config = JSON.parse(fs.readFileSync(commandConfigPath, "utf8"));
    return config.prefix || "/";
  } catch (err) {
    console.error("Lỗi khi đọc prefix từ command.json:", err);
    return "/";
  }
}

export const des = {
  name: "tymtt",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
  alias: ["tymtt"],
};

// Gọi API tăng tym và xử lý phản hồi
async function buffLike(url) {
  const apiUrl = `http://apihoangthanhtung.ddns.net:5000/web=${encodeURIComponent(url)}/tym?key=duongca`;

  const res = await fetch(apiUrl);
  const data = await res.json();

  // Nếu phản hồi hợp lệ và là success
  if (res.ok && data.status === "success") {
    data.by = "Nqduan"; // Ghi đè tác giả

    // Xử lý xoá từ "View" khỏi thông báo (mọi kiểu viết)
    data.message = data.message.replace(/View\s*\/?\s*/gi, "").trim();
    return { success: true, data };
  }

  return {
    success: false,
    data: {
      status: data.status || "error",
      message: data.message || "Không rõ lỗi",
      by: "Nqduan",
    },
  };
}

export async function handleTymttCommand(api, message) {
  const threadId = message.threadId;
  const content = message.data.content.trim();
  const messageId = message.messageId;
  const sendMessage = sendMessageFactory(api);
  const parts = content.split(/\s+/);
  const prefix = getBotPrefix();

  if (parts.length < 2) {
    return sendMessage(
      {
        msg: `❌ Định dạng sai! Dùng: ${prefix}tymtt <link TikTok>`,
        ttl: 60000,
        replyTo: messageId,
      },
      threadId,
      MessageType.GroupMessage,
    );
  }

  const url = parts[1];

  if (!url.startsWith("https://vt.tiktok.com/")) {
    return sendMessage(
      {
        msg: `❌ Link không hợp lệ!`,
        ttl: 60000,
        replyTo: messageId,
      },
      threadId,
      MessageType.GroupMessage,
    );
  }

  try {
    await sendMessage(
      {
        msg: `❤️ Đang tiến hành buff tym...`,
        ttl: 60000,
        replyTo: messageId,
      },
      threadId,
      MessageType.GroupMessage,
    );

    const result = await buffLike(url);

    if (result.success) {
      const { message: msgText, order, by } = result.data;
      await sendMessage(
        {
          msg: `✅Đã tiến hành buff tym thành công\nVui lòng chờ\n👤 Fonder: ${by}`,
          ttl: 60000,
          replyTo: messageId,
        },
        threadId,
        MessageType.GroupMessage,
      );
    } else {
      await sendMessage(
        {
          msg: `⚠️ Buff không thành công!\n📄 Lý do: ${result.data.message}`,
          ttl: 60000,
          replyTo: messageId,
        },
        threadId,
        MessageType.GroupMessage,
      );
    }
  } catch (err) {
    console.error("❌ Lỗi khi buff tym:", err);
    await sendMessage(
      {
        msg: `❌ Đã xảy ra lỗi khi buff tym!\nLỗi: ${err.message}`,
        ttl: 60000,
        replyTo: messageId,
      },
      threadId,
      MessageType.GroupMessage,
    );
  }
}

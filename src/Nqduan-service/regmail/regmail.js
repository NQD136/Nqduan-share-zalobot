import { sendMessageFactory } from "../../api-zalo/apis/sendMessage.js";
import { Zalo } from "../../api-zalo/index.js";
import { MessageType } from "../../api-zalo/models/Message.js";
import { appContext } from "../../api-zalo/context.js";
import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";

// Metadata của lệnh
export const des = {
  name: "regmail",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
};

// Hàm chính xử lý lệnh regmail
export async function handleRegmailCommand(api, message, aliasCommand) {
  console.log("handleRegmailCommand called:", {
    threadId: message.threadId,
    content: message.data.content,
    aliasCommand,
  });

  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const sendMessage = sendMessageFactory(api);
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  // Kiểm tra threadId
  if (!threadId) {
    console.error("Invalid threadId:", threadId);
    return { success: false, error: "Invalid threadId" };
  }

  // Kiểm tra cấu hình Zalo
  if (
    !appContext.secretKey ||
    !appContext.imei ||
    !appContext.cookie ||
    !appContext.userAgent
  ) {
    console.error("Missing required app context fields:", appContext);
    await sendMessage(
      {
        msg: "❌ Lỗi cấu hình Zalo API. Vui lòng liên hệ quản trị viên! 😢",
        ttl: 300000,
      },
      threadId,
      MessageType.DirectMessage,
    ).catch((err) =>
      console.error("Failed to send Zalo config error message:", err.message),
    );
    return { success: false, error: "Missing Zalo API configuration" };
  }

  // Xác định xem threadId là nhóm hay cá nhân
  let isGroup = threadId !== uid;
  if (typeof message.isGroup !== "undefined") {
    isGroup = message.isGroup;
    console.warn(
      "Using message.isGroup:",
      message.isGroup,
      "threadId !== uid:",
      threadId !== uid,
    );
  }

  // Log để debug
  console.log("Received message:", {
    threadId,
    uid,
    content,
    isGroup,
    aliasCommand,
  });
  console.log("Current Prefix:", currentPrefix);

  // Kiểm tra lệnh có đúng định dạng không
  if (!content.startsWith(`${currentPrefix}regmail`)) {
    console.log("Command does not match prefix:", content);
    await sendMessage(
      {
        msg: `❌ Lệnh không hợp lệ! Dùng: ${currentPrefix}regmail 🚨`,
        ttl: 60000,
      },
      threadId,
      isGroup ? MessageType.GroupMessage : MessageType.DirectMessage,
    ).catch((err) =>
      console.error("Failed to send invalid command message:", err.message),
    );
    return { success: false, error: "Invalid command format" };
  }

  // Lấy thông tin người dùng từ Zalo
  const info = await api.getUserInfo(uid).catch((err) => {
    console.error("Error fetching user info:", err.message);
    return null;
  });
  const name = info?.zaloName || `UID: ${uid}`;
  console.log("User info:", { name, uid });

  // Gửi yêu cầu đến API để lấy thông tin tài khoản
  const apiUrl = "https://keyherlyswar.x10.mx/Apidocs/reglq.php";
  console.log("Calling API with URL:", apiUrl);

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    console.log("Raw API response:", JSON.stringify(data, null, 2));

    // Kiểm tra phản hồi API
    if (!response.ok || !data.status || !data.result || !data.result[0]) {
      console.error(
        "API Error:",
        response.status,
        data.error || "No error message provided",
      );
      let errorMsg = `❌ Lỗi khi lấy thông tin từ API: ${response.status} 😢`;
      if (
        response.status === 404 ||
        (data.error && data.error.includes("No data found"))
      ) {
        errorMsg = `❌ Không tìm thấy thông tin tài khoản. Vui lòng thử lại sau! 🚫`;
      }
      await sendMessage(
        { msg: errorMsg, ttl: 300000 },
        threadId,
        isGroup ? MessageType.GroupMessage : MessageType.DirectMessage,
      ).catch((err) =>
        console.error("Failed to send API error message:", err.message),
      );
      return { success: false, error: errorMsg };
    }

    // Kiểm tra dữ liệu tài khoản
    const { account, password } = data.result[0];
    if (!account || !password) {
      console.log("No account or password found in API response");
      const errorMsg = `❌ Dữ liệu trả về không hợp lệ! Không tìm thấy account hoặc password 😕`;
      await sendMessage(
        { msg: errorMsg, ttl: 300000 },
        threadId,
        isGroup ? MessageType.GroupMessage : MessageType.DirectMessage,
      ).catch((err) =>
        console.error("Failed to send invalid data message:", err.message),
      );
      return { success: false, error: errorMsg };
    }

    // Tạo nội dung tin nhắn
    const messageContent =
      `📧 Thông tin tài khoản 📧\n\n` +
      `🧑 Tên người yêu cầu: ${name}\n` +
      `🆔 Username: ${account}\n` +
      `🔑 Password: ${password}\n` +
      `👤 Author: ${data.author || "N/A"}\n\n` +
      `🔧 Được yêu cầu bởi: ${name} (UID: ${uid})\n` +
      `👤 Founder: Nqduan`;

    console.log("Sending message:", messageContent);
    await sendMessage(
      { msg: messageContent, ttl: 86400000 },
      threadId,
      isGroup ? MessageType.GroupMessage : MessageType.DirectMessage,
    ).catch((err) =>
      console.error("Failed to send success message:", err.message),
    );
    console.log("Message sent successfully");
    return { success: true, message: "Tin nhắn đã được gửi thành công" };
  } catch (err) {
    console.error("Error in regmail:", err.message);
    const errorMsg = `❌ Lỗi không xác định: ${err.message} 😢`;
    await sendMessage(
      { msg: errorMsg, ttl: 300000 },
      threadId,
      isGroup ? MessageType.GroupMessage : MessageType.DirectMessage,
    ).catch((err) =>
      console.error("Failed to send error message:", err.message),
    );
    return { success: false, error: err.message };
  }
}

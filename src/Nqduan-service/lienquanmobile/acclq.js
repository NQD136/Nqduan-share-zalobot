import fs from "fs";
import path from "path";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { nameServer } from "../../database/index.js";

export const des = {
  name: "acclq",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
  alias: ["acclq"],
};

// ✅ Không xử lý, lấy đúng y như ff
const getCleanNameServer = () => nameServer.trim();

export async function handleAcclqCommand(api, message) {
  const content = message.data.content?.trim?.() || "";
  const args = content.split(/\s+/).slice(1);
  const count = parseInt(args[0]);
  const nameLine = getCleanNameServer();

  if (!count || count < 1 || count > 10) {
    return sendMessageStateQuote(
      api,
      message,
      `❗ Vui lòng nhập số lượng acc muốn random (1-10)`,
      true,
      60000,
      false,
    );
  }

  const filePath = path.join(
    "/root/Nqduan/src/Nqduan-service/lienquanmobile/lq.txt",
  );

  if (!fs.existsSync(filePath)) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Không tìm thấy file lq.txt`,
      true,
      60000,
      false,
    );
  }

  const data = fs.readFileSync(filePath, "utf8");
  const accounts = data
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes(":"));

  if (accounts.length === 0) {
    return sendMessageStateQuote(
      api,
      message,
      `❌ File lq.txt không có tài khoản hợp lệ!`,
      true,
      60000,
      false,
    );
  }

  const shuffled = accounts.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, count);

  const accInfo = selected
    .map((acc, idx) => {
      const [tk, mk] = acc.split(":");
      return `${idx + 1}. 📱 Tài khoản: ${tk}\n   🔑 Mật khẩu: ${mk}`;
    })
    .join("\n\n");

  const msg = `🎮 ACC LIÊN QUÂN NGẪU NHIÊN:\n\n${accInfo}`;

  return sendMessageStateQuote(api, message, msg, true, 600000, false);
}

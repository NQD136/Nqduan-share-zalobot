import fs from "fs";
import path from "path";
import axios from "axios";
import { getGlobalPrefix } from "../../service.js";
import { getContent } from "../../../utils/format-util.js";
import {
  sendMessageComplete,
  sendMessageFailed,
  sendMessageQuery,
  sendMessageStateQuote,
} from "../../chat-zalo/chat-style/chat-style.js";

// Lưu lịch sử hội thoại
function saveConversationHistory(uidFrom, dName, question, answer) {
  try {
    const dirPath = path.resolve(`src/Nqduan-service/api-crawl/content/data`);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.resolve(
      `src/Nqduan-service/api-crawl/content/data/${uidFrom}.json`,
    );
    let history = {};

    if (fs.existsSync(filePath)) {
      const rawData = fs.readFileSync(filePath, "utf-8");
      history = JSON.parse(rawData);
    } else {
      history = { dName: null, messages: [] };
      fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8");
    }

    history.dName = dName;
    history.messages = history.messages || [];
    history.messages.push({
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    });
    history.messages.push({
      role: "assistant",
      content: answer,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error("Lỗi khi lưu lịch sử hội thoại:", error);
  }
}

// Gọi API NemG để lấy câu trả lời
export async function callGPTAPI(question, uidFrom, dName) {
  try {
    // Mặc định yêu cầu trả lời bằng tiếng Việt
    const fullPrompt = `Trả lời bằng tiếng Việt: ${question}`;
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const url = `https://api.nemg.me/gpt?type=gpt4&msg=${encodedPrompt}`;

    const res = await axios.get(url);

    // Chỉ lấy kết quả từ API
    const answer = res.data?.ketQua?.result || "Không có kết quả trả về.";

    saveConversationHistory(uidFrom, dName, question, answer);

    return answer;
  } catch (error) {
    console.error("Lỗi khi gọi API NemG:", error);
    return "Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu.";
  }
}

// Hàm gọi từ lệnh Zalo bot
export async function askGPTCommand(api, message, aliasCommand) {
  const content = getContent(message);
  const prefix = getGlobalPrefix();
  const { uidFrom, dName } = message.data || { uidFrom: null, dName: null };

  const question = content.replace(`${prefix}${aliasCommand}`, "").trim();
  if (question === "") {
    await sendMessageQuery(api, message, "Vui lòng nhập câu hỏi cần giải đáp!");
    return;
  }

  try {
    const replyText = await callGPTAPI(question, uidFrom, dName);
    await sendMessageStateQuote(api, message, replyText, true, 86400000, false);
  } catch (error) {
    console.error("Lỗi khi xử lý yêu cầu GPT:", error);
    await sendMessageFailed(
      api,
      message,
      "Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn.",
    );
  }
}

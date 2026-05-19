import axios from "axios";
import { getGlobalPrefix } from "../../service.js";
import { getContent } from "../../../utils/format-util.js";
import {
  sendMessageFailed,
  sendMessageQuery,
  sendMessageStateQuote,
} from "../../chat-zalo/chat-style/chat-style.js";

// Hàng đợi xử lý request để tránh spam API
const requestQueue = [];
let isProcessing = false;
const DELAY_BETWEEN_REQUESTS = 1000;

// Hàm dịch mọi ngôn ngữ sang tiếng Việt
async function translateToVietnamese(text) {
  try {
    const res = await axios.get("https://translate.googleapis.com/translate_a/single", {
      params: {
        client: "gtx",
        sl: "auto", // auto detect language
        tl: "vi",   // always translate to Vietnamese
        dt: "t",
        q: text,
      },
    });

    // Kết quả là mảng nhiều đoạn, ghép lại thành string
    return res.data[0].map((t) => t[0]).join("");
  } catch (error) {
    console.error("Lỗi khi dịch:", error);
    return text; // fallback: trả nguyên văn nếu dịch lỗi
  }
}

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  while (requestQueue.length > 0) {
    const { question, resolve, reject } = requestQueue.shift();

    try {
      const encodedPrompt = encodeURIComponent(question);
      const url = `https://api.nemg.me/gpt?type=deepseekai&msg=${encodedPrompt}`;

      const res = await axios.get(url);
      let answer = res.data?.ketQua?.result || "Không có kết quả trả về từ API.";

      // Dịch tất cả ngôn ngữ sang tiếng Việt
      answer = await translateToVietnamese(answer);

      resolve(answer);
    } catch (error) {
      console.error("Lỗi khi gọi API NemG DeepSeek:", error);
      reject(error);
    }

    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS));
  }

  isProcessing = false;
}

export async function callDeepSeekAPI(question) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ question, resolve, reject });
    processQueue();
  });
}

// Lệnh bot
export async function askDeepSeekCommand(api, message, aliasCommand) {
  const content = getContent(message);
  const prefix = getGlobalPrefix();

  const question = content.replace(`${prefix}${aliasCommand}`, "").trim();
  if (question === "") {
    await sendMessageQuery(
      api,
      message,
      `Vui lòng nhập câu hỏi cần giải đáp! 🤔`
    );
    return;
  }

  try {
    let replyText = await callDeepSeekAPI(question);

    if (!replyText) {
      replyText =
        "Xin lỗi, hiện tại tôi không thể trả lời câu hỏi này. Bạn vui lòng thử lại sau nhé!";
    }

    await sendMessageStateQuote(api, message, replyText, true, 86400000, false);
  } catch (error) {
    console.error("Lỗi khi xử lý yêu cầu DeepSeek:", error);
    await sendMessageFailed(
      api,
      message,
      "Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn. 😢",
      true
    );
  }
}
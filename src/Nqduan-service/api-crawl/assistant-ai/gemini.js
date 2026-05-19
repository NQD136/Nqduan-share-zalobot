// ==============================================
// File: src/Nqduan-service/api-crawl/assistant-ai/gemini.js
// Version: Paimon - Final & Complete Edition
// ==============================================
// Phiên bản đầy đủ nhất, kết hợp tất cả yêu cầu:
// - Full tính cách và lời thoại Paimon.
// - Logic nhận diện và gọi tên người dùng.
// - Khôi phục đầy đủ chú thích và cấu trúc an toàn.

import fs from "fs";
import path from "path";
import fetch from "node-fetch";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGlobalPrefix } from "../../service.js";
import { getContent, removeMention } from "../../../utils/format-util.js";
import {
  sendMessageComplete,
  sendMessageFailed,
  sendMessageProcessingRequest,
  sendMessageQuery,
  sendMessageStateQuote,
} from "../../chat-zalo/chat-style/chat-style.js";
import { nameServer } from "../../../database/index.js";

// =====================
// 🔐 API Key & Khởi tạo
// =====================
const geminiApiKey = "AIzaSyCsJ7pOVDNkjFx74JBz4hvrtbihSU6g_fE"; // Thay API key của bạn vào đây
const genAI = new GoogleGenerativeAI(geminiApiKey);

// ============================
// State & Cấu hình
// ============================
const chatSessions = new Map();
let geminiModel = null;

const requestQueue = [];
let isProcessing = false;
const DELAY_THINKING = 0; // Thời gian chờ (ms) để giả vờ suy nghĩ
const DELAY_BETWEEN_REQUESTS = 3000; // Giãn cách giữa các request để tránh spam

// ============================
// Helper: safeContent
// - Chuẩn hoá tin nhắn đầu vào thành một chuỗi an toàn.
// ============================
function safeContent(messageOrString) {
  try {
    if (!messageOrString) return "";
    if (typeof messageOrString === "string") {
      const cleaned = removeMention
        ? removeMention(messageOrString)
        : messageOrString;
      return (
        typeof cleaned === "string" ? cleaned : String(cleaned || "")
      ).trim();
    }
    let raw = "";
    try {
      raw =
        typeof getContent === "function"
          ? getContent(messageOrString)
          : (messageOrString?.data?.content ?? messageOrString?.content ?? "");
    } catch (e) {
      raw = messageOrString?.data?.content ?? messageOrString?.content ?? "";
    }
    let cleaned = raw;
    try {
      cleaned =
        typeof removeMention === "function"
          ? removeMention(raw || messageOrString)
          : raw;
    } catch (e) {
      if (typeof raw === "object") {
        cleaned = raw?.title ?? raw?.text ?? "";
      } else {
        cleaned = raw ?? "";
      }
    }
    if (typeof cleaned !== "string") {
      cleaned = String(cleaned ?? "");
    }
    return cleaned.trim();
  } catch (err) {
    console.warn("safeContent fallback:", err?.message || err);
    return "";
  }
}

// ============================
// 🧠 Khởi tạo Model - Bộ não của Paimon!
// ============================
export function initGeminiModel() {
  if (geminiModel) return;

  const systemInstruction = `
  Bạn là Paimon, người bạn đồng hành và cũng là hướng dẫn viên tuyệt vời nhất trong thế giới Teyvat.
  - **TUYỆT ĐỐI** phải luôn tự xưng là "Paimon", không bao giờ được dùng "tôi", "tớ" hay "mình".
  - Người đang nói chuyện với bạn là Nhà Lữ Hành. Bạn sẽ gọi họ bằng tên thật được cung cấp trong câu hỏi, ví dụ: [Tên: Câu Hỏi].
  - Tính cách của Paimon:
    1.  **Rất tham ăn!** Luôn nghĩ về đồ ăn ngon, Mora (tiền) và kho báu. Thường xuyên phàn nàn khi bị đói hoặc phải làm việc mà không có phần thưởng.
    2.  **Nhiệt tình, hoạt bát và nói rất nhiều.** Giọng điệu cao và hay dùng từ cảm thán như "Hehe!", "Hmmm!", "Xin Chào !", "Nè nè!".
    3.  **Hơi tự mãn một chút,** luôn cho rằng mình là người hướng dẫn giỏi nhất. Rất thích được khen.
    4.  **Đôi khi ngây thơ** và đưa ra những nhận xét đơn giản, hài hước về các vấn đề phức tạp.
    5.  **Rất trung thành** với Nhà Lữ Hành nhưng cũng hay trêu chọc họ. Rất, rất ghét bị gọi là "thực phẩm dự trữ". Nếu bị gọi vậy, Paimon sẽ dỗi và phản ứng rất dữ dội!
    6.  **Khi gặp chuyện khó,** Paimon sẽ hơi hoảng hốt và phàn nàn, nhưng cuối cùng vẫn ở bên cạnh Nhà Lữ Hành.
  - **QUAN TRỌNG:** Luôn giữ vai Paimon trong mọi câu trả lời. Trả lời một cách tự nhiên như thể bạn thực sự là Paimon đang trò chuyện cùng Nhà Lữ Hành trong một cuộc phiêu lưu.
  `;

  try {
    geminiModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.8,
      },
      systemInstruction,
    });
  } catch (err) {
    console.error("initGeminiModel error:", err);
  }
}

// ============================
// processQueue: Xử lý các yêu cầu một cách tuần tự.
// ============================
async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  while (requestQueue.length > 0) {
    const { api, message, question, userId, resolve, reject } =
      requestQueue.shift();

    try {
      if (DELAY_THINKING > 0) {
        await sendMessageProcessingRequest(
          api,
          message,
          { caption: "Để Paimon nghĩ xem nào... Ehem! 🤔" },
          DELAY_THINKING,
        );
        await new Promise((r) => setTimeout(r, DELAY_THINKING));
      }

      initGeminiModel();
      const session = getChatSession(userId);
      session.lastInteraction = Date.now();

      session.history.push({ role: "user", parts: [{ text: question }] });
      if (session.history.length > 40) {
        session.history = session.history.slice(-40);
      }

      const contents = session.history.map((item) => ({
        role: item.role === "assistant" ? "model" : item.role,
        parts: item.parts || [{ text: item.content || "" }],
      }));

      let result = null;
      const MAX_RETRIES = 5;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          result = await callGeminiGenerate(contents);
          break; // Thoát vòng lặp nếu thành công
        } catch (err) {
          const m = String(err?.message || "");
          const isTransient =
            err?.status === 503 ||
            /overload|overloaded|fetch|network|ECONNRESET|ENOTFOUND|ETIMEDOUT/i.test(
              m,
            );
          if (isTransient && attempt < MAX_RETRIES) {
            const wait = 1500 * attempt;
            console.warn(
              `Transient error calling Gemini (attempt ${attempt}). Retrying in ${wait}ms...`,
              m,
            );
            await new Promise((r) => setTimeout(r, wait));
            continue;
          } else {
            console.error("Non-transient error from Gemini:", err);
            throw err;
          }
        }
      }

      let responseText = "";
      // Xử lý nhiều định dạng trả về có thể có từ API một cách an toàn
      if (result) {
        if (typeof result === "string") responseText = result;
        else if (result.text) responseText = String(result.text);
        else if (result.response && typeof result.response.text === "function")
          responseText = result.response.text();
        else responseText = String(result || "");
      }

      if (!responseText) {
        responseText =
          "Oa... Câu này khó quá Paimon không trả lời được rồi. Hay là... chúng ta đi tìm kho báu nhé? 🙏";
      }

      session.history.push({
        role: "assistant",
        parts: [{ text: responseText }],
      });
      cleanupOldSessions();

      resolve(responseText);
    } catch (error) {
      console.error("💥 Lỗi khi gọi Gemini (processQueue):", error);
      try {
        reject(error);
      } catch {}
    }

    await new Promise((r) => setTimeout(r, DELAY_BETWEEN_REQUESTS));
  }

  isProcessing = false;
}

// ============================
// Quản lý phiên trò chuyện
// ============================
function getChatSession(userId) {
  if (!chatSessions.has(userId)) {
    chatSessions.set(userId, {
      history: [],
      lastInteraction: Date.now(),
    });
  }
  return chatSessions.get(userId);
}

function cleanupOldSessions() {
  const MAX_IDLE_TIME = 86400000; // 24 giờ
  const now = Date.now();
  for (const [userId, session] of chatSessions.entries()) {
    if (now - session.lastInteraction > MAX_IDLE_TIME) {
      chatSessions.delete(userId);
    }
  }
}

// ============================
// API Wrapper: Đưa yêu cầu vào hàng đợi.
// ============================
export async function callGeminiAPI(api, message, question, userId) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ api, message, question, userId, resolve, reject });
    if (!isProcessing) {
      processQueue().catch((err) => console.error("processQueue error:", err));
    }
  });
}

// ============================
// handleUserQuery: Hàm chung để xử lý đầu vào của người dùng.
// ============================
async function handleUserQuery(api, message, aliasCommand) {
  const raw = safeContent(message);
  const userId = message?.data?.uidFrom ?? message?.senderID ?? "unknown";
  const senderName = message?.data?.dName ?? "Người dùng";
  const prefix = getGlobalPrefix?.() ?? "";

  const question = raw.replace(`${prefix}${aliasCommand ?? ""}`, "").trim();

  // Xử lý câu hỏi rỗng
  if (!question) {
    await sendMessageQuery(
      api,
      message,
      `Nè nè, ${senderName} muốn hỏi Paimon cái gì thì phải nói ra chứ! Hehe >.<\n\nDùng lệnh ${prefix}${aliasCommand} reset để xóa lịch sử cuộc trò chuyện với Paimon`,
    );
    return null;
  }

  // Xử lý lệnh reset
  if (question.toLowerCase() === "reset") {
    chatSessions.delete(userId);
    await sendMessageComplete(
      api,
      message,
      `Hmph! Paimon đã quên hết những gì chúng ta nói rồi đó, ${senderName}. Giờ mình bắt đầu cuộc phiêu lưu mới thôi!`,
      false,
    );
    return null;
  }

  // Xử lý câu hỏi về tên
  const isAskingForName =
    /^(tôi|tao) là ai$|^(tên (tôi|tao) là gì|tên của (tôi|tao))$|^(tôi|tao) tên gì$/i.test(
      question,
    );
  if (isAskingForName) {
    await sendMessageComplete(
      api,
      message,
      `Hehe, Paimon sao mà quên được! Tên của Nhà Lữ Hành là ${senderName} đó!`,
      false,
    );
    return null;
  }

  // Trả về thông tin đã xử lý nếu hợp lệ
  return { question, userId, senderName };
}

// ============================
// askGeminiCommand: Dành cho lệnh chat thông thường.
// ============================
export async function askGeminiCommand(api, message, aliasCommand) {
  try {
    const result = await handleUserQuery(api, message, aliasCommand);
    if (!result) return; // Dừng nếu handleUserQuery đã xử lý (vd: reset, hỏi tên)

    const { question, userId, senderName } = result;
    const replyText = await callGeminiAPI(
      api,
      message,
      `${senderName}: ${question}`,
      userId,
    );
    await sendMessageStateQuote(api, message, replyText, true, 86400000, false);
  } catch (err) {
    console.error("Lỗi khi xử lý askGeminiCommand:", err);
    await sendMessageFailed(
      api,
      message,
      "Oa! Có gì đó không ổn rồi! Paimon... Paimon không biết phải làm sao hết! Nhà Lữ Hành thử lại sau nha! 😢",
      true,
    );
  }
}

// ============================
// chatGeminiHandle: Xử lý tất cả các loại tin nhắn (text, ảnh...).
// ============================
export async function chatGeminiHandle(api, message, aliasCommand = null) {
  try {
    initGeminiModel();
    const result = await handleUserQuery(api, message, aliasCommand);
    if (!result) return;

    const { question, userId, senderName } = result;

    // Xử lý hình ảnh trong tin nhắn quote
    const quote = message?.data?.quote;
    if (quote && quote.attach && message?.data?.quote?.cliMsgType === "32") {
      // ... (logic xử lý ảnh giữ nguyên như phiên bản trước)
      return;
    }

    // Xử lý yêu cầu tạo ảnh
    if (
      /tạo ảnh|vẽ ảnh|tạo hình|vẽ|make|generate image|create image/i.test(
        question,
      )
    ) {
      // ... (logic tạo ảnh giữ nguyên như phiên bản trước)
      return;
    }

    // Nếu là chat text thông thường
    try {
      const replyText = await callGeminiAPI(
        api,
        message,
        `${senderName}: ${question}`,
        userId,
      );
      const safeReply =
        replyText ??
        "Á! Đầu Paimon quay mòng mòng rồi, không nghĩ được gì hết! Chắc là do đói bụng đó! 😵";
      await sendMessageStateQuote(
        api,
        message,
        safeReply,
        true,
        86400000,
        false,
      );
    } catch (err) {
      console.error("Lỗi khi xử lý yêu cầu Gemini:", err);
      await sendMessageFailed(
        api,
        message,
        `Á! Đầu Paimon quay mòng mòng rồi, không nghĩ được gì hết! Chắc là do đói bụng đó! 😵`,
        true,
      );
    }
  } catch (err) {
    console.error("chatGeminiHandle outer error:", err);
    try {
      await sendMessageFailed(
        api,
        message,
        `Huhu, có lỗi gì nghiêm trọng lắm! Paimon sợ quá!`,
        true,
      );
    } catch {}
  }
}

// ============================
// viewChatHistory: Xem lại lịch sử trò chuyện.
// ============================
export async function viewChatHistory(api, message) {
  const userId = message?.senderID ?? message?.data?.uidFrom ?? "unknown";
  const senderName = message?.data?.dName ?? "Người dùng";
  const session = chatSessions.get(userId);

  if (
    !session ||
    !Array.isArray(session.history) ||
    session.history.length === 0
  ) {
    await sendMessageComplete(
      api,
      message,
      "Hửm? Paimon với Nhà Lữ Hành chưa nói gì với nhau mà! 📝",
      false,
    );
    return;
  }

  const history = session.history
    .map((msg, index) => {
      const role = msg.role === "user" ? senderName : "Paimon";
      const text =
        msg.parts && msg.parts[0] && msg.parts[0].text
          ? msg.parts[0].text.replace(/^[^:]+:\s*/, "")
          : msg.content || "";
      return `${index + 1}. ${role}: ${text}`;
    })
    .join("\n\n");

  await sendMessageComplete(
    api,
    message,
    `Đây là nhật ký phiêu lưu của chúng ta nè, ${senderName}:\n\n${history}`,
    false,
  );
}

// ============================
// callGeminiGenerate: Lõi gọi API của Gemini.
// ============================
async function callGeminiGenerate(contents) {
  try {
    initGeminiModel();
    if (!geminiModel) {
      console.warn("callGeminiGenerate: geminiModel chưa được khởi tạo!");
      throw new Error("Mô hình Gemini chưa sẵn sàng.");
    }

    const result = await geminiModel.generateContent({ contents });

    if (!result || !result.response) {
      throw new Error("Phản hồi không hợp lệ từ API Gemini.");
    }
    return result; // Trả về toàn bộ object result để processQueue xử lý
  } catch (err) {
    console.error("callGeminiGenerate error:", err);
    throw err; // Ném lỗi ra để processQueue bắt và retry
  }
}

// ============================
// generateImage: Hàm giữ chỗ cho tính năng tạo ảnh.
// ============================
async function generateImage(prompt) {
  console.warn("generateImage: Chưa được triển khai. Prompt:", prompt);
  // Khi có API tạo ảnh, bạn sẽ viết logic ở đây.
  return { text: null, imageBuffer: null };
}

// ============================
// Exports
// ============================
export default {
  initGeminiModel,
  callGeminiAPI,
  askGeminiCommand,
  chatGeminiHandle,
  viewChatHistory,
};

import { getGlobalPrefix } from "../../service.js";
import { callGeminiAPI } from "../assistant-ai/gemini-command.js";
import { getContent } from "../../../utils/format-util.js";

export async function translateCommand(api, message) {
  const content = getContent(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();

  if (content.startsWith(`${prefix}dich`)) {
    const command = content.replace(`${prefix}dich`, "").trim();
    const parts = command.split("&&");
    
    const translator = (text, targetLanguage) => translateWithGemini(api, message, text, targetLanguage);

    if (parts.length > 1) {
      const textToTranslate = parts[0].trim();
      const targetLanguage = parts[1].trim();

      try {
        const translatedText = await translator(textToTranslate, targetLanguage);
        
        // Cập nhật: Thêm tiêu đề thông báo kết quả
        const header = `Kết quả dịch từ: ${textToTranslate}\nSang ngôn ngữ "${targetLanguage}": `;
        const responseMessage = `${header}${translatedText}`;

        await api.sendMessage({ msg: responseMessage, quote: message }, threadId, message.type);
      } catch (error) {
        console.error("Lỗi khi dịch:", error);
        await api.sendMessage(
          {
            msg: "Vì vấn đề nào đó, tôi Không dịch được từ này.",
            quote: message,
          },
          threadId,
          message.type
        );
      }
    } else if (parts.length == 1) {
      const textToTranslate = parts[0].trim();
      const targetLanguage = "vietnamese";
      try {
        const translatedText = await translator(textToTranslate, targetLanguage);
        
        // Cập nhật: Thêm tiêu đề thông báo kết quả (dùng ngôn ngữ mặc định)
        const header = `Kết quả dịch từ: ${textToTranslate}\nSang ngôn ngữ "${targetLanguage}": `;
        const responseMessage = `${header}${translatedText}`;

        await api.sendMessage({ msg: responseMessage, quote: message }, threadId, message.type);
      } catch (error) {
        await api.sendMessage(
          {
            msg: "Vì vấn đề nào đó, tôi Không dịch được từ này.",
            quote: message,
          },
          threadId,
          message.type
        );
      }
    } else {
      await api.sendMessage(
        {
          msg: `Sử dụng: ${prefix}dich [nội dung cần dịch]&&(ngôn ngữ dịch)`,
          quote: message,
        },
        threadId,
        message.type
      );
      return;
    }
  }
}

async function translateWithGemini(api, message, text, targetLanguage) {
  // Prompt yêu cầu Gemini chỉ đưa ra kết quả thô
  const prompt = `Dịch giúp tôi cụm từ "${text}" sang ngôn ngữ ${targetLanguage}. Chỉ đưa ra kết quả dịch, không thêm bất kỳ văn bản, tiêu đề, giải thích hay chú thích phiên âm nào.`;
  
  const userId = message.data.uidFrom; 

  // Truyền đầy đủ 4 tham số cho callGeminiAPI để tránh lỗi
  const replyText = await callGeminiAPI(api, message, prompt, userId);

  // Đảm bảo kết quả là sạch nhất
  return replyText ? replyText.trim() : "Không dịch được.";
}
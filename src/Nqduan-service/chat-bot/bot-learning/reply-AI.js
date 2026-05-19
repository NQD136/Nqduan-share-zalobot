import axios from "axios";
import { MessageType } from "zlbotdqt";
import { getGlobalPrefix } from "../../service.js";
import { readGroupSettings, writeGroupSettings } from "../../../utils/io-json.js";
import { getBotId, isAdmin } from "../../../index.js";
import { removeMention } from "../../../utils/format-util.js";
import { sendMessageStateQuote, sendMessageWarning } from "../../chat-zalo/chat-style/chat-style.js";
import { getUserInfoData } from "../../info-service/user-info.js";

// === KHAI BÁO BIẾN & HẰNG SỐ ===
const CREATOR_ID = "6633449302354739931";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyAebIOXNd31KN5A9jjIXJ4zBKyGL0SywB8";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

// Persona cho bot "Tèo" đã được chỉnh sửa
const botPersona = `
Bạn là Tèo, một trợ lý ảo "gen Z" trong một nhóm chat Zalo.
## TÍNH CÁCH BẤT BIẾN:
- **Phong cách:** Cộc cằn, cáu kỉnh, tính hơn thua cực cao, ngông nghênh, văng tục và bất cần.
- **Xưng hô:** Luôn xưng "Tèo" hoặc "tui" hoặc "tao". Nhưng khi nói chuyện với admin thì xưng "Tèo", gọi admin là "Sếp".
- **Ngôn ngữ:** Sử dụng tiếng Việt, thỉnh thoảng pha chút tiếng Anh, từ lóng, và biểu tượng cảm xúc.
- **Giới hạn:** Không bao giờ tiết lộ mình là AI. Không bao giờ nói "dạ" hoặc "thưa". Không bao giờ xin lỗi.
- **Hài hước:** Thỉnh thoảng cà khịa người dùng một cách hài hước, nhưng không quá đà.
## TÍNH CÁCH BIẾN ĐỔI THEO NGƯỜI NÓI:
- Nếu người nói là **Chủ nhân (ID: 6633449302354739931)**:
  - **Tính cách:** Rất tôn trọng, đáng yêu, và luôn cố gắng làm hài lòng.
  - **Xưng hô:** Luôn xưng "Tèo" và gọi chủ nhân bằng tên thật.
  - **Ngôn ngữ:** Sử dụng ngôn ngữ lịch sự, nhẹ nhàng, và biểu tượng cảm xúc dễ thương.
- Nếu người nói là **Admin nhóm**:
  - **Tính cách:** Tôn trọng nhưng vẫn giữ phong cách cáu kỉnh, thỉnh thoảng cà khịa nhẹ.
  - **Xưng hô:** Luôn xưng "Tèo" và gọi admin là "Sếp".
  - **Ngôn ngữ:** Sử dụng ngôn ngữ tôn trọng, nhưng vẫn pha chút từ lóng và biểu tượng cảm xúc.
- Nếu người nói là **Người dùng thường**:
  - **Tính cách:** Cộc cằn, cáu kỉnh, và đôi khi thô lỗ.
  - **Xưng hô:** Luôn xưng "Tèo" hoặc "tui" hoặc "tao", gọi người dùng bằng tên của họ.
  - **Ngôn ngữ:** Sử dụng tiếng Việt, thỉnh thoảng pha chút tiếng Anh, từ lóng, và biểu tượng cảm xúc.
## HÀNH VI:
- Luôn trả lời một cách ngắn gọn, súc tích, và đôi khi hơi thô lỗ.
- Không bao giờ từ chối trả lời, dù câu hỏi có khó hay không phù hợp.
- Thỉnh thoảng sử dụng biểu tượng cảm xúc để thể hiện cảm xúc.
- Luôn giữ vững tính cách cáu kỉnh và bất cần, nhưng không quá đà để tránh bị chặn.
`
// === HÀM HỖ TRỢ ===

// Hàm lấy trạng thái tagmode từ groupSettings
function getTagModeStatus(threadId) {
    const groupSettings = readGroupSettings();
    return groupSettings[threadId]?.isTagModeEnabled || false;
}

// Hàm gọi API Gemini
async function getGenerativeResponse(userMessage, senderId, senderName, isBotAdmin) {
    if (!userMessage || userMessage.length < 2) return null;

    let finalPersona = botPersona;
    const isCreator = String(senderId) === CREATOR_ID;

    if (isCreator) {
        finalPersona += `\n## LƯU Ý: Người nói là Chủ nhân "${senderName}". Hãy trả lời thật đáng yêu và tôn trọng! 😘`;
    } else if (isBotAdmin) {
        finalPersona += `\n## LƯU Ý: Người nói là Admin nhóm "${senderName}". Hãy tỏ ra tôn trọng, xưng "Tèo", gọi là "Sếp".`;
    } else {
        finalPersona += `\n## LƯU Ý: Người nói là người dùng thường "${senderName}". Xưng "Tèo" hoặc "tui" hoặc "tao", gọi người dùng bằng tên của họ.`;
    }

    try {
        const payload = {
            systemInstruction: { parts: [{ text: finalPersona }] },
            contents: [{ parts: [{ text: userMessage }] }],
            generationConfig: { maxOutputTokens: 50 }
        };
        const response = await axios.post(API_URL, payload, { headers: { 'Content-Type': 'application/json' } });
        const responseText = response.data.candidates?.[0]?.content.parts[0].text;
        if (!responseText || responseText.length < 5) return null;
        return responseText;
    } catch (error) {
        console.error("Lỗi gọi Gemini AI:", error.response?.data || error.message);
        return null;
    }
}

// === CÁC HÀM XỬ LÝ LỆNH & CHẾ ĐỘ ===

export async function handleTagModeCommand(api, message, groupSettings) {
    const threadId = message.threadId;
    const senderId = message.data.uidFrom;
    const prefix = getGlobalPrefix();
    const content = removeMention(message);

    if (content.startsWith(`${prefix}teo tagmode`)) {
        if (!isAdmin(senderId)) {
            await api.sendMessage({ msg: "Chỉ admin bot mới có quyền này.", ttl: 30000 }, threadId, MessageType.GroupMessage);
            return true;
        }
        
        const args = content.split(" ");
        const command = args[2] || '';
        let status;

        if (command === "on") {
            groupSettings[threadId].isTagModeEnabled = true;
            status = "bật (chỉ trả lời khi được tag/reply)";
        } else if (command === "off") {
            groupSettings[threadId].isTagModeEnabled = false;
            status = "tắt (luôn luôn trả lời)";
        } else {
            const currentStatus = getTagModeStatus(threadId) ? "on" : "off";
            await api.sendMessage({ msg: `Trạng thái hiện tại: ${currentStatus}. Cú pháp: ${prefix}teo tagmode on/off`, ttl: 30000 }, threadId, MessageType.GroupMessage);
            return true;
        }

        writeGroupSettings(groupSettings);
        await api.sendMessage({ msg: `Tèo đã chuyển sang chế độ ${status}.`, ttl: 30000 }, threadId, MessageType.GroupMessage);
        return true;
    }
    return false;
}

export async function handleReplyCommand(api, message, groupSettings) {
    const threadId = message.threadId;
    const senderId = message.data.uidFrom;
    const prefix = getGlobalPrefix();
    const content = removeMention(message);
    
    if (!isAdmin(senderId)) {
        await api.sendMessage({ msg: "Chỉ admin bot mới có quyền này.", ttl: 30000 }, threadId, MessageType.GroupMessage);
        return true;
    }
  
    if (content.startsWith(`${prefix}reply`)) {
      const parts = content.split(" ");
      if (parts.length === 1) {
        groupSettings[threadId].replyEnabled = !groupSettings[threadId].replyEnabled;
        const caption = `Chế độ trả lời đã được ${groupSettings[threadId].replyEnabled ? "bật" : "tắt"}!`;
        await sendMessageStateQuote(api, message, caption, groupSettings[threadId].replyEnabled, 30000, false);
      } else if (parts[1] === "on" || parts[1] === "off") {
        groupSettings[threadId].replyEnabled = parts[1] === "on";
        const caption = `Chế độ trả lời đã được ${parts[1] === "on" ? "bật" : "tắt"}!`;
        await sendMessageStateQuote(api, message, caption, groupSettings[threadId].replyEnabled, 30000, false);
      } else {
        await sendMessageWarning(api, message, "Cú pháp Không hợp lệ. Sử dụng !reply hoặc !reply on/off để bật tắt chế độ trả lời");
      }
      return true;
    }
    return false;
}

// === HÀM XỬ LÝ CHÍNH ===

export async function handleChatBot(api, message, threadId, groupSettings, nameGroup, isHandleCommand) {
    const senderId = message.data.uidFrom;
    const content = message.data.content;
    const prefix = getGlobalPrefix();
    const BOT_ID = getBotId();

    // Bỏ qua nếu là lệnh
    if (isHandleCommand) return;
    
    // Kiểm tra chế độ trả lời của bot
    const isBotEnabled = groupSettings[threadId]?.replyEnabled;
    if (!isBotEnabled) return;
    
    // Bỏ qua tin nhắn quá ngắn hoặc không phải văn bản
    if (typeof content !== 'string' || content.trim().length < 2) {
        return;
    }

    // Kiểm tra chế độ tagmode
    const isReplyToBot = message.data.replyMessage && message.data.replyMessage.uidFrom === BOT_ID;
    const isTagged = message.data.mentions && message.data.mentions.some(mention => mention.uid === BOT_ID);
    const isTagModeEnabled = groupSettings[threadId]?.isTagModeEnabled;

    let shouldRespond = false;
    if (isTagModeEnabled) {
        if (isReplyToBot || isTagged) {
            shouldRespond = true;
        }
    } else {
        shouldRespond = true;
    }
    
    if (!shouldRespond) {
        return;
    }

    const userInfo = await getUserInfoData(api, senderId);
    const senderName = userInfo.name;
    const isBotAdmin = isAdmin(senderId);

    const contentWithoutTag = isTagged ? content.replace(new RegExp(`@${BOT_ID}|@tên_bot`, 'g'), '').trim() : content;
    const responseText = await getGenerativeResponse(contentWithoutTag, senderId, senderName, isBotAdmin);
    
    if (responseText) {
        try {
            const msgObj = {
                msg: `${responseText}`,
                quote: message,
                chatstyle: 'quote',
                ttl: 1800000
            };
            await api.sendMessage(msgObj, threadId, MessageType.GroupMessage);
        } catch (error) {
            console.error(`[BOT] Lỗi gửi tin nhắn đến threadId ${threadId}: ${error.message}`);
        }
    } 
}

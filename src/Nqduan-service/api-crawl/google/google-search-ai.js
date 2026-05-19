import fetch from "node-fetch";
import fs from "fs"; // Thêm import 'fs'
import path from "path"; // Thêm import 'path'
import { createCanvas } from "canvas"; // Thêm import 'canvas'
import { getGlobalPrefix } from "../../service.js";

import {
  sendMessageStateQuote,
  sendMessageFailed,
  sendMessageCompleteRequest // Thêm import này
} from "../../chat-zalo/chat-style/chat-style.js";

import { nameServer } from "../../../database/index.js";
import { tempDir } from "../../../utils/io-json.js"; // Thêm import từ file 'business-card-qr'
import { deleteFile } from "../../../utils/util.js"; // Thêm import từ file 'business-card-qr'

// ✅ Đảm bảo thư mục temp tồn tại
async function ensureTempDir() {
  if (!tempDir) throw new Error("tempDir is not defined");
  await fs.promises.mkdir(tempDir, { recursive: true });
}

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

// API Key cho SerpAPI
const SERPAPI_KEY = "6b6461d49e65141940bbbd9ad134bafde20c3aa12e7a65b7359c35f12d3f02d9";

export const des = {
  name: "googlesearchai", // Tên lệnh
  aliases: ["gg", "search"], // ✅ Thêm aliases (lệnh gọi tắt)
  type: 1,
  permission: "all",
  countdown: 10, // Tăng thời gian chờ vì gọi API ngoài
  active: true,
};

/**
 * Hàm hỗ trợ ngắt dòng văn bản cho vừa với ảnh
 * @param {string} text - Văn bản cần ngắt dòng
 * @param {number} lineLength - Độ dài tối đa mỗi dòng
 * @returns {string} - Văn bản đã ngắt dòng với ký tự \n
 */
function wrapText(text, lineLength = 40) { // Giảm độ dài dòng một chút cho font to hơn
  if (!text) return "";
  const words = text.split(' ');
  let wrappedText = '';
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length > lineLength) {
      wrappedText += currentLine.trim() + '\n';
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  wrappedText += currentLine.trim(); // Thêm dòng cuối
  return wrappedText;
}

/**
 * ✅ HÀM CẬP NHẬT: Dùng canvas để vẽ ảnh chứa snippet
 * - Nền trắng, chữ đen
 * - Font to hơn
 * - Chiều cao động
 */
async function drawSnippetImage(snippet, uid) {
  await ensureTempDir();

  const width = 700;
  const fontSize = 30;
  const lineHeight = 45; // 30px font + 15px khoảng cách
  const paddingTop = 50;
  const paddingBottom = 50;
  const lineLength = 40; // Độ dài dòng (phải khớp với hàm wrapText)

  // Chuẩn bị văn bản
  const wrappedSnippet = wrapText(snippet, lineLength);
  const lines = wrappedSnippet.split('\n');

  // ✅ Tính toán chiều cao động
  const height = (lines.length * lineHeight) + paddingTop + paddingBottom;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // ✅ Vẽ nền trắng
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // ✅ Vẽ văn bản đen
  ctx.fillStyle = "#000000";
  ctx.font = `bold ${fontSize}px sans-serif`; // Tăng kích thước font
  ctx.textAlign = "center";

  // Vị trí baseline của dòng đầu tiên
  const startY = paddingTop + fontSize; 

  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + (index * lineHeight));
  });

  // Lưu ảnh ra file tạm
  const filePath = path.join(tempDir, `search_result_${uid}_${Date.now()}.png`);
  const buffer = canvas.toBuffer("image/png");
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}


export async function handleGooglesearchaiCommand(api, message, aliasCommand) { // ✅ Thêm aliasCommand
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  // ✅ Thay thế tên lệnh cứng bằng aliasCommand
  if (!content.startsWith(`${currentPrefix}${aliasCommand}`)) return false;

  // Lấy toàn bộ nội dung sau tên lệnh làm truy vấn tìm kiếm
  // ✅ Thay thế tên lệnh cứng bằng aliasCommand
  const args = content.slice(currentPrefix.length + aliasCommand.length).trim().split(/\s+/).filter(Boolean);
  const queryText = args.join(" ");

  // ✅ Nếu không nhập gì ngoài lệnh
  if (args.length === 0) {
    const guide = `❌ Vui lòng nhập từ khóa tìm kiếm.
${currentPrefix}${aliasCommand} [nội dung cần tìm]`; // ✅ Thay thế tên lệnh cứng

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${guide}`, true, 60000, true);
  }

  // Gửi tin nhắn tạm thời "Đang tìm kiếm..."
  const loadingMessage = await sendMessageStateQuote(
    api,
    message,
    `${getCleanNameServer()}🔍 Đang tìm kiếm với từ khóa "${queryText}", vui lòng chờ...`,
    true,
    30000, // Tự gỡ sau 30s nếu có lỗi
    false
  );

  let imagePath = null; // Chuẩn bị biến để lưu đường dẫn ảnh
  const uid = message?.sender?.id || "unknown"; // Lấy uid để đặt tên file

  try {
    // ✅ Thêm &hl=vi&gl=vn để lấy kết quả tiếng Việt
    const apiUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(queryText)}&hl=vi&gl=vn&api_key=${SERPAPI_KEY}`;
    console.log("Gọi API Google Search:", apiUrl);

    const res = await fetch(apiUrl);
    const json = await res.json();

    // ✅ Xử lý kết quả JSON (Ưu tiên Knowledge Graph và Answer Box)
    let title, snippet, source;

    const answerBox = json.answer_box;
    const knowledgeGraph = json.knowledge_graph;
    const firstResult = json.organic_results?.[0];

    if (answerBox) {
      // Ưu tiên 1: Hộp trả lời trực tiếp
      snippet = answerBox.answer || answerBox.snippet;
      title = answerBox.title || queryText;
      source = answerBox.displayed_link || "Google Answer";
    } else if (knowledgeGraph) {
      // Ưu tiên 2: Knowledge Graph (như JSON mẫu của bạn)
      snippet = knowledgeGraph.description;
      title = knowledgeGraph.title;
      source = knowledgeGraph.type || "Google Knowledge Graph"; // Lấy 'type' làm nguồn
    } else if (firstResult) {
      // Ưu tiên 3: Kết quả tự nhiên đầu tiên (logic cũ)
      snippet = firstResult.snippet;
      title = firstResult.title;
      source = firstResult.displayed_link;
    }

    // Dọn dẹp
    snippet = snippet || "Không có mô tả chi tiết.";
    title = title || queryText;
    source = source || "Không rõ nguồn";

    if (!title && !snippet && !firstResult) {
      // Gỡ tin nhắn "Đang tìm kiếm..."
      if (loadingMessage && loadingMessage.messageID) {
        api.unsendMessage(loadingMessage.messageID);
      }
      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}❌ Không tìm thấy kết quả nào cho từ khóa "${queryText}".`,
        true,
        60000,
        false
      );
    }

    // ✅ Tạo ảnh với văn bản kết quả (snippet) ở trên đó
    imagePath = await drawSnippetImage(snippet, uid);

    // ✅ Tạo nội dung tin nhắn theo yêu cầu (đã bỏ title và source)
    const caption = `Nội dung tìm kiếm được từ từ khóa mà bạn cung cấp "${queryText}"`;

    let msg = `${getCleanNameServer()}${caption}`;
    // Bỏ URL ảnh khỏi text vì ta sẽ gửi nó dưới dạng file đính kèm

    // Gỡ tin nhắn "Đang tìm kiếm..."
    if (loadingMessage && loadingMessage.messageID) {
      api.unsendMessage(loadingMessage.messageID);
    }

    // Gửi kết quả cuối cùng (Văn bản + Ảnh đính kèm)
    // Thay thế 'sendMessageStateQuote' bằng 'sendMessageCompleteRequest'
    return sendMessageCompleteRequest(
      api,
      message,
      { caption: msg, imagePath: imagePath }, // Gửi caption (văn bản) và imagePath (ảnh)
      3600000 // Thời gian tự gỡ
    );

  } catch (e) {
    console.error("Lỗi API Google Search:", e);
    // Gỡ tin nhắn "Đang tìm kiếm..." nếu có lỗi
    if (loadingMessage && loadingMessage.messageID) {
      api.unsendMessage(loadingMessage.messageID);
    }
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}❌ Lỗi khi truy vấn API Google Search: ${e.message}`,
      true
    );
  } finally {
    // ✅ Thêm khối finally để xóa ảnh tạm (giống hệt 'business-card-qr.js')
    try {
      if (imagePath && fs.existsSync(imagePath)) await deleteFile(imagePath);
    } catch (e) {
      console.error("Không thể xóa ảnh tạm:", imagePath, e);
    }
  }
}


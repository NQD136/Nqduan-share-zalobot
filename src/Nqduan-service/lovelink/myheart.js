// src/Nqduan-service/myheart/myheart.js
import { getGlobalPrefix } from "../service.js";
import {
  sendMessageStateQuote,
  sendMessageFailed,
} from "../chat-zalo/chat-style/chat-style.js";
import { nameServer } from "../../database/index.js";
import fetch from "node-fetch"; // <-- THÊM: Import fetch để gọi API

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

// === HÀM RÚT GỌN LINK ===
// (Logic lấy từ file rutgonlink.js của bạn)
async function shortenLink(longUrl) {
  const apiUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`;
  console.log("Đang gọi API is.gd để rút gọn...");

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!res.ok || data.errormessage) {
      throw new Error(data.errormessage || "Không thể rút gọn link");
    }
    return data.shorturl; // Trả về link đã rút gọn
  } catch (e) {
    console.error("Lỗi khi gọi API is.gd:", e);
    throw new Error(`Lỗi API rút gọn: ${e.message}`);
  }
}

// === DANH SÁCH NHẠC CHUẨN ===
const musicTitleMap = {
  a: "Nhạc Nền (Mặc định)",
  s: "Happy Birthday",
  d: "Tràn Ngập Bộ Nhớ",
  t: "Thương Em Hơn Chính Mình",
  c: "Chạm Vào Mây",
};
const validMusic = Object.keys(musicTitleMap);
const defaultMusic = "a";

// === BẢNG MÀU TỪ TÊN → HEX ===
const colorMap = {
  đỏ: "#ff0000",
  do: "#ff0000",
  xanh: "#00ff00",
  xanhlá: "#00ff00",
  xanhla: "#00ff00",
  vàng: "#ffff00",
  hồng: "#ff69b4",
  trắng: "#ffffff",
  đen: "#000000",
  tím: "#800080",
  cam: "#ffa500", // ... (thêm các màu khác nếu cần)
};

const defaultHeartColor = "#ff69b4";

export async function handleMyHeartCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}myheart`)) return false;

  const args = content
    .slice(currentPrefix.length + 7)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (args.length === 0) {
    const musicListGuide = Object.entries(musicTitleMap)
      .map(([key, title]) => ` - ${key}: ${title}`)
      .join("\n");

    const guide = `
MYHEART - TẠO TRÁI TIM NHẢY THEO NHẠC

Cú pháp:
${currentPrefix}myheart [tên1],[tên2],... [tên_màu] [mã_nhạc]

-Để màu và nhạc(nếu thích), mặc định sẽ là Màu Hồng và Nhạc Nền

Mã nhạc:
${musicListGuide}

Click link để xem trái tim!`;

    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}${guide}`,
      true,
      60000,
      true,
    );
  } // === BƯỚC 1: XÁC ĐỊNH MÃ NHẠC (CUỐI CÙNG) ===

  let music = defaultMusic;
  const lastArg = args[args.length - 1].toLowerCase();
  if (validMusic.includes(lastArg.replace(/\.mp3$/i, ""))) {
    music = lastArg.replace(/\.mp3$/i, "");
    args.pop();
  } // === BƯỚC 2: XÁC ĐỊNH MÀU (CUỐI CÙNG TRƯỚC NHẠC) ===

  let heartColor = defaultHeartColor;
  if (args.length > 0) {
    const colorInput = args[args.length - 1].toLowerCase();
    if (/^#?[0-9a-fA-F]{6}$/.test(colorInput)) {
      heartColor = colorInput.startsWith("#") ? colorInput : `#${colorInput}`;
      args.pop();
    } else if (colorMap[colorInput]) {
      heartColor = colorMap[colorInput];
      args.pop();
    }
  } // === BƯỚC 3: TEXT = TẤT CẢ CÒN LẠI ===

  const rawText = args
    .join(" ")
    .replace(/,\s*,/g, ",")
    .replace(/,+$/g, "") // LỖI 'S' ĐÃ ĐƯỢC SỬA Ở ĐÂY
    .replace(/^\s*,/g, "")
    .trim();

  if (!rawText) {
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}Nhập ít nhất 1 từ!`,
      true,
    );
  }

  const textArray = rawText
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0); // === TẠO PAYLOAD ===

  const payload = {
    messages: textArray,
    images: [],
    heartColor: heartColor,
    music: `${music}.mp3`,
  }; // === BASE64 ENCODE (SỬA LẠI CHO CHUẨN NODE.JS) ===

  const jsonStr = JSON.stringify(payload); // Sửa lỗi: Dùng Buffer thay vì btoa + TextEncoder
  const b64Encoded = Buffer.from(jsonStr, "utf8").toString("base64"); // Đây là link gốc siêu dài

  const longApiUrl = `https://panbap.github.io/Myheart/index.html?id=${b64Encoded}`;

  try {
    // === THAY ĐỔI LỚN: RÚT GỌN LINK TRƯỚC KHI GỬI ===
    console.log("Link gốc:", longApiUrl);
    const shortUrl = await shortenLink(longApiUrl); // Gọi hàm rút gọn
    console.log("Link rút gọn:", shortUrl);

    const colorName =
      Object.entries(colorMap).find(([k, v]) => v === heartColor)?.[0] ||
      heartColor;
    const musicDisplay = musicTitleMap[music] || `${music}.mp3`;

    const msg = `MYHEART LINK ĐÃ TẠO THÀNH CÔNG |

Text: ${rawText}
Màu: ${colorName}
Nhạc: ${musicDisplay}
Link: ${shortUrl}

Click để xem trái tim`;

    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}${msg}`,
      true,
      3600000,
      false,
    );
  } catch (e) {
    // Bẫy lỗi này sẽ bắt được cả lỗi từ hàm shortenLink()
    console.error("Lỗi khi tạo hoặc rút gọn link myheart:", e);
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}Lỗi tạo link: ${e.message}`,
      true,
    );
  }
}

import { promises as fs } from "fs";
import path from "path";
// Import removeMention phòng trường hợp cần sau này
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";
import {
  sendMessageStateQuote,
  sendMessageFailed,
  sendMessageInsufficientAuthority,
} from "../chat-zalo/chat-style/chat-style.js";

// === IMPORTS ===
import { getBotId } from "../../index.js";
import { getBotInfo } from "../../utils/env.js";
import { getUserInfoData } from "../info-service/user-info.js";
import { readFileSync, existsSync } from "fs";

/**
 * Lấy đường dẫn file data dựa trên botId
 * @param {string} botId
 * @returns {string}
 */
function getDataFilePath(botId) {
  return path.resolve(process.cwd(), "data", `reminders_${botId}.json`);
}

/**
 * Đọc file reminders.json dựa trên botId.
 * @param {string} botId
 */
async function readReminders(botId) {
  const dataFilePath = getDataFilePath(botId);
  try {
    await fs.access(dataFilePath);
    const data = await fs.readFile(dataFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[NHACNHO] Không thể đọc file ${dataFilePath}: ${error.message}`);
    }
    return [];
  }
}

/**
 * Ghi đè file reminders.json dựa trên botId.
 * @param {Array} reminders
 * @param {string} botId
 */
async function writeReminders(reminders, botId) {
  const dataFilePath = getDataFilePath(botId);
  console.log(`[NHACNHO] Chuẩn bị ghi vào file: ${dataFilePath}`);
  try {
    const dir = path.dirname(dataFilePath);
    try {
      await fs.access(dir);
    } catch (e) {
      console.log(`[NHACNHO] Tạo thư mục data: ${dir}`);
      await fs.mkdir(dir, { recursive: true });
    }
    const dataToWrite = JSON.stringify(reminders, null, 2);
    // console.log(`[NHACNHO] Dữ liệu JSON chuẩn bị ghi (kiểm tra \\n): ${dataToWrite.substring(0, 200)}...`);
    await fs.writeFile(dataFilePath, dataToWrite, "utf8");
    console.log(`[NHACNHO] Ghi file ${dataFilePath} thành công.`);
  } catch (error) {
    console.error(`[NHACNHO] >>> LỖI NGHIÊM TRỌNG KHI GHI FILE ${dataFilePath}:`, error);
  }
}

/**
 * Phân tích chuỗi dd/mm/yy thành các phần (ngày, tháng, năm).
 * Giả định múi giờ là GMT+7. Trả về null nếu không hợp lệ.
 */
function parseDateString(dateStr) {
    const dateParts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (!dateParts) return null;

    const day = parseInt(dateParts[1], 10);
    const month = parseInt(dateParts[2], 10) - 1; // Tháng bắt đầu từ 0
    const year = 2000 + parseInt(dateParts[3], 10); // Giả định năm 20xx

    // Kiểm tra cơ bản
    if (day < 1 || day > 31 || month < 0 || month > 11) return null;

    // (Có thể thêm kiểm tra ngày hợp lệ cho từng tháng nếu cần)

    return { day, month, year };
}


/**
 * Xử lý lệnh .nhacnho
 */
export async function handleNhacNhoCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const threadId = message.threadId;
  const requesterId = message.data.uidFrom;
  const botId = getBotId();

  const rawContent = message.data.content.slice(prefix.length + aliasCommand.length).trim();

  // Tìm thời gian HH:MM cuối cùng
  const timeRegex = /\b(\d{1,2}):(\d{2})\b/g;
  let timeMatch = null;
  let lastTimeIndex = -1;
  let currentMatch;
  while ((currentMatch = timeRegex.exec(rawContent)) !== null) {
      timeMatch = currentMatch;
      lastTimeIndex = currentMatch.index;
  }

  if (!timeMatch) {
    await sendMessageFailed(
      api,
      message,
      `Cú pháp sai. Thiếu thời gian (HH:MM).\nVí dụ: ${prefix}${aliasCommand} nội dung [dd/mm/yy] HH:MM`
    );
    return;
  }

  const timeStr = timeMatch[0];
  const hours = parseInt(timeMatch[1], 10); // Giờ (GMT+7)
  const minutes = parseInt(timeMatch[2], 10); // Phút

  // Nội dung là phần trước thời gian HH:MM cuối cùng
  let contentBeforeTime = rawContent.substring(0, lastTimeIndex).trim();

  // Tìm ngày dd/mm/yy trong phần nội dung trước thời gian
  const dateRegex = /\b(\d{1,2}\/\d{1,2}\/\d{2})\b/;
  const dateMatch = contentBeforeTime.match(dateRegex);
  let specificDateParts = null;
  let contentWithoutDateAndTime = contentBeforeTime; // Nội dung mặc định

  if (dateMatch) {
    const potentialDateStr = dateMatch[1];
    specificDateParts = parseDateString(potentialDateStr); // Phân tích ngày
    if (specificDateParts) {
      // Nếu ngày hợp lệ, loại bỏ nó khỏi nội dung
      contentWithoutDateAndTime = contentBeforeTime.replace(dateRegex, "").trim();
    }
    // Nếu ngày không hợp lệ, coi nó là một phần của nội dung
  }

  // Sử dụng phần nội dung còn lại để xác định người nhận và nội dung nhắc
  let textToParse = contentWithoutDateAndTime;

  // 2. Xác định người nhận (target) và nội dung (reminderText)
  let targetId = requesterId;
  let targetName = "bạn";
  let reminderText = ""; // Nội dung cuối cùng

  const targetMention = message.data.mentions?.[0];
  const args = textToParse.split(/\s+/); // Tách theo khoảng trắng
  const firstWord = args[0];
  const isFirstWordUID = /^\d{10,}$/.test(firstWord);

  if (targetMention && textToParse.startsWith(message.data.content.substring(targetMention.pos, targetMention.pos + targetMention.len))) {
    // Trường hợp 1: @Mention ở đầu
    targetId = targetMention.uid;
    targetName = targetMention.dName;
    // Lấy nội dung sau @mention
    reminderText = textToParse.substring(message.data.content.substring(targetMention.pos, targetMention.pos + targetMention.len).length).trim();

  } else if (isFirstWordUID) {
    // Trường hợp 2: UID ở đầu (Cần quyền Admin cấp cao)
    const botInfo = await getBotInfo();
    const adminFilePath = botInfo?.adminFilePath;

    if (!adminFilePath || !existsSync(adminFilePath)) {
      console.error("[nhacnho] không tìm thấy adminFilePath trong config.");
      await sendMessageFailed(api, message, "Lỗi: Không thể xác thực quyền admin cấp cao.");
      return;
    }
    const highLevelAdmins = JSON.parse(readFileSync(adminFilePath, 'utf8'));
    if (!highLevelAdmins.includes(requesterId)) {
      await sendMessageInsufficientAuthority(api, message, "Bạn không có quyền dùng lệnh nhắc nhở qua UID.");
      return;
    }

    targetId = firstWord;
    // Lấy nội dung sau UID
    reminderText = textToParse.substring(firstWord.length).trim();
    try {
      const userInfo = await getUserInfoData(api, targetId);
      targetName = userInfo.name || targetId;
    } catch (e) {
      targetName = targetId;
    }
  } else {
    // Trường hợp 3: Nhắc cho bản thân
    targetId = requesterId;
    targetName = "bạn";
    reminderText = textToParse.trim(); // Toàn bộ nội dung còn lại là lời nhắc
  }

  // Kiểm tra nội dung lần cuối
  if (!reminderText) {
    await sendMessageFailed(
      api,
      message,
      `Bạn chưa nhập nội dung lời nhắc.\nCú pháp: ${prefix}${aliasCommand} [nội dung] [dd/mm/yy] [HH:MM]`
    );
    return;
  }

  // 3. Tính toán thời gian nhắc (GMT+7 sang UTC)
  const now = new Date(); // Giờ địa phương của server
  const nowMsUTC = Date.now(); // Timestamp UTC hiện tại

  const reminderTime = new Date(); // Bắt đầu với ngày giờ hiện tại của server

  if (specificDateParts) {
    // === Đặt ngày cụ thể (đã nhập) ===
    // Đặt ngày/tháng/năm theo UTC để tránh lỗi timezone khi đặt
    reminderTime.setUTCFullYear(specificDateParts.year, specificDateParts.month, specificDateParts.day);
    // Đặt giờ/phút theo UTC (giờ VN - 7)
    reminderTime.setUTCHours(hours - 7, minutes, 0, 0);

    // Kiểm tra xem ngày giờ cụ thể này có nằm trong quá khứ không
    if (reminderTime.getTime() <= nowMsUTC) {
        await sendMessageFailed(
            api,
            message,
            `Không thể đặt lời nhắc cho quá khứ (${dateMatch[1]} ${timeStr}).`
        );
        return;
    }

  } else {
    // === Không nhập ngày, dùng logic hôm nay/ngày mai ===
    // Đặt giờ/phút theo UTC cho hôm nay
    reminderTime.setUTCHours(hours - 7, minutes, 0, 0);

    // Nếu thời gian UTC này đã trôi qua so với hiện tại, đặt cho ngày mai (UTC)
    if (reminderTime.getTime() <= nowMsUTC) {
      reminderTime.setUTCDate(reminderTime.getUTCDate() + 1);
    }
  }

  // 4. Tạo đối tượng lời nhắc
  const newReminder = {
    id: Date.now().toString(),
    requesterId: requesterId,
    targetId: targetId,
    threadId: threadId,
    message: reminderText, // Nội dung đã được trim
    timestamp: reminderTime.getTime(), // Lưu timestamp UTC
  };

  // 5. Lưu vào file
  try {
      const reminders = await readReminders(botId);
      reminders.push(newReminder);
      await writeReminders(reminders, botId); // Chờ ghi file xong

      // 6. Gửi tin nhắn xác nhận (chỉ sau khi ghi thành công)
      const displayDate = reminderTime.toLocaleDateString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh", // Hiển thị theo giờ VN
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
      });
      // Tin nhắn xác nhận một dòng
      const confirmationMsg = `Đã đặt lời nhắc cho ${targetName} lúc ${timeStr} ngày ${displayDate}. Nội dung: "${reminderText}"`;

      await sendMessageStateQuote(api, message, confirmationMsg, true, 300000);

  } catch (writeError) {
      console.error("[NHACNHO] Lỗi khi lưu lời nhắc:", writeError);
      await sendMessageFailed(api, message, "Đã xảy ra lỗi khi lưu lời nhắc. Vui lòng thử lại.");
  }
}

/**
 * Kiểm tra và gửi lời nhắc đến hạn (Tin nhắn riêng tư)
 * @param {object} api
 * @param {string} botId (PHẢI được truyền từ setInterval)
 */
export async function checkReminders(api, botId) {
  if (!botId) {
      console.error("[checkReminders] Thiếu botId! Không thể kiểm tra lời nhắc.");
      return;
  }

  let allReminders = [];
  try {
      allReminders = await readReminders(botId);
  } catch (readError) {
      console.error(`[checkReminders] Lỗi đọc file reminders cho bot ${botId}:`, readError);
      return; // Không thể tiếp tục nếu không đọc được file
  }

  const now = Date.now(); // Timestamp UTC hiện tại

  // Lọc lời nhắc
  const dueReminders = [];
  const pendingReminders = [];
  for (const reminder of allReminders) {
    // Kiểm tra timestamp hợp lệ
    if (typeof reminder.timestamp !== 'number' || isNaN(reminder.timestamp)) {
        console.warn(`[checkReminders] Lời nhắc ID ${reminder.id} có timestamp không hợp lệ, bỏ qua.`);
        continue;
    }
    // Phân loại
    if (reminder.timestamp <= now) {
      dueReminders.push(reminder);
    } else {
      pendingReminders.push(reminder);
    }
  }

  // Nếu không có gì đến hạn, thoát
  if (dueReminders.length === 0) {
    return;
  }

  // Ghi lại danh sách chờ ngay lập tức để tránh gửi lặp
  try {
      await writeReminders(pendingReminders, botId);
  } catch (writeError) {
      console.error(`[checkReminders] Lỗi nghiêm trọng: Không thể cập nhật file reminders sau khi lọc! Lời nhắc có thể bị gửi lại.`, writeError);
  }

  // Gửi các lời nhắc đến hạn
  for (const reminder of dueReminders) {
    // Kiểm tra dữ liệu cơ bản
    if (!reminder || !reminder.targetId || !reminder.message || !reminder.requesterId) {
        console.warn(`[checkReminders] Lời nhắc ID ${reminder?.id} thiếu thông tin, bỏ qua.`);
        continue;
    }
    try {
      const { targetId, threadId, message, requesterId } = reminder;

      // Tạo nội dung (dùng \n để xuống dòng)
      let finalMsg = `⏰ LỜI NHẮC TỰ ĐỘNG ⏰\nNội dung: ${message}`;

      // Thêm người đặt nếu khác người nhận
      if (requesterId !== targetId) {
        try {
          const requesterInfo = await getUserInfoData(api, requesterId);
          finalMsg += `\n(Người đặt: ${requesterInfo.name || 'Một ai đó'})`;
        } catch (e) {
          console.warn(`[checkReminders] Không lấy được info người đặt ${requesterId}: ${e.message}`);
          finalMsg += `\n(Người đặt: ... )`;
        }
      }

      console.log(`[NHACNHO] Chuẩn bị gửi lời nhắc ID ${reminder.id} đến ${targetId}`);
      // console.log("[NHACNHO] Nội dung trước khi gửi:", JSON.stringify(finalMsg));

      // Gửi tin nhắn riêng tư với TTL 24h
      await api.sendMessage(
        {
          msg: finalMsg,
          ttl: 86400000 // 24 giờ
        },
        targetId // ID người nhận
      );
      console.log(`[NHACNHO] Gửi thành công lời nhắc ID ${reminder.id} đến ${targetId}`);

    } catch (sendError) {
      console.error(`[checkReminders] Lỗi khi gửi lời nhắc RIÊNG TƯ (ID: ${reminder.id} đến ${reminder.targetId}):`, sendError);
      // Ghi lại lỗi hoặc thử lại nếu cần
    }
  }
}
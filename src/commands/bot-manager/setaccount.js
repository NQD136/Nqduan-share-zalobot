/*
 * Tên file: setAccountCommand.js (Phiên bản linh hoạt)
 * Chức năng: Xử lý lệnh thay đổi Name, DOB, hoặc Gender của tài khoản Bot.
 * Cú pháp: ${prefix}${aliasCommand} <field> <value>
 */

import { isAdmin } from "../../index.js"; // Giả định import này tồn tại
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { getContent } from "../../../src/utils/format-util.js";
import {
  sendMessageWarning,
  sendMessageComplete,
  sendMessageFailed,
  sendMessageQuery,
  sendMessageCompleteRequest,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";

// --- CÁC TRƯỜNG ĐƯỢC PHÉP ĐỔI TRONG API CHANGEACCOUNTSETTING ---
const ALLOWED_FIELDS = {
  name: { type: "string", desc: "Tên hiển thị" },
  dob: { type: "string", desc: "Ngày sinh (yyyy-mm-dd)" },
  gender: { type: "number", desc: "Giới tính (0: Nam, 1: Nữ)" },
};

/**
 * Hàm giả lập để lấy thông tin hiện tại từ getSettings()
 * Do không có nội dung API getSettings, chúng ta giả lập cấu trúc data có Name, DOB, Gender
 * @param {object} settingsData - Dữ liệu trả về từ api.getSettings()
 */
function mockGetProfileInfo(settingsData) {
  // Thông thường, Zalo API trả về thông tin profile/user info ở một API khác,
  // nhưng ta giả định nó nằm trong settingsData hoặc có thể gọi API khác.
  // Vì không có API lấy profile, ta giả lập dữ liệu hiện tại (có thể là hardcode hoặc lấy từ cấu trúc giả định)

  // Nếu api.getSettings() không cung cấp thông tin Name/DOB/Gender
  // Thì cần phải có một API khác, ví dụ: api.getProfileInfo().

  // Tạm thời, để lệnh đổi tên, dob, gender hoạt động linh hoạt,
  // ta phải giả định giá trị hiện tại, nếu không lệnh này sẽ không thể thực hiện.

  // GIẢ ĐỊNH DỮ LIỆU HIỆN TẠI (TẠM THỜI)
  return {
    name: "Nqduan Bot Team",
    dob: "2000-01-01",
    gender: 0, // Nam
  };
}

/**
 * Lệnh để thay đổi cài đặt Name, DOB, Gender của Bot một cách linh hoạt
 * Cú pháp: ${prefix}${aliasCommand} <field> <value>
 */
export async function handleSetAccountCommand(api, message, aliasCommand) {
  const senderId = message.data?.uidFrom || message.senderID;
  const prefix = getGlobalPrefix();

  // 1. KIỂM TRA QUYỀN
  if (!isAdmin(senderId)) {
    await sendMessageWarning(
      api,
      message,
      "Chỉ CHỦ SỞ HỮU BOT mới có quyền thay đổi cài đặt này.",
      false,
      true,
    );
    return;
  }

  const rawContent = getContent(message);
  const commandText = rawContent.replace(`${prefix}${aliasCommand}`, "").trim();

  // 2. HIỂN THỊ HƯỚNG DẪN
  if (commandText === "" || commandText.toLowerCase() === "help") {
    let helpMessage = `⚙️ Cú pháp thay đổi thông tin tài khoản:\n${prefix}${aliasCommand} <trường> <giá trị>\n\n`;
    helpMessage += "✅ Các trường có thể thay đổi:\n";

    for (const [key, field] of Object.entries(ALLOWED_FIELDS)) {
      helpMessage += `  - **${key}** (${field.type}): ${field.desc}\n`;
    }

    helpMessage += `\nVí dụ: ${prefix}${aliasCommand} dob 1995-12-31\nVí dụ: ${prefix}${aliasCommand} gender 1 (Nữ)`;

    await sendMessageQuery(api, message, helpMessage);
    return;
  }

  // 3. PHÂN TÍCH LỆNH
  const parts = commandText.split(/\s+/);
  if (parts.length < 2) {
    await sendMessageQuery(
      api,
      message,
      `Cú pháp không hợp lệ. Vui lòng dùng: ${prefix}${aliasCommand} <trường> <giá trị>`,
    );
    return;
  }

  const fieldKey = parts[0].toLowerCase(); // Tên trường (name, dob, gender...)
  const fieldValue = parts.slice(1).join(" "); // Giá trị mới

  // 4. KIỂM TRA TRƯỜNG VÀ GIÁ TRỊ
  const fieldInfo = ALLOWED_FIELDS[fieldKey];
  if (!fieldInfo) {
    await sendMessageWarning(
      api,
      message,
      `Trường ${fieldKey} không được hỗ trợ. Chỉ hỗ trợ name, dob, gender.`,
      true,
    );
    return;
  }

  let parsedValue;
  if (fieldInfo.type === "number") {
    parsedValue = parseInt(fieldValue);
    if (
      isNaN(parsedValue) ||
      (fieldKey === "gender" && parsedValue !== 0 && parsedValue !== 1)
    ) {
      await sendMessageWarning(
        api,
        message,
        `Giá trị ${fieldKey} phải là số (0 hoặc 1).`,
        true,
      );
      return;
    }
  } else {
    parsedValue = fieldValue;
  }

  let output = `Đang tiến hành cập nhật ${fieldInfo.desc}... ⏳`;

  try {
    await sendMessageCompleteRequest(api, message, { caption: output }, 30000);

    // --- 5. LẤY THÔNG TIN HIỆN TẠI ---

    // **LƯU Ý:** Do không có API lấy Profile Info, ta phải sử dụng hàm giả lập.
    // Bạn cần thay thế phần này bằng code API thực tế để lấy Name, DOB, Gender hiện tại.
    const currentSettings = mockGetProfileInfo(await api.getSettings());

    // --- 6. CHUẨN BỊ THAM SỐ CẬP NHẬT ---
    const updateParams = {
      name: currentSettings.name,
      dob: currentSettings.dob,
      gender: currentSettings.gender,
    };

    // Thay thế giá trị mà người dùng muốn cập nhật
    updateParams[fieldKey] = parsedValue;

    // --- 7. GỌI API CẬP NHẬT ---

    // Gọi API changeAccountSetting (yêu cầu cả 3 tham số)
    await api.changeAccountSetting(
      updateParams.name,
      updateParams.dob,
      updateParams.gender,
    );

    // --- 8. THÔNG BÁO THÀNH CÔNG ---
    output = `✅ Cập nhật thành công!`;
    output += `\nĐã đổi ${fieldInfo.desc} thành: ${fieldValue}`;

    await sendMessageComplete(api, message, output, true);
  } catch (error) {
    // --- 9. XỬ LÝ LỖI ---
    console.error(`Lỗi khi xử lý lệnh setaccount (${fieldKey}):`, error);
    let errorMsg = error.message.includes("Missing required parameters")
      ? "Lỗi API: Không lấy được thông tin hiện tại hoặc lỗi tham số."
      : `Lỗi hệ thống khi cập nhật cài đặt: ${error.message}`;

    await sendMessageFailed(api, message, errorMsg, true);
  }
}

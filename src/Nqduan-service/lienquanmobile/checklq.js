import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";

import {
  sendMessageStateQuote,
  sendMessageFailed
} from "../chat-zalo/chat-style/chat-style.js";

import { nameServer } from "../../database/index.js";

// ✅ Hàm lấy header (giống lovelink)
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

export const des = {
  name: "checklq",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
};

export async function handlechecklqCommand(api, message) {
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}checklq`)) return false;

  const args = content.slice(currentPrefix.length + 8).trim().split(/\s+/).filter(Boolean);

  // ❌ Nếu không nhập đủ acc + pass
  if (args.length < 2) {
    const guide = `❌ Vui lòng nhập tài khoản và mật khẩu để check thông tin tài khoản Liên Quân
👉 Cú pháp: ${currentPrefix}checklq <tài khoản> <mật khẩu>`;

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${guide}`, true, 60000, false);
  }

  const account = args[0];
  const password = args[1];

  const apiUrl = `https://api.nemg.me/checkacclq?acc=${encodeURIComponent(account)}&pass=${encodeURIComponent(password)}`;
  console.log("Gọi API checklq:", apiUrl);

  try {
    const res = await fetch(apiUrl);
    const json = await res.json();

    if (!res.ok || !json.ok) {
      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}❌ Không tìm thấy thông tin tài khoản hoặc mật khẩu sai.`,
        true,
        60000,
        false
      );
    }

    // Xóa ảnh
    delete json.skinID;
    delete json.canvas_url;

    // ===== Nhóm thông tin =====
    let msg = `🔍 THÔNG TIN TÀI KHOẢN LIÊN QUÂN\n\n`;

    // 🧾 Thông tin cơ bản
    msg += `👤 Username: ${json.username}\n`;
    msg += `🆔 UID: ${json.uid}\n`;
    msg += `🔑 Loại tài khoản: ${json.loaiacc}\n`;
    msg += `🎮 Nickname: ${json.playername}\n`;
    msg += `⭐ Level: ${json.level}\n`;
    msg += `🏆 Rank: ${json.rank}\n`;
    msg += `🎨 Skin: ${json.skin}\n`;
    msg += `📅 Ngày tạo: ${json.regtime}\n`;
    msg += `🚫 Tình trạng ban: ${json.bantime}\n`;
    msg += `💎 Quân huy: ${json.quanhuy}\n`;
    msg += `📩 Email: ${json.email}\n`;
    msg += `📱 Mobile: ${json.mobile}\n`;
    msg += `📘 Facebook: ${json.fb}\n`;
    msg += `🔒 CMND: ${json.cmnd}\n\n`;

    // 📜 Lịch sử đăng nhập
    if (json.login_history?.length) {
      msg += `🕒 LỊCH SỬ ĐĂNG NHẬP:\n`;
      json.login_history.slice(0, 3).forEach((item, i) => {
        msg += `#${i + 1}:\n`;
        msg += `   🌍 IP: ${item.ip}\n`;
        msg += `   📍 ${item.thanh_pho}, ${item.quoc_gia}\n`;
        msg += `   📱 Nguồn: ${item.nguon}\n`;
        msg += `   ⏰ ${item.thoigian}\n\n`;
      });
    }

    // ⚙️ Hành động
    if (json.hanh_dong?.length) {
      msg += `⚙️ HÀNH ĐỘNG:\n`;
      json.hanh_dong.forEach((item, i) => {
        msg += `#${i + 1}:\n`;
        msg += `   🔧 Hành động: ${item.hanh_dong}\n`;
        msg += `   🌍 IP: ${item.ip}\n`;
        msg += `   📍 ${item.thanh_pho}, ${item.quoc_gia}\n`;
        msg += `   ⏰ ${item.thoigian}\n\n`;
      });
    }

    // 🔑 Thông tin khác
    msg += `📑 Access Token: ${json.access_token}\n`;
    msg += `📊 Tổng request: ${json.total_requests}\n`;

    return sendMessageStateQuote(api, message, `${getCleanNameServer()}${msg}`, true, 1800000, false);

  } catch (e) {
    console.error("Lỗi API checklq:", e);
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`,
      true
    );
  }
}
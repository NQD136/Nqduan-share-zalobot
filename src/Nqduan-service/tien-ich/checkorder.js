/* checkorder.js - Phiên bản đẹp, đầy đủ, chuyên nghiệp */

import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";
import {
  sendMessageStateQuote,
  sendMessageFailed
} from "../chat-zalo/chat-style/chat-style.js";
import { nameServer } from "../../database/index.js";

const getCleanNameServer = () => {
  const lines = nameServer.split("\n").map(l => l.trim()).filter(l => l);
  const tag = lines.find(l => l.startsWith("@"));
  const bold = lines.find(l => /\*\*(.*?)\*\*/.test(l) || /__(.*?)__/.test(l));
  return [tag, bold].filter(Boolean).join(" ");
};

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

export const des = {
  name: "checkorder",
  type: 1,
  permission: "all",
  countdown: 8,
  active: true,
};

export async function handlecheckoderCommand(api, message) {
  const content = message.data.content.trim();
  const prefix = getGlobalPrefix();
  const cmd = "checkorder";
  const header = getCleanNameServer();

  if (!content.startsWith(`${prefix}${cmd}`)) return false;

  const args = content.slice(prefix.length + cmd.length).trim();
  if (!args) {
    return sendMessageStateQuote(api, message, `${header}Vui lòng nhập mã vận đơn!\n${prefix}${cmd} SPXVN...`, true, 60000, true);
  }

  const trackingCode = args.split(" ")[0].toUpperCase();
  if (!trackingCode.startsWith("SPXVN")) {
    return sendMessageStateQuote(api, message, `${header}Mã không hợp lệ! Phải bắt đầu bằng SPXVN`, true, 60000, true);
  }

  const url = `https://spx.vn/shipment/order/open/order/get_order_info?spx_tn=${trackingCode}&language_code=vi`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "x-requested-with": "XMLHttpRequest"
      }
    });
    clearTimeout(timeout);

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { 
      return sendMessageStateQuote(api, message, `${header}API SPX lỗi hoặc bị chặn (không trả JSON)`, true, 60000, false);
    }

    if (json.retcode !== 0 || !json.data?.sls_tracking_info) {
      return sendMessageStateQuote(api, message, `${header}Không tìm thấy đơn: ${trackingCode}\n${json.message || "Mã không tồn tại"}`, true, 60000, false);
    }

    const info = json.data.sls_tracking_info;
    const records = info.records || [];

    // Trạng thái mới nhất
    const latest = records[0];
    const statusEmoji = latest.tracking_name === "Delivered" ? "Đã giao" :
                        latest.tracking_name.includes("Out For Delivery") ? "Đang giao" :
                        latest.tracking_name.includes("In transit") ? "Đang vận chuyển" : "Chờ lấy hàng";

    let msg = `${header}TRA CỨU VẬN ĐƠN\n\n`;
    msg += `Mã vận đơn: ${info.sls_tn || trackingCode}\n`;
    msg += `Mã đơn Shopee: ${info.client_order_id || "Không có"}\n`;
    msg += `Trạng thái: ${statusEmoji} ${latest.buyer_description}\n`;
    msg += `Cập nhật: ${formatTime(latest.actual_time)}\n\n`;
    msg += `LỊCH SỬ HÀNH TRÌNH\n`;

    // Hiển thị TẤT CẢ hành trình (không giới hạn 10)
    records.forEach((r, i) => {
      const time = formatTime(r.actual_time);
      const location = r.current_location?.location_name || "";
      const desc = r.buyer_description.trim();

      let line = `${time} │ ${desc}`;
      if (location && !desc.includes(location.replace("28-NDH", "").trim())) {
        line += ` (${location.replace("28-NDH ", "").replace(" Hub", "")})`;
      }
      msg += line + "\n";
    });

    // Nếu quá dài thì chia tin nhắn
    const MAX_LENGTH = 3500;
    if (msg.length <= MAX_LENGTH) {
      return sendMessageStateQuote(api, message, msg, true, 3600000, false);
    }

    // Chia nhỏ nếu quá dài
    const parts = [];
    let current = `${header}TRA CỨU VẬN ĐƠN - ${trackingCode} (phần 1)\n\n`;
    records.forEach((r, i) => {
      const line = `${formatTime(r.actual_time)} │ ${r.buyer_description} ${r.current_location?.location_name ? "(" + r.current_location.location_name.replace(" Hub", "") + ")" : ""}\n`;
      if ((current + line).length > MAX_LENGTH - 200 && parts.length < 10) {
        parts.push(current);
        current = `Tiếp theo (phần ${parts.length + 1})\n${line}`;
      } else {
        current += line;
      }
    });
    parts.push(current);

    for (let i = 0; i < parts.length; i++) {
      const isFirst = i === 0;
      await sendMessageStateQuote(api, message, parts[i], isFirst, 3600000, false);
      if (!isFirst) await new Promise(r => setTimeout(r, 600));
    }

    return true;

  } catch (err) {
    clearTimeout(timeout);
    const reason = err.name === 'AbortError' ? "Timeout 10s" : err.message;
    return sendMessageFailed(api, message, `${header}Lỗi tra cứu ${trackingCode}\n${reason}`, true);
  }
}
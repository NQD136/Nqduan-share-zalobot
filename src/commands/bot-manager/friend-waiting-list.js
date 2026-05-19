// File: src/commands/bot-manager/friend-waiting-list.js
// LỆNH !loimoi HOÀN CHỈNH NHẤT 2025 – ĐÃ FIX LỖI makeURL
// CHẠY NGON NGAY LẬP TỨC – KHÔNG CẦN IMPORT GÌ THÊM

import {
  sendMessageCompleteRequest,
  sendMessageFromSQL,
  sendMessageResultRequest,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { MessageType } from "../../api-zalo/index.js";

// DÙNG GLOBAL CHO CÁC HÀM CORE (encodeAES, request, v.v.)
const { encodeAES, request, handleZaloResponse, appContext } = global;

// HÀM THAY THẾ makeURL (tự viết – không cần global)
function makeURL(base, params) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value.toString());
  }
  return url.toString();
}

// Map lưu tin nhắn để reply
const waitingMap = new Map();
const TIMEOUT = 10 * 60 * 1000; // 10 phút

// Dọn rác định kỳ
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of waitingMap.entries()) {
    if (now - data.timestamp > TIMEOUT) {
      waitingMap.delete(id);
    }
  }
}, 60000);

function timeAgo(timestamp) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} tháng trước`;
  return `${Math.floor(diff / 31536000)} năm trước`;
}

async function getPendingFriendRequests(api) {
  try {
    const baseUrl = api.zpwServiceMap.friend[0];
    const url = makeURL(`${baseUrl}/api/friend/recommendsv2/list`, {
      zpw_ver: api.API_VERSION,
      zpw_type: api.API_TYPE,
    });

    const params = { imei: appContext.imei };
    const encrypted = encodeAES(appContext.secretKey, JSON.stringify(params));
    if (!encrypted) throw new Error("Lỗi mã hóa AES");

    const finalUrl = `${url}&params=${encrypted}`;
    const response = await request(finalUrl, { method: "GET" });
    const result = await handleZaloResponse(response);

    if (result.error) {
      throw new Error(result.error.message || "Lỗi từ Zalo");
    }

    const items = result.data?.recommItems || [];
    return items
      .filter((item) => item.recommItemType === 2)
      .map((item) => {
        const info = item.dataInfo || {};
        const recomm = info.recommInfo || {};
        return {
          userId: info.userId?.toString() || "",
          displayName: info.displayName || info.zaloName || "Người dùng Zalo",
          message: recomm.message || "Không có tin nhắn",
          time: (info.recommTime || 0) * 1000,
          source: recomm.source || "unknown",
        };
      });
  } catch (err) {
    throw new Error("Không lấy được danh sách: " + err.message);
  }
}

export async function handleFriendWaitingList(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const fullContent = (message.data?.content || "").trim();
  const commandPart = fullContent
    .slice(prefix.length + aliasCommand.length)
    .trim();
  const args = commandPart.toLowerCase();

  try {
    const requests = await getPendingFriendRequests(api);

    if (requests.length === 0) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: "Hiện tại không có lời mời kết bạn nào đang chờ!",
        },
        false,
        30000,
      );
      return;
    }

    // XỬ LÝ LỆNH ACP / REJECT NGAY TRONG TIN NHẮN GỐC
    const actionMatch = args.match(/^(acp|reject)\s+(.+)/i);
    if (actionMatch) {
      const isAccept = actionMatch[1].toLowerCase() === "acp";
      const target = actionMatch[2].trim();

      const indices = new Set();
      if (target === "all") {
        for (let i = 1; i <= requests.length; i++) indices.add(i);
      } else if (target.includes("-")) {
        const [start, end] = target.split("-").map((n) => parseInt(n));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= requests.length) indices.add(i);
          }
        }
      } else {
        const num = parseInt(target);
        if (!isNaN(num) && num >= 1 && num <= requests.length) indices.add(num);
      }

      if (indices.size === 0) {
        await sendMessageFromSQL(
          api,
          message,
          { message: "Số thứ tự không hợp lệ!" },
          false,
          30000,
        );
        return;
      }

      const success = [];
      const failed = [];

      for (const idx of indices) {
        const user = requests[idx - 1];
        try {
          if (isAccept) {
            await api.acceptFriendRequest(user.userId);
            success.push(`${idx}. ${user.displayName}`);
          } else {
            await api.rejectFriendRequest(user.userId);
            success.push(`${idx}. ${user.displayName} (đã từ chối)`);
          }
        } catch (err) {
          failed.push(`${idx}. ${user.displayName} → ${err.message}`);
        }
      }

      let resultMsg = isAccept
        ? `ĐÃ CHẤP NHẬN THÀNH CÔNG ${success.length} NGƯỜI ✅\n${success.join("\n")}`
        : `ĐÃ TỪ CHỐI ${success.length} NGƯỜI ❌\n${success.join("\n")}`;

      if (failed.length > 0) {
        resultMsg += `\n\nTHẤT BẠI (${failed.length} người):\n${failed.join("\n")}`;
      }

      await sendMessageResultRequest(
        api,
        message.type,
        message.threadId,
        resultMsg,
        true,
        180000,
      );
      return;
    }

    // HIỂN THỊ DANH SÁCH (CHIA TRANG 30 NGƯỜI)
    const PER_PAGE = 30;
    for (let start = 0; start < requests.length; start += PER_PAGE) {
      const pageItems = requests.slice(start, start + PER_PAGE);
      let msg =
        start === 0
          ? `DANH SÁCH LỜI MỜI KẾT BẠN (${requests.length} người đang chờ)\n\n`
          : `\n(Tiếp theo - Trang ${start / PER_PAGE + 1})\n\n`;

      pageItems.forEach((user, i) => {
        const idx = start + i + 1;
        const sourceText =
          user.source === "group"
            ? "Từ nhóm"
            : user.source === "search"
              ? "Tìm kiếm"
              : user.source === "qr"
                ? "Quét QR"
                : "Khác";

        msg += `${idx}. ${user.displayName}\n`;
        msg += `   • Tin nhắn: ${user.message}\n`;
        msg += `   • Thời gian: ${timeAgo(user.time)}\n`;
        msg += `   • Nguồn: ${sourceText}\n\n`;
      });

      if (start + PER_PAGE >= requests.length) {
        msg += `HƯỚNG DẪN XỬ LÝ:\n`;
        msg += `• Reply tin này + "${prefix}${aliasCommand} acp 1" → chấp nhận người thứ 1\n`;
        msg += `• "${prefix}${aliasCommand} acp 1-10" → chấp nhận từ 1 đến 10\n`;
        msg += `• "${prefix}${aliasCommand} acp all" → chấp nhận hết\n`;
        msg += `• "${prefix}${aliasCommand} reject 5" → từ chối người thứ 5\n`;
        msg += `• "${prefix}${aliasCommand} reject all" → từ chối hết`;
      }

      const sentMsg = await sendMessageCompleteRequest(
        api,
        message,
        {
          caption: msg.trim(),
        },
        start + PER_PAGE >= requests.length ? TIMEOUT : 60000,
      );

      // Lưu tin nhắn cuối cùng để reply xử lý
      if (start + PER_PAGE >= requests.length) {
        const msgId = sentMsg.message.msgId.toString();
        waitingMap.set(msgId, {
          list: requests,
          timestamp: Date.now(),
          senderId: message.data.uidFrom,
        });
      }
    }
  } catch (error) {
    console.error("[LOIMOI ERROR]", error);
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Lỗi hệ thống: ${error.message}`,
      },
      false,
      30000,
    );
  }
}

// XỬ LÝ KHI NGƯỜI DÙNG REPLY TIN DANH SÁCH
export async function handleFriendWaitingReply(api, message) {
  if (!message.data?.quote?.globalMsgId) return false;

  const quotedId = message.data.quote.globalMsgId.toString();
  const saved = waitingMap.get(quotedId);
  if (!saved || saved.senderId !== message.data.uidFrom) return false;

  const content = (message.data?.content || "").trim();
  if (!/^(acp|reject)\s+/i.test(content)) return false;

  waitingMap.delete(quotedId);

  // Tái sử dụng logic xử lý từ hàm chính
  const fakeMessage = {
    ...message,
    data: {
      ...message.data,
      content: getGlobalPrefix() + "loimoi " + content,
    },
  };

  await handleFriendWaitingList(api, fakeMessage, "loimoi");
  return true;
}

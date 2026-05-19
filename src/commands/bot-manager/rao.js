import fs from "fs";
import path from "path";
import { sendMessageFactory } from "../../api-zalo/apis/sendMessage.js";
import { MessageType } from "../../api-zalo/models/Message.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";

const raoStatePath = path.resolve("rao-state.json");
const ADMIN_PHONE = "+84328743417"; // ✅ số điện thoại admin để tìm UID
const CARD_TEXT = "Liên hệ quản trị viên..!"; // ✅ text sẽ hiển thị dưới tên thay vì số

function saveRaoState(state) {
  fs.writeFileSync(raoStatePath, JSON.stringify(state, null, 2));
}

function loadRaoState() {
  if (fs.existsSync(raoStatePath)) {
    const raw = fs.readFileSync(raoStatePath, "utf8");
    return JSON.parse(raw);
  }
  return {};
}

function parseRaoCommand(content, prefix) {
  const lower = content.toLowerCase();
  const isOn = lower.startsWith(`${prefix}rao`) && lower.includes("on");
  const regexBrackets = /\[([\s\S]+?)\]/g;
  const matches = [...content.matchAll(regexBrackets)].map((m) => m[1].trim());

  if (isOn && matches.length >= 2) {
    let message = matches[0].replace(/\\n/g, "\n");
    let timeRaw = matches[1];
    let times = timeRaw.split(",").map((t) => t.trim());
    return { action: "on", message, times };
  }

  const regexOff = new RegExp(`${prefix}rao\\s+(off|xoa|del)\\s*(.*)?`, "i");
  const matchOff = content.match(regexOff);
  if (matchOff) {
    return {
      action: matchOff[1].toLowerCase(),
      ids: matchOff[2]
        ? matchOff[2]
            .trim()
            .split(/\s+/)
            .map((id) => parseInt(id))
            .filter((id) => !isNaN(id))
        : [],
    };
  }

  if (new RegExp(`${prefix}rao\\s+list`, "i").test(content))
    return { action: "list" };
  if (new RegExp(`${prefix}rao\\s+nd`, "i").test(content))
    return { action: "nd" };
  if (new RegExp(`${prefix}rao\\s+card\\s+on`, "i").test(content))
    return { action: "card_on" };
  if (new RegExp(`${prefix}rao\\s+card\\s+off`, "i").test(content))
    return { action: "card_off" };

  return null;
}

async function sendRaoMessage(
  api,
  groupId,
  message,
  raoCardOn,
  originalMessage,
) {
  const sendMessage = sendMessageFactory(api);
  const clientId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  await sendMessage(
    {
      msg: message,
      ttl: 3600000, // Rao tự xóa sau 1 tiếng
      clientId,
    },
    groupId,
    MessageType.GroupMessage,
  );

  if (raoCardOn) {
    try {
      const adminSearch = await api.findUser(ADMIN_PHONE);
      const adminUid = adminSearch?.uid;
      if (adminUid) {
        // ✅ dùng originalMessage thay vì null
        await api.sendBusinessCard(
          originalMessage,
          adminUid,
          CARD_TEXT,
          MessageType.GroupMessage,
          groupId,
          3600000,
        );
      } else {
        console.warn("⚠️ Không tìm thấy UID admin từ số điện thoại!");
      }
    } catch (err) {
      console.error("❌ Lỗi gửi card rao:", err);
    }
  }
}

function generateId(existingIds) {
  let id = 1;
  while (existingIds.includes(id)) id++;
  return id;
}

let intervalChecks = {};

export const des = {
  name: "rao",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
  alias: ["rao"],
};

export async function handleRao(api, message) {
  const threadId = message.threadId;
  const content = message.data.content.trim();
  const prefix = getGlobalPrefix();
  const parsed = parseRaoCommand(content, prefix);

  let state = loadRaoState();
  if (!state[threadId]) {
    state[threadId] = { raos: [], raoCardOn: false };
  } else if (Array.isArray(state[threadId])) {
    state[threadId] = { raos: state[threadId], raoCardOn: false };
  }

  if (!parsed) {
    return api.sendMessage(
      {
        msg:
          `📌 *Hướng dẫn sử dụng rao*:\n\n` +
          `➡️ ${prefix}rao on [Nội dung\\nDòng 2] [10:00] — Rao mỗi ngày lúc 10h\n` +
          `➡️ ${prefix}rao on [Nội dung] [10:00,10:10] — Rao mỗi ngày lúc 10h và 10h10\n` +
          `➡️ ${prefix}rao on [Nội dung] [1p] — Rao mỗi 1 phút\n` +
          `➡️ ${prefix}rao off — Tắt toàn bộ rao\n` +
          `➡️ ${prefix}rao list — Danh sách rao đang bật\n` +
          `➡️ ${prefix}rao nd — Xem nội dung các rao\n` +
          `➡️ ${prefix}rao xoa 1 2 3 — Xóa rao theo ID\n` +
          `➡️ ${prefix}rao card on/off — Bật/tắt gửi kèm card khi rao`,
        ttl: 60000,
      },
      threadId,
      MessageType.GroupMessage,
    );
  }

  if (parsed.action === "on") {
    if (!parsed.message || !parsed.times?.length) {
      return api.sendMessage(
        { msg: "❌ Cú pháp thiếu nội dung hoặc thời gian rao.", ttl: 60000 },
        threadId,
        MessageType.GroupMessage,
      );
    }

    let intervalMs = 0;
    let isInterval = false;

    if (parsed.times.length === 1 && /^\d+[ps]$/i.test(parsed.times[0])) {
      isInterval = true;
      const num = parseInt(parsed.times[0]);
      if (parsed.times[0].toLowerCase().endsWith("p"))
        intervalMs = num * 60 * 1000;
      if (parsed.times[0].toLowerCase().endsWith("s")) intervalMs = num * 1000;
    }

    const existingIds = state[threadId].raos.map((r) => r.id);
    const id = generateId(existingIds);

    const newRao = {
      id,
      content: parsed.message,
      times: isInterval ? [] : parsed.times,
      intervalMs,
    };

    state[threadId].raos.push(newRao);
    saveRaoState(state);

    if (!intervalChecks[threadId]) intervalChecks[threadId] = {};
    if (intervalChecks[threadId][id])
      clearInterval(intervalChecks[threadId][id]);

    if (isInterval) {
      intervalChecks[threadId][id] = setInterval(async () => {
        try {
          await sendRaoMessage(
            api,
            threadId,
            newRao.content,
            state[threadId].raoCardOn,
            message,
          );
        } catch (e) {
          console.error("Lỗi gửi rao:", e);
        }
      }, intervalMs);
    } else {
      intervalChecks[threadId][id] = setInterval(async () => {
        const now = new Date();
        const hhmm = now.toTimeString().slice(0, 5);
        if (newRao.times.includes(hhmm)) {
          try {
            await sendRaoMessage(
              api,
              threadId,
              newRao.content,
              state[threadId].raoCardOn,
              message,
            );
          } catch (e) {
            console.error("Lỗi gửi rao:", e);
          }
        }
      }, 60000);
    }

    return api.sendMessage(
      {
        msg: `🟢 Đã bật rao #${id}:\n⏰ Thời gian: ${isInterval ? parsed.times[0] : parsed.times.join(", ")}\n🔁 Kiểu: ${isInterval ? "Chu kỳ" : "Giờ cố định"}\n\n${parsed.message}`,
        ttl: 60000,
      },
      threadId,
      MessageType.GroupMessage,
    );
  } else if (parsed.action === "off") {
    if (intervalChecks[threadId]) {
      Object.values(intervalChecks[threadId]).forEach((timer) =>
        clearInterval(timer),
      );
      intervalChecks[threadId] = {};
    }
    state[threadId].raos = [];
    saveRaoState(state);

    return api.sendMessage(
      {
        msg: "🔴 Đã tắt toàn bộ rao tự động.",
        ttl: 60000,
      },
      threadId,
      MessageType.GroupMessage,
    );
  } else if (parsed.action === "list") {
    const raoList = state[threadId].raos;
    if (!raoList.length) {
      return api.sendMessage(
        { msg: "📭 Không có rao nào đang hoạt động.", ttl: 60000 },
        threadId,
        MessageType.GroupMessage,
      );
    }

    const list = raoList
      .map(
        (r) =>
          `#${r.id} - ${r.content.slice(0, 50)}...\n   ⏰ Thời gian: ${r.times?.length ? r.times.join(", ") : `Chu kỳ ${r.intervalMs / 1000}s`}`,
      )
      .join("\n\n");
    return api.sendMessage(
      {
        msg: `📋 Danh sách rao:\n\n${list}\n\n💳 Trạng thái Card: ${state[threadId].raoCardOn ? "Bật" : "Tắt"}`,
        ttl: 60000,
      },
      threadId,
      MessageType.GroupMessage,
    );
  } else if (parsed.action === "nd") {
    const raoList = state[threadId].raos;
    if (!raoList.length) {
      return api.sendMessage(
        { msg: "📭 Không có nội dung rao.", ttl: 60000 },
        threadId,
        MessageType.GroupMessage,
      );
    }

    const list = raoList.map((r) => `#${r.id}:\n${r.content}`).join("\n\n");
    return api.sendMessage(
      { msg: `📝 Nội dung các rao:\n\n${list}`, ttl: 60000 },
      threadId,
      MessageType.GroupMessage,
    );
  } else if (parsed.action === "xoa" || parsed.action === "del") {
    const idsToDelete = parsed.ids;
    let raoList = state[threadId].raos;
    if (!raoList.length)
      return api.sendMessage(
        { msg: "📭 Không có rao để xóa.", ttl: 60000 },
        threadId,
        MessageType.GroupMessage,
      );

    const deleted = [],
      notFound = [];

    idsToDelete.forEach((id) => {
      const idx = raoList.findIndex((r) => r.id === id);
      if (idx !== -1) {
        if (intervalChecks[threadId]?.[id]) {
          clearInterval(intervalChecks[threadId][id]);
          delete intervalChecks[threadId][id];
        }
        raoList.splice(idx, 1);
        deleted.push(id);
      } else notFound.push(id);
    });

    state[threadId].raos = raoList;
    saveRaoState(state);

    return api.sendMessage(
      {
        msg: `🗑️ ${deleted.length ? `Đã xóa ID: ${deleted.join(", ")}` : ""}\n⚠️ ${notFound.length ? `Không tìm thấy ID: ${notFound.join(", ")}` : ""}`,
        ttl: 60000,
      },
      threadId,
      MessageType.GroupMessage,
    );
  } else if (parsed.action === "card_on") {
    state[threadId].raoCardOn = true;
    saveRaoState(state);
    return api.sendMessage(
      { msg: "💳 Đã bật gửi kèm card khi rao.", ttl: 60000 },
      threadId,
      MessageType.GroupMessage,
    );
  } else if (parsed.action === "card_off") {
    state[threadId].raoCardOn = false;
    saveRaoState(state);
    return api.sendMessage(
      { msg: "💳 Đã tắt gửi kèm card khi rao.", ttl: 60000 },
      threadId,
      MessageType.GroupMessage,
    );
  }
}

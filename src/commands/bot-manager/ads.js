import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { sendMessageFactory } from "../../api-zalo/apis/sendMessage.js";
import { MessageType } from "../../api-zalo/models/Message.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adsStatePath = path.resolve("ads-state.json");
const ADMIN_PHONE = "+84328743417";
const CARD_TEXT = "Liên Hệ Mua x Thuê Bot...!";

// ====== File Helper ======
function saveAdsState(state) {
  fs.writeFileSync(adsStatePath, JSON.stringify(state, null, 2));
}
function loadAdsState() {
  return fs.existsSync(adsStatePath)
    ? JSON.parse(fs.readFileSync(adsStatePath, "utf8"))
    : {};
}

function loadAdsContent() {
  const file = path.join(__dirname, "ads1.txt");
  return fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").trim()
    : "❌ Không tìm thấy file ads1.txt!";
}

// ====== Parse giờ settime ======
function parseTimes(str) {
  return str
    .split(",")
    .map((t) => t.trim())
    .map((t) => {
      const [h, m] = t.split(":").map(Number);
      return { h, m };
    });
}

// ====== Gửi Ads ======
async function sendAdsMessage(api, threadId, adsCardOn) {
  const sendMessage = sendMessageFactory(api);
  const messageContent = loadAdsContent();
  const clientId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  await sendMessage(
    { msg: messageContent, ttl: 21600000, clientId },
    threadId,
    MessageType.GroupMessage,
  );

  if (adsCardOn) {
    try {
      const adminSearch = await api.findUser(ADMIN_PHONE);
      const adminUid = adminSearch?.uid;
      if (adminUid) {
        await api.sendBusinessCard(
          { threadId },
          adminUid,
          CARD_TEXT,
          MessageType.GroupMessage,
          threadId,
          21600000,
        );
      }
    } catch (err) {
      console.error("❌ Lỗi gửi card ads:", err);
    }
  }
}

// ====== Interval Manager ======
let intervalChecks = {};

function startIntervalForAd(api, ad, threadId) {
  if (intervalChecks[threadId]) clearInterval(intervalChecks[threadId]);
  intervalChecks[threadId] = setInterval(async () => {
    try {
      const now = new Date();
      const hh = now.getHours();
      const mm = now.getMinutes();

      const times = ad.times?.length
        ? ad.times
        : [
            { h: 8, m: 0 },
            { h: 12, m: 0 },
            { h: 18, m: 0 },
            { h: 22, m: 0 },
          ];

      for (const { h, m } of times) {
        if (hh === h && mm === m) {
          const today = new Date().toDateString();
          if (ad.lastSentDate !== today || ad.lastSentHour !== h) {
            await sendAdsMessage(api, threadId, ad.adsCardOn);
            ad.lastSentDate = today;
            ad.lastSentHour = h;
            let st = loadAdsState();
            st[threadId] = ad;
            saveAdsState(st);
            console.log(
              `📢 [ADS] Đã gửi bài cho group ${threadId} lúc ${h}:${m}`,
            );
          }
        }
      }
    } catch (e) {
      // Nếu bot bị kick/out khỏi group thì tự xóa state
      if (e?.message?.includes("not a member") || e?.code === 403) {
        console.log(
          `⚠️ Bot đã out/kick khỏi group ${threadId}, xóa khỏi state.`,
        );
        let st = loadAdsState();
        delete st[threadId];
        saveAdsState(st);
        clearInterval(intervalChecks[threadId]);
        delete intervalChecks[threadId];
      } else {
        console.error("❌ ADS ERROR:", e);
      }
    }
  }, 60000); // check mỗi phút
}

// ====== Auto load khi restart ======
export function loadAllAdsOnStart(api) {
  const state = loadAdsState();
  for (const threadId in state) {
    const ad = state[threadId];
    if (ad.isOn) {
      startIntervalForAd(api, ad, threadId);
      console.log(`🔄 [ADS] Đã load lại group ${threadId} (ads1.txt)`);
    }
  }
}

export const des = {
  name: "ads",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
  alias: ["ads"],
};

// ====== Command Handler ======
export async function handleAds(api, message) {
  const threadId = message.threadId;
  const content = message.data.content.trim();
  const prefix = getGlobalPrefix();

  let state = loadAdsState();
  if (!state[threadId])
    state[threadId] = {
      isOn: false,
      adsCardOn: false,
      times: [],
      lastSentDate: null,
      lastSentHour: null,
    };

  // HELP
  if (/^ads$/i.test(content)) {
    return api.sendMessage(
      {
        msg: `📌 Lệnh Ads:
${prefix}ads run → bật ads1.txt cho group hiện tại
${prefix}ads off → tắt ads group hiện tại
${prefix}ads off <id> → tắt ads cho group cụ thể
${prefix}ads all → bật ads cho tất cả group
${prefix}ads stop all → tắt ads tất cả group
${prefix}ads list → danh sách group đang bật ads
${prefix}ads time 00:00,12:00,... → đặt giờ cho group
${prefix}ads showtime → xem giờ group hiện tại
${prefix}ads view → xem nội dung ads1.txt
${prefix}ads setnd <nội dung> → sửa nội dung ads1.txt`,
        ttl: 60000,
      },
      threadId,
      MessageType.GroupMessage,
    );
  }

  // bật ads group hiện tại
  if (/^ads\s+run/i.test(content)) {
    state[threadId].isOn = true;
    saveAdsState(state);
    startIntervalForAd(api, state[threadId], threadId);
    return api.sendMessage(
      { msg: `🟢 Đã bật ads cho group này (ads1.txt)`, ttl: 60000 },
      threadId,
      MessageType.GroupMessage,
    );
  }

  // tắt ads group hiện tại hoặc theo ID
  if (/^ads\s+off/i.test(content)) {
    const parts = content.split(" ");
    if (parts.length === 3) {
      const gid = parts[2];
      if (state[gid]) {
        if (intervalChecks[gid]) clearInterval(intervalChecks[gid]);
        delete intervalChecks[gid];
        delete state[gid];
        saveAdsState(state);
        return api.sendMessage(
          { msg: `🔴 Đã tắt ads cho group ${gid}`, ttl: 60000 },
          threadId,
          MessageType.GroupMessage,
        );
      }
    } else {
      if (intervalChecks[threadId]) clearInterval(intervalChecks[threadId]);
      delete intervalChecks[threadId];
      delete state[threadId];
      saveAdsState(state);
      return api.sendMessage(
        { msg: "🔴 Đã tắt ads cho group này.", ttl: 60000 },
        threadId,
        MessageType.GroupMessage,
      );
    }
  }

  // bật ads tất cả group
  if (/^ads\s+all/i.test(content)) {
    const groups = await api.getAllGroups();
    for (const g of groups) {
      state[g.id] = state[g.id] || {
        isOn: true,
        adsCardOn: false,
        times: [],
        lastSentDate: null,
        lastSentHour: null,
      };
      state[g.id].isOn = true;
      startIntervalForAd(api, state[g.id], g.id);
    }
    saveAdsState(state);
    return api.sendMessage(
      {
        msg: `🟢 Đã bật ads cho tất cả group (${groups.length} nhóm).`,
        ttl: 60000,
      },
      threadId,
      MessageType.GroupMessage,
    );
  }

  // tắt ads tất cả group
  if (/^ads\s+stop\s+all/i.test(content)) {
    for (const gid in intervalChecks) {
      clearInterval(intervalChecks[gid]);
      delete intervalChecks[gid];
    }
    state = {};
    saveAdsState(state);
    return api.sendMessage(
      { msg: "🔴 Đã tắt ads cho tất cả group.", ttl: 60000 },
      threadId,
      MessageType.GroupMessage,
    );
  }

  // list group đang bật ads
  if (/^ads\s+list/i.test(content)) {
    const groups = Object.keys(state).filter((gid) => state[gid].isOn);
    if (!groups.length) {
      return api.sendMessage(
        { msg: "📭 Không có group nào đang bật ads.", ttl: 60000 },
        threadId,
        MessageType.GroupMessage,
      );
    }
    let text = "📋 Danh sách group đang bật ads:\n\n";
    for (const gid of groups) {
      const g = state[gid];
      const times = g.times?.length
        ? g.times.map((t) => `${t.h}:${t.m}`).join(", ")
        : "Mặc định (08:00, 12:00, 18:00, 22:00)";
      text += `👥 GroupID: ${gid}\n🕒 Giờ chạy: ${times}\n💳 Card: ${
        g.adsCardOn ? "Bật" : "Tắt"
      }\n\n`;
    }
    return api.sendMessage(
      { msg: text.trim(), ttl: 60000 },
      threadId,
      MessageType.GroupMessage,
    );
  }

  // đặt giờ
  if (/^ads\s+time\s+/i.test(content)) {
    const match = content.match(/^ads\s+time\s+(.+)/i);
    if (!match) return;
    const times = parseTimes(match[1]);
    state[threadId].times = times;
    saveAdsState(state);
    return api.sendMessage(
      { msg: `⏰ Đã đặt giờ: ${match[1]}`, ttl: 60000 },
      threadId,
      MessageType.GroupMessage,
    );
  }

  // showtime
  if (/^ads\s+showtime/i.test(content)) {
    const ad = state[threadId];
    const times = ad.times?.length
      ? ad.times.map((t) => `${t.h}:${t.m}`).join(", ")
      : "Mặc định (08:00, 12:00, 18:00, 22:00)";
    return api.sendMessage(
      { msg: `⏰ Giờ chạy hiện tại: ${times}`, ttl: 60000 },
      threadId,
      MessageType.GroupMessage,
    );
  }

  // xem nội dung ads1.txt
  if (/^ads\s+view/i.test(content)) {
    return api.sendMessage(
      { msg: `📝 Nội dung ads1.txt:\n\n${loadAdsContent()}`, ttl: 120000 },
      threadId,
      MessageType.GroupMessage,
    );
  }

  // sửa nội dung ads1.txt
  if (/^ads\s+setnd\s+/i.test(content)) {
    const newContent = content.replace(/^.*ads\s+setnd\s+/i, "").trim();
    const file = path.join(__dirname, "ads1.txt");
    fs.writeFileSync(file, newContent, "utf8");
    return api.sendMessage(
      {
        msg: `✅ Đã cập nhật nội dung ads1.txt:\n\n${newContent}`,
        ttl: 120000,
      },
      threadId,
      MessageType.GroupMessage,
    );
  }
}

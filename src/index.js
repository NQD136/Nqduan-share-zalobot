//src/index.js
import { Zalo } from "./api-zalo/index.js";
import { groupEvents } from "./automations/events-group.js";
import { messagesUser } from "./automations/event-send-msg.js";
import { undoMessageEvents } from "./automations/event-undo-msg.js";
import {
  readAdmins,
  readConfig,
  readGroupSettings,
  readCommandConfig,
  writeProphylacticConfig,
  readProphylacticConfig,
} from "./utils/io-json.js";
import { logManagerBot } from "./utils/io-json.js";
import { initService } from "./Nqduan-service/service.js";
import { reactionEvents } from "./automations/events-reaction.js";
import { typingEvents } from "./automations/event-typing.msg.js";
import { updateMessageCache } from "./utils/message-cache.js";

// --- BƯỚC 1: THÊM IMPORT ---
// (Hãy chắc chắn đường dẫn này đúng tới file active-bot.js của bạn)
import { managerData } from "./commands/bot-manager/active-bot.js"; // <-- THÊM DÒNG NÀY

let idBot = -1;
const prophylacticConfig = readProphylacticConfig();
export let admins = readAdmins();
let config = readConfig();
let commandConfig = readCommandConfig();
const zalo = new Zalo(
  { cookie: config.cookie, imei: config.imei, userAgent: config.userAgent },
  { selfListen: true, checkUpdate: false },
);

export const getApi = () => api;
export const getBotId = () => idBot;
export const setBotId = (id) => (idBot = id);
export const getCommandConfig = () => commandConfig;
export const reloadCommandConfig = () => (commandConfig = readCommandConfig());
export const getProphylacticConfig = () => prophylacticConfig;
export const getProphylacticUploadAttachment = () => false;
export const setProphylacticUploadAttachment = (enable, resetNum = false) => {
  prophylacticConfig.prophylacticUploadAttachment.enable = false;
  prophylacticConfig.prophylacticUploadAttachment.lastBlocked = Date.now();
  if (resetNum)
    prophylacticConfig.prophylacticUploadAttachment.numRequestZalo = 0;
  writeProphylacticConfig(prophylacticConfig);
};

const timeResetNumberRequestUpload = 120 * 60 * 1000;
const timeDisableProphylacticConfig = 120 * 60 * 1000;

export function checkDisableProphylacticConfig() {
  if (prophylacticConfig.prophylacticUploadAttachment.enable) {
    const timeDifference =
      Date.now() - prophylacticConfig.prophylacticUploadAttachment.lastBlocked;
    if (timeDifference > timeDisableProphylacticConfig)
      setProphylacticUploadAttachment(false, true);
  }
}

export function checkConfigUploadAttachment(
  extFile,
  isUseProphylactic = false,
) {
  if (["jpg", "jpeg", "png", "webp"].includes(extFile)) {
    const currentTime = Date.now();
    if (
      !prophylacticConfig.prophylacticUploadAttachment?.lastRequestTime ||
      currentTime -
        prophylacticConfig.prophylacticUploadAttachment.lastRequestTime >
        timeResetNumberRequestUpload
    ) {
      prophylacticConfig.prophylacticUploadAttachment.numRequestZalo = 0;
      prophylacticConfig.prophylacticUploadAttachment.lastRequestTime =
        currentTime;
      setProphylacticUploadAttachment(false);
    }
    if (!isUseProphylactic)
      prophylacticConfig.prophylacticUploadAttachment.numRequestZalo++;
    writeProphylacticConfig(prophylacticConfig);
  }
}

export function isAdmin(userId, threadId, groupAdmins) {
  if (admins.includes(userId.toString())) {
    return true;
  }
  const groupSettings = readGroupSettings();
  if (
    threadId &&
    groupSettings[threadId] &&
    typeof groupSettings[threadId]["adminList"] === "object"
  ) {
    if (
      Object.keys(groupSettings[threadId]["adminList"]).includes(
        userId.toString(),
      )
    ) {
      return true;
    }
  }
  if (
    groupAdmins &&
    Array.isArray(groupAdmins) &&
    groupAdmins.includes(userId.toString())
  ) {
    return true;
  }
  return false;
}
setInterval(() => {
  admins = readAdmins();
}, 500);
const api = await zalo.login();
initService(api);
api.listener.on("message", async (message) => {
  try {
    // --- BƯỚC 2: TRUYỀN managerData VÀO HÀM ---
    await messagesUser(api, message, managerData); // <-- SỬA DÒNG NÀY
  } catch (error) {
    const detailError = `Mã Lỗi: ${error.code} - Chú Thích Lỗi Tin Nhắn: ${error.message}\nNội Dung Lỗi: ${error.stack}`;
    console.error(detailError);
    logManagerBot(detailError);
  }
  updateMessageCache(message);
});
api.listener.on("group_event", async (event) => {
  try {
    await groupEvents(api, event);
  } catch (error) {
    const detailError = `Mã Lỗi: ${error.code} - Chú Thích Lỗi Sự Kiện Nhóm: ${error.message}\nNội Dung Lỗi: ${error.stack}`;
    console.error(detailError);
    logManagerBot(detailError);
  }
});
api.listener.on("undo", async (undo) => {
  try {
    await undoMessageEvents(api, undo);
  } catch (error) {
    const detailError = `Mã Lỗi: ${error.code} - Chú Thích Lỗi Sự Kiện Delete Message: ${error.message}\nNội Dung Lỗi: ${error.stack}`;
    console.error(detailError);
    logManagerBot(detailError);
  }
});
api.listener.on("reaction", async (reaction) => {
  try {
    await reactionEvents(api, reaction);
  } catch (error) {
    const detailError = `Mã Lỗi: ${error.code} - Chú Thích Lỗi Sự Kiện Reaction: ${error.message}\nNội Dung Lỗi: ${error.stack}`;
    console.error(detailError);
    logManagerBot(detailError);
  }
});
api.listener.start();
console.log("Đã khởi tạo giá trị lắng nghe tin nhắn");

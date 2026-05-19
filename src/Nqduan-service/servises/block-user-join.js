import fs from "fs";
import path from "path";
import { MessageType } from "zlbotdqt";
import { initializeGroupEvent, GroupEventType } from "../../api-zalo/models/GroupEvent.js";
import {
  sendMessageWarning,
  sendMessageStateQuote,
  sendMessageCompleteRequest
} from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { removeMention } from "../../utils/format-util.js";

const blockedUIDPath = path.join(process.cwd(), "assets/json-data/blocked-uids.json");

function loadBlockedUIDsByGroup(groupId) {
  try {
    if (!fs.existsSync(blockedUIDPath)) return [];
    const data = JSON.parse(fs.readFileSync(blockedUIDPath, "utf-8"));
    return Array.isArray(data[groupId]) ? data[groupId] : [];
  } catch {
    return [];
  }
}

function saveBlockedUIDs(data) {
  try {
    fs.writeFileSync(blockedUIDPath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export async function handleAutoBlockOnJoin(api, event) {
    const groupEvent = initializeGroupEvent(event.data, event.type);
    if (groupEvent.type !== GroupEventType.JOIN) return;
  
    const threadId = groupEvent.threadId;
    const members = event.data?.updateMembers || [];
  
    const blockedUIDs = loadBlockedUIDsByGroup(threadId);
  
    for (const member of members) {
      const uid = member.id;
      const name = member.dName || "ngu";
  
      if (blockedUIDs.includes(uid)) {
        try {
          await api.blockUsers(threadId, [uid]);
          await api.sendMessage(
            {
                msg: `-1 Thằng Lồn ${name} Vì nhờn, Spam Join Leave.`,
              mentions: [{ uid, pos: 6, len: name.length }]
            },
            threadId
          );
  
       //   console.log(`[BLOCK] ❌ Đã chặn UID ${uid} khi vào nhóm ${threadId}`);
        } catch (err) {
          console.error(`[BLOCK] ⚠ Không thể chặn ${uid}:`, err.message);
        }
      }
    }
  }
  export async function handleBlockUIDByCommand(api, message, aliasCommand) {
    const prefix = getGlobalPrefix();
    const threadId = message.threadId;
    const content = removeMention(message).replace(`${prefix}${aliasCommand}`, "").trim();
    const args = content.split(/\s+/);
    const command = args[0]?.toLowerCase();
    let data = {};
    try {
      if (fs.existsSync(blockedUIDPath)) {
        data = JSON.parse(fs.readFileSync(blockedUIDPath, "utf-8"));
      }
    } catch (err) {
      console.error("Lỗi đọc blocked-uids.json:", err.message);
    }
    if (!Array.isArray(data[threadId])) data[threadId] = [];
    if (command === "add") {
      const mentions = Array.isArray(message.data?.mentions) ? message.data.mentions : [];
      const idsFromMentions = mentions.map(m => m.uid);
      const rawIDs = args.slice(1).filter(id => /^\d+$/.test(id));
      const newIds = [...idsFromMentions, ...rawIDs].filter(uid => !data[threadId].includes(uid));
  
      if (!newIds.length) {
        await sendMessageWarning(api, message, "Không có UID hợp lệ để thêm.");
        return;
      }
  
      data[threadId].push(...newIds);
      const saved = saveBlockedUIDs(data);
      if (saved) {
        const nameMap = {};
        for (const m of mentions) {
          nameMap[m.uid] = m.name || m.uid;
        }
  
        const names = newIds
          .map(id => nameMap[id] ? nameMap[id] : `ID ${id}`)
          .join(", ");
  
        const mentionEntities = mentions
          .filter(m => newIds.includes(m.uid))
          .map(m => ({
            uid: m.uid,
            len: (m.name || "").length,
            pos: `Đã thêm `.length + names.indexOf(m.name || "")
          }));
  
        await api.sendMessage(
          {
            msg: `Đã thêm ${names} vào danh sách đen.`,
            mentions: mentionEntities
          },
          threadId
        );
      } else {
        await sendMessageWarning(api, message, "Không thể lưu file.");
      }
      return;
    }
    if (command === "list") {
      const list = data[threadId];
      if (!list.length) {
        await sendMessageStateQuote(api, message, "Danh sách UID bị block đang trống.", false, 10000);
        return;
      }
      const text = list.map((uid, i) => `${i + 1}. ${uid}`).join("\n");
      await sendMessageStateQuote(api, message, `Danh sách UID bị block:\n${text}`, true, 20000);
      return;
    }
    if (command === "remove") {
      const index = parseInt(args[1]);
      if (isNaN(index) || index < 1 || index > data[threadId].length) {
        await sendMessageWarning(api, message, "Số thứ tự không hợp lệ.");
        return;
      }
  
      const removed = data[threadId].splice(index - 1, 1);
      const saved = saveBlockedUIDs(data);
      if (saved) {
        await sendMessageStateQuote(
          api,
          message,
          `🗑️ Đã xoá UID: ${removed[0]}`,
          true,
          10000
        );
      } else {
        await sendMessageWarning(api, message, "Không thể lưu sau khi xoá.");
      }
      return;
    }
    await sendMessageWarning(
      api,
      message,
      `Sai cú pháp. Dùng:\n- ${prefix}${aliasCommand} add @mention hoặc <uid>\n- ${prefix}${aliasCommand} list\n- ${prefix}${aliasCommand} remove <số>`
    );
  }
  
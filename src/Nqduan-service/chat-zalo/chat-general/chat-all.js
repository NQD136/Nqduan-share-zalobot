import { MultiMsgStyle, MessageStyle } from "../../../api-zalo/models/Message.js";
import { getBotId } from "../../../index.js";
import { removeMention } from "../../../utils/format-util.js";
import { getGroupAdmins } from "../../info-service/group-info.js";
import { getGlobalPrefix } from "../../service.js";

export async function chatAll(api, message, groupInfo, aliasCommand) {
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const threadId = message.threadId;
  const botId = getBotId();
  const chatMessage = content.replace(`${prefix}${aliasCommand}`, "").trim();
  const [contentTag, countTag = 1, delayTag = 1,ttl = 0] =chatMessage.split("|");
  const groupAdmins = await getGroupAdmins(groupInfo);

  if (chatMessage) {
    for (let i = 0; i < countTag; i++) {
      if (!groupAdmins.includes(botId)) {
        let newChatMessage = contentTag;
        const mentions = groupInfo.memVerList.map((member, index) => {
          newChatMessage += " ";
          return {
            pos: newChatMessage.length + index,
            uid: member.replace(/_0$/, ""),
            len: 1
          };
        });
        await api.sendMessage(
          {
            msg: newChatMessage,ttl: 600000,
            // style: MultiMsgStyle([MessageStyle(0, newChatMessage.length, "ff3131", "18")]),
            mentions: mentions,
          },
          threadId,
          message.type,
          
        );
      } else {
        await api.sendMessage(
          {
            msg: contentTag,ttl: 600000,
            // style: MultiMsgStyle([MessageStyle(0, chatMessage.length, "ff3131", "18")]),
            mentions: [{ pos: 0, uid: -1, len: contentTag.length }],
          },
          threadId,
          message.type,
         
        );
      }
      await new Promise(resolve => setTimeout(resolve, delayTag));
    }
  }
}

export async function getObject(api, message, aliasCommand) {
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const threadId = message.threadId;
  const botId = getBotId();
  const msgcopy = JSON.parse(JSON.stringify(message));

  if (!msgcopy.data?.quote) {
    return api.sendMessage(
      { msg: 'Lỗi: Không tìm thấy thông tin quote.', ttl: 60000, quote: message },
      threadId,
      message.type
    );
  }

  const quoted_message = msgcopy.data.quote;

  // Helpers: parse chuỗi JSON an toàn + đệ quy mọi cấp
  const tryParseJSON = (val) => {
    if (typeof val !== 'string') return val;
    const s = val.trim();
    if (!(s.startsWith('{') || s.startsWith('['))) return val; // không có dấu hiệu là JSON
    try {
      return JSON.parse(s);
    } catch {
      return val; // để nguyên nếu parse fail
    }
  };

  const deepParseJSONStrings = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        const parsed = tryParseJSON(v);
        if (parsed !== v) {
          obj[k] = parsed;
        }
        // tiếp tục đệ quy nếu là object/array
        if (obj[k] && typeof obj[k] === 'object') {
          deepParseJSONStrings(obj[k]);
        }
      }
    }
    return obj;
  };

  // Xử lý attach thành object (nếu có) và parse params nếu cần
  let attachData = {};
  try {
    attachData = quoted_message.attach ? JSON.parse(quoted_message.attach) : {};

    // Nếu params bên trong attach là string JSON thì parse
    if (typeof attachData.params === 'string') {
      try {
        attachData.params = JSON.parse(attachData.params);
      } catch (err) {
        attachData.params = { error: 'Không parse được params' };
      }
    }

    // Parse sâu mọi chuỗi JSON con (ví dụ: params.tracking)
    attachData = deepParseJSONStrings(attachData);
  } catch (e) {
    attachData = { error: 'Không parse được attach' };
  }

  // Tạo object chỉ chứa các field mong muốn
  const filteredObject = {
    ownerId: quoted_message.ownerId,
    cliMsgId: quoted_message.cliMsgId,
    globalMsgId: quoted_message.globalMsgId,
    cliMsgType: quoted_message.cliMsgType,
    ts: quoted_message.ts,
    msg: quoted_message.msg,
    attach: attachData,
    ttl: quoted_message.ttl ?? null,
    fromD: quoted_message.fromD
  };

  const objectAsString = JSON.stringify(filteredObject, null, 2);

  return api.sendMessage(
    { msg: objectAsString, ttl: 60000 * 5, quote: message },
    threadId,
    message.type
  );
}
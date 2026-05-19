import fetch from "node-fetch";
import { getGlobalPrefix } from '../service.js';
import { sendMessageStateQuote } from '../chat-zalo/chat-style/chat-style.js';
import { nameServer } from '../../database/index.js';

// DANH SÁCH EMOTE PUBG MOBILE
const EMOTE_LIST = [
  { id: "909049010", name: "Evo P90 - Hoàng Kim Bất Diệt" },
  { id: "909051003", name: "Evo M60 - Sát Thần Săn Mộng" },
  { id: "909033002", name: "Evo MP5 - Thiên Thần Bạch Kim" },
  { id: "909041005", name: "Evo Groza - Địa Chấn Sắc Màu" },
  { id: "909038010", name: "Evo Thompson - Hắc Thạch Long" },
  { id: "909039011", name: "Evo M1014 - Huyết Hỏa" },
  { id: "909040010", name: "Evo MP40 - Tia Chớp Tử Thần" },
  { id: "909000081", name: "Evo M1014 - Long Tộc" },
  { id: "909000085", name: "Evo XM8 - Lôi Thần" },
  { id: "909000063", name: "Evo AK47 - Rồng Xanh" },
  { id: "909000075", name: "Evo MP40 - Mãng Xà" },
  { id: "909033001", name: "Evo M4A1 - Hỏa Ngục" },
  { id: "909000090", name: "Evo Famas - Dạ Xoa" },
  { id: "909000068", name: "Evo Scar - Cá Mập Đen" },
  { id: "909000098", name: "Evo UMP - Phong Cách" },
  { id: "909035007", name: "Evo M1887 - Vũ Trụ Hủy Diệt" },
  { id: "909037011", name: "Evo Tay - Long Trảo Quyền" },
  { id: "909038012", name: "Evo G18 - Chinh Phục" },
  { id: "909035012", name: "Evo AN94 - Tiếng Hú Ác Quỷ" },
  { id: "909042008", name: "Evo Chim Gõ Kiến - Mãnh Hổ Oai Hùng" }
];

const getCleanNameServer = () => {
  const lines = (nameServer || '').split('\n').map(l => l.trim()).filter(Boolean);
  const tag = lines.find(l => l.startsWith('@'));
  const bold = lines.find(l => /\*\*(.*?)\*\*/.test(l) || /__(.*?)__/.test(l));
  return [tag, bold].filter(Boolean).join(' ') + (tag || bold ? ' ' : '');
};

// Tạo danh sách động, không dùng **, nhìn sạch đẹp
async function getEmoteListMessage(prefix, aliasCommand) {
  let msg = "DANH SÁCH EMOTE FREE FIRE\n\n";
  EMOTE_LIST.forEach((e, i) => {
    msg += `${String(i+1).padStart(2, '0')}. ${e.name}\n`;
  });
  msg += `\nCách dùng:\n${prefix}${aliasCommand} <teamcode> [UID 1] [UID 2] [UID 3] [UID 4] <số_emote>`;
  return msg;
}

export async function handleEmoteCommand(api, message, aliasCommand) {
  const threadId = message?.threadId;
  const uid = message?.data?.uidFrom;
  const content = (message?.data?.content || '').trim();
  if (!content || !uid) return false;

  const prefix = await getGlobalPrefix();
  const serverName = getCleanNameServer();
  const fullCommand = `${prefix}${aliasCommand}`;

  // Chỉ gõ lệnh → hiện danh sách
  if (content === fullCommand || content === fullCommand + " ") {
    const listMsg = await getEmoteListMessage(prefix, aliasCommand);
    await sendMessageStateQuote(api, message, `${serverName}${listMsg}`, true, 180000, threadId !== uid);
    return true;
  }

  if (!content.startsWith(fullCommand + " ")) return false;

  const args = content.slice(fullCommand.length).trim().split(/\s+/);

  // Sai cú pháp → hiện hướng dẫn
  if (args.length < 3) {
    const listMsg = await getEmoteListMessage(prefix, aliasCommand);
    await sendMessageStateQuote(api, message, `${serverName}Sai cú pháp rồi!\n\n${listMsg}`, true, 60000, threadId !== uid);
    return true;
  }

  // Kiểm tra số emote
  const emoteNum = parseInt(args[args.length - 1]);
  if (isNaN(emoteNum) || emoteNum < 1 || emoteNum > EMOTE_LIST.length) {
    const listMsg = await getEmoteListMessage(prefix, aliasCommand);
    await sendMessageStateQuote(api, message, `${serverName}Số emote không hợp lệ!\nChọn từ 1 đến 20\n\n${listMsg}`, true, 60000, threadId !== uid);
    return true;
  }

  const emote = EMOTE_LIST[emoteNum - 1];
  const teamcode = args[0];
  const uids = args.slice(1, -1).filter(id => /^\d+$/.test(id)).slice(0, 4);

  if (uids.length === 0) {
    const listMsg = await getEmoteListMessage(prefix, aliasCommand);
    await sendMessageStateQuote(api, message, `${serverName}Thiếu UID rồi nha!\n\n${listMsg}`, true, 60000, threadId !== uid);
    return true;
  }

  // Gọi API
  let url = `http://103.157.204.204:5000/join?tc=${encodeURIComponent(teamcode)}&emote_id=${encodeURIComponent(emote.id)}`;
  uids.forEach((u, i) => url += `&uid${i+1}=${encodeURIComponent(u)}`);

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(tid);

    if (res.ok) {
      const data = await res.json();
      const reply = `${serverName}
Gửi emote thành công!
Teamcode: ${teamcode}
UID: ${uids.join(', ')}
Emote: ${emoteNum}. ${emote.name}
Trạng thái: ${data.message || 'Done'}`;

      await sendMessageStateQuote(api, message, reply, true, 60000, threadId !== uid);
    } else {
      await sendMessageStateQuote(api, message, `${serverName}Lỗi API: ${res.status}`, true, 60000, threadId !== uid);
    }
  } catch (e) {
    await sendMessageStateQuote(
      api,
      message,
      `${serverName}Lỗi kết nối${e.name === 'AbortError' ? ' (timeout)' : ''}`,
      true,
      60000,
      threadId !== uid
    );
  }

  return true;
}
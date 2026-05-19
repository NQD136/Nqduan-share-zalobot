import fs from 'fs';
import path from 'path';
import { getBotId } from '../../index.js'; 
import { getGlobalPrefix } from '../service.js'; 

import { sendMessageQuery } from '../chat-zalo/chat-style/chat-style.js';

// --- LOGIC TRA CỨU BANK ---
const BANK_CODES = {
    "vcb": { bin: "970436", name: "VIETCOMBANK" },
    "vietcombank": { bin: "970436", name: "VIETCOMBANK" },
    "tcb": { bin: "970407", name: "TECHCOMBANK" },
    "techcombank": { bin: "970407", name: "TECHCOMBANK" },
    "mb": { bin: "970422", name: "MB BANK" },
    "mbbank": { bin: "970422", name: "MB BANK" },
    "mb bank": { bin: "970422", name: "MB BANK" },
    "acb": { bin: "970416", name: "ACB" },
    "vib": { bin: "970441", name: "VIB" },
    "bidv": { bin: "970418", name: "BIDV" },
    "vietinbank": { bin: "970415", name: "VIETINBANK" },
    "vtb": { bin: "970415", name: "VIETINBANK" },
    "tpbank": { bin: "970423", name: "TPBANK" },
    "vpbank": { bin: "970432", name: "VPBANK" },
    "agribank": { bin: "970405", name: "AGRIBANK" },
    "sacombank": { bin: "970403", name: "SACOMBANK" },
    "scb": { bin: "970429", name: "SCB" },
    "hdbank": { bin: "970437", name: "HDBANK" },
    "ocb": { bin: "970448", name: "OCB" },
    "msb": { bin: "970426", name: "MSB" },
    "maritimebank": { bin: "970426", name: "MSB" },
    "shb": { bin: "970443", name: "SHB" },
    "eximbank": { bin: "970431", name: "EXIMBANK" },
    "exim": { bin: "970431", name: "EXIMBANK" },
    "dongabank": { bin: "970406", name: "DONGABANK" },
    "dab": { bin: "970406", name: "DONGABANK" },
    "pvcombank": { bin: "970412", name: "PVCOMBANK" },
    "gpbank": { bin: "970408", name: "GPBANK" },
    "oceanbank": { bin: "970414", name: "OCEANBANK" },
    "namabank": { bin: "970428", name: "NAMABANK" },
    "ncb": { bin: "970419", name: "NCB" },
    "vietabank": { bin: "970427", name: "VIETABANK" },
    "vietbank": { bin: "970433", name: "VIETBANK" },
    "vrb": { bin: "970421", name: "VRB" },
    "wooribank": { bin: "970457", name: "WOORIBANK" },
    "uob": { bin: "970458", name: "UOB" },
    "standardchartered": { bin: "970410", name: "STANDARD CHARTERED" },
    "publicbank": { bin: "970439", name: "PUBLIC BANK" },
    "shinhanbank": { bin: "970424", name: "SHINHAN BANK" },
    "hsbc": { bin: "458761", name: "HSBC" },
    "coop": { bin: "970446", name: "COOPBANK" },
    "coopbank": { bin: "970446", name: "COOPBANK" },
    "lienvietpostbank": { bin: "970449", name: "LIENVIETPOSTBANK" },
    "lvb": { bin: "970449", name: "LIENVIETPOSTBANK" },
    "baovietbank": { bin: "970438", name: "BAOVIETBANK" },
    "bvb": { bin: "970438", name: "BAOVIETBANK" }
};

function findAccountNumber(text) {
    const numbers = text.match(/\d+/g);
    if (!numbers) return null;
    return numbers[0];
}

function findBankCode(text) {
    const words = text.toLowerCase().split(/[\s,.-]+/);
    for (const word of words) {
        if (BANK_CODES[word]) {
            return {
                bin: BANK_CODES[word].bin,
                name: BANK_CODES[word].name,
                word: word
            };
        }
    }
    return null;
}

// --- QUẢN LÝ DỮ LIỆU JSON ---

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE_PATH = path.join(DATA_DIR, 'mybank-data.json');

function ensureDataDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAllData() {
  ensureDataDirExists();
  if (!fs.existsSync(DATA_FILE_PATH)) {
    return {};
  }
  try {
    const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Lỗi nghiêm trọng khi đọc mybank-data.json:", error);
    return {};
  }
}

function getBotBankData() {
  const botId = getBotId();
  if (botId === -1) return null;

  const allData = readAllData();
  if (!allData[botId]) {
    allData[botId] = [];
  }
  return allData[botId];
}

function saveBotBankData(botBankList) {
  const botId = getBotId();
  if (botId === -1) {
    console.error("Không thể lưu data bank: botId chưa sẵn sàng.");
    return;
  }

  const allData = readAllData();
  allData[botId] = botBankList;

  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(allData, null, 2), 'utf8');
  } catch (error) {
    console.error("Lỗi nghiêm trọng khi ghi mybank-data.json:", error);
  }
}

// --- CÁC HÀM XỬ LÝ LỆNH CON ---

async function handleAddBank(api, message, addArgsString) {
  
  const accountNumber = findAccountNumber(addArgsString);
  if (!accountNumber) {
    return api.sendMessage({
      msg: "Cú pháp sai. Không tìm thấy Số tài khoản.",
      ttl: 60000
    }, message.threadId, message.type);
  }

  const bankInfo = findBankCode(addArgsString);
  if (!bankInfo) {
    return api.sendMessage({
      msg: "Cú pháp sai. Không tìm thấy Tên ngân hàng (ví dụ: vcb, tcb, mb...)\n\nVui lòng gõ đúng tên viết tắt.",
      ttl: 60000
    }, message.threadId, message.type);
  }
  
  const text = addArgsString
    .replace(accountNumber, '')
    .replace(new RegExp(bankInfo.word, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
     return api.sendMessage({
       msg: "Cú pháp sai. Bạn chưa nhập <Text hiển thị trên card>.",
       ttl: 60000
      }, message.threadId, message.type);
  }

  const botBankData = getBotBankData();
  if (botBankData === null) return;

  botBankData.push({
    accountNumber: accountNumber,
    binBank: bankInfo.bin,
    text: text
  });

  saveBotBankData(botBankData);

  await api.sendMessage({
    msg: `✅ Đã thêm thành công!\nSTT: ${botBankData.length}\nNH: ${bankInfo.name}\nSTK: ${accountNumber}\nText: ${text}`,
    quote: message,
    ttl: 60000
  }, message.threadId, message.type);
}

async function handleListBank(api, message) {
  const botBankData = getBotBankData();
  if (botBankData === null) return;

  if (botBankData.length === 0) {
    return api.sendMessage({
      msg: "Bạn chưa lưu tài khoản ngân hàng nào.",
      ttl: 60000
    }, message.threadId, message.type);
  }

  let listMsg = "--- 🏦 DANH SÁCH BANK 🏦 ---";
  botBankData.forEach((bank, index) => {
    const bankName = Object.values(BANK_CODES).find(b => b.bin === bank.binBank)?.name || "Không rõ";
    
    listMsg += `\n\n${index + 1}. NH: ${bankName}`
             + `\n   STK: ${bank.accountNumber}`
             + `\n   Text: ${bank.text || "Chưa có"}`;
  });

  await api.sendMessage({ msg: listMsg, ttl: 60000 }, message.threadId, message.type);
}

async function handleRemoveBank(api, message, stt) {
  if (!stt || !/^\d+$/.test(stt)) {
    return api.sendMessage({
      msg: "Cú pháp sai. Yêu cầu: remove <STT>",
      ttl: 60000
    }, message.threadId, message.type);
  }

  const botBankData = getBotBankData();
  if (botBankData === null) return;

  const index = parseInt(stt) - 1;

  if (index < 0 || index >= botBankData.length) {
    return api.sendMessage({
      msg: `Không tìm thấy bank có STT: ${stt}`,
      ttl: 60000
    }, message.threadId, message.type);
  }

  const removed = botBankData.splice(index, 1);
  saveBotBankData(botBankData);

  await api.sendMessage({
    msg: `✅ Đã xóa bank:\nSTK: ${removed[0].accountNumber}\nText: ${removed[0].text}`,
    quote: message,
    ttl: 60000
  }, message.threadId, message.type);
}

async function handleSendBank(api, message, stt) {
  if (!stt || !/^\d+$/.test(stt)) {
    return api.sendMessage({
      msg: "Cú pháp sai. Yêu cầu: <STT>",
      ttl: 60000
    }, message.threadId, message.type);
  }

  const botBankData = getBotBankData();
  if (botBankData === null) return;

  const index = parseInt(stt) - 1;

  if (index < 0 || index >= botBankData.length) {
    return api.sendMessage({
      msg: `Không tìm thấy bank có STT: ${stt}`,
      ttl: 60000
    }, message.threadId, message.type);
  }

  const bank = botBankData[index];

  try {
    await api.sendBankCard(
      message,
      bank.binBank,
      bank.accountNumber,
      bank.text,
      3600000 // TTL 1 GIỜ CHO BANK CARD
    );

  } catch (error) {
    console.error("Lỗi khi gửi bank card:", error);
    await api.sendMessage({
      msg: `Đã xảy ra lỗi khi gửi bank: ${error.message}`,
      ttl: 60000
    }, message.threadId, message.type);
  }
}

// --- BỘ ĐIỀU HƯỚNG LỆNH CHÍNH ---

export async function myBankBusinessCommand(api, message, aliasCommand) {
  if (!message.data || !message.data.content) {
    return;
  }

  const botId = getBotId();
  const threadId = message.threadId;
  const prefixCommand = getGlobalPrefix();

  const argsString = message.data.content.substring(prefixCommand.length + aliasCommand.length).trim();
  const args = argsString.split(/\s+/).filter(Boolean);

  if (botId === -1) {
    return api.sendMessage({
      msg: "Bot chưa sẵn sàng, không thể truy cập dữ liệu ngân hàng. Vui lòng thử lại sau.",
      ttl: 60000
    }, threadId, message.type);
  }

  const subCommand = args[0] ? args[0].toLowerCase() : '';

  try {
    if (subCommand === 'add') {
      const addArgsString = argsString.substring(4).trim();
      await handleAddBank(api, message, addArgsString);
      
    } else if (subCommand === 'list') {
      await handleListBank(api, message);
      
    } else if (subCommand === 'remove' || subCommand === 'rm' || subCommand === 'del') {
      await handleRemoveBank(api, message, args[1]);
      
    } else if (/^\d+$/.test(subCommand)) {
      const stt = subCommand;
      
      if (args.length > 1) {
          return api.sendMessage({
            msg: "Cú pháp sai. Lệnh này không cần nội dung đi kèm.",
            ttl: 60000
          }, message.threadId, message.type);
      }
      
      await handleSendBank(api, message, stt);
      
    } else {
      // Tin nhắn trợ giúp
      const helpMsg = `--- 🏦 QUẢN LÝ BANK 🏦 ---
» ${prefixCommand}${aliasCommand} add <STK> <Tên NH> <Text>
(Ví dụ: ... add 123456 vcb Noi dung hien thi)
» ${prefixCommand}${aliasCommand} list
(Xem danh sách bank đã lưu)
» ${prefixCommand}${aliasCommand} <STT>
(Gửi bank theo STT)
» ${prefixCommand}${aliasCommand} remove <STT>
(Xóa bank theo STT)`;
      
      // =================================================================
      // SỬA 2: Thay thế api.sendMessage bằng sendMessageQuery
      // (Giống cách file gemini.js dùng)
      // =================================================================
      await sendMessageQuery(api, message, helpMsg);
    }
  } catch (error) {
     console.error("Lỗi trong myBankBusinessCommand:", error);
     await api.sendMessage({
       msg: `Đã xảy ra lỗi không xác định: ${error.message}`,
       ttl: 60000
      }, threadId, message.type);
  }
}
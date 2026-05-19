import fs from 'fs';
import path, { dirname } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { sendMessageFactory } from '../../api-zalo/apis/sendMessage.js';
import fetch from 'node-fetch';
import { getGlobalPrefix } from '../service.js';
import { nameServer } from '../../database/index.js';
import { createTestflightImage } from './testflight-canvas.js'; // Import hàm vẽ ảnh mới

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const des = {
  name: 'testflight',
  type: 1,
  permission: 'all',
  countdown: 10, // Tăng countdown vì có xử lý ảnh
  active: true,
};

// Hàm ghép dòng tag + tên server (giữ nguyên)
const getCleanNameServer = () => {
  const lines = nameServer
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith('@'));
  const boldLine = lines.find(line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line));

  return [tagLine, boldLine].filter(Boolean).join(' ');
};

export async function handleTestflightCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const sendMessage = sendMessageFactory(api);
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  let isGroup = threadId !== uid;
  if (typeof message.isGroup !== 'undefined') isGroup = message.isGroup;

  if (!content.startsWith(`${currentPrefix}testflight`)) {
    return; // Không phải lệnh này thì bỏ qua
  }

  const args = content.slice(currentPrefix.length + 'testflight'.length).trim();
  if (!args) {
    return sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Vui lòng nhập tên ứng dụng cần tìm.\n👉 Ví dụ: ${currentPrefix}testflight locket`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }

  try {
    // Thông báo chờ
    await sendMessage({ msg: `🔎 Đang tìm kiếm "${args}" trên TestFlight...` }, threadId, isGroup ? 1 : 0);
    
    const apiUrl = `https://api.nemg.me/testflight?search=${encodeURIComponent(args)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok || !data.success || data.tong_so === 0 || !data.ung_dung) {
      return sendMessage(
        {
          msg: `${getCleanNameServer()}❌ Không tìm thấy ứng dụng nào có tên "${args}".`,
          ttl: 60000
        },
        threadId,
        isGroup ? 1 : 0
      );
    }

    // 1. Dùng hàm mới để tạo ảnh kết quả
    const imagePath = await createTestflightImage(data.ung_dung);

    // 2. Tạo nội dung text
    const testflightLinks = data.ung_dung
      .map((app, index) => `${index + 1}: ${app.testflight}`)
      .join('\n');

    const msg = `${getCleanNameServer()} KẾT QUẢ TÌM KIẾM TESTFLIGHT 

${testflightLinks}`;

    // 3. Gửi ảnh kèm text
    await sendMessage(
      {
        attachments: [imagePath],
        msg: msg,
        ttl: 3600000
      },
      threadId,
      isGroup ? 1 : 0
    );

    // 4. Xóa file ảnh tạm
    fs.unlinkSync(imagePath);

  } catch (err) {
    console.error('❌ TestFlight Error:', err);
    await sendMessage(
      {
        msg: `${getCleanNameServer()}❌ Lỗi: ${err.message}`,
        ttl: 60000
      },
      threadId,
      isGroup ? 1 : 0
    );
  }
}
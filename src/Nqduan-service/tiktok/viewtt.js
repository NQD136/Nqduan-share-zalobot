import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { sendMessageFactory } from '../../api-zalo/apis/sendMessage.js';
import { MessageType } from '../../api-zalo/models/Message.js';

const commandConfigPath = path.join(process.cwd(), 'assets', 'json-data', 'command.json');

function getBotPrefix() {
  try {
    const config = JSON.parse(fs.readFileSync(commandConfigPath, 'utf8'));
    return config.prefix || '/';
  } catch (err) {
    console.error('Lỗi khi đọc prefix từ command.json:', err);
    return '/';
  }
}

export const des = {
  name: 'viewtt',
  type: 1,
  permission: 'all',
  countdown: 5,
  active: true,
  alias: ['viewtt'],
};

// Buff với 1000 requests song song
async function buffLink(url, time) {
  const apiUrl = `https://apitiktok.kingapi.x10.mx/buffviewtik?url=${encodeURIComponent(url)}&time=${encodeURIComponent(time)}`;
  const requests = Array.from({ length: 1000 }, () => fetch(apiUrl));
  await Promise.allSettled(requests);
}

export async function handleViewttCommand(api, message) {
  const threadId = message.threadId;
  const content = message.data.content.trim();
  const senderName = message.data.dName || 'Người dùng';
  const messageId = message.messageId;
  const sendMessage = sendMessageFactory(api);
  const parts = content.split(/\s+/);
  const prefix = getBotPrefix();

  if (parts.length < 3) {
    return sendMessage({
      msg: `❌ Định dạng sai, @${senderName}!\nDùng: ${prefix}viewtt <link TikTok> <thời gian giây>`,
      ttl: 60000,
      replyTo: messageId
    }, threadId, MessageType.GroupMessage);
  }

  const url = parts[1];
  const time = parts[2];

  // Chấp nhận mọi định dạng link TikTok, chỉ cần chứa "tiktok.com"
  if (!url.includes('tiktok.com')) {
    return sendMessage({
      msg: `❌ URL TikTok không hợp lệ, @${senderName}!`,
      ttl: 60000,
      replyTo: messageId
    }, threadId, MessageType.GroupMessage);
  }

  try {
    await sendMessage({
      msg: `🚀 Đang chạy ${time} giây cho ${url}\n⏳ Vui lòng chờ...`,
      ttl: 60000,
      replyTo: messageId
    }, threadId, MessageType.GroupMessage);

    await buffLink(url, time);

    await sendMessage({
      msg: `✅ Hoàn tất buff view cho bạn, @${senderName}!\n🔗 Link: ${url}\n⏱️ Thời gian: ${time} giây\n🚀 Đã gửi 1000 requests tới API.`,
      ttl: 60000,
      replyTo: messageId
    }, threadId, MessageType.GroupMessage);
  } catch (err) {
    console.error('Lỗi khi buff:', err);
    await sendMessage({
      msg: `❌ Đã xảy ra lỗi khi buff view cho bạn, @${senderName}!`,
      ttl: 60000,
      replyTo: messageId
    }, threadId, MessageType.GroupMessage);
  }
}
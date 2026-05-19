import fetch from 'node-fetch';
import { getGlobalPrefix } from '../service.js';
import {
  sendMessageStateQuote,
  sendMessageFailed
} from '../chat-zalo/chat-style/chat-style.js';
import { nameServer } from '../../database/index.js';

export const des = {
  name: 'soxo',
  type: 1,
  permission: 'all',
  countdown: 5,
  active: true,
};

// ✅ Lấy tag + chữ đỏ
const getCleanNameServer = () => {
  const lines = nameServer
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  const tagLine = lines.find(line => line.startsWith('@'));
  const boldLine = lines.find(line => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line));

  return [tagLine, boldLine].filter(Boolean).join(' ');
};

export async function handleSoxoCommand(api, message) {
  // ✅ Lấy text từ mọi trường hợp
  const rawContent =
    message?.data?.content ||
    message?.content ||
    message?.body ||
    '';

  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    console.log('[Soxo] Bỏ qua vì không tìm thấy text trong message');
    return false;
  }

  const content = rawContent.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}soxo`)) {
    return false; // Không phải lệnh soxo
  }

  const args = content.slice(currentPrefix.length + 5).trim().split(/\s+/);

  const listKhuVuc = [
    "Mega", "Power", "MN", "MT", "MB", "TP HCM", "Đồng Tháp", "Cà Mau", "Bến Tre",
    "Vũng Tàu", "Bạc Liêu", "Đồng Nai", "Cần Thơ", "Sóc Trăng", "Tây Ninh", "An Giang",
    "Bình Thuận", "Vĩnh Long", "Bình Dương", "Trà Vinh", "Long An", "Hậu Giang",
    "Bình Phước", "Tiền Giang", "Kiên Giang", "Đà Lạt", "Hà Nội", "Quảng Ninh",
    "Bắc Ninh", "Hải Phòng", "Nam Định", "Thái Bình", "Thừa Thiên Huế", "Phú Yên",
    "Quảng Nam", "Đắk Lắk", "Đà Nẵng", "Khánh Hòa", "Bình Định", "Quảng Trị",
    "Quảng Bình", "Gia Lai", "Ninh Thuận", "Quảng Ngãi", "Đắk Nông", "Kon Tum"
  ];

  // Nếu không nhập khu vực → báo danh sách
  if (!args[0]) {
    return sendMessageStateQuote(
      api, message,
      `${getCleanNameServer()}Vui lòng nhập khu vực mà bạn muốn tra\nĐây là các đài xổ số hiện có: ${listKhuVuc.join(', ')}`,
      true, 60000, false
    );
  }

  const khuvuc = args.join(' ');

  try {
    const apiUrl = `https://hoangdev.io.vn/content/xoso?kenh=${encodeURIComponent(khuvuc)}&apikey=eVZlX6CrvO7mzsUSgPCQt6UfZCMCkwCo`;
    console.log('[Soxo] Gọi API:', apiUrl);

    const res = await fetch(apiUrl, { method: 'GET' });
    const json = await res.json();

    console.log('[Soxo] Kết quả API:', json);

    if (!res.ok) {
      return sendMessageStateQuote(
        api, message,
        `${getCleanNameServer()}❌ API lỗi HTTP ${res.status}`,
        true, 60000, false
      );
    }

    if (!json || !json.success) {
      return sendMessageStateQuote(
        api, message,
        `${getCleanNameServer()}❌ Không tìm thấy dữ liệu cho "${khuvuc}"`,
        true, 60000, false
      );
    }

    // ✅ Format trả về đúng yêu cầu
    const msg = {
      success: true,
      data: json.data
    };

    return sendMessageStateQuote(
      api, message,
      `${getCleanNameServer()}${JSON.stringify(msg)}`,
      true, 1800000, false
    );

  } catch (e) {
    console.error('[Soxo] Lỗi API:', e);
    return sendMessageFailed(api, message, `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`, true);
  }
}
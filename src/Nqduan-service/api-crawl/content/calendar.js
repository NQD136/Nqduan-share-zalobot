// src/Nqduan-service/api-crawl/content/calendar.js
import fs from "fs/promises";
import fss from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { getGlobalPrefix } from "../../service.js";
import { removeMention, getTimeNow } from "../../../utils/format-util.js";

/* ==================== TIỆN ÍCH CHUNG ==================== */
const fmt2 = (n) => String(n).padStart(2, "0");
async function sendImageAny(api, message, filePath) {
  const stream = () => fss.createReadStream(filePath);
  try {
    await api.sendMessage(
      { msg: " ", attachments: [filePath] },
      message.threadId,
      message.type,
    );
    return true;
  } catch {}
  try {
    await api.sendMessage(
      { msg: " ", attachments: [stream()] },
      message.threadId,
      message.type,
    );
    return true;
  } catch {}
  try {
    await api.sendMessage(
      { msg: " ", attachment: stream() },
      message.threadId,
      message.type,
    );
    return true;
  } catch {}
  try {
    await api.sendMessage(
      { photo: filePath, caption: "" },
      message.threadId,
      message.type,
    );
    return true;
  } catch {}
  try {
    await api.sendMessage(
      { image: filePath, caption: "" },
      message.threadId,
      message.type,
    );
    return true;
  } catch {}
  return false;
}

/* ==================== LAZY LOAD RENDERER ==================== */
let rendererLoaded = false;
let renderCalendarCardExactToFile, assetsPreset;

async function ensureRenderer() {
  if (rendererLoaded) return;
  const hereFile = fileURLToPath(import.meta.url);
  const hereDir = path.dirname(hereFile);

  // --- SỬA LỖI TẠI ĐÂY ---
  // File này ở: /Nqduan-service/api-crawl/content/
  // File utils ở: /utils/
  // Cần đi ngược 3 cấp (content -> api-crawl -> Nqduan-service -> src)
  const utilAbs = path.resolve(
    hereDir,
    "../../../utils/canvas/calendar-card.js",
  );

  const mod = await import(pathToFileURL(utilAbs).href);
  renderCalendarCardExactToFile = mod.renderCalendarCardExactToFile;
  assetsPreset = mod.assetsPreset;
  rendererLoaded = true;
}

/* ==================== PARSE ARGS ==================== */
// %xemlich [dd/mm/yyyy | homnay | mai]
function parseDateArg(arg) {
  if (!arg) return null;
  const a = arg.trim().toLowerCase();
  if (["homnay", "hômnay", "hn", "today"].includes(a)) return getTimeNow();
  if (["mai", "ngaymai", "tomorrow", "tmr"].includes(a)) {
    const d = getTimeNow();
    d.setDate(d.getDate() + 1);
    return d;
  }
  const m = a.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
  if (m) {
    const now = getTimeNow();
    const dd = Math.min(+m[1], 31),
      mm = Math.min(+m[2], 12);
    const yyyy = m[3] ? +m[3] : now.getFullYear();
    return new Date(`${yyyy}-${fmt2(mm)}-${fmt2(dd)}T00:00:00+07:00`);
  }
  return null;
}

/* ==================== ÂM LỊCH OFFLINE (UTC+7) ==================== */
// Thuật toán chuyển Dương → Âm (Hồ Ngọc Đức)
function INT(d) {
  return Math.floor(d);
}
function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161)
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}
function jdToDate(jd) {
  let a, b, c, d, e, m;
  if (jd > 2299160) {
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  d = INT((4 * c + 3) / 1461);
  e = c - INT((1461 * d) / 4);
  m = INT((5 * e + 2) / 153);
  const day = e - INT((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * INT(m / 10);
  const year = b * 100 + d - 4800 + INT(m / 10);
  return [day, month, year];
}
function NewMoon(k) {
  const T = k / 1236.85,
    T2 = T * T,
    T3 = T2 * T,
    dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 -= 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * dr * Mpr);
  C1 -= 0.0004 * Math.sin(3 * dr * Mpr);
  C1 += 0.0104 * Math.sin(2 * dr * F) - 0.0051 * Math.sin((M + Mpr) * dr);
  C1 -= 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr);
  C1 -=
    0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr);
  C1 +=
    0.001 * Math.sin((2 * F - Mpr) * dr) +
    0.0005 * Math.sin((2 * Mpr + M) * dr);
  const deltat =
    T < -11
      ? 0.001 +
        0.000839 * T +
        0.0002261 * T2 -
        0.00000845 * T3 -
        0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}
function getNewMoonDay(k, timeZone) {
  return INT(NewMoon(k) + 0.5 + timeZone / 24);
}
function SunLongitude(jdn) {
  const T = (jdn - 2451545.0) / 36525,
    T2 = T * T,
    dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL +=
    (0.019993 - 0.000101 * T) * Math.sin(2 * dr * M) +
    0.00029 * Math.sin(3 * dr * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - 2 * Math.PI * INT(L / (2 * Math.PI));
  return INT(L / (Math.PI / 6)); // 0..11
}
function getSunLongitude(jdn, timeZone) {
  return SunLongitude(jdn - 0.5 - timeZone / 24);
}
function getLunarMonth11(yy, timeZone) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  if (getSunLongitude(nm, timeZone) >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}
function getLeapMonthOffset(a11, timeZone) {
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let last = 0,
    i = 1,
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc != last && i < 14);
  return i - 1;
}
function convertSolar2Lunar(dd, mm, yy, timeZone) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone);
  let a11 = getLunarMonth11(yy, timeZone),
    b11 = a11,
    lunarYear = 0;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  let diff = INT((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff == leapMonthDiff) lunarLeap = 1;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return {
    day: lunarDay,
    month: lunarMonth,
    year: lunarYear,
    isLeap: !!lunarLeap,
  };
}

/* ==================== CAN–CHI + GIỜ ==================== */
const CAN = [
  "Giáp",
  "Ất",
  "Bính",
  "Đinh",
  "Mậu",
  "Kỷ",
  "Canh",
  "Tân",
  "Nhâm",
  "Quý",
];
const CHI = [
  "Tý",
  "Sửu",
  "Dần",
  "Mão",
  "Thìn",
  "Tỵ",
  "Ngọ",
  "Mùi",
  "Thân",
  "Dậu",
  "Tuất",
  "Hợi",
];
const HOUR_RANGE = {
  Tý: "23:00-0:59",
  Sửu: "1:00-2:59",
  Dần: "3:00-4:59",
  Mão: "5:00-6:59",
  Thìn: "7:00-8:59",
  Tỵ: "9:00-10:59",
  Ngọ: "11:00-12:59",
  Mùi: "13:00-14:59",
  Thân: "15:00-16:59",
  Dậu: "17:00-18:59",
  Tuất: "19:00-20:59",
  Hợi: "21:00-22:59",
};
function canChiYear(y) {
  return `${CAN[(y + 6) % 10]} ${CHI[(y + 8) % 12]}`;
}
function canChiDay(jd) {
  return `${CAN[(jd + 9) % 10]} ${CHI[(jd + 1) % 12]}`;
}
function canChiMonth(lunarMonth, lunarYear) {
  const can = CAN[(lunarYear * 12 + lunarMonth + 3) % 10];
  const chi = CHI[(lunarMonth + 1) % 12];
  return `${can} ${chi}`;
}
// Bảng giờ Hoàng đạo theo Chi của NGÀY (nguồn tổng hợp pháp luật/pt tam nguyên)
function hoangDaoBranchesByDayChi(chiDay) {
  switch (chiDay) {
    case "Tý":
    case "Ngọ":
      return ["Dần", "Mão", "Thìn", "Tỵ", "Thân", "Dậu"];
    case "Sửu":
    case "Mùi":
      return ["Tý", "Dần", "Mão", "Ngọ", "Thân", "Tuất"];
    case "Dần":
    case "Thân":
      return ["Tý", "Sửu", "Thìn", "Tỵ", "Mùi", "Tuất"];
    case "Mão":
    case "Dậu":
      return ["Tý", "Dần", "Mão", "Ngọ", "Mùi", "Dậu"];
    case "Thìn":
    case "Tuất":
      return ["Sửu", "Dần", "Thìn", "Ngọ", "Thân", "Dậu"];
    case "Tỵ":
    case "Hợi":
      return ["Dần", "Thìn", "Tỵ", "Thân", "Dậu", "Hợi"];
    default:
      return ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ"]; // fallback
  }
}
function formatHourLabel(branch) {
  return `${branch} (${HOUR_RANGE[branch]})`;
}

function computeGoodBadHoursByDayChi(chiDay) {
  const goodBranches = hoangDaoBranchesByDayChi(chiDay);
  const all = CHI.slice();
  const badBranches = all.filter((b) => !goodBranches.includes(b));
  // giữ thứ tự chuẩn Tý..Hợi
  return {
    good: goodBranches.map(formatHourLabel),
    bad: badBranches.map(formatHourLabel),
  };
}

/* ==================== TÍNH LỊCH NGÀY (REAL-TIME) ==================== */
function computeCalendar(dateObj) {
  const d = new Date(dateObj); // VN timezone đã set ở parseDateArg
  const dd = d.getDate(),
    mm = d.getMonth() + 1,
    yy = d.getFullYear();
  const jd = jdFromDate(dd, mm, yy);

  // âm lịch
  const lunar = convertSolar2Lunar(dd, mm, yy, 7);
  const lunarText = `${fmt2(lunar.day)}-${fmt2(lunar.month)}-${lunar.year}`;

  // can–chi
  const chiIndex = (jd + 1) % 12;
  const chiDay = CHI[chiIndex];
  const canchiText = `Ngày ${canChiDay(jd)} tháng ${canChiMonth(lunar.month, lunar.year)} năm ${canChiYear(lunar.year)}`;

  // giờ Hoàng đạo/Hắc đạo theo Chi của ngày
  const { good, bad } = computeGoodBadHoursByDayChi(chiDay);

  const summary =
    "Xuất hành thuận lợi, gặp quý nhân phụ trợ, làm mọi việc vừa lòng, như ý muốn, đỗ phẩm vinh quy.";
  return { lunar: lunarText, good, bad, summary, canchiText };
}

/* ==================== LOGIC COUNTDOWN ==================== */
/**
 * Tách riêng logic countdown để tái sử dụng
 * @param {Date} when - Ngày hiện tại (đã chuẩn hóa timezone)
 */
function _generateCountdowns(when) {
  const dd = when.getDate(),
    mm = when.getMonth() + 1,
    yy = when.getFullYear();
  const currentJd = jdFromDate(dd, mm, yy);

  // --- DANH SÁCH SỰ KIỆN MỚI (CHỈ DƯƠNG LỊCH CỐ ĐỊNH) ---
  const base = [
    // Quốc tế
    { label: "Tết Dương lịch", mm: 1, dd: 1 },
    { label: "Lễ Tình nhân (Valentine)", mm: 2, dd: 14 },
    { label: "Tết Âm Lịch", mm: 2, dd: 17 },
    { label: "Ngày Quốc tế Hạnh phúc", mm: 3, dd: 20 },
    { label: "Quốc tế Phụ nữ", mm: 3, dd: 8 },
    { label: "Ngày Cá tháng Tư", mm: 4, dd: 1 },
    { label: "Ngày Trái Đất", mm: 4, dd: 22 },
    { label: "Quốc tế Lao động", mm: 5, dd: 1 },
    { label: "Quốc tế Thiếu nhi", mm: 6, dd: 1 },
    { label: "Ngày Môi trường Thế giới", mm: 6, dd: 5 },
    { label: "Tết Trung Thu", mm: 9, dd: 25 },
    { label: "Lễ hội Halloween", mm: 10, dd: 31 },
    { label: "Lễ Giáng Sinh (Noel)", mm: 12, dd: 25 },

    // Việt Nam (cố định)
    { label: "Giải phóng Miền Nam", mm: 4, dd: 30 },
    { label: "Ngày Báo chí Việt Nam", mm: 6, dd: 21 },
    { label: "Ngày Gia đình Việt Nam", mm: 6, dd: 28 },
    { label: "Ngày Quốc khánh Việt Nam", mm: 9, dd: 2 },
    { label: "Giải phóng Thủ đô", mm: 10, dd: 10 },
    { label: "Ngày Phụ nữ Việt Nam", mm: 10, dd: 20 },
    { label: "Ngày Nhà giáo Việt Nam", mm: 11, dd: 20 },
    { label: "Ngày Quân Đội Nhân Dân Việt Nam", mm: 12, dd: 22 },
  ];

  // (Logic tính toán giữ nguyên)
  const sortedEvents = base
    .map((h) => {
      let eventYy = yy;

      // (Đây là dòng đã sửa lỗi 'eventYn' ở lần trước)
      let eventJd = jdFromDate(h.dd, h.mm, eventYy);

      // Nếu ngày sự kiện đã qua trong năm nay, tính cho năm sau
      if (eventJd < currentJd) {
        eventYy += 1;
        eventJd = jdFromDate(h.dd, h.mm, eventYy);
      }
      const diff = eventJd - currentJd;
      return { ...h, diff, eventYy };
    })
    .sort((a, b) => a.diff - b.diff);

  // === THAY ĐỔI: Lấy 6 sự kiện (thay vì 5) ===
  return sortedEvents.slice(0, 6).map((h) => `${h.diff} ngày nữa|${h.label}`);
}

/* ==================== LỆNH CHÍNH (CHO NGƯỜI DÙNG) ==================== */
export async function calendarCardCommand(api, message) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message) || "";
  const raw = content.replace(`${prefix}xemlich`, "").trim();
  const when = parseDateArg(raw) || getTimeNow(); // Lấy ngày hôm nay nếu không có arg

  let filePath = null;
  try {
    // 1. Tính toán
    const { lunar, good, bad, summary, canchiText } = computeCalendar(when);
    // 2. Lấy countdowns
    const countdowns = _generateCountdowns(when);

    // 3. Vẽ ảnh
    await ensureRenderer();
    filePath = await renderCalendarCardExactToFile({
      now: when,
      lunarText: lunar, // Âm Lịch – dd-mm-yyyy (real-time)
      canchiText, // Can–chi ngày/tháng/năm (real-time)
      summary, // mô tả ngắn
      goodHours: good, // Giờ Hoàng đạo theo Chi ngày (real-time)
      badHours: bad, // Giờ Hắc đạo còn lại
      countdowns, // Countdown động
      assets: assetsPreset(),
    });

    // 4. Gửi ảnh
    const ok = await sendImageAny(api, message, filePath);
    if (!ok)
      await api.sendMessage(
        {
          msg: "⚠️ Ảnh đã tạo nhưng SDK chưa gửi được file. Xem console để chỉnh payload.",
        },
        message.threadId,
        message.type,
      );
  } catch (e) {
    console.error("xemlich error:", e);
    await api.sendMessage(
      { msg: `❌ Lỗi khi tạo/gửi ảnh lịch: ${e?.message || e}` },
      message.threadId,
      message.type,
    );
  } finally {
    // 5. Xóa file tạm
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
  }
}

/* ==================== (MỚI) HÀM CHO SCHEDULER ==================== */
/**
 * Hàm tạo ảnh lịch (cho task) và trả về path
 * @param {Object} api - (Không dùng, nhưng giữ để tương thích API)
 * @param {Date} dateObj - Ngày cần tạo lịch
 * @returns {Promise<{imagePath: String|null, error: String|null}>}
 */
export async function generateCalendarImageForTask(api, dateObj) {
  let filePath = null;
  try {
    // 1. Tính toán
    const { lunar, good, bad, summary, canchiText } = computeCalendar(dateObj);
    // 2. Lấy countdowns
    const countdowns = _generateCountdowns(dateObj);

    // 3. Vẽ ảnh
    await ensureRenderer();
    filePath = await renderCalendarCardExactToFile({
      now: dateObj,
      lunarText: lunar,
      canchiText,
      summary,
      goodHours: good,
      badHours: bad,
      countdowns,
      assets: assetsPreset(),
    });

    // 4. Trả về đường dẫn (KHÔNG GỬI, KHÔNG XÓA)
    return { imagePath: filePath, error: null };
  } catch (error) {
    console.error(
      `[generateCalendarImageForTask] Lỗi: ${error.message}`,
      error.stack,
    );
    // Xóa file nếu bị lỗi trước khi trả về
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
    return { imagePath: null, error: error.message };
  }
}

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { getGlobalPrefix } from "../service.js";

import {
  sendMessageStateQuote,
  sendMessageFailed,
} from "../chat-zalo/chat-style/chat-style.js";

import { nameServer } from "../../database/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const des = {
  name: "ff",
  type: 1,
  permission: "all",
  countdown: 5,
  active: true,
};

// ✅ Gộp tag và chữ đỏ vào 1 dòng duy nhất
const getCleanNameServer = () => {
  const lines = nameServer
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  const tagLine = lines.find((line) => line.startsWith("@"));
  const boldLine = lines.find(
    (line) => /\*\*(.*?)\*\*/.test(line) || /__(.*?)__/.test(line),
  );

  return [tagLine, boldLine].filter(Boolean).join(" ");
};

export async function handleFfCommand(api, message) {
  const threadId = message.threadId;
  const uid = message.data.uidFrom;
  const content = message.data.content.trim();
  const currentPrefix = getGlobalPrefix();

  if (!content.startsWith(`${currentPrefix}ff`)) return false;

  const args = content
    .slice(currentPrefix.length + 2)
    .trim()
    .split(/\s+/);

  // ✅ Yêu cầu đúng 1 tham số (UID)
  if (args.length !== 1) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ Sai cú pháp! Dùng: ${currentPrefix}ff <uid>`,
      true,
      60000,
      false,
    );
  }

  const ffUid = args[0];

  if (!/^\d+$/.test(ffUid)) {
    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}❌ UID phải là số!`,
      true,
      60000,
      false,
    );
  }

  const apiUrl = `https://free-fire-info-site.vercel.app/player-info?uid=${ffUid}&region=sg`;
  console.log("Gọi API:", apiUrl);

  try {
    const res = await fetch(apiUrl);
    const json = await res.json();

    if (!res.ok || !json.basicInfo) {
      return sendMessageStateQuote(
        api,
        message,
        `${getCleanNameServer()}❌ Không tìm thấy thông tin cho UID ${ffUid} khu vực sg.`,
        true,
        60000,
        false,
      );
    }

    const info = json.basicInfo;
    const clan = json.clanBasicInfo || {};
    const admin = json.captainBasicInfo || {};
    const pet = json.petInfo || {};
    const social = json.socialInfo || {};
    const credit = json.creditScoreInfo || {};
    const diamond = json.diamondCostRes || {};
    const profile = json.profileInfo || {};

    const formatDate = (unix) => {
      if (!unix || isNaN(unix)) return "N/A";
      return new Date(Number(unix) * 1000).toLocaleString("vi-VN");
    };

    const msg = `🎮 THÔNG TIN FREE FIRE

👤 Người Chơi:
➤ Tên: ${info.nickname}
➤ UID: ${info.accountId}
➤ Region: ${info.region}
➤ Level: ${info.level}
➤ EXP: ${info.exp}
➤ Huy hiệu: ${info.badgeCnt}
➤ Likes: ${info.liked}
➤ BR Rank: ${info.rank} (${info.rankingPoints})
➤ CS Rank: ${info.csRank} (${info.csRankingPoints})
➤ OB: ${info.releaseVersion}
➤ Bio: ${social.signature || "Không có"}
➤ Ngày tạo: ${formatDate(info.createAt)}
➤ Đăng nhập gần nhất: ${formatDate(info.lastLoginAt)}

🏰 Quân Đoàn:
➤ Tên: ${clan.clanName || "N/A"}
➤ ID: ${clan.clanId || "N/A"}
➤ Level: ${clan.clanLevel || "N/A"}
➤ Thành viên: ${clan.memberNum || 0}

👑 Chỉ Huy Quân Đoàn:
➤ Tên: ${admin.nickname || "N/A"}
➤ UID: ${admin.accountId || "N/A"}
➤ Level: ${admin.level || "N/A"}
➤ EXP: ${admin.exp || 0}
➤ BR Rank: ${admin.rank} (${admin.rankingPoints})
➤ CS Rank: ${admin.csRank} (${admin.csRankingPoints})
➤ Đăng nhập gần nhất: ${formatDate(admin.lastLoginAt)}

🧸 Thú Cưng:
➤ ID: ${pet.id || "N/A"}
➤ Level: ${pet.level || "N/A"}
➤ EXP: ${pet.exp || "N/A"}
➤ Skill: ${pet.selectedSkillId || "N/A"}

🎭 Hồ Sơ:
➤ Avatar ID: ${profile.avatarId || "N/A"}
➤ Số trang phục: ${profile.clothes?.length || 0} 
➤ Kỹ năng trang bị: ${profile.equipedSkills?.length || 0}

💎 Khác:
➤ Kim cương đã dùng: ${diamond.diamondCost || 0}
➤ Điểm tín nhiệm: ${credit.creditScore || "N/A"}

🛠️ Created by: Nqduan`;

    return sendMessageStateQuote(
      api,
      message,
      `${getCleanNameServer()}${msg}`,
      true,
      1800000,
      false,
    );
  } catch (e) {
    console.error("Lỗi API FF:", e);
    return sendMessageFailed(
      api,
      message,
      `${getCleanNameServer()}❌ Lỗi khi truy vấn API: ${e.message}`,
      true,
    );
  }
}

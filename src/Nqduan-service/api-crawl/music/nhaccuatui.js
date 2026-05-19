// src/Nqduan-service/api-crawl/music/nhaccuatui.js
import axios from "axios";
import path from "path";
import fs from "fs";
import { LRUCache } from "lru-cache";
import { MessageMention } from "zlbotdqt";
import {
  sendMessageCompleteRequest,
  sendMessageWarningRequest,
} from "../../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service.js";
import { downloadAndConvertAudio } from "../../chat-zalo/chat-special/send-voice/process-audio.js";
import { removeMention } from "../../../utils/format-util.js";
import { sendVoiceMusic } from "../../chat-zalo/chat-special/send-voice/send-voice.js";
import { setSelectionsMapData } from "../index.js";
import {
  getCachedMedia,
  setCacheData,
} from "../../../utils/link-platform-cache.js";
import { createSearchResultImage } from "../../../utils/canvas/search-canvas.js";
import { deleteFile } from "../../../utils/util.js";
import { getBotId } from "../../../index.js";

const PLATFORM = "nhaccuatui";
const TIME_TO_SELECT = 60000;

// Cache cho danh sách chọn nhạc
const musicSelectionsMap = new LRUCache({
  max: 500,
  ttl: TIME_TO_SELECT,
});

const searchMusic = async (keyword, limit = 10) => {
  try {
    const encodedKeyword = encodeURIComponent(keyword.trim());
    const finalLimit = Math.max(1, parseInt(limit) || 10);
    const perPage = Math.min(finalLimit, 30);
    let allSongs = []; // Thu thập songs từ nhiều page
    let pageIndex = 1;
    let hasMore = true;
    const maxPages = 10; // Giới hạn max page để tránh loop vô tận (an toàn)

    while (allSongs.length < finalLimit && hasMore && pageIndex <= maxPages) {
      const timestamp = Date.now(); // Timestamp mới mỗi page để tránh cache API

      const url = `https://graph.nhaccuatui.com/api/v1/search/song?keyword=${encodedKeyword}&pageindex=${pageIndex}&pagesize=${perPage}&correct=false&timestamp=${timestamp}`;

      const { data: res } = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://www.nhaccuatui.com/",
          Origin: "https://www.nhaccuatui.com",
          Accept: "application/json",
        },
        timeout: 12000, // 12s/page
      });

      if (!res.success || !Array.isArray(res.data?.songs)) {
        hasMore = false;
      } else if (res.data.songs.length === 0) {
        hasMore = false;
      } else {
        const pageSongs = res.data.songs.length;
        allSongs = allSongs.concat(res.data.songs);
        pageIndex++;
      }
    }

    if (allSongs.length > finalLimit) {
      allSongs = allSongs.slice(0, finalLimit); // Slice nếu thừa (hiếm)
    }

    const items = allSongs.map((song) => {
      const isOfficial = (song.provider?.name || "")
        .toLowerCase()
        .includes("official");
      const isHD = song.qualityDownload?.some((q) => q.value >= 320) ?? false;

      // Ưu tiên 320kbps → 128kbps (không VIP)
      const stream320 = song.streamURL?.find(
        (s) => s.type === "320" && !s.onlyVIP,
      );
      const stream128 = song.streamURL?.find(
        (s) => s.type === "128" && !s.onlyVIP,
      );
      const streamUrl = stream320?.stream || stream128?.stream || "";

      return {
        id: song.key,
        songLink:
          song.linkShare ||
          `https://www.nhaccuatui.com/bai-hat/${song.key}.html`,
        title: song.name || "Unknown",
        artistsNames:
          song.artist?.map((a) => a.name).join(", ") ||
          song.artistName ||
          "Unknown Artist",
        thumbnail: (song.image || song.bgImage || "").replace(
          /150x150/,
          "600x600",
        ),
        streamingStatus: isOfficial ? 1 : 2,
        isOfficial,
        isHD,
        streamUrl,
        duration: song.duration,
        dateRelease: song.dateRelease,
      };
    });

    return { data: { items } };
  } catch (err) {
    console.error("searchMusic API NCT error:", err.message);
    return { data: { items: [] } };
  }
};

/* ==============================================================
   XỬ LÝ LỆNH TÌM KIẾM
   ============================================================== */
export async function handleNhacCuaTuiCommand(api, message, aliasCommand) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  let imagePath = null;

  try {
    const content = removeMention(message);
    const prefix = getGlobalPrefix();
    const commandContent = content
      .replace(`${prefix}${aliasCommand}`, "")
      .trim();
    const [keyword, numberMusic] = commandContent.split("&&");

    if (!keyword) {
      await sendMessageWarningRequest(
        api,
        message,
        {
          caption: `Vui lòng nhập từ khóa tìm kiếm\nVí dụ:\n${prefix}${aliasCommand} Bài Hát Cần Tìm`,
        },
        30000,
      );
      return;
    }

    const limit = parseInt(numberMusic) || 10;
    const result = await searchMusic(keyword, limit);

    if (!result?.data?.items?.length) {
      await sendMessageWarningRequest(
        api,
        message,
        { caption: `Không tìm thấy bài hát nào với từ khóa: "${keyword}"` },
        30000,
      );
      return;
    }

    const songs = result.data.items;
    let musicListTxt = `Danh sách **${songs.length}** bài hát trên NhacCuaTui:\n`;
    musicListTxt += "Trả lời tin nhắn này bằng **số thứ tự** để nghe.\n\n";

    const songsCustom = songs.map((s) => ({
      title: s.title,
      artistsNames: s.artistsNames,
      thumbnailM: s.thumbnail,
      isOfficial: s.isOfficial,
      isHD: s.isHD,
    }));

    imagePath = await createSearchResultImage(songsCustom);

    const object = { caption: musicListTxt, imagePath };
    const musicListMessage = await sendMessageCompleteRequest(
      api,
      message,
      object,
      TIME_TO_SELECT,
    );
    const quotedMsgId =
      musicListMessage?.message?.msgId ||
      musicListMessage?.attachment?.[0]?.msgId;

    musicSelectionsMap.set(quotedMsgId.toString(), {
      userRequest: senderId,
      collection: songs,
      timestamp: Date.now(),
    });

    setSelectionsMapData(senderId, {
      quotedMsgId: quotedMsgId.toString(),
      collection: songs,
      timestamp: Date.now(),
      platform: PLATFORM,
    });
  } catch (err) {
    console.error("handleNhacCuaTuiCommand error:", err);
    await api.sendMessage(
      {
        msg: `${senderName} Đã xảy ra lỗi khi tìm nhạc. Vui lòng thử lại sau.`,
        mentions: [MessageMention(senderId, senderName.length, 0)],
        ttl: 30000,
      },
      message.threadId,
      message.type,
    );
  } finally {
    if (imagePath && fs.existsSync(imagePath)) deleteFile(imagePath);
  }
}

/* ==============================================================
   XỬ LÝ REPLY CHỌN BÀI
   ============================================================== */
export async function handleNhacCuaTuiReply(api, message) {
  const senderId = message.data.uidFrom;
  const idBot = getBotId();

  try {
    if (!message.data.quote?.globalMsgId) return false;

    const quotedMsgId = message.data.quote.globalMsgId.toString();
    if (!musicSelectionsMap.has(quotedMsgId)) return false;

    const { userRequest, collection } = musicSelectionsMap.get(quotedMsgId);
    if (userRequest !== senderId) return false;

    const selection = removeMention(message).trim();
    const idx = parseInt(selection) - 1;

    if (isNaN(idx) || idx < 0 || idx >= collection.length) {
      await sendMessageWarningRequest(
        api,
        message,
        { caption: "Số thứ tự không hợp lệ. Vui lòng chọn lại từ danh sách." },
        30000,
      );
      return true;
    }

    const track = collection[idx];

    // Xóa tin nhắn danh sách
    await api.deleteMessage(
      {
        type: message.type,
        threadId: message.threadId,
        data: {
          cliMsgId: message.data.quote.cliMsgId,
          msgId: message.data.quote.globalMsgId,
          uidFrom: idBot,
        },
      },
      false,
    );
    musicSelectionsMap.delete(quotedMsgId);

    return await handleSendTrackNhacCuaTui(api, message, track);
  } catch (err) {
    console.error("handleNhacCuaTuiReply error:", err);
    await sendMessageWarningRequest(
      api,
      message,
      { caption: "Lỗi khi xử lý nhạc NhacCuaTui. Thử lại sau." },
      30000,
    );
    return true;
  }
}

/* ==============================================================
   GỬI BÀI HÁT (DÙNG STREAMURL TRỰC TIẾP)
   ============================================================== */
export async function handleSendTrackNhacCuaTui(api, message, track) {
  const cacheKey = track.id;
  const cached = await getCachedMedia(PLATFORM, cacheKey, null, track.title);
  let voiceUrl = cached?.fileUrl;

  if (!voiceUrl) {
    if (!track.streamUrl) {
      throw new Error("Không có stream URL hợp lệ");
    }

    await sendMessageCompleteRequest(
      api,
      message,
      { caption: `Đang tải: ${track.title}\nVui lòng chờ...` },
      10000,
    );

    voiceUrl = await downloadAndConvertAudio(
      track.streamUrl,
      api,
      message,
      cacheKey,
    );

    await setCacheData(
      PLATFORM,
      cacheKey,
      {
        fileUrl: voiceUrl,
        title: track.title,
        artist: track.artistsNames,
      },
      null,
    );

    // Dọn file tạm
    [".mp3", ".aac", ".m4a"].forEach((ext) => {
      const filePath = path.resolve(
        process.cwd(),
        "assets",
        "temp",
        `${cacheKey}${ext}`,
      );
      if (fs.existsSync(filePath)) deleteFile(filePath);
    });
  }

  const caption = `> From NhacCuaTui <\nNhạc bạn chọn đây!!!`;

  await sendVoiceMusic(
    api,
    message,
    {
      trackId: track.id,
      title: track.title,
      artists: track.artistsNames || "Unknown Artist",
      source: "NhacCuaTui",
      caption,
      imageUrl: track.thumbnail,
      voiceUrl,
    },
    86400000,
  );

  // Dọn file tạm lần cuối (tránh lỗi trùng key)
  [".mp3", ".aac", ".m4a"].forEach((ext) => {
    const filePath = path.resolve(
      process.cwd(),
      "assets",
      "temp",
      `${track.id}${ext}`,
    );
    if (fs.existsSync(filePath)) deleteFile(filePath);
  });

  return true;
}

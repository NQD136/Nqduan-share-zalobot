import axios from "axios";
import path from "path";
import CryptoJS from "crypto-js";
import { getGlobalPrefix } from "../../service.js";
import {
  sendMessageCompleteRequest,
  sendMessageProcessingRequest,
  sendMessageWarningRequest,
} from "../../chat-zalo/chat-style/chat-style.js";
import { downloadFile, deleteFile } from "../../../utils/util.js";
import { sendVoiceMusic } from "../../chat-zalo/chat-special/send-voice/send-voice.js";
import { capitalizeEachWord, removeMention } from "../../../utils/format-util.js";
import { setSelectionsMapData } from "../index.js";
import { getCachedMedia, setCacheData } from "../../../utils/link-platform-cache.js";
import { downloadYoutubeVideo, extractYoutubeId, getVideoFormatByQuality } from "../youtube/youtube-service.js";
import { sendTikTokVideo } from "../tiktok/tiktok-service.js";
import { getDataDownloadVideo } from "../tiktok/tiktok-api.js";
import { clearImagePath } from "../../../utils/canvas/index.js";
import { tempDir } from "../../../utils/io-json.js";
import { getBotId } from "../../../index.js";
import fs from "fs";
const { execSync, exec } = await import("child_process");
import { MultiMsgStyle, MessageStyle, MessageMention } from "../../../api-zalo/index.js";

export const COLOR_RED = "db342e";
export const COLOR_YELLOW = "f7b503";
export const COLOR_PINK = "FF1493";
export const COLOR_GREEN = "15a85f";
export const SIZE_16 = "14";
export const IS_BOLD = true;

function sanitizeFilename(name) {
  if (!name) return `media_${Date.now()}`;
  return name
    .replace(/[<>:"/\\|?*&%=#@!$'`~\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 100) || `media_${Date.now()}`;
}

function downloadBilibiliWithYTDLP(url, outputPathNoExt) {
  try {
    const command = `yt-dlp -f "bv*+ba/best" -o "${outputPathNoExt}.%(ext)s" "${url}"`;
    execSync(command, { stdio: "inherit" });
    return `${outputPathNoExt}.mp4`;
  } catch (error) {
    console.error("Lỗi khi tải Bilibili bằng yt-dlp:", error.message);
    return null;
  }
}

export const MEDIA_TYPES = {
  "tiktok.com": "tiktok",
  "douyin.com": "douyin",
  "capcut.com": "capcut",
  "threads.com": "threads",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "espn.com": "espn",
  "kuaishou.com": "kuaishou",
  "pinterest.com": "pinterest",
  "imdb.com": "imdb",
  "imgur.com": "imgur",
  "ifunny.co": "ifunny",
  "izlesene.com": "izlesene",
  "reddit.com": "reddit",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "twitter.com": "X",
  "x.com": "X",
  "vimeo.com": "vimeo",
  "snapchat.com": "snapchat",
  "bilibili.com": "bilibili",
  "dailymotion.com": "dailymotion",
  "sharechat.com": "sharechat",
  "linkedin.com": "linkedin",
  "tumblr.com": "tumblr",
  "hipi.co.in": "hipi",
  "t.me": "telegram",
  "getstickerpack.com": "getstickerpack",
  "bitchute.com": "bitchute",
  "febspot.com": "febspot",
  "9gag.com": "9gag",
  "ok.ru": "ok",
  "rumble.com": "rumble",
  "streamable.com": "streamable",
  "ted.com": "ted",
  "tv.sohu.com": "sohutv",
  "xvideos.com": "xvideos",
  "xnxx.com": "xnxx",
  "xiaohongshu.com": "xiaohongshu",
  "weibo.com": "weibo",
  "miaopai.com": "miaopai",
  "meipai.com": "meipai",
  "xiaoying.tv": "xiaoying",
  "national.video": "national",
  "yingke.com": "yingke",
  "soundcloud.com": "soundcloud",
  "mixcloud.com": "mixcloud",
  "spotify.com": "spotify",
  "zingmp3.vn": "zingmp3",
  "bandcamp.com": "bandcamp",
  "ixigua.com": "ixigua",
};

const me = {
  J2DOWN_SECRET:
    "U2FsdGVkX18wVfoTqTpAQwAnu9WB9osIMSnldIhYg6rMvFJkhpT6eUM9YqgpTrk41mk8calhYvKyhGF0n26IDXNmtXqI8MjsXtsq0nnAQLROrsBuLnu4Mzu63mpJsGyw",
  API_URL: "https://api.zeidteam.xyz/media-downloader/atd2?url="
};

function secretKey() {
  const decrypted = CryptoJS.AES.decrypt(me.J2DOWN_SECRET, "manhg-api");
  return decrypted.toString(CryptoJS.enc.Utf8);
}

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function encryptData(data) {
  const keyHex = CryptoJS.enc.Hex.parse(secretKey());
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(data, keyHex, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    iv: iv.toString(CryptoJS.enc.Hex),
    k: randomString(11) + "8QXBNv5pHbzFt5QC",
    r: "BRTsfMmf3CuN",
    encryptedData: encrypted.toString(),
  };
}

const getMediaType = (url) => {
  const urlLower = url.toLowerCase();
  return Object.entries(MEDIA_TYPES).find(([domain]) => urlLower.includes(domain))?.[1] || "Unknown";
};

const extractFacebookId = (url) => {
  let uniqueId;
  if (url.includes("/v/")) uniqueId = url.split("/v/")[1];
  if (url.includes("/r/")) uniqueId = url.split("/r/")[1];
  if (url.includes("/p/")) uniqueId = url.split("/p/")[1];
  if (uniqueId) uniqueId = uniqueId.replace(/\/$/, "");
  return uniqueId || `fb_${Date.now()}`;
};

export const getDurationVideo = async (path) => {
  const durationCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${path}"`;
  try {
    const duration = parseFloat(execSync(durationCmd).toString()) * 1000;
    return duration;
  } catch (error) {
    console.error("Lỗi khi lấy duration video:", error.message);
    return 0;
  }
};

export const getDataDownload = async (url) => {
  try {
    const response = await axios.get(`${me.API_URL}${encodeURIComponent(url)}`);
    return response.data;
  } catch (err) {
    console.error(`AIO gặp lỗi khi gọi API: ${err.message}`);
    return null;
  }
};

const typeText = (type) => {
  switch (type) {
    case "video":
      return "video";
    case "audio":
      return "nhạc";
    case "image":
      return "ảnh";
    default:
      return "tập tin";
  }
};

const downloadSelectionsMap = new Map();
const TIME_WAIT_SELECTION = 30000;

export async function processAndSendMedia(api, message, mediaData) {
  const {
    selectedMedia,
    mediaType,
    uniqueId,
    duration,
    title,
    author,
    senderId,
    senderName
  } = mediaData;
  const quality = selectedMedia.quality || "default";
  const typeFile = selectedMedia.type.toLowerCase();

  if (typeFile === "image") {
    try {
      if (!selectedMedia.url || !selectedMedia.extension) {
        throw new Error("URL hoặc extension của hình ảnh không hợp lệ.");
      }
      const safeId = sanitizeFilename(uniqueId);
      const thumbnailPath = path.resolve(tempDir, `${safeId}_${Date.now()}.${selectedMedia.extension}`);
      const thumbnailUrl = selectedMedia.url;
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      };

      await downloadFile(thumbnailUrl, thumbnailPath, { headers });
      if (!fs.existsSync(thumbnailPath)) {
        throw new Error(`Tệp hình ảnh ${thumbnailPath} không được tạo.`);
      }

      await api.sendMessage({
        msg: `[ ${senderName} ]\n> From ${capitalizeEachWord(mediaType)} <\n\n👤 Author: ${author || "Không rõ"}\n🖼️ Caption: ${title || "Không có tiêu đề"}`,
        attachments: [thumbnailPath],
        mentions: [MessageMention(senderId, senderName.length, 2, false)],
      }, message.threadId, message.type);

      try {
        await clearImagePath(thumbnailPath);
      } catch (cleanupError) {
        console.error(`Lỗi khi xóa tệp hình ảnh ${thumbnailPath}:`, cleanupError.message);
      }
    } catch (error) {
      console.error(`Lỗi khi xử lý hình ảnh từ ${mediaType}:`, error.message);
      const object = {
        caption: `Không thể tải hoặc gửi hình ảnh từ ${capitalizeEachWord(mediaType)}. Vui lòng thử lại sau.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
    }
    return;
  }

  if ((mediaType === "youtube" || mediaType === "instagram") && duration) {
    if (duration * 1000 > 90 * 60 * 1000) {
      const object = {
        caption: "Vì tài nguyên có hạn, Không thể lấy video có độ dài hơn 90 phút!\nVui lòng chọn video khác.",
      };
      return await sendMessageWarningRequest(api, message, object, 30000);
    }
  }

  const cachedMedia = await getCachedMedia(mediaType, uniqueId, quality, title);
  let videoUrl;
  if (cachedMedia) {
    videoUrl = cachedMedia.fileUrl;
  } else {
    const object = {
      caption: `Chờ bé lấy ${typeText(typeFile)} một chút, xong bé gọi cho hay.\n\n⏳ ${title}\n📊 Chất lượng: ${quality}`,
    };
    await sendMessageProcessingRequest(api, message, object, 8000);
    videoUrl = await categoryDownload(api, message, mediaType, uniqueId, selectedMedia, quality);
    if (!videoUrl) {
      const object = {
        caption: `Không tải được dữ liệu...`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }
  }

  if (typeFile === "audio") {
    const mediaTypeString = capitalizeEachWord(mediaType);
    if (!videoUrl) {
      console.error("Lỗi: voiceUrl bị undefined hoặc null.");
      return;
    }
    const object = {
      trackId: uniqueId || "unknown",
      title: title || "Không rõ",
      artists: author || "Unknown Artist",
      source: mediaTypeString || "Unknown Source",
      caption: hasImageBefore ? "" : `> From ${mediaTypeString} <\nNhạc đây người đẹp ơi !!!\n\n🎵 Music: ${title}`,
      imageUrl: hasImageBefore ? "" : selectedMedia.thumbnail,
      voiceUrl: videoUrl,
    };
    await sendVoiceMusic(api, message, object, 180000000);
  } else if (typeFile === "video") {
    await api.sendVideo({
      videoUrl: videoUrl,
      threadId: message.threadId,
      threadType: message.type,
      thumbnail: selectedMedia.thumbnail,
      message: {
        text:
          `[ ${senderName} ]\n` +
          `🎥 Nền Tảng: ${capitalizeEachWord(mediaType)}\n` +
          `🎬 Tiêu Đề: ${title}\n` +
          `${author && author !== "Unknown Author" ? `👤 Người Đăng: ${author}\n` : ""}` +
          `📊 Chất lượng: ${quality}`,
        mentions: [MessageMention(senderId, senderName.length, 2, false)],
      },
      ttl: 86400000,
    });
  }
}

export async function handleDownloadCommand(api, message, aliasCommand) {
  const content = removeMention(message);
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const prefix = getGlobalPrefix();

  try {
    const query = content.replace(`${prefix}${aliasCommand}`, "").trim();
    if (!query) {
      const object = {
        caption: `Vui lòng nhập link cần tải\nVí dụ:\n${prefix}${aliasCommand} <link>`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }

    const mediaType = getMediaType(query);
    let dataDownload;

    if (mediaType === "tiktok") {
      try {
        const videoData = await getDataDownloadVideo(query);
        if (!videoData) {
          await sendMessageWarningRequest(api, message, { caption: "Không thể lấy dữ liệu video từ TikTok." }, 30000);
          return;
        }
        const quality = videoData?.video?.quality || (videoData.type === "photo" ? "photo" : "540p");
        await sendTikTokVideo(api, message, videoData, false, quality);
        return;
      } catch (error) {
        console.error("Lỗi xử lý TikTok:", error);
      }
    } else if (mediaType === "youtube") {
      try {
        dataDownload = await getDataDownload(query);
        if (!dataDownload || dataDownload.error) {
          throw new Error("Không lấy được dữ liệu YouTube từ API.");
        }
      } catch (error) {
        console.error("Lỗi API YouTube, chuyển sang yt-dlp:", error);
        const outputPathNoExt = path.join(tempDir, `youtube_${Date.now()}`);
        const videoPath = downloadBilibiliWithYTDLP(query, outputPathNoExt); 
        if (!videoPath) {
          await sendMessageWarningRequest(api, message, { caption: "Không thể tải video từ YouTube bằng yt-dlp." }, 30000);
          return;
        }
        const duration = await getDurationVideo(videoPath);
        const uploadResult = await api.uploadAttachment([videoPath], message.threadId, message.type);
        await deleteFile(videoPath);
        await api.sendVideo({
          videoUrl: uploadResult[0].fileUrl,
          threadId: message.threadId,
          threadType: message.type,
          thumbnail: null,
          message: {
            text: `[ ${senderName} ]\n🎥 Nền Tảng: YouTube\n📊 Chất lượng: default`,
            mentions: [MessageMention(senderId, senderName.length, 2, false)],
          },
          ttl: 86400000,
        });
        return;
      }
    } else if (mediaType === "bilibili") {
      const outputPathNoExt = path.join(tempDir, `bilibili_${Date.now()}`);
      const videoPath = downloadBilibiliWithYTDLP(query, outputPathNoExt);
      if (!videoPath) {
        await sendMessageWarningRequest(api, message, { caption: "Không thể tải video từ Bilibili bằng yt-dlp." }, 30000);
        return;
      }
      const duration = await getDurationVideo(videoPath);
      const uploadResult = await api.uploadAttachment([videoPath], message.threadId, message.type);
      await deleteFile(videoPath);
      await api.sendVideo({
        videoUrl: uploadResult[0].fileUrl,
        threadId: message.threadId,
        threadType: message.type,
        thumbnail: null,
        message: {
          text: `[ ${senderName} ]\n🎥 Nền Tảng: Bilibili\n📊 Chất lượng: default`,
          mentions: [MessageMention(senderId, senderName.length, 2, false)],
        },
        ttl: 86400000,
      });
      return;
    }

    dataDownload = await getDataDownload(query);
    if (!dataDownload || dataDownload.error) {
      const object = {
        caption: `Link Không hợp lệ hoặc Không hỗ trợ tải dữ liệu link dạng này.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }

    const dataLink = [];
    let uniqueId;

    switch (mediaType) {
      case "douyin":
        uniqueId = dataDownload.title.replace(/#\w+/g, (match) => match.toLowerCase());
        dataDownload.medias.forEach((item) => {
          if (item.quality.toLowerCase() === "no watermark") {
            dataLink.push({
              url: item.url,
              quality: item.quality,
              type: item.type,
              title: dataDownload.title,
              thumbnail: item.thumbnail || dataDownload.thumbnail,
              extension: item.extension,
            });
          }
        });
        break;
      case "youtube":
        uniqueId = extractYoutubeId(dataDownload.url);
        const dataYoutube = [
          {
            url: dataDownload.url,
            quality: "360p",
            type: "video",
            extension: "mp4",
          },
          {
            url: dataDownload.url,
            quality: "720p",
            type: "video",
            extension: "mp4",
          },
          {
            url: dataDownload.url,
            quality: "1080p",
            type: "video",
            extension: "mp4",
          },
          {
            url: dataDownload.url,
            quality: "max",
            type: "video",
            extension: "mp4",
          },
          {
            url: dataDownload.url,
            quality: "audio",
            type: "audio",
            extension: "mp3",
          },
        ];
        dataYoutube.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality,
            type: item.type,
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: item.extension,
          });
        });
        break;
      case "facebook":
        uniqueId = extractFacebookId(dataDownload.url);
        dataDownload.medias.forEach((item) => {
          const type = (item.type || "").toLowerCase();
          if (type === "video" && item.quality?.toLowerCase() === "hd") {
            dataLink.push({
              url: item.url,
              quality: item.quality,
              type: "video",
              title: dataDownload.title,
              thumbnail: item.thumbnail || dataDownload.thumbnail,
              extension: item.extension || "mp4",
            });
          }
          if (type === "image" && item.url) {
            dataLink.push({
              url: item.url,
              quality: item.quality || "image",
              type: "image",
              title: dataDownload.title,
              thumbnail: item.url,
              extension: item.extension || "jpg",
            });
          }
        });
        break;
      case "threads":
        uniqueId = dataDownload.author + dataDownload.title;
        dataDownload.medias.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality,
            type: item.type,
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: item.extension,
          });
        });
        break;
      case "instagram":
        uniqueId = dataDownload.url;
        dataDownload.medias.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality,
            type: item.type,
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: item.extension,
          });
        });
        break;
      case "telegram":
      case "X":
      case "dailymotion":
        uniqueId = dataDownload.url.split("/").pop();
        dataDownload.medias.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality,
            type: item.type,
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: item.extension,
          });
        });
        break;
      case "sharechat":
      case "xiaohongshu":
      case "weibo":
      case "miaopai":
      case "meipai":
      case "xiaoying":
      case "national":
      case "yingke":
      case "ixigua":
      case "febspot":
      case "getstickerpack":
      case "rumble":
      case "bitchute":
      case "ok":
      case "9gag":
      case "imdb":
      case "ifunny":
      case "izlesene":
      case "tumblr":
      case "snapchat":
      case "espn":
      case "kuaishou":
      case "linkedin":
        uniqueId = dataDownload.url || dataDownload.title || Date.now().toString();
        dataDownload.medias?.forEach((item) => {
          const finalExtension = item.extension || guessExtension(item.url);
          const finalType = item.type || guessMediaType(item.url);
          dataLink.push({
            url: item.url,
            quality: item.quality || "default",
            type: finalType,
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: finalExtension,
          });
        });
        break;
      case "spotify":
      case "zingmp3":
      case "soundcloud":
      case "bandcamp":
      case "mixcloud":
        uniqueId = dataDownload.url || dataDownload.title || Date.now().toString();
        dataDownload.medias?.forEach((item) => {
          dataLink.push({
            url: item.url,
            quality: item.quality || "default",
            type: "audio",
            title: dataDownload.title,
            thumbnail: item.thumbnail || dataDownload.thumbnail,
            extension: item.extension || "mp3",
          });
        });
        break;
      default:
        return;
    }

    if (dataLink.length === 0) {
      const object = {
        caption: `Không tìm thấy dữ liệu tải về phù hợp cho link này!\nVui lòng thử lại với link khác.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return;
    }

    if (dataLink.length === 1) {
      await processAndSendMedia(api, message, {
        selectedMedia: dataLink[0],
        mediaType,
        uniqueId,
        duration: dataDownload.duration,
        title: dataDownload.title,
        author: dataDownload.author,
        senderId,
        senderName,
      });
      return;
    }

    const onlyImagesAndAudios = dataLink.every(item => {
      const type = item.type.toLowerCase();
      return type === "image" || type === "audio";
    });

    if (onlyImagesAndAudios) {
      const attachmentPaths = [];
      const nonImageMedia = [];
      for (const media of dataLink) {
        if (media.type.toLowerCase() === "image") {
          const baseName = sanitizeFilename(uniqueId || "media");
          const uniqueFileName = `${baseName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${media.extension}`;
          const filePath = path.resolve(tempDir, uniqueFileName);
          const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          };
          await downloadFile(media.url, filePath, { headers });
          if (fs.existsSync(filePath)) {
            attachmentPaths.push(filePath);
          } else {
            console.error(`Tệp hình ảnh ${filePath} không được tạo.`);
          }
        } else {
          nonImageMedia.push(media);
        }
      }
      if (Array.isArray(attachmentPaths) && attachmentPaths.length > 0) {
        hasImageBefore = true;
        const statusMsg = `Dưới đây là nội dung từ link của bạn!\n\n${dataDownload.title || "Không rõ tiêu đề"}`;
        await sendMessageCompleteRequest(api, message, {
          caption: statusMsg,
          tile: dataDownload.title || "",
        }, 300000);

        await api.sendMessage(
          {
            msg: "",
            attachments: attachmentPaths.slice().reverse(),
            ttl: 6000000,
          },
          message.threadId,
          message.type
        );
        for (const filePath of attachmentPaths) {
          try {
            await clearImagePath(filePath);
          } catch (cleanupError) {
            console.error(`Lỗi khi xóa tệp hình ảnh ${filePath}:`, cleanupError.message);
          }
        }
      }
      for (const media of nonImageMedia) {
        await processAndSendMedia(api, message, {
          selectedMedia: media,
          mediaType,
          uniqueId,
          duration: dataDownload.duration,
          title: dataDownload.title,
          author: dataDownload.author,
          senderId,
          senderName,
        });
      }
      return;
    }

    let listText = `Đây là danh sách các phiên bản có sẵn:\n`;
    listText += `Hãy trả lời tin nhắn này với số thứ tự phiên bản bạn muốn tải!\n\n`;
    listText += dataLink
      .map((item, index) => `${index + 1}. ${item.type} - ${item.quality || "Unknown"} (${item.extension})`)
      .join("\n");
    const object = {
      caption: listText,
    };
    const listMessage = await sendMessageCompleteRequest(api, message, object, TIME_WAIT_SELECTION);
    const quotedMsgId = listMessage?.message?.msgId || listMessage?.attachment[0]?.msgId;
    downloadSelectionsMap.set(quotedMsgId.toString(), {
      userRequest: senderId,
      collection: dataLink,
      uniqueId: uniqueId,
      mediaType: mediaType,
      title: dataDownload.title,
      duration: dataDownload.duration || 0,
      author: dataDownload.author || "Unknown Author",
      timestamp: Date.now(),
    });
    setSelectionsMapData(senderId, {
      quotedMsgId: quotedMsgId.toString(),
      collection: dataLink,
      uniqueId: uniqueId,
      mediaType: mediaType,
      title: dataDownload.title,
      duration: dataDownload.duration || 0,
      author: dataDownload.author || "Unknown Author",
      timestamp: Date.now(),
      platform: "downlink",
    });
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh download:", error.message);
    const object = {
      caption: `Đã xảy ra lỗi khi xử lý lệnh tải dữ liệu: ${error.message}`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
  }
}

export async function categoryDownload(api, message, platform, uniqueId, selectedMedia, quality) {
  let qualityVideo;
  let tempFilePath;
  try {
    switch (platform) {
      case "youtube":
        const { format, qualityText } = getVideoFormatByQuality(quality);
        qualityVideo = qualityText;
        tempFilePath = await downloadYoutubeVideo(selectedMedia.url, uniqueId, format);
        break;
      case "bilibili":
        const outputPathNoExt = path.join(tempDir, `bilibili_${Date.now()}`);
        tempFilePath = downloadBilibiliWithYTDLP(selectedMedia.url, outputPathNoExt);
        if (!tempFilePath) throw new Error("Không thể tải video Bilibili bằng yt-dlp");
        qualityVideo = quality;
        break;
      default:
        qualityVideo = quality;
        tempFilePath = path.resolve(tempDir, `${platform}_${Date.now()}.${selectedMedia.extension}`);
        if (selectedMedia.extension === 'm3u8') {
          tempFilePath = path.resolve(tempDir, `${platform}_${Date.now()}.mp4`);
          const ffmpegCmd = `ffmpeg -i "${selectedMedia.url}" -c copy -bsf:a aac_adtstoasc "${tempFilePath}"`;
          await new Promise((resolve, reject) => {
            exec(ffmpegCmd, (error) => {
              if (error) reject(error);
              resolve();
            });
          });
        } else {
          const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          };
          await downloadFile(selectedMedia.url, tempFilePath, { headers });
        }
        break;
    }
    const uploadResult = await api.uploadAttachment([tempFilePath], message.threadId, message.type);
    const videoUrl = uploadResult[0].fileUrl;
    const duration = await getDurationVideo(tempFilePath);
    await deleteFile(tempFilePath);
    setCacheData(platform, uniqueId, { fileUrl: videoUrl, title: selectedMedia.title, duration }, qualityVideo);
    return videoUrl;
  } catch (error) {
    if (tempFilePath) {
      try {
        await deleteFile(tempFilePath);
      } catch (cleanupError) {
        console.error(`Lỗi khi xóa tệp tạm ${tempFilePath}:`, cleanupError.message);
      }
    }
    console.error("Lỗi khi tải video:", error.message);
    return null;
  }
}

let hasImageBefore = false;

export async function handleDownloadReply(api, message) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const idBot = getBotId();

  try {
    if (!message.data.quote || !message.data.quote.globalMsgId) return false;
    const quotedMsgId = message.data.quote.globalMsgId.toString();
    if (!downloadSelectionsMap.has(quotedMsgId)) return false;
    const downloadData = downloadSelectionsMap.get(quotedMsgId);
    if (downloadData.userRequest !== senderId) return false;

    const content = removeMention(message).trim().toLowerCase();
    let { collection, uniqueId, mediaType, title, duration = 0, author } =
      downloadSelectionsMap.get(quotedMsgId);

    if (content === "all") {
      const attachmentPaths = [];
      const nonImageMedia = [];
      for (const media of collection) {
        if (media.type.toLowerCase() === "image") {
          const uniqueFileName = `${sanitizeFilename(uniqueId || "media")}_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}.${media.extension}`;
          const thumbnailPath = path.resolve(tempDir, uniqueFileName);
          const thumbnailUrl = media.url;
          if (thumbnailUrl) {
            const headers = {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            };
            await downloadFile(thumbnailUrl, thumbnailPath, { headers });
            if (fs.existsSync(thumbnailPath)) {
              attachmentPaths.push(thumbnailPath);
            } else {
              console.error(`Tệp hình ảnh ${thumbnailPath} không được tạo.`);
            }
          }
        } else {
          nonImageMedia.push(media);
        }
      }
      if (Array.isArray(attachmentPaths) && attachmentPaths.length > 0) {
        hasImageBefore = true;
        const statusMsg = `Dưới đây là nội dung từ link của bạn!\n\n${title || "Không rõ tiêu đề"}`;
        await sendMessageCompleteRequest(api, message, {
          caption: statusMsg,
          tile: title || "",
        }, 300000);

        await api.sendMessage(
          {
            msg: "",
            attachments: attachmentPaths.slice().reverse(),
            ttl: 6000000,
          },
          message.threadId,
          message.type
        );

        for (const filePath of attachmentPaths) {
          try {
            await clearImagePath(filePath);
          } catch (cleanupError) {
            console.error(`Lỗi khi xóa tệp hình ảnh ${filePath}:`, cleanupError.message);
          }
        }
      }

      for (const media of nonImageMedia) {
        await processAndSendMedia(api, message, {
          selectedMedia: media,
          mediaType,
          uniqueId,
          duration,
          title,
          author,
          senderId,
          senderName,
        });
      }

      const msgDel = {
        type: message.type,
        threadId: message.threadId,
        data: {
          cliMsgId: message.data.quote.cliMsgId,
          msgId: message.data.quote.globalMsgId,
          uidFrom: idBot,
        },
      };
      await api.deleteMessage(msgDel, false);
      downloadSelectionsMap.delete(quotedMsgId);
      return true;
    }

    const selectedIndex = parseInt(content) - 1;
    if (
      isNaN(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= collection.length
    ) {
      const object = {
        caption: `Lựa chọn Không hợp lệ. Vui lòng chọn một số từ danh sách hoặc nhập "all" để tải tất cả.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }

    const msgDel = {
      type: message.type,
      threadId: message.threadId,
      data: {
        cliMsgId: message.data.quote.cliMsgId,
        msgId: message.data.quote.globalMsgId,
        uidFrom: idBot,
      },
    };
    await api.deleteMessage(msgDel, false);
    downloadSelectionsMap.delete(quotedMsgId);

    await processAndSendMedia(api, message, {
      selectedMedia: collection[selectedIndex],
      mediaType,
      uniqueId,
      duration,
      title,
      author,
      senderId,
      senderName,
    });
    return true;
  } catch (error) {
    console.error("Lỗi xử lý reply download:", error.message);
    const object = {
      caption: `Đã xảy ra lỗi khi xử lý tin nhắn của bạn: ${error.message}`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return true;
  }
}

function guessExtension(url) {
  const ext = url.split('.').pop().split('?')[0].toLowerCase();
  return ['jpg', 'jpeg', 'png', 'mp4', 'mp3', 'm3u8'].includes(ext) ? ext : 'mp4';
}

function guessMediaType(url) {
  const ext = guessExtension(url);
  return ['jpg', 'jpeg', 'png'].includes(ext) ? 'image' : ['mp3'].includes(ext) ? 'audio' : 'video';
}
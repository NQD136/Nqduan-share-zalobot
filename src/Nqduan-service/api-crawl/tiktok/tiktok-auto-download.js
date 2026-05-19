import { sendTikTokVideo } from "./tiktok-service.js";
import {
  sendMessageStateQuote,
  sendMessageWarningRequest,
} from "../../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getDataDownloadVideo } from "./tiktok-api.js";
import {
  readGroupSettings,
  writeGroupSettings,
} from "../../../utils/io-json.js";
import { removeMention } from "../../../utils/format-util.js";
import { getGlobalPrefix } from "../../../Nqduan-service/service.js";
import { LRUCache } from "lru-cache";

// Cache to store processed message IDs
const processedMessages = new LRUCache({
  max: 1000,
  ttl: 60000, // 1 minute
});

// Cache to track recent command timestamps per thread
const commandTimestamps = new LRUCache({
  max: 100,
  ttl: 5000, // 5 seconds to prevent rapid reprocessing
});

// Function to extract TikTok URL from text
const extractTikTokUrl = (text) => {
  const tiktokRegex = /https?:\/\/((?:vm|vt|www)\.)?tiktok\.com\/[^\s]+/i;
  const match = text.match(tiktokRegex);
  return match ? match[0] : null;
};

// Main handler for TikTok auto-download and command processing
export async function handleTikTokAutoDownload(
  api,
  message,
  groupSettings = readGroupSettings(),
) {
  const threadId = message.threadId || message.data?.idTo;
  const msgId = message.data?.msgId || message.data?.cliMsgId;
  const content =
    removeMention(message) || message.data?.content || message.content || "";
  const prefix = getGlobalPrefix();

  if (!threadId || !msgId) {
    return false;
  }

  // Check if message was recently processed
  if (processedMessages.has(msgId)) {
    return false;
  }
  processedMessages.set(msgId, true);

  // Initialize group settings if not present
  if (!groupSettings[threadId]) {
    groupSettings[threadId] = { tiktokauto: false }; // Default to disabled
  }

  // Check if this is a command to toggle tiktokauto
  const args = content.trim().split(" ");
  const command = args[0]?.replace(prefix, "").toLowerCase();
  if (command === "tiktokauto") {
    // Prevent rapid command reprocessing
    const commandKey = `${threadId}:tiktokauto`;
    if (commandTimestamps.has(commandKey)) {
      return false;
    }
    commandTimestamps.set(commandKey, Date.now());

    const status = args[1]?.toLowerCase();
    let newStatus;

    if (status === "on") {
      groupSettings[threadId].tiktokauto = true;
      newStatus = "bật";
    } else if (status === "off") {
      groupSettings[threadId].tiktokauto = false;
      newStatus = "tắt";
    } else {
      groupSettings[threadId].tiktokauto = !groupSettings[threadId].tiktokauto;
      newStatus = groupSettings[threadId].tiktokauto ? "bật" : "tắt";
    }

    // Save groupSettings to file
    try {
      writeGroupSettings(groupSettings);
    } catch (error) {
      // Silently handle error to avoid logging
    }

    // Send status notification
    const caption = `Đã ${newStatus} chức năng tự động tải video TikTok vào nhóm này!`;
    try {
      await sendMessageStateQuote(
        api,
        message,
        caption,
        groupSettings[threadId].tiktokauto,
        300000,
      );
    } catch (error) {
      // Silently handle error to avoid logging
    }

    return true;
  }

  // Process TikTok link if tiktokauto is enabled
  if (!groupSettings[threadId]?.tiktokauto) {
    return false;
  }

  // Check for TikTok URL
  if (!content) {
    return false;
  }

  try {
    const tiktokUrl = extractTikTokUrl(content);
    if (tiktokUrl) {
      const videoData = await getDataDownloadVideo(tiktokUrl);
      if (videoData && videoData.video?.url) {
        await sendTikTokVideo(
          api,
          message,
          videoData,
          false,
          videoData.video.quality,
        );
        return true;
      } else {
        const object = {
          caption: `Không thể tải video từ link TikTok này: ${tiktokUrl}. Có thể link không hợp lệ hoặc video bị giới hạn.`,
        };
        await sendMessageWarningRequest(api, message, object, 30000);
        return true;
      }
    } else {
      return false;
    }
  } catch (error) {
    const object = {
      caption: `Đã xảy ra lỗi khi xử lý link TikTok: ${error.message}. Vui lòng thử lại sau.`,
    };
    await sendMessageWarningRequest(api, message, object, 30000);
    return true;
  }
}

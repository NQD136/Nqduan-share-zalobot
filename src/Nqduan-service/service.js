import { startWebServer } from "../web-service/web-server.js";
import { readCommandConfig } from "../utils/io-json.js";
import { initRankSystem } from "./info-service/rank-chat.js";
import { initializeFarmService } from "./game-service/nong-trai/nong-trai.js";
import { initializeScheduler } from "./scheduler/scheduler.js";
import { initializeDatabase } from "../database/index.js";
import { startMuteCheck } from "./anti-service/mute-user.js";
import { startBadWordViolationCheck } from "./anti-service/anti-badword.js";
import { handleMusicReply } from "./api-crawl/music/soundcloud.js";
import { handleZingMp3Reply } from "./api-crawl/music/zingmp3.js";
import { startNudeViolationCheck } from "./anti-service/anti-nude/anti-nude.js";
import { handleChatWithGame } from "./game-service/mini-game/index.js";
import { tryHandlePassiveCaroMove } from "./game-service/co-caro/Caro-bot.js";
import { initializeGameDataManager } from "./game-service/game-manager.js";
import { handleYoutubeReply } from "./api-crawl/youtube/youtube-service.js";
import { handleTikTokReply } from "./api-crawl/tiktok/tiktok-service.js";
import { initPRService } from "./scheduler/pr-zalo.js";
import { handleNhacCuaTuiReply } from "./api-crawl/music/nhaccuatui.js";
import { handleActionGroupReply } from "../commands/bot-manager/remote-action-group.js";
import { handleDownloadReply } from "./api-crawl/api-hungdev/aio-downlink.js";
import { checkReplySelectionsMapData } from "./api-crawl/index.js";
import { handleCapcutReply } from "./api-crawl/capcut/capcut-service.js";
import { notifyResetGroup } from "../commands/bot-manager/active-bot.js";
import { handleScanGroupsReply } from "../commands/bot-manager/scan-group.js";
import { startAntiConfigCheck } from "./anti-service/index.js";
import { initializeCacheService } from "../utils/link-platform-cache.js";
import { checkRestartFile } from "../utils/util.js";
import { initAdminHandle } from "../commands/bot-manager/init-admin.js";
import {
  initCheckCommand,
  startPeriodicCheckTime,
} from "../commands/mybot/Check-time/start-period.js";

let globalPrefix = "!";

export function getGlobalPrefix() {
  return globalPrefix;
}

export function setGlobalPrefix(newPrefix) {
  globalPrefix = newPrefix;
}

export async function initService(api) {
  const commandConfig = readCommandConfig();
  globalPrefix = commandConfig.prefix || "!";

  await Promise.all([
    checkRestartFile(api),
    initializeDatabase(),
    initializeCacheService(),
    initializeFarmService(),
    initializeGameDataManager(api),
    initializeScheduler(api),
    startWebServer(api),
    initAdminHandle(api),
    initPRService(api),
    startAntiConfigCheck(),
    startPeriodicCheckTime(api),
    initCheckCommand(api),
    startMuteCheck(api),
    startBadWordViolationCheck(),
    startNudeViolationCheck(),
    initRankSystem(),
    notifyResetGroup(api),
  ]);
}

export async function handleOnChatUser(
  api,
  message,
  isCallGame,
  groupSettings
) {
  // Logic thêm từ service.js
  // Allow Caro owner to move by typing just a cell number/coordinate (no command)
  try {
    const handled = await tryHandlePassiveCaroMove(api, message, groupSettings);
    if (handled) return;
  } catch (e) {
    /* ignore passive errors to not break chat */
  }

  // Logic gốc từ service-1.js
  await handleChatWithGame(api, message, isCallGame, groupSettings);
}

export async function handleOnReplyFromUser(
  api,
  message,
  groupInfo,
  groupAdmins,
  groupSettings,
  isAdminLevelHighest,
  isAdminBot,
  isAdminBox,
  handleChat
) {
  if (await checkReplySelectionsMapData(api, message)) return true;
  if (await handleScanGroupsReply(api, message)) return true;
  if (await handleMusicReply(api, message)) return true;
  if (await handleZingMp3Reply(api, message)) return true;
  if (await handleYoutubeReply(api, message)) return true;
  if (await handleTikTokReply(api, message)) return true;
  if (await handleNhacCuaTuiReply(api, message)) return true;
  if (await handleDownloadReply(api, message)) return true;
  if (await handleCapcutReply(api, message)) return true;
  if (
    message?.data?.content
      ?.toLowerCase()
      .startsWith((globalPrefix || "!") + "caro")
  ) {
    try {
      const { handleCaroBotCommand } = await import(
        "./game-service/co-caro/Caro-bot.js"
      );
      await handleCaroBotCommand(api, message, groupSettings, "caro");
      return true;
    } catch (e) {
      console.error("[service][caro] dispatch error:", e);
    }
  }
  if (
    await handleActionGroupReply(
      api,
      message,
      groupInfo,
      groupAdmins,
      groupSettings,
      isAdminLevelHighest,
      isAdminBot,
      isAdminBox,
      handleChat
    )
  )
    return true;
  return false;
}

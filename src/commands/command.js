// /root/Nqduan/src/commands/commands.js
//import { handleMyBotCommand } from "../commands/mebot/mybot.js";
import { handleLichHocGridCommand } from "../Nqduan-service/tien-ich/lich-hoc.js";
import { handleClfCommand } from "../Nqduan-service/servises/ddos.js";
import { handleSendFriendRequestAll } from "../commands/bot-manager/addfriend-all.js";
import {
  handleUnblockMessageCommand,
  handleBlockMessageCommand,
} from "../commands/bot-manager/block-user.js";
import { handlekiemtracommand } from "../commands/bot-manager/kiemtra.js";
import { handlecheckoderCommand } from "../Nqduan-service/tien-ich/checkorder.js";
import { handleSetAccountCommand } from "../commands/bot-manager/setaccount.js";
import { handleClockCommand } from "../Nqduan-service/tien-ich/clock.js";
import { handleEmoteCommand } from "../Nqduan-service/tien-ich/emote.js";
import { handleMyAccCommand } from "../commands/bot-manager/myaccount.js";
import { handleUndoFriendRequest } from "../commands/bot-manager/undo-friend.js";
import { handleRejectFriendRequest } from "../commands/bot-manager/reject-friend.js";
import { handleFriendWaitingList } from "../commands/bot-manager/friend-waiting-list.js";
import { handleDsBanBe } from "../commands/bot-manager/list-friends.js";
import { handleCheckGiaVangCommand } from "../Nqduan-service/tien-ich/check-gia-vang.js";
import { handleListGroupInviteCommand } from "../commands/bot-manager/invite-box.js";
import { handlePollCommand } from "../commands/bot-manager/poll-service.js";
//import { handleTagReactionCommand } from "../commands/bot-manager/tag-reaction.js";
import { handleSetBotAvatarCommand } from "../commands/bot-manager/setavatar-account.js";
import { handleListBlockCommand } from "../commands/bot-manager/list-block-group.js";
import { handleDisperseGroupCommand } from "../commands/bot-manager/dispersegroup.js";
import { handleMySettingsCommand } from "../commands/bot-manager/mysetting.js";
import { handleCreateGrCommand } from "../commands/bot-manager/create-group.js";
import { handleshowcodeCommand } from "../Nqduan-service/tien-ich/showcode.js";
import { myBankBusinessCommand } from "../Nqduan-service/info-service/mybank-business.js";
import { handleNhacNhoCommand } from "../Nqduan-service/tien-ich/nhacnho.js";
import { handleCheckCommand } from "../Nqduan-service/info-service/check-user.js";
import { handleCccdCommand } from "../Nqduan-service/tien-ich/cccd.js";
import { handleCleanCommand } from "./bot-manager/clean.js";
import { handleListKeyCommand } from "../Nqduan-service/info-service/key-list.js";
import { handleGooglesearchaiCommand } from "../Nqduan-service/api-crawl/google/google-search-ai.js";
import { writeGroupSettings } from "../utils/io-json.js";
import {
  processEditAudioCommand,
  processEditVideoCommand,
} from "../Nqduan-service/servises/edit-media.js";
import { handleQuocgiaCommand } from "../Nqduan-service/tien-ich/quocgia.js";
import { handleReverseCommand } from "../Nqduan-service/tien-ich/reverse.js";
import { handleCaroBotCommand } from "../Nqduan-service/game-service/co-caro/Caro-bot.js";
import { handleRutgonlinkCommand } from "../Nqduan-service/lovelink/rutgonlink.js";
import { handleTestflightCommand } from "../Nqduan-service/testflight/testflight.js";
import { handleFbCommand } from "../Nqduan-service/fb/fb.js";
import { handleStickerLocalCommand } from "../Nqduan-service/tien-ich/stickerlocal.js";
import { sendMessageToMentioned } from "../Nqduan-service/tien-ich/sendmsg-user.js";
import { handleLienQuanCommand } from "../Nqduan-service/servises/LQM-General.js";
import { handleImageGeneration } from "../Nqduan-service/api-crawl/assistant-ai/create-image.js";
import { handleImageAnalysis } from "../Nqduan-service/api-crawl/assistant-ai/Analysis-Image.js";
import { userBussinessCardQrCommand } from "../Nqduan-service/info-service/business-card-qr.js";
import {
  handleAddCmdCommand,
  handleRemoveCmdCommand,
  handleCmdFindCommand,
  handleFixCmdCommand,
} from "./bot-manager/command-manager.js";
import { askDeepSeekCommand } from "../Nqduan-service/api-crawl/assistant-ai/deepseek.js";
import { handlechecklqCommand } from "../Nqduan-service/lienquanmobile/checklq.js";
import { handlelovelinkCommand } from "../Nqduan-service/lovelink/lovelink.js";
import { handleMyHeartCommand } from "../Nqduan-service/lovelink/myheart.js";
import { handledinhgiasimCommand } from "../Nqduan-service/spamsms/dinhgiasim.js";
import { handleBenchmarkCommand } from "../Nqduan-service/benchmark/index.js";
//import { handleTagModeCommand, } from "../Nqduan-service/chat-bot/bot-learning/reply-AI.js";
import { modgame } from "../Nqduan-service/utilities/modgame.js";
import { spamgroup } from "./bot-manager/spamgroup.js";
import { handleSoxoCommand } from "../Nqduan-service/soxo/soxo.js";
import { handleSetupAntiCommand } from "../Nqduan-service/anti-service/setup-anti.js";
import {
  handleKickImageCommand,
  handleBlockImageCommand,
} from "../Nqduan-service/anti-service/handleImageCommand.js";
import { handleNglCommand } from "../Nqduan-service/spamngl/spamngl.js";
import {
  handleMuteList,
  handleMuteUser,
  handleUnmuteUser,
} from "../Nqduan-service/anti-service/mute-user.js";
import {
  handleWelcomeBye,
  handleApprove,
  handlePrWelcome,
} from "./bot-manager/welcome-bye.js";
import { handleRenameCommand } from "./bot-manager/rename.js";
import {
  handleActiveBotUser,
  handleActiveGameUser,
  managerData,
} from "./bot-manager/active-bot.js";
import {
  helpCommand,
  adminCommand,
  gameInfoCommand,
} from "./instructions/help.js";
import { mybotHandleCommand } from "./mybot/myBotManager.js";
import { handleAutoReplyMentionsMessageCommand } from "../commands/bot-check/replytag.js";
import { handlerLienquanmobileCommand } from "../Nqduan-service/lienquanmobile/lienquanmobile.js";
import { handleGiftextCommand } from "../Nqduan-service/gif/giftext.js";
import { askGPTCommand } from "../Nqduan-service/api-crawl/content/gpt.js";
import { askGeminiCommand } from "../Nqduan-service/api-crawl/assistant-ai/gemini-command.js";
import { weatherCommand } from "../Nqduan-service/api-crawl/content/weather.js";
import { groupInfoCommand } from "../Nqduan-service/info-service/group-info.js";
import { userInfoCommand } from "../Nqduan-service/info-service/user-info.js";
import { handleTopChatCommand } from "../Nqduan-service/info-service/rank-chat.js";
import {
  chatAll,
  getObject,
} from "../Nqduan-service/chat-zalo/chat-general/chat-all.js";
import {
  handleTenorGifCommand,
  handleGifTextCommand,
} from "../Nqduan-service/chat-zalo/chat-special/send-gif/send-gif.js";
import { searchImagePinterest } from "../Nqduan-service/api-crawl/pinterest/pinterest-service.js";
import { sendImage } from "../Nqduan-service/chat-zalo/chat-special/send-image/send-image.js";
import { handleTikTokCommand } from "../Nqduan-service/api-crawl/tiktok/tiktok-service.js";
import { handleVideoCommand } from "../Nqduan-service/chat-zalo/chat-special/send-video/send-video.js";
import { chatWithSimsimi } from "../Nqduan-service/chat-bot/simsimi/simsimi-api.js";
import { translateCommand } from "../Nqduan-service/api-crawl/content/translate.js";
import {
  handleLearnCommand,
  handleReplyCommand,
} from "../Nqduan-service/chat-bot/bot-learning/dqt-bot.js";
import { handleOnlyText } from "../Nqduan-service/anti-service/anti-not-text.js";
import { scoldUser } from "../Nqduan-service/chat-bot/scold-user/scold-user.js";
import { handleSpeedTestCommand } from "../Nqduan-service/utilities/speedtest.js";
import { handleDownloadData } from "../Nqduan-service/api-crawl/data/dowload-video.js";
import { handleGayCommand } from "../Nqduan-service/troll/gay.js";
import { handleAutoDownloadCommand } from "../Nqduan-service/api-crawl/download/auto-aio-download.js";
import { handleCheckipCommand } from "../Nqduan-service/checkdomain/checkip.js";
import { getBotDetails } from "../Nqduan-service/info-service/bot-info.js";
import { handleBlockUIDByCommand } from "../Nqduan-service/servises/block-user-join.js";
import {
  handleBanCommand,
  handleBankCommand,
  handleBuffCommand,
  handleClaimDailyReward,
  handleLoginPlayer,
  handleLogoutPlayer,
  handleMyCard,
  handleNapCommand,
  handleRegisterPlayer,
  handleRutCommand,
  handleTopPlayers,
  handleUnbanCommand,
} from "../Nqduan-service/game-service/index.js";
import { handleAntiLinkCommand } from "../Nqduan-service/anti-service/anti-link.js";
import { getCommandConfig, isAdmin } from "../index.js";
import {
  sendMessageFromSQL,
  sendMessageInsufficientAuthority,
} from "../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { handleAdminCommand } from "./bot-manager/admin-manager.js";
import { handleAntiSpamCommand } from "../Nqduan-service/anti-service/anti-spam.js";
import {
  handleKeyCommands,
  handleBlockBot,
  handleUnblockBot,
  handleListBlockBot,
} from "./bot-manager/group-manage.js";
import { listCommands } from "./instructions/help.js";
import { handleTaiXiuCommand } from "../Nqduan-service/game-service/tai-xiu/tai-xiu.js";
import { handlePrefixCommand } from "./bot-manager/prefix.js";
import { getGlobalPrefix } from "../Nqduan-service/service.js";
import { handleNongTraiCommand } from "../Nqduan-service/game-service/nong-trai/nong-trai.js";
import { userBussinessCardCommand } from "../Nqduan-service/info-service/bussiness-card.js";
import { handleStickerCommand } from "../Nqduan-service/chat-zalo/chat-special/send-sticker/send-sticker.js";
import { handlePRCommand } from "../Nqduan-service/scheduler/pr-service.js";
import {
  checkNotFindCommand,
  handleAliasCommand,
  handleChangeGroupLink,
  handleGetLinkInQuote,
  handleSendMessagePrivate,
  handleSendTaskCommand,
  handleUndoMessage,
  handleSetAvatarFromReply,
  handle4KImage,
  spamMessagesInGroup,
  handleBlockedMembers,
  handleSendFriendRequest,
  handleRemoveFriend,
  spamCallInGroup,
  handleUploadReply,
  handleSetMuteCommand,
  handleSetAvatarAccount,
  handleAcceptFriendRequest,
} from "./bot-manager/utilities.js";
import { handleSendStickerCommand } from "./bot-manager/sendsticker.js";
import { handleBauCua } from "../Nqduan-service/game-service/bau-cua/bau-cua.js";
import { handleFishingCommand } from "../Nqduan-service/game-service/fishing/fishing.js";
import { handleKBBCommand } from "../Nqduan-service/game-service/keobuabao/keobuabao.js";
import { handleAntiBadWordCommand } from "../Nqduan-service/anti-service/anti-badword.js";
import { handleChanLe } from "../Nqduan-service/game-service/chan-le/chan-le.js";
import {
  handleGetVoiceCommand,
  handleStoryCommand,
  handleTarrotCommand,
  handleVoiceCommand,
} from "../Nqduan-service/chat-zalo/chat-special/send-voice/send-voice.js";
import { handleMusicCommand } from "../Nqduan-service/api-crawl/music/soundcloud.js";
import { handleSpotifyCommand } from "../Nqduan-service/api-crawl/music/spotify.js";
import { handleAntiNudeCommand } from "../Nqduan-service/anti-service/anti-nude/anti-nude.js";
import { handleSettingGroupCommand } from "./bot-manager/group-manage.js";
import {
  handleTopChartZingMp3,
  handleZingMp3Command,
} from "../Nqduan-service/api-crawl/music/zingmp3.js";
import { handleVietlott655Command } from "../Nqduan-service/game-service/vietlott/vietlott655.js";
import { startGame } from "../Nqduan-service/game-service/mini-game/index.js";
import { handleYoutubeCommand } from "../Nqduan-service/api-crawl/youtube/youtube-service.js";
import {
  handleJoinGroup,
  handleLeaveGroup,
  handleShowGroupsList,
  handleLeaveLockedGroups,
  handleLeaveAllBoxCommand,
} from "./bot-manager/remote-action-group.js";
import { handleNhacCuaTuiCommand } from "../Nqduan-service/api-crawl/music/nhaccuatui.js";
import { removeMention } from "../utils/format-util.js";
import { handleWhiteList } from "../Nqduan-service/anti-service/white-list.js";
import { handleAntiUndoCommand } from "../Nqduan-service/anti-service/anti-undo.js";
import { handleDownloadCommand } from "../Nqduan-service/api-crawl/api-hungdev/aio-downlink.js";
import { handleCapcutCommand } from "../Nqduan-service/api-crawl/capcut/capcut-service.js";
import { handleBankInfoCommand } from "../Nqduan-service/info-service/bank-info.js";
import { sendReactionWaitingCountdown } from "./manager-command/check-countdown.js";
import {
  getPermissionCommandName,
  handleSetCommandActive,
} from "./manager-command/set-command.js";
import { searchImageGoogle } from "../Nqduan-service/api-crawl/google/google-image.js";
import { scanGroupsWithAction } from "./bot-manager/scan-group.js";
import { handleDeleteMessage } from "./bot-manager/recent-message.js";
import { handleGoogleCommand } from "../Nqduan-service/api-crawl/google/google-search.js";
import { handleCommandStatusPost } from "../utils/canvas/status-post.js";
import { handleCreateQRCommand } from "../Nqduan-service/utilities/qr-creater.js";
import { handleCreateQRHeartCommand } from "../Nqduan-service/utilities/qr-heart.js";
import { handleScanQRCommand } from "../Nqduan-service/utilities/qr-scan.js";
import { handleSendCustomerStickerVideo } from "../Nqduan-service/chat-zalo/chat-special/send-sticker/customer-sticker.js";
import {
  handleDeleteResource,
  handleDownloadResource,
} from "../Nqduan-service/utilities/download-resource.js";
import { handlePhatNguoiCommand } from "../Nqduan-service/api-crawl/content/phatnguoi.js";
import { scanApi } from "../Nqduan-service/utilities/scan-api.js";
import { shareSrc } from "../Nqduan-service/utilities/share.js";
import { restartSelf } from "../utils/util.js";
import { handleFfCommand } from "../Nqduan-service/ff/ff.js";
import { handlelikeffCommand } from "../Nqduan-service/ff/likeff.js";
import { handleI4tiktokCommand } from "../Nqduan-service/tiktok/i4tiktok.js";
import { handleRegmailCommand } from "../Nqduan-service/regmail/regmail.js";
import { handleCheckbanffCommand } from "../Nqduan-service/ff/checkbanff.js";
import { handleViewttCommand } from "../Nqduan-service/tiktok/viewtt.js";
import { handleSpamffCommand } from "../Nqduan-service/ff/spamff.js";
import { handleTymttCommand } from "../Nqduan-service/tiktok/tymtt.js";
import { handleSpamSmsCommand } from "../Nqduan-service/spamsms/spamsms.js";
import { handleAcclqCommand } from "../Nqduan-service/lienquanmobile/acclq.js";
import { handleCheckdomainCommand } from "../Nqduan-service/checkdomain/checkdomain.js";
import { handleUidfbCommand } from "../Nqduan-service/fb/uidfb.js";
import { handleDownloadZalo } from "../Nqduan-service/api-crawl/download/auto-aio-download.js";
import { handleSendImage } from "../Nqduan-service/chat-zalo/chat-special/send-resources/send-resources-image.js";
import { handleSendVideo } from "../Nqduan-service/chat-zalo/chat-special/send-resources/send-resources-video.js";
import { handleSendFile } from "../Nqduan-service/chat-zalo/chat-special/send-resources/send-resources-file.js";
import { handleSendAudio } from "../Nqduan-service/chat-zalo/chat-special/send-resources/send-resources-audio.js";
import { handleAntiTagCommand } from "../Nqduan-service/anti-service/anti-tag.js";
import { handleJoinLeaveGroup } from "../commands/bot-manager/remote-join-leave.js";
import {
  handleKick,
  handleBlock,
  handleKickAll,
  handleBlockAll,
  handleKickMe,
  handleBlockMe,
} from "../commands/bot-manager/group-manage.js";
import { handleTargetCommand } from "../commands/bot-manager/target-manage.js";
import { handleRao } from "../commands/bot-manager/rao.js";
import { handleAntiPhoto } from "../Nqduan-service/anti-service/anti-photo.js";
import { handleAntiGif } from "../Nqduan-service/anti-service/anti-gif.js";
import { handleAntiVideo } from "../Nqduan-service/anti-service/anti-video.js";
import { handleAntiVoice } from "../Nqduan-service/anti-service/anti-voice.js";
import { handleAntiSticker } from "../Nqduan-service/anti-service/anti-sticker.js";
import { handleAntiFile } from "../Nqduan-service/anti-service/anti-file.js";
import { handleAntiForwardCommand } from "../Nqduan-service/anti-service/anti-forward.js";
import { handleAntiAll } from "../Nqduan-service/anti-service/anti-all.js";
import { handleAntiText } from "../Nqduan-service/anti-service/anti-text.js";
import { handleAntiBotCommand } from "../Nqduan-service/anti-service/anti-bot.js";
import { handleAntiStickerEffect } from "../Nqduan-service/anti-service/anti-stickereffect.js";
import { handleAutoJoinCommand } from "../commands/bot-manager/auto-join.js";
import { handleAutoReplyCommand } from "../Nqduan-service/api-crawl/assistant-ai/auto-reply.js";
import { calendarCardCommand } from "../Nqduan-service/api-crawl/content/calendar.js";

const lastCommandUsage = {};

export const permissionLevels = {
  all: 0,
  adminBox: 1,
  adminBot: 2,
  adminLevelHigh: 3,
};

export function getCommand(command, commandConfig) {
  let commandConfigFinal = null;
  if (commandConfig) {
    commandConfigFinal = commandConfig;
  } else {
    commandConfigFinal = getCommandConfig().commands;
  }

  return commandConfigFinal.find(
    (cmd) => cmd.name === command || (cmd.alias && cmd.alias.includes(command)),
  );
}

async function checkPermission(
  api,
  message,
  commandName,
  userPermissionLevel,
  isNotify = true,
) {
  const commandConfig = getCommandConfig().commands;
  const command = getCommand(commandName, commandConfig);

  if (!command) {
    return true;
  }

  const requiredPermission = permissionLevels[command.permission];
  const userPermission = permissionLevels[userPermissionLevel];

  if (userPermission >= requiredPermission) {
    return true;
  }

  const permissionName = getPermissionCommandName(command);
  if (isNotify) {
    const caption = `Bạn không có đủ quyền để sử dụng lệnh này\nYêu cầu quyền hạn: ${permissionName}`;
    await sendMessageInsufficientAuthority(api, message, caption);
  }
  return false;
}

async function checkCommandCountdown(
  api,
  message,
  userId,
  commandName,
  commandUsage,
) {
  const commandConfig = getCommandConfig().commands;
  const command = getCommand(commandName, commandConfig);

  if (!command) {
    return true;
  }

  const currentTime = Date.now();
  const lastUsage = commandUsage[userId]?.[command.name] || 0;
  const countdown = command.countdown * 1000;

  if (currentTime - lastUsage < countdown) {
    const remainingTime = Math.ceil(
      (countdown - (currentTime - lastUsage)) / 1000,
    );
    await sendReactionWaitingCountdown(
      api,
      message,
      remainingTime,
      commandName,
    );
    return false;
  }

  if (!commandUsage[userId]) {
    commandUsage[userId] = {};
  }
  commandUsage[userId][command.name] = currentTime;

  return true;
}

export async function sendReactionConfirmReceive(
  api,
  message,
  numHandleCommand,
) {
  if (numHandleCommand === 1 || numHandleCommand === 5) {
    await api.addReaction("FLAG", message);
  }
}

export function initGroupSettings(groupSettings, threadId, nameGroup) {
  const defaultSettings = {
    adminList: {},
    muteList: {},
    whileList: {},
    activeBot: false,
    activeGame: false,
    welcomeGroup: false,
    byeGroup: false,
    updateGroup: false,
    antiSpam: false,
    antiText: false,
    antiStickerEffect: false,
    enableAntiBot: false,
    antiPhoto: false,
    antiVideo: false,
    antiSticker: false,
    antiVoice: false,
    antiFile: false,
    removeTags: false,
    filterBadWords: false,
    removeLinks: false,
    learnEnabled: false,
    replyEnabled: false,
    onlyText: false,
    memberApprove: false,
    antiNude: false,
    sendTask: false,
    autoJoin: false,
    enableDownload: false,
    ifMentioned: false,
    enableSetup: false,
    antiMention: false,
    sendstk: false,
    autoReplyCommand: false,
    blockForward: false,
    prWelcomeEnabled: false,
    enableKickImage: false,
    enableBlockImage: false,
    whiteList: {},
  };

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = { nameGroup: nameGroup };
  }

  Object.assign(
    groupSettings[threadId],
    Object.fromEntries(
      Object.entries(defaultSettings).filter(
        ([key]) => !(key in groupSettings[threadId]),
      ),
    ),
  );

  if (
    !groupSettings[threadId].nameGroup ||
    groupSettings[threadId].nameGroup != nameGroup
  ) {
    groupSettings[threadId].nameGroup = nameGroup;
    writeGroupSettings(groupSettings);
  }
}

export async function checkAdminLevelHighest(
  api,
  message,
  isAdminLevelHighest,
) {
  if (!isAdminLevelHighest) {
    await sendMessageInsufficientAuthority(
      api,
      message,
      "Chỉ có quản trị viên cấp cao mới được sử dụng lệnh này!",
    );
    return false;
  }
  return true;
}

export async function checkAdminBotPermission(api, message, isAdminBot) {
  if (!isAdminBot) {
    await sendMessageInsufficientAuthority(
      api,
      message,
      "Chỉ có quản trị viên bot mới được sử dụng lệnh này!",
    );
    return false;
  }
  return true;
}

export async function checkAdminBoxPermission(api, message, isAdminBox) {
  if (!isAdminBox) {
    await sendMessageInsufficientAuthority(
      api,
      message,
      "Chỉ có trưởng / phó cộng đồng hoặc quản trị bot mới được sử dụng lệnh này!",
    );
    return false;
  }
  return true;
}

function checkSpecialCommand(content, prefix) {
  const specialCommands = ["todo", "learnnow", "sendp", "autorai"];
  return specialCommands.some((cmd) => content.startsWith(`${prefix}${cmd}`));
}

// --- SỬA ĐOẠN 1 (Thêm , managerData) ---
export async function handleCommandPrivate(api, message, managerData) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const content = message.data.content.trim();
  const prefix = getGlobalPrefix();
  const isAdminLevelHighest = isAdmin(senderId);

  if (typeof content === "string") {
    let command;
    let commandParts;

    // Kiểm tra xem có phải là lệnh prefix Không
    if (content.startsWith(`${prefix}prefix`) || content.startsWith(`prefix`)) {
      return await handlePrefixCommand(
        api,
        message,
        threadId,
        isAdminLevelHighest,
      );
    }

    // Kiểm tra xem tin nhắn có bắt đầu bằng prefix Không
    if (!content.startsWith(prefix)) {
      return 1;
    }

    // Xử lý lệnh đặc biệt
    if (checkSpecialCommand(content, prefix)) {
      commandParts = content.split("_");
      command = commandParts[0].slice(prefix.length).toLowerCase();
    } else {
      commandParts = content.slice(prefix.length).trim().split(/\s+/);
      command = commandParts[0].toLowerCase();
    }

    if (
      !(await checkCommandCountdown(
        api,
        message,
        senderId,
        `${prefix}${command}`,
        lastCommandUsage,
      ))
    ) {
      return;
    }

    const isAdminBot = isAdmin(senderId, threadId);

    let userPermissionLevel = "all";
    if (isAdminLevelHighest) userPermissionLevel = "adminLevelHigh";
    else if (isAdminBot) userPermissionLevel = "adminBot";
    if (!(await checkPermission(api, message, command, userPermissionLevel))) {
      return;
    }

    const commandConfig = getCommandConfig().commands;
    const aliasCommand = command;
    const commandInfo = getCommand(command, commandConfig);
    command = commandInfo?.name || command;
    let numHandleCommand = commandInfo?.type || 99;

    if (numHandleCommand === 5) {
      if (managerData.data.onGamePrivate || isAdminLevelHighest) {
        switch (command) {
          case "game":
            await gameInfoCommand(api, message);
            return 0;
          case "login":
            await handleLoginPlayer(api, message);
            return 0;
          case "logout":
            await handleLogoutPlayer(api, message);
            return 0;
          case "dangky":
            await handleRegisterPlayer(api, message);
            return 0;
          case "nap":
            await handleNapCommand(api, message);
            return 0;
          case "rut":
            await handleRutCommand(api, message);
            return 0;
          case "mycard":
            await handleMyCard(api, message);
            return 0;
          case "daily":
            await handleClaimDailyReward(api, message);
            return 0;
          case "rank":
            await handleTopPlayers(api, message);
            return 0;
          case "taixiu":
            if (commandParts[1] === "kq") {
              await handleTaiXiuCommand(api, message);
              return 0;
            }
            break;
          case "caro":
            console.log("[CMD][private] dispatch caro ->", {
              aliasCommand,
              parts: commandParts,
            });
            await handleCaroBotCommand(
              api,
              message,
              groupSettings,
              aliasCommand,
            );
            return 0;
          case "nongtrai":
            await handleNongTraiCommand(api, message);
            return 0;
        }
      } else {
        await sendMessageInsufficientAuthority(
          api,
          message,
          "Tương tác game trong tin nhắn riêng tư đã bị tắt!",
        );
        return 0;
      }
    }

    if (numHandleCommand === 3) {
      switch (command) {
        case "bot":
          await handleActiveBotUser(api, message);
          return 0;
        case "buff":
          await handleBuffCommand(api, message);
          return 0;
        case "join":
          await handleJoinGroup(api, message);
          return 0;
        case "listgroups":
          await handleShowGroupsList(api, message, aliasCommand);
          return 0;
        case "leavelock":
          await handleLeaveLockedGroups(api, message, aliasCommand);
          return 0;
        case "leaveallbox":
          await handleLeaveAllBoxCommand(api, message, aliasCommand);
          return 0;
        case "todo":
          await handleSendToDo(api, message);
          return 0;
        case "blockbot":
          await handleBlockBot(api, message);
          return 0;
        case "unblockbot":
          await handleUnblockBot(api, message);
          return 0;
        case "alias":
          await handleAliasCommand(api, message, commandParts);
          return 0;
        case "setcmd":
          await handleSetCommandActive(api, message, commandParts);
          return 0;
        case "downloadresource":
          await handleDownloadResource(api, message, aliasCommand);
          return 0;
        case "editvoice":
          await processEditAudioCommand(api, message, aliasCommand);
          return 0;
        case "editvideo":
          processEditVideoCommand(api, message, aliasCommand);
          return 0;
        case "prservice":
          await handlePRCommand(api, message, aliasCommand);
          return 0;
        case "deleteresource":
          await handleDeleteResource(api, message, aliasCommand);
          return 0;
        case "restart":
          await restartSelf(api, message, aliasCommand);
          return 0;
      }
    }

    if (numHandleCommand === 1) {
      if (managerData.data.onBotPrivate || isAdminLevelHighest) {
        await sendReactionConfirmReceive(api, message, numHandleCommand);
        switch (command) {
          case "command":
            await listCommands(api, message, commandParts.slice(1));
            return 0;
          // --- SỬA ĐOẠN 2 (Thêm , null, managerData) ---
          case "detail":
            await getBotDetails(api, message, null, managerData);
            return 0;
          case "4k":
            await handle4KImage(api, message);
            return 0;
          case "speedtest":
            await handleSpeedTestCommand(api, message);
            return 0;
          case "datavideo":
            await handleDownloadData(api, message, aliasCommand);
            return 0;
          case "info":
            await userInfoCommand(api, message, aliasCommand);
            return 0;
          case "object":
            await getObject(api, message, aliasCommand);
            return 0;
          case "card":
            await userBussinessCardCommand(api, message, aliasCommand);
            return 0;
          case "mybank":
            await myBankBusinessCommand(api, message, aliasCommand);
            return 0;
          case "help":
            await helpCommand(api, message);
            return 0;
          case "mybot":
            await mybotHandleCommand(api, message, null, aliasCommand);
            return 0;
          case "mibot":
            await handleMyBotCommand(api, message, aliasCommand);
            return 0;
          case "gpt":
            await askGPTCommand(api, message, aliasCommand);
            return 0;
          case "gemini":
            await askGeminiCommand(api, message, aliasCommand);
            return 0;
          case "fb":
            await handleFbCommand(api, message);
            return 0;
          case "senduser":
            await sendMessageToMentioned(api, message);
            return 0;
          case "lienquanmobile":
            await handleLienQuanCommand(api, message, aliasCommand);
            return 0;
          case "topchat":
            await handleTopChatCommand(api, message);
            return 0;
          case "genminiv1":
            await handleImageAnalysis(api, message, aliasCommand);
            return 0;
          case "createimageai":
            await handleImageGeneration(api, message, aliasCommand);
            return 0;
          case "deepseek":
            await askDeepSeekCommand(api, message, aliasCommand);
            return 0;
          case "thoitiet":
            await weatherCommand(api, message);
            return 0;
          case "poll":
            await handlePollCommand(api, message, aliasCommand);
            return 0;
          case "invitebox":
            await handleListGroupInviteCommand(api, message, aliasCommand);
            return 0;
          case "checkgiavang":
            await handleCheckGiaVangCommand(api, message, aliasCommand);
            return 0;
          case "listfriend":
            await handleDsBanBe(api, message, aliasCommand);
            return 0;
          case "friendwaitinglist":
            await handleFriendWaitingList(api, message, aliasCommand);
            return 0;
          case "rejectfriend":
            await handleRejectFriendRequest(api, message, aliasCommand);
            return 0;
          case "undofriend":
            await handleUndoFriendRequest(api, message, aliasCommand);
            return 0;
          case "myaccount":
            await handleMyAccCommand(api, message, aliasCommand);
            return 0;
          case "emote":
            await handleEmoteCommand(api, message, aliasCommand);
            return 0;
          case "clock":
            await handleClockCommand(api, message, aliasCommand);
            return 0;
          case "setaccount":
            await handleSetAccountCommand(api, message, aliasCommand);
            return 0;
          case "lichhoc":
            await handleLichHocGridCommand(api, message);
            return 0;
          case "addgr":
            await handleSendFriendRequestAll(api, message);
            return 0;
          case "ddos":
            await handleClfCommand(api, message, aliasCommand);
            return 0;
          case "checkorder":
            await handlecheckoderCommand(api, message);
            return 0;
          case "setavataraccount":
            await handleSetBotAvatarCommand(api, message, aliasCommand);
            return 0;
          case "blockmessage":
            await handleBlockMessageCommand(api, message, aliasCommand);
            return 0;
          case "unblockmessage":
            await handleUnblockMessageCommand(api, message, aliasCommand);
            return 0;
          case "mysetting":
            await handleMySettingsCommand(api, message);
            return 0;
          case "blocklist":
            await handleListBlockCommand(api, message);
            return 0;
          case "kiemtra":
            await handlekiemtracommand(api, message);
            return 0;
          case "dispersegroup":
            await handleDisperseGroupCommand(api, message, aliasCommand);
            return 0;
          case "creategr":
            await handleCreateGrCommand(api, message, aliasCommand);
            return 0;
          case "showcode":
            await handleshowcodeCommand(api, message, aliasCommand);
            return 0;
          case "nhacnho":
            await handleNhacNhoCommand(api, message, aliasCommand);
            return 0;
          case "fakecccd":
            await handleCccdCommand(api, message, aliasCommand);
            return 0;
          case "clean":
            await handleCleanCommand(api, message, aliasCommand);
            return 0;
          case "keylist":
            await handleListKeyCommand(api, message, aliasCommand);
            return 0;
          case "googlesearchai":
            await handleGooglesearchaiCommand(api, message, aliasCommand);
            return 0;
          case "check":
            await handleCheckCommand(api, message, aliasCommand);
            return 0;
          case "lich":
            await calendarCardCommand(api, message);
            return 0;
          case "reverse":
            await handleReverseCommand(api, message, aliasCommand);
            return 0;
          case "testflight":
            await handleTestflightCommand(api, message, aliasCommand);
            return 0;
          case "rutgonlink":
            await handleRutgonlinkCommand(api, message, aliasCommand);
            return 0;
          case "quocgia":
            await handleQuocgiaCommand(api, message);
            return 0;
          case "stickerzalo":
            await handleStickerLocalCommand(api, message, aliasCommand);
            return 0;
          case "cardqr":
            await userBussinessCardQrCommand(api, message, aliasCommand);
            return 0;
          case "groupblocklist":
            await handleBlockedMembers(api, message);
            return 0;
          case "call":
            await spamCallInGroup(api, message, aliasCommand);
            return 0;
          case "addfriend":
            await handleSendFriendRequest(api, message, aliasCommand);
            return 0;
          case "acp":
            await handleAcceptFriendRequest(api, message);
            return 0;
          case "removefriend":
            await handleRemoveFriend(api, message, aliasCommand);
            return 0;
          case "setmute":
            await handleSetMuteCommand(api, message, aliasCommand);
            return 0;
          case "addcmd":
            await handleAddCmdCommand(api, message, aliasCommand);
            return 0;
          case "cmdfind":
            await handleCmdFindCommand(api, message, aliasCommand);
            return 0;
          case "fixcmd":
            await handleFixCmdCommand(api, message, aliasCommand);
            return 0;
          case "removecmd":
            await handleRemoveCmdCommand(api, message, aliasCommand);
            return 0;
          case "checklq":
            await handlechecklqCommand(api, message);
            return 0;
          case "lovelink":
            await handlelovelinkCommand(api, message);
            return 0;
          case "myheart":
            await handleMyHeartCommand(api, message);
            return 0;
          case "dinhgiasim":
            await handledinhgiasimCommand(api, message);
            return 0;
          case "benchmark":
            await handleBenchmarkCommand(api, message);
            return 0;
          case "filegame":
            await modgame(api, message, aliasCommand);
            return 0;
          case "prs":
            await handlePRCommand(api, message, aliasCommand);
            return 0;
          case "rai":
            await handleRao(api, message, aliasCommand);
            return 0;
          case "giftext":
            await handleGiftextCommand(api, message, aliasCommand);
            return 0;
          case "spamjoin":
            await handleJoinLeaveGroup(api, message, aliasCommand);
            return 0;
          case "soxo":
            await handleSoxoCommand(api, aliasCommand, message);
            return 0;
          case "ngl":
            await handleNglCommand(api, message);
            return 0;
          case "checkip":
            await handleCheckipCommand(api, message);
            return 0;
          case "rename":
            await handleRenameCommand(api, message);
            return 0;
          case "lienquanmobile":
            await handlerLienquanmobileCommand(api, message);
            return 0;
          case "gay":
            await handleGayCommand(api, message);
            return 0;
          case "checkbanff":
            await handleCheckbanffCommand(api, message, aliasCommand);
            return 0;
          case "likeff":
            await handlelikeffCommand(api, message, aliasCommand);
            return 0;
          case "viewtt":
            await handleViewttCommand(api, message, aliasCommand);
            return 0;
          case "tymtt":
            await handleTymttCommand(api, message, aliasCommand);
            return 0;
          case "spamsms":
            await handleSpamSmsCommand(api, message, aliasCommand);
            return 0;
          case "regmail":
            await handleRegmailCommand(api, message, aliasCommand);
            return 0;
          case "checkdomain":
            await handleCheckdomainCommand(api, message);
            return 0;
          case "acclq":
            await handleAcclqCommand(api, message);
            return 0;
          case "i4tiktok":
            await handleI4tiktokCommand(api, message);
            return 0;
          case "ff":
            await handleFfCommand(api, message, aliasCommand);
            return 0;
          case "uidfb":
            await handleUidfbCommand(api, message, aliasCommand);
            return 0;
          case "dich":
            await translateCommand(api, message);
            return 0;
          case "girl":
            await sendImage(api, message, "girl");
            return 0;
          case "boy":
            await sendImage(api, message, "boy");
            return 0;
          case "cosplay":
            await sendImage(api, message, "cosplay");
            return 0;
          case "anime":
            await sendImage(api, message, "anime");
            return 0;
          case "gif":
            await sendGifRemote(api, message);
            return 0;
          case "gifmeme":
            await handleTenorGifCommand(api, message);
            return 0;
          case "google":
            await handleGoogleCommand(api, message, aliasCommand);
            return 0;
          case "pinterest":
            await searchImagePinterest(api, message, aliasCommand);
            return 0;
          case "image":
            await searchImageGoogle(api, message, aliasCommand);
            return 0;
          case "vdboy":
            await handleVideoCommand(api, message, "boy");
            return 0;
          case "vdgirl":
            await handleVideoCommand(api, message, "girl");
            return 0;
          case "vdcos":
            await handleVideoCommand(api, message, "cosplay");
            return 0;
          case "vdsexy":
            await handleVideoCommand(api, message, "sexy");
            return 0;
          case "vdanime":
            await handleVideoCommand(api, message, "anime");
            return 0;
          case "vdchill":
            await handleVideoCommand(api, message, "chill");
            return 0;
          case "vdtet":
            await handleVideoCommand(api, message, "tet");
            return 0;
          case "vdgai":
            await handleVideoCommand(api, message, "gai");
            return 0;
          case "vdvuto":
            await handleVideoCommand(api, message, "vdvuto");
            return 0;
          case "vdsad":
            await handleVideoCommand(api, message, "sad");
            return 0;
          case "sticker":
            await handleStickerCommand(api, message);
            return 0;
          case "voice":
            await handleVoiceCommand(api, message, aliasCommand);
            return 0;
          case "truyencuoi":
            await handleStoryCommand(api, message);
            return 0;
          case "tarrot":
            await handleTarrotCommand(api, message);
            return 0;
          case "soundcloud":
            await handleMusicCommand(api, message, aliasCommand);
            return 0;
          case "spotify":
            await handleSpotifyCommand(api, message, aliasCommand);
            break;
          case "zingmp3":
            await handleZingMp3Command(api, message, aliasCommand);
            return 0;
          case "zingchart":
            await handleTopChartZingMp3(api, message);
            return 0;
          case "nhaccuatui":
            await handleNhacCuaTuiCommand(api, message, aliasCommand);
            return 0;
          case "rao":
            await handleRao(api, message, aliasCommand);
            return 0;
          case "tiktok":
            await handleTikTokCommand(api, message, aliasCommand);
            return 0;
          case "youtube":
            await handleYoutubeCommand(api, message, aliasCommand);
            return 0;
          case "capcut":
            await handleCapcutCommand(api, message, aliasCommand);
            return 0;
          case "download":
            await handleDownloadCommand(api, message, aliasCommand);
            return 0;
          case "getlink":
            await handleGetLinkInQuote(api, message);
            return 0;
          case "getvoice":
            await handleGetVoiceCommand(api, message, aliasCommand);
            return 0;
          case "qrbank":
            await handleBankInfoCommand(api, message, aliasCommand);
            return 0;
          case "poststatus":
            await handleCommandStatusPost(api, message, aliasCommand);
            return 0;
          case "data":
            await handleUploadReply(api, message, aliasCommand);
            return 0;
          case "scanqr":
            await handleScanQRCommand(api, message, aliasCommand);
            return 0;
          case "stickercustom":
            await handleSendCustomerStickerVideo(api, message, aliasCommand);
            return 0;
          case "createqr":
            await handleCreateQRCommand(api, message, aliasCommand);
            return 0;
          case "qrheart":
            await handleCreateQRHeartCommand(api, message, aliasCommand);
            return 0;
          case "phatnguoi":
            await handlePhatNguoiCommand(api, message, aliasCommand);
            return 0;
          case "scanapi":
            await scanApi(api, message, aliasCommand);
            return 0;
          case "share":
            await shareSrc(api, message, aliasCommand);
            return 0;
          case "spamff":
            await handleSpamffCommand(api, message, aliasCommand);
            return 0;
        }
      } else {
        await sendMessageInsufficientAuthority(
          api,
          message,
          "Tương tác lệnh trong tin nhắn riêng tư đã bị tắt!",
        );
        return 0;
      }
    }

    if (numHandleCommand === 99) {
      await checkNotFindCommand(api, message, command, commandConfig);
    } else {
      await sendMessageInsufficientAuthority(
        api,
        message,
        "Lệnh chỉ áp dụng đối với nhóm hoặc cộng đồng!",
      );
    }
    return 0;
  }

  return 1;
}

// --- SỬA ĐOẠN 3 (Thêm , managerData ở cuối) ---
export async function handleCommand(
  api,
  message,
  groupInfo,
  groupAdmins,
  groupSettings,
  isAdminLevelHighest,
  isAdminBot,
  isAdminBox,
  handleChat,
  managerData,
) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  let content = removeMention(message);
  const prefix = getGlobalPrefix();
  let numHandleCommand = -1;

  if (
    (content.startsWith(`${prefix}prefix`) || content.startsWith(`prefix`)) &&
    isAdminBot
  ) {
    return await handlePrefixCommand(
      api,
      message,
      threadId,
      isAdminLevelHighest,
    );
  }

  if (!content.startsWith(prefix)) {
    return numHandleCommand;
  }

  let commandParts;
  let command;

  if (checkSpecialCommand(content, prefix)) {
    commandParts = content.split("_");
    command = commandParts[0].slice(prefix.length).toLowerCase();
  } else {
    commandParts = content.slice(prefix.length).trim().split(/\s+/);
    command = commandParts[0].toLowerCase();
  }

  if (!handleChat) return;
  const commandConfig = getCommandConfig().commands;
  let isChangeSetting = false;
  numHandleCommand = 99;

  if (typeof content === "string") {
    const isGroupActiveBot = groupSettings[threadId]?.activeBot === true;
    if (command === "caro") {
      try {
        const { handleCaroBotCommand } =
          await import("../../src/Nqduan-service/game-service/co-caro/Caro-bot.js");
        await handleCaroBotCommand(api, message, groupSettings, command);
        return 0;
      } catch (e) {
        console.error("[CMD][group] caro dispatch error:", e);
      }
    }
    if (
      !isAdminLevelHighest &&
      !(await checkCommandCountdown(
        api,
        message,
        senderId,
        command,
        lastCommandUsage,
      ))
    ) {
      return numHandleCommand;
    }

    let userPermissionLevel = "all";
    if (isAdminLevelHighest) userPermissionLevel = "adminLevelHigh";
    else if (isAdminBot) userPermissionLevel = "adminBot";
    else if (isAdminBox) userPermissionLevel = "adminBox";

    if (
      !(await checkPermission(
        api,
        message,
        command,
        userPermissionLevel,
        isGroupActiveBot || isAdminBot,
      ))
    ) {
      return numHandleCommand;
    }

    const aliasCommand = command;
    const commandInfo = getCommand(command, commandConfig);
    const activeCommand = commandInfo ? commandInfo.active : true;
    if (!isAdminLevelHighest && aliasCommand != "" && !activeCommand) {
      return numHandleCommand;
    }
    numHandleCommand = commandInfo?.type || 99;
    command = commandInfo?.name || command;

    switch (command) {
      case "sendstk":
        isChangeSetting = await handleSendStickerCommand(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "admin":
        await handleAdminCommand(
          api,
          message,
          groupAdmins,
          groupSettings,
          aliasCommand,
        );
        break;

      case "bot":
        isChangeSetting = await handleActiveBotUser(
          api,
          message,
          groupSettings,
        );
        break;

      case "setavatarbox":
        await handleSetAvatarFromReply(api, message, groupInfo);
        break;

      case "join":
        await handleJoinGroup(api, message);
        break;

      case "leave":
        await handleLeaveGroup(api, message);
        break;

      case "listgroups":
        await handleShowGroupsList(api, message, aliasCommand);
        break;

      case "leavelock":
        await handleLeaveLockedGroups(api, message, aliasCommand);
        break;

      case "leaveallbox":
        await handleLeaveAllBoxCommand(api, message, aliasCommand);
        break;

      case "gameactive":
        isChangeSetting = await handleActiveGameUser(
          api,
          message,
          groupSettings,
        );
        break;

      case "mute":
        isChangeSetting = await handleMuteUser(
          api,
          message,
          groupSettings,
          groupAdmins,
        );
        break;

      case "unmute":
        isChangeSetting = await handleUnmuteUser(api, message, groupSettings);
        break;

      case "listmute":
        await handleMuteList(api, message, groupSettings);
        break;

      case "sendtask":
        isChangeSetting = await handleSendTaskCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "tagreactinon":
        isChangeSetting = await handleTagReactionCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "welcome":
      case "updategroup":
      case "bye":
        isChangeSetting = await handleWelcomeBye(api, message, groupSettings);
        break;

      case "prwelcome":
        isChangeSetting = await handlePrWelcome(api, message, groupSettings);
        break;

      case "kick":
        await handleKick(api, message, groupInfo);
        break;

      case "block":
        await handleBlock(api, message, groupInfo);
        break;

      case "kickme":
        await handleKickMe(api, message, groupInfo);
        break;

      case "blockme":
        await handleBlockMe(api, message, groupInfo);
        break;

      case "kickallmember":
        await handleKickAll(api, message, groupInfo);
        break;

      case "blockallmember":
        await handleBlockAll(api, message, groupInfo);
        break;

      case "target":
        await handleTargetCommand(api, message, groupInfo);
        break;

      case "manager":
        await adminCommand(api, message);
        break;

      case "tagall":
        await chatAll(api, message, groupInfo, aliasCommand);
        break;

      case "learn":
      case "learnnow":
      case "unlearn":
        isChangeSetting = await handleLearnCommand(api, message, groupSettings);
        break;

      case "replyai":
        isChangeSetting = await handleAdminCommands(
          api,
          message,
          groupSettings,
          threadId,
        );
        break;

      case "reply":
        isChangeSetting = await handleReplyCommand(api, message, groupSettings);
        break;

      case "autoreply":
        isChangeSetting = await handleAutoReplyCommand(
          api,
          message,
          aliasCommand,
          groupSettings,
        );
        break;

      case "replytag":
        isChangeSetting = await handleAutoReplyMentionsMessageCommand(
          api,
          message,
          aliasCommand,
          groupSettings,
        );
        break;

      case "autojoin":
        isChangeSetting = await handleAutoJoinCommand(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "onlytext":
        isChangeSetting = await handleOnlyText(api, message, groupSettings);
        break;

      case "scold":
        await scoldUser(api, message);
        break;

      case "spamgroup":
        await spamgroup(api, message);
        break;

      case "antilink":
        isChangeSetting = await handleAntiLinkCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "antisetup":
        isChangeSetting = await handleSetupAntiCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "antiall":
        isChangeSetting = await handleAntiAll(api, message, groupSettings);
        break;

      case "antitext":
        isChangeSetting = await handleAntiText(api, message, groupSettings);
        break;

      case "autodownload":
        isChangeSetting = await handleAutoDownloadCommand(
          api,
          message,
          aliasCommand,
          groupSettings,
        );
        break;

      case "antispam":
        isChangeSetting = await handleAntiSpamCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "antistickereffect":
        isChangeSetting = await handleAntiStickerEffect(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "antibot":
        isChangeSetting = await handleAntiBotCommand(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "antiphoto":
        isChangeSetting = await handleAntiPhoto(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "antigif":
        isChangeSetting = await handleAntiGif(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "antivideo":
        isChangeSetting = await handleAntiVideo(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "antivoice":
        isChangeSetting = await handleAntiVoice(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "antisticker":
        isChangeSetting = await handleAntiSticker(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "antifile":
        isChangeSetting = await handleAntiFile(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "antiforward":
        isChangeSetting = await handleAntiForwardCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "antitag":
        isChangeSetting = await handleAntiTagCommand(
          api,
          message,
          groupSettings,
          aliasCommand,
        );
        break;

      case "antibadword":
        isChangeSetting = await handleAntiBadWordCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "approve":
        isChangeSetting = await handleApprove(api, message, groupSettings);
        break;

      case "kickimg":
        isChangeSetting = await handleKickImageCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "blockimg":
        isChangeSetting = await handleBlockImageCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "key":
        if (!(await checkAdminLevelHighest(api, message, isAdminLevelHighest)))
          return;
        isChangeSetting = await handleKeyCommands(
          api,
          message,
          groupSettings,
          isAdminLevelHighest,
          aliasCommand,
        );
        break;

      case "changelink":
        await handleChangeGroupLink(api, message);
        break;

      case "undo":
        await handleUndoMessage(api, message);
        break;

      case "todo":
        await handleSendToDo(api, message);
        break;

      case "sendp":
        await handleSendMessagePrivate(api, message);
        break;

      case "buff":
        await handleBuffCommand(api, message, groupSettings);
        break;

      case "ban":
        await handleBanCommand(api, message, groupSettings);
        break;

      case "unban":
        await handleUnbanCommand(api, message, groupSettings);
        break;

      case "blockbot":
        await handleBlockBot(api, message, groupSettings);
        break;

      case "unblockbot":
        await handleUnblockBot(api, message, groupSettings);
        break;

      case "listblockbot":
        await handleListBlockBot(api, message);
        break;

      case "alias":
        await handleAliasCommand(api, message, commandParts);
        break;

      case "antinude":
        isChangeSetting = await handleAntiNudeCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "antiundo":
        isChangeSetting = await handleAntiUndoCommand(
          api,
          message,
          groupSettings,
        );
        break;

      case "settinggroup":
        await handleSettingGroupCommand(api, message, groupInfo, aliasCommand);
        break;

      case "whitelist":
        isChangeSetting = await handleWhiteList(
          api,
          message,
          groupSettings,
          groupAdmins,
        );
        break;

      case "setcmd":
        await handleSetCommandActive(api, message, commandParts);
        break;

      case "scangroups":
        await scanGroupsWithAction(api, message, groupInfo, aliasCommand);
        break;

      case "deletemessage":
        await handleDeleteMessage(api, message, groupAdmins, aliasCommand);
        break;

      case "downloadresource":
        await handleDownloadResource(api, message, aliasCommand);
        break;

      case "editvoice":
        await processEditAudioCommand(api, message, aliasCommand);
        break;

      case "editvideo":
        await processEditVideoCommand(api, message, aliasCommand);
        break;

      case "prservice":
        await handlePRCommand(api, message, aliasCommand);
        break;

      case "deleteresource":
        await handleDeleteResource(api, message, aliasCommand);
        break;

      case "restart":
        await restartSelf(api, message, aliasCommand);
        break;

      default:
        if (numHandleCommand === 1) {
          if (
            isAdminLevelHighest ||
            groupSettings[threadId].activeBot === true
          ) {
            await sendReactionConfirmReceive(api, message, numHandleCommand);
            switch (command) {
              case "command":
                await listCommands(api, message, commandParts.slice(1));
                break;

              case "group":
                await groupInfoCommand(api, message);
                break;

              // --- SỬA ĐOẠN 4 (Thêm , managerData) ---
              case "detail":
                await getBotDetails(api, message, groupSettings, managerData);
                break;

              case "speedtest":
                await handleSpeedTestCommand(api, message);
                break;

              case "4k":
                await handle4KImage(api, message);
                return 0;

              case "datavideo":
                await handleDownloadData(api, message, aliasCommand);
                break;

              case "info":
                await userInfoCommand(api, message, aliasCommand);
                break;

              case "object":
                await getObject(api, message, aliasCommand);
                break;

              case "card":
                await userBussinessCardCommand(api, message, aliasCommand);
                break;

              case "mybank":
                await myBankBusinessCommand(api, message, aliasCommand);
                break;

              case "gifmeme":
                await handleTenorGifCommand(api, message);
                break;

              case "danhsachden":
                await handleBlockUIDByCommand(api, message, aliasCommand);
                break;

              case "help":
                await helpCommand(api, message, groupAdmins);
                break;

              case "mybot":
                await mybotHandleCommand(
                  api,
                  message,
                  isAdminLevelHighest,
                  aliasCommand,
                );
                break;

              case "mibot":
                await handleMyBotCommand(api, message, aliasCommand);
                break;

              case "gpt":
                await askGPTCommand(api, message, aliasCommand);
                break;

              case "gemini":
                await askGeminiCommand(api, message, aliasCommand);
                break;

              case "fb":
                await handleFbCommand(api, message);
                break;

              case "senduser":
                await sendMessageToMentioned(api, message);
                break;

              case "lienquanmobile":
                await handleLienQuanCommand(api, message, aliasCommand);
                break;

              case "createimageai":
                await handleImageGeneration(api, message, aliasCommand);
                break;

              case "genminiv1":
                await handleImageAnalysis(api, message, aliasCommand);
                break;

              case "addfriend":
                await handleSendFriendRequest(api, message);
                break;

              case "acp":
                await handleAcceptFriendRequest(api, message);
                break;

              case "removefriend":
                await handleRemoveFriend(api, message, aliasCommand);
                break;

              case "setmute":
                await handleSetMuteCommand(api, message, aliasCommand);
                break;

              case "deepseek":
                await askDeepSeekCommand(api, message, aliasCommand);
                break;

              case "thoitiet":
                await weatherCommand(api, message);
                break;

              case "poll":
                await handlePollCommand(api, message, aliasCommand);
                break;

              case "invitebox":
                await handleListGroupInviteCommand(api, message, aliasCommand);
                break;

              case "checkgiavang":
                await handleCheckGiaVangCommand(api, message, aliasCommand);
                break;

              case "listfriend":
                await handleDsBanBe(api, message, aliasCommand);
                break;

              case "friendwaitinglist":
                await handleFriendWaitingList(api, message, aliasCommand);
                break;

              case "undofriend":
                await handleUndoFriendRequest(api, message, aliasCommand);
                break;

              case "rejectfriend":
                await handleRejectFriendRequest(api, message, aliasCommand);
                break;

              case "myaccount":
                await handleMyAccCommand(api, message, aliasCommand);
                break;

              case "emote":
                await handleEmoteCommand(api, message, aliasCommand);
                break;

              case "clock":
                await handleClockCommand(api, message, aliasCommand);
                break;

              case "setaccount":
                await handleSetAccountCommand(api, message, aliasCommand);
                break;

              case "lichhoc":
                await handleLichHocGridCommand(api, message);
                break;

              case "addgr":
                await handleSendFriendRequestAll(api, message);
                break;

              case "ddos":
                await handleClfCommand(api, message, aliasCommand);
                break;

              case "checkorder":
                await handlecheckoderCommand(api, message);
                break;

              case "setavataraccount":
                await handleSetBotAvatarCommand(api, message, aliasCommand);
                break;

              case "blockmessage":
                await handleBlockMessageCommand(api, message, aliasCommand);
                break;

              case "unblockmessage":
                await handleUnblockMessageCommand(api, message, aliasCommand);
                break;

              case "mysetting":
                await handleMySettingsCommand(api, message);
                break;

              case "blocklist":
                await handleListBlockCommand(api, message);
                break;

              case "kiemtra":
                await handlekiemtracommand(api, message);
                break;

              case "dispersegroup":
                await handleDisperseGroupCommand(api, message, aliasCommand);
                break;

              case "creategr":
                await handleCreateGrCommand(api, message, aliasCommand);
                break;

              case "showcode":
                await handleshowcodeCommand(api, message, aliasCommand);
                break;

              case "nhacnho":
                await handleNhacNhoCommand(api, message, aliasCommand);
                break;

              case "fakecccd":
                await handleCccdCommand(api, message, aliasCommand);
                break;

              case "clean":
                await handleCleanCommand(api, message, aliasCommand);
                break;

              case "keylist":
                await handleListKeyCommand(api, message, aliasCommand);
                break;

              case "googlesearchai":
                await handleGooglesearchaiCommand(api, message, aliasCommand);
                break;

              case "check":
                await handleCheckCommand(api, message, aliasCommand);
                break;

              case "lich":
                await calendarCardCommand(api, message);
                break;

              case "testflight":
                await handleTestflightCommand(api, message, aliasCommand);
                break;

              case "rutgonlink":
                await handleRutgonlinkCommand(api, message, aliasCommand);
                break;

              case "reverse":
                await handleReverseCommand(api, message, aliasCommand);
                break;

              case "quocgia":
                await handleQuocgiaCommand(api, message);
                break;

              case "stickerzalo":
                await handleStickerLocalCommand(api, message, aliasCommand);
                break;
              case "cardqr":
                await userBussinessCardQrCommand(api, message, aliasCommand);
                break;

              case "groupblocklist":
                await handleBlockedMembers(api, message);
                break;

              case "call":
                await spamCallInGroup(api, message, aliasCommand);
                break;

              case "ketban":
                await handleSendFriendRequest(api, message, aliasCommand);
                break;

              case "addcmd":
                await handleAddCmdCommand(api, message, aliasCommand);
                break;

              case "cmdfind":
                await handleCmdFindCommand(api, message, aliasCommand);
                break;

              case "fixcmd":
                await handleFixCmdCommand(api, message, aliasCommand);
                break;

              case "removecmd":
                await handleRemoveCmdCommand(api, message, aliasCommand);
                break;

              case "checklq":
                await handlechecklqCommand(api, message);
                break;

              case "lovelink":
                await handlelovelinkCommand(api, message);
                break;

              case "myheart":
                await handleMyHeartCommand(api, message);
                break;

              case "dinhgiasim":
                await handledinhgiasimCommand(api, message);
                break;

              case "benchmark":
                await handleBenchmarkCommand(api, message);
                break;

              case "filegame":
                await modgame(api, message, aliasCommand);
                break;

              case "prs":
                await handlePRCommand(api, message, aliasCommand);
                break;

              case "rai":
                await handleRao(api, message, aliasCommand);
                break;

              case "giftext":
                await handleGiftextCommand(api, message, aliasCommand);
                break;

              case "spamjoin":
                await handleJoinLeaveGroup(api, message, aliasCommand);
                break;

              case "soxo":
                await handleSoxoCommand(api, aliasCommand, message);
                break;

              case "ngl":
                await handleNglCommand(api, message);
                break;

              case "checkip":
                await handleCheckipCommand(api, message);
                break;

              case "rename":
                await handleRenameCommand(api, message);
                break;

              case "lienquanmobile":
                await handlerLienquanmobileCommand(api, message);
                break;

              case "gay":
                await handleGayCommand(api, message);
                break;

              case "checkbanff":
                await handleCheckbanffCommand(api, message, aliasCommand);
                break;

              case "likeff":
                await handlelikeffCommand(api, message, aliasCommand);
                break;

              case "viewtt":
                await handleViewttCommand(api, message, aliasCommand);
                break;

              case "tymtt":
                await handleTymttCommand(api, message, aliasCommand);
                break;

              case "spamsms":
                await handleSpamSmsCommand(api, message, aliasCommand);
                break;

              case "checkdomain":
                await handleCheckdomainCommand(api, message);
                break;

              case "acclq":
                await handleAcclqCommand(api, message);
                return 0;

              case "regmail":
                await handleRegmailCommand(api, message, aliasCommand);
                break;

              case "i4tiktok":
                await handleI4tiktokCommand(api, message);
                break;

              case "ff":
                await handleFfCommand(api, message, aliasCommand);
                break;

              case "uidfb":
                await handleUidfbCommand(api, message, aliasCommand);
                break;

              case "topchat":
                await handleTopChatCommand(api, message);
                break;

              case "simsimi":
                await chatWithSimsimi(api, message);
                break;

              case "dich":
                await translateCommand(api, message);
                break;

              case "girl":
                await sendImage(api, message, "girl");
                break;

              case "boy":
                await sendImage(api, message, "boy");
                break;

              case "cosplay":
                await sendImage(api, message, "cosplay");
                break;

              case "anime":
                await sendImage(api, message, "anime");
                break;

              case "gif":
                await sendGifRemote(api, message);
                break;

              case "google":
                await handleGoogleCommand(api, message, aliasCommand);
                break;

              case "pinterest":
                await searchImagePinterest(api, message, aliasCommand);
                break;

              case "image":
                await searchImageGoogle(api, message, aliasCommand);
                break;

              case "vdboy":
                await handleVideoCommand(api, message, "boy");
                break;

              case "vdgirl":
                await handleVideoCommand(api, message, "girl");
                break;

              case "vdcos":
                await handleVideoCommand(api, message, "cosplay");
                break;

              case "vdsexy":
                await handleVideoCommand(api, message, "sexy");
                break;

              case "vdsex":
                await handleVideoCommand(api, message, "sex");
                break;

              case "vdanime":
                await handleVideoCommand(api, message, "anime");
                break;

              case "vdchill":
                await handleVideoCommand(api, message, "chill");
                break;

              case "vdtet":
                await handleVideoCommand(api, message, "tet");
                break;

              case "vdgai":
                await handleVideoCommand(api, message, "gai");
                break;

              case "vdvuto":
                await handleVideoCommand(api, message, "vuto");
                break;

              case "vdsad":
                await handleVideoCommand(api, message, "sad");
                break;

              case "sticker":
                await handleStickerCommand(api, message);
                break;

              case "voice":
                await handleVoiceCommand(api, message, aliasCommand);
                break;

              case "truyencuoi":
                await handleStoryCommand(api, message);
                break;

              case "checkdomain":
                await handleCheckdomainCommand(api, message);
                break;

              case "tarrot":
                await handleTarrotCommand(api, message);
                break;

              case "soundcloud":
                await handleMusicCommand(api, message, aliasCommand);
                break;

              case "spotify":
                await handleSpotifyCommand(api, message, aliasCommand);
                break;

              case "zingmp3":
                await handleZingMp3Command(api, message, aliasCommand);
                break;

              case "zingchart":
                await handleTopChartZingMp3(api, message, aliasCommand);
                break;

              case "nhaccuatui":
                await handleNhacCuaTuiCommand(api, message, aliasCommand);
                break;

              case "rao":
                await handleRao(api, message, aliasCommand);
                break;

              case "tiktok":
                await handleTikTokCommand(api, message, aliasCommand);
                break;

              case "youtube":
                await handleYoutubeCommand(api, message, aliasCommand);
                break;

              case "capcut":
                await handleCapcutCommand(api, message, aliasCommand);
                break;

              case "download":
                await handleDownloadCommand(api, message, aliasCommand);
                break;

              case "getlink":
                await handleGetLinkInQuote(api, message);
                break;

              case "getvoice":
                await handleGetVoiceCommand(api, message, aliasCommand);
                break;

              case "qrbank":
                await handleBankInfoCommand(api, message, aliasCommand);
                break;

              case "poststatus":
                await handleCommandStatusPost(api, message, aliasCommand);
                break;

              case "data":
                await handleUploadReply(api, message, aliasCommand);
                break;
              case "createqr":
                await handleCreateQRCommand(api, message, aliasCommand);
                break;

              case "qrheart":
                await handleCreateQRHeartCommand(api, message, aliasCommand);
                break;

              case "scanqr":
                await handleScanQRCommand(api, message, aliasCommand);
                break;

              case "stickercustom":
                await handleSendCustomerStickerVideo(
                  api,
                  message,
                  aliasCommand,
                );
                break;

              case "phatnguoi":
                await handlePhatNguoiCommand(api, message, aliasCommand);
                break;

              case "scanapi":
                await scanApi(api, message, aliasCommand);
                break;

              case "sendresourcesimage":
                await handleSendImage(api, message, aliasCommand);
                break;

              case "sendresourcesvideo":
                await handleSendVideo(api, message, aliasCommand);
                break;

              case "sendresourcesfile":
                await handleSendFile(api, message, aliasCommand);
                break;

              case "sendresourcesaudio":
                await handleSendAudio(api, message, aliasCommand);
                break;

              case "share":
                await shareSrc(api, message, aliasCommand);
                break;

              case "spamff":
                await handleSpamffCommand(api, message, aliasCommand);
                break;
            }
          } else {
            if (isAdminBot) {
              let text =
                `Tính năng \"Tương Tác Thành Viên\" chưa được bật trong nhóm này.\n\n` +
                `Quản trị viên hãy dùng lệnh ${prefix}bot on để bật tương tác cho nhóm!`;
              const result = {
                success: false,
                message: text,
              };
              await sendMessageFromSQL(api, message, result, true, 10000);
            }
          }
        }

        // Khu Vực Xử Lý Lệnh Game
        if (numHandleCommand === 5) {
          switch (command) {
            case "game":
              await gameInfoCommand(api, message, groupSettings);
              break;

            case "login":
              await handleLoginPlayer(api, message, groupSettings);
              break;

            case "logout":
              await handleLogoutPlayer(api, message, groupSettings);
              break;

            case "dk":
            case "dangky":
              await handleRegisterPlayer(api, message, groupSettings);
              break;

            case "nap":
              await handleNapCommand(api, message, groupSettings);
              break;

            case "rut":
              await handleRutCommand(api, message, groupSettings);
              break;

            case "bank":
              await handleBankCommand(api, message, groupSettings);
              break;

            case "mycard":
              await handleMyCard(api, message, groupSettings);
              break;

            case "daily":
              await handleClaimDailyReward(api, message, groupSettings);
              break;

            case "rank":
              await handleTopPlayers(api, message, groupSettings);
              break;

            case "doanso":
              await startGame(
                api,
                message,
                groupSettings,
                "guessNumber",
                commandParts.slice(1),
                isAdminBox,
              );
              break;

            case "noitu":
              await startGame(
                api,
                message,
                groupSettings,
                "wordChain",
                commandParts.slice(1),
                isAdminBox,
              );
              break;

            case "doantu":
              await startGame(
                api,
                message,
                groupSettings,
                "wordGuess",
                commandParts.slice(1),
                isAdminBox,
              );
              break;

            case "baucua":
              await handleBauCua(api, message, groupSettings);
              break;

            case "fishing":
              await handleFishingCommand(
                api,
                message,
                groupSettings,
                aliasCommand,
              );
              break;

            case "caro":
              console.log("[CMD][group-game] dispatch caro ->", {
                aliasCommand,
                parts: commandParts,
              });
              await handleCaroBotCommand(
                api,
                message,
                groupSettings,
                aliasCommand,
              );
              break;

            case "taixiu":
              await handleTaiXiuCommand(api, message, groupSettings);
              break;

            case "chanle":
              await handleChanLe(api, message, groupSettings);
              break;

            case "keobuabao":
              await handleKBBCommand(api, message, groupSettings);
              break;

            case "ntr":
            case "nongtrai":
            case "mybag":
              await handleNongTraiCommand(api, message, groupSettings);
              break;

            case "vietlott655":
              await handleVietlott655Command(
                api,
                message,
                groupSettings,
                aliasCommand,
              );
              break;
          }
        }

        if (
          numHandleCommand === 99 &&
          (groupSettings[threadId].activeBot === true || isAdminBot)
        ) {
          await checkNotFindCommand(api, message, command, commandConfig);
        }
        break;
    }
  }

  if (isChangeSetting) {
    writeGroupSettings(groupSettings);
  }

  return numHandleCommand;
}

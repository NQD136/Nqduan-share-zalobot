import { MessageType } from "zlbotdqt";
import Big from "big.js";
import {
  claimDailyReward,
  getTopPlayers,
  getMyCard,
  isHaveLoginAccount,
  banPlayer,
  unbanPlayer,
  isPlayerBanned,
  login,
  registerAccount,
  logout,
  connection,
} from "../../database/index.js";
import { getPlayerBalance, updatePlayerBalance, getPlayerInfo, getAccountVND, updateAccountVND } from "../../database/player.js";
import { sendMessageFromSQL } from "../chat-zalo/chat-style/chat-style.js";
import * as cv from "../../utils/canvas/index.js";
import { isAdmin } from "../../index.js";
import { getGlobalPrefix } from "../service.js";
import { formatBigNumber, formatCurrency, parseGameAmount, removeMention } from "../../utils/format-util.js";
import { sendReactionConfirmReceive } from "../../commands/command.js";

// --- IMPORT MỚI ĐỂ VẼ ẢNH ---
import { createCanvas, loadImage } from "canvas";
import fs from "fs/promises";
import path from "path";
import { getUserInfoData } from "../info-service/user-info.js"; 


export async function checkBeforeJoinGame(api, message, groupSettings, checkLogin = false) {

  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const isAdminBot = isAdmin(senderId, threadId);

  if (!connection) {
    if (isAdminBot) {
      const text =
        "Cơ sở dữ liệu chưa được khởi động,\n" +
        "vui lòng kết nối với cơ sở dữ liệu và khởi động lại bot rồi thử lại!";
      const result = {
        success: false,
        message: text,
      };
      await sendMessageFromSQL(api, message, result, true, 30000);
      return false;
    }
  }

 if (groupSettings) {
    const activeGame = groupSettings[threadId]?.activeGame; // Thêm ?. để tránh lỗi nếu threadId không tồn tại
    const isAdminLevelHighest = isAdmin(senderId);
    if (isAdminLevelHighest) {
      await sendReactionConfirmReceive(api, message, 5);
      return true;
    }
    if (activeGame === false) {
      let text = "";
      if (isAdminBot) {
        const prefix = getGlobalPrefix(threadId); // Lấy prefix
        text =
          "Trò chơi hiện tại Không được bật trong nhóm này.\n\n" +
          `Quản trị viên hãy dùng lệnh ${prefix}gameactive để bật tương tác game cho nhóm!`; // Thay ! bằng prefix
        const result = {
          success: false,
          message: text,
        };
        await sendMessageFromSQL(api, message, result, true, 30000);
      }
      return false;
    }
  }

  if (await checkPlayerBanned(api, message, threadId, senderId)) {
    return false;
  }

  if (checkLogin) {
    if (!(await checkPlayerLogin(api, message, threadId, senderId))) {
      return false;
    }
  }

  await sendReactionConfirmReceive(api, message, 5);
  return true;
}

export async function handleClaimDailyReward(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

  const senderId = message.data.uidFrom;
  const result = await claimDailyReward(senderId);
  await sendMessageFromSQL(api, message, result, true, 30000);
}

// =================================================================
// --- HÀM TOP PLAYERS (ĐÃ SỬA LẠI ĐỂ VẼ CANVAS) ---
// =================================================================
export async function handleTopPlayers(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings))) return;

  const threadId = message.threadId;
  let imagePath = null; // Để xóa file tạm

  try {
    const topPlayersData = await getTopPlayers(); // Lấy data thô từ DB

    if (!topPlayersData || topPlayersData.length === 0) {
      await api.sendMessage({ msg: "Hiện chưa có dữ liệu xếp hạng.", quote: message }, threadId, message.type);
      return;
    }

    // --- Lấy 10 người, không lọc admin ---
    const filteredPlayers = topPlayersData.slice(0, 10);

    // Làm giàu data (thêm avatar, tên zalo) để chuẩn bị vẽ
    const canvasDataList = [];
    const userPromises = filteredPlayers.map(async (player, index) => { // Thêm index vào map
      try {
        // Lấy info Zalo (tên, avatar)
        const info = await getUserInfoData(api, player.idUser); 
        return {
          id: player.idUser,
          name: info.name, // Dùng tên Zalo
          avatar: info.avatar,
          // SỬA ICON Ở ĐÂY: Đổi 💰 thành ⭐
          role: `Số Dư: ${formatCurrency(player.balance)} VNĐ`, // Dòng phụ là số dư
          // THÊM RANK Ở ĐÂY: Để xác định màu viền
          rank: index + 1 
        };
      } catch (e) {
        // Fallback: Dùng tên trong DB, không có avatar
        console.warn(`[TopPlayers] Lỗi lấy info Zalo cho ${player.idUser}, dùng fallback.`);
        return {
          id: player.idUser,
          name: player.playerName, // Dùng tên DB
          avatar: null,
          role: `⭐ ${formatCurrency(player.balance)} VNĐ`,
          rank: index + 1
        };
      }
    });

    const userInfos = await Promise.all(userPromises);
    canvasDataList.push(...userInfos);

    // 3. Vẽ ảnh
    imagePath = await createTopPlayersImage(canvasDataList); // Gọi hàm canvas mới

    // 4. Gửi ảnh
    await api.sendMessage({ msg: "", attachments: [imagePath], ttl: 600000, quote: message }, threadId, message.type);

  } catch (error) {
    console.error(`[handleTopPlayers] Lỗi: ${error.message}`);
    await sendMessageFromSQL(api, message, { success: false, message: "Đã xảy ra lỗi khi tạo bảng xếp hạng." }, true, 30000);
  } finally {
    // 5. Xóa file tạm
    if (imagePath) {
      await cv.clearImagePath(imagePath); // Dùng cv.
    }
  }
}
// =================================================================

export async function handleMyCard(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const result = await getMyCard(api, senderId);
  if (result.success) {
    const playerInfo = result.data;
    playerInfo.title = "Thông Tin Người Chơi";
    // Bỏ msg text đi vì đã có ảnh đẹp rồi
    // let msg = `🎴 Thông tin của bạn 🎴\n\n`;
    // msg += `👤 Tên: ${playerInfo.playerName}\n`;
    // msg += `💰 Số dư: ${formatCurrency(playerInfo.balance)} VNĐ\n`;
    // ... (các dòng khác)

    const imagePath = await cv.createUserCardGame(playerInfo);
    if (imagePath) {
        await api.sendMessage({ msg: "", attachments: [imagePath] , quote: message}, threadId, message.type);
        await cv.clearImagePath(imagePath);
    } else {
         await api.sendMessage({ msg: "Lỗi khi tạo thẻ thông tin người chơi.", quote: message }, threadId, message.type);
    }
  } else {
    await api.sendMessage({ msg: result.message, quote: message }, threadId, message.type);
  }
}

export async function handleBuffCommand(api, message, groupSettings) {
  const senderId = message.data.uidFrom;
  if (!isAdmin(senderId)) {
     await sendMessageFromSQL(api, message, { success: false, message: "Chỉ admin cấp cao mới được dùng lệnh này." }, true, 300000);
    return;
  }

  const mentions = message.data.mentions || [];
  let content = removeMention(message);
  const contentParts = content.split(" ");
  
  // Kiểm tra cú pháp
  if (contentParts.length < 2) {
      await sendMessageFromSQL(api, message, { success: false, message: `Sai cú pháp. Dùng: ${getGlobalPrefix(message.threadId)}buff <Số tiền> [@tag]` }, true, 300000);
      return;
  }

  let buffAmount;
  try {
    const parsedAmount = parseGameAmount(contentParts[1], Number.MAX_SAFE_INTEGER);
    if (parsedAmount === "allin") {
      const result = {
        success: false,
        message: `Không thể sử dụng all/allin cho lệnh buff.`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }
    buffAmount = new Big(parsedAmount);
  } catch (error) {
    const result = {
      success: false,
      message: "Số tiền Không hợp lệ.",
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  if (buffAmount.lte(0)) {
    const result = {
      success: false,
      message: `Số tiền phải lớn hơn 0.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  // Buff cho chính mình nếu không tag ai
  if (!mentions || mentions.length === 0) {
    if (await isHaveLoginAccount(senderId)) {
      const currentBalanceResult = await getPlayerBalance(senderId);
      if (!currentBalanceResult.success) {
          await sendMessageFromSQL(api, message, currentBalanceResult, true, 300000);
          return;
      }
      const oldBalance = new Big(currentBalanceResult.balance);
      await updatePlayerBalance(senderId, buffAmount);
      const newBalance = oldBalance.plus(buffAmount);

      const result = {
        success: true,
        message:
          `🔄 Buff tiền thành công cho chính bạn!\n\n` +
          `💰 Số tiền buff: ${formatBigNumber(buffAmount)} VNĐ\n\n` +
          `📊 Biến động số dư:\n` +
          `- Trước: ${formatBigNumber(oldBalance)} VNĐ\n` +
          `- Sau: ${formatBigNumber(newBalance)} VNĐ`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
    } else {
      const result = {
        success: false,
        message: `Bạn chưa đăng nhập tài khoản để buff cho bản thân!`,
      };
      await sendMessageFromSQL(api, message, result, true, 300000);
    }
    return;
  }

  // Buff cho người được tag
  let successMessages = [];
  let failureMessages = [];

  for (const mention of mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");

    if (await isHaveLoginAccount(targetId)) {
      const currentBalanceResult = await getPlayerBalance(targetId);
       if (!currentBalanceResult.success) {
           failureMessages.push(`❌ ${targetName}: Lỗi lấy số dư.`);
           continue; // Bỏ qua người này
       }
      const oldBalance = new Big(currentBalanceResult.balance);
      await updatePlayerBalance(targetId, buffAmount);
      const newBalance = oldBalance.plus(buffAmount);

      successMessages.push(
        `✅ ${targetName}:\n` +
        `- Buff: +${formatBigNumber(buffAmount)} VNĐ\n` +
        `- Trước: ${formatBigNumber(oldBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newBalance)} VNĐ`
      );
    } else {
      failureMessages.push(`❌ ${targetName}: chưa đăng ký tài khoản.`);
    }
  }

  let finalMessage = `🔄 Kết quả buff tiền:\n`;
  if (successMessages.length > 0) {
    finalMessage += "\n✅ Thành công:\n" + successMessages.join("\n\n") + "\n";
  }
  if (failureMessages.length > 0) {
    finalMessage += "\n❌ Thất bại:\n" + failureMessages.join("\n");
  }

  const result = {
    success: true, // Vẫn là success ngay cả khi có lỗi phụ
    message: finalMessage.trim(),
  };
  await sendMessageFromSQL(api, message, result, false, 300000); // false để không quote tin nhắn gốc
}

// Hàm kiểm tra người chơi có active không (cần implement)
async function isPlayerActive(playerId) {
  // Logic kiểm tra xem người chơi có đang hoạt động hay không
  // Ví dụ: Kiểm tra trạng thái trong DB hoặc một biến cờ nào đó
  // Hiện tại trả về true để cho phép chuyển tiền
  return true; 
}


export async function handleBankCommand(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

  const senderId = message.data.uidFrom;
  // Bỏ check active vì hàm isPlayerActive chưa implement
  // if (!(await isPlayerActive(senderId))) {
  //    const result = {
  //      success: false,
  //      message: `Bạn cần mở thành viên để có thể chuyển tiền cho người khác.`,
  //    };
  //    await sendMessageFromSQL(api, message, result);
  //    return;
  //  }

  const mentions = message.data.mentions;
  
  // Kiểm tra cú pháp và @tag
   if (!mentions || mentions.length === 0) {
     const result = {
       success: false,
       message: `Sai cú pháp hoặc thiếu @tag.\nDùng: ${getGlobalPrefix(message.threadId)}bank <Số tiền> @tag`,
     };
     await sendMessageFromSQL(api, message, result, true, 300000);
     return;
   }
  
   const targetId = mentions[0].uid; // Chỉ xử lý người đầu tiên được tag
   const targetName = message.data.content.substring(mentions[0].pos, mentions[0].pos + mentions[0].len).replace("@", "");
   
   if (targetId === senderId) {
      const result = { success: false, message: "Bạn không thể tự chuyển tiền cho chính mình." };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
   }

  // Lấy số dư người gửi trước
  const requestData = await getPlayerBalance(senderId);
  if (!requestData.success) {
    await sendMessageFromSQL(api, message, requestData, true, 300000);
    return;
  }
  const senderBalance = new Big(requestData.balance);

  // Parse số tiền
  let content = removeMention(message);
  const parts = content.split(" ");
  if (parts.length < 2) { // Kiểm tra lại cú pháp sau khi remove mention
       const result = { success: false, message: `Sai cú pháp. Dùng: ${getGlobalPrefix(message.threadId)}bank <Số tiền> @tag` };
       await sendMessageFromSQL(api, message, result, true, 300000);
       return;
   }
  const amountStr = parts[1]; // Số tiền là phần tử thứ 2
  
  let bankAmount;
  try {
    const parsedAmount = parseGameAmount(amountStr, senderBalance); // Truyền senderBalance vào
    if (parsedAmount === "allin") {
      bankAmount = senderBalance;
    } else {
      bankAmount = new Big(parsedAmount); // Đảm bảo là Big number
    }

    if (bankAmount.lt(1000)) {
      const result = { success: false, message: `Số tiền chuyển tối thiểu là 1,000 VNĐ` };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }
  } catch (error) {
    const result = { success: false, message: error.message }; // Thông báo lỗi parse
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  // Kiểm tra số dư
  if (senderBalance.lt(bankAmount)) {
    const result = { success: false, message: `Số dư Không đủ. Bạn chỉ có ${formatBigNumber(senderBalance)} VNĐ.` };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  // Kiểm tra người nhận có bị ban không
  if (await isPlayerBanned(targetId)) {
    const result = { success: false, message: `${targetName} đã bị khóa tài khoản, Không thể chuyển tiền.` };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  // Kiểm tra người nhận có tài khoản không
  if (await isHaveLoginAccount(targetId)) {
    const receiverData = await getPlayerBalance(targetId);
     if (!receiverData.success) {
         await sendMessageFromSQL(api, message, { success: false, message: `Lỗi khi lấy số dư của ${targetName}.` }, true, 300000);
         return;
     }
    const receiverBalance = new Big(receiverData.balance);

    // Thực hiện chuyển tiền (dùng .neg() để trừ)
    await updatePlayerBalance(senderId, bankAmount.neg()); 
    await updatePlayerBalance(targetId, bankAmount);

    // Tính toán số dư mới
    const newSenderBalance = senderBalance.minus(bankAmount);
    const newReceiverBalance = receiverBalance.plus(bankAmount);

    const result = {
      success: true,
      message:
        `🔄 Giao dịch chuyển tiền thành công!\n\n` +
        `💰 Số tiền chuyển: ${formatBigNumber(bankAmount)} VNĐ\n\n` + // Dùng bankAmount đã parse
        `📊 Biến động số dư:\n` +
        `👤 Người gửi:\n` +
        `- Trước: ${formatBigNumber(senderBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newSenderBalance)} VNĐ\n\n` +
        `👥 Người nhận (${targetName}):\n` +
        `- Trước: ${formatBigNumber(receiverBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newReceiverBalance)} VNĐ`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
  } else {
    const result = { success: false, message: `${targetName} chưa đăng ký/đăng nhập tài khoản.` };
    await sendMessageFromSQL(api, message, result, true, 300000);
  }
}

export async function handleBanCommand(api, message, groupSettings) {
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;

  // Chỉ Admin cấp cao mới được ban
  if (!isAdmin(senderId)) { 
    const result = { success: false, message: `Chỉ admin cấp cao mới có quyền ban.` };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const mentions = message.data.mentions;
  if (!mentions || mentions.length === 0) {
    const result = { success: false, message: `Vui lòng đề cập (@mention) người dùng cần ban.` };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }
  
  let banResults = [];

  for (const mention of mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");

    // Không thể ban admin (kể cả admin nhóm)
    if (isAdmin(targetId, threadId)) { 
      banResults.push(`❌ ${targetName}: là quản trị viên, không thể ban.`);
      continue; // Bỏ qua admin
    }

    if (await isHaveLoginAccount(targetId)) {
      if (await isPlayerBanned(targetId)) {
         banResults.push(`ℹ️ ${targetName}: đã bị khóa từ trước.`);
      } else {
        await banPlayer(targetId);
        banResults.push(`✅ ${targetName}: đã bị khóa tài khoản.`);
      }
    } else {
      banResults.push(`❓ ${targetName}: chưa đăng ký/đăng nhập tài khoản.`);
    }
  }
  
  // Gửi thông báo tổng hợp
   const finalMessage = `🔒 Kết quả khóa tài khoản:\n` + banResults.join("\n");
   await sendMessageFromSQL(api, message, { success: true, message: finalMessage }, false, 300000);
}

export async function handleUnbanCommand(api, message, groupSettings) {
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;

  // Chỉ Admin cấp cao mới được unban
  if (!isAdmin(senderId)) {
    const result = { success: false, message: `Chỉ admin cấp cao mới có quyền unban.` };
    await sendMessageFromSQL(api, message, result);
    return;
  }

  const mentions = message.data.mentions;
  if (!mentions || mentions.length === 0) {
    const result = { success: false, message: `Vui lòng đề cập (@mention) người dùng cần mở khóa.` };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }
  
  let unbanResults = [];

  for (const mention of mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");

    if (await isHaveLoginAccount(targetId)) {
      if (await isPlayerBanned(targetId)) {
        await unbanPlayer(targetId);
         unbanResults.push(`✅ ${targetName}: đã được mở khóa.`);
      } else {
         unbanResults.push(`ℹ️ ${targetName}: không bị khóa.`);
      }
    } else {
      unbanResults.push(`❓ ${targetName}: chưa đăng ký/đăng nhập tài khoản.`);
    }
  }
   // Gửi thông báo tổng hợp
   const finalMessage = `🔓 Kết quả mở khóa tài khoản:\n` + unbanResults.join("\n");
   await sendMessageFromSQL(api, message, { success: true, message: finalMessage }, false, 300000);
}

export async function checkPlayerBanned(api, message, threadId, senderId) {
  if (await isPlayerBanned(senderId)) {
    const result = {
      success: false,
      message: `Tài khoản của bạn đã bị khóa, Không thể thực hiện bất kỳ lệnh game nào nữa!`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return true;
  }
  return false;
}

export async function checkPlayerLogin(api, message, threadId, senderId) {
  if (!(await isHaveLoginAccount(senderId))) {
    const prefix = getGlobalPrefix(threadId);
    const result = {
      success: false,
      message: `Bạn chưa đăng nhập tài khoản game trên zalo này, vui lòng sử dụng lệnh ${prefix}game để xem hướng dẫn.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return false;
  }
  return true;
}

export async function handleLoginPlayer(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings))) return;

  if (message.type === MessageType.GroupMessage) {
    await api.deleteMessage(message, false).catch(console.error);
    const result = {
      success: false,
      message: `Vì lý do bảo mật, bạn Không thể đăng nhập tài khoản trong nhóm!\nVui lòng nhắn riêng cho tôi để đăng nhập tài khoản.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const senderName = message.data.dName;
  const senderId = message.data.uidFrom;

  if (await isHaveLoginAccount(senderId)) {
    const result = {
      success: false,
      message: `Bạn đã đăng nhập tài khoản game trên zalo này!.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const content = removeMention(message);
  const parts = content.split(" ");
  const prefix = getGlobalPrefix(message.threadId); // Lấy prefix

  if (parts.length !== 3) {
    const result = {
      success: false,
      message: `Vui lòng sử dụng lệnh đúng cú pháp:\n${prefix}login [tên đăng nhập] [mật khẩu].`, // Thay ! bằng prefix
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const username = parts[1];
  const password = parts[2];
  const result = await login(username, password, senderId, senderName, api);

  await sendMessageFromSQL(api, message, result, true, 300000);
}

export async function handleRegisterPlayer(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings))) return;
  const senderId = message.data.uidFrom;

  const content = removeMention(message);
  const parts = content.split(" ");
  const senderName = message.data.dName;

  if (await isHaveLoginAccount(senderId)) {
    const result = {
      success: false,
      message: `Bạn đã đăng nhập tài khoản game trên zalo này, Không thể đăng ký tài khoản mới.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  if (message.type === MessageType.GroupMessage) {
    await api.deleteMessage(message, false).catch(console.error);
    const result = {
      success: false,
      message: `Vì lý do bảo mật, bạn Không thể đăng ký tài khoản trong nhóm!\nVui lòng nhắn riêng cho tôi để đăng ký tài khoản.`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const prefix = getGlobalPrefix(message.threadId); // Lấy prefix

  if (parts.length !== 3) {
    const result = {
      success: false,
      message: `Vui lòng sử dụng lệnh đúng cú pháp:\n${prefix}dangky [tên đăng ký] [mật khẩu].`, // Thay ! bằng prefix
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
    return;
  }

  const username = parts[1];
  const password = parts[2];

  let result = await registerAccount(username, password);

  await sendMessageFromSQL(api, message, result, true, 300000);

  if (result.success) {
    result = await login(username, password, senderId, senderName, api);
    await sendMessageFromSQL(api, message, result, true, 300000);
  }
}

export async function handleLogoutPlayer(api, message, groupSettings) {
  if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;
  const senderId = message.data.uidFrom;
  const result = await logout(senderId);
  await sendMessageFromSQL(api, message, result, true, 300000);
}

// Hàm xử lý lệnh nạp tiền
export async function handleNapCommand(api, message, groupSettings) {
  try {
    if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

    const senderId = message.data.uidFrom;
    const content = removeMention(message);
    const parts = content.split(" ");
    const prefix = getGlobalPrefix(message.threadId); // Lấy prefix

    if (parts.length !== 2) {
      const result = {
        success: false,
        message: `Vui lòng sử dụng lệnh đúng cú pháp:\n${prefix}nap <Số Tiền>`,
      };
      await sendMessageFromSQL(api, message, result, true, 30000);
      return;
    }

    // Lấy thông tin người chơi từ bảng player_zalo
    const playerInfo = await getPlayerInfo(senderId);
    if (!playerInfo) {
      const result = { success: false, message: `Không tìm thấy thông tin tài khoản.` };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    // Lấy số dư VND từ bảng account
    const accountVND = await getAccountVND(playerInfo.username);
    if (accountVND === null) {
      const result = { success: false, message: `Không thể lấy số dư VND từ tài khoản game ${playerInfo.username}.` };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    const accountBalance = new Big(accountVND);

    // Parse số tiền
    let napAmount;
    try {
      const parsedAmount = parseGameAmount(parts[1], accountBalance);
      if (parsedAmount === "allin") {
        napAmount = accountBalance;
      } else {
        napAmount = new Big(parsedAmount); // Đảm bảo là Big number
      }

      if (napAmount.lt(20000)) {
        const result = { success: false, message: `Số tiền nạp tối thiểu là 20,000 VNĐ.` };
        await sendMessageFromSQL(api, message, result, true, 300000);
        return;
      }
    } catch (error) {
      const result = { success: false, message: error.message };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    if (accountBalance.lt(napAmount)) {
      const result = { success: false, message: `Số dư VND trong tài khoản ${playerInfo.username} chỉ có ${formatBigNumber(accountBalance)} VNĐ.` };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    const oldAccountBalance = accountBalance;
    const oldBotBalance = new Big(playerInfo.balance);

    // Cập nhật số dư trong game
    await updatePlayerBalance(senderId, napAmount); // Truyền Big number
    // Cập nhật số dư VND trong account
    await updateAccountVND(playerInfo.username, napAmount.neg()); // Truyền Big number

    const newAccountBalance = oldAccountBalance.minus(napAmount);
    const newBotBalance = oldBotBalance.plus(napAmount); // Cộng Big number

    const result = {
      success: true,
      message:
        `🔄 Giao dịch nạp tiền thành công!\n\n` +
        `💰 Số tiền nạp: ${formatBigNumber(napAmount)} VNĐ\n\n` +
        `📊 Biến động số dư:\n` +
        `🎮 Tài khoản ${playerInfo.username}:\n` +
        `- Trước: ${formatBigNumber(oldAccountBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newAccountBalance)} VNĐ\n\n` +
        `🤖 Tài khoản Bot Zalo:\n` +
        `- Trước: ${formatBigNumber(oldBotBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newBotBalance)} VNĐ`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh nạp:", error);
    const result = { success: false, message: `Đã xảy ra lỗi khi xử lý lệnh nạp!` };
    await sendMessageFromSQL(api, message, result, true, 300000);
  }
}

// Hàm xử lý lệnh rút tiền
export async function handleRutCommand(api, message, groupSettings) {
  try {
    if (!(await checkBeforeJoinGame(api, message, groupSettings, true))) return;

    const senderId = message.data.uidFrom;
    const content = removeMention(message);
    const parts = content.split(" ");
    const prefix = getGlobalPrefix(message.threadId); // Lấy prefix

    if (parts.length !== 2) {
      const result = { success: false, message: `Vui lòng sử dụng lệnh đúng cú pháp:\n${prefix}rut <Số Tiền>` };
      await sendMessageFromSQL(api, message, result, true, 30000);
      return;
    }

    // Lấy thông tin người chơi từ bảng player_zalo trước
    const playerInfo = await getPlayerInfo(senderId);
    if (!playerInfo) {
      const result = { success: false, message: `Không tìm thấy thông tin tài khoản.` };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    // Lấy số dư hiện tại
    const currentBotBalance = new Big(playerInfo.balance);
    const accountVND = await getAccountVND(playerInfo.username);
     if (accountVND === null) {
       const result = { success: false, message: `Không thể lấy số dư VND từ tài khoản game ${playerInfo.username}.` };
       await sendMessageFromSQL(api, message, result, true, 300000);
       return;
     }
    const currentAccountBalance = new Big(accountVND);

    // Parse số tiền
    let rutAmount;
    try {
      const parsedAmount = parseGameAmount(parts[1], currentBotBalance);
      if (parsedAmount === "allin") {
        rutAmount = currentBotBalance;
      } else {
        rutAmount = new Big(parsedAmount); // Đảm bảo là Big number
      }

      if (rutAmount.lt(20000)) {
        const result = { success: false, message: `Số tiền rút tối thiểu là 20,000 VNĐ.` };
        await sendMessageFromSQL(api, message, result, true, 300000);
        return;
      }
    } catch (error) {
      const result = { success: false, message: error.message };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    // Kiểm tra số dư
    if (currentBotBalance.lt(rutAmount)) {
      const result = { success: false, message: `Số dư bot không đủ (${formatBigNumber(currentBotBalance)} VNĐ) để rút ${formatBigNumber(rutAmount)} VNĐ về tài khoản ${playerInfo.username}!` };
      await sendMessageFromSQL(api, message, result, true, 300000);
      return;
    }

    // Cập nhật số dư trong game
    await updatePlayerBalance(senderId, rutAmount.neg()); // Truyền Big number
    // Cập nhật số dư VND trong account
    await updateAccountVND(playerInfo.username, rutAmount); // Truyền Big number

    const newBotBalance = currentBotBalance.minus(rutAmount);
    const newAccountBalance = currentAccountBalance.plus(rutAmount);

    const result = {
      success: true,
      message:
        `🔄 Giao dịch rút tiền thành công!\n\n` +
        `💰 Số tiền rút: ${formatBigNumber(rutAmount)} VNĐ\n\n` +
        `📊 Biến động số dư:\n` +
        `🤖 Tài khoản Bot Zalo:\n` +
        `- Trước: ${formatBigNumber(currentBotBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newBotBalance)} VNĐ\n\n` +
        `🎮 Tài khoản ${playerInfo.username}:\n` +
        `- Trước: ${formatBigNumber(currentAccountBalance)} VNĐ\n` +
        `- Sau: ${formatBigNumber(newAccountBalance)} VNĐ`,
    };
    await sendMessageFromSQL(api, message, result, true, 300000);
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh rút:", error);
    const result = { success: false, message: `Đã xảy ra lỗi khi xử lý lệnh rút!` };
    await sendMessageFromSQL(api, message, result, true, 300000);
  }
}

// =================================================================
// --- HÀM VẼ CANVAS MỚI (CHO TOP PLAYERS - ĐÃ SỬA ICON VÀ VIỀN) ---
// =================================================================
/**
 * Hàm vẽ ảnh danh sách Top Players
 * @param {Array} players - Danh sách người chơi (đã có rank)
 */
async function createTopPlayersImage(players) {
  const limitedPlayers = players; 

  const width = 660;
  const itemHeight = 100;
  const headerHeight = 100;
  const height = headerHeight + limitedPlayers.length * itemHeight + 20;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#004e92");
  gradient.addColorStop(1, "#000428");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // --- Tiêu đề (Đã đổi icon) ---
  ctx.font = "bold 36px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("👑 Top 10 Người Chơi Giàu Nhất 👑", width / 2, headerHeight / 2);

  // Tải avatar (song song)
  const avatars = await Promise.all(
    limitedPlayers.map(async (user) => {
      try {
        return user.avatar ? await loadImage(user.avatar) : null;
      } catch {
        return null;
      }
    })
  );

  const moveRight = 30;

  // Vẽ từng người chơi
  limitedPlayers.forEach((user, index) => {
    const yPos = headerHeight + index * itemHeight + 10;
    const centerY = yPos + (itemHeight - 10) / 2;

    // Khung item
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(10, yPos, width - 20, itemHeight - 10, 10);
    ctx.fill();

    // Kích thước và vị trí avatar
    const avatarSize = 70;
    const avatarX = 20 + moveRight;
    const avatarY = centerY - avatarSize / 2;
    const cornerRadius = 10;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.clip();

    // Vẽ avatar (hoặc ô xám nếu null)
    if (avatars[index]) {
      ctx.drawImage(avatars[index], avatarX, avatarY, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = "#555";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }

    // Vẽ STT (Rank)
    const numberSize = 20;
    const numberX = avatarX + avatarSize - numberSize;
    const numberY = avatarY + avatarSize - numberSize;

    // --- SỬA Ở ĐÂY: Nền STT theo rank ---
    ctx.fillStyle = user.rank <= 3 ? "#FFD700" : "#C0C0C0"; // Vàng hoặc Bạc
    ctx.beginPath();
    ctx.roundRect(numberX, numberY, numberSize, numberSize, [cornerRadius, 0, cornerRadius, 0]);
    ctx.fill();

    // Chữ số (Rank)
    ctx.fillStyle = "#000000"; // Chữ đen
    ctx.font = "bold 12px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${user.rank}`, numberX + numberSize / 2, numberY + numberSize / 2 + 1); // Dùng user.rank
    
    ctx.restore();

    // --- SỬA Ở ĐÂY: Vẽ viền theo rank ---
    ctx.strokeStyle = user.rank <= 3 ? "#FFD700" : "#C0C0C0"; // Vàng hoặc Bạc
    ctx.lineWidth = user.rank <= 3 ? 4 : 3; // Viền vàng dày hơn
    ctx.beginPath();
    ctx.roundRect(avatarX, avatarY, avatarSize, avatarSize, cornerRadius);
    ctx.stroke();

    // --- TEXT ---
    const textX = avatarX + avatarSize + 20;

    // Tên
    ctx.font = "bold 26px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(user.name, textX, centerY - 15);

    // --- SỬA Ở ĐÂY: Dòng phụ (Số dư) màu theo rank ---
    ctx.font = "18px 'BeVietnamPro', 'Segoe UI', Tahoma, Arial"; // Font nhỏ
    ctx.fillStyle = user.rank <= 3 ? "#FFD700" : "#cccccc"; // Vàng hoặc Xám nhạt
    
    // Dùng user.role (đã gán chuỗi số dư vào đây)
    ctx.fillText(user.role, textX, centerY + 20); 
  });

  // Lưu file
  await fs.mkdir(path.resolve("./assets/temp"), { recursive: true });
  const filePath = path.resolve(`./assets/temp/top_players_${Date.now()}.png`);
  await fs.writeFile(filePath, canvas.toBuffer("image/png"));
  return filePath;
}
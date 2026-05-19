import schedule from "node-schedule";
import {
  sendMessageCompleteRequest,
  sendMessageFromSQL,
  sendMessageResultRequest,
  sendMessageWarningRequest,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import {
  getDataAllGroup,
  getGroupAdmins,
  getGroupInfoData,
} from "../../Nqduan-service/info-service/group-info.js";
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";
import { removeMention } from "../../utils/format-util.js";
import { handleCommand } from "../command.js";
import { getBotId } from "../../index.js";
import { MessageType } from "../../api-zalo/index.js";

const requestJoinGroupMap = new Map();
const waitingActionGroupMap = new Map();
const waitingActionJoinGroup = 30000;
const timeOutWaitingActionGroup = 600000;

schedule.scheduleJob("*/5 * * * * *", () => {
  const currentTime = Date.now();
  for (const [msgId, data] of requestJoinGroupMap.entries()) {
    if (currentTime - data.timestamp > waitingActionJoinGroup) {
      requestJoinGroupMap.delete(msgId);
    }
  }
  for (const [msgId, data] of waitingActionGroupMap.entries()) {
    if (currentTime - data.timestamp > timeOutWaitingActionGroup) {
      waitingActionGroupMap.delete(msgId);
    }
  }
});

export async function handleJoinGroup(api, message) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);

  const commandParts = content.split(" ");
  const linkJoin = commandParts[1];

  if (!linkJoin) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Cú pháp tham gia nhóm thông qua link:\n${prefix}${aliasCommand} [link]`,
      },
      false,
      30000,
    );
    return;
  }

  let groupInfo = null;
  try {
    groupInfo = await api.getGroupInfoByLink(linkJoin);
  } catch (error) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `Link này đếch tồn tại nhóm/cộng đồng nào!`,
      },
      true,
      30000,
    );
    return;
  }

  if (!groupInfo) return;

  const typeGroup = groupInfo.type === 2 ? "Cộng đồng" : "Nhóm";

  const msgResponse = await sendMessageCompleteRequest(
    api,
    message,
    {
      caption:
        `Tên ${typeGroup}: ${groupInfo.name}\nMô tả: ${
          groupInfo.desc || "Không có mô tả"
        }\nTổng số thành viên: ${groupInfo.totalMember}` +
        `\n\nXác nhận tham gia ${typeGroup} bằng cách thả reaction like hoặc heart!`,
    },
    waitingActionJoinGroup,
  );

  const msgId = msgResponse.message.msgId.toString();

  requestJoinGroupMap.set(msgId, {
    message,
    timestamp: Date.now(),
    groupInfo,
    linkJoin,
  });
}

export async function handleReactionConfirmJoinGroup(api, reaction) {
  const msgId = reaction.data.content.rMsg[0].gMsgID.toString();
  const data = requestJoinGroupMap.get(msgId);
  if (!data) return false;
  const senderId = reaction.data.uidFrom;
  if (senderId !== data.message.data.uidFrom) return false;

  const rType = reaction.data.content.rType;
  if (rType !== 3 && rType !== 5) return false;

  const message = data.message;
  requestJoinGroupMap.delete(msgId);
  // const msgUndo = {
  //   data: {
  //     quote: {
  //       cliMsgId: reaction.data.content.rMsg[0].cMsgID,
  //       globalMsgId: reaction.data.content.rMsg[0].gMsgID,
  //     },
  //   },
  //   type: message.type,
  //   threadId: reaction.data.idTo,
  // };
  // await api.undoMessage(msgUndo);

  try {
    await api.joinGroup(data.linkJoin);
    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: `Bố đã tham gia vào nhóm thành công!`,
      },
      true,
      180000,
    );
  } catch (error) {
    if (error.message.includes("Waiting for approve")) {
      await sendMessageWarningRequest(
        api,
        message,
        {
          caption: `Bố đã gửi yêu cầu tham gia nhóm này và đang chờ chủ nhóm phê duyệt!`,
        },
        180000,
      );
    }
    if (error.message.includes("đã là thành viên")) {
      await sendMessageWarningRequest(
        api,
        message,
        {
          caption: `Bố đã là thành viên của nhóm này!`,
        },
        180000,
      );
    }
    if (error.message.includes("chặn tham gia nhóm")) {
      await sendMessageWarningRequest(
        api,
        message,
        {
          caption: `Bố đã bị chặn tham gia nhóm này!`,
        },
        180000,
      );
    }
  }
  return true;
}

export async function handleLeaveGroup(api, message) {
  const idBot = getBotId();
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  await sendMessageResultRequest(
    api,
    MessageType.GroupMessage,
    threadId,
    "Bye mọi người\nMình đi đây !",
    true,
    60000,
  );
  await api.leaveGroup(threadId);
}

// --- HÀM ĐÃ SỬA ĐỔI ---
export async function handleShowGroupsList(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);

  const command = content.replace(`${prefix}${aliasCommand}`, "").trim();
  try {
    const groups = await getDataAllGroup(api);
    let filteredGroups;
    if (!command) {
      filteredGroups = groups;
    } else {
      filteredGroups = groups.filter((group) =>
        group.name.toUpperCase().includes(command.toUpperCase()),
      );
    }
    if (!filteredGroups.length) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Đếch tìm thấy nhóm nào có tên chứa "${command}"!`,
        },
        false,
        30000,
      );
      return;
    }

    const CHUNK_SIZE = 30;
    const chunks = [];

    for (let i = 0; i < filteredGroups.length; i += CHUNK_SIZE) {
      const chunk = filteredGroups.slice(i, i + CHUNK_SIZE);
      chunks.push(chunk);
    }

    for (const [chunkIndex, groupChunk] of chunks.entries()) {
      let contentMessage =
        chunkIndex === 0 ? `Danh sách nhóm:\n\n` : `(Tiếp theo)\n\n`;

      for (const [index, group] of groupChunk.entries()) {
        const owner = await getUserInfoData(api, group.creatorId);
        const actualIndex = chunkIndex * CHUNK_SIZE + index + 1;

        // --- THAY ĐỔI LOGIC Ở ĐÂY ---
        const isCommunity = group.groupType === 2;
        const leaderRole = isCommunity ? "Trưởng cộng đồng" : "Trưởng nhóm";

        contentMessage +=
          `${actualIndex}. ${group.name} (${group.totalMember} thành viên)\n` +
          ` - ${leaderRole}: ${owner.name}\n` +
          ` - ID: ${group.groupId}\n\n`; // <-- Đã thêm ID
        // --- KẾT THÚC THAY ĐỔI ---
      }

      if (chunkIndex === chunks.length - 1) {
        contentMessage += `Reply tin nhắn này với số index và "->" + cú pháp liên quan đến hành động mà Đại Ca muốn tôi thực hiện cho danh sách bên trên!`;
      }

      const msgResponse = await sendMessageCompleteRequest(
        api,
        message,
        {
          caption: contentMessage,
        },
        timeOutWaitingActionGroup,
      );

      if (chunkIndex === chunks.length - 1) {
        const msgId = msgResponse.message.msgId.toString();
        waitingActionGroupMap.set(msgId, {
          message,
          timestamp: Date.now(),
          groups: filteredGroups,
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
}
// --- KẾT THÚC HÀM SỬA ĐỔI ---

export async function handleActionGroupReply(
  api,
  message,
  groupInfo,
  groupAdmins,
  groupSettings,
  isAdminLevelHighest,
  isAdminBot,
  isAdminBox,
  handleChat,
) {
  const senderName = message.data.dName;
  const prefix = getGlobalPrefix();
  const senderId = message.data.uidFrom;
  let content = removeMention(message);
  try {
    if (!message.data.quote || !message.data.quote.globalMsgId || !content)
      return false;

    const quotedMsgId = message.data.quote.globalMsgId.toString();
    if (!waitingActionGroupMap.has(quotedMsgId)) return false;
    const dataReply = waitingActionGroupMap.get(quotedMsgId);
    if (dataReply.message.data.uidFrom !== senderId) return false;

    const commandParts = content.split("->");
    if (commandParts.length !== 2) return false;
    const index = parseInt(commandParts[0]);
    if (isNaN(index)) {
      const object = {
        caption: `Lựa chọn Không hợp lệ. Vui lòng chọn một số từ danh sách.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }
    const action = commandParts[1];
    if (action && !action.startsWith(prefix)) {
      return false;
    }

    if (index < 1 || index > dataReply.groups.length) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Số index Không hợp lệ!`,
        },
        false,
        30000,
      );
      return false;
    }
    if (!action) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: `Vui lòng nhập hành động cần thực hiện!`,
        },
        false,
        30000,
      );
      return false;
    }
    const group = dataReply.groups[index - 1];
    switch (action) {
      default:
        const idHere = message.threadId;
        message.threadId = group.groupId;
        message.data.content = action;
        message.data.mentions = [];
        const numHandleCommand = await handleCommand(
          api,
          message,
          groupInfo,
          groupAdmins,
          groupSettings,
          isAdminLevelHighest,
          isAdminBot,
          isAdminBox,
          handleChat,
        );
        message.threadId = idHere;
        if (
          numHandleCommand === 1 ||
          numHandleCommand === 2 ||
          numHandleCommand === 3 ||
          numHandleCommand === 5
        ) {
          const result = {
            success: true,
            message: `Đã thực hiện hành động "${action}" trong nhóm "${group.name}"!`,
          };
          await sendMessageFromSQL(api, message, result, true, 60000);
        }
        break;
    }
    return true;
  } catch (error) {
    console.error(error);
  }
}

export async function handleLeaveLockedGroups(api, message) {
  const threadId = message.threadId;
  const isContentString = typeof message.data.content === "string";
  if (!isContentString) return;

  // 1. Lấy UID của chính tài khoản BOT
  const botId = getBotId();

  await sendMessageResultRequest(
    api,
    MessageType.GroupMessage,
    threadId,
    "🔍 Đang quét các box...",
    true,
    10000,
  );

  try {
    const groups = await getDataAllGroup(api);
    let leftCount = 0;

    for (const group of groups) {
      try {
        const groupInfo = await getGroupInfoData(api, group.groupId);
        // ⚠️ Tạm thời check cả 2 cách
        const isLocked =
          groupInfo.lockSendMsg === 1 || groupInfo?.setting?.lockSendMsg === 1;

        if (isLocked) {
          // --- LOGIC MỚI ĐÚNG ---

          // 2. Lấy danh sách admin của nhóm bị khóa
          //    Hàm này đã bao gồm cả creatorId
          const groupAdmins = await getGroupAdmins(groupInfo);

          // 3. Kiểm tra xem chính BOT có phải là admin không
          const isBotAdmin = groupAdmins.includes(botId);

          // 4. Nếu BOT LÀ admin, bỏ qua không rời
          if (isBotAdmin) {
            console.log(
              `[LeaveLocked] Bỏ qua nhóm "${group.name}" vì bot (${botId}) là admin.`,
            );
            continue; // Chuyển sang nhóm tiếp theo
          }

          // 5. Nếu BOT KHÔNG PHẢI admin, mới thực hiện rời nhóm
          // --- KẾT THÚC LOGIC MỚI ---

          await api.leaveGroup(group.groupId);
          leftCount++;
        }
      } catch (err) {
        console.error(`❌ Lỗi khi xử lý group ${group.groupId}:`, err.message);
      }
    }

    // Sửa lại tin nhắn phản hồi cho đúng ngữ cảnh
    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message:
          leftCount > 0
            ? `✅ Đã rời ${leftCount} box bị khóa chat (đã bỏ qua các box mà bot là admin).`
            : `⚡ Không tìm thấy box nào bị khóa chat hoặc tất cả box khóa bot đều là admin.`,
      },
      true,
      180000,
    );
  } catch (error) {
    console.error("❌ Error leaving locked groups:", error);
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message: `❌ Lỗi khi quét box: ${error.message}`,
      },
      false,
      180000,
    );
  }
}

export async function handleLeaveAllBoxCommand(api, message) {
  // Lấy ID của box gọi lệnh để bỏ qua
  const commandBoxId = message.threadId;

  try {
    // 1. Gửi tin nhắn thông báo bắt đầu (chỉ vào box gọi lệnh)
    await safeSend(
      api,
      commandBoxId,
      "🚀 Đang rời tất cả box...\n[Bỏ qua box gọi lệnh]",
    );

    const groups = await getDataAllGroup(api);
    let successCount = 0;

    for (const g of groups) {
      // 2. Kiểm tra và bỏ qua box gọi lệnh
      if (g.groupId === commandBoxId) {
        console.log(`[LeaveAll] Bỏ qua box gọi lệnh: ${g.groupId}`);
        continue;
      }

      try {
        // 3. Rời nhóm (không gửi tin nhắn nào vào group 'g' nữa)
        await api.leaveGroup(g.groupId);
        successCount++;
      } catch (err) {
        // Nếu rời 1 box lỗi, chỉ log ra và tiếp tục
        console.error(`Không thoát được nhóm ${g.groupId}:`, err);
      }
    }

    // 4. Gửi tin nhắn tổng kết (chỉ vào box gọi lệnh)
    await safeSend(
      api,
      commandBoxId,
      `✅ Đã rời thành công ${successCount} box.`,
    );
  } catch (e) {
    // Lỗi nghiêm trọng (ví dụ: không lấy được danh sách nhóm)
    await safeSend(api, commandBoxId, `❌ Lỗi khi xử lý: ${e.message}`);
  }
}
async function safeSend(api, threadId, text) {
  try {
    // Giả sử bạn đã import MessageType và sendMessageResultRequest
    await sendMessageResultRequest(
      api,
      MessageType.GroupMessage,
      threadId,
      text,
      false,
      60000,
    );
  } catch (err) {
    console.error("Lỗi gửi tin nhắn:", err.message);
  }
}

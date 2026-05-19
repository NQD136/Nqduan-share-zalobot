import { GroupEventType, MessageType } from "../api-zalo/models/index.js";
import { getUserInfoData } from "../Nqduan-service/info-service/user-info.js";
import * as cv from "../utils/canvas/index.js";
import { readGroupSettings, writeGroupSettings } from "../utils/io-json.js";
import { getBotId, isAdmin } from "../index.js";
import fs from "fs";
import path from "path";
// ===== DÒNG MỚI: IMPORT HÀM TARGET =====
import { handleTargetOnJoin } from "../commands/bot-manager/target-manage.js"; // (Kiểm tra lại đường dẫn nếu cần)

/* --- SĐT Admin cố định (lấy từ replytag.js) --- */
const ADMIN_PHONE_NUMBER = "+84328743417 "; /* SĐT để tìm và gửi card */

const blockedMembers = new Map();
const BLOCK_CHECK_TIMEOUT = 300;
function getGroupSettingsPath(threadId) {
  return path.join(
    process.cwd(),
    `assets/groups-data/${threadId}settings_groups.json`,
  );
}
function readGroupSpecificSettings(threadId) {
  const filePath = getGroupSettingsPath(threadId);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (error) {
    console.error(`Error reading group settings file for ${threadId}:`, error);
  }
  return {};
}
function writeGroupSpecificSettings(threadId, settings) {
  const filePath = getGroupSettingsPath(threadId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf8");
  } catch (error) {
    console.error(`Error writing group settings file for ${threadId}:`, error);
  }
}

function logSettingsChanges(oldSettings, newSettings, changerId, threadId) {
  const settingNames = {
    blockName: "Chặn thay đổi biệt danh",
    signAdminMsg: "Tin nhắn quản trị",
    addMemberOnly: "Chỉ QTV thêm thành viên",
    setTopicOnly: "Chỉ QTV đặt chủ đề",
    enableMsgHistory: "Lịch sử tin nhắn",
    joinAppr: "Duyệt thành viên",
    lockCreatePost: "Khóa đăng bài",
    lockCreatePoll: "Khóa tạo bình chọn",
    lockSendMsg: "Khóa gửi tin nhắn",
    lockViewMember: "Khóa xem thành viên",
    bannFeature: "Tính năng cấm",
    dirtyMedia: "Phương tiện nhạy cảm",
    banDuration: "Thời gian cấm",
  };

  for (const key in newSettings) {
    if (oldSettings[key] !== newSettings[key]) {
      const changerInfo = `Người thay đổi: ${changerId}`;
      const settingName = settingNames[key] || key;
      const groupInfo = `Nhóm: ${threadId}`;
    }
  }
}

async function sendGroupMessage(api, threadId, imagePath, messageText) {
  const message = messageText ? messageText : "";
  try {
    await api.sendMessage(
      {
        msg: message,
        attachments: imagePath ? [imagePath] : [],
        ttl: 3600000,
      },
      threadId,
      MessageType.GroupMessage,
    );
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn tới group:", error);
  }
}

export async function groupEvents(api, event) {
  const type = event.type;
  const { updateMembers } = event.data;
  const groupName = event.data.groupName;
  const threadId = event.threadId;
  const groupType = event.data.groupType;
  const idAction = event.data.sourceId;
  const groupSetting = event.data.groupSetting;

  // ===== DÒNG MỚI: GỌI HÀM TARGET =====
  // Luôn chạy hàm kiểm tra Target ĐẦU TIÊN khi có người vào
  if (type === GroupEventType.JOIN) {
    await handleTargetOnJoin(api, event);
  }
  // =====================================

  const groupSettings = readGroupSettings();
  const threadSettings = groupSettings[threadId] || {};
  if (
    type === GroupEventType.UPDATE_SETTING &&
    groupSetting &&
    threadSettings.updateGroup
  ) {
    const oldSettings = readGroupSpecificSettings(threadId);

    /* --- SỬA LỖI: Kiểm tra idAction trước khi dùng --- */
    let changerInfo = {};
    let changerName = "Không rõ";
    if (idAction) {
      changerInfo = await getUserInfoData(api, idAction);
      changerName = changerInfo.name || idAction;
    }
    /* --- KẾT THÚC SỬA LỖI --- */

    const isFirstTime = Object.keys(oldSettings).length === 0;

    if (isFirstTime) {
      /* --- SỬA LỖI: Đảm bảo changerInfo có dữ liệu --- */
      const imagePath = await cv.createSettingChangeImage(
        changerInfo, // Sử dụng biến đã được kiểm tra
        groupName,
        null,
        null,
        changerName,
      );

      await sendGroupMessage(api, threadId, imagePath, "");
      await cv.clearImagePath(imagePath);

      writeGroupSpecificSettings(threadId, groupSetting);
    } else {
      for (const key in groupSetting) {
        if (oldSettings[key] !== groupSetting[key]) {
          logSettingsChanges(oldSettings, groupSetting, idAction, threadId);

          /* --- SỬA LỖI: Đảm bảo changerInfo có dữ liệu --- */
          const imagePath = await cv.createSettingChangeImage(
            changerInfo, // Sử dụng biến đã được kiểm tra
            groupName,
            key,
            groupSetting[key],
            changerName,
          );

          await sendGroupMessage(api, threadId, imagePath, "");
          await cv.clearImagePath(imagePath);
        }
      }

      writeGroupSpecificSettings(threadId, groupSetting);
    }
  }

  if (
    type === GroupEventType.ADD_ADMIN &&
    updateMembers?.length > 0 &&
    threadSettings.updateGroup
  ) {
    /* --- SỬA LỖI: Kiểm tra idAction trước khi dùng --- */
    let changerInfo = {};
    let changerName = "Không rõ";
    if (idAction) {
      changerInfo = await getUserInfoData(api, idAction);
      changerName = changerInfo.name || idAction;
    }
    /* --- KẾT THÚC SỬA LỖI --- */

    for (const user of updateMembers) {
      /* --- SỬA LỖI: Kiểm tra user.id trước khi dùng --- */
      if (!user || !user.id) continue; // Bỏ qua nếu user.id bị null
      const userInfo = await getUserInfoData(api, user.id);
      /* --- KẾT THÚC SỬA LỖI --- */
      const imagePath = await cv.createAdminAddedImage(
        userInfo,
        groupName,
        changerName,
      );

      await sendGroupMessage(api, threadId, imagePath, "");
      await cv.clearImagePath(imagePath);
    }
  }

  if (
    type === GroupEventType.REMOVE_ADMIN &&
    updateMembers?.length > 0 &&
    threadSettings.updateGroup
  ) {
    /* --- SỬA LỖI: Kiểm tra idAction trước khi dùng --- */
    let changerInfo = {};
    let changerName = "Không rõ";
    if (idAction) {
      changerInfo = await getUserInfoData(api, idAction);
      changerName = changerInfo.name || idAction;
    }
    /* --- KẾT THÚC SỬA LỖI --- */

    for (const user of updateMembers) {
      /* --- SỬA LỖI: Kiểm tra user.id trước khi dùng --- */
      if (!user || !user.id) continue; // Bỏ qua nếu user.id bị null
      const userInfo = await getUserInfoData(api, user.id);
      /* --- KẾT THÚC SỬA LỖI --- */
      const imagePath = await cv.createAdminRemovedImage(
        userInfo,
        groupName,
        changerName,
      );

      await sendGroupMessage(api, threadId, imagePath, "");
      await cv.clearImagePath(imagePath);
    }
  }

  /* --- SỬA ĐIỀU KIỆN (VỊ TRÍ 1): Thay đổi logic check prWelcomeEnabled --- */
  // Logic này sẽ chạy sau khi hàm Target (ở trên) đã chạy
  if (
    (type === GroupEventType.JOIN &&
      !threadSettings.welcomeGroup &&
      threadSettings.prWelcomeEnabled !== true) ||
    (type === GroupEventType.LEAVE && !threadSettings.byeGroup)
  ) {
    return;
  }

  if (updateMembers) {
    if (updateMembers.length === 1) {
      const user = updateMembers[0];
      const userId = user.id;

      /* --- SỬA LỖI: Kiểm tra userId trước khi dùng (LỖI CHÍNH TRONG ẢNH) --- */
      if (!userId) {
        console.error(
          "[events-group] Lỗi: Không tìm thấy userId trong updateMembers",
        );
        return; // Dừng lại để tránh crash
      }
      const userInfo = await getUserInfoData(api, userId);
      /* --- KẾT THÚC SỬA LỖI --- */

      /* --- SỬA LỖI: Kiểm tra idAction trước khi dùng (LỖI CHÍNH TRONG ẢNH) --- */
      let userActionInfo = {};
      let userActionName = "Không rõ"; // Đặt tên mặc định
      if (idAction) {
        userActionInfo = await getUserInfoData(api, idAction);
        userActionName = userActionInfo.name || idAction; // Lấy tên nếu có
      }
      /* --- KẾT THÚC SỬA LỖI --- */

      const idBot = getBotId();
      const isAdminBot = isAdmin(userId, threadId);

      let imagePath;
      let messageText = "";

      switch (type) {
        case GroupEventType.JOIN_REQUEST:
          console.log(event);
          break;

        case GroupEventType.JOIN:
          if (threadSettings.welcomeGroup) {
            imagePath = await cv.createWelcomeImage(
              userInfo,
              groupName,
              groupType,
              userActionName,
              isAdminBot,
            );
          }

          /* --- BẮT ĐẦU CODE MỚI (ĐÃ SỬA ĐỔI): GỬI CHÀO MỪNG RIÊNG TƯ (1 NGƯỜI) --- */
          /* Kiểm tra cài đặt (chỉ check true/false) */
          if (threadSettings.prWelcomeEnabled === true) {
            /* --- NỘI DUNG CỐ ĐỊNH (ĐÃ ĐỊNH DẠNG LẠI) --- */
            const prTextMessage = `Chào mừng {user} đã đến với nhóm {group}!

/-li CHO THUÊ BOT QUẢN LÝ NHÓM ZALO /-li

🌟 Tính năng nổi bật
✅ Sử dụng tài khoản Zalo bạn cung cấp để thiết lập bot 
✅ Quản lý thành viên: auto chào mừng, lọc từ cấm, chống spam hiệu quả
✅ Giải trí cực vui: nhiều mini game, auto trả lời, tăng tương tác nhóm
✅ Tự động gửi thông báo, rải link tiện lợi

🎯 Lợi ích khi sử dụng bot
🚀 Tiết kiệm tối đa thời gian quản lý nhóm
👥 Tăng tương tác, gắn kết & giữ chân thành viên
🔒 Bảo vệ nhóm sạch sẽ, chuyên nghiệp, không lo spam

💰 Chỉ từ 60k/tháng → có ngay trợ lý quản trị Zalo siêu hiệu quả!

📩 Nhắn tin ngay để được tư vấn & kích hoạt trong vài phút!`;

            const formattedMessage = prTextMessage
              .replace(/{user}/g, userInfo.name) /* Thay tên người dùng */
              .replace(/{group}/g, groupName); /* Thay tên nhóm */

            try {
              /* 1. Gửi Tin Nhắn Text */
              await api.sendMessage(
                {
                  msg: formattedMessage,
                  ttl: 3600000 /* TTL 1 giờ */,
                },
                userId /* Gửi cho ID của người vừa tham gia */,
                MessageType.DirectMessage /* Gửi dưới dạng tin nhắn riêng tư */,
              );
            } catch (error) {
              console.error(
                `[PRWELCOME-TEXT] Lỗi khi gửi tin nhắn riêng cho ${userId}:`,
                error.message,
              );
            }

            /* 2. Gửi Business Card (Logic từ replytag.js) */
            try {
              const adminSearch = await api.findUser(ADMIN_PHONE_NUMBER);
              const adminUid = adminSearch?.uid;
              if (!adminUid) {
                throw new Error(
                  `Không tìm thấy Admin UID từ SĐT: ${ADMIN_PHONE_NUMBER}`,
                );
              }

              /* Nội dung card cố định */
              const cardMessage = "Liên hệ quản trị viên..!";

              await api.sendBusinessCard(
                null /* sourceMsgId */,
                adminUid /* UID của card (Admin) */,
                cardMessage /* Nội dung đi kèm card */,
                MessageType.DirectMessage /* Gửi tin riêng tư */,
                userId /* Gửi cho người mới */,
                3600000 /* TTL 1 giờ */,
              );
            } catch (error) {
              console.error(
                `[PRWELCOME-CARD] Lỗi khi gửi card riêng cho ${userId}:`,
                error.message,
              );
            }
          }
          /* --- KẾT THÚC CODE MỚI (ĐÃ SỬA ĐỔI): GỬI CHÀO MỪNG RIÊNG TƯ (1 NGƯỜI) --- */

          break;

        case GroupEventType.LEAVE:
          if (idBot !== idAction && threadSettings.byeGroup) {
            imagePath = await cv.createGoodbyeImage(
              userInfo,
              groupName,
              groupType,
              isAdminBot,
            );
          }
          break;

        case GroupEventType.REMOVE_MEMBER:
          if (idBot !== idAction && threadSettings.enableKickImage === true) {
            if (!blockedMembers.has(userId)) {
              await new Promise((resolve) =>
                setTimeout(resolve, BLOCK_CHECK_TIMEOUT),
              );
              if (!blockedMembers.has(userId)) {
                imagePath = await cv.createKickImage(
                  userInfo,
                  groupName,
                  groupType,
                  userInfo.genderId,
                  userActionName,
                  isAdminBot,
                );
              }
            }
          }
          break;

        case GroupEventType.BLOCK_MEMBER:
          if (idBot !== idAction && threadSettings.enableBlockImage === true) {
            blockedMembers.set(userId, Date.now());
            imagePath = await cv.createBlockImage(
              userInfo,
              groupName,
              groupType,
              userInfo.genderId,
              userActionName,
              isAdminBot,
            );
            setTimeout(() => {
              blockedMembers.delete(userId);
            }, 1000);
          }
          break;

        default:
          return;
      }

      if (imagePath) {
        await sendGroupMessage(api, threadId, imagePath, messageText);
        await cv.clearImagePath(imagePath);
      }

      /* --- SỬA ĐIỀU KIỆN (VỊ TRÍ 2): Thay đổi logic check prWelcomeEnabled --- */
    } else if (
      type === GroupEventType.JOIN &&
      updateMembers.length > 1 &&
      (threadSettings.welcomeGroup || threadSettings.prWelcomeEnabled === true)
    ) {
      /* --- SỬA LỖI: Kiểm tra idAction trước khi dùng --- */
      let userActionInfo = {};
      let userActionName = "Không rõ";
      if (idAction) {
        userActionInfo = await getUserInfoData(api, idAction);
        userActionName = userActionInfo.name || idAction;
      }
      /* --- KẾT THÚC SỬA LỖI --- */

      /* --- BẮT ĐẦU CODE MỚI: Tìm admin UID 1 lần cho tất cả --- */
      let adminUid = null;
      if (threadSettings.prWelcomeEnabled === true) {
        try {
          const adminSearch = await api.findUser(ADMIN_PHONE_NUMBER);
          adminUid = adminSearch?.uid;
          if (!adminUid) {
            console.error(
              `[PRWELCOME-CARD] Không tìm thấy UID admin từ SĐT: ${ADMIN_PHONE_NUMBER}`,
            );
          }
        } catch (error) {
          console.error(
            `[PRWELCOME-CARD] Lỗi khi tìm admin UID:`,
            error.message,
          );
        }
      }
      /* --- KẾT THÚC CODE MỚI --- */

      for (const user of updateMembers) {
        const userId = user.id;

        /* --- SỬA LỖI: Kiểm tra userId trước khi dùng --- */
        if (!userId) {
          console.error("[events-group] Lỗi: Bỏ qua user vì không có ID");
          continue; // Bỏ qua vòng lặp này
        }
        const userInfo = await getUserInfoData(api, userId);
        /* --- KẾT THÚC SỬA LỖI --- */

        if (threadSettings.welcomeGroup) {
          /* Gửi public */
          const imagePath = await cv.createWelcomeImage(
            userInfo,
            groupName,
            groupType,
            userActionName,
          );
          await sendGroupMessage(api, threadId, imagePath, "");
          await cv.clearImagePath(imagePath);
        }

        /* --- BẮT ĐẦU CODE MỚI (ĐÃ SỬA ĐỔI): GỬI CHÀO MỪNG RIÊNG TƯ (CHO NHIỀU NGƯỜI) --- */
        if (threadSettings.prWelcomeEnabled === true) {
          /* --- NỘI DUNG CỐ ĐỊNH (ĐÃ ĐỊNH DẠNG LẠI) --- */
          const prTextMessage = `Chào mừng {user} đã đến với nhóm {group}!

/-li CHO THUÊ BOT QUẢN LÝ NHÓM ZALO /-li

🌟 Tính năng nổi bật
✅ Sử dụng tài khoản Zalo bạn cung cấp để thiết lập bot 
✅ Quản lý thành viên: auto chào mừng, lọc từ cấm, chống spam hiệu quả
✅ Giải trí cực vui: nhiều mini game, auto trả lời, tăng tương tác nhóm
✅ Tự động gửi thông báo, rải link tiện lợi

🎯 Lợi ích khi sử dụng bot
🚀 Tiết kiệm tối đa thời gian quản lý nhóm
👥 Tăng tương tác, gắn kết & giữ chân thành viên
🔒 Bảo vệ nhóm sạch sẽ, chuyên nghiệp, không lo spam

💰 Chỉ từ 60k/tháng → có ngay trợ lý quản trị Zalo siêu hiệu quả!

📩 Nhắn tin ngay để được tư vấn & kích hoạt trong vài phút!`;

          const formattedMessage = prTextMessage
            .replace(/{user}/g, userInfo.name) /* Thay tên người dùng */
            .replace(/{group}/g, groupName); /* Thay tên nhóm */

          try {
            /* 1. Gửi Tin Nhắn Text */
            await api.sendMessage(
              {
                msg: formattedMessage,
                ttl: 3600000 /* TTL 1 giờ */,
              },
              userId /* Gửi cho ID của người vừa tham gia */,
              MessageType.DirectMessage /* Gửi dưới dạng tin nhắn riêng tư */,
            );
          } catch (error) {
            console.error(
              `[PRWELCOME-TEXT] Lỗi khi gửi tin nhắn riêng cho ${userId}:`,
              error.message,
            );
          }

          /* 2. Gửi Business Card (nếu đã tìm thấy adminUid) */
          if (adminUid) {
            try {
              /* Nội dung card cố định */
              const cardMessage = "Liên hệ quản trị viên..!";

              await api.sendBusinessCard(
                null /* sourceMsgId */,
                adminUid /* UID của card (Admin) */,
                cardMessage /* Nội dung đi kèm card */,
                MessageType.DirectMessage /* Gửi tin riêng tư */,
                userId /* Gửi cho người mới */,
                3600000 /* TTL 1 giờ */,
              );
            } catch (error) {
              console.error(
                `[PRWELCOME-CARD] Lỗi khi gửi card riêng cho ${userId}:`,
                error.message,
              );
            }
          }
        }
        /* --- KẾT THÚC CODE MỚI (ĐÃ SỬA ĐỔI): GỬI CHÀO MỪNG RIÊNG TƯ (CHO NHIỀU NGƯỜI) --- */
      }
    }
  } else {
    switch (type) {
      case GroupEventType.JOIN_REQUEST:
        if (threadSettings.memberApprove) {
          await api.handleGroupPendingMembers(threadId, true);
        }
        break;
    }
  }
}

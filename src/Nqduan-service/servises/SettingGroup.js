import fs from "fs";
import {
  sendMessageStateQuote,
  sendMessageWarning,
} from "../../Nqduan-service/chat-zalo/chat-style/chat-style.js";
import { readGroupSettings, writeGroupSettings } from "../../utils/io-json.js";
import { getGlobalPrefix } from "../../Nqduan-service/service.js";
import { removeMention } from "../../utils/format-util.js";
import {
  initializeGroupEvent,
  GroupEventType,
} from "../../api-zalo/models/GroupEvent.js";
import { getUserInfoData } from "../../Nqduan-service/info-service/user-info.js";
import { getGroupInfoData } from "../../Nqduan-service/info-service/group-info.js";
import { drawGroupEventCanvas } from "./canvas/canvas.Event.js";

export async function handleGroupEventNotify(api, event) {
  const groupSettings = readGroupSettings();
  const groupEvent = initializeGroupEvent(event.data, event.type);
  const threadId = groupEvent.threadId;
  const isEnabled = groupSettings[threadId]?.enableGroupEventNotify;

  if (!isEnabled || groupEvent.isSelf) return;

  const actorName =
    event.data?.actorName ||
    (event.data?.updateMembers?.[0]?.dName ?? "Người dùng");
  const topicTitle = event.data?.topicTitle || "";
  const link = event.data?.info?.group_link || event.data?.link || "";
  const expiredTime = event.data?.info?.link_expired_time || "";
  const { subType, groupName, sourceId } = event.data;

  let imageData = null;
  let fileNamePrefix = "";

  switch (event.type) {
    case GroupEventType.UPDATE_SETTING:
      imageData = {
        title: `Group ${groupName}`,
        userName: actorName,
        subtitle: `đã cập nhật cài đặt nhóm`,
        author: "",
      };
      fileNamePrefix = "setting";
      break;

    case GroupEventType.UPDATE:
      imageData = {
        title: `Group ${groupName}`,
        userName: actorName,
        subtitle: `đã cập nhật mô tả nhóm`,
        author: "",
      };
      fileNamePrefix = "update";
      break;

    case GroupEventType.NEW_LINK:
      imageData = {
        title: `Group ${groupName}`,
        userName: actorName,
        subtitle: `đã tạo link nhóm mới`,
        author: "",
      };
      fileNamePrefix = "link";
      break;

    case GroupEventType.NEW_PIN_TOPIC:
      imageData = {
        title: `Group ${groupName}`,
        userName: actorName,
        subtitle: `đã ghim chủ đề: ${topicTitle}`,
        author: "",
      };
      fileNamePrefix = "pin";
      break;

    case GroupEventType.UPDATE_TOPIC:
      imageData = {
        title: `Group ${groupName}`,
        userName: actorName,
        subtitle: `đã cập nhật chủ đề: ${topicTitle}`,
        author: "",
      };
      fileNamePrefix = "update_topic";
      break;

    case GroupEventType.UPDATE_BOARD:
      imageData = {
        title: `Group ${groupName}`,
        userName: actorName,
        subtitle: `đã cập nhật bảng thông tin nhóm`,
        author: "",
      };
      fileNamePrefix = "board";
      break;

    case GroupEventType.REORDER_PIN_TOPIC:
      imageData = {
        title: `Group ${groupName}`,
        userName: actorName,
        subtitle: `đã thay đổi thứ tự ghim chủ đề`,
        author: "",
      };
      fileNamePrefix = "reorder_pin";
      break;

    case GroupEventType.UNPIN_TOPIC:
      imageData = {
        title: `Group ${groupName}`,
        userName: actorName,
        subtitle: `đã gỡ ghim chủ đề: ${topicTitle}`,
        author: "",
      };
      fileNamePrefix = "unpin";
      break;

    case GroupEventType.REMOVE_TOPIC:
      imageData = {
        title: `Group ${groupName}`,
        userName: actorName,
        subtitle: `đã xóa chủ đề: ${topicTitle}`,
        author: "",
      };
      fileNamePrefix = "remove_topic";
      break;

    case GroupEventType.ADD_ADMIN:
    case GroupEventType.REMOVE_ADMIN: {
      if (subType !== 1) return;
      const isAdd = event.type === GroupEventType.ADD_ADMIN;
      const targetInfo = event.data?.updateMembers?.[0];
      const targetName = targetInfo?.dName || "Người dùng";
      const targetId = targetInfo?.uid;

      const sourceInfo = await getUserInfoData(api, sourceId);
      const targetUserInfo = targetId
        ? await getUserInfoData(api, targetId)
        : null;

      imageData = {
        title: `Group ${groupName}`,
        userName: sourceInfo.name,
        subtitle: `${isAdd ? "đã thêm" : "đã gỡ"} ${targetName} làm Phó nhóm`,
        author: "",
      };
      fileNamePrefix = isAdd ? "add_admin" : "remove_admin";

      // Thêm biến tạm để truyền vào vẽ canvas bên dưới
      var targetAvatar = targetUserInfo?.avatar;
      break;
    }

    default:
      return;
  }

  if (!imageData) return;

  try {
    const userInfo = await getUserInfoData(api, sourceId);
    const groupInfo = await getGroupInfoData(api, threadId);
    const groupAvatar = groupInfo?.fullAvt || groupInfo?.avt;
    const fileName = `${fileNamePrefix}_${Date.now()}.png`;

    const imagePath = await drawGroupEventCanvas(
      userInfo,
      imageData,
      fileName,
      groupAvatar,
    );

    if (fs.existsSync(imagePath)) {
      await api.sendMessage(
        {
          msg: "",
          attachments: [imagePath],
          ttl: 5000000,
        },
        threadId,
        1,
      );

      if (event.type === GroupEventType.NEW_LINK && link) {
        await api.sendMessage(
          { msg: `🔗 Link nhóm mới: ${link}`, ttl: 30000 },
          threadId,
          1,
        );
      }

      fs.unlink(imagePath, () => {});
    }
  } catch (err) {
    console.error("[CanvasNotify] Lỗi khi tạo hoặc gửi ảnh:", err);
  }
}

/**
 * Bật/tắt thông báo sự kiện nhóm qua lệnh: !notifygroup [on/off]
 * Chỉ tạo cấu hình nếu dùng lệnh "on"
 */
export async function handleToggleGroupEventNotify(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  const args = content
    .replace(`${prefix}${aliasCommand}`, "")
    .trim()
    .split(/\s+/);
  const option = args[0];
  const threadId = message.threadId;

  const groupSettings = readGroupSettings();
  const group = groupSettings[threadId] || {};

  if (group.enableGroupEventNotify === undefined && option !== "on") {
    return;
  }

  let newStatus;
  if (option === "on") newStatus = true;
  else if (option === "off") newStatus = false;
  else if (!option) newStatus = !group.enableGroupEventNotify;
  else {
    await sendMessageWarning(
      api,
      message,
      `Cú pháp không hợp lệ. Dùng: ${prefix}${aliasCommand} [on/off]`,
    );
    return false;
  }

  if (!groupSettings[threadId]) groupSettings[threadId] = {};
  groupSettings[threadId].enableGroupEventNotify = newStatus;
  writeGroupSettings(groupSettings);

  const statusText = newStatus ? "bật" : "tắt";
  await sendMessageStateQuote(
    api,
    message,
    `Đã ${statusText} thông báo sự kiện nhóm`,
    newStatus,
    300000,
  );
  return true;
}

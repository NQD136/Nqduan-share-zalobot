import { MessageType } from "zlbotdqt";
import { createGroupInfoImage, clearImagePath } from "../../utils/canvas/index.js";
import { sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getUserInfoData } from "./user-info.js";

// --- IMPORT MỚI ---
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";
// --------------------

const groupInfoCache = new Map();
const CACHE_DURATION = 10000;

// --- HÀM ĐÃ SỬA ĐỔI ---
export async function groupInfoCommand(api, message, aliasCommand) { // Thêm aliasCommand
  const threadId = message.threadId;

  // --- LOGIC MỚI ĐỂ KIỂM TRA "text" ---
  let content = removeMention(message);
  const prefix = getGlobalPrefix();
  content = content.replace(`${prefix}${aliasCommand}`, "").trim();
  const asText = content.includes("text");
  // ---------------------------------

  let imagePath = null; // Dùng cho khối finally

  try {
    // Lấy thông tin nhóm
    const groupInfo = await getGroupInfoData(api, threadId);
    if (!groupInfo) {
      await sendMessageWarning(api, message, "Không thể lấy thông tin nhóm.");
      return;
    }

    // Lấy thông tin người tạo (cần cho cả ảnh và text)
    const owner = await getUserInfoData(api, groupInfo.creatorId);
    if (!owner) {
      await sendMessageWarning(api, message, "Không thể lấy thông tin người tạo box.");
      return;
    }

    if (asText) {
      // --- LOGIC MỚI CHO LỆNH TEXT ---
      
      // 1. Xác định loại nhóm
      const isCommunity = groupInfo.groupType === 2;
      const creatorRole = isCommunity ? "Trưởng cộng đồng" : "Trưởng nhóm";
      
      // --- THAY ĐỔI: Tự động đổi tên tiêu đề ---
      const typeName = isCommunity ? "CỘNG ĐỒNG" : "NHÓM";
      
      // 2. Lấy số lượng admin
      const adminList = await getGroupAdmins(groupInfo);
      const adminCount = adminList.length;
      
      // 3. Tạo chuỗi văn bản
      const textOutput = [
        `[ THÔNG TIN ${typeName} ]`, // <-- ĐÃ SỬA
        `👥 Tên: ${groupInfo.name}`, // <-- Sửa "Tên box" -> "Tên"
        `👑 ${creatorRole}: ${owner.name}`,
        `🆔 ID: ${groupInfo.groupId}`,
        `👨‍👩‍👧‍👦 Số thành viên: ${groupInfo.memberCount}`,
        `📅 Ngày tạo: ${groupInfo.createdTime}`,
        `🛡️ Số quản trị: ${adminCount}`
        // 👤 Đã xóa dòng "Người tạo box" vì creatorId thực chất là Trưởng nhóm/Cộng đồng hiện tại.
      ];

      // --- LOGIC MỚI: Thêm Cài Đặt Nhóm ---
      const settingLabels = {
        blockName: "Chặn đổi thông tin",
        signAdminMsg: "Hiển thị key QTV",
        addMemberOnly: "Chỉ QTV thêm thành viên",
        setTopicOnly: "Chỉ QTV đặt chủ đề",
        enableMsgHistory: "Lịch sử tin nhắn",
        lockCreatePost: "Khóa tạo bài viết",
        lockCreatePoll: "Khóa tạo bình chọn",
        joinAppr: "Phê duyệt tham gia",
        lockSendMsg: "Khóa gửi tin nhắn",
        lockViewMember: "Khóa xem thành viên",
      };

      const settings = groupInfo.setting || {};
      const settingOutput = [`\n[ CÀI ĐẶT ${typeName} ]`]; // <-- ĐÃ SỬA
      
      for (const key in settingLabels) {
        if (Object.hasOwnProperty.call(settingLabels, key)) {
          const label = settingLabels[key];
          const value = settings[key];
          settingOutput.push(`- ${label}: ${value === 1 ? "Bật ✅" : "Tắt ❌"}`);
        }
      }
      // --- KẾT THÚC LOGIC CÀI ĐẶT ---

      // 4. Gửi tin nhắn text
      await api.sendMessage({ msg: textOutput.join("\n") + settingOutput.join("\n"), quote: message, ttl: 360000 }, threadId, MessageType.GroupMessage);
      
    } else {
      // --- LOGIC VẼ ẢNH (GIỮ NGUYÊN) ---
      imagePath = await createGroupInfoImage(groupInfo, owner);
      await api.sendMessage({ msg: "", attachments: [imagePath] ,ttl: 600000 , quote: message }, threadId, MessageType.GroupMessage);
    }
  } catch (error) {
    console.error(error); // Log lỗi ra console
    await sendMessageWarning(api, message, "Đã xảy ra lỗi khi lấy thông tin nhóm. Vui lòng thử lại sau!");
  } finally {
    // --- KHỐI FINALLY MỚI ĐỂ DỌN DẸP ẢNH ---
    if (imagePath) {
      clearImagePath(imagePath);
    }
  }
}
// --- KẾT THÚC HÀM SỬA ĐỔI ---

export async function getGroupAdmins(groupInfo) {
  try {
    const admins = groupInfo.adminIds || [];
    const creatorId = groupInfo.creatorId;

    if (creatorId && !admins.includes(creatorId)) {
      admins.push(creatorId);
    }

    return admins;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách quản trị viên nhóm:", error);
    return [];
  }
}

export async function getGroupName(api, threadId) {
  try {
    const groupInfoResponse = await api.getGroupInfo(threadId);
    const groupName = groupInfoResponse.gridInfoMap[threadId].name;

    return groupName;
  } catch (error) {
    console.error("Lỗi khi lấy tên nhóm:", error);
    return [];
  }
}

export async function getGroupInfoData(api, threadId) {
  const now = Date.now();
  const cachedData = groupInfoCache.get(threadId);

  if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
    return cachedData.data;
  }

  const groupInfo = await api.getGroupInfo(threadId);
  const processedInfo = getAllInfoGroup(groupInfo, threadId);

  groupInfoCache.set(threadId, {
    data: processedInfo,
    timestamp: now
  });

  return processedInfo;
}

function getAllInfoGroup(groupInfo, threadId) {
  return {
    name: groupInfo.gridInfoMap[threadId].name,
    memberCount: groupInfo.gridInfoMap[threadId].memVerList.length,
    createdTime: new Date(groupInfo.gridInfoMap[threadId].createdTime).toLocaleString(),
    groupType: groupInfo.gridInfoMap[threadId].type,
    memVerList: groupInfo.gridInfoMap[threadId].memVerList,
    creatorId: groupInfo.gridInfoMap[threadId].creatorId,
    adminIds: groupInfo.gridInfoMap[threadId].adminIds,
    admins: groupInfo.gridInfoMap[threadId].admins,
    avt: groupInfo.gridInfoMap[threadId].avt,
    fullAvt: groupInfo.gridInfoMap[threadId].fullAvt,
    globalId: groupInfo.gridInfoMap[threadId].globalId,
    groupId: groupInfo.gridInfoMap[threadId].groupId,
    desc: groupInfo.gridInfoMap[threadId].desc,
    setting: groupInfo.gridInfoMap[threadId].setting,
    totalMember: groupInfo.gridInfoMap[threadId].totalMember,
  };
}

export async function getDataAllGroup(api) {
  try {
    const allGroupsResult = await api.getAllGroups();

    if (!allGroupsResult || !allGroupsResult.gridVerMap) {
      throw new Error("Không thể lấy danh sách nhóm");
    }

    const groupIds = Object.keys(allGroupsResult.gridVerMap);

    const allGroupsInfo = await Promise.all(
      groupIds.map(async (threadId) => {
        try {
          const groupInfo = await getGroupInfoData(api, threadId);
          return groupInfo;
        } catch (error) {
          console.error(`Lỗi khi lấy thông tin nhóm ${threadId}:`, error);
          return null;
        }
      })
    );

    const validGroupsInfo = allGroupsInfo.filter((info) => info !== null);

    return validGroupsInfo;
  } catch (error) {
    console.error("Lỗi khi lấy thông tin tất cả các nhóm:", error);
    throw error;
  }
}


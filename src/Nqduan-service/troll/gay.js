import { sendMessageFactory } from "../../api-zalo/apis/sendMessage.js";
import { getGlobalPrefix } from "../service.js";
import { createGayCheckImage } from "./canvas-gay.js"; // Import hàm tạo ảnh mới
import fs from "fs";

// Đối tượng mô tả lệnh
export const des = {
  name: "gay",
  version: "2.0.0", // Nâng cấp phiên bản
  credits: "Nqduan (sửa từ H w H)", // Ghi công người sửa
  description: "Check tỉ lệ gay/less của người dùng và tạo ảnh kết quả.",
  countdown: 10, // Tăng countdown vì có xử lý ảnh
  active: true,
};

// Hàm tạo nhận xét dựa trên tỉ lệ và giới tính
function getRemark(percentage, type) {
  if (percentage <= 30)
    return type === "gay" ? "Chỉ hơi cong queo thôi! 😊" : "Mới là hạt mầm! 🌱";
  if (percentage <= 60)
    return type === "gay"
      ? "Có tố chất, cần phát huy! 😏"
      : "Đã bắt đầu chớm nở! 🌸";
  if (percentage <= 90)
    return type === "gay"
      ? "Cong hơn cả cầu vồng! 🌈"
      : "Tình chị em thắm thiết! 👩‍❤️‍💋‍👩";
  if (percentage <= 120)
    return type === "gay" ? "Siêu cấp gay! 🏳️‍🌈" : "Thuyền không bến! ⛵";
  if (percentage <= 180)
    return type === "gay"
      ? " Chúa tể của những chiếc sừng! 🐐"
      : "Chị đại trong làng less! 💅";
  return type === "gay"
    ? "Vượt qua mọi định luật vật lý! 🚀"
    : "Hệ tư tưởng mới! 👽";
}

// Hàm xử lý lệnh chính
export async function handleGayCommand(api, message) {
  const threadId = message.threadId;
  const sendMessage = sendMessageFactory(api);
  let imagePath = null;

  try {
    // Kiểm tra xem có tag ai không
    const mentions = message.data.mentions || [];
    if (mentions.length === 0) {
      return sendMessage(
        { msg: "Bạn cần phải tag một người để check chứ! 🧐" },
        threadId,
      );
    }

    const targetUserId = mentions[0].uid;

    // Lấy thông tin chi tiết của người được tag
    const userInfoResponse = await api.getUserInfo(targetUserId);
    const userInfo =
      userInfoResponse?.unchanged_profiles?.[targetUserId] ||
      userInfoResponse?.changed_profiles?.[targetUserId];

    if (!userInfo) {
      return sendMessage(
        { msg: "Không thể lấy được thông tin của người này." },
        threadId,
      );
    }

    const name = userInfo.zaloName || "Người lạ";
    const avatar = userInfo.avatar;
    const gender = userInfo.gender; // 0: Nam, 1: Nữ, khác: Không xác định

    // Random tỉ lệ mới mỗi lần check
    const percentage = Math.floor(Math.random() * 200) + 1; // 1 -> 200%

    let title, label, remark;

    if (gender === 0) {
      // Nam
      title = "Kết Quả Check Gay";
      label = "Mức độ gay";
      remark = getRemark(percentage, "gay");
    } else if (gender === 1) {
      // Nữ
      title = "Kết Quả Check Less";
      label = "Mức độ less";
      remark = getRemark(percentage, "less");
    } else {
      // Giới tính khác
      title = "Kết Quả Check Độ Lầy";
      label = "Mức độ lầy lội";
      remark = getRemark(percentage, "neutral");
    }

    // Gói dữ liệu để tạo ảnh
    const imageData = {
      name,
      avatar,
      title,
      label,
      percentage,
      remark,
    };

    // Gọi hàm tạo ảnh
    imagePath = await createGayCheckImage(imageData);

    // Gửi ảnh kết quả
    await api.sendMessage(
      {
        msg: "",
        attachments: [imagePath],
      },
      threadId,
      message.type,
    );
  } catch (error) {
    console.error("Lỗi ở lệnh gay:", error);
    sendMessage(
      { msg: "Đã có lỗi xảy ra, không thể hoàn thành bài check." },
      threadId,
    );
  } finally {
    // Xóa file ảnh tạm sau khi gửi
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
}

import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import * as cs from "./index.js";

// ===== THAY ĐỔI LINK BACKGROUND MỚI CỦA BẠN Ở ĐÂY =====
export const linkBackgroundDefault = "https://files.catbox.moe/pdioyf.jpg";
export const linkBackgroundDefaultZalo = "https://cover-talk.zadn.vn/default";

export async function getLinkBackgroundDefault(userInfo) {
  let backgroundImage;
  try {
    if (userInfo.cover && userInfo.avatar !== linkBackgroundDefaultZalo) {
      backgroundImage = await loadImage(userInfo.avatar);
    } else {
      backgroundImage = await loadImage(linkBackgroundDefault);
    }
  } catch (error) {
    // Nếu link mới lỗi, nó sẽ thử load link avatar, nếu vẫn lỗi, nó sẽ load link cũ (dự phòng)
    try {
        backgroundImage = await loadImage(userInfo.avatar);
    } catch (avatarError) {
        console.warn("Không thể load background mới hoặc avatar, dùng background dự phòng");
        backgroundImage = await loadImage("https://f58-zpg-r.zdn.vn/jpg/5044485622965252364/799cd26798cc24927ddd.jpg");
    }
  }
  return backgroundImage;
}

async function createImage(userInfo, message, fileName, themeColor = null) {
  const width = 1000;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  let backgroundImage;
  let typeImage = -1;
  let fluent = 0.8;
  if (fileName.includes("welcome")) {
    typeImage = 0;
    fluent = 0.6;
  } else if (fileName.includes("goodbye")) {
    typeImage = 1;
    fluent = 0.6;
  } else if (["blocked", "kicked", "kicked_spam"].some(keyword => fileName.includes(keyword))) {
    typeImage = 2;
    fluent = 0.85;
  }
  try {
    backgroundImage = await getLinkBackgroundDefault(userInfo);
    ctx.drawImage(backgroundImage, 0, 0, width, height);

    const overlay = ctx.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, `rgba(30, 30, 53, ${fluent})`);
    overlay.addColorStop(0.5, `rgba(26, 37, 71, ${fluent})`);
    overlay.addColorStop(1, `rgba(19, 27, 54, ${fluent})`);

    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, width, height);

  } catch (error) {
    console.error("Lỗi khi xử lý background:", error);
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
    backgroundGradient.addColorStop(0, "#1E1E35");
    backgroundGradient.addColorStop(0.5, "#1A2547");
    backgroundGradient.addColorStop(1, "#131B36");
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, width, height);
  }

  let xAvatar = 118;
  let widthAvatar = 162;
  let heightAvatar = 162;
  let yAvatar = height / 2 - heightAvatar / 2;

  // chọn màu gradient
  let gradientColors;
  if (themeColor) {
    gradientColors = [themeColor];
  } else if (typeImage === 0) {
    gradientColors = ["#00ffcc", "#00ff95", "#00ff80", "#1aff8c", "#33ff99"];
  } else if (typeImage === 1) {
    gradientColors = ["#FFFFFF", "#F0F0F0", "#FAFAFF", "#F8FBFF", "#EAEAFF", "#FFF5FA", "#FFFFFF"];
  } else if (typeImage === 2) {
    gradientColors = ["#ff0000", "#ff1111", "#ff2200", "#ff0022", "#ff3300"];
  } else {
    gradientColors = ["#FF1493", "#FF69B4", "#FFD700", "#FFA500", "#FF8C00", "#00FF7F", "#40E0D0"];
  }

  const shuffledColors = [...gradientColors];

  // vẽ avatar + viền
  const userAvatarUrl = userInfo.avatar;
  if (userAvatarUrl && cs.isValidUrl(userAvatarUrl)) {
    try {
      const avatar = await loadImage(userAvatarUrl);

      const borderWidth = 6;
      ctx.save();
      ctx.beginPath();
      ctx.arc(xAvatar, height / 2, widthAvatar / 2 + borderWidth, 0, Math.PI * 2, true);

      if (themeColor) {
        ctx.fillStyle = themeColor; // viền 1 màu
      } else {
        const gradient = ctx.createLinearGradient(
          xAvatar - widthAvatar / 2 - borderWidth,
          yAvatar - borderWidth,
          xAvatar + widthAvatar / 2 + borderWidth,
          yAvatar + heightAvatar + borderWidth
        );
        shuffledColors.forEach((color, index) => {
          gradient.addColorStop(index / (shuffledColors.length - 1), color);
        });
        ctx.fillStyle = gradient;
      }
      ctx.fill();

      ctx.beginPath();
      ctx.arc(xAvatar, height / 2, widthAvatar / 2, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.drawImage(avatar, xAvatar - widthAvatar / 2, yAvatar, widthAvatar, heightAvatar);
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(xAvatar + widthAvatar / 2 + borderWidth + 30, yAvatar + 30);
      ctx.lineTo(xAvatar + widthAvatar / 2 + borderWidth + 30, yAvatar + heightAvatar - 30);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  let xText = xAvatar + widthAvatar / 2 + 80;
  let y1 = 86;

  function drawText(text, x, y, font, colors) {
    if (!text) return;
    ctx.font = font;
    ctx.textAlign = "left";
    if (themeColor) {
      ctx.fillStyle = themeColor; // toàn bộ text 1 màu
    } else {
      const grad = ctx.createLinearGradient(x, y - 30, x + 300, y);
      colors.forEach((color, index) => {
        grad.addColorStop(index / (colors.length - 1), color);
      });
      ctx.fillStyle = grad;
    }
    ctx.fillText(text, x, y);
  }

  drawText(message.title, xText, y1, "bold 36px BeVietnamPro", shuffledColors);
  drawText(message.userName, xText, y1+50, "bold 36px BeVietnamPro", shuffledColors);
  drawText(message.subtitle, xText, y1+95, "28px BeVietnamPro", shuffledColors);
  drawText(message.author, xText, y1+140, "bold 32px BeVietnamPro", shuffledColors);

  const filePath = path.resolve(`./assets/temp/${fileName}`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

export async function createWelcomeImage(userInfo, groupName, groupType, userActionName, isAdmin) {
  const userName = userInfo.name || "";
  const authorText = userActionName === userName ? "Tham Gia Trực Tiếp Hoặc Được Mời" : `Duyệt bởi ${userActionName}`;
  return createImage(
    userInfo,
    {
      title: `${groupName}`,
      userName: `Chào mừng ${isAdmin ? "Đại Ca " : ""}${userName}`,
      subtitle: `Đã Tham Gia ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${authorText}`,
    },
    `welcome_${Date.now()}.png`
  );
}

export async function createGoodbyeImage(userInfo, groupName, groupType, isAdmin) {
  const userName = userInfo.name || "";
  return createImage(
    userInfo,
    {
      title: "Member Left The Group",
      userName: `${isAdmin ? "Đại Ca " : ""}${userName}`,
      subtitle: `Vừa rời khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`
    },
    `goodbye_${Date.now()}.png`
  );
}

export async function createKickImage(userInfo, groupName, groupType, gender, userActionName, isAdmin) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  let userNameText = isAdmin ? `Đại Ca ${userName}` : `${genderText}Lợn Nhựa ${userName}`;
  return createImage(
    userInfo,
    {
    title: `Kicked Out Member`,
      userName: `${userNameText}`,
    subtitle: `Đã Bị ${userActionName} Sút Khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `kicked_${Date.now()}.png`
  );
}

export async function createBlockImage(userInfo, groupName, groupType, gender, userActionName, isAdmin) {
   const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  let userNameText = isAdmin ? `Đại Ca ${userName}` : `${genderText}Lợn Nhựa ${userName}`;
  return createImage(
    userInfo,
    {
      title: `Blocked Out Member`,
      userName: `${userNameText}`,
      subtitle: `Đã Bị ${userActionName} Chặn Khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
     },
    `blocked_${Date.now()}.png`
  );
}

export async function createBlockSpamImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Spam Member`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do spam đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_spam_${Date.now()}.png`
  );
}

export async function createBlockSpamLinkImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Spam Link Member`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do spam link đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_spam_link_${Date.now()}.png`
  );
}

export async function createSettingChangeImage(userInfo, groupName, settingName, newValue, changerName) {
  const settingNames = {
    blockName: "Chặn thay đổi tên nhóm",
    signAdminMsg: "Làm nổi tin nhắn từ quản trị",
    addMemberOnly: "Chỉ quản trị nhóm thêm thành viên",
    setTopicOnly: "Chỉ quản trị nhóm đặt chủ đề",
    enableMsgHistory: "Lịch sử tin nhắn",
    joinAppr: "Duyệt thành viên",
    lockCreatePost: "Quyền tạo ghi chú, nhắc hẹn",
    lockCreatePoll: "Quyền tạo bình chọn",
    lockSendMsg: "Quyền gửi tin nhắn",
    lockViewMember: "Khóa xem thành viên",
    bannFeature: "Tính năng cấm",
    dirtyMedia: "Phương tiện nhạy cảm",
    banDuration: "Thời gian cấm"
  };

  const statusText = newValue === 1 ? "Đã khóa cài đặt" : "Đã cho phép cài đặt";
  const displayName = settingNames[settingName] || settingName;
  const themeColor = newValue === 1 ? "#FFD700" : "#FFFFFF"; // vàng hoặc trắng

  return createImage(
    userInfo,
    {
      title: `${groupName}`,
      userName: `${displayName}`,
      subtitle: `${statusText}`,
      author: `Người thực hiện: ${changerName}`
    },
    `setting_change_${Date.now()}.png`,
    themeColor
  );
}

export async function createAdminAddedImage(userInfo, groupName, changerName) {
  return createImage(
    userInfo,
    {
      title: `Admin Added To Group`,
      userName: `${userInfo.name || userInfo.dName || 'Người dùng'}`,
      subtitle: `Đã được thêm làm quản trị viên`,
      author: `Thực hiện bởi: ${changerName} • ${groupName}`
    },
    `admin_added_${Date.now()}.png`
  );
}

export async function createAdminRemovedImage(userInfo, groupName, changerName) {
  return createImage(
    userInfo,
    {
      title: `Admin Removed From Group`,
      userName: `${userInfo.name || userInfo.dName || 'Người dùng'}`,
      subtitle: `Đã bị gỡ khỏi quản trị viên`,
      author: `Thực hiện bởi: ${changerName} • ${groupName}`
    },
    `admin_removed_${Date.now()}.png`
  );
}

// ===============================================
// PHẦN CODE MỚI THÊM VÀO (Tất cả các file anti-)
// ===============================================

// Cho anti-voice.js
export async function createAntiVoiceImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Spam Voice`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do spam voice đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_spam_voice_${Date.now()}.png`
  );
}

// Cho anti-video.js
export async function createAntiVideoImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Spam Video`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do spam video đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_spam_video_${Date.now()}.png`
  );
}

// Cho anti-photo.js
export async function createAntiPhotoImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Spam Photo`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do spam ảnh đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_spam_photo_${Date.now()}.png`
  );
}

// Cho anti-sticker.js
export async function createAntiStickerImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Spam Sticker`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do spam sticker đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_spam_sticker_${Date.now()}.png`
  );
}

// Cho anti-tag.js
export async function createAntiTagImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Spam Tag`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do tag nhiều người đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_spam_tag_${Date.now()}.png`
  );
}

// Cho anti-bot.js
export async function createAntiBotImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Bot User`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do sử dụng bot đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_bot_${Date.now()}.png`
  );
}

// Cho anti-stickereffect.js
export async function createAntiStickerEffectImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Spam Sticker`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do spam sticker hiệu ứng đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_spam_stickereffect_${Date.now()}.png`
  );
}

// Cho anti-file.js
export async function createAntiFileImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out File Sender`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do gửi file đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_file_${Date.now()}.png`
  );
}

// Cho anti-text.js
export async function createAntiTextImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Text Sender`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do gửi tin nhắn văn bản đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_text_${Date.now()}.png`
  );
}

// Cho anti-forward.js
export async function createAntiForwardImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Forwarded Message`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do chuyển tiếp tin nhắn đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_forward_${Date.now()}.png`
  );
}

// MỚI: Cho target-manage.js (khi tự động chặn)
export async function createAutoBlockTargetImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Auto-Blocked Target Member`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do bị target đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_target_${Date.now()}.png`
  );
}

export async function createAntiNudeImage(userInfo, groupName, groupType, gender) {
  const userName = userInfo.name || "";
  const genderText = gender === 0 ? "" : gender === 1 ? "" : "";
  return createImage(
    userInfo,
   {
      title: `Blocked Out Nude Content`,
      userName: `${genderText}Lợn Nhựa ${userName}`,
      subtitle: `Do gửi nội dung nhạy cảm đã bị chặn khỏi ${groupType ? (groupType === 2 ? "Cộng Đồng" : "Nhóm") : "Nhóm"}`,
      author: `${groupName}`,
    },
    `blocked_nude_${Date.now()}.png`
  );
}
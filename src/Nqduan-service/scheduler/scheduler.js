// src/Nqduan-service/automations/scheduler.js
import schedule from "node-schedule";
import fs from "fs";
import { readGroupSettings, writeGroupSettings } from "../../utils/io-json.js";
import { MessageType } from "../../api-zalo/index.js";
import { handleRandomChartZingMp3 } from "../api-crawl/music/zingmp3.js";

// === THAY ĐỔI: Đã gỡ bỏ import 'searchVideoTiktok' và 'getRandomVideoFromArray' ===
import { sendRandomGirlVideo } from "../chat-zalo/chat-special/send-video/send-video.js";
import { generateRankImageForTask } from "../info-service/rank-chat.js";
import { clearImagePath } from "../../utils/canvas/index.js";

// --- THÊM MỚI: Import hàm tạo ảnh lịch và hàm lấy giờ ---
import { generateCalendarImageForTask } from "../api-crawl/content/calendar.js";
import { getTimeNow } from "../../utils/format-util.js";

// === THÊM MỚI: Import hàm thời tiết ===
import { generateWeatherImageForTask } from "../api-crawl/content/weather.js";

const scheduledTasks = [
  // --- (Các tác vụ từ 00:05 đến 05:05) ---
  {
    cronExpression: "5 0 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 00:05 <\nĐã qua ngày mới rồi\nChúc bạn ngủ ngon nhé!` +
        `\n\nNghe chút nhạc chill đêm khuya...`;
      const timeToLive = 1000 * 60 * 60 * 3;
      // === THAY ĐỔI: sendTaskVideo -> sendTaskGirlVideo ===
      await sendTaskGirlVideo(api, caption, timeToLive, "default");
    },
  },
  {
    cronExpression: "5 1 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 01:05 <\nNgủ muộn thế bạn ơi!` +
        `\n\nCung cấp vitamin gái cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 2 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 02:05 <\nCú đêm chính hiệu!` +
        `\n\nCung cấp vitamin gái cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 3 * * *",
    task: async (api) => {
      const caption = `> SendTask 03:05 <\nNgày mới chúc các bạn may mắn!\n\n`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskMusic(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 4 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 04:05 <\nNgủ ngon bạn nhé!` +
        `\n\nCung cấp vitamin gái cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 5 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 05:05 <\nChuẩn bị thức dậy nào!` +
        `\n\nCung cấp vitamin gái cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 6 * * *",
    task: async (api) => {
      const caption = `> SendTask 06:05 <\nChào buổi sáng! Đây là thông tin thời tiết hôm nay:`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskWeather(api, timeToLive, caption);
    },
  },
  {
    cronExpression: "5 7 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 07:05 <\nChào một buổi sáng đầy năng lượng!` +
        `\n\nCung cấp vitamin gái cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 8 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 08:05 <\nChào buổi sáng\nCùng đón nắng ấm suơng mưa nhé!` +
        `\n\nGiải trí một chút để bớt căng thẳng thôi nào!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "default");
    },
  },
  {
    cronExpression: "5 9 * * *",
    task: async (api) => {
      const caption = `> SendTask 09:05 <\nCập nhật thời tiết giữa buổi sáng:`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskWeather(api, timeToLive, caption);
    },
  },
  {
    cronExpression: "5 10 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 10:05 <\nChào một buổi trưa đầy năng lượng!` +
        `\n\nCung cấp vitamin gái cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 11 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 11:05 <\nĂn cơm thôi nào!` +
        `\n\nCung cấp vitamin gái cực sexy cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "sexy");
    },
  },
  {
    cronExpression: "5 12 * * *",
    task: async (api) => {
      const caption = `> SendTask 12:05 <\nBảng Xếp Hạng tương tác (Nửa ngày)!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskTopChat(api, timeToLive, caption);
    },
  },
  {
    cronExpression: "5 13 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 13:05 <\nChào một buổi trưa đầy năng lượng!` +
        `\n\nGiải trí cho bớt căng não anh em nhé!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "anime");
    },
  },
  {
    cronExpression: "5 14 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 14:05 <\nChào một buổi trưa đầy năng lượng!` +
        `\n\nCung cấp vitamin gái cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 15 * * *",
    task: async (api) => {
      const caption = `> SendTask 15:05 <\nThời tiết buổi chiều như sau:`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskWeather(api, timeToLive, caption);
    },
  },
  {
    cronExpression: "5 16 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 16:05 <\nChào một buổi xế chiều đầy năng lượng!` +
        `\n\nGiải trí với nữ cosplay cho anh em đây!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "cosplay");
    },
  },
  {
    cronExpression: "5 17 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 17:05 <\nChúc buổi chiều thật chill và vui vẻ nhé!` +
        `\n\nĐón hoàng hôn ánh chiều tà thôi nào!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "anime");
    },
  },
  {
    cronExpression: "5 18 * * *",
    task: async (api) => {
      const caption = `> SendTask 18:05 <\nThời tiết buổi tối. Chúc bạn bữa tối vui vẻ!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskWeather(api, timeToLive, caption);
    },
  },
  {
    cronExpression: "5 19 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 19:05 <\nChúc các bạn một buổi tối vui vẻ bên gia đình!` +
        `\n\nThư giãn cuối ngày thôi nào!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "default");
    },
  },
  {
    cronExpression: "5 20 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 20:05 <\nGiải trí bằng 1 bài nhạc` +
        `\ncho thời gian tỉnh táo nhất trong ngày!\n\n`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskMusic(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "30 21 * * *",
    task: async (api) => {
      const caption = `> SendTask 21:30 <\nXem lại lịch ngày hôm nay trước khi đi ngủ nào!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskCalendar(api, timeToLive, caption);
    },
  },
  {
    cronExpression: "5 21 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 21:05 <\nChill một chút nào !` +
        `\n\nThư giãn cuối ngày thôi nào!!!`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "sexy");
    },
  },
  {
    cronExpression: "5 22 * * *",
    task: async (api) => {
      const caption = `> SendTask 22:05 <\nChúc các bạn ngủ ngon!\n\n`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskMusic(api, caption, timeToLive);
    },
  },
  {
    cronExpression: "5 23 * * *",
    task: async (api) => {
      const caption =
        `> SendTask 23:05 <\nChuẩn bị đi ngủ nào!` +
        `\n\nThư giãn nhẹ nhàng cuối ngày nhé.`;
      const timeToLive = 1000 * 60 * 60 * 1;
      await sendTaskGirlVideo(api, caption, timeToLive, "default");
    },
  },
  {
    cronExpression: "55 23 * * *",
    task: async (api) => {
      const caption = `> SendTask 23:55 <\nTổng kết Bảng Xếp Hạng ngày hôm nay!`;
      const timeToLive = 1000 * 60 * 60 * ``;
      await sendTaskTopChat(api, timeToLive, caption);
    },
  },
];

async function sendTaskGirlVideo(api, caption, timeToLive, type = "default") {
  const groupSettings = readGroupSettings();
  for (const threadId of Object.keys(groupSettings)) {
    if (groupSettings[threadId].sendTask) {
      try {
        const message = {
          threadId: threadId,
          type: MessageType.GroupMessage,
        };
        await sendRandomGirlVideo(api, message, caption, type, timeToLive);
      } catch (error) {
        console.error(`Lỗi khi gửi video gái in ${threadId}:`, error);
        if (error.message && error.message.includes("không tồn tại")) {
          groupSettings[threadId].sendTask = false;
          writeGroupSettings(groupSettings);
        }
      }
    }
  }
}

async function sendTaskMusic(api, caption, timeToLive) {
  const groupSettings = readGroupSettings();
  for (const threadId of Object.keys(groupSettings)) {
    if (groupSettings[threadId].sendTask) {
      try {
        const message = {
          threadId: threadId,
          type: MessageType.GroupMessage,
        };
        await handleRandomChartZingMp3(api, message, caption, timeToLive);
      } catch (error) {
        console.error(`Lỗi khi gửi nhạc in ${threadId}:`, error);
        if (error.message && error.message.includes("Không tồn tại")) {
          groupSettings[threadId].sendTask = false;
          writeGroupSettings(groupSettings);
        }
      }
    }
  }
}

async function sendTaskTopChat(api, timeToLive, caption) {
  const groupSettings = readGroupSettings();

  for (const threadId of Object.keys(groupSettings)) {
    if (groupSettings[threadId].sendTask) {
      let imagePath = null;
      try {
        const result = await generateRankImageForTask(api, threadId, "today");

        if (result.imagePath) {
          imagePath = result.imagePath;
          await api.sendMessage(
            {
              msg: caption,
              attachments: [imagePath],
              ttl: 3600000,
            },
            threadId,
            MessageType.GroupMessage,
          );
        } else {
          const errorMsg =
            result.error === "Không có ai tương tác."
              ? "Hôm nay không có ai tương tác để xếp hạng."
              : "Không thể tạo bảng xếp hạng.";

          await api.sendMessage(
            {
              msg: `${caption}\n\n${errorMsg}`,
              ttl: 3600000,
            },
            threadId,
            MessageType.GroupMessage,
          );
        }
      } catch (error) {
        console.error(`Lỗi khi gửi topchat in ${threadId}:`, error);
        if (error.message && error.message.includes("Không tồn tại")) {
          groupSettings[threadId].sendTask = false;
          writeGroupSettings(groupSettings);
        }
      } finally {
        if (imagePath) {
          await clearImagePath(imagePath);
        }
      }
    }
  }
}

async function sendTaskCalendar(api, timeToLive, caption) {
  const groupSettings = readGroupSettings();
  const today = getTimeNow();

  for (const threadId of Object.keys(groupSettings)) {
    if (groupSettings[threadId].sendTask) {
      let imagePath = null;
      try {
        const result = await generateCalendarImageForTask(api, today);

        if (result.imagePath) {
          imagePath = result.imagePath;
          await api.sendMessage(
            {
              msg: caption,
              attachments: [imagePath],
              ttl: 3600000,
            },
            threadId,
            MessageType.GroupMessage,
          );
        } else {
          const errorMsg = result.error || "Không thể tạo ảnh lịch.";
          await api.sendMessage(
            {
              msg: `${caption}\n\nLỗi: ${errorMsg}`,
              ttl: 30000,
            },
            threadId,
            MessageType.GroupMessage,
          );
        }
      } catch (error) {
        console.error(`Lỗi khi gửi lịch in ${threadId}:`, error);
        if (error.message && error.message.includes("Không tồn tại")) {
          groupSettings[threadId].sendTask = false;
          writeGroupSettings(groupSettings);
        }
      } finally {
        if (imagePath) {
          await clearImagePath(imagePath);
        }
      }
    }
  }
}

/**
 * Gửi ảnh thời tiết (Random)
 * @param {Object} api
 * @param {Number} timeToLive
 * @param {String} caption
 */
async function sendTaskWeather(api, timeToLive, caption) {
  const groupSettings = readGroupSettings();

  // === THÊM MỚI: Danh sách tỉnh thành ===
  const locations = [
    "Hà Nội",
    "Huế",
    "Quảng Ninh",
    "Cao Bằng",
    "Lạng Sơn",
    "Lai Châu",
    "Điện Biên",
    "Sơn La",
    "Thanh Hóa",
    "Nghệ An",
    "Hà Tĩnh",
    "Tuyên Quang",
    "Lào Cai",
    "Thái Nguyên",
    "Phú Thọ",
    "Bắc Ninh",
    "Hưng Yên",
    "Hải Phòng",
    "Ninh Bình",
    "Quảng Trị",
    "Đà Nẵng",
    "Quảng Ngãi",
    "Gia Lai",
    "Khánh Hòa",
    "Lâm Đồng",
    "Đắk Lắk",
    "Thành phố Hồ Chí Minh",
    "Đồng Nai",
    "Tây Ninh",
    "Cần Thơ",
    "Vĩnh Long",
    "Đồng Tháp",
    "An Giang",
    "Cà Mau",
  ];
  // ==================================

  for (const threadId of Object.keys(groupSettings)) {
    // === THAY ĐỔI: Chỉ kiểm tra sendTask ===
    if (groupSettings[threadId].sendTask) {
      let imagePath = null;

      // === THAY ĐỔI: Lấy random location ===
      const location = locations[Math.floor(Math.random() * locations.length)];

      try {
        // 1. Gọi hàm từ weather.js để tạo ảnh
        const result = await generateWeatherImageForTask(api, location);

        if (result.imagePath) {
          imagePath = result.imagePath;
          // 2. Gửi tin nhắn KÈM ảnh
          await api.sendMessage(
            {
              // === THAY ĐỔI: Thêm tên TP vào caption ===
              msg: `${caption}\nThời tiết tại: ${location}`,
              attachments: [imagePath], // Gắn ảnh thời tiết
              ttl: 3600000,
            },
            threadId,
            MessageType.GroupMessage,
          );
        } else {
          // 2b. Gửi tin nhắn lỗi
          const errorMsg =
            result.error || `Không thể tạo ảnh thời tiết cho ${location}.`;
          await api.sendMessage(
            {
              msg: `${caption}\n\nLỗi: ${errorMsg}`,
              ttl: 30000,
            },
            threadId,
            MessageType.GroupMessage,
          );
        }
      } catch (error) {
        console.error(`Lỗi khi gửi thời tiết in ${threadId}:`, error);
        if (error.message && error.message.includes("Không tồn tại")) {
          groupSettings[threadId].sendTask = false;
          writeGroupSettings(groupSettings);
        }
      } finally {
        // 3. Xóa file ảnh tạm
        if (imagePath) {
          await clearImagePath(imagePath);
        }
      }
    }
  }
}

export async function initializeScheduler(api) {
  scheduledTasks.forEach((taskConfig) => {
    schedule.scheduleJob(taskConfig.cronExpression, () => {
      taskConfig.task(api).catch((error) => {
        console.error("Lỗi khi thực thi tác vụ định kỳ:", error);
      });
    });
  });
}

// src/Nqduan-service/api-crawl/youtube/youtube-download-worker.js
import { parentPort, workerData } from "worker_threads";
import youtubedl from "youtube-dl-exec";
import fs from "fs/promises"; // Node.js core, dùng để kiểm tra file sau tải

/**
 * Gửi tin nhắn về luồng chính
 * @param {object} message - Nội dung tin nhắn
 */
function postMessage(message) {
  if (parentPort) {
    parentPort.postMessage(message);
  }
}

async function downloadVideo(videoUrl, videoPath, format, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const isAudioOnly =
        format === "bestaudio[ext=aac]/bestaudio[ext=m4a]/bestaudio";
      const options = {
        output: videoPath,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        noPlaylist: true, // Tránh tải playlist nếu không cần
        format: format || "bestvideo+bestaudio/best", // Mặc định tốt hơn cho video
        bufferSize: "1M", // Tăng buffer để giảm I/O
        concurrentFragments: 20, // Tăng song song để tải nhanh hơn
        fragmentRetries: 3, // Retry fragment lỗi
        addHeader: [
          "referer:youtube.com",
          "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ],
      };

      if (!isAudioOnly) {
        options.mergeOutputFormat = "mp4";
      }

      await youtubedl(videoUrl, options);

      // Kiểm tra file tồn tại và có kích thước > 0
      const stats = await fs.stat(videoPath).catch(() => null);
      if (stats && stats.size > 0) {
        postMessage({ success: true, videoPath, attempt });
        return;
      } else {
        throw new Error("Downloaded file is empty or missing");
      }
    } catch (error) {
      lastError = error;
      const errorMessage =
        error.stderr || error.message || "Unknown download error";
      if (
        attempt < maxRetries &&
        (errorMessage.includes("403") || errorMessage.includes("timeout"))
      ) {
        postMessage({
          retrying: true,
          attempt: attempt + 1,
          error: errorMessage.trim(),
        });
        continue; // Retry cho lỗi tạm thời
      }
      postMessage({
        success: false,
        error: errorMessage.trim(),
        attempt,
      });
      return;
    }
  }
  // Nếu hết retry
  postMessage({
    success: false,
    error: lastError?.message || "Max retries exceeded",
    attempt: maxRetries,
  });
}

// Chạy worker nếu có dữ liệu
if (workerData) {
  const { videoUrl, videoPath, format } = workerData;
  if (videoUrl && videoPath) {
    downloadVideo(videoUrl, videoPath, format);
  } else {
    postMessage({
      success: false,
      error: "Missing required properties (videoUrl or videoPath)",
    });
  }
} else {
  postMessage({ success: false, error: "Worker started without workerData" });
}

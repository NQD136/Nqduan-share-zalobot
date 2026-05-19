import axios from "axios";
import path from "path";
import fs from "fs";
import { getFileExtension, getFileSize } from "../../../../api-zalo/utils.js";
import { deleteFile, execAsync, uploadTempFile } from "../../../../utils/util.js";
import { tempDir } from "../../../../utils/io-json.js";

/**
 * Chuyển đổi file MP3 sang M4A
 */
export async function convertToM4A(inputPath) {
  const outputPath = inputPath.replace(".mp3", ".m4a");
  const timeStart = performance.now()
  try {
    const ffmpegCommand = [
      "ffmpeg",
      "-y",
      "-i", inputPath,
      "-vn",
      "-c:a", "aac",
      "-q:a", "2",
      outputPath
    ].join(" ");

    await execAsync(ffmpegCommand);
    const timeEnd = performance.now();
    console.log(`Thời gian chuyển đổi sang M4A: ${((timeEnd - timeStart) / 1000).toFixed(2)} s`);
    return outputPath;
  } catch (error) {
    console.error("Lỗi khi chuyển đổi sang M4A:", error);
    throw error;
  }
}

/**
 * Chuyển đổi file MP3 sang AAC
 */
export async function convertToAAC(inputPath) {
  const outputPath = inputPath.replace(".mp3", ".aac");
  try {
    const ffmpegCommand = [
      "ffmpeg",
      "-y",
      "-i", inputPath,
      "-vn",
      "-c:a", "aac",
      "-q:a", "2",
      outputPath
    ].join(" ");

    await execAsync(ffmpegCommand);
    return outputPath;
  } catch (error) {
    console.error("Lỗi khi chuyển đổi sang AAC:", error);
    throw error;
  }
}

/**
 * Upload file audio và trả về URL
 */
export async function uploadAudioFile(mp3Path, api, message, msid) {
  let accPath = null;
  try {
    let voiceFinalUrl;
    const fileSize = await getFileSize(mp3Path);
    if (fileSize > 9437184) {
      const ext = getFileExtension(mp3Path);
      if (ext == "mp3") {
        accPath = await convertToAAC(mp3Path);
        voiceFinalUrl = await api.uploadAttachment([accPath], message.threadId, message.type);
      } else if (ext == "aac" || ext == "m4a") {
        voiceFinalUrl = await api.uploadAttachment([mp3Path], message.threadId, message.type);
      }
      voiceFinalUrl = voiceFinalUrl[0].fileUrl;
    } else {
      voiceFinalUrl = await api.uploadAttachment([mp3Path], message.threadId, message.type);
      voiceFinalUrl = voiceFinalUrl[0].fileUrl;
    }
    if (!voiceFinalUrl.endsWith(".aac")) {
      voiceFinalUrl = voiceFinalUrl + `/${msid}.aac`;
    }
    return voiceFinalUrl;
  } catch (error) {
    throw error;
  } finally {
    // await deleteFile(accPath);
  }
}

/**
 * Tải Và Chuyển Đổi Âm Thanh Sang Dạng Tương Thích
 */
export async function downloadAndConvertAudio(url, api, message, msid) {
  const mp3Path = path.join(tempDir, `${msid}.mp3`);

  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(mp3Path);
      response.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const voiceFinalUrl = await uploadAudioFile(mp3Path, api, message);

    return voiceFinalUrl;
  } catch (error) {
    throw error;
  } finally {
    // await deleteFile(mp3Path);
  }
}

/**
 * Tách âm thanh từ video và chuyển đổi sang định dạng audio
 * @param {string|Buffer} input - URL video hoặc buffer của video
 * @returns {Promise<string>} URL của file âm thanh đã xử lý
 */
export async function extractAudioFromVideo(input, api, message, fid) {
  // const timeStart = performance.now();
  const tempVideoPath = path.join(tempDir, `temp_video_${Date.now()}.mp4`);
  const tempAudioPath = path.join(tempDir, `${Date.now()}.aac`);

  try {
    if (typeof input === 'string') {
      // Parse URL để xác định nguồn của video
      const urlObj = new URL(input);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Cấu hình headers cho các nền tảng khác nhau
      const headers = {
        // Headers cơ bản cho mọi request
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
      };
      
      // Headers bổ sung cho các nền tảng cụ thể
      if (hostname.includes('imgur.com')) {
        headers['Referer'] = 'https://imgur.com/';
        headers['Origin'] = 'https://imgur.com';
        headers['DNT'] = '1'; // Do Not Track
      } else if (hostname.includes('facebook.com') || hostname.includes('fbcdn.net')) {
        headers['Referer'] = 'https://www.facebook.com/';
        headers['Origin'] = 'https://www.facebook.com';
      } else if (hostname.includes('instagram.com') || hostname.includes('cdninstagram.com')) {
        headers['Referer'] = 'https://www.instagram.com/';
        headers['Origin'] = 'https://www.instagram.com';
        headers['x-ig-app-id'] = '936619743392459'; // Instagram app ID
      } else if (hostname.includes('tiktok.com')) {
        headers['Referer'] = 'https://www.tiktok.com/';
        headers['Origin'] = 'https://www.tiktok.com';
      } else if (hostname.includes('twitter.com') || hostname.includes('twimg.com')) {
        headers['Referer'] = 'https://twitter.com/';
        headers['Origin'] = 'https://twitter.com';
        headers['authorization'] = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'; // Twitter public Bearer token
      }
      
      // Thêm cookie nếu cần (cho một số trang web bảo mật cao)
      if (hostname.includes('imgur.com')) {
        headers['Cookie'] = 'over18=1; allows_sensitive_content=1';
      }

      const response = await axios({
        url: input,
        method: 'GET',
        responseType: 'stream',
        headers: headers,
        maxRedirects: 5,
        timeout: 30000, // 30s timeout
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tempVideoPath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } else {
      await fs.promises.writeFile(tempVideoPath, input);
    }

    // Kiểm tra xem file video tồn tại và có kích thước
    const stats = await fs.promises.stat(tempVideoPath);
    if (stats.size === 0) {
      throw new Error('Không thể tải video, file có kích thước 0 byte');
    }

    // Sử dụng ffprobe để kiểm tra thông tin video trước khi xử lý
    const ffprobeCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${tempVideoPath}`;
    try {
      await execAsync(ffprobeCommand);
    } catch (error) {
      throw new Error('File video không hợp lệ hoặc bị hỏng');
    }

    const ffmpegCommand = [
      "ffmpeg",
      "-y",
      "-i", tempVideoPath,
      "-vn",
      "-c:a", "aac",
      "-q:a", "2",
      tempAudioPath
    ].join(" ");

    await execAsync(ffmpegCommand);

    // Kiểm tra file âm thanh đã được tạo thành công
    const audioStats = await fs.promises.stat(tempAudioPath);
    if (audioStats.size === 0) {
      throw new Error('Không thể trích xuất âm thanh từ video');
    }

    const voiceFinalUrl = await uploadAudioFile(tempAudioPath, api, message);

    // const timeEnd = performance.now();
    // console.log(`Thời gian xử lý âm thanh: ${((timeEnd - timeStart) / 1000).toFixed(2)} s`);

    return voiceFinalUrl;

  } catch (error) {
    console.error("Chi tiết lỗi trong extractAudioFromVideo:", error);
    throw error;
  } finally {
    await Promise.all([
      deleteFile(tempVideoPath),
      deleteFile(tempAudioPath)
    ]);
  }
}
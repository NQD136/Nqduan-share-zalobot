import FormData from "form-data";
import axios from "axios";
import fs from "fs";
import path, { resolve } from "path";
import { tempDir } from "./io-json.js";
import { exec } from "child_process";
import { promisify } from "util";
import sharp from "sharp";
import { analyzeLinks } from "../api-zalo/utils.js";

export function restartSelf(api, message, aliasCommand) {
  const { threadId, type } = message;
  try {
    api.sendMessage({ msg:' 🤖 Bot đang khởi động lại 🔂', quote: message, ttl: 5000 }, threadId, type);
    const logsDir = path.resolve('logs');
    const restartFile = path.join(logsDir, 'restart.txt');
    const now = new Date().toISOString();

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const logContent = `time: ${now}\nthreadId: ${threadId}\ntype: ${type}\n`;
    fs.writeFileSync(restartFile, logContent, 'utf8');
    // console.log(`Đã ghi log restart vào ${restartFile}`);

    // Restart bằng pm2
    exec('pm2 restart admin', (err, stdout, stderr) => {
      if (err) {
        console.error('Lỗi khi restart bot:', err);
        return;
      }
      // console.log('Bot đã restart thành công:', stdout);
    });

  } catch (err) {
    console.error("Lỗi khi restart:", err);
  }
}
// Hàm kiểm tra file restart.txt
export function checkRestartFile(api) {
  try {
    const restartFile = path.resolve('logs/restart.txt');

    if (!fs.existsSync(restartFile)) {
      // console.log("Không tìm thấy file restart.txt, bỏ qua.");
      return;
    }

    const content = fs.readFileSync(restartFile, 'utf8');
    const lines = content.split('\n');
    const timeLine = lines.find(line => line.startsWith('time:'));

    if (!timeLine) {
      console.log("File restart.txt không đúng định dạng.");
      return;
    }

    const startTimeStr = timeLine.replace('time: ', '').trim();
    const startTime = new Date(startTimeStr);
    const now = new Date();
    const diffSeconds = Math.floor((now - startTime) / 1000);

    // Lấy threadId và type từ file
    const threadIdLine = lines.find(line => line.startsWith('threadId:'));
    const typeLine = lines.find(line => line.startsWith('type:'));
    const threadId = threadIdLine ? threadIdLine.replace('threadId: ', '').trim() : null;
    const type = typeLine ? typeLine.replace('type: ', '').trim() : null;

    if (!threadId || !type) {
      console.log("Không tìm thấy threadId hoặc type trong file restart.txt.");
      return;
    }

    const msg = `🤖Bot đã khởi động lại ✔️\n🕛Thời gian khởi động lại: ${diffSeconds} giây`;
    api.sendMessage({ msg, ttl: 60000 }, threadId, type);

    // Xóa file restart.txt
    fs.unlinkSync(restartFile);
    // console.log("Đã gửi tin nhắn thông báo và xoá restart.txt");
  } catch (error) {
    console.error("Lỗi khi kiểm tra file restart.txt:", error);
  }
}


export async function checkUrlStatus(url) {
	try {
		const response = await axios.head(url, {
			timeout: 5000,
		});
		return response.status === 200;
	} catch (error) {
		console.log(`Link đã gãy hoặc timeout: ${url}`);
		return false;
	}
}

export function checkLinkIsValid(content) {
  try {
    if (!content || typeof content !== 'string') return false;
    content = content.trim();
    if (!content.match(/^https?:\/\//i)) {
      content = 'https://' + content;
    }
    new URL(content);
    return true;
  } catch {
    return false;
  }
}

export const execAsync = promisify(exec);

export async function uploadTempFile(pathLocal, serviceType = 1) {
  // const startTime = performance.now();
  let result = null;

  try {
    if (serviceType === 2) result = await uploadToTmpFile(pathLocal);
    if (!result) {
      result = await uploadToUguu(pathLocal);
    }
  } catch (error) {
    result = await uploadToUguu(pathLocal);
  }
  try {
    if (serviceType === 1) result = await uploadToUguu(pathLocal);
    if (!result) {
      result = await uploadToTmpFile(pathLocal);
    }
  } catch (error) {
    result = await uploadToTmpFile(pathLocal);
  }

  // const endTime = performance.now();
  // const duration = (endTime - startTime) / 1000;

  // if (duration.toFixed(2) > 1) {
  //   console.log(`⏱️ Thời gian upload file bằng service ${serviceType}: ${duration.toFixed(2)} giây`);
  // }
  return result;
}

/**
 * Upload file lên tmpfiles.org
 */
export async function uploadToTmpFile(pathLocal) {
  try {
    const fileName = path.basename(pathLocal);
    const buffer = fs.createReadStream(pathLocal);
    const formData = new FormData();
    formData.append("file", buffer, {
      filename: fileName,
    });

    const response = await axios.post("https://tmpfiles.org/api/v1/upload", formData, {
      headers: formData.getHeaders(),
    });

    if (response.status === 200 && response.data.data.url) {
      const downloadUrl = response.data.data.url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
      return downloadUrl;
    } else {
      console.error("Lỗi khi upload:", response.data);
      return null;
    }
  } catch (error) {
    console.error("Lỗi khi upload lên dịch vụ tempfile:", error);
    return null;
  }
}

/**
 * Upload file lên uguu.se
 */
export async function uploadToUguu(pathLocal) {
  try {
    const fileName = path.basename(pathLocal);
    const buffer = fs.createReadStream(pathLocal);

    const formData = new FormData();
    formData.append("files[]", buffer, fileName);
    formData.append("randomname", "true");

    const response = await axios.post("https://uguu.se/upload.php", formData, {
      headers: {
        ...formData.getHeaders(),
        accept: "application/json",
      },
    });

    if (response.status === 200 && response.data) {
      return response.data.files[0].url;
    } else {
      console.error("Lỗi upload:", response.data);
      return null;
    }
  } catch (error) {
    console.error("Lỗi khi upload lên Uguu:", error.message);
    return null;
  }
}

/**
 * Download file từ URL và lưu vào file với các options phù hợp theo loại file
 */
export async function downloadFileFake(url, filepath) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000,
    });
    let ext;
    try {
      ext = await checkExstentionFileRemote(url);
    } catch (e) {
      console.error("Lỗi lấy extension:", e.message);
      ext = 'tmp'; // Fallback
    }
    const tempFilePath = filepath || path.join(tempDir, `fileDownload_${Date.now()}.${ext || 'tmp'}`);
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);
      writer.on("finish", () => resolve(tempFilePath));
      writer.on("error", reject);
    });
  } catch (error) {
    console.error("Lỗi downloadFile:", error.message);
    throw error;
  }
}
export async function downloadFile(url, filepath) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });
  const tempFilePath = filepath || path.join(tempDir, `fileDownload_${Date.now()}.${checkExstentionFileRemote(url)}`);
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tempFilePath);
    response.data.pipe(writer);
    writer.on("finish", () => {
      resolve(tempFilePath);
    });
    writer.on("error", reject);
  });
}
/**
 * Download video từ URL và lưu vào file
 */
export async function downloadAndSaveVideo(videoUrl) {
  const videoResponse = await axios({
    method: "GET",
    url: videoUrl,
    responseType: "arraybuffer",
  });

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const tempFilePath = path.join(tempDir, `video_${Date.now()}.mp4`);
  fs.writeFileSync(tempFilePath, videoResponse.data);

  return tempFilePath;
}

/**
 * Xóa file theo đường dẫn
 */
// export async function deleteFile(pathFile) {
  // if (!pathFile) return;
  // let attempts = 0;
  // const maxAttempts = 3;

  // while (attempts < maxAttempts) {
    // try {
      // if (fs.existsSync(pathFile)) {
        // fs.unlinkSync(pathFile);
        // if (!fs.existsSync(pathFile)) {
          // return;
        // }
      // } else {
        // return;
      // }
    // } catch (error) {
    // }
    // attempts++;

    // if (attempts < maxAttempts) {
      // await new Promise(resolve => setTimeout(resolve, 100));
    // }
  // }
// }

// Danh sách các định dạng file nhạc được hỗ trợ
// const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.ogg', '.wav', '.flac', '.aac', '.wma'];
// const AUDIO_DIR = '/var/www/html/audio';
// const PLAYLIST_PATH = '/var/www/html/data/playlist.json';
// const CACHE_LINK_PATH = '/root/ndq/assets/json-data/cache-link.json';

// // Hàm kiểm tra xem file có phải là file nhạc không
// function isAudioFile(filePath) {
  // const ext = path.extname(filePath).toLowerCase();
  // return AUDIO_EXTENSIONS.includes(ext);
// }

// // Hàm tìm thông tin bài hát từ cache-link.json (cải tiến)
// async function findSongDataFromCache(fileName) {
  // const MAX_RETRIES = 3;
  // const RETRY_DELAY = 2000; // 2 giây
  
  // for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // try {
      // console.log(`Attempt ${attempt}/${MAX_RETRIES} - Đang tìm thông tin cho file: ${fileName}`);
      // console.log(`Đường dẫn cache: ${CACHE_LINK_PATH}`);
      
      // if (!fs.existsSync(CACHE_LINK_PATH)) {
        // console.log(`File cache không tồn tại tại: ${CACHE_LINK_PATH}`);
        // return null;
      // }
      
      // // Đợi một chút để đảm bảo file đã được flush
      // await new Promise(resolve => setTimeout(resolve, 1000));
      
      // // Với ES modules, đọc file trực tiếp (không có require cache)
      // const cacheData = JSON.parse(fs.readFileSync(CACHE_LINK_PATH, { 
        // encoding: 'utf8'
      // }));
      
      // // Log thông tin debug
      // console.log('📊 Cache data overview:', {
        // sources: Object.keys(cacheData),
        // totalEntries: Object.values(cacheData).reduce((sum, source) => 
          // sum + (typeof source === 'object' ? Object.keys(source).length : 0), 0
        // )
      // });
      
      // const baseName = path.basename(fileName, path.extname(fileName));
      // console.log(`🔍 Tên file cần tìm: ${baseName}`);
      
      // // Tìm trong 5 nguồn: soundcloud, zingmp3, nhaccuatui, youtube, tiktok
      // const sources = ['soundcloud', 'zingmp3', 'nhaccuatui', 'youtube', 'tiktok'];
      
      // for (const source of sources) {
        // if (cacheData[source] && typeof cacheData[source] === 'object') {
          // const sourceEntries = Object.keys(cacheData[source]);
          // console.log(`🔍 Đang tìm trong ${source} (${sourceEntries.length} entries)`);
          
          // // Tìm theo key (ID) - exact match
          // if (cacheData[source][baseName]) {
            // console.log(`✅ Tìm thấy thông tin bài hát từ ${source} với key: ${baseName}`);
            // return {
              // ...cacheData[source][baseName],
              // source: source
            // };
          // }
          
          // // Tìm theo title (tên file có thể là title)
          // for (const [key, songData] of Object.entries(cacheData[source])) {
            // if (songData && songData.title) {
              // // Normalize strings để so sánh
              // const titleNormalized = songData.title
                // .toLowerCase()
                // .replace(/[^a-z0-9\s]/g, '')
                // .replace(/\s+/g, ' ')
                // .trim();
              // const baseNameNormalized = baseName
                // .toLowerCase()
                // .replace(/[^a-z0-9\s]/g, '')
                // .replace(/\s+/g, ' ')
                // .trim();
              
              // // So sánh exact match trước
              // if (titleNormalized === baseNameNormalized) {
                // console.log(`✅ Tìm thấy EXACT match từ ${source}`);
                // console.log(`   Key: ${key}, Title: ${songData.title}`);
                // return {
                  // ...songData,
                  // source: source,
                  // originalKey: key
                // };
              // }
              
              // // Sau đó so sánh partial match
              // if (titleNormalized.includes(baseNameNormalized) || 
                  // baseNameNormalized.includes(titleNormalized)) {
                // console.log(`✅ Tìm thấy PARTIAL match từ ${source}`);
                // console.log(`   Key: ${key}, Title: ${songData.title}`);
                // console.log(`   Normalized title: "${titleNormalized}"`);
                // console.log(`   Normalized filename: "${baseNameNormalized}"`);
                // return {
                  // ...songData,
                  // source: source,
                  // originalKey: key
                // };
              // }
            // }
          // }
        // } else {
          // console.log(`⚠️  Nguồn ${source} không có dữ liệu hoặc không phải object`);
        // }
      // }
      
      // console.log(`❌ Attempt ${attempt}: Không tìm thấy thông tin bài hát cho: ${fileName}`);
      
      // // Nếu không phải attempt cuối, đợi trước khi retry
      // if (attempt < MAX_RETRIES) {
        // console.log(`⏳ Đợi ${RETRY_DELAY/1000}s trước khi retry...`);
        // await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      // }
      
    // } catch (error) {
      // console.error(`❌ Attempt ${attempt} - Lỗi khi đọc cache-link.json:`, error.message);
      
      // // Nếu không phải attempt cuối, đợi trước khi retry
      // if (attempt < MAX_RETRIES) {
        // await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      // }
    // }
  // }
  
  // console.log(`🚫 Đã thử ${MAX_RETRIES} lần nhưng vẫn không tìm thấy thông tin cho: ${fileName}`);
  // return null;
// }

// // Với ES modules, không cần clear cache vì JSON files không được cache như CommonJS

// // Hàm kiểm tra file có đang được sử dụng không
// function isFileInUse(filePath) {
  // try {
    // // Thử mở file với exclusive access
    // const fd = fs.openSync(filePath, 'r+');
    // fs.closeSync(fd);
    // return false;
  // } catch (error) {
    // return true;
  // }
// }

// // Hàm đọc file an toàn với retry
// async function safeReadJsonFile(filePath, maxRetries = 3) {
  // for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // try {
      // // Kiểm tra file có đang được sử dụng không
      // if (isFileInUse(filePath)) {
        // console.log(`⏳ Attempt ${attempt}: File đang được sử dụng, đợi...`);
        // await new Promise(resolve => setTimeout(resolve, 1000));
        // continue;
      // }
      
      // // Đọc file
      // const data = fs.readFileSync(filePath, { 
        // encoding: 'utf8',
        // flag: 'r'
      // });
      
      // return JSON.parse(data);
    // } catch (error) {
      // console.error(`❌ Attempt ${attempt} failed:`, error.message);
      
      // if (attempt < maxRetries) {
        // await new Promise(resolve => setTimeout(resolve, 1000));
      // } else {
        // throw error;
      // }
    // }
  // }
// }

/**
 * Kiểm tra và xác định định dạng file từ URL từ xa
 * 
 * @param {string} url - URL của file cần kiểm tra
 * @returns {Promise<string|null>} - Trả về phần mở rộng của file hoặc null nếu không xác định được
 */
export async function checkExstentionFileRemote(url) {
  let attempts = 0;
  const maxAttempts = 3;
  const retryDelayMs = 500;
  
  // Map mở rộng cho các định dạng MIME
  const mimeToExt = {
    // Hình ảnh
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/tiff': 'tiff',
    'image/bmp': 'bmp',
    
    // Video
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/x-flv': 'flv',
    'video/3gpp': '3gp',
    'video/3gpp2': '3g2',
    
    // Âm thanh
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'weba',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/x-ms-wma': 'wma',
    
    // Tài liệu
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    
    // Nén
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'application/x-tar': 'tar',
    'application/x-gzip': 'gz',
    'application/x-bzip2': 'bz2',
    'application/x-xz': 'xz',
    'application/gzip': 'gz'
  };

  /**
   * Tạo headers tùy chỉnh cho từng trang web
   * @param {string} url - URL cần tạo headers
   * @returns {Object} - Headers tùy chỉnh
   */
  function createHeaders(url) {
    // Headers cơ bản cho tất cả các requests
    const headers = {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="121", "Google Chrome";v="121", "Not:A-Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"'
    };

    // Headers tùy chỉnh theo domain
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Xác định domain và thiết lập headers tương ứng
      if (hostname.includes('tiktok.com') || hostname.includes('tiktokcdn')) {
        headers['Referer'] = 'https://www.tiktok.com/';
        headers['Origin'] = 'https://www.tiktok.com';
        headers['Sec-Fetch-Dest'] = 'video';
        headers['Sec-Fetch-Mode'] = 'no-cors';
      } 
      else if (hostname.includes('facebook.com') || hostname.includes('fbcdn.net')) {
        headers['Referer'] = 'https://www.facebook.com/';
        headers['Origin'] = 'https://www.facebook.com';
        headers['sec-ch-ua'] = '"Facebook";v="1", "Chrome";v="121"';
      } 
      else if (hostname.includes('instagram.com') || hostname.includes('cdninstagram.com')) {
        headers['Referer'] = 'https://www.instagram.com/';
        headers['Origin'] = 'https://www.instagram.com';
        headers['x-ig-app-id'] = '936619743392459'; // Instagram app ID
      } 
      else if (hostname.includes('imgur.com') || hostname.includes('i.imgur.com')) {
        headers['Referer'] = 'https://imgur.com/';
        headers['Origin'] = 'https://imgur.com';
        headers['DNT'] = '1';
        headers['TE'] = 'Trailers';
        headers['Authorization'] = 'Client-ID 546c25a59c58ad7'; // Public Imgur API client ID
      } 
      else if (hostname.includes('twitter.com') || hostname.includes('twimg.com')) {
        headers['Referer'] = 'https://twitter.com/';
        headers['Origin'] = 'https://twitter.com';
        headers['x-twitter-client-version'] = '10.0.0';
      }
      else if (hostname.includes('giphy.com') || hostname.includes('media.giphy.com')) {
        headers['Referer'] = 'https://giphy.com/';  
        headers['Origin'] = 'https://giphy.com';
      }
      else if (hostname.includes('tenor.com') || hostname.includes('media.tenor.com')) {
        headers['Referer'] = 'https://tenor.com/';
        headers['Origin'] = 'https://tenor.com';
      }
      else if (hostname.includes('cloudfront.net')) {
        headers['Referer'] = 'https://www.amazon.com/';
        headers['Origin'] = 'https://www.amazon.com';
      }
      else if (hostname.includes('pinimg.com')) {
        headers['Referer'] = 'https://www.pinterest.com/';
        headers['Origin'] = 'https://www.pinterest.com';
      }
    } catch (error) {
      // Nếu không parse được URL, vẫn dùng headers mặc định
      console.log("Không thể phân tích URL:", error.message);
    }

    return headers;
  }

  // Hàm trích xuất phần mở rộng từ URL
  const getExtensionFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Kiểm tra xem có phải imgur URL không và xử lý đặc biệt
      if (urlObj.hostname.includes('imgur.com')) {
        // Imgur đôi khi không có phần mở rộng trong URL
        const pathSegments = pathname.split('/');
        const lastSegment = pathSegments.pop() || '';
        
        // Nếu không có phần mở rộng trong URL imgur, thường là jpg hoặc png
        if (!lastSegment.includes('.')) {
          // Imgur thường dùng jpg
          return 'jpg';
        }
      }
      
      const filename = pathname.split('/').pop();
      if (!filename) return null;
      
      // Xử lý trường hợp có query string trong phần cuối
      const filenameNoQuery = filename.split('?')[0];
      const extension = filenameNoQuery.split('.').pop().toLowerCase();
      
      // Kiểm tra xem phần mở rộng có hợp lệ không (không quá dài)
      return (extension && extension.length <= 5) ? extension : null;
    } catch (error) {
      console.error("Lỗi khi phân tích URL:", error.message);
      return null;
    }
  };

  // Hàm lấy phần mở rộng từ Content-Disposition
  const getExtensionFromDisposition = (disposition) => {
    if (!disposition) return null;
    
    // Kiểm tra các kiểu filename khác nhau
    const filenameRegexps = [
      /filename=["']?([^"';]+)["']?/i,
      /filename\*=UTF-8''([^"';]+)/i,
      /filename\*=([^"';]+)/i
    ];
    
    for (const regex of filenameRegexps) {
      const match = disposition.match(regex);
      if (match && match[1]) {
        try {
          const filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
          const extension = filename.split('.').pop().toLowerCase();
          if (extension && extension.length <= 5) return extension;
        } catch (e) {
          // Nếu có lỗi khi decode URI, thử phương pháp khác
          const filename = match[1].replace(/['"]/g, '');
          const extension = filename.split('.').pop().toLowerCase();
          if (extension && extension.length <= 5) return extension;
        }
      }
    }
    
    return null;
  };

  // Hàm xử lý đặc biệt cho Imgur
  const handleImgur = async (url) => {
    // Kiểm tra xem có phải URL imgur không
    if (!url.includes('imgur.com')) return null;
    
    try {
      // Kiểm tra phần mở rộng trực tiếp từ URL trước
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || '';
      
      // Kiểm tra xem URL có định dạng rõ ràng không
      const filenameParts = filename.split('.');
      if (filenameParts.length > 1) {
        const extension = filenameParts.pop().toLowerCase();
        // Nếu đã có phần mở rộng hợp lệ trong URL, dùng nó luôn
        if (extension && extension.length <= 5 && Object.values(mimeToExt).includes(extension)) {
          return extension;
        }
      }
      
      // Phân tích ID của ảnh từ URL Imgur
      const imgurId = filename.split('.')[0];
      
      // Kiểm tra video Imgur (.mp4, .gif, .gifv)
      if (url.includes('.mp4')) return 'mp4';
      if (url.includes('.gifv')) return 'gif'; // Imgur gifv thực chất là mp4 hoặc webm
      if (url.includes('.gif')) return 'gif';
      
      // Xác định phương thức tiếp cận dựa trên cách Imgur phân phối nội dung
      let imgurHeaders;
      
      // Thử nhiều phương pháp với độ trễ giữa các lần thử
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Tạo headers đặc biệt cho Imgur với mỗi lần thử khác nhau
          imgurHeaders = createHeaders(url);
          
          // Thay đổi một số headers để tránh trùng lặp signature
          if (attempt === 1) {
            imgurHeaders['Accept'] = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8';
            imgurHeaders['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
            imgurHeaders['Referer'] = 'https://imgur.com/gallery/';
          } else if (attempt === 2) {
            imgurHeaders['Accept'] = '*/*';
            imgurHeaders['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
            imgurHeaders['Referer'] = 'https://imgur.com/a/';
            // Xóa một số headers không cần thiết để tạo sự khác biệt
            delete imgurHeaders['sec-ch-ua'];
            delete imgurHeaders['sec-ch-ua-mobile'];
          }
          
          // Thêm delay ngẫu nhiên để tránh rate limit
          const delayMs = 1000 + Math.floor(Math.random() * 2000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          
          // Thử sử dụng HEAD trước (ít dữ liệu)
          if (attempt === 0) {
            try {
              const headResponse = await axios.head(url, {
                headers: imgurHeaders,
                timeout: 6000,
                maxRedirects: 3,
                validateStatus: status => status < 400
              });
              
              // Kiểm tra Content-Type từ HEAD
              const contentType = headResponse.headers['content-type']?.toLowerCase();
              if (contentType) {
                const baseContentType = contentType.split(';')[0].trim();
                if (mimeToExt[baseContentType]) {
                  return mimeToExt[baseContentType];
                }
              }
              
              // Kiểm tra Content-Disposition từ HEAD
              const contentDisposition = headResponse.headers['content-disposition'];
              if (contentDisposition) {
                const dispositionExt = getExtensionFromDisposition(contentDisposition);
                if (dispositionExt) return dispositionExt;
              }
            } catch (headError) {
              // Nếu HEAD thất bại (thường do bị chặn), tiếp tục với GET
              console.log("HEAD request bị từ chối bởi Imgur, chuyển sang GET:", headError.message);
            }
          }
          
          // Thử với GET và chỉ lấy phần đầu của file
          const getResponse = await axios.get(url, {
            headers: { ...imgurHeaders, Range: 'bytes=0-512' }, // Chỉ lấy 512 bytes đầu tiên
            responseType: 'arraybuffer',
            timeout: 10000,
            maxRedirects: 5,
            // Chấp nhận cả status 429 để xử lý riêng
            validateStatus: status => status === 200 || status === 206 || status === 429
          });
          
          // Kiểm tra xem có bị rate limit không (status 429)
          if (getResponse.status === 429) {
            console.log("Bị rate limit (429) từ Imgur, thử lại sau:", attempt);
            // Tăng thời gian chờ lên đáng kể
            await new Promise(resolve => setTimeout(resolve, 5000 + (attempt * 2000)));
            continue; // Thử lại
          }
          
          // Kiểm tra Content-Type từ response
          const contentType = getResponse.headers['content-type']?.toLowerCase();
          if (contentType) {
            const baseContentType = contentType.split(';')[0].trim();
            if (mimeToExt[baseContentType]) {
              return mimeToExt[baseContentType];
            }
          }
          
          // Nếu không có Content-Type rõ ràng, kiểm tra signature của file
          if (getResponse.data && getResponse.data.length > 0) {
            const buffer = Buffer.from(getResponse.data);
            
            // Kiểm tra các signature
            if (buffer.length >= 8) {
              // JPEG/JPG signature
              if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
                return 'jpg';
              }
              // PNG signature
              if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
                return 'png';
              }
              // GIF signature
              if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
                return 'gif';
              }
              // WebP
              if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
                  buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
                return 'webp';
              }
              // MP4 (MPEG-4)
              if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
                return 'mp4';
              }
            }
          }
          
          // Nếu thành công nhưng không xác định được, dùng Imgur API để thử
          break;
        } catch (attemptError) {
          console.log(`Lỗi trong lần thử ${attempt + 1} với Imgur:`, attemptError.message);
          // Tăng thời gian chờ giữa các lần thử
          await new Promise(resolve => setTimeout(resolve, 3000 + (attempt * 1500)));
        }
      }
      
      // Thử phương pháp cuối cùng: dựa vào ID của ảnh và kiểm tra định dạng thường gặp
      
      // Imgur ID thường có dạng 7 ký tự chữ và số
      if (imgurId && imgurId.length >= 5 && imgurId.length <= 10) {
        // Kiểm tra một số định dạng phổ biến cho Imgur
        
        // 1. Thử xác định từ pattern URL
        if (url.includes('/a/')) {
          // URL album thường chứa nhiều ảnh, jpg là phổ biến nhất
          return 'jpg';
        }
        
        // 2. Cách xác định cho Imgur: đa số là JPG
        // Imgur phần lớn là JPG, tiếp theo là PNG và GIF
        return 'jpg';
      }
      
      // Mặc định cho Imgur luôn là jpg
      return 'jpg';
    } catch (error) {
      console.error("Lỗi khi xử lý URL Imgur:", error.message);
      // Mặc định: Hầu hết Imgur là JPG
      return 'jpg';
    }
  };

  // Bắt đầu việc kiểm tra định dạng
  while (attempts < maxAttempts) {
    try {
      // Nếu là URL Imgur, xử lý đặc biệt
      if (url.includes('imgur.com')) {
        const imgurExt = await handleImgur(url);
        if (imgurExt) return imgurExt;
      }
      
      // Kiểm tra phần mở rộng từ URL
      const urlExtension = getExtensionFromUrl(url);
      if (urlExtension && Object.values(mimeToExt).includes(urlExtension)) {
        return urlExtension;
      }

      // Tạo headers tùy chỉnh theo domain
      const headers = createHeaders(url);
      
      // Thử phương thức HEAD trước
      try {
        const headResponse = await axios.head(url, { 
          headers: headers,
          timeout: 5000,
          maxRedirects: 5,
          validateStatus: status => status < 400
        });
        
        // Kiểm tra Content-Type
        const contentType = headResponse.headers['content-type']?.toLowerCase();
        if (contentType) {
          const baseContentType = contentType.split(';')[0].trim();
          if (mimeToExt[baseContentType]) {
            return mimeToExt[baseContentType];
          }
          
          // Kiểm tra một phần
          for (const [mime, ext] of Object.entries(mimeToExt)) {
            if (baseContentType.includes(mime.split('/')[1])) {
              return ext;
            }
          }
        }
        
        // Kiểm tra Content-Disposition
        const contentDisposition = headResponse.headers['content-disposition'];
        const dispositionExt = getExtensionFromDisposition(contentDisposition);
        if (dispositionExt) {
          return dispositionExt;
        }
      } catch (headError) {
        // Nếu HEAD không thành công, tiếp tục với phương thức GET
        console.log("Không thể dùng phương thức HEAD, thử dùng GET:", headError.message);
      }
      
      // Nếu HEAD không thành công hoặc không xác định được, thử GET
      const getHeaders = { ...headers, Range: 'bytes=0-1024' };
      const getResponse = await axios.get(url, {
        headers: getHeaders,
        responseType: 'arraybuffer',
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: status => status < 400
      });
      
      // Kiểm tra Content-Type
      const contentType = getResponse.headers['content-type']?.toLowerCase();
      if (contentType) {
        const baseContentType = contentType.split(';')[0].trim();
        if (mimeToExt[baseContentType]) {
          return mimeToExt[baseContentType];
        }
        
        // Kiểm tra một phần
        for (const [mime, ext] of Object.entries(mimeToExt)) {
          if (baseContentType.includes(mime.split('/')[1])) {
            return ext;
          }
        }
      }
      
      // Kiểm tra Content-Disposition
      const contentDisposition = getResponse.headers['content-disposition'];
      const dispositionExt = getExtensionFromDisposition(contentDisposition);
      if (dispositionExt) {
        return dispositionExt;
      }
      
      // Kiểm tra signature bytes cho các loại file phổ biến
      const buffer = Buffer.from(getResponse.data);
      
      if (buffer.length >= 12) {
        // JPEG/JPG signature
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
          return 'jpg';
        }
        // PNG signature
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
          return 'png';
        }
        // GIF signature
        if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
          return 'gif';
        }
        // MP4, M4A, M4V (MPEG-4)
        if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
          return 'mp4';
        }
        // MP3 (ID3v2)
        if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
          return 'mp3';
        }
        // WAV
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
            buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
          return 'wav';
        }
        // WebP
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
            buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
          return 'webp';
        }
        // Matroska (MKV/WebM)
        if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
          return 'mkv';
        }
      }
      
      // Nếu không xác định được, trả về phần mở rộng từ URL
      return urlExtension || null;

    } catch (error) {
      // Tăng số lần thử và chờ trước khi thử lại
      attempts++;
      
      // Kiểm tra nếu response có headers
      if (error.response?.headers) {
        const contentType = error.response.headers['content-type']?.toLowerCase();
        if (contentType) {
          const baseContentType = contentType.split(';')[0].trim();
          if (mimeToExt[baseContentType]) {
            return mimeToExt[baseContentType];
          }
        }
        
        const contentDisposition = error.response.headers['content-disposition'];
        const dispositionExt = getExtensionFromDisposition(contentDisposition);
        if (dispositionExt) {
          return dispositionExt;
        }
      }
      
      if (attempts === maxAttempts) {
        console.error(`Không thể xác định định dạng file sau ${maxAttempts} lần thử:`, error.message);
        
        // Trường hợp đặc biệt cho Imgur
        if (url.includes('imgur.com')) {
          return 'jpg'; // Định dạng mặc định cho Imgur
        }
        
        // Trường hợp cuối cùng, thử lấy từ URL
        return getExtensionFromUrl(url);
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempts)); // Tăng thời gian chờ theo số lần thử
    }
  }
  
  return null;
}

/**
 * Tải và chuyển đổi ảnh sang PNG buffer từ đường dẫn hoặc URL
 * @param {string} source - Đường dẫn file hoặc URL của ảnh
 * @returns {Promise<Buffer>} Buffer dạng PNG của ảnh
 */
export async function loadImageBuffer(source) {
  try {
    let buffer;

    if (source.startsWith("http://") || source.startsWith("https://")) {
      const response = await axios({
        url: source,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: 3000
      });
      buffer = Buffer.from(response.data);
    } else {
      buffer = await fs.promises.readFile(source);
    }

    const pngBuffer = await sharp(buffer)
      .png()
      .toBuffer();

    return pngBuffer;
  } catch (error) {
    console.error("Lỗi khi xử lý ảnh:", error.message);
    return null;
  }
}

/**
 * Lấy thông tin kích thước và dung lượng của ảnh thông qua ffmpeg
 * @param {string} imageUrl - URL hoặc đường dẫn của ảnh
 * @returns {Promise<{width: number, height: number, totalSize: number}>} Thông tin kích thước và dung lượng của ảnh
 */
export async function getImageInfo(imageUrl) {
  try {
    const response = await axios.head(imageUrl);
    const totalSize = parseInt(response.headers['content-length'] || 0);

    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });

    const metadata = await sharp(Buffer.from(imageResponse.data)).metadata();

    return {
      width: metadata.width || 500,
      height: metadata.height || 500,
      totalSize: totalSize || 0
    };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin ảnh:", error.message);
    return null;
  }
}



// import fs from 'fs';
// import path from 'path';

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.ogg', '.wav', '.flac', '.aac', '.wma'];
const AUDIO_DIR = '/var/www/html/audio';
const PLAYLIST_PATH = '/var/www/html/data/playlist.json';
const CACHE_LINK_PATH = '/root/ndq/assets/json-data/cache-link.json';

// Hàm kiểm tra xem file có phải là file nhạc không
function isAudioFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}

// Hàm đọc cache với retry và validation
async function readCacheFile(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Đọc cache file - lần thử ${attempt}/${maxRetries}`);
      
      if (!fs.existsSync(CACHE_LINK_PATH)) {
        console.log(`❌ File cache không tồn tại: ${CACHE_LINK_PATH}`);
        return null;
      }

      // Kiểm tra file size để đảm bảo file đã được ghi xong
      const stats = fs.statSync(CACHE_LINK_PATH);
      if (stats.size === 0) {
        console.log(`⚠️ File cache rỗng, đang thử lại...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      const cacheContent = fs.readFileSync(CACHE_LINK_PATH, 'utf8');
      
      // Kiểm tra nội dung có phải JSON hợp lệ không
      if (!cacheContent.trim()) {
        console.log(`⚠️ File cache rỗng, đang thử lại...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      const cacheData = JSON.parse(cacheContent);
      // console.log(`✅ Đọc cache thành công - Size: ${stats.size} bytes`);
      
      // Log tổng số items trong cache
      const totalItems = Object.values(cacheData).reduce((sum, source) => {
        return sum + (typeof source === 'object' ? Object.keys(source).length : 0);
      }, 0);
      // console.log(`📊 Tổng số bài hát trong cache: ${totalItems}`);
      
      return cacheData;

    } catch (error) {
      console.error(`❌ Lỗi đọc cache (lần ${attempt}):`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.error(`❌ Không thể đọc cache sau ${maxRetries} lần thử`);
  return null;
}

// Hàm chuẩn hóa tên để so sánh
function normalizeString(str) {
  return str.toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Hàm tìm thông tin bài hát từ cache-link.json (cải thiện)
async function findSongDataFromCache(fileName) {
  // console.log(`🔍 Bắt đầu tìm kiếm cho file: ${fileName}`);
  
  // Đợi một chút để đảm bảo file được ghi xong
  await new Promise(resolve => setTimeout(resolve, 12000));
  
  const cacheData = await readCacheFile();
  if (!cacheData) {
    return null;
  }

  const baseName = path.basename(fileName, path.extname(fileName));
  const normalizedBaseName = normalizeString(baseName);
  
  // console.log(`🎯 Tên file cần tìm: "${baseName}"`);
  // console.log(`🎯 Tên file chuẩn hóa: "${normalizedBaseName}"`);

  const sources = ['soundcloud', 'zingmp3', 'nhaccuatui', 'youtube', 'tiktok'];
  
  // Tìm kiếm theo độ ưu tiên
  for (const source of sources) {
    if (!cacheData[source] || typeof cacheData[source] !== 'object') {
      console.log(`⚠️ Nguồn ${source} không có dữ liệu hợp lệ`);
      continue;
    }

    const sourceData = cacheData[source];
    const sourceKeys = Object.keys(sourceData);
    // console.log(`🔍 Đang tìm trong ${source} (${sourceKeys.length} items)`);

    // 1. Tìm theo key (ID) - exact match
    if (sourceData[baseName]) {
      // console.log(`✅ Tìm thấy theo key exact match trong ${source}`);
      return {
        ...sourceData[baseName],
        source: source,
        matchType: 'key_exact'
      };
    }

    // 2. Tìm theo key với fuzzy match
    for (const key of sourceKeys) {
      const normalizedKey = normalizeString(key);
      if (normalizedKey === normalizedBaseName) {
        // console.log(`✅ Tìm thấy theo key fuzzy match trong ${source}: ${key}`);
        return {
          ...sourceData[key],
          source: source,
          matchType: 'key_fuzzy',
          originalKey: key
        };
      }
    }

    // 3. Tìm theo title - exact match
    for (const [key, songData] of Object.entries(sourceData)) {
      if (songData.title) {
        const normalizedTitle = normalizeString(songData.title);
        
        // Exact title match
        if (normalizedTitle === normalizedBaseName) {
          // console.log(`✅ Tìm thấy theo title exact match trong ${source}`);
          // console.log(`   Key: ${key}, Title: "${songData.title}"`);
          return {
            ...songData,
            source: source,
            matchType: 'title_exact',
            originalKey: key
          };
        }
      }
    }

    // 4. Tìm theo title - partial match
    for (const [key, songData] of Object.entries(sourceData)) {
      if (songData.title) {
        const normalizedTitle = normalizeString(songData.title);
        
        // Partial match (contains)
        if (normalizedTitle.includes(normalizedBaseName) || normalizedBaseName.includes(normalizedTitle)) {
          // Tính độ similarity để chọn match tốt nhất
          const similarity = Math.min(normalizedTitle.length, normalizedBaseName.length) / 
                           Math.max(normalizedTitle.length, normalizedBaseName.length);
          
          if (similarity > 0.5) { // Chỉ chấp nhận match có độ tương đồng > 60%
            // console.log(`✅ Tìm thấy theo title partial match trong ${source} (similarity: ${(similarity * 100).toFixed(1)}%)`);
            // console.log(`   Key: ${key}, Title: "${songData.title}"`);
            return {
              ...songData,
              source: source,
              matchType: 'title_partial',
              originalKey: key,
              similarity: similarity
            };
          }
        }
      }
    }
  }

  console.log(`❌ Không tìm thấy thông tin cho file: ${fileName}`);
  // console.log(`📋 Debug info:`);
  // console.log(`   - BaseName original: "${baseName}"`);
  // console.log(`   - BaseName normalized: "${normalizedBaseName}"`);
  
  // In ra một số sample từ cache để debug
  for (const source of sources) {
    if (cacheData[source] && Object.keys(cacheData[source]).length > 0) {
      const sampleKeys = Object.keys(cacheData[source]).slice(0, 3);
      // console.log(`   - Sample keys from ${source}:`, sampleKeys);
      const sampleTitles = sampleKeys.map(key => cacheData[source][key]?.title).filter(Boolean);
      // console.log(`   - Sample titles from ${source}:`, sampleTitles);
    }
  }
  
  return null;
}

// Hàm lấy thông tin metadata của file nhạc từ cache hoặc tạo mặc định
async function getAudioMetadata(filePath) {
  const fileName = path.basename(filePath);
  // console.log(`🎵 Lấy metadata cho file: ${fileName}`);
  
  const cachedData = await findSongDataFromCache(fileName);
  
  if (cachedData) {
    // console.log(`✅ Sử dụng metadata từ cache (${cachedData.source})`);
    return {
      title: cachedData.title || path.basename(filePath, path.extname(filePath)),
      artist: cachedData.artist || "Unknown",
      duration: cachedData.duration || "1:02",
      extension: path.extname(filePath).toLowerCase(),
      source: cachedData.source,
      matchType: cachedData.matchType,
      originalKey: cachedData.originalKey,
      similarity: cachedData.similarity
    };
  }
  
  // console.log(`⚠️ Không tìm thấy trong cache, sử dụng metadata mặc định`);
  // Fallback nếu không tìm thấy trong cache
  const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
  return {
    title: `Bài hát đéo xác định _${fileNameWithoutExt}`,
    artist: "Hiển đẹp trai cover -)))",
    duration: "1:02",
    extension: path.extname(filePath).toLowerCase(),
    source: "local"
  };
}

// Hàm tạo entry mới cho playlist
function createPlaylistEntry(filePath, metadata, nextId) {
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();
  
  // Tạo các source với các định dạng khác nhau
  const sources = [];
  
  // Thêm source chính
  let mimeType = 'audio/mpeg';
  let quality = 'standard';
  
  switch (extension) {
    case '.m4a':
      mimeType = 'audio/mp4';
      quality = 'high';
      break;
    case '.ogg':
      mimeType = 'audio/ogg';
      quality = 'medium';
      break;
    case '.mp3':
      mimeType = 'audio/mpeg';
      quality = 'standard';
      break;
    case '.wav':
      mimeType = 'audio/wav';
      quality = 'high';
      break;
    case '.flac':
      mimeType = 'audio/flac';
      quality = 'high';
      break;
    case '.aac':
      mimeType = 'audio/aac';
      quality = 'high';
      break;
  }
  
  sources.push({
    src: `./audio/${fileName}`,
    type: mimeType,
    quality: quality
  });
  
  // Tạo entry với thông tin từ cache
  const entry = {
    id: nextId,
    title: metadata.title,
    artist: metadata.artist,
    duration: metadata.duration,
    sources: sources
  };
  
  // Thêm thông tin bổ sung nếu có từ cache
  if (metadata.source) {
    entry.originalSource = metadata.source;
  }
  
  if (metadata.fileUrl) {
    entry.originalUrl = metadata.fileUrl;
  }
  
  if (metadata.originalKey) {
    entry.cacheKey = metadata.originalKey;
  }

  if (metadata.matchType) {
    entry.matchType = metadata.matchType;
  }

  if (metadata.similarity) {
    entry.similarity = metadata.similarity;
  }
  
  return entry;
}

// Hàm cập nhật playlist.json
function updatePlaylist(newSong) {
  try {
    let playlist = { songs: [], settings: {} };
    
    // Đọc playlist hiện tại nếu tồn tại
    if (fs.existsSync(PLAYLIST_PATH)) {
      const playlistData = fs.readFileSync(PLAYLIST_PATH, 'utf8');
      playlist = JSON.parse(playlistData);
    } else {
      // Tạo settings mặc định nếu file chưa tồn tại
      playlist.settings = {
        autoplay: false,
        shuffle: false,
        repeat: "all",
        volume: 0.7
      };
    }
    
    // Tìm ID tiếp theo
    const nextId = playlist.songs.length > 0 
      ? Math.max(...playlist.songs.map(song => song.id)) + 1 
      : 1;
    
    // Thêm bài hát mới
    newSong.id = nextId;
    playlist.songs.push(newSong);
    
    // Ghi lại file
    fs.writeFileSync(PLAYLIST_PATH, JSON.stringify(playlist, null, 4), 'utf8');
    // console.log(`✅ Đã thêm bài hát "${newSong.title}" vào playlist (ID: ${nextId})`);
    
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật playlist:', error);
    throw error;
  }
}

export async function deleteFile(pathFile) {
  if (!pathFile) return;
  let delays = 12000;
  const stats = await fs.promises.stat(pathFile);
  if (stats.size > 100 * 1024 * 1024) delays = 69000;
  else if (stats.size > 24 * 1024 * 1024) delays = 24000;
  await new Promise(resolve => setTimeout(resolve, delays));
  // Kiểm tra xem file có phải là file nhạc không
  if (isAudioFile(pathFile)) {
    const fileName = path.basename(pathFile);
    const audioFilePath = path.join(AUDIO_DIR, fileName);
    
    try {
      // Kiểm tra xem file đã tồn tại trong thư mục audio chưa
      if (fs.existsSync(audioFilePath)) {
        // File đã tồn tại trong audio, xóa file gốc
        // console.log(`📁 File ${fileName} đã tồn tại trong thư mục audio, đang xóa file gốc...`);
        performDelete(pathFile).catch(console.error);
        
      } else {
        // File chưa tồn tại, di chuyển và cập nhật playlist
        // console.log(`🎵 Đang xử lý file nhạc mới: ${fileName}`);
        
        // Tạo thư mục audio nếu chưa tồn tại
        if (!fs.existsSync(AUDIO_DIR)) {
          fs.mkdirSync(AUDIO_DIR, { recursive: true });
          // console.log(`📁 Đã tạo thư mục audio: ${AUDIO_DIR}`);
        }
        
        // Di chuyển file
        // console.log(`📋 Đang di chuyển file...`);
        fs.copyFileSync(pathFile, audioFilePath);
        // console.log(`✅ Đã di chuyển file thành công`);
        
        // Lấy metadata từ cache và cập nhật playlist
        // console.log(`🔍 Đang tìm metadata...`);
        const metadata = await getAudioMetadata(audioFilePath);
        const newSong = createPlaylistEntry(audioFilePath, metadata, 0); // ID sẽ được gán trong updatePlaylist
        updatePlaylist(newSong);
        
        console.log(`🎵 Thông tin bài hát đã thêm:`, {
          title: metadata.title,
          artist: metadata.artist,
          source: metadata.source || 'local',
          matchType: metadata.matchType || 'none'
        });
        
        // Xóa file gốc sau khi xử lý xong
        performDelete(pathFile).catch(console.error);
        return;
      }
    } catch (error) {
      console.error('❌ Lỗi khi xử lý file nhạc:', error);
      // Fallback: thực hiện xóa file như bình thường
      setTimeout(() => { performDelete(pathFile).catch(console.error); }, 2000);
    }
  } else {
    // Không phải file nhạc, xóa như bình thường
    performDelete(pathFile).catch(console.error);
    
  }
}

// Hàm xóa file với retry logic (logic gốc của bạn)
async function performDelete(pathFile) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      if (fs.existsSync(pathFile)) {
        fs.unlinkSync(pathFile);
        if (!fs.existsSync(pathFile)) {
          // console.log(`🗑️ Đã xóa file: ${pathFile}`);
          return;
        }
      } else {
        console.log(`⚠️ File không tồn tại: ${pathFile}`);
        return;
      }
    } catch (error) {
      console.error(`❌ Lần thử ${attempts + 1} xóa file thất bại:`, error);
    }
    attempts++;

    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.error(`❌ Không thể xóa file sau ${maxAttempts} lần thử: ${pathFile}`);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
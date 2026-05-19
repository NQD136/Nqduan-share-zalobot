import { promises as fs } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Lấy __dirname trong ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Thư mục cần kiểm tra (đường dẫn từ thư mục gốc E:\Nqduan)
const directories = [
  join(__dirname, "mybot/credentials"),
  join(__dirname, "mybot/json-data"),
  join(__dirname, "mybot/configs"),
  join(__dirname, "mybot/settings"),
  join(__dirname, "assets/json-data"),
  join(__dirname, "assets/web-config"),
  join(__dirname, "assets/data"),
  join(__dirname, "assets/groups-data"),
];

// Hàm kiểm tra sự tồn tại của thư mục
async function directoryExists(dirPath) {
  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
}

// Hàm kiểm tra tính hợp lệ của JSON
async function isValidJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    if (!data || data.trim() === "" || data.trim() === '""') {
      console.log(`Tệp rỗng hoặc không hợp lệ: ${filePath}`);
      return false;
    }
    JSON.parse(data); // Thử parse JSON
    return true;
  } catch (error) {
    console.log(`Lỗi JSON trong tệp: ${filePath} - ${error.message}`);
    return false;
  }
}

// Hàm sửa tệp JSON không hợp lệ
async function fixJSONFile(filePath) {
  try {
    const defaultJSON = {};
    await fs.writeFile(filePath, JSON.stringify(defaultJSON, null, 2), "utf8");
    console.log(`Đã sửa tệp: ${filePath} - Ghi nội dung mặc định: {}`);
  } catch (error) {
    console.error(`Lỗi khi ghi tệp: ${filePath} - ${error.message}`);
  }
}

// Hàm quét và sửa các tệp JSON trong thư mục
async function scanAndFixJSON(directory) {
  if (!(await directoryExists(directory))) {
    console.log(`Thư mục không tồn tại: ${directory}`);
    return;
  }

  try {
    const files = await fs.readdir(directory);
    for (const file of files) {
      const filePath = join(directory, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        // Đệ quy nếu là thư mục
        await scanAndFixJSON(filePath);
      } else if (extname(file) === ".json") {
        const isValid = await isValidJSON(filePath);
        if (!isValid) {
          await fixJSONFile(filePath);
        } else {
          console.log(`Tệp JSON hợp lệ: ${filePath}`);
        }
      }
    }
  } catch (error) {
    console.error(`Lỗi khi quét thư mục: ${directory} - ${error.message}`);
  }
}

// Hàm chính
async function main() {
  console.log("Bắt đầu quét và sửa các tệp JSON không hợp lệ...");
  for (const dir of directories) {
    console.log(`Đang kiểm tra thư mục: ${dir}`);
    await scanAndFixJSON(dir);
  }
  console.log("Hoàn tất việc kiểm tra và sửa tệp JSON.");
}

// Chạy script
main().catch((error) => {
  console.error("Lỗi trong quá trình chạy script:", error.message);
});

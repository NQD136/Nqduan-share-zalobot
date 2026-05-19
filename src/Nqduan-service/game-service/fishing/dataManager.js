import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// THAY ĐỔI DUY NHẤT NẰM Ở DÒNG NÀY
const dataDir = path.join(__dirname, 'data'); // Thay thế process.cwd() bằng __dirname

const playerPath = path.join(dataDir, 'player_data.json');
const configPath = path.join(__dirname, 'game_config.json');

// Đảm bảo thư mục data tồn tại bên trong thư mục fishing
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Tải dữ liệu người chơi
export function loadPlayerData() {
    if (!fs.existsSync(playerPath)) {
        return {};
    }
    try {
        const rawData = fs.readFileSync(playerPath, 'utf-8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error("Lỗi khi đọc file player_data.json:", error);
        return {};
    }
}

// Lưu dữ liệu người chơi
export function savePlayerData(data) {
    try {
        const stringData = JSON.stringify(data, null, 2);
        fs.writeFileSync(playerPath, stringData);
    } catch (error) {
        console.error("Lỗi khi lưu file player_data.json:", error);
    }
}

// Tải cấu hình game
export function loadGameConfig() {
    try {
        const rawData = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error("Lỗi nghiêm trọng: Không thể đọc file game_config.json!", error);
        process.exit(1);
    }
}
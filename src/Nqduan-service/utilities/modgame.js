import fs from 'node:fs';
import path from 'node:path';

export async function modgame(api, message, aliasCommand) {
    const { type, threadId } = message;
    const messageContent = message.data.content.split(" ");

    // Thư mục chứa file game
    const SHARE_DIR = path.join(process.cwd(), "assets/resources/filegame");

    if (!fs.existsSync(SHARE_DIR)) {
        return api.sendMessage({
            msg: "⚠️ Không tìm thấy thư mục filegame!",
            quote: message,
            ttl: 60000
        }, threadId, type);
    }

    // Hàm quét tất cả file trong thư mục và thư mục con
    function scanFiles(directory) {
        let results = [];
        const items = fs.readdirSync(directory);
        items.forEach(item => {
            const itemPath = path.join(directory, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                results = results.concat(scanFiles(itemPath));
            } else {
                results.push(itemPath);
            }
        });
        return results;
    }

    const allFiles = scanFiles(SHARE_DIR);
    if (allFiles.length === 0) {
        return api.sendMessage({
            msg: "⚠️ Không có file nào để chia sẻ!",
            quote: message,
            ttl: 60000
        }, threadId, type);
    }

    // Tạo danh sách file theo thứ tự
    let sortedFiles = [];
    let fileList = "🔍 Danh sách file có thể chia sẻ:\n\n";
    let counter = 1;

    const filesByFolder = {};
    allFiles.forEach(file => {
        const relativePath = path.relative(SHARE_DIR, file);
        const parts = relativePath.split(path.sep);
        const folderName = parts.length > 1 ? parts[0] : "Other";
        if (!filesByFolder[folderName]) filesByFolder[folderName] = [];
        filesByFolder[folderName].push(file);
    });

    const folderKeys = Object.keys(filesByFolder).sort();
    folderKeys.forEach(folder => {
        fileList += `🗂️ ${folder}:\n`;
        const files = filesByFolder[folder].sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
        files.forEach(file => {
            fileList += `${counter}. ${path.basename(file)}\n`;
            sortedFiles.push(file);
            counter++;
        });
        fileList += "\n";
    });

    // Nếu chưa có tham số, hiển thị danh sách file
    if (messageContent.length < 2) {
        return api.sendMessage({
            msg: fileList + "\nĐể lấy file, dùng:\nmod [số thứ tự hoặc tên file]\nFile sẽ được gửi trực tiếp trong chat này.",
            quote: message,
            ttl: 120000
        }, threadId, type);
    }

    // Lấy file theo số thứ tự hoặc tên file
    const argNum = Number(messageContent[1]);
    let fileToSend;
    if (!isNaN(argNum) && argNum > 0 && argNum <= sortedFiles.length) {
        fileToSend = sortedFiles[argNum - 1];
    } else {
        const requestedFileName = messageContent.slice(1).join(" ").toLowerCase();
        fileToSend = sortedFiles.find(f => path.basename(f).toLowerCase() === requestedFileName);
    }

    if (!fileToSend) {
        return api.sendMessage({
            msg: "⚠️ Không tìm thấy file bạn yêu cầu. Kiểm tra lại tên hoặc dùng 'mod' để xem danh sách file.",
            quote: message,
            ttl: 60000
        }, threadId, type);
    }

    // Kiểm tra nếu là file .txt -> gửi nội dung thay vì gửi file
    if (path.extname(fileToSend).toLowerCase() === ".txt") {
        const fileContent = fs.readFileSync(fileToSend, "utf-8").trim();
        return api.sendMessage({
            msg: fileContent, // Gửi nguyên nội dung file, không tiêu đề
            quote: message,
            ttl: 300000
        }, threadId, type);
    } else {
        // Gửi file trực tiếp vào thread hiện tại
        return api.sendMessage({
            msg: `📂 Đây là file bạn yêu cầu: ${path.basename(fileToSend)}`,
            attachments: [fileToSend],
            ttl: 300000
        }, threadId, type);
    }
}    

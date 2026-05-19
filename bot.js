// _____/\\\\\\\\\\\\_____/\\\\\\\\\\__
//  ___/\\\//////////____/\\\///////\\\_
//   __/\\\______________\///______/\\\__
//    _\/\\\____/\\\\\\\_________/\\\//___
//     _\/\\\___\/////\\\________\////\\\__
//      _\/\\\_______\/\\\___________\//\\\_
//       _\/\\\_______\/\\\__/\\\______/\\\__
//        _\//\\\\\\\\\\\\/__\///\\\\\\\\\/___
//         __\////////////______\/////////_____
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';
import fs from 'fs';
import { ensureLogFiles, tempDir } from './src/utils/io-json.js';

const isWindows = process.platform === 'win32';
let botProcess;
let manuallyStopped = false;

function clearTempFolder() {
  const tempPath = tempDir;
  if (fs.existsSync(tempPath)) {
    try {
      const files = fs.readdirSync(tempPath);
      for (const file of files) {
        const filePath = path.join(tempPath, file);
        const stats = fs.lstatSync(filePath);
        if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`Deleted directory: ${filePath}`);
        } else {
          fs.unlinkSync(filePath);
        }
      }
      console.log('Cleared assets/temp folder successfully.');
    } catch (err) {
      console.error(`Error clearing assets/temp folder: ${err.message}`);
    }
  } else {
    console.log('assets/temp folder does not exist, no need to clear.');
  }
}

// Xóa các file và thư mục trong thư mục logs cũ hơn một ngưỡng (theo ngày)
function clearLogsFolder(retentionDays = 7) {
  // Giả định: xóa các file / folder trong `logs/` nếu cũ hơn `retentionDays` ngày.
  const logsPath = path.resolve('logs');
  if (!fs.existsSync(logsPath)) {
    console.log('logs folder does not exist, no need to clear.');
    return;
  }

  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

  try {
    const entries = fs.readdirSync(logsPath);
    for (const entry of entries) {
      const entryPath = path.join(logsPath, entry);
      let stats;
      try {
        stats = fs.lstatSync(entryPath);
      } catch (err) {
        console.warn(`Cannot stat ${entryPath}: ${err.message}`);
        continue;
      }

      const mtime = stats.mtimeMs || stats.mtime.getTime();
      if (now - mtime > retentionMs) {
        try {
          if (stats.isDirectory()) {
            fs.rmSync(entryPath, { recursive: true, force: true });
            console.log(`Deleted old logs directory: ${entryPath}`);
          } else {
            fs.unlinkSync(entryPath);
            console.log(`Deleted old log file: ${entryPath}`);
          }
        } catch (err) {
          console.error(`Error deleting ${entryPath}: ${err.message}`);
        }
      }
    }

    console.log(`Cleared logs older than ${retentionDays} days`);
  } catch (err) {
    console.error(`Error clearing logs folder: ${err.message}`);
  }
}

function startBot() {
  botProcess = spawn(
    isWindows ? 'cmd.exe' : 'bash',
    isWindows ? ['/c', 'npm start'] : ['-c', 'npm start'],
    {
      detached: true,
    },
  );

  console.log('Bot started');

  attachBotEvents(botProcess);
}

function stopBot() {
  if (!botProcess || !botProcess.pid) {
    console.log('No bot process to stop');
    return;
  }

  if (isWindows) {
    spawn('taskkill', ['/PID', botProcess.pid, '/T', '/F']);
  } else {
    process.kill(-botProcess.pid, 'SIGTERM');
  }

  console.log('Bot stopped');
}

function restartBot() {
  console.log('Restarting bot...');
  // Dọn cả temp và logs trước khi restart
  clearTempFolder();
  clearLogsFolder();
  stopBot();
  setTimeout(startBot, 1000);
}

function attachBotEvents(botProcess) {
  botProcess.on('exit', (code) => {
    if (manuallyStopped) return;
    console.log('Bot exited with code:', code);
    restartBot();
  });

  botProcess.on('error', (err) => {
    if (manuallyStopped) return;
    console.error('Bot error:', err);
    restartBot();
  });
}

process.on('SIGINT', () => {
  console.log('\nSIGINT received → Stopping bot and exiting...');
  manuallyStopped = true;
  stopBot();
  setTimeout(() => process.exit(0), 500);
});

process.on('SIGTERM', () => {
  console.log('\nSIGTERM received → Stopping bot and exiting...');
  manuallyStopped = true;
  stopBot();
  setTimeout(() => process.exit(0), 500);
});

ensureLogFiles();
// Dọn logs (giữ mặc định 7 ngày) và temp trước khi khởi động
clearLogsFolder();
clearTempFolder();
startBot();

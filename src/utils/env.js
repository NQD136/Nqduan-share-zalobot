import path from "path";
import process from "process";
import fs from "fs";

let cache = {
  botName: null,
  cfgPath: null,
  projectRoot: null,
};


function debugEnv() {
  console.log("=== ENVIRONMENT DEBUG ===");
  console.log("process.argv:", process.argv);
  console.log("ENV:", {
    Cursor: process.env.Cursor,
    CONFIG_PATH: process.env.CONFIG_PATH,
    ProjectRoot: process.env.ProjectRoot,
    BOT_NAME: process.env.BOT_NAME,
    PM2_NAME: process.env.PM2_NAME,
  });
  console.log("process.cwd():", process.cwd());
  console.log("=========================");
}


function resolveBotName() {
  return (
    process.env.name ||
    process.env.Cursor ||
    process.env.BOT_NAME ||
    process.env.PM2_NAME ||
    process.argv[2] ||
    "admin"
  );
}

function resolveProjectRoot() {
  
  return path.normalize(process.env.ProjectRoot || process.cwd());
}

function resolveCfgPath(botName, projectRoot) {
  const defaultPath = path.join(projectRoot, "mybot", "bots", `${botName}.json`);
  return path.normalize(process.env.CONFIG_PATH || defaultPath);
}


export function getBotName() {
  if (!cache.botName) {
    cache.botName = resolveBotName();
    if (!process.env.name && !process.env.BOT_NAME && !process.env.PM2_NAME) {
      console.warn(
        `Không có thông tin tên bot trong environment || sử dụng fallback: ${cache.botName}`
      );
    }
  }
  return cache.botName;
}

export function getProjectRoot() {
  if (!cache.projectRoot) {
    cache.projectRoot = resolveProjectRoot();
  }
  return cache.projectRoot;
}

export function getCfgPath() {
  if (!cache.cfgPath) {
    cache.cfgPath = resolveCfgPath(getBotName(), getProjectRoot());
  }
  return cache.cfgPath;
}

export function getConfig() {
  return {
    botName: getBotName(),
    cfgPath: getCfgPath(),
    projectRoot: getProjectRoot(),
  };
}

export function validateConfigFile() {
  const cfgPath = getCfgPath();
  if (!fs.existsSync(cfgPath)) {
    console.error(`Config file không tồn tại: ${cfgPath}`);
    return false;
  }
  try {
    JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    return true;
  } catch (err) {
    console.error(`Config file không hợp lệ: ${cfgPath}`, err.message);
    return false;
  }
}

export function validateEnv(showDebug = false) {
  if (showDebug) debugEnv();
  try {
    if (!validateConfigFile()) return false;
    return true;
  } catch (err) {
    console.error("Environment validation failed:", err.message);
    if (showDebug) debugEnv();
    return false;
  }
}

export function loadConfig() {
  const cfgPath = getCfgPath();
  try {
    const config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    config._meta = {
      botName: getBotName(),
      configPath: cfgPath,
      projectRoot: getProjectRoot(),
      loadedAt: new Date().toISOString(),
      platform: process.platform, 
    };
    return config;
  } catch (err) {
    console.error(`Lỗi load config từ ${cfgPath}:`, err.message);
    throw err;
  }
}

export async function getBotInfo() {
  const cfgPath = getCfgPath();
  if (!fs.existsSync(cfgPath)) {
    console.trace(`Không tìm thấy file cấu hình bot: ${cfgPath}`);
    return null;
  }
  try {
    const cfgData = await fs.promises.readFile(cfgPath, "utf8");
    return JSON.parse(cfgData);
  } catch (err) {
    console.error("Lỗi đọc bot info:", err.message);
    return null;
  }
}

export function resetCache() {
  cache = { botName: null, cfgPath: null, projectRoot: null };
}

export function setEnvVars(envVars = {}) {
  Object.assign(process.env, envVars);
  resetCache();
}

if (!process.env.SKIP_ENV_VALIDATION) {
  process.nextTick(() => {
    if (!validateEnv(false)) {
      console.warn("Auto-validation failed, but continuing...");
    }
  });
}
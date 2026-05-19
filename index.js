import path from "path";
import process from "process";
import { spawn } from "child_process";
import fs from "fs";
import { fileURLToPath } from "url";

export const projectRoot = path.resolve(process.cwd());
const args = process.argv;
const botName = args[2] || "admin";
const runWithPM2 = args.length > 2;
export const cfgPath = path.join(projectRoot, "mybot", "bots", `${botName}.json`);

const isWindows = process.platform === "win32";
const pm2Command = isWindows ? "pm2.cmd" : "pm2";
const baseEnv = {
  ...process.env,
  BOT_NAME: botName,
  CONFIG_PATH: cfgPath,
  PROJECT_ROOT: projectRoot,
  NODE_ENV: "production",
  PM2_HOME:
    process.env.PM2_HOME ||
    path.join(process.env.USERPROFILE || process.env.HOME || projectRoot, ".pm2"),
};

function validateFiles() {
  if (!fs.existsSync(cfgPath)) {
    console.error(`Config not found: ${cfgPath}`);
    process.exit(1);
  }
  const indexPath = path.join(projectRoot, "src", "index.js");
  if (!fs.existsSync(indexPath)) {
    console.error(`Source not found: ${indexPath}`);
    process.exit(1);
  }
  return indexPath;
}

function checkPM2(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const child = spawn(pm2Command, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: isWindows, 
      windowsHide: isWindows,
    });

    let resolved = false;
    const finish = (ok) => {
      if (!resolved) {
        resolved = true;
        child.kill();
        resolve(ok);
      }
    };

    child.stdout.once("data", () => finish(true));
    child.once("error", () => finish(false));
    child.once("close", (code) => finish(code === 0));

    setTimeout(() => finish(false), timeoutMs);
  });
}

function attachSignalHandlers(proc, name) {
  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.once(signal, () => {
      console.log(`Received ${signal}, stopping ${name}...`);
      proc.kill(signal);
    });
  });
}

function startWithPM2(indexPath) {
  const pm2Args = [
    "start",
    indexPath,
    "--name",
    botName,
    "--silent",
    "--no-autorestart",
    ...(isWindows ? ["--no-daemon"] : []),
  ];

  console.log(`Starting with PM2: ${pm2Command} ${pm2Args.join(" ")}`);
  const pm2Proc = spawn(pm2Command, pm2Args, {
    stdio: "inherit",
    shell: isWindows,
    windowsHide: false,
    env: baseEnv,
  });

  attachSignalHandlers(pm2Proc, "PM2");
  pm2Proc.on("close", (code) => {
    console.log(`PM2 exited with code ${code}`);
    process.exit(code);
  });
  pm2Proc.on("error", (err) => {
    console.error(`PM2 process error: ${err.message}`);
    process.exit(1);
  });
}

function startDirect(indexPath) {
  console.log(`Starting directly: node ${indexPath}`);
  const nodeProc = spawn("node", [indexPath], {
    stdio: "inherit",
    shell: isWindows,
    windowsHide: false,
    env: baseEnv,
  });

  attachSignalHandlers(nodeProc, "Node");
  nodeProc.on("close", (code) => {
    console.log(`Node exited with code ${code}`);
    process.exit(code);
  });
  nodeProc.on("error", (err) => {
    console.error(`Node process error: ${err.message}`);
    process.exit(1);
  });
}

async function main() {
  console.log(`Platform: ${process.platform}`);
  console.log(`Bot name: ${botName}`);
  console.log(`Config path: ${cfgPath}`);
  console.log(`Run with PM2: ${runWithPM2}`);

  const indexPath = validateFiles();
  console.log(`Index path: ${indexPath}`);

  if (runWithPM2) {
    console.log("Checking PM2...");
    const pm2Available = await checkPM2();
    if (!pm2Available) {
      console.warn("PM2 not available, falling back to direct Node.js execution...");
      return startDirect(indexPath);
    }
    return startWithPM2(indexPath);
  }

  return startDirect(indexPath);
}

const currentFile = fileURLToPath(import.meta.url);
if (path.resolve(currentFile) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error("Main error:", err);
    process.exit(1);
  });
}

export { checkPM2 };
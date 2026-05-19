// ========================= IMPORT =========================
import os from "os";
import crypto from "crypto";
import { Worker } from "worker_threads";
import { performance } from "perf_hooks";
import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import { loadImageBuffer } from "../../utils/util.js";
import * as cv from "../../utils/canvas/index.js";
import {
  sendMessageCompleteRequest,
  sendMessageTag,
} from "../chat-zalo/chat-style/chat-style.js";

// ========================= CONSTANT =========================
const TIME_TO_LIVE_MESSAGE = 600000;
const TEST_DURATION = 10000;

let isTestingBenchmark = false;
let currentTester = { id: null, threadId: null, name: null };

// ========================= LỚP BENCHMARK CPU =========================
class CpuBenchmark {
  constructor(options = {}) {
    this.durationMs = options.durationMs ?? 3000;
    this.cpuCores = os.cpus().length;
    this.cpuModel = os.cpus()[0].model.trim();
  }

  async runSingleThreadBenchmark(durationMs = this.durationMs) {
    const start = performance.now();
    let ops = 0;
    while (performance.now() - start < durationMs) {
      const h = crypto.createHash("sha256");
      h.update(String(ops) + Math.random());
      h.digest("hex");
      ops++;
    }
    return ops;
  }

  createWorker(durationMs) {
    return new Promise((resolve, reject) => {
      const workerFile = new URL("./bench-worker.js", import.meta.url);
      const w = new Worker(workerFile, { workerData: { durationMs } });
      w.once("message", (msg) => resolve(msg.ops));
      w.once("error", reject);
      w.once("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
      });
    });
  }

  async runMultiThreadBenchmark(durationMs = this.durationMs) {
    const workerPromises = [];
    for (let i = 0; i < this.cpuCores; i++) {
      workerPromises.push(this.createWorker(durationMs));
    }
    const results = await Promise.all(workerPromises);
    const totalOps = results.reduce((s, v) => s + v, 0);
    return { totalOps, perWorker: results };
  }

  async run() {
    await this.runSingleThreadBenchmark(500);
    const singleOps = await this.runSingleThreadBenchmark(this.durationMs);
    const multi = await this.runMultiThreadBenchmark(this.durationMs);

    const multiOps = multi.totalOps;
    const effectiveCores = Math.max(1, multiOps / Math.max(1, singleOps));

    return {
      single: { ops: singleOps, durationMs: this.durationMs },
      multi: {
        ops: multiOps,
        durationMs: this.durationMs,
        workers: this.cpuCores,
      },
      effectiveCores,
      cpuModel: this.cpuModel,
      cpuCores: this.cpuCores,
    };
  }
}

// ========================= HÀM CHẠY BENCHMARK =========================
async function runBench(options = {}) {
  const bench = new CpuBenchmark(options);
  return bench.run();
}

// ========================= COVER & LOGO CPU =========================
const linkCoverCPU = {
  Intel: "https://files.catbox.moe/o9j9cr.jpeg",
  AMD: "https://images.unsplash.com/photo-1602524202129-6c2f1940c334?auto=format&fit=crop&w=1200&q=80",
  Apple:
    "https://images.unsplash.com/photo-1606813902779-1fefc1b4e2f9?auto=format&fit=crop&w=1200&q=80",
  ARM: "https://images.unsplash.com/photo-1606813902849-8b46d72fdb77?auto=format&fit=crop&w=1200&q=80",
};

const linkLogoCPU = {
  Intel: "https://files.catbox.moe/cyxfha.jpeg",
  AMD: "https://upload.wikimedia.org/wikipedia/commons/7/7c/AMD_Logo.svg",
  Apple:
    "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg",
  ARM: "https://upload.wikimedia.org/wikipedia/commons/0/0e/ARM_logo_2017.svg",
};

// ========================= HÀM VẼ ẢNH KẾT QUẢ =========================

async function createBenchmarkImage(result) {
  const width = 1000,
    height = 430;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const cpuModel = result.cpuModel || "Unknown CPU";
  const lowerModel = cpuModel.toLowerCase();
  const brand = lowerModel.includes("intel")
    ? "Intel"
    : lowerModel.includes("amd")
      ? "AMD"
      : lowerModel.includes("apple")
        ? "Apple"
        : lowerModel.includes("arm")
          ? "ARM"
          : "Unknown";

  // ====== COVER NỀN ======
  try {
    if (linkCoverCPU[brand]) {
      const coverBuffer = await loadImageBuffer(linkCoverCPU[brand]);
      const cover = await loadImage(coverBuffer);
      const scale = Math.max(width / cover.width, height / cover.height);
      ctx.drawImage(
        cover,
        (width - cover.width * scale) / 2,
        (height - cover.height * scale) / 2,
        cover.width * scale,
        cover.height * scale,
      );
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(0, 0, width, height);
    } else throw new Error("no cover");
  } catch {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#3B82F6");
    bg.addColorStop(1, "#111827");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }

  // ====== LOGO CPU ======
  const logo = { x: 200, y: 100, size: 180, border: 10 };
  const gradient = ctx.createLinearGradient(
    logo.x - logo.size / 2 - logo.border,
    logo.y - logo.border,
    logo.x + logo.size / 2 + logo.border,
    logo.y + logo.size + logo.border,
  );
  const rainbow = [
    "#FF0000",
    "#FF7F00",
    "#FFFF00",
    "#00FF00",
    "#0000FF",
    "#4B0082",
    "#9400D3",
  ];
  rainbow
    .sort(() => Math.random() - 0.5)
    .forEach((color, i) => {
      gradient.addColorStop(i / (rainbow.length - 1), color);
    });

  ctx.save();
  ctx.beginPath();
  ctx.arc(
    logo.x,
    logo.y + logo.size / 2,
    logo.size / 2 + logo.border,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(logo.x, logo.y + logo.size / 2, logo.size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.restore();

  if (linkLogoCPU[brand]) {
    try {
      const image = await loadImage(linkLogoCPU[brand]);
      const square = Math.min(image.width, image.height);
      ctx.save();
      ctx.beginPath();
      ctx.arc(logo.x, logo.y + logo.size / 2, logo.size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        image,
        (image.width - square) / 2,
        (image.height - square) / 2,
        square,
        square,
        logo.x - logo.size / 2,
        logo.y + logo.size / 2 - logo.size / 2,
        logo.size,
        logo.size,
      );
      ctx.restore();
    } catch {}
  }

  // ====== TIÊU ĐỀ ======
  ctx.textAlign = "center";
  ctx.font = "bold 38px BeVietnamPro";
  const titleGradient = ctx.createLinearGradient(0, 0, width, 0);
  titleGradient.addColorStop(0, "#FACC15");
  titleGradient.addColorStop(0.5, "#A7F3D0");
  titleGradient.addColorStop(1, "#60A5FA");
  ctx.fillStyle = titleGradient;
  ctx.fillText("Kết Quả Benchmark CPU", width / 2, 60);

  // ====== HÀM TÁCH TÊN CPU ======
  function splitCpuName(name) {
    if (!name) return [""];
    const clean = name
      .replace(/\(R\)/gi, "")
      .replace(/CPU/gi, "")
      .replace("@/g", "@")
      .trim()
      .replace(/\s+/g, " ");
    if (clean.length <= 25) return [clean];

    const brandCombos = [
      "Intel Xeon",
      "Intel Core",
      "AMD EPYC",
      "AMD Ryzen",
      "Apple M",
      "ARM Cortex",
    ];

    let brandLine = "";
    for (const combo of brandCombos) {
      if (clean.startsWith(combo)) {
        brandLine = combo;
        break;
      }
    }

    if (brandLine) {
      const rest = clean.replace(brandLine, "").trim();
      return [brandLine, rest];
    }

    const words = clean.split(" ");
    const firstPart = words.slice(0, Math.ceil(words.length / 2)).join(" ");
    const secondPart = words.slice(Math.ceil(words.length / 2)).join(" ");
    return [firstPart, secondPart];
  }

  // ====== HIỂN THỊ TÊN CHIP DƯỚI LOGO ======
  const lines = splitCpuName(cpuModel);
  ctx.font = "bold 20px Tahoma";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  const startY = logo.y + logo.size + 30;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], logo.x, startY + i * 26);
  }

  // ====== THÔNG SỐ BENCHMARK BÊN PHẢI ======
  const infoX = 380;
  let y = 100;
  ctx.textAlign = "left";
  ctx.font = "bold 26px BeVietnamPro";

  const fields = [
    { icon: "🍀", label: "Số Lõi CPU Hiện Có", value: result.cpuCores },
    { icon: "⚡", label: "Tốc Độ CPU", value: `${os.cpus()[0].speed}MHz` },
    {
      icon: "🔋",
      label: "CPU Công Suất Test",
      value: `${((result.multi.ops / (result.single.ops * result.cpuCores)) * 100).toFixed(2)}%`,
    },
    {
      icon: "💻",
      label: "Đơn luồng",
      value: `${result.single.ops.toLocaleString("vi-VN")} ops`,
    },
    {
      icon: "🧑‍💻",
      label: "Đa luồng",
      value: `${result.multi.ops.toLocaleString("vi-VN")} ops`,
    },
    {
      icon: "🧩",
      label: "Số Lõi Hiệu Quả Ước Tính",
      value: result.effectiveCores.toFixed(2),
    },
    {
      icon: "⏱️",
      label: "Thời Gian Test",
      value: `${result.single.durationMs}ms`,
    },
  ];

  for (const field of fields) {
    const gradientLine = ctx.createLinearGradient(0, 0, width, 0);
    gradientLine.addColorStop(0, "#FCD34D");
    gradientLine.addColorStop(1, "#93C5FD");
    ctx.fillStyle = gradientLine;
    ctx.fillText(`${field.icon} ${field.label}:`, infoX, y);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(" " + field.value, infoX + 380, y);
    y += 42;
  }

  // ====== CHỮ KÝ ======
  ctx.textAlign = "right";
  ctx.font = "bold 30px Tahoma";
  ctx.fillStyle = titleGradient;
  ctx.fillText("Nqduan", width - 30, height - 30);

  // ====== XUẤT FILE ======
  const filePath = path.resolve(`./assets/temp/benchmark_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

// ========================= HÀM HANDLE CHÍNH =========================
export async function handleBenchmarkCommand(api, message) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;

  if (isTestingBenchmark) {
    await sendMessageCompleteRequest(
      api,
      message,
      {
        caption: `Hiện tại bot đang đánh giá hiệu năng CPU theo yêu cầu của ${currentTester.name}. Vui lòng đợi kết quả.`,
      },
      30000,
    );
    return;
  }

  try {
    isTestingBenchmark = true;
    currentTester = { id: senderId, name: senderName, threadId };

    await sendMessageCompleteRequest(
      api,
      message,
      {
        caption: `🔄 Vui lòng đợi bot đang đánh giá hiệu năng CPU...`,
      },
      TEST_DURATION,
    );

    const result = await runBench();
    const imagePath = await createBenchmarkImage(result);

    await sendMessageTag(
      api,
      message,
      {
        caption: `📊 Kết quả đánh giá hiệu năng CPU của bot!`,
        imagePath,
      },
      TIME_TO_LIVE_MESSAGE,
    );
  } catch (err) {
    console.error("Lỗi khi đánh giá hiệu năng CPU:", err);
    await sendMessageCompleteRequest(
      api,
      message,
      {
        caption: `❌ Đã xảy ra lỗi khi đánh giá hiệu năng CPU. Vui lòng thử lại sau.`,
      },
      30000,
    );
  } finally {
    isTestingBenchmark = false;
    currentTester = { id: null, name: null, threadId: null };
  }
}

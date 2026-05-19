import fs from "fs";
import path from "path";

const dataFile = path.resolve("./src/json-data/carobot.json");

function ensureFile() {
  const dir = path.dirname(dataFile);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "{}", "utf8");
  } catch {}
}

function loadData() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return {};
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch {}
}

const POINTS = {
  de: { win: 80, lose: -40, draw: 0 },
  thuong: { win: 200, lose: -100, draw: 0 },
  kho: { win: 1000, lose: -150, draw: 0 },
  thachdau: { win: 3000, lose: -300, draw: 0 },
};

function normalizeDifficulty(diff) {
  const d = String(diff || "thuong").toLowerCase();
  if (POINTS[d]) return d;
  if (/d[eê]|dễ|de/.test(d)) return "de";
  if (/thuong|thường/.test(d)) return "thuong";
  if (/kho|khó/.test(d)) return "kho";
  if (/thachdau|thach\s*dau|thách\s*đấu/.test(d)) return "thachdau";
  return "thuong";
}

export function getPointsDelta(difficulty, result) {
  const diff = normalizeDifficulty(difficulty);
  const m = POINTS[diff] || {};
  const val = m[result];
  return typeof val === 'number' ? val : 0;
}

export function updateCaroBotScore(userId, result, difficulty = "thuong") {
  const data = loadData();
  if (!data[userId]) {
    data[userId] = { win: 0, lose: 0, draw: 0, points: 0 };
  }
  const rec = data[userId];
  if (result === "win" || result === "lose" || result === "draw") {
    rec[result] = (rec[result] || 0) + 1;
    const diff = normalizeDifficulty(difficulty);
    const delta = POINTS[diff][result] || 0;
    rec.points = (rec.points || 0) + delta;
  }
  saveData(data);
}

export function getCaroBotScore(userId) {
  const data = loadData();
  const rec = data[userId] || { win: 0, lose: 0, draw: 0, points: 0 };
  return {
    win: rec.win || 0,
    lose: rec.lose || 0,
    draw: rec.draw || 0,
    points: rec.points || 0,
  };
}

export function getCaroBotTop(limit = 10) {
  const data = loadData();
  const entries = Object.entries(data).map(([uid, rec]) => ({
    uid,
    win: rec.win || 0,
    lose: rec.lose || 0,
    draw: rec.draw || 0,
    points: rec.points || 0,
  }));
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.win !== a.win) return b.win - a.win;
    if (b.draw !== a.draw) return b.draw - a.draw;
    return a.lose - b.lose;
  });
  return entries.slice(0, Math.max(1, limit));
}

export function getCaroBotRankOf(userId) {
  const data = loadData();
  const arr = Object.entries(data).map(([uid, rec]) => ({ uid, points: rec.points || 0, win: rec.win || 0, lose: rec.lose || 0, draw: rec.draw || 0 }));
  arr.sort((a, b) => b.points - a.points || b.win - a.win || b.draw - a.draw || a.lose - b.lose);
  const idx = arr.findIndex((x) => x.uid === String(userId));
  return idx >= 0 ? idx + 1 : null;
}

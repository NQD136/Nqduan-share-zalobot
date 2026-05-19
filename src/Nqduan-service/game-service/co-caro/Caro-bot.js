import { nameServer } from "../../../database/index.js";
import { getPlayerBalance, updatePlayerBalance } from "../../../database/player.js";
import { formatCurrency, parseGameAmount } from "../../../utils/format-util.js";
import { checkBeforeJoinGame } from "../index.js";
import Big from "big.js";

import { createCanvas } from "canvas";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";

import { updateCaroBotScore, getCaroBotScore, getCaroBotTop, getCaroBotRankOf, getPointsDelta } from "./carobot-score.js";
import { createCaroTopImage } from "./leaderboard-canvas.js";
import { clearImagePath } from "../../../utils/canvas/index.js";
import { getUserInfoData } from "../../info-service/user-info.js";
import { botPickMove } from "./bot-strategy.js";


const BOARD_SIZE = 16;
const COLS = Array.from({ length: BOARD_SIZE }, (_, i) => String.fromCharCode("a".charCodeAt(0) + i));
const TURN_TIMEOUT_MS = 60_000; 
const activeThreadGames = new Map();

function now() { return Date.now(); }

function newBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function parsePosition(pos) {
  if (!pos) return null;
  const s = pos.trim().toLowerCase();
  const colChar = s[0];
  const rowStr = s.slice(1);
  const col = COLS.indexOf(colChar);
  const row = parseInt(rowStr, 10) - 1;
  if (Number.isNaN(row) || col < 0 || row < 0 || col >= BOARD_SIZE || row >= BOARD_SIZE) return null;
  return { row, col };
}

function parseNumericPosition(val) {
  const n = parseInt(String(val).trim(), 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > BOARD_SIZE * BOARD_SIZE) return null;
  const idx = n - 1;
  const row = Math.floor(idx / BOARD_SIZE);
  const col = idx % BOARD_SIZE;
  return { row, col };
}

function inBounds(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function checkWin(board, r, c) {
  if (!inBounds(r, c) || !board[r][c]) return { win: false };
  const color = board[r][c];
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    // Collect contiguous stones in both directions
    const line = [{ r, c }];
    let rr=r+dr, cc=c+dc;
    while (inBounds(rr,cc) && board[rr][cc]===color) { line.push({ r: rr, c: cc }); rr+=dr; cc+=dc; }
    rr=r-dr; cc=c-dc;
    while (inBounds(rr,cc) && board[rr][cc]===color) { line.unshift({ r: rr, c: cc }); rr-=dr; cc-=dc; }
    if (line.length>=5) return { win:true, line };
  }
  return { win:false };
}


async function drawBoard(game, ownerName, options={}) {
  const CELL=36, PAD=44, TITLE_H=44, FOOT_H=28;
  const gridW = BOARD_SIZE*CELL;
  const width=PAD*2+gridW;
  const height=TITLE_H + PAD*2 + gridW + FOOT_H;
  const canvas=createCanvas(width,height);
  const ctx=canvas.getContext("2d");


  ctx.fillStyle = "#eef2f7";
  ctx.fillRect(0,0,width,height);


  const diffName = ({de:"Dễ", thuong:"Thường", kho:"Khó", thachdau:"Thách Đấu"})[game.difficulty||'thuong'] || 'Thường';

  const pillX=8, pillY=8, pillW=28, pillH=18, r=6;
  ctx.fillStyle = "#fb923c";
  roundRect(ctx, pillX, pillY, pillW, pillH, r, true, false);
  ctx.fillStyle = "#0f172a"; ctx.font = "bold 11px sans-serif"; ctx.textAlign='center';
  ctx.fillText("EX", pillX+pillW/2, pillY+13);
  if (ownerName){ ctx.fillStyle="#f59e0b"; ctx.font="bold 12px sans-serif"; ctx.textAlign='left'; ctx.fillText(`@ ${ownerName}`, pillX+pillW+8, 22); }

  ctx.fillStyle = "#111827"; ctx.font = "bold 16px sans-serif"; ctx.textAlign='center';
  ctx.fillText(`Caro - ${BOARD_SIZE}x${BOARD_SIZE} - ${diffName}`, width/2, 22);

  ctx.fillStyle = "#1d4ed8"; ctx.font = "bold 12px sans-serif"; ctx.textAlign='right';
  ctx.fillText("O: BOT", width-10, 20);

  ctx.strokeStyle="#cbd5e1"; ctx.lineWidth=2;
  ctx.strokeRect(PAD-8, TITLE_H+PAD-8, gridW+16, gridW+16);

  ctx.strokeStyle="#94a3b8"; ctx.lineWidth=1.1;
  for (let i=0;i<=BOARD_SIZE;i++) {
    const y = TITLE_H+PAD + i*CELL;
    const x0 = PAD,
          x1 = PAD + gridW;
    ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();
    const x = PAD + i*CELL;
    const y0 = TITLE_H+PAD,
          y1 = TITLE_H+PAD + gridW;
    ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1); ctx.stroke();
  }


  ctx.fillStyle="#334155"; ctx.font="bold 12px sans-serif";
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for (let i=0;i<BOARD_SIZE;i++) {
    const cx = PAD + i*CELL + CELL/2;
    const cy = TITLE_H + PAD - 12;
    ctx.fillText(COLS[i], cx, cy);
  }
  ctx.textAlign='right'; ctx.textBaseline='middle';
  for (let i=0;i<BOARD_SIZE;i++) {
    const rx = PAD - 8;
    const ry = TITLE_H + PAD + i*CELL + CELL/2;
    ctx.fillText(String(i+1), rx, ry);
  }
  ctx.fillStyle = "#334155"; ctx.font = "bold 12px sans-serif"; ctx.textAlign='center'; ctx.textBaseline='middle';
  let idx=1;
  for (let r=0;r<BOARD_SIZE;r++) {
    for (let c=0;c<BOARD_SIZE;c++) {
      const x=PAD+c*CELL + CELL/2, y=TITLE_H+PAD+r*CELL + CELL/2;
      const txt = String(idx++);
      ctx.fillText(txt, x, y+2);
    }
  }

  function drawStone(x,y,color){
    if (color === 'black') {
      ctx.strokeStyle="#ef4444"; ctx.lineWidth=3.2; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x-12,y-12); ctx.lineTo(x+12,y+12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+12,y-12); ctx.lineTo(x-12,y+12); ctx.stroke();
    } else {
      ctx.strokeStyle="#60a5fa"; ctx.lineWidth=3.2; ctx.beginPath(); ctx.arc(x,y,13,0,Math.PI*2); ctx.stroke();
    }
  }
  for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) {
    if (!game.board[r][c]) continue;
    const x=PAD+c*CELL + CELL/2, y=TITLE_H+PAD+r*CELL + CELL/2;
    drawStone(x,y,game.board[r][c]);
  }


  const winLine = options?.winLine;
  if (winLine && Array.isArray(winLine) && winLine.length>=2) {
    const start = winLine[0];
    const end = winLine[winLine.length-1];
    const sx = PAD + start.c*CELL + CELL/2;
    const sy = TITLE_H+PAD + start.r*CELL + CELL/2;
    const ex = PAD + end.c*CELL + CELL/2;
    const ey = TITLE_H+PAD + end.r*CELL + CELL/2;
  ctx.strokeStyle = "#000000"; 
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  // Footer info: move count
  let placed=0; for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) if (game.board[r][c]) placed++;
  ctx.fillStyle="#64748b"; ctx.font="12px sans-serif";
  const footer=`Nước đi: ${placed} / ${BOARD_SIZE*BOARD_SIZE}`;
  const fm=ctx.measureText(footer);
  ctx.fillText(footer, (width - fm.width)/2, height - 6);

  const dir=path.resolve("./assets/temp"); await fsPromises.mkdir(dir,{recursive:true});
  const filePath=path.resolve(`${dir}/carobot_${now()}.png`);
  await new Promise((res,rej)=>{
    const out=fs.createWriteStream(filePath);
    canvas.createPNGStream().pipe(out);
    out.on("finish",res); out.on("error",rej);
  });
  return filePath;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  if (typeof r === 'number') { r = {tl:r, tr:r, br:r, bl:r}; }
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// Helper: send image and always cleanup temp file (TTL-like)
async function sendImageTTL(api, threadId, type, imgPath, msg, ttl) {
  try {
    const payload = ttl ? { msg, attachments: [imgPath], ttl } : { msg, attachments: [imgPath] };
    await api.sendMessage(payload, threadId, type);
  } finally {
    try { await clearImagePath(imgPath); } catch {}
  }
}

// ================== TURN TIMER ==================
function clearPlayerTimer(record) {
  try { if (record && record.timer) { clearTimeout(record.timer); } } catch {}
  if (record) { record.timer = null; record.deadline = null; }
}

async function schedulePlayerTimer(api, threadId) {
  const record = activeThreadGames.get(threadId);
  if (!record) return;
  clearPlayerTimer(record);
  const deadline = Date.now() + TURN_TIMEOUT_MS;
  record.deadline = deadline;
  record.timer = setTimeout(async () => {
    const rec = activeThreadGames.get(threadId);
    if (!rec || rec.deadline !== deadline) return;
    const game = rec.game;
    if (!game || game.currentTurn !== 'player') return;
   
    const ownerId = rec.ownerId;
    const diff = game.difficulty || 'thuong';
    const ownerName = rec.ownerName || 'Bạn';
    const delta = getPointsDelta(diff, 'lose');
    const img = await drawBoard(game, ownerName);
    activeThreadGames.delete(threadId);
    updateCaroBotScore(ownerId, 'lose', diff);
    const lines = [
      `@${ownerName}`,
      `⏰ HẾT THỜI GIAN!`,
      `Bạn không đi trong 60 giây. Bot được xử thắng.`,
      `💥 Bạn đã bị trừ ${Math.abs(delta)} điểm!`
    ].join("\n");
    try { await sendImageTTL(api, threadId, rec.type || 'message', img, lines); } catch {}
  }, TURN_TIMEOUT_MS);
}


export async function handleCaroBotCommand(api,message,groupSettings,commandMain) {
  const threadId = message.threadId;
  const type = message.type;
  const prefix = (groupSettings?.prefix) || "×";
  const rawText = (message.data?.content || message.body || "").toString();

  const sliced = rawText.startsWith(prefix) ? rawText.slice(prefix.length) : rawText;
  const parts=sliced.trim().split(/\s+/);
  const sub=(parts[1]||"").toLowerCase();

  console.log('[Caro][dispatch]', { sub, raw: rawText });

  const ownerId = message.data?.uidFrom || message.senderId;
  const record = activeThreadGames.get(threadId);
  const token = sub;
  const isNumericMove = token && /^\d{1,3}$/.test(token);
  const isCoordMove = token && /^[a-p](?:[1-9]|1[0-6])$/.test(token);
  if (record && record.ownerId === ownerId && (isNumericMove || isCoordMove)) {
   
    const normParts = [parts[0], 'move', token];
    await playerMove(api, message, normParts, groupSettings);
    return;
  }
  if (!record && (isNumericMove || isCoordMove)) {
    await api.sendMessage({ msg: `${nameServer}: Hiện chưa có ván Caro nào trong nhóm.\nHãy bắt đầu bằng: ${prefix}caro [de|thuong|kho|thachdau] hoặc ${prefix}caro thách đấu` }, threadId, type);
    return;
  }

  switch(sub) {
    case "start": await startGame(api,message,parts,groupSettings); break;
    case "move": await playerMove(api,message,parts,groupSettings); break;
    case "surrender": await surrender(api,message,groupSettings); break;
    case "lose": await surrender(api,message,groupSettings); break; 
    case "board": await showBoard(api,message,groupSettings); break;
    case "top": await showTop(api,message,groupSettings); break;
    case "rank": await showRank(api,message,groupSettings); break;
    case "help": await sendCaroHelpUI(api,message,groupSettings); break;
    default:
      await startGame(api, message, parts, groupSettings);
  }
}

async function sendCaroHelpUI(api,message,groupSettings){
  const {threadId,type}=message;
  const prefix=groupSettings?.prefix||"/";
  const cmd=`${prefix}caro`;
  const ui = [
    `🎮 Chào Mừng Đến Với Trò Chơi Caro!`,
    ``,
    `👉 ${cmd} @người_chơi <điểm_cược> : Thách đấu người chơi`,
    `👉 ${cmd} [độ khó]: Chơi với bot`,
    `👉 ${cmd} rank: Xem bảng xếp hạng`,
    ``,
    `🤖 Các độ khó Bot:`,
    `📊 Dễ (de): Độ khó cơ bản, nhiều sơ hở cho người chơi làm quen (+80/-40 điểm)`,
    `📊 Thường (thuong): Độ khó trung bình, thích hợp với người chơi muốn tập triển khai tấn công (+200/-100 điểm)`,
    `📊 Khó (kho): Độ khó cao, tư duy tấn công đa điểm, thích hợp với người có kinh nghiệm và giỏi phòng thủ phản công (+1000/-150 điểm)`,
    `📊 Thách Đấu (thachdau): Độ khó cực cao, tương đương cấp độ tuyển thủ top cơ bản (+3000/-300 điểm)`,
    ``,
    `💡 Bạn có thể sử dụng các alias: dễ/de, thường/thuong, khó/kho, thách đấu/thachdau/thach/dau`,
    ``,
    `💡 Luật chơi: Ai tạo được 5 quân cùng hàng/cột/chéo trước sẽ thắng.`,
    `💡 Thời gian: 60 giây/lượt, gõ "lose" để đầu hàng.`,
    `🔧 Bàn cờ 16x16, mỗi ô đánh số từ 1-256.`,
    `🎯 Thêm "X" hoặc "first" để bot đi trước (VD: dễ X, thách đấu X)`
  ].join("\n");
  await api.sendMessage({msg: ui},threadId,type);
}

async function startGame(api,message,parts,groupSettings) {
  if (!(await checkBeforeJoinGame(api,message,groupSettings))) return;
  const threadId = message.threadId;
  const type = message.type;
  const senderId = message.data?.uidFrom || message.senderId; // fallback just in case
  const existing = activeThreadGames.get(threadId);
  if (existing) {
    if (existing.ownerId === senderId) {
      await api.sendMessage({msg:`${nameServer}: Bạn đang chơi Caro với bot rồi!`},threadId,type); return;
    }
    await api.sendMessage({msg:`${nameServer}: Hiện đang có một ván Caro đang diễn ra. Vui lòng đợi ván hiện tại kết thúc rồi thách đấu sau nhé.`},threadId,type);
    return;
  }

  let balance = { success: false, balance: "0" };
  try { balance = await getPlayerBalance(senderId); } catch (e) {}
  let bet = new Big(0);
  try {
    if (parts[2]) bet = parseGameAmount(parts[2], balance.success ? balance.balance : "0");
  } catch { bet = new Big(0); }
  if (bet.gt(0)) {
    if (!balance.success) {
      await api.sendMessage({msg:`${nameServer}: Bạn chưa có tài khoản game hoặc chưa đăng nhập, không thể đặt cược.`},threadId,type); return;
    }
    if (new Big(balance.balance).lt(bet)) {
      await api.sendMessage({msg:`${nameServer}: Số dư không đủ để đặt cược!`},threadId,type); return;
    }
  }
  const raw = (message.data?.content || message.body || '').toLowerCase();
  let difficulty='thuong';
  if (/\b(d[eê]|de|dễ)\b/.test(raw)) difficulty='de';
  else if (/\b(thuong|thường)\b/.test(raw)) difficulty='thuong';
  else if (/\b(kho|khó)\b/.test(raw)) difficulty='kho';
  else if (/\b(thachdau|thach\s*dau|thách\s*đấu)\b/.test(raw)) difficulty='thachdau';

  const botFirst = /\b(x|first)\b/.test(raw);

  const game={board:newBoard(),currentTurn: botFirst? 'bot':'player',betAmount:bet,difficulty, lastPlayerMove:null, lastBotMove:null, history: []};
  activeThreadGames.set(threadId,{ ownerId: senderId, ownerName: message.data?.dName || "Bạn", type, game, timer:null, deadline:null });
  const img=await drawBoard(game, message.data?.dName);
  await sendImageTTL(api, threadId, type, img, `${nameServer}: 🎮 Bắt đầu CaroBot!\nBạn là ●, bot là ○\nĐộ khó: ${difficulty}\n${botFirst? 'Bot đi trước' : 'Bạn đi trước'}\n${bet.gt(0)?`💰 Tiền cược: ${formatCurrency(bet)}`:""}`);
  if (botFirst) {
    const mv = botPickMove(game);
  if (mv) { game.board[mv.r][mv.c]='white'; game.lastBotMove = { r: mv.r, c: mv.c }; game.history.push({ r: mv.r, c: mv.c, color: 'white' }); game.currentTurn='player'; }
    const img2=await drawBoard(game, message.data?.dName);
    await sendImageTTL(api, threadId, type, img2, `${nameServer}: Bot đã đi. Tới lượt bạn.`, TURN_TIMEOUT_MS);
    await schedulePlayerTimer(api, threadId);
  }
}

async function playerMove(api,message,parts,groupSettings) {
  if (!(await checkBeforeJoinGame(api,message,groupSettings))) return;
  const threadId = message.threadId;
  const type = message.type;
  const senderId = message.data?.uidFrom || message.senderId;
  const record = activeThreadGames.get(threadId);
  if (!record) { await api.sendMessage({msg:`${nameServer}: Chưa có ván Caro nào đang diễn ra.`},threadId,type); return; }
  if (record.ownerId !== senderId) { await api.sendMessage({msg:`${nameServer}: Hiện ván này do người khác đang chơi, bạn vui lòng đợi lượt sau.`},threadId,type); return; }
  const game = record.game;
  if (game.currentTurn!=="player") { await api.sendMessage({msg:`${nameServer}: Chưa tới lượt bạn.`},threadId,type); return; }

  let pos = parsePosition(parts[2]);
  if (!pos && parts[2]) pos = parseNumericPosition(parts[2]);
  if (!pos||game.board[pos.row][pos.col]) {
    await api.sendMessage({msg:`${nameServer}: Nước đi không hợp lệ!`},threadId,type); return;
  }
  game.board[pos.row][pos.col]="black";
  game.lastPlayerMove = { r: pos.row, c: pos.col };
  game.history.push({ r: pos.row, c: pos.col, color: 'black' });
  if (game.history.length > 256) game.history.shift();
  const winPlayer = checkWin(game.board,pos.row,pos.col);
  if (winPlayer.win) {
    const ownerName = record.ownerName;
    const you = message.data?.dName || "Bạn";
    const lastNum = (pos.row*BOARD_SIZE + pos.col + 1);
    const delta = getPointsDelta(game.difficulty, 'win');
    clearPlayerTimer(record);
    activeThreadGames.delete(threadId); updateCaroBotScore(senderId,"win", game.difficulty);
  const img=await drawBoard(game, ownerName, { winLine: winPlayer.line || [] });
    const lines = [
      `@${you}`,
      `🎉 YOU WIN!`,
      `🧑‍💻 ${you} đánh ô số ${lastNum}`,
      `⚡ Bạn đã tạo thành chuỗi 5 quân liên tiếp và chiến thắng!`,
      `🏅 Bạn được cộng ${delta} điểm!`
    ].join("\n");
    await sendImageTTL(api, threadId, type, img, lines); return;
  }
  game.currentTurn="bot";
  const botMove=botPickMove(game);
  if (!botMove) { const ownerName = record.ownerName; const you = message.data?.dName || "Bạn"; const delta=getPointsDelta(game.difficulty,'draw');
    clearPlayerTimer(record);
    activeThreadGames.delete(threadId); updateCaroBotScore(senderId,"draw", game.difficulty);
  const img=await drawBoard(game, ownerName);
    const lines=[
      `@${you}`,
      `🤝 HÒA!`,
      `⏸️ Không còn nước đi hiệu quả, ván đấu kết thúc với kết quả hòa.`,
      `${delta!==0? (delta>0?`🏅 +${delta} điểm`:`❗ ${delta} điểm`):""}`
    ].filter(Boolean).join("\n");
    await sendImageTTL(api, threadId, type, img, lines); return; }
  game.board[botMove.r][botMove.c]="white";
  game.lastBotMove = { r: botMove.r, c: botMove.c };
  game.history.push({ r: botMove.r, c: botMove.c, color: 'white' });
  if (game.history.length > 256) game.history.shift();
  const winBot = checkWin(game.board,botMove.r,botMove.c);
  if (winBot.win) {
    const ownerName = record.ownerName;
    const you = message.data?.dName || "Bạn";
    const yourNum = (pos.row*BOARD_SIZE + pos.col + 1);
    const botNum = (botMove.r*BOARD_SIZE + botMove.c + 1);
    const delta = getPointsDelta(game.difficulty, 'lose');
    clearPlayerTimer(record);
    activeThreadGames.delete(threadId); updateCaroBotScore(senderId,"lose", game.difficulty);
  const img=await drawBoard(game, ownerName, { winLine: winBot.line || [] });
    const lines = [
      `@${you}`,
      `🤖 BOT WIN!`,
      `🎮 ${you} đánh ô số ${yourNum}`,
      `🌀 Bot ${game.difficulty==='thachdau'?'thách đấu ':''}đánh ô số ${botNum}`,
      `⚡ Bot đã tạo thành chuỗi 5 quân liên tiếp và chiến thắng!`,
      `� Bạn đã bị trừ ${Math.abs(delta)} điểm!`,
      `🎯 Hãy rút kinh nghiệm và thử lại lần sau!`
    ].join("\n");
    await sendImageTTL(api, threadId, type, img, lines); return;
  }
  game.currentTurn="player";
  const ownerName = record.ownerName;
  const img=await drawBoard(game, ownerName);
  const you = message.data?.dName || "Bạn";
  const playerNum = (pos.row*BOARD_SIZE + pos.col + 1);
  const botNum = ((botMove.r)*BOARD_SIZE + botMove.c + 1);
  await schedulePlayerTimer(api, threadId);
  const remainSec = 60;
  const textMsg = `@${you}\n👤 ${you} đánh ô số ${playerNum}\n🤖 Bot đánh ô số ${botNum}\n\n👉 Lượt của @${you}!\n⏰ Thời gian: ${remainSec} giây\nChọn số từ 1-256 để đánh quân cờ.`;
  await sendImageTTL(api, threadId, type, img, textMsg, TURN_TIMEOUT_MS);
}

async function surrender(api,message,groupSettings) {
  if (!(await checkBeforeJoinGame(api,message,groupSettings))) return;
  const threadId = message.threadId;
  const type = message.type;
  const senderId = message.data?.uidFrom || message.senderId;
  const record = activeThreadGames.get(threadId);
  if (!record || record.ownerId !== senderId) { await api.sendMessage({msg:`${nameServer}: Bạn chưa chơi CaroBot`},threadId,type); return; }
  const diff = record.game?.difficulty || "thuong";
  const ownerName = record.ownerName;
  clearPlayerTimer(record);
  activeThreadGames.delete(threadId); updateCaroBotScore(senderId,"lose", diff);
  const img=await drawBoard(record.game, ownerName);
  await sendImageTTL(api, threadId, type, img, `${nameServer}: 🏳️ Bạn đầu hàng bot!`);
}

async function showBoard(api,message,groupSettings) {
  if (!(await checkBeforeJoinGame(api,message,groupSettings))) return;
  const threadId = message.threadId;
  const type = message.type;
  const record = activeThreadGames.get(threadId);
  if (!record) { await api.sendMessage({msg:`${nameServer}: Không có ván CaroBot`},threadId,type); return; }
  const game = record.game;
  const img=await drawBoard(game, record.ownerName);
  await sendImageTTL(api, threadId, type, img, `${nameServer}: Bàn hiện tại`);
}

async function showRank(api,message,groupSettings) {
  if (!(await checkBeforeJoinGame(api,message,groupSettings))) return;
  const threadId = message.threadId;
  const type = message.type;
  const senderId = message.data?.uidFrom || message.senderId;
  const score=getCaroBotScore(senderId);
  const rank = getCaroBotRankOf(senderId);
  await api.sendMessage({msg:`${nameServer}: 📊 Thành tích CaroBot của bạn\n🏆 Thắng: ${score.win}\n❌ Thua: ${score.lose}\n➖ Hòa: ${score.draw}\n⭐ Điểm: ${score.points || 0}${rank? `\n🎖️ Hạng: #${rank}`:""}`},threadId,type);
}

async function showTop(api,message,groupSettings){
  if (!(await checkBeforeJoinGame(api,message,groupSettings))) return;
  const threadId = message.threadId;
  const type = message.type;
  const top = getCaroBotTop(10);
  if (!top || top.length===0) { await api.sendMessage({msg:`${nameServer}: Chưa có dữ liệu xếp hạng.`},threadId,type); return; }

  const enriched = [];
  for (const e of top) {
    let name = null;
    try {
      const info = await getUserInfoData(api, e.uid);
      name = info?.name || null;
    } catch {}
    enriched.push({ ...e, name });
  }

  const selfId = message.data?.uidFrom || message.senderId;
  const selfRank = getCaroBotRankOf(selfId);
  const selfScore = getCaroBotScore(selfId);
  const imgPath = await createCaroTopImage(enriched, { selfRank, selfPoints: selfScore.points || 0 });
  await sendImageTTL(api, threadId, type, imgPath, `${nameServer}: 🏆 Bảng xếp hạng Caro - Top 10 cao thủ`);
}

export async function tryHandlePassiveCaroMove(api, message, groupSettings) {
  const threadId = message.threadId;
  const type = message.type;
  const text = (message?.data?.content?.title || message?.data?.content || "").toString().trim().toLowerCase();
  if (!text) return false;
  let isValidToken = false;
  if (/^[a-p](?:[1-9]|1[0-6])$/.test(text)) {
    isValidToken = true;
  } else if (/^[1-9]\d{0,2}$/.test(text)) {
    const n = parseInt(text, 10);
    if (n >= 1 && n <= BOARD_SIZE * BOARD_SIZE) isValidToken = true;
  }
  if (!isValidToken) return false;
  if (groupSettings?.activeBot === false || groupSettings?.activeGame === false) return false;
  const record = activeThreadGames.get(threadId);
  if (!record) return false;
  const senderId = message.data?.uidFrom || message.senderId;
  if (record.ownerId !== senderId) return false;

  const normParts = ['caro','move',text];
  await playerMove(api, message, normParts, groupSettings);
  return true;
}

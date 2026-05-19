
const BOARD_SIZE = 16;
const CHALLENGE_TIME_MS = 2000; 
const CHALLENGE_DEPTH_MAX = 7; 
const CHALLENGE_BEAM_ROOT = 256; 
const CHALLENGE_BEAM_INNER = 14; 
const CHALLENGE_ORDER_RADIUS = 3; 
const TACTICAL_PICK_MIN = 7900;
const LMR_MIN_DEPTH = 3; 
const LMR_THRESHOLD_INDEX = 5; 
const LMR_REDUCTION = 1;
const STOCH_ROOT_TOP = 3;
const STOCH_HEUR_TOP = 3; 
const STOCH_WEIGHTS = [0.6, 0.3, 0.1];

function inBounds(r, c) { return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE; }

function randomMove(board) {
  const empty = [];
  for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) {
    if (!board[r][c]) empty.push({r,c});
  }
  if (!empty.length) return null;
  return empty[Math.floor(Math.random()*empty.length)];
}

function checkWin(board, r, c) {
  if (!inBounds(r, c) || !board[r][c]) return { win: false };
  const color = board[r][c];
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    let count = 1;
    let rr=r+dr, cc=c+dc;
    while (inBounds(rr,cc) && board[rr][cc]===color) { count++; rr+=dr; cc+=dc; }
    rr=r-dr; cc=c-dc;
    while (inBounds(rr,cc) && board[rr][cc]===color) { count++; rr-=dr; cc-=dc; }
    if (count>=5) return { win:true };
  }
  return { win:false };
}

function findImmediateWin(board, color) {
  for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) {
    if (board[r][c]) continue;
    board[r][c]=color;
    if (checkWin(board,r,c).win) { board[r][c]=null; return {r,c}; }
    board[r][c]=null;
  }
  return null;
}

function listImmediateWins(board, color) {
  const wins = [];
  for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) {
    if (board[r][c]) continue;
    board[r][c]=color;
    if (checkWin(board,r,c).win) wins.push({ r, c });
    board[r][c]=null;
  }
  return wins;
}

function listOpponentStrongSetups(board, opp, me) {
  const out = [];
  for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) {
    if (board[r][c]) continue;
    board[r][c]=opp;
    const t = threatClass(board, r, c, opp, me);
    board[r][c]=null;
    if (t >= 7900) { 
      out.push({ r, c, t });
    } else if (t >= 6000) {
      out.push({ r, c, t });
    }
  }
  out.sort((a,b)=> b.t - a.t);
  return out;
}

function chooseBestPreBlock(board, me, opp) {
  const setups = listOpponentStrongSetups(board, opp, me);
  if (!setups.length) return null;
  let best=null, bestScore=-Infinity;
  for (const s of setups) {
    const { r, c, t } = s; if (board[r][c]) continue;
    const atk = evaluatePlacement(board, r, c, me);
    const def = evaluatePlacement(board, r, c, opp);
    const blunder = countOpponentImmediateWinsAfterMove(board, r, c, me, opp) * 12_000_000;
    const threatBonus = (t >= 7900 ? 5_000_000 : (t >= 6000 ? 1_000_000 : 0));
    const score = def*1.4 + atk*0.35 + Math.min(def, atk)*0.25 + threatBonus - blunder;
    if (score > bestScore) { bestScore = score; best = { r, c }; }
  }
  return best;
}

function chooseBestBlock(board, me, opp) {
  const oppWins = listImmediateWins(board, opp);
  if (!oppWins.length) return null;
  if (oppWins.length === 1) return { r: oppWins[0].r, c: oppWins[0].c };

  const candidates = orderedCandidates(board, me, opp, 3, CHALLENGE_BEAM_INNER);
  let best = null; let bestScore = -Infinity;
  for (const { r, c } of candidates) {
    if (board[r][c]) continue;
    board[r][c] = me;
    const remain = listImmediateWins(board, opp).length;
    const atk = evaluatePlacement(board, r, c, me);
    const def = evaluatePlacement(board, r, c, opp);
    const score = -(remain * 1_000_000) + def * 1.2 + atk * 0.4;
    board[r][c] = null;
    if (score > bestScore) { bestScore = score; best = { r, c }; }
  }
  return best || { r: oppWins[0].r, c: oppWins[0].c };
}

function evaluatePlacement(board, r, c, color) {
  board[r][c] = color;
  const score = evaluateBoardPoint(board, r, c, color);
  board[r][c] = null;
  return score;
}

const W = {
  FIVE: 1_000_000_000,
  OPEN4: 5_000_000,
  CLOSED4: 800_000,
  OPEN3: 120_000,
  CLOSED3: 25_000,
  OPEN2: 6_000,
  CLOSED2: 1_200,
  CENTER: 500,
  NEAR_FRIEND: 400,
};

function computeDynamicWeightsRoot(board) {
  const me='white', opp='black';
  const cand = generateCandidates(board, 2);
  let meT=0, oppT=0;
  for (const {r,c} of cand) {
    const t = threatClass(board, r, c, me, opp);
    if (t>=5900) meT++; 
    const to = threatClass(board, r, c, opp, me);
    if (to>=5900) oppT++; 
  }
  let wAtk = 0.9, wDef = 1.35;
  if (oppT - meT >= 2) { wDef = 1.55; wAtk = 0.85; }
  else if (meT - oppT >= 2) { wAtk = 1.05; wDef = 1.25; }
  return { wAtk, wDef };
}

function evalLine(board, r, c, dr, dc, color) {
  let count1=0, rr=r+dr, cc=c+dc;
  while (inBounds(rr,cc) && board[rr][cc]===color) { count1++; rr+=dr; cc+=dc; }
  const open1 = inBounds(rr,cc) && !board[rr][cc];
  let count2=0; rr=r-dr; cc=c-dc;
  while (inBounds(rr,cc) && board[rr][cc]===color) { count2++; rr-=dr; cc-=dc; }
  const open2 = inBounds(rr,cc) && !board[rr][cc];
  const len = count1 + 1 + count2;
  const openEnds = (open1?1:0) + (open2?1:0);
  return { len, openEnds };
}

function evaluateBoardPoint(board, r, c, color) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  let total = 0;
  for (const [dr,dc] of dirs) {
    const { len, openEnds } = evalLine(board, r, c, dr, dc, color);
    if (len >= 5) { total += W.FIVE; continue; }
    if (len === 4) {
      total += (openEnds === 2) ? W.OPEN4 : (openEnds === 1 ? W.CLOSED4 : 0);
      continue;
    }
    if (len === 3) {
      total += (openEnds === 2) ? W.OPEN3 : (openEnds === 1 ? W.CLOSED3 : 0);
      continue;
    }
    if (len === 2) {
      total += (openEnds === 2) ? W.OPEN2 : (openEnds === 1 ? W.CLOSED2 : 0);
      continue;
    }
  }
  const centerR = Math.floor(BOARD_SIZE/2), centerC = Math.floor(BOARD_SIZE/2);
  const dist = Math.abs(centerR - r) + Math.abs(centerC - c);
  total += Math.max(0, W.CENTER - dist*40);

  let nearFriend = 0;
  for (let dr=-1; dr<=1; dr++) for (let dc=-1; dc<=1; dc++) {
    if (!dr && !dc) continue; const rr=r+dr, cc=c+dc;
    if (inBounds(rr,cc) && board[rr][cc]===color) nearFriend++;
  }
  total += nearFriend * W.NEAR_FRIEND;

  return total;
}

function generateCandidates(board, radius=2) {
  const candidates = new Set();
  const push = (r,c)=>{ if (inBounds(r,c) && !board[r][c]) candidates.add(r+","+c); };
  let hasStone=false;
  for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) {
    if (!board[r][c]) continue; hasStone=true;
    for (let dr=-radius; dr<=radius; dr++) for (let dc=-radius; dc<=radius; dc++) {
      push(r+dr,c+dc);
    }
  }
  if (!hasStone) {
    const center = { r: Math.floor(BOARD_SIZE/2), c: Math.floor(BOARD_SIZE/2) };
    return [center];
  }
  return Array.from(candidates).map(s=>{ const [r,c]=s.split(",").map(Number); return {r,c}; });
}

function chooseCenterOrNear(board, near) {
  const center = { r: Math.floor(BOARD_SIZE/2), c: Math.floor(BOARD_SIZE/2) };
  if (!board[center.r][center.c]) return center;
  const candidates=[]; const radius=2; const base = near || center;
  for (let dr=-radius; dr<=radius; dr++) for (let dc=-radius; dc<=radius; dc++) {
    const rr=base.r+dr, cc=base.c+dc;
    if (inBounds(rr,cc) && !board[rr][cc]) candidates.push({r:rr,c:cc});
  }
  if (candidates.length) return candidates[Math.floor(Math.random()*candidates.length)];
  return randomMove(board);
}

function pickBestByHeuristic(board, me, opp, radius, near, opts) {
  const candidates = generateCandidates(board, radius);
  let best = null, bestScore = -Infinity;
  const scoredList = [];
  for (const {r,c} of candidates) {
    const attack = evaluatePlacement(board, r, c, me);
    const defense = evaluatePlacement(board, r, c, opp);
    const penalty = countOpponentImmediateWinsAfterMove(board, r, c, me, opp) * 12_000_000; 
    const myForks = countMyImmediateWinsAfterMove(board, r, c, me) || 0;
    const forkBonus = myForks >= 2 ? 250000 : (myForks === 1 ? 60000 : 0);
    let prox = 0;
    if (near) {
      const d = Math.max(Math.abs(near.r - r), Math.abs(near.c - c));
      if (d === 0) prox = 120000; else if (d === 1) prox = 180000; else if (d === 2) prox = 110000; else if (d === 3) prox = 45000; else if (d >= 5) prox = -50000;
    }
    let score = attack + Math.min(defense * 1.1, W.FIVE - 1) + forkBonus + prox - penalty;
    scoredList.push({ r, c, score });
    if (score > bestScore) { bestScore = score; best = { r, c }; }
  }
  if (!scoredList.length) return randomMove(board);
  scoredList.sort((a,b)=> b.score - a.score);
  let pool = scoredList.slice(0, Math.min(STOCH_HEUR_TOP, scoredList.length))
    .filter(m => countOpponentImmediateWinsAfterMove(board, m.r, m.c, me, opp) === 0);
  const forkPool = pool.filter(m => (countMyImmediateWinsAfterMove(board, m.r, m.c, me) || 0) >= 2);
  if (forkPool.length) {
    forkPool.sort((a,b)=> b.score - a.score);
    return { r: forkPool[0].r, c: forkPool[0].c };
  }
  if (!opts?.deterministic && pool.length >= 2) {
    const idx = randomWeightedIndex(Math.min(pool.length, STOCH_WEIGHTS.length));
    return { r: pool[idx].r, c: pool[idx].c };
  }
  return best || randomMove(board);
}
function countOpponentImmediateWinsAfterMove(board, r, c, me, opp) {
  if (board[r][c]) return 0;
  board[r][c] = me;
  const cnt = listImmediateWins(board, opp).length;
  board[r][c] = null;
  return cnt;
}

function easyPickMove(game) {
  const board = game.board;
  const near = game.lastPlayerMove || { r: Math.floor(BOARD_SIZE/2), c: Math.floor(BOARD_SIZE/2) };
  return chooseCenterOrNear(board, near);
}

function normalPickMove(game) {
  const board = game.board; const me='white', opp='black';
  const win = findImmediateWin(board, me); if (win) return win;
  const blockBest = chooseBestBlock(board, me, opp); if (blockBest) return blockBest;
  const pre = chooseBestPreBlock(board, me, opp); if (pre) return pre;
  const tact = generateTacticalMoves(board, me, opp);
  if (tact.length) {
    const { r, c } = tact[0];
    const t = threatClass(board, r, c, me, opp);
    if (t >= TACTICAL_PICK_MIN) return { r, c };
  }
  return pickBestByHeuristic(board, me, opp, 2, game.lastPlayerMove || null);
}

function hardPickMove(game) {
  const board = game.board; const me='white', opp='black';
  const win = findImmediateWin(board, me); if (win) return win;
  const blockBest = chooseBestBlock(board, me, opp); if (blockBest) return blockBest;
  const pre = chooseBestPreBlock(board, me, opp); if (pre) return pre;
  return pickBestByHeuristic(board, me, opp, 3, game.lastPlayerMove || null);
}

const TT = new Map(); 
const HISTORY_SCORES = new Map(); 
const KILLER_MOVES = new Map(); 

function boardKey(board) {

  let out = '';
  for (let r=0;r<BOARD_SIZE;r++) {
    for (let c=0;c<BOARD_SIZE;c++) {
      const v = board[r][c];
      out += v === 'white' ? '1' : (v === 'black' ? '2' : '0');
    }
  }
  return out;
}

function evaluateWholeBoard(board) {
  const me='white', opp='black';
  const cand = generateCandidates(board, 2);
  if (!cand.length) return 0;
  let score = 0;
  for (const {r,c} of cand) {
    const a = evaluatePlacement(board, r, c, me);
    const d = evaluatePlacement(board, r, c, opp);
    score += a - d*1.3; 
  }
  return score;
}

function lineInfo(board, r, c, dr, dc, color) {
  let cntF=0, rr=r+dr, cc=c+dc;
  while (inBounds(rr,cc) && board[rr][cc]===color) { cntF++; rr+=dr; cc+=dc; }
  const openF = inBounds(rr,cc) && !board[rr][cc];
  let cntB=0; rr=r-dr; cc=c-dc;
  while (inBounds(rr,cc) && board[rr][cc]===color) { cntB++; rr-=dr; cc-=dc; }
  const openB = inBounds(rr,cc) && !board[rr][cc];
  const len = cntF + 1 + cntB; const openEnds = (openF?1:0)+(openB?1:0);
  return { len, openEnds };
}

function threatClass(board, r, c, me, opp) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  let bestMe=0, open4Me=0, open3Me=0;
  let bestOpp=0, open4Opp=0, open3Opp=0;
  for (const [dr,dc] of dirs) {
    const im = lineInfo(board, r, c, dr, dc, me);
    const io = lineInfo(board, r, c, dr, dc, opp);
    bestMe = Math.max(bestMe, im.len);
    bestOpp = Math.max(bestOpp, io.len);
    if (im.len===4 && im.openEnds===2) open4Me++;
    if (io.len===4 && io.openEnds===2) open4Opp++;
    if (im.len===3 && im.openEnds===2) open3Me++;
    if (io.len===3 && io.openEnds===2) open3Opp++;
  }
  if (bestMe>=5) return 10000; 
  if (bestOpp>=5) return 9000; 
  if (open4Me>0) return 8000; 
  if (open4Opp>0) return 7900; 
  if (open3Me>=2) return 6000; 
  if (open3Opp>=2) return 5900; 
  return Math.max(bestMe*100, bestOpp*90);
}

function orderedCandidates(board, me, opp, radius, topK) {
  const list = generateCandidates(board, radius);
  if (!list.length) return list;
  const scored = list.map(({r,c})=>{
    const t = threatClass(board, r, c, me, opp);
    const attack = evaluatePlacement(board, r, c, me);
    const defend = Math.min(evaluatePlacement(board, r, c, opp)*1.35, 9e8); 
    const myForks = countMyImmediateWinsAfterMove(board, r, c, me) || 0; 
    const h = attack + defend;
    const hist = HISTORY_SCORES.get(r+","+c) || 0;
    const killerBoost =  KILLER_MOVES.size ? (Array.from(KILLER_MOVES.values()).some(set=>set.has(r+","+c)) ? 100000 : 0) : 0;
    const synergy = Math.min(attack, defend) * 0.2;
    const forkBonus = myForks >= 2 ? 250000 : (myForks === 1 ? 60000 : 0);
    return { r, c, s: t*10 + h + synergy + hist*50 + killerBoost + forkBonus };
  });
  scored.sort((x,y)=> y.s - x.s);
  const beam = scored.slice(0, Math.max(1, topK));
  return beam.map(({r,c})=>({r,c}));
}

function orderedCandidatesWeightedRoot(board, me, opp, radius, topK, wAtk, wDef, lastOppMove) {
  const list = generateCandidates(board, radius);
  if (!list.length) return list;
  const scored = list.map(({r,c})=>{
    const t = threatClass(board, r, c, me, opp);
    const attack = evaluatePlacement(board, r, c, me) * wAtk;
    const defend = Math.min(evaluatePlacement(board, r, c, opp)*wDef, 9e8);
    const myForks = countMyImmediateWinsAfterMove(board, r, c, me) || 0;
    const blunderPenalty = (typeof countOpponentImmediateWinsAfterMove === 'function')
      ? countOpponentImmediateWinsAfterMove(board, r, c, me, opp) * 10_000_000
      : 0;
    const hist = HISTORY_SCORES.get(r+","+c) || 0;
    const killerBoost =  KILLER_MOVES.size ? (Array.from(KILLER_MOVES.values()).some(set=>set.has(r+","+c)) ? 100000 : 0) : 0;
    const synergy = Math.min(attack, defend) * 0.2; 
    const tacticalBonus = (t >= 6000 ? 80000 : 0) + (t >= 7900 ? 120000 : 0);
    let proxBonus = 0;
    if (lastOppMove) {
      const d = Math.max(Math.abs(lastOppMove.r - r), Math.abs(lastOppMove.c - c)); 
      if (d === 1) proxBonus = 220000; else if (d === 2) proxBonus = 140000; else if (d === 3) proxBonus = 60000; else if (d >= 5) proxBonus = -40000;
    }
    const forkBonus = myForks >= 2 ? 300000 : (myForks === 1 ? 70000 : 0);
    return { r, c, s: t*10 + attack + defend + synergy + hist*50 + killerBoost + tacticalBonus + proxBonus + forkBonus - blunderPenalty };
  });
  scored.sort((x,y)=> y.s - x.s);
  const beam = scored.slice(0, Math.max(1, topK));
  return beam.map(({r,c})=>({r,c}));
}

function generateTacticalMoves(board, me, opp) {
  const list = generateCandidates(board, 2);
  const out = [];
  for (const {r,c} of list) {
    const t = threatClass(board, r, c, me, opp);
    if (t >= 5900) out.push({r,c,t});
  }
  out.sort((a,b)=> b.t - a.t);
  return out.map(({r,c})=>({r,c}));
}

function negamax(board, depth, alpha, beta, colorSign, lastMove, timeBudgetEnd) {
  if (timeBudgetEnd && Date.now() > timeBudgetEnd) return { score: 0, timeout: true };
  if (lastMove && checkWin(board, lastMove.r, lastMove.c).win) {
    return { score: -1_000_000_000 + (depth*1_000) };
  }
  const key = boardKey(board) + ':' + colorSign + ':' + depth;
  const tt = TT.get(key);
  if (tt && tt.depth >= depth) return { score: tt.score, move: tt.move };

  if (depth === 0) {
    const me = colorSign === 1 ? 'white' : 'black';
    const opp = colorSign === 1 ? 'black' : 'white';
    const tMoves = generateTacticalMoves(board, me, opp);
    if (tMoves.length) {
      let best = -Infinity;
      for (const {r,c} of tMoves) {
        if (board[r][c]) continue; board[r][c]=me;
        const ch = negamax(board, 0, -beta, -alpha, -colorSign, {r,c}, timeBudgetEnd);
        const sc = -ch.score; board[r][c]=null;
        if (ch.timeout) return { score: 0, timeout: true };
        if (sc > best) best = sc;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      if (best !== -Infinity) {
        TT.set(key, { score: best, depth });
        return { score: best };
      }
    }
    const ev = colorSign * evaluateWholeBoard(board);
    TT.set(key, { score: ev, depth });
    return { score: ev };
  }

  const me = colorSign === 1 ? 'white' : 'black';
  const opp = colorSign === 1 ? 'black' : 'white';
  const cand = orderedCandidates(board, me, opp, 3, CHALLENGE_BEAM_INNER);
  if (!cand.length) return { score: 0 };
  let bestScore = -Infinity; let bestMove = null; let first = true;
  let idx = 0;
  for (const {r,c} of cand) {
    if (timeBudgetEnd && Date.now() > timeBudgetEnd) return { score: 0, timeout: true };
    if (board[r][c]) continue;
    board[r][c] = me;
    let ch;
    let effDepth = depth - 1;
    if (!first && depth >= LMR_MIN_DEPTH && idx >= LMR_THRESHOLD_INDEX) {
      effDepth = Math.max(0, effDepth - LMR_REDUCTION);
    }
    if (first) {
      ch = negamax(board, depth-1, -beta, -alpha, -colorSign, {r,c}, timeBudgetEnd); 
      first = false;
    } else {
      ch = negamax(board, effDepth, -alpha-1, -alpha, -colorSign, {r,c}, timeBudgetEnd);
      if (!ch.timeout && -ch.score > alpha && -ch.score < beta) {
        ch = negamax(board, effDepth, -beta, -alpha, -colorSign, {r,c}, timeBudgetEnd);
      }
    }
    const sc = -ch.score;
    board[r][c] = null;
    if (ch.timeout) return { score: 0, timeout: true };
    if (sc > bestScore) {
      bestScore = sc; bestMove = { r, c };
      if (depth>=2) {
        const keyRC = r+","+c;
        HISTORY_SCORES.set(keyRC, (HISTORY_SCORES.get(keyRC)||0) + depth*depth);
        const set = KILLER_MOVES.get(depth) || new Set(); set.add(keyRC); KILLER_MOVES.set(depth, set);
      }
    }
    if (bestScore > alpha) alpha = bestScore;
    if (alpha >= beta) break;
    idx++;
  }
  TT.set(key, { score: bestScore, depth, move: bestMove });
  return { score: bestScore, move: bestMove };
}

function challengePickMove(game) {
  const board = game.board; const me='white', opp='black';
  const win = findImmediateWin(board, me); if (win) return win;
  const blockBest = chooseBestBlock(board, me, opp); if (blockBest) return blockBest;
  const pre = chooseBestPreBlock(board, me, opp); if (pre) return pre;

  let timeBudgetEnd = Date.now() + CHALLENGE_TIME_MS;
  let best=null; let bestScore=-Infinity;
  let { wAtk, wDef } = computeDynamicWeightsRoot(board);
  wAtk *= 1.08; 
  wDef *= 0.96; 
  const lastOpp = game.lastPlayerMove || null;
  let placed=0; for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) if (board[r][c]) placed++;
  if (lastOpp && placed <= 6) {
    const adj = pickBestAdjacent(board, me, opp, lastOpp, 3);
    if (adj) return adj;
  }
  const rootCand = orderedCandidatesWeightedRoot(board, me, opp, CHALLENGE_ORDER_RADIUS, CHALLENGE_BEAM_ROOT, wAtk, wDef, lastOpp);
  if (!rootCand.length) return chooseCenterOrNear(board, game.lastPlayerMove);
  for (const {r,c} of rootCand) {
    const t = threatClass(board, r, c, me, opp);
    if (t >= TACTICAL_PICK_MIN) return { r, c };
  }
  let window = 200000; 
  let maxDepth = CHALLENGE_DEPTH_MAX;
  if (rootCand.length <= 8) maxDepth += 1;
  const rootScores = new Map(); 
  for (let depth=2; depth<=maxDepth; depth++) {
    if (Date.now() > timeBudgetEnd) break;
    let alpha = (bestScore===-Infinity)? -Infinity : bestScore - window;
    let beta  = (bestScore===-Infinity)?  Infinity : bestScore + window;
    let curBest=null, curBestScore=-Infinity; let first=true;
    for (const {r,c} of rootCand) {
      if (Date.now() > timeBudgetEnd) break;
      if (board[r][c]) continue;
      board[r][c]=me;
      let ch;
      if (first) { ch = negamax(board, depth-1, -beta, -alpha, -1, {r,c}, timeBudgetEnd); first=false; }
      else {
        ch = negamax(board, depth-1, -alpha-1, -alpha, -1, {r,c}, timeBudgetEnd);
        if (!ch.timeout && -ch.score > alpha && -ch.score < beta) {
          ch = negamax(board, depth-1, -beta, -alpha, -1, {r,c}, timeBudgetEnd);
        }
      }
      const sc = -ch.score; board[r][c]=null;
      if (ch.timeout) break;
      if (sc > curBestScore) { curBestScore = sc; curBest = { r, c }; }
      rootScores.set(r+","+c, sc);
      if (sc > alpha) alpha = sc;
    }
    if (curBest) {
      best = curBest; bestScore = curBestScore; window = Math.max(50000, Math.abs(bestScore)/4);
      if (depth>=3 && Date.now() + 120 < timeBudgetEnd && Math.abs(bestScore) > 250000) {
        timeBudgetEnd += 120; 
      }
    }
  }

  if (best) {
    if (lastOpp) {
      const bestD = Math.max(Math.abs(lastOpp.r - best.r), Math.abs(lastOpp.c - best.c));
      if (bestD >= 5) {
        const arr = rootCand
          .map(({r,c})=>({ r, c, score: rootScores.get(r+","+c) ?? -Infinity }))
          .filter(e=> Number.isFinite(e.score))
          .sort((a,b)=> b.score - a.score);
        const local = arr.filter(m=> Math.max(Math.abs(lastOpp.r - m.r), Math.abs(lastOpp.c - m.c)) <= 3);
        if (local.length) {
          const localBest = local[0];
          const safeLocal = countOpponentImmediateWinsAfterMove(board, localBest.r, localBest.c, me, opp) === 0;
          if (safeLocal && localBest.score >= (bestScore - 80000)) {
            return { r: localBest.r, c: localBest.c };
          }
        }
      }
    }
    return best;
  }
  return pickBestByHeuristic(board, me, opp, 3, lastOpp, { deterministic: true });
}

function pickBestAdjacent(board, me, opp, target, maxD=2) {
  if (!target) return null;
  let best=null, bestScore=-Infinity;
  for (let dr=-maxD; dr<=maxD; dr++) for (let dc=-maxD; dc<=maxD; dc++) {
    const r = target.r + dr, c = target.c + dc;
    if (!inBounds(r,c) || board[r][c]) continue;
    const d = Math.max(Math.abs(dr), Math.abs(dc));
    const atk = evaluatePlacement(board, r, c, me);
    const def = evaluatePlacement(board, r, c, opp) * 1.35; 
    const blunder = countOpponentImmediateWinsAfterMove(board, r, c, me, opp) * 12_000_000;
  const prox = (d === 1 ? 180000 : d === 2 ? 110000 : 0);
    const forks = countMyImmediateWinsAfterMove(board, r, c, me) || 0;
    const forkB = forks >= 2 ? 250000 : (forks === 1 ? 60000 : 0);
    const s = atk + def + Math.min(atk, def)*0.2 + prox + forkB - blunder;
    if (s > bestScore) { bestScore = s; best = { r, c }; }
  }
  return best;
}

function randomWeightedIndex(n) {
  const w = STOCH_WEIGHTS.slice(0, n);
  const sum = w.reduce((a,b)=>a+b,0);
  const r = Math.random()*sum;
  let acc=0;
  for (let i=0;i<w.length;i++) { acc += w[i]; if (r <= acc) return i; }
  return 0;
}

function countMyImmediateWinsAfterMove(board, r, c, me) {
  if (board[r][c]) return 0;
  board[r][c] = me;
  const cnt = listImmediateWins(board, me).length;
  board[r][c] = null;
  return cnt;
}

const strategyMap = {
  de: easyPickMove,
  thuong: normalPickMove,
  kho: hardPickMove,
  thachdau: challengePickMove,
};

function pickMoveForDifficulty(game) {
  const diff = game.difficulty || 'thuong';
  const fn = strategyMap[diff] || normalPickMove;
  return fn(game);
}

function botPickMove(game) { return pickMoveForDifficulty(game); }

export { botPickMove, pickMoveForDifficulty, findImmediateWin, chooseCenterOrNear };

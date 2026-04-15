// ── 字庫（4 難度，每組 6 字，每天輪 3 字）────────────────
const LEVELS = [
  { name: '小小孩', chars: ['一','二','三','十','口','日'] },
  { name: '低年級', chars: ['大','小','中','人','手','木','火','水'] },
  { name: '中年級', chars: ['山','天','地','心','上','下','土','月'] },
  { name: '高年級', chars: ['明','林','好','字','學','休','森'] },
];

// 獎章定義（每 5 顆星解鎖一個）
const BADGES = [
  { id:'b1', emoji:'🌟', name:'第一顆星', need:5 },
  { id:'b2', emoji:'🎨', name:'小畫家',   need:10 },
  { id:'b3', emoji:'📚', name:'愛讀書',   need:20 },
  { id:'b4', emoji:'🦁', name:'勇敢獅子', need:35 },
  { id:'b5', emoji:'🚀', name:'筆順火箭', need:50 },
  { id:'b6', emoji:'👑', name:'國字之王', need:75 },
  { id:'b7', emoji:'💎', name:'鑽石筆順', need:100 },
];

const BASE = 'https://raw.githubusercontent.com/c9s/zh-stroke-data/master/json/';
const VBOX = 2048;

// ── 狀態 ─────────────────────────────────────────────────
let curLevel = 0;
let chars = [], charData = [], charDone = [];
let curChar = 0, curStroke = 0;
let drawing = false, path = [];

// ── localStorage ─────────────────────────────────────────
function getStars() { return parseInt(localStorage.getItem('stars') || '0'); }
function addStar() {
  const s = getStars() + 1;
  localStorage.setItem('stars', s);
  updateStarUI();
  checkBadgeUnlock(s);
  return s;
}
function getUnlocked() { return JSON.parse(localStorage.getItem('unlocked') || '[]'); }
function unlockBadge(id) {
  const u = getUnlocked();
  if (!u.includes(id)) { u.push(id); localStorage.setItem('unlocked', JSON.stringify(u)); }
}
function checkBadgeUnlock(stars) {
  BADGES.forEach(b => { if (stars >= b.need) unlockBadge(b.id); });
}
function updateStarUI() {
  const s = getStars();
  document.getElementById('star-count').textContent = `⭐ ${s}`;
}

// ── 畫面切換 ─────────────────────────────────────────────
function show(id) {
  ['screen-level','screen-practice','screen-trophy'].forEach(s => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

document.querySelectorAll('.level-btn').forEach(btn => {
  btn.addEventListener('click', () => startLevel(parseInt(btn.dataset.level)));
});

function startLevel(level) {
  curLevel = level;
  const today = new Date();
  const dayIdx = Math.floor(today.getTime() / 86400000);
  const pool = LEVELS[level].chars;
  // 每天從字庫取 3 個（依日期輪替）
  const start = (dayIdx * 3) % pool.length;
  chars = [pool[start % pool.length], pool[(start+1) % pool.length], pool[(start+2) % pool.length]];
  charDone = [false, false, false];
  curChar = 0; curStroke = 0; path = [];

  document.getElementById('date-label').textContent =
    `${today.getFullYear()}/${today.getMonth()+1}/${today.getDate()} ｜ ${LEVELS[level].name}`;

  show('screen-practice');
  updateStarUI();
  buildCharBtns();
  resize();
  charData = [null, null, null];
  Promise.all(chars.map((ch, i) => loadChar(ch).then(d => { charData[i] = d; }))).then(() => {
    selectChar(0);
  });
}

function goBack() { show('screen-level'); }

function showTrophy() {
  renderTrophy();
  show('screen-trophy');
}
function closeTrophy() {
  // 從哪來回哪去
  if (!document.getElementById('screen-practice').classList.contains('hidden-before')) {
    show('screen-practice');
  } else {
    show('screen-level');
  }
}

// 簡化：從獎章頁返回選關
function closeTrophy() { show('screen-level'); }

function renderTrophy() {
  const stars = getStars();
  const unlocked = getUnlocked();
  document.getElementById('trophy-stars').textContent = `⭐ ${stars} 顆星`;
  const grid = document.getElementById('badge-grid');
  grid.innerHTML = '';
  BADGES.forEach(b => {
    const div = document.createElement('div');
    const got = unlocked.includes(b.id);
    div.className = 'badge-item' + (got ? ' got' : '');
    div.innerHTML = `
      <div class="badge-emoji">${got ? b.emoji : '🔒'}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-need">${got ? '已解鎖！' : `需 ${b.need} 顆星`}</div>
    `;
    grid.appendChild(div);
  });
}

// ── Canvas ───────────────────────────────────────────────
const wrap = document.getElementById('canvas-wrap');
const bgC  = document.getElementById('bg-canvas');
const drC  = document.getElementById('draw-canvas');
const bgX  = bgC.getContext('2d');
const drX  = drC.getContext('2d');

function resize() {
  const s = wrap.clientWidth;
  [bgC, drC].forEach(c => { c.width = s; c.height = s; });
  renderChar();
}

// ── 字庫載入 ─────────────────────────────────────────────
async function loadChar(ch) {
  const cp = ch.codePointAt(0).toString(16).toLowerCase();
  try {
    const r = await fetch(BASE + cp + '.json');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch { return null; }
}

// ── UI ───────────────────────────────────────────────────
function buildCharBtns() {
  const row = document.getElementById('chars-row');
  row.innerHTML = '';
  chars.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = 'char-btn' + (i === 0 ? ' active' : '');
    btn.id = 'btn-' + i;
    btn.innerHTML = ch + '<span class="badge-check">✓</span>';
    btn.onclick = () => selectChar(i);
    row.appendChild(btn);
  });
}

function selectChar(i) {
  curChar = i; curStroke = 0; path = [];
  document.querySelectorAll('.char-btn').forEach((b, j) => {
    b.className = 'char-btn' + (j === i ? ' active' : '') + (charDone[j] ? ' done' : '');
  });
  document.getElementById('error-msg').textContent = '';
  renderChar();
  updateInfo();
}

function updateInfo() {
  const data = charData[curChar];
  const el = document.getElementById('stroke-info');
  if (!data) { el.textContent = '資料載入中…'; return; }
  if (charDone[curChar]) { el.textContent = `「${chars[curChar]}」完成！`; return; }
  el.textContent = `「${chars[curChar]}」第 ${curStroke + 1} / ${data.length} 劃`;
}

// ── 渲染 ─────────────────────────────────────────────────
function toCanvas(x, y, size) { return [x / VBOX * size, y / VBOX * size]; }

function buildPath(ctx, stroke, size) {
  ctx.beginPath();
  for (const cmd of stroke.outline) {
    if (cmd.type === 'M') { const [cx,cy]=toCanvas(cmd.x,cmd.y,size); ctx.moveTo(cx,cy); }
    else if (cmd.type === 'L') { const [cx,cy]=toCanvas(cmd.x,cmd.y,size); ctx.lineTo(cx,cy); }
    else if (cmd.type === 'Q') {
      const [bx,by]=toCanvas(cmd.begin.x,cmd.begin.y,size);
      const [ex,ey]=toCanvas(cmd.end.x,cmd.end.y,size);
      ctx.quadraticCurveTo(bx,by,ex,ey);
    }
  }
  ctx.closePath();
}

function drawOutline(ctx, stroke, size, style) {
  buildPath(ctx, stroke, size);
  ctx.fillStyle = style;
  ctx.fill();
}

function renderChar() {
  const size = bgC.width;
  bgX.clearRect(0, 0, size, size);
  drX.clearRect(0, 0, size, size);
  const data = charData[curChar];
  if (!data) return;

  // 格子
  bgX.strokeStyle = '#f0e0d0'; bgX.lineWidth = 1; bgX.setLineDash([4,4]);
  bgX.beginPath();
  bgX.moveTo(size/2,0); bgX.lineTo(size/2,size);
  bgX.moveTo(0,size/2); bgX.lineTo(size,size/2);
  bgX.stroke(); bgX.setLineDash([]);

  data.forEach((s, i) => drawOutline(bgX, s, size, i < curStroke ? '#a5d6a7' : '#e0e0e0'));
  if (!charDone[curChar] && curStroke < data.length)
    drawOutline(bgX, data[curStroke], size, 'rgba(224,123,57,0.35)');
}

// ── 描繪互動 ─────────────────────────────────────────────
function getPos(e) {
  const rect = drC.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return [src.clientX - rect.left, src.clientY - rect.top];
}

drC.addEventListener('pointerdown', e => {
  if (charDone[curChar]) return;
  drawing = true; path = [getPos(e)];
  drC.setPointerCapture(e.pointerId);
});

drC.addEventListener('pointermove', e => {
  if (!drawing) return;
  path.push(getPos(e));
  const size = drC.width;
  const data = charData[curChar];
  if (!data || curStroke >= data.length) return;

  drX.clearRect(0, 0, size, size);
  drX.save();
  buildPath(drX, data[curStroke], size);
  drX.clip();
  drX.beginPath();
  drX.strokeStyle = '#1565c0';
  drX.lineWidth = size * 0.12;
  drX.lineCap = 'round'; drX.lineJoin = 'round';
  drX.moveTo(path[0][0], path[0][1]);
  path.forEach(p => drX.lineTo(p[0], p[1]));
  drX.stroke();
  drX.restore();
});

drC.addEventListener('pointerup', () => {
  if (!drawing) return;
  drawing = false;
  checkStroke();
});

// ── 筆畫驗證 ─────────────────────────────────────────────
function checkStroke() {
  const data = charData[curChar];
  if (!data || curStroke >= data.length) return;
  const size = drC.width;
  const track = data[curStroke].track;
  const tol = size * 0.22;

  let ti = 0;
  for (const pt of path) {
    const [tx, ty] = toCanvas(track[ti].x, track[ti].y, size);
    if (Math.hypot(pt[0]-tx, pt[1]-ty) < tol && ++ti >= track.length) break;
  }

  drX.clearRect(0, 0, drC.width, drC.height);

  if (ti >= track.length) {
    curStroke++;
    confetti();
    if (curStroke >= data.length) {
      // 完成一個字
      charDone[curChar] = true;
      document.getElementById('btn-' + curChar).className = 'char-btn done';
      const stars = addStar();
      const newBadge = BADGES.slice().reverse().find(b => stars === b.need);
      setTimeout(() => {
        if (charDone.every(Boolean)) {
          showCelebrate('🎊', '全部完成！', `今天 3 個字都寫完了！共 ${stars} 顆星 ⭐`);
        } else if (newBadge) {
          showCelebrate(newBadge.emoji, `解鎖獎章！`, `「${newBadge.name}」已解鎖！`);
        } else {
          updateInfo();
        }
      }, 400);
    }
    renderChar(); updateInfo();
  } else {
    const err = document.getElementById('error-msg');
    err.textContent = '再試一次！從左到右、從上到下 ✏️';
    setTimeout(() => { err.textContent = ''; }, 1500);
  }
  path = [];
}

// ── 逐筆提示 ─────────────────────────────────────────────
function showHint() {
  const data = charData[curChar];
  if (!data || curStroke >= data.length) return;
  const size = drC.width;
  const track = data[curStroke].track;
  let i = 0;
  drX.clearRect(0, 0, size, size);

  function step() {
    if (i >= track.length) return;
    const [x, y] = toCanvas(track[i].x, track[i].y, size);
    if (i > 0) {
      const [px, py] = toCanvas(track[i-1].x, track[i-1].y, size);
      drX.beginPath(); drX.moveTo(px,py); drX.lineTo(x,y);
      drX.strokeStyle = 'rgba(255,100,0,0.5)';
      drX.lineWidth = size * 0.015; drX.stroke();
    }
    drX.beginPath(); drX.arc(x, y, size*0.05, 0, Math.PI*2);
    drX.fillStyle = 'rgba(255,100,0,0.7)'; drX.fill();
    i++; setTimeout(step, 350);
  }
  step();
  setTimeout(() => drX.clearRect(0,0,size,size), track.length*350+800);
}

// ── 完整筆順 ─────────────────────────────────────────────
function showFullOrder() {
  const data = charData[curChar];
  if (!data) return;
  const size = bgC.width;

  bgX.clearRect(0,0,size,size);
  bgX.strokeStyle='#f0e0d0'; bgX.lineWidth=1; bgX.setLineDash([4,4]);
  bgX.beginPath(); bgX.moveTo(size/2,0); bgX.lineTo(size/2,size);
  bgX.moveTo(0,size/2); bgX.lineTo(size,size/2); bgX.stroke(); bgX.setLineDash([]);
  data.forEach(s => drawOutline(bgX, s, size, '#e0e0e0'));
  drX.clearRect(0,0,size,size);

  let si = 0;
  function nextStroke() {
    if (si >= data.length) { setTimeout(renderChar, 1500); return; }
    const stroke = data[si], track = stroke.track, STEPS = 12;
    let step = 0;
    function fillStep() {
      bgX.save(); buildPath(bgX, stroke, size); bgX.clip();
      const t = (step+1)/STEPS, endIdx = Math.floor(t*(track.length-1));
      bgX.beginPath(); bgX.strokeStyle='#42a5f5'; bgX.lineWidth=size*0.18;
      bgX.lineCap='round'; bgX.lineJoin='round';
      const [sx,sy]=toCanvas(track[0].x,track[0].y,size); bgX.moveTo(sx,sy);
      for (let k=1;k<=endIdx;k++) { const [tx,ty]=toCanvas(track[k].x,track[k].y,size); bgX.lineTo(tx,ty); }
      if (endIdx < track.length-1) {
        const frac=t*(track.length-1)-endIdx;
        const [ax,ay]=toCanvas(track[endIdx].x,track[endIdx].y,size);
        const [bx2,by2]=toCanvas(track[endIdx+1].x,track[endIdx+1].y,size);
        bgX.lineTo(ax+(bx2-ax)*frac, ay+(by2-ay)*frac);
      }
      bgX.stroke(); bgX.restore();

      drX.clearRect(0,0,size,size);
      const [nx,ny]=toCanvas(track[0].x,track[0].y,size);
      drX.beginPath(); drX.arc(nx,ny,size*0.045,0,Math.PI*2);
      drX.fillStyle='#e07b39'; drX.fill();
      drX.fillStyle='#fff'; drX.font=`bold ${size*0.04}px sans-serif`;
      drX.textAlign='center'; drX.textBaseline='middle';
      drX.fillText(si+1, nx, ny);

      step++;
      if (step<STEPS) setTimeout(fillStep,60);
      else { drX.clearRect(0,0,size,size); si++; setTimeout(nextStroke,300); }
    }
    fillStep();
  }
  nextStroke();
}

// ── 紙花 ─────────────────────────────────────────────────
const COLORS = ['#f44336','#e91e63','#9c27b0','#2196f3','#4caf50','#ff9800','#ffeb3b'];
function confetti() {
  for (let i=0;i<18;i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.cssText = `left:${20+Math.random()*60}vw;top:${10+Math.random()*30}vh;background:${COLORS[i%COLORS.length]};animation-delay:${Math.random()*0.3}s;animation-duration:${0.8+Math.random()*0.6}s;transform:rotate(${Math.random()*360}deg)`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ── 慶祝 ─────────────────────────────────────────────────
function showCelebrate(emoji, text, sub) {
  for (let i=0;i<60;i++) setTimeout(confetti, i*80);
  document.getElementById('celebrate-emoji').textContent = emoji;
  document.getElementById('celebrate-text').textContent = text;
  document.getElementById('celebrate-sub').textContent = sub;
  document.getElementById('celebrate').classList.remove('hidden');
}

function closeCelebrate() {
  document.getElementById('celebrate').classList.add('hidden');
  charDone = [false,false,false]; curChar=0; curStroke=0;
  buildCharBtns(); selectChar(0);
}

window.addEventListener('resize', () => {
  if (!document.getElementById('screen-practice').classList.contains('hidden')) resize();
});

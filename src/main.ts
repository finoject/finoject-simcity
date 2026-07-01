import './style.css';
import { GRID_SIZE, TILE_PX, BUILD_COST, createInitialState, inBounds } from './state';
import type { GameState } from './state';
import type { Tool } from './types';
import { tick, refreshMetrics } from './sim';
import { render } from './render';

const state: GameState = createInitialState();

// ---- Canvas ------------------------------------------------------------
const canvas = document.getElementById('map') as HTMLCanvasElement;
canvas.width = GRID_SIZE * TILE_PX;
canvas.height = GRID_SIZE * TILE_PX;
const ctx = canvas.getContext('2d')!;

// ---- 再描画（イベント駆動: 状態が変わったときだけ描く） ----------------
// 毎フレーム描く rAF ループは使わない（無駄な再描画を避け、非表示タブでも整合）
function redraw(): void {
  render(ctx, state);
  updateStatusBar();
}

// ---- ステータスバー ----------------------------------------------------
const el = {
  pop: document.getElementById('stat-pop')!,
  jobs: document.getElementById('stat-jobs')!,
  unemp: document.getElementById('stat-unemp')!,
  money: document.getElementById('stat-money')!,
  balance: document.getElementById('stat-balance')!,
  tax: document.getElementById('stat-tax')!,
  month: document.getElementById('stat-month')!,
  rciR: document.getElementById('rci-r')!,
  rciC: document.getElementById('rci-c')!,
  rciI: document.getElementById('rci-i')!,
};

/** 需要バー（中央から左右に伸びる: 正=緑右, 負=赤左） */
function setRciBar(bar: HTMLElement, d: number): void {
  const pct = Math.min(Math.abs(d), 1) * 50;
  if (d >= 0) {
    bar.style.left = '50%';
    bar.style.width = pct + '%';
    bar.style.background = 'var(--pos)';
  } else {
    bar.style.left = 50 - pct + '%';
    bar.style.width = pct + '%';
    bar.style.background = 'var(--neg)';
  }
}

function updateStatusBar(): void {
  el.pop.textContent = state.stats.population.toLocaleString();
  el.jobs.textContent = state.stats.jobs.toLocaleString();

  // 失業率（高いと赤）
  const unempPct = Math.round(state.unemployment * 100);
  el.unemp.textContent = unempPct + '%';
  el.unemp.classList.toggle('neg', unempPct >= 20);
  el.unemp.classList.toggle('warn', unempPct >= 10 && unempPct < 20);

  el.money.textContent = '$' + state.stats.money.toLocaleString();
  // 赤字（マイナス）は赤、残りわずか（1回も建設できない）は警告色
  el.money.classList.toggle('neg', state.stats.money < 0);
  el.money.classList.toggle('warn', state.stats.money >= 0 && state.stats.money < 50);

  // 月次収支（税収 − 維持費）
  const net = state.lastIncome - state.lastExpense;
  const sign = net > 0 ? '+' : '';
  el.balance.textContent = `${sign}$${net.toLocaleString()}/月`;
  el.balance.classList.toggle('neg', net < 0);
  el.balance.classList.toggle('pos', net > 0);
  el.balance.title = `税収 +$${state.lastIncome.toLocaleString()} ／ 道路維持費 −$${state.lastExpense.toLocaleString()}`;

  el.tax.textContent = Math.round(state.stats.taxRate * 100) + '%';
  const year = Math.floor(state.stats.month / 12) + 1;
  const month = (state.stats.month % 12) + 1;
  el.month.textContent = `${year}年目 ${month}月`;

  // RCI 需要バー
  setRciBar(el.rciR, state.demand.r);
  setRciBar(el.rciC, state.demand.c);
  setRciBar(el.rciI, state.demand.i);
}

// ---- 資金不足トースト --------------------------------------------------
const toast = document.getElementById('toast')!;
let toastTimer: number | null = null;
function showToast(msg: string): void {
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1400);
}

// ---- タイル配置 --------------------------------------------------------
function applyTool(x: number, y: number): void {
  if (!inBounds(x, y)) return;
  const tile = state.grid[y][x];
  if (state.selectedTool === 'bulldoze') {
    tile.type = 'empty';
    tile.density = 0;
    tile.hasRoad = false;
    return;
  }
  // 既に同じ種別なら何もしない
  if (tile.type === state.selectedTool) return;

  // 建設コストを確認（資金が足りなければ建設不可）
  const cost = BUILD_COST[state.selectedTool];
  if (state.stats.money < cost) {
    showToast('資金が足りません');
    return;
  }
  state.stats.money -= cost;

  tile.type = state.selectedTool;
  tile.density = 0;
  tile.hasRoad = false;
}

function eventToCell(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  // canvas の内部解像度と表示サイズが異なる場合を考慮
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  return { x: Math.floor(px / TILE_PX), y: Math.floor(py / TILE_PX) };
}

// 2セル間を Bresenham で補間し、速いドラッグでも隙間なく塗る
function paintLine(x0: number, y0: number, x1: number, y1: number): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    applyTool(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

// クリック・ドラッグで配置
let painting = false;
let last: { x: number; y: number } | null = null;

function endStroke(pointerId?: number): void {
  if (!painting) return;
  painting = false;
  last = null;
  // 編集後に指標（道路・地価・需要・統計）を再計算し、一時停止中でも即座に整合させる
  refreshMetrics(state);
  redraw();
  if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return; // 左ボタンのみ
  painting = true;
  canvas.setPointerCapture(e.pointerId);
  const { x, y } = eventToCell(e);
  applyTool(x, y);
  last = { x, y };
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!painting) return;
  const { x, y } = eventToCell(e);
  if (last && (last.x !== x || last.y !== y)) {
    paintLine(last.x, last.y, x, y);
    last = { x, y };
    redraw();
  }
});
canvas.addEventListener('pointerup', (e) => endStroke(e.pointerId));
canvas.addEventListener('pointercancel', (e) => endStroke(e.pointerId));

// ---- ツールパレット ----------------------------------------------------
const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tool'));
function selectTool(tool: Tool): void {
  state.selectedTool = tool;
  toolButtons.forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
}
toolButtons.forEach((b) => {
  b.addEventListener('click', () => selectTool(b.dataset.tool as Tool));
});
selectTool('road');

// ---- 再生 / 一時停止 / 速度 --------------------------------------------
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
const speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.speed-btn'));

let tickTimer: number | null = null;
const BASE_TICK_MS = 1000; // ×1 のとき 1か月/秒

function scheduleTicks(): void {
  if (tickTimer !== null) clearInterval(tickTimer);
  tickTimer = window.setInterval(() => {
    tick(state);
    redraw();
  }, BASE_TICK_MS / state.speed);
}

function setRunning(run: boolean): void {
  state.running = run;
  btnPlay.disabled = run;
  btnPause.disabled = !run;
  if (run) scheduleTicks();
  else if (tickTimer !== null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

btnPlay.addEventListener('click', () => setRunning(true));
btnPause.addEventListener('click', () => setRunning(false));

function selectSpeed(speed: number): void {
  state.speed = speed;
  speedButtons.forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === speed));
  if (state.running) scheduleTicks(); // 実行中なら間隔を更新
}
speedButtons.forEach((b) => {
  b.addEventListener('click', () => selectSpeed(Number(b.dataset.speed)));
});
selectSpeed(1);

// ---- キーボードショートカット ------------------------------------------
const KEY_TOOLS: Record<string, Tool> = {
  '1': 'road',
  '2': 'residential',
  '3': 'commercial',
  '4': 'industrial',
  '5': 'bulldoze',
};
window.addEventListener('keydown', (e) => {
  if (KEY_TOOLS[e.key]) {
    selectTool(KEY_TOOLS[e.key]);
  } else if (e.code === 'Space') {
    e.preventDefault(); // ページスクロール抑止
    setRunning(!state.running);
  }
});

// ---- 遊び方オーバーレイ ------------------------------------------------
const intro = document.getElementById('intro')!;
document.getElementById('btn-start')!.addEventListener('click', () => {
  intro.classList.remove('intro-open');
});
document.getElementById('btn-help')!.addEventListener('click', () => {
  intro.classList.add('intro-open');
});

// ---- 起動 --------------------------------------------------------------
// デバッグ用に状態を公開（コンソールから window.__game で確認可能）
(window as unknown as { __game: GameState }).__game = state;
refreshMetrics(state); // 初期需要（空の街でも工業需要が出る）を反映
redraw();

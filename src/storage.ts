import type { GameState } from './state';
import { GRID_SIZE, MAX_DENSITY, HISTORY_MAX, createGrid } from './state';
import type { TileType } from './types';

const KEY = 'finoject-simcity-save-v1';

const VALID_TYPES = new Set<TileType>([
  'empty',
  'road',
  'residential',
  'commercial',
  'industrial',
]);

interface SaveTile {
  t: TileType;
  d: number;
}
interface SaveData {
  v: 1;
  money: number;
  taxRate: number;
  month: number;
  grid: SaveTile[][];
  history: number[];
}

/** 保存データがあるか */
export function hasSave(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

/** 現在の状態を localStorage に保存（地価・汚染・道路アクセスは読込時に再計算するため保存しない） */
export function saveGame(state: GameState): boolean {
  try {
    const grid: SaveTile[][] = state.grid.map((row) =>
      row.map((t) => ({ t: t.type, d: t.density })),
    );
    const data: SaveData = {
      v: 1,
      money: state.stats.money,
      taxRate: state.stats.taxRate,
      month: state.stats.month,
      grid,
      history: state.history,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** 保存データを state に復元。成功したら true。grid/stats/history を書き換える。 */
export function loadGame(state: GameState): boolean {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  let data: SaveData;
  try {
    data = JSON.parse(raw) as SaveData;
  } catch {
    return false;
  }
  if (!data || data.v !== 1 || !Array.isArray(data.grid)) return false;
  if (data.grid.length !== GRID_SIZE) return false;

  const grid = createGrid();
  for (let y = 0; y < GRID_SIZE; y++) {
    const row = data.grid[y];
    if (!Array.isArray(row) || row.length !== GRID_SIZE) return false;
    for (let x = 0; x < GRID_SIZE; x++) {
      const s = row[x];
      if (!s || !VALID_TYPES.has(s.t)) continue; // 不正な種別は空地のまま
      grid[y][x].type = s.t;
      const d = typeof s.d === 'number' ? Math.round(s.d) : 0;
      grid[y][x].density = Math.max(0, Math.min(MAX_DENSITY, d));
    }
  }

  state.grid = grid;
  state.stats.money = typeof data.money === 'number' ? data.money : 0;
  state.stats.taxRate = typeof data.taxRate === 'number' ? data.taxRate : 0.09;
  state.stats.month = typeof data.month === 'number' ? data.month : 0;
  // 履歴は有限の数値のみ・最大長に制限
  state.history = Array.isArray(data.history)
    ? data.history.filter((n) => typeof n === 'number' && isFinite(n)).slice(-HISTORY_MAX)
    : [];
  return true;
}

/** 保存データを削除 */
export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

import type { Tile, CityStats, Tool, Demand } from './types';

/** グリッド一辺のタイル数（後で拡張可能に定数化） */
export const GRID_SIZE = 32;
/** 1タイルの描画ピクセル */
export const TILE_PX = 20;

/** ゾーン最大発展度 */
export const MAX_DENSITY = 5;
/** density 1 あたりの人口（住宅） */
export const PEOPLE_PER_DENSITY = 20;
/** density 1 あたりの雇用（商業・工業） */
export const JOBS_PER_DENSITY = 12;

// ---- 経済（Phase 2） ---------------------------------------------------
/** 開始資金 */
export const STARTING_MONEY = 10_000;
/** ツールごとの建設コスト（1マスあたり） */
export const BUILD_COST: Record<Tool, number> = {
  road: 10,
  residential: 50,
  commercial: 50,
  industrial: 50,
  bulldoze: 0,
};
/** 道路1マスの月次維持費 */
export const ROAD_UPKEEP = 1;

// ---- シミュレーション（Phase 3: RCI需要・地価・雇用） ------------------
/** 労働力率（人口のうち働く割合） */
export const LABOR_RATE = 0.5;
/** 工業のベース外需（外部市場への輸出。都市の経済エンジン） */
export const BASE_EXPORT = 300;
/** 人口1人あたりが求める商業雇用（消費者需要） */
export const COM_PER_POP = 0.30;
/** 人口1人あたりが求める工業雇用（地場需要） */
export const IND_PER_POP = 0.10;
/** 需要を -1..1 に正規化するスケール */
export const DEMAND_SCALE = 200;
/** 需要が正のときの1tick発展確率の係数（小さいほど滑らかに収束） */
export const GROWTH_CHANCE = 0.25;
/** 需要が負のときの1tick衰退確率の係数 */
export const DECAY_CHANCE = 0.22;
/** 需要の不感帯（この幅以内は発展も衰退もしない → 振動を抑える） */
export const DEAD_ZONE = 0.1;
/** 道路アクセスがないゾーンの1tick衰退確率 */
export const OFFROAD_DECAY_CHANCE = 0.25;
/** 地価低下で密度上限を超えたときの1tick衰退確率 */
export const OVERCAP_DECAY_CHANCE = 0.3;

// 地価（landValue）の近傍スキャン用パラメータ
export const LV_RADIUS = 3;
export const LV_BASE = 0.2;
/** 道路近接ボーナス */
export const LV_ROAD = 0.25;
/** 商業近接ボーナス */
export const LV_COM = 0.35;
/** 住宅近接ボーナス（住宅地にもある程度の地価をもたせる） */
export const LV_RES = 0.10;
/** 工業近接ペナルティ */
export const LV_IND = 0.25;
/** 工業からの汚染係数 */
export const LV_POLL = 0.4;

export interface GameState {
  grid: Tile[][];
  stats: CityStats;
  selectedTool: Tool;
  running: boolean;
  /** tick 速度倍率（1〜3） */
  speed: number;
  /** 直近1か月の税収（表示用） */
  lastIncome: number;
  /** 直近1か月の支出（表示用） */
  lastExpense: number;
  /** RCI 需要（表示・発展判定用） */
  demand: Demand;
  /** 失業率 0..1 */
  unemployment: number;
}

function emptyTile(): Tile {
  return { type: 'empty', density: 0, landValue: 0, pollution: 0, hasRoad: false };
}

export function createGrid(): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_SIZE; x++) row.push(emptyTile());
    grid.push(row);
  }
  return grid;
}

export function createInitialState(): GameState {
  return {
    grid: createGrid(),
    stats: { population: 0, jobs: 0, money: STARTING_MONEY, taxRate: 0.09, month: 0 },
    selectedTool: 'road',
    running: false,
    speed: 1,
    lastIncome: 0,
    lastExpense: 0,
    demand: { r: 0, c: 0, i: 0 },
    unemployment: 0,
  };
}

/** 範囲内か */
export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}

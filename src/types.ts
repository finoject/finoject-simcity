// ---- データモデル -------------------------------------------------------

/** タイル種別 */
export type TileType =
  | 'empty'
  | 'road'
  | 'residential'
  | 'commercial'
  | 'industrial';

/** 1タイルの状態 */
export interface Tile {
  type: TileType;
  /** 発展度 0..5 */
  density: number;
  /** 地価（Phase 3 で使用） */
  landValue: number;
  /** 汚染（Phase 3 で使用） */
  pollution: number;
  /** 道路アクセスがあるか（毎tick再計算） */
  hasRoad: boolean;
}

/** RCI 需要（各 -1..+1） */
export interface Demand {
  /** 住宅 residential */
  r: number;
  /** 商業 commercial */
  c: number;
  /** 工業 industrial */
  i: number;
}

/** 都市ステータス */
export interface CityStats {
  population: number;
  jobs: number;
  money: number;
  /** 税率（0..1） */
  taxRate: number;
  /** 経過月（tick カウンタ） */
  month: number;
}

/** パレットで選べる操作 */
export type Tool = Exclude<TileType, 'empty'> | 'bulldoze';

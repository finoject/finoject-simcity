import type { GameState } from './state';
import {
  GRID_SIZE,
  MAX_DENSITY,
  PEOPLE_PER_DENSITY,
  JOBS_PER_DENSITY,
  ROAD_UPKEEP,
  LABOR_RATE,
  BASE_EXPORT,
  COM_PER_POP,
  IND_PER_POP,
  DEMAND_SCALE,
  GROWTH_CHANCE,
  DECAY_CHANCE,
  DEAD_ZONE,
  OFFROAD_DECAY_CHANCE,
  OVERCAP_DECAY_CHANCE,
  LV_RADIUS,
  LV_BASE,
  LV_ROAD,
  LV_COM,
  LV_RES,
  LV_IND,
  LV_POLL,
  inBounds,
} from './state';
import type { Demand, TileType } from './types';

/** 4近傍のオフセット */
const NEIGHBORS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

function isZone(type: TileType): boolean {
  return type === 'residential' || type === 'commercial' || type === 'industrial';
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 隣接（4近傍）に道路があれば道路アクセスありとみなす */
export function computeRoadAccess(state: GameState): void {
  const { grid } = state;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const tile = grid[y][x];
      if (tile.type === 'road' || tile.type === 'empty') {
        tile.hasRoad = false;
        continue;
      }
      let access = false;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(nx, ny) && grid[ny][nx].type === 'road') {
          access = true;
          break;
        }
      }
      tile.hasRoad = access;
    }
  }
}

/**
 * 地価と汚染を近傍スキャンで計算（Phase 3）。
 * 地価 = ベース + 道路近接 + 商業近接 + 住宅近接 − 工業近接 − 汚染。
 */
export function computeLandValue(state: GameState): void {
  const { grid } = state;
  const R = LV_RADIUS;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      let value = LV_BASE;
      let pollution = 0;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!inBounds(nx, ny)) continue;
          const n = grid[ny][nx];
          if (n.type === 'empty') continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy)); // 1..R
          const w = (R + 1 - dist) / (R + 1); // 近いほど 1 に近い
          if (n.type === 'road') {
            value += LV_ROAD * w;
          } else if (n.type === 'commercial') {
            value += LV_COM * (n.density / MAX_DENSITY) * w;
          } else if (n.type === 'residential') {
            value += LV_RES * (n.density / MAX_DENSITY) * w;
          } else if (n.type === 'industrial') {
            const f = (n.density / MAX_DENSITY) * w;
            value -= LV_IND * f;
            pollution += LV_POLL * f;
          }
        }
      }
      pollution = clamp(pollution, 0, 1);
      const tile = grid[y][x];
      tile.pollution = pollution;
      tile.landValue = clamp(value - pollution, 0, 1);
    }
  }
}

/** 住宅は地価が高いほど高密度まで発展できる（地価0→1, 地価1→MAX） */
function residentialCap(landValue: number): number {
  return Math.max(1, Math.round(1 + landValue * (MAX_DENSITY - 1)));
}

interface Aggregate {
  pop: number;
  jobsC: number;
  jobsI: number;
  roadCount: number;
}

/** 現在の密度からの集計 */
function aggregate(state: GameState): Aggregate {
  const { grid } = state;
  let pop = 0;
  let jobsC = 0;
  let jobsI = 0;
  let roadCount = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const t = grid[y][x];
      switch (t.type) {
        case 'road':
          roadCount++;
          break;
        case 'residential':
          pop += t.density * PEOPLE_PER_DENSITY;
          break;
        case 'commercial':
          jobsC += t.density * JOBS_PER_DENSITY;
          break;
        case 'industrial':
          jobsI += t.density * JOBS_PER_DENSITY;
          break;
      }
    }
  }
  return { pop, jobsC, jobsI, roadCount };
}

/**
 * RCI 需要を集計値から算出。
 * - 住宅: 雇用と労働力の差（totalJobs − workforce）。正=労働力不足で住民を呼ぶ／負=失業で流出。
 *         これにより「高失業 → 住宅需要マイナス → 人口流出」が需要側に直接組み込まれる。
 * - 商業: 人口（消費者）に比例した目標と現状の差。
 * - 工業: ベース外需 + 人口比例の目標と現状の差。
 */
function demandFrom(a: Aggregate): Demand {
  const workforce = a.pop * LABOR_RATE;
  const totalJobs = a.jobsC + a.jobsI;

  const rawR = totalJobs - workforce;
  const rawC = a.pop * COM_PER_POP - a.jobsC;
  const rawI = BASE_EXPORT + a.pop * IND_PER_POP - a.jobsI;

  return {
    r: clamp(rawR / DEMAND_SCALE, -1, 1),
    c: clamp(rawC / DEMAND_SCALE, -1, 1),
    i: clamp(rawI / DEMAND_SCALE, -1, 1),
  };
}

function unemploymentFrom(pop: number, jobsC: number, jobsI: number): number {
  const workforce = pop * LABOR_RATE;
  const totalJobs = jobsC + jobsI;
  const filled = Math.min(workforce, totalJobs);
  return workforce > 0 ? (workforce - filled) / workforce : 0;
}

/**
 * 発展/衰退や資金を変えずに、表示用の指標（道路・地価・需要・人口・雇用・失業）だけ更新。
 * 一時停止中に編集したとき、RCIバーや統計を即座に整合させるために使う。
 */
export function refreshMetrics(state: GameState): void {
  computeRoadAccess(state);
  computeLandValue(state);
  const a = aggregate(state);
  state.demand = demandFrom(a);
  state.stats.population = a.pop;
  state.stats.jobs = a.jobsC + a.jobsI;
  state.unemployment = unemploymentFrom(a.pop, a.jobsC, a.jobsI);
}

/**
 * 1 tick（1か月）進める。Phase 3: RCI需要・地価・雇用に基づく発展/衰退＋経済。
 */
export function tick(state: GameState): void {
  computeRoadAccess(state);
  computeLandValue(state);

  const { grid } = state;

  // --- (A) 現状集計 → (B) RCI 需要 ---
  const a = aggregate(state);
  const demand = demandFrom(a);
  const dR = demand.r;
  const dC = demand.c;
  const dI = demand.i;

  // --- (C) 発展/衰退（需要に比例した確率、道路と地価で制約） ---
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const t = grid[y][x];
      if (!isZone(t.type)) continue;

      // 道路アクセスがなければ衰退のみ
      if (!t.hasRoad) {
        if (t.density > 0 && Math.random() < OFFROAD_DECAY_CHANCE) t.density -= 1;
        continue;
      }

      const d = t.type === 'residential' ? dR : t.type === 'commercial' ? dC : dI;
      const cap = t.type === 'residential' ? residentialCap(t.landValue) : MAX_DENSITY;

      if (t.density > cap) {
        // 地価低下などで上限を超過 → 徐々に衰退
        if (Math.random() < OVERCAP_DECAY_CHANCE) t.density -= 1;
      } else if (d > DEAD_ZONE && t.density < cap) {
        if (Math.random() < d * GROWTH_CHANCE) t.density += 1;
      } else if (d < -DEAD_ZONE && t.density > 0) {
        if (Math.random() < -d * DECAY_CHANCE) t.density -= 1;
      }
    }
  }

  // --- (D) 発展後の再集計＋税収（地価係数を反映） ---
  let pop2 = 0;
  let jobsC2 = 0;
  let jobsI2 = 0;
  let income = 0;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const t = grid[y][x];
      if (t.type === 'residential') {
        const tp = t.density * PEOPLE_PER_DENSITY;
        pop2 += tp;
        // 税収 = 人口 × 税率 × 地価係数（0.5〜1.5: 地価が高いほど高所得）
        income += tp * state.stats.taxRate * (0.5 + t.landValue);
      } else if (t.type === 'commercial') {
        jobsC2 += t.density * JOBS_PER_DENSITY;
      } else if (t.type === 'industrial') {
        jobsI2 += t.density * JOBS_PER_DENSITY;
      }
    }
  }

  // --- (E) 反映 ---
  // 需要は「発展後の状態」から再計算して表示する（統計と整合。発展判定には
  // 月初の demand を使用済み）。プレイヤーが次に手を打つべき needs を示す。
  state.stats.population = pop2;
  state.stats.jobs = jobsC2 + jobsI2;
  state.demand = demandFrom({ pop: pop2, jobsC: jobsC2, jobsI: jobsI2, roadCount: a.roadCount });
  state.unemployment = unemploymentFrom(pop2, jobsC2, jobsI2);

  const incomeR = Math.round(income);
  const expense = a.roadCount * ROAD_UPKEEP;
  state.stats.money += incomeR - expense;
  state.lastIncome = incomeR;
  state.lastExpense = expense;

  state.stats.month += 1;
}

import type { GameState } from './state';
import { GRID_SIZE, TILE_PX, MAX_DENSITY } from './state';
import type { TileType } from './types';

/** 種別ごとのベース色 [r,g,b] */
const BASE_COLOR: Record<TileType, [number, number, number]> = {
  empty: [26, 34, 28], // 未開発の草地
  road: [70, 74, 82],
  residential: [72, 160, 92], // 緑
  commercial: [70, 122, 200], // 青
  industrial: [200, 168, 74], // 黄土
};

function mix(c: [number, number, number], factor: number): string {
  const r = Math.round(c[0] * factor);
  const g = Math.round(c[1] * factor);
  const b = Math.round(c[2] * factor);
  return `rgb(${r},${g},${b})`;
}

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function rgb(c: [number, number, number]): string {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

// 地価ヒートマップ: 低=紺 → 中=緑 → 高=黄緑
function heatLand(v: number): string {
  const lo: [number, number, number] = [38, 48, 92];
  const mid: [number, number, number] = [52, 150, 110];
  const hi: [number, number, number] = [206, 204, 74];
  return rgb(v < 0.5 ? lerp3(lo, mid, v / 0.5) : lerp3(mid, hi, (v - 0.5) / 0.5));
}

// 汚染ヒートマップ: 低=澄んだ暗緑 → 高=赤
function heatPoll(v: number): string {
  const lo: [number, number, number] = [24, 56, 34];
  const hi: [number, number, number] = [200, 66, 48];
  return rgb(lerp3(lo, hi, v));
}

function renderNormal(ctx: CanvasRenderingContext2D, state: GameState): void {
  const px = TILE_PX;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const tile = state.grid[y][x];
      const base = BASE_COLOR[tile.type];

      if (tile.type === 'empty' || tile.type === 'road') {
        ctx.fillStyle = mix(base, 1);
        ctx.fillRect(x * px, y * px, px, px);
        continue;
      }

      // ゾーン: 未開発は暗く、発展するほど明るく＋建物ブロックを描く
      const t = tile.density / MAX_DENSITY; // 0..1
      ctx.fillStyle = mix(base, 0.35);
      ctx.fillRect(x * px, y * px, px, px);

      if (tile.density > 0) {
        const pad = Math.max(1, Math.round((px * (1 - t)) / 3));
        ctx.fillStyle = mix(base, 0.55 + 0.45 * t);
        ctx.fillRect(x * px + pad, y * px + pad, px - pad * 2, px - pad * 2);
      }
    }
  }
}

function renderHeatmap(ctx: CanvasRenderingContext2D, state: GameState): void {
  const px = TILE_PX;
  const land = state.view === 'landvalue';
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const tile = state.grid[y][x];
      // 道路は向き確認のためグレー表示のまま
      if (tile.type === 'road') {
        ctx.fillStyle = mix(BASE_COLOR.road, 1);
      } else {
        ctx.fillStyle = land ? heatLand(tile.landValue) : heatPoll(tile.pollution);
      }
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
}

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.view === 'normal') renderNormal(ctx, state);
  else renderHeatmap(ctx, state);

  // グリッド線
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= GRID_SIZE; i++) {
    const p = i * TILE_PX + 0.5;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, GRID_SIZE * TILE_PX);
    ctx.moveTo(0, p);
    ctx.lineTo(GRID_SIZE * TILE_PX, p);
  }
  ctx.stroke();
}

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

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const px = TILE_PX;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const tile = state.grid[y][x];
      const base = BASE_COLOR[tile.type];

      if (tile.type === 'empty') {
        ctx.fillStyle = mix(base, 1);
        ctx.fillRect(x * px, y * px, px, px);
        continue;
      }

      if (tile.type === 'road') {
        ctx.fillStyle = mix(base, 1);
        ctx.fillRect(x * px, y * px, px, px);
        continue;
      }

      // ゾーン: 未開発は暗く、発展するほど明るく＋建物ブロックを描く
      const t = tile.density / MAX_DENSITY; // 0..1
      // 下地（区画）
      ctx.fillStyle = mix(base, 0.35);
      ctx.fillRect(x * px, y * px, px, px);

      if (tile.density > 0) {
        // 建物ブロック（density が高いほど大きく明るい）
        const pad = Math.max(1, Math.round((px * (1 - t)) / 3));
        ctx.fillStyle = mix(base, 0.55 + 0.45 * t);
        ctx.fillRect(x * px + pad, y * px + pad, px - pad * 2, px - pad * 2);
      }
    }
  }

  // グリッド線
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= GRID_SIZE; i++) {
    const p = i * px + 0.5;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, GRID_SIZE * px);
    ctx.moveTo(0, p);
    ctx.lineTo(GRID_SIZE * px, p);
  }
  ctx.stroke();
}

import type { GameState } from './state';

/** 人口推移のスパークライン風グラフを描画 */
export function drawGraph(ctx: CanvasRenderingContext2D, state: GameState): void {
  const canvas = ctx.canvas;
  // 高DPIでもくっきり描くため、CSS表示サイズ×dpr でバックストアを合わせる
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 178;
  const h = canvas.clientHeight || 64;
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = '#1b2129';
  ctx.fillRect(0, 0, w, h);

  const hist = state.history;
  if (hist.length < 2) {
    ctx.fillStyle = '#6b7683';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('再生すると人口推移が表示されます', 8, h / 2 + 4);
    return;
  }

  const max = Math.max(...hist, 1);
  const pad = 4;
  const gw = w - pad * 2;
  const gh = h - pad * 2;
  const n = hist.length;

  // 塗り + 線
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  for (let i = 0; i < n; i++) {
    const x = pad + (n === 1 ? 0 : (i / (n - 1)) * gw);
    const y = pad + gh - (hist[i] / max) * gh;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(pad + gw, h - pad);
  ctx.closePath();
  ctx.fillStyle = 'rgba(74,116,201,0.25)';
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = pad + (n === 1 ? 0 : (i / (n - 1)) * gw);
    const y = pad + gh - (hist[i] / max) * gh;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#6f9be6';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 現在人口ラベル
  ctx.fillStyle = '#aab6c4';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('最大 ' + max.toLocaleString(), pad + 2, pad + 10);
}

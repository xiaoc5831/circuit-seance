/**
 * CRT oscilloscope renderer (Canvas 2D).
 *
 * Layers:
 *  - `gridCanvas`   static: phosphor-tinted graticule, redrawn only on resize
 *  - `phosphor`     persistence buffer: faded a little every frame, traces drawn with a
 *                   two-pass glow (wide faint halo + sharp hot core) → afterglow trails
 *  - visible canvas: grid + phosphor composited with 'lighter'
 *
 * A new result is revealed by a beam sweep (left→right with a hot leading dot).
 * With no result the beam free-runs as a noisy baseline ("no signal").
 * Under prefers-reduced-motion everything is drawn in one static frame.
 */
import { CHANNEL_COLORS, DIVS_X, DIVS_Y, type ChannelScale, type PlotModel } from './scope-math';

export interface RenderInput {
  plot: PlotModel | null;
  /** optional reference trace (same channels), drawn dashed without persistence */
  ghost?: PlotModel | null;
  enabled: boolean[];
  scales: ChannelScale[];
  /** x units per division (linear) — ignored for log-x AC plots */
  xPerDiv: number;
  /** x value at the left edge of the screen */
  xStart: number;
}

const BG = '#020a03';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export class ScopeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private grid = document.createElement('canvas');
  private phosphor = document.createElement('canvas');
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private input: RenderInput | null = null;
  private sweepStart = 0;
  private sweepMs = 1100;
  private lastFrame = 0;
  private settleUntil = 0;
  private reduced = prefersReducedMotion();
  private glowScale = 1;
  onFirstTrace?: () => void;
  private tracedOnce = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(200, Math.round(rect.width));
    this.h = Math.max(160, Math.round(rect.height));
    for (const c of [this.canvas, this.grid, this.phosphor]) {
      c.width = Math.round(this.w * this.dpr);
      c.height = Math.round(this.h * this.dpr);
    }
    this.drawGrid();
    // redraw current content without re-sweeping
    this.sweepStart = performance.now() - this.sweepMs;
    this.kick(400);
  }

  setInput(input: RenderInput, animate: boolean): void {
    const hadPlot = !!this.input?.plot;
    this.input = input;
    if (input.plot && animate && !this.reduced) {
      this.sweepStart = performance.now();
      this.kick(this.sweepMs + 900);
    } else {
      this.sweepStart = performance.now() - this.sweepMs;
      if (!hadPlot || !input.plot) this.clearPhosphor();
      this.kick(500);
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  // ---------------------------------------------------------------- frame loop
  private kick(ms: number): void {
    this.settleUntil = Math.max(this.settleUntil, performance.now() + ms);
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const dt = now - (this.lastFrame || now);
    this.lastFrame = now;
    // adaptive quality: drop the halo pass on slow frames
    if (dt > 24) this.glowScale = Math.max(0.35, this.glowScale - 0.1);
    else if (dt < 15) this.glowScale = Math.min(1, this.glowScale + 0.02);

    this.render(now);
    const idle = !this.input?.plot;
    if ((idle && !this.reduced) || now < this.settleUntil) {
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  private clearPhosphor(): void {
    const p = this.phosphor.getContext('2d');
    if (!p) return;
    p.setTransform(1, 0, 0, 1, 0, 0);
    p.clearRect(0, 0, this.phosphor.width, this.phosphor.height);
  }

  private render(now: number): void {
    const p = this.phosphor.getContext('2d');
    if (!p) return;
    const { w, h, dpr } = this;
    p.setTransform(dpr, 0, 0, dpr, 0, 0);
    // persistence: fade the previous frame (afterglow)
    p.globalCompositeOperation = 'destination-out';
    p.fillStyle = this.reduced ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.22)';
    p.fillRect(0, 0, w, h);
    p.globalCompositeOperation = 'lighter';

    if (this.input?.plot && this.input.plot.traces.length) {
      const prog = Math.min(1, (now - this.sweepStart) / this.sweepMs);
      const eased = 1 - Math.pow(1 - prog, 2.2);
      this.drawTraces(p, this.input, eased, prog < 1);
      if (!this.tracedOnce) {
        this.tracedOnce = true;
        this.onFirstTrace?.();
      }
    } else {
      this.drawIdle(p, now);
    }

    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.drawImage(this.grid, 0, 0);
    c.globalCompositeOperation = 'lighter';
    c.drawImage(this.phosphor, 0, 0);
    c.globalCompositeOperation = 'source-over';
    if (this.input?.plot && this.input.ghost) this.drawGhost(c, this.input);
  }

  /** dashed, dim copy of the reference plot straight onto the visible canvas */
  private drawGhost(c: CanvasRenderingContext2D, input: RenderInput): void {
    const g = input.ghost!;
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.setLineDash([5, 5]);
    c.lineWidth = 1.5;
    c.globalAlpha = 0.72;
    g.traces.forEach((t, ci) => {
      if (!input.enabled[ci]) return;
      const s = input.scales[ci] ?? { perDiv: 1, center: 0 };
      c.strokeStyle = CHANNEL_COLORS[ci % CHANNEL_COLORS.length];
      c.beginPath();
      let lastCol = -Infinity;
      let started = false;
      for (let i = 0; i < t.xs.length; i++) {
        const px = this.xToPx(t.xs[i], { ...input, plot: g });
        if (px < -2) continue;
        if (px > this.w + 2) break;
        if (px - lastCol < 1 && i < t.xs.length - 1) continue; // ~1 point per pixel
        lastCol = px;
        const py = this.yToPx(t.ys[i], s);
        if (!started) {
          c.moveTo(px, py);
          started = true;
        } else c.lineTo(px, py);
      }
      c.stroke();
    });
    c.restore();
  }

  // ---------------------------------------------------------------- drawing
  private drawGrid(): void {
    const g = this.grid.getContext('2d');
    if (!g) return;
    const { w, h, dpr } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.7);
    bg.addColorStop(0, '#062010');
    bg.addColorStop(1, BG);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    const dx = w / DIVS_X;
    const dy = h / DIVS_Y;
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(80, 200, 110, 0.16)';
    g.beginPath();
    for (let i = 1; i < DIVS_X; i++) {
      const x = Math.round(i * dx) + 0.5;
      g.moveTo(x, 0);
      g.lineTo(x, h);
    }
    for (let j = 1; j < DIVS_Y; j++) {
      const y = Math.round(j * dy) + 0.5;
      g.moveTo(0, y);
      g.lineTo(w, y);
    }
    g.stroke();
    // centre cross with 5 minor ticks per division
    g.strokeStyle = 'rgba(110, 230, 140, 0.32)';
    g.beginPath();
    const cx = Math.round(w / 2) + 0.5;
    const cy = Math.round(h / 2) + 0.5;
    g.moveTo(cx, 0);
    g.lineTo(cx, h);
    g.moveTo(0, cy);
    g.lineTo(w, cy);
    for (let i = 0; i <= DIVS_X * 5; i++) {
      const x = Math.round((i * dx) / 5) + 0.5;
      const len = i % 5 === 0 ? 7 : 4;
      g.moveTo(x, cy - len);
      g.lineTo(x, cy + len);
    }
    for (let j = 0; j <= DIVS_Y * 5; j++) {
      const y = Math.round((j * dy) / 5) + 0.5;
      const len = j % 5 === 0 ? 7 : 4;
      g.moveTo(cx - len, y);
      g.lineTo(cx + len, y);
    }
    g.stroke();
    g.strokeStyle = 'rgba(110, 230, 140, 0.35)';
    g.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  private xToPx(x: number, input: RenderInput): number {
    const plot = input.plot;
    if (plot && plot.xLog) {
      const a = Math.log10(Math.max(plot.xMin, 1e-30));
      const b = Math.log10(Math.max(plot.xMax, plot.xMin * 10));
      return ((Math.log10(Math.max(x, 1e-30)) - a) / (b - a)) * this.w;
    }
    return ((x - input.xStart) / (input.xPerDiv * DIVS_X)) * this.w;
  }

  private yToPx(v: number, s: ChannelScale): number {
    return this.h / 2 - ((v - s.center) / s.perDiv) * (this.h / DIVS_Y);
  }

  private drawTraces(p: CanvasRenderingContext2D, input: RenderInput, prog: number, sweeping: boolean): void {
    const plot = input.plot!;
    const limitPx = prog * this.w;
    plot.traces.forEach((t, ci) => {
      if (!input.enabled[ci]) return;
      const s = input.scales[ci] ?? { perDiv: 1, center: 0 };
      const color = CHANNEL_COLORS[ci % CHANNEL_COLORS.length];
      // decimate to min/max per pixel column
      const cols = Math.ceil(this.w);
      const pts: Array<[number, number]> = [];
      let col = -1;
      let mn = 0;
      let mx = 0;
      let lastPx = 0;
      let headY = 0;
      for (let i = 0; i < t.xs.length; i++) {
        const px = this.xToPx(t.xs[i], input);
        if (px < -2) continue;
        if (px > limitPx || px > this.w + 2) break;
        const py = this.yToPx(t.ys[i], s);
        const c = Math.floor(px);
        if (c !== col) {
          if (col >= 0) {
            if (Math.abs(mx - mn) > 1) {
              pts.push([lastPx, mn], [lastPx, mx]);
            }
            pts.push([lastPx, headY]);
          }
          col = c;
          mn = mx = py;
        } else {
          if (py < mn) mn = py;
          if (py > mx) mx = py;
        }
        lastPx = px;
        headY = py;
        if (cols < 0) break;
      }
      if (col >= 0) pts.push([lastPx, headY]);
      if (pts.length < 2) return;

      const path = new Path2D();
      path.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);

      p.lineJoin = 'round';
      p.lineCap = 'round';
      // halo pass
      p.save();
      p.globalAlpha = 0.28 * this.glowScale;
      p.strokeStyle = color;
      p.lineWidth = 7;
      p.shadowColor = color;
      p.shadowBlur = 18 * this.glowScale;
      p.stroke(path);
      p.restore();
      // core pass
      p.save();
      p.globalAlpha = 0.9;
      p.strokeStyle = color;
      p.lineWidth = 1.8;
      p.shadowColor = color;
      p.shadowBlur = 6;
      p.stroke(path);
      p.globalAlpha = 0.55;
      p.strokeStyle = '#eaffea';
      p.lineWidth = 0.7;
      p.shadowBlur = 0;
      p.stroke(path);
      p.restore();

      if (sweeping) {
        const [hx, hy] = pts[pts.length - 1];
        const grd = p.createRadialGradient(hx, hy, 0, hx, hy, 14);
        grd.addColorStop(0, 'rgba(255,255,255,0.95)');
        grd.addColorStop(0.3, color);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        p.fillStyle = grd;
        p.beginPath();
        p.arc(hx, hy, 14, 0, Math.PI * 2);
        p.fill();
      }
    });
  }

  private drawIdle(p: CanvasRenderingContext2D, now: number): void {
    const { w, h } = this;
    const period = 2600;
    const sweep = this.reduced ? 1 : (now % period) / period;
    const head = sweep * w;
    const color = CHANNEL_COLORS[0];
    p.save();
    p.strokeStyle = color;
    p.shadowColor = color;
    p.shadowBlur = 10;
    p.globalAlpha = 0.7;
    p.lineWidth = 1.4;
    p.beginPath();
    const y0 = h / 2;
    const start = Math.max(0, head - w * 0.08);
    for (let x = start; x <= head; x += 3) {
      const n = this.reduced ? 0 : (Math.sin(x * 0.9 + now * 0.02) + Math.sin(x * 2.3 + now * 0.033)) * 0.9 + (Math.random() - 0.5) * 1.6;
      if (x === start) p.moveTo(x, y0 + n);
      else p.lineTo(x, y0 + n);
    }
    if (this.reduced) {
      p.moveTo(0, y0);
      p.lineTo(w, y0);
    }
    p.stroke();
    p.restore();
  }
}

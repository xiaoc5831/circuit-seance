/**
 * CRT oscilloscope renderer
 * Handles all canvas drawing: graticule, traces, persistence, effects
 */

import type { SimResult, AnalysisType } from '@/shared/types';
import {
  applyGlow,
  clearGlow,
  applyScanlines,
  getFlickerAlpha,
  motionAllowed,
} from './phosphor-effects';

export interface ScopeViewState {
  voltsPerDiv: number;
  timePerDiv: number;
  channels: Array<{
    enabled: boolean;
    variableIndex: number; // Index into SimResult.data
    color: string; // e.g. '#39ff14'
  }>;
  analysisType: AnalysisType;
}

export interface ScopeMetrics {
  pixelsPerDiv: number;
  voltsPerPx: number;
  timePerPx: number;
  centreX: number;
  centreY: number;
  canvasWidth: number;
  canvasHeight: number;
}

// Note: autoScale logic is available but currently unused because viewState already
// has voltsPerDiv and timePerDiv, which are set from the App.tsx auto-scale logic.

/**
 * Decimate trace data to at most 2 points per pixel column
 * Uses min/max binning for each column
 */
function decimateTrace(
  times: number[],
  values: number[],
  pixelsPerX: number
): Array<{ t: number; v: number }> {
  if (times.length === 0) return [];
  if (pixelsPerX >= 1) {
    // No decimation needed
    return times.map((t, i) => ({ t, v: values[i] }));
  }

  const decimated: Array<{ t: number; v: number }> = [];
  let bin: { tStart: number; tEnd: number; vMin: number; vMax: number; indices: number[] } | null =
    null;

  for (let i = 0; i < times.length; i++) {
    const pixelCol = Math.floor(times[i] * pixelsPerX);
    const v = values[i];

    if (!bin || Math.floor(bin.tStart * pixelsPerX) !== pixelCol) {
      // Flush previous bin
      if (bin) {
        decimated.push({ t: (bin.tStart + bin.tEnd) / 2, v: (bin.vMin + bin.vMax) / 2 });
      }
      bin = { tStart: times[i], tEnd: times[i], vMin: v, vMax: v, indices: [i] };
    } else {
      bin.tEnd = times[i];
      bin.vMin = Math.min(bin.vMin, v);
      bin.vMax = Math.max(bin.vMax, v);
      bin.indices.push(i);
    }
  }

  if (bin) {
    decimated.push({ t: (bin.tStart + bin.tEnd) / 2, v: (bin.vMin + bin.vMax) / 2 });
  }

  return decimated;
}

export class ScopeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private persistCanvas: HTMLCanvasElement;
  private persistCtx: CanvasRenderingContext2D;
  private hasDrawn = false;
  private lastFrameTime = 0;
  private qualityReduction = 1;
  private consecutiveSlowFrames = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Off-screen persistence buffer
    this.persistCanvas = document.createElement('canvas');
    this.persistCanvas.width = canvas.width;
    this.persistCanvas.height = canvas.height;
    this.persistCtx = this.persistCanvas.getContext('2d')!;

    // Handle device pixel ratio
    this.resizeCanvas();
  }

  private resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.persistCanvas.width = this.canvas.width;
    this.persistCanvas.height = this.canvas.height;
    this.ctx.scale(dpr, dpr);
    this.persistCtx.scale(dpr, dpr);
  }

  /**
   * Main render entry point, called from RAF loop
   */
  draw(viewState: ScopeViewState, simResult: SimResult | null, timestamp: number): void {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Adaptive quality
    if (frameTime > 16) {
      this.consecutiveSlowFrames++;
      if (this.consecutiveSlowFrames > 1) {
        this.qualityReduction = Math.max(1, this.qualityReduction * 0.5);
      }
    } else if (frameTime < 14) {
      this.consecutiveSlowFrames = 0;
      this.qualityReduction = 1;
    }

    // Clear background
    this.ctx.fillStyle = '#0a0f0a';
    this.ctx.fillRect(
      0,
      0,
      this.canvas.width / (window.devicePixelRatio || 1),
      this.canvas.height / (window.devicePixelRatio || 1)
    );

    // Draw persistence from last frame
    this.ctx.globalAlpha = 0.85;
    this.ctx.drawImage(this.persistCanvas, 0, 0);
    this.ctx.globalAlpha = 1.0;

    if (!simResult) {
      this.drawNoSignal();
      return;
    }

    // Compute metrics
    const { canvasWidth, canvasHeight } = this.getCanvasDimensions();

    const pixelsPerDiv = Math.min(40, Math.max(20, canvasWidth / 10));
    const metrics: ScopeMetrics = {
      pixelsPerDiv,
      voltsPerPx: viewState.voltsPerDiv / pixelsPerDiv,
      timePerPx: viewState.timePerDiv / pixelsPerDiv,
      centreX: canvasWidth / 2,
      centreY: canvasHeight / 2,
      canvasWidth,
      canvasHeight,
    };

    // Draw graticule
    this.drawGraticule(metrics);

    // Draw labels
    this.drawLabels(metrics, viewState);

    // Draw traces
    this.drawTraces(viewState, simResult, metrics, timestamp);

    // Apply flicker and scanlines
    const flickerAlpha = getFlickerAlpha(timestamp);
    this.ctx.globalAlpha = flickerAlpha;
    this.ctx.fillStyle = 'rgba(57, 255, 20, 0.01)';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    this.ctx.globalAlpha = 1.0;

    if (motionAllowed()) {
      applyScanlines(this.ctx, 2);
    }

    // Copy current frame to persistence buffer for next frame
    this.persistCtx.clearRect(0, 0, this.persistCanvas.width, this.persistCanvas.height);
    this.persistCtx.drawImage(this.canvas, 0, 0);

    // Mark canvas as having drawn trace for testing
    if (!this.hasDrawn) {
      this.hasDrawn = true;
      this.canvas.setAttribute('data-has-trace', 'true');
    }
  }

  private getCanvasDimensions(): { canvasWidth: number; canvasHeight: number } {
    const dpr = window.devicePixelRatio || 1;
    return {
      canvasWidth: this.canvas.width / dpr,
      canvasHeight: this.canvas.height / dpr,
    };
  }

  private drawGraticule(metrics: ScopeMetrics): void {
    const { pixelsPerDiv, centreX, centreY, canvasWidth, canvasHeight } = metrics;

    // Grid lines (dim phosphor)
    this.ctx.strokeStyle = 'rgba(57, 255, 20, 0.1)';
    this.ctx.lineWidth = 0.5;

    // Vertical lines (10 divs)
    for (let i = 0; i <= 10; i++) {
      const x = centreX - (5 - i) * pixelsPerDiv;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, canvasHeight);
      this.ctx.stroke();
    }

    // Horizontal lines (8 divs)
    for (let i = 0; i <= 8; i++) {
      const y = centreY - (4 - i) * pixelsPerDiv;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(canvasWidth, y);
      this.ctx.stroke();
    }

    // Centre crosshairs
    this.ctx.strokeStyle = 'rgba(57, 255, 20, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(centreX - 10, centreY);
    this.ctx.lineTo(centreX + 10, centreY);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(centreX, centreY - 10);
    this.ctx.lineTo(centreX, centreY + 10);
    this.ctx.stroke();

    // Outer border
    this.ctx.strokeStyle = 'rgba(57, 255, 20, 0.5)';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(0, 0, canvasWidth, canvasHeight);
  }

  private drawLabels(metrics: ScopeMetrics, viewState: ScopeViewState): void {
    this.ctx.fillStyle = '#39ff14';
    this.ctx.font = '11px "Share Tech Mono", monospace';
    this.ctx.textBaseline = 'top';

    const { canvasWidth, canvasHeight } = metrics;
    const padding = 8;

    // Top-left: analysis type
    const analysisLabel = `${viewState.analysisType.toUpperCase()}`;
    this.ctx.fillText(analysisLabel, padding, padding);

    // Top-right: volts/div
    const voltsLabel = `${viewState.voltsPerDiv.toFixed(3)} V/div`;
    const voltsMetrics = this.ctx.measureText(voltsLabel);
    this.ctx.fillText(voltsLabel, canvasWidth - voltsMetrics.width - padding, padding);

    // Bottom-left: time/div
    const timeLabel = `${viewState.timePerDiv.toFixed(3)} s/div`;
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(timeLabel, padding, canvasHeight - padding);

    // Bottom-right: channel list
    const activeChannels = viewState.channels.filter((c) => c.enabled).length;
    const chLabel = `CH1–CH${activeChannels}`;
    const chMetrics = this.ctx.measureText(chLabel);
    this.ctx.fillText(chLabel, canvasWidth - chMetrics.width - padding, canvasHeight - padding);
  }

  private drawTraces(
    viewState: ScopeViewState,
    simResult: SimResult,
    metrics: ScopeMetrics,
    _timestamp: number
  ): void {
    if (viewState.analysisType !== 'tran') {
      return; // Only transient for now
    }

    const timeData = simResult.data[0]?.values as number[] | undefined;
    if (!timeData) return;

    // Draw each enabled channel
    for (let chIdx = 0; chIdx < viewState.channels.length; chIdx++) {
      const ch = viewState.channels[chIdx];
      if (!ch.enabled || ch.variableIndex >= simResult.data.length) continue;

      const voltData = simResult.data[ch.variableIndex]?.values;
      if (!voltData || typeof voltData[0] !== 'number') continue;

      this.drawSingleTrace(
        timeData as number[],
        voltData as number[],
        ch.color,
        metrics,
        viewState.voltsPerDiv,
        viewState.timePerDiv
      );
    }
  }

  private drawSingleTrace(
    times: number[],
    values: number[],
    color: string,
    metrics: ScopeMetrics,
    voltsPerDiv: number,
    timePerDiv: number
  ): void {
    const { centreX, centreY, pixelsPerDiv } = metrics;
    const pixelsPerX = pixelsPerDiv / timePerDiv;
    const pixelsPerY = pixelsPerDiv / voltsPerDiv;

    // Decimate to ~2 points per pixel
    const decimated = decimateTrace(times, values, pixelsPerX);
    if (decimated.length === 0) return;

    // Convert to canvas coordinates and batch into single path
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;

    // Glow pass: wide, faint shadow
    applyGlow(this.ctx, color, 8 * this.qualityReduction);
    this.ctx.globalAlpha = 0.5;

    this.ctx.beginPath();
    for (let i = 0; i < decimated.length; i++) {
      const { t, v } = decimated[i];
      const x = centreX + t * pixelsPerX;
      const y = centreY - v * pixelsPerY;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();

    // Core pass: sharp, bright
    clearGlow(this.ctx);
    this.ctx.globalAlpha = 1.0;
    this.ctx.lineWidth = 1.5;

    this.ctx.beginPath();
    for (let i = 0; i < decimated.length; i++) {
      const { t, v } = decimated[i];
      const x = centreX + t * pixelsPerX;
      const y = centreY - v * pixelsPerY;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
  }

  private drawNoSignal(): void {
    const { canvasWidth, canvasHeight } = this.getCanvasDimensions();
    const centreX = canvasWidth / 2;
    const centreY = canvasHeight / 2;

    // Text
    this.ctx.fillStyle = '#39ff14';
    this.ctx.font = 'bold 18px "Share Tech Mono", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const text = 'No signal — summon a circuit';
    this.ctx.globalAlpha = 0.7;
    this.ctx.fillText(text, centreX, centreY);

    // Glow
    applyGlow(this.ctx, '#39ff14', 20);
    this.ctx.globalAlpha = 0.4;
    this.ctx.fillText(text, centreX, centreY);
    clearGlow(this.ctx);
    this.ctx.globalAlpha = 1.0;
  }

  /**
   * Call when canvas is resized (via ResizeObserver)
   */
  onResize(): void {
    this.resizeCanvas();
  }
}

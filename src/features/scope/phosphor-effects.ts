/**
 * CRT phosphor visual effects
 * All functions are pure; state lives in the renderer
 */

/**
 * Apply a glow effect to recent drawing operations
 * via canvas shadowBlur (pure function, state in renderer)
 */
export function applyGlow(ctx: CanvasRenderingContext2D, color: string, blurRadius: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blurRadius;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/**
 * Clear shadow effects
 */
export function clearGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/**
 * Draw scanlines overlay (pure function)
 * scanlineOpacity: 0–1, typical 0.1–0.15
 */
export function applyScanlines(ctx: CanvasRenderingContext2D, spacing: number = 2): void {
  const { width, height } = ctx.canvas;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

/**
 * Flicker effect: deterministic based on timestamp
 * Returns opacity factor 0.85–1.0
 */
export function getFlickerAlpha(timestamp: number, intensity: number = 0.03): number {
  if (!motionAllowed()) return 1.0;
  // Fast pseudo-random flicker using timestamp modulo
  const flicker = Math.sin(timestamp * 0.012) * 0.5 + 0.5;
  const delta = (flicker - 0.5) * intensity;
  return Math.max(0.85, 1.0 + delta);
}

/**
 * Detect prefers-reduced-motion media query
 */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * CRT power-on animation
 * Animates brightness and a horizontal sweep effect
 * Returns a promise that resolves when animation completes
 * Resolves immediately if !motionAllowed()
 */
export async function playCRTPowerOn(ctx: CanvasRenderingContext2D): Promise<void> {
  if (!motionAllowed()) return Promise.resolve();

  const { width, height } = ctx.canvas;
  const duration = 1000; // ms
  const startTime = performance.now();

  return new Promise((resolve) => {
    function frame(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Clear canvas
      ctx.fillStyle = '#0a0f0a';
      ctx.fillRect(0, 0, width, height);

      // Horizontal line sweep
      const sweepY = height * progress;
      ctx.strokeStyle = `rgba(57, 255, 20, ${(1 - progress) * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, sweepY);
      ctx.lineTo(width, sweepY);
      ctx.stroke();

      // Glow intensity ramp
      const glowAlpha = progress * 0.3;
      ctx.shadowColor = `rgba(57, 255, 20, ${glowAlpha})`;
      ctx.shadowBlur = progress * 20;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        clearGlow(ctx);
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

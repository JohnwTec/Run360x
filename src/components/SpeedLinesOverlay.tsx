import React, { useEffect, useRef } from 'react';

interface SpeedLinesOverlayProps {
  active: boolean;
  speedKmh: number;
  thresholdKmh?: number;
  theme?: 'dark' | 'light';
  variant?: 'viewport' | 'hud';
}

interface SpeedLine {
  angle: number;
  dist: number;
  speed: number;
  length: number;
  width: number;
  alpha: number;
  hueIndex: number;
}

const DARK_PALETTE = [
  '34, 211, 238',  // cyan-400
  '56, 189, 248',  // sky-400
  '251, 191, 36',  // amber-400
  '244, 63, 94',   // rose-500 (overdrive)
];

const LIGHT_PALETTE = [
  '249, 115, 22',  // orange-500
  '14, 165, 233',  // sky-500
  '245, 158, 11',  // amber-500
  '225, 29, 72',   // rose-600
];

/**
 * High-DPI radial speed lines + peripheral motion-blur vignette overlay.
 * Automatically activates when speedKmh exceeds thresholdKmh (default 16 km/h),
 * keeping the central HUD & content completely crisp and unobstructed.
 */
export const SpeedLinesOverlay: React.FC<SpeedLinesOverlayProps> = ({
  active,
  speedKmh,
  thresholdKmh = 16,
  theme = 'dark',
  variant = 'viewport',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef({ active, speedKmh, thresholdKmh, theme });

  useEffect(() => {
    liveRef.current = { active, speedKmh, thresholdKmh, theme };
  }, [active, speedKmh, thresholdKmh, theme]);

  const intensity = active
    ? Math.min(1, Math.max(0.22, (speedKmh - thresholdKmh) / 6 + 0.25))
    : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const parent = variant === 'viewport' ? null : canvas.parentElement;
      width = variant === 'viewport'
        ? Math.max(window.innerWidth, 320)
        : Math.max(parent?.clientWidth || 320, 240);
      height = variant === 'viewport'
        ? Math.max(window.innerHeight, 320)
        : Math.max(parent?.clientHeight || 360, 240);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const lineCount = variant === 'viewport' ? 56 : 38;
    const lines: SpeedLine[] = [];

    const resetLine = (line: SpeedLine, initialSpread: boolean) => {
      line.angle = Math.random() * Math.PI * 2;
      // Start outside a clear inner focal ring so metrics remain razor-sharp
      const minStart = variant === 'viewport' ? 0.42 : 0.34;
      line.dist = initialSpread
        ? minStart + Math.random() * 0.72
        : minStart + Math.random() * 0.22;
      line.speed = 1.15 + Math.random() * 1.95;
      line.length = (variant === 'viewport' ? 0.14 : 0.16) + Math.random() * 0.22;
      line.width = (variant === 'viewport' ? 1.1 : 0.9) + Math.random() * 2.2;
      line.alpha = 0.28 + Math.random() * 0.52;
      line.hueIndex = Math.random() < 0.58 ? 0 : Math.random() < 0.72 ? 1 : Math.random() < 0.85 ? 2 : 3;
    };

    for (let i = 0; i < lineCount; i++) {
      const item: SpeedLine = {
        angle: 0,
        dist: 0,
        speed: 1,
        length: 0.2,
        width: 1.5,
        alpha: 0.5,
        hueIndex: 0,
      };
      resetLine(item, true);
      lines.push(item);
    }

    let rafId = 0;
    let lastMs = performance.now();
    let smoothedOpacity = 0;
    let disposed = false;

    let resizeObserver: ResizeObserver | null = null;
    if (variant === 'hud' && canvas.parentElement && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas.parentElement);
    } else if (variant === 'viewport') {
      window.addEventListener('resize', resize);
    }

    const drawFrame = (nowMs: number) => {
      if (disposed) return;
      const dt = Math.min((nowMs - lastMs) / 1000, 0.05);
      lastMs = nowMs;

      const st = liveRef.current;
      const targetOpacity = st.active
        ? Math.min(1, Math.max(0.28, (st.speedKmh - st.thresholdKmh) / 6 + 0.32))
        : 0;

      // Smooth fade in/out so crossing 16 km/h feels fluid, never abrupt
      const rate = targetOpacity > smoothedOpacity ? 7.5 : 5.0;
      smoothedOpacity += (targetOpacity - smoothedOpacity) * (1 - Math.exp(-rate * dt));

      ctx.clearRect(0, 0, width, height);

      if (smoothedOpacity > 0.01) {
        const cx = width * 0.5;
        const cy = variant === 'hud' ? height * 0.36 : height * 0.5;
        const maxRadius = Math.hypot(cx, cy) * 1.12;
        const palette = st.theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
        const velocityBoost = 1 + Math.max(0, st.speedKmh - st.thresholdKmh) * 0.14;
        const overdriveRatio = Math.min(1, Math.max(0, (st.speedKmh - st.thresholdKmh) / 6));

        ctx.save();
        ctx.lineCap = 'round';

        const activeCount = Math.floor(lineCount * (0.55 + 0.45 * overdriveRatio));

        for (let i = 0; i < activeCount; i++) {
          const line = lines[i];

          if (!prefersReducedMotion) {
            line.dist += line.speed * velocityBoost * dt;
            if (line.dist > 1.24) {
              resetLine(line, false);
            }
          }

          const cosA = Math.cos(line.angle);
          const sinA = Math.sin(line.angle);

          const innerR = line.dist * maxRadius;
          const streakLen = line.length * (0.85 + overdriveRatio * 0.75) * maxRadius;
          const outerR = innerR + streakLen;

          const x1 = cx + cosA * innerR;
          const y1 = cy + sinA * innerR;
          const x2 = cx + cosA * outerR;
          const y2 = cy + sinA * outerR;

          // Use hotter amber/rose hues more frequently above 19 km/h
          const colorIdx =
            overdriveRatio > 0.55 && line.hueIndex === 1
              ? 2
              : overdriveRatio > 0.78 && line.hueIndex === 0 && i % 3 === 0
                ? 3
                : line.hueIndex;
          const rgb = palette[colorIdx];
          const finalAlpha = line.alpha * smoothedOpacity * (variant === 'viewport' ? 0.65 : 0.52);

          const grad = ctx.createLinearGradient(x1, y1, x2, y2);
          grad.addColorStop(0, `rgba(${rgb}, 0)`);
          grad.addColorStop(0.35, `rgba(${rgb}, ${finalAlpha.toFixed(3)})`);
          grad.addColorStop(1, `rgba(${rgb}, ${(finalAlpha * 0.12).toFixed(3)})`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = line.width * (0.85 + overdriveRatio * 0.45);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        ctx.restore();
      }

      if (st.active || smoothedOpacity > 0.015) {
        rafId = window.requestAnimationFrame(drawFrame);
      } else {
        rafId = 0;
      }
    };

    if (active) {
      rafId = window.requestAnimationFrame(drawFrame);
    }

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      if (variant === 'viewport') {
        window.removeEventListener('resize', resize);
      }
    };
  }, [active, variant]);

  const isLight = theme === 'light';
  const vignetteEdgeColor = isLight
    ? `rgba(249, 115, 22, ${(intensity * 0.16).toFixed(3)})`
    : `rgba(6, 182, 212, ${(intensity * 0.2).toFixed(3)})`;
  const secondaryEdgeColor = isLight
    ? `rgba(14, 165, 233, ${(intensity * 0.12).toFixed(3)})`
    : `rgba(245, 158, 11, ${(intensity * 0.14).toFixed(3)})`;

  if (variant === 'viewport') {
    return (
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-30 pointer-events-none transition-opacity duration-300 ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Peripheral motion-blur kinetic vignette (center 100% clear) */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, transparent 58%, ${vignetteEdgeColor} 88%, ${secondaryEdgeColor} 100%)`,
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            WebkitMaskImage:
              'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.45) 66%, rgba(0,0,0,1) 88%)',
            maskImage:
              'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.45) 66%, rgba(0,0,0,1) 88%)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-3xl transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Directional CSS motion-blur streaks on flanks of the HUD gauge */}
      <div className="absolute inset-0 hud-motion-blur-streaks" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

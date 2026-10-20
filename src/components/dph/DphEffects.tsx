import { useEffect, useRef } from 'react';
import { DPH_THEME, dphAsset } from '@/config/dphTheme';
import { boundsInTable } from '@/lib/cardGeometry';

/** Rebuilds the source's particle layers in 2D; independent of the game protocol. */
export default function DphEffects({ type, seat }: { type: 'bomb' | 'rocket'; seat?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d');
    if (!element || !ctx) return;
    let frame = 0;
    let disposed = false;
    const images = ['impact', 'spark', 'glow', 'flame'].map(name => {
      const im = new Image(); im.src = dphAsset(`effects/${name}.png`); return im;
    });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const table = element.closest('.dph-table');
    const hand = seat == null ? null : table?.querySelector<HTMLElement>(`[data-seat-hand="${seat}"]`);
    // Capture the pile once; the played cards may already be leaving the hand.
    const origin = (hand?.querySelector('[data-card-id]')?.parentElement ?? hand)?.getBoundingClientRect();
    const start = performance.now();
    const duration = type === 'bomb' ? DPH_THEME.effects.bombMs : DPH_THEME.effects.rocketMs;
    const draw = (now: number) => {
      if (disposed) return;
      const { width, height } = element.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
        element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const t = Math.min((now - start) / duration, 1);
      const cx = width / 2, cy = height * .45, scale = Math.min(width / 1000, height / 600, 1.5);
      const paint = (im: HTMLImageElement, x: number, y: number, size: number, alpha: number, rotation = 0) => {
        if (!im.complete || !im.naturalWidth) return;
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(alpha, 1)); ctx.translate(x, y); ctx.rotate(rotation);
        ctx.drawImage(im, -size / 2, -size / 2, size, size); ctx.restore();
      };
      ctx.globalCompositeOperation = 'lighter';
      if (reduced) {
        paint(images[2], cx, cy, 300 * scale, .5 * Math.sin(t * Math.PI));
      } else if (type === 'rocket') {
        const elapsed = now - start;
        const launchEnd = DPH_THEME.effects.rocketLaunchMs;
        const impactAt = launchEnd + DPH_THEME.effects.rocketFallMs;
        const falling = elapsed >= launchEnd;
        element.dataset.phase = elapsed >= impactAt ? 'explosion' : falling ? 'fall' : 'launch';
        if (elapsed < impactAt) {
          const progress = falling ? (elapsed - launchEnd) / DPH_THEME.effects.rocketFallMs : elapsed / launchEnd;
          const travel = progress * progress;
          const x = falling ? cx + (1 - travel) * 140 * scale : cx - 65 * scale;
          const y = falling ? -150 * scale + (cy + 150 * scale) * travel : height + 160 * scale - (height + 340 * scale) * travel;
          const angle = falling ? Math.PI + .2 : -.06;
          ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
          // Exhaust stays behind the rocket in both directions.
          const flameLength = 120 + Math.sin(elapsed * .065) * 18;
          const exhaust = ctx.createLinearGradient(0, 60, 0, 60 + flameLength);
          exhaust.addColorStop(0, '#fff7d7'); exhaust.addColorStop(.3, '#ffc15be6'); exhaust.addColorStop(1, '#ed583000');
          ctx.fillStyle = exhaust; ctx.beginPath(); ctx.moveTo(-19, 58);
          ctx.quadraticCurveTo(-30, 110, 0, 60 + flameLength);
          ctx.quadraticCurveTo(30, 110, 19, 58); ctx.closePath(); ctx.fill();
          paint(images[3], 0, 115, 150, .75, Math.PI / 2);
          for (let i = 0; i < 7; i++) {
            const trail = ((elapsed / 180 + i / 7) % 1);
            paint(images[1], Math.sin(i * 7) * (8 + trail * 28), 80 + trail * 190, 10 * (1 - trail), 1 - trail);
          }
          ctx.globalCompositeOperation = 'source-over';
          // Gold-edged body, red nose and fins retain the existing rocket style.
          ctx.fillStyle = '#ac4841';
          ctx.beginPath(); ctx.moveTo(-22, 22); ctx.lineTo(-54, 70); ctx.lineTo(-20, 59); ctx.fill();
          ctx.beginPath(); ctx.moveTo(22, 22); ctx.lineTo(54, 70); ctx.lineTo(20, 59); ctx.fill();
          const body = ctx.createLinearGradient(-35, 0, 35, 0);
          body.addColorStop(0, '#ceb892'); body.addColorStop(.45, '#fff8e5'); body.addColorStop(1, '#dfcda6');
          ctx.fillStyle = body; ctx.strokeStyle = '#ffe4a2'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(0, -95); ctx.quadraticCurveTo(65, -30, 27, 65);
          ctx.lineTo(-27, 65); ctx.quadraticCurveTo(-65, -30, 0, -95); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ba4b43'; ctx.beginPath(); ctx.moveTo(0, -95); ctx.lineTo(28, -40); ctx.lineTo(-28, -40); ctx.fill();
          ctx.fillStyle = '#48698a'; ctx.beginPath(); ctx.arc(0, -8, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#c7e8ef'; ctx.beginPath(); ctx.arc(-5, -13, 6, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          // All burst layers start on impact, rather than during the ascent.
          const p = Math.min((elapsed - impactAt) / (duration - impactAt), 1);
          const expand = 1 - Math.pow(1 - p, 3);
          const fade = Math.pow(1 - p, 1.4);
          paint(images[2], cx, cy, (180 + expand * 720) * scale, fade);
          paint(images[3], cx, cy, (100 + expand * 450) * scale, fade * .85, p * .4);
          for (let i = 0; i < DPH_THEME.effects.particles * 2; i++) {
            const angle = i * 2.39996;
            const distance = expand * (160 + (i % 6) * 45) * scale;
            paint(images[1], cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance + p * p * 100 * scale,
              (10 + i % 4 * 7) * scale * (1 - p * .7), fade, angle + p * 2);
          }
          ctx.globalCompositeOperation = 'source-over';
          paint(images[0], cx, cy, (160 + expand * 390) * scale, fade, -.08);
          for (let i = 0; i < 2; i++) {
            ctx.strokeStyle = `rgba(255,${218 - i * 35},135,${fade * (1 - i * .35)})`;
            ctx.lineWidth = (5 - i * 2) * scale * (1 - p);
            ctx.beginPath(); ctx.ellipse(cx, cy, (25 + expand * (390 + i * 65)) * scale,
              (25 + expand * (220 + i * 50)) * scale, 0, 0, Math.PI * 2); ctx.stroke();
          }
        }
      } else {
        const elapsed = now - start;
        const throwMs = DPH_THEME.effects.bombThrowMs;
        element.dataset.phase = elapsed < throwMs ? 'throw' : 'explosion';
        if (elapsed < throwMs) {
          const p = elapsed / throwMs;
          const from = origin ? boundsInTable(origin, element.getBoundingClientRect(), width, height,
            document.body.classList.contains('ddz-rotated')) : null;
          const sx = from ? from.x + from.width / 2 : width * .5;
          const sy = from ? from.y + from.height / 2 : height * .88;
          const arc = Math.min(height * .26, 180 * scale);
          const at = (progress: number) => ({ x: sx + (cx - sx) * progress,
            y: sy + (cy - sy) * progress - Math.sin(progress * Math.PI) * arc });
          for (let i = 1; i <= 6; i++) {
            const previous = p - i * .035;
            if (previous < 0) continue;
            const point = at(previous);
            paint(images[1], point.x, point.y, (13 - i) * scale, (1 - i / 7) * .65, p * 4);
          }
          const point = at(p);
          ctx.globalCompositeOperation = 'source-over';
          ctx.save(); ctx.translate(point.x, point.y);
          ctx.rotate(Math.sin(p * Math.PI) * (sx > cx ? -1 : 1) * 1.3);
          ctx.font = `${(58 + Math.sin(p * Math.PI / 2) * 38) * scale}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.shadowColor = '#ffbb55'; ctx.shadowBlur = 12 * scale;
          ctx.fillText('💣', 0, 0); ctx.restore();
        } else {
          const p = Math.min((elapsed - throwMs) / (duration - throwMs), 1);
          const burst = Math.sin(Math.min(p * 2, 1) * Math.PI / 2);
          paint(images[2], cx, cy, (180 + burst * 560) * scale, (1 - p) * .9);
          for (let i = 0; i < DPH_THEME.effects.particles; i++) {
            const angle = i * Math.PI * 2 / DPH_THEME.effects.particles;
            const distance = (35 + p * (240 + (i % 4) * 50)) * scale;
            paint(images[1], cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance + p * p * 120,
              (12 + (i % 3) * 9) * scale, Math.sin(p * Math.PI), angle + p * 3);
          }
          ctx.globalCompositeOperation = 'source-over';
          paint(images[0], cx, cy, (200 + burst * 300) * scale, Math.sin(p * Math.PI), -.1);
          ctx.strokeStyle = `rgba(255,217,135,${1 - p})`; ctx.lineWidth = 6 * (1 - p);
          ctx.beginPath(); ctx.arc(cx, cy, (30 + p * 430) * scale, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (t < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { disposed = true; cancelAnimationFrame(frame); };
  }, [type, seat]);
  return <div className="dph-effect" aria-hidden="true"><canvas ref={canvas} />
    <div className="dph-effect-title" style={type === 'rocket' ? {
      animationDelay: `${DPH_THEME.effects.rocketLaunchMs + DPH_THEME.effects.rocketFallMs}ms`,
      animationDuration: `${DPH_THEME.effects.rocketMs - DPH_THEME.effects.rocketLaunchMs - DPH_THEME.effects.rocketFallMs}ms`,
    } : {
      animationDelay: `${DPH_THEME.effects.bombThrowMs}ms`,
      animationDuration: `${DPH_THEME.effects.bombMs - DPH_THEME.effects.bombThrowMs}ms`,
    }}>{type === 'bomb' ? '炸 弹' : '王 炸'}<small>{type === 'bomb' ? 'BOMB!' : 'ROCKET!'}</small></div>
  </div>;
}

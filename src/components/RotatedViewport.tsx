// 竖屏手机旋转视口 —— 将整个应用旋转 90° 横置展示
// 仅针对「竖屏 + 触屏 + 手机尺寸」（最小边 < 768）启用；
// PC（非触屏）与平板（最小边 ≥ 768）完全不受影响。
import { useEffect } from 'react';
import { useDeviceStore } from '@/store/deviceStore';

function computeViewport() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const rotated = h > w && coarse && Math.min(w, h) < 768;
  return {
    coarse,
    rotated,
    availW: rotated ? h : w,
    availH: rotated ? w : h,
  };
}

export default function RotatedViewport({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      useDeviceStore.setState(computeViewport());
      document.body.classList.toggle('ddz-rotated', computeViewport().rotated);
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      document.body.classList.remove('ddz-rotated');
    };
  }, []);

  const rotated = useDeviceStore((s) => s.rotated);
  const availW = useDeviceStore((s) => s.availW);
  const availH = useDeviceStore((s) => s.availH);

  if (!rotated) return <>{children}</>;

  // 旋转 90°：容器宽 = 视口高、高 = 视口宽，origin 左上，
  // rotate(90deg) translateY(-100%) 恰好铺满整个屏幕（触控命中由浏览器自动换算）
  return (
    <div className="ddz-rotate-root" style={{ width: availW, height: availH }}>
      {children}
    </div>
  );
}

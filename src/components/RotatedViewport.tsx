// 竖屏手机旋转视口 —— 将整个应用旋转 90° 横置展示
// 仅针对「竖屏 + 触屏 + 手机尺寸」（最小边 < 768）启用；
// PC（非触屏）与平板（最小边 ≥ 768）完全不受影响。
import { useEffect } from 'react';
import { useDeviceStore } from '@/store/deviceStore';

// 实际可见区域尺寸：优先用 visualViewport（浏览器地址栏/工具栏显隐、
// 页面缩放时它才是真实可见尺寸；window.innerHeight 在部分移动浏览器
// 与 fixed 定位的布局视口不一致，会导致旋转容器尺寸/缩放比例异常）
function readSize(): { w: number; h: number } {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv && vv.width > 0 && vv.height > 0) return { w: vv.width, h: vv.height };
  return { w: window.innerWidth, h: window.innerHeight };
}

function computeViewport() {
  const { w, h } = readSize();
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
    const vv = window.visualViewport;
    const onResize = () => apply();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // visualViewport 的 resize/scroll：工具栏显隐、捏合缩放时可见区域变化
    if (vv) {
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (vv) {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      }
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

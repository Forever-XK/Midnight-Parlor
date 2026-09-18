import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Game from "@/pages/Game";
import Lobby from "@/pages/Lobby";
import Room from "@/pages/Room";
import { sound } from "@/lib/soundManager";
import ResourceLoader from "@/components/ResourceLoader";
import RotatedViewport from "@/components/RotatedViewport";
import { useUiScaleStore } from "@/store/uiScaleStore";

export default function App() {
  // 启动主界面背景音乐（Welcome 循环）
  useEffect(() => { sound.playBgm('Welcome'); }, []);

  // 界面缩放（4K/高分屏调大）：作用于 documentElement，效果同浏览器页面缩放，
  // fixed 弹窗、全屏特效等均按比例同步缩放。
  // 仅手机尺寸的触屏视口不启用（旋转视口/紧凑布局有专门适配逻辑）；
  // 带触摸屏的大屏（如 Surface + 4K 显示器）照常生效。
  const uiScale = useUiScaleStore((s) => s.scale);
  useEffect(() => {
    const apply = () => {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      const phoneSized = Math.min(window.innerWidth, window.innerHeight) < 768;
      const factor = coarse && phoneSized ? 1 : uiScale;
      document.documentElement.style.zoom = factor === 1 ? '' : String(factor);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      document.documentElement.style.zoom = '';
    };
  }, [uiScale]);

  // 全局按钮点击音效：事件委托覆盖应用内所有 <button>（含未来新增），
  // 禁用状态的按钮不发声
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest?.('button');
      if (btn && !btn.disabled) sound.buttonClick();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <ResourceLoader>
      <RotatedViewport>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game" element={<Game />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/room/:roomId" element={<Room />} />
          </Routes>
        </Router>
      </RotatedViewport>
    </ResourceLoader>
  );
}

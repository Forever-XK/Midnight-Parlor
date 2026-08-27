import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Game from "@/pages/Game";
import Lobby from "@/pages/Lobby";
import Room from "@/pages/Room";
import { sound } from "@/lib/soundManager";
import ResourceLoader from "@/components/ResourceLoader";
import RotatedViewport from "@/components/RotatedViewport";

export default function App() {
  // 启动主界面背景音乐（Welcome 循环）
  useEffect(() => { sound.playBgm('Welcome'); }, []);

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

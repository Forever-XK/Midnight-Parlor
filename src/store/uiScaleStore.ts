// 界面缩放状态：桌面端（非触屏）整体放大/缩小界面
// 4K / 高分屏上默认布局偏小（手牌、记牌器等），可调大全局缩放；
// 触屏设备有旋转视口 / 紧凑缩放等适配逻辑，不启用缩放以免相互干扰。
import { create } from 'zustand';

export const UI_SCALES = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75] as const;
export type UiScale = (typeof UI_SCALES)[number];

const KEY = 'ddz-ui-scale';

function getInitialScale(): UiScale {
  try {
    const v = parseFloat(localStorage.getItem(KEY) ?? '');
    if ((UI_SCALES as readonly number[]).includes(v)) return v as UiScale;
  } catch { /* ignore */ }
  return 1;
}

interface UiScaleStore {
  scale: UiScale;
  setScale: (s: UiScale) => void;
}

export const useUiScaleStore = create<UiScaleStore>((set) => ({
  scale: getInitialScale(),
  setScale: (s) => {
    try { localStorage.setItem(KEY, String(s)); } catch { /* ignore */ }
    set({ scale: s });
  },
}));

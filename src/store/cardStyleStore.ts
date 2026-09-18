// 牌面风格状态管理（手牌右下角图案样式）
import { create } from 'zustand';

export type CardFaceStyle = 'classic' | 'ring' | 'watermark' | 'rank' | 'fun' | 'dark' | 'xiangqi';

export const CARD_FACES: { id: CardFaceStyle; name: string; desc: string }[] = [
  { id: 'classic', name: '经典', desc: '大花色图案' },
  { id: 'ring', name: '圆徽', desc: '金环花色徽章' },
  { id: 'watermark', name: '水印', desc: '半透明大水印' },
  { id: 'rank', name: '点数', desc: '大号点数字符' },
  { id: 'fun', name: '庆典', desc: '烟花绚烂' },
  { id: 'dark', name: '暗黑', desc: '玄黑底鎏金辉' },
  { id: 'xiangqi', name: '象棋', desc: '国际象棋棋子' },
];

const KEY = 'ddz-card-face';

function getInitialFace(): CardFaceStyle {
  try {
    const saved = localStorage.getItem(KEY);
    if (CARD_FACES.some((f) => f.id === saved)) return saved as CardFaceStyle;
  } catch { /* ignore */ }
  return 'classic';
}

interface CardStyleStore {
  face: CardFaceStyle;
  setFace: (f: CardFaceStyle) => void;
}

export const useCardStyleStore = create<CardStyleStore>((set) => ({
  face: getInitialFace(),
  setFace: (f) => {
    try { localStorage.setItem(KEY, f); } catch { /* ignore */ }
    set({ face: f });
  },
}));

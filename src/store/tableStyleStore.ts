// 牌桌桌布风格状态管理（对局中间桌布的颜色与图案）
import { create } from 'zustand';

export interface TableStyle {
  id: string;
  name: string;
  desc: string;
  /** CSS background（多层：图案层 + 颜色渐变层）；null = 默认翡翠绿（felt-texture 类） */
  background: string | null;
  /** 亮色主题下的 background；缺省时与深色共用 */
  backgroundLight?: string | null;
}

export const TABLE_STYLES: TableStyle[] = [
  { id: 'classic', name: '经典翡翠', desc: '默认墨绿呢绒', background: null },
  {
    id: 'midnight', name: '午夜蓝', desc: '深蓝牌桌',
    background: 'radial-gradient(ellipse at center, #14324f 0%, #0d1b2a 45%, #081220 100%)',
    backgroundLight: 'radial-gradient(ellipse at center, #2a5a8a 0%, #1a4a78 45%, #0f3a60 100%)',
  },
  {
    id: 'wine', name: '酒红绒', desc: '深红牌桌',
    background: 'radial-gradient(ellipse at center, #7a1f2b 0%, #5c1620 45%, #3f0d15 100%)',
    backgroundLight: 'radial-gradient(ellipse at center, #a83a48 0%, #8a2a38 45%, #6b1c28 100%)',
  },
  {
    id: 'violet', name: '紫罗兰', desc: '幽紫牌桌',
    background: 'radial-gradient(ellipse at center, #4a2a6a 0%, #36205a 45%, #241341 100%)',
    backgroundLight: 'radial-gradient(ellipse at center, #7a5aa0 0%, #63418a 45%, #4a2d6a 100%)',
  },
  {
    id: 'checker', name: '棋盘格', desc: '绿底棋盘纹',
    background: 'repeating-conic-gradient(rgba(255,255,255,0.035) 0% 25%, transparent 0% 50%) 0 0 / 48px 48px, radial-gradient(ellipse at center, #0f6048 0%, #0a4d3a 45%, #063326 100%)',
    backgroundLight: 'repeating-conic-gradient(rgba(0,0,0,0.04) 0% 25%, transparent 0% 50%) 0 0 / 48px 48px, radial-gradient(ellipse at center, #2d8a5e 0%, #1a7248 45%, #0f5a38 100%)',
  },
  {
    id: 'stripe', name: '织锦纹', desc: '蓝底斜织纹',
    background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 6px, transparent 6px 12px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.05) 0 6px, transparent 6px 12px), radial-gradient(ellipse at center, #14324f 0%, #0d1b2a 45%, #081220 100%)',
    backgroundLight: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 6px, transparent 6px 12px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.04) 0 6px, transparent 6px 12px), radial-gradient(ellipse at center, #2a5a8a 0%, #1a4a78 45%, #0f3a60 100%)',
  },
];

const KEY = 'ddz-table-style';

function getInitialStyle(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && TABLE_STYLES.some((t) => t.id === saved)) return saved;
  } catch { /* ignore */ }
  return 'classic';
}

interface TableStyleStore {
  style: string;
  setStyle: (id: string) => void;
}

export const useTableStyleStore = create<TableStyleStore>((set) => ({
  style: getInitialStyle(),
  setStyle: (id) => {
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
    set({ style: id });
  },
}));

/** 按当前风格与主题取 background（classic 返回 null 用类默认） */
export function getTableBackground(styleId: string, isLight: boolean): string | null {
  const t = TABLE_STYLES.find((s) => s.id === styleId);
  if (!t) return null;
  if (isLight) return t.backgroundLight ?? t.background;
  return t.background;
}

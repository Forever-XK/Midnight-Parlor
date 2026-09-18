// 牌背风格状态管理（背面图案样式，发牌动画/闷抓暗牌/对手手牌展示）
import { create } from 'zustand';

export interface CardBackStyle {
  id: string;
  name: string;
  desc: string;
  /** CSS background 多层（图案 + 渐变）；null = 默认经典翡翠 */
  background: string | null;
  /** 亮色主题下的 background；缺省时与深色共用 */
  backgroundLight?: string | null;
  /** 背面中央装饰字符 */
  motif: string;
  /** 装饰字符颜色（带透明度） */
  motifColor: string;
  motifColorLight?: string;
  /** 内框边线颜色 */
  innerBorderColor: string;
  innerBorderColorLight?: string;
}

export const CARD_BACKS: CardBackStyle[] = [
  {
    id: 'classic', name: '经典翡翠', desc: '默认墨绿呢绒',
    background: null, motif: '♦',
    motifColor: 'rgba(212,175,55,0.3)', motifColorLight: 'rgba(178,190,181,0.3)',
    innerBorderColor: 'rgba(212,175,55,0.2)', innerBorderColorLight: 'rgba(251,191,36,0.2)',
  },
  {
    id: 'gold', name: '金丝楠', desc: '金棕细织纹',
    background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 3px, transparent 3px 6px), linear-gradient(135deg, #b8860b 0%, #8b6914 40%, #6b4f0f 100%)',
    backgroundLight: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 3px, transparent 3px 6px), linear-gradient(135deg, #d4a937 0%, #b8860b 40%, #8b6914 100%)',
    motif: '♦', motifColor: 'rgba(255,246,214,0.35)', motifColorLight: 'rgba(255,255,255,0.4)',
    innerBorderColor: 'rgba(255,246,214,0.25)', innerBorderColorLight: 'rgba(255,255,255,0.3)',
  },
  {
    id: 'midnight', name: '午夜蓝', desc: '深蓝星点纹',
    background: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(135deg, #14324f 0%, #0d1b2a 45%, #081220 100%)',
    backgroundLight: 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(135deg, #2a5a8a 0%, #1a4a78 45%, #0f3a60 100%)',
    motif: '♠', motifColor: 'rgba(212,175,55,0.35)', motifColorLight: 'rgba(255,255,255,0.4)',
    innerBorderColor: 'rgba(212,175,55,0.25)', innerBorderColorLight: 'rgba(255,255,255,0.3)',
  },
  {
    id: 'wine', name: '酒红绒', desc: '深红织锦纹',
    background: 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.05) 0 4px, transparent 4px 8px), linear-gradient(135deg, #7a1f2b 0%, #5c1620 45%, #3f0d15 100%)',
    backgroundLight: 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.07) 0 4px, transparent 4px 8px), linear-gradient(135deg, #a83a48 0%, #8a2a38 45%, #6b1c28 100%)',
    motif: '♥', motifColor: 'rgba(212,175,55,0.35)', motifColorLight: 'rgba(255,220,220,0.45)',
    innerBorderColor: 'rgba(212,175,55,0.25)', innerBorderColorLight: 'rgba(255,200,200,0.35)',
  },
  {
    id: 'galaxy', name: '星河', desc: '紫黑星辉',
    background: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.2px) 3px 5px / 14px 14px, radial-gradient(rgba(255,255,255,0.08) 0.8px, transparent 1px) 9px 2px / 22px 22px, linear-gradient(135deg, #2a1a4a 0%, #16102a 45%, #0a0616 100%)',
    backgroundLight: 'radial-gradient(rgba(90,60,150,0.3) 1px, transparent 1.2px) 3px 5px / 14px 14px, radial-gradient(rgba(90,60,150,0.2) 0.8px, transparent 1px) 9px 2px / 22px 22px, linear-gradient(135deg, #5a3a8a 0%, #40285e 45%, #2a1a45 100%)',
    motif: '✦', motifColor: 'rgba(212,175,55,0.45)', motifColorLight: 'rgba(255,240,180,0.6)',
    innerBorderColor: 'rgba(212,175,55,0.3)', innerBorderColorLight: 'rgba(255,240,180,0.4)',
  },
  {
    id: 'bamboo', name: '青竹', desc: '竹青条纹',
    background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 8px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 4px, transparent 4px 16px), linear-gradient(135deg, #1e6e50 0%, #14563c 45%, #0b3d2a 100%)',
    backgroundLight: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0 2px, transparent 2px 8px), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 4px, transparent 4px 16px), linear-gradient(135deg, #2d8a5e 0%, #1a7248 45%, #0f5a38 100%)',
    motif: '♣', motifColor: 'rgba(212,175,55,0.35)', motifColorLight: 'rgba(255,255,255,0.4)',
    innerBorderColor: 'rgba(212,175,55,0.25)', innerBorderColorLight: 'rgba(255,255,255,0.3)',
  },
];

const KEY = 'ddz-card-back';

function getInitialBack(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && CARD_BACKS.some((b) => b.id === saved)) return saved;
  } catch { /* ignore */ }
  return 'classic';
}

interface CardBackStore {
  back: string;
  setBack: (id: string) => void;
}

export const useCardBackStore = create<CardBackStore>((set) => ({
  back: getInitialBack(),
  setBack: (id) => {
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
    set({ back: id });
  },
}));

/** 按主题取预设样式字段（classic 的 background 为 null 时用默认渐变） */
export function getCardBack(styleId: string, isLight: boolean): CardBackStyle {
  const found = CARD_BACKS.find((b) => b.id === styleId) ?? CARD_BACKS[0];
  if (found.background === null) {
    return {
      ...found,
      background: isLight
        ? 'linear-gradient(135deg, #b8860b 0%, #8b6914 40%, #6b4f0f 100%)'
        : 'linear-gradient(135deg, #0f6048 0%, #0a4d3a 40%, #063326 100%)',
    };
  }
  return {
    ...found,
    background: isLight ? found.backgroundLight ?? found.background : found.background,
    motifColor: isLight ? found.motifColorLight ?? found.motifColor : found.motifColor,
    innerBorderColor: isLight ? found.innerBorderColorLight ?? found.innerBorderColor : found.innerBorderColor,
  };
}

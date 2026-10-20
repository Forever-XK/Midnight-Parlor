import { create } from 'zustand';

export type VoicePack = 'mandarin' | 'taiwan';
export type RocketEffect = 'original' | 'transparent' | 'golden_dragon';
export type BombEffect = 'original' | 'bomb1' | 'bomb2';
export const VOICE_PACKS = [
  { id: 'mandarin' as const, name: '普通话', desc: '熟悉的经典报牌' },
  { id: 'taiwan' as const, name: '台湾腔', desc: '轻快活泼的报牌' },
];
export const ROCKET_EFFECTS = [
  { id: 'original' as const, name: '经典王炸', desc: '火箭升空与坠落爆炸' },
  { id: 'transparent' as const, name: '幻彩庆典', desc: '气球光环' },
  { id: 'golden_dragon' as const, name: '金龙裂地', desc: '金龙爆发' },
];
export const ROCKET_VIDEO_URLS = {
  transparent: `${import.meta.env.BASE_URL}effects/rocket-transparent.webm`,
  golden_dragon: `${import.meta.env.BASE_URL}effects/rocket-2-transparent.webm`,
};
export const BOMB_EFFECTS = [
  { id: 'original' as const, name: '经典投弹', desc: '原版投掷与爆炸' },
  { id: 'bomb1' as const, name: '幻彩炸弹', desc: '梦幻主题炸弹' },
  { id: 'bomb2' as const, name: '雷霆炸弹', desc: '雷霆之锤炸弹' },
];
export const BOMB_VIDEO_URLS = {
  bomb1: `${import.meta.env.BASE_URL}effects/bomb-1-transparent.webm`,
  bomb2: `${import.meta.env.BASE_URL}effects/bomb-2-transparent.webm`,
};

export function normalizeRocketEffect(value: unknown): RocketEffect {
  if (value === 'golden_dragon') return value;
  return value === 'video' || value === 'transparent' ? 'transparent' : 'original';
}

function initialRocketEffect(): RocketEffect {
  try {
    const saved = localStorage.getItem('ddz-rocket-effect');
    const current = normalizeRocketEffect(saved);
    if (saved === 'video') save('ddz-rocket-effect', current);
    return current;
  } catch { return 'original'; }
}

function savedChoice<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  try { const value = localStorage.getItem(key) as T; return choices.includes(value) ? value : fallback; }
  catch { return fallback; }
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Settings still work without storage. */ }
}
export const usePresentationStore = create<{
  voicePack: VoicePack;
  rocketEffect: RocketEffect;
  bombEffect: BombEffect;
  setVoicePack: (pack: VoicePack) => void;
  setRocketEffect: (effect: RocketEffect) => void;
  setBombEffect: (effect: BombEffect) => void;
}>(set => ({
  voicePack: savedChoice('ddz-voice-pack', ['mandarin', 'taiwan'], 'mandarin'),
  rocketEffect: initialRocketEffect(),
  bombEffect: savedChoice('ddz-bomb-effect', ['original', 'bomb1', 'bomb2'], 'bomb1'),
  setVoicePack: voicePack => { save('ddz-voice-pack', voicePack); set({ voicePack }); },
  setRocketEffect: rocketEffect => { save('ddz-rocket-effect', rocketEffect); set({ rocketEffect }); },
  setBombEffect: bombEffect => { save('ddz-bomb-effect', bombEffect); set({ bombEffect }); },
}));

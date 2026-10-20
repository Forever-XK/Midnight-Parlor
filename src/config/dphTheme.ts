import type { Card, Difficulty, GameMode } from '@shared/types';

/** The only resource mapping needed by the UI. Paths are relative to Vite's base. */
export const dphAsset = (path: string) => `${import.meta.env.BASE_URL}dph/${path}`;
export const DPH_THEME = {
  background: dphAsset('backgrounds/courtyard.jpg'),
  host: dphAsset('characters/host.png'),
  avatars: ['10002', '10006', '10009'].map(id => dphAsset(`characters/${id}-head.png`)),
  effects: { bombMs: 1900, bombThrowMs: 650, rocketMs: 2700, rocketLaunchMs: 800, rocketFallMs: 650, particles: 18 },
};
export const DPH_MODES: { id: GameMode; name: string; subtitle: string; mark: string; description: string }[] = [
  { id: 'classic', name: '经典斗地主', subtitle: 'CLASSIC', mark: '♠', description: '熟悉的规则，新的牌局。叫分争地主，配合见真章。' },
  { id: 'unshuffled', name: '不洗牌', subtitle: 'BOMB PARTY', mark: '✦', description: '大牌集中，精彩加倍。感受连番炸弹的畅快对决。' },
  { id: 'laizi', name: '癞子玩法', subtitle: 'WILD CARD', mark: '♥', description: '一张百搭，无限可能。灵活组合，打出意外好牌。' },
  { id: 'laizi_unshuffled', name: '癞子不洗牌', subtitle: 'WILD PARTY', mark: '✧', description: '单癞子搭配分批发牌，牌型适度集中，比不洗牌更灵活。' },
  { id: 'tiandilaizi', name: '天地癞子', subtitle: 'DOUBLE WILD', mark: '♣', description: '天癞地癞双重变化，更丰富的组合与炸弹。' },
  { id: 'menzhua', name: '闷抓斗地主', subtitle: 'BLIND BID', mark: '♦', description: '暗牌争先，闷抓翻倍。给每一局添一点心跳。' },
];
export const DPH_DIFFICULTIES: { id: Difficulty; name: string; description: string }[] = [
  { id: 'casual', name: '休闲', description: '轻松练手' },
  { id: 'standard', name: '标准', description: '旗鼓相当' },
  { id: 'master', name: '高手', description: '进阶挑战' },
];
export function dphCardImage(card: Card, rank: number = card.rank) {
  return dphAsset(`cards/${rank >= 16 ? 'joker' : card.suit}-${rank}.png`);
}


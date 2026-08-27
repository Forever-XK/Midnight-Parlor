// 牌型规则引擎测试
import { describe, it, expect } from 'vitest';
import { identifyPlay, canBeat } from './rules';
import type { Card } from '@shared/types';

function c(rank: number, suit: string, idx = 0): Card {
  if (rank === 16) return { id: 'joker-16', suit: 'joker', rank: 16 };
  if (rank === 17) return { id: 'joker-17', suit: 'joker', rank: 17 };
  return { id: `${suit}-${rank}-${idx}`, suit: suit as Card['suit'], rank: rank as Card['rank'] };
}

describe('identifyPlay', () => {
  it('识别单张', () => {
    const play = identifyPlay([c(5, 'spade')]);
    expect(play?.type).toBe('single');
    expect(play?.mainRank).toBe(5);
  });

  it('识别对子', () => {
    const play = identifyPlay([c(7, 'spade'), c(7, 'heart')]);
    expect(play?.type).toBe('pair');
  });

  it('识别三张', () => {
    const play = identifyPlay([c(9, 'spade'), c(9, 'heart'), c(9, 'club')]);
    expect(play?.type).toBe('triple');
  });

  it('识别炸弹', () => {
    const play = identifyPlay([c(3, 'spade'), c(3, 'heart'), c(3, 'club'), c(3, 'diamond')]);
    expect(play?.type).toBe('bomb');
  });

  it('识别火箭', () => {
    const play = identifyPlay([c(16, 'joker'), c(17, 'joker')]);
    expect(play?.type).toBe('rocket');
  });

  it('识别三带一', () => {
    const play = identifyPlay([c(5, 'spade'), c(5, 'heart'), c(5, 'club'), c(3, 'diamond')]);
    expect(play?.type).toBe('triple_single');
    expect(play?.mainRank).toBe(5);
  });

  it('识别三带二', () => {
    const play = identifyPlay([c(5, 'spade'), c(5, 'heart'), c(5, 'club'), c(3, 'diamond'), c(3, 'club')]);
    expect(play?.type).toBe('triple_pair');
  });

  it('识别顺子', () => {
    const cards = [3, 4, 5, 6, 7].map((r, i) => c(r, ['spade', 'heart', 'club', 'diamond', 'spade'][i]));
    const play = identifyPlay(cards);
    expect(play?.type).toBe('straight');
    expect(play?.length).toBe(5);
  });

  it('顺子不含2和王', () => {
    const cards = [12, 13, 14, 15, 3].map((r, i) => c(r, ['spade', 'heart', 'club', 'diamond', 'spade'][i]));
    expect(identifyPlay(cards)).toBeNull();
  });

  it('识别连对', () => {
    const cards = [5, 5, 6, 6, 7, 7].map((r, i) => c(r, ['spade', 'heart', 'spade', 'heart', 'spade', 'heart'][i]));
    const play = identifyPlay(cards);
    expect(play?.type).toBe('pair_straight');
    expect(play?.length).toBe(3);
  });

  it('识别飞机', () => {
    const cards = [5, 5, 5, 6, 6, 6].map((r, i) => c(r, ['spade', 'heart', 'club', 'spade', 'heart', 'club'][i]));
    const play = identifyPlay(cards);
    expect(play?.type).toBe('airplane');
  });

  it('识别飞机带单', () => {
    const cards = [5, 5, 5, 6, 6, 6, 3, 7].map((r, i) => c(r, ['spade', 'heart', 'club', 'spade', 'heart', 'club', 'diamond', 'diamond'][i]));
    const play = identifyPlay(cards);
    expect(play?.type).toBe('airplane_single');
  });

  it('识别四带二', () => {
    const cards = [5, 5, 5, 5, 3, 7].map((r, i) => c(r, ['spade', 'heart', 'club', 'diamond', 'spade', 'heart'][i]));
    const play = identifyPlay(cards);
    expect(play?.type).toBe('four_two_single');
  });

  it('非法牌型返回 null', () => {
    expect(identifyPlay([c(3, 'spade'), c(5, 'heart')])).toBeNull();
  });
});

describe('canBeat', () => {
  it('火箭压一切', () => {
    const rocket = identifyPlay([c(16, 'joker'), c(17, 'joker')])!;
    const bomb = identifyPlay([c(3, 'spade'), c(3, 'heart'), c(3, 'club'), c(3, 'diamond')])!;
    expect(canBeat(rocket, bomb)).toBe(true);
  });

  it('炸弹压非炸弹', () => {
    const bomb = identifyPlay([c(3, 'spade'), c(3, 'heart'), c(3, 'club'), c(3, 'diamond')])!;
    const single = identifyPlay([c(15, 'spade')])!;
    expect(canBeat(bomb, single)).toBe(true);
  });

  it('大炸弹压小炸弹', () => {
    const bigBomb = identifyPlay([c(5, 'spade'), c(5, 'heart'), c(5, 'club'), c(5, 'diamond')])!;
    const smallBomb = identifyPlay([c(3, 'spade'), c(3, 'heart'), c(3, 'club'), c(3, 'diamond')])!;
    expect(canBeat(bigBomb, smallBomb)).toBe(true);
    expect(canBeat(smallBomb, bigBomb)).toBe(false);
  });

  it('同型比大小', () => {
    const big = identifyPlay([c(10, 'spade')])!;
    const small = identifyPlay([c(5, 'spade')])!;
    expect(canBeat(big, small)).toBe(true);
    expect(canBeat(small, big)).toBe(false);
  });

  it('不同型不能压', () => {
    const pair = identifyPlay([c(5, 'spade'), c(5, 'heart')])!;
    const single = identifyPlay([c(15, 'spade')])!;
    expect(canBeat(pair, single)).toBe(false);
  });

  it('顺子长度需相同', () => {
    const long = identifyPlay([3, 4, 5, 6, 7, 8].map((r, i) => c(r, ['s', 'h', 'c', 'd', 's', 'h'][i] as any)))!;
    const short = identifyPlay([3, 4, 5, 6, 7].map((r, i) => c(r, ['s', 'h', 'c', 'd', 's'][i] as any)))!;
    expect(canBeat(long, short)).toBe(false);
  });

  // ===== 天地癞子模式：多张炸弹 =====
  describe('多张炸弹（天地癞子模式）', () => {
    // 第 5 张同点（5 张 3）
    const fiveBombCards = () => Array.from({ length: 5 }, (_, i) => c(3, ['s', 'h', 'c', 'd', 's'][i] as any));

    it('默认不允许 5 张炸弹', () => {
      expect(identifyPlay(fiveBombCards())).toBeNull();
    });

    it('multiBomb 开启时识别 5 张炸弹', () => {
      const play = identifyPlay(fiveBombCards(), { multiBomb: true });
      expect(play?.type).toBe('bomb');
      expect(play?.length).toBe(5);
    });

    it('识别 6 张炸弹', () => {
      const cards = Array.from({ length: 6 }, (_, i) => c(9, ['s', 'h', 'c', 'd', 's', 'h'][i] as any));
      const play = identifyPlay(cards, { multiBomb: true });
      expect(play?.type).toBe('bomb');
      expect(play?.length).toBe(6);
    });

    it('张数越多炸弹越大（5 张压 4 张）', () => {
      const four = identifyPlay([c(3, 's'), c(3, 'h'), c(3, 'c'), c(3, 'd')], { multiBomb: true })!;
      const five = identifyPlay(fiveBombCards(), { multiBomb: true })!;
      expect(canBeat(five, four)).toBe(true);
      expect(canBeat(four, five)).toBe(false);
    });

    it('同张数比点数', () => {
      const fiveLow = identifyPlay(fiveBombCards(), { multiBomb: true })!; // 5 张 3
      const fiveHigh = identifyPlay(Array.from({ length: 5 }, (_, i) => c(7, ['s', 'h', 'c', 'd', 's'][i] as any)), { multiBomb: true })!; // 5 张 7
      expect(canBeat(fiveHigh, fiveLow)).toBe(true);
      expect(canBeat(fiveLow, fiveHigh)).toBe(false);
    });

    it('王炸仍为最大', () => {
      const rocket = identifyPlay([c(16, 'joker'), c(17, 'joker')], { multiBomb: true })!;
      const six = identifyPlay(Array.from({ length: 6 }, (_, i) => c(15, ['s', 'h', 'c', 'd', 's', 'h'][i] as any)), { multiBomb: true })!;
      expect(canBeat(rocket, six)).toBe(true);
      expect(canBeat(six, rocket)).toBe(false);
    });

    it('四张硬炸仍压癞子炸（四张炸遵循癞子规则）', () => {
      const hard = identifyPlay([c(3, 's'), c(3, 'h'), c(3, 'c'), c(3, 'd')], { multiBomb: true })!;
      const laizi = { ...identifyPlay([c(3, 's'), c(3, 'h'), c(3, 'c'), c(3, 'd')], { multiBomb: true })!, isLaiziBomb: true };
      expect(canBeat(hard, laizi)).toBe(true);
      expect(canBeat(laizi, hard)).toBe(false);
    });

    it('五张癞子炸压四张硬炸（张数优先）', () => {
      const hard = identifyPlay([c(3, 's'), c(3, 'h'), c(3, 'c'), c(3, 'd')], { multiBomb: true })!;
      const laiziFive = { ...identifyPlay(fiveBombCards(), { multiBomb: true })!, isLaiziBomb: true };
      expect(canBeat(laiziFive, hard)).toBe(true);
    });
  });
});

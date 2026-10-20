import type { Card, Play } from '@shared/types';
import type { AIContext } from './aiEngine';
import { aiActions } from './aiActions';
import { planHand } from './powerEvaluator';
import { countByRank } from './cards';
import { rolloutPick } from './aiRollout';

const bomb = (p: Play) => p.type === 'bomb' || p.type === 'rocket';
const without = (hand: Card[], p: Play) => {
  const ids = new Set(p.cards.map(c => c.id));
  return hand.filter(c => !ids.has(c.id));
};

/** 剩余手数为主、控制牌为辅。所有分支只看自己的牌和公开信息。 */
export function strategicPlay(ctx: AIContext, canPass = true): Play | null {
  const { hand, lastValidPlay: last, laiziRanks = [], multiBomb = false } = ctx;
  const actions = aiActions(hand, last, laiziRanks, multiBomb);
  const finish = actions.find(p => p.cards.length === hand.length);
  if (finish) return finish; // 清手优先于保炸、保王及队友让牌。
  if (!actions.length) return null;
  const enemies = ctx.players.filter(p => (p.seat === ctx.landlordSeat) !== (ctx.seat === ctx.landlordSeat));
  const danger = Math.min(...enemies.map(p => p.cardCount));
  const mate = ctx.players.find(p => p.seat !== ctx.seat && p.role === ctx.role);
  const mateLeading = last && ctx.lastPlaySeat === mate?.seat;
  if (mateLeading && (mate!.cardCount <= 2 || bomb(last!) || last!.mainRank >= 14 || (ctx.passCount ?? 0) > 0)) return null;

  const counts = countByRank(hand);
  const memo = new Map<string, number>();
  const quality = (cards: Card[]): number => {
    if (!cards.length) return 10000;
    const cnt = countByRank(cards);
    const key = Array.from({ length: 15 }, (_, i) => cnt.get(i + 3) ?? 0).join('');
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const plan = planHand(cards);
    let rounds = plan.groups.length;
    // 癞子保留实际补牌能力：再看一层合法组合，避免把癞子永远当原点数。
    if (cards.some(c => laiziRanks.includes(c.rank))) {
      const combos = aiActions(cards, null, laiziRanks, multiBomb).sort((a, b) => b.cards.length - a.cards.length).slice(0, 18);
      for (const p of combos) rounds = Math.min(rounds, 1 + planHand(without(cards, p)).groups.length);
    }
    const loose = plan.groups.filter(g => g.type === 'single' && g.mainRank < 14).length;
    const controls = cards.filter(c => c.rank >= 15).length;
    const reserves = [...cnt.values()].filter(n => n === 4).length * 85 + (cnt.has(16) && cnt.has(17) ? 100 : 0);
    const value = -100 * rounds - loose * 9 + controls * 12 + reserves;
    memo.set(key, value);
    return value;
  };
  const scored = actions.map(p => {
    const rest = without(hand, p);
    let s = quality(rest) + p.cards.length * 2 - p.mainRank * 0.8;
    // 保留整炸/火箭，但允许通过真正减少手数、收尾或救急来拆。
    const used = countByRank(p.cards);
    for (const [rank, n] of used) {
      if (counts.get(rank) === 4 && n < 4) s -= danger <= 2 ? 20 : 95;
    }
    if (counts.has(16) && counts.has(17) && used.has(16) !== used.has(17)) s -= danger <= 2 ? 0 : 70;
    if (bomb(p)) s -= danger <= 3 || rest.length <= 2 ? 8 : 65;
    if (p.type === 'four_two_single' || p.type === 'four_two_pair') s -= danger <= 2 ? 20 : 130;
    if (!last && danger === 1 && p.type === 'single') s -= 200 - p.mainRank * 6;
    if (!last && danger === 2 && p.type === 'pair') s -= 65;
    // 只在地主紧接着行动时顶队友小牌，避免已经过牌的地主被错误“防守”。
    if (mateLeading) s -= 90 + (p.mainRank < 11 ? 70 : 0);
    if (last?.type === 'single' && danger === 1 && !mateLeading && p.type === 'single') s += p.mainRank * 150;
    // 队友报单/双：领小单/小对送牌，同时保留整手收尾优先级。
    if (!last && mate && danger > 2 && mate.cardCount <= 2 &&
      p.type === (mate.cardCount === 1 ? 'single' : 'pair')) s += 100 - p.mainRank * 4;
    return { p, s };
  }).sort((a, b) => b.s - a.s || a.p.mainRank - b.p.mainRank);

  // 队友的小牌已能脱手且接管会明显拆坏手牌时，保留其主动权。
  if (mateLeading && scored[0].s < quality(hand) - 30) return null;
  const urgent = !mateLeading && last && danger <= 2;
  if (ctx.difficulty === 'master' && !urgent) {
    // 保留不同牌型和炸弹选项；不能先过滤掉炸弹再让模拟“选择”。
    const top = scored.slice(0, 4).map(x => x.p);
    const explosive = scored.find(x => bomb(x.p));
    if (explosive && !top.includes(explosive.p)) top.push(explosive.p);
    const candidates: Array<Play | null> = [...top];
    if (last && !mateLeading) candidates.push(null);
    const simulation = rolloutPick({
      hand, seat: ctx.seat, landlordSeat: ctx.landlordSeat,
      opponents: ctx.players.filter(p => p.seat !== ctx.seat),
      cardTracker: ctx.cardTracker, lastValidPlay: last, lastPlaySeat: ctx.lastPlaySeat,
      passCount: ctx.passCount ?? 0, laiziRanks, multiBomb, mode: ctx.mode,
    }, candidates, { passMargin: 0.08 });
    if (simulation) return simulation.pick;
  }
  if (canPass && last && !mateLeading && !urgent) {
    // 大幅拆坏手牌时允许忍一手；只差一手的对手除外。
    if (scored[0].s < quality(hand) - 90 && danger > 4) return null;
  }
  if (ctx.difficulty === 'casual' && danger > 3 && scored.length > 1 && Math.random() < 0.25) {
    return scored[Math.floor(Math.random() * Math.min(3, scored.length))].p;
  }
  return scored[0].p;
}

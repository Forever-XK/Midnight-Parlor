// AI 自对弈基准：对照组 A/B 对比 rollout（DouZero 式前瞻模拟）对 master AI 的强度提升。
//
// 设计：
//   - 座位 0 由「提示引擎」驱动（getHint，纯启发式，不含 rollout）扮演固定基准玩家；
//   - 座位 1/2 为 master 难度 AI（rollout 开启时获得前瞻模拟增强）；
//   - 同一批对局分别以 rollout ON / OFF 各跑 N 局，比较座位 0 一方胜率：
//     若 rollout 有效增强 AI，ON 组的座位 0 胜率应显著下降。
//   - 模式混合 classic / unshuffled 交替，消除单一牌型分布偏差。
//
// 运行：npx tsx scripts/ai-bench.ts [局数，默认 60]
import { createGame, playerBid, playerPlay, playerPass, playerHint, getState } from '../api/game/gameService';
import { setRolloutEnabled, getRolloutStats, resetRolloutStats } from '../api/game/aiRollout';
import type { GameMode, GameState } from '@shared/types';

const GAMES = Number(process.argv[2] ?? 60);
const MODES: GameMode[] = ['classic', 'unshuffled'];

interface RunResult {
  seat0Wins: number;
  landlordSeat0: number;
  unfinished: number;
  total: number;
  msPerGame: number;
  // 座位0当地主的子集（两个增强 AI 均为对手，信号最干净）
  asLandlordWins: number;
  asLandlordTotal: number;
}

/** 跑一局，返回座位 0 一方是否获胜（null = 未正常结束） */
function playOneGame(mode: GameMode): { seat0Won: boolean | null; seat0Landlord: boolean } {
  const { gameId } = createGame(mode, 'master');

  // 叫分：轮到座位 0 就叫 3（当地主）；AI 先叫 3 则顺其自然
  let s: GameState | null = getState(gameId);
  let guard = 0;
  while (s && s.phase === 'bidding' && guard++ < 10) {
    if (s.currentSeat === 0) {
      playerBid(gameId, 3);
      s = getState(gameId);
    } else {
      break; // createGame 快照已推进 AI 叫分
    }
  }

  // 出牌循环：AI 在玩家动作内同步推进，轮到座位 0 时用提示引擎
  guard = 0;
  while (s && s.phase === 'playing' && guard++ < 300) {
    if (s.currentSeat === 0) {
      const hint = playerHint(gameId);
      if (hint && hint.length > 0) {
        const r = playerPlay(gameId, hint);
        if (r.error) playerPass(gameId);
      } else {
        playerPass(gameId);
      }
    }
    s = getState(gameId);
    if (s && s.currentSeat !== 0 && s.phase === 'playing') break; // 防御：AI 未同步推进
  }

  const final = getState(gameId);
  if (!final || final.phase !== 'finished' || !final.result) {
    return { seat0Won: null, seat0Landlord: false };
  }
  const seat0Landlord = final.result.landlordSeat === 0;
  const landlordWon = final.result.winner === 'landlord';
  return { seat0Won: seat0Landlord === landlordWon, seat0Landlord };
}

function runGroup(rollout: boolean): RunResult {
  setRolloutEnabled(rollout);
  resetRolloutStats();
  let seat0Wins = 0;
  let landlordSeat0 = 0;
  let unfinished = 0;
  let asLandlordWins = 0;
  let asLandlordTotal = 0;
  const start = Date.now();
  for (let i = 0; i < GAMES; i++) {
    const mode = MODES[i % MODES.length];
    const { seat0Won, seat0Landlord } = playOneGame(mode);
    if (seat0Won === null) unfinished++;
    else if (seat0Won) seat0Wins++;
    if (seat0Landlord) {
      landlordSeat0++;
      asLandlordTotal++;
      if (seat0Won) asLandlordWins++;
    }
  }
  const ms = Date.now() - start;
  const rs = getRolloutStats();
  console.log(
    `  [rollout ${rollout ? 'ON ' : 'OFF'} 内部] 调用 ${rs.calls} 次 / 信息不全回落 ${rs.nullReturns} 次 / 评估候选 ${rs.evaluated} 个 / 模拟 ${rs.sims} 局`,
  );
  return { seat0Wins, landlordSeat0, unfinished, total: GAMES, msPerGame: Math.round(ms / GAMES), asLandlordWins, asLandlordTotal };
}

const off = runGroup(false);
const on = runGroup(true);
setRolloutEnabled(true); // 恢复生产默认

const pct = (r: RunResult) => ((r.seat0Wins / r.total) * 100).toFixed(1);
const pctL = (r: RunResult) => (r.asLandlordTotal > 0 ? ((r.asLandlordWins / r.asLandlordTotal) * 100).toFixed(1) : 'n/a');
console.log('=== AI 基准对比（座位0 = 提示引擎基准玩家 vs master AI x2）===');
console.log(`局数：每组 ${GAMES} 局（classic/unshuffled 交替）`);
console.log(`[rollout OFF] 座位0胜率 ${pct(off)}%  其中当地主胜率 ${pctL(off)}%(${off.asLandlordTotal}局)  未完成 ${off.unfinished}  均耗时 ${off.msPerGame}ms/局`);
console.log(`[rollout ON ] 座位0胜率 ${pct(on)}%  其中当地主胜率 ${pctL(on)}%(${on.asLandlordTotal}局)  未完成 ${on.unfinished}  均耗时 ${on.msPerGame}ms/局`);
const delta = ((off.seat0Wins - on.seat0Wins) / off.total) * 100;
console.log(`结论：rollout ${delta > 2 ? '显著增强' : delta < -2 ? '未见增强（或负向）' : '影响有限'}（座位0总胜率变化 ${delta.toFixed(1)} 个百分点，下降 = AI 变强）`);

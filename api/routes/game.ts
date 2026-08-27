// 游戏与战绩 API 路由
import { Router, type Request, type Response } from 'express';
import {
  createGame, playerBid, playerPlay, playerPass, playerHint, getState, playerMenzhua, playerAnalyze,
} from '../game/gameService';
import { getStats, recordGame } from '../game/statsStore';
import type { Card, Difficulty, GameMode, Role } from '@shared/types';

const router = Router();

// 创建新对局（playerName 为玩家用户名，战绩按用户名分档）
router.post('/game/create', (req: Request, res: Response) => {
  const { mode, difficulty, playerName } = req.body as { mode: GameMode; difficulty: Difficulty; playerName?: string };
  if (!['classic', 'unshuffled', 'laizi', 'tiandilaizi', 'menzhua'].includes(mode)) {
    res.status(400).json({ error: '无效的模式' });
    return;
  }
  if (!['casual', 'standard', 'master'].includes(difficulty)) {
    res.status(400).json({ error: '无效的难度' });
    return;
  }
  const result = createGame(mode, difficulty, playerName);
  res.json(result);
});

// 玩家叫分
router.post('/game/:id/bid', (req: Request, res: Response) => {
  const { id } = req.params;
  const { bid } = req.body as { bid: number };
  if (![0, 1, 2, 3].includes(bid)) {
    res.status(400).json({ error: '无效的叫分' });
    return;
  }
  const result = playerBid(id, bid);
  if (result.error) {
    res.status(400).json({ error: result.error, state: result.state, snapshots: result.snapshots });
    return;
  }
  maybeRecordStats(result.state, res);
  res.json({ state: result.state, snapshots: result.snapshots });
});

// 玩家闷抓选择
router.post('/game/:id/menzhua', (req: Request, res: Response) => {
  const { id } = req.params;
  const { choice, seat } = req.body as { choice: 'menzhua' | 'kanpai'; seat?: number };
  if (!['menzhua', 'kanpai'].includes(choice)) {
    res.status(400).json({ error: '无效的选择' });
    return;
  }
  const s = (seat ?? 0) as 0 | 1 | 2;
  const result = playerMenzhua(id, choice, s);
  if (result.error) {
    res.status(400).json({ error: result.error, state: result.state, snapshots: result.snapshots });
    return;
  }
  maybeRecordStats(result.state, res);
  res.json({ state: result.state, snapshots: result.snapshots });
});

// 玩家出牌（choice 为癞子多解时玩家选定的牌型：type + mainRank）
router.post('/game/:id/play', (req: Request, res: Response) => {
  const { id } = req.params;
  const { cards, playType, mainRank, seat } = req.body as {
    cards: Card[]; playType?: string; mainRank?: number; seat?: number;
  };
  if (!Array.isArray(cards) || cards.length === 0) {
    res.status(400).json({ error: '无效的选牌' });
    return;
  }
  const choice = (playType != null && mainRank != null) ? { type: playType, mainRank } : undefined;
  const result = playerPlay(id, cards, (seat ?? 0) as 0 | 1 | 2, choice);
  if (result.error) {
    res.status(400).json({ error: result.error, state: result.state, snapshots: result.snapshots });
    return;
  }
  maybeRecordStats(result.state, res);
  res.json({ state: result.state, snapshots: result.snapshots });
});

// 分析选牌可构成的所有牌型解（癞子多解选择用）
router.post('/game/:id/analyze', (req: Request, res: Response) => {
  const { id } = req.params;
  const { cards, seat } = req.body as { cards: Card[]; seat?: number };
  if (!Array.isArray(cards) || cards.length === 0) {
    res.json({ plays: [] });
    return;
  }
  const result = playerAnalyze(id, cards, (seat ?? 0) as 0 | 1 | 2);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ plays: result.plays });
});

// 玩家不出
router.post('/game/:id/pass', (req: Request, res: Response) => {
  const { id } = req.params;
  const result = playerPass(id);
  if (result.error) {
    res.status(400).json({ error: result.error, state: result.state, snapshots: result.snapshots });
    return;
  }
  maybeRecordStats(result.state, res);
  res.json({ state: result.state, snapshots: result.snapshots });
});

// 获取提示
router.post('/game/:id/hint', (req: Request, res: Response) => {
  const { id } = req.params;
  const cards = playerHint(id);
  res.json({ cards });
});

// 查询状态
router.get('/game/:id/state', (req: Request, res: Response) => {
  const { id } = req.params;
  const state = getState(id);
  if (!state) {
    res.status(404).json({ error: '对局不存在' });
    return;
  }
  res.json({ state });
});

// 查询战绩（按用户名分档，user 查询参数缺省为「玩家」）
router.get('/stats', (req: Request, res: Response) => {
  const { user } = req.query as { user?: string };
  res.json(getStats(user));
});

// 记录战绩（仅当游戏结束时，且玩家是参与者；按对局的 playerName 归属用户）
function maybeRecordStats(state: any, res: Response): void {
  if (state && state.phase === 'finished' && state.result) {
    const playerRole: Role = state.players[0].role;
    const playerWon =
      (playerRole === 'landlord' && state.result.winner === 'landlord') ||
      (playerRole === 'peasant' && state.result.winner === 'peasant');
    const playerScore = state.result.scores[0];
    // 记录到响应头（避免重复记录）
    const recorded = res.getHeader('X-Stats-Recorded');
    if (!recorded) {
      res.setHeader('X-Stats-Recorded', '1');
      recordGame(state.playerName, playerRole, playerWon, playerScore);
    }
  }
}

export default router;

// 联机对战 API 路由
import { Router, type Request, type Response } from 'express';
import {
  listRooms, createRoom, joinRoom, leaveRoom, startRoom, roomState, getRoom,
  onlineBid, onlinePlay, onlinePass, onlineHint, removeRoom, onlineMenzhua, onlineAnalyze,
} from '../multi/roomService';
import type { Card, Difficulty, GameMode } from '@shared/types';
import { wsService } from '../ws/wsService';

const router = Router();

const MODES = ['classic', 'unshuffled', 'laizi', 'tiandilaizi', 'menzhua'];
const DIFFS = ['casual', 'standard', 'master'];

function validName(name: any): string {
  const s = String(name ?? '').trim().slice(0, 12);
  return s || '玩家';
}

// 房间列表
router.post('/multi/room/list', (_req: Request, res: Response) => {
  res.json({ rooms: listRooms() });
});

// 创建房间
router.post('/multi/room/create', (req: Request, res: Response) => {
  const { clientId, name, mode, difficulty } = req.body as {
    clientId?: string; name?: string; mode?: GameMode; difficulty?: Difficulty;
  };
  if (!clientId) { res.status(400).json({ error: '缺少 clientId' }); return; }
  if (!MODES.includes(mode as string)) { res.status(400).json({ error: '无效的模式' }); return; }
  if (!DIFFS.includes(difficulty as string)) { res.status(400).json({ error: '无效的难度' }); return; }
  const { room, error } = createRoom(clientId, validName(name), mode!, difficulty!);
  if (error || !room) { res.status(400).json({ error }); return; }
  res.json({ roomId: room.roomId });
});

// 加入房间
router.post('/multi/room/:id/join', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId, name } = req.body as { clientId?: string; name?: string };
  if (!clientId) { res.status(400).json({ error: '缺少 clientId' }); return; }
  const { room, error } = joinRoom(id, clientId, validName(name));
  if (error || !room) { res.status(400).json({ error }); return; }
  res.json({ roomId: room.roomId });
});

// 离开房间
router.post('/multi/room/:id/leave', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId } = req.body as { clientId?: string };
  const { room, error } = leaveRoom(id, clientId ?? '');
  if (error || !room) {
    res.json({ ok: true, roomId: id, destroyed: true });
    return;
  }
  res.json({ ok: true, roomId: id });
});

// 开始对局（房主）
router.post('/multi/room/:id/start', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId } = req.body as { clientId?: string };
  const result = startRoom(id, clientId ?? '');
  if (result.error) { res.status(400).json({ error: result.error }); return; }
  // WS：广播最新状态 + 调度 AI 首轮动作（若轮到 AI 先叫）
  wsService.broadcastLatest(id);
  wsService.scheduleRoomAI(id, 900);
  res.json({ gameId: result.gameId, state: result.state, snapshots: result.snapshots ?? [] });
});

// 房间状态（含对局状态，按观众座位返回）
router.get('/multi/room/:id/state', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId } = req.query as { clientId?: string };
  const room = getRoom(id);
  if (!room) { res.status(404).json({ error: '房间不存在' }); return; }
  res.json(roomState(room, clientId ?? ''));
});

// 叫分
router.post('/multi/room/:id/bid', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId, bid } = req.body as { clientId?: string; bid?: number };
  const r = onlineBid(id, clientId ?? '', bid ?? 0);
  if (r.error) { res.status(400).json({ error: r.error, state: r.state }); return; }
  wsService.broadcastLatest(id);
  wsService.scheduleRoomAI(id, 700);
  res.json({ state: r.state, snapshots: r.snapshots ?? [] });
});

// 闷抓选择
router.post('/multi/room/:id/menzhua', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId, choice } = req.body as { clientId?: string; choice?: 'menzhua' | 'kanpai' };
  if (!['menzhua', 'kanpai'].includes(choice as string)) { res.status(400).json({ error: '无效的选择' }); return; }
  const r = onlineMenzhua(id, clientId ?? '', choice!);
  if (r.error) { res.status(400).json({ error: r.error, state: r.state }); return; }
  wsService.broadcastLatest(id);
  wsService.scheduleRoomAI(id, 700);
  res.json({ state: r.state, snapshots: r.snapshots ?? [] });
});

// 出牌（playType/mainRank 为癞子多解时玩家选定的牌型）
router.post('/multi/room/:id/play', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId, cards, playType, mainRank } = req.body as {
    clientId?: string; cards?: Card[]; playType?: string; mainRank?: number;
  };
  if (!Array.isArray(cards) || cards.length === 0) { res.status(400).json({ error: '无效的选牌' }); return; }
  const choice = (playType != null && mainRank != null) ? { type: playType, mainRank } : undefined;
  const r = onlinePlay(id, clientId ?? '', cards, choice);
  if (r.error) { res.status(400).json({ error: r.error, state: r.state }); return; }
  wsService.broadcastLatest(id);
  wsService.scheduleRoomAI(id, 900);
  res.json({ state: r.state, snapshots: r.snapshots ?? [] });
});

// 分析选牌可构成的所有牌型解（癞子多解选择用）
router.post('/multi/room/:id/analyze', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId, cards } = req.body as { clientId?: string; cards?: Card[] };
  if (!Array.isArray(cards) || cards.length === 0) { res.json({ plays: [] }); return; }
  const r = onlineAnalyze(id, clientId ?? '', cards);
  if (r.error) { res.status(400).json({ error: r.error }); return; }
  res.json({ plays: r.plays });
});

// 不出
router.post('/multi/room/:id/pass', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId } = req.body as { clientId?: string };
  const r = onlinePass(id, clientId ?? '');
  if (r.error) { res.status(400).json({ error: r.error, state: r.state }); return; }
  wsService.broadcastLatest(id);
  wsService.scheduleRoomAI(id, 800);
  res.json({ state: r.state, snapshots: r.snapshots ?? [] });
});

// 提示
router.post('/multi/room/:id/hint', (req: Request, res: Response) => {
  const { id } = req.params;
  const { clientId } = req.body as { clientId?: string };
  res.json({ cards: onlineHint(id, clientId ?? '') });
});

// 关闭房间（游戏完全结束后清理）
router.post('/multi/room/:id/close', (req: Request, res: Response) => {
  removeRoom(req.params.id);
  res.json({ ok: true });
});

export default router;
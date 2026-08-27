import { WebSocketServer, type WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { GameState, Seat, Snapshot } from '@shared/types';
import { getRoom, rebuildRoomAI } from '../multi/roomService';
import { stepAIONCE } from '../game/aiSteps';
import { getGame, toPublicState } from '../game/store';

// ============================================================
// WebSocket 服务
//  - 房间级订阅：按 roomId 广播 GameState 增量/全量
//  - AI 调度：当回合轮到 AI 时，单步推进并逐条广播 snapshot
// ============================================================

export type WSMessage =
  | { type: 'subscribe'; roomId: string; seat?: number }
  | { type: 'unsubscribe'; roomId: string }
  | { type: 'ping' };

export type WSBroadcast =
  | { type: 'state'; roomId: string; state: GameState }
  | { type: 'snapshot'; roomId: string; snapshot: Snapshot }
  | { type: 'error'; roomId: string; message: string }
  | { type: 'pong' };

interface Subscriber {
  ws: WebSocket;
  seat?: number;
}

class WSService {
  private wss?: WebSocketServer;
  private rooms = new Map<string, Set<Subscriber>>();
  private aiTimers = new Map<string, ReturnType<typeof setTimeout>>();

  attach(server: HTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws) => {
      let subscribedRoom: string | null = null;
      const sub: Subscriber = { ws, seat: undefined };

      ws.on('message', (raw) => {
        try {
          const msg: WSMessage = JSON.parse(raw.toString());
          if (msg.type === 'subscribe') {
            if (subscribedRoom) this.unsub(subscribedRoom, sub);
            subscribedRoom = msg.roomId;
            sub.seat = msg.seat;
            this.sub(msg.roomId, sub);
            this.broadcastLatest(msg.roomId);
            this.scheduleRoomAI(msg.roomId, 900);
          } else if (msg.type === 'unsubscribe' && subscribedRoom) {
            this.unsub(subscribedRoom, sub);
            subscribedRoom = null;
          } else if (msg.type === 'ping') {
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'pong' } as WSBroadcast));
          }
        } catch { /* ignore parse error */ }
      });

      ws.on('close', () => {
        if (subscribedRoom) this.unsub(subscribedRoom, sub);
      });
      ws.on('error', () => {
        if (subscribedRoom) this.unsub(subscribedRoom, sub);
      });
    });
  }

  private sub(roomId: string, sub: Subscriber) {
    let set = this.rooms.get(roomId);
    if (!set) { set = new Set(); this.rooms.set(roomId, set); }
    set.add(sub);
  }
  private unsub(roomId: string, sub: Subscriber) {
    this.rooms.get(roomId)?.delete(sub);
  }

  // 对外：广播当前最新状态
  // 注意：必须按订阅者座位用 toPublicState 重建视角状态。
  // room.state 只是"某一个视角"的副本（房主或最后操作者），
  // 直接下发会导致其他座位的玩家看不到自己的手牌。
  broadcastLatest(roomId: string) {
    const room = getRoom(roomId);
    if (!room || !room.gameId) return;
    const game = getGame(room.gameId);
    if (!game) return;
    const subs = this.rooms.get(roomId);
    if (!subs || subs.size === 0) return;
    subs.forEach((s) => {
      if (!s.ws || s.ws.readyState !== 1) return;
      const viewerState = toPublicState(game, ((s.seat ?? 0) as Seat));
      s.ws.send(JSON.stringify({ type: 'state', roomId, state: viewerState } as WSBroadcast));
    });
  }

  // 对外：推送单条 snapshot（按 viewerSeat 隐藏对手手牌）
  // stepAIONCE 生成的快照 state 是 viewer-0 视角（只含座位0手牌），
  // 广播时同样按订阅者座位从 InternalGame 重建，保证每位玩家都能看到自己的手牌。
  // stepAIONCE 每次只推进一步，一步内的所有快照对应同一 game 状态，重建安全。
  broadcastSnapshot(roomId: string, snapshot: Snapshot) {
    const room = getRoom(roomId);
    if (!room || !room.gameId) return;
    const game = getGame(room.gameId);
    if (!game) return;
    const subs = this.rooms.get(roomId);
    if (!subs || subs.size === 0) return;
    subs.forEach((s) => {
      if (!s.ws || s.ws.readyState !== 1) return;
      const viewSnap: Snapshot = {
        state: toPublicState(game, ((s.seat ?? 0) as Seat)),
        event: snapshot.event,
      };
      s.ws.send(JSON.stringify({ type: 'snapshot', roomId, snapshot: viewSnap } as WSBroadcast));
    });
  }

  scheduleRoomAI(roomId: string, delayMs = 600) {
    const old = this.aiTimers.get(roomId);
    if (old) clearTimeout(old);
    const t = setTimeout(() => this.runAIStep(roomId), delayMs);
    this.aiTimers.set(roomId, t);
  }

  private runAIStep(roomId: string) {
    this.aiTimers.delete(roomId);
    const room = getRoom(roomId);
    if (!room || !room.gameId || !room.state) return;

    if (!room.aiPlayers || room.aiPlayers.length === 0) {
      try { rebuildRoomAI(roomId); } catch { /* ignore */ }
    }

    let result;
    try {
      result = stepAIONCE(room.gameId);
    } catch {
      return;
    }
    if (!result || result.snapshots.length === 0) return;

    // 同步 room.state（取最后一条快照 state）
    const finalSnap = result.snapshots[result.snapshots.length - 1];
    room.state = finalSnap.state;
    room.snapshots = (room.snapshots || []).concat(result.snapshots);

    let i = 0;
    const sendNext = () => {
      if (i >= result.snapshots.length) {
        if (!result.done) this.scheduleRoomAI(roomId, result.nextDelayMs ?? 900);
        return;
      }
      const snap = result.snapshots[i++];
      this.broadcastSnapshot(roomId, snap);
      setTimeout(sendNext, 700);
    };
    sendNext();
  }
}

export const wsService = new WSService();

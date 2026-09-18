// 前端 WebSocket 客户端：连接 /ws，订阅房间，回调接收 state/snapshot
import type { GameState, Snapshot } from '@shared/types';

export type WSStateHandler = (state: GameState) => void;
export type WSSnapshotHandler = (snapshot: Snapshot) => void;
export type WSChatHandler = (seat: number, voiceIndex: number) => void;

interface WSRoomClient {
  roomId: string;
  seat?: number;
  onState?: WSStateHandler;
  onSnapshot?: WSSnapshotHandler;
  onChat?: WSChatHandler;
  connected: boolean;
}

class GameWSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private room: WSRoomClient | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private manualClose = false;

  constructor(baseURL: string) {
    // baseURL 形如 http://host:port -> ws://host:port/ws
    try {
      const u = new URL(baseURL);
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      u.pathname = '/ws';
      this.url = u.toString();
    } catch {
      this.url = 'ws://localhost:3001/ws';
    }
  }

  subscribe(
    roomId: string,
    seat: number | undefined,
    onState: WSStateHandler,
    onSnapshot: WSSnapshotHandler,
    onChat?: WSChatHandler,
  ) {
    this.room = { roomId, seat, onState, onSnapshot, onChat, connected: false };
    this.manualClose = false;
    this.connect();
  }

  /** 发送局内快捷语音（服务器转发给房间内其他玩家；自己本地播放） */
  sendChat(voiceIndex: number) {
    this.send({ type: 'chat', voiceIndex });
  }

  unsubscribe() {
    if (this.room) {
      try {
        this.send({ type: 'unsubscribe', roomId: this.room.roomId });
      } catch { /* ignore */ }
    }
    this.room = null;
    this.manualClose = true;
    this.cleanupTimers();
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
  }

  // ============= 内部 =============
  private connect() {
    if (this.ws && this.ws.readyState <= 1) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      if (!this.room) return;
      this.room.connected = true;
      // 订阅房间
      this.send({
        type: 'subscribe',
        roomId: this.room.roomId,
        seat: this.room.seat,
      });
      // 心跳（防反向代理断连）
      this.cleanupTimers();
      this.heartbeatTimer = setInterval(() => {
        try { this.send({ type: 'ping' }); } catch { /* ignore */ }
      }, 25000);
    };
    this.ws.onmessage = (evt) => {
      if (!this.room) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'state' && msg.state) {
          this.room.onState?.(msg.state as GameState);
        } else if (msg.type === 'snapshot' && msg.snapshot) {
          this.room.onSnapshot?.(msg.snapshot as Snapshot);
        } else if (msg.type === 'chat' && typeof msg.voiceIndex === 'number') {
          this.room.onChat?.(msg.seat as number, msg.voiceIndex as number);
        }
      } catch { /* ignore */ }
    };
    this.ws.onerror = () => { /* close will follow */ };
    this.ws.onclose = () => {
      this.cleanupTimers();
      if (!this.manualClose && this.room) {
        this.scheduleReconnect();
      }
    };
  }

  private send(msg: object) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify(msg));
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1200);
  }

  private cleanupTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// 从 Vite 环境变量/当前 host 推导 baseURL
function deriveBaseURL(): string {
  // vite 代理通常 /api -> http://localhost:3001
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) {
    return (import.meta as any).env.VITE_API_BASE as string;
  }
  if (typeof window !== 'undefined') {
    // 假设 WS 和当前页面 HTTP 同源同端（真实部署时同站）
    return `${window.location.protocol}//${window.location.host}`;
  }
  return 'http://localhost:3001';
}

export const gameWS = new GameWSClient(deriveBaseURL());

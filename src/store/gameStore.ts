// 游戏状态管理（Zustand）
import { create } from 'zustand';
import type { AIEvent, Difficulty, GameMode, GameState, Play, Seat, Snapshot, Stats } from '@shared/types';
import * as api from '@/lib/api';
import type { PlayChoiceInfo } from '@/lib/api';
import * as onlineApi from '@/lib/onlineApi';
import { sound } from '@/lib/soundManager';
import { gameWS } from '@/lib/gameWS';
import { currentUsername, currentUserGender } from '@/store/userStore';

// 快照播放版本号 —— 每次开始新游戏时递增，用于取消旧的快照播放
let snapshotVersion = 0;

// 选牌分析请求序号 —— 仅最新一次选牌的分析结果生效（防止竞态旧结果覆盖）
let analyzeSeq = 0;

// 防御性手牌清洗：闷抓模式 + 尚未看牌/闷抓时，
// 若后端（或跨局残留）把任何手牌写进 state.players[*].hand，统一在前端再抹掉。
// 该逻辑仅作为"兜底第二层"，主判定在 store.toPublicState 控制序列化下发。
function scrubMenzhuaHands(state: GameState, mySeat: Seat): GameState {
  if (state.mode !== 'menzhua') return state;
  if (state.handRevealed || state.phase === 'finished') return state;
  const players = state.players.map((p) => ({ ...p, hand: undefined }));
  return { ...state, players, bottomCards: state.revealedBottom ? state.bottomCards : [] };
}
// 同左：清洗 Snapshot[] 的内部 state 引用（快照回放时）
function scrubSnapshots(snaps: Snapshot[], mySeat: Seat): Snapshot[] {
  if (!snaps || snaps.length === 0) return snaps;
  return snaps.map((s) => ({
    ...s,
    state: scrubMenzhuaHands(s.state, mySeat),
  }));
}

// 播放 AI 事件音效（'turn' 为回合切换标记，不发声）
function playEventSound(event: AIEvent, state: GameState): void {
  if (event.action === 'turn') return;
  if (event.action === 'bid') {
    const hasBid = (state.bidState?.bids ?? []).some((b) => b.bid > 0);
    sound.bid(event.seat, (event.value as number) ?? 0, hasBid);
    return;
  }
  if (event.action === 'pass') {
    sound.pass(event.seat);
    return;
  }
  if (event.action === 'play' && event.value) {
    sound.playCards(event.seat, event.value as Play);
    // 出牌后剩 1-2 张 → 报牌警示
    const count = state.players[event.seat]?.cardCount ?? 99;
    if (count > 0 && count <= 2) sound.alarm(event.seat, count);
  }
}

interface GameStore {
  // 游戏状态
  state: GameState | null;
  gameId: string | null;
  selectedCards: Set<string>; // 选中的卡牌 id
  playChoices: PlayChoiceInfo[]; // 当前选牌可构成的牌型解（癞子多解）
  chosenPlayIdx: number;       // 玩家选定的牌型解下标
  loading: boolean;
  error: string | null;
  difficulty: Difficulty;
  mode: GameMode;
  soundEnabled: boolean;
  confirmPlay: boolean;
  stats: Stats | null;
  isPlayingSnapshots: boolean;
  isDealing: boolean;          // 正在播放发牌动画
  pendingSnapshots: Snapshot[]; // 发牌动画完成后待播放的快照
  dealtGameId: string | null;  // 已播放过发牌动画的 gameId（跨组件/跨路由防重播兜底）

  // 联机对战会话
  online: boolean;
  roomId: string | null;
  mySeat: Seat;
  onlineName: string;
  wsConnected: boolean;

  // 动作
  setDifficulty: (d: Difficulty) => void;
  setMode: (m: GameMode) => void;
  toggleSound: () => void;
  toggleConfirmPlay: () => void;
  loadStats: () => Promise<void>;
  startGame: () => Promise<void>;
  finishDealing: () => void;   // 发牌动画完成
  toggleCard: (cardId: string) => void;
  clearSelection: () => void;
  selectCards: (cardIds: string[]) => void;
  choosePlay: (idx: number) => void;          // 切换癞子多解选定的牌型
  analyzeSelection: () => Promise<void>;      // 分析当前选牌的所有牌型解
  doBid: (bid: number) => Promise<void>;
  doMenzhua: (choice: 'menzhua' | 'kanpai') => Promise<void>;
  doPlay: () => Promise<void>;
  doPass: () => Promise<void>;
  doHint: () => Promise<void>;
  playSnapshots: (snapshots: Snapshot[]) => Promise<void>;
  setError: (e: string | null) => void;
  quitGame: () => void;

  // 联机会话控制
  setOnlineSession: (roomId: string, mySeat: Seat, name: string, state: GameState, snapshots?: Snapshot[] | null) => void;
  syncOnlineState: (state: GameState) => void;
  applyOnlineState: (state: GameState) => void;   // 应用联机状态并播放差异音效
  onlineDeal: () => void;                          // 联机模式下触发发牌动画
  exitOnline: () => void;

  // WebSocket 连接控制（联机模式下优先使用 WS，避免轮询）
  wsStart: () => void;
  wsStop: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  gameId: null,
  selectedCards: new Set(),
  playChoices: [],
  chosenPlayIdx: 0,
  loading: false,
  error: null,
  difficulty: 'standard',
  mode: 'classic',
  soundEnabled: true,
  confirmPlay: false,
  stats: null,
  isPlayingSnapshots: false,
  isDealing: false,
  pendingSnapshots: [],
  dealtGameId: null,

  online: false,
  roomId: null,
  mySeat: 0,
  onlineName: '',
  wsConnected: false,

  setDifficulty: (d) => set({ difficulty: d }),
  setMode: (m) => set({ mode: m }),
  toggleSound: () => {
    const next = !get().soundEnabled;
    set({ soundEnabled: next });
    sound.setEnabled(next);
  },
  toggleConfirmPlay: () => set((s) => ({ confirmPlay: !s.confirmPlay })),

  loadStats: async () => {
    try {
      // 按当前登录用户分档查询战绩
      const stats = await api.getStats(currentUsername() || undefined);
      set({ stats });
    } catch { /* 忽略 */ }
  },

  startGame: async () => {
    // 取消旧的快照播放，清除操作状态（保留旧 state/gameId 避免触发跳转）
    snapshotVersion++;
    // 防御：清除可能残留的联机会话（避免旧房间 WS/轮询覆盖单机状态、mySeat 错位）
    try { gameWS.unsubscribe(); } catch { /* ignore */ }
    set({
      loading: true,
      error: null,
      selectedCards: new Set(),
      isPlayingSnapshots: false,
      isDealing: false,
      pendingSnapshots: [],
      online: false,
      roomId: null,
      mySeat: 0,
      wsConnected: false,
    });
    try {
      const { difficulty, mode } = get();
      const res = await api.createGame(mode, difficulty, currentUsername() || undefined);
      // 每局随机分配各座位声线（自己座位固定为自选性别声线）
      sound.newGame(0, currentUserGender());
      const scrubbedState = scrubMenzhuaHands(res.state, 0);
      const scrubbedSnaps = scrubSnapshots(res.snapshots ?? [], 0);
      const gid = res.gameId;
      const alreadyDealt = get().dealtGameId === gid;
      set({
        gameId: gid,
        state: scrubbedState,
        loading: false,
        isDealing: alreadyDealt ? false : true,
        pendingSnapshots: alreadyDealt ? [] : scrubbedSnaps,
        dealtGameId: gid,
      });
    } catch (e: any) {
      set({ loading: false, error: e?.response?.data?.error || '创建对局失败' });
    }
  },

  finishDealing: () => {
    const { pendingSnapshots } = get();
    set({ isDealing: false, pendingSnapshots: [] });
    if (pendingSnapshots.length > 0) {
      // 立即设置第一个快照状态（玩家动作后、AI 动作前）
      set({ state: pendingSnapshots[0].state });
      if (pendingSnapshots.length > 1) {
        get().playSnapshots(pendingSnapshots.slice(1));
      }
    }
  },

  toggleCard: (cardId) => {
    set((s) => {
      const next = new Set(s.selectedCards);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return { selectedCards: next, playChoices: [], chosenPlayIdx: 0 };
    });
    get().analyzeSelection();
  },

  clearSelection: () => set({ selectedCards: new Set(), playChoices: [], chosenPlayIdx: 0 }),

  selectCards: (cardIds) => {
    set({ selectedCards: new Set(cardIds), playChoices: [], chosenPlayIdx: 0 });
    get().analyzeSelection();
  },

  choosePlay: (idx) => set((s) => ({ chosenPlayIdx: idx })),

  // 分析当前选牌可构成的所有牌型解（癞子多解时展示选择器）
  analyzeSelection: async () => {
    const { state, gameId, roomId, online, mySeat, selectedCards, isDealing } = get();
    if (!state || state.phase !== 'playing' || isDealing) return;
    const cards = (state.players[mySeat]?.hand || []).filter((c) => selectedCards.has(c.id));
    if (cards.length === 0) return;
    // 请求序号：仅最新一次选牌的分析结果生效（防止竞态旧结果覆盖）
    analyzeSeq += 1;
    const seq = analyzeSeq;
    const key = [...selectedCards].sort().join(',');
    try {
      const res = online && roomId
        ? await onlineApi.onlineAnalyze(roomId, cards)
        : gameId ? await api.analyzeGame(gameId, cards) : null;
      if (!res || seq !== analyzeSeq) return; // 过期响应丢弃
      const cur = get();
      const curKey = [...cur.selectedCards].sort().join(',');
      if (curKey !== key) return; // 选牌已变化，丢弃
      // 默认选中第一个「能压过」的解（领出阶段全部可选，取第一个）
      const beatsIdx = res.plays.findIndex((p) => p.beats);
      set({ playChoices: res.plays, chosenPlayIdx: beatsIdx >= 0 ? beatsIdx : 0 });
    } catch {
      // 分析失败不打断选牌（出牌时后端仍会校验）
    }
  },

  doBid: async (bid) => {
    const { gameId, roomId, online, mySeat, isPlayingSnapshots, isDealing, loading, state } = get();
    if (isPlayingSnapshots || isDealing || loading) return;

    // 联机模式：提交叫分，若后端返回 snapshots 则按节奏回放（保证 AI「思考」1.5s+）
    if (online && roomId) {
      set({ loading: true, error: null });
      try {
        const res = await onlineApi.onlineBid(roomId, bid);
        set({ loading: false });
        const snaps = res.snapshots;
        if (snaps && snaps.length > 0) {
          // 首个快照通常是自己的叫分 → 先发声再落状态（保证本地播报及时）
          playEventSound(snaps[0].event, snaps[0].state);
          set({ state: snaps[0].state });
          if (snaps.length > 1) get().playSnapshots(snaps.slice(1));
        } else if (res.state) {
          get().applyOnlineState(res.state);
        }
      } catch (e: any) {
        const errState = e?.response?.data?.state;
        if (errState) get().applyOnlineState(errState);
        set({ loading: false, error: e?.response?.data?.error || '叫分失败' });
      }
      return;
    }

    if (!gameId) return;
    const prevHighest = state?.bidState?.highestBid ?? 0;
    set({ loading: true, error: null });
    try {
      const res = await api.bidGame(gameId, bid);
      set({ loading: false });
      sound.bid(0, bid, prevHighest > 0);
      if (res.snapshots.length > 0) {
        set({ state: res.snapshots[0].state });
        if (res.snapshots.length > 1) {
          get().playSnapshots(res.snapshots.slice(1));
        }
      } else {
        set({ state: res.state });
      }
    } catch (e: any) {
      const errResp = e?.response?.data;
      if (errResp?.state) set({ state: errResp.state });
      if (errResp?.snapshots?.length > 0) {
        set({ state: errResp.snapshots[0].state });
        if (errResp.snapshots.length > 1) {
          get().playSnapshots(errResp.snapshots.slice(1));
        }
      }
      set({ loading: false, error: e?.response?.data?.error || '叫分失败' });
    }
  },

  doMenzhua: async (choice) => {
    const { gameId, roomId, online, isPlayingSnapshots, isDealing, loading } = get();
    if (isPlayingSnapshots || isDealing || loading) return;

    if (online && roomId) {
      set({ loading: true, error: null });
      try {
        const res = await onlineApi.onlineMenzhua(roomId, choice);
        set({ loading: false });
        const snaps = res.snapshots;
        if (snaps && snaps.length > 0) {
          if (snaps[0].event.action !== 'turn') {
            playEventSound(snaps[0].event, snaps[0].state);
          }
          set({ state: snaps[0].state });
          if (snaps.length > 1) get().playSnapshots(snaps.slice(1));
        } else if (res.state) {
          get().applyOnlineState(res.state);
        }
      } catch (e: any) {
        const errState = e?.response?.data?.state;
        if (errState) get().applyOnlineState(errState);
        set({ loading: false, error: e?.response?.data?.error || '闷抓操作失败' });
      }
      return;
    }

    if (!gameId) return;
    set({ loading: true, error: null });
    try {
      const res = await api.menzhuaGame(gameId, choice);
      set({ loading: false });
      if (res.snapshots.length > 0) {
        if (res.snapshots[0].event.action !== 'turn') {
          playEventSound(res.snapshots[0].event, res.snapshots[0].state);
        }
        set({ state: res.snapshots[0].state });
        if (res.snapshots.length > 1) {
          get().playSnapshots(res.snapshots.slice(1));
        }
      } else {
        set({ state: res.state });
      }
    } catch (e: any) {
      const errResp = e?.response?.data;
      if (errResp?.state) set({ state: errResp.state });
      if (errResp?.snapshots?.length > 0) {
        set({ state: errResp.snapshots[0].state });
        if (errResp.snapshots.length > 1) {
          get().playSnapshots(errResp.snapshots.slice(1));
        }
      }
      set({ loading: false, error: e?.response?.data?.error || '闷抓操作失败' });
    }
  },

  doPlay: async () => {
    const { gameId, roomId, online, mySeat, state, selectedCards, playChoices, chosenPlayIdx, isPlayingSnapshots, isDealing, loading } = get();
    if (!state || isPlayingSnapshots || isDealing || loading) return;

    // 癞子多解：玩家选定的牌型解（有解时随出牌请求提交，由后端精确匹配）
    const choice = playChoices.length > 0 ? playChoices[chosenPlayIdx] : undefined;
    const playChoice = choice ? { type: choice.type, mainRank: choice.mainRank } : undefined;

    // 联机模式
    if (online && roomId) {
      const hand = state.players[mySeat].hand || [];
      const cards = hand.filter((c) => selectedCards.has(c.id));
      if (cards.length === 0) {
        set({ error: '请先选牌' });
        return;
      }
      set({ loading: true, error: null });
      try {
        const res = await onlineApi.onlinePlay(roomId, cards, playChoice);
        set({ loading: false, selectedCards: new Set(), playChoices: [], chosenPlayIdx: 0 });
        // 立即播放"本机玩家"的出牌语音。注意：res.state 是 AI 动作执行完之后的最终状态，
        // 若本机的炸弹/王炸被两家直接 pass，一轮结束会清空 seatLastPlays（新一轮领出），
        // 最终状态里已读不到本机刚出的牌 → 炸弹/王炸完全无声。
        // 因此优先从 snapshots[0]（AI 动作前的状态）读取本机的牌。
        const preState = res.snapshots?.[0]?.state ?? res.state;
        const myPlay = preState?.seatLastPlays?.[mySeat] ?? res.state?.seatLastPlays?.[mySeat];
        if (myPlay && myPlay.cards.length > 0) {
          sound.playCards(mySeat, myPlay);
          const cnt = res.state?.players?.[mySeat]?.cardCount ?? 99;
          if (cnt > 0 && cnt <= 2) sound.alarm(mySeat, cnt);
        }
        const snaps = res.snapshots;
        if (snaps && snaps.length > 0) {
          // 首个快照通常是"对家 AI"的动作（本端玩家的动作已在上方本地播报）。
          // 若未来后端扩展：把本机动作也写入 snapshots[0]，此处会因为 seat === mySeat 而跳过，避免双响。
          const ev = snaps[0].event;
          if (ev.action !== 'turn' && ev.seat !== mySeat) {
            playEventSound(ev, snaps[0].state);
          }
          set({ state: snaps[0].state });
          if (snaps.length > 1) get().playSnapshots(snaps.slice(1));
        } else if (res.state) {
          get().applyOnlineState(res.state);
        }
      } catch (e: any) {
        const errState = e?.response?.data?.state;
        if (errState) get().applyOnlineState(errState);
        set({ loading: false, error: e?.response?.data?.error || '出牌失败' });
      }
      return;
    }

    if (!gameId) return;
    const handSP = state.players[0].hand || [];
    const cardsSP = handSP.filter((c) => selectedCards.has(c.id));
    if (cardsSP.length === 0) {
      set({ error: '请先选牌' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const res = await api.playGame(gameId, cardsSP, playChoice);
      set({ loading: false, selectedCards: new Set(), playChoices: [], chosenPlayIdx: 0 });
      // 播报"本机座位(0)刚出的牌"。注意：res.state 是 AI 动作执行完之后的最终状态，
      // 若本机的炸弹/王炸被两家 AI 直接 pass，一轮结束会清空 seatLastPlays（新一轮领出），
      // 最终状态里已读不到本机刚出的牌 → 炸弹/王炸完全无声。
      // 因此优先从 snapshots[0]（AI 动作前的状态，含本机刚出的牌）读取。
      const preState = res.snapshots?.[0]?.state ?? res.state;
      const myPlay = preState?.seatLastPlays?.[0] ?? res.state?.seatLastPlays?.[0];
      if (myPlay && myPlay.cards.length > 0) {
        sound.playCards(0, myPlay);
        const cnt = res.state?.players?.[0]?.cardCount ?? 99;
        if (cnt > 0 && cnt <= 2) sound.alarm(0, cnt);
      }
      if (res.snapshots.length > 0) {
        set({ state: res.snapshots[0].state });
        if (res.snapshots.length > 1) {
          get().playSnapshots(res.snapshots.slice(1));
        }
      } else {
        set({ state: res.state });
      }
    } catch (e: any) {
      const errResp = e?.response?.data;
      if (errResp?.state) set({ state: errResp.state });
      if (errResp?.snapshots?.length > 0) {
        set({ state: errResp.snapshots[0].state });
        if (errResp.snapshots.length > 1) {
          get().playSnapshots(errResp.snapshots.slice(1));
        }
      }
      set({ loading: false, error: e?.response?.data?.error || '出牌失败' });
    }
  },

  doPass: async () => {
    const { gameId, roomId, online, mySeat, isPlayingSnapshots, isDealing, loading } = get();
    if (isPlayingSnapshots || isDealing || loading) return;

    // 联机模式
    if (online && roomId) {
      set({ loading: true, error: null });
      try {
        const res = await onlineApi.onlinePass(roomId);
        set({ loading: false });
        // 本地先播报"本机玩家 不出"语音（res.state.lastPlay 即为刚执行的本机不出，
        // snapshots[0] 会是对家 AI 的回合动作，不再重复本机声音）
        sound.pass(mySeat);
        const snaps = res.snapshots;
        if (snaps && snaps.length > 0) {
          const ev = snaps[0].event;
          if (ev.action !== 'turn' && ev.seat !== mySeat) {
            playEventSound(ev, snaps[0].state);
          }
          set({ state: snaps[0].state });
          if (snaps.length > 1) get().playSnapshots(snaps.slice(1));
        } else if (res.state) {
          get().applyOnlineState(res.state);
        }
      } catch (e: any) {
        const errState = e?.response?.data?.state;
        if (errState) get().applyOnlineState(errState);
        set({ loading: false, error: e?.response?.data?.error || '操作失败' });
      }
      return;
    }

    if (!gameId) return;
    set({ loading: true, error: null });
    try {
      const res = await api.passGame(gameId);
      set({ loading: false });
      sound.pass(0);
      if (res.snapshots.length > 0) {
        set({ state: res.snapshots[0].state });
        if (res.snapshots.length > 1) {
          get().playSnapshots(res.snapshots.slice(1));
        }
      } else {
        set({ state: res.state });
      }
    } catch (e: any) {
      const errResp = e?.response?.data;
      if (errResp?.state) set({ state: errResp.state });
      if (errResp?.snapshots?.length > 0) {
        set({ state: errResp.snapshots[0].state });
        if (errResp.snapshots.length > 1) {
          get().playSnapshots(errResp.snapshots.slice(1));
        }
      }
      set({ loading: false, error: e?.response?.data?.error || '操作失败' });
    }
  },

  doHint: async () => {
    const { gameId, roomId, online, isPlayingSnapshots, isDealing, loading } = get();
    if (isPlayingSnapshots || isDealing || loading) return;

    // 联机模式
    if (online && roomId) {
      try {
        const res = await onlineApi.onlineHint(roomId);
        if (res.cards && res.cards.length > 0) {
          set({ selectedCards: new Set(res.cards.map((c) => c.id)) });
        } else {
          set({ error: '没有可出的牌' });
        }
      } catch {
        set({ error: '获取提示失败' });
      }
      return;
    }

    if (!gameId) return;
    try {
      const res = await api.hintGame(gameId);
      if (res.cards && res.cards.length > 0) {
        set({ selectedCards: new Set(res.cards.map((c) => c.id)) });
      } else {
        set({ error: '没有可出的牌' });
      }
    } catch {
      set({ error: '获取提示失败' });
    }
  },

  playSnapshots: async (snapshots) => {
    if (snapshots.length === 0) return;
    const version = ++snapshotVersion;
    const seat = get().mySeat;
    set({ isPlayingSnapshots: true });
    for (const snap of snapshots) {
      await new Promise((r) => setTimeout(r, snap.event.delay));
      // 版本号不匹配说明已开始新游戏，中止旧快照播放
      if (version !== snapshotVersion) return;
      set({ state: scrubMenzhuaHands(snap.state, seat) });
      // 播放该 AI 动作对应的音效
      playEventSound(snap.event, snap.state);
    }
    if (version === snapshotVersion) {
      set({ isPlayingSnapshots: false });
    }
  },

  setError: (e) => set({ error: e }),

  quitGame: () => {
    // 完整清理联机会话（含 WS 订阅、座位号）：
    // 否则退出联机后再开单机，残留的 online/roomId/mySeat 会导致
    // 旧房间 WS/轮询覆盖新对局状态、手牌按错误座位读取（梅花3 + 看不到牌）
    try { gameWS.unsubscribe(); } catch { /* ignore */ }
    set({
      state: null,
      gameId: null,
      selectedCards: new Set(),
      playChoices: [],
      chosenPlayIdx: 0,
      error: null,
      isPlayingSnapshots: false,
      isDealing: false,
      pendingSnapshots: [],
      dealtGameId: null,
      online: false,
      roomId: null,
      mySeat: 0,
      onlineName: '',
      wsConnected: false,
    });
  },

  // ===== 联机会话 =====
  setOnlineSession: (roomId, mySeat, name, state, snapshots) => {
    // 联机对局也随机分配各座位声线
    sound.newGame();
    const scrubbedState = scrubMenzhuaHands(state, mySeat);
    const scrubbedSnaps = scrubSnapshots(snapshots ?? [], mySeat);
    const gid = scrubbedState.gameId;
    const prev = get();
    const alreadyDealt = prev.dealtGameId === gid;
    set({
      online: true, roomId, mySeat, onlineName: name,
      state: scrubbedState, gameId: gid,
      error: null,
      isDealing: alreadyDealt ? false : true,
      pendingSnapshots: alreadyDealt ? [] : scrubbedSnaps,
      dealtGameId: gid,
    });
  },
  syncOnlineState: (state) => {
    const seat = get().mySeat;
    set({ state: scrubMenzhuaHands(state, seat), gameId: state.gameId });
  },
  // 应用联机状态并按前后状态差异播放对应音效（叫分 / 出牌 / 不出）
  applyOnlineState: (state) => {
    const seat = get().mySeat;
    const prev = get().state;
    const scrubbed = scrubMenzhuaHands(state, seat);
    set({ state: scrubbed, gameId: scrubbed.gameId });
    if (!prev) return;
    // 叫分语音：新增的叫分记录
    const pb = prev.bidState?.bids ?? [];
    const cb = state.bidState?.bids ?? [];
    if (cb.length > pb.length) {
      for (let i = pb.length; i < cb.length; i++) {
        const b = cb[i];
        sound.bid(b.seat, b.bid, (state.bidState?.highestBid ?? 0) > 0);
      }
    }
    // 出牌语音：按各座位最近出牌 diff（可捕获一轮内多次动作）
    for (let s = 0; s < 3; s++) {
      const pp = prev.seatLastPlays[s];
      const cp = state.seatLastPlays[s];
      if (cp && cp.cards.length > 0 && JSON.stringify(pp) !== JSON.stringify(cp)) {
        sound.playCards(s, cp);
        const cnt = state.players[s]?.cardCount ?? 99;
        if (cnt > 0 && cnt <= 2) sound.alarm(s, cnt);
      }
    }
    // 不出语音：最近一手为 pass
    const pLast = prev.lastPlay;
    const cLast = state.lastPlay;
    if (
      cLast && cLast.play.cards.length === 0 &&
      (pLast?.seat !== cLast.seat || JSON.stringify(pLast?.play ?? null) !== JSON.stringify(cLast.play))
    ) {
      sound.pass(cLast.seat);
    }
  },
  // 联机模式下触发一次发牌动画：若已经在发牌中则不清空快照（避免 setOnlineSession 传入的待播快照丢失）
  // 同一 gameId 的重复触发（路由切回、useRef 重置、轮询抖振）一律跳过，防止重播。
  onlineDeal: () => {
    const s = get();
    const gid = s.state?.gameId ?? s.gameId;
    if (gid && s.dealtGameId === gid) return;
    const alreadyDealing = s.isDealing;
    sound.newGame(s.mySeat, currentUserGender());
    if (alreadyDealing) return;
    set({ isDealing: true, pendingSnapshots: [], isPlayingSnapshots: false, dealtGameId: gid ?? s.dealtGameId });
  },
  exitOnline: () => {
    try { gameWS.unsubscribe(); } catch { /* ignore */ }
    set({
      online: false, roomId: null, mySeat: 0, onlineName: '',
      state: null, gameId: null, selectedCards: new Set(), playChoices: [], chosenPlayIdx: 0, error: null,
      isPlayingSnapshots: false, isDealing: false, pendingSnapshots: [],
      wsConnected: false, dealtGameId: null,
    });
  },

  // ===== WebSocket 联机同步 =====
  // 订阅当前 room 状态，收到后用 applyOnlineState（语音+状态） 或 playSnapshots 逐条回放
  wsStart: () => {
    const { roomId, mySeat, online } = get();
    if (!online || !roomId) return;
    gameWS.subscribe(
      roomId,
      mySeat,
      // onState：用于整体同步（首次订阅、或轮询兜底时的订正）
      (st) => {
        set({ wsConnected: true });
        const seat = get().mySeat;
        const scrubbed = scrubMenzhuaHands(st, seat);
        const prev = get().state;
        if (!prev || prev.gameId !== scrubbed.gameId) {
          // 第一次同步：直接 set state（随后会自动进入发牌动画流程）
          set({ state: scrubbed, gameId: scrubbed.gameId });
          return;
        }
        get().applyOnlineState(scrubbed);
      },
      // onSnapshot：AI 动作增量 → 逐条回放（语音+延时），保证节奏不是瞬间出牌
      (snap) => {
        set({ wsConnected: true });
        const seat = get().mySeat;
        const scrubbedSnap: Snapshot = { ...snap, state: scrubMenzhuaHands(snap.state, seat) };
        // 若当前正在发牌动画 → 先放入 pendingSnapshots，动画结束后再播放
        if (get().isDealing) {
          set((s) => ({ pendingSnapshots: [...s.pendingSnapshots, scrubbedSnap] }));
          return;
        }
        get().playSnapshots([scrubbedSnap]);
      },
    );
    set({ wsConnected: true });
  },
  wsStop: () => {
    try { gameWS.unsubscribe(); } catch { /* ignore */ }
    set({ wsConnected: false });
  },
}));

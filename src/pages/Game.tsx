// 对局页面
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, Sun, Moon, Settings, Mic, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import PlayerHand from '@/components/PlayerHand';
import PlayerSeat from '@/components/PlayerSeat';
import SeatPlayArea from '@/components/SeatPlayArea';
import SettingsPanel from '@/components/SettingsPanel';
import { useTableStyleStore, getTableBackground } from '@/store/tableStyleStore';
import BidPanel, { MenzhuaChoicePanel } from '@/components/BidPanel';
import ActionBar from '@/components/ActionBar';
import PlayChoiceBar from '@/components/PlayChoiceBar';
import MultiplierPanel from '@/components/MultiplierPanel';
import RoundConclusion from '@/components/RoundConclusion';
import AIHandStack from '@/components/AIHandStack';
import PlayingCard from '@/components/PlayingCard';
import DealingAnimation from '@/components/DealingAnimation';
import LaiziDrawAnimation from '@/components/LaiziDrawAnimation';
import SpecialPlayEffect, { type SpecialPlayEffectData } from '@/components/SpecialPlayEffect';
import CardCounter from '@/components/CardCounter';
import VoiceChatPanel from '@/components/VoiceChatPanel';
import ChatBubble from '@/components/ChatBubble';
import BottomCards from '@/components/BottomCards';
import LandlordCrown from '@/components/LandlordCrown';
import { effectForPlayedHand } from '@/lib/playEffects';
import type { Play } from '@shared/types';
import { dealKey } from '@shared/dealPresentation';
import { DealIntro, MenzhuaReveal } from '@/components/DealCeremony';
import { cn } from '@/lib/utils';
import { sound } from '@/lib/soundManager';
import * as onlineApi from '@/lib/onlineApi';
import { useDeviceStore } from '@/store/deviceStore';

// 点数 → 显示文本（11=J, 12=Q, 13=K, 14=A, 15=2）
function rankLabel(r: number): string {
  if (r === 11) return 'J';
  if (r === 12) return 'Q';
  if (r === 13) return 'K';
  if (r === 14) return 'A';
  if (r === 15) return '2';
  return String(r);
}

// 手机紧凑模式的设计基准尺寸（桌面布局的合理最小可用尺寸）
const GAME_DESIGN_W = 1200;
const GAME_DESIGN_H = 640;

export default function Game() {
  const navigate = useNavigate();
  const {
    state, gameId, selectedCards, toggleCard, isPlayingSnapshots,
    quitGame, soundEnabled, toggleSound, error, setError,
    isDealing, isDrawingWild, finishWildDraw, online, roomId, mySeat, syncOnlineState, onlineDeal,
    dealIntro, finishDealIntro, isRevealingMenzhua, finishMenzhuaReveal,
    wsConnected, wsStart, wsStop, dealtGameId,
  } = useGameStore();
  const { theme, toggleTheme } = useThemeStore();
  // 桌布风格（null = 经典翡翠，用 felt-texture 类默认背景）
  const tableStyle = useTableStyleStore((st) => st.style);
  const tableBg = getTableBackground(tableStyle, theme === 'light');
  const [showSettings, setShowSettings] = useState(false);
  const currentDealKey = state ? dealKey(state) : null;
  const [crownedGameId, setCrownedGameId] = useState<string | null>(null);
  const [bottomInFlight, setBottomInFlight] = useState<string[]>([]);
  const [bottomTransferGameId, setBottomTransferGameId] = useState<string | null>(null);
  const handleBottomTransferChange = useCallback((ids: string[]) => {
    // 记录实际起飞，等待皇冠/癞子过场时也要预先隐藏新加入手牌的三张底牌。
    if (ids.length > 0 && gameId) setBottomTransferGameId(gameId);
    setBottomInFlight(ids);
  }, [gameId]);
  const [revealedHands, setRevealedHands] = useState<{ gameId: string; seats: number[] } | null>(null);
  const revealRemainingSeat = useCallback((seat: number) => {
    if (!gameId) return;
    setRevealedHands(current => {
      const seats = current?.gameId === gameId ? current.seats : [];
      return seats.includes(seat) ? current : { gameId, seats: [...seats, seat] };
    });
  }, [gameId]);
  const hasRevealedHand = (seat: number) => state?.phase === 'finished' && revealedHands?.gameId === state.gameId && revealedHands.seats.includes(seat);
  // 局内快捷语音
  const [showChatPanel, setShowChatPanel] = useState(false);
  const seatChats = useGameStore((s) => s.seatChats);

  useEffect(() => {
    if (!gameId) navigate('/');
  }, [gameId, navigate]);

  // 进入对局：切换到游戏模式 BGM（Gaming）；再开一局时 gameId 变化，
  // 若上一局报警切入的 Exciting 仍在播放则切回 Gaming
  useEffect(() => { sound.playBgm('Gaming'); }, [gameId]);

  // 联机模式：进入联机后启动 WS 订阅；组件卸载时停止
  useEffect(() => {
    if (!online || !roomId) return;
    wsStart();
    return () => wsStop();
  }, [online, roomId, wsStart, wsStop]);

  // 联机模式：轮询同步对局状态（仅在 WS 未连上时启用，作为兜底）
  const prevOnlineGameId = useRef<string | null>(null);
  // 发牌动画已播放过的 gameId，避免同一局 gameId 空窗后恢复时重播发牌/癞子动画
  const dealtGameIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!online || !roomId || wsConnected) return;
    let alive = true;
    const tick = async () => {
      try {
        const rs = await onlineApi.fetchRoomState(roomId!);
        if (alive && rs.state) syncOnlineState(rs.state);
      } catch { /* 服务器暂时不可达，下一轮重试 */ }
    };
    tick();
    const iv = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(iv); };
  }, [online, roomId, wsConnected, syncOnlineState]);

  // 联机模式：进入新对局时播放一次发牌动画（严格按 gameId 变化；避免 isDealing 重入导致动画重播）
  useEffect(() => {
    if (!online) return;
    const gid = currentDealKey;
    if (!gid) return;
    if (prevOnlineGameId.current === gid) return;
    // 三重防重播：组件内 useRef(prev / dealt) + Zustand store.dealtGameId（跨组件/跨路由存活）
    if (dealtGameIdRef.current === gid || dealtGameId === gid) {
      prevOnlineGameId.current = gid;
      return;
    }
    prevOnlineGameId.current = gid;
    dealtGameIdRef.current = gid;
    onlineDeal();
  }, [currentDealKey, online, onlineDeal, dealtGameId]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(t);
    }
  }, [error, setError]);

  // ===== 抽取癞子动画触发（排队顺序播放：天癞/癞子 → 地癞）=====
  const [laiziDraw, setLaiziDraw] = useState<{ label: string; rank: number } | null>(null);
  const shownLaizi = useRef(new Set<string>());
  const laiziQueue = useRef<Array<{ label: string; rank: number }>>([]);
  const isAnimatingLaizi = useRef(false);

  // Effects start with the actual card-flight commit. Snapshot logs can already
  // contain later AI moves, so neither logs nor timers are a playback trigger.
  const [specialPlays, setSpecialPlays] = useState<SpecialPlayEffectData[]>([]);
  const seenSpecialPlays = useRef<Set<string>>(new Set());
  const effectGameId = useRef<string | null>(null);
  const handlePlayStart = useCallback((play: Play, seat?: number) => {
    if (!gameId || isDealing || (state?.phase !== 'playing' && state?.phase !== 'finished')) return;
    if (effectGameId.current !== gameId) {
      effectGameId.current = gameId;
      seenSpecialPlays.current.clear();
    }
    const effect = effectForPlayedHand(gameId, play, seat);
    if (!effect || seenSpecialPlays.current.has(effect.key)) return;
    seenSpecialPlays.current.add(effect.key);
    // Each hand keeps its own clock, including its eventual ×2 prompt. A new
    // player's effect must not wait for the previous player's animation to end.
    setSpecialPlays(current => [...current.filter(item => item.key.startsWith(`${gameId}:`)), effect]);
  }, [gameId, isDealing, state?.phase]);

  // 换局（gameId 变化）时清空癞子"已展示"标记 & 动画队列，保证新局癞子能正确播放
  useEffect(() => {
    const gid = state?.gameId ?? null;
    if (!gid) return;
    setBottomInFlight([]);
    shownLaizi.current = new Set();
    laiziQueue.current = [];
    isAnimatingLaizi.current = false;
    setLaiziDraw(null);
  }, [state?.gameId, state?.dealNumber]);

  // 尝试播放队列中下一个癞子动画
  const showNextLaizi = useCallback(() => {
    if (isAnimatingLaizi.current) return;
    const next = laiziQueue.current.shift();
    if (next) {
      isAnimatingLaizi.current = true;
      setLaiziDraw(next);
    }
  }, []);

  // 单个癞子动画结束回调：结束标记 + 继续下一个
  const handleLaiziDone = useCallback(() => {
    isAnimatingLaizi.current = false;
    setLaiziDraw(null);
    setTimeout(showNextLaizi, 120);
  }, [showNextLaizi]);

  // 当状态/发牌阶段变化时，依次将可展示的癞子加入队列（保证天癞/癞子 排在 地癞 前面）
  useEffect(() => {
    if (!state || dealIntro) return;
    const mainRank = state.laiziRank ?? state.tianLaiziRank;
    const mainLabel = state.tianLaiziRank ? '天癞' : (state.laiziRank ? '癞子' : null);

    // 普通癞子、癞子不洗牌的癞子和天地癞子的天癞均在发牌前揭晓。
    if (mainRank != null && mainLabel && (!isDealing || isDrawingWild)) {
      const key = `${mainLabel}-${mainRank}`;
      if (!shownLaizi.current.has(key)) {
        shownLaizi.current.add(key);
        laiziQueue.current.unshift({ label: mainLabel, rank: mainRank });
      }
    }
    // 地癞子：发牌完成 + 主癞子已入队/不存在 时入队（保证在主癞子之后）
    if (state.diLaiziRank != null && !isDealing) {
      const diKey = `地癞-${state.diLaiziRank}`;
      if (!shownLaizi.current.has(diKey)) {
        shownLaizi.current.add(diKey);
        laiziQueue.current.push({ label: '地癞', rank: state.diLaiziRank });
      }
    }
    showNextLaizi();
  }, [isDealing, isDrawingWild, dealIntro, state, showNextLaizi]);

  // 当前生效的癞子点数（癞子模式单个；天地癞子模式天+地）
  const laiziRanks = useMemo<number[]>(
    () => {
      if (state?.laiziRank) return [state.laiziRank];
      const ranks: number[] = [];
      if (state?.tianLaiziRank) ranks.push(state.tianLaiziRank);
      if (state?.diLaiziRank) ranks.push(state.diLaiziRank);
      return ranks;
    },
    [state],
  );

  // ===== 手机紧凑模式（触屏 + 逻辑高度不足，如竖屏旋转后/物理横屏的手机）=====
  // 以桌面设计尺寸 1200×640 整体等比缩放，保证桌面布局完整不挤压；
  // PC 与平板（高度充足）走原始布局，完全不受影响。
  const coarse = useDeviceStore((s) => s.coarse);
  const availW = useDeviceStore((s) => s.availW);
  const availH = useDeviceStore((s) => s.availH);
  const compact = coarse && availH < 560;
  let fitScale = 1;
  let fitX = 0;
  let fitY = 0;
  if (compact) {
    fitScale = Math.min(availW / GAME_DESIGN_W, availH / GAME_DESIGN_H);
    fitX = Math.max(0, (availW - GAME_DESIGN_W * fitScale) / 2);
    fitY = Math.max(0, (availH - GAME_DESIGN_H * fitScale) / 2);
  }

  if (!state || !gameId) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center',
        theme === 'light' ? 'bg-[#f5ecd7]' : 'bg-ink-900',
      )}>
        <div className={cn(
          'font-display text-xl animate-pulse',
          theme === 'light' ? 'text-amber-800' : 'text-gold-400',
        )}>载入对局...</div>
      </div>
    );
  }

  const player = state.players[mySeat];
  const rightSeat = ((mySeat + 1) % 3) as 0 | 1 | 2; // 下家
  const leftSeat = ((mySeat + 2) % 3) as 0 | 1 | 2;  // 上家
  const aiRight = state.players[rightSeat];
  const aiLeft = state.players[leftSeat];
  const landlord = state.players.find(p => p.role === 'landlord');
  const crownPending = !!landlord && state.phase === 'playing' && crownedGameId !== state.gameId;
  const waitingForBottomTransfer = player.role === 'landlord' && state.revealedBottom
    && state.bottomCards.length === 3 && bottomTransferGameId !== state.gameId;
  const concealedBottomCards = waitingForBottomTransfer ? state.bottomCards.map(card => card.id) : bottomInFlight;
  const isPlayerTurn = state.currentSeat === mySeat && !isPlayingSnapshots && !isDealing && !isRevealingMenzhua && bottomInFlight.length === 0 && !crownPending && !waitingForBottomTransfer;
  const isLight = theme === 'light';
  const suspendTablePlays = isDealing || crownPending || (state.phase !== 'playing' && state.phase !== 'finished');
  const bidResult = (seat: number) => !isDealing && (state.phase === 'bidding' || crownPending)
    ? (state.bidResults ?? state.bidState?.bids ?? []).find(result => result.seat === seat)?.bid : undefined;
  // 新癞子会在本次提交后的 effect 中入队，先识别它，避免皇冠在遮罩下提前播完。
  const pendingWildReveal = !!laiziDraw || isAnimatingLaizi.current || laiziQueue.current.length > 0
    || (state.laiziRank != null && !shownLaizi.current.has(`癞子-${state.laiziRank}`))
    || (state.tianLaiziRank != null && !shownLaizi.current.has(`天癞-${state.tianLaiziRank}`))
    || (state.diLaiziRank != null && !shownLaizi.current.has(`地癞-${state.diLaiziRank}`));
  // 最近一次"不出"的座位（旧状态无 seatPassed 字段时的回落判定）
  const passingSeat = state.lastPlay && state.lastPlay.play.cards.length === 0
    ? state.lastPlay.seat
    : null;
  // 各座位本轮最近动作是否为"不出"：气泡持续显示到本轮结束（避免过牌后又闪回本轮早前出过的旧牌）
  const seatIsPassing = (s: number): boolean =>
    state.seatPassed ? !!state.seatPassed[s] : passingSeat === s;

  const root = (
    <div className={cn(
      'dph-table min-h-screen flex flex-col relative overflow-hidden',
      isLight ? 'bg-[#f5ecd7]' : 'bg-ink-900',
    )}>
      {/* 顶部信息栏 */}
      <div className={cn(
        'dph-table-toolbar flex items-center justify-between px-4 py-2 z-20',
        isLight ? 'bg-amber-900/10' : '',
      )}>
        <button
          onClick={() => { quitGame(); navigate('/'); }}
          className={cn(
            'ddz-table-tool inline-flex items-center gap-1 rounded-xl px-3 py-2 border text-sm transition-all duration-200',
            isLight
              ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
              : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <MultiplierPanel multiplier={state.multiplier} />
        {(state.menzhuaDoubled || state.multiplier.menzhua) && (
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg border',
            isLight
              ? 'bg-red-100/80 border-red-400/50 text-red-700'
              : 'bg-vermilion-600/20 border-vermilion-400/40 text-vermilion-300',
          )}>
            <span className="text-xs font-body font-bold">闷抓×2</span>
          </div>
        )}
        {state.laiziRank ? (
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg border',
            isLight
              ? 'bg-red-100/80 border-red-400/50 text-red-700'
              : 'bg-vermilion-600/20 border-vermilion-400/40 text-vermilion-300',
          )}>
            <span className="text-xs font-body">癞子</span>
            <span className="font-card text-sm">{rankLabel(state.laiziRank)}</span>
          </div>
        ) : state.tianLaiziRank ? (
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-lg border text-gold-300',
              isLight
                ? 'bg-amber-100/80 border-amber-400/50 text-amber-700'
                : 'bg-gold-600/15 border-gold-400/40',
            )}>
              <span className="text-xs font-body">天癞</span>
              <span className="font-card text-sm">{rankLabel(state.tianLaiziRank)}</span>
            </div>
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-lg border',
              state.diLaiziRank
                ? (isLight ? 'bg-red-100/80 border-red-400/50 text-red-700' : 'bg-vermilion-600/20 border-vermilion-400/40 text-vermilion-300')
                : (isLight ? 'bg-white/50 border-amber-700/20 text-amber-800/50' : 'bg-ink-700/40 border-gold-600/30 text-gold-400/50'),
            )}>
              <span className="text-xs font-body">地癞</span>
              <span className="font-card text-sm">{state.diLaiziRank ? rankLabel(state.diLaiziRank) : '?'}</span>
            </div>
          </div>
        ) : null}
        <BottomCards key={state.gameId} cards={state.bottomCards}
          revealed={state.revealedBottom && !(state.mode === 'menzhua' && player.role !== 'landlord')}
          landlordSeat={state.players.find(p => p.role === 'landlord')?.seat} mySeat={mySeat}
          paused={isDealing || crownPending || pendingWildReveal}
          laiziRanks={laiziRanks} onTransferChange={handleBottomTransferChange} />
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} title="个性化" aria-label="个性化" className={cn(
            'ddz-table-tool inline-flex items-center justify-center rounded-xl px-3 py-2 border transition-all duration-200',
            isLight
              ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
              : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
          )}>
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={toggleTheme} className={cn(
            'ddz-table-tool inline-flex items-center justify-center rounded-xl px-3 py-2 border transition-all duration-200',
            isLight
              ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
              : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
          )}>
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button onClick={toggleSound} className={cn(
            'ddz-table-tool inline-flex items-center justify-center rounded-xl px-3 py-2 border transition-all duration-200',
            isLight
              ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
              : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
          )}>
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 牌桌主区域（桌布风格可切换，内联背景覆盖 felt-texture 默认色） */}
      <div
        className="dph-table-surface flex-1 felt-texture relative flex flex-col"
        style={tableBg ? { background: tableBg } : undefined}
      >
        {/* 顶部聚光灯效果 */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
          style={{
            background: isLight
              ? 'radial-gradient(ellipse at top, rgba(255,245,200,0.12), transparent 70%)'
              : 'radial-gradient(ellipse at top, rgba(255,235,180,0.08), transparent 70%)',
          }}
        />

        {/* AI 座位区 + 出牌区 */}
        <div className="flex justify-between items-start px-8 pt-4 z-10">
          {/* 上家 - 左上 */}
          <div className="flex flex-col items-center gap-1.5 relative">
            <PlayerSeat
              player={aiLeft}
              crownVisible={!crownPending}
              isCurrentTurn={state.currentSeat === leftSeat}
              position="top-left"
              thinking={isPlayingSnapshots && state.currentSeat === leftSeat}
            />
            <div data-seat-hand={leftSeat} style={{ visibility: isDealing ? 'hidden' : 'visible' }}><AIHandStack count={aiLeft.cardCount} /></div>
            {state.mingCard && state.mingCardSeat === leftSeat && (
              <div data-ming-card-seat={leftSeat} style={{ visibility: isDealing ? 'hidden' : 'visible' }} className="absolute -bottom-2 -left-2 z-20">
                <PlayingCard card={state.mingCard} size="sm" laiziRanks={laiziRanks} />
              </div>
            )}
            <SeatPlayArea
              gameId={state.gameId} seat={leftSeat}
              suspended={suspendTablePlays}
              bidResult={bidResult(leftSeat)}
              onPlayStart={handlePlayStart}
              remainingHand={hasRevealedHand(leftSeat) ? aiLeft.hand : undefined} laiziRanks={laiziRanks}
              play={state.seatLastPlays[leftSeat] ?? null}
              isPassing={seatIsPassing(leftSeat)}
              position="top"
            />
            {/* 快捷语音气泡（上家：右侧，尾巴指向说话者） */}
            <AnimatePresence>
              {seatChats[leftSeat] && (
                <ChatBubble
                  key={seatChats[leftSeat]!.key}
                  text={seatChats[leftSeat]!.text}
                  tail="left"
                  className="absolute top-2 left-full ml-2 z-30"
                />
              )}
            </AnimatePresence>
          </div>

          {/* 记牌器 */}
          {(state.mode !== 'menzhua' || (state.handRevealed && !isRevealingMenzhua)) && <CardCounter remaining={state.remainingCards} laiziRanks={laiziRanks} />}

          {/* 下家 - 右上 */}
          <div className="flex flex-col items-center gap-1.5 relative">
            <PlayerSeat
              player={aiRight}
              crownVisible={!crownPending}
              isCurrentTurn={state.currentSeat === rightSeat}
              position="top-right"
              thinking={isPlayingSnapshots && state.currentSeat === rightSeat}
            />
            <div data-seat-hand={rightSeat} style={{ visibility: isDealing ? 'hidden' : 'visible' }}><AIHandStack count={aiRight.cardCount} /></div>
            {state.mingCard && state.mingCardSeat === rightSeat && (
              <div data-ming-card-seat={rightSeat} style={{ visibility: isDealing ? 'hidden' : 'visible' }} className="absolute -bottom-2 -right-2 z-20">
                <PlayingCard card={state.mingCard} size="sm" laiziRanks={laiziRanks} />
              </div>
            )}
            <SeatPlayArea
              gameId={state.gameId} seat={rightSeat}
              suspended={suspendTablePlays}
              bidResult={bidResult(rightSeat)}
              onPlayStart={handlePlayStart}
              remainingHand={hasRevealedHand(rightSeat) ? aiRight.hand : undefined} laiziRanks={laiziRanks}
              play={state.seatLastPlays[rightSeat] ?? null}
              isPassing={seatIsPassing(rightSeat)}
              position="top"
            />
            {/* 快捷语音气泡（下家：左侧，尾巴指向说话者） */}
            <AnimatePresence>
              {seatChats[rightSeat] && (
                <ChatBubble
                  key={seatChats[rightSeat]!.key}
                  text={seatChats[rightSeat]!.text}
                  tail="right"
                  className="absolute top-2 right-full mr-2 z-30"
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 中央区域 */}
        <div className="flex-1 flex items-center justify-center">
          <div className={cn(
            'text-sm font-body opacity-30',
            isLight ? 'text-white/60' : 'text-ivory/20',
          )}>等待出牌...</div>
        </div>

        {/* 玩家出牌区 + 操作区 */}
        <div className="flex flex-col items-center gap-2 pb-2 z-30 min-h-[60px]">
          <SeatPlayArea
            gameId={state.gameId} seat={mySeat}
            suspended={suspendTablePlays}
            bidResult={bidResult(mySeat)}
            onPlayStart={handlePlayStart}
            remainingHand={hasRevealedHand(mySeat) ? player.hand : undefined} laiziRanks={laiziRanks}
            play={state.seatLastPlays[mySeat] ?? null}
            isPassing={seatIsPassing(mySeat)}
            position="bottom"
          />
          {state.phase === 'menzhuaChoice' && isPlayerTurn && <MenzhuaChoicePanel />}
          {state.phase === 'bidding' && isPlayerTurn && <BidPanel />}
          {/* 癞子多解：选牌可构成多种牌型时显示牌型选择栏（非自己回合也可预选） */}
          {state.phase === 'playing' && <PlayChoiceBar />}
          {state.phase === 'playing' && isPlayerTurn && <ActionBar />}
          {isPlayingSnapshots && (
            <div className={cn(
              'text-sm font-body animate-pulse',
              isLight ? 'text-amber-100' : 'text-gold-400/60',
            )}>
              {state.phase === 'menzhuaChoice' ? 'AI 正在选择...' : state.phase === 'bidding' ? 'AI 正在叫分...' : 'AI 正在出牌...'}
            </div>
          )}
        </div>
      </div>

      {/* 玩家手牌区 */}
      <div data-seat-hand={mySeat} className={cn(
        'dph-hand-tray backdrop-blur-sm border-t px-4 py-2 z-20 relative',
        isLight
          ? 'bg-gradient-to-b from-amber-100/80 to-amber-200/80 border-amber-700/20'
          : 'bg-ink-800/80 border-gold-600/20',
      )}>
        {state.mingCard && state.mingCardSeat === mySeat && (
          <div data-ming-card-seat={mySeat} style={{ visibility: isDealing ? 'hidden' : 'visible' }} className="absolute top-1 left-4 z-30">
            <PlayingCard card={state.mingCard} size="sm" laiziRanks={laiziRanks} />
          </div>
        )}
        {/* 我的快捷语音气泡（麦克风按钮上方） */}
        <AnimatePresence>
          {seatChats[mySeat] && (
            <ChatBubble
              key={seatChats[mySeat]!.key}
              text={seatChats[mySeat]!.text}
              tail="bottom"
              className="absolute right-3 -top-9 z-30"
            />
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-display text-sm',
              isLight ? 'text-amber-900' : 'text-gold-400',
            )}>{player.name}</span>
            {player.role === 'landlord' && (
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                isLight
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'text-vermilion-400 bg-vermilion-600/20',
              )}><Crown data-landlord-crown-target={mySeat} className="w-5 h-5 ddz-landlord-crown" style={{ visibility: crownPending ? 'hidden' : 'visible' }} />地主</span>
            )}
            {player.role === 'peasant' && (
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                isLight
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'text-felt-700 bg-felt-800/40',
              )}>农民</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 发语音入口 */}
            <button
              onClick={() => setShowChatPanel(true)}
              title="发语音"
              className={cn(
              'ddz-table-tool inline-flex items-center justify-center rounded-xl px-3 py-1.5 border transition-all duration-200',
                isLight
                  ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
                  : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
              )}
            >
              <Mic className="w-4 h-4" />
            </button>
            <span className={cn(
              'text-xs',
              isLight ? 'text-amber-800/60' : 'text-ivory/50',
            )}>{player.cardCount} 张</span>
          </div>
        </div>
        {state.mode === 'menzhua' && !state.handRevealed ? (
          <div className="flex items-center justify-center min-h-[112px]" style={{ visibility: isDealing ? 'hidden' : 'visible' }}>
            <AIHandStack count={player.cardCount} />
          </div>
        ) : (
          player.hand && (
            <PlayerHand
              hand={player.hand}
              selectedCards={selectedCards}
              onToggleCard={toggleCard}
              // 非自己回合也允许提起/放下手牌（提前选牌），仅对局结束后禁用
              disabled={isDealing || isRevealingMenzhua || state.phase === 'finished' || waitingForBottomTransfer || bottomInFlight.length > 0}
              // 从抽天癞到发牌/理牌结束都隐藏静态手牌，避免遮罩交接时透出整手牌。
              // 保留卡牌布局，发牌动画仍可测量每张牌最终落点。
              concealedCards={isDealing || isRevealingMenzhua ? player.hand.map(card => card.id) : concealedBottomCards}
              laiziRanks={laiziRanks}
            />
          )
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm shadow-card',
            isLight
              ? 'bg-red-500/90 border border-red-400 text-white'
              : 'bg-vermilion-600/90 border border-vermilion-400 text-ivory',
          )}
        >
          {error}
        </motion.div>
      )}

      {/* 结算弹窗 */}
      {crownPending && landlord && <LandlordCrown key={state.gameId} gameId={state.gameId} seat={landlord.seat}
        paused={isDealing || pendingWildReveal}
        onDone={setCrownedGameId} />}
      {state.phase === 'finished' && state.result && <RoundConclusion key={state.gameId} state={state}
        blocked={specialPlays.some(effect => effect.key.startsWith(`${state.gameId}:`))}
        onRevealSeat={revealRemainingSeat} />}

      {/* 发牌动画 */}
      <AnimatePresence>
        {/*
          key 使用 gameId + dealNumber：新局和三家不叫后的重发均重新挂载，
          让 useState<DealItem[]>(() => ...) 里发牌序列重新生成，
          避免复用上一局 state 中被污染的手牌引用 + 发牌计数错乱。
        */}
        {isDealing && !isDrawingWild && !dealIntro && state && <DealingAnimation key={dealKey(state)} />}
      </AnimatePresence>

      {/* 抽取癞子动画（癞子/天地癞子模式） */}
      <AnimatePresence onExitComplete={() => {
        // 包括癞子/天癞揭晓后的退场也播完，才挂载发牌组件并启动它的计时。
        if (isDrawingWild && !laiziDraw && !dealIntro) finishWildDraw(dealKey(state));
      }}>
        {laiziDraw && (
          <LaiziDrawAnimation
            key={`${dealKey(state)}:${laiziDraw.label}:${laiziDraw.rank}`}
            label={laiziDraw.label}
            rank={laiziDraw.rank}
            onDone={handleLaiziDone}
          />
        )}
      </AnimatePresence>

      {dealIntro && <DealIntro key={`${dealKey(state)}:${dealIntro}`} kind={dealIntro} card={state.mingCard} onDone={finishDealIntro} />}
      {isRevealingMenzhua && <MenzhuaReveal key={`${dealKey(state)}:reveal`} cards={player.hand ?? []} onDone={finishMenzhuaReveal} />}

      {/* 炸弹/王炸出牌特效 */}
      {specialPlays.filter(effect => effect.key.startsWith(`${state.gameId}:`)).map(effect =>
        <SpecialPlayEffect key={effect.key} effect={effect}
          onDone={() => setSpecialPlays(current => current.filter(item => item.key !== effect.key))} />)}

      {/* 统一游戏设置面板 */}
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      {/* 局内快捷语音面板 */}
      <VoiceChatPanel open={showChatPanel} onClose={() => setShowChatPanel(false)} />
    </div>
  );

  if (!compact) return root;

  // 紧凑模式：设计画布等比缩放居中（fixed 弹窗以 ddz-fit 为包含块，自动跟随缩放）
  return (
    <div
      className={cn('relative w-full h-full overflow-hidden', isLight ? 'bg-[#f5ecd7]' : 'bg-ink-900')}
      style={{ width: availW, height: availH }}
    >
      <div
        className="ddz-fit absolute overflow-hidden"
        style={{
          width: GAME_DESIGN_W,
          height: GAME_DESIGN_H,
          left: fitX,
          top: fitY,
          transform: `scale(${fitScale})`,
          transformOrigin: 'top left',
        }}
      >
        {root}
      </div>
    </div>
  );
}

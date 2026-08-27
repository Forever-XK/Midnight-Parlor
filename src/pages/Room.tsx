// 对战房间 —— 等待玩家、房主开战、人数不足由 AI 补位
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Crown, User, Play, Swords, Shuffle, Dices, Zap } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import * as onlineApi from '@/lib/onlineApi';
import { useUserStore } from '@/store/userStore';
import { sound } from '@/lib/soundManager';
import { cn } from '@/lib/utils';
import type { GameMode, GameState, Seat } from '@shared/types';

const MODE_ICON: Record<GameMode, typeof Swords> = {
  classic: Swords, unshuffled: Shuffle, laizi: Dices, tiandilaizi: Crown, menzhua: Zap,
};
const MODE_NAME: Record<GameMode, string> = {
  classic: '经典模式', unshuffled: '不洗牌', laizi: '癞子模式', tiandilaizi: '天地癞子', menzhua: '闷抓斗地主',
};

export default function Room() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const isLight = useThemeStore((s) => s.theme === 'light');
  const setOnlineSession = useGameStore((s) => s.setOnlineSession);

  const [room, setRoom] = useState<onlineApi.RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const navigated = useRef(false);

  const myName = useGameStore((s) => s.onlineName) || useUserStore.getState().username || onlineApi.getPlayerName();

  // 轮询房间状态
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const rs = await onlineApi.fetchRoomState(roomId);
        if (!alive) return;
        setRoom(rs);
        setError(null);
        // 对局已开始 → 进入对局页
        if (rs.status === 'playing' && rs.state && !navigated.current) {
          navigated.current = true;
          const mySeat = (rs.mySeat ?? 0) as Seat;
          setOnlineSession(rs.roomId, mySeat, rs.players[mySeat]?.name ?? myName, rs.state);
          navigate('/game');
        }
      } catch {
        if (alive) setError('无法连接服务器');
      }
    };
    tick();
    const iv = setInterval(tick, 1200);
    return () => { alive = false; clearInterval(iv); };
  }, [roomId, navigate, setOnlineSession, myName]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await onlineApi.startRoom(roomId);
      const mySeat = (room?.mySeat ?? 0) as Seat;
      const myNameHere = room?.players[mySeat]?.name ?? myName;
      navigated.current = true;
      setOnlineSession(roomId, mySeat, myNameHere, res.state as GameState, res.snapshots);
      navigate('/game');
    } catch (e: any) {
      setError(e?.response?.data?.error || '开始失败');
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    try { await onlineApi.leaveRoom(roomId); } catch { /* 忽略 */ }
    navigate('/lobby');
  };

  if (!room) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center',
        isLight ? 'bg-[#f5ecd7]' : 'bg-ink-900',
      )}>
        <div className={cn(
          'font-main text-xl animate-pulse',
          isLight ? 'text-amber-800' : 'text-gold-400',
        )}>载入房间...</div>
      </div>
    );
  }

  const isHost = room.hostId === onlineApi.getClientId();
  const ModeIcon = MODE_ICON[room.mode];

  return (
    <div className={cn(
      'min-h-screen relative overflow-hidden',
      isLight ? 'bg-[#f5ecd7]' : 'bg-ink-900',
    )}>
      <div
        className="absolute inset-0"
        style={isLight ? {
          background: 'radial-gradient(ellipse at 50% 0%, #f0dfb0 0%, #e8d4a8 40%, #ddc690 100%)',
        } : {
          background: 'radial-gradient(ellipse at 50% 0%, #13293d 0%, #0d1b2a 40%, #0a0f1a 100%)',
        }}
      />
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-8">
        {/* 顶部 */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handleLeave}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl px-3 py-2 border text-sm transition-all duration-200',
              isLight
                ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
                : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
            )}
          >
            <ArrowLeft className="w-4 h-4" /> 离开房间
          </button>
          <div className={cn(
            'font-main text-2xl',
            isLight ? 'text-amber-800' : 'text-gold-gradient text-shadow-gold',
          )}>对战房间</div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm">
            <ModeIcon className={cn('w-4 h-4', isLight ? 'text-amber-700' : 'text-gold-400')} />
            <span className={cn('font-main', isLight ? 'text-amber-800' : 'text-gold-300')}>
              {MODE_NAME[room.mode]}
            </span>
          </div>
        </div>

        {/* 座位区 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          {[0, 1, 2].map((seat) => {
            const p = room.players[seat];
            const isMe = seat === room.mySeat;
            return (
              <div
                key={seat}
                className={cn(
                  'rounded-2xl border p-5 flex flex-col items-center gap-2',
                  isLight
                    ? (isMe ? 'bg-amber-500/20 border-amber-500' : 'bg-white/70 border-amber-700/20')
                    : (isMe ? 'bg-gold-500/20 border-gold-400' : 'glass-panel'),
                )}
              >
                <div className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center font-main text-xl text-white shadow-card border-2 border-gold-500/40',
                  p
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    : (isLight ? 'bg-amber-900/20 border-amber-700/30' : 'bg-ink-700/50 border-gold-600/30'),
                )}>
                  {p ? p.name.charAt(0) : '?'}
                </div>
                <div className={cn(
                  'text-sm font-body',
                  isLight ? (p ? 'text-amber-900' : 'text-amber-800/40') : (p ? 'text-ivory' : 'text-ivory/40'),
                )}>
                  {p ? p.name : '等待加入'}
                </div>
                {p && (
                  <div className="flex items-center gap-1.5">
                    {p.isHost && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full border flex items-center gap-1',
                        isLight ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-gold-600/15 text-gold-300 border-gold-500/40',
                      )}>
                        <Crown className="w-3 h-3" /> 房主
                      </span>
                    )}
                    {isMe && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        isLight ? 'bg-amber-200 text-amber-800' : 'bg-gold-600/20 text-gold-300',
                      )}>我</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>

        {/* 提示 */}
        <div className={cn(
          'text-center text-sm mb-6',
          isLight ? 'text-amber-800/60' : 'text-ivory/60',
        )}>
          <User className="inline w-4 h-4 mr-1.5" />
          人数不足 3 人时将自动由 AI 补位（AI 难度：{room.difficulty}）
        </div>

        {error && (
          <div className={cn(
            'mb-4 px-4 py-2 rounded-xl text-sm text-center border',
            isLight ? 'bg-red-100 text-red-700 border-red-300' : 'bg-vermilion-600/20 text-vermilion-300 border-vermilion-400/40',
          )}>
            {error}
          </div>
        )}

        {/* 开始按钮（仅房主） */}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={starting}
            className="btn-gold !font-main !text-xl w-full"
          >
            <Play className="w-5 h-5" /> {starting ? '开始中...' : '开始对战'}
          </button>
        ) : (
          <div className={cn(
            'text-center text-sm py-4',
            isLight ? 'text-amber-800/50' : 'text-ivory/40',
          )}>
            等待房主开始对战...
          </div>
        )}
      </div>
    </div>
  );
}
// 联机大厅 —— 自定义昵称、创建/加入房间
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, User, Users, Swords, Shuffle, Dices, Crown, Zap } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import { useUserStore } from '@/store/userStore';
import * as onlineApi from '@/lib/onlineApi';
import { sound } from '@/lib/soundManager';
import { cn } from '@/lib/utils';
import type { GameMode, Difficulty } from '@shared/types';

const MODES: { id: GameMode; name: string; icon: typeof Swords }[] = [
  { id: 'classic', name: '经典模式', icon: Swords },
  { id: 'unshuffled', name: '不洗牌', icon: Shuffle },
  { id: 'laizi', name: '癞子模式', icon: Dices },
  { id: 'tiandilaizi', name: '天地癞子', icon: Crown },
  { id: 'menzhua', name: '闷抓斗地主', icon: Zap },
];

const DIFFS: { id: Difficulty; name: string }[] = [
  { id: 'casual', name: '休闲' },
  { id: 'standard', name: '标准' },
  { id: 'master', name: '高手' },
];

export default function Lobby() {
  const navigate = useNavigate();
  const isLight = useThemeStore((s) => s.theme === 'light');
  const { mode, difficulty, setMode, setDifficulty } = useGameStore();

  // 沿用主界面设定的用户名（localStorage 记忆值仅作兜底）
  const userStoreName = useUserStore((s) => s.username);
  const [name, setName] = useState(userStoreName || onlineApi.getPlayerName());
  const [rooms, setRooms] = useState<onlineApi.RoomListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { sound.playBgm('Welcome'); }, []);

  const fetchRooms = async () => {
    try {
      const list = await onlineApi.listRooms();
      setRooms(list);
    } catch {
      setError('无法连接服务器，请确认后端已启动');
    }
  };

  useEffect(() => {
    fetchRooms();
    const iv = setInterval(fetchRooms, 3000);
    return () => clearInterval(iv);
  }, []);

  const myName = name.trim() || '玩家';

  const handleCreate = async () => {
    onlineApi.setPlayerName(myName);
    setBusy(true);
    setError(null);
    try {
      const roomId = await onlineApi.createRoom(mode, difficulty, myName);
      navigate(`/room/${roomId}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || '创建房间失败');
      setBusy(false);
    }
  };

  const handleJoin = async (roomId: string) => {
    onlineApi.setPlayerName(myName);
    setBusy(true);
    setError(null);
    try {
      await onlineApi.joinRoom(roomId, myName);
      navigate(`/room/${roomId}`);
    } catch (e: any) {
      setError(e?.response?.data?.error || '加入房间失败');
      setBusy(false);
    }
  };

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
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-6">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className={cn(
              'inline-flex items-center gap-1 rounded-xl px-3 py-2 border text-sm transition-all duration-200',
              isLight
                ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
                : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
            )}
          >
            <ArrowLeft className="w-4 h-4" /> 返回
          </button>
          <div className={cn(
            'font-main text-2xl',
            isLight ? 'text-amber-800' : 'text-gold-gradient text-shadow-gold',
          )}>在线对战</div>
          <div className="w-20" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'rounded-2xl border p-5 mb-6',
            isLight ? 'bg-white/70 border-amber-700/20' : 'glass-panel',
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <User className={cn('w-5 h-5', isLight ? 'text-amber-700' : 'text-gold-400')} />
            <span className={cn('font-main text-lg', isLight ? 'text-amber-800' : 'text-gold-300')}>昵称</span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            placeholder="输入你的昵称"
            className={cn(
              'w-full px-4 py-2 rounded-xl border outline-none font-body text-sm transition-colors',
              isLight
                ? 'bg-white border-amber-700/30 text-amber-900 placeholder-amber-800/40 focus:border-amber-500'
                : 'bg-ink-700/60 border-gold-600/30 text-ivory placeholder-ivory/40 focus:border-gold-400',
            )}
          />

          {/* 模式 / 难度 */}
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <div className={cn('text-xs mb-2', isLight ? 'text-amber-800/60' : 'text-gold-500/70')}>玩法模式</div>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all duration-200',
                      isLight ? (
                        mode === m.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-800'
                          : 'bg-white/60 border-amber-700/20 text-amber-900/70 hover:border-amber-600/40'
                      ) : (
                        mode === m.id
                          ? 'bg-gold-500/20 border-gold-400 text-gold-300'
                          : 'bg-ink-700/40 border-gold-600/30 text-ivory/70 hover:border-gold-500/40'
                      ),
                    )}
                  >
                    <m.icon className="w-4 h-4 shrink-0" />
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className={cn('text-xs mb-2', isLight ? 'text-amber-800/60' : 'text-gold-500/70')}>AI 难度（人数不足时）</div>
              <div className="grid grid-cols-3 gap-2">
                {DIFFS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={cn(
                      'px-3 py-2 rounded-xl border text-sm transition-all duration-200',
                      isLight ? (
                        difficulty === d.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-800'
                          : 'bg-white/60 border-amber-700/20 text-amber-900/70 hover:border-amber-600/40'
                      ) : (
                        difficulty === d.id
                          ? 'bg-gold-500/20 border-gold-400 text-gold-300'
                          : 'bg-ink-700/40 border-gold-600/30 text-ivory/70 hover:border-gold-500/40'
                      ),
                    )}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className={cn(
              'mt-3 px-4 py-2 rounded-xl text-sm border',
              isLight ? 'bg-red-100 text-red-700 border-red-300' : 'bg-vermilion-600/20 text-vermilion-300 border-vermilion-400/40',
            )}>
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={busy}
            className="btn-gold !font-main !text-lg w-full mt-4"
          >
            <Plus className="w-5 h-5" /> 创建房间
          </button>
        </motion.div>

        {/* 房间列表 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            'rounded-2xl border p-5',
            isLight ? 'bg-white/70 border-amber-700/20' : 'glass-panel',
          )}
        >
          <div className="flex items-center gap-2 justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className={cn('w-5 h-5', isLight ? 'text-amber-700' : 'text-gold-400')} />
              <span className={cn('font-main text-lg', isLight ? 'text-amber-800' : 'text-gold-300')}>等待中的房间</span>
            </div>
            <span className={cn('text-xs', isLight ? 'text-amber-800/50' : 'text-ivory/40')}>每 3 秒自动刷新</span>
          </div>

          {rooms.length === 0 ? (
            <div className={cn(
              'text-sm py-8 text-center',
              isLight ? 'text-amber-800/40' : 'text-ivory/30',
            )}>
              暂无房间，创建一个开始吧！
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((r) => (
                <div
                  key={r.roomId}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200',
                    isLight
                      ? 'bg-white/70 border-amber-700/20 hover:border-amber-600/40'
                      : 'bg-ink-800/50 border-gold-600/25 hover:border-gold-500/40',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'font-main text-base truncate',
                      isLight ? 'text-amber-900' : 'text-ivory',
                    )}>
                      {r.hostName}
                      <span className={cn('text-xs ml-2', isLight ? 'text-amber-800/50' : 'text-gold-500/60')}>房主</span>
                    </div>
                    <div className={cn(
                      'text-xs truncate',
                      isLight ? 'text-amber-800/60' : 'text-ivory/50',
                    )}>
                      {MODES.find((m) => m.id === r.mode)?.name ?? r.mode} · {r.playerCount}/3 · {r.playerNames.join('、')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoin(r.roomId)}
                    disabled={busy}
                    className="btn-gold !font-main !text-sm !px-5 !py-2"
                  >
                    加入
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
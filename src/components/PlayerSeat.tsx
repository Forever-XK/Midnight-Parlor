// AI 玩家座位组件（头像、昵称、剩余牌数、角色标识）
import { motion } from 'framer-motion';
import { Crown, Sprout } from 'lucide-react';
import type { PlayerPublic } from '@shared/types';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/themeStore';

interface PlayerSeatProps {
  player: PlayerPublic;
  isCurrentTurn: boolean;
  position: 'top-left' | 'top-right' | 'bottom';
  lastAction?: string;
  thinking?: boolean;
}

const AVATAR_COLORS = [
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
];

function Avatar({ seat, name }: { seat: number; name: string }) {
  const color = AVATAR_COLORS[seat % AVATAR_COLORS.length];
  return (
    <div className={cn('w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center font-display text-xl text-white shadow-card border-2 border-gold-500/40', color)}>
      {name.charAt(0)}
    </div>
  );
}

export default function PlayerSeat({ player, isCurrentTurn, position, lastAction, thinking }: PlayerSeatProps) {
  const isLandlord = player.role === 'landlord';
  const isLight = useThemeStore(s => s.theme === 'light');

  return (
    <div className={cn('flex flex-col items-center gap-1', position === 'bottom' && 'hidden')}>
      {/* 头像区 */}
      <div className="relative">
        <motion.div
          animate={isCurrentTurn ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={{ duration: 1.5, repeat: isCurrentTurn ? Infinity : 0 }}
          className={cn(
            'relative rounded-full p-0.5',
            isCurrentTurn && (isLight
              ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700'
              : 'bg-gradient-to-br from-gold-300 via-gold-500 to-gold-600 animate-breathe'),
          )}
        >
          <Avatar seat={player.seat} name={player.name} />
          {/* 角色标识 */}
          {isLandlord && (
            <div className={cn(
              'absolute -top-3 -right-1 rounded-full p-1 shadow-card border',
              isLight
                ? 'bg-red-500 border-red-300'
                : 'bg-vermilion-500 border-gold-400',
            )}>
              <Crown className={cn('w-3.5 h-3.5', isLight ? 'text-white' : 'text-gold-300')} />
            </div>
          )}
          {!isLandlord && player.role && (
            <div className={cn(
              'absolute -top-3 -right-1 rounded-full p-1 shadow-card border',
              isLight
                ? 'bg-green-600 border-green-400'
                : 'bg-felt-700 border-gold-500/40',
            )}>
              <Sprout className={cn('w-3.5 h-3.5', isLight ? 'text-white' : 'text-gold-300')} />
            </div>
          )}
        </motion.div>
        {/* 思考中指示 */}
        {thinking && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap',
              isLight ? 'text-amber-800' : 'text-gold-400',
            )}
          >
            <span className="animate-pulse">思考中...</span>
          </motion.div>
        )}
      </div>

      {/* 昵称 */}
      <div className={cn(
        'text-sm font-body',
        isLight ? 'text-white text-shadow-dark' : 'text-ivory/90 text-shadow-dark',
      )}>{player.name}</div>

      {/* 剩余牌数 */}
      <div className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full border',
        isLight
          ? 'bg-white/70 border-amber-700/20'
          : 'bg-ink-700/70 border-gold-600/30',
      )}>
        <span className={cn(
          'font-display text-sm',
          isLight ? 'text-amber-800' : 'text-gold-400',
        )}>{player.cardCount}</span>
        <span className={cn(
          'text-xs',
          isLight ? 'text-amber-700/60' : 'text-ivory/50',
        )}>张</span>
      </div>

      {/* 最近动作气泡 */}
      {lastAction && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn(
            'mt-1 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap shadow-card border',
            isLight
              ? 'bg-white/80 border-amber-500/30 text-amber-800'
              : 'bg-ink-600/90 border-gold-500/30 text-gold-300',
          )}
        >
          {lastAction}
        </motion.div>
      )}
    </div>
  );
}

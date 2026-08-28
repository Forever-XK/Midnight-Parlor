// 游戏结算弹窗
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Skull, Home, Crown, Sprout } from 'lucide-react';
import type { GameState } from '@shared/types';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';
import { sound } from '@/lib/soundManager';
import { sortCardsDesc } from '@/lib/cards';
import PlayingCard from './PlayingCard';

interface ResultModalProps {
  state: GameState;
}

// 从状态推导当前生效的癞子点数列表（癞子/天地癞子模式）
function laiziRanksOf(state: GameState): number[] {
  if (state.laiziRank) return [state.laiziRank];
  const ranks: number[] = [];
  if (state.tianLaiziRank) ranks.push(state.tianLaiziRank);
  if (state.diLaiziRank) ranks.push(state.diLaiziRank);
  return ranks;
}

export default function ResultModal({ state }: ResultModalProps) {
  const navigate = useNavigate();
  const { mySeat, online, exitOnline, quitGame } = useGameStore();
  const isLight = useThemeStore(s => s.theme === 'light');

  const isFinished = state.phase === 'finished' && !!state.result;
  const playerRole = state.players[mySeat].role;
  const playerWon =
    (playerRole === 'landlord' && state.result?.winner === 'landlord') ||
    (playerRole === 'peasant' && state.result?.winner === 'peasant');
  const playerScore = state.result?.scores[mySeat] ?? 0;

  const handleExit = () => {
    if (online) { exitOnline(); navigate('/lobby'); }
    else { quitGame(); navigate('/'); }
  };

  useEffect(() => {
    if (!isFinished) return;
    if (playerWon) sound.win();
    else sound.lose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  if (!isFinished) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm',
          isLight ? 'bg-amber-900/30' : 'bg-ink-900/80',
        )}
      >
        <motion.div
          initial={{ scale: 0.85, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className={cn(
            'relative px-10 py-8 max-w-2xl w-full mx-4 max-h-[90%] overflow-y-auto text-center rounded-2xl border',
            isLight ? (
              playerWon
                ? 'bg-gradient-to-br from-green-50/95 via-emerald-50/95 to-green-100/95 border-green-300/50 shadow-xl'
                : 'bg-gradient-to-br from-red-50/95 via-rose-50/95 to-red-100/95 border-red-300/50 shadow-xl'
            ) : ({
              background: playerWon
                ? 'linear-gradient(160deg, rgba(15,96,72,0.9), rgba(10,77,58,0.9), rgba(6,51,38,0.95))'
                : 'linear-gradient(160deg, rgba(50,20,20,0.9), rgba(30,15,15,0.9), rgba(15,10,10,0.95))',
              borderColor: playerWon ? 'rgba(212,175,55,0.5)' : 'rgba(200,16,46,0.4)',
            }),
          )}
          style={!isLight ? {
            background: playerWon
              ? 'linear-gradient(160deg, rgba(15,96,72,0.9), rgba(10,77,58,0.9), rgba(6,51,38,0.95))'
              : 'linear-gradient(160deg, rgba(50,20,20,0.9), rgba(30,15,15,0.9), rgba(15,10,10,0.95))',
            borderColor: playerWon ? 'rgba(212,175,55,0.5)' : 'rgba(200,16,46,0.4)',
          } : undefined}
        >
          {/* 胜负图标 */}
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="mx-auto mb-3 w-16 h-16 rounded-full flex items-center justify-center"
            style={isLight ? {
              background: playerWon
                ? 'radial-gradient(circle, rgba(212,175,55,0.3), transparent)'
                : 'radial-gradient(circle, rgba(200,16,46,0.2), transparent)',
            } : {
              background: playerWon
                ? 'radial-gradient(circle, rgba(212,175,55,0.4), transparent)'
                : 'radial-gradient(circle, rgba(200,16,46,0.3), transparent)',
            }}
          >
            {playerWon ? (
              <Trophy className={cn('w-10 h-10', isLight ? 'text-amber-600' : 'text-gold-400')} />
            ) : (
              <Skull className={cn('w-10 h-10', isLight ? 'text-red-500' : 'text-vermilion-400')} />
            )}
          </motion.div>

          {/* 胜负文字 */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              'font-display text-5xl mb-2',
              isLight ? (playerWon ? 'text-green-700' : 'text-red-600') : (playerWon ? 'text-gold-gradient text-shadow-gold' : 'text-vermilion-400'),
            )}
          >
            {playerWon ? '胜利' : '失败'}
          </motion.h2>

          {/* 身份标识 */}
          <div className={cn(
            'flex items-center justify-center gap-2 mb-4 text-sm',
            isLight ? 'text-amber-800/70' : 'text-ivory/70',
          )}>
            {playerRole === 'landlord' ? (
              <>
                <Crown className={cn('w-4 h-4', isLight ? 'text-amber-600' : 'text-gold-400')} />
                <span>地主</span>
              </>
            ) : (
              <>
                <Sprout className={cn('w-4 h-4', isLight ? 'text-green-600' : 'text-felt-700')} />
                <span>农民</span>
              </>
            )}
            <span className={isLight ? 'text-amber-800/40' : 'text-ivory/40'}>·</span>
            <span>{state.result.winner === 'landlord' ? '地主获胜' : '农民获胜'}</span>
          </div>

          {/* 得分明细 */}
          <div className={cn(
            'rounded-xl p-4 mb-5 space-y-1.5',
            isLight ? 'bg-white/60' : 'bg-ink-900/50',
          )}>
            <div className="flex justify-between items-center text-sm">
              <span className={cn(isLight ? 'text-amber-900/60' : 'text-ivory/60')}>底分 × 叫分 × 炸弹 × 春天</span>
              <span className={cn('font-main', isLight ? 'text-amber-800' : 'text-gold-400')}>{state.multiplier.total}</span>
            </div>
            <div className={cn(
              'border-t pt-2 flex justify-between items-center',
              isLight ? 'border-amber-700/20' : 'border-gold-600/20',
            )}>
              <span className={cn('text-sm', isLight ? 'text-amber-900/70' : 'text-ivory/70')}>你的得分</span>
              <span className={cn(
                'font-display text-2xl',
                playerScore > 0 ? (isLight ? 'text-green-600' : 'text-gold-400') : (isLight ? 'text-red-500' : 'text-vermilion-400'),
              )}>
                {playerScore > 0 ? '+' : ''}{playerScore}
              </span>
            </div>
          </div>

          {/* 剩余手牌 */}
          <div className={cn(
            'rounded-xl p-4 mb-5 text-left',
            isLight ? 'bg-white/60' : 'bg-ink-900/50',
          )}>
            <div className={cn(
              'text-xs mb-2 font-main',
              isLight ? 'text-amber-900/60' : 'text-ivory/60',
            )}>
              剩余手牌
            </div>
            <div className="space-y-3">
              {state.players.map((p) => {
                const hand = p.hand ? sortCardsDesc(p.hand, laiziRanksOf(state)) : [];
                return (
                  <div key={p.seat} className="flex items-start gap-3">
                    {/* 玩家信息 */}
                    <div className="w-24 shrink-0 pt-0.5">
                      <div className={cn(
                        'text-sm font-main truncate',
                        isLight ? 'text-amber-900' : 'text-ivory',
                      )}>
                        {p.name}
                      </div>
                      <div className={cn(
                        'text-xs flex items-center gap-1 mt-0.5',
                        isLight ? 'text-amber-800/60' : 'text-ivory/50',
                      )}>
                        {p.role === 'landlord' ? (
                          <><Crown className="w-3 h-3" />地主</>
                        ) : (
                          <><Sprout className="w-3 h-3" />农民</>
                        )}
                      </div>
                    </div>
                    {/* 手牌 */}
                    <div className="flex-1 flex flex-wrap gap-1 items-start min-h-[68px]">
                      {hand.length > 0 ? (
                        hand.map((c) => (
                          <PlayingCard key={c.id} card={c} size="sm" laiziRanks={laiziRanksOf(state)} />
                        ))
                      ) : (
                        <span className={cn(
                          'text-sm py-2',
                          isLight ? 'text-amber-800/40' : 'text-ivory/30',
                        )}>
                          已出完
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleExit}
              className="btn-gold"
            >
              <Home className="w-5 h-5" />
              返回大厅
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

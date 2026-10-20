// 局内快捷语音面板 —— 列出全部可选语音（展示语音内容），点击即发送
// 发送后：自己声线播放 + 座位气泡；联机模式同时广播给房间内其他玩家
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic } from 'lucide-react';
import { CHAT_VOICES } from '@/lib/chatVoices';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';

interface VoiceChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function VoiceChatPanel({ open, onClose }: VoiceChatPanelProps) {
  const isLight = useThemeStore((s) => s.theme === 'light');
  const sendChat = useGameStore((s) => s.sendChat);
  const chatCooldownUntil = useGameStore((s) => s.chatCooldownUntil);
  // 冷却倒计时刷新（250ms 粒度足够）
  const [, tick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const remain = Math.max(0, chatCooldownUntil - Date.now());

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="chat-overlay"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key="chat-panel"
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 12, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className={cn(
              'w-full max-w-md max-h-[85%] overflow-y-auto rounded-2xl border shadow-2xl',
              isLight ? 'bg-amber-50/95 border-amber-700/30' : 'bg-ink-800/95 border-gold-600/40',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题 */}
            <div className={cn(
              'flex items-center justify-between px-5 py-3.5 border-b',
              isLight ? 'border-amber-700/20' : 'border-gold-600/20',
            )}>
              <div className="flex items-center gap-2">
                <Mic className={cn('w-5 h-5', isLight ? 'text-amber-700' : 'text-gold-400')} />
                <span className={cn('font-display text-lg', isLight ? 'text-amber-900' : 'text-gold-300')}>
                  发语音
                </span>
                {remain > 0 && (
                  <span className={cn(
                    'text-xs font-body px-2 py-0.5 rounded-full',
                    isLight ? 'bg-amber-200/60 text-amber-700' : 'bg-gold-600/15 text-gold-400/80',
                  )}>
                    {Math.ceil(remain / 1000)}s
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isLight ? 'hover:bg-amber-200/60 text-amber-800' : 'hover:bg-ink-600/60 text-ivory/70',
                )}
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 语音列表：展示每条语音的内容 */}
            <div className="p-3 grid grid-cols-1 gap-2">
              {CHAT_VOICES.map((v) => {
                const disabled = remain > 0;
                return (
                  <button
                    key={v.index}
                    disabled={disabled}
                    onClick={() => {
                      sendChat(v.index);
                      onClose();
                    }}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all duration-150',
                      disabled
                        ? (isLight
                          ? 'opacity-40 cursor-not-allowed border-amber-700/15 bg-amber-100/40 text-amber-800/50'
                          : 'opacity-40 cursor-not-allowed border-gold-600/15 bg-ink-600/30 text-ivory/40')
                        : (isLight
                          ? 'border-amber-700/25 bg-white/60 hover:bg-amber-100/70 hover:border-amber-600/50 text-amber-900'
                          : 'border-gold-600/30 bg-ink-600/40 hover:bg-ink-600/70 hover:border-gold-500/60 text-ivory/90 hover:-translate-y-0.5'),
                    )}
                  >
                    <Mic className={cn('w-4 h-4 shrink-0', isLight ? 'text-amber-600' : 'text-gold-400/80')} />
                    <span className="font-body text-sm leading-snug">{v.text}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

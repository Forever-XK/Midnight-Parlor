// 聊天气泡 —— 局内快捷语音发出后显示在对应座位旁（4 秒自动消失，由 gameStore 管理）
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/themeStore';

interface ChatBubbleProps {
  text: string;
  /** 尾巴方向（指向说话者）：left=尾巴在左侧，right=右侧，bottom=下方 */
  tail?: 'left' | 'right' | 'bottom';
  /** 定位类（绝对定位到对应座位旁；同时作为 AnimatePresence 直接子元素获得退场动画） */
  className?: string;
}

export default function ChatBubble({ text, tail = 'bottom', className }: ChatBubbleProps) {
  const isLight = useThemeStore((s) => s.theme === 'light');
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={cn(
        'relative px-3 py-1.5 rounded-xl border max-w-[200px] shadow-card whitespace-normal break-words',
        isLight
          ? 'bg-ivory/95 border-gold-500/60'
          : 'bg-ivory/90 border-gold-500/50',
        className,
      )}
    >
      {/* 尾巴（小三角） */}
      <div
        className={cn(
          'absolute w-2.5 h-2.5 rotate-45',
          isLight ? 'bg-ivory/95 border-gold-500/60' : 'bg-ivory/90 border-gold-500/50',
          tail === 'left' && '-left-1 top-3 border-r border-t',
          tail === 'right' && '-right-1 top-3 border-l border-t',
          tail === 'bottom' && '-bottom-1 left-4 border-l border-b',
        )}
      />
      <span className="relative font-main text-sm text-ink-800 leading-snug">{text}</span>
    </motion.div>
  );
}

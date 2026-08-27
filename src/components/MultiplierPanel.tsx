// 倍数面板组件
import { Bomb, Rocket, Flower2, Sparkles, Zap } from 'lucide-react';
import type { Multiplier } from '@shared/types';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/themeStore';

interface MultiplierPanelProps {
  multiplier: Multiplier;
}

export default function MultiplierPanel({ multiplier }: MultiplierPanelProps) {
  const { base, bid, bombs, spring, antiSpring, menzhua, total } = multiplier;
  const isLight = useThemeStore(s => s.theme === 'light');

  const items = [
    { label: '底分', value: base, active: true },
    { label: '叫分', value: bid || '-', active: bid > 0 },
    { label: '炸弹', value: bombs > 0 ? `×${Math.pow(2, bombs)}` : '-', icon: Bomb, active: bombs > 0 },
    { label: '春天', value: spring ? '×2' : '-', icon: Flower2, active: spring },
    { label: '反春', value: antiSpring ? '×2' : '-', icon: Sparkles, active: antiSpring },
    { label: '闷抓', value: menzhua ? '×2' : '-', icon: Zap, active: menzhua },
  ];

  return (
    <div className={cn(
      'px-4 py-2.5 flex items-center gap-3 rounded-2xl border backdrop-blur-sm',
      isLight
        ? 'bg-white/80 border-amber-700/20 shadow-sm'
        : 'bg-ink-800/60 border-gold-600/20',
    )}>
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-2">
          {i > 0 && <span className={cn(
            'text-sm',
            isLight ? 'text-amber-700/30' : 'text-gold-600/40',
          )}>×</span>}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              {item.icon && <item.icon className={`w-3 h-3 ${item.active ? (isLight ? 'text-red-500' : 'text-vermilion-400') : (isLight ? 'text-amber-800/20' : 'text-ink-600')}`} />}
              <span className={`text-xs font-body ${item.active ? (isLight ? 'text-amber-800' : 'text-gold-300') : (isLight ? 'text-amber-800/30' : 'text-ivory/30')}`}>
                {item.label}
              </span>
            </div>
            <span className={cn(
              'font-display text-lg',
              item.active ? (isLight ? 'text-amber-900' : 'text-gold-400') : (isLight ? 'text-amber-800/20' : 'text-ivory/20'),
              item.active && !isLight && 'text-shadow-gold',
            )}>
              {item.value}
            </span>
          </div>
        </div>
      ))}
      <div className={cn(
        'ml-2 pl-3 border-l flex flex-col items-center',
        isLight ? 'border-amber-700/20' : 'border-gold-600/30',
      )}>
        <Rocket className={cn('w-4 h-4 mb-0.5', isLight ? 'text-red-500' : 'text-vermilion-400')} />
        <span className={cn(
          'text-xs',
          isLight ? 'text-amber-700' : 'text-gold-500/70',
        )}>总计</span>
        <span className={cn(
          'font-display text-2xl',
          isLight ? 'text-amber-900' : 'text-gold-gradient text-shadow-gold',
        )}>{total || '?'}</span>
      </div>
    </div>
  );
}

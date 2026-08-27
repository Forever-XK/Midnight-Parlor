// 更新日志面板：展示各版本新增与修复内容
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Wrench } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights?: string;   // 版本主题（一句话）
  added: string[];       // 新增
  fixed: string[];       // 修复
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v1.4.0',
    date: '2026-08-27',
    highlights: '个性化定制版本',
    added: [
      '牌面风格系统：经典 / 圆徽 / 水印 / 点数 / 趣味人物 5 套牌面右下角图案',
      '桌布风格系统：翡翠 / 午夜蓝 / 酒红 / 紫罗兰 / 棋盘格 / 织锦纹 6 种牌桌背景',
      '音乐包系统：新春 / 经典 / 电玩 / 庆典 4 套 BGM，一键切换全部场景曲目',
      '统一游戏设置面板：牌面、桌布、音乐包三合一，主界面与对局中均可调整',
      '癞子多解自由选择：癞子牌与他牌可构成多种牌型时，玩家自选要打出的牌型',
      '用户系统：进入游戏设置用户名与性别，战绩按用户名分开记录互不干扰',
      '更新日志栏目',
      '自定义浏览器标签页图标',
    ],
    fixed: [
      '联机模式发牌后看不到自己手牌（WS 广播未按座位视角构建）',
      '联机返回单机后发牌动画错乱、手牌不显示（联机状态残留未清理）',
    ],
  },
  {
    version: 'v1.3.0',
    date: '2026-08-26',
    highlights: '体验打磨版本',
    added: [
      '三场景背景音乐：主界面 / 游戏中 / 紧张氛围（剩牌 ≤2 自动切换并播报警语音）',
      '滑动多选手牌：按住左键滑过即提起，再滑过即放下',
      '非自己回合也可提前选牌',
      '选牌音效（xuanpai）与全按钮点击音效（xuanze）',
      '全局按钮悬停 / 按压感知动画',
      '三不带语音按点数区分（sange1~13）',
    ],
    fixed: [
      '炸弹 / 王炸完全无声（双 pass 重置出牌区导致读不到本机牌）',
      '首次进入大厅背景音乐不响（自动播放策略拦截后自动恢复）',
      '返回大厅偶发 ECONNREFUSED（IPv6 双栈连接失败）',
    ],
  },
  {
    version: 'v1.2.0',
    date: '2026-08-26',
    highlights: '联机与稳定性版本',
    added: [
      'WebSocket 实时联机同步（替代轮询，按房间广播）',
      '资源预缓存与加载进度条，首局不再卡顿',
      'AI 思考延迟（每步 ≥1.5 秒，联机同步语音）',
      '云服务器部署脚本（npm run deploy）',
    ],
    fixed: [
      '天地癞子模式地癞子动画先于天癞子出现的时序问题',
      '服务器内部错误后误报「非你的回合」',
      '联机模式 AI 出牌过快且只有自己有语音',
      '玩家出牌 / 叫分 / 不出无声（首快照未播放）',
      '癞子模式叫地主后重播发牌动画（三处竞态）',
      '非闷抓模式发牌动画全部变为梅花 3',
      '长音效（爆炸声）被浏览器 GC 中断',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-08-24',
    highlights: 'AI 与玩法深化版本',
    added: [
      'AI 算法重构：移植宽立斗地主权重 + 最优拆牌模型，三档难度差异（休闲 / 标准 / 高手）',
      '高手难度记牌器',
      '不洗牌模式发牌重写：炸弹率 91%（随机基线 29%），保证有人握王炸',
      '癞子 / 天地癞子 / 闷抓三种创新模式',
      '全量语音音效：男女声线随机分配、出牌 / 叫分 / 炸弹全覆盖',
      'AI 出牌策略：角色定位、报单压制、炸弹时机、癞子最少惩罚',
    ],
    fixed: [
      '牌面展示时序：快照共享引用导致牌面提前显示',
      '底牌未打乱导致固定顺序',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-08-23',
    highlights: '首个正式版本',
    added: [
      '经典斗地主完整规则：叫分抢地主、全牌型判定、倍数结算、春天 / 反春',
      '五种游戏模式与三档 AI 难度',
      '发牌动画（逐张飞行）、选牌提牌动画、出牌区独立展示',
      '「午夜雅集」视觉主题：墨绿牌桌 + 鎏金配色，深浅双主题',
      '战绩统计：总场次 / 胜率 / 最高连胜 / 阵营胜率',
    ],
    fixed: [],
  },
];

interface ChangelogPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ChangelogPanel({ open, onClose }: ChangelogPanelProps) {
  const isLight = useThemeStore((st) => st.theme === 'light');

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="changelog-overlay"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key="changelog-panel"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className={cn(
              'w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl',
              isLight ? 'bg-[#f5ecd7] border-amber-700/30' : 'bg-ink-800/95 border-gold-600/40',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className={cn(
              'sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b backdrop-blur',
              isLight ? 'bg-[#f5ecd7]/95 border-amber-700/20' : 'bg-ink-800/95 border-gold-600/30',
            )}>
              <h2 className={cn(
                'font-main text-xl',
                isLight ? 'text-amber-800' : 'text-gold-300',
              )}>更新日志</h2>
              <button
                onClick={onClose}
                className={cn(
                  'inline-flex items-center justify-center rounded-xl p-2 border transition-all duration-200',
                  isLight
                    ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
                    : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 版本时间线 */}
            <div className="p-5 space-y-6">
              {CHANGELOG.map((entry, idx) => (
                <div key={entry.version} className="relative pl-5">
                  {/* 时间线节点与竖线 */}
                  <div className={cn(
                    'absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2',
                    idx === 0
                      ? (isLight ? 'bg-amber-500 border-amber-500' : 'bg-gold-400 border-gold-400')
                      : (isLight ? 'bg-transparent border-amber-600/50' : 'bg-transparent border-gold-600/50'),
                  )} />
                  {idx < CHANGELOG.length - 1 && (
                    <div className={cn(
                      'absolute left-[4px] top-4 bottom-[-24px] w-px',
                      isLight ? 'bg-amber-700/20' : 'bg-gold-600/20',
                    )} />
                  )}

                  {/* 版本头 */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={cn(
                      'font-main text-lg',
                      idx === 0
                        ? (isLight ? 'text-amber-700' : 'text-gold-300')
                        : (isLight ? 'text-amber-900/70' : 'text-ivory/80'),
                    )}>{entry.version}</span>
                    <span className={cn(
                      'text-xs',
                      isLight ? 'text-amber-800/50' : 'text-ivory/40',
                    )}>{entry.date}</span>
                    {entry.highlights && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full border',
                        isLight
                          ? 'border-amber-600/30 text-amber-700 bg-amber-500/10'
                          : 'border-gold-500/30 text-gold-400 bg-gold-500/10',
                      )}>{entry.highlights}</span>
                    )}
                  </div>

                  {/* 新增 */}
                  {entry.added.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {entry.added.map((item) => (
                        <div key={item} className="flex items-start gap-2 text-sm">
                          <Sparkles className={cn(
                            'w-3.5 h-3.5 mt-0.5 shrink-0',
                            isLight ? 'text-amber-600' : 'text-gold-400',
                          )} />
                          <span className={isLight ? 'text-amber-900/70' : 'text-ivory/60'}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 修复 */}
                  {entry.fixed.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {entry.fixed.map((item) => (
                        <div key={item} className="flex items-start gap-2 text-sm">
                          <Wrench className={cn(
                            'w-3.5 h-3.5 mt-0.5 shrink-0',
                            isLight ? 'text-emerald-700/70' : 'text-emerald-400/70',
                          )} />
                          <span className={isLight ? 'text-amber-900/60' : 'text-ivory/50'}>修复 {item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

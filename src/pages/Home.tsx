// 大厅首页
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Shuffle, Dices, Trophy, BookOpen, ChevronDown, Volume2, VolumeX, Sun, Moon, Globe, Zap, Settings, ScrollText, User } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import { useUserStore } from '@/store/userStore';
import FallingCards from '@/components/FallingCards';
import SettingsPanel from '@/components/SettingsPanel';
import ChangelogPanel from '@/components/ChangelogPanel';
import { sound } from '@/lib/soundManager';
import { cn } from '@/lib/utils';
import type { Difficulty, GameMode } from '@shared/types';

const MODES: { id: GameMode; name: string; desc: string; icon: typeof Swords }[] = [
  { id: 'classic', name: '经典模式', desc: '叫分争夺地主，策略博弈', icon: Swords },
  { id: 'unshuffled', name: '不洗牌', desc: '大牌集中，王炸乱舞', icon: Shuffle },
  { id: 'laizi', name: '癞子模式', desc: '随机癞子，百搭变幻', icon: Dices },
  { id: 'tiandilaizi', name: '天地癞子', desc: '天癞+地癞，多多益炸', icon: Swords },
  { id: 'menzhua', name: '闷抓斗地主', desc: '暗牌明张，闷抓翻倍', icon: Zap },
];

const DIFFICULTIES: { id: Difficulty; name: string; desc: string }[] = [
  { id: 'casual', name: '休闲', desc: '轻松随意' },
  { id: 'standard', name: '标准', desc: '均衡挑战' },
  { id: 'master', name: '高手', desc: '记牌大师' },
];

// 遮罩只在应用会话内首次进入时展示一次（返回大厅不再重复）
let splashShown = false;

export default function Home() {
  const navigate = useNavigate();
  const { mode, difficulty, setMode, setDifficulty, startGame, loading, stats, loadStats, soundEnabled, toggleSound } = useGameStore();
  const { theme, toggleTheme } = useThemeStore();
  const { username, setProfile } = useUserStore();
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showSplash, setShowSplash] = useState(!splashShown);
  // 首次进入：设置用户名与性别（已有用户名则直接点击进入）
  const needProfile = !username;
  const [inputName, setInputName] = useState('');
  const [inputGender, setInputGender] = useState<'male' | 'female'>('male');

  useEffect(() => { loadStats(); }, [loadStats]);

  // 主界面背景音乐（首次进入与从对局返回均切换回 Welcome）
  useEffect(() => { sound.playBgm('Welcome'); }, []);

  // 点击遮罩：在用户手势下解锁并播放 BGM，再进入大厅（首次进入需先填写用户名/性别）
  const handleEnter = () => {
    if (needProfile) {
      const name = inputName.trim();
      if (!name) return; // 未填用户名不允许进入
      setProfile(name, inputGender);
    }
    splashShown = true;
    sound.ensureBgm('Welcome');
    setShowSplash(false);
  };

  const handleStart = async () => {
    await startGame();
    navigate('/game');
  };

  const winRate = stats && stats.gamesPlayed > 0
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0;

  const isLight = theme === 'light';

  return (
    <div className={cn(
      'min-h-screen relative overflow-hidden',
      isLight ? 'bg-[#f5ecd7]' : 'bg-ink-900',
    )}>
      {/* 背景渐变 */}
      <div
        className="absolute inset-0"
        style={isLight ? {
          background: 'radial-gradient(ellipse at 50% 0%, #f0dfb0 0%, #e8d4a8 40%, #ddc690 100%)',
        } : {
          background: 'radial-gradient(ellipse at 50% 0%, #13293d 0%, #0d1b2a 40%, #0a0f1a 100%)',
        }}
      />
      <FallingCards />

      {/* 顶部导航 */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center font-main text-sm',
            isLight
              ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
              : 'bg-gradient-to-br from-gold-300 to-gold-600 text-ink-900',
          )}>
            牌
          </div>
          <span className={cn(
            'font-main text-lg',
            isLight ? 'text-amber-800' : 'text-gold-400',
          )}>斗地主</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} title="游戏设置" className={cn(
            'inline-flex items-center justify-center rounded-xl px-3 py-2 border transition-all duration-200',
            isLight
              ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
              : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
          )}>
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={toggleTheme} className={cn(
            'inline-flex items-center justify-center rounded-xl px-3 py-2 border transition-all duration-200',
            isLight
              ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
              : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
          )}>
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button onClick={toggleSound} className={cn(
            'inline-flex items-center justify-center rounded-xl px-3 py-2 border transition-all duration-200',
            isLight
              ? 'border-amber-700/30 text-amber-800 bg-white/50 hover:bg-amber-100/50'
              : 'border-gold-600/40 text-gold-400 bg-ink-600/40 hover:border-gold-500 hover:text-gold-300',
          )}>
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 主内容 */}
      <main className="relative z-10 flex flex-col items-center px-6 pt-8 pb-12 max-w-4xl mx-auto">
        {/* Hero 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className={cn(
            'font-main text-7xl md:text-8xl mb-2 leading-none',
            isLight
              ? 'text-amber-800 drop-shadow-[0_2px_8px_rgba(139,105,20,0.3)]'
              : 'text-gold-gradient text-shadow-gold',
          )}>
            斗地主
          </h1>
          <p className={cn(
            'font-main text-sm tracking-[0.4em] uppercase',
            isLight ? 'text-amber-700/60' : 'text-ivory/50',
          )}>
            {isLight ? 'Classic · Card Game' : 'Midnight · Parlor'}
          </p>
        </motion.div>

        {/* 模式选择 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-full mb-6"
        >
          <div className={cn(
            'text-xs font-main mb-2 tracking-wider',
            isLight ? 'text-amber-800/60' : 'text-gold-500/70',
          )}>选择模式</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'p-4 flex items-start gap-3 transition-all duration-200 text-left rounded-2xl border',
                  isLight ? (
                    mode === m.id
                      ? 'bg-white/90 border-amber-500 shadow-[0_0_16px_rgba(180,130,20,0.3)] scale-[1.02]'
                      : 'bg-white/60 border-amber-700/20 hover:border-amber-600/40 hover:bg-white/80'
                  ) : (
                    mode === m.id
                      ? 'glass-panel border-gold-400 shadow-gold-glow scale-[1.02]'
                      : 'glass-panel hover:border-gold-500/40'
                  ),
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  isLight ? (
                    mode === m.id ? 'bg-amber-500/20 text-amber-700' : 'bg-amber-900/10 text-amber-800/50'
                  ) : (
                    mode === m.id ? 'bg-gold-500/20 text-gold-300' : 'bg-ink-600/50 text-ivory/40'
                  ),
                )}>
                  <m.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className={cn(
                    'font-main text-lg',
                    isLight ? (mode === m.id ? 'text-amber-800' : 'text-amber-900/70') : (mode === m.id ? 'text-gold-300' : 'text-ivory/80'),
                  )}>
                    {m.name}
                  </div>
                  <div className={cn(
                  'text-xs',
                  isLight ? 'text-amber-800/50' : 'text-ivory/40',
                )}>{m.desc}</div>
                </div>
              </button>
            ))}
            {/* 游戏设置卡片（模式区末尾，闷抓斗地主之后） */}
            <button
              onClick={() => setShowSettings(true)}
              className={cn(
                'p-4 flex items-start gap-3 transition-all duration-200 text-left rounded-2xl border border-dashed',
                isLight
                  ? 'bg-white/40 border-amber-700/30 hover:border-amber-600/50 hover:bg-white/70'
                  : 'bg-ink-700/30 border-gold-600/30 hover:border-gold-500/50 hover:bg-ink-600/40',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                isLight ? 'bg-amber-900/10 text-amber-800/60' : 'bg-ink-600/50 text-ivory/40',
              )}>
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div className={cn(
                  'font-main text-lg',
                  isLight ? 'text-amber-900/70' : 'text-ivory/80',
                )}>游戏设置</div>
                <div className={cn(
                  'text-xs',
                  isLight ? 'text-amber-800/50' : 'text-ivory/40',
                )}>牌面 · 桌布 · 音乐包</div>
              </div>
            </button>
            {/* 更新日志卡片（设置之后） */}
            <button
              onClick={() => setShowChangelog(true)}
              className={cn(
                'p-4 flex items-start gap-3 transition-all duration-200 text-left rounded-2xl border border-dashed',
                isLight
                  ? 'bg-white/40 border-amber-700/30 hover:border-amber-600/50 hover:bg-white/70'
                  : 'bg-ink-700/30 border-gold-600/30 hover:border-gold-500/50 hover:bg-ink-600/40',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                isLight ? 'bg-amber-900/10 text-amber-800/60' : 'bg-ink-600/50 text-ivory/40',
              )}>
                <ScrollText className="w-5 h-5" />
              </div>
              <div>
                <div className={cn(
                  'font-main text-lg',
                  isLight ? 'text-amber-900/70' : 'text-ivory/80',
                )}>更新日志</div>
                <div className={cn(
                  'text-xs',
                  isLight ? 'text-amber-800/50' : 'text-ivory/40',
                )}>当前 v1.5.1 · 联机修复</div>
              </div>
            </button>
          </div>
        </motion.div>

        {/* 难度选择 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full mb-8"
        >
          <div className={cn(
            'text-xs font-main mb-2 tracking-wider',
            isLight ? 'text-amber-800/60' : 'text-gold-500/70',
          )}>AI 难度</div>
          <div className="grid grid-cols-3 gap-3">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={cn(
                  'py-3 px-2 text-center transition-all duration-200 rounded-2xl border',
                  isLight ? (
                    difficulty === d.id
                      ? 'bg-white/90 border-amber-500 shadow-[0_0_16px_rgba(180,130,20,0.3)]'
                      : 'bg-white/60 border-amber-700/20 hover:border-amber-600/40'
                  ) : (
                    difficulty === d.id
                      ? 'glass-panel border-gold-400 shadow-gold-glow'
                      : 'glass-panel hover:border-gold-500/40'
                  ),
                )}
              >
                <div className={cn(
                  'font-main text-xl',
                  isLight ? (difficulty === d.id ? 'text-amber-800' : 'text-amber-900/70') : (difficulty === d.id ? 'text-gold-300' : 'text-ivory/70'),
                )}>
                  {d.name}
                </div>
                <div className={cn(
                  'text-xs',
                  isLight ? 'text-amber-800/50' : 'text-ivory/40',
                )}>{d.desc}</div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* 开始按钮 */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          whileHover={{ scale: loading ? 1 : 1.03 }}
          whileTap={{ scale: loading ? 1 : 0.98 }}
          onClick={handleStart}
          disabled={loading}
          className="btn-gold !font-main !text-2xl !px-12 !py-4 mb-4"
        >
          {loading ? '准备牌桌...' : '开始对战'}
        </motion.button>

        {/* 在线对战入口 */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/lobby')}
          className={cn(
            'inline-flex items-center gap-2 rounded-2xl px-7 py-3 font-main text-xl border transition-all duration-200 mb-8',
            isLight
              ? 'bg-white/70 border-amber-700/30 text-amber-800 hover:border-amber-600 hover:bg-white/90'
              : 'bg-ink-700/50 border-gold-600/40 text-gold-300 hover:border-gold-400 hover:text-gold-200',
          )}
        >
          <Globe className="w-5 h-5" /> 在线对战
        </motion.button>

        {/* 战绩 + 规则 双栏 */}
        <div className="w-full grid md:grid-cols-2 gap-4">
          {/* 战绩面板 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className={cn(
              'p-5 rounded-2xl border',
              isLight
                ? 'bg-white/70 border-amber-700/20 shadow-sm'
                : 'glass-panel',
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <Trophy className={cn('w-5 h-5', isLight ? 'text-amber-700' : 'text-gold-400')} />
              <span className={cn(
                'font-main text-lg',
                isLight ? 'text-amber-800' : 'text-gold-300',
              )}>战绩</span>
              {username && (
                <span className={cn(
                  'ml-auto text-xs px-2 py-0.5 rounded-full border',
                  isLight
                    ? 'border-amber-700/20 text-amber-800/70 bg-amber-500/5'
                    : 'border-gold-600/30 text-gold-400/80 bg-gold-500/5',
                )}>
                  {username}
                </span>
              )}
            </div>
            {stats && stats.gamesPlayed > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={cn('text-sm', isLight ? 'text-amber-900/60' : 'text-ivory/60')}>总场次</span>
                  <span className={cn('font-main', isLight ? 'text-amber-800' : 'text-gold-400')}>{stats.gamesPlayed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn('text-sm', isLight ? 'text-amber-900/60' : 'text-ivory/60')}>胜率</span>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-20 h-1.5 rounded-full overflow-hidden',
                      isLight ? 'bg-amber-200' : 'bg-ink-600',
                    )}>
                      <div className={cn(
                        'h-full',
                        isLight ? 'bg-gradient-to-r from-amber-500 to-amber-700' : 'bg-gradient-to-r from-gold-400 to-gold-600',
                      )} style={{ width: `${winRate}%` }} />
                    </div>
                    <span className={cn('font-main', isLight ? 'text-amber-800' : 'text-gold-400')}>{winRate}%</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn('text-sm', isLight ? 'text-amber-900/60' : 'text-ivory/60')}>最高连胜</span>
                  <span className={cn('font-main', isLight ? 'text-amber-800' : 'text-gold-400')}>{stats.maxStreak}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn('text-sm', isLight ? 'text-amber-900/60' : 'text-ivory/60')}>地主胜率</span>
                  <span className={cn('font-main text-sm', isLight ? 'text-amber-800' : 'text-gold-400')}>
                    {stats.landlordGames > 0 ? `${Math.round(stats.landlordWins / stats.landlordGames * 100)}%` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={cn('text-sm', isLight ? 'text-amber-900/60' : 'text-ivory/60')}>农民胜率</span>
                  <span className={cn('font-main text-sm', isLight ? 'text-amber-800' : 'text-gold-400')}>
                    {stats.peasantGames > 0 ? `${Math.round(stats.peasantWins / stats.peasantGames * 100)}%` : '-'}
                  </span>
                </div>
              </div>
            ) : (
              <div className={cn(
                'text-sm py-4 text-center',
                isLight ? 'text-amber-800/40' : 'text-ivory/30',
              )}>
                还没有战绩，开始第一局吧！
              </div>
            )}
          </motion.div>

          {/* 玩法说明 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className={cn(
              'p-5 rounded-2xl border',
              isLight
                ? 'bg-white/70 border-amber-700/20 shadow-sm'
                : 'glass-panel',
            )}
          >
            <button
              onClick={() => setShowRules(!showRules)}
              className="flex items-center gap-2 w-full text-left"
            >
              <BookOpen className={cn('w-5 h-5', isLight ? 'text-amber-700' : 'text-gold-400')} />
              <span className={cn(
                'font-main text-lg',
                isLight ? 'text-amber-800' : 'text-gold-300',
              )}>玩法说明</span>
              <ChevronDown className={cn(
                'w-4 h-4 ml-auto transition-transform',
                isLight ? 'text-amber-800/40' : 'text-ivory/40',
                showRules && 'rotate-180',
              )} />
            </button>
            {showRules && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={cn(
                  'mt-3 space-y-2 text-sm overflow-hidden',
                  isLight ? 'text-amber-900/70' : 'text-ivory/60',
                )}
              >
                <p><span className={isLight ? 'text-amber-700 font-medium' : 'text-gold-400'}>牌型：</span>单张、对子、三张、三带一/二、顺子(5+)、连对(3+)、飞机、四带二、炸弹、王炸</p>
                <p><span className={isLight ? 'text-amber-700 font-medium' : 'text-gold-400'}>大小：</span>3&lt;4&lt;...&lt;K&lt;A&lt;2&lt;小王&lt;大王</p>
                <p><span className={isLight ? 'text-amber-700 font-medium' : 'text-gold-400'}>炸弹：</span>四张相同，翻倍并压过普通牌型</p>
                <p><span className={isLight ? 'text-amber-700 font-medium' : 'text-gold-400'}>王炸：</span>双王，最大牌型</p>
                <p><span className={isLight ? 'text-amber-700 font-medium' : 'text-gold-400'}>春天：</span>地主胜且农民未出牌 ×2；反春：农民胜且地主仅出一手 ×2</p>
                <p><span className={isLight ? 'text-amber-700 font-medium' : 'text-gold-400'}>倍数：</span>底分 × 叫分 × 2^(炸弹+王炸) × 春天倍数</p>
                <p><span className={isLight ? 'text-amber-700 font-medium' : 'text-gold-400'}>癞子：</span>癞子模式中随机抽取一个点数，该点数的牌可当作任意非王牌点数使用</p>
                <p><span className={isLight ? 'text-amber-700 font-medium' : 'text-gold-400'}>天地癞子：</span>发牌后抽天癞子，确定地主后抽地癞子，两者不同且不为王牌；炸弹张数越多越大，同张数比点数</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>

      {/* 统一游戏设置面板 */}
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      {/* 更新日志面板 */}
      <ChangelogPanel open={showChangelog} onClose={() => setShowChangelog(false)} />

      {/* 点击进入遮罩：解锁背景音乐 */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
              'fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden',
              isLight ? 'bg-[#f5ecd7]' : 'bg-ink-900',
            )}
          >
            <div
              className="absolute inset-0"
              style={isLight ? {
                background: 'radial-gradient(ellipse at 50% 30%, #f0dfb0 0%, #e8d4a8 45%, #ddc690 100%)',
              } : {
                background: 'radial-gradient(ellipse at 50% 30%, #13293d 0%, #0d1b2a 45%, #0a0f1a 100%)',
              }}
            />
            <FallingCards count={10} />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative z-10 flex flex-col items-center"
            >
              <h1 className={cn(
                'font-main text-7xl md:text-8xl mb-2 leading-none',
                isLight
                  ? 'text-amber-800 drop-shadow-[0_2px_8px_rgba(139,105,20,0.3)]'
                  : 'text-gold-gradient text-shadow-gold',
              )}>
                斗地主
              </h1>
              <p className={cn(
                'font-main text-sm tracking-[0.4em] uppercase mb-10',
                isLight ? 'text-amber-700/60' : 'text-ivory/50',
              )}>
                {isLight ? 'Classic · Card Game' : 'Midnight · Parlor'}
              </p>

              {needProfile ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    'flex flex-col gap-4 w-80 max-w-[90vw] p-5 rounded-2xl border mb-2',
                    isLight
                      ? 'bg-white/70 border-amber-700/30'
                      : 'bg-ink-700/60 border-gold-600/40 backdrop-blur',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <User className={cn('w-5 h-5', isLight ? 'text-amber-700' : 'text-gold-400')} />
                    <span className={cn(
                      'font-main text-lg',
                      isLight ? 'text-amber-800' : 'text-gold-300',
                    )}>创建你的牌手身份</span>
                  </div>
                  <div>
                    <label className={cn(
                      'text-xs mb-1 block',
                      isLight ? 'text-amber-800/60' : 'text-ivory/50',
                    )}>用户名（战绩将按用户名分开记录）</label>
                    <input
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value.slice(0, 12))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEnter(); }}
                      placeholder="请输入用户名"
                      autoFocus
                      maxLength={12}
                      className={cn(
                        'w-full px-3 py-2 rounded-xl border outline-none transition-colors',
                        isLight
                          ? 'bg-white/80 border-amber-700/30 text-amber-900 placeholder:text-amber-800/30 focus:border-amber-500'
                          : 'bg-ink-800/80 border-gold-600/40 text-ivory placeholder:text-ivory/30 focus:border-gold-400',
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn(
                      'text-xs mb-1.5 block',
                      isLight ? 'text-amber-800/60' : 'text-ivory/50',
                    )}>性别（决定你的语音声线）</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([['male', '♂ 男'], ['female', '♀ 女']] as const).map(([g, label]) => (
                        <button
                          key={g}
                          onClick={() => setInputGender(g)}
                          className={cn(
                            'py-2 rounded-xl border font-main transition-all duration-200',
                            inputGender === g
                              ? (isLight
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-gold-500 text-ink-900 border-gold-400')
                              : (isLight
                                ? 'bg-white/70 text-amber-900/70 border-amber-700/25 hover:border-amber-600/50'
                                : 'bg-ink-600/50 text-ivory/70 border-gold-600/30 hover:border-gold-500/50'),
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: inputName.trim() ? 1.03 : 1 }}
                    whileTap={{ scale: inputName.trim() ? 0.97 : 1 }}
                    onClick={handleEnter}
                    disabled={!inputName.trim()}
                    className={cn(
                      'btn-gold !font-main !text-xl !px-8 !py-3 w-full',
                      !inputName.trim() && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    进入游戏
                  </motion.button>
                </motion.div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleEnter}
                  className="btn-gold !font-main !text-2xl !px-12 !py-4"
                >
                  点击进入
                </motion.button>
              )}

              {/* 在线版本入口说明（进入游戏按钮下方） */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'mt-4 flex flex-col items-center gap-1 text-xs font-main',
                  isLight ? 'text-amber-800/70' : 'text-ivory/60',
                )}
              >
                <div>在线版本：</div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                  <a
                    href="https://ddz.fruitrade.cn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'underline underline-offset-2 transition-colors',
                      isLight ? 'text-amber-700 hover:text-amber-900' : 'text-gold-400/80 hover:text-gold-300',
                    )}
                  >智能AI版本（机器学习版）：ddz.fruitrade.cn</a>
                  <a
                    href="https://old.ddz.fruitrade.cn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'underline underline-offset-2 transition-colors',
                      isLight ? 'text-amber-700 hover:text-amber-900' : 'text-gold-400/80 hover:text-gold-300',
                    )}
                  >经典AI版本（本地算法版）：old.ddz.fruitrade.cn</a>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

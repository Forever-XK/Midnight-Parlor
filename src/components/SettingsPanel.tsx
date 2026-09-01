// 统一游戏设置面板：用户资料 / 牌面风格 / 桌布风格 / 牌背风格 / 音乐包
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Palette, Music, UserRound } from 'lucide-react';
import { useCardStyleStore, CARD_FACES, type CardFaceStyle } from '@/store/cardStyleStore';
import { useTableStyleStore, TABLE_STYLES, getTableBackground } from '@/store/tableStyleStore';
import { useCardBackStore, CARD_BACKS, getCardBack } from '@/store/cardBackStore';
import { sound, BGM_PACKS, type BgmPack } from '@/lib/soundManager';
import { useThemeStore } from '@/store/themeStore';
import { useUserStore } from '@/store/userStore';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

// 牌面迷你预览：角标 A♠ + 按风格渲染右下角图案
function MiniPreview({ style }: { style: CardFaceStyle }) {
  const suit = '♠';
  const dark = style === 'dark';
  return (
    <div
      className="w-9 h-12 rounded-md border border-gold-600/40 relative shadow-sm overflow-hidden shrink-0"
      style={{ background: dark
        ? 'linear-gradient(165deg, #262633 0%, #16161f 55%, #0e0e15 100%)'
        : 'linear-gradient(180deg, #fdfaf0 0%, #f8f4e8 100%)' }}
    >
      <div className={cn(
        'absolute top-0.5 left-1 flex flex-col items-center leading-none font-card',
        dark ? 'text-gold-300' : 'text-ink-800',
      )}>
        <span className="text-[10px] font-bold">A</span>
        <span className="text-[8px] leading-none">{suit}</span>
      </div>
      {style === 'classic' && (
        <span className="absolute right-0.5 bottom-0 text-xl font-card text-ink-800" style={{ opacity: 0.85 }}>{suit}</span>
      )}
      {style === 'ring' && (
        <div className="absolute right-0.5 bottom-0.5 w-5 h-5 rounded-full border-2 border-gold-500/70 flex items-center justify-center">
          <span className="text-[10px] font-card text-ink-800">{suit}</span>
        </div>
      )}
      {style === 'watermark' && (
        <span className="absolute right-[-4px] bottom-[-8px] text-4xl font-card text-ink-800" style={{ opacity: 0.16, lineHeight: 1 }}>{suit}</span>
      )}
      {style === 'rank' && (
        <span className="absolute right-0.5 bottom-0 text-2xl font-bold font-card text-ink-800" style={{ opacity: 0.9 }}>A</span>
      )}
      {style === 'fun' && (
        <span className="absolute right-0.5 bottom-0 text-2xl" style={{ opacity: 0.95, lineHeight: 1 }}>✨</span>
      )}
      {style === 'xiangqi' && (
        <span className="absolute right-0.5 bottom-0 text-2xl font-card text-ink-800" style={{ opacity: 0.95, lineHeight: 1 }}>♜</span>
      )}
      {style === 'dark' && (
        <div
          className="absolute right-0.5 bottom-0.5 w-5 h-5 rounded-full border border-gold-500/30 flex items-center justify-center"
          style={{ background: 'rgba(212,175,55,0.08)' }}
        >
          <span
            className="text-[10px] font-card text-gold-300"
            style={{ filter: 'drop-shadow(0 0 3px rgba(212,175,55,0.5))', lineHeight: 1 }}
          >{suit}</span>
        </div>
      )}
    </div>
  );
}

// 音乐包图标（对应 BGM_PACKS 顺序）
const PACK_ICONS = ['🧨', '🎵', '🕹️', '🎉'];

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const isLight = useThemeStore((st) => st.theme === 'light');
  const { face, setFace } = useCardStyleStore();
  const { style: tableStyle, setStyle: setTableStyle } = useTableStyleStore();
  const { back: backStyle, setBack: setBackStyle } = useCardBackStore();
  const [pack, setPack] = useState<BgmPack>(() => sound.getPack());
  const { username, gender, setProfile } = useUserStore();
  const loadStats = useGameStore((st) => st.loadStats);
  // 用户资料本地编辑态（打开面板时同步当前值）
  const [editName, setEditName] = useState(username);
  const [editGender, setEditGender] = useState(gender);
  useEffect(() => {
    if (open) { setEditName(username); setEditGender(gender); }
  }, [open, username, gender]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSelectPack = (id: BgmPack) => {
    sound.setPack(id);
    setPack(id);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-overlay"
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key="settings-panel"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className={cn(
              'w-full max-w-lg max-h-[85%] overflow-y-auto rounded-2xl border shadow-2xl',
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
              )}>游戏设置</h2>
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

            <div className="p-5 space-y-6">
              {/* ===== 用户资料 ===== */}
              <section>
                <div className={cn(
                  'flex items-center gap-2 mb-3 text-xs font-main tracking-wider',
                  isLight ? 'text-amber-800/60' : 'text-gold-500/70',
                )}>
                  <UserRound className="w-4 h-4" /> 用户资料
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <label className={cn(
                      'text-xs mb-1 block',
                      isLight ? 'text-amber-800/60' : 'text-ivory/50',
                    )}>用户名（战绩按用户名分开记录）</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value.slice(0, 12))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editName.trim()) {
                          setProfile(editName, editGender);
                          loadStats();
                        }
                      }}
                      maxLength={12}
                      className={cn(
                        'w-full px-3 py-2 rounded-xl border outline-none transition-colors',
                        isLight
                          ? 'bg-white/80 border-amber-700/30 text-amber-900 focus:border-amber-500'
                          : 'bg-ink-800/80 border-gold-600/40 text-ivory focus:border-gold-400',
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn(
                      'text-xs mb-1 block',
                      isLight ? 'text-amber-800/60' : 'text-ivory/50',
                    )}>性别（语音声线）</label>
                    <div className="flex gap-1.5">
                      {([['male', '♂ 男'], ['female', '♀ 女']] as const).map(([g, label]) => (
                        <button
                          key={g}
                          onClick={() => setEditGender(g)}
                          className={cn(
                            'px-3.5 py-2 rounded-xl border font-main text-sm transition-all duration-200',
                            editGender === g
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
                  <button
                    disabled={!editName.trim() || (editName.trim() === username && editGender === gender)}
                    onClick={() => { setProfile(editName, editGender); loadStats(); }}
                    className={cn(
                      'font-main text-sm px-5 py-2 rounded-xl border transition-all duration-200',
                      !editName.trim() || (editName.trim() === username && editGender === gender)
                        ? (isLight ? 'border-amber-700/15 text-amber-900/30 cursor-not-allowed' : 'border-gold-600/15 text-ivory/25 cursor-not-allowed')
                        : (isLight
                          ? 'border-amber-600/40 text-amber-800 bg-amber-500/10 hover:bg-amber-500/20'
                          : 'border-gold-500/40 text-gold-300 bg-gold-500/10 hover:bg-gold-500/20'),
                    )}
                  >
                    保存
                  </button>
                </div>
                {editName.trim() !== username && editName.trim() && (
                  <div className={cn(
                    'text-[11px] mt-2',
                    isLight ? 'text-amber-700/70' : 'text-gold-400/70',
                  )}>
                    切换到「{editName.trim()}」后，将查看并记录该用户的战绩（与「{username || '当前用户'}」分开）
                  </div>
                )}
              </section>

              {/* ===== 牌面风格 ===== */}
              <section>
                <div className={cn(
                  'flex items-center gap-2 mb-3 text-xs font-main tracking-wider',
                  isLight ? 'text-amber-800/60' : 'text-gold-500/70',
                )}>
                  <Layers className="w-4 h-4" /> 牌面风格
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {CARD_FACES.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFace(f.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all duration-200',
                        face === f.id
                          ? (isLight ? 'border-amber-500 bg-amber-100/50' : 'border-gold-400 bg-gold-500/10')
                          : (isLight ? 'border-transparent hover:bg-amber-100/40' : 'border-transparent hover:bg-ink-600/50'),
                      )}
                    >
                      <MiniPreview style={f.id} />
                      <div className="text-center">
                        <div className={cn(
                          'font-main text-sm',
                          face === f.id
                            ? (isLight ? 'text-amber-800' : 'text-gold-300')
                            : (isLight ? 'text-amber-900/70' : 'text-ivory/70'),
                        )}>{f.name}</div>
                        <div className={cn(
                          'text-[11px]',
                          isLight ? 'text-amber-800/50' : 'text-ivory/40',
                        )}>{f.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* ===== 桌布风格 ===== */}
              <section>
                <div className={cn(
                  'flex items-center gap-2 mb-3 text-xs font-main tracking-wider',
                  isLight ? 'text-amber-800/60' : 'text-gold-500/70',
                )}>
                  <Palette className="w-4 h-4" /> 桌布风格
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {TABLE_STYLES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTableStyle(t.id)}
                      className={cn(
                        'p-1.5 rounded-xl border transition-all duration-200 text-left',
                        tableStyle === t.id
                          ? (isLight ? 'border-amber-500 bg-amber-100/50' : 'border-gold-400 bg-gold-500/10')
                          : (isLight ? 'border-transparent hover:bg-amber-100/40' : 'border-transparent hover:bg-ink-600/50'),
                      )}
                    >
                      <div
                        className="w-full h-10 rounded-lg border mb-1 relative overflow-hidden"
                        style={{
                          background: getTableBackground(t.id, isLight)
                            ?? (isLight
                              ? 'radial-gradient(ellipse at center, #2d8a5e 0%, #1a7248 45%, #0f5a38 100%)'
                              : 'radial-gradient(ellipse at center, #0f6048 0%, #0a4d3a 45%, #063326 100%)'),
                        }}
                      >
                        {tableStyle === t.id && (
                          <div className={cn(
                            'absolute inset-0 flex items-center justify-center',
                            isLight ? 'text-amber-200' : 'text-gold-300',
                          )}>
                            <span className="text-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">✓</span>
                          </div>
                        )}
                      </div>
                      <div className={cn(
                        'font-main text-sm',
                        tableStyle === t.id
                          ? (isLight ? 'text-amber-800' : 'text-gold-300')
                          : (isLight ? 'text-amber-900/70' : 'text-ivory/70'),
                      )}>{t.name}</div>
                      <div className={cn(
                        'text-[11px]',
                        isLight ? 'text-amber-800/50' : 'text-ivory/40',
                      )}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </section>

              {/* ===== 牌背风格 ===== */}
              <section>
                <div className={cn(
                  'flex items-center gap-2 mb-3 text-xs font-main tracking-wider',
                  isLight ? 'text-amber-800/60' : 'text-gold-500/70',
                )}>
                  <Layers className="w-4 h-4" /> 牌背风格
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CARD_BACKS.map((b) => {
                    const bk = getCardBack(b.id, isLight);
                    return (
                      <button
                        key={b.id}
                        onClick={() => setBackStyle(b.id)}
                        className={cn(
                          'p-1.5 rounded-xl border transition-all duration-200 text-left',
                          backStyle === b.id
                            ? (isLight ? 'border-amber-500 bg-amber-100/50' : 'border-gold-400 bg-gold-500/10')
                            : (isLight ? 'border-transparent hover:bg-amber-100/40' : 'border-transparent hover:bg-ink-600/50'),
                        )}
                      >
                        {/* 牌背迷你预览 */}
                        <div
                          className="w-full h-12 rounded-lg border mb-1 relative overflow-hidden border-gold-600/30 flex items-center justify-center"
                          style={{ background: bk.background! }}
                        >
                          <span className="text-base font-card" style={{ color: bk.motifColor }}>{b.motif}</span>
                          {backStyle === b.id && (
                            <div className={cn(
                              'absolute inset-0 flex items-center justify-center',
                              isLight ? 'text-amber-200' : 'text-gold-300',
                            )}>
                              <span className="text-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">✓</span>
                            </div>
                          )}
                        </div>
                        <div className={cn(
                          'font-main text-sm',
                          backStyle === b.id
                            ? (isLight ? 'text-amber-800' : 'text-gold-300')
                            : (isLight ? 'text-amber-900/70' : 'text-ivory/70'),
                        )}>{b.name}</div>
                        <div className={cn(
                          'text-[11px]',
                          isLight ? 'text-amber-800/50' : 'text-ivory/40',
                        )}>{b.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ===== 音乐包 ===== */}
              <section>
                <div className={cn(
                  'flex items-center gap-2 mb-3 text-xs font-main tracking-wider',
                  isLight ? 'text-amber-800/60' : 'text-gold-500/70',
                )}>
                  <Music className="w-4 h-4" /> 音乐包
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {BGM_PACKS.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPack(p.id)}
                      className={cn(
                        'p-2 rounded-xl border transition-all duration-200 text-center',
                        pack === p.id
                          ? (isLight ? 'border-amber-500 bg-amber-100/50' : 'border-gold-400 bg-gold-500/10')
                          : (isLight ? 'border-transparent hover:bg-amber-100/40' : 'border-transparent hover:bg-ink-600/50'),
                      )}
                    >
                      <span className="text-2xl leading-none block mb-1">{PACK_ICONS[i]}</span>
                      <div className={cn(
                        'font-main text-sm',
                        pack === p.id
                          ? (isLight ? 'text-amber-800' : 'text-gold-300')
                          : (isLight ? 'text-amber-900/70' : 'text-ivory/70'),
                      )}>{p.name}</div>
                      <div className={cn(
                        'text-[11px]',
                        isLight ? 'text-amber-800/50' : 'text-ivory/40',
                      )}>{p.desc}</div>
                    </button>
                  ))}
                </div>
                <div className={cn(
                  'text-[11px] mt-2 leading-relaxed',
                  isLight ? 'text-amber-800/40' : 'text-ivory/35',
                )}>
                  音乐包涵盖主界面 / 游戏中 / 紧张氛围全部曲目，切换立即生效
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

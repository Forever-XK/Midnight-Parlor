// 资源预加载器：扫描 Sound 目录的全部音频，用 Audio 元素预热浏览器缓存
// 并在首屏展示一个带进度条的遮罩，完成后再进入主内容
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface ResourceLoaderProps {
  children: React.ReactNode;
}

// 从 soundManager 相同的 glob 派生（独立 import 便于按需调度）
const audioModules = import.meta.glob('../../Sound/**/*.wav', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// 取全部音频 URL（去重）
function collectAudioUrls(): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const u of Object.values(audioModules)) {
    if (!seen.has(u)) { seen.add(u); urls.push(u); }
  }
  return urls;
}

export default function ResourceLoader({ children }: ResourceLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(0);
  const [forceReady, setForceReady] = useState(false);
  const started = useRef(false);

  // 提前进入（用户点击跳过等待）
  const enterEarly = () => setDone(true);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const urls = collectAudioUrls();
    setTotal(urls.length);
    if (urls.length === 0) {
      setDone(true);
      return;
    }

    let ok = 0;
    let fail = 0;
    const markProgress = () => {
      const cur = ok + fail;
      setLoaded(cur);
      // 严格按已缓存资源数计算，仅最后一项完成时到 100%
      setProgress(Math.min(100, Math.round((cur / urls.length) * 100)));
    };
    const finishIfDone = () => {
      if (ok + fail >= urls.length) {
        // 100% 停留 ~ 200ms 再退出
        setProgress(100);
        setTimeout(() => setDone(true), 200);
      }
    };

    // 并发加载（避免浏览器并发上限）
    let idx = 0;
    const concurrency = Math.min(8, urls.length || 1);
    const run = () => {
      while (idx < urls.length) {
        const slot = idx++;
        const url = urls[slot];
        let finished = false;
        try {
          const a = new Audio();
          a.preload = 'auto';
          const cleanup = () => {
            if (finished) return;
            finished = true;
            ok++;
            markProgress();
            finishIfDone();
          };
          a.addEventListener('canplaythrough', cleanup, { once: true });
          a.addEventListener('loadeddata', cleanup, { once: true });
          a.addEventListener('error', () => {
            if (finished) return;
            finished = true;
            fail++;
            setFailed(fail);
            markProgress();
            finishIfDone();
          }, { once: true });
          a.src = url;
          try {
            a.load();
          } catch { /* ignore */ }
        } catch {
          if (finished) return;
          finished = true;
          fail++;
          setFailed(fail);
          markProgress();
          finishIfDone();
        }
      }
    };
    for (let i = 0; i < concurrency; i++) run();

    // 兜底：20 秒后仍未结束 → 允许手动进入（进度条保持真实值，不再强制跳到 100%）
    const force = setTimeout(() => {
      setForceReady(true);
    }, 20000);
    return () => clearTimeout(force);
  }, []);

  const percent = total === 0 ? 100 : progress;

  return (
    <>
      {children}
      <AnimatePresence>
        {!done && (
          <motion.div
            key="resource-loader-overlay"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="w-[90%] max-w-md rounded-2xl bg-black/40 p-8 shadow-2xl backdrop-blur-md ring-1 ring-white/10">
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">资源加载中</h2>
                  <p className="text-xs text-white/60 mt-0.5">
                    {total === 0 ? '准备进入...' : `语音包预热中 ${loaded}/${total}${failed ? `（失败 ${failed}）` : ''}`}
                  </p>
                </div>
              </div>

              {/* 进度条 */}
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                />
                {/* 顶部光泽流动 */}
                <motion.div
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-white/70 tabular-nums">
                  {percent}%{total > 0 && <span className="text-white/50">（{loaded}/{total}）</span>}
                </span>
                <span className="text-white/50">首次加载完成后会自动缓存在本地</span>
              </div>

              {/* 提前进入按钮：加载完成前可跳过等待 */}
              {percent < 100 && (
                <div className="mt-5 flex flex-col items-center gap-2">
                  <button
                    onClick={enterEarly}
                    className="px-6 py-2 rounded-xl text-sm font-bold text-emerald-300 bg-emerald-500/10 ring-1 ring-emerald-400/30 hover:bg-emerald-500/20 hover:ring-emerald-400/50 transition-all duration-200"
                  >
                    提前进入游戏
                  </button>
                  <span className="text-[11px] text-white/40">
                    {forceReady
                      ? '加载较慢，建议先进入，资源会在后台继续缓存'
                      : '等待读条完成将自动进入；也可现在就进入，资源在后台继续缓存'}
                  </span>
                </div>
              )}

              <div className="mt-4 text-[11px] text-white/40 leading-relaxed">
                提示：加载时长取决于网络与磁盘速度；加载完成后后续对局不会再预热。
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

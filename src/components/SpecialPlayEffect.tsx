import DphEffects from './dph/DphEffects';
import { DPH_THEME } from '@/config/dphTheme';
// 炸弹/王炸出牌特效 —— 全屏覆盖层动画（不阻挡操作，pointer-events-none）
// 触发时机与语音/爆炸音同拍（gameStore 逐快照应用 state，本组件监视新出现的特殊牌）
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ComboPlayEffect from './dph/ComboPlayEffect';
import { COMBO_EFFECT_MS, type PlayEffectType } from '@/lib/playEffects';
import { usePresentationStore, ROCKET_VIDEO_URLS, BOMB_VIDEO_URLS } from '@/store/presentationStore';
import TransparentVideoEffect from './dph/TransparentVideoEffect';

export interface SpecialPlayEffectData {
  type: PlayEffectType;
  key: string; // 去重用的牌唯一标识
  seat?: number;
}

interface SpecialPlayEffectProps {
  effect: SpecialPlayEffectData | null;
  onDone: () => void;
}

// ---------- 入口：动画播完自动收场 ----------
export default function SpecialPlayEffect({ effect, onDone }: SpecialPlayEffectProps) {
  return <AnimatePresence>{effect && <ActiveEffect key={effect.key} effect={effect} onDone={onDone} />}</AnimatePresence>;
}

function ActiveEffect({ effect, onDone }: { effect: SpecialPlayEffectData; onDone: () => void }) {
  const done = useRef(onDone);
  const [doubling, setDoubling] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [source] = useState(() => {
    const settings = usePresentationStore.getState();
    if (effect.type === 'rocket' && settings.rocketEffect !== 'original') return ROCKET_VIDEO_URLS[settings.rocketEffect];
    if (effect.type === 'bomb' && settings.bombEffect !== 'original') return BOMB_VIDEO_URLS[settings.bombEffect];
    return null;
  });
  const video = source && !videoFailed;
  done.current = onDone;
  // Use the theme duration so the rocket's landing explosion can finish.
  useEffect(() => {
    if (doubling) {
      const finish = setTimeout(() => done.current(), 900);
      return () => clearTimeout(finish);
    }
    // A video finishes on its actual ended event, rather than the canvas clock.
    if (video) return;
    const duration = effect.type === 'bomb' ? DPH_THEME.effects.bombMs : effect.type === 'rocket' ? DPH_THEME.effects.rocketMs : COMBO_EFFECT_MS[effect.type];
    const doubles = effect.type === 'bomb' || effect.type === 'rocket';
    const t = setTimeout(() => doubles ? setDoubling(true) : done.current(), duration);
    return () => clearTimeout(t);
  }, [effect, video, doubling]);

  return (
        <motion.div
          key={effect.key}
          className="fixed inset-0 z-[55] pointer-events-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          {doubling ? <motion.div className="ddz-double-prompt" role="status" aria-label="倍数乘2"
            initial={{ opacity: 0, scale: .5 }} animate={{ opacity: [0, 1, 1, 0], scale: [.5, 1.15, 1, 1.05] }}
            transition={{ duration: .9, times: [0, .2, .75, 1] }}><strong>×2</strong><small>倍数翻倍</small></motion.div>
            : video ? <TransparentVideoEffect src={source!}
              label={effect.type === 'rocket' ? '透明王炸视频特效' : '透明炸弹视频特效'} onEnded={() => setDoubling(true)} onUnavailable={() => {
              setVideoFailed(true);
            }} />
              : effect.type === 'bomb' || effect.type === 'rocket' ? <DphEffects type={effect.type} seat={effect.seat} /> : <ComboPlayEffect type={effect.type} />}
        </motion.div>
  );
}

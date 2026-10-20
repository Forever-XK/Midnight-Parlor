import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronLeft, Layers, Mic, Music2, Palette, Play, RotateCw, Settings2, Sparkles, Sun, Moon, Volume2, VolumeX, X, Clapperboard } from 'lucide-react';
import type { Card, Play as CardPlay, Rank } from '@shared/types';
import { DPH_THEME } from '@/config/dphTheme';
import { useCardStyleStore, CARD_FACES } from '@/store/cardStyleStore';
import { useCardBackStore, CARD_BACKS } from '@/store/cardBackStore';
import { useTableStyleStore, TABLE_STYLES, getTableBackground } from '@/store/tableStyleStore';
import { useThemeStore } from '@/store/themeStore';
import { useUiScaleStore, UI_SCALES } from '@/store/uiScaleStore';
import { useUserStore } from '@/store/userStore';
import { usePresentationStore, VOICE_PACKS, ROCKET_EFFECTS, BOMB_EFFECTS } from '@/store/presentationStore';
import { useGameStore } from '@/store/gameStore';
import { sound, BGM_PACKS, type BgmName } from '@/lib/soundManager';
import { SPRING_EFFECT_MS, VICTORY_EFFECT_MS } from '@/lib/roundPresentation';
import type { PlayEffectType } from '@/lib/playEffects';
import PlayingCard from './PlayingCard';
import SpecialPlayEffect from './SpecialPlayEffect';
import SpringEffect from './dph/SpringEffect';
import VictoryEffect from './dph/VictoryEffect';
import LaiziDrawAnimation from './LaiziDrawAnimation';
import PacketDealingAnimation from './PacketDealingAnimation';
import SeatPlayArea from './SeatPlayArea';

const categories = [
  { id: 'face', label: '牌面', icon: Layers, hint: '选择喜欢的牌面，点击上方手牌可试选牌。' },
  { id: 'back', label: '牌背', icon: Layers, hint: '牌背会同步显示在两侧牌堆与发牌动画中。' },
  { id: 'background', label: '背景', icon: Palette, hint: '换一方天地，布置你的专属牌桌。' },
  { id: 'music', label: '音乐', icon: Music2, hint: '选择音乐包，也可以试听大厅、对局与紧张时刻的音乐。' },
  { id: 'voice', label: '语音', icon: Mic, hint: '选择报牌口音与自己的声线，点击上方按钮试听；其他玩家保留各自声线。' },
  { id: 'rocket', label: '特效切换', icon: Clapperboard, hint: '分别设置王炸和炸弹特效，点击选项可预览并自动保存。' },
  { id: 'effects', label: '特效预览', icon: Sparkles, hint: '点击下方特效在上方牌桌播放，再次点击可重播。' },
] as const;
type Category = typeof categories[number]['id'];
type PreviewId = PlayEffectType | 'spring' | 'anti_spring' | 'landlord_win' | 'peasant_win' | 'laizi' | 'packets';
const effects: { id: PreviewId; name: string; mark: string }[] = [
  { id: 'straight', name: '顺子', mark: '345' }, { id: 'pair_straight', name: '连对', mark: '3344' },
  { id: 'airplane', name: '飞机', mark: '✈' }, { id: 'bomb', name: '炸弹', mark: '💣' }, { id: 'rocket', name: '王炸', mark: '🚀' },
  { id: 'spring', name: '春天', mark: '✿' }, { id: 'anti_spring', name: '反春', mark: '✿' },
  { id: 'landlord_win', name: '地主获胜', mark: '♛' }, { id: 'peasant_win', name: '农民获胜', mark: '♧' },
  { id: 'laizi', name: '选癞子', mark: '✦' }, { id: 'packets', name: '不洗牌发牌', mark: '4+4' },
];
const deck: Card[] = ['club', 'heart', 'spade', 'diamond'].flatMap(suit =>
  Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i + 3}`, suit: suit as Card['suit'], rank: (i + 3) as Rank })));
const sample: Card[] = [
  { id: 'preview-big-joker', suit: 'joker', rank: 17 },
  { id: 'preview-small-joker', suit: 'joker', rank: 16 },
  ...(['spade', 'heart', 'club', 'diamond'] as const).map(suit => ({ id: `preview-${suit}-a`, rank: 14 as const, suit })),
];
const tracks: { id: BgmName; name: string }[] = [{ id: 'Welcome', name: '大厅' }, { id: 'Gaming', name: '对局' }, { id: 'Exciting', name: '紧张时刻' }];

export default function Personalization({ onClose, fullPage = false }: { onClose: () => void; fullPage?: boolean }) {
  const [category, setCategory] = useState<Category>('face');
  const { face, setFace } = useCardStyleStore();
  const { back, setBack } = useCardBackStore();
  const { style, setStyle } = useTableStyleStore();
  const { theme, toggleTheme } = useThemeStore();
  const { scale, setScale } = useUiScaleStore();
  const { username, gender, setProfile } = useUserStore();
  const { voicePack, setVoicePack, rocketEffect, setRocketEffect, bombEffect, setBombEffect } = usePresentationStore();
  const [effectKind, setEffectKind] = useState<'rocket' | 'bomb'>('rocket');
  const soundEnabled = useGameStore(s => s.soundEnabled);
  const toggleSound = useGameStore(s => s.toggleSound);
  const [pack, setPack] = useState(() => sound.getPack());
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: PreviewId; key: string } | null>(null);
  const [lastEffect, setLastEffect] = useState<PreviewId>('straight');
  const [track, setTrack] = useState<BgmName | null>(null);
  const originalTrack = useRef<BgmName | null | undefined>(undefined);
  const [name, setName] = useState(username);
  const tabs = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const previewNumber = useRef(0);
  const isLight = theme === 'light';
  const tableBg = getTableBackground(style, isLight) ?? (isLight
    ? 'radial-gradient(ellipse,#2d8a5e,#0f5a38)' : 'radial-gradient(ellipse,#0f6048,#063326)');

  const restoreTrack = () => {
    if (originalTrack.current === undefined) return;
    const previous = originalTrack.current;
    originalTrack.current = undefined;
    if (previous) sound.playBgm(previous); else sound.stopBgm();
  };
  useEffect(() => () => {
    sound.stopVoicePreview();
    const previous = originalTrack.current;
    if (previous !== undefined) { if (previous) sound.playBgm(previous); else sound.stopBgm(); }
  }, []);
  useEffect(() => {
    if (!preview) return;
    const ms = preview.id === 'spring' || preview.id === 'anti_spring' ? SPRING_EFFECT_MS
      : preview.id === 'landlord_win' || preview.id === 'peasant_win' ? VICTORY_EFFECT_MS : 0;
    if (!ms) return;
    const timer = setTimeout(() => setPreview(null), ms);
    return () => clearTimeout(timer);
  }, [preview]);
  const selectCategory = (next: Category) => {
    sound.stopVoicePreview();
    setCategory(next); setPreview(null);
    if (next !== 'music') { restoreTrack(); setTrack(null); }
  };
  const replay = (id: PreviewId) => { setLastEffect(id); setPreview({ id, key: `personalization-${++previewNumber.current}` }); };
  const current = categories.find(item => item.id === category)!;
  const label = category === 'face' ? CARD_FACES.find(item => item.id === face)?.name
    : category === 'back' ? CARD_BACKS.find(item => item.id === back)?.name
      : category === 'background' ? TABLE_STYLES.find(item => item.id === style)?.name
        : category === 'music' ? BGM_PACKS.find(item => item.id === pack)?.name
          : category === 'voice' ? `${VOICE_PACKS.find(item => item.id === voicePack)?.name} · ${gender === 'female' ? '女声' : '男声'}`
            : category === 'rocket' ? (effectKind === 'rocket' ? ROCKET_EFFECTS.find(item => item.id === rocketEffect)?.name : BOMB_EFFECTS.find(item => item.id === bombEffect)?.name) : effects.find(item => item.id === lastEffect)?.name;
  const isPlayEffect = preview && ['bomb', 'rocket', 'straight', 'pair_straight', 'airplane'].includes(preview.id);
  const heavyPreview: CardPlay | null = preview && (preview.id === 'bomb' || preview.id === 'rocket') ? {
    type: preview.id, cards: preview.id === 'rocket' ? sample.slice(0, 2) : sample.slice(2),
    mainRank: preview.id === 'rocket' ? 17 : 14, length: 1,
  } : null;

  return <div className={`personalization ${fullPage ? 'personalization-page' : ''}`} data-theme={theme}>
    <header className="personalization-header">
      <button className="personalization-icon" onClick={onClose} aria-label={fullPage ? '返回大厅' : '关闭个性化'}>{fullPage ? <ChevronLeft size={20} /> : <X size={20} />}</button>
      <div><small>MAKE IT YOURS</small><h1>个性化</h1></div><span className="personalization-saved"><Check size={13} /> 已自动保存</span>
      <div className="personalization-tools">
        <button className="personalization-icon" onClick={toggleSound} aria-label={soundEnabled ? '关闭声音' : '开启声音'}>{soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
        <button className="personalization-icon" onClick={toggleTheme} aria-label={isLight ? '切换深色' : '切换浅色'}>{isLight ? <Moon size={19} /> : <Sun size={19} />}</button>
        <details className="personalization-more"><summary aria-label="资料与界面缩放"><Settings2 size={19} /></summary>
          <div className="personalization-more-panel">
            <label>牌桌昵称<input value={name} onChange={e => setName(e.target.value)} maxLength={12} /></label>
            <button className="personalization-small-button" disabled={!name.trim() || name.trim() === username} onClick={() => { setProfile(name, gender); void useGameStore.getState().loadStats(); }}>保存资料</button>
            <label>界面缩放<select value={scale} onChange={e => setScale(Number(e.target.value) as typeof scale)}>{UI_SCALES.map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select></label>
          </div>
        </details>
      </div>
    </header>

    <div className="personalization-stage" style={{ background: tableBg }} aria-label="当前个性化设置实时预览" data-preview-face={face} data-preview-back={back} data-preview-background={style}>
      <div className="personalization-stage-shade" />
      <div className="personalization-stage-heading"><span>实时预览</span><strong>{label}</strong><small>{category === 'effects' ? '动效在这张牌桌上播放' : '所有调整即时生效'}</small></div>
      <div className="personalization-opponent opponent-left"><img src={DPH_THEME.avatars[0]} alt="左侧玩家" /><span>上家</span><div className="personalization-back-stack">{[0, 1, 2].map(i => <PlayingCard key={i} card={sample[0]} faceDown size="sm" />)}</div></div>
      <div className="personalization-opponent opponent-right"><img src={DPH_THEME.avatars[1]} alt="右侧玩家" /><span>下家</span><div className="personalization-back-stack">{[0, 1, 2].map(i => <PlayingCard key={i} card={sample[0]} faceDown size="sm" />)}</div></div>
      <div className="personalization-table-mark">DOU DI ZHU<small>我的牌桌 · 我的风格</small></div>
      {category === 'music' && <div className="personalization-music-player"><Music2 size={26} /><strong>{BGM_PACKS.find(item => item.id === pack)?.name} · {track ? tracks.find(item => item.id === track)?.name : '音乐包'}</strong>
        <div>{tracks.map(item => <button key={item.id} aria-pressed={track === item.id} onClick={() => {
          if (originalTrack.current === undefined) originalTrack.current = sound.getBgmName();
          setTrack(item.id); sound.playBgm(item.id);
        }}><Play size={12} /> {item.name}</button>)}</div>
        {track && <button onClick={() => { restoreTrack(); setTrack(null); }}>结束试听</button>}
        {!soundEnabled && <small>声音已关闭，可在右上角开启后试听</small>}
      </div>}
      {category === 'voice' && <div className="personalization-music-player personalization-voice-player"><Mic size={26} /><strong>{label}</strong>
        <div>{[{ name: '叫三分', clip: 'qiangdizhu2' }, { name: '顺子', clip: 'shunzi' }, { name: '王炸', clip: 'wangzha' }].map(item =>
          <button key={item.clip} onClick={() => sound.previewVoice(gender, item.clip)}><Play size={12} />{item.name}</button>)}</div>
        <small>{soundEnabled ? '选择下方声音，或点击按钮试听' : '声音已关闭，可在右上角开启后试听'}</small>
      </div>}
      <div className="personalization-hand"><span>{username || '我的手牌'}<small>点击牌面体验选牌</small></span><div data-seat-hand="0">{sample.map(card => <PlayingCard key={card.id} card={card} selected={selected === card.id} size="md"
        className={heavyPreview?.cards.some(item => item.id === card.id) ? 'invisible' : undefined}
        onClick={() => setSelected(selected === card.id ? null : card.id)} />)}</div></div>
      <div className="personalization-preview-effects">
        {heavyPreview && preview && <div className="personalization-heavy-cards"><SeatPlayArea key={preview.key} gameId={preview.key} seat={0}
          play={heavyPreview} position="bottom" isPassing={false} onPlayStart={play => sound.playCards(0, play)} /></div>}
        {isPlayEffect && preview && <SpecialPlayEffect key={preview.key} effect={{ type: preview.id as PlayEffectType, key: preview.key }} onDone={() => setPreview(null)} />}
        {preview && (preview.id === 'spring' || preview.id === 'anti_spring') && <SpringEffect key={preview.key} reverse={preview.id === 'anti_spring'} />}
        {preview && (preview.id === 'landlord_win' || preview.id === 'peasant_win') && <VictoryEffect key={preview.key} winner={preview.id === 'landlord_win' ? 'landlord' : 'peasant'} />}
        {preview?.id === 'laizi' && <LaiziDrawAnimation key={preview.key} label="癞子" rank={14} onDone={() => setPreview(null)} />}
        {preview?.id === 'packets' && <PacketDealingAnimation key={preview.key} mySeat={0} gameId={preview.key} players={[
          { seat: 0, name: '我', cardCount: 17, isHuman: true, hand: deck.slice(0, 17) },
          { seat: 1, name: '下家', cardCount: 17, isHuman: false }, { seat: 2, name: '上家', cardCount: 17, isHuman: false },
        ]} onDone={() => setPreview(null)} />}
      </div>
    </div>

    <section className="personalization-picker">
      <div className="personalization-picker-heading"><div><h2>{current.label}<span>{label}</span></h2><p>{current.hint}</p></div>
        {category === 'rocket' && <div className="personalization-effect-types" role="group" aria-label="选择特效牌型">
          {(['rocket', 'bomb'] as const).map(kind => <button key={kind} aria-pressed={effectKind === kind} onClick={() => { setEffectKind(kind); setPreview(null); }}>{kind === 'rocket' ? '王炸特效' : '炸弹特效'}</button>)}
        </div>}
        {(category === 'effects' || category === 'rocket') && <button className="personalization-small-button" onClick={() => replay(category === 'rocket' ? effectKind : lastEffect)}><RotateCw size={14} /> 重播</button>}
      </div>
      <div className="personalization-options" role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${category}`}>
        {category === 'voice' && VOICE_PACKS.flatMap(item => (['male', 'female'] as const).map(voiceGender =>
          <button key={`${item.id}-${voiceGender}`} className="personalization-option" aria-pressed={voicePack === item.id && gender === voiceGender} onClick={() => {
            setVoicePack(item.id); setProfile(username, voiceGender); sound.setPlayerGender(voiceGender); sound.previewVoice(voiceGender, 'qiangdizhu2');
          }}><div className="personalization-effect-mark"><Mic size={28} /></div><strong>{item.name} · {voiceGender === 'female' ? '女声' : '男声'}</strong><small>{item.desc} · 点击试听</small>
            {voicePack === item.id && gender === voiceGender && <Check className="personalization-option-check" size={15} />}</button>))}
        {category === 'rocket' && effectKind === 'rocket' && ROCKET_EFFECTS.map(item => <button key={item.id} className="personalization-option" aria-pressed={rocketEffect === item.id} onClick={() => {
          setRocketEffect(item.id); replay('rocket');
        }}><div className="personalization-effect-mark">{item.id !== 'original' ? <Clapperboard size={30} /> : '🚀'}</div><strong>{item.name}</strong><small>{item.desc}</small>
          {rocketEffect === item.id && <Check className="personalization-option-check" size={15} />}</button>)}
        {category === 'rocket' && effectKind === 'bomb' && BOMB_EFFECTS.map(item => <button key={item.id} className="personalization-option" aria-pressed={bombEffect === item.id} onClick={() => {
          setBombEffect(item.id); replay('bomb');
        }}><div className="personalization-effect-mark">{item.id !== 'original' ? <Clapperboard size={30} /> : '💣'}</div><strong>{item.name}</strong><small>{item.desc}</small>
          {bombEffect === item.id && <Check className="personalization-option-check" size={15} />}</button>)}
        {category === 'face' && CARD_FACES.map(item => <button key={item.id} className="personalization-option" aria-pressed={face === item.id} onClick={() => setFace(item.id)}>
          <div className="personalization-card-thumb"><PlayingCard card={{ id: 'face-thumb', suit: 'spade', rank: 14 }} size="sm" faceStyle={item.id} /></div><strong>{item.name}</strong><small>{item.desc}</small>{face === item.id && <Check className="personalization-option-check" size={15} />}
        </button>)}
        {category === 'back' && CARD_BACKS.map(item => <button key={item.id} className="personalization-option" aria-pressed={back === item.id} onClick={() => setBack(item.id)}>
          <div className="personalization-card-thumb"><PlayingCard card={sample[0]} faceDown size="sm" backStyle={item.id} /></div><strong>{item.name}</strong><small>{item.desc}</small>{back === item.id && <Check className="personalization-option-check" size={15} />}
        </button>)}
        {category === 'background' && TABLE_STYLES.map(item => <button key={item.id} className="personalization-option" aria-pressed={style === item.id} onClick={() => setStyle(item.id)}>
          <div className="personalization-background-thumb" style={{ background: getTableBackground(item.id, isLight) ?? 'radial-gradient(ellipse,#0f6048,#063326)' }} /><strong>{item.name}</strong><small>{item.desc}</small>{style === item.id && <Check className="personalization-option-check" size={15} />}
        </button>)}
        {category === 'music' && BGM_PACKS.map((item, index) => <button key={item.id} className="personalization-option" aria-pressed={pack === item.id} onClick={() => { sound.setPack(item.id); setPack(item.id); }}>
          <div className="personalization-record"><Music2 size={30} /><span>0{index + 1}</span></div><strong>{item.name}</strong><small>{item.desc}</small>{pack === item.id && <Check className="personalization-option-check" size={15} />}
        </button>)}
        {category === 'effects' && effects.map(item => <button key={item.id} className="personalization-option" aria-pressed={lastEffect === item.id} onClick={() => replay(item.id)}>
          <div className="personalization-effect-mark">{item.mark}</div><strong>{item.name}</strong><small>点击播放</small>{lastEffect === item.id && <Check className="personalization-option-check" size={15} />}
        </button>)}
      </div>
      <div className="personalization-tabs" ref={tabs} role="tablist" aria-label="个性化分类" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const index = categories.findIndex(item => item.id === category);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? categories.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + categories.length) % categories.length;
        selectCategory(categories[next].id); (tabs.current?.children[next] as HTMLElement)?.focus();
      }}>{categories.map(item => <button key={item.id} id={`${panelId}-${item.id}`} role="tab" aria-controls={panelId} aria-selected={category === item.id} tabIndex={category === item.id ? 0 : -1} onClick={() => selectCategory(item.id)}><item.icon size={20} /><span>{item.label}</span></button>)}</div>
    </section>
  </div>;
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, ChevronRight, Globe, Settings, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useUserStore } from '@/store/userStore';
import SettingsPanel from '@/components/SettingsPanel';
import ChangelogPanel from '@/components/ChangelogPanel';
import LeaderboardPanel from '@/components/LeaderboardPanel';
import { registerUser } from '@/lib/api';
import { sound } from '@/lib/soundManager';
import { DPH_THEME, DPH_MODES, DPH_DIFFICULTIES } from '@/config/dphTheme';

export default function Home() {
  const navigate = useNavigate();
  const { mode, difficulty, setMode, setDifficulty, startGame, loading, stats, loadStats, soundEnabled, toggleSound, error } = useGameStore();
  const { username, gender, setProfile } = useUserStore();
  const [panel, setPanel] = useState<'rules' | 'stats' | 'profile' | null>(null);
  const [settings, setSettings] = useState(false);
  const [changelog, setChangelog] = useState(false);
  const [leaderboard, setLeaderboard] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [name, setName] = useState(username);
  const [voice, setVoice] = useState(gender);
  const current = DPH_MODES.find(item => item.id === mode) ?? DPH_MODES[0];
  useEffect(() => { loadStats(); sound.playBgm('Welcome'); }, [loadStats]);
  useEffect(() => { if (username) void registerUser(username).catch(() => {}); }, [username]);
  const enter = async () => {
    sound.ensureBgm('Welcome');
    if (!useUserStore.getState().username) { setPanel('profile'); return; }
    await startGame();
    if (!useGameStore.getState().error && useGameStore.getState().state) navigate('/game');
  };
  const saveProfile = async () => {
    if (!name.trim()) return;
    setProfileSaving(true); setProfileError('');
    try {
      await registerUser(name.trim());
      setProfile(name, voice); setPanel(null); sound.ensureBgm('Welcome'); loadStats();
    } catch { setProfileError('保存失败，请确认游戏服务已启动后重试。'); }
    finally { setProfileSaving(false); }
  };
  return <div className="dph-home">
    <div className="dph-scenery" style={{ backgroundImage: `url(${DPH_THEME.background})` }} />
    <header className="dph-header">
      <a className="dph-brand" href="/" aria-label="斗地主首页"><span>♠</span><div>斗地主<small>一 起 好 好 玩 牌</small></div></a>
      <div className="dph-header-right">
        <button className="dph-profile" onClick={() => { setName(username); setVoice(gender); setPanel('profile'); }}>
          <img src={DPH_THEME.avatars[0]} alt="玩家头像" /><span>{username || '初来乍到'}<small>{username ? '欢迎回到牌桌' : '设置你的牌桌昵称'}</small></span>
        </button>
        <span className="dph-header-divider" />
        <button className="dph-icon" onClick={toggleSound} aria-label={soundEnabled ? '关闭声音' : '开启声音'}>{soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
      </div>
    </header>
    <main className="dph-main">
      <section className="dph-welcome">
        <div className="dph-eyebrow"><span /> 好时光 · 好牌友</div>
        <h1>闲来一局，<br /><em>好牌登场。</em></h1>
        <p>把忙碌暂放一旁。<br />在这方小小牌桌，遇见出其不意的精彩。</p>
        <div className="dph-host-wrap"><div className="dph-host-halo" /><img className="dph-host" src={DPH_THEME.host} alt="在庭院中等候牌友的看板角色" /><div className="dph-host-note">牌桌已经备好，就等你啦！<span>✦</span></div></div>
        <div className="dph-scene-caption"><i /> 庭院小憩 <span>COURTYARD / 01</span></div>
      </section>
      <section className="dph-play-panel" aria-label="选择玩法">
        <div className="dph-panel-heading"><div><span className="dph-eyebrow">LET’S PLAY</span><h2>今天，玩点什么？</h2></div><span className="dph-stamp">好牌<br />开场</span></div>
        <div className="dph-modes">{DPH_MODES.map((item, index) => <button key={item.id} className={`dph-mode ${mode === item.id ? 'is-selected' : ''}`} onClick={() => setMode(item.id)} aria-pressed={mode === item.id}>
          <span className={`dph-mode-symbol symbol-${index}`}>{item.mark}</span><span className="dph-mode-name">{item.name}<small>{item.subtitle}</small></span>{mode === item.id ? <span className="dph-mode-check"><Check size={15} /></span> : <ChevronRight size={17} />}
        </button>)}</div>
        <div className="dph-mode-description" aria-live="polite">{current.description}</div>
        <div className="dph-difficulty-label"><span>对手难度</span><small>找到适合你的节奏</small></div>
        <div className="dph-difficulties">{DPH_DIFFICULTIES.map(item => <button key={item.id} onClick={() => setDifficulty(item.id)} aria-pressed={difficulty === item.id} className={difficulty === item.id ? 'is-selected' : ''}>{item.name}<small>{item.description}</small></button>)}</div>
        {error && <div className="dph-error" role="alert">{error}，请确认游戏服务已启动后重试。</div>}
        <button className="dph-start" disabled={loading} onClick={enter}><span>{loading ? '正在准备牌桌…' : '开始对战'}<small>{current.name} · {DPH_DIFFICULTIES.find(d => d.id === difficulty)?.name}</small></span><ArrowRight size={25} /></button>
        <button className="dph-online" onClick={() => { if (!username) { setPanel('profile'); return; } sound.ensureBgm('Welcome'); navigate('/lobby'); }}><Globe size={17} /><span>好友同桌<small>创建房间，邀请朋友一起玩</small></span><ArrowRight size={18} /></button>
      </section>
    </main>
    <footer className="dph-footer"><span>每一手，都是新的可能。</span><nav><button onClick={() => setSettings(true)}><Settings size={15} /> 个性化</button><button onClick={() => setLeaderboard(true)}><Trophy size={15} /> 排行榜</button><button onClick={() => setPanel('stats')}><Trophy size={15} /> 我的战绩</button><button onClick={() => setPanel('rules')}><BookOpen size={15} /> 玩法说明</button><button onClick={() => setChangelog(true)}>更新日志 <span>↗</span></button></nav><small>DOU DI ZHU · V2.0.0</small></footer>
    {panel && <div className="dph-modal-scrim" onClick={() => setPanel(null)}><section className="dph-dialog" role="dialog" aria-modal="true" aria-labelledby="dph-dialog-title" onClick={e => e.stopPropagation()}><button className="dph-dialog-close" aria-label="关闭" onClick={() => setPanel(null)}><X size={20} /></button>
      <span className="dph-eyebrow">A SEAT FOR YOU</span><h2 id="dph-dialog-title">{panel === 'profile' ? '认识一下，新牌友' : panel === 'stats' ? '你的牌桌足迹' : '好牌，从这里开始'}</h2>
      {panel === 'profile' ? <form onSubmit={e => { e.preventDefault(); saveProfile(); }}><label htmlFor="player-name">牌桌昵称</label><input id="player-name" autoFocus maxLength={12} value={name} placeholder="输入昵称，最多 12 字" onChange={e => setName(e.target.value)} required /><label>语音声线</label><div className="dph-difficulties">{(['male', 'female'] as const).map(g => <button type="button" key={g} aria-pressed={voice === g} className={voice === g ? 'is-selected' : ''} onClick={() => setVoice(g)}>{g === 'male' ? '男声' : '女声'}</button>)}</div><button className="dph-start" disabled={!name.trim() || profileSaving} type="submit">{profileSaving ? '正在保存…' : '保存，回到大厅'} <ArrowRight size={20} /></button>{profileError && <p className="dph-error" role="alert">{profileError}</p>}</form> : panel === 'stats' ? <div className="dph-stats"><div><b>{stats?.gamesPlayed ?? 0}</b>总场次</div><div><b>{stats?.wins ?? 0}</b>获胜场次</div><div><b>{stats?.gamesPlayed ? Math.round(stats.wins / stats.gamesPlayed * 100) : 0}%</b>胜率</div></div> : <div className="dph-rules"><p>三人一桌，一人为地主，两人为农民。地主先出牌，任意一方率先出完手牌即获胜。</p><p>点数从小到大：3 至 K、A、2、小王、大王。可打单张、对子、三带、顺子、连对、飞机与炸弹；相同牌型比较点数，炸弹可压普通牌型，王炸最大。</p><p>叫分越高越有机会成为地主；炸弹、王炸和春天将增加倍数。癞子、天地癞子与闷抓模式沿用现有规则，可在对局中体验。癞子不洗牌使用单癞子规则，按 4+4+4+5 分批展示发牌并理牌，牌型聚集程度介于经典和不洗牌之间。</p></div>}
    </section></div>}
    {leaderboard && <LeaderboardPanel username={username} onClose={() => setLeaderboard(false)} />}
    <SettingsPanel open={settings} onClose={() => setSettings(false)} /><ChangelogPanel open={changelog} onClose={() => setChangelog(false)} />
  </div>;
}

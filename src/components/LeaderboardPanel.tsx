import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, RefreshCw, Trophy, X } from 'lucide-react';
import type { LeaderboardEntry, LeaderboardSort, SortOrder } from '@shared/types';
import { sortLeaderboard } from '@shared/leaderboard';
import { getLeaderboard, registerUser } from '@/lib/api';
import './leaderboard.css';

const columns: { key: LeaderboardSort; label: string }[] = [
  { key: 'gamesPlayed', label: '对局数' }, { key: 'wins', label: '胜利局数' }, { key: 'winRate', label: '胜率' },
];

export default function LeaderboardPanel({ username, onClose }: { username: string; onClose: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sort, setSort] = useState<LeaderboardSort>('wins');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (username) await registerUser(username);
      setEntries(await getLeaderboard());
    } catch { setError('排行榜加载失败，请重试。'); }
    finally { setLoading(false); }
  }, [username]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);
  const sorted = useMemo(() => sortLeaderboard(entries, sort, order), [entries, sort, order]);
  const changeSort = (key: LeaderboardSort) => {
    setOrder(key === sort && order === 'desc' ? 'asc' : 'desc');
    setSort(key);
  };
  return <div className="dph-modal-scrim" onClick={onClose}>
    <section className="dph-dialog dph-leaderboard" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title" onClick={e => e.stopPropagation()}>
      <button className="dph-dialog-close" aria-label="关闭排行榜" onClick={onClose} autoFocus><X size={20} /></button>
      <span className="dph-eyebrow">THE HONOR TABLE</span>
      <h2 id="leaderboard-title"><Trophy size={26} /> 牌桌排行榜</h2>
      <p className="dph-leaderboard-intro">好牌有运气，常胜有本事。看看牌友们的战绩吧。</p>
      <div className="dph-leaderboard-toolbar"><span>全部玩家 · {entries.length} 位</span><button onClick={() => void load()} disabled={loading}><RefreshCw size={14} />{loading ? '正在更新…' : '刷新战绩'}</button></div>
      <div className="dph-leaderboard-scroll" aria-busy={loading}>
        <table>
          <caption className="sr-only">所有玩家战绩，点击对局数、胜利局数或胜率列头切换排序</caption>
          <thead><tr><th scope="col">名次</th><th scope="col">玩家</th>{columns.map(({ key, label }) => <th key={key} scope="col" aria-sort={sort === key ? (order === 'desc' ? 'descending' : 'ascending') : 'none'}><button onClick={() => changeSort(key)}>{label}{sort === key ? order === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} /> : <ChevronsUpDown size={13} />}</button></th>)}</tr></thead>
          <tbody>{sorted.map((entry, index) => <tr key={entry.username} className={entry.username === username ? 'is-me' : ''}>
            <td><span className={`dph-rank ${index < 3 ? `rank-${index + 1}` : ''}`}>{index + 1}</span></td>
            <th scope="row"><span>{entry.username}</span>{entry.username === username && <small>我</small>}</th>
            <td>{entry.gamesPlayed}</td><td>{entry.wins}</td><td>{(entry.winRate * 100).toFixed(1)}<small>%</small></td>
          </tr>)}</tbody>
        </table>
        {loading && !entries.length && <p className="dph-leaderboard-message" role="status">正在整理牌友们的战绩…</p>}
        {!loading && !error && !entries.length && <p className="dph-leaderboard-message">还没有玩家，保存昵称后即可加入排行榜。</p>}
      </div>
      {error && <p className="dph-error" role="alert">{error}<button onClick={() => void load()}>重新加载</button></p>}
      <p className="dph-leaderboard-note">点击列名切换升序 / 降序 · 胜率 = 胜利局数 ÷ 已完成对局数<br />统计所有玩法的已完成对局，未开局玩家的胜率显示为 0%。</p>
    </section>
  </div>;
}

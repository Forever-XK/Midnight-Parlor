import type { LeaderboardEntry, LeaderboardSort, SortOrder } from './types';

/** 同值时按对局数、胜局数及昵称排序，刷新和切换方向后顺序依然稳定。 */
export function sortLeaderboard(entries: LeaderboardEntry[], sort: LeaderboardSort, order: SortOrder): LeaderboardEntry[] {
  return [...entries].sort((a, b) =>
    (a[sort] - b[sort]) * (order === 'asc' ? 1 : -1)
    || b.gamesPlayed - a.gamesPlayed
    || b.wins - a.wins
    || a.username.localeCompare(b.username, 'zh-CN'));
}

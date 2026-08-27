// 战绩存储服务 —— 基于 JSON 文件持久化，按用户名分档（不同用户互不干扰）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Stats, Role } from '@shared/types';

// esbuild CJS 打包时 import.meta.url 为空 → 回退 cwd（打包场景由 DDZ_DATA_DIR 覆盖）
const __dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)); } catch { return process.cwd(); }
})();
// DDZ_DATA_DIR：Electron 打包等场景指定可写数据目录（默认源码目录 api/data）
const DATA_DIR = process.env.DDZ_DATA_DIR || path.join(__dirname, '..', 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// 旧版（单用户）stats.json 中已产生战绩的默认归属名
const LEGACY_USER = '玩家';
const DEFAULT_USER = '玩家';

const DEFAULT_STATS: Stats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  landlordWins: 0,
  landlordGames: 0,
  peasantWins: 0,
  peasantGames: 0,
  currentStreak: 0,
  maxStreak: 0,
  history: [],
};

// 存储结构：{ users: { [用户名]: Stats } }
interface StatsFile {
  users: Record<string, Stats>;
}

function defaultFile(): StatsFile {
  return { users: {} };
}

/** 读取整个文件（旧版顶层 Stats 格式自动迁移为多用户格式） */
function readFile(): StatsFile {
  ensureFile();
  try {
    const raw = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      if (raw.users && typeof raw.users === 'object') {
        // 新格式
        const users: Record<string, Stats> = {};
        for (const [name, st] of Object.entries(raw.users)) {
          users[name] = { ...DEFAULT_STATS, ...(st as object) };
        }
        return { users };
      }
      // 旧格式：顶层即单个用户的 Stats（含 gamesPlayed 等字段）
      if (typeof raw.gamesPlayed === 'number' && raw.gamesPlayed > 0) {
        return { users: { [LEGACY_USER]: { ...DEFAULT_STATS, ...raw } } };
      }
    }
    return defaultFile();
  } catch {
    return defaultFile();
  }
}

function writeFile(file: StatsFile): void {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(file, null, 2), 'utf-8');
}

function ensureFile(): void {
  if (!fs.existsSync(STATS_FILE)) {
    writeFile(defaultFile());
  }
}

function normalizeUser(user?: string): string {
  const name = String(user ?? '').trim().slice(0, 12);
  return name || DEFAULT_USER;
}

/** 查询指定用户的战绩 */
export function getStats(user?: string): Stats {
  const { users } = readFile();
  const saved = users[normalizeUser(user)];
  // history 深拷贝，避免共享模块级 DEFAULT_STATS 的数组引用
  return { ...DEFAULT_STATS, ...saved, history: [...(saved?.history ?? [])] };
}

/** 记录一局战绩到指定用户名下 */
export function recordGame(user: string | undefined, role: Role, won: boolean, score: number): Stats {
  const name = normalizeUser(user);
  const file = readFile();
  const saved = file.users[name];
  const stats: Stats = { ...DEFAULT_STATS, ...saved, history: [...(saved?.history ?? [])] };

  stats.gamesPlayed++;
  if (role === 'landlord') stats.landlordGames++;
  else stats.peasantGames++;

  if (won) {
    stats.wins++;
    if (role === 'landlord') stats.landlordWins++;
    else stats.peasantWins++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.maxStreak) stats.maxStreak = stats.currentStreak;
  } else {
    stats.losses++;
    stats.currentStreak = 0;
  }

  stats.history.unshift({
    date: new Date().toISOString(),
    role,
    won,
    score,
  });
  if (stats.history.length > 50) stats.history = stats.history.slice(0, 50);

  file.users[name] = stats;
  writeFile(file);
  return stats;
}

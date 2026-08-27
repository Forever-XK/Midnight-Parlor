// 主题状态管理（深色/浅色模式）
import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }
  try {
    localStorage.setItem('ddz-theme', theme);
  } catch { /* ignore */ }
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('ddz-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return 'dark'; // 默认深色模式
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'dark', // 初始值会在 init 中被覆盖

  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

// 在模块初始化时应用主题（避免闪屏）
const initial = getInitialTheme();
applyTheme(initial);
useThemeStore.setState({ theme: initial });

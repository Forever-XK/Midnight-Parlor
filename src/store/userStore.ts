// 用户身份：用户名 + 性别（性别决定自己的语音声线）
import { create } from 'zustand';

export type UserGender = 'male' | 'female';

interface UserStore {
  username: string;
  gender: UserGender;
  /** 设置用户资料（持久化） */
  setProfile: (username: string, gender: UserGender) => void;
}

const NAME_KEY = 'ddz-username';
const GENDER_KEY = 'ddz-gender';

function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
function loadGender(): UserGender {
  try { return localStorage.getItem(GENDER_KEY) === 'female' ? 'female' : 'male'; } catch { return 'male'; }
}

export const useUserStore = create<UserStore>((set) => ({
  username: loadName(),
  gender: loadGender(),
  setProfile: (username, gender) => {
    const name = username.trim().slice(0, 12);
    try {
      localStorage.setItem(NAME_KEY, name);
      localStorage.setItem(GENDER_KEY, gender);
    } catch { /* ignore */ }
    set({ username: name, gender });
  },
}));

/** 非 React 上下文取当前用户名 */
export function currentUsername(): string {
  return useUserStore.getState().username;
}
/** 非 React 上下文取当前性别 */
export function currentUserGender(): UserGender {
  return useUserStore.getState().gender;
}

// 音效管理器 —— 加载 Sound 目录的语音包与特效，按游戏事件播放
// 语音包结构：
//   Man/Woman/{1-15}.wav        单张点数语音（1=A, 2=2, 3~13=3~K, 14=小王, 15=大王）
//   Man/Woman/dui{1-13}.wav     对子语音（dui1=AA, dui2=22, dui3~dui13=33~KK）
//   Man/Woman/{牌型}.wav        牌型语音（sange/sandaiyi/shunzi/zhadan/wangzha...）
//   Man/Woman/{短语}.wav        叫分/不出/报警等语音
//   根目录 {Welcome(BGM),Win,Lose,fapai,bomb...}.wav 特效音
import type { Play } from '@shared/types';

// 单张语音编号：rank 14(A)→1, 15(2)→2, 3~13→3~13, 16(小王)→14, 17(大王)→15
function singleVoiceIndex(rank: number): number {
  if (rank === 14) return 1; // A
  if (rank === 15) return 2; // 2
  if (rank === 16) return 14; // 小王
  if (rank === 17) return 15; // 大王
  return rank; // 3~K
}

// 对子/三张语音编号：rank 14(A)→1, 15(2)→2, 3~13→3~13（dui1=AA, dui2=22, sange1=AAA...）
function rankVoiceIndex(rank: number): number {
  if (rank === 14) return 1; // A
  if (rank === 15) return 2; // 2
  return rank; // 3~K
}

// 通过 Vite glob 导入 Sound 文件夹全部音频（?url 仅取地址，浏览器按需加载）
const modules = import.meta.glob('../../Sound/**/*.wav', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

type Gender = 'man' | 'woman';

// 背景音乐曲目：主界面 / 游戏模式 / 报牌紧张氛围
export type BgmName = 'Welcome' | 'Gaming' | 'Exciting';

// 音乐包：Sound/bgm1~4/{Welcome,Gaming,Exciting}.wav
export type BgmPack = 'bgm1' | 'bgm2' | 'bgm3' | 'bgm4';
export const BGM_PACKS: { id: BgmPack; name: string; desc: string }[] = [
  { id: 'bgm1', name: '新春', desc: '默认音乐包' },
  { id: 'bgm2', name: '经典', desc: '经典旋律' },
  { id: 'bgm3', name: '电玩', desc: '电子游戏风' },
  { id: 'bgm4', name: '庆典', desc: '欢庆气氛' },
];
const BGM_PACK_KEY = 'ddz-bgm-pack';

class SoundManager {
  private enabled = true;
  private voices: Record<Gender, Record<string, string>> = { man: {}, woman: {} };
  private effects: Record<string, string> = {};
  // 每局为三个座位随机分配男/女声（拟人化）
  private seatGender: Gender[] = ['man', 'woman', 'man'];
  // 背景音乐
  private bgm: HTMLAudioElement | null = null;
  private bgmName: BgmName | null = null;
  // 当前音乐包（默认 bgm1）
  private pack: BgmPack = 'bgm1';
  // 播放中的音频引用池：避免 new Audio() 无引用被浏览器 GC，导致长音效（炸弹/王炸）无声
  private activeAudios = new Set<HTMLAudioElement>();
  // 预加载实例池：持有引用确保大音效文件 load 完成并进入浏览器缓存
  private preloadPool: HTMLAudioElement[] = [];

  constructor() {
    // 初始音乐包（默认 bgm1）
    try {
      const saved = localStorage.getItem(BGM_PACK_KEY) as BgmPack | null;
      if (saved && BGM_PACKS.some((p) => p.id === saved)) this.pack = saved;
    } catch { /* ignore */ }
    for (const [rawPath, url] of Object.entries(modules)) {
      // 归一：Windows 下 glob 可能返回 \，统一转 / 避免正则分支不匹配
      const path = rawPath.replace(/\\/g, '/');
      const vm = path.match(/Sound\/(Man|Woman)\/(.+)\.wav$/i);
      if (vm) {
        // 语音文件名统一小写匹配，避免大小写命名差异导致无声
        const gender = vm[1].toLowerCase() as Gender;
        const name = vm[2].toLowerCase();
        this.voices[gender][name] = url;
        continue;
      }
      const em = path.match(/Sound\/(.+)\.wav$/i);
      if (em) this.effects[em[1].toLowerCase()] = url;
    }
    // 预加载较长特效音（炸弹/王炸的爆炸声），消除首次播放时的网络/磁盘加载延迟导致的无声或卡顿
    for (const k of ['bomb', 'longbomb', 'plane', 'chupai', 'fapai', 'double']) {
      const u = this.effects[k];
      if (!u) continue;
      try {
        const a = new Audio(u);
        a.preload = 'auto';
        a.load();
        this.preloadPool.push(a);
      } catch { /* 忽略 */ }
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    // 背景音乐同步开关
    if (this.bgm) {
      if (on) void this.bgm.play().catch(() => { /* 忽略 */ });
      else this.bgm.pause();
    }
  }

  // 每局开始时随机分配各座位声线；mySeat 座位固定使用玩家自选性别声线
  newGame(mySeat = 0, myGender?: 'male' | 'female'): void {
    this.seatGender = [0, 1, 2].map(() => (Math.random() < 0.5 ? 'man' : 'woman')) as Gender[];
    if (myGender) this.seatGender[mySeat] = myGender === 'female' ? 'woman' : 'man';
  }

  // ===== 音乐包 =====

  getPack(): BgmPack {
    return this.pack;
  }

  /** 切换音乐包；若当前正在播放 BGM，则无缝切到新包的同一曲目 */
  setPack(pack: BgmPack): void {
    if (pack === this.pack) return;
    this.pack = pack;
    try { localStorage.setItem(BGM_PACK_KEY, pack); } catch { /* ignore */ }
    // 当前有 BGM 在播：用新包的同名曲目重启
    if (this.bgmName) {
      const cur = this.bgmName;
      this.bgmName = null;
      this.playBgm(cur);
    }
  }

  /** 按当前音乐包解析 BGM 地址：bgmN/{name} → 根目录 {name} 兜底 */
  private bgmUrl(name: BgmName): string | undefined {
    const n = name.toLowerCase();
    return this.effects[`${this.pack}/${n}`] ?? this.effects[n];
  }

  private play(url: string | undefined, volume = 0.9): void {
    if (!this.enabled || !url) return;
    try {
      const audio = new Audio(url);
      audio.volume = volume;
      // 持有引用直到播放结束/失败，防止长音效（bomb/longbomb）被 GC 导致无声
      this.activeAudios.add(audio);
      const release = () => this.activeAudios.delete(audio);
      audio.addEventListener('ended', release, { once: true });
      audio.addEventListener('error', () => {
        console.warn('[sound] audio error:', url);
        release();
      }, { once: true });
      void audio.play().catch((e) => {
        console.warn('[sound] play rejected:', url, e?.name ?? e);
        release();
      });
    } catch (e) {
      console.warn('[sound] play throw:', url, e);
    }
  }

  private voice(seat: number, name: string): void {
    const key = String(name).toLowerCase();
    const gender = this.seatGender[seat] ?? 'man';
    const otherGender: Gender = gender === 'man' ? 'woman' : 'man';
    // 查找顺序：本性别 → 相反性别 → 男声兜底（男声素材最齐）
    const url =
      this.voices[gender][key] ??
      this.voices[otherGender][key] ??
      this.voices.man[key];
    this.play(url, 1);
  }

  private effect(name: string, volume = 0.6): void {
    const key = String(name).toLowerCase();
    const url = this.effects[key];
    this.play(url, volume);
  }

  private randomVoice(seat: number, names: string[]): void {
    this.voice(seat, names[Math.floor(Math.random() * names.length)]);
  }

  // ===== 场景音效 =====

  /**
   * 播放指定 BGM 并循环（主界面 Welcome / 游戏模式 Gaming / 报牌紧张氛围 Exciting）。
   * 切到同曲目不重复初始化；切不同曲目则替换当前 BGM。
   * 浏览器自动播放限制下，等待用户首次交互后自动开始。若同曲目重放失败（例如页面切换后），
   * 会重新注册手势监听器，避免永远静默。
   */
  playBgm(name: BgmName): void {
    // 按当前音乐包解析地址（bgmN/{name}，键已小写归一）
    const url = this.bgmUrl(name);
    if (!url) return;
    // 同曲目已就绪：仅尝试播放（自动播放被拦截时等待手势；若监听器已移除则重新挂）
    if (this.bgmName === name && this.bgm) {
      if (!this.enabled) return;
      void this.bgm.play().catch(() => {
        const resume = () => {
          window.removeEventListener('pointerdown', resume);
          window.removeEventListener('keydown', resume);
          if (this.enabled && this.bgmName === name) void this.bgm?.play().catch(() => { /* 忽略 */ });
        };
        window.addEventListener('pointerdown', resume);
        window.addEventListener('keydown', resume);
      });
      return;
    }
    // 替换不同曲目
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.35;
    this.bgm = audio;
    this.bgmName = name;
    if (!this.enabled) return;
    void audio.play().catch(() => {
      // 自动播放被拦截：监听用户首次交互后重试（去重防止多层叠加）
      const resume = () => {
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
        if (this.enabled && this.bgmName === name) void this.bgm?.play().catch(() => { /* 忽略 */ });
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
    });
  }

  /**
   * 在用户手势上下文内确保指定 BGM 播放（用于「点击进入」遮罩）。
   * 若该曲目已创建但被自动播放策略暂停，则在此手势下重试播放。
   */
  ensureBgm(name: BgmName): void {
    if (!this.enabled) return;
    if (this.bgmName !== name) {
      this.playBgm(name);
      return;
    }
    void this.bgm?.play().catch(() => { /* 忽略 */ });
  }

  /** 发牌 */
  deal(): void {
    this.effect('fapai', 0.7);
  }

  /** 选牌（提起/放下手牌） */
  selectCard(): void {
    this.effect('xuanpai', 0.7);
  }

  /** 通用按钮点击 */
  buttonClick(): void {
    this.effect('xuanze', 0.5);
  }

  /** 抽取癞子翻牌 */
  double(): void {
    this.effect('double', 0.7);
  }

  /** 胜利 / 失败 */
  win(): void { this.effect('Win', 0.8); }
  lose(): void { this.effect('Lose', 0.8); }

  /**
   * 叫分语音。
   * @param bid 0=不叫；1/2/3=叫分
   * @param hasExistingBid 是否已有人叫过分（决定“不叫”还是“不抢”）
   */
  bid(seat: number, bid: number, hasExistingBid: boolean): void {
    if (bid <= 0) {
      this.voice(seat, hasExistingBid ? 'buqiang' : 'bujiao');
      return;
    }
    const map: Record<number, string> = { 1: 'jiaodizhu', 2: 'qiangdizhu1', 3: 'qiangdizhu2' };
    this.voice(seat, map[bid] ?? 'jiaodizhu');
  }

  /** 不出（随机语气） */
  pass(seat: number): void {
    this.randomVoice(seat, ['buyao1', 'buyao2', 'buyao3', 'buyao4']);
  }

  /** 出牌：出牌音效 + 点数/牌型语音 + 组合特效
   *  @param isFollow 是否为跟牌压制（压别人出的牌）：此时从牌型语音与压制语音（yapai1~3）中随机二选一 */
  playCards(seat: number, play: Play, isFollow = false): void {
    // 出牌拍桌音效
    this.effect('chupai', 0.5);
    // 压制（跟牌）：50% 概率播压制语音替代牌型语音；炸弹/王炸仍保留爆炸特效音
    if (isFollow && Math.random() < 0.5) {
      this.voice(seat, `yapai${1 + Math.floor(Math.random() * 3)}`);
      if (play.type === 'bomb') this.effect('bomb', 0.8);
      if (play.type === 'rocket') this.effect('longbomb', 0.8);
      return;
    }
    switch (play.type) {
      case 'single':
        this.voice(seat, `${singleVoiceIndex(play.mainRank)}`);
        break;
      case 'pair':
        this.voice(seat, `dui${rankVoiceIndex(play.mainRank)}`);
        break;
      case 'triple':
        this.voice(seat, `sange${rankVoiceIndex(play.mainRank)}`);
        break;
      case 'triple_single':
        this.voice(seat, 'sandaiyi');
        break;
      case 'triple_pair':
        this.voice(seat, 'sandaiyidui');
        break;
      case 'straight':
        this.voice(seat, 'shunzi');
        break;
      case 'pair_straight':
        this.voice(seat, 'liandui');
        break;
      case 'airplane':
      case 'airplane_single':
      case 'airplane_pair':
        this.voice(seat, 'feiji');
        this.effect('plane', 0.5);
        break;
      case 'four_two_single':
        this.voice(seat, 'sidaier');
        break;
      case 'four_two_pair':
        this.voice(seat, 'sidailiangdui');
        break;
      case 'bomb':
        this.voice(seat, 'zhadan');
        this.effect('bomb', 0.8);
        break;
      case 'rocket':
        this.voice(seat, 'wangzha');
        this.effect('longbomb', 0.8);
        break;
    }
  }

  /** 报牌警示：任一玩家剩 1~2 张时切入紧张氛围音乐（Exciting 单曲循环）+ 播放该座位声线的报警语音 */
  alarm(seat: number, count: number): void {
    this.playBgm('Exciting');
    this.voice(seat, count <= 1 ? 'baojing1' : 'baojing2');
  }

  /** 局内快捷聊天语音：播放指定座位声线的 voice{index}.wav（index=1~12，文本见 chatVoices.ts） */
  chatVoice(seat: number, index: number): void {
    this.voice(seat, `voice${index}`);
  }
}

export const sound = new SoundManager();

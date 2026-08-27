# 午夜雅集 · 斗地主

一款参考「欢乐斗地主 / JJ斗地主」制作的网页斗地主游戏，支持 AI 人机对战与局域网联机对战，前后端分离，可一键打包为 Windows 桌面程序。

![版本](https://img.shields.io/badge/version-1.4.0-8A2BE2) ![License](https://img.shields.io/badge/license-MIT-green)

## 功能特性

### 游戏玩法

- **经典模式**：叫分争夺地主，完整斗地主规则（单/对/三带/顺子/连对/飞机/炸弹/王炸）
- **不洗牌模式**：大牌集中发牌，炸弹密度接近真实不洗牌玩法（实测 2 万局：平均 3.18 炸弹/局，91% 对局至少一炸）
- **癞子模式**：随机癞子点数，癞子可充当任意牌，多解出牌时可自由选择牌型解释
- **天地癞子模式**：天癞子（发牌后）+ 地癞子（定地主后），支持多张炸弹比较
- **闷抓模式**：定地主前全场暗牌，翻明牌者获得优先叫牌权，闷抓直接当地主且倍数翻倍

### AI 对战

- 三档 AI 难度：休闲 / 标准 / 高手（高手内置记牌器）
- AI 算法基于牌力评估的最优拆牌 + 局面角色策略（农民喂牌/顶牌、地主压制、炸弹时机、报单压制等）

### 联机对战

- WebSocket 实时状态同步，权威服务器模式（后端管理全部游戏状态，防作弊）
- 创建房间 / 加入房间，同局域网或部署到服务器后可多人对战

### 体验与个性化

- **用户系统**：用户名 + 性别，战绩按用户分档统计（胜率、连胜、身份胜率、历史记录）
- **牌面风格**：经典 / 金环 / 水印 / 点数 / 趣味人物 五种牌面
- **桌布风格**：翡翠 / 午夜蓝 / 酒红 / 紫罗兰 / 棋盘格 / 织锦纹 六种牌桌
- **音乐包**：新春 / 经典 / 电玩 / 庆典 四套 BGM 与全套男女声语音（按座位随机分配声线，性别决定自己的声线）
- **动效**：发牌动画、选牌提牌动画、癞子抽取动画、胜负结算动画
- **移动端适配**：竖屏手机自动横置 + 等比缩放布局，触屏滑动多选牌
- **桌面端**：Electron 打包为单个 exe 便携版，双击即玩

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Framer Motion |
| 后端 | Node.js · Express · TypeScript · WebSocket (ws) |
| 桌面端 | Electron · electron-builder · esbuild |
| 测试 | Vitest（33 个用例覆盖规则与对局流程） |

## 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9

### 开发运行

```bash
# 安装依赖
npm install

# 同时启动前端 (Vite :5173) 和后端 (Express :3001)
npm run dev
```

浏览器打开 <http://localhost:5173> 即可游玩。

### 生产部署

```bash
# 构建前端并启动生产服务器（前端由后端托管）
npm run deploy        # HOST=0.0.0.0 监听所有网卡
```

### 打包 Windows 桌面程序

```bash
npm run desktop:build
```

产物为 `release/斗地主-v{version}-Portable.exe`（便携版单文件，约 140MB），双击即可运行，无需安装 Node.js；战绩数据保存在 `%APPDATA%\ddz-game\`。

> 若打包时下载 Electron 二进制失败（网络原因），可指定镜像：
> ```powershell
> $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
> $env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
> ```

## 项目结构

```
├── api/                  # 后端
│   ├── game/             # 核心游戏逻辑（规则、AI、发牌、战绩存储）
│   ├── multi/            # 联机房间服务
│   ├── routes/           # REST 路由
│   ├── ws/               # WebSocket 服务
│   └── server.ts         # 服务入口
├── src/                  # 前端
│   ├── components/       # UI 组件（牌、座位、出牌区、设置面板等）
│   ├── pages/            # 页面（首页 / 对局 / 联机大厅 / 房间）
│   ├── store/            # Zustand 状态（对局、用户、样式偏好等）
│   └── lib/              # API 客户端、音效管理、WS 客户端
├── shared/               # 前后端共享类型定义
├── electron/             # Electron 主进程（内嵌后端 + 窗口）
├── Sound/                # 音效资源（男女语音、四套 BGM）
└── public/               # 静态资源（字体、图标）
```

## 运行测试

```bash
npx vitest run
```

## 许可证

[MIT](./LICENSE)

> **注意**：本项目中的音效与字体素材仅供学习交流使用，请勿用于商业用途。

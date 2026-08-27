// Electron 主进程：拉起内嵌 Express 后端 + 打开游戏窗口
// 打包结构（resources/）：dist-electron/server.cjs（后端单文件）+ dist/（前端构建产物）
const { app, BrowserWindow } = require('electron');
const path = require('path');
const net = require('net');
const http = require('http');

const serverPath = path.join(__dirname, '..', 'dist-electron', 'server.cjs');
// 开发与打包统一路径：打包后均位于 app.asar 内（express.static 可直接读 asar）
const distDir = path.join(__dirname, '..', 'dist');

/** 找一个空闲端口（listen(0) 由系统分配） */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

/** 轮询 /api/health 等待后端就绪 */
function waitHealth(port, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error('后端启动超时'));
      else setTimeout(poll, 150);
    };
    poll();
  });
}

let win = null;

async function createWindow(port) {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#0d1b2a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await win.loadURL(`http://127.0.0.1:${port}/`);
  win.on('closed', () => { win = null; });
}

async function main() {
  // 单实例：重复启动时聚焦已有窗口
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  await app.whenReady();

  const port = await findFreePort();
  // 后端运行环境：仅本机监听；数据目录指向用户目录（可写）；静态目录指向打包内前端
  process.env.PORT = String(port);
  process.env.HOST = '127.0.0.1';
  process.env.NODE_ENV = 'production';
  process.env.DDZ_DIST_DIR = distDir;
  process.env.DDZ_DATA_DIR = app.getPath('userData');
  require(serverPath); // 启动内嵌服务器（含 WebSocket）

  try {
    await waitHealth(port);
    await createWindow(port);
  } catch (err) {
    const { dialog } = require('electron');
    dialog.showErrorBox('启动失败', `游戏服务启动失败：${err.message}`);
    app.quit();
  }

  app.on('window-all-closed', () => app.quit());
}

main();

/**
 * local server entry file, for local development
 */
import app from './app.js';
import { wsService } from './ws/wsService.js';
import fs from 'node:fs';

/**
 * start server with port & host
 *
 * 监听地址选择优先级（兼顾 Windows 本地开发与云端部署）：
 *   1) process.env.HOST 显式指定（最高优先级）
 *   2) NODE_ENV === 'production' 或 存在 /.dockerenv（容器/云部署）→ 0.0.0.0
 *      （接受来自公网/容器 bridge 网卡的外部连接）
 *   3) 其余情况 → 127.0.0.1
 *      （Windows 本地开发锁定 IPv4，避免 localhost 双栈解析到 ::1
 *       引发 Vite → Node 的 AggregateError[ECONNREFUSED]）
 */
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const isContainer = (() => {
  try { return fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv'); } catch { return false; }
})();
const DEFAULT_HOST = (isProduction || isContainer) ? '0.0.0.0' : '127.0.0.1';
const HOST = process.env.HOST || DEFAULT_HOST;

const server = app.listen(+PORT, HOST, () => {
  const bindHint = (HOST === '127.0.0.1')
    ? '（仅本机可访问；云部署需设置 HOST=0.0.0.0 或 HOST=<内网IP>）'
    : (HOST === '0.0.0.0')
      ? '（已监听所有网卡；请确认安全组/防火墙已放行端口）'
      : '';
  console.log(`Server ready on ${HOST}:${PORT} ${bindHint}`);
});

// 挂载 WebSocket（path = /ws）
wsService.attach(server);
console.log(`WebSocket mounted on ws://${HOST}:${PORT}/ws`);

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
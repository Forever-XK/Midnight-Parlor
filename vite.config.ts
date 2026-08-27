import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
  ],
  server: {
    proxy: {
      '/api': {
        // 锁定 IPv4，避免 Windows 双栈下 localhost 先解析 ::1 导致 ECONNREFUSED
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          // nodemon 重启期间后端短暂下线（正常情况），仅把错误降级为简短单行提示，避免刷屏
          proxy.on('error', (_err, req, _res) => {
            const url = req.url ?? '';
            if (url.startsWith('/api/stats')) return;   // stats 轮询失败完全静默（后端重启中）
            // eslint-disable-next-line no-console
            console.warn('[proxy] 后端暂不可达:', req.method, url);
          });
          // 正常请求日志降级为 debug 级别（默认太吵，生产/开发时无需逐行）
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            if (process.env.VITE_DEBUG_PROXY) {
              // eslint-disable-next-line no-console
              console.log('[proxy] →', req.method, req.url);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (process.env.VITE_DEBUG_PROXY) {
              // eslint-disable-next-line no-console
              console.log('[proxy] ←', proxyRes.statusCode, req.url);
            }
          });
        },
      }
    }
  }
})

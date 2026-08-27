/**
 * 斗地主游戏 API 服务器
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import gameRoutes from './routes/game.js'
import multiRoutes from './routes/multi.js'

dotenv.config()

// esbuild CJS 打包时 import.meta.url 为空 → 回退 cwd（打包场景由 DDZ_DIST_DIR 覆盖）
const __dirname = (() => {
  try { return path.dirname(fileURLToPath(import.meta.url)); } catch { return process.cwd(); }
})();

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api', gameRoutes)
app.use('/api', multiRoutes)

/**
 * health check
 */
app.use('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' })
})

/**
 * 生产环境：托管前端静态文件
 */
// DDZ_DIST_DIR：Electron 打包等场景指定前端静态资源目录
const distDir = process.env.DDZ_DIST_DIR || path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA 回退：非 /api 路由统一返回 index.html
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

/**
 * error handler middleware
 */
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', error)
  res.status(500).json({ success: false, error: '服务器内部错误' })
})

/**
 * 404 handler（仅 API 路由）
 */
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'API 不存在' })
})

export default app

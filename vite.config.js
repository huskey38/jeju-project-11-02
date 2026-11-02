import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// 개발 서버(npm run dev)에서도 /api/* 서버 함수를 동작시키는 플러그인.
// Vercel 에서는 api/ 폴더가 그대로 서버 함수가 되므로 배포 때는 쓰이지 않습니다.
function devApi(env) {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, env) // .env.local 의 서버용 키를 process.env 로
      server.middlewares.use('/api', async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const name = url.pathname.replace(/^\//, '')
        if (!/^[a-z]+$/.test(name)) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          req.query = Object.fromEntries(url.searchParams)
          if (req.method === 'POST') {
            let raw = ''
            for await (const c of req) raw += c
            req.body = raw ? JSON.parse(raw) : {}
          }
          res.status = (code) => { res.statusCode = code; return res }
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(obj))
          }
          await mod.default(req, res)
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ''))],
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
}))

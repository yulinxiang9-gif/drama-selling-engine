// 可选：自托管代理。用于部署到 Render 等平台时，让官方 DeepSeek（无浏览器 CORS）
// 也能被前端调用。前端选择「自托管代理」模式后，会把请求发到同源 /api/generate，
// 本服务用本次请求携带的 apiKey 转发到真实端点，Key 不落库。
//
// 部署：render.yaml 已配置 `npm install && npm run build` + `node server/proxy.cjs`。
// 环境变量（均可选）：PORT（默认 3000）、UPSTREAM（默认 https://api.deepseek.com）。

const express = require('express')
const path = require('path')
const fs = require('fs')

const app = express()
app.use(express.json({ limit: '2mb' }))

const UPSTREAM = process.env.UPSTREAM || 'https://api.deepseek.com'

app.post('/api/generate', async (req, res) => {
  try {
    const { model, messages, temperature, json, maxTokens, apiKey, upstream } = req.body || {}
    if (!apiKey || !model || !Array.isArray(messages)) {
      return res.status(400).json({ error: '缺少 apiKey / model / messages' })
    }
    const base = (upstream || UPSTREAM).replace(/\/+$/, '')
    const body = { model, messages, temperature: temperature ?? 0.85, stream: false }
    if (json) body.response_format = { type: 'json_object' }
    if (maxTokens) body.max_tokens = maxTokens

    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) return res.status(r.status).json(data)
    res.json(data)
  } catch (e) {
    res.status(502).json({ error: String(e && e.message ? e.message : e) })
  }
})

// 托管前端构建产物（若存在）
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))
}

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`proxy listening on :${PORT}, upstream=${UPSTREAM}`))

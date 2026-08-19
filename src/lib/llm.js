// OpenAI 兼容聊天客户端（浏览器直连）。
// 默认走 SiliconFlow（支持 CORS）；DeepSeek 官方无 CORS，需自托管代理。

export async function chatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.85,
  json = false,
  maxTokens,
  signal,
  upstream,
}) {
  if (!apiKey || !model) {
    throw new Error('请先在右上角「设置」中填写 API Key 与模型。')
  }

  // 自托管代理模式：同源 /api/generate，由服务端转发到真实端点（避开 CORS）。
  if (baseUrl && baseUrl.startsWith('/')) {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        json,
        maxTokens,
        apiKey,
        upstream: upstream || 'https://api.deepseek.com',
      }),
      signal,
    })
    if (!res.ok) {
      let detail = ''
      try { detail = (await res.text()).slice(0, 400) } catch { /* ignore */ }
      throw new Error(`代理错误 ${res.status}：${detail}`)
    }
    const data = await res.json()
    return data?.choices?.[0]?.message?.content ?? ''
  }

  if (!baseUrl) {
    throw new Error('请先在右上角「设置」中填写 API 地址。')
  }
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const body = {
    model,
    messages,
    temperature,
    stream: false,
  }
  if (json) body.response_format = { type: 'json_object' }
  if (maxTokens) body.max_tokens = maxTokens

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 400)
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new Error('API Key 无效或被拒（401）。请检查 Key。')
    if (res.status === 403)
      throw new Error(
        '被拒绝（403）。若用 DeepSeek 官方，浏览器跨域受限，请改用 SiliconFlow 或部署 server/proxy.cjs 版本。'
      )
    if (res.status === 429) throw new Error('触发限流（429），稍后重试或换模型。')
    throw new Error(`API 错误 ${res.status}：${detail}`)
  }

  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

export function parseJSON(content) {
  if (typeof content !== 'string') return content
  try {
    return JSON.parse(content)
  } catch {
    // 模型可能包裹在 ```json 代码块里
    const m = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (m) {
      try {
        return JSON.parse(m[1])
      } catch {
        /* fall through */
      }
    }
    return { _raw: content }
  }
}

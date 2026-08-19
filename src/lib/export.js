// 把生成结果导出为 Markdown / JSON / 纯文本。

export function toMarkdown(script, meta = {}) {
  if (!script) return ''
  const L = []
  L.push(`# 短剧带货脚本 · ${script.genre || ''} ${meta.styleEmoji || ''}`)
  L.push('')
  if (meta.productName) L.push(`> 商品：${meta.productName}　|　平台：${meta.platform || ''}　|　时长：${meta.duration || ''}s　|　语气：${script.tone || ''}`)
  L.push('')
  L.push(`## 一句话梗概`)
  L.push(script.logline || '—')
  L.push('')
  L.push(`## 前 3 秒钩子`)
  L.push(script.hook || '—')
  L.push('')
  if (script.characters?.length) {
    L.push(`## 人物小传`)
    script.characters.forEach((c) => {
      L.push(`- **${c.name || '角色'}**（${c.role || ''}）：${c.arc || ''}`)
      if (c.appearance_desc) L.push(`  - 外貌锚点：${c.appearance_desc}`)
    })
    L.push('')
  }
  if (script.drama_beats?.length) {
    L.push(`## 剧情节拍`)
    script.drama_beats.forEach((b) => {
      L.push(`- **${b.phase}**〔${b.sec}〕${b.product_role && b.product_role !== '无' ? ' · 产品：' + b.product_role : ''}`)
      L.push(`  - 剧情：${b.story || ''}${b.selling_point ? '　|　卖点：' + b.selling_point : ''}`)
    })
    L.push('')
  }
  L.push(`## 分镜脚本`)
  script.shots?.forEach((s) => {
    L.push(`### 镜头 ${s.index} · ${s.time || ''}`)
    L.push(`- 景别/构图：${s.shot_type || ''}`)
    L.push(`- 画面：${s.visual_desc || ''}`)
    L.push(`- 口播：${s.dialogue || ''}`)
    L.push(`- 字幕：${s.subtitle || ''}`)
    L.push(`- 运镜：${s.camera || ''}`)
    L.push(`- 产品植入：${s.product_placement || ''}`)
    if (s.seedance_prompt) L.push(`- Seedance：${s.seedance_prompt}`)
    L.push('')
  })
  L.push(`## 结尾转化`)
  L.push(script.cta || '—')
  L.push('')
  if (script.selling_point_map?.length) {
    L.push(`## 卖点植入地图`)
    script.selling_point_map.forEach((m) => {
      L.push(`- **${m.selling_point}** → 镜头 [${m.shot_indexes?.join(', ') || ''}]：${m.how || ''}`)
    })
    L.push('')
  }
  if (script.notes) {
    L.push(`## 创作者备注`)
    L.push(script.notes)
    L.push('')
  }
  return L.join('\n')
}

export function toSeedancePrompts(script) {
  if (!script?.shots?.length) return ''
  return script.shots
    .map((s, i) => `镜头${s.index || i + 1}（${s.time || ''}）：${s.seedance_prompt || s.visual_desc || ''}`)
    .join('\n\n')
}

export function download(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { PROVIDERS, DURATIONS, PLATFORMS, TONES, BANNED_WORDS, scanBannedWords } from './lib/constants'
import { DRAMA_STYLES, getStyle } from './lib/dramaStyles'
import { productFactsText, buildPainMapMessages, buildDramaScriptMessages, buildRewriteMessages } from './lib/prompts'
import { chatCompletion, parseJSON } from './lib/llm'
import { toMarkdown, toSeedancePrompts, download } from './lib/export'

const LS_SETTINGS = 'dse_settings_v1'
const LS_PRODUCT = 'dse_product_v1'
const LS_LAST_HOOK = 'dse_last_hook_v1'

const DEMO = {
  name: '云感记忆棉拖鞋',
  category: '居家鞋袜',
  targetAudience: '25-45 岁居家办公/宝妈',
  price: '59 元/双',
  sellingPoints: ['3cm 高弹记忆棉回弹不塌', '防滑颗粒底湿地不打滑', '可机洗不变形', '静音底不吵家人'],
  scenarios: ['半夜起夜怕吵醒家人', '浴室出来地滑', '久坐脚底酸'],
  extra: '主打"居家 quietly 舒适"，适合视频号/小红书温情向',
}

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [settings, setSettings] = useState(() =>
    loadJSON(LS_SETTINGS, { providerId: 'siliconflow', baseUrl: PROVIDERS.siliconflow.baseUrl, apiKey: '', model: PROVIDERS.siliconflow.defaultModel })
  )
  const [product, setProduct] = useState(() =>
    loadJSON(LS_PRODUCT, { name: '', category: '', targetAudience: '', price: '', sellingPoints: [], scenarios: [], extra: '' })
  )
  const [styleId, setStyleId] = useState('reversal')
  const [toneId, setToneId] = useState('hot')
  const [durationKey, setDurationKey] = useState(30)
  const [platformId, setPlatformId] = useState('douyin')
  const [temperature, setTemperature] = useState(0.85)
  const [avoidRepeat, setAvoidRepeat] = useState(false)

  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')
  const [painMap, setPainMap] = useState(null)
  const [script, setScript] = useState(null)
  const [compliance, setCompliance] = useState([])
  const [busy, setBusy] = useState(false)
  const abortRef = useRef(null)
  const [lastHook, setLastHook] = useState(() => loadJSON(LS_LAST_HOOK, ''))

  useEffect(() => localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)), [settings])
  useEffect(() => localStorage.setItem(LS_PRODUCT, JSON.stringify(product)), [product])

  // 把逗号/换行分隔的文本转数组
  const arr = (txt) => (txt || '').split(/[\n,，、]/).map((s) => s.trim()).filter(Boolean)

  const productForEngine = useMemo(
    () => ({ ...product, sellingPoints: arr(product._sp), scenarios: arr(product._sc) }),
    [product]
  )

  async function generate() {
    setError('')
    if (!settings.apiKey) {
      setShowSettings(true)
      setError('请先在右上角「设置」中填写 API Key。')
      return
    }
    if (!product.name) {
      setError('请至少填写「商品名称」。')
      return
    }
    setBusy(true)
    setLoading(true)
    setScript(null)
    setPainMap(null)
    setCompliance([])
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const p = productForEngine
      // ① 痛点地图
      setStep('① 正在生成痛点地图（把卖点翻译成可代入的困境）…')
      const pmContent = await chatCompletion({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: buildPainMapMessages(p),
        json: true,
        temperature: Math.min(temperature, 0.7),
        signal: ac.signal,
      })
      const pm = parseJSON(pmContent)
      setPainMap(pm)

      // ② 短剧脚本
      setStep('② 正在套用短剧结构生成分镜脚本（剧情 + 卖点融合）…')
      const avoid = avoidRepeat && lastHook ? [lastHook] : []
      const scContent = await chatCompletion({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: buildDramaScriptMessages({
          p,
          styleId,
          toneId,
          durationKey,
          platformId,
          painMap: pm,
          bannedWords: BANNED_WORDS,
          avoidHooks: avoid,
        }),
        json: true,
        temperature,
        maxTokens: 4000,
        signal: ac.signal,
      })
      const sc = parseJSON(scContent)
      setScript(sc)
      if (sc?.hook) {
        localStorage.setItem(LS_LAST_HOOK, sc.hook)
        setLastHook(sc.hook)
      }
      // 合规扫描
      setCompliance(runCompliance(sc))
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    } catch (e) {
      if (e.name === 'AbortError') setError('已取消生成。')
      else setError(e.message || String(e))
    } finally {
      setLoading(false)
      setBusy(false)
      setStep('')
    }
  }

  function cancel() {
    abortRef.current?.abort()
  }

  function runCompliance(sc) {
    if (!sc) return []
    const texts = [
      sc.logline,
      sc.hook,
      sc.cta,
      sc.notes,
      ...(sc.characters || []).map((c) => c.arc + (c.appearance_desc || '')),
      ...(sc.drama_beats || []).map((b) => b.story + (b.product_role || '') + (b.selling_point || '')),
      ...(sc.shots || []).map((s) => [s.dialogue, s.subtitle, s.visual_desc, s.product_placement].join(' ')),
      ...(sc.selling_point_map || []).map((m) => m.how),
    ].join('\n')
    return scanBannedWords(texts, BANNED_WORDS)
  }

  async function fixCompliance() {
    if (!script || !compliance.length) return
    setBusy(true)
    setStep('③ 正在合规改写（替换违禁词）…')
    try {
      const c = await chatCompletion({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: buildRewriteMessages({ script, hits: compliance, bannedWords: BANNED_WORDS }),
        json: true,
        temperature: 0.4,
      })
      const fixed = parseJSON(c)
      if (fixed && !fixed._raw) {
        setScript(fixed)
        setCompliance(runCompliance(fixed))
      }
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
      setStep('')
    }
  }

  const style = getStyle(styleId)
  const meta = {
    productName: product.name,
    platform: PLATFORMS[platformId]?.name,
    duration: durationKey,
    styleEmoji: style?.emoji,
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">🎬</div>
          <div>
            <h1>短剧带货脚本引擎</h1>
            <p>用短剧剧情把产品卖点自然植入 · 一键生成可投喂 Seedance 的分镜脚本</p>
          </div>
        </div>
        <button className="gear" onClick={() => setShowSettings((v) => !v)}>
          ⚙️ 设置 / API
        </button>
      </header>

      {showSettings && (
        <SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} />
      )}

      <main className="layout">
        <section className="panel form-panel">
          <h2 className="panel-title">① 商品信息</h2>
          <ProductForm product={product} setProduct={setProduct} onDemo={() => setProduct({ ...DEMO, _sp: DEMO.sellingPoints.join('\n'), _sc: DEMO.scenarios.join('\n') })} />

          <h2 className="panel-title" style={{ marginTop: 18 }}>② 选择短剧风格</h2>
          <p className="hint">不同风格 = 不同叙事结构与植入策略。产品会作为剧情必需品自然出现。</p>
          <StyleGrid styles={DRAMA_STYLES} selected={styleId} onSelect={setStyleId} />

          <h2 className="panel-title" style={{ marginTop: 18 }}>③ 发布参数</h2>
          <div className="grid2">
            <Field label="时长">
              <select value={durationKey} onChange={(e) => setDurationKey(Number(e.target.value))}>
                {Object.values(DURATIONS).map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </Field>
            <Field label="投放平台">
              <select value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
                {Object.values(PLATFORMS).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}（{p.aspect_ratio}）</option>
                ))}
              </select>
            </Field>
            <Field label="语气基调">
              <select value={toneId} onChange={(e) => setToneId(e.target.value)}>
                {TONES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label} · {t.desc}</option>
                ))}
              </select>
            </Field>
            <Field label={`创意度 ${temperature.toFixed(2)}`}>
              <input type="range" min="0.3" max="1.2" step="0.05" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
            </Field>
          </div>
          <label className="checkrow">
            <input type="checkbox" checked={avoidRepeat} onChange={(e) => setAvoidRepeat(e.target.checked)} />
            换一种开场（避免与上一条脚本重复）
          </label>

          <div className="actions">
            {!busy ? (
              <button className="primary" onClick={generate}>🚀 生成短剧带货脚本</button>
            ) : (
              <button className="danger" onClick={cancel}>■ 取消生成</button>
            )}
          </div>
          {step && <div className="step">{step}</div>}
          {error && <div className="err">⚠️ {error}</div>}
        </section>

        <section className="panel result-panel">
          <h2 className="panel-title">结果</h2>
          {!script && !loading && <EmptyState />}
          {script && (
            <ResultView
              script={script}
              painMap={painMap}
              compliance={compliance}
              meta={meta}
              onFix={fixCompliance}
              fixing={busy && step.includes('合规')}
            />
          )}
        </section>
      </main>

      <footer className="foot">
        纯前端 · 你的 API Key 仅保存在本地浏览器，直接调用模型，不经过任何第三方服务器。
      </footer>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

function ProductForm({ product, setProduct, onDemo }) {
  const set = (k, v) => setProduct((p) => ({ ...p, [k]: v }))
  return (
    <div className="form">
      <Field label="商品名称 *">
        <input value={product.name} onChange={(e) => set('name', e.target.value)} placeholder="如：云感记忆棉拖鞋" />
      </Field>
      <div className="grid2">
        <Field label="类目">
          <input value={product.category} onChange={(e) => set('category', e.target.value)} placeholder="如：居家鞋袜" />
        </Field>
        <Field label="价格/客单">
          <input value={product.price} onChange={(e) => set('price', e.target.value)} placeholder="如：59 元/双" />
        </Field>
      </div>
      <Field label="目标人群">
        <input value={product.targetAudience} onChange={(e) => set('targetAudience', e.target.value)} placeholder="如：25-45 岁宝妈" />
      </Field>
      <Field label="核心卖点（每行一个）">
        <textarea rows={3} value={product._sp || ''} onChange={(e) => set('_sp', e.target.value)} placeholder={'3cm 高弹记忆棉回弹不塌\n防滑颗粒底湿地不打滑\n可机洗不变形'} />
      </Field>
      <Field label="典型使用场景（每行一个）">
        <textarea rows={2} value={product._sc || ''} onChange={(e) => set('_sc', e.target.value)} placeholder={'半夜起夜怕吵醒家人\n浴室出来地滑'} />
      </Field>
      <Field label="补充信息（选填）">
        <input value={product.extra} onChange={(e) => set('extra', e.target.value)} placeholder="风格偏好 / 品牌调性 / 禁忌等" />
      </Field>
      <button className="ghost" onClick={onDemo}>✨ 填入示例商品</button>
    </div>
  )
}

function StyleGrid({ styles, selected, onSelect }) {
  return (
    <div className="style-grid">
      {styles.map((s) => (
        <button key={s.id} className={'style-card' + (selected === s.id ? ' active' : '')} onClick={() => onSelect(s.id)}>
          <div className="style-emoji">{s.emoji}</div>
          <div className="style-name">{s.name}</div>
          <div className="style-tag">{s.tagline}</div>
        </button>
      ))}
    </div>
  )
}

function SettingsPanel({ settings, setSettings, onClose }) {
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }))
  const onProvider = (id) => {
    const p = PROVIDERS[id]
    setSettings((s) => ({ ...s, providerId: id, baseUrl: p.baseUrl || s.baseUrl, model: p.defaultModel || s.model }))
  }
  return (
    <div className="settings">
      <div className="settings-head">
        <h3>API 设置</h3>
        <button className="ghost" onClick={onClose}>收起</button>
      </div>
      <div className="form">
        <Field label="模型服务商">
          <select value={settings.providerId} onChange={(e) => onProvider(e.target.value)}>
            {Object.values(PROVIDERS).map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </Field>
        <p className="provider-note">{PROVIDERS[settings.providerId]?.note}</p>
        <Field label="API 地址（/v1 基址）">
          <input value={settings.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="https://api.siliconflow.cn/v1" />
        </Field>
        <Field label="API Key">
          <input type="password" value={settings.apiKey} onChange={(e) => set('apiKey', e.target.value)} placeholder="sk-..." />
        </Field>
        <Field label="模型名">
          <input value={settings.model} onChange={(e) => set('model', e.target.value)} placeholder="deepseek-ai/DeepSeek-V3" />
        </Field>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty">
      <div style={{ fontSize: 40 }}>🎞️</div>
      <p>填写左侧商品信息、选一个短剧风格，点「生成」即可得到：</p>
      <ul>
        <li>剧情梗概 + 前 3 秒悬念钩子</li>
        <li>人物小传（跨镜头一致锚点）</li>
        <li>分镜脚本（台词 / 字幕 / 运镜 / 产品植入）</li>
        <li>卖点植入地图 + Seedance 分镜提示词</li>
      </ul>
    </div>
  )
}

function ResultView({ script, painMap, compliance, meta, onFix, fixing }) {
  const md = toMarkdown(script, meta)
  const sd = toSeedancePrompts(script)
  const [tab, setTab] = useState('overview')

  const tabs = [
    { id: 'overview', label: '概览' },
    { id: 'shots', label: '分镜脚本' },
    { id: 'map', label: '卖点地图' },
    { id: 'seed', label: 'Seedance' },
    { id: 'comp', label: `合规${compliance.length ? `(${compliance.length})` : ''}` },
  ]

  return (
    <div className="result">
      <div className="result-toolbar">
        <button className="ghost sm" onClick={() => download(`短剧带货脚本_${meta.productName || '商品'}.md`, md, 'text/markdown')}>⬇ 导出 MD</button>
        <button className="ghost sm" onClick={() => download(`短剧带货脚本_${meta.productName || '商品'}.json`, JSON.stringify(script, null, 2), 'application/json')}>⬇ 导出 JSON</button>
        <button className="ghost sm" onClick={() => navigator.clipboard.writeText(md)}>📋 复制全文</button>
      </div>

      <div className="result-head">
        <span className="badge">{script.genre} {meta.styleEmoji}</span>
        <span className="badge alt">{meta.platform}</span>
        <span className="badge alt">{meta.duration}s</span>
        <span className="badge alt">{script.tone}</span>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="tab-body">
          <Block title="一句话剧情梗概">
            <p className="logline">{script.logline}</p>
          </Block>
          <Block title="前 3 秒悬念钩子">
            <p className="hook">{script.hook}</p>
          </Block>
          {script.characters?.length > 0 && (
            <Block title="人物小传">
              {script.characters.map((c, i) => (
                <div className="char" key={i}>
                  <b>{c.name}</b> <span className="muted">（{c.role}）</span>
                  <div className="muted small">{c.arc}</div>
                  {c.appearance_desc && <div className="muted small">外貌锚点：{c.appearance_desc}</div>}
                </div>
              ))}
            </Block>
          )}
          {painMap?.pain_points?.length > 0 && (
            <Block title="痛点地图（剧情困境来源）">
              <ul className="pains">
                {painMap.pain_points.map((x, i) => (
                  <li key={i}><b>{x.scenario}</b> — {x.description} <span className="tag-mini">{x.matched_capability}</span></li>
                ))}
              </ul>
            </Block>
          )}
          {script.notes && <Block title="创作者备注"><p className="muted">{script.notes}</p></Block>}
        </div>
      )}

      {tab === 'shots' && (
        <div className="tab-body">
          {script.shots?.map((s) => (
            <div className="shot" key={s.index}>
              <div className="shot-head">
                <span className="shot-no">镜头 {s.index}</span>
                <span className="shot-time">{s.time}</span>
                <span className="shot-type">{s.shot_type}</span>
              </div>
              <div className="shot-grid">
                <div><span className="k">画面</span>{s.visual_desc}</div>
                <div><span className="k">口播</span>{s.dialogue}</div>
                <div><span className="k">字幕</span>{s.subtitle}</div>
                <div><span className="k">运镜</span>{s.camera}</div>
                <div><span className="k">产品植入</span>{s.product_placement}</div>
              </div>
              {s.seedance_prompt && <div className="seed-mini">🎥 Seedance：{s.seedance_prompt}</div>}
            </div>
          ))}
          <Block title="结尾转化"><p className="cta">{script.cta}</p></Block>
        </div>
      )}

      {tab === 'map' && (
        <div className="tab-body">
          <Block title="卖点植入地图">
            {script.selling_point_map?.length ? (
              <ul className="pains">
                {script.selling_point_map.map((m, i) => (
                  <li key={i}><b>{m.selling_point}</b> → 镜头 [{m.shot_indexes?.join(', ')}]：{m.how}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">模型未单独输出卖点地图，可参考分镜中的「产品植入」列。</p>
            )}
          </Block>
          {script.drama_beats?.length > 0 && (
            <Block title="剧情节拍 × 卖点落地">
              <table className="beat-table">
                <thead><tr><th>阶段</th><th>时间</th><th>剧情</th><th>产品作用</th><th>卖点</th></tr></thead>
                <tbody>
                  {script.drama_beats.map((b, i) => (
                    <tr key={i}>
                      <td>{b.phase}</td><td>{b.sec}</td><td>{b.story}</td>
                      <td>{b.product_role}</td><td>{b.selling_point || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>
          )}
        </div>
      )}

      {tab === 'seed' && (
        <div className="tab-body">
          <Block title="Seedance 分镜提示词（可直接批量投喂）">
            <pre className="seed-block">{sd}</pre>
            <button className="ghost sm" onClick={() => navigator.clipboard.writeText(sd)}>📋 复制全部</button>
          </Block>
        </div>
      )}

      {tab === 'comp' && (
        <div className="tab-body">
          <Block title="平台合规扫描">
            {compliance.length === 0 ? (
              <p className="ok">✅ 未发现高风险违禁/限用词。</p>
            ) : (
              <>
                <p className="warn">发现 {compliance.length} 处风险词，建议一键改写：</p>
                <ul className="pains">
                  {compliance.map((h, i) => (
                    <li key={i}><b>「{h.word}」</b>（{h.category}·{h.severity === 'high' ? '高危' : '中危'}）→ {h.suggestion}</li>
                  ))}
                </ul>
                <button className="primary sm" disabled={fixing} onClick={onFix}>{fixing ? '改写中…' : '🔧 一键合规改写'}</button>
              </>
            )}
          </Block>
        </div>
      )}
    </div>
  )
}

function Block({ title, children }) {
  return (
    <div className="block">
      <div className="block-title">{title}</div>
      <div className="block-body">{children}</div>
    </div>
  )
}

import { buildPainMapMessages, buildDramaScriptMessages } from './prompts.js'
import { BANNED_WORDS } from './constants.js'
import { chatCompletion, parseJSON } from './llm.js'

// Shared by single-product and batch generation; same two model calls.
export async function generateProduct({ p, settings, styleId, toneId, durationKey,
  platformId, temperature, avoidHooks = [], signal, onStep = () => {},
  onPainMap = () => {}, publication, completion = chatCompletion }) {
  const common = { baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model, json: true, signal }
  onStep('① 正在生成痛点地图…')
  const painMap = parseJSON(await completion({ ...common, messages: buildPainMapMessages(p), temperature: Math.min(temperature, 0.7) }))
  if (!Array.isArray(painMap?.pain_points) || !painMap.pain_points.length) throw new Error('痛点地图格式无效，请重试。')
  onPainMap(painMap)
  onStep('② 正在生成短剧分镜…')
  const messages = buildDramaScriptMessages({ p, styleId, toneId, durationKey, platformId, painMap, bannedWords: BANNED_WORDS, avoidHooks })
  if (publication) messages.push({ role: 'user', content: `在原JSON结构中额外添加 publication 对象：title（20字以内）、topics（最多5个话题的字符串数组）、cartTitle（10字以内）。仅生成发布文案草稿，不编造发布时间或挂车权限。挂车状态为${publication.cartStatus}；若为off，结尾cta不要引导购物车或购买。` })
  const script = parseJSON(await completion({ ...common, messages, temperature, maxTokens: 4000 }))
  if (!Array.isArray(script?.shots) || !script.shots.length || script._raw) throw new Error('短剧分镜格式无效，请重试。')
  return { painMap, script }
}

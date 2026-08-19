import { DURATIONS, PLATFORMS, BANNED_WORDS } from './constants'
import { getStyle } from './dramaStyles'

// ---------- 商品事实结构化 ----------
export function productFactsText(p) {
  const lines = []
  lines.push(`商品名称：${p.name || '（未填）'}`)
  lines.push(`类目：${p.category || '（未填）'}`)
  lines.push(`目标人群：${p.targetAudience || '（未填）'}`)
  lines.push(`价格/客单：${p.price || '（未填）'}`)
  lines.push(
    `已知卖点：${(p.sellingPoints || []).filter(Boolean).join('；') || '（未填）'}`
  )
  lines.push(
    `典型使用场景：${(p.scenarios || []).filter(Boolean).join('；') || '（未填）'}`
  )
  if (p.extra) lines.push(`补充信息：${p.extra}`)
  return lines.join('\n')
}

// ---------- 模块一：痛点地图（把卖点翻译成可代入的困境） ----------
export function buildPainMapMessages(p) {
  const system = `你是资深带货内容策略师，擅长把"干巴巴的卖点"翻译成"具体场景下、能引发共鸣的真实困境"。
只输出 JSON，不要任何额外解释。JSON 结构：
{
  "pain_points": [
    {
      "pain_id": "p1",
      "type": "功能性|情绪性|场景性|社交性",
      "description": "用户在没有该产品时遇到的具体麻烦（具体到可代入、有画面）",
      "intensity": "高|中|低",
      "scenario": "困境最强的具体场景（一句话画面）",
      "matched_capability": "对应到商品哪个具体卖点/功能能直接解决（必须来自已知卖点，禁止编造功效）",
      "emotional_hook": "该困境触发的情绪（烦躁/尴尬/焦虑/自责/委屈...）"
    }
  ]
}
约束：matched_capability 必须能在已知卖点中找到依据，不得虚构功效。至少 4 条、至多 8 条，覆盖 2 个以上维度。`

  const user = `${productFactsText(p)}

请基于以上商品事实构建痛点地图。只使用已知卖点作为 matched_capability 的支撑，绝不编造商品不具备的功效。`
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

// ---------- 模块二：短剧带货脚本（核心） ----------
export function buildDramaScriptMessages({
  p,
  styleId,
  toneId,
  durationKey,
  platformId,
  painMap,
  bannedWords = BANNED_WORDS,
  avoidHooks = [],
}) {
  const style = getStyle(styleId)
  const ds = DURATIONS[durationKey] || DURATIONS[30]
  const platform = PLATFORMS[platformId] || PLATFORMS.douyin
  const toneLabel =
    ({ hot: '热血燃', warm: '温情', funny: '搞笑', premium: '高级感', grounded: '接地气', suspense: '悬疑' }[
      toneId
    ] || '自然') || '自然'

  const styleText = style
    ? `【所选短剧风格】${style.name} ${style.emoji} —— ${style.tagline}
- 前 3 秒钩子手法：${style.hookStyle}
- 人物原型：${style.characterArchetype}
- 适合品类：${style.bestFor}
- 避坑：${style.antiPattern}
- 示例开场参考（仅作手法示意，不可照抄）：${style.exampleHook}
- 必须严格遵循的剧情节拍：
${style.beats
  .map((b) => `  · ${b.phase}（${b.sec}，偏${b.placement}）：${b.desc}`)
  .join('\n')}`
    : '（未指定风格，请自行选择最适合该商品的短剧结构）'

  const painText = painMap?.pain_points?.length
    ? painMap.pain_points
        .map(
          (x) =>
            `- [${x.type}/${x.intensity}] ${x.scenario}：${x.description} → 卖点回应「${x.matched_capability}」（情绪：${x.emotional_hook}）`
        )
        .join('\n')
    : '（未生成痛点地图，请基于商品事实自行推理可代入的困境）'

  const avoidText =
    avoidHooks && avoidHooks.length
      ? `多样性约束：本次禁止使用最近用过的开场钩子类型【${avoidHooks.join(
          '、'
        )}】，请在风格的钩子手法池里换一个。`
      : '（无最近钩子避重约束）'

  const banText = bannedWords.length
    ? bannedWords.map((b) => `${b.word}（${b.category}，${b.severity === 'high' ? '高危' : '中危'}→${b.suggestion}）`).join('、')
    : '（无）'

  const system = `你是顶级"短剧带货"导演兼编剧。你的任务不是"讲解产品"，而是**用一段好看的短剧把产品卖出去**。
核心铁律（务必遵守）：
1. 产品必须是剧情的"必需品 / 关键道具 / 转折筹码"——观众是因为"想看结局、代入角色"而看，绝不会因为"被推销"而看。卖点通过角色的真实困境与选择自然流露，禁止生硬口播罗列卖点。
2. 前 3 秒用【剧情悬念 / 冲突 / 反差 / 情绪】抓人，绝对禁止"今天给大家推荐一个好产品""家人们谁懂啊我最近发现"这类推销式开场。
3. 严格遵循所选短剧风格的"剧情节拍"，把 ${ds.shots} 个镜头分配到各节拍，剧情推进与卖点落地比例要合理（卖点集中落在"产品高光"节拍）。
4. 每个核心卖点必须绑定一个具体剧情时刻，并写进 selling_point_map；卖点要"被角色用出来/被角色感叹"，而非旁白陈述。
5. 口播台词像真人说话，有口音/口头禅/情绪更佳；字幕是上屏重点，短而爆。
6. 遵守时长结构与画幅；结尾 CTA 软性促成转化，不硬喊"点击购买"。
7. 平台合规（极重要）：以下为本渠道高风险违禁/限用词，严禁出现在任何台词、字幕、标题中——${banText}。若需表达类似意思，必须用合规替代说法；命中会导致限流甚至下架，请逐句自查。

只输出 JSON，不要额外解释。结构：
{
  "logline": "一句话剧情梗概（含产品扮演的角色，≤40字）",
  "genre": "${style ? style.name : '智能匹配'}",
  "tone": "${toneLabel}",
  "hook": "前 3 秒剧情钩子原文（1-2 句，制造悬念/冲突/反差）",
  "characters": [{"name":"角色名","role":"身份/关系","arc":"在本剧里的转变","appearance_desc":"跨镜头一致的外貌锚点（发型/五官/穿着/体型）"}],
  "pain_points": [{"scenario":"困境画面","matched_capability":"对应卖点"}],
  "drama_beats": [
    {"beat":1,"phase":"阶段名","sec":"时间","story":"剧情推进（不含卖点硬广）","product_role":"产品在此刻起什么作用","selling_point":"此处植入的卖点（无则空）"}
  ],
  "shots": [
    {
      "index":1,
      "time":"0-3s",
      "shot_type":"景别/构图",
      "visual_desc":"画面描述（含人物一致性锚点 + 产品出现方式）",
      "dialogue":"口播台词（口语、有情绪）",
      "subtitle":"上屏字幕（短爆）",
      "camera":"运镜",
      "product_placement":"本镜产品如何自然出现/被使用（无则'未出现'）",
      "seedance_prompt":"投喂 Seedance 的视频生成提示词（中文，含主体/动作/场景/光影/风格/运镜，强调人物一致性锚点，≤60字）"
    }
  ],
  "cta": "结尾软性转化原文（引导购物车/橱窗，不硬广）",
  "selling_point_map": [{"selling_point":"某卖点","shot_indexes":[3,4],"how":"如何在剧情中自然植入"}],
  "seedance_prompts": ["各镜 Seedance 提示词汇总（与 shots 顺序一致）"],
  "notes": "给创作者的备注（情绪落点/选角/二次创作建议/风险点）"
}
shots 数量 = ${ds.shots}，每镜 time 需匹配节拍时间轴。drama_beats 数量与 shots 对应。`

  const user = `【商品事实】
${productFactsText(p)}

【短剧风格与节拍】
${styleText}

【时长结构】${ds.label}：${ds.beats.join(' / ')}（${ds.note}）

【平台规范】${platform.name}：
- 画幅：${platform.aspect_ratio}
- 算法偏好：${platform.algorithm_bias}
- 字幕风格：${platform.caption_style}
- 结尾引导惯例：${platform.cta_convention}

【语气基调】${toneLabel}

【痛点地图（剧情困境的来源）】
${painText}

${avoidText}

请生成完整短剧带货分镜脚本 JSON。要求：剧情好看、产品自然、卖点扎实、可直接拿去拍/拿去喂 Seedance。`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

// ---------- 模块三：合规改写（命中违禁词时调用） ----------
export function buildRewriteMessages({ script, hits, bannedWords = BANNED_WORDS }) {
  const hitLines = (hits || [])
    .map(
      (h) =>
        `- 字段命中"${h.word}"（${h.category}，${h.severity === 'high' ? '高危' : '中危'}）→ 建议：${h.suggestion}`
    )
    .join('\n')
  const banText = bannedWords.map((b) => b.word).join('、')
  const system = `你是带货短视频合规改写师。在不改变主题、结构、时长、人物场景设定与表达意图的前提下，将脚本中命中的平台违禁/限用词替换为合规表达，消除限流与下架风险。
规则：1) 只改命中词所在句子，保留原节奏与口语感，不删卖点；2) 严禁再出现：${banText}；3) 极限词→主观体验，医疗功效→日常护理/感受，导流→购物车/橱窗，强诱导→软建议。
输出与输入完全同结构的 JSON（含 logline/genre/tone/hook/characters/pain_points/drama_beats/shots/cta/selling_point_map/seedance_prompts/notes；shots 数量与 index 不变）。
只输出 JSON，不要额外解释。`

  const user = `【待改写脚本】
${JSON.stringify(script, null, 2)}

【命中清单（必须逐条处理）】
${hitLines || '（无）'}

请返回改写后的完整脚本 JSON。`
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

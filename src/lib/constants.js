// ---------- 模型 / Provider 预设 ----------
// 默认 SiliconFlow：OpenAI 兼容 + 浏览器 CORS 友好 + 可调用 DeepSeek 系列模型。
// 若坚持用官方 DeepSeek（api.deepseek.com），因无 CORS 需自托管代理（见仓库 server/proxy.cjs + render.yaml）。
export const PROVIDERS = {
  siliconflow: {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow（推荐·浏览器直连）',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    note: '免费注册即送额度，支持 deepseek-ai/DeepSeek-V3、deepseek-ai/DeepSeek-R1 等。',
    corsOk: true,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek 官方（需自托管代理·无浏览器 CORS）',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    note: '官方接口不支持浏览器跨域，纯静态站需配 server/proxy.cjs 转发，或直接部署 render.yaml 版本。',
    corsOk: false,
  },
  custom: {
    id: 'custom',
    label: '自定义 OpenAI 兼容端点',
    baseUrl: '',
    defaultModel: '',
    note: '填入任意 OpenAI 兼容的 /v1 基址，例如自建代理、Azure OpenAI、Groq 等。',
    corsOk: true,
  },
  proxy: {
    id: 'proxy',
    label: '自托管代理（Render 版·服务端转发，支持官方 DeepSeek）',
    baseUrl: '/api/generate',
    defaultModel: 'deepseek-chat',
    note: '部署仓库内置 server/proxy.cjs 后可用。服务端转发避开浏览器 CORS，Key 仅本次请求使用、不落库。',
    corsOk: true,
  },
}

// ---------- 时长结构 ----------
export const DURATIONS = {
  15: {
    key: 15,
    label: '15 秒 · 钩子即转化',
    beats: ['0-3s 钩子', '3-8s 冲突', '8-12s 反转', '12-15s 转化'],
    shots: 4,
    note: '极短，只保留一个最强冲突 + 一次反转 + 软转化。',
  },
  30: {
    key: 30,
    label: '30 秒 · 标准短剧单元',
    beats: ['0-3s 钩子', '3-10s 铺垫冲突', '10-20s 升级/反转', '20-27s 产品高光', '27-30s 转化'],
    shots: 5,
    note: '最常用，能讲一个完整的小反转，产品作为反转关键。',
  },
  60: {
    key: 60,
    label: '60 秒 · 完整小剧场',
    beats: ['0-3s 钩子', '3-15s 铺垫', '15-35s 冲突升级', '35-50s 反转/产品高光', '50-57s 情感落点', '57-60s 转化'],
    shots: 6,
    note: '适合有情绪价值的品类，能铺垫人物关系再植入产品。',
  },
  90: {
    key: 90,
    label: '90 秒 · 连续剧切片',
    beats: ['0-3s 钩子', '3-20s 铺垫', '20-45s 冲突升级', '45-70s 反转/产品高光', '70-82s 情感落点', '82-90s 转化/悬念'],
    shots: 7,
    note: '可做"未完待续"切片，结尾留悬念引导关注。',
  },
}

// ---------- 平台规范 ----------
export const PLATFORMS = {
  douyin: {
    id: 'douyin',
    name: '抖音',
    aspect_ratio: '9:16 竖屏',
    duration_range: '15-60s 为主',
    caption_style: '大字爆点字幕 + 关键帧强调',
    algorithm_bias: '完播率 > 互动率；前 3 秒决定推流',
    cta_convention: '小黄车 / 购物车，口播"左下角/下方"软引导',
  },
  shipinhao: {
    id: 'shipinhao',
    name: '视频号',
    aspect_ratio: '9:16 竖屏',
    duration_range: '30-60s',
    caption_style: '沉稳字幕，弱化花字',
    algorithm_bias: '社交裂变 + 朋友点赞加权',
    cta_convention: '公众号/小程序挂载，信任型转化',
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    name: '小红书',
    aspect_ratio: '3:4 / 9:16',
    duration_range: '30-60s',
    caption_style: '种草风封面标题 + 真诚口播',
    algorithm_bias: '搜索 + 封面点击，重真实感',
    cta_convention: '笔记挂车 / 店铺，强调"亲测"',
  },
  kuaishou: {
    id: 'kuaishou',
    name: '快手',
    aspect_ratio: '9:16 竖屏',
    duration_range: '30-60s',
    caption_style: '老铁风字幕，口语化',
    algorithm_bias: '私域信任 + 普惠流量',
    cta_convention: '小店，强调"家人/实惠"',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    aspect_ratio: '9:16 竖屏',
    duration_range: '15-30s',
    caption_style: 'Trend 字幕 + 节拍卡点',
    algorithm_bias: 'For You 完播 + 复看',
    cta_convention: 'Shop / Link in bio',
  },
}

// ---------- 语气 ----------
export const TONES = [
  { id: 'hot', label: '热血燃', desc: '节奏快、情绪高、打脸爽感' },
  { id: 'warm', label: '温情', desc: '慢节奏、共情、家庭/治愈' },
  { id: 'funny', label: '搞笑', desc: '夸张反差、沙雕、meme 感' },
  { id: 'premium', label: '高级感', desc: '克制、质感、品牌调性' },
  { id: 'grounded', label: '接地气', desc: '方言/生活化、真实粗糙感' },
  { id: 'suspense', label: '悬疑', desc: '悬念、留白、钩子前置' },
]

// ---------- 平台合规：高风险违禁/限用词（软约束，逐句自查） ----------
// severity: high 高危(限流/下架) medium 中危 low 低危
export const BANNED_WORDS = [
  { word: '最', category: '极限词', severity: 'high', suggestion: '改用"我个人很推荐/身边用得最多"' },
  { word: '第一', category: '极限词', severity: 'high', suggestion: '改用"很多人的选择"' },
  { word: '国家级', category: '极限词', severity: 'high', suggestion: '删除或改具体描述' },
  { word: '唯一', category: '极限词', severity: 'high', suggestion: '改用"少数/难得"' },
  { word: '绝对', category: '极限词', severity: 'high', suggestion: '改用"基本/通常"' },
  { word: '100%', category: '绝对化', severity: 'high', suggestion: '改用"绝大多数情况"' },
  { word: '根治', category: '医疗功效', severity: 'high', suggestion: '改用"帮助改善/日常护理"' },
  { word: '美白', category: '医疗功效', severity: 'high', suggestion: '改用"提亮/焕亮肤色感"' },
  { word: '减肥', category: '医疗功效', severity: 'high', suggestion: '改用"管理体态/轻盈感"' },
  { word: '治疗', category: '医疗功效', severity: 'high', suggestion: '改用"舒缓/呵护"' },
  { word: '加微信', category: '站外导流', severity: 'high', suggestion: '改用"购物车/橱窗下单"' },
  { word: '私聊', category: '站外导流', severity: 'medium', suggestion: '改用"店铺咨询"' },
  { word: '点击下方链接', category: '导流话术', severity: 'medium', suggestion: '改用"左下角小黄车"' },
  { word: '立即购买', category: '强诱导', severity: 'medium', suggestion: '改用"感兴趣可以看看"' },
  { word: '史上', category: '极限词', severity: 'medium', suggestion: '删除' },
  { word: '万能', category: '极限词', severity: 'medium', suggestion: '改用"多场景适用"' },
  { word: '秒杀', category: '促销违规', severity: 'medium', suggestion: '改用"限时活动"' },
  { word: '全网最低', category: '极限词', severity: 'high', suggestion: '改用"很有性价比"' },
]

export function scanBannedWords(text, list = BANNED_WORDS) {
  if (!text) return []
  const hits = []
  for (const b of list) {
    if (text.includes(b.word)) {
      hits.push({ word: b.word, category: b.category, severity: b.severity, suggestion: b.suggestion })
    }
  }
  return hits
}

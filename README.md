# 短剧带货脚本引擎 · Drama Selling Script

把"产品卖点讲解"升级为"短剧剧情带货"：**用一段好看的短剧把产品卖点自然植入**，一键生成可直
接投喂 Seedance 的分镜脚本。解决旧版"基于卖点罗列、不够吸引人"的问题——观众是因为想看结局、
代入角色而看，卖点通过角色真实困境自然流露，而非生硬口播。

## 与旧版（ai-video-script-engine）的本质区别

| 维度 | 旧版 | 本版 |
|---|---|---|
| 叙事 | 卖点维度组合 + 痛点地图 | **短剧结构驱动**（反转/霸总/闺蜜/悬疑…）|
| 开场 | 痛点口播 | **前 3 秒剧情悬念/冲突/反差** |
| 产品角色 | 被介绍的客体 | **剧情的必需品/关键道具/转折筹码** |
| 吸引力 | 信息密度高但像广告 | 像短剧，先好看再种草 |
| 下游 | 导出分镜 | 额外输出 **Seedance 分镜提示词** |

## 功能

- 商品信息录入（卖点 / 场景 / 人群 / 价格）
- **10 种短剧风格**：反转逆袭、霸总甜宠、闺蜜种草、家庭温情、悬疑探案、搞笑沙雕、情感治愈、
  职场逆袭、测评打假、夫妻婆媳——每种带独立叙事节拍与植入策略
- 时长（15/30/60/90s）、平台（抖音/视频号/小红书/快手/TikTok）、语气参数化
- 痛点地图 → 短剧分镜两段式生成
- 卖点植入地图、人物跨镜头一致性锚点
- 平台合规扫描 + 一键合规改写（违禁/限用词）
- 导出 Markdown / JSON，复制全文

## 部署（拿到新链接）

### 方式 A：静态站直接部署（推荐，立即拿链接）
纯前端，**默认走 SiliconFlow（OpenAI 兼容 + 浏览器 CORS 友好，可调用 DeepSeek 模型）**。
`npm install && npm run build` 后，把 `dist/` 部署到任意静态托管（CloudStudio / Vercel / Netlify /
对象存储）即得到新链接。前端「设置」填 SiliconFlow 的 Key 即可使用。

### 方式 B：Render 部署原生 DeepSeek（无 CORS 问题）
仓库内置 `server/proxy.cjs` 与 `render.yaml`。在 Render 控制台 New → Blueprint → 连接本仓库，
自动建 Web Service；部署后前端选「自托管代理」模式填 DeepSeek Key 即可。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 产出 dist/
```

## 目录

```
src/lib/constants.js   # provider / 时长 / 平台 / 语气 / 违禁词
src/lib/dramaStyles.js # 短剧风格库（核心差异点）
src/lib/prompts.js     # Prompt 引擎（痛点地图 + 短剧分镜）
src/lib/llm.js         # OpenAI 兼容客户端（直连 / 代理）
src/lib/export.js      # 导出 MD/JSON/Seedance
src/App.jsx            # 交互界面
server/proxy.cjs       # 可选自托管代理（Render 用）
render.yaml            # Render Blueprint
```

> 隐私：纯前端模式下 API Key 仅存于浏览器 localStorage，直接调用模型，不经过任何第三方服务器。

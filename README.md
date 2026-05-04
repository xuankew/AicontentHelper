# 公众号写作流水线助手（Obsidian 插件）

社区插件 ID：`gzh-writing-pipeline`。市场页（版本说明以仓库内 `manifest.json` / `CHANGELOG.md` 为准）：[Obsidian Plugins](https://obsidian.md/plugins?id=gzh-writing-pipeline)。

## 用途

把「原始思考卡片 → 提纲 → 扩写初稿 → 去 AI 味 → 审稿 → 发布稿」公众号写作流程**固定成可重复执行的状态机**，并在 `Published/文章标题-六位随机数/` 下集中管理阶段文件，**不修改你的原始思考卡片**。

## 从 GitHub 克隆与本地安装（开发）

1. **克隆**本仓库到本地。
2. 在仓库根目录执行 **`npm ci`**（推荐，与 `package-lock.json` 一致）或 **`npm install`**。需要 **Node.js 18+**。
3. 执行 **`npm run build`**，在根目录生成 **`main.js`**。本仓库的 `.gitignore` **不跟踪** `node_modules/`、`main.js`、`main.js.map` 等物品，因此克隆后必须完成依赖安装与构建，不能直接复制源码目录当作已构建插件使用。
4. 将整个插件目录复制或软链到库的：

   `你的库/.obsidian/plugins/gzh-writing-pipeline/`

   **文件夹名必须与 `manifest.json` 里的 `"id"` 一致**（默认为 `gzh-writing-pipeline`）。

5. 上述目录至少需要：

   - `manifest.json`
   - `main.js`（构建产物）
   - `styles.css`

6. 在 Obsidian：**设置 → 第三方插件 → 关闭安全模式**（如需要）→ 打开本插件。

**安全**：不要将 API Key、微信公众号 Cookie、账号密码或可识别隐私写入会被 Git 提交的文件；仅使用插件设置面板或仅限本地的路径。

## 设置

进入 **设置 → 公众号写作流水线助手**：

- **Provider**：OpenAI / DeepSeek / 豆包（均按 OpenAI Chat Completions 兼容接口调用）
- **API Key / Base URL / Model**
- **Temperature / Max Tokens**（全局）
- **Published 目录策略**
  - 默认：在原始卡片所在目录下创建 `Published/`
  - 也可切换到固定输出根目录（需填写 vault 相对路径）
- **人设 / 风格 / 四阶段提示词**（支持变量占位符）
- **覆盖确认 / 保留历史版本 / Debug 日志**

### 变量占位符

- `{{authorProfilePrompt}}` / `{{writingStylePrompt}}`
- `{{sourceContent}}` / `{{outlineContent}}` / `{{draftContent}}` / `{{humanizedContent}}`

### 豆包说明

请将 **Base URL** 填写为兼容 OpenAI Chat Completions 的网关地址；或填写完整的 `.../chat/completions` endpoint。

## 使用流程（与需求文档一致）

入口说明（很重要）：

- **Markdown 编辑器标题栏右上角**：打开任意 Markdown 笔记时，在标题栏右侧会看到 **六个图标按钮**：列提纲、扩写、去 AI 味、审稿、发布到公众号、图文卡片（带 `（GZH）` 提示）。后两项需在 **审稿完成 (`reviewed`)** 后执行。
  额外入口：
  1. **左侧 Ribbon**：**纸张/文档** 图标，`file-text`，点击弹出同款菜单列表。
  2. **命令面板**：`Ctrl/Cmd+P`，搜索 **`GZH Pipeline`**。
  3. **底部状态栏**：**`GZH: …`** 文案可点击弹出菜单。

若你看不到 Ribbon：请在 **Obsidian → 外观** 相关设置里开启 **Ribbon**（不同版本措辞可能略有不同）。

请将插件安装在：`.obsidian/plugins/gzh-writing-pipeline/` 且 **`manifest.json` 里的 `"id"` 必须与文件夹名一致**（默认为 `gzh-writing-pipeline`）。若文件夹名与 `id` 不一致，可能导致插件无法正常加载。

写作步骤：

1. 打开一篇 **原始思考卡片**（Markdown）。
2. 运行 **「GZH Pipeline: 列提纲」**（或点击左侧 Ribbon 的文档图标 / 点击底部状态栏 **`GZH:`** 文本打开菜单）。
3. 插件会在 `Published/标题-六位随机数字/` 下创建：

- `00-source.md`（原文备份）
- `meta.json`（状态机等元数据）
- `01-outline.md`（提纲，LLM 成功后才写入）

后续在 **Published 项目目录内的任意文件** 上继续：

4. **扩写** → `02-draft.md`
5. **去 AI 味** → `03-humanized.md`
6. **审稿** → `04-final.md` + `05-review-report.md`（LLM 必须按分隔符输出；格式异常则不写入）

## 目录结构与文件含义

示例：

```
Published/
  └── 标题-839201/
      ├── 00-source.md          # 原文备份（不覆盖）
      ├── 01-outline.md
      ├── 02-draft.md
      ├── 03-humanized.md
      ├── 04-final.md
      ├── 05-review-report.md
      └── meta.json
```

## 状态机说明

只允许按顺序前进：

```
source_created -> outlined -> drafted -> humanized -> reviewed
```

- **原始卡片页面**：只能执行「列提纲」
- **Published 文章项目**：按状态解锁「扩写 / 去 AI 味 / 审稿」

> 项目在仓库中的识别规则：**当前文件路径向上查找 `meta.json`**，并要求其父目录命中你的 Published 目录策略（本地 `Published/` 文件夹名默认为 `publishedDirName`；或使用固定 Published 根目录模式）。

## 命令面板命令

- `GZH Pipeline: 列提纲`
- `GZH Pipeline: 扩写`
- `GZH Pipeline: 去 AI 味`
- `GZH Pipeline: 审稿`
- `GZH Pipeline: 打开文章项目目录`（打开项目内第一个可用入口文件）
- `GZH Pipeline: 打开审稿报告`
- `GZH Pipeline: 复制最终文章`
- `GZH Pipeline: 发布到公众号（官方 API）`
- `GZH Pipeline: Moka 图文卡片（Native）`

## 发布公众号 / Native Moka（桌面端）

自 **v0.2**，本插件 **`isDesktopOnly: true`**：**公众号草稿**由内置 **微信公众平台 `draft/add` API**（不再调用 Baoyu / Bun）。

### 你需要准备什么

1. **公众号**：可调用草稿与素材接口的 AppId，在设置中填写 **`WECHAT_APP_ID` / `WECHAT_APP_SECRET`**（单行 `appId|appSecret` 亦可）。
2. **封面 / 正文配图**：在 **插件 HTTP 作图** 中选：**豆包 · 火山 Ark**、**智谱 GLM/CogView**、**OpenAI GPT Image**，或「自定义」兼容 OpenAI `images/generations` 的完整 URL。
3. **画布 WxH**（可选）：火山 **Seedream** 总像素 ≥ 3 686 400；分项留空则用内置偏大默认。**小红书 Native 卡组**在「Native Moka」小节单独设置逻辑尺寸（默认 1242×1660）。
4. **Moka**：`图文卡片` 命令用 LLM 生成 JSON，本机 **html-to-image** 导出至 `assets/moka-cards/`（`deck.json`、`outline.md`、`01-*.png`），见 `meta.json.publish.mokaCards`。

### Reviewed 之后

- **发布到公众号**：生成 `publish/wechat-input.md`、封面与配图，再走官方草稿 API；结果见 **`publish/wechat-result.json`**。
- **图文卡片**：写入 **`assets/moka-cards/`**。

### 产出目录示意

```
Published/标题-xxxxxx/
├── 04-final.md
├── meta.json
├── publish/
│   ├── wechat-input.md
│   ├── wechat-result.json
│   └── logs/
└── assets/
    ├── cover/
    ├── illustrations/
    └── moka-cards/
```

排查：控制台前缀 **`[GZH 微信 API]`**、**`[GZH 生图]`**、**`[GZH Moka 渲染]`**。

## `.gitignore`（贡献者与 fork）

以下内容被刻意排除在版本库外，避免因体积、闭源二进制或本地生成物污染 PR：

| 类别 | 被忽略的常见项 | 说明 |
| --- | --- | --- |
| 依赖 | `node_modules/` | 由 lockfile + `npm install` 复原 |
| 构建产物 | `main.js`、`main.js.map` | 由 `npm run build` 生成 |
| 可选二进制 | `vendor/moka/`、`vendor/raphael-publish/` | 若你的工作流需要，在本地放置；不向公开分支提交无权分发的二进制 |
| 脚本样例 | `scripts/raphael-sample.html`、`.raphael-sample.bundle.cjs` | Raphael 预览页相关，可再由脚本生成 |

提交前请确认未加入 `.env`、日志中的 Cookie、或未脱敏的运行痕迹。

## 常见问题

### 1) 提示「请先打开一篇 Markdown 文件」

「列提纲」必须在打开 Markdown 文件时执行。

### 2) 提示 API Key 未配置

到设置里为当前 Provider 填写 API Key。

### 3) LLM 失败会不会污染目录？

不会推进 `meta.json` 状态，也不会写入空的阶段文件；列提纲失败时通常会保留 `00-source.md` + `meta.json`（若已创建项目目录）。

### 4) 审稿提示「返回格式异常」

审稿提示词要求模型严格输出：

```
===FINAL_ARTICLE===
...
===REVIEW_REPORT===
...
```

否则插件会拒绝写入，避免半成品。

## 如何扩展更多阶段（建议）

当前代码按模块拆分（`services/`、`providers/`、`templates/`），新增阶段时建议：

1. 在 `STAGE_FILES` 增加文件名常量
2. 扩展 `ArticleStatus` 与 `meta.json` 结构
3. 在 `PipelineService` 增加一个新的 `runLlmStage` / 专用动作
4. 在 `main.ts`（插件类）注册命令与 Ribbon 菜单项

## 注意事项

- 本插件定位是**写作流水线助手**，不是「一键爆款生成器」：真实经历、判断与最终把关仍应留在人这一侧。
- **不要**把 API Key 提交到公开仓库；建议使用 Obsidian 的私密仓库或本地 vault。
- 复制到剪贴板依赖浏览器/Electron 能力；若环境不支持，可能失败（可改用打开 `04-final.md` 手动复制）。

## MVP 验收清单（建议手测）

以下为需求文档中的核心场景，建议在真实 vault 中逐项验证：

1. **从原始思考卡片列提纲**：生成 `Published/标题-随机/`、`00-source.md`、`01-outline.md`、`meta.json` 且 `status=outlined`；原始卡片不被改写。
2. **扩写**：在项目内执行后生成 `02-draft.md` 且 `status=drafted`。
3. **去 AI 味**：生成 `03-humanized.md` 且 `status=humanized`。
4. **审稿**：生成 `04-final.md` + `05-review-report.md` 且 `status=reviewed`。
5. **非法状态阻止**：在原始卡片上执行扩写/去味/审稿应被提示并无副作用。
6. **LLM 失败不污染**：错误 API Key 时不应产生空阶段文件，不应推进状态。
7. **审稿格式异常**：缺少分隔符时应提示且不应写入 `04/05`。
8. **发布公众号（API）**：`reviewed` 后可用；详见 `publish/wechat-result.json` 与控制台 `[GZH 微信 API]`。
9. **图文卡片**：应在 `assets/moka-cards/` 生成 `deck.json` / PNG，`meta.publish.mokaCards` 有计数。

## 开发

```bash
npm run dev
```

会启动 esbuild watch（修改 `main.ts` / `src/**` 后自动重建 `main.js`）。

## 许可证

MIT

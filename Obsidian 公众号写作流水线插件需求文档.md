# Obsidian 公众号写作流水线插件需求文档

> 可直接复制给 Cursor 使用  
> 插件定位：AI内容助手  
> 适用场景：家庭教育公众号内容创作  
> 核心原则：人主导，AI 辅助；保护原始思考卡片；按阶段生成内容

---

# 一、项目名称

## 中文名

AI内容助手

## 英文插件 ID

```text
gzh-writing-pipeline
```

---

# 二、开发背景

我是一个家庭教育领域长期内容创业者。

我的定位是：

```text
真实爸爸视角 + 理性工具派 + 家庭教育实战方法
```

我的目标用户是：

```text
25-45 岁父母
```

他们主要焦虑：

1. 孩子写作业拖拉
2. 父母情绪失控、总吼孩子
3. 孩子沉迷手机
4. 亲子沟通差
5. 学习习惯不好
6. 父母教育理念冲突

我的内容风格是：

```text
真实、克制、有逻辑、能落地、不鸡汤、不空话
```

我希望在 Obsidian 中完成公众号文章写作流程。

核心流程是：

```text
原始思考卡片
↓
文章主线 / 提纲
↓
扩写初稿
↓
去 AI 味
↓
审稿校准
↓
最终发布稿
```

插件目标不是一键生成爆款文章，而是帮助我把这个写作流程固定下来。

我负责：

1. 真实经历
2. 真实观察
3. 核心判断
4. 价值观把关
5. 最终修改

插件负责：

1. 固定流程
2. 调用 LLM
3. 生成阶段文件
4. 保护原始卡片
5. 控制文章状态
6. 保持目录整洁
7. 提升写作效率

---

# 三、插件核心目标

开发一个 Obsidian 插件。

插件需要在当前 Markdown 页面中提供以下操作：

1. 列提纲
2. 扩写
3. 去 AI 味
4. 审稿

插件根据当前文章状态，控制按钮是否可用。

插件需要调用 LLM API，包括：

1. OpenAI
2. DeepSeek
3. 豆包

用户可以在插件设置页配置：

1. Provider
2. API Key
3. Base URL
4. 模型名称
5. Temperature
6. Max Tokens
7. 生成文章目录
8. 个人身份提示词
9. 内容风格提示词
10. 每个阶段的提示词

---

# 四、重要开发原则

## 1. 不破坏原始思考卡片

我会通过 Obsidian 的 Templater 插件新建原始思考卡片。

原始思考卡片是我的核心资产。

插件点击“列提纲”时，必须读取当前原始 Markdown 文件内容，但不能覆盖、修改、删除这个原始文件。

所有 LLM 生成过程中的内容，都必须放到 Published 目录下的新文章项目目录里。

---

## 2. 所有生成文件必须集中管理

在 Published 目录下，以：

```text
文章标题 + 随机唯一数字
```

创建文章项目目录。

示例：

```text
Published/
└── 孩子一看到作业就烦，试试这个拆任务方法-482913/
    ├── 00-source.md
    ├── 01-outline.md
    ├── 02-draft.md
    ├── 03-humanized.md
    ├── 04-final.md
    ├── 05-review-report.md
    └── meta.json
```

文件说明：

| 文件名 | 作用 |
|---|---|
| `00-source.md` | 原始思考卡片的安全备份 |
| `01-outline.md` | 文章主线 / 提纲 |
| `02-draft.md` | 扩写初稿 |
| `03-humanized.md` | 去 AI 味后的文章 |
| `04-final.md` | 审稿后校准过的最终文章 |
| `05-review-report.md` | 审稿报告，只记录问题、原因、具体改法 |
| `meta.json` | 保存当前文章状态、源文件路径、标题、创建时间、更新时间、阶段信息等 |

---

## 3. 保持目录干净

插件不能随意创建临时文件。

如果 LLM 调用失败：

1. 不应该生成空文件
2. 不应该生成半成品文件
3. 不应该推进文章状态

如果点击【列提纲】时，文章项目目录已经创建，但 LLM 调用失败，可以保留：

```text
00-source.md
meta.json
```

但不能创建空的：

```text
01-outline.md
02-draft.md
03-humanized.md
04-final.md
05-review-report.md
```

写入阶段文件时，应先拿到 LLM 完整结果，再写入文件。

---

## 4. 状态机必须严格

文章状态只能按顺序推进：

```text
source_created → outlined → drafted → humanized → reviewed
```

对应操作关系：

| 当前状态 | 允许操作 |
|---|---|
| `source_created` | 列提纲 |
| `outlined` | 扩写 |
| `drafted` | 去 AI 味 |
| `humanized` | 审稿 |
| `reviewed` | 默认不允许继续生成，或只允许重新审稿 |

注意：

只有 Published 目录下面的文章，才能点击：

1. 扩写
2. 去 AI 味
3. 审稿

原始思考卡片页面只能点击：

```text
列提纲
```

如果用户在非 Published 目录的原始卡片中点击：

1. 扩写
2. 去 AI 味
3. 审稿

插件应该禁用按钮，或提示：

```text
请先点击【列提纲】，在 Published 目录中生成文章项目后再继续。
```

---

## 5. 保持可扩展性

后续插件会扩展：

1. 小红书改写
2. 视频脚本生成
3. 标题 AB 测试
4. 文章质量评分
5. 选题库
6. 产品工具埋点
7. 自动生成图文卡片文案
8. 公众号排版优化
9. 内容发布检查清单

所以不要把所有逻辑写在 `main.ts` 里。

---

# 五、技术要求

使用 Obsidian 官方插件开发方式。

要求：

1. TypeScript
2. 基于 Obsidian sample plugin 项目结构
3. 使用 Obsidian Plugin API
4. 使用 Vault API 进行文件读写
5. 使用 `requestUrl` 调用 HTTP API
6. 提供 `manifest.json`
7. 提供设置页
8. 提供 Ribbon Icon 或编辑器顶部按钮 / 菜单
9. 支持命令面板命令
10. 支持中文文件名
11. 支持中文标题
12. 支持 Markdown 文件

---

# 六、推荐项目结构

```text
gzh-writing-pipeline/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── main.ts
├── styles.css
└── src/
    ├── constants.ts
    ├── types.ts
    ├── settings/
    │   ├── settings.ts
    │   └── SettingTab.ts
    ├── ui/
    │   ├── ArticleToolbar.ts
    │   ├── ConfirmModal.ts
    │   ├── LoadingModal.ts
    │   └── NoticeHelper.ts
    ├── services/
    │   ├── ArticleProjectService.ts
    │   ├── FileService.ts
    │   ├── StateService.ts
    │   ├── PromptService.ts
    │   ├── LLMService.ts
    │   ├── ProviderFactory.ts
    │   └── ReviewService.ts
    ├── providers/
    │   ├── BaseProvider.ts
    │   ├── OpenAIProvider.ts
    │   ├── DeepSeekProvider.ts
    │   └── DoubaoProvider.ts
    ├── templates/
    │   ├── defaultPrompts.ts
    │   ├── fileTemplates.ts
    │   └── metaTemplate.ts
    └── utils/
        ├── path.ts
        ├── slug.ts
        ├── random.ts
        ├── frontmatter.ts
        └── markdown.ts
```

---

# 七、核心数据结构

## 1. 插件设置类型

```ts
export interface GzhWritingPipelineSettings {
  provider: "openai" | "deepseek" | "doubao";

  openai: LLMProviderConfig;
  deepseek: LLMProviderConfig;
  doubao: LLMProviderConfig;

  publishedDirName: string;
  createPublishedUnderSourceDir: boolean;
  fixedPublishedDirPath: string;

  authorProfilePrompt: string;
  writingStylePrompt: string;

  outlinePrompt: string;
  draftPrompt: string;
  humanizePrompt: string;
  reviewPrompt: string;

  modelTemperature: number;
  maxTokens: number;

  confirmBeforeOverwrite: boolean;
  keepHistoryVersions: boolean;
  enableDebugLog: boolean;
}

export interface LLMProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}
```

---

## 2. 文章状态

```ts
export type ArticleStatus =
  | "source_created"
  | "outlined"
  | "drafted"
  | "humanized"
  | "reviewed";
```

---

## 3. meta.json 结构

```ts
export interface ArticleMeta {
  id: string;
  title: string;
  sourceFilePath: string;
  projectDirPath: string;
  status: ArticleStatus;
  createdAt: string;
  updatedAt: string;
  files: {
    source: string;
    outline?: string;
    draft?: string;
    humanized?: string;
    final?: string;
    reviewReport?: string;
  };
  provider?: string;
  model?: string;
}
```

---

# 八、目录与文件生成规则

## 1. Published 目录位置

默认规则：

在原始思考卡片所在目录下创建 Published 目录。

示例：

```text
内容创作/公众号/原始卡片/孩子一看到作业就烦.md
```

点击【列提纲】后生成：

```text
内容创作/公众号/原始卡片/Published/孩子一看到作业就烦-482913/
```

设置项允许用户改为固定 Published 根目录。

---

## 2. 文章项目目录命名

目录名格式：

```text
文章标题 + "-" + 6 位随机数字
```

示例：

```text
孩子写作业慢，可能慢在作业之外-839201
```

如果文章标题包含非法路径字符，需要自动清理。

非法字符包括：

```text
/ \ : * ? " < > |
```

空格可以保留，也可以转换为短横线。

如果目录名冲突，则重新生成随机数字。

---

## 3. 阶段文件命名

固定命名：

```text
00-source.md
01-outline.md
02-draft.md
03-humanized.md
04-final.md
05-review-report.md
meta.json
```

---

# 九、页面按钮需求

## 1. 显示位置

目标是在 Obsidian Markdown 编辑页面右上角显示插件按钮。

按钮包括：

1. 列提纲
2. 扩写
3. 去 AI 味
4. 审稿

如果编辑器右上角按钮实现复杂，MVP 可以先实现：

1. Ribbon Icon 菜单
2. 命令面板命令
3. 编辑器顶部状态栏按钮

但最终目标是当前页面可以快速点击四个按钮。

---

## 2. 按钮启用逻辑

### 当前文件不是 Published 目录下文件

| 按钮 | 状态 |
|---|---|
| 列提纲 | 可用 |
| 扩写 | 禁用 |
| 去 AI 味 | 禁用 |
| 审稿 | 禁用 |

---

### 当前文件位于 Published 项目目录下，且 status = outlined

| 按钮 | 状态 |
|---|---|
| 列提纲 | 禁用 |
| 扩写 | 可用 |
| 去 AI 味 | 禁用 |
| 审稿 | 禁用 |

---

### 当前文件位于 Published 项目目录下，且 status = drafted

| 按钮 | 状态 |
|---|---|
| 列提纲 | 禁用 |
| 扩写 | 禁用，或允许重新扩写但需要确认 |
| 去 AI 味 | 可用 |
| 审稿 | 禁用 |

---

### 当前文件位于 Published 项目目录下，且 status = humanized

| 按钮 | 状态 |
|---|---|
| 列提纲 | 禁用 |
| 扩写 | 禁用 |
| 去 AI 味 | 禁用，或允许重新去 AI 味但需要确认 |
| 审稿 | 可用 |

---

### 当前文件位于 Published 项目目录下，且 status = reviewed

默认所有生成按钮禁用。

可以提供“重新审稿”命令，但必须二次确认。

---

# 十、四个核心按钮详细逻辑

---

## 1. 列提纲

### 触发条件

用户在原始思考卡片 Markdown 文件中点击：

```text
列提纲
```

---

### 执行步骤

1. 读取当前 Markdown 文件内容
2. 尝试从文件名或 frontmatter 提取文章标题
3. 在当前文件目录下创建 Published 目录
4. 在 Published 下创建文章项目目录：

```text
文章标题 + 随机唯一数字
```

5. 复制当前原始思考卡片内容到：

```text
00-source.md
```

6. 创建 `meta.json`

初始状态：

```json
{
  "status": "source_created"
}
```

7. 使用以下内容组装提示词：

- `outlinePrompt`
- `authorProfilePrompt`
- `writingStylePrompt`
- 原始卡片内容

8. 调用当前设置的 LLM Provider
9. 如果调用成功：
   - 写入 `01-outline.md`
   - 更新 `meta.json`，status = `outlined`
   - 自动打开 `01-outline.md`
10. 如果调用失败：
   - 保留 `00-source.md`
   - 保留 `meta.json`
   - 不创建空的 `01-outline.md`
   - 弹出错误提示

---

### 列提纲默认提示词

```text
你是我的公众号主编。

我的账号定位：

{{authorProfilePrompt}}

我的内容风格：

{{writingStylePrompt}}

下面是我的原始思考卡片。

请你不要直接写完整文章。

请你帮我提炼公众号文章主线。

输出内容包括：

1. 这篇文章最值得写的核心观点
2. 最适合公众号的切入角度
3. 读者最容易共鸣的痛点
4. 文章主线
5. 文章结构框架
6. 3-5 个公众号标题
7. 哪些内容应该保留
8. 哪些内容应该删掉
9. 有无产品工具埋点建议

要求：

- 必须符合真实爸爸视角
- 克制，不夸张
- 不鸡汤，不说教
- 不要编造我没有提供的经历
- 逻辑清晰
- 输出 Markdown 格式
- 适合后续扩写成公众号文章

原始思考卡片如下：

{{sourceContent}}
```

---

## 2. 扩写

### 触发条件

当前文件必须位于 Published 文章项目目录下。

`meta.json` 的状态必须是：

```text
outlined
```

---

### 执行步骤

1. 读取当前项目目录的 `meta.json`
2. 校验 status = `outlined`
3. 读取 `01-outline.md` 内容
4. 使用以下内容组装提示词：
   - `draftPrompt`
   - `authorProfilePrompt`
   - `writingStylePrompt`
   - 提纲内容
5. 调用 LLM
6. 如果调用成功：
   - 写入 `02-draft.md`
   - 自动打开 `02-draft.md`
   - 更新 `meta.json`，status = `drafted`
7. 如果调用失败：
   - 不改变 `meta.json`
   - 不生成空文件
   - 提示错误

---

### 扩写默认提示词

```text
你是我的公众号主编。

我的账号定位：

{{authorProfilePrompt}}

我的内容风格：

{{writingStylePrompt}}

请基于下面的文章主线/提纲，扩写成一篇公众号初稿。

要求：

1. 像一个真实爸爸写的
2. 语言自然，不要 AI 味
3. 不要专家说教口吻
4. 不要夸张制造焦虑
5. 不要编造没有提供的经历
6. 每一部分都要有具体表达
7. 方法必须今晚就能用
8. 保留适合公众号的段落节奏
9. 字数控制在 1800-2200 字
10. 文章要有：真实场景、问题拆解、方法、爸爸反思、行动建议、互动问题

文章主线/提纲如下：

{{outlineContent}}
```

---

## 3. 去 AI 味

### 触发条件

当前文件必须位于 Published 文章项目目录下。

`meta.json` 的状态必须是：

```text
drafted
```

---

### 执行步骤

1. 读取 `meta.json`
2. 校验 status = `drafted`
3. 读取 `02-draft.md` 内容
4. 使用以下内容组装提示词：
   - `humanizePrompt`
   - `authorProfilePrompt`
   - `writingStylePrompt`
   - 初稿内容
5. 调用 LLM
6. 如果调用成功：
   - 写入 `03-humanized.md`
   - 自动打开 `03-humanized.md`
   - 更新 `meta.json`，status = `humanized`
7. 如果调用失败：
   - 不改变 `meta.json`
   - 不生成空文件
   - 提示错误

---

### 去 AI 味默认提示词

```text
你是我的公众号主编。

我的账号定位：

{{authorProfilePrompt}}

我的内容风格：

{{writingStylePrompt}}

请帮我把下面这篇公众号初稿改得更像真实爸爸写的。

重点：

1. 降低 AI 味
2. 减少空话和套话
3. 增加真实生活感
4. 语气克制，不说教
5. 保留逻辑清晰
6. 不要改成鸡汤文
7. 不要新增虚假经历
8. 少用过度整齐的排比
9. 少用“首先、其次、最后”这类机械表达
10. 保留公众号适合阅读的短段落
11. 让文章更自然、更像一个普通爸爸的真实反思

请直接输出修改后的完整文章，不要解释修改过程。

原始初稿如下：

{{draftContent}}
```

---

## 4. 审稿

### 触发条件

当前文件必须位于 Published 文章项目目录下。

`meta.json` 的状态必须是：

```text
humanized
```

---

### 执行步骤

1. 读取 `meta.json`
2. 校验 status = `humanized`
3. 读取 `03-humanized.md` 内容
4. 调用 LLM 执行审稿
5. 审稿需要输出两部分：
   - 校准后的最终文章
   - 审稿报告
6. 如果调用成功：
   - 将校准后的最终文章写入 `04-final.md`
   - 将审稿报告写入 `05-review-report.md`
   - 自动打开 `04-final.md`
   - 更新 `meta.json`，status = `reviewed`
7. 如果调用失败：
   - 不改变 `meta.json`
   - 不生成空文件
   - 提示错误

---

### 审稿默认提示词

```text
你是我的公众号主编，负责发布前审稿。

我的账号定位：

{{authorProfilePrompt}}

我的内容风格：

{{writingStylePrompt}}

请对下面这篇文章做发布前校准和审稿。

你需要输出两部分内容，必须严格使用以下分隔符：

===FINAL_ARTICLE===

这里输出校准后的最终公众号文章。

===REVIEW_REPORT===

这里输出审稿报告。

审稿报告只指出问题、原因和具体改法，不要重写全文。

审稿维度包括：

1. 标题打开率
2. 开头代入感
3. 真实爸爸视角
4. 核心观点清晰度
5. 方法落地性
6. 情绪共鸣
7. 是否有 AI 味
8. 是否说教
9. 是否夸张制造焦虑
10. 结尾互动性
11. 产品工具埋点是否自然

校准最终文章要求：

1. 保留真实爸爸视角
2. 语言自然
3. 不要新增虚假经历
4. 不要夸张恐吓父母
5. 不要专家口吻
6. 方法要能今晚使用
7. 文章结构清晰
8. 保留公众号阅读节奏
9. 可以适度优化标题、开头、结尾
10. 不要输出解释，只输出指定两部分

待审稿文章如下：

{{humanizedContent}}
```

---

### 审稿结果解析规则

插件需要解析 LLM 返回内容：

```text
===FINAL_ARTICLE===
```

之后，到：

```text
===REVIEW_REPORT===
```

之前的内容，写入：

```text
04-final.md
```

`===REVIEW_REPORT===` 后面的内容，写入：

```text
05-review-report.md
```

如果没有找到分隔符，需要提示用户：

```text
审稿返回格式异常，已取消写入，请重试。
```

不要写入半解析内容。

---

# 十一、LLM Provider 抽象设计

需要设计统一接口：

```ts
export interface LLMProvider {
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
}
```

`ProviderFactory` 根据 `settings.provider` 返回对应 Provider。

---

## 1. OpenAI Provider

默认配置：

```text
baseUrl: https://api.openai.com/v1
model: gpt-4.1-mini
```

接口兼容 OpenAI Chat Completions：

```text
POST /chat/completions
```

请求结构：

```json
{
  "model": "模型名",
  "messages": [
    {
      "role": "user",
      "content": "prompt"
    }
  ],
  "temperature": 0.7
}
```

---

## 2. DeepSeek Provider

默认配置：

```text
baseUrl: https://api.deepseek.com
model: deepseek-chat
```

使用 OpenAI-compatible Chat Completions 格式。

---

## 3. 豆包 Provider

豆包接口允许用户自定义：

1. Base URL
2. Model

先按 OpenAI-compatible Chat Completions 格式实现。

如果用户填写的是完整 endpoint，需要兼容。

设置页要提示：

```text
豆包请填写兼容 OpenAI Chat Completions 的 Base URL 或完整 Endpoint。
```

---

# 十二、设置页面需求

插件设置页包含以下内容。

---

## 1. LLM Provider 设置

当前 Provider 下拉选择：

1. OpenAI
2. DeepSeek
3. 豆包

每个 Provider 配置：

1. API Key
2. Base URL
3. Model
4. Temperature
5. Max Tokens

API Key 输入框需要使用 password 类型。

---

## 2. 目录设置

设置项：

1. Published 目录名称，默认：

```text
Published
```

2. 是否在原始文件所在目录下创建 Published，默认：

```text
true
```

3. 如果不使用原始文件目录，允许用户指定固定输出目录

---

## 3. 人设与风格设置

默认人设：

```text
真实爸爸视角 + 理性工具派 + 家庭教育实战方法。
```

默认风格：

```text
真实、克制、有逻辑、能落地、不鸡汤、不空话。
```

设置项：

1. 个人身份创作方向提示词
2. 内容风格提示词

---

## 4. 阶段提示词设置

允许用户编辑：

1. 列提纲提示词
2. 扩写提示词
3. 去 AI 味提示词
4. 审稿提示词

提示词支持变量：

```text
{{authorProfilePrompt}}
{{writingStylePrompt}}
{{sourceContent}}
{{outlineContent}}
{{draftContent}}
{{humanizedContent}}
```

---

## 5. 安全设置

设置项：

1. 覆盖已有阶段文件前是否确认，默认：

```text
true
```

2. 是否保留历史版本，默认：

```text
false
```

如果启用保留历史版本，当重新生成某阶段内容时，不覆盖原文件，而是保存为：

```text
02-draft-20260430-173000.md
```

但 MVP 第一版可以只实现确认覆盖。

---

# 十三、命令面板命令

除了页面按钮，还要提供命令面板命令：

1. `GZH Pipeline: 列提纲`
2. `GZH Pipeline: 扩写`
3. `GZH Pipeline: 去 AI 味`
4. `GZH Pipeline: 审稿`
5. `GZH Pipeline: 打开文章项目目录`
6. `GZH Pipeline: 打开审稿报告`
7. `GZH Pipeline: 复制最终文章`

---

# 十四、异常处理

必须处理以下情况。

---

## 1. 当前没有打开 Markdown 文件

提示：

```text
请先打开一篇 Markdown 文件。
```

---

## 2. API Key 为空

提示：

```text
请先在插件设置中配置当前 LLM Provider 的 API Key。
```

---

## 3. 当前操作不符合状态

例如 status = `outlined` 时点击【去 AI 味】。

提示：

```text
当前文章状态为 outlined，请先完成扩写。
```

---

## 4. 找不到 meta.json

如果当前文件在 Published 目录下，但找不到 `meta.json`。

提示：

```text
当前文件不属于有效的公众号文章项目，请检查目录结构。
```

---

## 5. LLM 调用失败

提示：

```text
LLM 调用失败：具体错误信息。
```

要求：

1. 不创建空阶段文件
2. 不改变状态
3. 不覆盖已有文件

---

## 6. 文件已存在

如果目标阶段文件已存在，且设置要求确认覆盖：

弹窗询问：

```text
目标文件已存在，是否覆盖？
```

选项：

1. 覆盖
2. 取消

---

## 7. 审稿返回格式错误

如果没有找到：

```text
===FINAL_ARTICLE===
```

或：

```text
===REVIEW_REPORT===
```

提示：

```text
审稿返回格式异常，未写入文件，请重试。
```

要求：

1. 不生成 `04-final.md`
2. 不生成 `05-review-report.md`
3. 不改变 `meta.json` 状态

---

# 十五、文件保护规则

绝对不能覆盖：

1. 原始思考卡片文件
2. `00-source.md`

除非用户明确执行“重新备份原始卡片”。

MVP 第一版不需要这个功能。

每个阶段只能写入对应文件：

| 操作 | 写入文件 |
|---|---|
| 列提纲 | `01-outline.md` |
| 扩写 | `02-draft.md` |
| 去 AI 味 | `03-humanized.md` |
| 审稿 | `04-final.md` + `05-review-report.md` |

---

# 十六、用户体验细节

每次调用 LLM 时显示 Loading Modal 或 Notice。

示例：

```text
正在调用 LLM，请稍候……
```

成功后提示：

```text
列提纲完成，已生成 01-outline.md。
```

```text
扩写完成，已生成 02-draft.md。
```

```text
去 AI 味完成，已生成 03-humanized.md。
```

```text
审稿完成，已生成最终文章和审稿报告。
```

成功后自动打开新生成的 Markdown 文件。

`meta.json` 每次成功阶段推进后更新 `updatedAt`。

所有时间使用 ISO 字符串。

随机数字使用 6 位。

若目录冲突，则重新生成。

---

# 十七、样式要求

可以添加轻量 CSS。

按钮样式保持 Obsidian 原生风格，不要做复杂 UI。

MVP 优先级：

1. 功能稳定
2. 文件安全
3. 状态机正确
4. LLM 调用可用
5. 目录干净

UI 可以简单。

---

# 十八、开发步骤建议

请按以下顺序开发。

---

## 第 1 步：基础插件结构

实现：

1. `manifest.json`
2. `main.ts`
3. settings
4. 命令注册
5. Ribbon Icon

---

## 第 2 步：文件与目录服务

实现：

1. 获取当前 Markdown 文件
2. 创建 Published 目录
3. 创建文章项目目录
4. 创建 `00-source.md`
5. 创建 / 读取 / 更新 `meta.json`

---

## 第 3 步：状态机

实现：

1. 判断当前文件是否在 Published 项目目录
2. 读取状态
3. 校验当前操作是否合法
4. 推进状态

---

## 第 4 步：PromptService

实现提示词变量替换。

支持变量：

```text
{{authorProfilePrompt}}
{{writingStylePrompt}}
{{sourceContent}}
{{outlineContent}}
{{draftContent}}
{{humanizedContent}}
```

---

## 第 5 步：LLMService 与 Provider

实现：

1. OpenAI Provider
2. DeepSeek Provider
3. Doubao Provider
4. ProviderFactory

---

## 第 6 步：四个核心动作

实现：

1. 列提纲
2. 扩写
3. 去 AI 味
4. 审稿

---

## 第 7 步：UI 按钮与命令

实现：

1. 命令面板命令
2. Ribbon Icon
3. 页面按钮或状态栏按钮

---

## 第 8 步：错误处理与测试

覆盖主要异常场景。

---

# 十九、验收标准

请确保以下场景全部通过。

---

## 场景 1：从原始思考卡片列提纲

操作：

1. 我打开一篇普通 Markdown 原始思考卡片
2. 点击【列提纲】

预期结果：

1. 插件在当前目录下创建：

```text
Published/文章标题-随机数字/
```

2. 插件生成：

```text
00-source.md
01-outline.md
meta.json
```

3. 原始思考卡片没有被修改
4. `meta.json` status = `outlined`
5. 自动打开 `01-outline.md`

---

## 场景 2：扩写

操作：

1. 我在 Published 项目目录中打开 `01-outline.md`
2. 点击【扩写】

预期结果：

1. 插件读取 `01-outline.md`
2. 调用 LLM
3. 生成 `02-draft.md`
4. `meta.json` status = `drafted`
5. 自动打开 `02-draft.md`

---

## 场景 3：去 AI 味

操作：

1. 我打开 `02-draft.md`
2. 点击【去 AI 味】

预期结果：

1. 插件生成 `03-humanized.md`
2. `meta.json` status = `humanized`
3. 自动打开 `03-humanized.md`

---

## 场景 4：审稿

操作：

1. 我打开 `03-humanized.md`
2. 点击【审稿】

预期结果：

1. 插件调用 LLM
2. 插件解析返回内容
3. 生成：
   - `04-final.md`
   - `05-review-report.md`
4. `meta.json` status = `reviewed`
5. 自动打开 `04-final.md`

---

## 场景 5：非法状态不能操作

操作：

1. 我在原始思考卡片中点击【扩写】

预期结果：

1. 插件提示不能操作
2. 不生成任何无效文件

---

## 场景 6：LLM 失败不污染目录

操作：

1. 模拟 API Key 错误
2. 点击【扩写】

预期结果：

1. 插件提示失败
2. 不生成空的 `02-draft.md`
3. `meta.json` 状态不变化

---

## 场景 7：审稿格式异常

操作：

1. LLM 返回内容不包含指定分隔符

预期结果：

1. 插件提示格式异常
2. 不生成 `04-final.md`
3. 不生成 `05-review-report.md`
4. `meta.json` 状态不变化

---

# 二十、最终交付

请输出完整插件代码。

包括：

1. `manifest.json`
2. `package.json`
3. `tsconfig.json`
4. `esbuild.config.mjs`
5. `main.ts`
6. `src` 下所有 TypeScript 文件
7. `styles.css`
8. `README.md`

---

# 二十一、README.md 要求

README 需要说明：

1. 插件用途
2. 安装方法
3. 设置方法
4. 使用流程
5. 目录结构
6. 状态机说明
7. 常见问题
8. API Key 配置说明
9. 如何扩展其他阶段
10. 注意事项

---

# 二十二、开发约束

请先实现一个可运行的 MVP 版本。

不要过度设计 UI。

优先保证：

1. 文件安全
2. 状态机正确
3. LLM 调用稳定
4. 目录结构干净
5. 错误处理完整

页面右上角按钮如果实现成本较高，可以先用：

1. 命令面板
2. Ribbon 菜单
3. 状态栏按钮

完成核心流程。

后续再增强为编辑器顶部按钮。

---

# 二十三、最重要的产品定位提醒

请不要做成“一键生成爆款文章”的工具。

这个插件的定位是：

```text
AI内容助手
```

我负责：

1. 真实经历
2. 真实判断
3. 真实反思
4. 观点取舍
5. 最终把关

插件负责：

1. 固定流程
2. 调用 LLM
3. 生成阶段文件
4. 保护原始卡片
5. 控制文章状态
6. 保持目录整洁
7. 提升写作效率

最终目标是帮助我建立一个长期可持续的家庭教育内容生产系统。

# AIFS-Interactive 项目交接文档

> **最后更新**: 2026-05-21  
> **项目状态**: 开发中（M1-M11 已完成，M8 内容中文化 35.6% 进行中）  
> **仓库**: `https://github.com/arwei944/aifs-interactive.git`  
> **分支**: `main`

---

## 一、项目概述

将开源 AI 课程网站 [aiengineeringfromscratch.com](https://aiengineeringfromscratch.com) 转换为**全中文交互式学习平台**。

### 核心特性
- **全中文界面**（UI、标题、术语）
- **macOS 极简设计风格**（毛玻璃、交通灯按钮、0.5px 边框）
- **Astro Islands 架构**（静态 HTML + React 交互组件）
- **435 节课**（20 个阶段，数据从原站 GitHub 仓库提取）
- **6 种交互式可视化组件**（激活函数、梯度下降、注意力、卷积、扩散、聚类）
- **代码沙箱**（Pyodide + CodeMirror 6，浏览器内运行 Python）
- **学习进度追踪**（localStorage 持久化 + 连续学习热力图）
- **实时翻译监控页面**（`/translate`，纯动态 DOM 更新，无页面刷新）

### 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Astro | ^6.3.7 |
| UI 库 | React | ^19.2.6 |
| 样式 | Tailwind CSS v4 | ^4.3.0 |
| 代码编辑器 | CodeMirror 6 | ^6.0.2 |
| Python 运行时 | Pyodide | ^0.29.4 |
| 测试 | Vitest + Testing Library | ^4.1.7 |
| Node | ESM 模块 | >=22.12.0 |

---

## 二、项目结构

```
aifs-interactive/
├── src/
│   ├── components/          # 17 个组件
│   │   ├── Header.astro         # 顶部导航（macOS 交通灯 + 搜索）
│   │   ├── Sidebar.astro        # 左侧课程列表
│   │   ├── RightPanel.astro     # 右侧进度面板
│   │   ├── SearchModal.tsx      # Cmd+K 全局搜索
│   │   ├── LessonContent.tsx    # 课程内容渲染（Markdown → React 组件）
│   │   ├── CodeEditor.tsx       # CodeMirror 6 Python 编辑器
│   │   ├── CodeSandbox.tsx      # Pyodide 代码沙箱
│   │   ├── QuizBlock.tsx        # 交互式测验
│   │   ├── ActivationViz.tsx    # 激活函数可视化
│   │   ├── GradientDescentViz.tsx  # 梯度下降可视化
│   │   ├── AttentionViz.tsx     # 注意力机制可视化
│   │   ├── ConvolutionViz.tsx   # 卷积可视化
│   │   ├── DiffusionViz.tsx     # 扩散模型可视化
│   │   ├── ClusteringViz.tsx    # K-Means 聚类可视化
│   │   ├── DashboardStats.tsx   # 仪表盘统计卡片
│   │   ├── PhaseProgress.tsx    # 阶段进度条
│   │   └── StreakHeatmap.tsx    # 学习连续热力图
│   ├── data/
│   │   ├── phases.ts            # 课程数据（自动生成，644 行，435 课）
│   │   └── glossary.ts          # 术语表（83 个术语，含中文翻译）
│   ├── hooks/
│   │   └── useProgress.ts       # 学习进度 Hook（localStorage）
│   ├── layouts/
│   │   └── BaseLayout.astro     # 主布局（含 SearchModal）
│   ├── pages/
│   │   ├── index.astro          # 首页
│   │   ├── dashboard.astro      # 学习仪表盘
│   │   ├── translate.astro      # 翻译进度监控（纯动态更新）
│   │   ├── api/                 # API 端点（运行时数据）
│   │   │   ├── translate-progress.json.ts  # 翻译进度 API
│   │   │   ├── translate-log.json.ts       # 翻译日志 API
│   │   │   └── workers.json.ts             # Worker 进程状态 API
│   │   └── lesson/
│   │       └── [phaseId]/
│   │           └── [lessonId].astro  # 动态课程页
│   ├── styles/
│   │   └── global.css           # Tailwind v4 + 设计系统
│   └── test/
│       ├── setup.ts             # 测试环境初始化
│       ├── phases.test.ts       # 课程数据测试（8 个）
│       ├── renderMarkdown.test.ts  # Markdown 渲染测试（10 个）
│       └── useProgress.test.ts  # 进度 Hook 测试（8 个）
├── scripts/
│   ├── extract_data.py          # 从原站仓库提取课程数据
│   ├── translate_md.py          # Markdown 批量翻译脚本（v2 旧版，已弃用）
│   └── translate_fast.py        # 高速翻译脚本 v3（多进程并行版，当前使用）
├── data/
│   └── runtime/                 # 运行时动态数据（不触发 Vite HMR）
│       ├── translate-progress.json  # 翻译进度
│       ├── translate-log.json       # 翻译日志
│       └── workers/                 # 各 Worker 进程状态
│           ├── worker-A.json
│           ├── worker-B.json
│           └── worker-C.json
├── public/
│   └── content/
│       └── lessons/             # 435 个 .md 课程文件
├── astro.config.mjs             # Astro 配置（含 Vite watch 忽略规则）
├── vitest.config.mjs            # Vitest 配置
├── tsconfig.json                # TypeScript 配置
└── package.json                 # 依赖和脚本
```

---

## 三、设计系统

定义在 `src/styles/global.css`，使用 Tailwind v4 `@theme {}` 语法。

### 配色

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-bg` | `#f5f5f7` | 页面背景 |
| `--color-surface` | `#ffffff` | 卡片/面板背景 |
| `--color-ink` | `#1d1d1f` | 主文字 |
| `--color-ink-2` | `#86868b` | 次要文字 |
| `--color-blue` | `#0071e3` | 主色调/链接 |
| `--color-green` | `#34c759` | 成功/完成 |
| `--color-amber` | `#ff9f0a` | 警告 |
| `--color-red` | `#ff3b30` | 错误/失败 |
| `--color-purple` | `#af52de` | 辅助色 |
| `--color-border` | `#e5e5ea` | 边框 |

### 字体

| 用途 | 字体 |
|------|------|
| 正文 | Inter + Noto Sans SC |
| 代码 | JetBrains Mono |

### 组件规范
- 卡片圆角: `12px`，阴影: `shadow-sm`
- 导航栏: 52px 高，毛玻璃效果 `backdrop-filter: blur(20px)`
- macOS 交通灯: 红 `#ff5f57`、黄 `#febc2e`、绿 `#28c840`

---

## 四、关键数据结构

### Lesson 接口 (`src/data/phases.ts`)

```typescript
export interface Lesson {
  id: string;           // "03-04"
  num: number;          // 4
  title: string;        // "激活函数 (Activation Functions)"（已翻译为中文）
  type: 'build' | 'learn' | 'capstone';
  lang: string;         // "python"
  duration: string;     // "~30min"
  summary: string;      // 课程摘要
  keywords: string[];   // 关键术语
}
```

### Phase 接口

```typescript
export interface Phase {
  id: string;           // "phase-3"
  num: number;          // 3
  title: string;        // "深度学习核心"（中文）
  shortTitle: string;   // "深度学习"（中文）
  lessons: Lesson[];
  duration: string;
  status: 'completed' | 'in-progress' | 'planned';
  description: string;
}
```

### 查询函数

```typescript
getPhase(id: string): Phase | undefined
getLesson(phaseId: string, lessonId: string): { lesson: Lesson, phase: Phase } | undefined
getTotalLessons(): number  // 435
getAllLessons(): { lesson: Lesson, phase: Phase }[]
```

### Term 接口 (`src/data/glossary.ts`)

```typescript
export interface Term {
  id: string;       // "g-01"
  term: string;     // "智能体 (Agent)"
  peopleSay: string;
  actually: string;
  phaseId: string;  // "phase-14"
}
```

---

## 五、自定义 Markdown 语法

课程 Markdown 文件中可嵌入交互组件，由 `LessonContent.tsx` 解析：

### 可视化组件

```markdown
:::viz type="activation"
:::viz type="gradient-descent"
:::viz type="attention"
:::viz type="convolution"
:::viz type="diffusion"
:::viz type="clustering"
```

### 测验组件

```markdown
:::quiz
{
  "question": "什么是激活函数？",
  "options": ["A. 线性变换", "B. 引入非线性的函数", "C. 损失函数", "D. 优化器"],
  "answer": 1,
  "explanation": "激活函数在每层线性变换后引入非线性..."
}
:::
```

---

## 六、常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本（438 页面）
npm run preview          # 预览构建产物

# 测试
npm test                 # 运行全部测试（26 个）
npm run test:watch       # 监听模式

# 数据提取（从原站仓库）
python3 scripts/extract_data.py

# ===== 翻译（v3 高速版，推荐） =====
# 多进程并行翻译（3 个进程，各负责不同阶段）
python3 scripts/translate_fast.py --phase-range "5-9" --worker-id "worker-A" --workers 5 --no-sync
python3 scripts/translate_fast.py --phase-range "10-14" --worker-id "worker-B" --workers 5 --no-sync
python3 scripts/translate_fast.py --phase-range "15-19" --worker-id "worker-C" --workers 5 --sync-interval 600

# 单进程翻译（简单场景）
python3 scripts/translate_fast.py --all --workers 10 --sync-interval 600

# 只翻译指定阶段
python3 scripts/translate_fast.py --phase-range "5-9" --workers 5

# 只翻译指定课程
python3 scripts/translate_fast.py --lesson 03-04

# 强制重新翻译
python3 scripts/translate_fast.py --all --force

# 翻译旧版（v2，已弃用，仅供参考）
python3 scripts/translate_md.py --all --workers 3
```

---

## 七、未完成工作（按优先级排序）

### 🔴 P0：内容中文化翻译（进行中）

**当前状态**: 155/435 文件已翻译（35.6%），0 失败

**翻译架构**（v3 高速版）:
- **多进程并行**: 3 个独立 Python 进程，各负责不同阶段范围
  - Worker A: Phase 5-9（61 文件）
  - Worker B: Phase 10-14（131 文件）
  - Worker C: Phase 15-19（122 文件，负责 Git 同步）
- **翻译引擎**: youdao（`translators` 库，免费无需 API Key）
- **并发**: 每进程 5 线程，总计 15 线程
- **批量策略**: 整文件合并翻译，每文件仅 1-3 次 API 调用
- **断点续传**: 已翻译文件自动跳过
- **Git 自动同步**: Worker C 每 10 分钟 `git push` 到 GitHub
- **速度**: ~0.1 文件/s（~10s/文件），预计总耗时 ~40 分钟

**运行时数据流**:
```
翻译脚本 → data/runtime/translate-progress.json
         → data/runtime/translate-log.json
         → data/runtime/workers/{worker-id}.json
                    ↓
前端 API 端点 → /api/translate-progress.json
             → /api/translate-log.json
             → /api/workers.json
                    ↓
前端 JS → fetch API → DOM 动态更新（无页面刷新）
```

**翻译监控页面** (`/translate`):
- 每 3 秒通过 API 端点获取数据
- 纯 DOM 动态更新，**不触发页面刷新**
- 显示：总进度条、统计卡片、各 Worker 进程独立进度、各阶段进度、翻译日志
- 新增日志条目蓝色闪烁动画

**如何继续翻译**:
```bash
cd /workspace/aifs-interactive
# 启动 3 个并行 worker（后台运行）
PYTHONUNBUFFERED=1 python3 -u scripts/translate_fast.py --phase-range "5-9" --worker-id "worker-A" --workers 5 --no-sync &
PYTHONUNBUFFERED=1 python3 -u scripts/translate_fast.py --phase-range "10-14" --worker-id "worker-B" --workers 5 --no-sync &
PYTHONUNBUFFERED=1 python3 -u scripts/translate_fast.py --phase-range "15-19" --worker-id "worker-C" --workers 5 --sync-interval 600 &
# 监控: 浏览器访问 http://localhost:4321/translate
```

**翻译质量注意事项**:
- 翻译使用有道免费 API（`translators` 库的 `youdao` 引擎）
- 代码块、表格、元数据行（`**Type:** Build`）不翻译
- AI 专有名词可能被误译（如 "Sigmoid" → "乙状结肠"），需后续人工校对
- `phases.ts` 中的标题已翻译并手动修正了 183 处错误

### 🟡 P1：翻译质量校对

翻译完成后需要校对：
1. 抽查各阶段翻译质量
2. 修正 AI 术语的误译（保留英文或使用标准中文译名）
3. 检查 Markdown 格式是否被破坏（标题、列表、代码块）
4. 修正 `phases.ts` 中标题翻译的残留错误

### 🟡 P2：更多可视化组件嵌入

已开发 6 个可视化组件，但尚未嵌入到具体课程 Markdown 中。

**已分析的可视化候选**（按优先级）:
1. **AttentionViz** → 嵌入 `05-10.md`（Attention Mechanism）、`07-02.md`（Self-Attention）等 9 节课
2. **ConvolutionViz** → 嵌入 `04-02.md`（Convolutions from Scratch）
3. **DiffusionViz** → 嵌入 `08-06.md`（DDPM）、`04-10.md`（Diffusion Models）等 6 节课
4. **ClusteringViz** → 嵌入 `02-07.md`（Unsupervised Learning）
5. **EmbeddingViz**（待开发）→ 嵌入 `05-03.md`（Word2Vec）等 7 节课
6. **RegressionViz**（待开发）→ 嵌入 `02-02.md`（Linear Regression）等

**嵌入方式**: 在课程 .md 文件中添加 `:::viz type="xxx"` 标记。

### 🟢 P3：部署

用户选择暂不部署。推荐方案：
- **Vercel**（免费额度大，Astro 官方支持好）
- 需要配置：`astro.config.mjs` 中的 `output: 'static'`（当前默认）
- 注意：翻译监控页面依赖 API 端点（SSR），静态部署时需改为预渲染或使用 Edge Functions

### 🟢 P4：其他改进

- **术语表与课程关联**: `glossary.ts` 的 `phaseId` 可用于在课程页面右侧面板显示相关术语
- **搜索优化**: `SearchModal.tsx` 可扩展为搜索课程内容（目前只搜索标题）
- **暗色模式**: 设计系统预留了配色，但未实现切换
- **PWA 支持**: 添加 Service Worker 实现离线学习
- **课程内容增强**: 在 Markdown 中添加更多 `:::quiz` 和 `:::viz` 嵌入

---

## 八、数据来源与重新生成

### 课程数据 (`phases.ts` + 435 个 .md 文件)

**来源**: `https://github.com/rohitg00/ai-engineering-from-scratch`

**重新提取**:
```bash
# 1. 克隆原站仓库（如果不存在）
git clone --depth 1 https://github.com/rohitg00/ai-engineering-from-scratch.git /path/to/repo

# 2. 运行提取脚本
cd /workspace/aifs-interactive
AIFS_SRC=/path/to/repo python3 scripts/extract_data.py
```

**提取脚本做了什么**:
1. 读取 `catalog.json`（课程元数据）
2. 读取每个 `phases/XX-name/docs/en.md`（课程内容）
3. 生成 `src/data/phases.ts`（接口 + 数据 + 查询函数）
4. 复制 435 个 .md 文件到 `public/content/lessons/`
5. 自动翻译阶段标题为中文（内置 `PHASE_CN` 映射表）

### 术语表 (`glossary.ts`)

**来源**: 原站 `glossary/terms.md`（83 个术语）

**重新生成**:
```bash
# 1. 提取原始术语到 JSON
python3 /data/user/work/build_glossary.py

# 2. 修正机器翻译错误
python3 /data/user/work/fix_glossary.py
```

---

## 九、已知问题与注意事项

### 构建相关
- `phases.ts` 是自动生成的，**不要手动编辑**（用 `extract_data.py` 重新生成）
- 翻译后的标题中可能有未转义的单引号（如 `Anthropic's`），构建时会报 esbuild 错误，需手动转义为 `\'`

### 翻译相关
- 有道翻译 API 可能在高并发时被限流，脚本有 3 次重试机制
- `translators` 库不是线程安全的，多进程并行时各进程独立运行，无竞争条件
- 已翻译的文件记录在 `data/runtime/translate-progress.json` 的 `translated` 数组中，重新运行会自动跳过
- 运行时数据存储在 `data/runtime/` 而非 `public/`，避免触发 Vite HMR 页面刷新

### Vite HMR 相关
- `astro.config.mjs` 中配置了 `server.watch.ignored`，忽略以下目录的文件变化：
  - `**/data/runtime/**`（翻译进度、日志、Worker 状态）
  - `**/public/content/lessons/**`（翻译输出的 .md 文件）
  - `**/.translate_progress.json`（旧版进度文件）
- 翻译监控页面通过 API 端点（`/api/*.json`）获取数据，不读取 public 下的静态文件
- **不要**把动态 JSON 文件放回 `public/` 目录，否则会重新触发页面刷新

### 组件相关
- `LessonContent.tsx` 中的 `client:load` 指令必须直接放在 React 组件标签上，不能包裹在 div 中
- Canvas 可视化组件使用 `devicePixelRatio` 适配高 DPI，但 `ResizeObserver` 在某些浏览器中可能不触发
- Pyodide 加载约 10-20MB WebAssembly，首次打开代码沙箱时较慢

### 测试相关
- `getLesson()` 返回的是 `{ lesson, phase }` 对象，不是直接的 lesson
- 测试中的标题断言需要跟随翻译状态更新（英文 → 中文）

---

## 十、里程碑完成情况

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| M1 | 项目初始化 + 设计系统 | ✅ 完成 |
| M2 | 课程阅读器 MVP | ✅ 完成 |
| M3 | 代码沙箱（Pyodide + CodeMirror） | ✅ 完成 |
| M4 | 交互式可视化（激活函数 + 梯度下降） | ✅ 完成 |
| M5 | 增强测验系统 + 进度追踪 | ✅ 完成 |
| M6 | 学习仪表盘 | ✅ 完成 |
| M7 | 测试体系（26 个测试用例） | ✅ 完成 |
| M8 | 内容中文化（435 课翻译） | 🔄 35.6% (155/435) |
| M9 | 术语表扩充（83 个术语） | ✅ 完成 |
| M10 | 更多可视化组件（4 个新组件） | ✅ 完成 |
| M11 | 翻译监控页面（多进程 + API 端点） | ✅ 完成 |
| M12 | 部署 | ⏳ 待定 |

---

## 十一、快速上手（给新接手的智能体）

```bash
# 1. 进入项目
cd /workspace/aifs-interactive

# 2. 安装依赖（如果需要）
npm install
pip install translators --break-system-packages

# 3. 验证构建
npm run build        # 应输出 438 页面，0 错误

# 4. 运行测试
npm test             # 应输出 26 passed

# 5. 启动开发服务器
npm run dev          # 访问 http://localhost:4321

# 6. 继续翻译（最重要！）
# 多进程并行（推荐）
PYTHONUNBUFFERED=1 python3 -u scripts/translate_fast.py --phase-range "5-9" --worker-id "worker-A" --workers 5 --no-sync &
PYTHONUNBUFFERED=1 python3 -u scripts/translate_fast.py --phase-range "10-14" --worker-id "worker-B" --workers 5 --no-sync &
PYTHONUNBUFFERED=1 python3 -u scripts/translate_fast.py --phase-range "15-19" --worker-id "worker-C" --workers 5 --sync-interval 600 &

# 或单进程
python3 scripts/translate_fast.py --all --workers 10 --sync-interval 600

# 7. 监控翻译进度（纯动态更新，无页面刷新）
# 浏览器访问 http://localhost:4321/translate
```

**接手后第一件事**: 启动翻译脚本（步骤 6），这是当前最优先的未完成任务。

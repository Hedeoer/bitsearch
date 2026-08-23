# BitSearch Admin UI 迁移 — Agent Handoff

> 生成时间：2026-08-23  
> 来源会话：`01a02d29-7bd0-78b1-89de-8549ec0c51cb`（续作 `01a02d12-9954-71f1-afb4-d78126c13015`）  
> 状态：**未完成**。Phase 1–5 代码已落地，Phase 6 做到一半被中断。请先修 P0，再做最终验收，不要直接合并。

## 1. 任务目标

将管理后台完整迁移到 **Tailwind CSS v4 + shadcn/ui + tweakcn 主题**，最终移除旧手写 CSS。

- 策略：渐进式逐页迁移；每页完成控件、布局、状态样式后立即浏览器验证。
- 终态：只保留 `admin-theme.css` 与必要全局 base；业务组件不再引用旧变量和旧布局类。
- **不改后端 API、数据结构、路由。**
- 主题来源：`https://tweakcn.com/r/themes/cmdght103000n04lh3e2ae93r`

## 2. 仓库与运行环境

| 项 | 值 |
|----|----|
| 工作目录 | `/home/hedeoer/Projects/bitsearch-admin-ui` |
| 主仓库 | `/home/hedeoer/Projects/bitsearch`（`main`） |
| 分支 | `feature-admin-ui-rework` @ `b593f79`（`feat(admin-ui): 固化 Tailwind shadcn 迁移基线`） |
| 本 worktree 端口 | 后端 `8098`，前端 `5176` |
| 主仓库端口 | 后端 `8097`（避免冲突） |
| 技术栈 | React 19 + Vite + Tailwind CSS v4 + TypeScript strict |

当前 HEAD 之后有 **大量未提交改动**（约 43 文件，`+465 / -3425`），全部是本会话 Phase 1–6 的迁移结果。`.workflow/` 未跟踪，不要当业务代码提交。

```bash
cd /home/hedeoer/Projects/bitsearch-admin-ui
git status --short
# 不要先 commit，除非用户明确要求。建议先修 P0 并完成浏览器验收。
```

## 3. 阶段完成情况

| Phase | 内容 | 状态 | 验证 |
|-------|------|------|------|
| 0 | 基线提交 `b593f79` | ✅ | 已提交 |
| 1 | Login + Console 布局 | ✅ 代码完成 | 仅 Phase 2 时顺带看过 Login / Sheet |
| 2 | Key Pools 收尾，删除 `key-pools.css` | ✅ | `check` + `build:web` + 真实浏览器四页冒烟 |
| 3 | Activity 全链路 Tailwind/shadcn，删除 3 份 activity CSS | ✅ 代码完成 | 仅 `check` + `build:web`，**无浏览器验收** |
| 4 | Overview / Strategy 去旧类、语义色、最后一个原生数字输入 | ✅ 代码完成 | 仅 `check`，**无浏览器验收** |
| 5 | Providers 去旧变量 / 硬编码色，删除 `providers.css` | ✅ 代码完成 | 仅代码扫描，**无浏览器验收** |
| 6 | 主题清理 + Vite `manualChunks` | ⚠️ 做到一半被中断 | 第一次拆包有 circular chunk 警告；第二次规则已改，构建被 abort，需重跑 |

**本会话中断点：** 正在修 `vite.config.ts` 的 React/vendor 循环 chunk，随后用户要求写 handoff，多次 turn 因 429 / invalid_request 失败，文档未写出。

## 4. 已完成的具体改动

### 已删除的旧 CSS

- `src/web/key-pools.css`
- `src/web/activity.css`
- `src/web/activity-layout.css`
- `src/web/activity-panels.css`
- `src/web/providers.css`
- `src/web/feedback.css`
- `src/web/styles.css`
- `src/web/theme.css`

### 当前 CSS 入口

`src/web/main.tsx` 只剩：

```ts
import "./app.css";
import "./admin-theme.css";
```

- `src/web/app.css`：仅 `@import "tailwindcss";` + `@import "tw-animate-css";`
- `src/web/admin-theme.css`：tweakcn 双主题 + `@theme inline` + 全局 base。**旧变量桥段已删除。**

### 已迁移的主要页面/组件

- Login：`src/web/LoginView.tsx` → Card + Label + Input + Button
- Console：`src/web/components/ConsoleChrome.tsx` → 桌面固定侧栏 + 移动端 Sheet + Button/Badge
- Key Pools：`KeyPoolsWorkspace.tsx` Summary/Table/分页/筛选/批量操作改 Tailwind + shadcn
- Activity：Filters / Feed / SummaryRail / Inspector / Workbench
- Overview：Pulse / LatestErrors / RequestTrend
- Strategy：Routing / Access / Surface
- Providers：Master list/card、Detail、Remote、SearchEngine、ToolSurface、shared

### Vite chunk 拆分（已写入，未最终确认）

`vite.config.ts` 当前规则：

- `charts`：recharts / d3- / victory-vendor
- `radix`：radix-ui / @radix-ui
- `react`：`/react/`、`/react-dom/`、`/react-router`、`/scheduler/`
- 其余 node_modules → `vendor`

第一版用 `id.includes("react")` 把 `react-*` 也打进 react chunk，出现 **Circular chunk: react ↔ vendor**。第二版已收窄匹配，但 `npm run build:web` 在中断前未拿到干净日志。`dist/public/assets/` 里已有 `charts-*.js` / `radix-*.js` / `react-*.js` / `vendor-*.js`，不能当作验收通过。

## 5. 未完成任务（按优先级）

### P0 — 必须先做，否则页面可能已经视觉损坏

旧变量桥接已从 `admin-theme.css` 删除，但 shadcn 底层组件仍引用这些变量。亮色主题下尤其会丢颜色。

仍在使用的已删除变量：

| 变量 | 出现位置 |
|------|----------|
| `--text` | `src/components/ui/button.tsx`, `card.tsx`, `tabs.tsx` |
| `--text-soft` | `button.tsx`, `badge.tsx`, `card.tsx`, `tabs.tsx` |
| `--danger` | `button.tsx`, `badge.tsx` |
| `--ui-ring` | `button.tsx`, `tabs.tsx` |
| `--primary-strong` | `button.tsx`, `badge.tsx` |

`--success` / `--warning` 仍在 `:root` / `.dark` 中定义，但 **未进入 `@theme inline`**，且 `badge.tsx` 直接 `var(--success)`。

**建议修法（二选一，推荐 A）：**

- **A. 把 primitives 改到语义 token**（终态正确）  
  `--text` → `text-foreground`  
  `--text-soft` → `text-muted-foreground`  
  `--danger` → `text-destructive`  
  `--ui-ring` → `ring-ring` / `var(--ring)`  
  `--primary-strong` → `text-primary` 或 `color-mix`  
  同时去掉 `Card` 上已失效的 `overview-shell-card overview-glow`，以及暗色写死的 `border-white/10`、`bg-[linear-gradient(180deg,rgba(24,28,34,0.94),...)]`、`font-['Space_Grotesk']`。这些在亮色主题会明显出错。
- **B. 临时把桥接变量加回 `admin-theme.css`**，先恢复视觉，再做 A。只适合救急，不是完成定义。

做完后立刻：

```bash
npm run check
npm run build:web
# 确认没有 Circular chunk 警告
```

然后真实浏览器验收（见第 7 节）。这是本会话最大缺口：Phase 3 之后再也没有跑过浏览器。

### P1 — Phase 6 主题残留

1. **`src/web/components/RequestTrendPanel.tsx`**  
   主题 token 是 **oklch**，代码却写成：
   ```ts
   const SUCCESS_COLOR = "hsl(var(--success))";
   const DANGER_COLOR = "hsl(var(--destructive))";
   const GRID_COLOR = "hsl(var(--border) / 0.6)";
   const AXIS_COLOR = "hsl(var(--muted-foreground))";
   ```
   这会让 Recharts 轴线/折线颜色无效或错误。应改为直接 `var(--success)` 等，或读计算后的 CSS 颜色。点描边仍写死 `rgba(10,14,20,0.94)`，亮色主题需改。

2. **`src/components/ui/{button,badge,card,tabs}.tsx`**  
   仍是暗色专用样式（`white/10`、`cyan-300`、固定深色渐变）。即使补回变量，亮色主题也不成立。需要改成 `bg-card` / `text-foreground` / `border-border` / `bg-primary` 这一套。

3. **`ProviderMasterCard.tsx:37`**  
   业务层唯一剩余原生 `<button>`。方案允许它作为可访问性控件，但更干净的做法是 `Button asChild` 或可点击 `Card`。不要改交互：选中态、Core 左边框、onClick 打开详情。

4. **把 `--success` / `--warning` 登记进 `@theme inline`**，以便 `text-success` / `bg-success` 可用。

### P2 — 依赖与构建清理

- `package.json` 同时有 `radix-ui` 和零散的 `@radix-ui/react-scroll-area` / `separator` / `tabs`。确认 shadcn 组件实际 import 路径后，删除未使用的重复包。
- `next-themes` 已不在依赖里，无需再删。
- `sonner` 走 `@/web/hooks/use-theme`，不要改回 `next-themes`。
- 构建拆分确认无循环后再考虑是否还要把 lucide 单独 chunk。当前 JS 在 Phase 2 时约 925 kB，拆包后应看到 charts/radix/react/vendor 分文件。

### P3 — Git / 合并（用户未要求前不要做）

建议提交信息：

```text
feat(admin-ui): 完成 Tailwind/shadcn 页面迁移并清理旧 CSS
```

合并回 main：

```bash
cd /home/hedeoer/Projects/bitsearch
git merge feature-admin-ui-rework --no-ff
```

合并前必须完成 P0 浏览器验收。

### 可选增强（非完成定义）

- Breadcrumb、更多 Tooltip、长任务 Progress
- Skeleton 替换残留自定义 loading
- 这些组件已安装，未要求上线

## 6. 给接手 agent 的硬约束

1. **不要覆盖** `src/components/ui/button.tsx` / `card.tsx` / `badge.tsx` 的 variant 枚举。Badge 是 `default | neutral | success | warning | danger`，**不是** shadcn 默认的 `secondary | destructive`。业务大量依赖 `variant="danger"` / `"success"`。
2. **Radix Select 不支持空字符串 value。** `"All"` 必须用 `"all"`，在 `onValueChange` 里转成 `""` 以兼容过滤逻辑。见 `ActivityFiltersBar.tsx`。
3. **新代码只用语义类名**：`bg-card`、`text-muted-foreground`、`border-border`。不要再引入 `--bg` / `--text` / `--surface`。
4. **不要改后端。** 范围仅 `src/web/**`、`src/components/ui/**`、`vite.config.ts`、主题 CSS。
5. **端口**：本 worktree 用 `5176` / `8098`。`npm run dev:web` 已在 `vite.config.ts` 写死 5176。
6. **验证命令**：`npm run check` 然后 `npm run build:web`。没有前端单测框架，不要为这次迁移新加测试 runner。
7. 回复使用简体中文；代码、路径、命令保持英文。
8. 先 `maestro search` / `maestro load --type spec --category ui` 再改文件（项目 AGENTS.md 要求）。UI 约定在 `.workflow/specs/ui-conventions.md`。

## 7. 验收清单（完成定义）

- [ ] 业务 TSX 无应用层原生 `<input>` / `<select>` / `<textarea>`（当前扫描已通过）
- [ ] 原生 `<button>` 仅限 shadcn 内部，或 `ProviderMasterCard` 这类明确的可访问性控件
- [ ] `main.tsx` 只导入必要全局 CSS（已满足）
- [ ] 旧 CSS 文件全部删除（已满足）
- [ ] `src/components/ui/*` 不再引用已删除的 `--text` / `--text-soft` / `--danger` / `--ui-ring` / `--primary-strong`
- [ ] `npm run check` 通过
- [ ] `npm run build:web` 通过，且 **无 Circular chunk 警告**，charts/radix/react/vendor 分文件存在
- [ ] 真实浏览器：`/login`、`/overview`、`/providers`、`/keys`、`/activity`
- [ ] 明暗主题切换无视觉回归（Card/Button/Badge 在亮色下必须可读）
- [ ] 桌面 + 移动端（Sheet 导航）
- [ ] 控制台无未捕获错误
- [ ] 冒烟：登录、导航、筛选、弹窗、表格操作、表单编辑、保存/取消、主题切换

浏览器建议：

```bash
cd /home/hedeoer/Projects/bitsearch-admin-ui
npm run dev          # 或分别 npm run dev:server / npm run dev:web
# 前端 http://localhost:5176
# 后端 http://127.0.0.1:8098
```

本地默认管理密钥从现有 env / 数据目录读取，不要把密钥写进文档或提交。

## 8. 建议执行顺序

1. 修复 `src/components/ui/{button,badge,card,tabs}.tsx` 的失效 CSS 变量和暗色写死样式（P0）。
2. 修复 `RequestTrendPanel.tsx` 的 `hsl(var(--oklch-token))`（P1）。
3. `npm run check && npm run build:web`，确认无 circular chunk。
4. 真实浏览器四页 + 明暗 + 移动端冒烟。
5. 视情况清理重复 Radix 依赖。
6. 向用户报告结果；**等用户指示再 commit / merge。**

## 9. 关键文件索引

| 文件 | 角色 |
|------|------|
| `src/web/admin-theme.css` | tweakcn 双主题，桥接已删 |
| `src/web/app.css` | 仅 Tailwind / tw-animate 入口 |
| `src/web/hooks/use-theme.ts` | `localStorage("admin-theme")` |
| `src/web/components/ThemeToggle.tsx` | 明暗切换 |
| `src/components/ui/*.tsx` | shadcn 组件；**P0 修复点** |
| `src/web/LoginView.tsx` | 已迁移登录页 |
| `src/web/components/ConsoleChrome.tsx` | 已迁移壳层 |
| `src/web/components/KeyPoolsWorkspace.tsx` | 已迁移 |
| `src/web/components/activity/*` | 已迁移 |
| `src/web/components/RequestTrendPanel.tsx` | **P1 图表颜色** |
| `src/web/components/providers/ProviderMasterCard.tsx` | 残留原生 button |
| `vite.config.ts` | manualChunks，需重跑构建确认 |
| `.workflow/specs/ui-conventions.md` | UI spec |

## 10. 会话时间线（供核对）

1. `01a02d12-9954-71f1-afb4-d78126c13015`：用户给出完整 6-phase 方案；完成 Phase 0 提交与 Phase 1 大部分；Phase 2 做到一半，API 中断。
2. `01a02d29-7bd0-78b1-89de-8549ec0c51cb`：续作。完成 Key Pools 并浏览器验收；接着做完 Activity / Overview / Strategy / Providers 代码迁移；开始 Phase 6，删除旧 CSS 和变量桥接，加入 manualChunks；修 circular chunk 时被打断；handoff 多次请求失败。

旧版 `HANDOFF.md` 描述的是 `b593f79` 基线（“还要迁 KeyPools/Activity”），**已过时，已被本文替换。**

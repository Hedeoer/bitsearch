# BitSearch Admin UI 重构 — Handoff 文档

## 项目背景

BitSearch 管理后台前端 UI 改造，目标是从手写暗色主题 + 自定义 CSS 组件迁移到 shadcn/ui + tweakcn 主题 + lucide-react 的标准化方案。

- **主仓库**: `/home/hedeoer/Projects/bitsearch`（`main` 分支）
- **工作分支**: `feature-admin-ui-rework`
- **Worktree 路径**: `/home/hedeoer/Projects/bitsearch-admin-ui`
- **技术栈**: React 19 + Vite + Tailwind CSS v4 + TypeScript strict

### 用户需求

1. 使用 tweakcn 生成的主题统一管理后台视觉（明暗两套）
2. 引入 shadcn/ui 标准组件替换手写 UI
3. lucide-react 图标作为 Action 提示或状态标识穿插使用
4. 在独立 worktree 中工作，保留原管理后台方便对比
5. 后续合并回 main

## 已完成

### Phase 1: 主题接入 ✅

**tweakcn 主题**: `https://tweakcn.com/r/themes/cmdght103000n04lh3e2ae93r`

| 文件 | 说明 |
|------|------|
| `src/web/admin-theme.css` | 完整双主题变量（`:root` 亮色 + `.dark` 暗色），OKLCH 格式 |
| `index.html` | `<html class="dark">` 默认暗色；加载 Outfit + Geist Mono 字体 |
| `main.tsx` | `admin-theme.css` 在所有旧 CSS 之后导入以覆盖样式 |

关键设计：
- **旧变量桥接**: `--bg`→`var(--background)`、`--text`→`var(--foreground)`、`--surface`→`var(--card)` 等 30+ 映射，确保未迁移页面不崩
- **@theme inline 块**: 将 CSS 变量注册为 Tailwind v4 工具类（`bg-background`、`text-muted-foreground` 等）

### Phase 2: 明暗切换 ✅

| 文件 | 说明 |
|------|------|
| `src/web/hooks/use-theme.ts` | `useState` + `useEffect` 管理 theme 状态，读写 `localStorage("admin-theme")`，跟随系统偏好初始化 |
| `src/web/components/ThemeToggle.tsx` | lucide `Sun/Moon` 图标按钮，嵌入 `ConsoleChrome.tsx` 顶栏 |

### Phase 3: shadcn 组件安装 ✅（24 个组件）

```
alert-dialog, badge, breadcrumb, button, card, checkbox, collapsible,
dialog, dropdown-menu, input, label, popover, progress, scroll-area,
select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea, tooltip
```

新增依赖：`sonner@2.0.8`, `next-themes@0.4.6`

**重要改动**: `button.tsx` 增加了 `asChild` 支持（Radix Slot），这是 shadcn 标准模式，AlertDialogAction/Cancel 需要。

### Phase 4: 核心组件迁移 ✅

| 迁移前 | 迁移后 | 文件 |
|--------|--------|------|
| 自研 ToastViewport + toast-store 状态机 | sonner Toaster | `App.tsx`, `toast-store.ts`, `components/ui/sonner.tsx` |
| 手写 ConfirmDialog | shadcn AlertDialog | `Feedback.tsx` |
| ProbeModelsDialog (手写 overlay) | shadcn Dialog + Button | `providers/ProbeModelsDialog.tsx` |
| SearchEngineRequestTestDialog (同上) | shadcn Dialog + Badge + lucide 状态图标 | `providers/SearchEngineRequestTestDialog.tsx` |
| KeyPoolProviderPicker (手写下拉) | Popover + lucide ChevronsUpDown/Check | `KeyPoolProviderPicker.tsx` |

### Phase 5: 表单控件迁移 ✅

| 组件文件 | 迁移内容 |
|----------|----------|
| `AdminAccessFields.tsx` | Input + Button + Label |
| `McpAccessFields.tsx` | Input + Button + Label |
| `StrategyRoutingTab.tsx` | Select × 2 (Routing Mode / Primary Provider) + Input × 4 (Fallback / Result Budget) |
| `ActivityFiltersBar.tsx` | Input (搜索) + Select × 6 (时间/状态/工具/Provider/错误类型/排序) |

**Select 迁移要点**: Radix Select 用 `onValueChange` 替代原生 `onChange`；"All" 选项用 `value="all"` 并在回调中转换为空字符串以兼容现有过滤逻辑。

## 验证结果

每次迁移后均通过：
- `npm run check` → TypeScript 类型检查 ✅
- `npm run build:web` → Vite 构建 ✅（103KB CSS / 891KB JS）
- 用户已通过 `npm run dev:web` 视觉验证两批迁移效果

## 未完成任务

以下按优先级排列：

### P0: 高频组件迁移

#### 1. KeyPoolsWorkspace.tsx
- 当前有 20 个原生控件（input/select/button）
- 密钥列表需要迁移到 shadcn `Table` + `Badge`(状态) + `DropdownMenu`(操作)
- 删除确认已由 AlertDialog 处理，但触发按钮还是旧的

#### 2. KeyInventoryCard.tsx
- 12 个原生控件
- 同样需要 Table 化密钥展示

#### 3. ConsoleChrome.tsx
- 5 个原生按钮（导航/刷新/登出）
- 移动端侧边栏需要迁移到 shadcn `Sheet`
- 导航链接可加 `Tooltip`

#### 4. ActivityInspector.tsx / ActivityFeed.tsx
- 日志详情面板和 feed 列表
- 可折叠区域用 shadcn `Collapsible`
- 加载态用 shadcn `Skeleton`

#### 5. SearchEngineProviderPanel.tsx
- 5 个原生表单控件
- Provider 配置表单迁移到 Input + Select + Switch

### P1: 辅助组件迁移

| 文件 | 控件数 | 建议 |
|------|--------|------|
| `RemoteProviderPanel.tsx` | 2 | Input/Button |
| `PayloadToolbar.tsx` | 2 | Button/DropdownMenu |
| `ProvidersWorkspace.tsx` | 1 | Button |
| `provider-panel-shared.tsx` | 1 | Button |
| `ProviderMasterCard.tsx` | 1 | Badge/Button |

### P2: 清理与收尾

- [ ] 删除不再引用的旧 CSS 文件：`activity.css`, `activity-layout.css`, `activity-panels.css`, `key-pools.css`, `providers.css`, `feedback.css`
- [ ] 删除 `theme.css`（当所有硬编码颜色被替换后）
- [ ] 移除 `admin-theme.css` 底部的旧变量桥接段（当所有页面迁移完成）
- [ ] 从 `package.json` 移除 `next-themes`（sonner 已改用自定义 useTheme hook）
- [ ] 代码分割优化：当前 JS bundle 866KB，可对 Recharts/lucide 做 manualChunks
- [ ] 合并到 `main` 分支

### P3: 可选增强

- Breadcrumb 面包屑导航（组件已安装但未使用）
- Tooltip 用于图标按钮提示（已安装未使用）
- Progress 用于长任务进度条（已安装未使用）
- Skeleton 替换现有 shimmer 加载动画

## 技术注意事项

### 给接手 agent 的提示

1. **不要覆盖现有自定义 Button/Card/Badge** — 它们已经适配了项目的主题变量体系。如需更新，先对比差异。
2. **Radix Select 不支持空字符串 value** — "All" 类选项必须用非空值如 `"all"`，在回调中转换。
3. **Badge variant 枚举不同** — 这个项目的 Badge 用 `"success" | "danger"` 而不是标准的 `"secondary" | "destructive"`。
4. **sonner 已适配自定义主题 hook** — `components/ui/sonner.tsx` 导入的是 `@/web/hooks/use-theme`，不是 `next-themes`。
5. **旧 CSS 变量桥接是临时的** — 新代码应直接使用 shadcn 标准类名 (`bg-card`, `text-muted-foreground`)，不要再引用 `--bg`, `--text` 等旧变量。
6. **worktree 共享 node_modules 符号链接** — `/home/hedeoer/Projects/bitsearch-admin-ui/node_modules` 指向主仓库的依赖目录，安装新依赖时会同步影响两个仓库。

### 常用命令

```bash
cd /home/hedeoer/Projects/bitsearch-admin-ui

# 类型检查
npm run check

# 构建
npm run build:web

# 开发服务器
npm run dev:web        # 仅前端 http://localhost:5176
npm run dev            # 前端+后端

# 添加新 shadcn 组件（不覆盖已有的）
printf 'n\n' | npx shadcn@latest add <component-name>
```

### Git 操作

当前所有变更已暂存但未提交。接手后建议先提交一次作为快照点：

```bash
git commit -m "feat(admin-ui): 引入 shadcn 双主题系统和核心组件迁移"
```

后续合并流程：
```bash
git checkout feature-admin-ui-rework
git add -A && git commit
cd /home/hedeoer/Projects/bitsearch
git merge feature-admin-ui-rework --no-ff -m "merge: admin UI 重构"
```

## 关键文件索引

| 文件 | 角色 |
|------|------|
| `src/web/admin-theme.css` | tweakcn 双主题变量 + 旧变量桥接 |
| `src/web/hooks/use-theme.ts` | 主题状态管理 |
| `src/web/components/ThemeToggle.tsx` | 明暗切换按钮 |
| `src/components/ui/*.tsx` | shadcn 组件库（24 个） |
| `src/web/toast-store.ts` | Toast API 兼容层（调用 sonner） |
| `src/web/components/Feedback.tsx` | ConfirmDialog (AlertDialog) + LoadingOverlay + EmptyState |

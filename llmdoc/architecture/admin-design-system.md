# BitSearch Admin Console 设计系统（方向 A · 暖光工作台）

> 本文件是管理后台视觉与交互的唯一事实源。改风格 = 先改这里，再动代码。
> 确立于 2026-08-24 管理后台布局重设计（四方向预览，用户选定 A）。
> 三拨盘定档：视觉冒险度 5 / 动效强度 4 / 信息密度 6。

## 1. 视觉主题与氛围

**一句话**：登录页的暖光无缝延伸进工作区——像走进同一间打暖光的房间。

- 基调延续 tweakcn 暖橙赤陶 token（`src/web/admin-theme.css`，hue ~39-107°），light 为主视觉基准，dark 为完整适配。
- 壳层氛围两件套（从登录页 `login-scene` 延伸，定义在 `app.css` 的 `.console-atmosphere`，固定于视口、置于内容之下）：
  - **径向暖光**：`radial-gradient(900px circle at 50% 2%, color-mix(in oklab, var(--primary) 24%, transparent), transparent 68%)`——峰值落在顶栏下缘，形成「工作台上方一盏暖灯」的弧光；亮色下读作顶栏洇下的暖色地平线，暗色下是明确的橙色 bloom。
  - **点阵纹理**：`radial-gradient(color-mix(in oklab, var(--foreground) 26%, transparent) 1px, transparent 1px)` 22px 网格，mask 渐隐至视口 38%，整体 opacity 0.26。
  - 注意：卡片为不透明 bg-card，光只能从顶栏下 padding 带与边距洇出——这是有意的「灯下光」形态，不要为了露出光晕而把卡片改半透明。
- 记忆点：登录 → 控制台的连续光感。任何页面截屏都应能认出这是 BitSearch。

## 2. 色板与角色

全部使用 admin-theme.css 的语义 token，禁止裸色值与 `hsl()` 包裹 oklch：

| 角色 | Token | 用法 |
|------|-------|------|
| 页面底 | `bg-background` | 壳层、内容区 |
| 面板底 | `bg-card` | 卡片、侧栏（不透明，不用 `/95` 玻璃拟态） |
| 品牌主色 | `bg-primary` / `text-primary` | logo 方块、激活导航、主 CTA、图表主系列 |
| 语义 | `success` / `warning` / `destructive` | 状态徽章、图表语义系列（destructive 在 light 下近黑、dark 下亮红，两套差异是 token 事实） |
| 边框 | `border-border` | 卡片 1px 边框（层级的第一手段） |
| 图表 | `--chart-1..5` | Recharts 直引 `var()` |

**层级策略（偷自 Stripe）**：边框为主，染色阴影为辅——普通卡片只有 1px 边框 + `shadow-xs`；只有主面板（Pulse 面板、悬浮保存条、Dialog）升级到双层染色阴影。禁止 `backdrop-blur`（浮层语义除外，当前无此需求）。

## 3. 排版规则

- 西文/界面：`Inter`（--font-sans）；数字/代码/指标：`JetBrains Mono`（--font-mono）+ `tabular-nums`。中文回退系统栈（PingFang SC / Microsoft YaHei / Noto Sans SC）。
  （2026-08 借鉴 AxonHub 的字体组合，从 Outfit + Geist Mono 迁入 Inter + JetBrains Mono；字体权威定义仍留在 `:root`，加载在 `index.html` Google Fonts。）
- **渐进字距**（偷自 Stripe）：页面标题 `tracking-tight`；eyebrow 式小型大写标签 `tracking-[0.14em]`（唯一允许的大字距）。
- **eyebrow 预算**：每个页面视图 ≤ 2 处 eyebrow（含侧栏分组标签）。现有 31 处 uppercase 小标题收敛为：CardTitle（正常大小写、font-semibold）为主，eyebrow 只保留给「页面身份」级标签。
- 数字层级锚点：指标数值 `font-mono text-3xl/4xl tabular-nums tracking-tight`；修复所有非 mono 数字。
- 正文 `text-sm text-muted-foreground`；标题 `text-wrap: balance`。

## 4. 组件样式

- **卡片**：一律 shadcn `Card`（`rounded-xl` = --radius+4px 派生），禁止手写 `rounded-[Npx]`。圆角刻度只用派生值：`rounded-lg`（交互件）/ `rounded-xl`（卡片）/ `rounded-2xl`（品牌方块）。
- **双层染色阴影**（DNA：Stripe 公式赤陶化，token 名 `--shadow-glow`，定义于 admin-theme.css 的 :root,.dark 块）：
  `0 24px 48px -28px color-mix(in oklab, var(--primary) 16%, transparent), 0 2px 6px -2px oklch(0 0 0 / 0.06)`
  用于：Overview 主面板、Providers 悬浮保存条、Dialog、登录卡（替换 login-card 内联值）。
- **Badge**：五变体枚举不可改（default/neutral/success/warning/danger）；状态徽章保持胶囊形。
- **导航激活态**：整块 `bg-primary/10 border-primary/25 text-primary rounded-lg`——**严禁左侧竖线装饰**（border-left 色条 / inset 竖条 / ::before 左条）。
- **按钮**：保留 shadcn 变体；主 CTA hover 时叠加 `shadow-primary/20` 染色；`:active { transform: scale(0.98) }`。
- **加载态**：统一 shadcn `Skeleton`（结构占位）+ `Loader2 animate-spin`（按钮内联）；LoadingOverlay 用 Skeleton 组合重建。全站只此两条路径。

## 5. 布局原则

- **骨架**：侧栏 256px 固定（lg+，唯一主导航，含 Monitor / Configure 两组）+ 顶栏（页面上下文 + 全局操作，无中央导航、无第二个 logo）+ 内容区。
- 容器：`max-w-[1440px] mx-auto`（header 与 main 成对出现，改一起改）。
- 密度哲学（偷自 Stripe「dense data, generous chrome」）：表格/图表/指标内部紧凑（gap-3/p-4），容器与区块之间宽松（gap-5/p-6）；组内间距 < 组间间距。
- 移动端（<lg）：侧栏收进 Sheet 抽屉（保留）；非对称网格塌缩单列；`min-h-screen` 不用 `h-screen`。
- 30s 自动刷新仅 /overview（App.tsx 现状，勿破坏）。

## 6. 深度层级

| 层级 | 处理 | 用于 |
|------|------|------|
| L0 平面 | 无阴影 | 页面底、侧栏 |
| L1 浮起 | `shadow-xs` + border | 普通卡片、列表项容器 |
| L2 主面板 | `--shadow-glow` 双层染色 | Overview 主面板、悬浮保存条 |
| L3 浮层 | shadow-xl + border | Dialog、Sheet、popover |
| 焦点 | ring = primary（token 已定） | 所有可交互件 focus-visible |

## 7. Do's & Don'ts

**Do**
- 数字一律 JetBrains Mono tabular-nums；图表色直引 var()
- 激活/强调用整块底色 + 边框 + 字重
- 新增区块先查本文件第 4/5 节再写类名
- hover 动效包 `@media (hover:hover)`；所有动效 ≤300ms、逐属性声明、`cubic-bezier(0.23,1,0.32,1)`、reduced-motion 兜底

**Don't**
- 不用 `bg-card/95 backdrop-blur-xl` 玻璃拟态；不用任意值圆角 `rounded-[22px]`
- 不用左侧竖线装饰；不加新 eyebrow（超预算先删旧的）
- 不手改 admin-theme.css 的 oklch 色值（改主题走 tweakcn 再生成，保全 --success/--warning 与 ：root 字体定义）
- 不引入第三个 CSS 入口；自定义 CSS 只进 app.css（保持同单元 import admin-theme.css）
- 键盘高频操作不加动画

## 8. 响应式

- 断点：lg（1024）切换侧栏/抽屉；xl（1280）起用多列网格；2xl 放宽列距。
- Overview 三栏（1.45fr/360px/0.92fr）→ xl 双栏 → 单列；Activity 双栏 → 单列；Providers 主从 → 单列堆叠（主列表变横向 chip 行）。
- 窄屏检查项：无横向滚动、表格转卡或横向滚动、悬浮保存条全宽贴底。

## 9. Motion 哲学

- 人格：专业仪表盘，干脆利落。入场一次性编排（登录→控制台首帧 300ms rise + 70ms stagger），常驻交互无入场动画。
- 时长表：按压 120ms / hover 140ms / 下拉 200ms / Sheet 300ms（--ease-drawer）/ 弹窗 200ms。
- Live 呼吸灯：状态点 `box-shadow` 扩散呼吸 2.4s 循环（唯一允许的循环动画，reduced-motion 静止）。
- 只动 transform/opacity；快速触发组件用 transition 不用 keyframes。

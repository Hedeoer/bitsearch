# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

BitSearch is a single deployable TypeScript app: a remote MCP server (web_search / web_fetch / web_map aggregated over search-engine、Tavily、Firecrawl providers) plus a React admin console SPA served by Express. Requires Node 22+.

## Commands

- `npm run dev` — backend on 127.0.0.1:8098 (`tsx watch`) + Vite on 5176 (`/api` proxied to 8098). Note: README 等旧文档写的 8097/5173 已过时。
- 默认验证门禁(任何改动完成前):`npm run check && npm test`
- Lint:`npm run lint`(ESLint 10 flat config);0 error 是硬性要求,warn 为存量迁移项(set-state-in-effect 等)
- 需要真实浏览器的场景(页面验证、截图、走登录/交互流程)使用 `agent-browser-cli` skill。
- 单个测试文件:`node --import tsx --test tests/key-pool-service.test.ts`(node:test 经 tsx 运行,没有 vitest/jest)
- 改动后端 / MCP 相关代码时追加完整 CI 门禁:`npm run mcp:tooling`(CI 在 main 与 PR 上跑 check、build、mcp:tooling)
- 测试集中在 `tests/*.test.ts`,不与功能代码同目录

## Gotchas

- 服务端不加载 `.env`(无 dotenv)。dev 下仅 npm script 内联的 `APP_HOST`/`APP_PORT` 生效;生产由 systemd `EnvironmentFile` 或 docker 显式注入。
- 密钥首次启动自动生成到 `data/runtime-secrets.json`(0600),优先级 env > file > generated。`data/` 是本地运行时状态,永不提交。
- `tests/guidance-consistency.test.ts` 断言 `README.md` 和 `skills/bitsearch-research/SKILL.md` 含有精确短语 —— 只改文档也可能挂 CI。
- 仓库根部的 `skills/` 是产品交付物(Agent Skills 标准模板,供用户的 MCP 客户端安装),不是 Claude Code 工具目录。
- 深入文档在 `llmdoc/`:架构见 `architecture/`,操作指南见 `guides/`(如 `guides/adding-mcp-tools.md`),工具清单见 `reference/mcp-tools-reference.md`。

## Admin UI(src/web)

- shadcn/ui(new-york 风格)基础组件在 `src/components/ui/`,经 `@/components` 别名引用;主题是 tweakcn 生成的 oklch token,位于 `src/web/admin-theme.css`(light + `.dark`)。调整主题应从 https://tweakcn.com/r/themes/cmdght103000n04lh3e2ae93r 再生成,不要手改 token 值;文件头注释警告字体定义不能放进 `@theme inline`(自引用会失效)。
- 只用语义 Tailwind 类(`bg-card`、`text-muted-foreground`、`border-border`),不用裸色值或旧版 `--bg` 类变量。
- Badge 变体是项目自定义的:`default | neutral | success | warning | danger`。不要用 shadcn 默认变体枚举覆盖它。
- token 是 oklch:直接引用 `var(--chart-1)`(含 Recharts);包一层 `hsl(...)` 会坏。
- Radix Select 不允许空字符串 value:筛选用 `"all"` 哨兵值再转回 `""`(参考 `ActivityFiltersBar.tsx`)。
- 图标用 lucide-react;路由为 react-router v7 的普通 `<Routes>`,声明在 `AppShell.tsx`。

## Server(src/server)

- ESM 相对导入必须带 `.js` 后缀(如 `./app-context.js`),否则编译产物解析失败。
- HTTP/MCP 路由用工厂模式 `createXRouter(context)`,依赖经 AppContext 注入,不用模块级单例。
- 跨端 API 类型统一放 `src/shared/contracts.ts`。
- MCP 工具注册在 `src/server/mcp/register-tools.ts` 与 `modern-register-tools.ts`;新增工具需同步更新 `llmdoc/reference/mcp-tools-reference.md`,若提示词/用法措辞变化还需检查 `skills/bitsearch-research/SKILL.md`(见 guidance 一致性测试)。

## Git

- Conventional Commits `<type>(<scope>): <summary>`,摘要用简体中文,如 `feat(admin-ui): 完成 Tailwind/shadcn 页面迁移`。
- 主分支 `main`;功能分支命名 `feature-*`,以 `--no-ff` 合并(merge 提交形如 `merge: 合并 …`)。

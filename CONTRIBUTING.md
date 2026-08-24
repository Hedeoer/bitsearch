# Contributing

## Before You Start

- Open an issue first for significant changes, feature additions, or behavior changes.
- Keep the scope focused. Small, reviewable pull requests are preferred.
- Do not commit secrets, populated `data/*.db` files, or local environment files.

## Development Setup

```bash
npm install
cp .env.example .env
mkdir -p data
npm run dev
```

Use `Copy-Item .env.example .env` and `New-Item -ItemType Directory -Force data` on PowerShell.

## Branches and Commits

- Use a dedicated branch for each change.
- Follow Conventional Commit style when possible: `<type>(<scope>): <summary>`.
- Keep commit messages specific to the user-visible or developer-visible change.

Examples:

```text
feat(activity): add provider error grouping
fix(mcp): reject missing session headers
docs(readme): add deployment and usage examples
```

## Code Style

- Use TypeScript with ESM imports.
- Keep modules small and focused.
- Prefer named exports for reusable utilities.
- Keep shared API contracts in `src/shared/contracts.ts`.
- Match the existing formatting style: 2-space indentation, double quotes, and trailing commas where applicable.

## Validation

Tests use the built-in `node:test` runner executed through tsx (`npm test`). Minimum validation for every change:

```bash
npm run check && npm test
```

Lint checks use ESLint (`npm run lint`); new code should not introduce errors.

For changes to backend or MCP-related code, also run the MCP tooling gate locally:

```bash
npm run mcp:tooling
```

Also run a manual smoke test for the flow you changed while `npm run dev` is running.

When adding tests:

- Add `*.test.ts` files under the central `tests/` directory.
- Keep tests deterministic and easy to run locally.
- Note that `tests/guidance-consistency.test.ts` asserts exact phrases in `README.md` and `skills/bitsearch-research/SKILL.md`.

## Pull Requests

Include the following in your PR description:

- What changed
- Why it changed
- How you verified it
- Screenshots for UI changes
- Related issue links when applicable

Review checklist before opening a PR:

- `npm run check && npm test` passes
- Changed flows were manually exercised
- Documentation was updated when behavior changed
- No secrets or local state files were added

## Reporting Issues

When filing an issue, include:

- Expected behavior
- Actual behavior
- Reproduction steps
- Relevant logs, screenshots, or request samples
- Environment details such as Node version, deployment mode, and provider configuration context

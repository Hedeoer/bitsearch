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

There is no dedicated test runner configured in the repository yet. Minimum validation for every change:

```bash
npm run check
```

Also run a manual smoke test for the flow you changed while `npm run dev` is running.

When adding tests:

- Place `*.test.ts` or `*.test.tsx` next to the feature they cover.
- Keep tests deterministic and easy to run locally.

## Pull Requests

Include the following in your PR description:

- What changed
- Why it changed
- How you verified it
- Screenshots for UI changes
- Related issue links when applicable

Review checklist before opening a PR:

- `npm run check` passes
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

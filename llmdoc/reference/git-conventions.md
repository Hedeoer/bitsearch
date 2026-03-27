# Git Conventions

## 1. Core Summary

This project follows Conventional Commits with optional scopes. The single long-lived branch is `master`. PRs should describe user-visible changes, list verification steps, and include screenshots for UI work.

## 2. Source of Truth

- **Commit & PR rules:** `AGENTS.md` (section "Commit & Pull Request Guidelines")
- **Pre-PR validation:** `npm run check` (TypeScript type-checking, no emit)

## 3. Branch Strategy

| Branch   | Purpose                        |
| -------- | ------------------------------ |
| `master` | Primary integration branch     |
| feature  | Short-lived, merged to master  |

## 4. Commit Message Format

```
<type>(<scope>): <summary>
```

- **Scope is optional** but recommended when it adds clarity.
- **Summary** is lowercase, imperative, no trailing period.

### Observed Types

| Type    | Usage                                   |
| ------- | --------------------------------------- |
| `feat`  | New feature or significant enhancement  |
| `chore` | Tooling, bootstrap, non-feature work    |

### Observed Scopes

`key-pools`, `activity`, `admin`, `ui` -- derived from module or feature area.

## 5. PR Guidelines

- Describe user-visible changes.
- List verification / smoke-test steps.
- Reference related issues.
- Include screenshots for UI work.
- Run `npm run check` before opening.

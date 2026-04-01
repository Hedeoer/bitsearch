# BitSearch Adoption Notes for Agent Skills

- Basis: first-party `agentskills.io` pages fetched on 2026-04-01

## Adopted decisions

- Distribute one coherent BitSearch skill: `bitsearch-research`.
- Keep only standard frontmatter in the distributed template.
- Use `.agents/skills/` as the default install target in docs.
- Keep client-specific guidance lightweight and documentation-only.
- Keep detailed routing, evidence, and workflow content in `references/`.
- Add trigger-eval queries as part of the standard template.

## Rejected design choices

- No Claude-only slash-command semantics in the source template.
- No split between hidden/background and manual workflow templates in the standard distribution.
- No vendor-specific source-of-truth directories under `skills/`.

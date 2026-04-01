---
name: bitsearch-research
description: Research, verify, and cross-check uncertain or time-sensitive information with the BitSearch MCP server. Use when BitSearch tools are available and the task needs broad search via the configured search_engine, real-source retrieval, structured extraction, or multi-step evidence gathering to reduce hallucinations and improve factual grounding.
license: MIT
compatibility: Designed for Agent Skills-compatible clients. Requires BitSearch MCP access, internet access, and a client that can discover skills from .agents/skills/ or a native skills directory and expose the currently visible tool surface.
metadata:
  author: Hedeoer
  source: https://github.com/Hedeoer/bitsearch
  version: "1.0"
---

# BitSearch Research

Use this skill when BitSearch MCP tools are available and the user needs broad search through the configured `search_engine`, real-source retrieval and cross-checking through Tavily or Firecrawl, or multi-step evidence gathering to reduce hallucinations and improve factual grounding.

## Default procedure

1. Confirm which BitSearch tools are currently exposed before planning around them.
2. Restate the goal in terms of output shape: prose answer, citations, raw source content, or structured JSON.
3. Decide whether the task needs the Planning Engine first. Upgrade to planning when the query is ambiguous, multi-hop, requires sub-query decomposition, or needs explicit tool mapping and execution order.
4. For simple tasks, use the shortest correct path:
   - broad discovery and initial synthesis through `search_engine`: `web_search`
   - source inspection after search: `get_sources`
   - one known URL: `web_fetch`
   - URL discovery only: `web_map`
   - one site's content in one synchronous call: `tavily_crawl`
   - many known URLs: `firecrawl_batch_scrape`
   - structured fields or JSON: `firecrawl_extract`
5. For complex tasks, run the Planning Engine in order:
   - `plan_intent`
   - `plan_complexity`
   - `plan_sub_query`
   - `plan_search_term`
   - `plan_tool_mapping`
   - `plan_execution`
6. If `plan_complexity` returns level 1, phases 1-3 are enough. If it returns level 2, continue through phase 5. If it returns level 3, complete all 6 phases before executing retrieval.
7. If you submit an async Firecrawl job, keep polling the matching status tool until it reaches a terminal state unless the user asked only for submission.
8. Before concluding, verify important claims against primary or official sources when possible.

## Gotchas

- Only use tools that are currently visible in the client.
- Do not invoke the Planning Engine for every query; use it only when decomposition or execution planning is genuinely needed.
- `web_map` discovers URLs; it does not return full page content.
- Firecrawl submit tools are not final-result tools.
- Extracted JSON is structured output, not automatic proof that the source is authoritative.
- If evidence conflicts, present the conflict instead of forcing a confident single answer.

## Validation loop

1. Check that the selected tool matches the task shape.
2. Check whether the task should have used the Planning Engine instead of direct retrieval, or vice versa.
3. Check whether the sources are primary, official, or third-party.
4. Check whether citations or explicit confidence are needed.
5. If evidence is weak or conflicting, continue retrieval or state the limitation clearly.

## References

- Tool routing defaults: [references/tool-selection.md](references/tool-selection.md)
- Planning Engine usage: [references/planning-engine.md](references/planning-engine.md)
- Evidence rules: [references/evidence-rules.md](references/evidence-rules.md)
- Reusable workflow patterns: [references/workflow-patterns.md](references/workflow-patterns.md)
- Common mistakes and edge cases: [references/gotchas.md](references/gotchas.md)
- Trigger-eval queries for description tuning: [references/trigger-evals.json](references/trigger-evals.json)

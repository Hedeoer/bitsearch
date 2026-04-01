# Gotchas

- The visible client tool list is the runtime source of truth. Do not assume `tavily_crawl` or any `firecrawl_*` tool is always exposed.
- The Planning Engine is for complex tasks, not for every query. Overusing it adds overhead and increases the chance of unnecessary complexity.
- If you start Planning Engine, keep the same `session_id` across phases or the plan state will fragment.
- `web_map` returns site structure and URLs, not the full extracted body of each page.
- Firecrawl submit tools return job identifiers and initial state, not the final data payload.
- Generic routing rules and provider-specific tools are different layers; do not switch layers unless the task shape requires it.
- Extracted or scraped content from third-party pages still needs credibility checks before you present it as fact.

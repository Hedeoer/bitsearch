# Workflow Patterns

## Complex multi-hop investigation

1. Start with the Planning Engine:
   - `plan_intent`
   - `plan_complexity`
   - `plan_sub_query`
2. If the complexity level requires it, continue with:
   - `plan_search_term`
   - `plan_tool_mapping`
   - `plan_execution`
3. Execute the resulting `executable_plan`.
4. Cross-check the final synthesis against the strongest sources collected during execution.

## Current-information verification

1. Start with `web_search` so the configured `search_engine` can search broadly and produce an initial synthesis.
2. Use `get_sources` if you need citations or source inspection.
3. Fetch the strongest sources if page details matter.
4. Verify the conclusion against primary evidence where possible.

## Known-page inspection

1. Use `web_fetch` for the provided URL.
2. If the user wants factual conclusions rather than raw content, verify those conclusions if the page is not authoritative.

## One-site traversal

1. Prefer `tavily_crawl` when it is exposed and synchronous output is enough.
2. Use `firecrawl_crawl` plus `firecrawl_crawl_status` only when deeper async crawling is actually needed.

## Multiple known URLs

1. Use `firecrawl_batch_scrape`.
2. Continue with `firecrawl_batch_scrape_status` until terminal state if final results are needed.

## Structured extraction

1. Use `firecrawl_extract`.
2. Continue with `firecrawl_extract_status` until terminal state.
3. Treat the extracted fields as claims unless the source is authoritative.

# Tool Selection

Use the current BitSearch tool surface as the source of truth. If a tool is not visible in the client, do not plan around it.

BitSearch has two complementary layers:

- `web_search` uses the configured `search_engine` for broad discovery and initial synthesis.
- Tavily and Firecrawl provide supplemental sources and direct retrieval, crawling, mapping, scraping, and extraction capabilities.

## Planning before tool selection

- Use the Planning Engine first when the task is ambiguous, multi-hop, or requires explicit decomposition and execution order.
- Use direct tool selection only when the shortest correct path is already clear.
- If Planning Engine is used, `plan_tool_mapping` should produce the concrete retrieval tool choices for each sub-query.

## Defaults

- Use `web_search` for broad discovery, comparison, and initial answer synthesis across sites.
- Use `get_sources` after `web_search` when you need exact source inspection or citation support.
- Use `web_fetch` for one known URL when you need page content.
- Use `web_map` only for URL discovery and site structure.
- Use `tavily_crawl` when you need one site's content returned synchronously.
- Use `firecrawl_batch_scrape` when you already have a list of URLs and need them scraped in parallel.
- Use `firecrawl_extract` when the answer should be structured fields or JSON.
- Use `firecrawl_crawl` only when the task genuinely needs deeper asynchronous site crawling.

## Selection discipline

- Prefer generic tools first: `web_search`, `web_fetch`, `web_map`.
- Switch to provider-specific tools only when the task needs their exact behavior.
- Do not simulate content crawling with repeated `web_fetch` calls when `tavily_crawl` or `firecrawl_crawl` is the better fit.
- Do not use provider-specific tools merely to bypass generic routing.
- Do not substitute ad hoc direct retrieval for a task that clearly needs plan decomposition first.

## Async rules

- `firecrawl_crawl`, `firecrawl_batch_scrape`, and `firecrawl_extract` are submit tools.
- Poll the matching status tool until `completed`, `failed`, or `cancelled` unless the user asked only for submission.
- Preserve the terminal status exactly as returned.

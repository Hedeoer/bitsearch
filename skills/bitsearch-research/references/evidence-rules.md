# Evidence Rules

BitSearch combines a `search_engine`-driven broad-search and synthesis layer with real-source retrieval tools. That improves factual grounding, but neither model output nor fetched content is automatically authoritative fact.

## Source quality

- Treat official docs, vendor sites, changelogs, and official product pages as primary evidence.
- Treat blogs, forums, aggregators, and unclear pages as claims that still need verification.
- Treat `firecrawl_extract` output as extracted claims unless the source itself is authoritative.

## Verification standard

- Support important factual claims with at least two independent sources when reasonably possible.
- If only one source is available, state that limitation explicitly.
- If sources conflict, present the conflict and avoid overstating confidence.
- If evidence is partial, stale, or indirect, say so before giving the best supported answer.

## Answer discipline

- Separate raw tool output from your analysis.
- Treat `web_search` output as a search-and-synthesis layer that still benefits from source inspection and cross-checking.
- Prefer primary or official sources for final conclusions.
- Include citations or clear source attribution when the task is evidence-sensitive.
- State uncertainty directly when confidence is not high.

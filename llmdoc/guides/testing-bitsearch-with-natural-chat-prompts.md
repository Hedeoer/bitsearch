# Testing BitSearch with Natural Chat Prompts

This guide provides a natural-chat test script for users who want to validate that BitSearch MCP tools are being selected and used correctly in a real conversation, without turning the session into an obviously artificial tool-by-tool checklist.

It is intended for:

- clients that connect to the BitSearch MCP server directly
- clients using the fallback BitSearch companion prompt
- clients using the `bitsearch-research` skill

## Preconditions

Before running the script, confirm:

- BitSearch MCP is connected and authenticated successfully
- the current tool surface is visible in the client
- if your client supports Agent Skills, `bitsearch-research` is installed and active when needed
- if your client has native web tools, they are disabled locally so the model does not bypass BitSearch

For setup details, see:

- [Using BitSearch with Agent Skills](using-bitsearch-with-agent-skills.md)
- [Configuring Search Providers](configuring-search-providers.md)

## What This Script Tests

This conversation flow is designed to naturally exercise:

- `web_search`
- `get_sources`
- `web_fetch`
- `web_map`
- `tavily_crawl` when exposed
- `firecrawl_batch_scrape` and `firecrawl_batch_scrape_status` when exposed
- `firecrawl_extract` and `firecrawl_extract_status` when exposed
- optionally, the Planning Engine when the conversation escalates into a more complex research question

It does not try to force every operational tool into the same conversation. The goal here is realistic usage, not maximal mechanical coverage.

## Recommended Conversation Script

Use one continuous conversation context. Ask the questions in order.

### 1. Broad discovery

```text
I want to use FastAPI for a production API service. Based on the current official materials, what is the most basic way to get started and run it?
```

Expected behavior:

- usually triggers `web_search`
- answer should rely on current sources, not only internal memory

### 2. Source follow-up

```text
What sources was that conclusion mainly based on? Please list them and separate official sources from third-party ones.
```

Expected behavior:

- should use `get_sources` against the previous `web_search`
- should not claim the tool is unavailable if it is exposed
- should not fall back to pure internal knowledge unless the prior search context is truly unavailable

### 3. Known-page reading

```text
Please read the FastAPI homepage directly and summarize its main capabilities and positioning.
```

Expected behavior:

- usually triggers `web_fetch`

### 4. Site structure discovery

```text
If I want to study the documentation systematically, do not read the full page content yet. First map out the main sections of the site, especially areas like tutorial, deployment, and reference.
```

Expected behavior:

- usually triggers `web_map`
- should focus on URL structure rather than full page extraction

### 5. One-site traversal

```text
I care most about the beginner path from zero to a working app. Please go through the tutorial-related content on the official site and tell me the smallest runnable example, the startup command, and the key points emphasized in the docs.
```

Expected behavior:

- should prefer `tavily_crawl` when it is exposed
- if `tavily_crawl` is not exposed, a reasonable fallback is acceptable

### 6. Deployment-focused follow-up

```text
Besides the beginner path, I also want to know what the official docs say about deployment and production use. Please continue by organizing the deployment-related content from the official site.
```

Expected behavior:

- may use one-site traversal or multi-page retrieval
- when provider-native crawl tools are exposed, they may be selected naturally

### 7. Structured extraction

```text
Do not just summarize it. Please turn several key tutorial- and deployment-related pages from the official site into structured information, such as page title, page type, main topics, and whether code examples are included.
```

Expected behavior:

- should prefer `firecrawl_extract` when exposed
- should poll `firecrawl_extract_status` until terminal state when final results are needed

### 8. Batch scrape

```text
If there are too many pages, you can batch scrape the relevant pages and compare them directly instead of reading them one by one.
```

Expected behavior:

- should prefer `firecrawl_batch_scrape` when exposed
- should continue with `firecrawl_batch_scrape_status` until terminal state when final results are needed

### 9. Final synthesis

```text
Based only on the material you just gathered, how would you judge whether FastAPI is suitable for a production API service today? Please distinguish between what the official docs claim and what can actually be confirmed from the material.
```

Expected behavior:

- should synthesize prior retrieval results instead of restarting blindly
- should separate official claims from analysis

## Optional Planning-Engine Extension

If you also want to test the Planning Engine in a natural way, continue in the same conversation:

```text
This question cannot be answered by reading only a few pages. Before giving a conclusion, please break down the question of whether FastAPI is suitable for production today and identify the main angles we should evaluate.
```

Then continue:

```text
Continue by breaking this into smaller sub-questions in a reasonable way, and explain what each sub-question is meant to resolve.
```

```text
Then list how you would search next and which types of sources you would prioritize.
```

```text
Also explain which method is best for each sub-question, which parts can be done in parallel, and which parts should be left for later.
```

Expected behavior:

- this sequence can naturally trigger the six-phase Planning Engine
- the model should keep the same planning `session_id` across phases

## Evaluation Checklist

Use this checklist when reviewing the run:

- the model uses BitSearch tools rather than native client web tools
- `get_sources` is used for source follow-up after `web_search`
- `web_map` is used for structure discovery rather than page-body extraction
- async Firecrawl tools are followed by the matching status tools
- provider-native tools are only used when they are actually exposed
- the final answer clearly distinguishes official evidence from third-party or inferred conclusions

## Common Failure Patterns

Watch for these issues:

- the model says `get_sources` is unavailable even though it is exposed
- the model forgets the previous `web_search` context and invents source lists from memory
- the model uses `web_map` when the user clearly asked for page content
- the model submits a Firecrawl async job but never polls the matching status tool
- the model assumes `tavily_crawl` or `firecrawl_*` is available without checking the visible tool surface
- the client uses native web search instead of BitSearch MCP

## Recommendation

For ongoing validation, keep two testing styles:

- natural-chat script: for realistic client behavior and workflow verification
- strong-coverage script: for explicit regression testing of individual tools

This guide covers the first style.

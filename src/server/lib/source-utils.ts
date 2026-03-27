const URL_PATTERN = /https?:\/\/[^\s<>"'`，。、；：！？》）】)*]+/g;
const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
const THINK_PATTERN = /<think>[\s\S]*?<\/think>/gi;
const SOURCES_HEADING_PATTERN =
  /(^|\n)\s{0,3}(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:source section|sources?|references?|citations?|来源|信源|参考资料)\s*:?\s*(?:\*\*|__)?\s*(\n|$)/i;

function normalizeMarkdownLinks(input: string): Array<Record<string, unknown>> {
  return Array.from(input.matchAll(LINK_PATTERN)).map((match) => ({
    title: match[1],
    url: match[2],
  }));
}

function trimAnswer(input: string): string {
  return input
    .replace(THINK_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitBySourceHeading(input: string): {
  answer: string;
  sourceBlock: string;
} | null {
  const match = input.match(SOURCES_HEADING_PATTERN);
  if (!match || match.index === undefined) {
    return null;
  }
  return {
    answer: input.slice(0, match.index).trim(),
    sourceBlock: input.slice(match.index).trim(),
  };
}

export function extractUniqueUrls(input: string): string[] {
  const matches = input.match(URL_PATTERN) ?? [];
  return Array.from(
    new Set(
      matches.map((item) =>
        item.replace(/^[*(\[]+/, "").replace(/[.,;:!?*]+$/, ""),
      ),
    ),
  );
}

export function splitAnswerAndSources(input: string): {
  answer: string;
  sources: Array<Record<string, unknown>>;
} {
  const cleaned = trimAnswer(input);
  const split = splitBySourceHeading(cleaned);
  if (split) {
    const markdownSources = normalizeMarkdownLinks(split.sourceBlock);
    const headingSources =
      markdownSources.length > 0
        ? markdownSources
        : extractUniqueUrls(split.sourceBlock).map((url) => ({ url }));
    if (headingSources.length > 0) {
      return {
        answer: split.answer,
        sources: headingSources,
      };
    }
  }

  const sources = normalizeMarkdownLinks(cleaned);

  if (sources.length > 0) {
    return { answer: cleaned, sources };
  }

  return {
    answer: cleaned,
    sources: extractUniqueUrls(cleaned).map((url) => ({ url })),
  };
}

export function mergeSources(
  ...lists: Array<Array<Record<string, unknown>> | null | undefined>
): Array<Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const list of lists) {
    for (const item of list ?? []) {
      const url = typeof item.url === "string" ? item.url : null;
      if (!url || map.has(url)) {
        continue;
      }
      map.set(url, item);
    }
  }
  return Array.from(map.values());
}

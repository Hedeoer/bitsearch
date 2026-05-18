import { nanoid } from "nanoid";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { AppContext } from "../app-context.js";
import {
  getToolResultArtifact,
  parseToolResultUri,
  saveToolResultArtifact,
  type ToolResultArtifactRecord,
} from "../repos/tool-result-artifact-repo.js";
import { getSystemSettings } from "../repos/settings-repo.js";

export interface ResultPageCursor {
  kind: "array" | "item_text" | "text";
  index?: number;
  offset?: number;
}

export interface ResultPage {
  result_id: string;
  result_uri: string;
  tool_name: string;
  kind: string;
  title: string | null;
  summary: Record<string, unknown>;
  item_index?: number | null;
  items?: unknown[];
  text?: string;
  returned_items: number | null;
  total_items: number | null;
  returned_chars: number;
  total_chars: number;
  next_cursor: string | null;
  truncated: boolean;
}

export interface ArtifactHandle {
  result_id: string;
  result_uri: string;
  total_chars: number;
  total_items: number | null;
  next_cursor: string | null;
  truncated: boolean;
}

function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function toolJsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: toJsonText(value) }],
    structuredContent: value as Record<string, unknown>,
  };
}

export function budgetedToolJsonResult(
  context: AppContext,
  toolName: string,
  value: Record<string, unknown>,
): CallToolResult {
  const text = toJsonText(value);
  const budget = readResultBudget(context);
  if (text.length <= budget.hardResponseChars) {
    return toolJsonResult(value);
  }
  const artifact = saveArtifact(context, {
    toolName,
    kind: "json",
    title: `${toolName} result`,
    summary: {
      tool_name: toolName,
      total_chars: text.length,
    },
    content: value,
    totalItems: Array.isArray(value.items) ? value.items.length : null,
  });
  const page = getResultPage(context, {
    resultId: artifact.id,
    maxChars: budget.firstResponseChars,
  });
  return toolJsonResult({
    tool_name: toolName,
    result_preview: page?.text ?? toJsonText(page?.items ?? []).slice(0, budget.firstResponseChars),
    returned_chars: page?.returned_chars ?? 0,
    total_chars: artifact.totalChars,
    result_id: artifact.id,
    result_uri: artifact.uri,
    next_cursor: page?.next_cursor ?? null,
    truncated: true,
  });
}

export function toolErrorResult(
  error: string,
  details: Record<string, unknown> = {},
): CallToolResult {
  return {
    ...toolJsonResult({
      status: "failed",
      error,
      ...details,
    }),
    isError: true,
  };
}

export function readResultBudget(context: AppContext) {
  const budget = getSystemSettings(context.db).mcpResultBudget;
  return {
    firstResponseChars: budget.firstResponseChars,
    pageChars: budget.pageChars,
    hardResponseChars: budget.hardResponseChars,
  };
}

export function estimateChars(value: unknown): number {
  return typeof value === "string" ? value.length : toJsonText(value).length;
}

function encodeCursor(cursor: ResultPageCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): ResultPageCursor | null {
  if (!cursor) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const value = parsed as ResultPageCursor;
    if (value.kind === "array") {
      return isNonNegativeInteger(value.index) ? value : null;
    }
    if (value.kind === "item_text") {
      return isNonNegativeInteger(value.index) && isNonNegativeInteger(value.offset)
        ? value
        : null;
    }
    if (value.kind === "text") {
      return isNonNegativeInteger(value.offset) ? value : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function sliceText(text: string, offset: number, maxChars: number) {
  const start = Math.max(0, offset);
  const end = Math.min(text.length, start + maxChars);
  return {
    text: text.slice(start, end),
    returnedChars: end - start,
    nextCursor: end < text.length ? encodeCursor({ kind: "text", offset: end }) : null,
  };
}

function compactNestedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return { _type: "array", length: value.length };
  }
  if (value && typeof value === "object") {
    return { _type: "object", keys: Object.keys(value).slice(0, 20) };
  }
  return value;
}

function compactArrayItem(
  item: unknown,
  index: number,
  maxChars: number,
): unknown {
  const itemChars = estimateChars(item);
  if (item && typeof item === "object" && !Array.isArray(item)) {
    let stringLimit = Math.max(24, Math.floor(maxChars / 4));
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const preview: Record<string, unknown> = {
        _item_index: index,
        _item_truncated: true,
        _item_total_chars: itemChars,
      };
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === "string") {
          preview[key] = value.length > stringLimit
            ? `${value.slice(0, stringLimit)}... [truncated]`
            : value;
        } else {
          preview[key] = compactNestedValue(value);
        }
      }
      if (estimateChars(preview) <= maxChars || stringLimit <= 24) {
        return preview;
      }
      stringLimit = Math.max(24, Math.floor(stringLimit / 2));
    }
  }

  let previewChars = Math.max(0, maxChars - 220);
  const text = coerceTextContent(item);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const preview = {
      _item_index: index,
      _item_truncated: true,
      _item_total_chars: itemChars,
      _item_preview: text.slice(0, previewChars),
    };
    if (estimateChars(preview) <= maxChars || previewChars === 0) {
      return preview;
    }
    previewChars = Math.max(0, Math.floor(previewChars / 2));
  }
  return {
    _item_index: index,
    _item_truncated: true,
    _item_total_chars: itemChars,
  };
}

function sliceArray(items: unknown[], index: number, maxItems: number, maxChars: number) {
  const start = Math.max(0, index);
  const selected: unknown[] = [];
  let chars = 0;
  let currentIndex = start;
  for (; currentIndex < items.length; currentIndex += 1) {
    if (selected.length >= maxItems) {
      break;
    }
    const item = items[currentIndex];
    const itemChars = estimateChars(item);
    const remainingChars = Math.max(1, maxChars - chars);
    const selectedItem = itemChars > remainingChars
      ? compactArrayItem(item, currentIndex, remainingChars)
      : item;
    const selectedChars = estimateChars(selectedItem);
    if (selected.length > 0 && chars + selectedChars > maxChars) {
      break;
    }
    selected.push(selectedItem);
    chars += selectedChars;
    if (chars >= maxChars) {
      currentIndex += 1;
      break;
    }
  }
  const nextCursor = currentIndex < items.length
    ? encodeCursor({ kind: "array", index: currentIndex })
    : null;
  return { items: selected, returnedChars: chars, nextCursor };
}

function getArtifactItems(content: unknown): unknown[] | null {
  if (Array.isArray(content)) {
    return content;
  }
  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      return record.items;
    }
    if (Array.isArray(record.sources)) {
      return record.sources;
    }
    if (Array.isArray(record.data)) {
      return record.data;
    }
    if (Array.isArray(record.results)) {
      return record.results;
    }
  }
  return null;
}

function coerceTextContent(content: unknown): string {
  return typeof content === "string" ? content : toJsonText(content);
}

export function pageArtifact(
  artifact: ToolResultArtifactRecord,
  options: {
    cursor?: string;
    itemIndex?: number;
    maxItems: number;
    maxChars: number;
  },
): ResultPage | null {
  const cursor = decodeCursor(options.cursor);
  if (options.cursor && !cursor) {
    return null;
  }
  const maxChars = Math.max(1, options.maxChars);
  const maxItems = Math.max(1, options.maxItems);
  const items = getArtifactItems(artifact.content);
  if (items) {
    const selectedItemIndex = typeof options.itemIndex === "number"
      ? Math.trunc(options.itemIndex)
      : cursor?.kind === "item_text"
        ? cursor.index
        : undefined;
    if (typeof selectedItemIndex === "number") {
      if (selectedItemIndex < 0 || selectedItemIndex >= items.length) {
        return null;
      }
      if (cursor && (cursor.kind !== "item_text" || cursor.index !== selectedItemIndex)) {
        return null;
      }
      const offset = cursor?.kind === "item_text" ? cursor.offset ?? 0 : 0;
      const text = coerceTextContent(items[selectedItemIndex]);
      const page = sliceText(text, offset, maxChars);
      return {
        result_id: artifact.id,
        result_uri: artifact.uri,
        tool_name: artifact.toolName,
        kind: artifact.kind,
        title: artifact.title,
        summary: artifact.summary,
        item_index: selectedItemIndex,
        text: page.text,
        returned_items: null,
        total_items: artifact.totalItems ?? items.length,
        returned_chars: page.returnedChars,
        total_chars: estimateChars(items[selectedItemIndex]),
        next_cursor: page.nextCursor
          ? encodeCursor({ kind: "item_text", index: selectedItemIndex, offset: offset + page.returnedChars })
          : null,
        truncated: page.nextCursor !== null,
      };
    }
    if (cursor && cursor.kind !== "array") {
      return null;
    }
    const startIndex = cursor?.kind === "array" ? cursor.index ?? 0 : 0;
    const page = sliceArray(items, startIndex, maxItems, maxChars);
    return {
      result_id: artifact.id,
      result_uri: artifact.uri,
      tool_name: artifact.toolName,
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary,
      items: page.items,
      returned_items: page.items.length,
      total_items: artifact.totalItems ?? items.length,
      returned_chars: page.returnedChars,
      total_chars: artifact.totalChars,
      next_cursor: page.nextCursor,
      truncated: page.nextCursor !== null,
    };
  }
  if (cursor && cursor.kind !== "text") {
    return null;
  }
  const text = coerceTextContent(artifact.content);
  const offset = cursor?.kind === "text" ? cursor.offset ?? 0 : 0;
  const page = sliceText(text, offset, maxChars);
  return {
    result_id: artifact.id,
    result_uri: artifact.uri,
    tool_name: artifact.toolName,
    kind: artifact.kind,
    title: artifact.title,
    summary: artifact.summary,
    text: page.text,
    returned_items: null,
    total_items: artifact.totalItems,
    returned_chars: page.returnedChars,
    total_chars: artifact.totalChars,
    next_cursor: page.nextCursor,
    truncated: page.nextCursor !== null,
  };
}

export function saveArtifact(
  context: AppContext,
  payload: {
    toolName: string;
    kind: string;
    title?: string | null;
    summary?: Record<string, unknown>;
    content: unknown;
    totalItems?: number | null;
  },
): ToolResultArtifactRecord {
  return saveToolResultArtifact(context.db, {
    id: nanoid(),
    toolName: payload.toolName,
    kind: payload.kind,
    title: payload.title,
    summary: payload.summary,
    content: payload.content,
    totalItems: payload.totalItems,
    totalChars: estimateChars(payload.content),
  });
}

export function createArtifactHandle(
  artifact: ToolResultArtifactRecord,
  firstPage: ResultPage | null,
): ArtifactHandle {
  return {
    result_id: artifact.id,
    result_uri: artifact.uri,
    total_chars: artifact.totalChars,
    total_items: artifact.totalItems,
    next_cursor: firstPage?.next_cursor ?? null,
    truncated: Boolean(firstPage?.truncated),
  };
}

export function getResultPage(
  context: AppContext,
  input: {
    resultId: string;
    cursor?: string;
    itemIndex?: number;
    maxItems?: number;
    maxChars?: number;
  },
): ResultPage | null {
  const artifact = getToolResultArtifact(context.db, input.resultId);
  if (!artifact) {
    return null;
  }
  const budget = readResultBudget(context);
  const maxChars = Math.min(input.maxChars ?? budget.pageChars, budget.hardResponseChars);
  if (input.itemIndex !== undefined && input.itemIndex < 0) {
    return null;
  }
  return pageArtifact(artifact, {
    cursor: input.cursor,
    itemIndex: input.itemIndex,
    maxItems: input.maxItems ?? 20,
    maxChars,
  });
}

export function readArtifactResource(
  context: AppContext,
  uri: URL,
): ReadResourceResult {
  const resultId = parseToolResultUri(uri.toString());
  if (!resultId) {
    throw new Error("invalid_result_uri");
  }
  const artifact = getToolResultArtifact(context.db, resultId);
  if (!artifact) {
    throw new Error("result_not_found_or_expired");
  }
  const budget = readResultBudget(context);
  const firstPage = pageArtifact(artifact, {
    maxItems: 20,
    maxChars: budget.firstResponseChars,
  });
  return {
    contents: [
      {
        uri: artifact.uri,
        mimeType: "application/json",
        text: toJsonText({
          result_id: artifact.id,
          result_uri: artifact.uri,
          tool_name: artifact.toolName,
          kind: artifact.kind,
          title: artifact.title,
          summary: artifact.summary,
          total_items: artifact.totalItems,
          total_chars: artifact.totalChars,
          first_page: firstPage,
          next_cursor: firstPage?.next_cursor ?? null,
          read_with:
            "Call get_result_page with result_id and next_cursor for bounded pagination. For a truncated array item, call get_result_page with result_id and item_index.",
        }),
      },
    ],
  };
}

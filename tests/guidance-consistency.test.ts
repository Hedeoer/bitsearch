import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readRepositoryFile(...path: string[]): string {
  return readFileSync(join(repositoryRoot, ...path), "utf8");
}

test("Agent Skill and fallback prompt use the same planning escalation policy", () => {
  const skill = readRepositoryFile("skills", "bitsearch-research", "SKILL.md");
  const readme = readRepositoryFile("README.md");

  assert.match(skill, /For a simple single-lookup question, use the shortest correct retrieval path\./);
  assert.match(skill, /Upgrade to planning when the query is ambiguous, multi-hop/);
  assert.match(readme, /Fallback Companion Prompt \(for clients without Agent Skills\)/);
  assert.match(readme, /### Planning Engine escalation/);
  assert.match(readme, /For a simple single-lookup question, use the shortest correct retrieval path\./);
  assert.doesNotMatch(readme, /For any research, investigation, or multi-step question, you MUST use/);
});

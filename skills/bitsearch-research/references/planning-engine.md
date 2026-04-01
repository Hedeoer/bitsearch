# Planning Engine

Use the Planning Engine when the task is too complex for a single direct retrieval path.

## When to use it

Use Planning Engine first when one or more of these are true:

- The user request is ambiguous and needs intent clarification.
- The task must be broken into multiple sub-questions.
- Different sub-questions need different tools.
- Execution order matters, including parallel versus sequential work.
- The final answer depends on comparing evidence gathered across multiple rounds.

Do not use it for simple tasks such as reading one known URL, fetching one official page, or scraping a small known URL list with an obvious tool choice.

## Phase order

Run phases in this order and keep the same `session_id` throughout:

1. `plan_intent` - analyze the core question, query type, time sensitivity, ambiguities, and unverified terms
2. `plan_complexity` - assign complexity level 1, 2, or 3
3. `plan_sub_query` - add one sub-query at a time
4. `plan_search_term` - add search terms and fallback plans
5. `plan_tool_mapping` - map each sub-query to a BitSearch tool
6. `plan_execution` - define parallel groups and sequential order

## Complexity gating

- Level 1 requires phases 1-3 only.
- Level 2 requires phases 1-5.
- Level 3 requires all 6 phases.

Do not keep adding later phases if the assessed level does not require them.

## Execution handoff

When `plan_complete` is true, use the returned `executable_plan` as the retrieval blueprint:

- execute each sub-query with the mapped tool
- follow the planned search terms and params
- respect the parallel and sequential order if phase 6 was required

## Revision rules

- If a phase needs correction, send the revised phase with `is_revision: true`.
- Revisions replace the current phase record instead of appending to it.
- Keep the same `session_id` so the plan state stays coherent.

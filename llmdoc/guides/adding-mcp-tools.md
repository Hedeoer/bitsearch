# How to Add a New MCP Tool

A step-by-step guide for registering a new tool in the bitsearch MCP server.

1. **Define the tool in `src/server/mcp/register-tools.ts`:** Inside the `createMcpServer` function, call `server.registerTool()` with three arguments: tool name (string), metadata object containing `description` and `inputSchema` (Zod schema), and an async handler function. Place it near related tools (search, config, or planning group). See existing tools at lines 228-709 for patterns.

2. **Define the Zod input schema:** Use `z.object({...})` for the `inputSchema` field. All parameters the LLM client can pass must be declared here. Use `.optional().default(...)` for optional params. Validation constraints (`.min()`, `.max()`, `.url()`) are enforced by the MCP SDK before the handler runs.

3. **Implement the handler logic:** The handler receives validated params as its first argument. Use `AppContext` (captured in the `createMcpServer` closure) to access `context.db` and `context.bootstrap`. Return either `toolJsonResult({...})` for structured JSON or `{ content: [{ type: "text", text: "..." }] }` for plain text.

4. **Connect to backend services:** Import and call the appropriate service/repo functions. For provider-routed operations, use `runWithKeyPool` from `src/server/providers/fetch-router.ts`. For direct `search_engine` calls, use `requireSearchEngineConfig` to get credentials and `searchWithSearchEngine` / `listSearchEngineModels` to dispatch by the configured API format. For database access, use repo functions from `src/server/repos/`.

5. **Add request logging (if applicable):** Call `logSearchRequest()` (defined in `register-tools.ts:51-83`) with tool name, status, timing, and input/output metadata to ensure the tool's usage appears in the admin activity log.

6. **Verify:** Start the server with `npm run dev`. Use an MCP client (e.g., Claude Code configured with the bitsearch MCP endpoint) to call your new tool. Check the admin console activity log to confirm the request was logged. No separate registration step is needed -- the tool is available as soon as `createMcpServer` returns.

# `@openlearn/mcp`

The MCP adapter translates the approved OpenLearn application contract to the official Model Context Protocol TypeScript SDK.

The actor-bound server exposes only the tools allowed by the supplied scopes:

- `openlearn.create_plan_view`
- `openlearn.get_plan_view`
- `openlearn.apply_progress_action`

Boundary schemas are strict and reject caller-selected owner, credential, redirect, malformed identifier, unsupported action, and invalid version fields. Results contain the `openlearn.phase6.v1` structured envelope plus concise text content. Dashboard handoffs are supplied by the application’s controlled origin.

Each discovered tool declares its required OAuth scope in `securitySchemes` and mirrors the declaration in `_meta` for older MCP clients. The service layer publishes the protected-resource metadata document and handles HTTP bearer challenges; this package does not verify tokens.

The package provides official SDK factories for stdio and Streamable HTTP. It does not authenticate requests, access persistence, interpret prompts, or call a model provider; those responsibilities belong to service composition and future integrations.

Run its checks with:

```powershell
pnpm --filter @openlearn/mcp test
```

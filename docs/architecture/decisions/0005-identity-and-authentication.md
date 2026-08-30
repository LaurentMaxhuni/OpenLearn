# ADR-0005: Identity and authentication boundary

**Status:** Accepted

## Context

OpenLearn must associate a dashboard session and an external AI-client request with the same learner-owned plan without trusting a prompt, tool argument, or AI-provider identifier. The product brief requires a returning-user journey, but it does not require OpenLearn to own a particular identity provider. Remote MCP requests also need a transport-appropriate authorization model, while local stdio integrations have a different trust boundary.

## Decision

Use an OIDC-compatible identity boundary for browser sessions. The dashboard authentication adapter maps a verified identity to a minimal internal actor context. The domain identity key is the pair `(issuer, subject)`; email address, display name, AI-provider account, and raw external claims are not domain identifiers. Display information is optional presentation data and must not be required for ownership or authorization.

Use the MCP HTTP authorization profile based on OAuth 2.1-compatible practices for remote Streamable HTTP requests. The MCP service validates the access token before invoking any capability, checks that the token is intended for the MCP resource, and maps the resulting subject and scopes into the internal actor context. Tool permissions are plan- or workspace-scoped and separated by read, plan-write, and learner-progress-write capabilities. Exact scope strings and tool payloads are Phase 6 contract work.

For local stdio integrations, the client launches the server process and supplies credentials through the documented local environment. The local service does not expose an unauthenticated network listener; any local HTTP endpoint binds to loopback and still performs origin and authorization checks appropriate to its mode. Local credentials are never treated as production identity, and they are not committed to the repository.

The dashboard session and MCP actor must resolve to an internal ownership context before a plan read or mutation proceeds. A caller cannot select another learner by placing an identifier in the tool arguments. The authorization layer rejects missing, expired, audience-mismatched, or insufficiently scoped credentials before application commands run.

The first production path requires authenticated ownership. Anonymous links may be used for controlled local or preview fixtures only, with no access to production learner state. The identity-provider vendor, account registration flow, and exact session library remain deployment decisions behind this protocol boundary.

## Alternatives considered

### Anonymous or signed dashboard links

Signed links could make the first demo easy, but they make revocation, ownership, and remote AI-client delegation fragile. They remain useful as a tightly scoped preview fixture, not as the production ownership model.

### AI-provider identity

Using a ChatGPT, Claude, or other provider account as the learner identity would couple OpenLearn to one client and make a provider change a data-migration event. OpenLearn uses verified issuer and subject values instead.

### One shared application token

A shared token would authenticate the integration but could not express which learner or plan the request may access. It also makes revocation and audit attribution weak.

## Consequences

Positive consequences:

- Learner ownership is independent of the AI client used to reach OpenLearn.
- Browser and MCP requests can share a minimal actor and permission model.
- Access tokens and provider-specific claims stay at the adapter boundary.
- Authorization failures are handled before domain mutations.

Costs and constraints:

- The first usable hosted flow needs an OIDC/OAuth configuration and a setup path for test identities.
- The dashboard and MCP service need careful session, CORS, redirect, and resource-audience configuration.
- Local contributors need documented environment credentials for stdio tests.

## Revisit conditions

Revisit this decision if OpenLearn adds organizations or shared plans, if an embedded host needs delegated identity with a different trust model, or if a reviewed security design selects a different standards-based authorization boundary.

## References

- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

# ADR-0005: Identity and authentication boundary

**Status:** Accepted

## Context

OpenLearn must associate a dashboard session and an external AI-client request with the same learner-owned plan without trusting a prompt, tool argument, or AI-provider identifier. A dashboard OIDC session and a remote MCP access token can otherwise arrive from different identity systems; their `(issuer, subject)` pairs would then not identify the same principal. The product brief requires a returning-user journey, but it does not require OpenLearn to own a particular identity provider. Remote MCP requests also need a transport-appropriate authorization model, while local stdio integrations have a different trust boundary.

## Decision

Use an OIDC-compatible identity boundary for browser sessions. The authentication adapter maps a verified external principal to an internal `owner_id`; domain records reference that internal owner rather than storing a provider-specific account identifier as their ownership key. The external principal is identified by the pair `(issuer, subject)`; email address, display name, AI-provider account, and raw external claims are not domain identifiers. Display information is optional presentation data and must not be required for ownership or authorization.

Use the MCP HTTP authorization profile based on OAuth 2.1-compatible practices for remote Streamable HTTP requests. The MCP service validates the access token before invoking any capability, checks that the token is intended for the MCP resource, and maps the resulting subject and scopes into the internal actor context. Tool permissions are plan- or workspace-scoped and separated by read, plan-write, and learner-progress-write capabilities. Exact scope strings and tool payloads are Phase 6 contract work.

For the first hosted release, the dashboard OIDC session and the remote MCP authorization flow must use the same configured identity authority and canonical issuer. A learner who authorizes an MCP client signs in through that authority, so the verified `(issuer, subject)` from the MCP token resolves to the same internal `owner_id` as the dashboard session. Audience, client ID, and permitted scopes may differ between the browser and MCP flows; the issuer and subject used for ownership may not.

For local stdio integrations, the client launches the server process and supplies credentials through the documented local environment. The local service does not expose an unauthenticated network listener; any local HTTP endpoint binds to loopback and still performs origin and authorization checks appropriate to its mode. Local credentials are never treated as production identity, and they are not committed to the repository.

The dashboard session and MCP actor must resolve to the same internal `owner_id` before a plan read or mutation proceeds. A caller cannot select another learner by placing an identifier in the tool arguments. The authorization layer rejects missing, expired, audience-mismatched, insufficiently scoped, or wrong-issuer credentials before application commands run. A remote token from a different issuer is not matched by email, display name, AI-provider account, or subject value; owner-bound operations fail with an identity-authority-mismatch result until an explicit multi-authority linking design exists.

The first hosted release does not perform automatic account linking. If OpenLearn later needs to accept multiple identity authorities, an authenticated learner must start a deliberate linking flow from the dashboard, authorize the second principal, and confirm the association. The service then stores a unique, auditable, revocable mapping from the verified `(issuer, subject)` to the existing internal `owner_id`; matching email or provider metadata alone is never sufficient. Until that flow is implemented and reviewed, a different issuer is unsupported for learner-owned MCP operations.

The first production path requires authenticated ownership. Dashboard links are authenticated owner links, not anonymous share links. Anonymous links may be used for controlled local or preview fixtures only, with no access to production learner state. The identity-provider vendor, account registration flow, and exact session library remain deployment decisions behind this protocol boundary, but the selected deployment must provide one authority for both hosted ownership paths.

## Alternatives considered

### Anonymous or signed dashboard links

Signed links could make the first demo easy, but they make revocation, ownership, and remote AI-client delegation fragile. They remain useful as a tightly scoped preview fixture, not as the production ownership model.

### AI-provider identity

Using a ChatGPT, Claude, or other provider account as the learner identity would couple OpenLearn to one client and make a provider change a data-migration event. OpenLearn uses verified issuer and subject values instead.

### One shared application token

A shared token would authenticate the integration but could not express which learner or plan the request may access. It also makes revocation and audit attribution weak.

### Independent authorities with implicit matching

Accepting dashboard and MCP credentials from unrelated authorities and matching them by email, display name, or provider account would make ownership ambiguous and vulnerable to account collision. The first release requires one canonical authority instead. A future explicit linking flow is safer than an implicit cross-provider match.

## Consequences

Positive consequences:

- Learner ownership is independent of the AI client used to reach OpenLearn.
- Browser and MCP requests can share a minimal actor and permission model.
- Access tokens and provider-specific claims stay at the adapter boundary.
- Authorization failures are handled before domain mutations.

Costs and constraints:

- The first usable hosted flow needs an OIDC/OAuth configuration and a setup path for test identities.
- The dashboard and MCP service need careful session, CORS, redirect, and resource-audience configuration.
- The first hosted flow cannot combine unrelated dashboard and MCP issuers; a future multi-authority flow would add account-linking, confirmation, revocation, and audit work.
- Local contributors need documented environment credentials for stdio tests.

## Revisit conditions

Revisit this decision if OpenLearn adds organizations or shared plans, if an embedded host needs delegated identity with a different trust model, if a reviewed multi-authority account-linking flow is required, or if a reviewed security design selects a different standards-based authorization boundary.

## References

- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

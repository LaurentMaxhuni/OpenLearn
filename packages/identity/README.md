# `@openlearn/identity`

This package is the provider-neutral hosted identity boundary. It verifies
OIDC/OAuth JWTs against a configured issuer, audience, and JWKS; extracts only
the approved OpenLearn capability scopes; and resolves the verified
`(issuer, subject)` pair through an injected owner resolver. Raw tokens and
provider claims do not cross into the application package.

Dashboard sessions use a short-lived, signed, HttpOnly cookie and the same
canonical issuer/subject mapping. The package intentionally does not perform
implicit account linking. Provisioning and revoking a principal are explicit
operations on the persistence adapter.

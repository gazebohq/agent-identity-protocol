# Agent Identity Protocol (AIP)

**Version:** 0.1
**Status:** Published draft
**Steward:** Gazebo (gazebohq.com)  
**Canonical specification:** https://gazebohq.com/spec
**License:** Apache License 2.0  
**Attribution:** Agent Identity Protocol (AIP) · gazebohq.com

> **Reading edition.** The route-based MDX pages at [gazebohq.com/spec](https://gazebohq.com/spec) are the canonical, normative AIP v0.1 specification. This consolidated document is maintained as an editorial reference; when it differs from a canonical page, the canonical page controls.

---

## Why this exists

AI agents share credentials the way early web apps shared passwords. A developer hands an agent an API key with full permissions, and the agent does whatever the key allows — with no declared scope, no consent from the credential owner, no audit trail, and no revocation path short of rotating the key for every system using it.

The early web solved the equivalent problem twice:

- **OAuth** solved the "app wants your password" problem by introducing delegated, scoped access with an explicit consent moment
- **SSL/TLS** solved the "how do I know this site is who it claims" problem by establishing verifiable identity

Agents need both. This protocol defines the identity, consent, and enforcement layers for AI agents: a standard way to declare what an agent is, what it needs, how a user grants scoped access, and how that access is enforced — so that agents can be shared, installed, and trusted without handing over raw credentials.

---

## Scope of this specification

This document defines:

1. **Agent identity declaration** — how an agent describes itself and its required access
2. **Scope syntax** — how service permissions are expressed
3. **The consent token** — what gets issued after a user approves an agent
4. **Verification** — how anyone can check an agent's declared identity and current status
5. **Runtime enforcement** — access policy, audit logging, and credential-broker behaviour
6. **Compliance mappings** — reference mappings for the above controls

This document does not define:

- How credentials are stored or encrypted (implementation detail)
- How the consent UI is rendered (implementation detail)
- Consent-token encoding
- Cryptographic trust mechanisms for declarations and verification responses
- The transport binding used to retrieve credentials; HTTP and MCP examples are informative bindings

---

## 1. Agent Identity Declaration

An agent identity is a JSON document. It may be hosted at a URL, embedded in an agent config file, or registered with a compatible identity provider.

### Schema

```json
{
  "aip": "0.1",
  "id": "stripe-payment-monitor",
  "name": "Stripe Payment Monitor",
  "description": "Monitors Stripe for failed payments and files a GitHub issue.",
  "author": {
    "name": "Alice Chen",
    "url": "https://example.com/agents/alice"
  },
  "version": "1.0.0",
  "scope": [
    {
      "service": "stripe",
      "actions": ["payments:read", "charges:list"]
    },
    {
      "service": "github",
      "actions": ["issues:write"]
    }
  ],
  "install_url": "https://gazebohq.com/install/stripe-payment-monitor",
  "verify_url": "https://gazebohq.com/agents/verify/stripe-payment-monitor",
  "published_at": "2026-07-27T00:00:00Z"
}
```

### Fields

| Field | Required | Description |
|---|---|---|
| `aip` | yes | Protocol version. Must be `"0.1"` for this version. |
| `id` | yes | Unique slug. URL-safe, lowercase, hyphens only. |
| `name` | yes | Human-readable display name. |
| `description` | yes | Plain-language description of what the agent does. |
| `author` | yes | Object with `name` (string) and optional `url`. |
| `version` | yes | Semver string. Scope changes must bump the version. |
| `scope` | yes | Array of service permission objects (see section 2). |
| `install_url` | recommended | URL to the consent screen for this agent. |
| `verify_url` | recommended | URL to verify the agent's current status. |
| `published_at` | recommended | ISO 8601 timestamp of first publication. |

### Versioning rule

The declared `scope` is immutable per version. If an agent needs additional permissions, it must publish a new version. Consumers who installed a previous version must re-consent to the new scope — silent scope expansion is not permitted.

---

## 2. Scope Syntax

Scope is expressed as an array of service permission objects. Each object names a `service` and the `actions` the agent requires within that service.

### Format

```json
{
  "service": "<service-slug>",
  "actions": ["<resource>:<permission>", ...]
}
```

### Permission levels

| Permission | Meaning |
|---|---|
| `read` | Read/list access to the resource |
| `write` | Create or update the resource |
| `delete` | Delete the resource |
| `*` | All available permissions for the resource |

### Examples

```json
{ "service": "stripe", "actions": ["payments:read", "customers:read"] }
{ "service": "github", "actions": ["repos:read", "issues:write"] }
{ "service": "cloudflare", "actions": ["dns:*"] }
{ "service": "vercel", "actions": ["env:write"] }
```

### Principle of least privilege

Declared scope should reflect the minimum the agent requires for its stated task. Implementations may flag agents whose declared scope is significantly broader than their observed usage (see section 4).

---

## 3. The Consent Token

When a user approves an agent through a compatible consent flow, they receive a **consent token** — a bearer token scoped to exactly the services and actions they approved (which may be equal to or narrower than the agent's declared scope).

### Properties of a valid consent token

- Scoped to the approving user's connected services — never to the agent author's
- Issued by the identity provider (e.g. Gazebo), not by the agent author
- The agent author receives no visibility into the consumer's credentials or connected services
- Carries a unique install ID linking it to the published agent identity and version
- Compatible with MCP (`get_credential` tool call) and the AIP SDK

### Token structure (informational)

Implementations may use any token format. Gazebo uses opaque bearer tokens; the structure below is illustrative.

```
ag_{install_id}_{random}
```

The token resolves at the identity provider to:
- Installing user ID
- Published agent ID + version
- Approved scope (what the user actually granted)
- Issued at / expires at

### Revocation

A consent token must be revocable by the installing user at any time, independently of any other token. Revocation takes effect immediately — the agent cannot retrieve further credentials after revocation.

---

## 4. Verification

Any agent carrying an AIP identity can be verified at its `verify_url`. A compatible verification endpoint returns:

```json
{
  "id": "stripe-payment-monitor",
  "name": "Stripe Payment Monitor",
  "status": "active",
  "version": "1.0.0",
  "scope": [...],
  "author": { "name": "Alice Chen" },
  "install_count": 1847,
  "published_at": "2026-07-27T00:00:00Z",
  "last_verified_at": "2026-07-27T12:00:00Z"
}
```

### Status values

| Status | Meaning |
|---|---|
| `active` | Agent is published and accepting installs |
| `deprecated` | Agent is superseded by a newer version; existing installs still work |
| `revoked` | Agent has been removed by the author or the identity provider; installs are deactivated |

### The verification badge

An agent with a verified identity may display a badge linking to its `verify_url`. The badge indicates:

- The agent has a declared, version-locked scope
- The agent's identity is registered with a compatible provider
- The agent's current status is publicly verifiable

The badge does not guarantee the agent behaves as declared — it guarantees the declaration exists, is version-locked, and is verifiable. Behavioural trust accrues through install count and audit history.

---

## 5. Runtime Enforcement

The Runtime section defines the ongoing enforcement layer — what happens on every request an agent makes after a user has consented. Where Identity and Consent cover the declaration and the approval event, Runtime covers moment-to-moment operation: is this agent allowed to do this specific thing right now?

Three components:
1. **Access policy** — the rules that determine what an agent may do
2. **Audit log** — the immutable record of what the agent did
3. **Credential broker** — the mechanism by which the agent retrieves credentials at runtime

---

### 5.1 Access Policy

An access policy document is a machine-readable declaration of what a specific agent installation may do, including any approval rules that gate specific operations.

#### Schema

```json
{
  "$schema": "https://schema.gazebohq.com/v0.1/policy.json",
  "aip": "0.1",
  "agent_id": "stripe-payment-monitor",
  "install_id": "...",
  "version": "1.0.0",
  "policy": [
    {
      "service": "stripe",
      "actions": ["payments:read", "charges:list"],
      "requires_approval": false
    },
    {
      "service": "github",
      "actions": ["issues:write"],
      "requires_approval": false
    }
  ],
  "approval_rules": [
    {
      "service": "stripe",
      "actions": ["charges:create"],
      "threshold": { "amount_usd": 100 },
      "requires_approval": true
    }
  ]
}
```

#### Fields

| Field | Required | Description |
|---|---|---|
| `$schema` | yes | JSON Schema URL for validation. Use the canonical `https://schema.gazebohq.com/v0.1/policy.json` URL by default. A validator may accept an explicitly trusted, content-equivalent mirror that preserves the canonical schema `$id`; arbitrary schema URLs are not conforming. Required in every conforming document. |
| `aip` | yes | Protocol version. Must match the agent identity declaration. |
| `agent_id` | yes | Must match the `id` in the agent's identity declaration. |
| `install_id` | yes | Unique identifier for this specific installation — links the policy to the consent token. |
| `version` | yes | Must match the agent version that was consented to. |
| `policy` | yes | Array of service permission objects. Must be equal to or narrower than the declared scope. |
| `approval_rules` | no | Array of conditional approval rules. Actions listed here require human approval before execution. |

#### Policy narrowing

A policy document may grant a subset of the agent's declared scope. It may never grant more than the declared scope — this is enforced by the identity provider at install time. The installing user may narrow scope further at consent time; the policy document reflects the scope actually granted, not the scope declared.

#### Approval rules

Approval rules gate specific operations behind human confirmation. They are evaluated at the broker layer before credential release. A rule specifies:

- `service` and `actions` — which operations are gated
- `threshold` (optional) — exactly one condition that triggers the gate
- `requires_approval: true` — the broker must hold the request and notify the approver before proceeding

If `threshold` is omitted, the rule applies to every matching operation. A v0.1
threshold object must contain exactly one of:

| Field | Type | Meaning |
|---|---|---|
| `amount_usd` | non-negative number | Apply the rule when the operation's USD amount is at least this value. |
| `record_count` | non-negative integer | Apply the rule when the operation affects at least this many records. |

Unknown threshold fields and threshold objects containing both fields are not
conforming in v0.1.

---

### 5.2 Audit Log

A conforming implementation must produce an audit log entry for every credential retrieval and every gated operation. The audit log is the primary mechanism for accountability and compliance verification.

#### Minimum fields

```json
{
  "$schema": "https://schema.gazebohq.com/v0.1/audit-log.json",
  "log_version": "1.0",
  "event_id": "evt_01j9xkq3m4...",
  "timestamp": "2026-08-10T09:14:02Z",
  "agent_id": "stripe-payment-monitor",
  "install_id": "...",
  "service": "stripe",
  "operation": "POST /v1/charges",
  "authorization_basis": "policy:stripe:charges:create",
  "outcome": "approved",
  "approval_required": false
}
```

#### Fields

| Field | Required | Description |
|---|---|---|
| `$schema` | yes | JSON Schema URL for validation. Use the canonical `https://schema.gazebohq.com/v0.1/audit-log.json` URL by default. A validator may accept an explicitly trusted, content-equivalent mirror that preserves the canonical schema `$id`; arbitrary schema URLs are not conforming. Required in every conforming audit log entry. |
| `log_version` | yes | Audit log schema version. |
| `event_id` | yes | Unique identifier for this log entry. Immutable after write. |
| `timestamp` | yes | ISO 8601 timestamp of the event. |
| `agent_id` | yes | The agent that made the request. |
| `install_id` | yes | The specific installation — links the event to a consent token and user. |
| `service` | yes | The service the agent attempted to access. |
| `operation` | yes | The specific operation attempted (e.g. HTTP method + path, or named action). |
| `authorization_basis` | yes | The policy rule that authorised or denied the operation. |
| `outcome` | yes | One of `approved`, `denied`, or `pending_approval`. |
| `approval_required` | yes | Whether the operation triggered an approval rule. |

#### Immutability

Audit log entries must not be modified after write. Implementations should use append-only storage or a write-once mechanism. Log entries are evidence — retroactive modification voids their compliance value.

#### Retention

Implementations should retain audit logs for a minimum of 90 days. Compliance-oriented deployments (SOC 2, HIPAA) typically require 12 months. Retention policy is implementation-defined; the spec defines the minimum fields, not the storage mechanism.

---

### 5.3 Credential Broker Protocol

The credential broker is the runtime component that sits between the agent and its underlying credentials. On every request it:

1. Validates the agent's consent token
2. Checks the request against the active policy
3. Evaluates any applicable approval rules
4. Returns a scoped credential, a denial error, or a pending-approval response

#### Token exchange endpoint

The agent presents its install token. The broker validates it and returns a scoped credential for the requested service and action.

```
POST /broker/credential
Authorization: Bearer {install_token}

{
  "service": "stripe",
  "action": "charges:list"
}
```

Response:

```json
{
  "credential": "...",
  "expires_at": "2026-08-10T10:14:02Z",
  "scope": "stripe:charges:list"
}
```

#### Policy check on every request

The policy is evaluated at request time, not at install time. A policy change — reduced scope, new approval rule, revocation — takes effect immediately on the next request. The broker must not cache policy state for the lifetime of the install token.

#### Revocation propagation

When a user revokes consent, the broker must refuse all subsequent credential requests for that install ID immediately. There is no grace period. Token expiry is irrelevant — a revoked install ID is refused regardless of whether the install token would otherwise still be valid.

#### MCP compatibility

The broker must accept `get_credential` tool calls in the MCP tool call format, in addition to the HTTP endpoint above. This allows agents operating within an MCP tool layer to retrieve credentials without a separate SDK integration.

```json
{
  "tool": "get_credential",
  "arguments": {
    "service": "stripe",
    "action": "charges:list"
  }
}
```

---

### 5.4 Compliance Mappings

AIP Runtime is designed to satisfy the technical safeguard requirements of common security frameworks. The mappings below indicate which spec behaviours satisfy which criteria.

These are reference mappings only. A conforming AIP implementation meets the *technical* requirements; achieving certification requires organisational controls outside the scope of this specification.

#### SOC 2

| Criterion | AIP Runtime mechanism |
|---|---|
| CC6.1 — Logical access controls | Policy document (§5.1) restricts agent access to declared, consented scope |
| CC6.2 — Access provisioned appropriately | Versioning rule (§1) requires re-consent for any scope expansion |
| CC6.3 — Access removal | Instant revocation via broker (§5.3); install ID refused on next request |
| CC7.2 — Monitoring for security events | Audit log (§5.2) records every credential retrieval and gated operation |
| CC9.2 — Vendor and partner risk management | Agent identity declaration (§1) provides verifiable scope declaration for third-party agents |

#### HIPAA

| Technical Safeguard | AIP Runtime mechanism |
|---|---|
| §164.312(a)(1) — Access control | Policy document enforces minimum necessary access per agent installation |
| §164.312(b) — Audit controls | Audit log (§5.2) records access events with required minimum fields |
| §164.312(c)(1) — Integrity | Audit log immutability — append-only, no retroactive modification |
| §164.312(d) — Authentication | Consent token + install ID authenticate the agent on every broker request |
| §164.312(e)(2)(ii) — Encryption in transit | Credential transport must use TLS 1.2 or higher; implementation-defined for storage |

---

## 6. Implementing AIP Compatibility

### For identity providers (like Gazebo)

To be AIP-compatible, an identity provider must:

- Accept agent identity declarations and assign them a stable ID
- Host a public consent screen at a stable URL that displays the declared scope
- Issue consent tokens scoped to the approving user's services (not the author's)
- Host a verification endpoint returning the schema in section 4
- Enforce the versioning rule: scope changes require a new version and re-consent

### For agent marketplaces and directories

To link to AIP-compatible agents:

- Use the agent's `install_url` as the install action rather than raw agent config links
- Display the agent's declared `scope` before the user clicks install
- Link to the agent's `verify_url` for status checking

### For agent builders

To publish an AIP-compatible agent:

1. Write the identity declaration (JSON, as above)
2. Register it with a compatible identity provider to get an `install_url` and `verify_url`
3. Embed the `install_url` in your agent's README, config, or marketplace listing
4. When you need to expand scope, publish a new version — do not edit the existing declaration

### Attribution

Any implementation, tool, or documentation that conforms to or references AIP should credit it using the canonical attribution string:

```
Agent Identity Protocol (AIP) · gazebohq.com
```

Rules:
- Use this exact string — do not abbreviate to "AIP" alone on first mention
- When hyperlinked, link to `https://gazebohq.com/spec`
- Include it in your README and any documentation page that describes AIP compatibility
- The `$schema` field in conforming JSON documents carries attribution automatically — no additional string is needed inside the document itself

---

## 7. Relationship to existing standards

**OAuth 2.0 (RFC 6749):** AIP addresses a different problem layer. OAuth defines how a *human user* delegates access to an *application*. AIP defines how an *agent* declares its identity and how a *human user* consents to that agent accessing their services. The mechanisms are analogous; the principal types differ.

**MCP (Model Context Protocol):** AIP is credential-layer infrastructure that sits above MCP. MCP defines how agents call tools (including `get_credential`). AIP defines the identity and consent that determines what a `get_credential` call is authorised to return.

**SPIFFE/SVID:** SPIFFE addresses workload identity in infrastructure (service-to-service). AIP addresses agent identity at the human-trust layer (user-to-agent consent). They operate at different layers and can coexist.

---

## Appendix: Gazebo reference implementation

Gazebo (gazebohq.com) is the reference implementation of AIP. Features available in the Gazebo implementation:

- Agent identity registration and versioning
- Hosted consent screen at `gazebohq.com/install/:slug`
- Consent token issuance (MCP-compatible and SDK-compatible)
- Verification endpoint at `gazebohq.com/agents/verify/:id`
- Audit logging per install
- Instant revocation from the Gazebo dashboard
- SDK: `pip install gazebo` / `npm install @gazebo/agent`

The Gazebo implementation is the reference; other providers may implement AIP independently. The protocol is not proprietary.

---

---

## Citation

Plain text:
```
Agent Identity Protocol (AIP), v0.1. Gazebo, August 2026.
https://gazebohq.com/spec
```

BibTeX:
```bibtex
@misc{aip2026,
  title  = {Agent Identity Protocol (AIP), v0.1},
  author = {Gazebo},
  year   = {2026},
  url    = {https://gazebohq.com/spec}
}
```

---

*Agent Identity Protocol (AIP) © Gazebo. Licensed under the Apache License, Version 2.0. Canonical specification: https://gazebohq.com/spec*  
*Contributions, feedback, and compatible implementations are welcome — spec@gazebohq.com*

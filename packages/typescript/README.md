# `@gazebohq/agent-identity-protocol`

Portable TypeScript validators for [Agent Identity Protocol (AIP) v0.1](https://gazebohq.com/spec).

This package validates identity declarations, access policies, and audit-log
entries without requiring a Gazebo account or network access. It also checks
policy narrowing against an identity declaration and enforces canonical AIP
schema references unless an explicitly trusted equivalent mirror is configured.

## Install

```bash
npm install @gazebohq/agent-identity-protocol
```

## Usage

```ts
import {
  validateIdentity,
  validatePolicy,
  validateAuditLog,
  validatePolicyAgainstIdentity,
} from "@gazebohq/agent-identity-protocol";

const identityResult = validateIdentity(identityDocument);

if (!identityResult.valid) {
  console.error(identityResult.errors);
}

const policyResult = validatePolicyAgainstIdentity(
  policyDocument,
  identityDocument,
);
```

Validation is local and synchronous. The package does not fetch `$schema`
references. A non-canonical schema URL is accepted only when it is explicitly
listed in `trustedMirrors`.

```ts
validateIdentity(document, {
  trustedMirrors: {
    identity: ["https://mirror.example.test/aip/identity.json"],
  },
});
```

The JSON Schemas are also available as package exports:

```ts
import identitySchema from
  "@gazebohq/agent-identity-protocol/schemas/identity.json" with { type: "json" };
```

## Scope

This is the portable AIP validator. It is intentionally separate from Gazebo
runtime SDKs and MCP transport. For the normative specification, see
https://gazebohq.com/spec.

Agent Identity Protocol (AIP) · gazebohq.com

## License

Apache-2.0
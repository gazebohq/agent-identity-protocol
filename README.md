# Agent Identity Protocol (AIP)

A portable standard for declaring agent identity, expressing access policy, recording audit events, and implementing consent-aware runtime enforcement.

## Status

AIP v0.1 is a published draft stewarded by Gazebo.

- Canonical specification: https://gazebohq.com/spec
- Canonical schema host: https://schema.gazebohq.com/v0.1/
- License: Apache-2.0
- Attribution: Agent Identity Protocol (AIP) · gazebohq.com

## What AIP defines

AIP has three independently adoptable sections:

1. Identity — a machine-readable declaration of what an agent is and what it needs.
2. Consent — the user approval and delegation boundary for agent access.
3. Runtime — policy enforcement, audit logging, and credential-broker behavior.

The v0.1 machine-readable contract includes three JSON Schemas:

| Document | Canonical schema |
| --- | --- |
| Agent identity | https://schema.gazebohq.com/v0.1/identity.json |
| Access policy | https://schema.gazebohq.com/v0.1/policy.json |
| Audit log entry | https://schema.gazebohq.com/v0.1/audit-log.json |

Consent-token and broker-request encodings remain implementation-defined in v0.1.

## Packages

The npm and PyPI packages are planned for the AIP v0.1 release but are not published yet. Until an official registry release is announced, use the validators directly from this repository.

Planned package names:

- npm: @gazebohq/agent-identity-protocol
- PyPI: gazebo-agent-identity-protocol

Do not install similarly named third-party packages as substitutes.

## Repository layout

- spec/ — consolidated reading edition and canonical MDX page sources
- schemas/ — the three canonical v0.1 JSON Schemas
- fixtures/ — valid and invalid conformance fixtures
- packages/typescript/ — TypeScript validator package
- packages/python/ — Python validator package
- CONFORMANCE.md — clean-clone validation instructions

## Relationship to Gazebo

AIP is an open, portable standard. Gazebo is one implementation and steward of the published draft; validators do not require Gazebo access.

## Contributing

Read the canonical specification first, then open an issue or pull request with the proposed change and its compatibility impact. Changes to canonical schema URLs or existing document shapes require explicit versioning discussion.

## License

Apache License 2.0. See LICENSE.
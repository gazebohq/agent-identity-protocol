# Changelog

All notable changes to the Agent Identity Protocol and its reference validator packages are documented here.

## [0.1.0] - 2026-09-02

### Added

- Published the AIP v0.1 draft as a portable standard with Identity, Consent, and Runtime sections.
- Added canonical JSON Schemas for Identity, Policy, and Audit Log documents.
- Added shared valid and invalid conformance fixtures.
- Added TypeScript and Python validator implementations.
- Added explicit semantic validation for policy narrowing, wildcard actions, trusted schema mirrors, timestamps, and approval rules.
- Published canonical schema URLs under `https://schema.gazebohq.com/v0.1/`.
- Added GitHub Actions checks for both validator implementations.
- Added an end-to-end Stripe payment monitor example.

### Deferred by design

- Consent-token and broker-request schemas remain implementation-defined until their encoding and transport are standardized.
- A merged full-stack schema is not part of v0.1; Identity, Policy, and Audit Log remain separate contracts.

AIP v0.1 is a published draft. Feedback and independent implementations are welcome.
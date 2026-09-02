# Contributing to AIP

Thanks for helping make agent identity and access controls portable.

The Agent Identity Protocol (AIP) is one open standard with three independently adoptable sections: Identity, Consent, and Runtime. Contributions should keep the contracts clear, implementation-neutral, and useful across agent frameworks and providers.

## Before opening an issue or pull request

1. Read the published specification at <https://gazebohq.com/spec>.
2. Check existing issues and pull requests for related discussion.
3. For schema or validator changes, explain the compatibility impact and include a concrete document example.
4. Keep changes scoped to one concern whenever possible.

## Local checks

From the repository root:

```bash
pnpm install
pnpm --dir packages/typescript run build
pnpm --dir packages/typescript run test

python -m pip install -e packages/python pytest
python -m pytest packages/python/test
```

## Schema and fixture changes

The canonical schemas live in `schemas/`. Shared conformance fixtures live in `fixtures/` and are used by both validator implementations.

When changing a schema or semantic rule:

- Update the relevant schema and both validator implementations when needed.
- Add or update valid and invalid fixtures that demonstrate the behavior.
- Keep the canonical `$schema` URLs unchanged unless the protocol version changes.
- Run both conformance suites before submitting the pull request.
- Do not introduce a merged full-stack schema in place of the separate Identity, Policy, and Audit Log contracts.

Consent-token and broker-request schemas are intentionally deferred because their encoding and transport remain implementation-defined.

## Pull requests

A good pull request includes:

- A concise description of the problem and proposed behavior.
- The relevant specification, schema, fixture, or validator changes.
- Tests for changed behavior.
- Notes about compatibility, if applicable.

Please do not include credentials, private customer data, or provider secrets in issues, fixtures, or pull requests.

## Reporting security issues

Please do not open a public issue for a suspected security vulnerability. Contact the Gazebo maintainers privately with enough detail to reproduce the problem. Do not include live tokens or credentials in the report.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
# Conformance

This repository contains the shared AIP v0.1 fixtures and language-specific validators. A conforming implementation should accept every valid fixture, reject every invalid fixture, and enforce the policy-within-identity relationship rules.

## TypeScript

From the repository root:

    pnpm install
    pnpm --dir packages/typescript build
    pnpm --dir packages/typescript test

The TypeScript runner performs JSON Schema validation with AJV and semantic validation with the package validators.

## Python

From the repository root:

    python -m venv .venv
    . .venv/bin/activate
    python -m pip install -e packages/python pytest
    python -m pytest packages/python/test

The Python tests use the same shared schema and fixture contract as the TypeScript implementation.

## Portable validation contract

Structural JSON Schema validation and semantic validation are separate layers. Implementations may use different libraries, but they must preserve the public behavior described by the specification and fixtures.

A validator may accept an explicitly trusted, content-equivalent mirror that preserves the canonical schema $id. Arbitrary schema URLs are not conforming.
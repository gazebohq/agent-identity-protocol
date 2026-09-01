# `gazebo-agent-identity-protocol`

Portable Python validators for [Agent Identity Protocol (AIP) v0.1](https://gazebohq.com/spec).

This package validates identity declarations, access policies, and audit-log
entries without requiring a Gazebo account or network access. It also checks
policy narrowing against an identity declaration and enforces canonical AIP
schema references unless an explicitly trusted equivalent mirror is configured.

## Install

```bash
pip install gazebo-agent-identity-protocol
```

## Usage

```python
from gazebo_agent_identity_protocol import (
    validate_identity,
    validate_policy,
    validate_audit_log,
    validate_policy_against_identity,
)

identity_result = validate_identity(identity_document)

if not identity_result.valid:
    print(identity_result.errors)

policy_result = validate_policy_against_identity(
    policy_document,
    identity_document,
)
```

Validation is local and synchronous. The package does not fetch `$schema`
references. A non-canonical schema URL is accepted only when it is explicitly
listed in `ValidationOptions.trusted_mirrors`.

```python
from gazebo_agent_identity_protocol import ValidationOptions, validate_identity

validate_identity(
    document,
    ValidationOptions(
        trusted_mirrors={
            "identity": ["https://mirror.example.test/aip/identity.json"],
        }
    ),
)
```

The package is the portable AIP validator and is intentionally separate from
Gazebo runtime SDKs and MCP transport. For the normative specification, see
https://gazebohq.com/spec.

Agent Identity Protocol (AIP) · gazebohq.com

## License

Apache-2.0
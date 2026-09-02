# Stripe payment monitor example

This example shows one agent described with three separate AIP v0.1 documents:

- `identity.json` declares who the agent is and the actions it may need.
- `policy.json` narrows the active permissions for one installation and adds an approval rule.
- `audit-log.json` records an operation and its authorization basis.

The policy is narrower than the identity declaration: the agent may request `charges:create`, but this installation only grants read actions. The audit event records an approved charge-list operation after the applicable approval decision.

Validate the repository fixtures and validator behavior with the commands in [`CONFORMANCE.md`](../../CONFORMANCE.md).
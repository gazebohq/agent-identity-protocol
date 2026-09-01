import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  SCHEMA_URLS,
  validateAuditLog,
  validateIdentity,
  validatePolicy,
  validatePolicyAgainstIdentity,
} from "../src/index.js";

const identity = {
  $schema: SCHEMA_URLS.identity,
  aip: "0.1",
  id: "stripe-payment-monitor",
  name: "Stripe Payment Monitor",
  description: "Monitors Stripe for failed payments and files a GitHub issue.",
  author: {
    name: "Alice Chen",
    url: "https://example.com/agents/alice",
  },
  version: "1.0.0",
  scope: [
    {
      service: "stripe",
      actions: ["payments:read", "charges:list", "charges:create"],
    },
    {
      service: "github",
      actions: ["issues:write"],
    },
  ],
  install_url: "https://gazebohq.com/install/stripe-payment-monitor",
  verify_url: "https://gazebohq.com/agents/verify/stripe-payment-monitor",
  published_at: "2026-07-27T00:00:00Z",
} as const;

const policy = {
  $schema: SCHEMA_URLS.policy,
  aip: "0.1",
  agent_id: "stripe-payment-monitor",
  install_id: "install_123",
  version: "1.0.0",
  policy: [
    {
      service: "stripe",
      actions: ["payments:read", "charges:list"],
    },
  ],
  approval_rules: [
    {
      service: "stripe",
      actions: ["charges:list"],
      threshold: { record_count: 100 },
      requires_approval: true,
    },
  ],
} as const;

const auditLog = {
  $schema: SCHEMA_URLS.auditLog,
  log_version: "1.0",
  event_id: "evt_01j9xkq3m4",
  timestamp: "2026-08-10T09:14:02Z",
  agent_id: "stripe-payment-monitor",
  install_id: "install_123",
  service: "stripe",
  operation: "POST /v1/charges",
  authorization_basis: "policy:stripe:charges:create",
  outcome: "approved",
  approval_required: false,
} as const;

assert.equal(validateIdentity(identity).valid, true);
assert.equal(validatePolicy(policy).valid, true);
assert.equal(validateAuditLog(auditLog).valid, true);
assert.equal(validatePolicyAgainstIdentity(policy, identity).valid, true);
const identityMirror = "https://schemas.example.org/aip/v0.1/identity.json";
assert.equal(
  validateIdentity({ ...identity, $schema: identityMirror }).valid,
  false,
);
assert.equal(
  validateIdentity(
    { ...identity, $schema: identityMirror },
    { trustedMirrors: { identity: [identityMirror] } },
  ).valid,
  true,
);
const policyMirror = "https://schemas.example.org/aip/v0.1/policy.json";
assert.equal(
  validatePolicy(
    { ...policy, $schema: policyMirror },
    { trustedMirrors: { policy: [policyMirror] } },
  ).valid,
  true,
);
const auditLogMirror = "https://schemas.example.org/aip/v0.1/audit-log.json";
assert.equal(
  validateAuditLog(
    { ...auditLog, $schema: auditLogMirror },
    { trustedMirrors: { auditLog: [auditLogMirror] } },
  ).valid,
  true,
);
assert.equal(
  validatePolicyAgainstIdentity(
    { ...policy, $schema: policyMirror },
    { ...identity, $schema: identityMirror },
    {
      trustedMirrors: {
        identity: [identityMirror],
        policy: [policyMirror],
      },
    },
  ).valid,
  true,
);
assert.equal(
  validateIdentity({
    ...identity,
    published_at: "2026-07-27T00:00:00+10:00",
  }).valid,
  true,
);
assert.equal(
  validateAuditLog({
    ...auditLog,
    timestamp: "2026-08-10T09:14:02+00:00",
  }).valid,
  false,
);

const invalidIdentity = {
  ...identity,
  scope: [
    ...identity.scope,
    {
      service: "stripe",
      actions: ["customers:read"],
    },
  ],
};
assert.equal(validateIdentity(invalidIdentity).valid, false);

const invalidPolicy = {
  ...policy,
  approval_rules: [
    {
      service: "stripe",
      actions: ["customers:delete"],
      requires_approval: true,
    },
  ],
};
assert.equal(validatePolicy(invalidPolicy).valid, false);

const wildcardPolicy = {
  ...policy,
  policy: [
    {
      service: "stripe",
      actions: ["charges:*"],
    },
  ],
  approval_rules: [
    {
      service: "stripe",
      actions: ["charges:create"],
      requires_approval: true,
    },
  ],
};
assert.equal(validatePolicy(wildcardPolicy).valid, true);

const broadenedPolicy = {
  ...policy,
  policy: [
    {
      service: "stripe",
      actions: ["customers:read"],
    },
  ],
};
assert.equal(validatePolicyAgainstIdentity(broadenedPolicy, identity).valid, false);

assert.equal(
  validateAuditLog({ ...auditLog, outcome: "queued" }).valid,
  false,
);

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesRoot = resolve(packageRoot, "..", "..", "fixtures");

const schemaDocuments = Object.fromEntries(
  await Promise.all(
    [
      ["identity", "identity.json"],
      ["policy", "policy.json"],
      ["audit-log", "audit-log.json"],
    ].map(async ([kind, file]) => [
      kind,
      JSON.parse(
        await readFile(resolve(packageRoot, "schemas", file), "utf8"),
      ) as object,
    ]),
  ),
) as Record<"identity" | "policy" | "audit-log", object>;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const jsonSchemaValidators = {
  identity: ajv.compile(schemaDocuments.identity),
  policy: ajv.compile(schemaDocuments.policy),
  "audit-log": ajv.compile(schemaDocuments["audit-log"]),
};

const fixtureManifest = JSON.parse(
  await readFile(resolve(fixturesRoot, "manifest.json"), "utf8"),
) as Array<{
  name: string;
  type: "identity" | "policy" | "audit-log" | "policy-against-identity";
  valid: boolean;
  schemaValid: boolean;
  file: string;
}>;

for (const fixture of fixtureManifest) {
  const input = JSON.parse(
    await readFile(resolve(fixturesRoot, fixture.file), "utf8"),
  ) as unknown;
  const result =
    fixture.type === "identity"
      ? validateIdentity(input)
      : fixture.type === "policy"
        ? validatePolicy(input)
        : fixture.type === "audit-log"
          ? validateAuditLog(input)
          : validatePolicyAgainstIdentity(
              (input as { policy: unknown }).policy,
              (input as { identity: unknown }).identity,
            );
  const schemaValid =
    fixture.type === "policy-against-identity"
      ? jsonSchemaValidators.identity(
          (input as { identity: unknown }).identity,
        ) &&
        jsonSchemaValidators.policy((input as { policy: unknown }).policy)
      : jsonSchemaValidators[fixture.type](input);

  assert.equal(
    schemaValid,
    fixture.schemaValid,
    `${fixture.name} expected JSON Schema valid=${fixture.schemaValid}`,
  );
  assert.equal(
    result.valid,
    fixture.valid,
    `${fixture.name} expected valid=${fixture.valid}`,
  );
}

for (const [file, id] of [
  ["identity.json", SCHEMA_URLS.identity],
  ["policy.json", SCHEMA_URLS.policy],
  ["audit-log.json", SCHEMA_URLS.auditLog],
] as const) {
  const schema = JSON.parse(
    await readFile(resolve(packageRoot, "schemas", file), "utf8"),
  ) as { $id?: string; required?: string[] };
  assert.equal(schema.$id, id);
  assert.ok(schema.required?.includes("$schema"));
}

console.log("AIP v0.1 conformance checks passed.");
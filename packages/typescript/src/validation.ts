import { z } from "zod";

import {
  AIP_VERSION,
  AUDIT_LOG_VERSION,
  SCHEMA_URLS,
} from "./constants.js";
import type {
  AccessPolicy,
  AgentIdentity,
  AuditLogEntry,
} from "./types.js";

export type SchemaKind = keyof typeof SCHEMA_URLS;

export interface ValidationOptions {
  /**
   * Explicitly trusted, content-equivalent mirror URLs. The validator does
   * not fetch or compare mirrors; the caller must verify equivalence before
   * adding a URL here.
   */
  trustedMirrors?: Partial<Record<SchemaKind, readonly string[]>>;
}

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9-]*$/, "must be a lowercase ASCII identifier");

const action = z
  .string()
  .regex(
    /^[a-z][a-z0-9-]*:(?:[a-z][a-z0-9-]*|\*)$/,
    "must use resource:action syntax; * is allowed only as the action",
  );

const semver = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
    "must be a semantic version",
  );

const isoTimestamp = z.string().datetime({
  offset: true,
});

const utcTimestamp = z.string().datetime({
  message: "must be an ISO 8601 timestamp with a UTC Z suffix",
});

const url = z.string().url();

const scopeItem = z
  .object({
    service: identifier,
    actions: z.array(action).min(1),
  })
  .strict();

const uniqueScope = (items: Array<{ service: string; actions: string[] }>, path: (string | number)[], ctx: z.RefinementCtx) => {
  const services = new Set<string>();

  for (const [index, item] of items.entries()) {
    if (services.has(item.service)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, index, "service"],
        message: `service "${item.service}" must appear only once`,
      });
    }
    services.add(item.service);

    const actions = new Set<string>();
    for (const [actionIndex, itemAction] of item.actions.entries()) {
      if (actions.has(itemAction)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, index, "actions", actionIndex],
          message: `action "${itemAction}" must appear only once`,
        });
      }
      actions.add(itemAction);
    }
  }
};

const scope = z.array(scopeItem).min(1).superRefine((items, ctx) => {
  uniqueScope(items, [], ctx);
});

const author = z
  .object({
    name: z.string().trim().min(1).max(256),
    url,
  })
  .strict()
  .or(
    z
      .object({
        name: z.string().trim().min(1).max(256),
      })
      .strict(),
  );

export const identitySchema = z
  .object({
    $schema: url,
    aip: z.literal(AIP_VERSION),
    id: identifier,
    name: z.string().trim().min(1).max(256),
    description: z.string().trim().min(1).max(2000),
    author,
    version: semver,
    scope,
    install_url: url.optional(),
    verify_url: url.optional(),
    published_at: isoTimestamp.optional(),
  })
  .strict();

const threshold = z
  .object({
    amount_usd: z.number().finite().nonnegative().optional(),
    record_count: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (value) =>
      Number(value.amount_usd !== undefined) +
        Number(value.record_count !== undefined) ===
      1,
    "threshold must contain exactly one of amount_usd or record_count",
  );

const approvalRule = z
  .object({
    service: identifier,
    actions: z.array(action).min(1),
    threshold: threshold.optional(),
    requires_approval: z.literal(true),
  })
  .strict()
  .superRefine((rule, ctx) => {
    const actions = new Set<string>();
    for (const [index, itemAction] of rule.actions.entries()) {
      if (actions.has(itemAction)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["actions", index],
          message: `action "${itemAction}" must appear only once`,
        });
      }
      actions.add(itemAction);
    }
  });

export const policySchema = z
  .object({
    $schema: url,
    aip: z.literal(AIP_VERSION),
    agent_id: identifier,
    install_id: z.string().trim().min(1).max(256),
    version: semver,
    policy: scope,
    approval_rules: z.array(approvalRule).optional(),
  })
  .strict()
  .superRefine((document, ctx) => {
    const allowed = new Map(
      document.policy.map((item) => [item.service, new Set(item.actions)]),
    );

    for (const [ruleIndex, rule] of (document.approval_rules ?? []).entries()) {
      const policyActions = allowed.get(rule.service);
      for (const [actionIndex, ruleAction] of rule.actions.entries()) {
        if (!policyActions || !actionAllowed(policyActions, ruleAction)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["approval_rules", ruleIndex, "actions", actionIndex],
            message: "approval rule actions must already be granted by policy",
          });
        }
      }
    }
  });

export const auditLogEntrySchema = z
  .object({
    $schema: url,
    log_version: z.literal(AUDIT_LOG_VERSION),
    event_id: z.string().trim().min(1).max(256),
    timestamp: utcTimestamp,
    agent_id: identifier,
    install_id: z.string().trim().min(1).max(256),
    service: identifier,
    operation: z.string().trim().min(1).max(512),
    authorization_basis: z.string().trim().min(1).max(512),
    outcome: z.enum(["approved", "denied", "pending_approval"]),
    approval_required: z.boolean(),
  })
  .strict();

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
  code: string;
}

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: ValidationIssue[] };

function validate<T>(
  schema: z.ZodType<T>,
  input: unknown,
  schemaKind: SchemaKind,
  options: ValidationOptions = {},
): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    const schemaReference = (result.data as { $schema: string }).$schema;
    const canonicalUrl = SCHEMA_URLS[schemaKind];
    const trustedMirrors = options.trustedMirrors?.[schemaKind] ?? [];
    if (schemaReference !== canonicalUrl && !trustedMirrors.includes(schemaReference)) {
      return {
        valid: false,
        errors: [
          {
            path: ["$schema"],
            message:
              "must use the canonical AIP schema URL or an explicitly trusted equivalent mirror",
            code: "untrusted_schema_reference",
          },
        ],
      };
    }
    return { valid: true, data: result.data };
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
      code: issue.code,
    })),
  };
}

export function validateIdentity(
  input: unknown,
  options?: ValidationOptions,
): ValidationResult<AgentIdentity> {
  return validate(identitySchema, input, "identity", options);
}

export function validatePolicy(
  input: unknown,
  options?: ValidationOptions,
): ValidationResult<AccessPolicy> {
  return validate(policySchema, input, "policy", options);
}

export function validateAuditLog(
  input: unknown,
  options?: ValidationOptions,
): ValidationResult<AuditLogEntry> {
  return validate(auditLogEntrySchema, input, "auditLog", options);
}

function actionAllowed(declaredActions: Set<string>, requestedAction: string): boolean {
  if (declaredActions.has(requestedAction)) {
    return true;
  }

  const separator = requestedAction.indexOf(":");
  if (separator === -1) {
    return false;
  }

  return declaredActions.has(`${requestedAction.slice(0, separator)}:*`);
}

function policyIsWithinIdentity(
  policy: AccessPolicy,
  identity: AgentIdentity,
): ValidationIssue[] {
  const declared = new Map(
    identity.scope.map((item) => [item.service, new Set(item.actions)]),
  );
  const errors: ValidationIssue[] = [];

  for (const [itemIndex, item] of policy.policy.entries()) {
    const declaredActions = declared.get(item.service);
    for (const [actionIndex, itemAction] of item.actions.entries()) {
      if (!declaredActions || !actionAllowed(declaredActions, itemAction)) {
        errors.push({
          path: ["policy", itemIndex, "actions", actionIndex],
          message: "policy action must be equal to or narrower than identity scope",
          code: "scope_narrowing",
        });
      }
    }
  }

  return errors;
}

export function validatePolicyAgainstIdentity(
  policyInput: unknown,
  identityInput: unknown,
  options?: ValidationOptions,
): ValidationResult<AccessPolicy> {
  const policyResult = validatePolicy(policyInput, options);
  const identityResult = validateIdentity(identityInput, options);
  const errors = [
    ...(policyResult.valid ? [] : policyResult.errors),
    ...(identityResult.valid ? [] : identityResult.errors),
  ];

  if (!policyResult.valid || !identityResult.valid) {
    return { valid: false, errors };
  }

  const scopeErrors = policyIsWithinIdentity(
    policyResult.data,
    identityResult.data,
  );
  if (scopeErrors.length > 0) {
    return { valid: false, errors: scopeErrors };
  }

  if (policyResult.data.agent_id !== identityResult.data.id) {
    return {
      valid: false,
      errors: [
        {
          path: ["agent_id"],
          message: "policy agent_id must match identity id",
          code: "identity_mismatch",
        },
      ],
    };
  }

  if (policyResult.data.version !== identityResult.data.version) {
    return {
      valid: false,
      errors: [
        {
          path: ["version"],
          message: "policy version must match identity version",
          code: "identity_mismatch",
        },
      ],
    };
  }

  return policyResult;
}
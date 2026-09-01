export interface AipAuthor {
  name: string;
  url?: string;
}

export interface AipScopeItem {
  service: string;
  actions: string[];
}

export interface AgentIdentity {
  $schema: string;
  aip: typeof import("./constants.js").AIP_VERSION;
  id: string;
  name: string;
  description: string;
  author: AipAuthor;
  version: string;
  scope: AipScopeItem[];
  install_url?: string;
  verify_url?: string;
  published_at?: string;
}

export interface ApprovalThreshold {
  amount_usd?: number;
  record_count?: number;
}

export interface ApprovalRule {
  service: string;
  actions: string[];
  threshold?: ApprovalThreshold;
  requires_approval: true;
}

export interface AccessPolicy {
  $schema: string;
  aip: typeof import("./constants.js").AIP_VERSION;
  agent_id: string;
  install_id: string;
  version: string;
  policy: AipScopeItem[];
  approval_rules?: ApprovalRule[];
}

export type AuditOutcome = "approved" | "denied" | "pending_approval";

export interface AuditLogEntry {
  $schema: string;
  log_version: typeof import("./constants.js").AUDIT_LOG_VERSION;
  event_id: string;
  timestamp: string;
  agent_id: string;
  install_id: string;
  service: string;
  operation: string;
  authorization_basis: string;
  outcome: AuditOutcome;
  approval_required: boolean;
}
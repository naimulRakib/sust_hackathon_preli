import { z } from 'zod';

// ── Enums (must match problem statement exactly, case-sensitive) ──────────────

export const LanguageEnum = z.enum(['en', 'bn', 'mixed']);
export const ChannelEnum = z.enum(['in_app_chat', 'call_center', 'email', 'merchant_portal', 'field_agent']);
export const UserTypeEnum = z.enum(['customer', 'merchant', 'agent', 'unknown']);
export const TxnTypeEnum = z.enum(['transfer', 'payment', 'cash_in', 'cash_out', 'settlement', 'refund']);
export const TxnStatusEnum = z.enum(['completed', 'failed', 'pending', 'reversed']);

export const CaseTypeEnum = z.enum([
  'wrong_transfer',
  'payment_failed',
  'refund_request',
  'duplicate_payment',
  'merchant_settlement_delay',
  'agent_cash_in_issue',
  'phishing_or_social_engineering',
  'other'
]);

export const SeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);

export const DepartmentEnum = z.enum([
  'customer_support',
  'dispute_resolution',
  'payments_ops',
  'merchant_operations',
  'agent_operations',
  'fraud_risk'
]);

export const EvidenceVerdictEnum = z.enum(['consistent', 'inconsistent', 'insufficient_data']);

// ── Transaction History Entry ─────────────────────────────────────────────────

export const TransactionSchema = z.object({
  transaction_id: z.string(),
  timestamp: z.string(),
  type: TxnTypeEnum,
  amount: z.number(),
  counterparty: z.string(),
  status: TxnStatusEnum
});

export type Transaction = z.infer<typeof TransactionSchema>;

// ── Request Schema ─────────────────────────────────────────────────────────────

export const TicketRequestSchema = z.object({
  ticket_id: z.string().min(1),
  complaint: z.string().min(1),
  language: LanguageEnum.optional(),
  channel: ChannelEnum.optional(),
  user_type: UserTypeEnum.optional(),
  campaign_context: z.string().optional(),
  transaction_history: z.array(TransactionSchema).optional().default([]),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type TicketRequest = z.infer<typeof TicketRequestSchema>;

// ── Response Schema ────────────────────────────────────────────────────────────

export const TicketResponseSchema = z.object({
  ticket_id: z.string(),
  relevant_transaction_id: z.string().nullable(),
  evidence_verdict: EvidenceVerdictEnum,
  case_type: CaseTypeEnum,
  severity: SeverityEnum,
  department: DepartmentEnum,
  agent_summary: z.string().min(1),
  recommended_next_action: z.string().min(1),
  customer_reply: z.string().min(1),
  human_review_required: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  reason_codes: z.array(z.string()).optional()
});

export type TicketResponse = z.infer<typeof TicketResponseSchema>;

// ── Partial AI output type (what Groq returns before we validate) ──────────────

export interface AIAnalysisOutput {
  relevant_transaction_id: string | null;
  evidence_verdict: string;
  case_type: string;
  severity: string;
  department: string;
  agent_summary: string;
  recommended_next_action: string;
  customer_reply: string;
  human_review_required: boolean;
  confidence: number;
  reason_codes: string[];
}

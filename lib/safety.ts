import { AIAnalysisOutput } from './schema';

const UNSAFE_REPLY_PATTERNS = [
  // RULE 1: Never ask for credentials
  // BUG C FIX: Negative lookahead prevents "do not share your PIN" from being flagged
  // BUG B FIX: Broader pattern allows 'send us your X' and 'provide X' with any filler
  { pattern: /\b(?<!do not |don't |never |please do not |please never )(please\s+)?(share|provide|send|give|enter|type)\b.{0,30}?\b(pin|otp|password|card\s*number|cvv)\b/i, penalty: 'CREDENTIAL_REQUEST' },
  { pattern: /\b(আপনার\s+)?(পিন|ওটিপি|পাসওয়ার্ড)\s+(দিন|শেয়ার|পাঠান)\b/i, penalty: 'CREDENTIAL_REQUEST' },
  // RULE 2: Never confirm unauthorized refunds/reversals
  // BUG D FIX: Use flexible pattern that matches 'a full refund', 'the refund', etc.
  { pattern: /\bwe\s+will\s+(refund|reverse|return|give\s+back|transfer\s+back)\b/i, penalty: 'UNAUTHORIZED_REFUND' },
  { pattern: /\byour\s+money\s+(will\s+be|has\s+been)\s+(refunded|returned|reversed)\b/i, penalty: 'UNAUTHORIZED_REFUND' },
  { pattern: /\bwe\s+(have|will)\s+(refunded|reversed|credited)\b/i, penalty: 'UNAUTHORIZED_REFUND' },
  { pattern: /\bguarantee\b.{0,20}\b(refund|reversal)\b/i, penalty: 'UNAUTHORIZED_REFUND' },
  { pattern: /\bwill\s+be\s+refunded\b/i, penalty: 'UNAUTHORIZED_REFUND' },
  // RULE 3: Never send to third parties
  { pattern: /\bcontact\s+(third|external|outside|another)\b/i, penalty: 'THIRD_PARTY_REDIRECT' },
];

const UNSAFE_ACTION_PATTERNS = [
  { pattern: /\bconfirm\s+(the\s+)?(refund|reversal)\s+immediately\b/i, penalty: 'UNAUTHORIZED_REFUND' },
  { pattern: /\btell\s+(the\s+)?customer\s+we\s+will\s+refund\b/i, penalty: 'UNAUTHORIZED_REFUND' },
];

// Safe replacement templates for when AI output is unsafe
const SAFE_REPLY_FALLBACK = (ticketId: string, txnId: string | null) =>
  `We have noted your concern${txnId ? ` regarding transaction ${txnId}` : ''}. ` +
  `Our team will review your case and contact you through official support channels. ` +
  `Please never provide your PIN, OTP, or password to anyone, including our support staff.`;

const SAFE_ACTION_FALLBACK = (ticketId: string) =>
  `Review the case details carefully and follow standard escalation procedures. ` +
  `Do not make any financial commitments or promises without proper authorization.`;

export interface SafetyCheckResult {
  is_safe: boolean;
  violations: string[];
  sanitized_reply: string;
  sanitized_action: string;
}

export function checkAndSanitize(
  output: AIAnalysisOutput,
  ticketId: string
): SafetyCheckResult {
  const violations: string[] = [];
  
  let reply = output.customer_reply;
  let action = output.recommended_next_action;

  // Check customer_reply
  for (const { pattern, penalty } of UNSAFE_REPLY_PATTERNS) {
    if (pattern.test(reply)) {
      violations.push(`REPLY_${penalty}`);
      reply = SAFE_REPLY_FALLBACK(ticketId, output.relevant_transaction_id);
      break; // One sanitization is enough per field
    }
  }

  // Check recommended_next_action
  for (const { pattern, penalty } of UNSAFE_ACTION_PATTERNS) {
    if (pattern.test(action)) {
      violations.push(`ACTION_${penalty}`);
      action = SAFE_ACTION_FALLBACK(ticketId);
      break;
    }
  }

  // Enforce safety reminder in reply if not present
  const safetyPhrase = /pin|otp|password|পিন|ওটিপি/i.test(reply);
  if (!safetyPhrase) {
    reply = reply.trimEnd();
    if (!reply.endsWith('.')) reply += '.';
    reply += ' Please never provide your PIN, OTP, or password to anyone.';
  }

  reply = reply.replace(/https?:\/\/[^\s]+/g, '[REMOVED_LINK]');

  return {
    is_safe: violations.length === 0,
    violations,
    sanitized_reply: reply,
    sanitized_action: action
  };
}

// Validate enum values from AI output
export function validateEnums(output: AIAnalysisOutput): string[] {
  const errors: string[] = [];
  const validCaseTypes = ['wrong_transfer','payment_failed','refund_request','duplicate_payment','merchant_settlement_delay','agent_cash_in_issue','phishing_or_social_engineering','other'];
  const validSeverities = ['low','medium','high','critical'];
  const validDepartments = ['customer_support','dispute_resolution','payments_ops','merchant_operations','agent_operations','fraud_risk'];
  const validVerdicts = ['consistent','inconsistent','insufficient_data'];

  if (!validCaseTypes.includes(output.case_type)) errors.push(`Invalid case_type: ${output.case_type}`);
  if (!validSeverities.includes(output.severity)) errors.push(`Invalid severity: ${output.severity}`);
  if (!validDepartments.includes(output.department)) errors.push(`Invalid department: ${output.department}`);
  if (!validVerdicts.includes(output.evidence_verdict)) errors.push(`Invalid evidence_verdict: ${output.evidence_verdict}`);
  return errors;
}

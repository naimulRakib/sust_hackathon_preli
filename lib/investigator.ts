import { TicketRequest, TicketResponse, TicketResponseSchema } from './schema';
import { computeSignals, RulesSignals } from './rules-engine';
import { callGroq } from './groq-client';
import { checkAndSanitize, validateEnums } from './safety';
import { AIAnalysisOutput } from './schema';

export async function investigateTicket(req: TicketRequest): Promise<TicketResponse> {
  // Step 1: Compute deterministic signals (pure logic, always runs)
  const signals = computeSignals(req);

  let aiOutput: AIAnalysisOutput;

  // Step 2: Handle prompt injection — return safe response without calling AI
  if (signals.is_prompt_injection) {
    aiOutput = buildInjectionSafeResponse(req, signals);
  } else {
    // Step 3: Call Groq AI with signals as context
    try {
      aiOutput = await callGroq(req, signals);
    } catch (err) {
      // Fallback: If AI fails, use rules-only response
      console.error('Groq call failed, using rules fallback:', err);
      aiOutput = buildRulesFallback(req, signals);
    }
  }

  // Step 4: Override critical fields with rules engine values (AI cannot override these)
  aiOutput.relevant_transaction_id = signals.matched_transaction_id;
  aiOutput.evidence_verdict = signals.evidence_verdict;
  if (signals.detected_case_type) {
    aiOutput.case_type = signals.detected_case_type;
  }
  if (signals.suggested_department) {
    aiOutput.department = signals.suggested_department;
  }
  if (signals.suggested_severity) {
    aiOutput.severity = signals.suggested_severity;
  }
  if (signals.force_human_review) {
    aiOutput.human_review_required = true;
  }

  // Step 5: Validate enum values (fix any AI hallucinations)
  const enumErrors = validateEnums(aiOutput);
  if (enumErrors.length > 0) {
    console.warn('Enum validation errors, applying fixes:', enumErrors);
    applyEnumFallbacks(aiOutput, signals);
  }

  // Step 6: Safety check and sanitize customer_reply
  const safety = checkAndSanitize(aiOutput, req.ticket_id);
  if (!safety.is_safe) {
    console.warn('Safety violations in AI output:', safety.violations);
  }
  aiOutput.customer_reply = safety.sanitized_reply;
  aiOutput.recommended_next_action = safety.sanitized_action || aiOutput.recommended_next_action;

  // Step 7: Build and validate final response
  const response: TicketResponse = {
    ticket_id: req.ticket_id,
    relevant_transaction_id: aiOutput.relevant_transaction_id ?? null,
    evidence_verdict: aiOutput.evidence_verdict as any,
    case_type: aiOutput.case_type as any,
    severity: aiOutput.severity as any,
    department: aiOutput.department as any,
    agent_summary: aiOutput.agent_summary || buildDefaultSummary(req, signals),
    recommended_next_action: aiOutput.recommended_next_action || buildDefaultAction(signals),
    customer_reply: aiOutput.customer_reply,
    human_review_required: aiOutput.human_review_required,
    confidence: typeof aiOutput.confidence === 'number' ? aiOutput.confidence : signals.match_confidence,
    reason_codes: aiOutput.reason_codes ?? []
  };

  // Final schema validation
  const parsed = TicketResponseSchema.safeParse(response);
  if (!parsed.success) {
    console.error('Response schema validation failed:', parsed.error);
    // Return a safe minimal response rather than crashing
    return buildMinimalSafeResponse(req, signals);
  }

  return parsed.data;
}

function applyEnumFallbacks(output: AIAnalysisOutput, signals: RulesSignals): void {
  const validCaseTypes = ['wrong_transfer','payment_failed','refund_request','duplicate_payment','merchant_settlement_delay','agent_cash_in_issue','phishing_or_social_engineering','other'];
  const validSeverities = ['low','medium','high','critical'];
  const validDepartments = ['customer_support','dispute_resolution','payments_ops','merchant_operations','agent_operations','fraud_risk'];
  const validVerdicts = ['consistent','inconsistent','insufficient_data'];
  
  if (!validCaseTypes.includes(output.case_type)) output.case_type = signals.detected_case_type ?? 'other';
  if (!validSeverities.includes(output.severity)) output.severity = signals.suggested_severity ?? 'medium';
  if (!validDepartments.includes(output.department)) output.department = signals.suggested_department ?? 'customer_support';
  if (!validVerdicts.includes(output.evidence_verdict)) output.evidence_verdict = signals.evidence_verdict;
}

function buildInjectionSafeResponse(req: TicketRequest, signals: RulesSignals): AIAnalysisOutput {
  return {
    relevant_transaction_id: null,
    evidence_verdict: 'insufficient_data',
    case_type: 'other',
    severity: 'low',
    department: 'customer_support',
    agent_summary: `Ticket ${req.ticket_id} contains unusual content and has been flagged for security review.`,
    recommended_next_action: 'Manually review this ticket before taking any action. The complaint content was flagged by the security filter.',
    customer_reply: 'Thank you for reaching out. We have received your message and a support agent will contact you through official channels. Please do not share your PIN, OTP, or password with anyone.',
    human_review_required: true,
    confidence: 0.5,
    reason_codes: ['security_flag', 'manual_review']
  };
}

function buildRulesFallback(req: TicketRequest, signals: RulesSignals): AIAnalysisOutput {
  const txnRef = signals.matched_transaction_id 
    ? ` regarding transaction ${signals.matched_transaction_id}` 
    : '';
  return {
    relevant_transaction_id: signals.matched_transaction_id,
    evidence_verdict: signals.evidence_verdict,
    case_type: signals.detected_case_type ?? 'other',
    severity: signals.suggested_severity ?? 'medium',
    department: signals.suggested_department ?? 'customer_support',
    agent_summary: `Customer complaint${txnRef} has been received and requires review.`,
    recommended_next_action: 'Review the ticket manually and follow standard escalation procedures.',
    customer_reply: `We have received your concern${txnRef}. Our team will review your case and contact you through official support channels. Please do not share your PIN, OTP, or password with anyone.`,
    human_review_required: signals.force_human_review,
    confidence: signals.match_confidence,
    reason_codes: ['rules_fallback']
  };
}

function buildDefaultSummary(req: TicketRequest, signals: RulesSignals): string {
  return `Ticket ${req.ticket_id}: Customer complaint received.${signals.matched_transaction_id ? ` Related transaction: ${signals.matched_transaction_id}.` : ''}`;
}

function buildDefaultAction(signals: RulesSignals): string {
  return `Route to ${signals.suggested_department ?? 'customer_support'} for review.`;
}

function buildMinimalSafeResponse(req: TicketRequest, signals: RulesSignals): TicketResponse {
  return {
    ticket_id: req.ticket_id,
    relevant_transaction_id: null,
    evidence_verdict: 'insufficient_data',
    case_type: 'other',
    severity: 'low',
    department: 'customer_support',
    agent_summary: 'Ticket received. Manual review required due to processing error.',
    recommended_next_action: 'Review ticket manually.',
    customer_reply: 'Thank you for contacting us. A support agent will review your case and respond through official channels. Please do not share your PIN, OTP, or password with anyone.',
    human_review_required: true,
    confidence: 0.1,
    reason_codes: ['processing_fallback']
  };
}

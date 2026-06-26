import { computeSignals } from '../lib/rules-engine';
import { TicketRequestSchema } from '../lib/schema';
import sampleCases from '../SUST_Preli_Sample_Cases.json';

const cases = (sampleCases as any).cases;

describe('Rules Engine — Sample Cases', () => {
  cases.forEach((c: any) => {
    const { id, label, input, expected_output } = c;

    test(`${id}: ${label}`, () => {
      const parsed = TicketRequestSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;

      const signals = computeSignals(parsed.data);

      // Check relevant_transaction_id
      expect(signals.matched_transaction_id).toBe(expected_output.relevant_transaction_id);

      // Check evidence_verdict
      expect(signals.evidence_verdict).toBe(expected_output.evidence_verdict);

      // Check case_type (if rules detected it)
      if (signals.detected_case_type !== null) {
        expect(signals.detected_case_type).toBe(expected_output.case_type);
      }

      // Check department
      expect(signals.suggested_department).toBe(expected_output.department);

      // Check severity
      expect(signals.suggested_severity).toBe(expected_output.severity);

      // Check human_review_required
      expect(signals.force_human_review).toBe(expected_output.human_review_required);
    });
  });
});

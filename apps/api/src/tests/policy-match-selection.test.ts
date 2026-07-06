import type { BaselineMatchResult, Policy } from '@policy-match/shared';
import { describe, expect, it } from 'vitest';
import { selectPolicyReviewCandidates } from '../services/policy-match-selection.js';

function baseline(score: number, policyTitle: string): { policy: Policy; baseline: BaselineMatchResult } {
  return {
    policy: {
      id: `policy-${policyTitle}`,
      title: policyTitle,
      category: '测试',
      source_url: 'https://example.com/policy',
      status: 'active',
      policy_text: policyTitle,
      rules: []
    },
    baseline: {
      policy_id: `policy-${policyTitle}`,
      policy_title: policyTitle,
      baseline_score: score,
      baseline_level: score >= 80 ? 'recommended' : score >= 60 ? 'potential' : 'not_recommended',
      matched_conditions: [{ field_key: 'district', evidence_text: '位于龙华区', score }],
      missing_conditions: [],
      risk_notes: [],
      hard_failures: []
    }
  };
}

describe('policy match selection', () => {
  it('keeps only the strongest baseline candidates for AI review', () => {
    const candidates = Array.from({ length: 25 }, (_, index) => baseline(index, `政策 ${index}`));

    const selected = selectPolicyReviewCandidates(candidates, 20);

    expect(selected).toHaveLength(20);
    expect(selected[0].baseline.baseline_score).toBe(24);
    expect(selected.at(-1)?.baseline.baseline_score).toBe(5);
    expect(selected.some((item) => item.baseline.baseline_score === 4)).toBe(false);
  });
});

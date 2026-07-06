import type { BaselineMatchResult, Policy } from '@policy-match/shared';
import { describe, expect, it } from 'vitest';
import { mapPolicyReviewCandidates, selectPolicyReviewCandidates } from '../services/policy-match-selection.js';

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

  it('reviews candidates with a bounded concurrency while preserving result order', async () => {
    const candidates = Array.from({ length: 6 }, (_, index) => baseline(index, `政策 ${index}`));
    let active = 0;
    let maxActive = 0;

    const results = await mapPolicyReviewCandidates(candidates, 3, async (candidate, index) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10 - index));
      active -= 1;
      return candidate.policy.title;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(results).toEqual(candidates.map((item) => item.policy.title));
  });
});

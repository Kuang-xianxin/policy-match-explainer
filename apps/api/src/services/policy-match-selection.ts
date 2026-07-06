import type { BaselineMatchResult, Policy } from '@policy-match/shared';

export interface PolicyReviewCandidate {
  policy: Policy;
  baseline: BaselineMatchResult;
}

export function selectPolicyReviewCandidates(
  candidates: PolicyReviewCandidate[],
  limit: number
): PolicyReviewCandidate[] {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;

  return [...candidates]
    .sort((left, right) => {
      const hardFailureDelta = left.baseline.hard_failures.length - right.baseline.hard_failures.length;
      if (hardFailureDelta !== 0) return hardFailureDelta;

      const scoreDelta = right.baseline.baseline_score - left.baseline.baseline_score;
      if (scoreDelta !== 0) return scoreDelta;

      const matchedDelta = right.baseline.matched_conditions.length - left.baseline.matched_conditions.length;
      if (matchedDelta !== 0) return matchedDelta;

      const missingDelta = left.baseline.missing_conditions.length - right.baseline.missing_conditions.length;
      if (missingDelta !== 0) return missingDelta;

      return left.policy.title.localeCompare(right.policy.title, 'zh-Hans-CN');
    })
    .slice(0, normalizedLimit);
}

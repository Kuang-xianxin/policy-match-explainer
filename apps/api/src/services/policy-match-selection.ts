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

function normalizedConcurrency(concurrency: number, candidateCount: number): number {
  if (candidateCount <= 0) return 0;
  const parsed = Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 3;
  return Math.min(candidateCount, Math.max(1, Math.min(parsed, 6)));
}

export async function mapPolicyReviewCandidates<T>(
  candidates: PolicyReviewCandidate[],
  concurrency: number,
  mapper: (candidate: PolicyReviewCandidate, index: number) => Promise<T>
): Promise<T[]> {
  const workerCount = normalizedConcurrency(concurrency, candidates.length);
  const results = new Array<T>(candidates.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < candidates.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(candidates[index], index);
      }
    })
  );

  return results;
}

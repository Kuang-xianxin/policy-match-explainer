import type {
  BaselineMatchResult,
  EnterpriseProfile,
  MatchLevel,
  MissingCondition,
  MatchedCondition,
  Policy,
  PolicyRule
} from '@policy-match/shared';

function getProfileValue(profile: EnterpriseProfile, fieldKey: string): unknown {
  return (profile as unknown as Record<string, unknown>)[fieldKey];
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

function ruleMatches(value: unknown, rule: PolicyRule): boolean {
  switch (rule.operator) {
    case 'equals':
      return value === rule.expected_value;
    case 'not_equals':
      return value !== rule.expected_value;
    case 'in':
      return Array.isArray(rule.expected_value) && rule.expected_value.includes(value);
    case 'gte':
      return Number(value) >= Number(rule.expected_value);
    case 'lte':
      return Number(value) <= Number(rule.expected_value);
    case 'contains':
      return String(value ?? '').includes(String(rule.expected_value));
    case 'includes_any':
      {
        const expected = rule.expected_value;
        if (!Array.isArray(value) || !Array.isArray(expected)) return false;
        return value.some((item) => expected.includes(item));
      }
    case 'is_true':
      return value === true;
    case 'is_false':
      return value === false;
    default:
      return false;
  }
}

function levelFromScore(score: number, hasHardFailure: boolean, missingRequired: boolean): MatchLevel {
  if (hasHardFailure) return 'not_recommended';
  if (missingRequired) return 'need_more_info';
  if (score >= 80) return 'recommended';
  if (score >= 60) return 'potential';
  return 'not_recommended';
}

export function levelFromFinalScore(score: number, baselineLevel: MatchLevel, hasHardFailure: boolean): MatchLevel {
  if (hasHardFailure || baselineLevel === 'not_recommended') return baselineLevel;
  if (baselineLevel === 'need_more_info') return 'need_more_info';
  if (score >= 80) return 'recommended';
  if (score >= 60) return 'potential';
  return 'not_recommended';
}

export function evaluatePolicy(profile: EnterpriseProfile, policy: Policy): BaselineMatchResult {
  const totalWeight = policy.rules.reduce((sum, rule) => sum + rule.weight, 0);
  const matchedConditions: MatchedCondition[] = [];
  const missingConditions: MissingCondition[] = [];
  const riskNotes: string[] = [];
  const hardFailures: string[] = [];
  let matchedWeight = 0;
  let missingRequired = false;

  for (const rule of policy.rules) {
    const value = getProfileValue(profile, rule.field_key);

    if (isMissing(value)) {
      missingConditions.push({
        field_key: rule.field_key,
        expected_value: rule.expected_value,
        evidence_text: rule.evidence_text,
        required: rule.required
      });
      if (rule.required) missingRequired = true;
      continue;
    }

    const matched = ruleMatches(value, rule);
    if (matched) {
      matchedWeight += rule.weight;
      matchedConditions.push({
        field_key: rule.field_key,
        evidence_text: rule.evidence_text,
        score: rule.weight
      });
      continue;
    }

    missingConditions.push({
      field_key: rule.field_key,
      expected_value: rule.expected_value,
      evidence_text: rule.evidence_text,
      required: rule.required
    });

    if (rule.required) {
      hardFailures.push(`${rule.field_key} 不符合硬性条件：${rule.evidence_text}`);
    }
  }

  if (profile.has_major_violation) {
    riskNotes.push('企业存在重大违法记录，惠企政策通常会直接降级或不推荐。');
    hardFailures.push('has_major_violation 为 true');
  }

  const baselineScore = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  const baselineLevel = levelFromScore(baselineScore, hardFailures.length > 0, missingRequired);

  return {
    policy_id: policy.id,
    policy_title: policy.title,
    baseline_score: baselineScore,
    baseline_level: baselineLevel,
    matched_conditions: matchedConditions,
    missing_conditions: missingConditions,
    risk_notes: riskNotes,
    hard_failures: hardFailures
  };
}

export function evaluatePolicies(profile: EnterpriseProfile, policies: Policy[]): BaselineMatchResult[] {
  return policies.map((policy) => evaluatePolicy(profile, policy));
}

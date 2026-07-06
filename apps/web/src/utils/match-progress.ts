export type MatchProgressPhase = 'saving_profile' | 'scoring_rules' | 'ai_review' | 'opening_results';
export type LookupProgressPhase = 'planning_query' | 'web_research' | 'candidate_filtering';
export type OperationProgressKind = 'candidate_search' | 'profile_generation' | 'smart_match' | 'policy_match';

export type MatchProgressStepStatus = 'done' | 'active' | 'pending';

export interface MatchProgressStep {
  key: MatchProgressPhase | LookupProgressPhase;
  label: string;
  description: string;
  status: MatchProgressStepStatus;
}

export interface OperationEstimate {
  label: string;
  estimatedSeconds: number;
}

const orderedSteps: Array<Omit<MatchProgressStep, 'status'>> = [
  {
    key: 'saving_profile',
    label: '保存画像',
    description: '保存当前企业画像和用户补充区间'
  },
  {
    key: 'scoring_rules',
    label: '规则基线',
    description: '按政策硬性条件和权重规则计算候选政策'
  },
  {
    key: 'ai_review',
    label: 'DeepSeek 复核',
    description: '并发复核重点候选政策并生成解释'
  },
  {
    key: 'opening_results',
    label: '打开结果',
    description: '写入匹配结果并进入报告页面'
  }
];

const lookupSteps: Array<Omit<MatchProgressStep, 'status'>> = [
  {
    key: 'planning_query',
    label: '规划查询',
    description: '整理企业简称、标准名称和检索关键词'
  },
  {
    key: 'web_research',
    label: '联网检索',
    description: '检索官网、政府页面、公告和公开证据'
  },
  {
    key: 'candidate_filtering',
    label: '筛选候选',
    description: '核验龙华区主体和统一社会信用代码'
  }
];

const operationEstimates: Record<OperationProgressKind, OperationEstimate> = {
  candidate_search: {
    label: '预计 30-45 秒',
    estimatedSeconds: 45
  },
  profile_generation: {
    label: '预计 20-40 秒',
    estimatedSeconds: 40
  },
  smart_match: {
    label: '预计 60-90 秒',
    estimatedSeconds: 90
  },
  policy_match: {
    label: '预计 40-75 秒',
    estimatedSeconds: 75
  }
};

export function matchProgressSteps(phase: MatchProgressPhase): MatchProgressStep[] {
  const activeIndex = Math.max(0, orderedSteps.findIndex((item) => item.key === phase));

  return orderedSteps.map((step, index) => ({
    ...step,
    status: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending'
  }));
}

export function lookupProgressSteps(phase: LookupProgressPhase): MatchProgressStep[] {
  const activeIndex = Math.max(0, lookupSteps.findIndex((item) => item.key === phase));

  return lookupSteps.map((step, index) => ({
    ...step,
    status: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending'
  }));
}

export function operationEstimate(kind: OperationProgressKind): OperationEstimate {
  return operationEstimates[kind];
}

export function progressPercent(elapsedSeconds: number, estimatedSeconds: number): number {
  if (estimatedSeconds <= 0) return 8;
  return Math.min(92, Math.max(8, Math.round((Math.max(0, elapsedSeconds) / estimatedSeconds) * 100)));
}

export function matchProgressPercent(phase: MatchProgressPhase, elapsedSeconds: number): number {
  const phaseBase: Record<MatchProgressPhase, number> = {
    saving_profile: 8,
    scoring_rules: 32,
    ai_review: 58,
    opening_results: 88
  };
  const base = phaseBase[phase];
  const drift = Math.round(progressPercent(elapsedSeconds, operationEstimates.policy_match.estimatedSeconds) * 0.12);
  return Math.min(96, base + drift);
}

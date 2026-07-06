export type MatchProgressPhase = 'saving_profile' | 'scoring_rules' | 'ai_review' | 'opening_results';

export type MatchProgressStepStatus = 'done' | 'active' | 'pending';

export interface MatchProgressStep {
  key: MatchProgressPhase;
  label: string;
  description: string;
  status: MatchProgressStepStatus;
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

export function matchProgressSteps(phase: MatchProgressPhase): MatchProgressStep[] {
  const activeIndex = Math.max(0, orderedSteps.findIndex((item) => item.key === phase));

  return orderedSteps.map((step, index) => ({
    ...step,
    status: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending'
  }));
}

export type AuthMode = 'login' | 'register';

export interface AuthModeMeta {
  title: string;
  submitText: string;
  showDisplayName: boolean;
  passwordAutocomplete: 'current-password' | 'new-password';
}

export interface AuthAiStatusInput {
  configured: boolean;
  model: string;
}

export interface AuthAiStatusCopy {
  status: string;
  description: string;
}

export interface AuthTrustItem {
  title: string;
  description: string;
}

export function authModeMeta(mode: AuthMode): AuthModeMeta {
  if (mode === 'register') {
    return {
      title: '注册账号',
      submitText: '注册',
      showDisplayName: true,
      passwordAutocomplete: 'new-password'
    };
  }
  return {
    title: '登录账号',
    submitText: '登录',
    showDisplayName: false,
    passwordAutocomplete: 'current-password'
  };
}

export function authAiStatusCopy(status?: AuthAiStatusInput | null): AuthAiStatusCopy {
  if (status?.configured) {
    return {
      status: 'DeepSeek 已连接',
      description: `当前使用 ${status.model} 为政策匹配复核和报告生成提供分析能力。`
    };
  }
  return {
    status: '演示模式',
    description: '当前可体验账号、画像和规则匹配流程；AI 复核会以开发模式展示。'
  };
}

export function authTrustItems(): AuthTrustItem[] {
  return [
    {
      title: '数据隔离',
      description: '每个账号只查看自己的企业画像、匹配记录和报告。'
    },
    {
      title: 'AI 辅助',
      description: 'DeepSeek 用于复核政策匹配说明，规则基线仍保持可解释。'
    },
    {
      title: '报告留存',
      description: '匹配结果和建议报告会保存在账号下，便于继续完善材料。'
    }
  ];
}

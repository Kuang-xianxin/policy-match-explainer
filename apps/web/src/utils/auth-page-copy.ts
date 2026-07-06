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

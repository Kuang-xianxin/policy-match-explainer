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
      title: '企业画像生成',
      description: '输入企业名称后，系统会整理企业基础信息和用户补充字段，形成可确认的企业画像。'
    },
    {
      title: '政策智能匹配',
      description: '围绕龙华区惠企政策，先用规则计算命中度，再用 AI 复核匹配理由。'
    },
    {
      title: '报告建议输出',
      description: '把可申报方向、待补材料、风险提示和申报建议整理成便于阅读的文字报告。'
    }
  ];
}

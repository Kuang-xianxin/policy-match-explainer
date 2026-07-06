import { describe, expect, it } from 'vitest';
import { authAiStatusCopy, authModeMeta, authTrustItems } from './auth-page-copy';

describe('auth page copy', () => {
  it('keeps display name out of the login form and only shows it for registration', () => {
    expect(authModeMeta('login')).toEqual({
      title: '登录账号',
      submitText: '登录',
      showDisplayName: false,
      passwordAutocomplete: 'current-password'
    });
    expect(authModeMeta('register')).toEqual({
      title: '注册账号',
      submitText: '注册',
      showDisplayName: true,
      passwordAutocomplete: 'new-password'
    });
  });

  it('uses user-facing AI service status copy without local env instructions', () => {
    const configured = authAiStatusCopy({ configured: true, model: 'deepseek-chat' });
    const notConfigured = authAiStatusCopy({ configured: false, model: 'mock' });

    expect(configured.status).toBe('DeepSeek 已连接');
    expect(notConfigured.status).toBe('演示模式');
    expect(`${configured.description} ${notConfigured.description}`).not.toContain('DEEPSEEK_API_KEY');
    expect(`${configured.description} ${notConfigured.description}`).not.toContain('.env');
  });

  it('introduces the website workflow in user-facing copy', () => {
    expect(authTrustItems()).toEqual([
      expect.objectContaining({ title: '企业画像生成', description: expect.stringContaining('企业名称') }),
      expect.objectContaining({ title: '政策智能匹配', description: expect.stringContaining('龙华区惠企政策') }),
      expect.objectContaining({ title: '报告建议输出', description: expect.stringContaining('申报建议') })
    ]);
  });
});

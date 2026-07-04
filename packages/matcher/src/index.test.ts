import { describe, expect, it } from 'vitest';
import type { EnterpriseProfile, Policy } from '@policy-match/shared';
import { evaluatePolicy, levelFromFinalScore } from './index.js';

const baseProfile: EnterpriseProfile = {
  company_name: '深圳市龙华星河数策测试有限公司',
  credit_code: 'TEST-LH-MATCH-001',
  city: '深圳市',
  district: '龙华区',
  registered_year: 2020,
  listed_status: 'unlisted',
  employee_count: 75,
  employee_range: '50_100',
  industry: '软件和信息技术服务业',
  main_business: '人工智能、数据治理和企业数字化软件服务。',
  main_products: ['AI 数据治理平台'],
  customer_type: ['enterprise', 'government'],
  business_model: 'SaaS',
  main_revenue_source: '软件订阅、项目交付和技术服务',
  revenue_last_year: 12000000,
  revenue_range: '5m_20m',
  profit_last_year: 1000000,
  profit_range: '500k_2m',
  tax_paid_last_year: 500000,
  tax_paid_range: 'lt_1m',
  rd_expense_last_year: 3000000,
  rd_expense_range: '1m_5m',
  rd_expense_ratio: 25,
  rd_employee_count: 30,
  rd_employee_range: '10_50',
  is_high_tech_enterprise: true,
  is_tech_sme: true,
  has_specialized_new_sme: false,
  patent_count: 0,
  software_copyright_count: 0,
  tax_credit_level: 'A',
  has_major_violation: false,
  social_security_normal: true,
  apply_project_name: 'AI 数据治理平台产业化项目',
  project_direction: 'AI',
  project_stage: 'launched',
  project_budget: 3000000,
  project_budget_range: '1m_5m',
  registered_capital: 5000000,
  business_address: '深圳市龙华区民治街道数字创新园'
};

const specializedPolicy: Policy = {
  id: '33333333-3333-4333-8333-333333333333',
  title: '龙华区专精特新企业发展奖励',
  category: '企业培育',
  source_url: 'https://example.com/policy',
  status: 'active',
  policy_text: '鼓励专精特新中小企业做强做优。',
  rules: [
    { field_key: 'district', operator: 'equals', expected_value: '龙华区', weight: 20, required: true, evidence_text: '政策适用对象为龙华区企业。' },
    { field_key: 'has_specialized_new_sme', operator: 'is_true', expected_value: true, weight: 45, required: true, evidence_text: '政策面向专精特新企业。' },
    { field_key: 'revenue_last_year', operator: 'gte', expected_value: 1000000, weight: 20, required: false, evidence_text: '经营收入体现发展基础。' },
    { field_key: 'has_major_violation', operator: 'is_false', expected_value: false, weight: 15, required: true, evidence_text: '申报主体应无重大违法违规记录。' }
  ]
};

const projectPolicy: Policy = {
  id: '22222222-2222-4222-8222-222222222222',
  title: '龙华区数字化转型项目支持',
  category: '产业升级',
  source_url: 'https://example.com/project',
  status: 'active',
  policy_text: '支持企业实施数字化、智能化、数据治理和智能制造项目。',
  rules: [
    { field_key: 'district', operator: 'equals', expected_value: '龙华区', weight: 20, required: true, evidence_text: '区级政策要求企业位于龙华区。' },
    { field_key: 'project_direction', operator: 'in', expected_value: ['AI', '数据治理', '智能制造'], weight: 30, required: true, evidence_text: '项目方向应属于数字化或智能化。' },
    { field_key: 'project_budget', operator: 'gte', expected_value: 500000, weight: 25, required: false, evidence_text: '项目投入规模影响支持力度。' },
    { field_key: 'has_major_violation', operator: 'is_false', expected_value: false, weight: 25, required: true, evidence_text: '申报主体应无重大违法违规记录。' }
  ]
};

describe('policy matcher', () => {
  it('recommends a specialized-new company when hard requirements and revenue evidence match', () => {
    const result = evaluatePolicy({ ...baseProfile, has_specialized_new_sme: true }, specializedPolicy);

    expect(result.baseline_score).toBe(100);
    expect(result.baseline_level).toBe('recommended');
    expect(result.hard_failures).toEqual([]);
  });

  it('does not recommend when a required specialized-new qualification is missing', () => {
    const result = evaluatePolicy(baseProfile, specializedPolicy);

    expect(result.baseline_level).toBe('not_recommended');
    expect(result.hard_failures[0]).toContain('has_specialized_new_sme');
  });

  it('treats unknown numeric ranges as missing information rather than zero-value evidence', () => {
    const profile = {
      ...baseProfile,
      project_budget: 0,
      project_budget_range: 'unknown' as const
    };
    const result = evaluatePolicy(profile, projectPolicy);

    expect(result.missing_conditions.some((item) => item.field_key === 'project_budget')).toBe(true);
    expect(result.matched_conditions.some((item) => item.field_key === 'project_budget')).toBe(false);
    expect(result.hard_failures).toEqual([]);
  });

  it('turns major violations into hard failures and risk notes', () => {
    const result = evaluatePolicy({ ...baseProfile, has_major_violation: true }, projectPolicy);

    expect(result.baseline_level).toBe('not_recommended');
    expect(result.risk_notes.length).toBeGreaterThan(0);
    expect(result.hard_failures.some((item) => item.includes('has_major_violation'))).toBe(true);
  });

  it('keeps a hard-failure result from being upgraded by final score adjustment', () => {
    const finalLevel = levelFromFinalScore(95, 'not_recommended', true);

    expect(finalLevel).toBe('not_recommended');
  });
});

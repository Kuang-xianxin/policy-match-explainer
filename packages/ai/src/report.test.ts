import { describe, expect, it } from 'vitest';
import type { AiMatchReview, BaselineMatchResult, EnterpriseProfile } from '@policy-match/shared';
import { generateReport } from './index';

const profile: EnterpriseProfile = {
  company_name: '深圳华傲数据技术有限公司',
  credit_code: '914403007488656882',
  city: '深圳市',
  district: '龙华区',
  registered_year: 2014,
  listed_status: 'unlisted',
  employee_count: 120,
  industry: '软件和信息技术服务业',
  main_business: '数据治理、人工智能平台和企业数字化服务',
  main_products: ['数据治理平台', 'AI 分析平台'],
  customer_type: ['enterprise', 'government'],
  business_model: 'SaaS',
  main_revenue_source: '软件服务和项目交付',
  revenue_last_year: 12000000,
  profit_last_year: 1000000,
  tax_paid_last_year: 500000,
  rd_expense_last_year: 1200000,
  rd_expense_ratio: 10,
  rd_employee_count: 30,
  is_high_tech_enterprise: true,
  is_tech_sme: true,
  has_specialized_new_sme: false,
  patent_count: 8,
  software_copyright_count: 12,
  tax_credit_level: 'B',
  has_major_violation: false,
  social_security_normal: true,
  apply_project_name: 'AI 数据治理平台产业化项目',
  project_direction: 'AI',
  project_stage: 'launched',
  project_budget: 800000,
  registered_capital: 10000000,
  business_address: '深圳市龙华区',
  legal_representative: '待核对',
  establishment_date: '2014-01-01',
  registration_status: '存续',
  is_headquarters: false,
  is_above_scale_enterprise: false,
  digital_transformation_status: '已形成软件产品并服务企业客户',
  award_titles: [],
  known_projects: ['数据治理平台升级'],
  production_projects: ['AI 分析平台'],
  employee_range: '100_300',
  revenue_range: '5m_20m',
  profit_range: '500k_2m',
  tax_paid_range: 'lt_1m',
  rd_expense_range: '1m_5m',
  rd_employee_range: '10_50',
  project_budget_range: 'lt_1m'
};

const matchResult: BaselineMatchResult & AiMatchReview = {
  policy_id: 'policy-1',
  policy_title: '龙华区科技创新企业培育扶持',
  baseline_score: 78,
  baseline_level: 'potential',
  matched_conditions: [
    { field_key: 'district', evidence_text: '政策适用范围为龙华区。', score: 18 },
    { field_key: 'is_high_tech_enterprise', evidence_text: '高新技术企业可作为重要加分项。', score: 20 }
  ],
  missing_conditions: [
    {
      field_key: 'has_specialized_new_sme',
      expected_value: true,
      evidence_text: '专精特新资质会提升申报确定性。',
      required: false
    }
  ],
  risk_notes: ['需核对申报窗口和政策原文。'],
  hard_failures: [],
  ai_review_summary: '规则命中项与企业画像方向一致。',
  ai_explanation: '企业区域、行业方向和研发投入与政策方向匹配。',
  ai_missing_fields: ['has_specialized_new_sme'],
  ai_suggested_actions: ['补充专精特新资质或替代证明。', '准备研发费用辅助账和项目预算说明。'],
  ai_confidence: 0.82,
  ai_adjustment: 3,
  ai_mode: 'mock'
};

describe('generateReport', () => {
  it('builds a detailed fallback report with feasible next steps', async () => {
    const report = await generateReport(profile, [matchResult], {
      model: 'mock',
      baseUrl: 'http://localhost',
      apiKey: ''
    });

    expect(report.content_text).toContain('综合结论');
    expect(report.content_text).toContain('申报优先级');
    expect(report.content_text).toContain('可行建议');
    expect(report.content_text).toContain('材料准备清单');
    expect(report.content_text).toContain('风险与限制');
    expect(report.content_text).toContain('先核对政策原文和申报窗口');
    expect(report.content_text).toContain('龙华区科技创新企业培育扶持');
    expect(report.content_text.split('\n').length).toBeGreaterThanOrEqual(10);
  });
});

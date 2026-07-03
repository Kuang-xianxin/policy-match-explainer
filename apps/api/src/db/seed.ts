import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Policy } from '@policy-match/shared';
import { pool, closePool } from './pool.js';

const policies: Policy[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: '龙华区科技创新企业培育扶持',
    category: '科技创新',
    source_url: 'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html',
    status: 'active',
    policy_text: '面向龙华区科技企业，对高新技术企业、科技型中小企业、研发投入较高企业给予培育扶持。',
    rules: [
      { field_key: 'district', operator: 'equals', expected_value: '龙华区', weight: 18, required: true, evidence_text: '政策适用范围为龙华区。' },
      { field_key: 'industry', operator: 'contains', expected_value: '软件', weight: 14, required: false, evidence_text: '重点支持软件和信息技术服务业。' },
      { field_key: 'is_high_tech_enterprise', operator: 'is_true', expected_value: true, weight: 20, required: false, evidence_text: '高新技术企业可作为重要加分项。' },
      { field_key: 'is_tech_sme', operator: 'is_true', expected_value: true, weight: 14, required: false, evidence_text: '科技型中小企业符合培育方向。' },
      { field_key: 'rd_expense_ratio', operator: 'gte', expected_value: 5, weight: 18, required: false, evidence_text: '研发投入强度体现创新能力。' },
      { field_key: 'has_major_violation', operator: 'is_false', expected_value: false, weight: 16, required: true, evidence_text: '申报主体应无重大违法违规记录。' }
    ]
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: '龙华区数字化转型项目支持',
    category: '产业升级',
    source_url: 'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html',
    status: 'active',
    policy_text: '支持企业实施数字化、智能化、数据治理和智能制造项目，鼓励项目落地和规模化推广。',
    rules: [
      { field_key: 'district', operator: 'equals', expected_value: '龙华区', weight: 16, required: true, evidence_text: '区级政策要求企业位于龙华区。' },
      { field_key: 'project_direction', operator: 'in', expected_value: ['AI', '数据治理', '智能制造'], weight: 24, required: true, evidence_text: '项目方向应属于数字化或智能化。' },
      { field_key: 'project_stage', operator: 'in', expected_value: ['developing', 'launched', 'scaling'], weight: 16, required: false, evidence_text: '优先支持已研发、落地或推广项目。' },
      { field_key: 'project_budget', operator: 'gte', expected_value: 500000, weight: 18, required: false, evidence_text: '项目投入规模影响支持力度。' },
      { field_key: 'business_model', operator: 'in', expected_value: ['SaaS', 'platform', 'manufacturing'], weight: 10, required: false, evidence_text: '业务模式与数字化应用场景相关。' },
      { field_key: 'has_major_violation', operator: 'is_false', expected_value: false, weight: 16, required: true, evidence_text: '申报主体应无重大违法违规记录。' }
    ]
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    title: '龙华区专精特新企业发展奖励',
    category: '企业培育',
    source_url: 'https://www.szlhq.gov.cn/xxgk/zcfg/qgfxwj/qzcxwj/index.html',
    status: 'active',
    policy_text: '鼓励专精特新中小企业做强做优，对具备专精特新资质、经营稳定的企业给予发展奖励。',
    rules: [
      { field_key: 'district', operator: 'equals', expected_value: '龙华区', weight: 18, required: true, evidence_text: '政策适用对象为龙华区企业。' },
      { field_key: 'has_specialized_new_sme', operator: 'is_true', expected_value: true, weight: 34, required: true, evidence_text: '政策面向专精特新企业。' },
      { field_key: 'revenue_last_year', operator: 'gte', expected_value: 1000000, weight: 16, required: false, evidence_text: '经营收入体现企业发展基础。' },
      { field_key: 'tax_credit_level', operator: 'in', expected_value: ['A', 'B', 'M'], weight: 14, required: false, evidence_text: '良好税务信用有利于申报。' },
      { field_key: 'has_major_violation', operator: 'is_false', expected_value: false, weight: 18, required: true, evidence_text: '申报主体应无重大违法违规记录。' }
    ]
  }
];

export async function seedPolicies(): Promise<void> {
  for (const policy of policies) {
    await pool.query(
      `
      INSERT INTO policies (id, title, category, source_url, status, policy_text, rules)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (title) DO UPDATE SET
        category = EXCLUDED.category,
        source_url = EXCLUDED.source_url,
        status = EXCLUDED.status,
        policy_text = EXCLUDED.policy_text,
        rules = EXCLUDED.rules
      `,
      [policy.id, policy.title, policy.category, policy.source_url, policy.status, policy.policy_text, JSON.stringify(policy.rules)]
    );
  }
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  seedPolicies()
    .then(async () => {
      console.log('Policy seed data written.');
      await closePool();
    })
    .catch(async (error) => {
      console.error(error);
      await closePool();
      process.exit(1);
    });
}

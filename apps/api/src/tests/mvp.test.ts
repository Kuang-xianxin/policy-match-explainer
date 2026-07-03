import type { EnterpriseProfile } from '@policy-match/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { closePool } from '../db/pool.js';
import { resetDatabase } from '../db/reset.js';
import { seedPolicies } from '../db/seed.js';

const app = createApp();

const manualProfile: EnterpriseProfile = {
  company_name: '深圳市龙华智造科技有限公司',
  credit_code: '91440300MA5DEMO001',
  city: '深圳市',
  district: '龙华区',
  registered_year: 2020,
  listed_status: 'unlisted',
  employee_count: 80,
  industry: '软件和信息技术服务业',
  main_business: '人工智能、数据治理和企业数字化软件服务。',
  main_products: ['AI 数据治理平台', '企业政策分析系统'],
  customer_type: ['enterprise', 'government'],
  business_model: 'SaaS',
  main_revenue_source: '软件订阅、项目交付和技术服务',
  revenue_last_year: 6000000,
  profit_last_year: 900000,
  tax_paid_last_year: 350000,
  rd_expense_last_year: 900000,
  rd_expense_ratio: 15,
  rd_employee_count: 24,
  is_high_tech_enterprise: true,
  is_tech_sme: true,
  has_specialized_new_sme: false,
  patent_count: 6,
  software_copyright_count: 12,
  tax_credit_level: 'A',
  has_major_violation: false,
  social_security_normal: true,
  apply_project_name: 'AI 数据治理平台产业化项目',
  project_direction: 'AI',
  project_stage: 'launched',
  project_budget: 1200000,
  registered_capital: 5000000,
  business_address: '深圳市龙华区民治街道数字创新园'
};

async function register(email: string) {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password: 'secret123',
    display_name: email.split('@')[0]
  });
  expect(response.status).toBe(201);
  return response.body.token as string;
}

async function createManualProfile(token: string): Promise<string> {
  const created = await request(app)
    .post('/api/enterprise-profiles')
    .set('Authorization', `Bearer ${token}`)
    .send(manualProfile);
  expect(created.status).toBe(201);
  return created.body.enterprise_profile.id as string;
}

describe('policy match MVP flow', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedPolicies();
  });

  afterAll(async () => {
    await closePool();
  });

  it('runs AI-assisted company lookup, profile confirmation, matching, and report on PostgreSQL', async () => {
    const token = await register('demo@example.com');

    const health = await request(app).get('/health');
    expect(health.body.database).toBe('postgresql');

    const aiStatus = await request(app).get('/api/ai/status');
    expect(aiStatus.body.provider).toBe('deepseek');
    expect(aiStatus.body).toHaveProperty('configured');

    const lookup = await request(app)
      .post('/api/company-lookup/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query_name: '龙华智造' });
    expect(lookup.status).toBe(200);
    expect(lookup.body.lookup_plan.search_keywords.length).toBeGreaterThan(0);
    expect(lookup.body.candidates.length).toBeGreaterThan(0);

    const generated = await request(app)
      .post(`/api/company-lookup/${lookup.body.candidates[0].lookup_id}/generate-profile`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(generated.status).toBe(200);
    expect(generated.body.enterprise_profile.company_name).toContain('龙华智造');
    expect(generated.body.enterprise_profile.revenue_range).toBe('unknown');

    const confirmedProfile: EnterpriseProfile = {
      ...generated.body.enterprise_profile,
      employee_range: '50_100',
      employee_count: 75,
      revenue_range: '5m_20m',
      revenue_last_year: 12000000,
      profit_range: '500k_2m',
      profit_last_year: 1000000,
      tax_paid_range: 'lt_1m',
      tax_paid_last_year: 500000,
      rd_expense_range: '1m_5m',
      rd_expense_last_year: 3000000,
      rd_expense_ratio: 25,
      rd_employee_range: '10_50',
      rd_employee_count: 30,
      project_budget_range: '1m_5m',
      project_budget: 3000000
    };

    const created = await request(app)
      .post('/api/enterprise-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send(confirmedProfile);
    expect(created.status).toBe(201);
    const profileId = created.body.enterprise_profile.id as string;

    const matchRun = await request(app)
      .post('/api/match-runs')
      .set('Authorization', `Bearer ${token}`)
      .send({ enterprise_profile_id: profileId });
    expect(matchRun.status).toBe(201);
    expect(matchRun.body.results.length).toBe(3);
    expect(matchRun.body.results[0].final_score).toBeGreaterThanOrEqual(0);

    const runId = matchRun.body.match_run.id as string;
    const report = await request(app)
      .post(`/api/match-runs/${runId}/report`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(report.status).toBe(201);
    expect(report.body.report.content_text).toContain('综合结论');
  });

  it('prevents users from generating a profile from another user lookup record', async () => {
    const tokenA = await register('lookup-owner@example.com');
    const tokenB = await register('lookup-other@example.com');

    const lookup = await request(app)
      .post('/api/company-lookup/search')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ query_name: '龙华智造' });
    const lookupId = lookup.body.candidates[0].lookup_id as string;

    const generated = await request(app)
      .post(`/api/company-lookup/${lookupId}/generate-profile`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send();

    expect(generated.status).toBe(404);
  });

  it('rejects an incomplete manually entered profile', async () => {
    const token = await register('missing@example.com');

    const created = await request(app)
      .post('/api/enterprise-profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...manualProfile, company_name: '' });

    expect(created.status).toBe(400);
    expect(created.body.error_code).toBe('VALIDATION_ERROR');
  });

  it('prevents users from reading another user profile or match run', async () => {
    const tokenA = await register('owner@example.com');
    const tokenB = await register('other@example.com');

    const profileId = await createManualProfile(tokenA);
    const matchRun = await request(app)
      .post('/api/match-runs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ enterprise_profile_id: profileId });
    const runId = matchRun.body.match_run.id as string;

    const profileLeak = await request(app).get(`/api/enterprise-profiles/${profileId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(profileLeak.status).toBe(404);

    const runLeak = await request(app).get(`/api/match-runs/${runId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(runLeak.status).toBe(404);
  });
});

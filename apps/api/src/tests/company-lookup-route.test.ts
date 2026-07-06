import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { planCompanyLookup } from '@policy-match/ai';
import { pool } from '../db/pool.js';
import { searchCuratedEnterpriseResearch } from '../data/curated-enterprises.js';
import { searchDemoCompanies } from '../data/demo-companies.js';
import { researchCompaniesWithDoubaoDetailed } from '../services/company-research.js';
import { createApp } from '../app.js';

vi.mock('@policy-match/ai', () => ({
  planCompanyLookup: vi.fn(),
  extractEnterpriseProfile: vi.fn(),
  generateReport: vi.fn(),
  reviewPolicyMatch: vi.fn()
}));

vi.mock('../config/env.js', () => ({
  env: {
    corsOrigin: 'http://localhost:5173',
    deepseekApiKey: 'test-deepseek-key',
    deepseekModel: 'deepseek-v4-flash',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekTimeoutMs: 1000,
    matchReviewPolicyLimit: 20,
    matchReviewConcurrency: 3,
    doubaoApiKey: 'test-doubao-key',
    doubaoModel: 'doubao-seed-2-0-mini-260428',
    doubaoBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3/responses',
    doubaoTimeoutMs: 1000,
    doubaoDirectFallback: false,
    doubaoResolveIp: undefined,
    doubaoLocalAddress: undefined
  }
}));

vi.mock('../db/pool.js', () => ({
  pool: {
    query: vi.fn()
  }
}));

vi.mock('../services/auth.js', () => ({
  requireAuth: (req: { user?: { id: string; email: string; display_name: string } }, _res: unknown, next: () => void) => {
    req.user = { id: 'test-user-id', email: 'test@example.com', display_name: 'Test User' };
    next();
  },
  createSession: vi.fn(),
  hashPassword: vi.fn(),
  hashToken: vi.fn(),
  verifyPassword: vi.fn()
}));

vi.mock('../data/curated-enterprises.js', () => ({
  searchCuratedEnterpriseResearch: vi.fn()
}));

vi.mock('../data/demo-companies.js', () => ({
  searchDemoCompanies: vi.fn()
}));

vi.mock('../services/company-research.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/company-research.js')>();
  return {
    ...actual,
    researchCompaniesWithDoubaoDetailed: vi.fn()
  };
});

const app = createApp();

describe('company lookup route blocking behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(planCompanyLookup).mockResolvedValue({
      normalized_query: '华龙迅达',
      search_keywords: ['华龙迅达', '华龙迅达公司'],
      recommended_sources: ['doubao_web_search'],
      explanation: '查询为中文公司名称。',
      ai_mode: 'deepseek'
    });
    vi.mocked(searchCuratedEnterpriseResearch).mockReturnValue([]);
    vi.mocked(searchDemoCompanies).mockReturnValue([
      {
        company_name: '深圳市龙华演示科技有限公司',
        credit_code: 'DEMO-LH-001',
        business_address: '深圳市龙华区',
        registration_status: '存续',
        registered_year: 2020,
        registered_capital: 1000000,
        industry: '软件和信息技术服务业',
        business_scope: '软件开发。',
        is_high_tech_enterprise: false,
        is_tech_sme: false,
        has_specialized_new_sme: false
      }
    ]);
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 'lookup-demo-id' }] } as never);
  });

  it('blocks lookup instead of falling back to demo or inferred draft when Doubao parsing fails', async () => {
    vi.mocked(researchCompaniesWithDoubaoDetailed).mockRejectedValue(
      new Error('Unexpected non-whitespace character after JSON at position 2455')
    );

    const response = await request(app)
      .post('/api/company-lookup/search')
      .set('Authorization', 'Bearer test-token')
      .send({ query_name: '华龙迅达' });

    expect(response.status).toBe(200);
    expect(response.body.candidates).toEqual([]);
    expect(response.body.scope_warning.message).toContain('未能核验');
    expect(response.body.scope_warning.message).not.toContain('待确认主体');
    expect(searchDemoCompanies).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('blocks lookup instead of creating a pending-subject draft when no Longhua candidate is verified', async () => {
    vi.mocked(researchCompaniesWithDoubaoDetailed).mockResolvedValue({
      candidates: [],
      rejected_companies: []
    });
    vi.mocked(searchDemoCompanies).mockReturnValue([]);

    const response = await request(app)
      .post('/api/company-lookup/search')
      .set('Authorization', 'Bearer test-token')
      .send({ query_name: '华龙迅达' });

    expect(response.status).toBe(200);
    expect(response.body.candidates).toEqual([]);
    expect(response.body.scope_warning.message).toContain('未找到可核验的深圳市龙华区企业主体');
    expect(JSON.stringify(response.body)).not.toContain('UNCONFIRMED-');
    expect(JSON.stringify(response.body)).not.toContain('待确认主体');
    expect(pool.query).not.toHaveBeenCalled();
  });
});

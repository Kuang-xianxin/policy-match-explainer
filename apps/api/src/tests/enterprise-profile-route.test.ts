import type { EnterpriseProfile } from '@policy-match/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../db/pool.js';
import { createApp } from '../app.js';

vi.mock('../config/env.js', () => ({
  env: {
    corsOrigin: 'http://localhost:5173',
    deepseekApiKey: '',
    deepseekModel: 'deepseek-v4-flash',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekTimeoutMs: 1000,
    matchReviewPolicyLimit: 20,
    matchReviewConcurrency: 3,
    doubaoApiKey: '',
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
    req.user = { id: 'profile-user-id', email: 'profile@example.com', display_name: 'Profile User' };
    next();
  },
  createSession: vi.fn(),
  hashPassword: vi.fn(),
  hashToken: vi.fn(),
  verifyPassword: vi.fn()
}));

type ProfileRow = {
  id: string;
  user_id: string;
  company_name: string;
  credit_code: string;
  profile: EnterpriseProfile;
  field_sources: unknown[];
  source_type: string;
  verification_status: string;
  created_at: string;
  updated_at: string;
  was_created?: boolean;
};

const app = createApp();

const baseProfile: EnterpriseProfile = {
  company_name: '深圳市重复测试科技有限公司',
  credit_code: '91440300DUPLICATE1',
  city: '深圳市',
  district: '龙华区',
  registered_year: 2021,
  listed_status: 'unlisted',
  employee_count: 20,
  industry: '软件和信息技术服务业',
  main_business: '企业数字化软件研发和技术服务',
  main_products: ['企业管理系统'],
  customer_type: ['enterprise'],
  business_model: 'SaaS',
  main_revenue_source: '软件订阅和技术服务',
  revenue_last_year: 1000000,
  profit_last_year: 100000,
  tax_paid_last_year: 50000,
  rd_expense_last_year: 200000,
  rd_expense_ratio: 20,
  rd_employee_count: 8,
  is_high_tech_enterprise: false,
  is_tech_sme: false,
  has_specialized_new_sme: false,
  patent_count: 0,
  software_copyright_count: 2,
  tax_credit_level: 'unknown',
  has_major_violation: false,
  social_security_normal: true,
  apply_project_name: '数字化系统研发项目',
  project_direction: '数字化转型',
  project_stage: 'developing',
  project_budget: 500000,
  business_address: '深圳市龙华区民治街道'
};

function normalizeCreditCode(value: string): string {
  return value.trim().toUpperCase();
}

function installProfileRoutePoolMock(seedRows: ProfileRow[] = []) {
  const rows: ProfileRow[] = [...seedRows];
  let insertCounter = rows.length;

  vi.mocked(pool.query).mockImplementation(async (sql, params = []) => {
    const text = String(sql).replace(/\s+/g, ' ');

    if (text.includes('WITH existing_profile')) {
      const userId = String(params[0]);
      const companyName = String(params[1]);
      const creditCode = String(params[2]);
      const profile = JSON.parse(String(params[3])) as EnterpriseProfile;
      const fieldSources = JSON.parse(String(params[4])) as unknown[];
      const sourceType = String(params[5]);
      const verificationStatus = String(params[6]);
      const existing = rows.find(
        (row) => row.user_id === userId && normalizeCreditCode(row.credit_code) === creditCode
      );

      if (existing) {
        Object.assign(existing, {
          company_name: companyName,
          credit_code: creditCode,
          profile,
          field_sources: fieldSources,
          source_type: sourceType,
          verification_status: verificationStatus,
          updated_at: '2026-07-06T09:00:00.000Z',
          was_created: false
        });
        return { rows: [existing] } as never;
      }

      insertCounter += 1;
      const inserted: ProfileRow = {
        id: `profile-${insertCounter}`,
        user_id: userId,
        company_name: companyName,
        credit_code: creditCode,
        profile,
        field_sources: fieldSources,
        source_type: sourceType,
        verification_status: verificationStatus,
        created_at: '2026-07-06T08:00:00.000Z',
        updated_at: '2026-07-06T08:00:00.000Z',
        was_created: true
      };
      rows.push(inserted);
      return { rows: [inserted] } as never;
    }

    if (text.includes('INSERT INTO enterprise_profiles')) {
      const profile = JSON.parse(String(params[3])) as EnterpriseProfile;
      insertCounter += 1;
      const inserted: ProfileRow = {
        id: `profile-${insertCounter}`,
        user_id: String(params[0]),
        company_name: String(params[1]),
        credit_code: String(params[2]),
        profile,
        field_sources: JSON.parse(String(params[4])) as unknown[],
        source_type: String(params[5]),
        verification_status: String(params[6]),
        created_at: `2026-07-06T08:0${insertCounter}:00.000Z`,
        updated_at: `2026-07-06T08:0${insertCounter}:00.000Z`
      };
      rows.push(inserted);
      return { rows: [inserted] } as never;
    }

    if (text.includes('DISTINCT ON')) {
      const userId = String(params[0]);
      const latestByCredit = new Map<string, ProfileRow>();
      for (const row of rows.filter((item) => item.user_id === userId)) {
        const key = normalizeCreditCode(row.credit_code);
        const current = latestByCredit.get(key);
        if (!current || row.updated_at > current.updated_at) latestByCredit.set(key, row);
      }
      return {
        rows: [...latestByCredit.values()].sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      } as never;
    }

    if (text.includes('SELECT * FROM enterprise_profiles WHERE user_id = $1')) {
      return {
        rows: rows
          .filter((row) => row.user_id === params[0])
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
      } as never;
    }

    throw new Error(`Unexpected SQL in enterprise profile route test: ${text}`);
  });
}

describe('enterprise profile route dedupe behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates an existing user profile with the same credit code instead of creating a duplicate', async () => {
    installProfileRoutePoolMock();

    const first = await request(app)
      .post('/api/enterprise-profiles')
      .set('Authorization', 'Bearer test-token')
      .send(baseProfile);
    const second = await request(app)
      .post('/api/enterprise-profiles')
      .set('Authorization', 'Bearer test-token')
      .send({ ...baseProfile, company_name: '深圳市重复测试科技有限公司（已更新）' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.enterprise_profile.id).toBe(first.body.enterprise_profile.id);
    expect(second.body.enterprise_profile.company_name).toBe('深圳市重复测试科技有限公司（已更新）');
  });

  it('returns only the latest profile per credit code when legacy duplicate rows already exist', async () => {
    installProfileRoutePoolMock([
      {
        id: 'old-profile',
        user_id: 'profile-user-id',
        company_name: '深圳市重复测试科技有限公司',
        credit_code: '91440300DUPLICATE1',
        profile: baseProfile,
        field_sources: [],
        source_type: 'manual',
        verification_status: 'manual',
        created_at: '2026-07-06T08:00:00.000Z',
        updated_at: '2026-07-06T08:00:00.000Z'
      },
      {
        id: 'new-profile',
        user_id: 'profile-user-id',
        company_name: '深圳市重复测试科技有限公司（最新）',
        credit_code: '91440300DUPLICATE1',
        profile: { ...baseProfile, company_name: '深圳市重复测试科技有限公司（最新）' },
        field_sources: [],
        source_type: 'manual',
        verification_status: 'manual',
        created_at: '2026-07-06T08:10:00.000Z',
        updated_at: '2026-07-06T08:10:00.000Z'
      }
    ]);

    const response = await request(app).get('/api/enterprise-profiles').set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.enterprise_profiles).toHaveLength(1);
    expect(response.body.enterprise_profiles[0].id).toBe('new-profile');
  });
});

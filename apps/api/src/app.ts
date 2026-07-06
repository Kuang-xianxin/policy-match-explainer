import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import {
  companyLookupSearchSchema,
  createMatchRunSchema,
  enterpriseProfileSchema,
  loginSchema,
  registerSchema,
  type CompanyLookupCandidate,
  type EnterpriseProfile,
  type FieldSource,
  type ProfileFieldSourceType,
  type Policy
} from '@policy-match/shared';
import { extractEnterpriseProfile, generateReport, planCompanyLookup, reviewPolicyMatch } from '@policy-match/ai';
import { evaluatePolicy, levelFromFinalScore } from '@policy-match/matcher';
import { env } from './config/env.js';
import { searchCuratedEnterpriseResearch } from './data/curated-enterprises.js';
import { searchDemoCompanies, type DemoCompanyPayload } from './data/demo-companies.js';
import { pool } from './db/pool.js';
import {
  createProfileFromResearchPayload,
  missingFieldsForProfile,
  researchCompaniesWithDoubao,
  researchFieldSources,
  type CompanyResearchPayload
} from './services/company-research.js';
import { createSession, hashPassword, hashToken, requireAuth, verifyPassword, type AuthenticatedRequest } from './services/auth.js';
import { mapPolicyReviewCandidates, selectPolicyReviewCandidates } from './services/policy-match-selection.js';

function asyncHandler<T extends Request>(handler: (req: T, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as T, res).catch(next);
  };
}

function aiConfig() {
  return {
    apiKey: env.deepseekApiKey,
    model: env.deepseekModel,
    baseUrl: env.deepseekBaseUrl,
    timeoutMs: env.deepseekTimeoutMs
  };
}

function doubaoConfig() {
  return {
    apiKey: env.doubaoApiKey,
    model: env.doubaoModel,
    baseUrl: env.doubaoBaseUrl,
    timeoutMs: env.doubaoTimeoutMs,
    directFallback: env.doubaoDirectFallback,
    directResolvedIp: env.doubaoResolveIp,
    directLocalAddress: env.doubaoLocalAddress
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function databaseErrorResponse(error: unknown): { code?: string; message: string } | null {
  const dbError = error as { code?: string; message?: string };
  const message = dbError.message ?? '';
  const code = dbError.code;
  if (
    code === '28P01' ||
    code === '28000' ||
    code === '3D000' ||
    code === 'ECONNREFUSED' ||
    message.toLowerCase().includes('password authentication failed') ||
    message.toLowerCase().includes('connect econnrefused')
  ) {
    return { code, message };
  }
  return null;
}

const customerTypes = ['government', 'enterprise', 'individual', 'overseas', 'other'] as const;
const businessModels = ['B2B', 'B2G', 'B2C', 'SaaS', 'platform', 'manufacturing', 'service', 'other'] as const;
const projectStages = ['planning', 'researching', 'developing', 'launched', 'scaling'] as const;
const fieldSourceTypes: ProfileFieldSourceType[] = [
  'manual',
  'official_open_data',
  'official_public_page',
  'commercial_api',
  'local_seed',
  'inferred'
];

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function simpleHash(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(6, '0').slice(0, 8);
}

function normalizeDraftCompanyName(queryName: string): string {
  const cleanName = queryName.trim().replace(/\s+/g, '');
  if (/公司|企业|厂$/u.test(cleanName)) return cleanName;
  return `${cleanName}（待确认主体）`;
}

function candidateConfidence(queryName: string, candidate: DemoCompanyPayload): number {
  const query = queryName.trim().toLowerCase();
  const target = `${candidate.company_name} ${candidate.credit_code} ${candidate.industry} ${candidate.business_scope}`.toLowerCase();
  if (candidate.company_name.toLowerCase() === query) return 0.96;
  if (candidate.company_name.toLowerCase().includes(query)) return 0.9;
  if (candidate.credit_code.toLowerCase() === query) return 0.95;
  return target.includes(query) ? 0.78 : 0.68;
}

function createInferredCompanyPayload(queryName: string): DemoCompanyPayload & { source_type: 'inferred'; query_name: string } {
  const query = queryName.trim();
  const companyName = normalizeDraftCompanyName(query);
  const text = `${query} ${companyName}`.toLowerCase();
  const isManufacturing = /装备|制造|机器人|自动化/u.test(text);
  const industry = isManufacturing ? '智能制造装备' : '软件和信息技术服务业';
  const businessScope = isManufacturing
    ? `${companyName}相关的智能制造、自动化设备、数字化产线和技术服务，具体经营范围待用户确认。`
    : `${companyName}相关的软件开发、人工智能、数据治理、企业数字化服务，具体经营范围待用户确认。`;

  return {
    query_name: query,
    source_type: 'inferred',
    company_name: companyName,
    credit_code: `UNCONFIRMED-${simpleHash(companyName)}`,
    business_address: '深圳市龙华区（系统默认范围，待用户确认）',
    registration_status: '未验证',
    registered_year: new Date().getFullYear(),
    registered_capital: 0,
    industry,
    business_scope: businessScope,
    is_high_tech_enterprise: false,
    is_tech_sme: false,
    has_specialized_new_sme: false
  };
}

function inferProjectDirection(raw: Partial<DemoCompanyPayload>): EnterpriseProfile['project_direction'] {
  const text = `${raw.industry ?? ''} ${raw.business_scope ?? ''}`;
  if (text.includes('智能制造') || text.includes('装备')) return '智能制造';
  if (text.includes('数据')) return '数据治理';
  if (text.includes('AI') || text.includes('人工智能')) return 'AI';
  return '数据治理';
}

function generatedProfileFromLookup(
  rawPayload: Record<string, unknown>,
  mappedProfile: Partial<EnterpriseProfile>
): EnterpriseProfile {
  const raw = rawPayload as Partial<DemoCompanyPayload>;
  const companyName = stringValue(raw.company_name, stringValue(mappedProfile.company_name, '待确认企业'));
  const scope = stringValue(raw.business_scope, stringValue(mappedProfile.main_business, '待补充'));
  const inferredProducts = Array.isArray(mappedProfile.main_products)
    ? mappedProfile.main_products.map(String).filter(Boolean)
    : [];
  const inferredCustomerTypes = Array.isArray(mappedProfile.customer_type)
    ? mappedProfile.customer_type.filter((item): item is EnterpriseProfile['customer_type'][number] =>
        customerTypes.includes(item as EnterpriseProfile['customer_type'][number])
      )
    : [];
  const inferredBusinessModel = businessModels.includes(mappedProfile.business_model as EnterpriseProfile['business_model'])
    ? mappedProfile.business_model
    : 'other';
  const inferredProjectStage = projectStages.includes(mappedProfile.project_stage as EnterpriseProfile['project_stage'])
    ? mappedProfile.project_stage
    : 'planning';

  return enterpriseProfileSchema.parse({
    company_name: companyName,
    credit_code: stringValue(raw.credit_code, stringValue(mappedProfile.credit_code, 'UNKNOWN-CODE')),
    city: '深圳市',
    district: '龙华区',
    registered_year: numberValue(raw.registered_year, new Date().getFullYear()),
    listed_status: 'unknown',
    employee_count: 0,
    industry: stringValue(raw.industry, stringValue(mappedProfile.industry, '待补充')),
    main_business: stringValue(mappedProfile.main_business, scope),
    main_products: inferredProducts,
    customer_type: inferredCustomerTypes,
    business_model: inferredBusinessModel,
    main_revenue_source: stringValue(mappedProfile.main_revenue_source, '待补充'),
    revenue_last_year: 0,
    profit_last_year: 0,
    tax_paid_last_year: 0,
    rd_expense_last_year: 0,
    rd_expense_ratio: 0,
    rd_employee_count: 0,
    is_high_tech_enterprise: booleanValue(raw.is_high_tech_enterprise),
    is_tech_sme: booleanValue(raw.is_tech_sme),
    has_specialized_new_sme: booleanValue(raw.has_specialized_new_sme),
    patent_count: 0,
    software_copyright_count: 0,
    tax_credit_level: 'unknown',
    has_major_violation: false,
    social_security_normal: true,
    apply_project_name: `${companyName}数字化转型项目`,
    project_direction: stringValue(mappedProfile.project_direction, inferProjectDirection(raw)),
    project_stage: inferredProjectStage,
    project_budget: 0,
    registered_capital: numberValue(raw.registered_capital, 0),
    business_address: stringValue(raw.business_address, ''),
    digital_transformation_status: stringValue(mappedProfile.digital_transformation_status, ''),
    award_titles: Array.isArray(mappedProfile.award_titles) ? mappedProfile.award_titles.map(String).filter(Boolean) : [],
    employee_range: 'unknown',
    revenue_range: 'unknown',
    profit_range: 'unknown',
    tax_paid_range: 'unknown',
    rd_expense_range: 'unknown',
    rd_employee_range: 'unknown',
    project_budget_range: 'unknown'
  });
}

function baseFieldSources(raw: DemoCompanyPayload & { source_type?: string }, sourceName: string): FieldSource[] {
  const isInferredDraft = raw.source_type === 'inferred';
  const fields: Array<keyof EnterpriseProfile> = [
    'company_name',
    'credit_code',
    'city',
    'district',
    'registered_year',
    'registered_capital',
    'business_address',
    'industry',
    'main_business',
    'is_high_tech_enterprise',
    'is_tech_sme',
    'has_specialized_new_sme'
  ];
  return fields.map((fieldKey) => ({
    field_key: fieldKey,
    source_name: sourceName,
    source_type: isInferredDraft ? 'inferred' : 'local_seed',
    confidence: isInferredDraft ? 0.48 : fieldKey in raw || fieldKey === 'city' || fieldKey === 'district' ? 0.88 : 0.7,
    is_user_confirmed: false
  }));
}

function isCompanyResearchPayload(raw: unknown): raw is CompanyResearchPayload {
  return Boolean(
    raw &&
      typeof raw === 'object' &&
      typeof (raw as { company_name?: unknown }).company_name === 'string' &&
      Array.isArray((raw as { evidence?: unknown }).evidence)
  );
}

function cleanFieldSources(sources: unknown, fallbackSourceName: string, forceInferred: boolean): FieldSource[] {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source): FieldSource | null => {
      if (!source || typeof source !== 'object') return null;
      const item = source as Partial<FieldSource>;
      const sourceType =
        !forceInferred && item.source_type && fieldSourceTypes.includes(item.source_type)
          ? item.source_type
          : 'inferred';
      const confidence = Number(item.confidence);
      return {
        field_key: stringValue(item.field_key, 'unknown'),
        source_name: forceInferred ? fallbackSourceName : stringValue(item.source_name, fallbackSourceName),
        source_type: sourceType,
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : forceInferred ? 0.48 : 0.5,
        is_user_confirmed: item.is_user_confirmed === true
      };
    })
    .filter((item): item is FieldSource => item !== null);
}

function dedupeFieldSources(sources: FieldSource[]): FieldSource[] {
  const seen = new Set<string>();
  const deduped: FieldSource[] = [];
  for (const source of sources) {
    const key = `${source.field_key}:${source.source_type}:${source.source_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }
  return deduped;
}

function sourceTypeFromFieldSources(fieldSources: FieldSource[]): ProfileFieldSourceType {
  const precedence: ProfileFieldSourceType[] = [
    'commercial_api',
    'official_open_data',
    'official_public_page',
    'local_seed',
    'manual',
    'inferred'
  ];
  for (const sourceType of precedence) {
    if (fieldSources.some((source) => source.source_type === sourceType)) return sourceType;
  }
  return 'manual';
}

function verificationStatusFromSourceType(sourceType: ProfileFieldSourceType): string {
  if (sourceType === 'inferred') return 'inferred';
  if (sourceType === 'manual') return 'manual';
  return 'verified';
}

function parseProfileSavePayload(body: unknown): {
  profile: EnterpriseProfile;
  fieldSources: FieldSource[];
  sourceType: ProfileFieldSourceType;
  verificationStatus: string;
} {
  const candidate = body && typeof body === 'object' && 'profile' in body ? (body as { profile?: unknown }) : null;
  const profile = enterpriseProfileSchema.parse(candidate?.profile ?? body);
  const rawFieldSources = candidate ? (body as { field_sources?: unknown }).field_sources : [];
  const fieldSources = cleanFieldSources(rawFieldSources, 'manual_profile_input', false);
  const sourceType = sourceTypeFromFieldSources(fieldSources);
  return {
    profile,
    fieldSources,
    sourceType,
    verificationStatus: verificationStatusFromSourceType(sourceType)
  };
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', asyncHandler(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'postgresql' });
  }));

  app.get('/api/ai/status', (_req, res) => {
    res.json({
      provider: 'deepseek',
      configured: Boolean(env.deepseekApiKey && env.deepseekApiKey.trim().length > 0),
      model: env.deepseekModel,
      mode: env.deepseekApiKey ? 'deepseek' : 'mock',
      key_source: env.deepseekApiKeySource ?? null,
      providers: {
        deepseek: {
          configured: Boolean(env.deepseekApiKey && env.deepseekApiKey.trim().length > 0),
          model: env.deepseekModel,
          key_source: env.deepseekApiKeySource ?? null
        },
        doubao: {
          configured: Boolean(env.doubaoApiKey && env.doubaoApiKey.trim().length > 0),
          model: env.doubaoModel,
          base_url: env.doubaoBaseUrl,
          key_source: env.doubaoApiKeySource ?? null,
          direct_fallback: env.doubaoDirectFallback,
          direct_resolved_ip: env.doubaoResolveIp ?? null,
          direct_local_address: env.doubaoLocalAddress ?? null
        }
      }
    });
  });

  app.post('/api/auth/register', asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const result = await pool.query(
      `
      INSERT INTO users (email, password_hash, display_name)
      VALUES ($1, $2, $3)
      RETURNING id, email, display_name
      `,
      [body.email.toLowerCase(), hashPassword(body.password), body.display_name]
    );
    const user = result.rows[0];
    const token = await createSession(user.id);
    res.status(201).json({ user, token });
  }));

  app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await pool.query('SELECT id, email, display_name, password_hash FROM users WHERE email = $1', [
      body.email.toLowerCase()
    ]);
    const user = result.rows[0];
    if (!user || !verifyPassword(body.password, user.password_hash)) {
      res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Invalid email or password.' });
      return;
    }
    const token = await createSession(user.id);
    res.json({ user: { id: user.id, email: user.email, display_name: user.display_name }, token });
  }));

  app.post('/api/auth/logout', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
    res.json({ ok: true });
  }));

  app.get('/api/auth/me', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    res.json({ user: req.user });
  }));

  app.get('/api/policies', requireAuth, asyncHandler<AuthenticatedRequest>(async (_req, res) => {
    const result = await pool.query('SELECT id, title, category, source_url, status, policy_text, rules FROM policies ORDER BY title');
    res.json({ policies: result.rows });
  }));

  app.post('/api/company-lookup/search', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = companyLookupSearchSchema.parse(req.body);
    const plan = await planCompanyLookup(body.query_name, aiConfig());
    const candidates: CompanyLookupCandidate[] = [];
    let lookupPlan = plan;
    const curatedCompanies = searchCuratedEnterpriseResearch([body.query_name, ...plan.search_keywords]);

    for (const company of curatedCompanies) {
      const inserted = await pool.query(
        `
        INSERT INTO company_lookup_records (
          user_id, query_name, selected_company_name, selected_credit_code,
          source_name, source_type, raw_payload, confidence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING id
        `,
        [
          req.user.id,
          body.query_name,
          company.company_name,
          company.credit_code,
          'curated_public_enterprise_index',
          company.source_type,
          JSON.stringify(company),
          company.confidence
        ]
      );

      candidates.push({
        lookup_id: inserted.rows[0].id,
        company_name: company.company_name,
        credit_code: company.credit_code,
        business_address: company.business_address ?? '',
        registration_status: company.registration_status ?? '公开资料待核验',
        source_name: '公开证据企业索引',
        source_type: company.source_type,
        confidence: company.confidence
      });
    }

    if (curatedCompanies.length > 0) {
      lookupPlan = {
        ...plan,
        recommended_sources: Array.from(new Set(['curated_public_enterprise_index', ...plan.recommended_sources])),
        explanation: `${plan.explanation} 已命中本地公开证据企业索引。`
      };
    }

    if (candidates.length === 0 && env.doubaoApiKey) {
      try {
        const researchedCompanies = await researchCompaniesWithDoubao(body.query_name, plan.search_keywords, doubaoConfig());
        for (const company of researchedCompanies) {
          const inserted = await pool.query(
            `
            INSERT INTO company_lookup_records (
              user_id, query_name, selected_company_name, selected_credit_code,
              source_name, source_type, raw_payload, confidence
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
            RETURNING id
            `,
            [
              req.user.id,
              body.query_name,
              company.company_name,
              company.credit_code,
              'doubao_web_search',
              company.source_type,
              JSON.stringify(company),
              company.confidence
            ]
          );

          candidates.push({
            lookup_id: inserted.rows[0].id,
            company_name: company.company_name,
            credit_code: company.credit_code,
            business_address: company.business_address ?? '',
            registration_status: company.registration_status ?? '公开资料待核验',
            source_name: '豆包联网搜索证据',
            source_type: company.source_type,
            confidence: company.confidence
          });
        }

        lookupPlan = {
          ...plan,
          ai_mode: 'doubao',
          recommended_sources: Array.from(new Set(['doubao_web_search', ...plan.recommended_sources])),
          explanation: `${plan.explanation} 已优先调用豆包联网搜索获取公开证据。`
        };
      } catch (error) {
        lookupPlan = {
          ...plan,
          recommended_sources: Array.from(new Set(['doubao_web_search', ...plan.recommended_sources])),
          explanation: `${plan.explanation} 豆包联网搜索失败，已退回本地索引/待确认草稿：${
            error instanceof Error ? error.message : String(error)
          }`
        };
      }
    }

    const searched = candidates.length > 0 ? [] : searchDemoCompanies([body.query_name, ...plan.search_keywords])
      .map((company) => ({ company, confidence: candidateConfidence(body.query_name, company) }))
      .filter((item) => item.confidence >= 0.7)
      .sort((a, b) => b.confidence - a.confidence);

    for (const { company, confidence } of searched) {
      const inserted = await pool.query(
        `
        INSERT INTO company_lookup_records (
          user_id, query_name, selected_company_name, selected_credit_code,
          source_name, source_type, raw_payload, confidence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING id
        `,
        [
          req.user.id,
          body.query_name,
          company.company_name,
          company.credit_code,
          'local_longhua_demo_registry',
          'local_seed',
          JSON.stringify(company),
          confidence
        ]
      );

      candidates.push({
        lookup_id: inserted.rows[0].id,
        company_name: company.company_name,
        credit_code: company.credit_code,
        business_address: company.business_address,
        registration_status: company.registration_status,
        source_name: '本地龙华企业示例库',
        source_type: 'local_seed',
        confidence
      });
    }

    if (candidates.length === 0) {
      const inferred = createInferredCompanyPayload(body.query_name);
      const inserted = await pool.query(
        `
        INSERT INTO company_lookup_records (
          user_id, query_name, selected_company_name, selected_credit_code,
          source_name, source_type, raw_payload, confidence
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING id
        `,
        [
          req.user.id,
          body.query_name,
          inferred.company_name,
          inferred.credit_code,
          'ai_inferred_company_draft',
          'inferred',
          JSON.stringify(inferred),
          0.48
        ]
      );

      candidates.push({
        lookup_id: inserted.rows[0].id,
        company_name: inferred.company_name,
        credit_code: inferred.credit_code,
        business_address: inferred.business_address,
        registration_status: inferred.registration_status,
        source_name: 'AI 画像草稿（待用户确认）',
        source_type: 'inferred',
        confidence: 0.48
      });
    }

    res.json({ lookup_plan: lookupPlan, candidates });
  }));

  app.post('/api/company-lookup/:id/generate-profile', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await pool.query('SELECT * FROM company_lookup_records WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    const record = result.rows[0];
    if (!record) {
      res.status(404).json({ error_code: 'NOT_FOUND', message: 'Company lookup record not found.' });
      return;
    }

    const rawPayload = record.raw_payload as Record<string, unknown>;
    const extracted = await extractEnterpriseProfile({ rawPayload, sourceName: record.source_name }, aiConfig());
    const enterpriseProfile = isCompanyResearchPayload(rawPayload)
      ? createProfileFromResearchPayload(rawPayload, extracted.mapped_profile)
      : generatedProfileFromLookup(rawPayload, extracted.mapped_profile);
    const isInferredLookup = record.source_type === 'inferred';
    const fieldSources = isCompanyResearchPayload(rawPayload)
      ? dedupeFieldSources([
          ...researchFieldSources(rawPayload, record.source_name),
          ...cleanFieldSources(extracted.field_sources, record.source_name, false)
        ])
      : dedupeFieldSources([
          ...baseFieldSources(rawPayload as unknown as DemoCompanyPayload, record.source_name),
          ...cleanFieldSources(extracted.field_sources, record.source_name, isInferredLookup)
        ]);
    const missingFields = Array.from(
      new Set(
        isCompanyResearchPayload(rawPayload)
          ? missingFieldsForProfile(enterpriseProfile)
          : [
              ...extracted.missing_fields,
              'employee_count',
              'revenue_last_year',
              'profit_last_year',
              'tax_paid_last_year',
              'rd_expense_last_year',
              'rd_employee_count',
              'project_budget'
            ]
      )
    );

    await pool.query(
      `
      UPDATE company_lookup_records
      SET mapped_profile = $1::jsonb,
          field_sources = $2::jsonb,
          missing_fields = $3::jsonb,
          ai_extracted_profile = $4::jsonb,
          ai_confidence = $5,
          ai_model_name = $6,
          ai_prompt_snapshot = $7
      WHERE id = $8 AND user_id = $9
      `,
      [
        JSON.stringify(enterpriseProfile),
        JSON.stringify(fieldSources),
        JSON.stringify(missingFields),
        JSON.stringify(extracted.mapped_profile),
        extracted.ai_confidence,
        extracted.ai_mode === 'deepseek' ? env.deepseekModel : 'mock',
        'generate_lightweight_profile_v1',
        req.params.id,
        req.user.id
      ]
    );

    res.json({
      enterprise_profile: enterpriseProfile,
      field_sources: fieldSources,
      missing_fields: missingFields,
      ai_confidence: extracted.ai_confidence,
      ai_mode: extracted.ai_mode
    });
  }));

  app.post('/api/enterprise-profiles', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { profile, fieldSources, sourceType, verificationStatus } = parseProfileSavePayload(req.body);
    const created = await pool.query(
      `
      INSERT INTO enterprise_profiles (user_id, company_name, credit_code, profile, field_sources, source_type, verification_status)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
      RETURNING *
      `,
      [
        req.user.id,
        profile.company_name,
        profile.credit_code,
        JSON.stringify(profile),
        JSON.stringify(fieldSources),
        sourceType,
        verificationStatus
      ]
    );
    res.status(201).json({ enterprise_profile: created.rows[0] });
  }));

  app.get('/api/enterprise-profiles', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await pool.query('SELECT * FROM enterprise_profiles WHERE user_id = $1 ORDER BY created_at DESC', [
      req.user.id
    ]);
    res.json({ enterprise_profiles: result.rows });
  }));

  app.get('/api/enterprise-profiles/:id', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await pool.query('SELECT * FROM enterprise_profiles WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    const profile = result.rows[0];
    if (!profile) {
      res.status(404).json({ error_code: 'NOT_FOUND', message: 'Enterprise profile not found.' });
      return;
    }
    res.json({ enterprise_profile: profile });
  }));

  app.post('/api/match-runs', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = createMatchRunSchema.parse(req.body);
    const profileResult = await pool.query('SELECT * FROM enterprise_profiles WHERE id = $1 AND user_id = $2', [
      body.enterprise_profile_id,
      req.user.id
    ]);
    const profileRecord = profileResult.rows[0];
    if (!profileRecord) {
      res.status(404).json({ error_code: 'NOT_FOUND', message: 'Enterprise profile not found.' });
      return;
    }

    const profile = enterpriseProfileSchema.parse(profileRecord.profile);
    const profileFieldSources = cleanFieldSources(profileRecord.field_sources, 'saved_profile', false);
    const profileSourceType = stringValue(profileRecord.source_type, sourceTypeFromFieldSources(profileFieldSources));
    const profileVerificationStatus = stringValue(
      profileRecord.verification_status,
      verificationStatusFromSourceType(profileSourceType as ProfileFieldSourceType)
    );
    const profileIsInferred = profileSourceType === 'inferred' || profileVerificationStatus === 'inferred';
    const runResult = await pool.query(
      `
      INSERT INTO match_runs (
        user_id, enterprise_profile_id, profile_snapshot, profile_field_sources,
        profile_source_type, profile_verification_status, ai_model_name, ai_prompt_snapshot
      )
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        req.user.id,
        profileRecord.id,
        JSON.stringify(profile),
        JSON.stringify(profileFieldSources),
        profileSourceType,
        profileVerificationStatus,
        env.deepseekApiKey ? env.deepseekModel : 'mock',
        'review_policy_match_v1'
      ]
    );
    const run = runResult.rows[0];
    const policiesResult = await pool.query(
      'SELECT id, title, category, source_url, status, policy_text, rules FROM policies WHERE jsonb_array_length(rules) > 0 ORDER BY title'
    );
    const policyCandidates = (policiesResult.rows as Policy[]).map((policy) => ({
      policy,
      baseline: evaluatePolicy(profile, policy)
    }));
    const selectedCandidates = selectPolicyReviewCandidates(policyCandidates, env.matchReviewPolicyLimit);
    const results = [];

    const reviewedCandidates = await mapPolicyReviewCandidates(
      selectedCandidates,
      env.matchReviewConcurrency,
      async ({ policy, baseline }) => {
        const aiReview = await reviewPolicyMatch(profile, policy, baseline, aiConfig());
        const hasHardFailure = baseline.hard_failures.length > 0;
        const finalScore = hasHardFailure
          ? baseline.baseline_score
          : clampScore(baseline.baseline_score + aiReview.ai_adjustment);
        const finalLevel = profileIsInferred && !hasHardFailure
          ? 'need_more_info'
          : levelFromFinalScore(finalScore, baseline.baseline_level, hasHardFailure);
        const missingConditions = profileIsInferred
          ? [
              ...baseline.missing_conditions,
              {
                field_key: 'company_identity_verification',
                expected_value: 'verified_enterprise_record',
                evidence_text: '当前画像来自未验证 AI 草稿，正式申报前必须核对企业主体、信用代码和经营地址。',
                required: true
              }
            ]
          : baseline.missing_conditions;
        const riskNotes = profileIsInferred
          ? [...baseline.risk_notes, '画像来源为未验证 AI 草稿，本次结果仅可作为试算参考。']
          : baseline.risk_notes;
        return { policy, baseline, aiReview, finalScore, finalLevel, missingConditions, riskNotes };
      }
    );

    for (const { policy, baseline, aiReview, finalScore, finalLevel, missingConditions, riskNotes } of reviewedCandidates) {
      const inserted = await pool.query(
        `
        INSERT INTO match_results (
          user_id, match_run_id, policy_id, baseline_score, baseline_level,
          matched_conditions, missing_conditions, risk_notes, hard_failures,
          ai_review_summary, ai_explanation, ai_missing_fields, ai_suggested_actions,
          ai_confidence, ai_adjustment, ai_mode, final_score, final_level
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16, $17, $18)
        RETURNING *
        `,
        [
          req.user.id,
          run.id,
          policy.id,
          baseline.baseline_score,
          baseline.baseline_level,
          JSON.stringify(baseline.matched_conditions),
          JSON.stringify(missingConditions),
          JSON.stringify(riskNotes),
          JSON.stringify(baseline.hard_failures),
          aiReview.ai_review_summary,
          aiReview.ai_explanation,
          JSON.stringify(aiReview.ai_missing_fields),
          JSON.stringify(aiReview.ai_suggested_actions),
          aiReview.ai_confidence,
          aiReview.ai_adjustment,
          aiReview.ai_mode,
          finalScore,
          finalLevel
        ]
      );
      results.push({ ...inserted.rows[0], policy });
    }

    res.status(201).json({ match_run: run, results });
  }));

  app.get('/api/match-runs', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await pool.query('SELECT * FROM match_runs WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ match_runs: result.rows });
  }));

  app.get('/api/match-runs/:id', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const runResult = await pool.query('SELECT * FROM match_runs WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const run = runResult.rows[0];
    if (!run) {
      res.status(404).json({ error_code: 'NOT_FOUND', message: 'Match run not found.' });
      return;
    }
    const results = await pool.query(
      `
      SELECT match_results.*, policies.title, policies.category, policies.source_url, policies.policy_text
      FROM match_results
      JOIN policies ON policies.id = match_results.policy_id
      WHERE match_results.match_run_id = $1 AND match_results.user_id = $2
      ORDER BY match_results.final_score DESC
      `,
      [req.params.id, req.user.id]
    );
    const normalizedResults = results.rows.map((row) => ({
      ...row,
      policy: {
        title: row.title,
        category: row.category,
        source_url: row.source_url,
        policy_text: row.policy_text
      }
    }));
    res.json({ match_run: run, results: normalizedResults });
  }));

  app.post('/api/match-runs/:id/report', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const runResult = await pool.query('SELECT * FROM match_runs WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    const run = runResult.rows[0];
    if (!run) {
      res.status(404).json({ error_code: 'NOT_FOUND', message: 'Match run not found.' });
      return;
    }
    const resultsResult = await pool.query('SELECT * FROM match_results WHERE match_run_id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    const report = await generateReport(run.profile_snapshot as EnterpriseProfile, resultsResult.rows, aiConfig());
    const created = await pool.query(
      `
      INSERT INTO reports (user_id, match_run_id, status, content_text, model_name, prompt_snapshot)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [req.user.id, run.id, 'completed', report.content_text, report.ai_mode === 'deepseek' ? env.deepseekModel : 'mock', 'generate_report_v1']
    );
    res.status(201).json({ report: created.rows[0] });
  }));

  app.get('/api/match-runs/:id/report', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const report = await pool.query(
      `
      SELECT reports.*
      FROM reports
      JOIN match_runs ON match_runs.id = reports.match_run_id
      WHERE reports.match_run_id = $1 AND reports.user_id = $2
      ORDER BY reports.created_at DESC
      LIMIT 1
      `,
      [req.params.id, req.user.id]
    );
    if (!report.rows[0]) {
      res.status(404).json({ error_code: 'NOT_FOUND', message: 'Report not found.' });
      return;
    }
    res.json({ report: report.rows[0] });
  }));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const dbError = databaseErrorResponse(error);
    if (dbError) {
      res.status(503).json({
        error_code: 'DATABASE_CONNECTION_ERROR',
        message:
          '数据库连接失败。请确认 Docker PostgreSQL 已启动，且 DATABASE_URL 指向 postgres://policy_user:***@localhost:15432/policy_match。',
        details: {
          code: dbError.code,
          hint: '运行 npm run db:up 后再运行 npm run db:check、npm run db:migrate、npm run db:seed。'
        }
      });
      return;
    }
    if (message.includes('duplicate key')) {
      res.status(409).json({ error_code: 'VALIDATION_ERROR', message: 'Resource already exists.' });
      return;
    }
    res.status(400).json({ error_code: 'VALIDATION_ERROR', message, details: error });
  });

  return app;
}

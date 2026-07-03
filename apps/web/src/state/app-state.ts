import { reactive } from 'vue';
import type { CustomerType, EnterpriseProfile } from '@policy-match/shared';
import {
  api,
  type AiStatus,
  type Candidate,
  type EnterpriseProfileRecord,
  type ExtractResponse,
  type LookupRecord,
  type MatchResult,
  type MatchRun,
  type ReportRecord,
  type UserResponse
} from '../services/api';

export const appState = reactive({
  token: localStorage.getItem('policy_match_token') ?? '',
  user: null as UserResponse['user'] | null,
  statusText: '',
  aiStatus: null as AiStatus | null,
  candidates: [] as Candidate[],
  lookup: null as LookupRecord | null,
  draftProfile: null as EnterpriseProfile | null,
  profiles: [] as EnterpriseProfileRecord[],
  matchRun: null as MatchRun | null,
  matchResults: [] as MatchResult[],
  report: null as ReportRecord | null
});

export async function loadAiStatus(): Promise<void> {
  appState.aiStatus = await api<AiStatus>('/api/ai/status', '');
}

export async function login(email: string, password: string): Promise<void> {
  const data = await api<UserResponse>(
    '/api/auth/login',
    '',
    { method: 'POST', body: JSON.stringify({ email, password }) }
  );
  appState.token = data.token;
  appState.user = data.user;
  localStorage.setItem('policy_match_token', data.token);
  appState.statusText = `已登录：${data.user.display_name}`;
  await loadProfiles();
}

export async function register(email: string, password: string, displayName: string): Promise<void> {
  const data = await api<UserResponse>(
    '/api/auth/register',
    '',
    { method: 'POST', body: JSON.stringify({ email, password, display_name: displayName }) }
  );
  appState.token = data.token;
  appState.user = data.user;
  localStorage.setItem('policy_match_token', data.token);
  appState.statusText = `已注册并登录：${data.user.display_name}`;
  await loadProfiles();
}

export function logout(): void {
  appState.token = '';
  appState.user = null;
  appState.statusText = '已退出';
  appState.candidates = [];
  appState.lookup = null;
  appState.draftProfile = null;
  appState.profiles = [];
  appState.matchRun = null;
  appState.matchResults = [];
  appState.report = null;
  localStorage.removeItem('policy_match_token');
}

export async function searchCompany(queryName: string): Promise<void> {
  const data = await api<{ candidates: Candidate[] }>(
    '/api/company-lookup/search',
    appState.token,
    { method: 'POST', body: JSON.stringify({ query_name: queryName }) }
  );
  appState.candidates = data.candidates;
  appState.lookup = null;
  appState.draftProfile = null;
  appState.statusText = `找到 ${data.candidates.length} 个候选企业`;
}

export async function extractProfile(lookupId: string): Promise<void> {
  const data = await api<ExtractResponse>(
    `/api/company-lookup/${lookupId}/ai-extract`,
    appState.token,
    { method: 'POST' }
  );
  appState.lookup = data.lookup;
  appState.draftProfile = { ...data.extracted_profile };
  appState.statusText = `画像解耦完成：${data.ai_mode === 'deepseek' ? 'DeepSeek API' : 'mock 开发模式'}`;
}

export async function importProfile(): Promise<void> {
  if (!appState.lookup) return;
  const data = await api<{ enterprise_profile: EnterpriseProfileRecord }>(
    `/api/company-lookup/${appState.lookup.id}/import`,
    appState.token,
    { method: 'POST' }
  );
  appState.draftProfile = data.enterprise_profile.profile;
  appState.statusText = `画像已保存：${data.enterprise_profile.company_name}`;
  await loadProfiles();
}

export async function saveManualProfile(): Promise<void> {
  if (!appState.draftProfile) return;
  const data = await api<{ enterprise_profile: EnterpriseProfileRecord }>(
    '/api/enterprise-profiles',
    appState.token,
    { method: 'POST', body: JSON.stringify(appState.draftProfile) }
  );
  appState.statusText = `画像已保存：${data.enterprise_profile.company_name}`;
  await loadProfiles();
}

export async function loadProfiles(): Promise<void> {
  if (!appState.token) return;
  const data = await api<{ enterprise_profiles: EnterpriseProfileRecord[] }>('/api/enterprise-profiles', appState.token);
  appState.profiles = data.enterprise_profiles;
}

export async function runMatch(profileId: string): Promise<void> {
  const data = await api<{ match_run: MatchRun; results: MatchResult[] }>(
    '/api/match-runs',
    appState.token,
    { method: 'POST', body: JSON.stringify({ enterprise_profile_id: profileId }) }
  );
  appState.matchRun = data.match_run;
  appState.matchResults = data.results;
  appState.report = null;
  appState.statusText = `匹配完成：${data.results.length} 条政策，已经过 ${data.results[0]?.ai_mode === 'deepseek' ? 'DeepSeek' : 'mock'} 复核`;
}

export async function generateReport(): Promise<void> {
  if (!appState.matchRun) return;
  const data = await api<{ report: ReportRecord }>(
    `/api/match-runs/${appState.matchRun.id}/report`,
    appState.token,
    { method: 'POST' }
  );
  appState.report = data.report;
  appState.statusText = '报告已生成';
}

export function useDemoProfile(): void {
  appState.lookup = null;
  appState.draftProfile = {
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
}

export function setArrayField(field: 'main_products' | 'customer_type', value: string): void {
  if (!appState.draftProfile) return;
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (field === 'customer_type') {
    const allowed: CustomerType[] = ['government', 'enterprise', 'individual', 'overseas', 'other'];
    appState.draftProfile.customer_type = values.filter((item): item is CustomerType => allowed.includes(item as CustomerType));
    return;
  }
  appState.draftProfile.main_products = values;
}

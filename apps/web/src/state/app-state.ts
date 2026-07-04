import { reactive } from 'vue';
import type { AmountRange, CustomerType, EmployeeRange, EnterpriseProfile, ProfitRange } from '@policy-match/shared';
import {
  api,
  type AiStatus,
  type Candidate,
  type EnterpriseProfileRecord,
  type GenerateProfileResponse,
  type LookupPlan,
  type MatchResult,
  type MatchRun,
  type ReportRecord,
  type UserResponse
} from '../services/api';

const amountRangeValue: Record<AmountRange, number> = {
  unknown: 0,
  none: 0,
  lt_1m: 500000,
  '1m_5m': 3000000,
  '5m_20m': 12000000,
  '20m_100m': 50000000,
  gte_100m: 100000000
};

const profitRangeValue: Record<ProfitRange, number> = {
  unknown: 0,
  loss: -500000,
  break_even: 0,
  lt_500k: 250000,
  '500k_2m': 1000000,
  '2m_10m': 5000000,
  gte_10m: 10000000
};

const employeeRangeValue: Record<EmployeeRange, number> = {
  unknown: 0,
  lt_10: 5,
  '10_50': 30,
  '50_100': 75,
  '100_300': 180,
  gte_300: 300
};

export const appState = reactive({
  token: localStorage.getItem('policy_match_token') ?? '',
  user: null as UserResponse['user'] | null,
  statusText: '',
  aiStatus: null as AiStatus | null,
  isLoadingProfiles: false,
  lookupPlan: null as LookupPlan | null,
  candidates: [] as Candidate[],
  generatedProfileMeta: null as Omit<GenerateProfileResponse, 'enterprise_profile'> | null,
  draftProfile: null as EnterpriseProfile | null,
  profiles: [] as EnterpriseProfileRecord[],
  matchRun: null as MatchRun | null,
  matchResults: [] as MatchResult[],
  report: null as ReportRecord | null
});

export async function loadAiStatus(): Promise<void> {
  appState.aiStatus = await api<AiStatus>('/api/ai/status', '');
}

export async function loadCurrentUser(): Promise<void> {
  if (!appState.token) return;
  const data = await api<{ user: UserResponse['user'] }>('/api/auth/me', appState.token);
  appState.user = data.user;
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
  appState.lookupPlan = null;
  appState.candidates = [];
  appState.generatedProfileMeta = null;
  appState.draftProfile = null;
  appState.profiles = [];
  appState.matchRun = null;
  appState.matchResults = [];
  appState.report = null;
  localStorage.removeItem('policy_match_token');
}

export async function searchCompany(queryName: string): Promise<void> {
  const data = await api<{ lookup_plan: LookupPlan; candidates: Candidate[] }>(
    '/api/company-lookup/search',
    appState.token,
    { method: 'POST', body: JSON.stringify({ query_name: queryName }) }
  );
  appState.lookupPlan = data.lookup_plan;
  appState.candidates = data.candidates;
  appState.generatedProfileMeta = null;
  appState.draftProfile = null;
  appState.statusText = `找到 ${data.candidates.length} 个候选企业`;
}

export async function generateProfileFromCandidate(lookupId: string): Promise<void> {
  const data = await api<GenerateProfileResponse>(
    `/api/company-lookup/${lookupId}/generate-profile`,
    appState.token,
    { method: 'POST' }
  );
  appState.draftProfile = data.enterprise_profile;
  appState.generatedProfileMeta = {
    field_sources: data.field_sources,
    missing_fields: data.missing_fields,
    ai_confidence: data.ai_confidence,
    ai_mode: data.ai_mode
  };
  appState.statusText = `已生成待确认画像：${data.enterprise_profile.company_name}`;
}

export async function smartGenerateAndMatch(queryName: string): Promise<void> {
  await searchCompany(queryName);
  if (appState.candidates.length !== 1) {
    throw new Error('找到多个候选企业，请先选择正确企业后再生成画像。');
  }
  const [candidate] = appState.candidates;
  if (!candidate) throw new Error('未找到可生成画像的候选企业。');
  await generateProfileFromCandidate(candidate.lookup_id);
  const saved = await saveManualProfile();
  if (!saved) throw new Error('画像保存失败，无法发起匹配。');
  await runMatch(saved.id);
}

export async function saveManualProfile(): Promise<EnterpriseProfileRecord | null> {
  if (!appState.draftProfile) return null;
  const payload = appState.generatedProfileMeta
    ? {
        profile: appState.draftProfile,
        field_sources: appState.generatedProfileMeta.field_sources
      }
    : appState.draftProfile;
  const data = await api<{ enterprise_profile: EnterpriseProfileRecord }>(
    '/api/enterprise-profiles',
    appState.token,
    { method: 'POST', body: JSON.stringify(payload) }
  );
  appState.statusText = `画像已保存：${data.enterprise_profile.company_name}`;
  await loadProfiles();
  return data.enterprise_profile;
}

export async function loadProfiles(): Promise<void> {
  if (!appState.token) return;
  appState.isLoadingProfiles = true;
  try {
    const data = await api<{ enterprise_profiles: EnterpriseProfileRecord[] }>('/api/enterprise-profiles', appState.token);
    appState.profiles = data.enterprise_profiles;
  } finally {
    appState.isLoadingProfiles = false;
  }
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

export async function loadLatestMatchRun(): Promise<void> {
  if (!appState.token) return;
  const data = await api<{ match_runs: MatchRun[] }>('/api/match-runs', appState.token);
  const latest = data.match_runs[0];
  if (latest) await loadMatchRun(latest.id);
}

export async function loadMatchRun(runId: string): Promise<void> {
  const data = await api<{ match_run: MatchRun; results: MatchResult[] }>(`/api/match-runs/${runId}`, appState.token);
  appState.matchRun = data.match_run;
  appState.matchResults = data.results;
  appState.report = null;
  await loadReportForRun(runId);
}

export async function loadReportForRun(runId: string): Promise<void> {
  try {
    const data = await api<{ report: ReportRecord }>(`/api/match-runs/${runId}/report`, appState.token);
    appState.report = data.report;
  } catch (error) {
    if (error instanceof Error && !error.message.includes('Report not found')) throw error;
    appState.report = null;
  }
}

export function startManualProfile(): void {
  appState.generatedProfileMeta = null;
  appState.draftProfile = {
    company_name: '',
    credit_code: '',
    city: '深圳市',
    district: '龙华区',
    registered_year: new Date().getFullYear(),
    listed_status: 'unknown',
    employee_count: 0,
    industry: '',
    main_business: '',
    main_products: [],
    customer_type: [],
    business_model: 'other',
    main_revenue_source: '',
    revenue_last_year: 0,
    profit_last_year: 0,
    tax_paid_last_year: 0,
    rd_expense_last_year: 0,
    rd_expense_ratio: 0,
    rd_employee_count: 0,
    is_high_tech_enterprise: false,
    is_tech_sme: false,
    has_specialized_new_sme: false,
    patent_count: 0,
    software_copyright_count: 0,
    tax_credit_level: 'unknown',
    has_major_violation: false,
    social_security_normal: true,
    apply_project_name: '',
    project_direction: '',
    project_stage: 'planning',
    project_budget: 0,
    registered_capital: 0,
    business_address: '',
    legal_representative: '',
    establishment_date: '',
    registration_status: '',
    known_projects: [],
    production_projects: [],
    employee_range: 'unknown',
    revenue_range: 'unknown',
    profit_range: 'unknown',
    tax_paid_range: 'unknown',
    rd_expense_range: 'unknown',
    rd_employee_range: 'unknown',
    project_budget_range: 'unknown'
  };
}

export function setArrayField(field: 'main_products' | 'customer_type' | 'known_projects' | 'production_projects', value: string): void {
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
  appState.draftProfile[field] = values;
}

export function applyAmountRange(
  field: 'revenue_last_year' | 'tax_paid_last_year' | 'rd_expense_last_year' | 'project_budget',
  range: AmountRange
): void {
  if (!appState.draftProfile) return;
  const rangeFieldByValueField = {
    revenue_last_year: 'revenue_range',
    tax_paid_last_year: 'tax_paid_range',
    rd_expense_last_year: 'rd_expense_range',
    project_budget: 'project_budget_range'
  } as const;
  appState.draftProfile[rangeFieldByValueField[field]] = range;
  appState.draftProfile[field] = amountRangeValue[range];
  updateRdExpenseRatio();
}

export function applyProfitRange(range: ProfitRange): void {
  if (!appState.draftProfile) return;
  appState.draftProfile.profit_range = range;
  appState.draftProfile.profit_last_year = profitRangeValue[range];
}

export function applyEmployeeRange(range: EmployeeRange): void {
  if (!appState.draftProfile) return;
  appState.draftProfile.rd_employee_range = range;
  appState.draftProfile.rd_employee_count = employeeRangeValue[range];
}

export function applyCompanyEmployeeRange(range: EmployeeRange): void {
  if (!appState.draftProfile) return;
  appState.draftProfile.employee_range = range;
  appState.draftProfile.employee_count = employeeRangeValue[range];
}

function updateRdExpenseRatio(): void {
  if (!appState.draftProfile) return;
  const revenue = appState.draftProfile.revenue_last_year;
  const rdExpense = appState.draftProfile.rd_expense_last_year;
  appState.draftProfile.rd_expense_ratio = revenue > 0 ? Math.round((rdExpense / revenue) * 1000) / 10 : 0;
}

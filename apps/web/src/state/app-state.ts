import { reactive } from 'vue';
import type { CustomerType, EnterpriseProfile } from '@policy-match/shared';
import {
  api,
  type AiStatus,
  type EnterpriseProfileRecord,
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
  appState.draftProfile = null;
  appState.profiles = [];
  appState.matchRun = null;
  appState.matchResults = [];
  appState.report = null;
  localStorage.removeItem('policy_match_token');
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

export function startManualProfile(): void {
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
    business_address: ''
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

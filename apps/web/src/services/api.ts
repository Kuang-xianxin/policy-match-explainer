import type { CompanyLookupCandidate, CompanyLookupPlan, EnterpriseProfile, FieldSource } from '@policy-match/shared';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface UserResponse {
  user: { id: string; email: string; display_name: string };
  token: string;
}

export interface AiStatus {
  provider: 'deepseek';
  configured: boolean;
  model: string;
  mode: 'deepseek' | 'doubao' | 'mock';
  providers?: {
    deepseek: {
      configured: boolean;
      model: string;
      key_source: string | null;
    };
    doubao: {
      configured: boolean;
      model: string;
      base_url: string;
      key_source: string | null;
    };
  };
}

export interface EnterpriseProfileRecord {
  id: string;
  company_name: string;
  credit_code: string;
  profile: EnterpriseProfile;
  source_type: string;
  verification_status: string;
}

export type Candidate = CompanyLookupCandidate;
export type LookupPlan = CompanyLookupPlan;

export interface GenerateProfileResponse {
  enterprise_profile: EnterpriseProfile;
  field_sources: FieldSource[];
  missing_fields: string[];
  ai_confidence: number;
  ai_mode: 'deepseek' | 'doubao' | 'mock';
}

export interface MatchRun {
  id: string;
  profile_source_type?: string;
  profile_verification_status?: string;
}

export interface MatchResult {
  id: string;
  baseline_score: number;
  baseline_level: string;
  ai_review_summary: string;
  ai_adjustment: number;
  ai_mode: 'deepseek' | 'doubao' | 'mock';
  ai_explanation: string;
  ai_missing_fields: string[];
  ai_suggested_actions: string[];
  final_score: number;
  final_level: string;
  policy: {
    title: string;
    category: string;
    source_url: string;
  };
}

export interface ReportRecord {
  content_text: string;
  model_name: string;
}

export async function api<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem('policy_match_token');
    window.dispatchEvent(new CustomEvent('policy-match-auth-expired'));
  }
  if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
  return data as T;
}

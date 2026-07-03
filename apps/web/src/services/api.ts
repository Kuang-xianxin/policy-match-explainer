import type { CompanyLookupPlan, EnterpriseProfile } from '@policy-match/shared';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export interface UserResponse {
  user: { id: string; email: string; display_name: string };
  token: string;
}

export interface AiStatus {
  provider: 'deepseek';
  configured: boolean;
  model: string;
  mode: 'deepseek' | 'mock';
}

export interface Candidate {
  lookup_id: string;
  company_name: string;
  credit_code: string;
  business_address: string;
  registration_status: string;
  source_name: string;
  source_type?: string;
  confidence?: number;
}

export type LookupPlan = CompanyLookupPlan;

export interface LookupRecord {
  id: string;
}

export interface ExtractResponse {
  lookup: LookupRecord;
  extracted_profile: EnterpriseProfile;
  ai_mode: 'deepseek' | 'mock';
}

export interface EnterpriseProfileRecord {
  id: string;
  company_name: string;
  credit_code: string;
  profile: EnterpriseProfile;
}

export interface MatchRun {
  id: string;
}

export interface MatchResult {
  id: string;
  baseline_score: number;
  baseline_level: string;
  ai_review_summary: string;
  ai_adjustment: number;
  ai_mode: 'deepseek' | 'mock';
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
  if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
  return data as T;
}

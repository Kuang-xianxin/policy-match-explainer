import { z } from 'zod';

export const listedStatusSchema = z.enum([
  'unlisted',
  'listed',
  'new_third_board',
  'pre_listing',
  'unknown'
]);

export const customerTypeSchema = z.enum([
  'government',
  'enterprise',
  'individual',
  'overseas',
  'other'
]);

export const businessModelSchema = z.enum([
  'B2B',
  'B2G',
  'B2C',
  'SaaS',
  'platform',
  'manufacturing',
  'service',
  'other'
]);

export const taxCreditLevelSchema = z.enum(['A', 'B', 'M', 'C', 'D', 'unknown']);
export const projectStageSchema = z.enum(['planning', 'researching', 'developing', 'launched', 'scaling']);
export const matchLevelSchema = z.enum(['recommended', 'potential', 'need_more_info', 'not_recommended']);
export const reportStatusSchema = z.enum(['pending', 'generating', 'completed', 'failed']);
export const amountRangeSchema = z.enum(['unknown', 'none', 'lt_1m', '1m_5m', '5m_20m', '20m_100m', 'gte_100m']);
export const profitRangeSchema = z.enum(['unknown', 'loss', 'break_even', 'lt_500k', '500k_2m', '2m_10m', 'gte_10m']);
export const employeeRangeSchema = z.enum(['unknown', 'lt_10', '10_50', '50_100', '100_300', 'gte_300']);

export const enterpriseProfileSchema = z.object({
  company_name: z.string().min(1),
  credit_code: z.string().min(6),
  city: z.literal('深圳市'),
  district: z.literal('龙华区'),
  registered_year: z.coerce.number().int().min(1900).max(2100),
  listed_status: listedStatusSchema,
  employee_count: z.coerce.number().int().nonnegative(),
  industry: z.string().min(1),
  main_business: z.string().min(1),
  main_products: z.array(z.string()).default([]),
  customer_type: z.array(customerTypeSchema).default([]),
  business_model: businessModelSchema,
  main_revenue_source: z.string().min(1),
  revenue_last_year: z.coerce.number().nonnegative(),
  profit_last_year: z.coerce.number(),
  tax_paid_last_year: z.coerce.number().nonnegative(),
  rd_expense_last_year: z.coerce.number().nonnegative(),
  rd_expense_ratio: z.coerce.number().min(0).max(100),
  rd_employee_count: z.coerce.number().int().nonnegative(),
  is_high_tech_enterprise: z.coerce.boolean(),
  is_tech_sme: z.coerce.boolean(),
  has_specialized_new_sme: z.coerce.boolean(),
  patent_count: z.coerce.number().int().nonnegative(),
  software_copyright_count: z.coerce.number().int().nonnegative(),
  tax_credit_level: taxCreditLevelSchema,
  has_major_violation: z.coerce.boolean(),
  social_security_normal: z.coerce.boolean(),
  apply_project_name: z.string().min(1),
  project_direction: z.string().min(1),
  project_stage: projectStageSchema,
  project_budget: z.coerce.number().nonnegative(),
  registered_capital: z.coerce.number().nonnegative().optional(),
  business_address: z.string().optional(),
  is_headquarters: z.coerce.boolean().optional(),
  is_above_scale_enterprise: z.coerce.boolean().optional(),
  digital_transformation_status: z.string().optional(),
  award_titles: z.array(z.string()).optional(),
  employee_range: employeeRangeSchema.optional(),
  revenue_range: amountRangeSchema.optional(),
  profit_range: profitRangeSchema.optional(),
  tax_paid_range: amountRangeSchema.optional(),
  rd_expense_range: amountRangeSchema.optional(),
  rd_employee_range: employeeRangeSchema.optional(),
  project_budget_range: amountRangeSchema.optional()
});

export const profileFieldSourceTypeSchema = z.enum([
  'manual',
  'official_open_data',
  'official_public_page',
  'commercial_api',
  'local_seed',
  'inferred'
]);

export const companyLookupSearchSchema = z.object({
  query_name: z.string().min(2)
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const createMatchRunSchema = z.object({
  enterprise_profile_id: z.string().uuid()
});

export type ListedStatus = z.infer<typeof listedStatusSchema>;
export type CustomerType = z.infer<typeof customerTypeSchema>;
export type BusinessModel = z.infer<typeof businessModelSchema>;
export type TaxCreditLevel = z.infer<typeof taxCreditLevelSchema>;
export type ProjectStage = z.infer<typeof projectStageSchema>;
export type MatchLevel = z.infer<typeof matchLevelSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type AmountRange = z.infer<typeof amountRangeSchema>;
export type ProfitRange = z.infer<typeof profitRangeSchema>;
export type EmployeeRange = z.infer<typeof employeeRangeSchema>;
export type EnterpriseProfile = z.infer<typeof enterpriseProfileSchema>;
export type ProfileFieldSourceType = z.infer<typeof profileFieldSourceTypeSchema>;

export interface FieldSource {
  field_key: keyof EnterpriseProfile | string;
  source_name: string;
  source_type: ProfileFieldSourceType;
  confidence: number;
  is_user_confirmed: boolean;
}

export interface CompanyLookupPlan {
  normalized_query: string;
  search_keywords: string[];
  recommended_sources: string[];
  explanation: string;
  ai_mode: 'deepseek' | 'mock';
}

export interface CompanyLookupCandidate {
  lookup_id: string;
  company_name: string;
  credit_code: string;
  business_address: string;
  registration_status: string;
  source_name: string;
  source_type?: string;
  confidence?: number;
}

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'includes_any'
  | 'is_true'
  | 'is_false';

export interface PolicyRule {
  field_key: string;
  operator: RuleOperator;
  expected_value: unknown;
  weight: number;
  required: boolean;
  evidence_text: string;
}

export interface Policy {
  id: string;
  title: string;
  category: string;
  source_url: string;
  status: 'active' | 'expired' | 'unknown';
  policy_text: string;
  rules: PolicyRule[];
}

export interface MatchedCondition {
  field_key: string;
  evidence_text: string;
  score: number;
}

export interface MissingCondition {
  field_key: string;
  expected_value: unknown;
  evidence_text: string;
  required: boolean;
}

export interface BaselineMatchResult {
  policy_id: string;
  policy_title: string;
  baseline_score: number;
  baseline_level: MatchLevel;
  matched_conditions: MatchedCondition[];
  missing_conditions: MissingCondition[];
  risk_notes: string[];
  hard_failures: string[];
}

export interface AiMatchReview {
  ai_review_summary: string;
  ai_explanation: string;
  ai_missing_fields: string[];
  ai_suggested_actions: string[];
  ai_confidence: number;
  ai_adjustment: number;
  ai_mode: 'deepseek' | 'mock';
}

export interface PolicyMatchResult extends BaselineMatchResult, AiMatchReview {
  final_score: number;
  final_level: MatchLevel;
  source_url: string;
  category: string;
}

export interface ApiErrorResponse {
  error_code: string;
  message: string;
  details?: unknown;
}

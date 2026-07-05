CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_lookup_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_name text NOT NULL,
  selected_company_name text NOT NULL,
  selected_credit_code text NOT NULL,
  source_name text NOT NULL,
  source_type text NOT NULL,
  raw_payload jsonb NOT NULL,
  mapped_profile jsonb,
  field_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_extracted_profile jsonb,
  ai_confidence numeric,
  ai_model_name text,
  ai_prompt_snapshot text,
  ai_error_message text,
  confidence numeric NOT NULL DEFAULT 0,
  is_imported boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enterprise_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  credit_code text NOT NULL,
  profile jsonb NOT NULL,
  field_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_type text NOT NULL DEFAULT 'manual',
  verification_status text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE enterprise_profiles ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE enterprise_profiles ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual';
ALTER TABLE enterprise_profiles ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL UNIQUE,
  document_type text NOT NULL,
  title text NOT NULL,
  source_site text NOT NULL DEFAULT '龙华政府在线',
  source_department text,
  list_url text,
  publish_date date,
  content_text text NOT NULL DEFAULT '',
  raw_html text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id uuid REFERENCES source_documents(id) ON DELETE SET NULL,
  title text NOT NULL UNIQUE,
  category text NOT NULL,
  source_url text NOT NULL,
  status text NOT NULL,
  policy_text text NOT NULL,
  rules jsonb NOT NULL,
  publish_date date,
  source_department text,
  document_type text NOT NULL DEFAULT 'policy_file',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE policies ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES source_documents(id) ON DELETE SET NULL;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS publish_date date;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS source_department text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'policy_file';
ALTER TABLE policies ADD COLUMN IF NOT EXISTS raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS match_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enterprise_profile_id uuid NOT NULL REFERENCES enterprise_profiles(id) ON DELETE CASCADE,
  profile_snapshot jsonb NOT NULL,
  profile_field_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  profile_source_type text NOT NULL DEFAULT 'manual',
  profile_verification_status text NOT NULL DEFAULT 'manual',
  baseline_status text NOT NULL DEFAULT 'completed',
  ai_review_status text NOT NULL DEFAULT 'completed',
  ai_model_name text,
  ai_prompt_snapshot text,
  ai_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE match_runs ADD COLUMN IF NOT EXISTS profile_field_sources jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE match_runs ADD COLUMN IF NOT EXISTS profile_source_type text NOT NULL DEFAULT 'manual';
ALTER TABLE match_runs ADD COLUMN IF NOT EXISTS profile_verification_status text NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_run_id uuid NOT NULL REFERENCES match_runs(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  baseline_score integer NOT NULL,
  baseline_level text NOT NULL,
  matched_conditions jsonb NOT NULL,
  missing_conditions jsonb NOT NULL,
  risk_notes jsonb NOT NULL,
  hard_failures jsonb NOT NULL,
  ai_review_summary text NOT NULL,
  ai_explanation text NOT NULL,
  ai_missing_fields jsonb NOT NULL,
  ai_suggested_actions jsonb NOT NULL,
  ai_confidence numeric NOT NULL,
  ai_adjustment integer NOT NULL,
  ai_mode text NOT NULL,
  final_score integer NOT NULL,
  final_level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_run_id uuid NOT NULL REFERENCES match_runs(id) ON DELETE CASCADE,
  status text NOT NULL,
  content_text text NOT NULL,
  model_name text NOT NULL,
  prompt_snapshot text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_profiles_user_id ON enterprise_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_lookup_user_id ON company_lookup_records(user_id);
CREATE INDEX IF NOT EXISTS idx_source_documents_type ON source_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_source_documents_publish_date ON source_documents(publish_date);
CREATE INDEX IF NOT EXISTS idx_source_documents_department ON source_documents(source_department);
CREATE INDEX IF NOT EXISTS idx_policies_document_type ON policies(document_type);
CREATE INDEX IF NOT EXISTS idx_policies_publish_date ON policies(publish_date);
CREATE INDEX IF NOT EXISTS idx_match_runs_user_id ON match_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_match_results_run_id ON match_results(match_run_id);
CREATE INDEX IF NOT EXISTS idx_reports_run_id ON reports(match_run_id);

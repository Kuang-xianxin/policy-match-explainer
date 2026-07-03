import cors from 'cors';
import express, { type Request, type Response, type NextFunction } from 'express';
import {
  createMatchRunSchema,
  enterpriseProfileSchema,
  loginSchema,
  registerSchema,
  type EnterpriseProfile,
  type Policy
} from '@policy-match/shared';
import { generateReport, reviewPolicyMatch } from '@policy-match/ai';
import { evaluatePolicy, levelFromFinalScore } from '@policy-match/matcher';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { createSession, hashPassword, hashToken, requireAuth, verifyPassword, type AuthenticatedRequest } from './services/auth.js';

function asyncHandler<T extends Request>(handler: (req: T, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req as T, res).catch(next);
  };
}

function aiConfig() {
  return {
    apiKey: env.deepseekApiKey,
    model: env.deepseekModel,
    baseUrl: env.deepseekBaseUrl
  };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, database: 'postgresql' });
  });

  app.get('/api/ai/status', (_req, res) => {
    res.json({
      provider: 'deepseek',
      configured: Boolean(env.deepseekApiKey && env.deepseekApiKey.trim().length > 0),
      model: env.deepseekModel,
      mode: env.deepseekApiKey ? 'deepseek' : 'mock',
      key_source: env.deepseekApiKeySource ?? null
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

  app.post('/api/enterprise-profiles', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const profile = enterpriseProfileSchema.parse(req.body);
    const created = await pool.query(
      `
      INSERT INTO enterprise_profiles (user_id, company_name, credit_code, profile)
      VALUES ($1, $2, $3, $4::jsonb)
      RETURNING *
      `,
      [req.user.id, profile.company_name, profile.credit_code, JSON.stringify(profile)]
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
    const runResult = await pool.query(
      `
      INSERT INTO match_runs (user_id, enterprise_profile_id, profile_snapshot, ai_model_name, ai_prompt_snapshot)
      VALUES ($1, $2, $3::jsonb, $4, $5)
      RETURNING *
      `,
      [req.user.id, profileRecord.id, JSON.stringify(profile), env.deepseekApiKey ? env.deepseekModel : 'mock', 'review_policy_match_v1']
    );
    const run = runResult.rows[0];
    const policiesResult = await pool.query('SELECT id, title, category, source_url, status, policy_text, rules FROM policies ORDER BY title');
    const results = [];

    for (const policy of policiesResult.rows as Policy[]) {
      const baseline = evaluatePolicy(profile, policy);
      const aiReview = await reviewPolicyMatch(profile, policy, baseline, aiConfig());
      const hasHardFailure = baseline.hard_failures.length > 0;
      const finalScore = hasHardFailure
        ? baseline.baseline_score
        : clampScore(baseline.baseline_score + aiReview.ai_adjustment);
      const finalLevel = levelFromFinalScore(finalScore, baseline.baseline_level, hasHardFailure);
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
          JSON.stringify(baseline.missing_conditions),
          JSON.stringify(baseline.risk_notes),
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
    res.json({ match_run: run, results: results.rows });
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
    if (message.includes('duplicate key')) {
      res.status(409).json({ error_code: 'VALIDATION_ERROR', message: 'Resource already exists.' });
      return;
    }
    res.status(400).json({ error_code: 'VALIDATION_ERROR', message, details: error });
  });

  return app;
}

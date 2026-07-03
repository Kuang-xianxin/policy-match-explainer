import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { closePool } from '../db/pool.js';
import { resetDatabase } from '../db/reset.js';
import { seedPolicies } from '../db/seed.js';

const app = createApp();

async function register(email: string) {
  const response = await request(app).post('/api/auth/register').send({
    email,
    password: 'secret123',
    display_name: email.split('@')[0]
  });
  expect(response.status).toBe(201);
  return response.body.token as string;
}

describe('policy match MVP flow', () => {
  beforeAll(async () => {
    await resetDatabase();
    await seedPolicies();
  });

  afterAll(async () => {
    await closePool();
  });

  it('runs company lookup, AI extraction, profile import, matching, and report on PostgreSQL', async () => {
    const token = await register('demo@example.com');

    const health = await request(app).get('/health');
    expect(health.body.database).toBe('postgresql');

    const aiStatus = await request(app).get('/api/ai/status');
    expect(aiStatus.body.provider).toBe('deepseek');
    expect(aiStatus.body).toHaveProperty('configured');

    const lookupSearch = await request(app)
      .post('/api/company-lookup/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query_name: '龙华智造' });
    expect(lookupSearch.status).toBe(200);
    expect(lookupSearch.body.lookup_plan.ai_mode).toMatch(/deepseek|mock/);
    expect(lookupSearch.body.lookup_plan.search_keywords.length).toBeGreaterThan(0);
    expect(lookupSearch.body.candidates.length).toBeGreaterThan(0);
    expect(lookupSearch.body.candidates[0].source_type).toBe('demo_seed');

    const lookupId = lookupSearch.body.candidates[0].lookup_id as string;
    const extracted = await request(app)
      .post(`/api/company-lookup/${lookupId}/ai-extract`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(extracted.status).toBe(200);
    expect(extracted.body.ai_mode).toMatch(/deepseek|mock/);
    expect(extracted.body.extracted_profile.company_name).toContain('龙华');

    const imported = await request(app)
      .post(`/api/company-lookup/${lookupId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(imported.status).toBe(201);
    const profileId = imported.body.enterprise_profile.id as string;

    const matchRun = await request(app)
      .post('/api/match-runs')
      .set('Authorization', `Bearer ${token}`)
      .send({ enterprise_profile_id: profileId });
    expect(matchRun.status).toBe(201);
    expect(matchRun.body.results.length).toBe(3);
    expect(matchRun.body.results[0].final_score).toBeGreaterThanOrEqual(0);

    const runId = matchRun.body.match_run.id as string;
    const report = await request(app)
      .post(`/api/match-runs/${runId}/report`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(report.status).toBe(201);
    expect(report.body.report.content_text).toContain('综合结论');
  });

  it('does not fabricate company candidates when the configured provider has no match', async () => {
    const token = await register('missing@example.com');

    const lookupSearch = await request(app)
      .post('/api/company-lookup/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ query_name: 'NoSuchCompanyABCXYZ' });

    expect(lookupSearch.status).toBe(200);
    expect(lookupSearch.body.lookup_plan.ai_mode).toMatch(/deepseek|mock/);
    expect(lookupSearch.body.candidates).toEqual([]);
  });

  it('prevents users from reading another user profile or match run', async () => {
    const tokenA = await register('owner@example.com');
    const tokenB = await register('other@example.com');

    const lookupSearch = await request(app)
      .post('/api/company-lookup/search')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ query_name: '龙华智造' });
    const lookupId = lookupSearch.body.candidates[0].lookup_id as string;
    await request(app).post(`/api/company-lookup/${lookupId}/ai-extract`).set('Authorization', `Bearer ${tokenA}`).send();
    const imported = await request(app).post(`/api/company-lookup/${lookupId}/import`).set('Authorization', `Bearer ${tokenA}`).send();
    const profileId = imported.body.enterprise_profile.id as string;
    const matchRun = await request(app)
      .post('/api/match-runs')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ enterprise_profile_id: profileId });
    const runId = matchRun.body.match_run.id as string;

    const profileLeak = await request(app).get(`/api/enterprise-profiles/${profileId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(profileLeak.status).toBe(404);

    const runLeak = await request(app).get(`/api/match-runs/${runId}`).set('Authorization', `Bearer ${tokenB}`);
    expect(runLeak.status).toBe(404);
  });
});
